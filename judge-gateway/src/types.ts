export const CONTRACT_VERSION = "judge.submission.v1" as const;
export const RESULT_VERSION = "judge.result.v1" as const;
/**
 * Execution-only rehearsal contracts intentionally have no judge metadata or
 * expected values.  Keep these versions separate from the sealed submission
 * protocol so a rehearsal can never settle a verified submission by accident.
 */
export const EXECUTION_CONTRACT_VERSION = "judge.execution.v1" as const;
export const EXECUTION_RESULT_VERSION = "judge.execution.result.v1" as const;
export const EXECUTION_LANGUAGE = "swift6" as const;
export const EXECUTION_RUNTIME = "swift-6.3.3-linux" as const;

export type ComparisonMode = "exact" | "trim-final-newline";
export type JudgeLanguage = "python3" | "swift6";
export type Verdict =
  | "accepted"
  | "wrong-answer"
  | "compile-error"
  | "runtime-error"
  | "time-limit"
  | "judge-error";

export type TestCaseVisibility = "sample" | "hidden";

export type ExecutionCaseStatus =
  | "executed"
  | "compile-error"
  | "runtime-error"
  | "time-limit"
  | "judge-error";

/**
 * A deliberately smaller, public-facing status vocabulary. The sealed judge
 * verdict remains the source of truth; this status is only for rendering a
 * visible sample's run without exposing expected values or hidden cases.
 */
export type PublicCaseStatus =
  | "passed"
  | "failed"
  | "compile-error"
  | "runtime-error"
  | "time-limit"
  | "judge-error"
  | "not-run";

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  /** Missing visibility is normalized to hidden by the ingress parser. */
  visibility: TestCaseVisibility;
}

export interface PublicCaseResult {
  id: string;
  status: PublicCaseStatus;
  /** Sanitized stdout, bounded independently from the runner's output cap. */
  actualOutput?: string;
}

export interface SubmissionRequest {
  version: typeof CONTRACT_VERSION;
  submissionId: string;
  language: JudgeLanguage;
  runtime: string;
  contentRevision: number;
  judgeRevision: number;
  contractDigest: string;
  source: string;
  comparison: ComparisonMode;
  tests: TestCase[];
  callbackUrl: string;
}

/**
 * A rehearsal request contains a trusted, already-wrapped Swift program and
 * caller-provided input only.  The gateway owns the language/runtime and does
 * not accept entrypoint, revision, digest, expected output, or comparison
 * metadata on this protocol.
 */
export interface ExecutionCase {
  id: string;
  input: string;
}

export interface ExecutionRequest {
  version: typeof EXECUTION_CONTRACT_VERSION;
  executionId: string;
  source: string;
  cases: ExecutionCase[];
  callbackUrl: string;
}

export interface ExecutionCaseResult {
  id: string;
  status: ExecutionCaseStatus;
  /** Sanitized stdout, bounded independently from the runner output cap. */
  actualOutput?: string;
  /** Sanitized, bounded diagnostic for this case when one is useful. */
  diagnostic?: string;
}

export interface ExecutionResult {
  version: typeof EXECUTION_RESULT_VERSION;
  executionId: string;
  language: typeof EXECUTION_LANGUAGE;
  runtime: typeof EXECUTION_RUNTIME;
  executed: number;
  total: number;
  cases: ExecutionCaseResult[];
  /** Sanitized, bounded compilation or service-level diagnostic. */
  diagnostic?: string;
}

export interface JudgeResult {
  version: typeof RESULT_VERSION;
  submissionId: string;
  language: JudgeLanguage;
  runtime: string;
  contentRevision: number;
  judgeRevision: number;
  contractDigest: string;
  verdict: Verdict;
  passed: number;
  total: number;
  failedCaseIndex?: number;
  diagnostic?: string;
  /** Present only when every request test is explicitly marked as a sample. */
  publicCaseResults?: PublicCaseResult[];
}

export interface SubmissionQueueMessage {
  kind: "submission";
  request: SubmissionRequest;
}

export interface CallbackQueueMessage {
  kind: "callback";
  callbackUrl: string;
  result: JudgeResult;
}

export interface ExecutionQueueMessage {
  kind: "execution";
  request: ExecutionRequest;
}

export interface ExecutionCallbackQueueMessage {
  kind: "execution-callback";
  callbackUrl: string;
  result: ExecutionResult;
}

export type JudgeQueueMessage =
  | SubmissionQueueMessage
  | CallbackQueueMessage
  | ExecutionQueueMessage
  | ExecutionCallbackQueueMessage;

export interface QueueBinding<T> {
  send(message: T, options?: { contentType?: "json" }): Promise<unknown>;
}

export interface QueueRecord<T> {
  readonly id: string;
  readonly attempts: number;
  readonly body: T;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

export interface QueueBatch<T> {
  readonly messages: readonly QueueRecord<T>[];
}

export interface Env {
  // Deliberately opaque here. sandbox-adapter.ts is the only vendor SDK boundary.
  JUDGE_SANDBOX: unknown;
  JUDGE_QUEUE: QueueBinding<JudgeQueueMessage>;
  INGRESS_HMAC_SECRET?: string;
  INGRESS_SERVICE_TOKEN?: string;
  CALLBACK_HMAC_SECRET: string;
  CALLBACK_ALLOWED_ORIGINS: string;
  MAX_REQUEST_BYTES?: string;
  TEST_TIMEOUT_MS?: string;
  COMPILE_TIMEOUT_MS?: string;
  OUTPUT_LIMIT_BYTES?: string;
  CALLBACK_TIMEOUT_MS?: string;
  SANDBOX_TRANSPORT?: string;
}

export interface RunnerResponse {
  version: 1;
  exitCode: number;
  timedOut: boolean;
  outputLimited: boolean;
  stdout: string;
  stderr: string;
}

export interface SandboxExecResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface SandboxHandle {
  writeFile(path: string, content: string): Promise<void>;
  exec(command: string, options: { stdin: string; timeout: number }): Promise<SandboxExecResult>;
  destroy(): Promise<void>;
}

export interface SandboxFactory {
  create(sandboxId: string): SandboxHandle;
}
