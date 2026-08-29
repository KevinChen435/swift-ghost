import type { LearningEvent } from "./learning-state.mjs";
import type { TypingProgressionWorkspace } from "./typing-progression.mjs";

export const PROGRESS_SYNC_VERSION: 1;
export const PROGRESS_SYNC_LIMITS: Readonly<{
  maxAttempts: number;
  maxLearningEvents: number;
  maxBytes: number;
}>;

export type ProgressSyncAttempt = {
  id: string;
  itemId: string;
  itemRevision: number;
  stage: number;
  practiceKind: "typing" | "solving" | "concept";
  mode: "strict" | "free";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
  rejectedKeystrokes: number;
  corrections: number;
  peeks: number;
  rawWpm: number;
  wpm: number;
  accuracy: number;
  consistency: number;
  outcome: "completed" | "abandoned";
  qualification:
    | "syntax"
    | "guided"
    | "independent"
    | "solved"
    | "assisted"
    | "incomplete";
  conceptGrade?: "again" | "hard" | "good" | "easy";
  conceptCheckIndex?: 0 | 1 | 2;
  verification?: {
    revision: number;
    passed: number;
    total: number;
    runs: number;
    submissions: number;
  };
  challengeDate?: string;
};

export type ProgressSyncSnapshot = {
  version: 1;
  revision: number;
  updatedAt: string;
  attempts: ProgressSyncAttempt[];
  typingProgress: TypingProgressionWorkspace;
  learningEvents: Array<Omit<LearningEvent, "promptSnapshot" | "response">>;
};

export function isProgressSyncableItemId(value: unknown): boolean;
export function normalizeProgressSnapshot(
  value: unknown,
  options?: { now?: string | Date | number },
): ProgressSyncSnapshot | undefined;
export function createProgressSnapshot(
  state?: {
    attempts?: unknown;
    typingProgress?: unknown;
    learningEvents?: unknown;
  },
  options?: { now?: string | Date | number },
): ProgressSyncSnapshot | undefined;
export function mergeProgressSnapshots(
  local: unknown,
  remote: unknown,
  options?: { now?: string | Date | number },
): ProgressSyncSnapshot;
export function progressSnapshotFingerprint(snapshot: unknown): string;
