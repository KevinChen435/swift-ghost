import type { LearningEvent } from "./learning-state.mjs";
import type { PracticeItem } from "./items";
import type { AttemptRecord } from "./product";

export type ReadinessRate = {
  numerator: number;
  denominator: number;
  percent: number | null;
};
export type ReadinessSummary = {
  windowDays: number;
  hintFreeSolves: ReadinessRate;
  strongRetrieval: ReadinessRate;
  conceptRecall: ReadinessRate;
  debriefCoverage: ReadinessRate;
  topFriction: {
    category: string | null;
    count: number;
    denominator: number;
  };
  trackMix: {
    minutes: Record<"python" | "swift" | "ios", number>;
    percent: Record<"python" | "swift" | "ios", number>;
    totalMinutes: number;
  };
  dueToday: number;
};
export type ReadinessTimelineBucket = {
  startDate: string;
  endDate: string;
  activeDays: number;
  completedAttempts: number;
  minutes: number;
  laneMinutes: Record<"python" | "swift" | "ios", number>;
  verifiedSolves: number;
  hintFreeSolves: number;
  retrievalEvents: number;
  strongRetrieval: number;
  conceptAttempts: number;
  strongConcept: number;
  debriefedAttempts: number;
};
export type ReadinessPeriodSummary = ReadinessTimelineBucket & {
  hintFreeSolveRate: ReadinessRate;
  strongRetrievalRate: ReadinessRate;
  conceptRecallRate: ReadinessRate;
  debriefCoverage: ReadinessRate;
  topFriction: {
    category: string | null;
    count: number;
    denominator: number;
  };
};
export type ReadinessTimeline = {
  windowDays: 90;
  startDate: string;
  endDate: string;
  buckets: ReadinessTimelineBucket[];
  current30: ReadinessPeriodSummary;
  previous30: ReadinessPeriodSummary;
  rateDeltas: Record<
    | "hintFreeSolveRate"
    | "strongRetrievalRate"
    | "conceptRecallRate"
    | "debriefCoverage",
    number | null
  >;
};
export type ReadinessTimelineInput = {
  items?: PracticeItem[];
  attempts?: AttemptRecord[];
  learningEvents?: LearningEvent[];
  now: Date | string | number;
};
export function buildReadinessTimeline(
  input: ReadinessTimelineInput,
): ReadinessTimeline;
export function buildReadinessSummary(input: {
  items: PracticeItem[];
  attempts: AttemptRecord[];
  learningEvents: LearningEvent[];
  dueCount?: number;
  now?: Date | string | number;
}): ReadinessSummary;
