import type { ItemId, PracticeItem } from "./items";

export type SessionSource = "mixed" | "due" | "new" | "favorites" | "custom";
export type SessionTrack = "all" | "interview" | "ios";
export type SessionLanguage = "all" | "python" | "swift";
export type SessionStageMode = "recommended" | "recall";
export type SessionPracticeMode = "smart" | "typing" | "solving";
export type SessionPracticeKind = "typing" | "solving" | "concept";
export type SessionLane = "review" | "interview" | "python" | "ios";
export type SessionQueueEntry = {
  itemId: ItemId;
  itemRevision: number;
  stage: number;
  status: "pending" | "completed" | "skipped";
  attemptId?: string;
  practiceKind?: SessionPracticeKind;
  estimatedMinutes?: number;
  rationale?: string;
  lane?: SessionLane;
};
export type SessionSignals = Record<string, {
  due?: boolean;
  favorite?: boolean;
  completions?: number;
  recommendedStage?: number;
  itemRevision?: number;
}>;

export const SESSION_SOURCES: SessionSource[];
export const SESSION_TRACKS: SessionTrack[];
export const SESSION_LANGUAGES: SessionLanguage[];
export const SESSION_STAGE_MODES: SessionStageMode[];
export const SESSION_PRACTICE_MODES: SessionPracticeMode[];
export function resolveSessionCurrentIndex(
  entries: Array<{ status: SessionQueueEntry["status"]; rawIndex: number }>,
  requestedRawIndex: number,
): number;
export function buildSessionQueue(
  items: PracticeItem[],
  signals: SessionSignals,
  options: { count: number; source: SessionSource; track: SessionTrack; language: SessionLanguage; pattern: string; difficulty: string; stageMode: SessionStageMode; practiceMode?: SessionPracticeMode },
  random?: () => number,
): SessionQueueEntry[];
