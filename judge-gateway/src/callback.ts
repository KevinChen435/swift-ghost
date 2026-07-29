import { signPayload } from "./auth";
import { parsePositiveInt, secretIsStrong, validateCallbackUrl } from "./schema";
import type { CallbackQueueMessage, Env } from "./types";

const VERDICTS = new Set(["accepted", "wrong-answer", "runtime-error", "time-limit", "judge-error"]);

function assertCallbackResult(message: CallbackQueueMessage): void {
  const result = message.result as unknown as Record<string, unknown>;
  if (
    typeof result !== "object" ||
    result === null ||
    result.version !== "judge.result.v1" ||
    typeof result.submissionId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(result.submissionId) ||
    typeof result.verdict !== "string" ||
    !VERDICTS.has(result.verdict) ||
    !Number.isInteger(result.passed) ||
    !Number.isInteger(result.total) ||
    (result.passed as number) < 0 ||
    (result.total as number) < 1 ||
    (result.total as number) > 64 ||
    (result.passed as number) > (result.total as number) ||
    (result.failedCaseIndex !== undefined &&
      (!Number.isInteger(result.failedCaseIndex) ||
        (result.failedCaseIndex as number) < 0 ||
        (result.failedCaseIndex as number) >= (result.total as number))) ||
    (result.diagnostic !== undefined &&
      (typeof result.diagnostic !== "string" || result.diagnostic.length > 2_000))
  ) {
    throw new Error("callback result failed contract validation");
  }
}

export async function deliverCallback(message: CallbackQueueMessage, env: Env): Promise<void> {
  if (!secretIsStrong(env.CALLBACK_HMAC_SECRET)) throw new Error("CALLBACK_HMAC_SECRET is missing or too short");
  assertCallbackResult(message);
  const callbackUrl = validateCallbackUrl(message.callbackUrl, env.CALLBACK_ALLOWED_ORIGINS);
  const body = JSON.stringify(message.result);
  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const signature = await signPayload(env.CALLBACK_HMAC_SECRET, timestamp, body);
  const timeoutMs = parsePositiveInt(env.CALLBACK_TIMEOUT_MS, 10_000, 100, 60_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("callback timeout"), timeoutMs);
  try {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `judge-result:${message.result.submissionId}`,
        "x-judge-timestamp": timestamp,
        "x-judge-signature": signature,
      },
      body,
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`callback returned HTTP ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}
