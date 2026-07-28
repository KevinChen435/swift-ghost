import type { SubmissionRecord } from "./product";

export function isStorableSubmissionSource(source: unknown): source is string;
export function submissionHistorySourceBytes(
  history: ReadonlyArray<SubmissionRecord>,
): number;
export function appendSubmissionHistory(
  history: ReadonlyArray<SubmissionRecord>,
  submission: SubmissionRecord,
): SubmissionRecord[];
export const SUBMISSION_HISTORY_LIMITS: Readonly<{
  maxRecords: number;
  maxPerItem: number;
  maxSourceBytes: number;
  maxTotalSourceBytes: number;
}>;
