import type { AttemptRecord, AttemptQualification } from "./product";
import type { ItemId } from "./items";
import type { RetrievalGrade } from "./learning-state.mjs";
import type { SubmissionReceipt } from "./submission-log.mjs";

export type SolutionReviewStep =
  | "explain"
  | "compare"
  | "mistake"
  | "teach-back"
  | "schedule"
  | "complete";
export type SolutionReviewMistake =
  | "none"
  | "recognition"
  | "invariant"
  | "implementation-plan"
  | "edge-case"
  | "python-syntax"
  | "swift-syntax-api"
  | "complexity";
export type SolutionReviewActivityKind = "syntax" | "solve" | "concept";

export type SolutionReviewRecord = {
  id: string;
  attemptId: string;
  submissionId?: string;
  itemId: ItemId;
  itemRevision: number;
  titleSnapshot: string;
  status: "draft" | "completed";
  step: SolutionReviewStep;
  unlockContext: "accepted-practice" | "finished-timed-run";
  qualification: Extract<AttemptQualification, "solved" | "assisted">;
  verificationPassed: number;
  verificationTotal: number;
  createdAt: string;
  updatedAt: string;
  explainApproach: string;
  explainInvariant: string;
  explainComplexity: string;
  explanationSkipped: boolean;
  revealedAt?: string;
  viewedApproachIds: string[];
  referenceCodeRevealed: boolean;
  comparisonViewed: boolean;
  mistakeCategory?: SolutionReviewMistake;
  mistakeNote: string;
  linkedSubmissionId?: string;
  teachBackPrompt: string;
  teachBackResponse: string;
  teachBackCommittedAt?: string;
  teachBackReferenceRevealedAt?: string;
  grade?: RetrievalGrade;
  activityKind?: SolutionReviewActivityKind;
  dueAt?: string;
  scheduleReason?: string;
  completedAt?: string;
};

export const SOLUTION_REVIEW_STEPS: readonly SolutionReviewStep[];
export const SOLUTION_REVIEW_MISTAKES: readonly SolutionReviewMistake[];
export const SOLUTION_REVIEW_GRADES: readonly RetrievalGrade[];
export const SOLUTION_REVIEW_ACTIVITY_KINDS: readonly SolutionReviewActivityKind[];
export const SOLUTION_REVIEW_LIMITS: Readonly<{
  maxRecords: 250;
  maxIdBytes: 160;
  maxTitleBytes: 500;
  maxExplanationBytes: 2_000;
  maxNoteBytes: 1_200;
  maxPromptBytes: 800;
  maxResponseBytes: 2_000;
  maxReasonBytes: 600;
  maxApproachIds: 8;
  maxRevision: 1_000_000;
}>;

export function normalizeSolutionReviews(
  value: unknown,
  options?: {
    attemptsById?: ReadonlyMap<string, AttemptRecord>;
    validItemIds?: ReadonlySet<string>;
    submissionIds?: ReadonlySet<string>;
    submissionsById?: ReadonlyMap<string, SubmissionReceipt>;
    timedAttemptIds?: ReadonlySet<string>;
  },
): SolutionReviewRecord[];
export function createSolutionReview(input: {
  id: string;
  attempt: AttemptRecord;
  submissionId?: string;
  teachBackPrompt: string;
  now: string | number | Date;
  unlockContext?: SolutionReviewRecord["unlockContext"];
}): SolutionReviewRecord;
export function upsertSolutionReview(
  records: readonly SolutionReviewRecord[],
  record: SolutionReviewRecord,
  options?: {
    attemptsById?: ReadonlyMap<string, AttemptRecord>;
    validItemIds?: ReadonlySet<string>;
    submissionIds?: ReadonlySet<string>;
    submissionsById?: ReadonlyMap<string, SubmissionReceipt>;
    timedAttemptIds?: ReadonlySet<string>;
  },
): SolutionReviewRecord[];
export function activityKindForMistake(
  category?: SolutionReviewMistake,
): SolutionReviewActivityKind;
export function scheduleReasonForReview(input?: {
  mistakeCategory?: SolutionReviewMistake;
  grade?: RetrievalGrade;
  qualification?: AttemptQualification;
}): string;
