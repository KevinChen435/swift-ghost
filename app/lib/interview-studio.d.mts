export type InterviewStudioFormat = "python-coding" | "ios-technical";
export type InterviewStudioMode = "mock" | "coach";
export type InterviewPhase =
  | "introduction"
  | "clarification"
  | "approach"
  | "implementation"
  | "testing"
  | "complexity"
  | "follow-up"
  | "closing"
  | "completed";
export type InterviewActivePhase = Exclude<InterviewPhase, "completed">;
export type InterviewTranscriptRole = "interviewer" | "candidate" | "system";
export type InterviewTranscriptKind =
  | "prompt"
  | "candidate-response"
  | "phase-transition"
  | "runner-evidence"
  | "coach-hint"
  | "session-ended";
export type InterviewRunnerEventStatus = "passed" | "failed" | "error";
export type InterviewStudioOutcome = "completed" | "ended" | "expired";

export type InterviewStudioScriptSnapshot = {
  version: 1;
  title: string;
  summary: string;
  scenario: string;
  prompts: Record<InterviewActivePhase, string>;
  hints: Partial<Record<InterviewActivePhase, string[]>>;
  referenceCriteria: string[];
};

export type InterviewTranscriptEntry = {
  id: string;
  at: string;
  phase: InterviewPhase;
  role: InterviewTranscriptRole;
  kind: InterviewTranscriptKind;
  text: string;
};

export type InterviewRunnerEvent = {
  id: string;
  at: string;
  phase: InterviewPhase;
  status: InterviewRunnerEventStatus;
  passed?: number;
  total?: number;
  source?: string;
};

export type InterviewStudioSession = {
  version: 1;
  id: string;
  format: InterviewStudioFormat;
  mode: InterviewStudioMode;
  itemId: string;
  itemRevision: number;
  startedAt: string;
  updatedAt: string;
  phase: InterviewPhase;
  script: InterviewStudioScriptSnapshot;
  transcript: InterviewTranscriptEntry[];
  runnerEvents: InterviewRunnerEvent[];
  completedAt?: string;
  outcome?: InterviewStudioOutcome;
};

export type InterviewStudioHistoryRecord = InterviewStudioSession & {
  phase: "completed";
  completedAt: string;
  outcome: InterviewStudioOutcome;
};

export type InterviewStudioState = {
  active: InterviewStudioSession | null;
  history: InterviewStudioHistoryRecord[];
};

export type InterviewStudioReportEvidence = {
  sessionId: string;
  format: InterviewStudioFormat;
  mode: InterviewStudioMode;
  itemId: string;
  itemRevision: number;
  startedAt: string;
  completedAt?: string;
  outcome?: InterviewStudioOutcome;
  durationMs: number;
  candidateResponseCount: number;
  phasesWithCandidateResponse: InterviewPhase[];
  hintCount: number;
  runnerEventCount: number;
  runnerStatusCounts: Record<InterviewRunnerEventStatus, number>;
};

export const INTERVIEW_STUDIO_FORMATS: readonly InterviewStudioFormat[];
export const INTERVIEW_STUDIO_MODES: readonly InterviewStudioMode[];
export const INTERVIEW_PHASES: readonly InterviewPhase[];
export const INTERVIEW_ACTIVE_PHASES: readonly InterviewActivePhase[];
export const INTERVIEW_TRANSCRIPT_ROLES: readonly InterviewTranscriptRole[];
export const INTERVIEW_TRANSCRIPT_KINDS: readonly InterviewTranscriptKind[];
export const INTERVIEW_RUNNER_EVENT_STATUSES: readonly InterviewRunnerEventStatus[];
export const INTERVIEW_STUDIO_OUTCOMES: readonly InterviewStudioOutcome[];
export const INTERVIEW_STUDIO_LIMITS: Readonly<{
  maxHistoryRecords: number;
  maxHistoryBytes: number;
  maxTranscriptEntries: number;
  maxTranscriptBytes: number;
  maxTranscriptEntryBytes: number;
  maxRunnerEvents: number;
  maxRunnerSourceBytes: number;
  maxRunnerSourcesBytes: number;
  maxScriptBytes: number;
  maxResponseBytes: number;
  maxPromptBytes: number;
  maxHintBytes: number;
  maxCriteriaBytes: number;
  maxCriteriaCount: number;
  maxHintsPerPhase: number;
  maxItemIdBytes: number;
  maxIdBytes: number;
  maxItemRevision: number;
}>;

export function createInterviewStudioSession(input: {
  id: string;
  format: InterviewStudioFormat;
  mode: InterviewStudioMode;
  itemId: string;
  itemRevision: number;
  startedAt: string;
  script: {
    title: string;
    summary: string;
    scenario: string;
    prompts: Record<InterviewActivePhase, string>;
    hints?: Partial<Record<InterviewActivePhase, readonly string[]>>;
    referenceCriteria: readonly string[];
  };
}): InterviewStudioSession;

export function currentInterviewPrompt(session: unknown): string | null;
export function commitInterviewResponse(
  session: InterviewStudioSession,
  input: { text: string; at: string },
): InterviewStudioSession;
export function advanceInterviewPhase(
  session: InterviewStudioSession,
  input: { at: string },
): InterviewStudioSession;
export function recordInterviewRunnerEvent(
  session: InterviewStudioSession,
  input: {
    status: InterviewRunnerEventStatus;
    source?: string;
    passed?: number;
    total?: number;
    at: string;
  },
): InterviewStudioSession;
export function recordInterviewRunnerEventForSession(
  session: InterviewStudioSession | null,
  expectedSessionId: string,
  input: {
    status: InterviewRunnerEventStatus;
    source?: string;
    passed?: number;
    total?: number;
    at: string;
  },
): InterviewStudioSession | null;
export function requestInterviewCoachHint(
  session: InterviewStudioSession,
  input: { at: string },
): InterviewStudioSession;
export function finishInterviewStudioSession(
  session: InterviewStudioSession,
  input: { at: string; outcome: InterviewStudioOutcome },
): InterviewStudioHistoryRecord;
export function interviewStudioReportEvidence(
  session: InterviewStudioSession,
): InterviewStudioReportEvidence;
export const deriveInterviewStudioReportEvidence: typeof interviewStudioReportEvidence;

export function normalizeInterviewStudioState(
  raw: unknown,
  options?: {
    validItemIds?: Iterable<string>;
    revisions?: ReadonlyMap<string, number> | Readonly<Record<string, number>>;
  },
): InterviewStudioState;
