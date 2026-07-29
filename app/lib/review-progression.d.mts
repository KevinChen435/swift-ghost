import type { AttemptRecord } from "./product";
import type { ItemId } from "./items";
import type { LearningEvent } from "./learning-state.mjs";

export type ReviewActivityKind = "solve" | "concept";
export type ReviewProgressionResult = {
  level: number;
  dueAt: string | null;
  due: boolean;
  overdueDays: number;
  lapses: number;
  successes: number;
  last: AttemptRecord | null;
  lastDebrief: LearningEvent | null;
  acquisitionAttemptId: string | null;
  lastReviewAttemptId: string | null;
  evidenceAttemptIds: string[];
  lapseAttemptIds: string[];
};

export const REVIEW_INTERVAL_DAYS: readonly [1, 3, 7, 14, 30];
export function deriveReviewProgression(
  attempts: readonly AttemptRecord[] | undefined,
  options: {
    itemId: ItemId;
    itemRevision: number;
    activityKind: ReviewActivityKind;
    events?: readonly LearningEvent[];
    now?: string | Date | number;
  },
): ReviewProgressionResult;
