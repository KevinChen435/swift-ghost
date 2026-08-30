import type { CloudTrustedAssignment, CloudTrustedExampleRun } from "./cloud.mjs";

export type SwiftExampleHistoryCase = {
  id: string;
  passed: boolean;
  status:
    | "passed"
    | "failed"
    | "compile-error"
    | "runtime-error"
    | "time-limit"
    | "wrong-answer"
    | "judge-error"
    | "not-run";
  actual?: unknown;
  diagnostic?: string;
};

export type SwiftExampleHistoryEntry = {
  id: string;
  settledAt: string;
  verdict: Exclude<CloudTrustedExampleRun["verdict"], null>;
  passed: number;
  total: number;
  contentRevision: number;
  judgeRevision: number;
  failedCaseIndex?: number;
  publicCaseResults: SwiftExampleHistoryCase[];
};

export function normalizeSwiftExampleHistory(
  value: unknown,
  challenge: NonNullable<CloudTrustedAssignment["challenge"]>,
): SwiftExampleHistoryEntry[];
export function swiftExampleHistoryEntryFromRun(
  run: CloudTrustedExampleRun,
  challenge: NonNullable<CloudTrustedAssignment["challenge"]>,
): SwiftExampleHistoryEntry | undefined;
export const SWIFT_EXAMPLE_HISTORY_LIMITS: Readonly<{
  maxEntries: number;
  maxValueCharacters: number;
  maxDiagnosticCharacters: number;
}>;
