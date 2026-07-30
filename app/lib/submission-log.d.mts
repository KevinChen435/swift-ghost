import type { CodeLanguage, ItemId } from "./items";

export type SubmissionLanguage = CodeLanguage;
export type SubmissionStatus =
  | "accepted"
  | "wrong-answer"
  | "compile-error"
  | "runtime-error"
  | "time-limit"
  | "invalid-entrypoint"
  | "judge-error";
export type SubmissionContextKind =
  | "practice"
  | "transfer"
  | "assessment"
  | "mock"
  | "studio"
  | "round";
export type SubmissionAssistance = "used" | "none-recorded" | "unknown";
export type SubmissionSnapshotProvenance =
  | "recorded"
  | "migrated-catalog-fallback";

export type SubmissionJudge = Readonly<{
  kind: "browser-python-local" | "server-isolated-python" | "server-isolated-swift";
  revision: number;
}>;

export type SubmissionContext = Readonly<{
  kind: SubmissionContextKind;
  sessionId?: string;
  assessmentRunId?: string;
  assessmentProbeId?: string;
  virtualRoundId?: string;
}>;

export type SubmissionReceiptBase = Readonly<{
  id: string;
  itemId: ItemId;
  titleSnapshot: string;
  language: SubmissionLanguage;
  itemRevision: number;
  requestedAt: string;
  judge: SubmissionJudge;
  context: SubmissionContext;
  assistance: SubmissionAssistance;
  snapshotProvenance: SubmissionSnapshotProvenance;
  interruptionReason?: string;
}>;

export type PendingSubmissionReceipt = SubmissionReceiptBase & Readonly<{
  lifecycle: "pending";
}>;

export type SettledSubmissionReceipt = SubmissionReceiptBase & Readonly<{
  lifecycle: "settled";
  settledAt: string;
  status: SubmissionStatus;
  durationMs: number;
  passed: number;
  total: number;
  interruptionReason?: string;
}>;

export type SubmissionReceipt = PendingSubmissionReceipt | SettledSubmissionReceipt;

export type SubmissionLog = Readonly<{
  version: 1;
  receipts: SubmissionReceipt[];
  sources: Record<string, string>;
}>;

export type SubmissionRequest = Readonly<{
  id: string;
  itemId: ItemId;
  titleSnapshot: string;
  language: SubmissionLanguage;
  itemRevision: number;
  requestedAt: string | number | Date;
  source: string;
  judge: SubmissionJudge;
  context: SubmissionContext;
  assistance: SubmissionAssistance;
}>;

export type SubmissionOutcome = Readonly<{
  settledAt: string | number | Date;
  status: SubmissionStatus;
  durationMs: number;
  passed: number;
  total: number;
  interruptionReason?: string;
}>;

export type SubmissionCatalogItem = Readonly<{
  itemId: ItemId;
  title: string;
  language: SubmissionLanguage;
  [key: string]: unknown;
}>;

export type LegacySubmissionRecord = Readonly<{
  id: string;
  itemId: ItemId;
  itemRevision: number;
  verificationRevision: number;
  submittedAt: string;
  settledAt?: string;
  status: SubmissionStatus;
  durationMs: number;
  passed: number;
  total: number;
  source: string;
  origin?: "practice" | "mock" | "round";
  sessionId?: string;
  virtualRoundId?: string;
  [key: string]: unknown;
}>;

export type CompatibleSubmissionRecord = Readonly<{
  id: string;
  itemId: ItemId;
  titleSnapshot: string;
  language: SubmissionLanguage;
  itemRevision: number;
  verificationRevision: number;
  submittedAt: string;
  status: SubmissionStatus;
  durationMs: number;
  passed: number;
  total: number;
  source: string;
  origin: "practice" | "mock" | "round";
  sessionId?: string;
  virtualRoundId?: string;
}>;

export type SettledSubmissionEvidence = Readonly<{
  id: string;
  itemId: ItemId;
  itemRevision: number;
  status: SubmissionStatus;
  passed: number;
  total: number;
  submittedAt: string;
  assistanceUsed?: boolean;
}>;

export const SUBMISSION_LOG_VERSION: 1;
export const SUBMISSION_LOG_LIMITS: Readonly<{
  maxReceipts: 500;
  maxReceiptsPerItem: 100;
  maxSourceBytes: 48_000;
  maxTotalSourceBytes: 1_000_000;
  maxIdBytes: 160;
  maxTitleBytes: 1_000;
  maxInterruptionReasonBytes: 240;
  maxDurationMs: 86_400_000;
  maxChecks: 10_000;
  maxRevision: 1_000_000;
}>;
export const SUBMISSION_STATUSES: readonly SubmissionStatus[];
export const SUBMISSION_LANGUAGES: readonly SubmissionLanguage[];
export const SUBMISSION_CONTEXT_KINDS: readonly SubmissionContextKind[];
export const SUBMISSION_ASSISTANCE: readonly SubmissionAssistance[];
export const SUBMISSION_SNAPSHOT_PROVENANCE: readonly SubmissionSnapshotProvenance[];
export const SUBMISSION_JUDGE_KIND: "browser-python-local";
export const SUBMISSION_JUDGE_KINDS: readonly SubmissionJudge["kind"][];
export const SUBMISSION_INTERRUPTION_REASON: "interrupted-before-settlement";
export const SUBMISSION_LOG_STATUSES: readonly SubmissionStatus[];
export const SUBMISSION_LOG_LANGUAGES: readonly SubmissionLanguage[];
export const SUBMISSION_LOG_CONTEXT_KINDS: readonly SubmissionContextKind[];
export const SUBMISSION_LOG_ASSISTANCE: readonly SubmissionAssistance[];
export const SUBMISSION_LOG_SNAPSHOT_PROVENANCE: readonly SubmissionSnapshotProvenance[];
export const SUBMISSION_LOG_JUDGE_KIND: "browser-python-local";

export function createSubmissionLog(): SubmissionLog;
export function requestSubmission(log: SubmissionLog, input: SubmissionRequest): SubmissionLog;
export function settleSubmission(
  log: SubmissionLog,
  id: string,
  outcome: SubmissionOutcome,
): SubmissionLog;
export function recoverInterruptedSubmissions(
  log: SubmissionLog,
  options: { now: string | number | Date },
): SubmissionLog;
export function normalizeSubmissionLog(
  raw: unknown,
  options?: {
    items?: readonly SubmissionCatalogItem[];
    now?: string | number | Date;
    legacyHistory?: readonly LegacySubmissionRecord[];
  },
): SubmissionLog;
export function resolveSubmissionSource(log: SubmissionLog, id: string): string | null;
export function sourceAvailable(log: SubmissionLog, id: string): boolean;
export function settledSubmissionRecords(log: SubmissionLog): CompatibleSubmissionRecord[];
export function settledSubmissionEvidence(log: SubmissionLog): SettledSubmissionEvidence[];
export function submissionLogSourceBytes(log: SubmissionLog): number;
