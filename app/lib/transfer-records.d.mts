import type {
  TransferEvidenceCoverage,
  TransferExposure,
  TransferVariantLike,
  TransferVariantProgress,
  TransferWorkspace,
} from "./transfer-lab.mjs";
import type { SubmissionLog, SubmissionReceipt } from "./submission-log.mjs";
import type { SolutionReviewRecord } from "./solution-review.mjs";

export type TransferRecordsAttemptLike = {
  id?: string;
  attemptId?: string;
  variantId?: string;
  itemId?: string;
  variantRevision?: number;
  itemRevision?: number;
  contentRevision?: number;
  completedAt?: string;
  submittedAt?: string;
  updatedAt?: string;
  outcome?: string;
  qualification?: string;
  assistanceUsed?: boolean;
  peeks?: number;
  maxHintLevel?: number;
  hintLevel?: number;
  referenceRevealedAt?: string;
  answerUnlockedAt?: string;
  submissionId?: string;
  verification?: { passed?: number; total?: number; [key: string]: unknown };
  [key: string]: unknown;
};

export type TransferRecordEventBase = {
  id: string;
  at: string;
  variantRevision: number;
  isCurrentRevision: boolean;
};

export type TransferRecordPromptEvent = TransferRecordEventBase & {
  kind: "prompt-open";
  occurrence: "first" | "last" | "first-and-last";
  recordedOpenCount: number;
};

export type TransferRecordHintEvent = TransferRecordEventBase & {
  kind: "hint";
  occurrence: "first" | "last" | "first-and-last";
  maxHintLevel: number;
};

export type TransferRecordRevealEvent = TransferRecordEventBase & {
  kind: "reference-or-debrief-reveal";
};

export type TransferAttemptEvidenceClass =
  | "cold-proof"
  | "spaced-recheck"
  | "early-reconstruction"
  | "assisted-reconstruction"
  | "not-schedule-evidence";

export type TransferRecordAttemptEvent = TransferRecordEventBase & {
  kind: "attempt";
  attemptId: string;
  outcome: "completed" | "abandoned";
  qualification: "syntax" | "guided" | "independent" | "solved" | "assisted" | "incomplete";
  assisted: boolean;
  verificationPassed: number | null;
  verificationTotal: number | null;
  submissionId?: string;
  evidenceClass: TransferAttemptEvidenceClass;
  advancesSchedule: boolean;
  intervalIndex: number | null;
  nextDueAt: string | null;
};

export type TransferRecordSubmissionEvent = TransferRecordEventBase & {
  kind: "submission";
  submissionId: string;
  attemptId?: string;
  lifecycle: "pending" | "settled";
  status: "accepted" | "wrong-answer" | "compile-error" | "runtime-error" | "time-limit" | "invalid-entrypoint" | "judge-error" | null;
  verificationPassed: number | null;
  verificationTotal: number | null;
  contextKind: "practice" | "transfer" | "assessment" | "mock" | "studio" | "round";
  assistance: "used" | "none-recorded" | "unknown";
  evidenceClass: TransferAttemptEvidenceClass;
  advancesSchedule: boolean;
  intervalIndex: number | null;
  nextDueAt: string | null;
};

export type TransferRecordReviewEvent = TransferRecordEventBase & {
  kind: "review";
  reviewId: string;
  attemptId: string;
  submissionId?: string;
  status: "draft" | "completed";
  grade: "again" | "hard" | "good" | "easy" | null;
  dueAt: string | null;
};

export type TransferRecordTimelineEvent =
  | TransferRecordPromptEvent
  | TransferRecordHintEvent
  | TransferRecordRevealEvent
  | TransferRecordAttemptEvent
  | TransferRecordSubmissionEvent
  | TransferRecordReviewEvent;

export type TransferRecordEvidenceCoverage = {
  scope: "local-practice-evidence";
  workspace: TransferEvidenceCoverage;
  promptOpens: "complete" | "first-and-last-only" | "none-recorded" | "unknown";
  hints: "first-and-last-only" | "none-recorded" | "unknown";
  referenceOrDebriefReveal: "recorded" | "none-recorded" | "unknown";
  timeline: "complete" | "truncated";
  omittedTimelineEventCount: number;
  disclosure: string;
};

export type TransferRecord = {
  variantId: string;
  currentRevision: number;
  title: string;
  difficulty: string;
  language: string;
  pattern: string;
  family: string;
  sourceItemIds: string[];
  eligible: boolean;
  status: TransferVariantProgress["status"];
  progress: TransferVariantProgress;
  exposure: TransferExposure | null;
  attemptCount: number;
  currentAttemptCount: number;
  staleAttemptCount: number;
  submissionCount: number;
  currentSubmissionCount: number;
  staleSubmissionCount: number;
  reviewCount: number;
  latestSubmissionId: string | null;
  latestReviewAttemptId: string | null;
  currentAcceptedAttemptId: string | null;
  dueAt: string | null;
  reviewDueAt: string | null;
  lastActivityAt: string | null;
  timeline: TransferRecordTimelineEvent[];
  timelineEventCount: number;
  omittedTimelineEventCount: number;
  evidenceCoverage: TransferRecordEvidenceCoverage;
};

export type TransferRecordsTotals = {
  records: number;
  eligible: number;
  unseen: number;
  opened: number;
  attempted: number;
  assisted: number;
  proven: number;
  independentEvidence: number;
  due: number;
  attempts: number;
  currentAttempts: number;
  staleAttempts: number;
  submissions: number;
  currentSubmissions: number;
  staleSubmissions: number;
  pendingSubmissions: number;
  settledSubmissions: number;
  acceptedSubmissions: number;
  failedSubmissions: number;
  reviews: number;
  draftReviews: number;
  completedReviews: number;
  partialEvidenceRecords: number;
  truncatedTimelines: number;
};

export type TransferRecordsInput<TVariant extends TransferVariantLike = TransferVariantLike> = {
  variants?: ReadonlyArray<TVariant>;
  workspace?: TransferWorkspace | unknown;
  attempts?: ReadonlyArray<TransferRecordsAttemptLike>;
  submissionLog?: SubmissionLog | { receipts?: ReadonlyArray<SubmissionReceipt | unknown>; [key: string]: unknown };
  submissions?: ReadonlyArray<SubmissionReceipt | unknown>;
  reviews?: ReadonlyArray<SolutionReviewRecord | unknown>;
  now?: string | number | Date;
};

export type TransferRecordsResult = {
  generatedAt: string;
  evidenceScope: "local-practice-evidence";
  records: TransferRecord[];
  totals: TransferRecordsTotals;
};

export const TRANSFER_RECORDS_LIMITS: Readonly<{
  maxTimelineEvents: 100;
  maxIdLength: 160;
  maxTextLength: 500;
  maxRevision: 2_147_483_647;
  maxChecks: 10_000;
}>;

export function buildTransferRecords<TVariant extends TransferVariantLike = TransferVariantLike>(
  input?: TransferRecordsInput<TVariant>,
): TransferRecordsResult;
