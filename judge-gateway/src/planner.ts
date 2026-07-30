import type { RunnerResponse, SandboxExecResult, SubmissionRequest, TestCase } from "./types";

export interface TestExecutionPlan {
  caseIndex: number;
  caseId: string;
  command: string;
  stdin: string;
  sdkTimeoutMs: number;
}

export interface PreparationPlan {
  command: string;
  sdkTimeoutMs: number;
}

export function sourcePath(request: SubmissionRequest): string {
  return request.language === "swift6"
    ? "/workspace/main.swift"
    : "/workspace/submission.py";
}

export function buildPreparationPlan(
  request: SubmissionRequest,
  outputLimitBytes: number,
  compileTimeoutMs = 20_000,
): PreparationPlan | null {
  if (request.language !== "swift6") return null;
  return {
    command: `/usr/bin/python3 /opt/judge/judge_runner.py swift-compile /workspace/main.swift ${compileTimeoutMs} ${outputLimitBytes}`,
    sdkTimeoutMs: compileTimeoutMs + 2_000,
  };
}

export function buildPlan(
  request: SubmissionRequest,
  timeoutMs: number,
  outputLimitBytes: number,
): TestExecutionPlan[] {
  const command = request.language === "swift6"
    ? `/usr/bin/python3 /opt/judge/judge_runner.py swift-run /tmp/judge/submission ${timeoutMs} ${outputLimitBytes}`
    : `/usr/bin/python3 /opt/judge/judge_runner.py python3 /workspace/submission.py ${timeoutMs} ${outputLimitBytes}`;
  return request.tests.map((test, caseIndex) => ({
    caseIndex,
    caseId: test.id,
    command,
    stdin: test.input,
    sdkTimeoutMs: timeoutMs + 1_500,
  }));
}

export function normalizeOutput(value: string, mode: SubmissionRequest["comparison"]): string {
  const normalized = value.replace(/\r\n/g, "\n");
  return mode === "trim-final-newline" ? normalized.replace(/\n$/, "") : normalized;
}

export function outputsMatch(actual: string, test: TestCase, mode: SubmissionRequest["comparison"]): boolean {
  return normalizeOutput(actual, mode) === normalizeOutput(test.expectedOutput, mode);
}

export function parseRunnerResponse(exec: SandboxExecResult, outputLimitBytes: number): RunnerResponse {
  if (!exec.success || exec.exitCode !== 0) throw new Error("trusted runner did not complete successfully");
  if (new TextEncoder().encode(exec.stdout).byteLength > outputLimitBytes * 3 + 1_024) {
    throw new Error("trusted runner response exceeded its protocol bound");
  }
  let value: unknown;
  try {
    value = JSON.parse(exec.stdout);
  } catch {
    throw new Error("trusted runner returned malformed JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("trusted runner returned a non-object");
  }
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    typeof candidate.exitCode !== "number" ||
    !Number.isInteger(candidate.exitCode) ||
    typeof candidate.timedOut !== "boolean" ||
    typeof candidate.outputLimited !== "boolean" ||
    typeof candidate.stdoutBase64 !== "string" ||
    typeof candidate.stderrBase64 !== "string"
  ) {
    throw new Error("trusted runner response failed validation");
  }
  const decode = (encoded: string): string => {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      throw new Error("trusted runner returned invalid base64");
    }
    const binary = atob(encoded);
    if (binary.length > outputLimitBytes) throw new Error("trusted runner violated the output limit");
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  };
  const stdout = decode(candidate.stdoutBase64);
  const stderr = decode(candidate.stderrBase64);
  if (new TextEncoder().encode(stdout).byteLength > outputLimitBytes * 3 || new TextEncoder().encode(stderr).byteLength > outputLimitBytes * 3) {
    throw new Error("trusted runner violated the output limit");
  }
  return {
    version: 1,
    exitCode: candidate.exitCode,
    timedOut: candidate.timedOut,
    outputLimited: candidate.outputLimited,
    stdout,
    stderr,
  };
}
