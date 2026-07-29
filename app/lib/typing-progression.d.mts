export type TypingStage = 1 | 2 | 3 | 4 | 5;
export type TypingPhase = "worked" | "faded" | "recall";
export type TypingQualification =
  | "syntax"
  | "guided"
  | "independent"
  | "solved"
  | "assisted"
  | "incomplete";

export type TypingAttemptInput = {
  id: string;
  itemId: string;
  itemRevision: number;
  stage: number;
  practiceKind: string;
  outcome: string;
  qualification: string;
  accuracy: number;
  corrections: number;
  peeks: number;
  completedAt: string;
};

export type NormalizedTypingAttempt = TypingAttemptInput & {
  stage: TypingStage;
  practiceKind: "typing";
  outcome: "completed" | "abandoned";
  qualification: TypingQualification;
};

export type TypingAttemptReference = {
  id: string;
  stage: TypingStage;
  completedAt: string;
  diagnosticBypass?: true;
};

export type TypingProgressionRecord = {
  itemId: string;
  itemRevision: number;
  completedStages: TypingStage[];
  references: TypingAttemptReference[];
  attemptCount: number;
  diagnosticCount: number;
  bypassAttemptIds: string[];
  owned: boolean;
  retained: boolean;
  recallLevel: number;
  dueAt: string | null;
  lapses: number;
  firstWorkedAt: string | null;
  firstFadedAt: string | null;
  firstEligibleFadedAt: string | null;
  firstOwnedAt: string | null;
  lastAttemptAt: string | null;
  updatedAt: string;
};

export type TypingProgressionWorkspace = {
  version: 1;
  revision: number;
  updatedAt: string;
  records: TypingProgressionRecord[];
  attempts: NormalizedTypingAttempt[];
};

export type TypingProgressionOptions = {
  now?: string;
  validItemIds?: Iterable<string>;
  revisions?: Map<string, number> | Record<string, number>;
};

export type DerivedTypingProgression = {
  itemId: string;
  itemRevision: number;
  completedStages: TypingStage[];
  attemptIds: string[];
  attemptTimestamps: string[];
  attemptCount: number;
  nextStage: TypingStage;
  phase: TypingPhase;
  owned: boolean;
  retained: boolean;
  due: boolean;
  recallLevel: number;
  dueAt: string | null;
  lapses: number;
  updatedAt: string;
  firstWorkedAt: string | null;
  firstFadedAt: string | null;
  firstEligibleFadedAt: string | null;
  firstOwnedAt: string | null;
  lastAttemptAt: string | null;
  hasDiagnosticBypass: boolean;
  diagnosticOnly: boolean;
  diagnosticCount: number;
  bypassAttemptIds: string[];
};

export const TYPING_PROGRESSION_VERSION: 1;
export const TYPING_PROGRESSION_RECORD_LIMIT: number;
export const TYPING_PROGRESSION_ATTEMPT_LIMIT: number;
export const TYPING_PROGRESSION_REFERENCE_LIMIT: number;
export const TYPING_REVIEW_INTERVAL_DAYS: readonly number[];
export const TYPING_STAGE_PHASES: Readonly<Record<TypingStage, TypingPhase>>;

export function typingStagePhase(stage: number): TypingPhase | null;
export function isCleanTypingRecall(attempt: TypingAttemptInput): boolean;
export function createTypingProgression(now?: string): TypingProgressionWorkspace;
export function normalizeTypingProgression(
  value: unknown,
  options?: TypingProgressionOptions,
): TypingProgressionWorkspace;
export function applyTypingAttempt(
  workspace: unknown,
  attempt: TypingAttemptInput,
  options?: TypingProgressionOptions,
): TypingProgressionWorkspace;
export function rebuildTypingProgression(
  attempts: unknown,
  options?: TypingProgressionOptions,
): TypingProgressionWorkspace;
export function deriveTypingProgression(
  workspace: unknown,
  itemId: string,
  itemRevision: number,
  now?: string,
): DerivedTypingProgression;
export function recommendedTypingStage(
  workspace: unknown,
  itemId: string,
  itemRevision: number,
  now?: string,
): TypingStage;
export function typingReviewStatus(
  workspace: unknown,
  itemId: string,
  itemRevision: number,
  now?: string,
): {
  status: "learning" | "diagnostic" | "lapsed" | "due" | "retained" | "scheduled";
  owned: boolean;
  retained: boolean;
  due: boolean;
  level: number;
  dueAt: string | null;
  lapses: number;
};
export function summarizeTypingProgression(
  workspace: unknown,
  options?: TypingProgressionOptions,
): {
  itemCount: number;
  ownedCount: number;
  retainedCount: number;
  dueCount: number;
  learningCount: number;
  diagnosticCount: number;
  records: DerivedTypingProgression[];
};
