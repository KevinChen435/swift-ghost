import assert from "node:assert/strict";
import test from "node:test";
import { judgeSubmission } from "../src/core";
import { CONTRACT_VERSION, type SandboxExecResult, type SandboxFactory, type SubmissionRequest } from "../src/types";

function runner(stdout: string, overrides: Partial<Record<"exitCode" | "timedOut" | "outputLimited" | "stderrBase64", unknown>> = {}): SandboxExecResult {
  return {
    success: true,
    exitCode: 0,
    stderr: "",
    stdout: JSON.stringify({
      version: 1,
      exitCode: 0,
      timedOut: false,
      outputLimited: false,
      stdoutBase64: btoa(stdout),
      stderrBase64: "",
      ...overrides,
    }),
  };
}

function submission(): SubmissionRequest {
  return {
    version: CONTRACT_VERSION,
    submissionId: "submission-1",
    language: "python3",
    source: "print(input())",
    comparison: "exact",
    tests: [
      { id: "one", input: "a\n", expectedOutput: "a\n" },
      { id: "two", input: "b\n", expectedOutput: "b\n" },
    ],
    callbackUrl: "https://app.example.com/callback",
  };
}

test("uses a fresh sandbox, sends one input per exec, compares outside, and destroys", async () => {
  const ids: string[] = [];
  const inputs: string[] = [];
  let destroyed = false;
  let executions = 0;
  const factory: SandboxFactory = {
    create(id) {
      ids.push(id);
      return {
        async writeFile(path, content) {
          assert.equal(path, "/workspace/submission.py");
          assert.equal(content, "print(input())");
        },
        async exec(command, options) {
          assert.equal(command.includes("expectedOutput"), false);
          inputs.push(options.stdin);
          const actual = executions++ === 0 ? "a\n" : "b\n";
          return runner(actual);
        },
        async destroy() { destroyed = true; },
      };
    },
  };
  const result = await judgeSubmission(submission(), factory, { timeoutMs: 4_000, outputLimitBytes: 4_096 });
  assert.match(ids[0]!, /^submission-[0-9a-f-]{36}$/);
  assert.deepEqual(inputs, ["a\n", "b\n"]);
  assert.equal(result.verdict, "accepted");
  assert.equal(destroyed, true);
});

test("destroys after a timeout result and stops before later tests", async () => {
  let destroyed = false;
  let executions = 0;
  const factory: SandboxFactory = {
    create() {
      return {
        async writeFile() {},
        async exec() { executions += 1; return runner("", { timedOut: true, exitCode: -9 }); },
        async destroy() { destroyed = true; },
      };
    },
  };
  const result = await judgeSubmission(submission(), factory, { timeoutMs: 4_000, outputLimitBytes: 4_096 });
  assert.equal(result.verdict, "time-limit");
  assert.equal(executions, 1);
  assert.equal(destroyed, true);
});

test("never reflects contestant stderr or hidden input in a runtime-error callback result", async () => {
  const hiddenInput = "hidden-secret-input\n";
  const request = submission();
  request.tests[0]!.input = hiddenInput;
  const factory: SandboxFactory = {
    create() {
      return {
        async writeFile() {},
        async exec() { return runner("", { exitCode: 1, stderrBase64: btoa(hiddenInput) }); },
        async destroy() {},
      };
    },
  };
  const result = await judgeSubmission(request, factory, { timeoutMs: 4_000, outputLimitBytes: 4_096 });
  assert.equal(result.verdict, "runtime-error");
  assert.equal(JSON.stringify(result).includes(hiddenInput.trim()), false);
});
