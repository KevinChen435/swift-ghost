import type { AttemptRecord } from "./product";
import type { ItemId, PracticeItem } from "./items";
import type { SessionQueueEntry } from "./sessions.mjs";
import type { LearningEvent } from "./learning-state.mjs";

export type PlannerActivityKind = "syntax" | "solve" | "concept";
export type PlannerLane = "review" | "interview" | "python" | "ios";
export type PlannerLaneMinutes = Partial<Record<PlannerLane, number>>;
export type PlannerLaneHistoryEntry =
  | PlannerLaneMinutes
  | { laneMinutes: PlannerLaneMinutes };
export type TrainingProfile = {
  preferredLanguage?: "python" | "swift";
  dailyGoalMinutes?: number;
  pythonShare?: number;
  reviewShare?: number;
  iosShare?: number;
};
export type DailyPlanTask = SessionQueueEntry & {
  practiceKind: "typing" | "solving" | "concept";
  activityKind: PlannerActivityKind;
  estimatedMinutes: number;
  rationale: string;
  score: number;
  track: "interview" | "ios";
  language: "python" | "swift";
  lane: PlannerLane;
};
export type DailyPlan = {
  date: string;
  budgetMinutes: number;
  estimatedMinutes: number;
  tasks: DailyPlanTask[];
  entries: DailyPlanTask[];
  laneMinutes: Record<PlannerLane, number>;
  deferredDueCount: number;
};
export type DailyPlanInput = {
  items: PracticeItem[];
  attempts?: AttemptRecord[];
  solves?: AttemptRecord[];
  learningEvents?: LearningEvent[];
  reviews?: LearningEvent[];
  reviewStatuses?: unknown[];
  evidence?: unknown[];
  favorites?: ItemId[];
  profile?: TrainingProfile;
  trainingProfile?: TrainingProfile;
  now?: Date | string | number;
  budgetMinutes?: number;
  maxItems?: number;
  recentLaneMinutes?: PlannerLaneHistoryEntry | PlannerLaneHistoryEntry[];
};
export function buildDailyPlan(
  input: DailyPlanInput,
  options?: {
    now?: Date | string | number;
    budgetMinutes?: number;
    maxItems?: number;
    recentLaneMinutes?: PlannerLaneHistoryEntry | PlannerLaneHistoryEntry[];
  },
): DailyPlan;
