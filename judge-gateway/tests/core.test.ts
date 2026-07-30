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
