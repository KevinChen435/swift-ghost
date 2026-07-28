export type MockNotebookField =
  | "clarifications"
  | "approach"
  | "invariant"
  | "complexity"
  | "edgeCases"
  | "finalExplanation";

export type MockNotebook = Record<MockNotebookField, string>;

export type MockCheckpointKind =
  | "promptAcknowledged"
  | "approachReady"
  | "codingStarted"
  | "firstTest"
  | "codeCompleted"
  | "explanationReady";

export type MockCheckpoints = Partial<Record<MockCheckpointKind, number>>;

export type MockProblemWorkspace = {
  version: 1;
  itemId: string;
  itemRevision: number;
  source: string;
  notebook: MockNotebook;
  checkpoints: MockCheckpoints;
};

export type MockRubricDimension =
  | "recognition"
  | "reasoning"
  | "implementation"
  | "verification"
  | "communication";

export type MockRubricScore = 0 | 1 | 2 | null;
export type MockRubricScores = Record<MockRubricDimension, MockRubricScore>;

export type MockMistakeTag =
  | "syntax-fluency"
  | "missed-cue"
  | "wrong-invariant"
  | "data-structure"
  | "complexity"
  | "boundary"
  | "implementation"
  | "verification"
  | "communication"
  | "overfit";

export type MockReflectionField =
  | "algorithmic"
  | "languageFluency"
  | "communication"
  | "nextStep";

export type MockDebrief = {
  version: 1;
  scores: MockRubricScores;
  mistakeTags: MockMistakeTag[];
  algorithmic: string;
  languageFluency: string;
  communication: string;
  nextStep: string;
  completedAt: string | null;
};

export type MockDebriefScore = {
  total: number;
  scoredDimensions: number;
  possible: number;
  complete: boolean;
};

export const MOCK_NOTEBOOK_FIELDS: readonly MockNotebookField[];
export const MOCK_CHECKPOINT_KINDS: readonly MockCheckpointKind[];
export const MOCK_RUBRIC_DIMENSIONS: readonly MockRubricDimension[];
export const MOCK_MISTAKE_TAGS: readonly MockMistakeTag[];
export const MOCK_REFLECTION_FIELDS: readonly MockReflectionField[];
export const MOCK_SESSION_LIMITS: Readonly<{
  maxItemIdBytes: number;
  maxItemRevision: number;
  maxNotebookFieldBytes: number;
  maxNotebookBytes: number;
  maxSourceBytes: number;
  maxReflectionFieldBytes: number;
  maxDebriefTextBytes: number;
  maxCheckpointElapsedMs: number;
}>;

export function mockNotebookBytes(notebook: unknown): number;
export function createMockNotebook(
  input?: Partial<MockNotebook> & { readonly [key: string]: unknown },
): MockNotebook;
export function normalizeMockNotebook(raw: unknown): MockNotebook;
export function updateMockNotebook(
  notebook: unknown,
  field: MockNotebookField,
  value: string,
): MockNotebook;

export function normalizeMockCheckpoints(
  raw: unknown,
  maxElapsedMs?: number,
): MockCheckpoints;
export function recordFirstMockCheckpoint(
  checkpoints: unknown,
  kind: MockCheckpointKind,
  elapsedMs: number,
  maxElapsedMs?: number,
): MockCheckpoints;

export function createMockProblemWorkspace(
  input: {
    itemId: string;
    itemRevision: number;
    source?: string;
    notebook?: Partial<MockNotebook> & { readonly [key: string]: unknown };
    checkpoints?: unknown;
    readonly [key: string]: unknown;
  },
  options?: { maxElapsedMs?: number },
): MockProblemWorkspace;
export function normalizeMockProblemWorkspace(
  raw: unknown,
  options?: { maxElapsedMs?: number },
): MockProblemWorkspace;
export function normalizeMockProblemWorkspaces(
  raw: unknown,
  options: {
    problemCount: 1 | 2;
    maxElapsedMs?: number;
    validItemIds?: readonly string[];
  },
): MockProblemWorkspace[];
export function updateMockWorkspaceNotebook(
  workspace: unknown,
  field: MockNotebookField,
  value: string,
  options?: { maxElapsedMs?: number },
): MockProblemWorkspace;
export function updateMockWorkspaceSource(
  workspace: unknown,
  source: string,
  options?: { maxElapsedMs?: number },
): MockProblemWorkspace;
export function recordMockCheckpoint(
  workspace: unknown,
  kind: MockCheckpointKind,
  elapsedMs: number,
  maxElapsedMs?: number,
): MockProblemWorkspace;

export function createMockDebrief(
  input?: {
    scores?: Partial<MockRubricScores> & { readonly [key: string]: unknown };
    mistakeTags?: readonly MockMistakeTag[];
    algorithmic?: string;
    languageFluency?: string;
    communication?: string;
    nextStep?: string;
    completedAt?: string | null;
    readonly [key: string]: unknown;
  },
): MockDebrief;
export function normalizeMockDebrief(raw: unknown): MockDebrief;
export function updateMockDebrief(
  debrief: unknown,
  patch: {
    scores?: Partial<MockRubricScores> & { readonly [key: string]: unknown };
    mistakeTags?: readonly MockMistakeTag[];
    algorithmic?: string;
    languageFluency?: string;
    communication?: string;
    nextStep?: string;
    completedAt?: string | null;
    readonly [key: string]: unknown;
  },
): MockDebrief;
export function mockDebriefScore(debrief: unknown): MockDebriefScore;
export function isMockDebriefComplete(debrief: unknown): boolean;
