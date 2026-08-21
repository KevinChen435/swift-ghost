import { signPayload } from "./auth";
import { parsePositiveInt, secretIsStrong, validateCallbackUrl } from "./schema";
import type { CallbackQueueMessage, Env } from "./types";

const VERDICTS = new Set(["accepted", "wrong-answer", "compile-error", "runtime-error", "time-limit", "judge-error"]);
const PUBLIC_CASE_STATUSES = new Set([
  "passed",
  "failed",
  "compile-error",
  "runtime-error",
  "time-limit",
  "judge-error",
  "not-run",
]);
const PUBLIC_OUTPUT_MAX_BYTES = 4_096;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const UNSAFE_PUBLIC_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;

function assertCallbackResult(message: CallbackQueueMessage): void {
  const result = message.result as unknown as Record<string, unknown>;
  if (
    typeof result !== "object" ||
    result === null ||
    result.version !== "judge.result.v1" ||
    typeof result.submissionId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(result.submissionId) ||
    (result.language !== "python3" && result.language !== "swift6") ||
    typeof result.runtime !== "string" ||
    result.runtime.length < 1 ||
    result.runtime.length > 80 ||
    !Number.isInteger(result.contentRevision) ||
    (result.contentRevision as number) < 1 ||
    !Number.isInteger(result.judgeRevision) ||
    (result.judgeRevision as number) < 1 ||
    typeof result.contractDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(result.contractDigest) ||
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
      (typeof result.diagnostic !== "string" || result.diagnostic.length > 2_000)) ||
    (result.publicCaseResults !== undefined &&
      (!Array.isArray(result.publicCaseResults) ||
        result.publicCaseResults.length !== (result.total as number) ||
        new Set(result.publicCaseResults.map((entry) =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry) && typeof (entry as Record<string, unknown>).id === "string"
            ? (entry as Record<string, unknown>).id
            : "",
        )).size !== result.publicCaseResults.length ||
        result.publicCaseResults.some((entry) => {
          if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return true;
          const candidate = entry as Record<string, unknown>;
          return (
            typeof candidate.id !== "string" ||
            !ID_PATTERN.test(candidate.id) ||
            typeof candidate.status !== "string" ||
            !PUBLIC_CASE_STATUSES.has(candidate.status) ||
            (candidate.actualOutput !== undefined &&
              (typeof candidate.actualOutput !== "string" ||
                new TextEncoder().encode(candidate.actualOutput).byteLength > PUBLIC_OUTPUT_MAX_BYTES ||
                UNSAFE_PUBLIC_TEXT.test(candidate.actualOutput) ||
                /\u001b\[[0-?]*[ -/]*[@-~]/.test(candidate.actualOutput))) ||
            (candidate.diagnostic !== undefined &&
              (typeof candidate.diagnostic !== "string" ||
                candidate.diagnostic.length > 2_000 ||
                UNSAFE_PUBLIC_TEXT.test(candidate.diagnostic)))
          );
        })))
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
