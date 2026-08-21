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
    runtime: "python-3.13-linux",
    contentRevision: 1,
    judgeRevision: 1,
    contractDigest: "a".repeat(64),
    source: "print(input())",
    comparison: "exact",
    tests: [
      { id: "one", input: "a\n", expectedOutput: "a\n", visibility: "hidden" },
      { id: "two", input: "b\n", expectedOutput: "b\n", visibility: "hidden" },
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

test("returns bounded sanitized stdout for sample-only runs and never expected output", async () => {
  const request: SubmissionRequest = {
    ...submission(),
    tests: [
      { id: "sample-1", input: "a\n", expectedOutput: "answer\u001b[31m\n", visibility: "sample" },
      { id: "sample-2", input: "b\n", expectedOutput: "unused\n", visibility: "sample" },
    ],
  };
  let executions = 0;
  const factory: SandboxFactory = {
    create() {
      return {
        async writeFile() {},
        async exec() {
          executions += 1;
          return runner(executions === 1 ? "answer\u001b[31m\n" : "wrong\n");
        },
        async destroy() {},
      };
    },
  };
  const result = await judgeSubmission(request, factory, { timeoutMs: 4_000, outputLimitBytes: 4_096 });
  assert.equal(result.verdict, "wrong-answer");
  assert.deepEqual(result.publicCaseResults, [
    { id: "sample-1", status: "passed", actualOutput: "answer\n" },
    { id: "sample-2", status: "failed", actualOutput: "wrong\n" },
  ]);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("expectedOutput"), false);
  assert.equal(serialized.includes("unused"), false);
  assert.equal(serialized.includes("sample-1"), true);
});

test("does not include public case output for sealed runs and marks skipped samples not-run", async () => {
  const request: SubmissionRequest = {
    ...submission(),
    tests: [
      { id: "sample-1", input: "a\n", expectedOutput: "wrong\n", visibility: "sample" },
      { id: "hidden-1", input: "b\n", expectedOutput: "b\n", visibility: "hidden" },
    ],
  };
  const result = await judgeSubmission(request, {
    create() {
      return {
        async writeFile() {},
        async exec() { return runner("actual\n"); },
        async destroy() {},
      };
    },
  }, { timeoutMs: 4_000, outputLimitBytes: 4_096 });
  assert.equal(result.publicCaseResults, undefined);

  const sampleOnly: SubmissionRequest = {
    ...request,
    tests: request.tests.map((test) => ({ ...test, visibility: "sample" as const })),
  };
  const stopped = await judgeSubmission(sampleOnly, {
    create() {
      return {
        async writeFile() {},
        async exec() { return runner("actual\n"); },
        async destroy() {},
      };
    },
  }, { timeoutMs: 4_000, outputLimitBytes: 4_096 });
  assert.deepEqual(stopped.publicCaseResults, [
    { id: "sample-1", status: "failed", actualOutput: "actual\n" },
    { id: "hidden-1", status: "not-run" },
  ]);
});

test("truncates and sanitizes public stdout independently of the runner cap", async () => {
  const request: SubmissionRequest = {
    ...submission(),
    tests: [{ id: "sample", input: "", expectedOutput: "", visibility: "sample" }],
  };
  const result = await judgeSubmission(request, {
    create() {
      return {
        async writeFile() {},
        async exec() { return runner(`${"x".repeat(8_000)}\u0000\u001b[2J`); },
        async destroy() {},
      };
    },
  }, { timeoutMs: 4_000, outputLimitBytes: 16_000 });
  const output = result.publicCaseResults?.[0]?.actualOutput ?? "";
  assert.equal(output.includes("\u0000"), false);
  assert.equal(output.includes("\u001b"), false);
  assert.ok(new TextEncoder().encode(output).byteLength <= 4_096);
  assert.match(output, /output truncated/);
});

test("keeps multibyte public stdout within the byte cap", async () => {
  const request: SubmissionRequest = {
    ...submission(),
    tests: [{ id: "sample", input: "", expectedOutput: "", visibility: "sample" }],
  };
  const result = await judgeSubmission(request, {
    create() {
      return {
        async writeFile() {},
        async exec() { return runner("🙂".repeat(4_000)); },
        async destroy() {},
      };
    },
  }, { timeoutMs: 4_000, outputLimitBytes: 16_000 });
  const output = result.publicCaseResults?.[0]?.actualOutput ?? "";
  assert.ok(new TextEncoder().encode(output).byteLength <= 4_096);
  assert.doesNotMatch(output, /�/);
  assert.match(output, /output truncated/);
});

test("compiles Swift exactly once before running cases and returns compile-error separately", async () => {
  const request: SubmissionRequest = {
    ...submission(),
    language: "swift6",
    runtime: "swift-6.3.3-linux",
    source: "print(readLine() ?? \"\")",
  };
  const commands: string[] = [];
  const inputs: string[] = [];
  let destroyed = false;
  const factory: SandboxFactory = {
    create() {
      return {
        async writeFile(path, content) {
          assert.equal(path, "/workspace/main.swift");
          assert.equal(content, request.source);
        },
        async exec(command, options) {
          commands.push(command);
          inputs.push(options.stdin);
          if (command.includes("swift-compile")) return runner("");
          return runner(options.stdin);
        },
        async destroy() { destroyed = true; },
      };
    },
  };
  const accepted = await judgeSubmission(request, factory, { timeoutMs: 4_000, outputLimitBytes: 4_096 });
  assert.equal(accepted.verdict, "accepted");
  assert.equal(commands.filter((command) => command.includes("swift-compile")).length, 1);
  assert.equal(commands.filter((command) => command.includes("swift-run")).length, 2);
  assert.deepEqual(inputs, ["", "a\n", "b\n"]);
  assert.equal(accepted.language, "swift6");
  assert.equal(accepted.contractDigest, request.contractDigest);
  assert.equal(destroyed, true);

  const compileFailure: SandboxFactory = {
    create() {
      return {
        async writeFile() {},
        async exec() { return runner("", { exitCode: 1, stderrBase64: btoa("syntax error") }); },
        async destroy() {},
      };
    },
  };
  const failed = await judgeSubmission(request, compileFailure, { timeoutMs: 4_000, outputLimitBytes: 4_096 });
  assert.equal(failed.verdict, "compile-error");
  assert.match(failed.diagnostic ?? "", /syntax error/);
  assert.equal(failed.passed, 0);
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
