import assert from "node:assert/strict";
import test from "node:test";
import { processQueueBatch } from "../src/queue";
import type { CallbackQueueMessage, Env, ExecutionCallbackQueueMessage, ExecutionQueueMessage, JudgeQueueMessage, QueueRecord, SandboxFactory } from "../src/types";

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
    language: "python3",
    runtime: "python-3.13-linux",
    contentRevision: 1,
    judgeRevision: 1,
    contractDigest: "a".repeat(64),
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

test("execution queue compiles/runs in its own lane and emits an execution callback", async () => {
  const sent: JudgeQueueMessage[] = [];
  const execution: ExecutionQueueMessage = {
    kind: "execution",
    request: {
      version: "judge.execution.v1",
      executionId: "execution-1",
      source: "import Foundation\n@main struct Main {}",
      cases: [{ id: "case-1", input: "{\"args\":[1]}\n" }],
      callbackUrl: "https://app.example.com/internal/judge-results",
    },
  };
  const { message, state } = record(execution);
  const factory: SandboxFactory = {
    create() {
      return {
        async writeFile() {},
        async exec(command) {
          return {
            success: true,
            exitCode: 0,
            stdout: JSON.stringify({
              version: 1,
              exitCode: 0,
              timedOut: false,
              outputLimited: false,
              stdoutBase64: command.includes("swift-compile") ? "" : btoa("observed\n"),
              stderrBase64: "",
            }),
            stderr: "",
          };
        },
        async destroy() {},
      };
    },
  };
  await processQueueBatch({ messages: [message] }, { ...env(), JUDGE_QUEUE: { async send(item) { sent.push(item); } } }, factory);
  assert.equal(state.acked, true);
  assert.equal(state.retried, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.kind, "execution-callback");
  assert.equal((sent[0] as ExecutionCallbackQueueMessage).result.version, "judge.execution.result.v1");
});
