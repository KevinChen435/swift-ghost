import type { AttemptRecord } from "./product";

export type AssessmentLane = "python-fluency" | "algorithmic" | "ios-self-assessed";
export type AssessmentRunStatus = "active" | "paused" | "completed" | "archived";
export type AssessmentRunOutcome = "completed" | "ended";
export type AssessmentProbeStatus = "pending" | "refreshed" | "attempted" | "debriefed";
export type AssessmentEvidenceLevel = "not-observed" | "incomplete" | "assisted" | "independent" | "self-assessed";
export type AssessmentRubricDimension = "recognition" | "reasoning" | "implementation" | "verification" | "communication";
export type AssessmentBlocker = "syntax-fluency" | "missed-cue" | "wrong-invariant" | "data-structure" | "complexity" | "boundary" | "implementation" | "verification" | "communication" | "overfit";
export type AssessmentRubric = Record<AssessmentRubricDimension, 0 | 1 | 2>;

export type AssessmentProbe = {
  id: string;
  itemId: string;
  lane: AssessmentLane;
  title: string;
  focus: string;
  estimatedMinutes: number;
};

export type AssessmentProgram = {
  id: "python-reentry" | "ios-pulse";
  title: string;
  shortTitle: string;
  track: "python" | "ios";
  evidenceLabel: string;
  description: string;
  disclaimer: string;
  probes: readonly AssessmentProbe[];
};

export type AssessmentRefresher = {
  kind: "typing" | "known-answer" | "concept-review";
  stage: number;
  usedAt: string;
  attemptId?: string;
};

export type AssessmentObjectiveAttempt = Pick<
  AttemptRecord,
  "itemId" | "itemRevision" | "practiceKind" | "outcome" | "qualification" | "peeks" | "durationMs" | "completedAt" | "conceptGrade" | "sessionId"
> & {
  attemptId?: string;
  verification?: { revision?: number; passed: number; total: number };
};

export type AssessmentDebrief = {
  rubric: AssessmentRubric;
  blockers: AssessmentBlocker[];
  note: string;
  recordedAt: string;
};

export type AssessmentProbeResult = {
  probeId: string;
  itemId: string;
  lane: AssessmentLane;
  status: AssessmentProbeStatus;
  refresher?: AssessmentRefresher;
  objectiveAttempt?: AssessmentObjectiveAttempt;
  debrief?: AssessmentDebrief;
};

export type AssessmentRun = {
  id: string;
  programId: AssessmentProgram["id"];
  status: AssessmentRunStatus;
  outcome?: AssessmentRunOutcome;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  archivedAt?: string;
  currentProbeIndex: number;
  results: AssessmentProbeResult[];
};

export type AssessmentWorkspace = {
  version: 1;
  revision: number;
  updatedAt: string;
  activeRunId: string | null;
  runs: AssessmentRun[];
};

export type AssessmentReport = {
  runId: string;
  programId: AssessmentProgram["id"];
  title: string;
  track: "python" | "ios";
  evidenceLabel: string;
  disclaimer: string;
  status: AssessmentRunStatus;
  outcome?: AssessmentRunOutcome;
  startedAt: string;
  completedAt?: string;
  completion: { attempted: number; debriefed: number; total: number };
  lanes: Record<"pythonFluency" | "algorithmic" | "ios", {
    evidenceKind: "observed" | "self-assessed";
    totalProbes: number;
    attempted: number;
    debriefed: number;
    independent: number;
    assisted: number;
    selfAssessed: number;
    incomplete: number;
    rubricAverage: number | null;
  }>;
  probes: Array<{
    probeId: string;
    itemId: string;
    title: string;
    focus: string;
    lane: AssessmentLane;
    status: AssessmentProbeStatus;
    evidenceLevel: AssessmentEvidenceLevel;
    usedRefresher: boolean;
    rubric: AssessmentRubric;
    rubricTotal: number | null;
    blockers: AssessmentBlocker[];
    note: string;
    objectiveAttempt?: AssessmentObjectiveAttempt;
  }>;
  blockers: Array<{ id: AssessmentBlocker; label: string; count: number }>;
  recommendations: Array<{ id: string; itemId?: string; lane: AssessmentLane; title: string; reason: string }>;
};

export const ASSESSMENT_RUBRIC_DIMENSIONS: readonly Readonly<{ id: AssessmentRubricDimension; label: string; description: string }>[];
export const ASSESSMENT_BLOCKERS: readonly Readonly<{ id: AssessmentBlocker; label: string }>[];
export const ASSESSMENT_PROGRAMS: readonly AssessmentProgram[];
export function assessmentProgram(programId: string): AssessmentProgram | null;
export function createAssessmentWorkspace(now?: string | Date | number): AssessmentWorkspace;
export function normalizeAssessmentProbeResult(value: unknown, probe?: AssessmentProbe | string, options?: { now?: string | Date | number; programId?: string }): AssessmentProbeResult | null;
export function normalizeAssessmentRun(value: unknown, options?: { now?: string | Date | number; programId?: string }): AssessmentRun | null;
export function normalizeAssessmentWorkspace(value: unknown, options?: { now?: string | Date | number; validItemIds?: Iterable<string>; revisions?: ReadonlyMap<string, number> }): AssessmentWorkspace;
export function currentAssessmentProbe(run: unknown): AssessmentProbe | null;
export function startAssessment(workspace: AssessmentWorkspace, programId: string, options?: { id?: string; now?: string | Date | number }): AssessmentWorkspace;
export function resumeAssessment(workspace: AssessmentWorkspace, runId: string, options?: { now?: string | Date | number }): AssessmentWorkspace;
export function recordAssessmentRefresher(workspace: AssessmentWorkspace, runId: string, probeId: string, input?: Partial<AssessmentRefresher>, options?: { now?: string | Date | number }): AssessmentWorkspace;
export function recordAssessmentObjectiveAttempt(workspace: AssessmentWorkspace, runId: string, probeId: string, attempt: Partial<AttemptRecord> & { attemptId?: string }, options?: { now?: string | Date | number }): AssessmentWorkspace;
export function recordAssessmentDebrief(workspace: AssessmentWorkspace, runId: string, probeId: string, input: { rubric?: Partial<Record<AssessmentRubricDimension, number>>; blockers?: string[]; note?: string; mostImportantGap?: string; recordedAt?: string }, options?: { now?: string | Date | number }): AssessmentWorkspace;
export function finishAssessment(workspace: AssessmentWorkspace, runId: string, options?: { now?: string | Date | number; outcome?: "completed" | "ended" }): AssessmentWorkspace;
export function archiveAssessment(workspace: AssessmentWorkspace, runId: string, options?: { now?: string | Date | number }): AssessmentWorkspace;
export function deriveAssessmentReport(run: unknown): AssessmentReport | null;
export function deriveAssessmentReport(workspace: AssessmentWorkspace, runId?: string): AssessmentReport | null;
export function buildAssessmentStudyPlanSeed(value: unknown, options?: { runId?: string; title?: string }): {
  sourceAssessmentRunId: string;
  rationale: string;
  collection: { title: string; description: string; outcome: string; source: "custom"; itemIds: string[]; modules: Array<{ id: string; title: string; outcome: string; itemIds: string[]; patterns: string[] }> };
  plan: { title: string; description: string; paceMinutes: 15 | 30; blocksPerWeek: 3; status: "active" };
} | null;
