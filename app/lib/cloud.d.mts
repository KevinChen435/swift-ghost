export type CloudUnavailableReason =
  | "disabled"
  | "unsupported"
  | "unauthorized"
  | "rate-limited"
  | "server-error"
  | "request-failed"
  | "revision-conflict"
  | "not-public"
  | "invalid-request"
  | "invalid-response"
  | "aborted"
  | "offline"
  | "judge-enqueue-unavailable";

export type CloudResult<T> =
  | { available: true; data: T; status: number }
  | {
      available: false;
      reason: CloudUnavailableReason;
      status?: number;
      retryAfterSeconds?: number;
      conflict?: CloudStudyWorkspaceConflict;
    };

export type CloudCapabilities = {
  apiVersion: string;
  cloudSync: boolean;
  studySync: boolean;
  community: boolean;
  leaderboards: boolean;
  trustedAssessments: boolean;
  auth: "none" | "anonymous" | "session";
  maxAttemptBatch: number;
  privacy: {
    profileDefault: "private";
    activityDefault: "off";
    leaderboardsDefault: "off";
  };
};

export type CloudUser = {
  displayName: string;
};

export type CloudSessionUser = {
  id?: string;
  displayName: string;
  email?: string;
};

export type CloudProfile = {
  handle: string;
  displayName: string | null;
  bio: string | null;
  timezone: string | null;
  isPublic: boolean;
  shareActivity: boolean;
  showOnLeaderboards: boolean;
  shareCommunity: boolean;
  persisted: boolean;
  createdAt?: string;
  updatedAt: string | null;
};

export type CloudSession = {
  authenticated: boolean;
  user: CloudSessionUser | null;
  profile: CloudProfile | null;
};

export type CloudStudyWorkspace = import("./study-plans.mjs").StudyWorkspace;
export type CloudStudyWorkspaceConflict = {
  revision: number;
  workspace: CloudStudyWorkspace | null;
};

export type CloudProfilePatch = {
  handle?: string;
  displayName?: string;
  bio?: string;
  /** null leaves the existing server value unchanged. */
  timezone?: string | null;
  isPublic?: boolean;
  shareActivity?: boolean;
  showOnLeaderboards?: boolean;
  shareCommunity?: boolean;
};

export type CloudPublicProfile = {
  handle: string;
  displayName: string | null;
  bio: string | null;
  stats: { completedAttempts: number; highestStage: number };
  createdAt?: string;
};

export type CloudAttemptInput = {
  id: string;
  itemId: string;
  itemRevision: number;
  stage: number;
  mode: "strict" | "free";
  track?: "interview" | "ios";
  itemTitle?: string;
  title?: string;
  titleSnapshot?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  typedChars?: number;
  totalKeystrokes?: number;
  correctKeystrokes?: number;
  rejectedKeystrokes?: number;
  corrections?: number;
  peeks: number;
  accuracy: number;
  outcome?: "completed" | "abandoned";
  qualification?:
    "syntax" | "guided" | "independent" | "solved" | "assisted" | "incomplete";
  challengeDate?: string;
  sessionId?: string;
};

export type CloudAttemptRejection = {
  id: string;
  code: string;
  message?: string;
};
export type CloudAttemptBatchReceipt = {
  accepted: string[];
  duplicates: string[];
  rejected: CloudAttemptRejection[];
  serverTime?: string;
};

export type CloudCommunityEntry = {
  user: CloudUser;
  itemId: string;
  itemRevision: number;
  itemTitle?: string;
  track: "interview" | "ios";
  stage: number;
  /** Server-computed display metric; never used as a trusted client input. */
  wpm: number;
  accuracy: number;
  durationMs: number;
  completedAt: string;
};

export type CloudItemLeaderboardEntry = {
  rank: number;
  user: CloudUser;
  /** Server-computed rank input. */
  wpm: number;
  accuracy: number;
  stage: number;
  durationMs: number;
  completedAt: string;
  itemRevision?: number;
};

export type CloudDailyLeaderboardEntry = {
  rank: number;
  user: CloudUser;
  score: number;
  completions: number;
  averageAccuracy: number;
  accuracy: number;
  totalDurationMs: number;
  highestStage: number;
  /** Server-computed display metric. */
  wpm: number;
  completed: number;
  minutes: number;
};

