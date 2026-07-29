import type { PracticeItem } from "./items";

export type RunManifestMode = "practice" | "timed";
export type RunManifestDuration = 30 | 45 | 60 | 75 | 90 | 105;
export type RunManifestStatus = "draft" | "active" | "completed" | "ended" | "archived";
export type RunManifestSource = "catalog" | "collection" | "study-plan";
export type RunManifestExecution = Readonly<{
  kind: "session" | "virtual-round";
  id: string;
}>;

export type RunManifestEntry = Readonly<{
  itemId: string;
  contentRevision: number;
  judgeRevision?: number;
  title: string;
  lane: string;
  difficulty: string;
  estimatedMinutes: number;
  order: number;
  currentEvidenceEligible: boolean;
}>;

export type RunManifestBase = Readonly<{
  version: 1;
  id: string;
  title: string;
  source: RunManifestSource;
  mode: RunManifestMode;
  durationMinutes: RunManifestDuration | null;
  execution: RunManifestExecution | null;
  createdAt: string;
  entries: RunManifestEntry[];
}>;

export type DraftRunManifest = RunManifestBase & Readonly<{ status: "draft" }>;
export type ActiveRunManifest = Omit<RunManifestBase, "execution"> & Readonly<{
  status: "active";
  execution: RunManifestExecution;
  startedAt: string;
}>;
export type FinishedRunManifest = Omit<RunManifestBase, "execution"> & Readonly<{
  status: "completed" | "ended";
  execution: RunManifestExecution;
  startedAt: string;
  finishedAt: string;
}>;
export type ArchivedRunManifest = Omit<RunManifestBase, "execution"> & Readonly<{
  status: "archived";
  execution: RunManifestExecution;
  startedAt: string;
  finishedAt: string;
  archivedFrom: "completed" | "ended";
  archivedAt: string;
}>;
export type RunManifest =
  | DraftRunManifest
  | ActiveRunManifest
  | FinishedRunManifest
  | ArchivedRunManifest;

export type RunManifestWorkspace = Readonly<{
  version: 1;
  manifests: RunManifest[];
}>;

export type RunManifestRegistryItem = Pick<
  PracticeItem,
  | "itemId"
  | "contentRevision"
  | "title"
  | "track"
  | "language"
  | "source"
  | "difficulty"
  | "estimatedMinutes"
> & Partial<Pick<PracticeItem, "verification" | "transfer" | "archivedAt">> & {
  lane?: string;
};
export type RunManifestRegistry = readonly RunManifestRegistryItem[] | Map<string, RunManifestRegistryItem>;

export type RunManifestAttemptEvidence = Readonly<{
  itemId: string;
  itemRevision?: number;
  contentRevision?: number;
  sessionId?: string;
  virtualRoundId?: string;
  context?: { sessionId?: string; virtualRoundId?: string };
  [key: string]: unknown;
}>;
export type RunManifestSubmissionEvidence = RunManifestAttemptEvidence & Readonly<{
  lifecycle?: "pending" | "settled";
  status?: string;
  judgeRevision?: number;
  verificationRevision?: number;
  judge?: { revision?: number };
  passed?: number;
  total?: number;
}>;
export type RunManifestEvidence = Readonly<{
  attempts?: readonly RunManifestAttemptEvidence[];
  submissions?: readonly RunManifestSubmissionEvidence[];
  receipts?: readonly RunManifestSubmissionEvidence[];
}>;

export type RunManifestEntryReport = RunManifestEntry & Readonly<{
  status: "not-started" | "attempted" | "pending" | "accepted-stale" | "accepted-current";
  attempted: boolean;
  pending: boolean;
  accepted: boolean;
  acceptedCurrent: boolean;
  attemptCount: number;
  submissionCount: number;
}>;
export type RunManifestReport = Readonly<{
  manifestId: string;
  status: RunManifestStatus;
  execution: RunManifestExecution | null;
  scope: "activity-progress-only";
  claimsMastery: false;
  entryCount: number;
  attemptedCount: number;
  pendingCount: number;
  acceptedCount: number;
  currentAcceptedCount: number;
  entries: RunManifestEntryReport[];
}>;

export const RUN_MANIFEST_VERSION: 1;
export const RUN_MANIFEST_MODES: readonly RunManifestMode[];
export const RUN_MANIFEST_DURATIONS: readonly RunManifestDuration[];
export const RUN_MANIFEST_STATUSES: readonly RunManifestStatus[];
export const RUN_MANIFEST_SOURCES: readonly RunManifestSource[];
export const RUN_MANIFEST_LIMITS: Readonly<{
  minEntries: 2;
  maxEntries: 12;
  maxManifests: 100;
  maxIdBytes: 160;
  maxTitleBytes: 500;
  maxLaneBytes: 80;
  maxDifficultyBytes: 40;
  maxRevision: 1_000_000;
  maxEstimatedMinutes: 240;
}>;

export function createRunManifestWorkspace(): RunManifestWorkspace;
export function normalizeRunManifestWorkspace(
  value: unknown,
  options?: { registry?: RunManifestRegistry; now?: string },
): RunManifestWorkspace;
export function createRunManifest(
  workspace: RunManifestWorkspace,
  input: {
    id?: string;
    createdAt?: string;
    title: string;
    source: RunManifestSource;
    mode: RunManifestMode;
    durationMinutes?: RunManifestDuration | null;
    itemIds: readonly string[];
    execution?: RunManifestExecution | null;
  },
  registry: RunManifestRegistry,
  options?: { id?: string; now?: string },
): RunManifestWorkspace;
export function startRunManifest(
  workspace: RunManifestWorkspace,
  manifestId: string,
  options: { now: string; execution?: RunManifestExecution },
): RunManifestWorkspace;
export function resumeRunManifest(
  workspace: RunManifestWorkspace,
  manifestId: string,
): ActiveRunManifest;
export function finishRunManifest(
  workspace: RunManifestWorkspace,
  manifestId: string,
  outcome: "completed" | "ended",
  options: { now: string },
): RunManifestWorkspace;
export function archiveRunManifest(
  workspace: RunManifestWorkspace,
  manifestId: string,
  options: { now: string },
): RunManifestWorkspace;
export function deriveRunManifestReport(
  manifest: RunManifest,
  evidence?: RunManifestEvidence,
  registry?: RunManifestRegistry,
): RunManifestReport | null;
