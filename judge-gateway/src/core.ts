import { buildPlan, outputsMatch, parseRunnerResponse } from "./planner";
import { RESULT_VERSION, type JudgeResult, type SandboxFactory, type SubmissionRequest } from "./types";

function diagnostic(value: string): string | undefined {
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return clean ? clean.slice(0, 2_000) : undefined;
}

export async function judgeSubmission(
  request: SubmissionRequest,
  factory: SandboxFactory,
  config: { timeoutMs: number; outputLimitBytes: number },
): Promise<JudgeResult> {
  // A nonce prevents state reuse even when Queues redelivers the same submission.
  const sandboxId = `submission-${crypto.randomUUID()}`;
  const sandbox = factory.create(sandboxId);
  let passed = 0;
  try {
    await sandbox.writeFile("/workspace/submission.py", request.source);
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
          version: RESULT_VERSION,
          submissionId: request.submissionId,
          verdict: "judge-error",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
          ...(detail ? { diagnostic: detail } : {}),
        };
      }
      if (runner.timedOut) {
        return {
          version: RESULT_VERSION,
          submissionId: request.submissionId,
          verdict: "time-limit",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
        };
      }
      if (runner.outputLimited) {
        return {
          version: RESULT_VERSION,
          submissionId: request.submissionId,
          verdict: "runtime-error",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
          diagnostic: "Output limit exceeded",
        };
      }
      if (runner.exitCode !== 0) {
        return {
          version: RESULT_VERSION,
          submissionId: request.submissionId,
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
          version: RESULT_VERSION,
          submissionId: request.submissionId,
          verdict: "wrong-answer",
          passed,
          total: request.tests.length,
          failedCaseIndex: plan.caseIndex,
        };
      }
      passed += 1;
    }
    return {
      version: RESULT_VERSION,
      submissionId: request.submissionId,
      verdict: "accepted",
      passed,
      total: request.tests.length,
    };
  } catch (error) {
    const detail = diagnostic(error instanceof Error ? error.message : "sandbox setup failed");
    return {
      version: RESULT_VERSION,
      submissionId: request.submissionId,
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
