import { buildPlan, buildPreparationPlan, outputsMatch, parseRunnerResponse, sourcePath } from "./planner";
import {
  RESULT_VERSION,
  type JudgeResult,
  type PublicCaseResult,
  type PublicCaseStatus,
  type SandboxFactory,
  type SubmissionRequest,
} from "./types";

const PUBLIC_OUTPUT_LIMIT_BYTES = 4_096;

function diagnostic(value: string): string | undefined {
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return clean ? clean.slice(0, 2_000) : undefined;
}

/**
 * Keep visible output useful in the editor without making the callback a
 * terminal or an unbounded output transport. ANSI controls and C0/C1 control
 * bytes are removed, CRLF is normalized, and the public cap is independent of
 * the larger internal runner cap.
 */
function publicOutput(value: string): string {
  const clean = value
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
    .replace(/\r\n?/g, "\n");
  const bytes = new TextEncoder().encode(clean);
  if (bytes.byteLength <= PUBLIC_OUTPUT_LIMIT_BYTES) return clean;
  const suffix = "\n[… output truncated]";
  const suffixBytes = new TextEncoder().encode(suffix).byteLength;
  const prefixLimit = Math.max(0, PUBLIC_OUTPUT_LIMIT_BYTES - suffixBytes);
  const codePoints = Array.from(clean);
  let low = 0;
  let high = codePoints.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = codePoints.slice(0, middle).join("");
    if (new TextEncoder().encode(candidate).byteLength <= prefixLimit) low = middle;
    else high = middle - 1;
  }
  return `${codePoints.slice(0, low).join("")}${suffix}`;
}

export async function judgeSubmission(
  request: SubmissionRequest,
  factory: SandboxFactory,
  config: { timeoutMs: number; compileTimeoutMs?: number; outputLimitBytes: number },
): Promise<JudgeResult> {
  const resultBase = {
    version: RESULT_VERSION,
    submissionId: request.submissionId,
    language: request.language,
    runtime: request.runtime,
    contentRevision: request.contentRevision,
    judgeRevision: request.judgeRevision,
    contractDigest: request.contractDigest,
  } as const;
  // A nonce prevents state reuse even when Queues redelivers the same submission.
  const sandboxId = `submission-${crypto.randomUUID()}`;
  const sandbox = factory.create(sandboxId);
  let passed = 0;
  const publicCaseResults: PublicCaseResult[] | undefined = request.tests.length > 0 &&
      request.tests.every((test) => test.visibility === "sample")
    ? request.tests.map((test) => ({ id: test.id, status: "not-run" as const }))
    : undefined;
  const setPublicCase = (index: number, status: PublicCaseStatus, actual?: string): void => {
    const result = publicCaseResults?.[index];
    if (!result) return;
    result.status = status;
    if (actual !== undefined) result.actualOutput = publicOutput(actual);
  };
  const setAllPublicCases = (status: PublicCaseStatus): void => {
    if (!publicCaseResults) return;
    for (const result of publicCaseResults) result.status = status;
  };
  const finish = (result: JudgeResult): JudgeResult => publicCaseResults === undefined
    ? result
    : { ...result, publicCaseResults: publicCaseResults.map((entry) => ({ ...entry })) };
  try {
    await sandbox.writeFile(sourcePath(request), request.source);
    const preparation = buildPreparationPlan(request, config.outputLimitBytes, config.compileTimeoutMs ?? 20_000);
    if (preparation) {
      let compiler;
      try {
        compiler = parseRunnerResponse(
          await sandbox.exec(preparation.command, { stdin: "", timeout: preparation.sdkTimeoutMs }),
          config.outputLimitBytes,
        );
      } catch (error) {
        const detail = diagnostic(error instanceof Error ? error.message : "sandbox compilation failed");
        setAllPublicCases("judge-error");
        return finish({
          ...resultBase,
          verdict: "judge-error",
          passed,
          total: request.tests.length,
          ...(detail ? { diagnostic: detail } : {}),
        });
      }
      if (compiler.timedOut || compiler.outputLimited || compiler.exitCode !== 0) {
        setAllPublicCases("compile-error");
        return finish({
          ...resultBase,
          verdict: "compile-error",
          passed,
          total: request.tests.length,
          diagnostic: compiler.timedOut
            ? "Swift compilation exceeded the compiler time limit"
            : compiler.outputLimited
              ? "Swift compiler output exceeded the diagnostic limit"
              : diagnostic(compiler.stderr) ?? "Swift compilation failed",
        });
      }
    }
    const plans = buildPlan(request, config.timeoutMs, config.outputLimitBytes);
    for (const plan of plans) {
      let runner;
      try {
        runner = parseRunnerResponse(
          await sandbox.exec(plan.command, { stdin: plan.stdin, timeout: plan.sdkTimeoutMs }),
          config.outputLimitBytes,
        );
      } catch (error) {
        const detail = diagnostic(error instanceof Error ? error.message : "sandbox execution failed");
        setPublicCase(plan.caseIndex, "judge-error");
        return finish({
          ...resultBase,
          verdict: "judge-error",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
          ...(detail ? { diagnostic: detail } : {}),
        });
      }
      if (runner.timedOut) {
        setPublicCase(plan.caseIndex, "time-limit", runner.stdout);
        return finish({
          ...resultBase,
          verdict: "time-limit",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
        });
      }
      if (runner.outputLimited) {
        setPublicCase(plan.caseIndex, "runtime-error", runner.stdout);
        return finish({
          ...resultBase,
          verdict: "runtime-error",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
          diagnostic: "Output limit exceeded",
        });
      }
      if (runner.exitCode !== 0) {
        setPublicCase(plan.caseIndex, "runtime-error", runner.stdout);
        return finish({
          ...resultBase,
          verdict: "runtime-error",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
          diagnostic: "Submission exited with a non-zero status",
        });
      }
      const test = request.tests[plan.caseIndex];
      if (!test || !outputsMatch(runner.stdout, test, request.comparison)) {
        setPublicCase(plan.caseIndex, "failed", runner.stdout);
        return finish({
          ...resultBase,
          verdict: "wrong-answer",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
        });
      }
      setPublicCase(plan.caseIndex, "passed", runner.stdout);
      passed += 1;
    }
    return finish({
      ...resultBase,
      verdict: "accepted",
      passed,
      total: request.tests.length,
    });
  } catch (error) {
    const detail = diagnostic(error instanceof Error ? error.message : "sandbox setup failed");
    setAllPublicCases("judge-error");
    return finish({
      ...resultBase,
      verdict: "judge-error",
      passed,
      total: request.tests.length,
      ...(detail ? { diagnostic: detail } : {}),
    });
  } finally {
    try {
      await sandbox.destroy();
    } catch (error) {
      console.error("sandbox destroy failed", { sandboxId, error });
    }
  }
}