export type CloudDailyChallenge = {
  date: string;
  itemId: string;
  itemRevision: number;
  itemTitle: string;
  track: "interview" | "ios";
  stage: 1;
  mode: "strict";
};

export type CloudTrustedJudgeVerdict =
  | "accepted"
  | "wrong-answer"
  | "compile-error"
  | "runtime-error"
  | "time-limit"
  | "judge-error";

export type CloudTrustedChallenge = {
  key: string;
  language: "python" | "swift";
  runtime: string;
  contentRevision: number;
  judgeRevision: number;
  title: string;
  difficulty: "Easy" | "Medium";
  estimatedMinutes: number;
  summary: string;
  prompt: string;
  constraints: string[];
  tags: string[];
  starterCode: string;
  entrypoint: {
    kind: "function";
    name: string;
    parameters?: Array<{ name: string; type: string }>;
    returns?: string;
  };
  samples: Array<{ id: string; name: string; args: unknown[]; expected: unknown }>;
};

export type CloudTrustedSubmission = {
  id: string;
  clientSubmissionId?: string;
  status: "pending" | "settled";
  verdict: CloudTrustedJudgeVerdict | null;
  submittedAt: string;
  settledAt: string | null;
  result: null | {
    passed: number;
    total: number;
    authority: "server-isolated-python" | "server-isolated-swift";
    language: "python" | "swift";
    runtime: string;
    contractDigest?: string;
    contentRevision: number;
    judgeRevision: number;
  };
};

export type CloudTrustedAssignment = {
  id: string;
  program: {
    id: string;
    revision: number;
    title: string;
    evidenceLabel: string;
    language: "python" | "swift";
  };
  challenge: CloudTrustedChallenge;
  status: "active" | "accepted" | "expired";
  assignedAt: string;
  expiresAt: string;
  latestSubmission: CloudTrustedSubmission | null;
};

export type CloudTrustedExampleRun = {
  id: string;
  assignmentId: string;
  clientRunId: string;
  status: "pending" | "settled";
  verdict: CloudTrustedJudgeVerdict | null;
  requestedAt: string;
  settledAt: string | null;
  result: null | {
    passed: number;
    total: number;
    authority: "server-isolated-python" | "server-isolated-swift";
    language: "python" | "swift";
    runtime: string;
    contractDigest: string;
    contentRevision: number;
    judgeRevision: number;
    failedCaseIndex?: number;
    failedCaseId?: string;
    diagnostic?: string;
    publicCaseResults?: Array<{
      id: string;
      visibility: "sample";
      passed: boolean;
      status?: "passed" | "failed" | "wrong-answer" | "compile-error" | "runtime-error" | "time-limit" | "judge-error" | "not-run";
      actual?: unknown;
      diagnostic?: string;
    }>;
  };
};

export type CloudTrustedCustomCaseInput = {
  id: string;
  name: string;
  args: unknown[];
};

export type CloudTrustedCustomRun = {
  id: string;
  assignmentId: string;
  clientRunId: string;
  status: "pending" | "settled";
  verdict: CloudTrustedJudgeVerdict | null;
  requestedAt: string;
  settledAt: string | null;
  result: null | {
    passed: number;
    total: number;
    authority: "server-isolated-swift";
    language: "swift";
    runtime: string;
    contractDigest: string;
    contentRevision: number;
    judgeRevision: number;
    failedCaseIndex?: number;
    diagnostic?: string;
    cases: Array<{
      id: string;
      name: string;
      status: "passed" | "executed" | "failed" | "wrong-answer" | "compile-error" | "runtime-error" | "time-limit" | "judge-error" | "not-run";
      passed: boolean;
      actual?: unknown;
      error?: string;
      diagnostic?: string;
    }>;
  };
};

export type CloudTrustedCustomRunOptions = CloudRequestOptions & {
  challenge?: Pick<
    CloudTrustedChallenge,
    "language" | "runtime" | "contentRevision" | "judgeRevision"
  >;
};

export type CloudTrustedAssignmentList = {
  program: {
    id: string;
    revision: number;
    title: string;
    description: string;
    evidenceLabel: string;
    language: "mixed";
  };
  entries: CloudTrustedAssignment[];
};

