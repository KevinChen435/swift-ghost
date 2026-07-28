import type { ItemId } from "./items";

export type RetrievalGrade = "again" | "hard" | "good" | "easy";
export type FrictionCategory =
  | "none"
  | "recognition"
  | "invariant"
  | "implementation"
  | "syntax"
  | "complexity"
  | "api";
export type LearningActivityKind = "syntax" | "solve" | "concept";
export type LearningEvent = {
  id: string;
  attemptId: string;
  itemId: ItemId;
  itemRevision: number;
  practiceKind: "typing" | "solving" | "concept";
  activityKind: LearningActivityKind;
  grade: RetrievalGrade;
  friction: FrictionCategory;
  confidence: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  promptSnapshot?: string;
  response?: string;
};

export const RETRIEVAL_GRADES: RetrievalGrade[];
export const FRICTION_CATEGORIES: FrictionCategory[];
export const ACTIVITY_KINDS: LearningActivityKind[];
export function activityKindFor(value?: {
  activityKind?: LearningActivityKind;
  track?: string;
  practiceKind?: string;
}): LearningActivityKind;
export function normalizeLearningEvents(
  value: unknown,
  options?: {
    validItemIds?: Set<string>;
    attemptsById?: Map<
      string,
      { itemId: string; itemRevision: number; practiceKind: string }
    >;
  },
): LearningEvent[];
export function upsertLearningEvent(
  events: LearningEvent[],
  event: LearningEvent,
): LearningEvent[];
export function applyDebriefToReviewState(
  state: {
    level?: number;
    dueAt?: Date | string | null;
    lapses?: number;
    lastAttemptAt?: number;
  },
  event?: Pick<LearningEvent, "grade" | "createdAt"> | null,
): { level: number; dueAt: Date | null; lapses: number };
