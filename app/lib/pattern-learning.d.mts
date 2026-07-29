import type { AttemptRecord } from "./product";
import type { RetrievalGrade } from "./learning-state.mjs";
import type { PatternLesson } from "../data/pattern-lessons";
import type {
  PatternDecisionProbe,
  PatternDecisionSource,
} from "../data/pattern-decision-probes";
import type { PracticeItem } from "./items";

export type PatternReview = {
  lessonId: string;
  lessonRevision: number;
  checkId: string;
  response: string;
  committedAt: string;
  revealedAt?: string;
  grade?: RetrievalGrade;
  updatedAt: string;
};

export type PatternLearningWorkspace = {
  version: 3;
  revision: number;
  updatedAt: string;
  reviews: PatternReview[];
  decisionAttempts: PatternDecisionAttempt[];
  activeSprint?: PatternDecisionSprint;
};

export type PatternDecisionAttempt = {
  id: string;
  sprintId: string;
  source: PatternDecisionSource;
  probeId: string;
  probeRevision: number;
  lessonId: string;
  lessonRevision: number;
  selectedLessonId: string;
  cue: string;
  invariant: string;
  whyNot: string;
  /** Missing only on safely migrated v2 attempts committed before complexity capture. */
  complexity?: string;
  confirmationForAttemptId?: string;
  assisted: boolean;
  wasDue: boolean;
  match: boolean;
  committedAt: string;
  revealedAt?: string;
  grade?: RetrievalGrade;
  completedAt?: string;
  dueAt?: string;
  levelAfter?: number;
  lapseCount?: number;
  updatedAt: string;
};

export type PatternDecisionSprint = {
  id: string;
  source: PatternDecisionSource;
  entries: {
    probeId: string;
    probeRevision: number;
    confirmationForAttemptId?: string;
  }[];
  cursor: number;
  status: "active" | "completed";
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
};

export type PatternDecisionState = {
  lessonId: string;
  level: number;
  lapseCount: number;
  dueAt?: string;
  due: boolean;
  isNew: boolean;
  retained: boolean;
  retainedProbeCount: number;
  status: PatternDecisionEvidenceStatus;
  completedAttempts: number;
  lastAttemptAt?: string;
};

export type PatternDecisionEvidenceStatus =
  | "unobserved"
  | "needs-contrast"
  | "emerging"
  | "retained";

export type PatternEvidence = {
  committedChecks: number;
  revealedChecks: number;
  strongChecks: number;
  worked: boolean;
  guided: boolean;
  independent: boolean;
  transfer: boolean;
};

export const PATTERN_LEARNING_VERSION: 3;
export const PATTERN_RESPONSE_LIMIT: number;
export const PATTERN_REVIEW_LIMIT: number;
export const PATTERN_GRADES: RetrievalGrade[];
export const PATTERN_DECISION_LIMIT: number;
export const PATTERN_DECISION_SPRINT_LIMIT: number;
export const PATTERN_DECISION_BASE_SPRINT_SIZE: 4;
export const PATTERN_DECISION_COMPLEXITY_LIMIT: number;
export const PATTERN_DECISION_INTERVAL_DAYS: number[];
export const PATTERN_DECISION_SOURCES: PatternDecisionSource[];
export const PATTERN_DECISION_EVIDENCE_STATUSES: PatternDecisionEvidenceStatus[];
export function createPatternLearningWorkspace(now?: string): PatternLearningWorkspace;
export function normalizePatternLearningWorkspace(
  value: unknown,
  options?: {
    lessons?: readonly PatternLesson[];
    probes?: readonly PatternDecisionProbe[];
    now?: string;
  },
): PatternLearningWorkspace;
export function commitPatternResponse(
  workspace: PatternLearningWorkspace,
  lesson: PatternLesson,
  checkId: string,
  response: string,
  options?: { now?: string },
): PatternLearningWorkspace;
export function revealPatternAnswer(
  workspace: PatternLearningWorkspace,
  lesson: PatternLesson,
  checkId: string,
  options?: { now?: string },
): PatternLearningWorkspace;
export function gradePatternCheck(
  workspace: PatternLearningWorkspace,
  lesson: PatternLesson,
  checkId: string,
  grade: RetrievalGrade,
  options?: { now?: string },
): PatternLearningWorkspace;
export function derivePatternEvidence(
  lesson: PatternLesson,
  workspace: PatternLearningWorkspace,
  attempts?: AttemptRecord[],
  items?: PracticeItem[],
): PatternEvidence;
export function countStrongPatternChecks(
  lessons: readonly PatternLesson[],
  workspace: PatternLearningWorkspace,
): number;
export function selectNextPatternLesson(
  lessons: readonly PatternLesson[],
  workspace: PatternLearningWorkspace,
  attempts?: AttemptRecord[],
  items?: PracticeItem[],
): PatternLesson | null;
export function derivePatternDecisionState(
  lesson: PatternLesson,
  workspace: PatternLearningWorkspace,
  probes?: readonly PatternDecisionProbe[],
  options?: { now?: string },
): PatternDecisionState;
export function derivePatternDecisionOverview(
  lessons: readonly PatternLesson[],
  probes: readonly PatternDecisionProbe[],
  workspace: PatternLearningWorkspace,
  options?: { now?: string },
): {
  newCount: number;
  dueCount: number;
  readyCount: number;
  retainedCount: number;
  totalPatterns: number;
  states: PatternDecisionState[];
  rows: {
    lessonId: string;
    status: PatternDecisionEvidenceStatus;
    retainedProbeCount: number;
    completedAttempts: number;
    due: boolean;
  }[];
};
export function selectPatternDecisionProbes(
  lessons: readonly PatternLesson[],
  probes: readonly PatternDecisionProbe[],
  workspace: PatternLearningWorkspace,
  options?: { now?: string; count?: number },
): PatternDecisionProbe[];
export function startPatternDecisionSprint(
  workspace: PatternLearningWorkspace,
  lessons: readonly PatternLesson[],
  probes: readonly PatternDecisionProbe[],
  options: {
    id: string;
    now?: string;
    count?: number;
    source?: PatternDecisionSource;
  },
): PatternLearningWorkspace;
export function commitPatternDecision(
  workspace: PatternLearningWorkspace,
  probe: PatternDecisionProbe,
  lesson: PatternLesson,
  input: {
    selectedLessonId: string;
    cue: string;
    invariant: string;
    whyNot: string;
    complexity: string;
    assisted?: boolean;
  },
  options: {
    id: string;
    now?: string;
    probes: readonly PatternDecisionProbe[];
  },
): PatternLearningWorkspace;
export function revealPatternDecision(
  workspace: PatternLearningWorkspace,
  attemptId: string,
  options: { now?: string; probes: readonly PatternDecisionProbe[] },
): PatternLearningWorkspace;
export function gradePatternDecision(
  workspace: PatternLearningWorkspace,
  attemptId: string,
  grade: RetrievalGrade,
  options: {
    now?: string;
    lessons: readonly PatternLesson[];
    probes?: readonly PatternDecisionProbe[];
  },
): PatternLearningWorkspace;
