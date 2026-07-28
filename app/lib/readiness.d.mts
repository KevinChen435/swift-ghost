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
export function buildReadinessSummary(input: {
  items: PracticeItem[];
  attempts: AttemptRecord[];
  learningEvents: LearningEvent[];
  dueCount?: number;
  now?: Date | string | number;
}): ReadinessSummary;
