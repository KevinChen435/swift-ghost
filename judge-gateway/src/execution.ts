import {
  buildExecutionPlan,
  buildExecutionPreparationPlan,
  executionSourcePath,
  parseRunnerResponse,
} from "./planner";
import {
  EXECUTION_LANGUAGE,
  EXECUTION_RESULT_VERSION,
  EXECUTION_RUNTIME,
  type ExecutionCaseResult,
  type ExecutionCaseStatus,
  type ExecutionRequest,
  type ExecutionResult,
  type SandboxFactory,
} from "./types";

const PUBLIC_OUTPUT_LIMIT_BYTES = 4_096;
const DIAGNOSTIC_LIMIT_BYTES = 2_000;

function cleanText(value: string, limitBytes: number, trim = false): string | undefined {
  const clean = value
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
    .replace(/\r\n?/g, "\n");
  const normalized = trim ? clean.trim() : clean;
  const bytes = new TextEncoder().encode(normalized);
  if (bytes.byteLength <= limitBytes) return normalized;
  const suffix = "\n[… output truncated]";
  const suffixBytes = new TextEncoder().encode(suffix).byteLength;
  const prefixLimit = Math.max(0, limitBytes - suffixBytes);
  const codePoints = Array.from(normalized);
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

function output(value: string): string {
  // Preserve stdout whitespace/newlines; only diagnostics are trimmed.
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

function diagnostic(value: string): string | undefined {
  return cleanText(value, DIAGNOSTIC_LIMIT_BYTES, true);
}

function caseResult(
  id: string,
  status: ExecutionCaseStatus,
  actualOutput?: string,
  detail?: string,
): ExecutionCaseResult {
  const cleanedDiagnostic = detail ? diagnostic(detail) : undefined;
  return {
    id,
    status,
    ...(actualOutput === undefined ? {} : { actualOutput: output(actualOutput) }),
    ...(cleanedDiagnostic === undefined ? {} : { diagnostic: cleanedDiagnostic }),
  };
}

function allCases(
  request: ExecutionRequest,
  status: ExecutionCaseStatus,
  detail?: string,
): ExecutionCaseResult[] {
  return request.cases.map((testCase) => caseResult(testCase.id, status, undefined, detail));
}

function resultBase(request: ExecutionRequest) {
  return {
    version: EXECUTION_RESULT_VERSION,
    executionId: request.executionId,
    language: EXECUTION_LANGUAGE,
    runtime: EXECUTION_RUNTIME,
    total: request.cases.length,
  } as const;
}

/**
 * Execute a bounded Swift rehearsal.  This path deliberately never compares
 * output and never receives expected values: every input gets an observed
 * output/status, while compilation is shared once per fresh sandbox.
 */
export async function judgeExecution(
  request: ExecutionRequest,
  factory: SandboxFactory,
  config: { timeoutMs: number; compileTimeoutMs?: number; outputLimitBytes: number },
): Promise<ExecutionResult> {
  const base = resultBase(request);
  const sandboxId = `execution-${crypto.randomUUID()}`;
  const sandbox = factory.create(sandboxId);
  const finish = (
    cases: ExecutionCaseResult[],
    topDiagnostic?: string,
  ): ExecutionResult => {
    const cleanedDiagnostic = topDiagnostic ? diagnostic(topDiagnostic) : undefined;
    return {
      ...base,
      executed: cases.filter((entry) => entry.status === "executed").length,
      cases,
      ...(cleanedDiagnostic === undefined ? {} : { diagnostic: cleanedDiagnostic }),
    };
  };
  try {
    await sandbox.writeFile(executionSourcePath(), request.source);
    const preparation = buildExecutionPreparationPlan(
      config.outputLimitBytes,
      config.compileTimeoutMs ?? 20_000,
    );
    let compiler;
    try {
      compiler = parseRunnerResponse(
        await sandbox.exec(preparation.command, {
          stdin: "",
          timeout: preparation.sdkTimeoutMs,
        }),
        config.outputLimitBytes,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "sandbox compilation failed";
      return finish(allCases(request, "judge-error", detail), detail);
    }
    if (compiler.timedOut || compiler.outputLimited || compiler.exitCode !== 0) {
      const detail = compiler.timedOut
        ? "Swift compilation exceeded the compiler time limit"
        : compiler.outputLimited
          ? "Swift compiler output exceeded the diagnostic limit"
          : diagnostic(compiler.stderr) ?? "Swift compilation failed";
      return finish(allCases(request, "compile-error", detail), detail);
    }

    const cases: ExecutionCaseResult[] = [];
    const plans = buildExecutionPlan(request, config.timeoutMs, config.outputLimitBytes);
    for (const plan of plans) {
      try {
        const runner = parseRunnerResponse(
          await sandbox.exec(plan.command, {
            stdin: plan.stdin,
            timeout: plan.sdkTimeoutMs,
          }),
          config.outputLimitBytes,
        );
        if (runner.timedOut) {
          cases.push(caseResult(plan.caseId, "time-limit", runner.stdout, "Execution exceeded the time limit"));
        } else if (runner.outputLimited) {
          cases.push(caseResult(plan.caseId, "runtime-error", runner.stdout, "Output limit exceeded"));
        } else if (runner.exitCode !== 0) {
          cases.push(caseResult(plan.caseId, "runtime-error", runner.stdout, "Execution exited with a non-zero status"));
        } else {
          cases.push(caseResult(plan.caseId, "executed", runner.stdout));
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "sandbox execution failed";
        cases.push(caseResult(plan.caseId, "judge-error", undefined, detail));
      }
    }
    const firstDiagnostic = cases.find((entry) => entry.diagnostic)?.diagnostic;
    return finish(cases, firstDiagnostic);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "sandbox setup failed";
    return finish(allCases(request, "judge-error", detail), detail);
  } finally {
    try {
      await sandbox.destroy();
    } catch (error) {
      console.error("sandbox destroy failed", { sandboxId, error });
    }
  }
}
