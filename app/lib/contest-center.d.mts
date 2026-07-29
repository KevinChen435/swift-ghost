import type {
  FinishedVirtualRoundRun,
  VirtualRoundPresetId,
} from "./virtual-rounds.mjs";

export type ContestCenterSection =
  | "overview"
  | "live"
  | "history"
  | "standings"
  | "review";

export type PersonalStanding = {
  id: string;
  presetId: VirtualRoundPresetId;
  title: string;
  completedAt: string;
  score: number;
  maxScore: number;
  scorePercent: number;
  acceptedCount: number;
  problemCount: number;
  elapsedMs: number;
  penaltyMs: number;
  archived: boolean;
  rank: number;
  cohortSize: number;
};

export type ContestSummary = {
  totalRounds: number;
  averageScorePercent: number;
  bestScorePercent: number;
  totalAccepted: number;
  totalProblems: number;
  latestRoundId?: string;
  latestScorePercent: number;
  strongestPreset: null | {
    presetId: VirtualRoundPresetId;
    title: string;
    rounds: number;
    scorePercentTotal: number;
    averageScorePercent: number;
  };
  presetPerformance: Array<{
    presetId: VirtualRoundPresetId;
    title: string;
    rounds: number;
    scorePercentTotal: number;
    averageScorePercent: number;
  }>;
  patternPerformance: Array<{
    pattern: string;
    problems: number;
    accepted: number;
    score: number;
    maxScore: number;
    scorePercent: number;
  }>;
};

export const CONTEST_CENTER_SECTIONS: readonly ContestCenterSection[];
export function normalizeContestCenterSection(value: unknown): ContestCenterSection;
export function buildPersonalStandings(
  history: readonly FinishedVirtualRoundRun[],
  options?: { presetId?: VirtualRoundPresetId | "all" },
): PersonalStanding[];
export function buildContestSummary(
  history: readonly FinishedVirtualRoundRun[],
): ContestSummary;
export function selectContestReport(
  history: readonly FinishedVirtualRoundRun[],
  requestedId?: string,
): null | Omit<PersonalStanding, "rank" | "cohortSize"> & {
  problems: Array<Record<string, unknown>>;
};
