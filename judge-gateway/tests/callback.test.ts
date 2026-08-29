import assert from "node:assert/strict";
import test from "node:test";
import { deliverCallback, deliverExecutionCallback } from "../src/callback";
import type { CallbackQueueMessage, Env, ExecutionCallbackQueueMessage } from "../src/types";

const message: CallbackQueueMessage = {
  kind: "callback",
  callbackUrl: "https://app.example.com/internal/judge-results",
  result: {
    version: "judge.result.v1",
    submissionId: "submission-1",
    language: "python3",
    runtime: "python-3.13-linux",
    contentRevision: 1,
    judgeRevision: 1,
    contractDigest: "a".repeat(64),
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

test("callback accepts bounded public sample results without expected values", async () => {
  const sample = structuredClone(message) as CallbackQueueMessage;
  sample.result.publicCaseResults = [
    { id: "sample-1", status: "passed", actualOutput: "answer\n" },
    { id: "sample-2", status: "not-run" },
  ];
  sample.result.total = 2;
  sample.result.passed = 1;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  try {
    await deliverCallback(sample, env());
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callback rejects public output that exceeds its independent bound", async () => {
  const oversized = structuredClone(message) as CallbackQueueMessage;
  oversized.result.publicCaseResults = [
    { id: "sample-1", status: "passed", actualOutput: "x".repeat(4_097) },
    { id: "sample-2", status: "not-run" },
  ];
  oversized.result.total = 2;
  oversized.result.passed = 1;
  await assert.rejects(() => deliverCallback(oversized, env()), /contract validation/);
});

test("callback rejects unsanitized public terminal controls", async () => {
  const unsafe = structuredClone(message) as CallbackQueueMessage;
  unsafe.result.publicCaseResults = [
    { id: "sample-1", status: "passed", actualOutput: "answer\u001b[2J" },
    { id: "sample-2", status: "not-run" },
  ];
  await assert.rejects(() => deliverCallback(unsafe, env()), /contract validation/);
});

const executionMessage: ExecutionCallbackQueueMessage = {
  kind: "execution-callback",
  callbackUrl: "https://app.example.com/internal/judge-results",
  result: {
    version: "judge.execution.result.v1",
    executionId: "execution-1",
    language: "swift6",
    runtime: "swift-6.3.3-linux",
    executed: 1,
    total: 2,
    cases: [
      { id: "case-1", status: "executed", actualOutput: "1\n" },
      { id: "case-2", status: "runtime-error", actualOutput: "partial\n", diagnostic: "Execution exited with a non-zero status" },
    ],
  },
};

test("execution callback uses its distinct result and idempotency contract", async () => {
  const originalFetch = globalThis.fetch;
  let captured: Request | undefined;
  globalThis.fetch = async (input, init) => {
    captured = new Request(input, init);
    return new Response(null, { status: 204 });
  };
  try {
    await deliverExecutionCallback(executionMessage, env());
    assert.equal(captured?.headers.get("idempotency-key"), "judge-execution-result:execution-1");
    assert.match(captured?.headers.get("x-judge-signature") ?? "", /^sha256=[0-9a-f]{64}$/);
    assert.deepEqual(JSON.parse(await captured!.text()), executionMessage.result);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("execution callback rejects expected values, hidden metadata, and malformed per-case statuses", async () => {
  const forbidden = structuredClone(executionMessage) as ExecutionCallbackQueueMessage;
  (forbidden.result as unknown as Record<string, unknown>).expectedOutput = "secret";
  await assert.rejects(() => deliverExecutionCallback(forbidden, env()), /contract validation/);

  const malformed = structuredClone(executionMessage) as ExecutionCallbackQueueMessage;
  malformed.result.cases[0] = { id: "case-1", status: "executed" };
  await assert.rejects(() => deliverExecutionCallback(malformed, env()), /contract validation/);

  const mismatch = structuredClone(executionMessage) as ExecutionCallbackQueueMessage;
  mismatch.result.executed = 0;
  await assert.rejects(() => deliverExecutionCallback(mismatch, env()), /contract validation/);
});

test("execution callback rejects unsanitized or oversized observed output", async () => {
  const oversized = structuredClone(executionMessage) as ExecutionCallbackQueueMessage;
  oversized.result.cases[0]!.actualOutput = "x".repeat(4_097);
  await assert.rejects(() => deliverExecutionCallback(oversized, env()), /contract validation/);

  const unsafe = structuredClone(executionMessage) as ExecutionCallbackQueueMessage;
  unsafe.result.cases[0]!.actualOutput = "answer\u001b[2J";
  await assert.rejects(() => deliverExecutionCallback(unsafe, env()), /contract validation/);
});
