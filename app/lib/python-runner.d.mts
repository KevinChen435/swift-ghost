export type PythonCodec =
  "json" | "linkedList" | "cyclicLinkedList" | "binaryTree";
export type PythonComparator =
  "deepEqual" | "unordered" | "unorderedNested" | "validTopologicalOrder";

export type PythonEntrypoint =
  | { kind: "function"; name: string }
  | { kind: "method"; className: string; name: string };

export type PythonVerificationCase = {
  name: string;
  args: readonly unknown[];
  argCodecs?: readonly PythonCodec[];
  expected: unknown;
  outputCodec?: PythonCodec;
  comparator?: PythonComparator;
};

export type PythonVerification = {
  entrypoint: PythonEntrypoint;
  cases: readonly PythonVerificationCase[];
};

export type PythonCaseResult = {
  name: string;
  passed: boolean;
  actual: unknown;
  error: string | null;
};

export type PythonVerificationResult = {
  ok: boolean;
  setupError: string | null;
  cases: PythonCaseResult[];
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type PythonRunnerOptions = {
  workerUrl?: string | URL;
  baseUrl?: string | URL;
  Worker?: typeof globalThis.Worker;
  initializationTimeoutMs?: number;
};

export class PythonRunner {
  constructor(options?: PythonRunnerOptions);
  verify(
    source: string,
    verification: PythonVerification,
  ): Promise<PythonVerificationResult>;
  dispose(): void;
}

export function buildPythonHarness(input: {
  source: string;
  verification: PythonVerification;
}): string;
export function createPythonRunner(options?: PythonRunnerOptions): PythonRunner;
export const PYTHON_RUNNER_LIMITS: Readonly<{
  maxSourceBytes: number;
  maxSpecBytes: number;
  maxCases: number;
  executionTimeoutMs: number;
  initializationTimeoutMs: number;
}>;
