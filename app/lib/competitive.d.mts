export type CompetitiveReason =
  | "missing-data"
  | "not-built-in"
  | "different-item"
  | "stale-revision"
  | "incomplete"
  | "not-strict"
  | "not-typing-or-recall"
  | "assisted"
  | "low-accuracy"
  | "implausible-characters"
  | "implausible-duration"
  | "implausible-speed"
  | "invalid-completed-at";

export type CompetitiveAttempt = {
  itemId: string;
  itemRevision: number;
  outcome?: string;
  completed?: boolean;
  mode: string;
  stage: number;
  activity?: string;
  practiceKind?: string;
  peeks: number;
  accuracy: number;
  durationMs: number;
  completedAt: string | number;
};

export type CompetitiveItem = {
  itemId: string;
  source: string;
  contentRevision?: number;
  itemRevision?: number;
  revision?: number;
  code?: string;
  sourceCode?: string;
  text?: string;
};

export type LeaderboardEntry = {
  user?: { displayName?: string };
  displayName?: string;
  wpm: number;
  accuracy: number;
  durationMs: number;
  completedAt: string | number;
  stage?: number;
  itemRevision?: number;
};

export type ComparabilityAssessment =
  | {
      eligible: true;
      reason: null;
      activity: "typing" | "recall";
      sourceLength: number;
      trustedWpm: number;
    }
  | {
      eligible: false;
      reason: CompetitiveReason;
      activity: null;
      sourceLength: number | null;
      trustedWpm: null;
    };

export type AttemptPreviewRow = {
  kind: "attempt";
  activity: "typing" | "recall";
  wpm: number;
  accuracy: number;
  durationMs: number;
  completedAt: string;
};

export type CommunityPreviewRow = {
  kind: "community";
  displayName: string;
  wpm: number;
  accuracy: number;
  durationMs: number;
  completedAt: string;
};

export type LeaderboardPreview =
  | {
      kind: "ineligible";
      assessment: ComparabilityAssessment & { eligible: false };
      candidate: null;
      visibleCount: 0;
      context: [];
    }
  | {
      kind: "empty";
      assessment: ComparabilityAssessment & { eligible: true };
      candidate: AttemptPreviewRow;
      visibleCount: 0;
      context: [AttemptPreviewRow];
    }
  | {
      kind: "top-window";
      assessment: ComparabilityAssessment & { eligible: true };
      candidate: AttemptPreviewRow;
      visibleCount: number;
      aheadOfVisible: number;
      behindVisible: number;
      context: Array<AttemptPreviewRow | CommunityPreviewRow>;
    }
  | {
      kind: "cutoff";
      assessment: ComparabilityAssessment & { eligible: true };
      candidate: AttemptPreviewRow;
      visibleCount: number;
      cutoff: CommunityPreviewRow;
      context: Array<AttemptPreviewRow | CommunityPreviewRow>;
    };

export function computeTrustedWpm(
  sourceLength: number,
  durationMs: number,
): number | null;
export function assessCommunityComparability(
  attempt: CompetitiveAttempt,
  item: CompetitiveItem,
): ComparabilityAssessment;
export function compareLeaderboardEntries(
  left: LeaderboardEntry,
  right: LeaderboardEntry,
): number;
export function orderLeaderboardEntries(
  entries: LeaderboardEntry[],
): LeaderboardEntry[];
export function buildLeaderboardPreview(input?: {
  attempt?: CompetitiveAttempt;
  item?: CompetitiveItem;
  entries?: LeaderboardEntry[];
  contextSize?: number;
}): LeaderboardPreview;
