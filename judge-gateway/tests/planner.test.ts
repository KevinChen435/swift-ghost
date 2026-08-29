import assert from "node:assert/strict";
import test from "node:test";
import { buildExecutionPlan, buildExecutionPreparationPlan, buildPlan, buildPreparationPlan, normalizeOutput, parseRunnerResponse, sourcePath } from "../src/planner";
import { CONTRACT_VERSION, EXECUTION_CONTRACT_VERSION, type ExecutionRequest, type SubmissionRequest } from "../src/types";

const request: SubmissionRequest = {
  version: CONTRACT_VERSION,
  submissionId: "submission-1",
  language: "python3",
  runtime: "python-3.13-linux",
  contentRevision: 1,
  judgeRevision: 1,
  contractDigest: "a".repeat(64),
  source: "print(input())",
  comparison: "exact",
  tests: [
    { id: "one", input: "a\n", expectedOutput: "secret-a\n", visibility: "hidden" },
    { id: "two", input: "b\n", expectedOutput: "secret-b\n", visibility: "hidden" },
  ],
  callbackUrl: "https://app.example.com/callback",
};

test("plans exactly one exec per input without embedding expected outputs", () => {
  const plans = buildPlan(request, 4_000, 65_536);
  assert.equal(plans.length, 2);
  assert.deepEqual(plans.map((plan) => plan.stdin), ["a\n", "b\n"]);
  for (const plan of plans) {
    assert.equal(plan.command.includes("secret"), false);
    assert.equal(plan.command.includes(request.source), false);
  }
});

test("Swift plans one bounded compile followed by fixed binary executions", () => {
  const swift: SubmissionRequest = {
    ...request,
    language: "swift6",
    runtime: "swift-6.3.3-linux",
    source: "print(readLine() ?? \"\")",
  };
  assert.equal(sourcePath(swift), "/workspace/main.swift");
  const preparation = buildPreparationPlan(swift, 65_536, 12_345);
  assert.match(preparation?.command ?? "", /swift-compile/);
  assert.match(preparation?.command ?? "", /12345/);
  assert.equal(preparation?.sdkTimeoutMs, 14_345);
  assert.doesNotMatch(preparation?.command ?? "", /secret/);
  const plans = buildPlan(swift, 4_000, 65_536);
  assert.equal(plans.length, 2);
  assert.ok(plans.every((plan) => plan.command.includes("swift-run")));
  assert.ok(plans.every((plan) => !plan.command.includes("secret")));
});

test("normalizes CRLF but only trims a final newline when requested", () => {
  assert.equal(normalizeOutput("a\r\n", "exact"), "a\n");
  assert.equal(normalizeOutput("a\r\n", "trim-final-newline"), "a");
  assert.equal(normalizeOutput("a\n\n", "trim-final-newline"), "a\n");
});

test("parses only the bounded trusted runner protocol", () => {
  const response = parseRunnerResponse(
    {
      success: true,
      exitCode: 0,
      stdout: JSON.stringify({
        version: 1,
        exitCode: 0,
        timedOut: false,
        outputLimited: false,
        stdoutBase64: btoa("answer\n"),
        stderrBase64: "",
      }),
      stderr: "",
    },
    1_024,
  );
  assert.equal(response.stdout, "answer\n");
  assert.throws(() => parseRunnerResponse({ success: true, exitCode: 0, stdout: "{}", stderr: "" }, 1_024));
});

test("base64 protocol accepts worst-case control bytes up to each stream limit", () => {
  const bytes = new Uint8Array(1_024);
  const binary = String.fromCharCode(...bytes);
  const encoded = btoa(binary);
  const response = parseRunnerResponse(
    {
      success: true,
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({
        version: 1,
        exitCode: 0,
        timedOut: false,
        outputLimited: false,
        stdoutBase64: encoded,
        stderrBase64: encoded,
      }),
    },
    1_024,
  );
  assert.equal(response.stdout.length, 1_024);
  assert.equal(response.stderr.length, 1_024);
});

test("plans Swift rehearsal inputs without embedding expected values or client metadata", () => {
  const execution: ExecutionRequest = {
    version: EXECUTION_CONTRACT_VERSION,
    executionId: "execution-1",
    source: "trusted wrapped source",
    cases: [
      { id: "case-1", input: "first\n" },
      { id: "case-2", input: "second\n" },
    ],
    callbackUrl: "https://app.example.com/callback",
  };
  const preparation = buildExecutionPreparationPlan(65_536, 12_345);
  assert.match(preparation.command, /swift-compile/);
  assert.match(preparation.command, /12345/);
  assert.equal(preparation.sdkTimeoutMs, 14_345);
  const plans = buildExecutionPlan(execution, 4_000, 65_536);
  assert.deepEqual(plans.map((plan) => plan.stdin), ["first\n", "second\n"]);
  assert.ok(plans.every((plan) => plan.command.includes("swift-run")));
  assert.ok(plans.every((plan) => !plan.command.includes("expectedOutput")));
  assert.ok(plans.every((plan) => !plan.command.includes("trusted wrapped source")));
});
