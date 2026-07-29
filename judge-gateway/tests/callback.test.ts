import assert from "node:assert/strict";
import test from "node:test";
import { deliverCallback } from "../src/callback";
import type { CallbackQueueMessage, Env } from "../src/types";

const message: CallbackQueueMessage = {
  kind: "callback",
  callbackUrl: "https://app.example.com/internal/judge-results",
  result: {
    version: "judge.result.v1",
    submissionId: "submission-1",
    verdict: "accepted",
    passed: 2,
    total: 2,
  },
};

function env(secret = "c".repeat(32)): Env {
  return {
    JUDGE_SANDBOX: {},
    JUDGE_QUEUE: { async send() {} },
    CALLBACK_HMAC_SECRET: secret,
    CALLBACK_ALLOWED_ORIGINS: "https://app.example.com",
  };
}

test("callback signs the exact immutable body and sets its stable settlement key", async () => {
  const originalFetch = globalThis.fetch;
  let captured: Request | undefined;
  globalThis.fetch = async (input, init) => {
    captured = new Request(input, init);
    return new Response(null, { status: 204 });
  };
  try {
    await deliverCallback(message, env());
    assert.equal(captured?.headers.get("idempotency-key"), "judge-result:submission-1");
    assert.match(captured?.headers.get("x-judge-signature") ?? "", /^sha256=[0-9a-f]{64}$/);
    assert.deepEqual(JSON.parse(await captured!.text()), message.result);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callback fails closed before fetch when its signing secret is missing or short", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response(); };
  try {
    await assert.rejects(() => deliverCallback(message, env("short")), /missing or too short/);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callback refuses to sign a malformed queue result", async () => {
  const malformed = structuredClone(message) as CallbackQueueMessage;
  delete (malformed.result as unknown as Record<string, unknown>).submissionId;
  await assert.rejects(() => deliverCallback(malformed, env()), /contract validation/);
});
