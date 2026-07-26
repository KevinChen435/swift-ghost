import type { ItemId, PracticeItem } from "./items";

export type SessionSource = "mixed" | "due" | "new" | "favorites" | "custom";
export type SessionStageMode = "recommended" | "recall";
export type SessionQueueEntry = {
  itemId: ItemId;
  itemRevision: number;
  stage: number;
  status: "pending" | "completed" | "skipped";
  attemptId?: string;
};
export type SessionSignals = Record<string, {
  due?: boolean;
  favorite?: boolean;
  completions?: number;
  recommendedStage?: number;
  itemRevision?: number;
}>;

export const SESSION_SOURCES: SessionSource[];
export const SESSION_STAGE_MODES: SessionStageMode[];
export function buildSessionQueue(
  items: PracticeItem[],
  signals: SessionSignals,
  options: { count: number; source: SessionSource; pattern: string; difficulty: string; stageMode: SessionStageMode },
  random?: () => number,
): SessionQueueEntry[];
