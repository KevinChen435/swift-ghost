import { authenticateIngress } from "./auth";
import { parseExecution, parsePositiveInt, parseSubmission, secretIsStrong, ValidationError } from "./schema";
import type { Env } from "./types";

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

function error(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel("request body too large");
      throw new ValidationError("request body is too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function fetchHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    const configured =
      secretIsStrong(env.CALLBACK_HMAC_SECRET) &&
      (secretIsStrong(env.INGRESS_HMAC_SECRET) || secretIsStrong(env.INGRESS_SERVICE_TOKEN)) &&
      !env.CALLBACK_ALLOWED_ORIGINS.includes("REPLACE");
    return json({ ok: true, configured, service: "swift-ghost-judge-gateway" });
  }
  const submissionRoute = request.method === "POST" && url.pathname === "/v1/submissions";
  const executionRoute = request.method === "POST" && url.pathname === "/v1/executions";
  if (!submissionRoute && !executionRoute) {
    return error("not_found", "Route not found", 404);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return error("invalid_content_type", "Content-Type must be application/json", 415);
  }
  if (
    !secretIsStrong(env.CALLBACK_HMAC_SECRET) ||
    (!secretIsStrong(env.INGRESS_HMAC_SECRET) && !secretIsStrong(env.INGRESS_SERVICE_TOKEN))
  ) {
    return error("service_unconfigured", "Required judge secrets are missing or too short", 503);
  }
  const maxBytes = parsePositiveInt(env.MAX_REQUEST_BYTES, 120_000, 1_024, 128_000);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) return error("request_too_large", "Request body is too large", 413);
  let rawBody: string;
  try {
    rawBody = await readBoundedBody(request, maxBytes);
  } catch {
    return error("request_too_large", "Request body is too large or is not UTF-8", 413);
  }
  const authenticated = await authenticateIngress(request, rawBody, {
    ...(secretIsStrong(env.INGRESS_HMAC_SECRET) ? { hmac: env.INGRESS_HMAC_SECRET } : {}),
    ...(secretIsStrong(env.INGRESS_SERVICE_TOKEN) ? { serviceToken: env.INGRESS_SERVICE_TOKEN } : {}),
  });
  if (!authenticated) return error("unauthorized", "Valid service authentication is required", 401);
  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody);
  } catch {
    return error("invalid_json", "Request body is not valid JSON", 400);
  }
  try {
    if (executionRoute) {
      const execution = parseExecution(decoded, env.CALLBACK_ALLOWED_ORIGINS);
      await env.JUDGE_QUEUE.send({ kind: "execution", request: execution }, { contentType: "json" });
      return json({ executionId: execution.executionId, status: "queued" }, 202);
    }
    const submission = parseSubmission(decoded, env.CALLBACK_ALLOWED_ORIGINS);
    await env.JUDGE_QUEUE.send({ kind: "submission", request: submission }, { contentType: "json" });
    return json({ submissionId: submission.submissionId, status: "queued" }, 202);
  } catch (caught) {
    if (caught instanceof ValidationError) return error("invalid_submission", caught.message, 400);
    console.error("submission enqueue failed", caught);
    return error("enqueue_failed", "Submission could not be queued", 503);
  }
}
