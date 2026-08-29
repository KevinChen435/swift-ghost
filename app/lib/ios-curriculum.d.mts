import type { ItemId, PracticeItem } from "./items";
import type { AttemptRecord } from "./product";
import type { LearningEvent } from "./learning-state.mjs";
import type { TypingProgressionWorkspace } from "./typing-progression.mjs";

export type IOSReactivationEvidence = {
  items?: readonly PracticeItem[];
  attempts?: readonly AttemptRecord[];
  learningEvents?: readonly LearningEvent[];
  typingProgress?: TypingProgressionWorkspace;
  now?: string | Date | number;
};

export type IOSReactivationItemStatus =
  | "not-started"
  | "practiced"
  | "independent"
  | "due"
  | "outdated"
  | "unavailable";

export type IOSReactivationItemProgress = {
  itemId: ItemId | string;
  itemRevision: number;
  status: IOSReactivationItemStatus;
  activityKind: "concept" | "solve" | "typing";
  independent: boolean;
  attempted: boolean;
  due: boolean;
  retained: boolean;
  outdated: boolean;
  attemptCount: number;
  recallLevel: number;
  completedStages: number[];
  lastAttemptAt: string | null;
  dueAt: string | null;
};

export type IOSReactivationCounts = {
  totalItems: number;
  availableItems: number;
  independent: number;
  attempted: number;
  due: number;
  retained: number;
  outdated: number;
};

export type IOSReactivationModuleProgress = IOSReactivationCounts & {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  outcome: string;
  focus: string[];
  estimatedMinutes: number;
  items: IOSReactivationItemProgress[];
};

export type IOSReactivationPhaseProgress = IOSReactivationCounts & {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  outcome: string;
  estimatedMinutes: number;
  modules: IOSReactivationModuleProgress[];
};

export type IOSReactivationProgress = IOSReactivationCounts & {
  trackId: "swift-ios-reactivation";
  phases: IOSReactivationPhaseProgress[];
  next: { itemId: string; phaseId: string; moduleId: string } | null;
  now: string;
};

export function deriveIOSReactivationProgress(
  phases: readonly unknown[],
  evidence?: IOSReactivationEvidence,
): IOSReactivationProgress;
