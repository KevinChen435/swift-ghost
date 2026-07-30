export const CONTRACT_VERSION = "judge.submission.v1" as const;
export const RESULT_VERSION = "judge.result.v1" as const;

export type ComparisonMode = "exact" | "trim-final-newline";
export type JudgeLanguage = "python3" | "swift6";
export type Verdict =
  | "accepted"
  | "wrong-answer"
  | "compile-error"
  | "runtime-error"
  | "time-limit"
  | "judge-error";

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
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

export type JudgeQueueMessage = SubmissionQueueMessage | CallbackQueueMessage;

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
