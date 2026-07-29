export type VirtualRoundPresetId = "sprint" | "standard" | "endurance";
export type VirtualRoundVerdict =
  | "pending"
  | "accepted"
  | "wrong-answer"
  | "runtime-error"
  | "time-limit"
  | "invalid-entrypoint"
  | "judge-error";
export type VirtualRoundProblemState =
  | "unopened"
  | "opened"
  | "attempted"
  | "partial"
  | "accepted"
  | "skipped";

export type VirtualRoundPreset = {
  readonly id: VirtualRoundPresetId;
  readonly title: string;
  readonly description: string;
  readonly durationMinutes: number;
  readonly problemCount: number;
};

export type VirtualRoundSubmission = {
  id: string;
  requestedAt: string;
  judgedAt?: string;
  status: VirtualRoundVerdict;
  durationMs: number;
  passed: number;
  total: number;
};

export type VirtualRoundProblem = {
  id: string;
  itemId: string;
  itemRevision: number;
  verificationRevision: number;
  title: string;
  pattern: string;
  difficulty: string;
  starterSource: string;
  source: string;
  openedAt?: string;
  flagged: boolean;
  submissions: VirtualRoundSubmission[];
};

export type ActiveVirtualRoundRun = {
  version: 1;
  id: string;
  presetId: VirtualRoundPresetId;
  title: string;
  status: "active" | "finalizing";
  startedAt: string;
  endsAt: string;
  currentProblemId: string;
  problems: VirtualRoundProblem[];
  finishRequestedAt?: string;
  finishOutcome?: "submitted" | "expired";
  finishedAt?: undefined;
  outcome?: undefined;
};

export type FinishedVirtualRoundRun = Omit<
  ActiveVirtualRoundRun,
  "status" | "finishedAt" | "outcome" | "finishRequestedAt" | "finishOutcome"
> & {
  status: "finished" | "archived";
  finishedAt: string;
  outcome: "submitted" | "expired";
};

export type VirtualRoundWorkspace = {
  version: 1;
  active: ActiveVirtualRoundRun | null;
  history: FinishedVirtualRoundRun[];
};

export type VirtualRoundCandidate = {
  itemId: string;
  pattern: string;
  difficulty: string;
  independentSolves?: number;
  roundAppearances?: number;
  lastAttemptAt?: string;
  [key: string]: unknown;
};

export type VirtualRoundProblemSnapshot = {
  itemId: string;
  itemRevision: number;
  verificationRevision: number;
  title: string;
  pattern: string;
  difficulty: string;
  starterSource: string;
  source?: string;
};

export const VIRTUAL_ROUND_VERSION: 1;
export const VIRTUAL_ROUND_POINTS_PER_PROBLEM: 100;
export const VIRTUAL_ROUND_WRONG_PENALTY_MS: number;
export const VIRTUAL_ROUND_PRESETS: readonly VirtualRoundPreset[];
export const VIRTUAL_ROUND_LIMITS: Readonly<{
  maxHistory: number;
  maxProblems: number;
  maxSubmissionsPerProblem: number;
  maxSourceBytes: number;
  maxIdBytes: number;
  maxTitleBytes: number;
  maxPatternBytes: number;
  maxDifficultyBytes: number;
}>;

export function selectVirtualRoundItems<T extends VirtualRoundCandidate>(
  candidates: readonly T[],
  problemCount: number,
): T[];
export function createVirtualRoundWorkspace(): VirtualRoundWorkspace;
export function normalizeVirtualRoundWorkspace(
  value: unknown,
  options?: {
    now?: string;
    validItemIds?: Set<string>;
    revisions?: Map<string, number>;
    verificationRevisions?: Map<string, number>;
  },
): VirtualRoundWorkspace;
export function startVirtualRound(
  workspace: VirtualRoundWorkspace,
  presetId: string,
  problemSnapshots: readonly VirtualRoundProblemSnapshot[],
  options: { id: string; now: string },
): VirtualRoundWorkspace;
export function openVirtualRoundProblem(
  workspace: VirtualRoundWorkspace,
  roundId: string,
  itemId: string,
  options: { now: string },
): VirtualRoundWorkspace;
export function updateVirtualRoundSource(
  workspace: VirtualRoundWorkspace,
  roundId: string,
  itemId: string,
  source: string,
): VirtualRoundWorkspace;
export function toggleVirtualRoundFlag(
  workspace: VirtualRoundWorkspace,
  roundId: string,
  itemId: string,
): VirtualRoundWorkspace;
export function requestVirtualRoundSubmission(
  workspace: VirtualRoundWorkspace,
  roundId: string,
  itemId: string,
  input: { id: string; requestedAt: string; source: string },
): VirtualRoundWorkspace;
export function settleVirtualRoundSubmission(
  workspace: VirtualRoundWorkspace,
  roundId: string,
  submissionId: string,
  input: {
    judgedAt: string;
    status: Exclude<VirtualRoundVerdict, "pending">;
    durationMs: number;
    passed: number;
    total: number;
  },
): VirtualRoundWorkspace;
export function finishVirtualRound(
  workspace: VirtualRoundWorkspace,
  roundId: string,
  options: { now: string; outcome: "submitted" | "expired" },
): VirtualRoundWorkspace;
export function expireVirtualRound(
  workspace: VirtualRoundWorkspace,
  options: { now: string },
): VirtualRoundWorkspace;
export function archiveVirtualRound(
  workspace: VirtualRoundWorkspace,
  roundId: string,
): VirtualRoundWorkspace;
export function virtualRoundRemainingMs(
  run: ActiveVirtualRoundRun | null,
  now: number | string,
): number;
export function deriveVirtualRoundProblemScore(problem: VirtualRoundProblem): number;
export function virtualRoundProblemStatus(
  problem: VirtualRoundProblem,
  finished?: boolean,
): VirtualRoundProblemState;
export function deriveVirtualRoundScore(
  run: ActiveVirtualRoundRun | FinishedVirtualRoundRun,
): { score: number; maxScore: number; acceptedCount: number };
export function deriveVirtualRoundReport(run: FinishedVirtualRoundRun): {
  id: string;
  presetId: VirtualRoundPresetId;
  title: string;
  status: "finished" | "archived";
  outcome: "submitted" | "expired";
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  penaltyMs: number;
  score: number;
  maxScore: number;
  acceptedCount: number;
  problemCount: number;
  problems: Array<{
    id: string;
    index: number;
    itemRevision: number;
    verificationRevision: number;
    title: string;
    pattern: string;
    difficulty: string;
    status: VirtualRoundProblemState;
    score: number;
    maxScore: number;
    submissionCount: number;
    flagged: boolean;
    submissions: Array<VirtualRoundSubmission & { elapsedMs: number; score: number }>;
  }>;
} | null;
