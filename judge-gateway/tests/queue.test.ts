import assert from "node:assert/strict";
import test from "node:test";
import { processQueueBatch } from "../src/queue";
import type { CallbackQueueMessage, Env, JudgeQueueMessage, QueueRecord, SandboxFactory } from "../src/types";

function env(): Env {
  return {
    JUDGE_SANDBOX: {},
    JUDGE_QUEUE: { async send() {} },
    CALLBACK_HMAC_SECRET: "c".repeat(32),
    CALLBACK_ALLOWED_ORIGINS: "https://app.example.com",
  };
}

const unusedFactory: SandboxFactory = { create() { throw new Error("not used"); } };

function record(body: JudgeQueueMessage) {
  const state = { acked: false, retried: false, delay: 0 };
  const message: QueueRecord<JudgeQueueMessage> = {
    id: "message-1",
    attempts: 3,
    body,
    ack() { state.acked = true; },
    retry(options) { state.retried = true; state.delay = options?.delaySeconds ?? 0; },
  };
  return { message, state };
}

const callback: CallbackQueueMessage = {
  kind: "callback",
  callbackUrl: "https://app.example.com/internal/judge-results",
  result: {
    version: "judge.result.v1",
    submissionId: "submission-1",
    verdict: "accepted",
    passed: 1,
    total: 1,
  },
};

test("acks a successful callback delivery", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  const { message, state } = record(callback);
  try {
    await processQueueBatch({ messages: [message] }, env(), unusedFactory);
    assert.equal(state.acked, true);
    assert.equal(state.retried, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retries but does not ack a failed callback delivery", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  globalThis.fetch = async () => new Response(null, { status: 503 });
  console.error = () => {};
  const { message, state } = record(callback);
  try {
    await processQueueBatch({ messages: [message] }, env(), unusedFactory);
    assert.equal(state.acked, false);
    assert.equal(state.retried, true);
    assert.equal(state.delay, 8);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});
