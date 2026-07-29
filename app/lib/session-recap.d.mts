import type { PracticeItem } from "./items";
import type { AttemptRecord, SessionHistoryRecord } from "./product";
import type { SessionQueueEntry } from "./sessions.mjs";
import type { TypingProgressionWorkspace } from "./typing-progression.mjs";

export type SessionReplayMode = "all" | "weak";
export type SessionRecapEntry = SessionQueueEntry & {
  index: number;
  item?: PracticeItem;
  attempt?: AttemptRecord;
  title: string;
  available: boolean;
  superseded: boolean;
  strong: boolean;
  diagnosticBypass: boolean;
  needsRetry: boolean;
  evidence: string;
};
export type SessionRecapModel = {
  record: SessionHistoryRecord;
  hasEntryDetail: boolean;
  entries: SessionRecapEntry[];
  elapsedMs: number;
  strongCount: number;
  weakCount: number;
  availableCount: number;
  weakAvailableCount: number;
  typing: { count: number; averageWpm: number; averageAccuracy: number };
  solving: { count: number; accepted: number };
  concept: { count: number; strong: number };
};

export const SESSION_REPLAY_MODES: SessionReplayMode[];
export function normalizeSessionHistoryEntries(value: unknown): SessionQueueEntry[];
export function buildSessionRecap(
  record: SessionHistoryRecord,
  attempts?: AttemptRecord[],
  items?: PracticeItem[],
  typingProgress?: TypingProgressionWorkspace,
): SessionRecapModel;
export function buildSessionReplayQueue(
  record: SessionHistoryRecord,
  attempts?: AttemptRecord[],
  items?: PracticeItem[],
  mode?: SessionReplayMode,
  typingProgress?: TypingProgressionWorkspace,
): SessionQueueEntry[];
