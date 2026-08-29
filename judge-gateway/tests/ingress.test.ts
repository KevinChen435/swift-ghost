import assert from "node:assert/strict";
import test from "node:test";
import { fetchHandler } from "../src/ingress";
import type { Env, JudgeQueueMessage } from "../src/types";

function submission() {
  return {
    version: "judge.submission.v1",
    submissionId: "submission-1",
    language: "python3",
    runtime: "python-3.13-linux",
    contentRevision: 1,
    judgeRevision: 1,
    contractDigest: "a".repeat(64),
    source: "print(input())",
    tests: [{ id: "one", input: "a\n", expectedOutput: "a\n" }],
    callbackUrl: "https://app.example.com/internal/judge-results",
  };
}

function makeEnv(sent: JudgeQueueMessage[]): Env {
  return {
    JUDGE_SANDBOX: {},
    JUDGE_QUEUE: { async send(message) { sent.push(message); } },
    INGRESS_SERVICE_TOKEN: "i".repeat(32),
    CALLBACK_HMAC_SECRET: "c".repeat(32),
    CALLBACK_ALLOWED_ORIGINS: "https://app.example.com",
  };
}

test("authenticated ingress validates and enqueues a normalized submission", async () => {
  const sent: JudgeQueueMessage[] = [];
  const response = await fetchHandler(
    new Request("https://judge.example.com/v1/submissions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${"i".repeat(32)}` },
      body: JSON.stringify(submission()),
    }),
    makeEnv(sent),
  );
  assert.equal(response.status, 202);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.kind, "submission");
});

test("ingress fails closed for missing auth and weak runtime secrets", async () => {
  const sent: JudgeQueueMessage[] = [];
  const body = JSON.stringify(submission());
  const unauthorized = await fetchHandler(
    new Request("https://judge.example.com/v1/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
    makeEnv(sent),
  );
  assert.equal(unauthorized.status, 401);
  const weak = makeEnv(sent);
  weak.INGRESS_SERVICE_TOKEN = "short";
  const unconfigured = await fetchHandler(
    new Request("https://judge.example.com/v1/submissions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer short" },
      body,
    }),
    weak,
  );
  assert.equal(unconfigured.status, 503);
  assert.equal(sent.length, 0);
});

test("authenticated execution ingress enqueues a distinct Swift rehearsal message", async () => {
  const sent: JudgeQueueMessage[] = [];
  const body = {
    version: "judge.execution.v1",
    executionId: "execution-123",
    source: "import Foundation\n@main struct Main {}",
    cases: [{ id: "case-1", input: "{\"args\":[1]}\n" }],
    callbackUrl: "https://app.example.com/internal/judge-results",
  };
  const response = await fetchHandler(
    new Request("https://judge.example.com/v1/executions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${"i".repeat(32)}` },
      body: JSON.stringify(body),
    }),
    makeEnv(sent),
  );
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { executionId: "execution-123", status: "queued" });
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.kind, "execution");
  if (sent[0]?.kind === "execution") {
    assert.deepEqual(sent[0].request.cases, body.cases);
    assert.equal("runtime" in sent[0].request, false);
    assert.equal("expectedOutput" in sent[0].request, false);
  }
});

test("execution ingress rejects expected values and untrusted runtime metadata", async () => {
  const sent: JudgeQueueMessage[] = [];
  for (const field of ["expectedOutput", "runtime", "entrypoint", "contentRevision", "judgeRevision", "contractDigest"]) {
    const body = {
      version: "judge.execution.v1",
      executionId: "execution-123",
      source: "import Foundation\n@main struct Main {}",
      cases: [{ id: "case-1", input: "", ...(field === "expectedOutput" ? { expectedOutput: "secret" } : {}) }],
      callbackUrl: "https://app.example.com/internal/judge-results",
      ...(field === "expectedOutput" ? {} : { [field]: "client-controlled" }),
    };
    const response = await fetchHandler(
      new Request("https://judge.example.com/v1/executions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${"i".repeat(32)}` },
        body: JSON.stringify(body),
      }),
      makeEnv(sent),
    );
    assert.equal(response.status, 400, field);
  }
  assert.equal(sent.length, 0);
});