export type CloudList<T> = { entries: T[]; nextCursor?: string };
export type CloudItemLeaderboard = CloudList<CloudItemLeaderboardEntry> & {
  itemId: string;
  itemRevision: number;
  stage: number;
  mode: "strict";
};
export type CloudDailyLeaderboard = CloudList<CloudDailyLeaderboardEntry> & {
  date: string;
  challenge: CloudDailyChallenge;
};

export type CloudRequestOptions = { signal?: AbortSignal };
export type CloudTrustedExampleRunOptions = CloudRequestOptions & {
  challenge?: Pick<
    CloudTrustedChallenge,
    "language" | "runtime" | "contentRevision" | "judgeRevision" | "samples"
  >;
};
export type CloudListOptions = CloudRequestOptions & {
  limit?: number;
  cursor?: string;
};
export type CloudTrustedAssignmentListOptions = CloudListOptions & {
  /** Optional server-side allowlisted challenge key filter. */
  challengeKey?: string;
};
export type CloudItemLeaderboardOptions = CloudListOptions & {
  itemRevision?: number;
  stage?: number;
};
export type CloudClientOptions = {
  fetchImpl?: typeof fetch;
  apiRoot?: string;
  disabled?: boolean;
  location?: Pick<Location, "hostname">;
};

export type CloudClient = {
  capabilities(
    options?: CloudRequestOptions,
  ): Promise<CloudResult<CloudCapabilities>>;
  session(options?: CloudRequestOptions): Promise<CloudResult<CloudSession>>;
  getStudyWorkspace(
    options?: CloudRequestOptions,
  ): Promise<CloudResult<CloudStudyWorkspace | null>>;
  putStudyWorkspace(
    workspace: CloudStudyWorkspace,
    options: CloudRequestOptions & { baseRevision: number },
  ): Promise<CloudResult<CloudStudyWorkspace>>;
  trustedAssignments(
    options?: CloudTrustedAssignmentListOptions,
  ): Promise<CloudResult<CloudTrustedAssignmentList>>;
  issueTrustedAssignment(
    clientRequestId: string,
    options?: CloudRequestOptions & {
      language?: "python" | "swift";
      /** Optional server-allowlisted challenge key (for example, a Swift catalog solve). */
      challengeKey?: string;
    },
  ): Promise<CloudResult<CloudTrustedAssignment>>;
  submitTrustedAssignment(
    assignmentId: string,
    submission: { clientSubmissionId: string; source: string },
    options?: CloudRequestOptions,
  ): Promise<CloudResult<CloudTrustedSubmission>>;
  runTrustedExamples(
    assignmentId: string,
    input: { clientRunId: string; source: string },
    options?: CloudTrustedExampleRunOptions,
  ): Promise<CloudResult<CloudTrustedExampleRun>>;
  runTrustedCustomCases(
    assignmentId: string,
    input: {
      clientRunId: string;
      source: string;
      cases: CloudTrustedCustomCaseInput[];
    },
    options?: CloudTrustedCustomRunOptions,
  ): Promise<CloudResult<CloudTrustedCustomRun>>;
  patchProfile(
    patch: CloudProfilePatch | CloudProfile,
    options?: CloudRequestOptions,
  ): Promise<CloudResult<CloudProfile>>;
  publicProfile(
    handle: string,
    options?: CloudRequestOptions,
  ): Promise<CloudResult<CloudPublicProfile>>;
  postAttemptBatch(
    attempts: CloudAttemptInput[],
    options?: CloudRequestOptions & { maximum?: number },
  ): Promise<CloudResult<CloudAttemptBatchReceipt>>;
  communityRecent(
    options?: CloudListOptions,
  ): Promise<CloudResult<CloudList<CloudCommunityEntry>>>;
  itemLeaderboard(
    itemId: string,
    options?: CloudItemLeaderboardOptions,
  ): Promise<CloudResult<CloudItemLeaderboard>>;
  dailyLeaderboard(
    date: string,
    options?: CloudListOptions,
  ): Promise<CloudResult<CloudDailyLeaderboard>>;
};

export function createCloudClient(options?: CloudClientOptions): CloudClient;
export const CLOUD_LIMITS: Readonly<{
  maxAttemptBatch: number;
  maxListEntries: number;
  maxStudyWorkspaceBytes: number;
}>;
