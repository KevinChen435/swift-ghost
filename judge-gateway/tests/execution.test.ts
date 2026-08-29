import assert from "node:assert/strict";
import test from "node:test";
import { judgeExecution } from "../src/execution";
import {
  EXECUTION_CONTRACT_VERSION,
  type ExecutionRequest,
  type SandboxExecResult,
  type SandboxFactory,
} from "../src/types";

function base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return btoa(String.fromCharCode(...bytes));
}

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
      stdoutBase64: base64(stdout),
      stderrBase64: "",
      ...overrides,
    }),
  };
}

function request(): ExecutionRequest {
  return {
    version: EXECUTION_CONTRACT_VERSION,
    executionId: "execution-1",
    source: "print(\"trusted swift harness\")",
    cases: [
      { id: "case-1", input: "{\"args\":[1]}\n" },
      { id: "case-2", input: "{\"args\":[2]}\n" },
      { id: "case-3", input: "{\"args\":[3]}\n" },
    ],
    callbackUrl: "https://app.example.com/internal/judge-results",
  };
}

const config = { timeoutMs: 4_000, compileTimeoutMs: 20_000, outputLimitBytes: 4_096 };

test("compiles Swift once, executes every custom input, and never compares output", async () => {
  const current = request();
  const commands: string[] = [];
  const inputs: string[] = [];
  let destroyed = false;
  let execution = 0;
  const result = await judgeExecution(current, {
    create(id) {
      assert.match(id, /^execution-[0-9a-f-]{36}$/);
      return {
        async writeFile(path, source) {
          assert.equal(path, "/workspace/main.swift");
          assert.equal(source, current.source);
        },
        async exec(command, options) {
          commands.push(command);
          inputs.push(options.stdin);
          if (command.includes("swift-compile")) return runner("");
          execution += 1;
          return runner(`observed-${execution}\n`);
        },
        async destroy() { destroyed = true; },
      };
    },
  }, config);
  assert.equal(result.version, "judge.execution.result.v1");
  assert.equal(result.executionId, "execution-1");
  assert.equal(result.language, "swift6");
  assert.equal(result.runtime, "swift-6.3.3-linux");
  assert.equal(result.executed, 3);
  assert.equal(result.total, 3);
  assert.deepEqual(inputs, ["", ...current.cases.map((entry) => entry.input)]);
  assert.equal(commands.filter((command) => command.includes("swift-compile")).length, 1);
  assert.equal(commands.filter((command) => command.includes("swift-run")).length, 3);
  assert.deepEqual(result.cases, [
    { id: "case-1", status: "executed", actualOutput: "observed-1\n" },
    { id: "case-2", status: "executed", actualOutput: "observed-2\n" },
    { id: "case-3", status: "executed", actualOutput: "observed-3\n" },
  ]);
  assert.equal(JSON.stringify(result).includes("expectedOutput"), false);
  assert.equal(destroyed, true);
});

test("marks every case compile-error when Swift compilation fails", async () => {
  const result = await judgeExecution(request(), {
    create() {
      return {
        async writeFile() {},
        async exec() { return runner("", { exitCode: 1, stderrBase64: btoa("syntax error\u001b[31m") }); },
        async destroy() {},
      };
    },
  }, config);
  assert.equal(result.executed, 0);
  assert.deepEqual(result.cases.map((entry) => entry.status), ["compile-error", "compile-error", "compile-error"]);
  assert.match(result.diagnostic ?? "", /syntax error/);
  assert.equal(JSON.stringify(result).includes("\u001b"), false);
});

test("keeps running independent inputs and reports runtime, timeout, and judge errors per case", async () => {
  let run = 0;
  const result = await judgeExecution(request(), {
    create() {
      return {
        async writeFile() {},
        async exec(command) {
          if (command.includes("swift-compile")) return runner("");
          run += 1;
          if (run === 1) return runner("partial\n", { exitCode: 1 });
          if (run === 2) return runner("late\n", { timedOut: true, exitCode: -9 });
          throw new Error("runner transport failed");
        },
        async destroy() {},
      };
    },
  }, config);
  assert.equal(result.executed, 0);
  assert.deepEqual(result.cases, [
    { id: "case-1", status: "runtime-error", actualOutput: "partial\n", diagnostic: "Execution exited with a non-zero status" },
    { id: "case-2", status: "time-limit", actualOutput: "late\n", diagnostic: "Execution exceeded the time limit" },
    { id: "case-3", status: "judge-error", diagnostic: "runner transport failed" },
  ]);
});

test("sanitizes and byte-bounds observed output", async () => {
  const result = await judgeExecution({
    ...request(),
    cases: [{ id: "case-1", input: "" }],
  }, {
    create() {
      return {
        async writeFile() {},
        async exec(command) {
          if (command.includes("swift-compile")) return runner("");
          return runner(`${"🙂".repeat(3_000)}\u0000\u001b[2J`);
        },
        async destroy() {},
      };
    },
  }, { timeoutMs: 4_000, outputLimitBytes: 16_000 });
  const actual = result.cases[0]?.actualOutput ?? "";
  assert.ok(new TextEncoder().encode(actual).byteLength <= 4_096);
  assert.doesNotMatch(actual, /�/);
  assert.doesNotMatch(actual, /\u001b/);
  assert.match(actual, /output truncated/);
});
