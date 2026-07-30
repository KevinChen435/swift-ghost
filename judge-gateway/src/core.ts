import { buildPlan, buildPreparationPlan, outputsMatch, parseRunnerResponse, sourcePath } from "./planner";
import { RESULT_VERSION, type JudgeResult, type SandboxFactory, type SubmissionRequest } from "./types";

function diagnostic(value: string): string | undefined {
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return clean ? clean.slice(0, 2_000) : undefined;
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
        return {
          ...resultBase,
          verdict: "judge-error",
          passed,
          total: request.tests.length,
          ...(detail ? { diagnostic: detail } : {}),
        };
      }
      if (compiler.timedOut || compiler.outputLimited || compiler.exitCode !== 0) {
        return {
          ...resultBase,
          verdict: "compile-error",
          passed,
          total: request.tests.length,
          diagnostic: compiler.timedOut
            ? "Swift compilation exceeded the compiler time limit"
            : compiler.outputLimited
              ? "Swift compiler output exceeded the diagnostic limit"
              : diagnostic(compiler.stderr) ?? "Swift compilation failed",
        };
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
        return {
          ...resultBase,
          verdict: "judge-error",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
          ...(detail ? { diagnostic: detail } : {}),
        };
      }
      if (runner.timedOut) {
        return {
          ...resultBase,
          verdict: "time-limit",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
        };
      }
      if (runner.outputLimited) {
        return {
          ...resultBase,
          verdict: "runtime-error",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
          diagnostic: "Output limit exceeded",
        };
      }
      if (runner.exitCode !== 0) {
        return {
          ...resultBase,
          verdict: "runtime-error",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
          diagnostic: "Submission exited with a non-zero status",
        };
      }
      const test = request.tests[plan.caseIndex];
      if (!test || !outputsMatch(runner.stdout, test, request.comparison)) {
        return {
          ...resultBase,
          verdict: "wrong-answer",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
        };
      }
      passed += 1;
    }
    return {
      ...resultBase,
      verdict: "accepted",
      passed,
      total: request.tests.length,
    };
  } catch (error) {
    const detail = diagnostic(error instanceof Error ? error.message : "sandbox setup failed");
    return {
      ...resultBase,
      verdict: "judge-error",
      passed,
      total: request.tests.length,
      ...(detail ? { diagnostic: detail } : {}),
    };
  } finally {
    try {
      await sandbox.destroy();
    } catch (error) {
      console.error("sandbox destroy failed", { sandboxId, error });
    }
  }
}
