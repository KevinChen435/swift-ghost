"use client";

import {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  INTERVIEW_PATTERN_ORDER,
  IOS_PATTERN_ORDER,
  PATTERN_ORDER,
  PYTHON_PATTERN_ORDER,
  problemLineCount,
  problemUrl,
  type Difficulty,
  type Pattern,
} from "../data/problems";
import { CommunityPanel } from "./CommunityPanel";
import { AttemptForensics } from "./AttemptForensics";
import { LearningAnalytics } from "./LearningAnalytics";
import { FluencyClinic } from "./FluencyClinic";
import { DailyCoach } from "./DailyCoach";
import {
  StudyPlans,
  type StudyCollectionInput,
  type StudyPlanInput,
  type StudyPlanPace,
  type StudyPlanSyncStatus,
} from "./StudyPlans";
import { ReadinessAnalytics } from "./ReadinessAnalytics";
import { ReadinessTrends } from "./ReadinessTrends";
import { TransferEvidenceRecords } from "./TransferEvidenceRecords";
import { AssessmentCenter } from "./AssessmentCenter";
import type { TrustedAssessmentReceiptEvent } from "./TrustedAssessmentPanel";
import {
  VirtualRounds,
  type ActiveVirtualRound,
  type VirtualRoundPreset as VirtualRoundPresetView,
  type VirtualRoundReport as VirtualRoundReportView,
} from "./VirtualRounds";
import {
  TransferLab,
  type TransferTotals,
  type TransferVariant,
} from "./TransferLab";
import { ChallengeStatement } from "./ChallengeStatement";
import { SolveWorkbench, type MobilePane } from "./SolveWorkbench";
import { MockNotebook } from "./MockNotebook";
import { MockDebriefDialog } from "./MockDebriefDialog";
import { CatalogLibrary } from "./CatalogLibrary";
import ChallengeSetActivity from "./ChallengeSetActivity";
import { SessionRecap } from "./SessionRecap";
import { CustomChallengeDialog } from "./CustomChallengeDialog";
import { SubmissionWorkLog } from "./SubmissionWorkLog";
import { AttemptClosureCenter } from "./AttemptClosureCenter";
import { SolutionReviewWorkspace } from "./SolutionReviewWorkspace";
import { WeaknessLab } from "./WeaknessLab";
import { PatternAcademy } from "./PatternAcademy";
import {
  PatternDecisionReview,
  type DecisionInput,
} from "./PatternDecisionReview";
import { TestDesignLab } from "./TestDesignLab";
import {
  ConceptTransferLab,
  type ConceptTransferSource,
} from "./ConceptTransferLab";
import {
  PATTERN_LESSONS,
  type PatternLesson,
  type PatternLessonStep,
} from "../data/pattern-lessons";
import {
  PATTERN_DECISION_PROBES,
  type PatternDecisionProbe,
  type PatternDecisionSource,
} from "../data/pattern-decision-probes";
import {
  TEST_DESIGN_PROBES,
  type TestDesignLane,
  type TestDesignProbe,
  type TestDesignSource,
} from "../data/test-design-probes";
import {
  CONCEPT_TRANSFER_VARIANTS,
  type ConceptTransferLane,
} from "../data/concept-transfer-variants";
import { getSolutionGuide } from "../data/solution-guides";
import {
  InterviewStudioPanel,
  type InterviewPanelSession,
} from "./InterviewStudioPanel";
import { PracticeEditor } from "./PracticeEditor";
import { ChallengeConsole } from "./ChallengeConsole";
import { SwiftSolveConsole } from "./SwiftSolveConsole";
import {
  ConceptPractice,
  type ConceptCompletionInput,
} from "./ConceptPractice";
import {
  PostAttemptDebrief,
  type DebriefInput,
} from "./PostAttemptDebrief";
import {
  PYTHON_RUNNER_LIMITS,
  createPythonRunner,
  type PythonRunner,
  type PythonVerificationResult,
} from "../lib/python-runner.mjs";
import {
  BUILTIN_ITEMS,
  canSolveItem,
  itemDisplayId,
  makeCustomItem,
  updateCustomItem,
  type CodeLanguage,
  type ItemId,
  type PracticeItem,
} from "../lib/items";
import {
  buildSessionQueue,
  type SessionLanguage,
  type SessionQueueEntry,
  type SessionSource,
  type SessionStageMode,
  type SessionTrack,
} from "../lib/sessions.mjs";
import {
  buildSessionReplayQueue,
  type SessionReplayMode,
} from "../lib/session-recap.mjs";
import {
  parseRoute,
  resolveRouteItem,
  routeForItem,
  serializeRoute,
  type AppRoute,
  type ContestSection,
  type RecordsSection,
} from "../lib/routes.mjs";
import {
  buildContestSummary,
  buildPersonalStandings,
} from "../lib/contest-center.mjs";
import {
  WEAKNESS_META,
  buildWeaknessLab,
  type WeaknessCase,
  type WeaknessEvidence,
  type WeaknessFilter,
  type WeaknessLane,
} from "../lib/weakness-lab.mjs";
import {
  createCloudClient,
  type CloudCapabilities,
  type CloudDailyChallenge,
  type CloudItemLeaderboard,
  type CloudSession,
  type CloudTrustedAssignment,
  type CloudTrustedExampleRun,
  type CloudTrustedSubmission,
} from "../lib/cloud.mjs";
import {
  assessCommunityComparability,
  buildLeaderboardPreview,
} from "../lib/competitive.mjs";
import {
  CATALOG_LIMITS,
  DEFAULT_CATALOG_QUERY,
  deleteCatalogView,
  normalizeCatalogQuery,
  saveCatalogView,
  updateCatalogView,
  type CatalogQuery,
} from "../lib/catalog-discovery.mjs";
import {
  DEFAULT_SUBMISSION_WORK_LOG_QUERY,
  normalizeSubmissionWorkLogQuery,
  type SubmissionWorkLogQuery,
} from "../lib/submission-work-log.mjs";
import {
  requestSubmission as requestSubmissionReceipt,
  resolveSubmissionSource,
  settleSubmission as settleSubmissionReceipt,
  settledSubmissionRecords,
  type SubmissionContextKind,
  type SubmissionReceipt,
  type SubmissionRequest,
} from "../lib/submission-log.mjs";
import {
  pruneSubmissionAnnotations,
  updateSubmissionAnnotation,
  type SubmissionAnnotation,
} from "../lib/submission-annotations.mjs";
import {
  completeAttemptClosure as completeAttemptClosureRecord,
  deriveAttemptClosureModel,
  reconcileAttemptClosureWorkspace,
  updateAttemptClosureDraft,
  type AttemptClosureRecord,
} from "../lib/attempt-closures.mjs";
import {
  createSolutionReview,
  scheduleReasonForReview,
  upsertSolutionReview,
  type SolutionReviewRecord,
} from "../lib/solution-review.mjs";
import {
  EMPTY_STATE,
  STAGES,
  SUPPORTED_STATE_VERSIONS,
  activeStreak,
  analyzeEdit,
  clearStateFallbacksForScope,
  completedAttempts,
  consistencyFromSamples,
  currentMetrics,
  customTestcaseSchemaForItem,
  dailyItem,
  dayKey,
  eligibleAttempt,
  formatDuration,
  isReviewDue,
  itemStats,
  loadStateForScope,
  makeId,
  maskCode,
  milestones,
  normalizeState,
  personalBest,
  practicedMinutesToday,
  qualificationFor,
  recommendedStage,
  reviewDueAt,
  saveStateForScope,
  submissionEvidence,
  type AppState,
  type AttemptRecord,
  type Draft,
  type PracticeKind,
  type Settings,
  type SubmissionRecord,
  type SessionHistoryRecord,
  type Theme,
  type TrainingSession,
  type View,
} from "../lib/product";
import {
  applyTypingAttempt,
  deriveTypingProgression,
} from "../lib/typing-progression.mjs";
import {
  GUEST_PERSISTENCE_SCOPE,
  resolvePersistenceScope,
  scopeMatchesAuthenticatedUser,
  type PersistenceScope,
} from "../lib/account-storage.mjs";
import {
  backupInventory,
  createBackupEnvelope,
  hasMeaningfulBackupState,
  readBackupPayload,
} from "../lib/backup.mjs";
import {
  addCustomTestcase,
  buildCustomTestcaseExecution,
  createCustomTestcaseCollection,
  deleteCustomTestcase,
  duplicateCustomTestcase,
  selectCustomTestcase,
  updateCustomTestcase,
  updateCustomTestcaseField,
  type CustomTestcase,
  type CustomTestcaseCollection,
  type CustomTestcaseField,
} from "../lib/custom-testcases.mjs";
import {
  normalizeTimelineSamples,
  type TimelineSample,
  type WeakLine,
} from "../lib/analytics.mjs";
import {
  deriveFluencyClinicModel,
  enqueueFluencyClinicCase,
  fluencyClinicCaseId,
  reconcileFluencyClinicWorkspace,
  recordFluencyClinicPass,
  type FluencyClinicPassKind,
  type FluencyClinicRecord,
} from "../lib/fluency-clinic.mjs";
import {
  deleteProblemNote,
  saveProblemNote,
  type ProblemNote,
} from "../lib/problem-notes.mjs";
import {
  activityKindFor,
  upsertLearningEvent,
  type LearningEvent,
} from "../lib/learning-state.mjs";
import {
  commitPatternDecision,
  commitPatternResponse,
  derivePatternDecisionOverview,
  gradePatternDecision,
  gradePatternCheck,
  revealPatternDecision,
  revealPatternAnswer,
  startPatternDecisionSprint,
} from "../lib/pattern-learning.mjs";
import {
  commitTestDesignAttempt,
  deriveTestDesignOverview,
  gradeTestDesignAttempt,
  revealTestDesignAttempt,
  saveTestDesignDraft,
  startTestDesignSprint,
  type TestDesignInput,
} from "../lib/test-design.mjs";
import {
  commitConceptTransferAttempt,
  finishConceptTransferAttempt,
  recordConceptTransferCriteria,
  recordConceptTransferTeachBack,
  revealConceptTransferHint,
  selectConceptTransferVariant,
  selfGradeConceptTransferAttempt,
  startConceptTransferAttempt,
  summarizeConceptTransferWorkspace,
  updateConceptTransferDraft,
  type ConceptTransferDraft,
  type ConceptTransferGrade,
} from "../lib/concept-transfer.mjs";
import {
  activateStudyPlan,
  appendStudyCollectionItems,
  STUDY_PLAN_LIMITS,
  createStudyCollection,
  createStudyPlan,
  deleteStudyCollection,
  deleteStudyPlan,
  instantiateStudyPlanTemplate,
  linkStudyPlanSession,
  mergeStudyWorkspaces,
  pauseStudyPlan,
  updateStudyCollection,
  updateStudyPlan,
} from "../lib/study-plans.mjs";
import {
  archiveAssessment,
  buildAssessmentStudyPlanSeed,
  deriveAssessmentReport,
  finishAssessment,
  recordAssessmentDebrief,
  recordAssessmentObjectiveAttempt,
  recordAssessmentRefresher,
  resumeAssessment,
  startAssessment,
  type AssessmentBlocker,
  type AssessmentProbe,
  type AssessmentRubric,
} from "../lib/assessments.mjs";
import {
  selectConceptCheckIndex,
  supportsConceptPractice,
} from "../lib/concept-practice.mjs";
import {
  VIRTUAL_ROUND_POINTS_PER_PROBLEM,
  VIRTUAL_ROUND_LIMITS,
  VIRTUAL_ROUND_PRESETS,
  archiveVirtualRound,
  deriveVirtualRoundProblemScore,
  deriveVirtualRoundReport,
  deriveVirtualRoundScore,
  expireVirtualRound,
  finishVirtualRound,
  openVirtualRoundProblem,
  requestVirtualRoundSubmission,
  selectVirtualRoundItems,
  settleVirtualRoundSubmission,
  startVirtualRound,
  toggleVirtualRoundFlag,
  updateVirtualRoundSource,
  virtualRoundProblemStatus,
  virtualRoundRemainingMs,
  type ActiveVirtualRoundRun,
} from "../lib/virtual-rounds.mjs";
import {
  RUN_MANIFEST_DURATIONS,
  archiveRunManifest,
  createRunManifest,
  deriveRunManifestReport,
  finishRunManifest,
  resumeRunManifest,
  startRunManifest,
  type RunManifestMode,
  type RunManifestDuration,
  type RunManifestExecution,
  type RunManifestWorkspace,
} from "../lib/run-manifests.mjs";
import {
  MOCK_INTERVIEW_PROBLEM_COUNTS,
  MOCK_INTERVIEW_PRESETS,
  formatMockClock,
  mockInterviewEndsAt,
  mockInterviewRemainingMs,
  mockInterviewPreset,
  selectMockInterviewItems,
  type MockInterviewProblemCount,
  type MockInterviewPresetId,
} from "../lib/mock-interview.mjs";
import {
  MOCK_NOTEBOOK_FIELDS,
  createMockDebrief,
  createMockProblemWorkspace,
  normalizeMockProblemWorkspace,
  recordMockCheckpoint,
  updateMockDebrief,
  updateMockNotebook,
  type MockCheckpointKind,
  type MockDebrief,
  type MockNotebook as MockNotebookValue,
} from "../lib/mock-session.mjs";
import {
  challengeVerificationForPurpose,
  classifySubmissionResult,
  defaultCustomCaseInput,
  isRecordableChallengeResult,
} from "../lib/challenge-lab.mjs";
import {
  deriveTransferProgress,
  recordTransferTargeted,
  recordTransferDebriefReveal,
  recordTransferHint,
  recordTransferOpened,
  selectNextTransferVariant,
} from "../lib/transfer-lab.mjs";
import { buildTransferRecords } from "../lib/transfer-records.mjs";
import {
  INTERVIEW_STUDIO_LIMITS,
  advanceInterviewPhase,
  commitInterviewResponse,
  createInterviewStudioSession,
  finishInterviewStudioSession,
  recordInterviewRunnerEventForSession,
  requestInterviewCoachHint,
  type InterviewRunnerEventStatus,
  type InterviewStudioFormat,
  type InterviewStudioMode,
  type InterviewStudioSession,
  type InterviewStudioState,
  type InterviewStudioHistoryRecord,
} from "../lib/interview-studio.mjs";
import {
  iosTechnicalScreenScript,
  pythonInterviewScript,
} from "../data/interview-scripts";

type Result = AttemptRecord & {
  item: PracticeItem;
  previousBest: AttemptRecord | null;
  nextReview: Date | null;
  typingEvidence?: {
    owned: boolean;
    retained: boolean;
    nextStage: 1 | 2 | 3 | 4 | 5;
    diagnosticOnly: boolean;
    recallLevel: number;
  };
  sessionNext?: {
    itemId: ItemId;
    stage: number;
    practiceKind: PracticeKind;
  };
  sessionComplete?: boolean;
  mockInterview?: boolean;
  transferEvidenceClass?:
    | "cold-proof"
    | "spaced-recheck"
    | "early-reconstruction"
    | "assisted-reconstruction";
};
type SessionBuildOptions = {
  name: string;
  count: number;
  source: SessionSource;
  track: SessionTrack;
  language: SessionLanguage;
  pattern: string;
  difficulty: string;
  stageMode: SessionStageMode;
  studyPlanId?: string;
  studyCollectionIds?: string[];
};
type CloudRuntime = {
  status:
    "checking" | "local" | "signed-out" | "connected" | "syncing" | "error";
  capabilities: CloudCapabilities | null;
  session: CloudSession | null;
  dailyChallenge: CloudDailyChallenge | null;
  refresh: number;
};

const cloudClient = createCloudClient();
const STATE_SAVE_DEBOUNCE_MS = 300;

const THEMES: { id: Theme; label: string; colors: string[] }[] = [
  {
    id: "midnight",
    label: "Midnight",
    colors: ["#09111f", "#5eead4", "#a78bfa"],
  },
  { id: "paper", label: "Paper", colors: ["#f6f2e8", "#166534", "#b45309"] },
  { id: "forest", label: "Forest", colors: ["#0c1914", "#86efac", "#fcd34d"] },
  {
    id: "synthwave",
    label: "Synthwave",
    colors: ["#1d102b", "#f472b6", "#22d3ee"],
  },
  { id: "ember", label: "Ember", colors: ["#1a100d", "#fb923c", "#facc15"] },
  { id: "ocean", label: "Ocean", colors: ["#071924", "#38bdf8", "#67e8f9"] },
];

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "learn", label: "Learn", icon: "◎" },
  { id: "today", label: "Today", icon: "◉" },
  { id: "plans", label: "Plans", icon: "◎" },
  { id: "improve", label: "Improve", icon: "◈" },
  { id: "practice", label: "Practice", icon: "⌨" },
  { id: "sessions", label: "Studio", icon: "≡" },
  { id: "assessments", label: "Assess", icon: "◇" },
  { id: "library", label: "Problems", icon: "▦" },
  { id: "records", label: "Records", icon: "↗" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

const LANGUAGE_META: Record<
  CodeLanguage,
  { label: string; short: string; file: string; note: string }
> = {
  python: {
    label: "Python",
    short: "Py",
    file: "solution.py",
    note: "Python note",
  },
  swift: {
    label: "Swift",
    short: "S",
    file: "Solution.swift",
    note: "Swift note",
  },
};

function laneLabel(item: Pick<PracticeItem, "track" | "language">) {
  if (item.track === "ios") return "iOS & Swift";
  return `${LANGUAGE_META[item.language].label} interview`;
}

function coercePracticeKind(
  item: Pick<
    PracticeItem,
    | "language"
    | "verification"
    | "trustedChallengeKey"
    | "track"
    | "recallChecks"
    | "conceptAnswers"
    | "transfer"
  >,
  requested: PracticeKind | undefined,
): PracticeKind {
  if (item.transfer) return "solving";
  if (
    requested === "solving" &&
    ((item.language === "python" && item.verification) ||
      (item.language === "swift" && item.trustedChallengeKey))
  )
    return "solving";
  const supportsConcept = supportsConceptPractice(item);
  if (supportsConcept && (requested === "concept" || requested === undefined))
    return "concept";
  return "typing";
}

function currentJudgeRevision(item: Pick<PracticeItem, "trustedJudgeRevision" | "verification">) {
  return item.trustedJudgeRevision ?? item.verification?.revision ?? 1;
}

function matchesLane(
  item: Pick<PracticeItem, "track" | "language">,
  value: "All" | "python" | "swift" | "ios",
) {
  if (value === "All") return true;
  if (value === "ios") return item.track === "ios";
  return item.track === "interview" && item.language === value;
}

function freshDraft(
  itemId: ItemId,
  stage: number,
  itemRevision = 1,
  challengeDate?: string,
  sessionId?: string,
  practiceKind: PracticeKind = "typing",
  initialValue = "",
  assessment?: { runId: string; probeId: string },
  virtualRoundId?: string,
): Draft {
  return {
    itemId,
    itemRevision,
    stage,
    practiceKind,
    value: initialValue,
    startedAt: null,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    rejectedKeystrokes: 0,
    corrections: 0,
    peeks: 0,
    keyErrors: {},
    lineErrors: {},
    timeline: [],
    testRuns: 0,
    submissions: 0,
    customCaseInput: "",
    challengeDate,
    sessionId,
    assessmentRunId: assessment?.runId,
    assessmentProbeId: assessment?.probeId,
    virtualRoundId,
  };
}

function replaceActiveInterviewStudio(
  studio: InterviewStudioState,
  next: InterviewStudioSession,
  at: string,
): InterviewStudioState {
  const previous =
    studio.active?.phase === "completed" &&
    studio.active.completedAt &&
    studio.active.outcome
      ? (studio.active as InterviewStudioHistoryRecord)
      : studio.active
        ? finishInterviewStudioSession(studio.active, {
            at,
            outcome: "ended",
          })
        : null;
  const history = previous ? [...studio.history, previous] : studio.history;
  return {
    active: next,
    history: history.slice(-INTERVIEW_STUDIO_LIMITS.maxHistoryRecords),
  };
}

function archiveActiveInterviewStudio(
  studio: InterviewStudioState,
  at: string,
  outcome: "completed" | "ended" | "expired",
  expectedId?: string,
): InterviewStudioState {
  if (!studio.active || (expectedId && studio.active.id !== expectedId)) {
    return studio;
  }
  const archived =
    studio.active.phase === "completed" &&
    studio.active.completedAt &&
    studio.active.outcome
      ? (studio.active as InterviewStudioHistoryRecord)
      : finishInterviewStudioSession(studio.active, { at, outcome });
  return {
    active: null,
    history: [...studio.history, archived].slice(
      -INTERVIEW_STUDIO_LIMITS.maxHistoryRecords,
    ),
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function sessionHistoryRecord(
  session: TrainingSession,
  entries: SessionQueueEntry[],
  outcome: "completed" | "ended" | "expired",
  completedAt = new Date().toISOString(),
): SessionHistoryRecord {
  const laneMinutes = entries.reduce<
    Record<"review" | "interview" | "python" | "ios", number>
  >(
    (totals, entry) => {
      const lane =
        entry.lane ??
        (entry.practiceKind === "concept"
          ? "ios"
          : entry.practiceKind === "solving"
            ? "interview"
            : "python");
      totals[lane] += entry.estimatedMinutes ?? 0;
      return totals;
    },
    { review: 0, interview: 0, python: 0, ios: 0 },
  );
  return {
    id: session.id,
    name: session.name,
    kind: session.kind,
    startedAt: session.createdAt,
    completedAt,
    completed: entries.filter((entry) => entry.status === "completed").length,
    total: entries.length,
    outcome,
    ...(session.kind === "practice"
      ? {
          entries: entries.slice(0, 20).map((entry) => ({
            itemId: entry.itemId,
            itemRevision: entry.itemRevision,
            stage: entry.stage,
            status: entry.status,
            practiceKind: entry.practiceKind ?? "typing",
            ...(entry.attemptId ? { attemptId: entry.attemptId } : {}),
            ...(entry.estimatedMinutes
              ? { estimatedMinutes: entry.estimatedMinutes }
              : {}),
            ...(entry.rationale ? { rationale: entry.rationale } : {}),
            ...(entry.lane ? { lane: entry.lane } : {}),
          })),
        }
      : {}),
    studyPlanId: session.studyPlanId,
    studyCollectionIds: session.studyCollectionIds,
    laneMinutes,
    ...(session.kind === "mock"
      ? {
          durationMinutes: session.durationMinutes,
          mockPreset: session.mockPreset,
          problemCount: session.problemCount,
          problems: session.mockProblems ?? [],
        }
      : {}),
  };
}

function finishLinkedRunManifest(
  workspace: RunManifestWorkspace,
  execution: { kind: "session" | "virtual-round"; id: string },
  outcome: "completed" | "ended",
  now: string,
) {
  const active = workspace.manifests.find(
    (manifest) =>
      manifest.status === "active" &&
      manifest.execution?.kind === execution.kind &&
      manifest.execution.id === execution.id,
  );
  return active
    ? finishRunManifest(workspace, active.id, outcome, { now })
    : workspace;
}

function endActiveRunManifest(workspace: RunManifestWorkspace, now: string) {
  const active = workspace.manifests.find(
    (manifest) => manifest.status === "active",
  );
  return active
    ? finishRunManifest(workspace, active.id, "ended", { now })
    : workspace;
}

function mockElapsedMs(session: TrainingSession, at = Date.now()) {
  const startedAt = Date.parse(session.createdAt);
  const limit = Math.max(1, session.durationMinutes ?? 45) * 60_000;
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, Math.min(limit, Math.round(at - startedAt)));
}

function withMockDraftSnapshot(
  session: TrainingSession,
  draft: Draft | null,
): TrainingSession {
  if (
    session.kind !== "mock" ||
    !draft ||
    draft.sessionId !== session.id ||
    !session.mockProblems
  )
    return session;
  const maxElapsedMs = Math.max(1, session.durationMinutes ?? 45) * 60_000;
  return {
    ...session,
    mockProblems: session.mockProblems.map((workspace) =>
      workspace.itemId === draft.itemId &&
      workspace.itemRevision === draft.itemRevision
        ? normalizeMockProblemWorkspace(
            { ...workspace, source: draft.value },
            { maxElapsedMs },
          )
        : workspace,
    ),
  };
}

function withMockCheckpoint(
  session: TrainingSession,
  itemId: ItemId,
  kind: MockCheckpointKind,
  at = Date.now(),
): TrainingSession {
  if (session.kind !== "mock" || !session.mockProblems) return session;
  const maxElapsedMs = Math.max(1, session.durationMinutes ?? 45) * 60_000;
  return {
    ...session,
    mockProblems: session.mockProblems.map((workspace) =>
      workspace.itemId === itemId
        ? recordMockCheckpoint(
            workspace,
            kind,
            mockElapsedMs(session, at),
            maxElapsedMs,
          )
        : workspace,
    ),
  };
}

function formatDay(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(value);
}

function useModalKeyboard(
  onClose: () => void,
  dialogRef: React.RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = () => [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]",
      ) ?? []),
    ];
    const frame = window.requestAnimationFrame(() =>
      (
        dialogRef.current?.querySelector<HTMLElement>(
          "[data-modal-autofocus]",
        ) ?? focusable()[0]
      )?.focus(),
    );
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [dialogRef]);
}

export default function SwiftGhostApp() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [ready, setReady] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [persistenceScope, setPersistenceScope] =
    useState<PersistenceScope>();
  const persistenceScopeRef = useRef<PersistenceScope | undefined>(undefined);
  const volatileScopeStateRef = useRef(new Map<PersistenceScope, AppState>());
  const [guestDataAvailable, setGuestDataAvailable] = useState(false);
  const [view, setView] = useState<View>("today");
  const [patternRouteId, setPatternRouteId] = useState<string>();
  const [patternLessonStep, setPatternLessonStep] =
    useState<PatternLessonStep>("recognize");
  const [patternReviewMode, setPatternReviewMode] =
    useState<"mixed" | "tests" | "reconstruct">();
  const [patternSprintId, setPatternSprintId] = useState<string>();
  const [testDesignSprintId, setTestDesignSprintId] = useState<string>();
  const [testDesignLane, setTestDesignLane] =
    useState<TestDesignLane>("python");
  const [testDesignSource, setTestDesignSource] =
    useState<TestDesignSource>("academy");
  const [testDesignAttemptId, setTestDesignAttemptId] = useState<string>();
  const [conceptTransferLane, setConceptTransferLane] =
    useState<ConceptTransferLane>("swift");
  const [conceptTransferSource, setConceptTransferSource] =
    useState<ConceptTransferSource>("academy");
  const [conceptTransferVariantId, setConceptTransferVariantId] =
    useState<string>();
  const [catalogQuery, setCatalogQuery] = useState<CatalogQuery>(() =>
    normalizeCatalogQuery(DEFAULT_CATALOG_QUERY),
  );
  const [recordsSection, setRecordsSection] =
    useState<RecordsSection>("overview");
  const [reviewAttemptId, setReviewAttemptId] = useState<string>();
  const [closureRouteId, setClosureRouteId] = useState<string>();
  const [fluencyClinicRouteId, setFluencyClinicRouteId] = useState<string>();
  const [transferRecordVariantId, setTransferRecordVariantId] =
    useState<string>();
  const [transferRecordAttemptId, setTransferRecordAttemptId] =
    useState<string>();
  const [submissionLogQuery, setSubmissionLogQuery] =
    useState<SubmissionWorkLogQuery>(() =>
      normalizeSubmissionWorkLogQuery(DEFAULT_SUBMISSION_WORK_LOG_QUERY),
    );
  const [assessmentRouteId, setAssessmentRouteId] = useState<string>();
  const [weaknessFilter, setWeaknessFilter] =
    useState<WeaknessFilter>("priority");
  const [weaknessLane, setWeaknessLane] = useState<WeaknessLane>("all");
  const [weaknessCaseId, setWeaknessCaseId] = useState<string>();
  const [contestSection, setContestSection] =
    useState<ContestSection>("overview");
  const [contestRoundId, setContestRoundId] = useState<string>();
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [selectedId, setSelectedId] = useState<ItemId>(BUILTIN_ITEMS[0].itemId);
  const [stage, setStage] = useState(1);
  const [reveal, setReveal] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [mockReviewSessionId, setMockReviewSessionId] = useState<string | null>(
    null,
  );
  const [now, setNow] = useState(0);
  const [toast, setToast] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [practiceKind, setPracticeKind] = useState<PracticeKind>("typing");
  const [practiceEpoch, setPracticeEpoch] = useState(0);
  const [customEditor, setCustomEditor] = useState<PracticeItem | "new" | null>(
    null,
  );
  const [cloud, setCloud] = useState<CloudRuntime>({
    status: "checking",
    capabilities: null,
    session: null,
    dailyChallenge: null,
    refresh: 0,
  });
  const [studySyncStatus, setStudySyncStatus] =
    useState<StudyPlanSyncStatus>("checking");
  const studyServerRevisionRef = useRef(0);
  const studySyncReadyRef = useRef(false);
  const studySyncedFingerprintRef = useRef("");
  const studySyncEpochRef = useRef(0);
  const [studySyncEpoch, setStudySyncEpoch] = useState(0);
  const [studySyncReadyVersion, setStudySyncReadyVersion] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const expireMockInterviewRef = useRef<(sessionId: string) => void>(() => {});
  expireMockInterviewRef.current = expireMockInterview;
  const expireVirtualRoundRef = useRef<(roundId: string) => void>(() => {});
  expireVirtualRoundRef.current = expireActiveVirtualRound;
  const blockVirtualRoundNavigationRef = useRef<() => boolean>(() => false);
  blockVirtualRoundNavigationRef.current = blockVirtualRoundNavigation;
  const restoringBlockedHistoryRef = useRef(false);

  const allItems = useMemo(
    () => [
      ...BUILTIN_ITEMS,
      ...state.customItems.filter((item) => !item.archivedAt),
    ],
    [state.customItems],
  );
  const curriculumItems = useMemo(
    () => allItems.filter((candidate) => !candidate.transfer),
    [allItems],
  );
  const transferSubmissionEvidence = useMemo(
    () => submissionEvidence(state),
    [state],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadStateForScope(GUEST_PERSISTENCE_SCOPE);
      const items = [
        ...BUILTIN_ITEMS,
        ...restored.customItems.filter((item) => !item.archivedAt),
      ];
      const route = parseRoute(window.location.href);
      const routedItem = resolveRouteItem(items, route);
      const restoredItem =
        items.find((candidate) => candidate.itemId === restored.lastItemId) ??
        BUILTIN_ITEMS[0];
      const initialItem = routedItem ?? restoredItem;
      const restoredPracticeKind =
        restored.draft?.itemId === initialItem.itemId
          ? restored.draft.practiceKind
          : undefined;
      const initialPracticeKind = coercePracticeKind(
        initialItem,
        route.practiceKind ?? restoredPracticeKind,
      );
      const hydratedState =
        route.view === "practice" && initialItem.transfer
          ? {
              ...restored,
              transferWorkspace: recordTransferOpened(
                restored.transferWorkspace,
                initialItem.itemId,
                {
                  now: new Date().toISOString(),
                  variantRevision: initialItem.contentRevision,
                },
              ),
            }
          : restored;
      stateRef.current = hydratedState;
      setState(hydratedState);
      setView(route.view);
      setPatternRouteId(route.patternId);
      setPatternLessonStep(route.lessonStep ?? "recognize");
      setPatternReviewMode(route.learnReview);
      setPatternSprintId(route.patternSprintId);
      setTestDesignSprintId(route.testDesignSprintId);
      setTestDesignLane(
        hydratedState.testDesign.activeSprint?.lane ??
          route.testDesignLane ??
          "python",
      );
      setTestDesignSource(
        hydratedState.testDesign.activeSprint?.source ?? "academy",
      );
      setTestDesignAttemptId(route.testDesignAttemptId);
      const activeConceptTransferAttempt =
        hydratedState.conceptTransfer.attempts.find(
          (attempt) =>
            attempt.id === hydratedState.conceptTransfer.activeAttemptId,
        );
      setConceptTransferLane(
        activeConceptTransferAttempt?.lane ??
          route.conceptTransferLane ??
          "swift",
      );
      setConceptTransferSource(route.conceptTransferSource ?? "academy");
      setConceptTransferVariantId(
        activeConceptTransferAttempt?.variantId ??
          route.conceptTransferVariantId,
      );
      setCatalogQuery(
        normalizeCatalogQuery(route.catalog ?? DEFAULT_CATALOG_QUERY),
      );
      setRecordsSection(route.recordsSection ?? "overview");
      setReviewAttemptId(route.reviewAttemptId);
      setClosureRouteId(route.closureId);
      setFluencyClinicRouteId(route.fluencyClinicCaseId);
      setTransferRecordVariantId(route.transferVariantId);
      setTransferRecordAttemptId(route.transferAttemptId);
      setSubmissionLogQuery(
        normalizeSubmissionWorkLogQuery(
          route.submissions ?? DEFAULT_SUBMISSION_WORK_LOG_QUERY,
        ),
      );
      setAssessmentRouteId(route.assessment);
      setWeaknessFilter(route.weaknessFilter ?? "priority");
      setWeaknessLane(route.weaknessLane ?? "all");
      setWeaknessCaseId(route.weaknessCaseId);
      setContestSection(route.contestSection ?? "overview");
      setContestRoundId(route.contestRoundId);
      setSelectedSessionId(route.sessionId);
      setSelectedId(initialItem.itemId);
      setStage(
        initialPracticeKind === "solving"
          ? 5
          : initialPracticeKind === "concept"
            ? (route.stage ?? 5)
            : (route.stage ?? (restored.lastStage || 1)),
      );
      setPracticeKind(initialPracticeKind);
      if (route.view === "library") {
        const canonicalHref = serializeRoute(
          { view: "library", catalog: route.catalog },
          window.location.href,
        );
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (canonicalHref !== currentHref)
          window.history.replaceState({}, "", canonicalHref);
      }
      if (route.view === "improve") {
        const canonicalHref = serializeRoute(
          {
            view: "improve",
            weaknessFilter: route.weaknessFilter,
            weaknessLane: route.weaknessLane,
            weaknessCaseId: route.weaknessCaseId,
          },
          window.location.href,
        );
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (canonicalHref !== currentHref)
          window.history.replaceState({}, "", canonicalHref);
      }
      if (route.view === "learn") {
        const canonicalHref = serializeRoute(
          {
            view: "learn",
            patternId: route.patternId,
            lessonStep: route.lessonStep,
            learnReview: route.learnReview,
            patternSprintId: route.patternSprintId,
            testDesignSprintId: route.testDesignSprintId,
            testDesignLane:
              hydratedState.testDesign.activeSprint?.lane ??
              route.testDesignLane,
            testDesignAttemptId: route.testDesignAttemptId,
            conceptTransferLane:
              activeConceptTransferAttempt?.lane ?? route.conceptTransferLane,
            conceptTransferVariantId:
              activeConceptTransferAttempt?.variantId ??
              route.conceptTransferVariantId,
            conceptTransferSource: route.conceptTransferSource,
          },
          window.location.href,
        );
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (canonicalHref !== currentHref)
          window.history.replaceState({}, "", canonicalHref);
      }
      if (route.view === "records" && route.recordsSection === "submissions") {
        const canonicalHref = serializeRoute(
          {
            view: "records",
            recordsSection: "submissions",
            submissions: route.submissions,
          },
          window.location.href,
        );
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (canonicalHref !== currentHref)
          window.history.replaceState({}, "", canonicalHref);
      }
      if (route.view === "records" && route.recordsSection === "reviews") {
        const canonicalHref = serializeRoute(
          {
            view: "records",
            recordsSection: "reviews",
            reviewAttemptId: route.reviewAttemptId,
          },
          window.location.href,
        );
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (canonicalHref !== currentHref)
          window.history.replaceState({}, "", canonicalHref);
      }
      if (route.view === "records" && route.recordsSection === "closures") {
        const canonicalHref = serializeRoute(
          {
            view: "records",
            recordsSection: "closures",
            closureId: route.closureId,
          },
          window.location.href,
        );
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (canonicalHref !== currentHref)
          window.history.replaceState({}, "", canonicalHref);
      }
      if (route.view === "records" && route.recordsSection === "fluency") {
        const canonicalHref = serializeRoute(
          {
            view: "records",
            recordsSection: "fluency",
            fluencyClinicCaseId: route.fluencyClinicCaseId,
          },
          window.location.href,
        );
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (canonicalHref !== currentHref)
          window.history.replaceState({}, "", canonicalHref);
      }
      if (route.view === "records" && route.recordsSection === "trends") {
        const canonicalHref = serializeRoute(
          { view: "records", recordsSection: "trends" },
          window.location.href,
        );
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (canonicalHref !== currentHref)
          window.history.replaceState({}, "", canonicalHref);
      }
      if (route.view === "records" && route.recordsSection === "transfer") {
        const canonicalHref = serializeRoute(
          {
            view: "records",
            recordsSection: "transfer",
            transferVariantId: route.transferVariantId,
            transferAttemptId: route.transferAttemptId,
          },
          window.location.href,
        );
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (canonicalHref !== currentHref)
          window.history.replaceState({}, "", canonicalHref);
      }
      if (route.view === "sessions") {
        const canonicalHref = serializeRoute(
          { view: "sessions", sessionId: route.sessionId },
          window.location.href,
        );
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (canonicalHref !== currentHref)
          window.history.replaceState({}, "", canonicalHref);
      }
      setNow(Date.now());
      setBootstrapped(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    function onPopState() {
      if (restoringBlockedHistoryRef.current) {
        restoringBlockedHistoryRef.current = false;
        return;
      }
      if (blockVirtualRoundNavigationRef.current()) {
        restoringBlockedHistoryRef.current = true;
        window.history.forward();
        window.setTimeout(() => {
          restoringBlockedHistoryRef.current = false;
        }, 1000);
        return;
      }
      const route = parseRoute(window.location.href);
      const routed = resolveRouteItem(allItems, route);
      const activeItem =
        routed ??
        allItems.find((candidate) => candidate.itemId === selectedId) ??
        BUILTIN_ITEMS[0];
      const nextPracticeKind = coercePracticeKind(
        activeItem,
        route.practiceKind,
      );
      if (
        route.view === "practice" &&
        activeItem.transfer
      ) {
        mutateState((current) => ({
          ...current,
          transferWorkspace: recordTransferOpened(
            current.transferWorkspace,
            activeItem.itemId,
            {
              now: new Date().toISOString(),
              variantRevision: activeItem.contentRevision,
            },
          ),
        }));
      }
      setView(route.view);
      setPatternRouteId(route.patternId);
      setPatternLessonStep(route.lessonStep ?? "recognize");
      setPatternReviewMode(route.learnReview);
      setPatternSprintId(route.patternSprintId);
      setTestDesignSprintId(route.testDesignSprintId);
      setTestDesignLane(
        stateRef.current.testDesign.activeSprint?.lane ??
          route.testDesignLane ??
          "python",
      );
      setTestDesignSource(
        stateRef.current.testDesign.activeSprint?.source ?? "academy",
      );
      setTestDesignAttemptId(route.testDesignAttemptId);
      const activeConceptTransferAttempt =
        stateRef.current.conceptTransfer.attempts.find(
          (attempt) =>
            attempt.id === stateRef.current.conceptTransfer.activeAttemptId,
        );
      setConceptTransferLane(
        activeConceptTransferAttempt?.lane ??
          route.conceptTransferLane ??
          "swift",
      );
      setConceptTransferSource(route.conceptTransferSource ?? "academy");
      setConceptTransferVariantId(
        activeConceptTransferAttempt?.variantId ??
          route.conceptTransferVariantId,
      );
      setCatalogQuery(
        normalizeCatalogQuery(route.catalog ?? DEFAULT_CATALOG_QUERY),
      );
      setRecordsSection(route.recordsSection ?? "overview");
      setReviewAttemptId(route.reviewAttemptId);
      setClosureRouteId(route.closureId);
      setFluencyClinicRouteId(route.fluencyClinicCaseId);
      setTransferRecordVariantId(route.transferVariantId);
      setTransferRecordAttemptId(route.transferAttemptId);
      setSubmissionLogQuery(
        normalizeSubmissionWorkLogQuery(
          route.submissions ?? DEFAULT_SUBMISSION_WORK_LOG_QUERY,
        ),
      );
      setAssessmentRouteId(route.assessment);
      setWeaknessFilter(route.weaknessFilter ?? "priority");
      setWeaknessLane(route.weaknessLane ?? "all");
      setWeaknessCaseId(route.weaknessCaseId);
      setContestSection(route.contestSection ?? "overview");
      setContestRoundId(route.contestRoundId);
      setSelectedSessionId(route.sessionId);
      if (routed) setSelectedId(routed.itemId);
      if (nextPracticeKind === "solving") setStage(5);
      else if (nextPracticeKind === "concept") setStage(route.stage ?? 5);
      else if (route.stage) setStage(route.stage);
      setPracticeKind(nextPracticeKind);
      setPracticeEpoch((current) => current + 1);
      setReveal(false);
      setResult(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [ready, allItems, selectedId]);

  useEffect(() => {
    if (!ready || !persistenceScope) return;
    const timer = window.setTimeout(() => {
      if (saveStateForScope(stateRef.current, persistenceScope))
        volatileScopeStateRef.current.delete(persistenceScope);
    }, STATE_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [ready, state, persistenceScope]);
  useEffect(() => {
    if (!ready || !persistenceScope) return;
    const flushState = () => {
      if (saveStateForScope(stateRef.current, persistenceScope))
        volatileScopeStateRef.current.delete(persistenceScope);
    };
    const flushHiddenState = () => {
      if (document.visibilityState === "hidden") flushState();
    };
    window.addEventListener("pagehide", flushState);
    document.addEventListener("visibilitychange", flushHiddenState);
    return () => {
      flushState();
      window.removeEventListener("pagehide", flushState);
      document.removeEventListener("visibilitychange", flushHiddenState);
    };
  }, [ready, persistenceScope]);
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
    document.documentElement.dataset.font = state.settings.font;
  }, [state.settings.theme, state.settings.font]);
  useEffect(() => {
    const activeTimedMode =
      state.activeSession?.kind === "mock" ||
      state.virtualRoundWorkspace.active?.status === "active";
    const timer = window.setInterval(
      () => setNow(Date.now()),
      activeTimedMode ? 1000 : 5000,
    );
    return () => window.clearInterval(timer);
  }, [state.activeSession?.kind, state.virtualRoundWorkspace.active?.status]);
  useEffect(() => {
    const session = state.activeSession;
    if (
      !ready ||
      !session ||
      session.kind !== "mock" ||
      mockInterviewRemainingMs(session, now) !== 0
    )
      return;
    expireMockInterviewRef.current(session.id);
  }, [ready, now, state.activeSession]);
  useEffect(() => {
    const round = state.virtualRoundWorkspace.active;
    if (
      !ready ||
      !round ||
      round.status !== "active" ||
      virtualRoundRemainingMs(round, now) !== 0
    )
      return;
    expireVirtualRoundRef.current(round.id);
  }, [ready, now, state.virtualRoundWorkspace.active]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!bootstrapped) return;
    const controller = new AbortController();
    async function connectCloud() {
      const capabilities = await cloudClient.capabilities({
        signal: controller.signal,
      });
      if (!capabilities.available) {
        setCloud((current) => ({
          ...current,
          status: "local",
          capabilities: null,
          session: null,
          dailyChallenge: null,
        }));
        return;
      }
      const utcToday = new Date().toISOString().slice(0, 10);
      const dailyLeaderboardRequest = capabilities.data.leaderboards
        ? cloudClient.dailyLeaderboard(utcToday, {
            limit: 1,
            signal: controller.signal,
          })
        : Promise.resolve(null);
      const [session, daily] = await Promise.all([
        cloudClient.session({ signal: controller.signal }),
        dailyLeaderboardRequest,
      ]);
      const dailyChallenge = daily?.available ? daily.data.challenge : null;
      if (!session.available) {
        setCloud((current) => ({
          ...current,
          status: session.reason === "unauthorized" ? "signed-out" : "error",
          capabilities: capabilities.data,
          session: null,
          dailyChallenge,
        }));
        return;
      }
      setCloud((current) => ({
        ...current,
        status: session.data.authenticated ? "connected" : "signed-out",
        capabilities: capabilities.data,
        session: session.data,
        dailyChallenge,
      }));
    }
    void connectCloud();
    return () => controller.abort();
  }, [bootstrapped, cloud.refresh]);

  useEffect(() => {
    if (!bootstrapped) return;
    const nextScope = resolvePersistenceScope({
      status: cloud.status,
      authenticated: cloud.session?.authenticated,
      userId: cloud.session?.user?.id,
      currentScope: persistenceScopeRef.current,
    });
    if (!nextScope) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const previousScope = persistenceScopeRef.current;
      if (previousScope === nextScope) {
        if (!ready) setReady(true);
        return;
      }
      const previousSaveFailed = Boolean(
        previousScope &&
          !saveStateForScope(stateRef.current, previousScope),
      );
      if (previousScope && previousSaveFailed)
        volatileScopeStateRef.current.set(previousScope, stateRef.current);
      else if (previousScope)
        volatileScopeStateRef.current.delete(previousScope);
      let restored =
        volatileScopeStateRef.current.get(nextScope) ??
        loadStateForScope(nextScope);
      if (!previousScope) {
        const route = parseRoute(window.location.href);
        const items = [
          ...BUILTIN_ITEMS,
          ...restored.customItems.filter((candidate) => !candidate.archivedAt),
        ];
        const routedItem = resolveRouteItem(items, route);
        const restoredItem =
          items.find((candidate) => candidate.itemId === restored.lastItemId) ??
          BUILTIN_ITEMS[0];
        const initialItem = routedItem ?? restoredItem;
        if (route.view === "practice" && initialItem.transfer) {
          restored = {
            ...restored,
            transferWorkspace: recordTransferOpened(
              restored.transferWorkspace,
              initialItem.itemId,
              {
                now: new Date().toISOString(),
                variantRevision: initialItem.contentRevision,
              },
            ),
          };
        }
      }
      persistenceScopeRef.current = nextScope;
      setPersistenceScope(nextScope);
      invalidateCloudWork();
      stateRef.current = restored;
      setState(restored);
      setGuestDataAvailable(
        nextScope !== GUEST_PERSISTENCE_SCOPE &&
          hasMeaningfulBackupState(
            loadStateForScope(GUEST_PERSISTENCE_SCOPE),
          ),
      );
      setReveal(false);
      setResult(null);
      setCustomEditor(null);
      setMockReviewSessionId(null);
      setPracticeEpoch((current) => current + 1);
      if (previousScope) {
        const firstItem =
          [...BUILTIN_ITEMS, ...restored.customItems].find(
            (candidate) => candidate.itemId === restored.lastItemId,
          ) ?? BUILTIN_ITEMS[0];
        setView("today");
        setSelectedId(firstItem.itemId);
        setStage(restored.lastStage || 1);
        setPracticeKind(
          restored.draft?.itemId === firstItem.itemId
            ? coercePracticeKind(firstItem, restored.draft.practiceKind)
            : "typing",
        );
        setAssessmentRouteId(undefined);
        setPatternRouteId(undefined);
        setPatternLessonStep("recognize");
        setSelectedSessionId(undefined);
        setReviewAttemptId(undefined);
        setClosureRouteId(undefined);
        setFluencyClinicRouteId(undefined);
        setTransferRecordVariantId(undefined);
        setTransferRecordAttemptId(undefined);
        window.history.replaceState(
          {},
          "",
          serializeRoute({ view: "today" }, window.location.href),
        );
        setToast(
          previousSaveFailed
            ? "Profile switched · the previous profile is held in memory because browser storage is unavailable"
            : nextScope === GUEST_PERSISTENCE_SCOPE
              ? "Switched to this browser's guest profile"
              : `Loaded ${cloud.session?.user?.displayName ?? "your"} account profile`,
        );
      } else {
        const items = [
          ...BUILTIN_ITEMS,
          ...restored.customItems.filter((candidate) => !candidate.archivedAt),
        ];
        const route = parseRoute(window.location.href);
        const routed = resolveRouteItem(items, route);
        const selected =
          routed ??
          items.find((candidate) => candidate.itemId === restored.lastItemId) ??
          BUILTIN_ITEMS[0];
        const nextPracticeKind = coercePracticeKind(
          selected,
          route.practiceKind ??
            (restored.draft?.itemId === selected.itemId
              ? restored.draft.practiceKind
              : undefined),
        );
        setSelectedId(selected.itemId);
        setPracticeKind(nextPracticeKind);
        setStage(
          nextPracticeKind === "solving"
            ? 5
            : (route.stage ?? restored.lastStage ?? 1),
        );
        setSelectedSessionId(
          route.sessionId &&
            restored.sessionHistory.some(
              (record) => record.id === route.sessionId,
            )
            ? route.sessionId
            : undefined,
        );
        setReviewAttemptId(
          route.reviewAttemptId &&
            restored.attempts.some(
              (attempt) => attempt.id === route.reviewAttemptId,
            )
            ? route.reviewAttemptId
            : undefined,
        );
        setClosureRouteId(route.closureId);
        setFluencyClinicRouteId(route.fluencyClinicCaseId);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [
    bootstrapped,
    cloud.status,
    cloud.session?.authenticated,
    cloud.session?.user?.id,
    cloud.session?.user?.displayName,
    ready,
  ]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    if (
      cloud.status === "local" ||
      cloud.status === "signed-out" ||
      !cloud.capabilities?.studySync ||
      !cloud.session?.authenticated
    ) {
      studySyncReadyRef.current = false;
      studyServerRevisionRef.current = 0;
      studySyncedFingerprintRef.current = "";
      const fallbackStatus = cloud.status === "local" ? "local" : "offline";
      void Promise.resolve().then(() => {
        if (!cancelled) setStudySyncStatus(fallbackStatus);
      });
      return () => {
        cancelled = true;
      };
    }
    if (cloud.status !== "connected" && cloud.status !== "syncing") return;
    const expectedUserId = cloud.session?.user?.id;
    if (
      !persistenceScope ||
      !scopeMatchesAuthenticatedUser(persistenceScope, expectedUserId)
    ) {
      void Promise.resolve().then(() => {
        if (!cancelled) setStudySyncStatus("offline");
      });
      return () => {
        cancelled = true;
      };
    }
    const expectedEpoch = studySyncEpochRef.current;
    studySyncReadyRef.current = false;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!cancelled) setStudySyncStatus("checking");
    });
    void cloudClient
      .getStudyWorkspace({ signal: controller.signal })
      .then(async (result) => {
        if (
          cancelled ||
          expectedEpoch !== studySyncEpochRef.current ||
          !scopeMatchesAuthenticatedUser(
            persistenceScopeRef.current,
            expectedUserId,
          )
        )
          return;
        if (!result.available) {
          if (result.reason !== "aborted") setStudySyncStatus("offline");
          return;
        }
        if (!result.data) {
          studyServerRevisionRef.current = 0;
          studySyncReadyRef.current = true;
          setStudySyncReadyVersion((current) => current + 1);
          const localWorkspace = stateRef.current.studyWorkspace;
          const hasLocalStudyData = Boolean(
            localWorkspace.collections.length ||
              localWorkspace.plans.length ||
              localWorkspace.tombstones.length,
          );
          studySyncedFingerprintRef.current = hasLocalStudyData
            ? ""
            : JSON.stringify(localWorkspace);
          setStudySyncStatus(hasLocalStudyData ? "syncing" : "synced");
          return;
        }
        studyServerRevisionRef.current = result.data.revision;
        const merged = mergeStudyWorkspaces(
          stateRef.current.studyWorkspace,
          result.data,
          { now: new Date().toISOString() },
        );
        const remoteFingerprint = JSON.stringify(result.data);
        const mergedFingerprint = JSON.stringify(merged);
        mutateState((current) => ({ ...current, studyWorkspace: merged }));
        studySyncReadyRef.current = true;
        setStudySyncReadyVersion((current) => current + 1);
        if (mergedFingerprint === remoteFingerprint) {
          studySyncedFingerprintRef.current = mergedFingerprint;
          setStudySyncStatus("synced");
        } else {
          studySyncedFingerprintRef.current = remoteFingerprint;
          setStudySyncStatus("syncing");
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    ready,
    cloud.status,
    cloud.capabilities?.studySync,
    cloud.session?.authenticated,
    cloud.session?.user?.id,
    persistenceScope,
    studySyncEpoch,
  ]);

  useEffect(() => {
    if (
      !ready ||
      !studySyncReadyRef.current ||
      !cloud.capabilities?.studySync ||
      !cloud.session?.authenticated ||
      !persistenceScope ||
      !scopeMatchesAuthenticatedUser(
        persistenceScope,
        cloud.session?.user?.id,
      ) ||
      (cloud.status !== "connected" && cloud.status !== "syncing")
    )
      return;
    const expectedUserId = cloud.session.user?.id;
    const expectedEpoch = studySyncEpochRef.current;
    const workspace = state.studyWorkspace;
    const fingerprint = JSON.stringify(workspace);
    if (fingerprint === studySyncedFingerprintRef.current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStudySyncStatus("syncing");
      const submittedFingerprint = JSON.stringify(workspace);
      void cloudClient
        .putStudyWorkspace(workspace, {
          baseRevision: studyServerRevisionRef.current,
          signal: controller.signal,
        })
        .then((result) => {
          if (
            expectedEpoch !== studySyncEpochRef.current ||
            !scopeMatchesAuthenticatedUser(
              persistenceScopeRef.current,
              expectedUserId,
            )
          )
            return;
          if (result.available) {
            studyServerRevisionRef.current = result.data.revision;
            const live = stateRef.current.studyWorkspace;
            if (JSON.stringify(live) === submittedFingerprint) {
              studySyncedFingerprintRef.current = JSON.stringify(result.data);
              mutateState((current) => ({
                ...current,
                studyWorkspace: result.data,
              }));
              setStudySyncStatus("synced");
            } else {
              const merged = mergeStudyWorkspaces(live, result.data, {
                now: new Date().toISOString(),
              });
              studySyncedFingerprintRef.current = JSON.stringify(result.data);
              mutateState((current) => ({ ...current, studyWorkspace: merged }));
            }
            return;
          }
          if (result.reason === "revision-conflict" && result.conflict) {
            studyServerRevisionRef.current = result.conflict.revision;
            const current = result.conflict.workspace;
            const merged = current
              ? mergeStudyWorkspaces(
                  stateRef.current.studyWorkspace,
                  current,
                  { now: new Date().toISOString() },
                )
              : stateRef.current.studyWorkspace;
            studySyncedFingerprintRef.current = current
              ? JSON.stringify(current)
              : "";
            mutateState((existing) => ({
              ...existing,
              studyWorkspace: merged,
            }));
            setStudySyncStatus("syncing");
            return;
          }
          if (result.reason !== "aborted") setStudySyncStatus("error");
        });
    }, 800);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    ready,
    state.studyWorkspace,
    cloud.status,
    cloud.capabilities?.studySync,
    cloud.session?.authenticated,
    cloud.session?.user?.id,
    persistenceScope,
    studySyncEpoch,
    studySyncReadyVersion,
  ]);

  useEffect(() => {
    if (
      !ready ||
      !state.cloud.communityEnabled ||
      !cloud.session?.authenticated ||
      !persistenceScope ||
      !scopeMatchesAuthenticatedUser(
        persistenceScope,
        cloud.session?.user?.id,
      )
    )
      return;
    const expectedUserId = cloud.session.user?.id;
    const expectedEpoch = studySyncEpochRef.current;
    const known = new Set(state.cloud.uploadedAttemptIds);
    const pending = state.attempts
      .filter(
        (attempt) =>
          attempt.outcome === "completed" &&
          attempt.practiceKind === "typing" &&
          !attempt.assessmentRunId &&
          !attempt.itemId.startsWith("custom:") &&
          !known.has(attempt.id),
      )
      .slice(0, 50);
    if (!pending.length) return;
    const controller = new AbortController();
    void cloudClient
      .postAttemptBatch(
        pending.map((attempt) => {
          const matched = BUILTIN_ITEMS.find(
            (candidate) => candidate.itemId === attempt.itemId,
          );
          return {
            ...attempt,
            track: matched?.track,
            title: attempt.titleSnapshot,
            typedChars: matched?.code.length ?? attempt.correctKeystrokes,
            completed: true as const,
          };
        }),
        { signal: controller.signal },
      )
      .then((receipt) => {
        if (
          expectedEpoch !== studySyncEpochRef.current ||
          !scopeMatchesAuthenticatedUser(
            persistenceScopeRef.current,
            expectedUserId,
          )
        )
          return;
        if (!receipt.available) {
          setCloud((current) => ({
            ...current,
            status: receipt.reason === "aborted" ? "connected" : "error",
          }));
          return;
        }
        const settled = new Set([
          ...receipt.data.accepted,
          ...receipt.data.duplicates,
          ...receipt.data.rejected.map((entry) => entry.id),
        ]);
        mutateState((current) => ({
          ...current,
          cloud: {
            ...current.cloud,
            uploadedAttemptIds: [
              ...new Set([...current.cloud.uploadedAttemptIds, ...settled]),
            ].slice(-1000),
            lastSyncedAt: new Date().toISOString(),
          },
        }));
        setCloud((current) => ({ ...current, status: "connected" }));
      });
    return () => controller.abort();
  }, [
    ready,
    state.cloud.communityEnabled,
    state.cloud.uploadedAttemptIds,
    state.attempts,
    cloud.session?.authenticated,
    cloud.session?.user?.id,
    persistenceScope,
    studySyncEpoch,
  ]);

  const item =
    allItems.find((candidate) => candidate.itemId === selectedId) ??
    allItems[0] ??
    BUILTIN_ITEMS[0];
  const draft =
    state.draft?.itemId === selectedId &&
    state.draft.stage === stage &&
    state.draft.practiceKind === practiceKind
      ? state.draft
      : freshDraft(
          selectedId,
          stage,
          item.contentRevision,
          undefined,
          undefined,
          practiceKind,
          practiceKind === "solving" ? (item.starterCode ?? "") : "",
        );
  const metrics = currentMetrics(draft, item.code, now);
  const ghostCode = maskCode(
    practiceKind === "solving" ? "" : item.code,
    stage,
    reveal,
    item.masks,
    item.language,
  );
  const stats = itemStats(state, selectedId);
  const assessmentEntry = state.draft?.assessmentRunId && state.draft.assessmentProbeId
    ? state.assessments.runs
        .find((run) => run.id === state.draft?.assessmentRunId)
        ?.form?.find((entry) => entry.entryId === state.draft?.assessmentProbeId)
    : undefined;
  const conceptCheckIndex = assessmentEntry?.conceptCheckIndex ??
    selectConceptCheckIndex(
      state.attempts,
      selectedId,
      item.contentRevision,
    );
  const dueItems = curriculumItems.filter((candidate) =>
    isReviewDue(state, candidate.itemId),
  );
  const transferItems = useMemo(
    () => allItems.filter((candidate) => Boolean(candidate.transfer)),
    [allItems],
  );
  const transferProgress = useMemo(
    () =>
      deriveTransferProgress({
        variants: transferItems,
        workspace: state.transferWorkspace,
        attempts: state.attempts,
        submissions: transferSubmissionEvidence,
        now: new Date(now).toISOString(),
      }),
    [
      now,
      state.attempts,
      state.transferWorkspace,
      transferSubmissionEvidence,
      transferItems,
    ],
  );
  const transferProgressById = useMemo(
    () => new Map(transferProgress.map((entry) => [entry.variantId, entry])),
    [transferProgress],
  );
  const recommendedTransferItem = useMemo(
    () =>
      selectNextTransferVariant({
        variants: transferItems,
        workspace: state.transferWorkspace,
        attempts: state.attempts,
        submissions: transferSubmissionEvidence,
        now: new Date(now).toISOString(),
      }),
    [
      now,
      state.attempts,
      state.transferWorkspace,
      transferSubmissionEvidence,
      transferItems,
    ],
  );
  const transferVariants = useMemo<TransferVariant[]>(
    () =>
      transferItems.map((candidate) => {
        const progress = transferProgressById.get(candidate.itemId);
        const evidenceLabels: string[] = [];
        if (progress?.exposureUnknown)
          evidenceLabels.push("Earlier exposure history is incomplete");
        if (progress?.exposure?.openCount)
          evidenceLabels.push(
            `${progress.exposure.openCount} prompt open${progress.exposure.openCount === 1 ? "" : "s"}`,
          );
        if (progress?.attemptCount)
          evidenceLabels.push(
            `${progress.attemptCount} attempt record${progress.attemptCount === 1 ? "" : "s"}`,
          );
        if (progress?.failedSubmissionCount)
          evidenceLabels.push(
            `${progress.failedSubmissionCount} unsuccessful submission${progress.failedSubmissionCount === 1 ? "" : "s"}`,
          );
        if (progress?.spacedSolveCount)
          evidenceLabels.push(
            `${progress.spacedSolveCount} cadence checkpoint${progress.spacedSolveCount === 1 ? "" : "s"}`,
          );
        if (progress?.unassistedRetestCount)
          evidenceLabels.push(
            `${progress.unassistedRetestCount} unassisted revealed reconstruction${progress.unassistedRetestCount === 1 ? "" : "s"}`,
          );
        if (progress?.exposure?.maxHintLevel)
          evidenceLabels.push(
            `Assistance recorded through hint ${progress.exposure.maxHintLevel}`,
          );
        if (progress?.dueAt)
          evidenceLabels.push(`Next check ${formatDate(progress.dueAt)}`);
        const debriefReady = Boolean(
          progress &&
            (progress.attemptCount > 0 ||
              progress.isProven ||
              progress.isDue),
        );
        return {
          id: candidate.itemId,
          displayLabel: itemDisplayId(candidate),
          difficulty: candidate.difficulty,
          estimatedMinutes: candidate.estimatedMinutes,
          status: progress?.status ?? "opened",
          evidenceLabels,
          attemptedAtLabel: progress?.lastActivityAt
            ? formatDate(progress.lastActivityAt)
            : undefined,
          revealed:
            debriefReady && candidate.transfer
              ? {
                  title: candidate.title,
                  pattern: candidate.transfer.postAttemptPatternLabel,
                  contrast: candidate.transfer.contrastExplanation,
                  teachBack: candidate.transfer.teachBackQuestion,
                }
              : undefined,
        };
      }),
    [transferItems, transferProgressById],
  );
  const transferTotals = useMemo<TransferTotals>(
    () => ({
      total: transferVariants.length,
      unseen: transferVariants.filter((entry) => entry.status === "unseen").length,
      opened: transferVariants.filter((entry) => entry.status === "opened").length,
      attempted: transferVariants.filter((entry) => entry.status === "attempted").length,
      assisted: transferVariants.filter((entry) => entry.status === "assisted").length,
      proven: transferVariants.filter((entry) => entry.status === "proven").length,
      due: transferVariants.filter((entry) => entry.status === "due").length,
    }),
    [transferVariants],
  );
  const virtualRoundEligibleItems = useMemo(
    () =>
      curriculumItems.filter(
        (candidate) =>
          candidate.track === "interview" &&
          candidate.language === "python" &&
          Boolean(candidate.verification),
      ),
    [curriculumItems],
  );
  const virtualRoundPresets = useMemo<VirtualRoundPresetView[]>(
    () =>
      VIRTUAL_ROUND_PRESETS.map((preset) => {
        const available = virtualRoundEligibleItems.length >= preset.problemCount;
        return {
          ...preset,
          maxScore: preset.problemCount * VIRTUAL_ROUND_POINTS_PER_PROBLEM,
          available,
          disabledReason: available
            ? undefined
            : `This build needs ${preset.problemCount} runnable Python interview problems; ${virtualRoundEligibleItems.length} are available.`,
          detail:
            preset.id === "sprint"
              ? "A compact pacing reset."
              : preset.id === "standard"
                ? "Closest to a multi-question phone screen rehearsal."
                : "Best after the shorter formats feel controlled.",
        };
      }),
    [virtualRoundEligibleItems.length],
  );
  const activeVirtualRoundView = useMemo<ActiveVirtualRound | null>(() => {
    const run = state.virtualRoundWorkspace.active;
    if (!run) return null;
    const aggregate = deriveVirtualRoundScore(run);
    return {
      id: run.id,
      title: run.title,
      status: run.status,
      ...aggregate,
      currentProblemId: run.currentProblemId,
      announcement:
        run.status === "finalizing"
          ? "An on-time submission is still being judged. The report will lock when it settles."
          : undefined,
      problems: run.problems.map((problem, index) => ({
        id: problem.itemId,
        index,
        identityRevealed: Boolean(problem.openedAt),
        title: problem.openedAt ? problem.title : undefined,
        status: virtualRoundProblemStatus(problem),
        score: deriveVirtualRoundProblemScore(problem),
        maxScore: VIRTUAL_ROUND_POINTS_PER_PROBLEM,
        submissionCount: problem.submissions.filter(
          (submission) => submission.status !== "pending",
        ).length,
        flagged: problem.flagged,
      })),
    };
  }, [state.virtualRoundWorkspace.active]);
  const virtualRoundReports = useMemo<VirtualRoundReportView[]>(
    () =>
      [...state.virtualRoundWorkspace.history]
        .flatMap((run) => {
          const report = deriveVirtualRoundReport(run);
          if (!report) return [];
          return [{
            id: report.id,
            presetId: report.presetId,
            title: report.title,
            completedAt: report.completedAt,
            outcome: report.outcome,
            score: report.score,
            maxScore: report.maxScore,
            scorePercent: report.maxScore
              ? Math.round((report.score / report.maxScore) * 100)
              : 0,
            acceptedCount: report.acceptedCount,
            problemCount: report.problemCount,
            elapsed: formatDuration(report.elapsedMs),
            elapsedMs: report.elapsedMs,
            penalty: report.penaltyMs
              ? `${formatDuration(report.penaltyMs)} contest penalty`
              : "No solved-problem penalty",
            penaltyMs: report.penaltyMs,
            archived: report.status === "archived",
            problems: report.problems.map((problem) => ({
              id: problem.id,
              index: problem.index,
              title: problem.title,
              pattern: problem.pattern,
              difficulty: problem.difficulty,
              revision: `item ${problem.itemRevision} / judge ${problem.verificationRevision}`,
              status: problem.status,
              score: problem.score,
              maxScore: problem.maxScore,
              submissionCount: problem.submissionCount,
              availableForRetry: virtualRoundEligibleItems.some(
                (candidate) =>
                  candidate.itemId === problem.id &&
                  candidate.contentRevision === problem.itemRevision &&
                  (candidate.verification?.revision ?? 1) ===
                    problem.verificationRevision,
              ),
              submissions: problem.submissions.map((submission) => ({
                id: submission.id,
                elapsed: formatDuration(submission.elapsedMs),
                verdict: submission.status
                  .split("-")
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                  .join(" "),
                score: submission.score,
                maxScore: VIRTUAL_ROUND_POINTS_PER_PROBLEM,
                note:
                  submission.status === "judge-error"
                    ? "Local judging was interrupted; no points were inferred."
                    : submission.total > 0
                      ? `${submission.passed} of ${submission.total} checks passed.`
                      : undefined,
              })),
            })),
          }];
        })
        .sort(
          (left, right) =>
            right.completedAt.localeCompare(left.completedAt) ||
            left.id.localeCompare(right.id),
        ),
    [state.virtualRoundWorkspace.history, virtualRoundEligibleItems],
  );
  const contestSummary = useMemo(
    () => buildContestSummary(state.virtualRoundWorkspace.history),
    [state.virtualRoundWorkspace.history],
  );
  const weaknessNow = Math.floor((now || Date.now()) / 60_000) * 60_000;
  const weaknessAssessmentReports = useMemo(
    () =>
      state.assessments.runs
        .map((run) => deriveAssessmentReport(run))
        .filter((report): report is NonNullable<typeof report> => Boolean(report)),
    [state.assessments.runs],
  );
  const weaknessTransferRecords = useMemo(
    () =>
      buildTransferRecords({
        variants: allItems.filter((candidate) => Boolean(candidate.transfer)),
        workspace: state.transferWorkspace,
        attempts: state.attempts,
        submissionLog: state.submissionLog,
        reviews: state.solutionReviews,
        now: new Date(weaknessNow).toISOString(),
      }).records,
    [
      allItems,
      state.transferWorkspace,
      state.attempts,
      state.submissionLog,
      state.solutionReviews,
      weaknessNow,
    ],
  );
  const testDesignLaneSummaries = useMemo(
    () =>
      Object.fromEntries(
        (["python", "swift", "ios"] as TestDesignLane[]).map((lane) => [
          lane,
          deriveTestDesignOverview(TEST_DESIGN_PROBES, state.testDesign, {
            lane,
            now: new Date(now).toISOString(),
          }),
        ]),
      ) as Record<
        TestDesignLane,
        ReturnType<typeof deriveTestDesignOverview>
      >,
    [now, state.testDesign],
  );
  const conceptTransferLaneSummaries = useMemo(
    () =>
      Object.fromEntries(
        (["swift", "ios"] as ConceptTransferLane[]).map((lane) => [
          lane,
          summarizeConceptTransferWorkspace(
            state.conceptTransfer,
            CONCEPT_TRANSFER_VARIANTS,
            { lane, now: new Date(now).toISOString() },
          ),
        ]),
      ) as Record<
        ConceptTransferLane,
        ReturnType<typeof summarizeConceptTransferWorkspace>
      >,
    [now, state.conceptTransfer],
  );
  const fluencyClinicModel = useMemo(() => {
    const conceptProgress = CONCEPT_TRANSFER_VARIANTS.map((variant) => {
      const targetedTransferObservedAt = state.conceptTransfer.attempts
        .filter(
          (attempt) =>
            attempt.variantId === variant.id &&
            attempt.variantRevision === variant.revision &&
            attempt.clinicTargeted === true &&
            Boolean(attempt.finishedAt),
        )
        .map((attempt) => attempt.finishedAt as string)
        .sort()
        .at(-1) ?? null;
      return {
        variantId: variant.id,
        targetedTransferObserved: Boolean(targetedTransferObservedAt),
        targetedTransferObservedAt,
      };
    });
    return deriveFluencyClinicModel(state.fluencyClinic, {
      items: allItems,
      attempts: state.attempts,
      transferVariants: [...transferItems, ...CONCEPT_TRANSFER_VARIANTS],
      transferProgress: [...transferProgress, ...conceptProgress],
      selectedId: fluencyClinicRouteId,
      now: new Date(now).toISOString(),
    });
  }, [
    allItems,
    fluencyClinicRouteId,
    now,
    state.attempts,
    state.conceptTransfer,
    state.fluencyClinic,
    transferItems,
    transferProgress,
  ]);
  const attemptClosureModel = useMemo(
    () =>
      deriveAttemptClosureModel(state.attemptClosures, {
        items: allItems,
        attempts: state.attempts,
        submissionLog: state.submissionLog,
        selectedId: closureRouteId,
        now: new Date(now).toISOString(),
      }),
    [
      allItems,
      closureRouteId,
      now,
      state.attemptClosures,
      state.attempts,
      state.submissionLog,
    ],
  );
  const weaknessModel = useMemo(() => {
    const itemSignals = Object.fromEntries(
      curriculumItems.map((candidate) => {
        const progress = itemStats(state, candidate.itemId);
        return [
          candidate.itemId,
          {
            due: isReviewDue(state, candidate.itemId, weaknessNow),
            completions: progress.completions,
            owned: progress.owned,
            recommendedStage: recommendedStage(state, candidate),
          },
        ];
      }),
    );
    return buildWeaknessLab({
      items: allItems,
      attempts: state.attempts,
      typingProgress: state.typingProgress,
      submissionReceipts: state.submissionLog.receipts,
      learningEvents: state.learningEvents,
      solutionReviews: state.solutionReviews,
      attemptClosures: state.attemptClosures.closures,
      assessmentReports: weaknessAssessmentReports,
      sessionHistory: state.sessionHistory,
      transferRecords: weaknessTransferRecords,
      conceptTransferAttempts: state.conceptTransfer.attempts,
      conceptTransferVariants: CONCEPT_TRANSFER_VARIANTS,
      patternDecisionAttempts: state.patternLearning.decisionAttempts,
      patternLessons: PATTERN_LESSONS,
      patternDecisionProbes: PATTERN_DECISION_PROBES,
      testDesignAttempts: state.testDesign.attempts,
      testDesignProbes: TEST_DESIGN_PROBES,
      itemSignals,
      now: weaknessNow,
    });
  }, [
    allItems,
    curriculumItems,
    state,
    weaknessAssessmentReports,
    weaknessTransferRecords,
    weaknessNow,
  ]);
  const personalRoundStandings = useMemo(
    () =>
      buildPersonalStandings(state.virtualRoundWorkspace.history).map(
        (entry) => ({
          id: entry.id,
          presetId: entry.presetId,
          title: entry.title,
          completedAt: entry.completedAt,
          score: entry.score,
          maxScore: entry.maxScore,
          acceptedCount: entry.acceptedCount,
          problemCount: entry.problemCount,
          elapsed: formatDuration(entry.elapsedMs),
          penalty: entry.penaltyMs
            ? formatDuration(entry.penaltyMs)
            : "None",
          rank: entry.rank,
          cohortSize: entry.cohortSize,
          archived: entry.archived,
        }),
      ),
    [state.virtualRoundWorkspace.history],
  );
  const todayMinutes = practicedMinutesToday(state);
  const dailyPercent = Math.min(
    100,
    Math.round((todayMinutes / state.settings.dailyGoalMinutes) * 100),
  );

  function mutateState(updater: (current: AppState) => AppState) {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }

  function withReconciledAttemptEvidence(
    current: AppState,
    at = new Date().toISOString(),
  ): AppState {
    return {
      ...current,
      attemptClosures: reconcileAttemptClosureWorkspace(
        current.attemptClosures,
        {
          items: [...BUILTIN_ITEMS, ...current.customItems],
          attempts: current.attempts,
          submissionLog: current.submissionLog,
          now: at,
        },
      ),
      fluencyClinic: reconcileFluencyClinicWorkspace(current.fluencyClinic, {
        items: [
          ...BUILTIN_ITEMS,
          ...current.customItems.filter((item) => !item.archivedAt),
        ],
        attempts: current.attempts,
        now: at,
      }),
    };
  }

  function invalidateCloudWork() {
    const nextEpoch = studySyncEpochRef.current + 1;
    studySyncEpochRef.current = nextEpoch;
    studySyncReadyRef.current = false;
    studyServerRevisionRef.current = 0;
    studySyncedFingerprintRef.current = "";
    setStudySyncEpoch(nextEpoch);
    setStudySyncStatus("checking");
  }

  function writeRoute(route: AppRoute, replace = false) {
    const href = serializeRoute(route, window.location.href);
    window.history[replace ? "replaceState" : "pushState"]({}, "", href);
  }

  function navigateView(nextView: View) {
    if (blockVirtualRoundNavigation()) return;
    setView(nextView);
    setAssessmentRouteId(undefined);
    setSelectedSessionId(undefined);
    setResult(null);
    setPatternRouteId(undefined);
    setPatternLessonStep("recognize");
    setPatternReviewMode(undefined);
    setPatternSprintId(undefined);
    setTestDesignSprintId(undefined);
    setTestDesignAttemptId(undefined);
    setConceptTransferVariantId(undefined);
    if (nextView === "improve") {
      setWeaknessFilter("priority");
      setWeaknessLane("all");
      setWeaknessCaseId(undefined);
    }
    if (nextView === "records") {
      setRecordsSection("overview");
      setReviewAttemptId(undefined);
      setClosureRouteId(undefined);
      setFluencyClinicRouteId(undefined);
      setTransferRecordVariantId(undefined);
      setTransferRecordAttemptId(undefined);
      setSubmissionLogQuery(
        normalizeSubmissionWorkLogQuery(DEFAULT_SUBMISSION_WORK_LOG_QUERY),
      );
    }
    writeRoute(
      nextView === "library"
        ? { view: "library", catalog: catalogQuery }
        : { view: nextView },
    );
  }

  function openSessionRecap(sessionId: string, replace = false) {
    if (blockVirtualRoundNavigation()) return;
    setView("sessions");
    setSelectedSessionId(sessionId);
    writeRoute({ view: "sessions", sessionId }, replace);
  }

  function closeSessionRecap() {
    setSelectedSessionId(undefined);
    writeRoute({ view: "sessions" }, true);
  }

  function replayPracticeSession(
    sessionId: string,
    mode: SessionReplayMode,
  ) {
    const current = stateRef.current;
    const record = current.sessionHistory.find(
      (candidate) => candidate.id === sessionId && candidate.kind === "practice",
    );
    if (!record) {
      setToast("That practice-session recap is no longer available");
      return;
    }
    const entries = buildSessionReplayQueue(
      record,
      current.attempts,
      curriculumItems,
      mode,
      current.typingProgress,
    );
    if (!entries.length) {
      setToast(
        mode === "weak"
          ? "No retry candidates are available in the current catalog"
          : "No items from that session are available in the current catalog",
      );
      return;
    }
    startSession(
      {
        name: `${record.name} · ${mode === "weak" ? "Weak-item retry" : "Replay"}`,
        count: entries.length,
        source: "mixed",
        track: "all",
        language: "all",
        pattern: "All",
        difficulty: "All",
        stageMode: "recommended",
        studyPlanId: record.studyPlanId,
        studyCollectionIds: record.studyCollectionIds,
      },
      entries,
    );
  }

  function openPatternLesson(
    patternId?: string,
    lessonStep: PatternLessonStep = "recognize",
    replace = false,
  ) {
    if (blockVirtualRoundNavigation()) return;
    setView("learn");
    setPatternRouteId(patternId);
    setPatternLessonStep(patternId ? lessonStep : "recognize");
    setPatternReviewMode(undefined);
    setPatternSprintId(undefined);
    setTestDesignSprintId(undefined);
    setTestDesignAttemptId(undefined);
    writeRoute(
      {
        view: "learn",
        patternId,
        lessonStep: patternId ? lessonStep : undefined,
      },
      replace,
    );
  }

  function openPatternDecisionReview(
    source: PatternDecisionSource = "academy",
  ) {
    if (blockVirtualRoundNavigation()) return;
    const currentSprint = stateRef.current.patternLearning.activeSprint;
    const sprintId =
      currentSprint?.status === "active" ? currentSprint.id : makeId();
    if (currentSprint?.status !== "active") {
      mutateState((current) => ({
        ...current,
        patternLearning: startPatternDecisionSprint(
          current.patternLearning,
          PATTERN_LESSONS,
          PATTERN_DECISION_PROBES,
          {
            id: sprintId,
            source,
            count: 4,
            now: new Date().toISOString(),
          },
        ),
      }));
    }
    setView("learn");
    setPatternRouteId(undefined);
    setPatternLessonStep("recognize");
    setPatternReviewMode("mixed");
    setPatternSprintId(sprintId);
    setTestDesignSprintId(undefined);
    setTestDesignAttemptId(undefined);
    writeRoute({
      view: "learn",
      learnReview: "mixed",
      patternSprintId: sprintId,
    });
  }

  function commitAcademyDecision(
    probe: PatternDecisionProbe,
    lesson: PatternLesson,
    input: DecisionInput,
  ) {
    mutateState((current) => ({
      ...current,
      patternLearning: commitPatternDecision(
        current.patternLearning,
        probe,
        lesson,
        input,
        {
          id: makeId(),
          probes: PATTERN_DECISION_PROBES,
          now: new Date().toISOString(),
        },
      ),
    }));
  }

  function revealAcademyDecision(attemptId: string) {
    mutateState((current) => ({
      ...current,
      patternLearning: revealPatternDecision(
        current.patternLearning,
        attemptId,
        {
          now: new Date().toISOString(),
          probes: PATTERN_DECISION_PROBES,
        },
      ),
    }));
  }

  function gradeAcademyDecision(
    attemptId: string,
    grade: "again" | "hard" | "good" | "easy",
  ) {
    mutateState((current) => ({
      ...current,
      patternLearning: gradePatternDecision(
        current.patternLearning,
        attemptId,
        grade,
        {
          lessons: PATTERN_LESSONS,
          probes: PATTERN_DECISION_PROBES,
          now: new Date().toISOString(),
        },
      ),
    }));
  }

  function startDecisionSolve(next: PracticeItem) {
    openItem(next, 5, undefined, undefined, "solving");
    setToast(
      "Blank local solve opened · pattern-choice evidence remains separate",
    );
  }

  function openTestDesignLab(
    source: TestDesignSource = "academy",
    lane: TestDesignLane = "python",
  ) {
    if (blockVirtualRoundNavigation()) return;
    const currentSprint = stateRef.current.testDesign.activeSprint;
    const active = currentSprint?.status === "active" ? currentSprint : undefined;
    const selectedLane = active?.lane ?? lane;
    setView("learn");
    setPatternRouteId(undefined);
    setPatternLessonStep("recognize");
    setPatternReviewMode("tests");
    setPatternSprintId(undefined);
    setTestDesignSprintId(active?.id);
    setTestDesignLane(selectedLane);
    setTestDesignSource(active?.source ?? source);
    setTestDesignAttemptId(undefined);
    writeRoute({
      view: "learn",
      learnReview: "tests",
      testDesignLane: selectedLane,
      ...(active ? { testDesignSprintId: active.id } : {}),
    });
  }

  function startTestDesignLab(
    source: TestDesignSource,
    lane: TestDesignLane,
  ) {
    if (blockVirtualRoundNavigation()) return;
    const currentSprint = stateRef.current.testDesign.activeSprint;
    const active = currentSprint?.status === "active" ? currentSprint : undefined;
    const sprintId = active?.id ?? makeId();
    const selectedLane = active?.lane ?? lane;
    if (!active) {
      mutateState((current) => ({
        ...current,
        testDesign: startTestDesignSprint(
          current.testDesign,
          TEST_DESIGN_PROBES,
          BUILTIN_ITEMS,
          {
            id: sprintId,
            source,
            lane: selectedLane,
            count: 3,
            now: new Date().toISOString(),
          },
        ),
      }));
    }
    setView("learn");
    setPatternRouteId(undefined);
    setPatternLessonStep("recognize");
    setPatternReviewMode("tests");
    setPatternSprintId(undefined);
    setTestDesignSprintId(sprintId);
    setTestDesignLane(selectedLane);
    setTestDesignSource(active?.source ?? source);
    setTestDesignAttemptId(undefined);
    writeRoute({
      view: "learn",
      learnReview: "tests",
      testDesignLane: selectedLane,
      testDesignSprintId: sprintId,
    });
  }

  function saveTestDraft(probe: TestDesignProbe, input: TestDesignInput) {
    mutateState((current) => ({ ...current, testDesign: saveTestDesignDraft(
      current.testDesign, probe, input,
      { probes: TEST_DESIGN_PROBES, items: BUILTIN_ITEMS, now: new Date().toISOString() },
    ) }));
  }

  function commitTestDesign(probe: TestDesignProbe, input: TestDesignInput) {
    mutateState((current) => ({ ...current, testDesign: commitTestDesignAttempt(
      current.testDesign, probe, input,
      { id: makeId(), probes: TEST_DESIGN_PROBES, items: BUILTIN_ITEMS, now: new Date().toISOString() },
    ) }));
  }

  function revealTestDesign(attemptId: string) {
    mutateState((current) => ({ ...current, testDesign: revealTestDesignAttempt(
      current.testDesign, attemptId,
      { probes: TEST_DESIGN_PROBES, items: BUILTIN_ITEMS, now: new Date().toISOString() },
    ) }));
  }

  function gradeTestDesign(
    attemptId: string,
    grade: "again" | "hard" | "good" | "easy",
  ) {
    mutateState((current) => ({ ...current, testDesign: gradeTestDesignAttempt(
      current.testDesign, attemptId, grade,
      { probes: TEST_DESIGN_PROBES, items: BUILTIN_ITEMS, now: new Date().toISOString() },
    ) }));
  }

  function startTestDesignSolve(next: PracticeItem) {
    const nextKind = next.track === "ios" ? "concept" : "solving";
    openItem(next, 5, undefined, undefined, nextKind);
    setToast(
      nextKind === "concept"
        ? "Blank concept reconstruction opened · test-design evidence remains separate"
        : "Blank local solve opened · test-design evidence remains separate",
    );
  }

  function exitTestDesignLab() {
    const source =
      stateRef.current.testDesign.activeSprint?.source ?? testDesignSource;
    if (source === "today") navigateView("today");
    else if (source === "assessment") navigateView("assessments");
    else if (source === "weakness") navigateView("improve");
    else openPatternLesson();
  }

  function openConceptTransferLab(
    source: ConceptTransferSource = "academy",
    lane: ConceptTransferLane = "swift",
    variantId?: string,
  ) {
    if (blockVirtualRoundNavigation()) return;
    const activeAttempt = stateRef.current.conceptTransfer.attempts.find(
      (attempt) =>
        attempt.id === stateRef.current.conceptTransfer.activeAttemptId,
    );
    const selectedLane = activeAttempt?.lane ?? lane;
    const selectedVariantId = activeAttempt?.variantId ?? variantId;
    setView("learn");
    setPatternRouteId(undefined);
    setPatternLessonStep("recognize");
    setPatternReviewMode("reconstruct");
    setPatternSprintId(undefined);
    setTestDesignSprintId(undefined);
    setTestDesignAttemptId(undefined);
    setConceptTransferLane(selectedLane);
    setConceptTransferSource(source);
    setConceptTransferVariantId(selectedVariantId);
    writeRoute({
      view: "learn",
      learnReview: "reconstruct",
      conceptTransferLane: selectedLane,
      ...(selectedVariantId
        ? { conceptTransferVariantId: selectedVariantId }
        : {}),
      ...(source !== "academy" ? { conceptTransferSource: source } : {}),
    });
  }

  function startConceptTransferLab(
    source: ConceptTransferSource,
    lane: ConceptTransferLane,
    variantId?: string,
  ) {
    if (blockVirtualRoundNavigation()) return;
    const nowIso = new Date().toISOString();
    const activeAttempt = stateRef.current.conceptTransfer.attempts.find(
      (attempt) =>
        attempt.id === stateRef.current.conceptTransfer.activeAttemptId,
    );
    const selected = activeAttempt
      ? CONCEPT_TRANSFER_VARIANTS.find(
          (variant) => variant.id === activeAttempt.variantId,
        )
      : variantId
        ? CONCEPT_TRANSFER_VARIANTS.find(
            (variant) => variant.id === variantId && variant.lane === lane,
          )
        : selectConceptTransferVariant(
            CONCEPT_TRANSFER_VARIANTS,
            stateRef.current.conceptTransfer,
            { lane, now: nowIso },
          );
    if (!selected) {
      setToast("No current reconstruction scenario is available in that lane");
      return;
    }
    const attemptId = activeAttempt?.id ?? makeId();
    if (!activeAttempt) {
      mutateState((current) => ({
        ...current,
        conceptTransfer: startConceptTransferAttempt(
          current.conceptTransfer,
          CONCEPT_TRANSFER_VARIANTS,
          {
            id: attemptId,
            variantId: selected.id,
            lane: selected.lane,
            now: nowIso,
            assisted: source === "clinic",
            clinicTargeted: source === "clinic",
          },
        ),
      }));
    }
    setView("learn");
    setPatternReviewMode("reconstruct");
    setConceptTransferLane(selected.lane);
    setConceptTransferSource(source);
    setConceptTransferVariantId(selected.id);
    writeRoute({
      view: "learn",
      learnReview: "reconstruct",
      conceptTransferLane: selected.lane,
      conceptTransferVariantId: selected.id,
      ...(source !== "academy" ? { conceptTransferSource: source } : {}),
    });
  }

  function saveConceptTransferDraft(
    attemptId: string,
    patch: Partial<
      Pick<ConceptTransferDraft, "prediction" | "reconstruction" | "tradeoff">
    >,
  ) {
    mutateState((current) => ({
      ...current,
      conceptTransfer: updateConceptTransferDraft(
        current.conceptTransfer,
        attemptId,
        patch,
        { variants: CONCEPT_TRANSFER_VARIANTS, now: new Date().toISOString() },
      ),
    }));
  }

  function revealConceptTransferHintForAttempt(attemptId: string) {
    mutateState((current) => ({
      ...current,
      conceptTransfer: revealConceptTransferHint(
        current.conceptTransfer,
        attemptId,
        { variants: CONCEPT_TRANSFER_VARIANTS, now: new Date().toISOString() },
      ),
    }));
    setToast("Hint revealed · this reconstruction is permanently assisted");
  }

  function commitConceptTransfer(attemptId: string) {
    mutateState((current) => ({
      ...current,
      conceptTransfer: commitConceptTransferAttempt(
        current.conceptTransfer,
        attemptId,
        { variants: CONCEPT_TRANSFER_VARIANTS, now: new Date().toISOString() },
      ),
    }));
    setToast("Reconstruction locked · project-authored comparison revealed");
  }

  function saveConceptTransferDebrief(
    attemptId: string,
    patch: {
      grade?: ConceptTransferGrade;
      criteria?: string[];
      teachBack?: string;
    },
  ) {
    const nowIso = new Date().toISOString();
    mutateState((current) => {
      let next = current.conceptTransfer;
      if (Object.hasOwn(patch, "grade") && patch.grade) {
        next = selfGradeConceptTransferAttempt(next, attemptId, patch.grade, {
          variants: CONCEPT_TRANSFER_VARIANTS,
          now: nowIso,
        });
      }
      if (Object.hasOwn(patch, "criteria")) {
        next = recordConceptTransferCriteria(
          next,
          attemptId,
          patch.criteria ?? [],
          { variants: CONCEPT_TRANSFER_VARIANTS, now: nowIso },
        );
      }
      if (Object.hasOwn(patch, "teachBack")) {
        next = recordConceptTransferTeachBack(
          next,
          attemptId,
          patch.teachBack ?? "",
          { variants: CONCEPT_TRANSFER_VARIANTS, now: nowIso },
        );
      }
      return { ...current, conceptTransfer: next };
    });
  }

  function finishConceptTransfer(
    attemptId: string,
    grade: ConceptTransferGrade,
    criteria: string[],
    teachBack: string,
  ) {
    const nowIso = new Date().toISOString();
    const finishedLane =
      stateRef.current.conceptTransfer.attempts.find(
        (attempt) => attempt.id === attemptId,
      )?.lane ?? conceptTransferLane;
    mutateState((current) => {
      let next = selfGradeConceptTransferAttempt(
        current.conceptTransfer,
        attemptId,
        grade,
        { variants: CONCEPT_TRANSFER_VARIANTS, now: nowIso },
      );
      next = recordConceptTransferCriteria(next, attemptId, criteria, {
        variants: CONCEPT_TRANSFER_VARIANTS,
        now: nowIso,
      });
      next = recordConceptTransferTeachBack(next, attemptId, teachBack, {
        variants: CONCEPT_TRANSFER_VARIANTS,
        now: nowIso,
      });
      next = finishConceptTransferAttempt(next, attemptId, {
        variants: CONCEPT_TRANSFER_VARIANTS,
        now: nowIso,
      });
      return { ...current, conceptTransfer: next };
    });
    setConceptTransferVariantId(undefined);
    writeRoute({
      view: "learn",
      learnReview: "reconstruct",
      conceptTransferLane: finishedLane,
      ...(conceptTransferSource !== "academy"
        ? { conceptTransferSource }
        : {}),
    });
    setToast(
      "Self-assessed reconstruction saved · next review scheduled locally",
    );
  }

  function exitConceptTransferLab() {
    if (conceptTransferSource === "today") navigateView("today");
    else if (conceptTransferSource === "assessment")
      navigateView("assessments");
    else if (conceptTransferSource === "weakness") navigateView("improve");
    else if (conceptTransferSource === "clinic") openFluencyClinic();
    else openPatternLesson();
  }

  function commitAcademyResponse(
    lesson: PatternLesson,
    checkId: string,
    response: string,
  ) {
    mutateState((current) => ({
      ...current,
      patternLearning: commitPatternResponse(
        current.patternLearning,
        lesson,
        checkId,
        response,
        { now: new Date().toISOString() },
      ),
    }));
  }

  function revealAcademyAnswer(lesson: PatternLesson, checkId: string) {
    mutateState((current) => ({
      ...current,
      patternLearning: revealPatternAnswer(
        current.patternLearning,
        lesson,
        checkId,
        { now: new Date().toISOString() },
      ),
    }));
  }

  function gradeAcademyCheck(
    lesson: PatternLesson,
    checkId: string,
    grade: "again" | "hard" | "good" | "easy",
  ) {
    mutateState((current) => ({
      ...current,
      patternLearning: gradePatternCheck(
        current.patternLearning,
        lesson,
        checkId,
        grade,
        { now: new Date().toISOString() },
      ),
    }));
  }

  function startAcademyPractice(
    next: PracticeItem,
    nextStage: number,
    nextPracticeKind: PracticeKind,
  ) {
    openItem(next, nextStage, undefined, undefined, nextPracticeKind);
    setToast(
      nextPracticeKind === "solving"
        ? "Blank local solve opened · lesson exposure remains separate"
        : nextStage === 1
          ? "Full ghost opened · guided exposure, not independent evidence"
          : "Reconstruction opened · assisted practice evidence",
    );
  }

  function browseAcademyPattern(lesson: PatternLesson) {
    updateCatalogRoute(
      normalizeCatalogQuery({
        ...DEFAULT_CATALOG_QUERY,
        lanes: ["python", "swift"],
        patterns: [lesson.pattern],
      }),
      "push",
    );
  }

  function updateCatalogRoute(
    nextQuery: CatalogQuery,
    history: "push" | "replace",
  ) {
    const normalized = normalizeCatalogQuery(nextQuery);
    setCatalogQuery(normalized);
    setView("library");
    const href = serializeRoute(
      { view: "library", catalog: normalized },
      window.location.href,
    );
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href === currentHref) return;
    window.history[history === "replace" ? "replaceState" : "pushState"](
      {},
      "",
      href,
    );
  }

  function updateWeaknessRoute(input: {
    filter: WeaknessFilter;
    lane: WeaknessLane;
    caseId?: string;
  }) {
    if (blockVirtualRoundNavigation()) return;
    setWeaknessFilter(input.filter);
    setWeaknessLane(input.lane);
    setWeaknessCaseId(input.caseId);
    setView("improve");
    writeRoute({
      view: "improve",
      weaknessFilter: input.filter,
      weaknessLane: input.lane,
      weaknessCaseId: input.caseId,
    });
  }

  function startWeaknessCase(value: WeaknessCase) {
    if (blockVirtualRoundNavigation()) return;
    if (
      value.weakness === "missed-cue" &&
      value.sourceKinds.includes("pattern-decision")
    ) {
      openPatternDecisionReview("weakness");
      setToast(
        "Core pattern skill check opened · repeated objective misses, not a diagnosis",
      );
      return;
    }
    if (
      value.sourceKinds.includes("test-design") &&
      (value.weakness === "boundary" || value.weakness === "verification")
    ) {
      const requestedLane = value.lane as TestDesignLane;
      const activeLane =
        stateRef.current.testDesign.activeSprint?.status === "active"
          ? stateRef.current.testDesign.activeSprint.lane
          : requestedLane;
      openTestDesignLab("weakness", activeLane);
      setToast(
        `Test Design repair opened · ${activeLane === "ios" ? "iOS" : activeLane} evidence stays design-only`,
      );
      return;
    }
    if (!value.queue.length) {
      setToast("No current-revision practice items match this remediation case");
      return;
    }
    const entries: SessionQueueEntry[] = value.queue.map((entry) => ({
      itemId: entry.itemId,
      itemRevision: entry.itemRevision,
      stage: entry.stage,
      status: "pending",
      practiceKind: entry.practiceKind,
      estimatedMinutes: entry.estimatedMinutes,
      rationale: entry.rationale,
      lane: entry.lane,
    }));
    startSession(
      {
        name: `Weakness Lab · ${value.topicKey} · ${WEAKNESS_META[value.weakness].short}`,
        count: entries.length,
        source: "mixed",
        track: value.lane === "ios" ? "ios" : "interview",
        language: value.lane === "python" ? "python" : "swift",
        pattern: value.topicKey,
        difficulty: "All",
        stageMode: "recommended",
      },
      entries,
    );
  }

  function openWeaknessEvidence(value: WeaknessEvidence) {
    if (blockVirtualRoundNavigation()) return;
    if (value.kind === "solution-review" && value.sourceId) {
      openSolutionReview(value.sourceId);
      return;
    }
    if (value.kind === "assessment" && value.sourceId) {
      selectAssessment(value.sourceId);
      return;
    }
    if (value.kind === "mock-debrief" && value.sourceId) {
      setMockReviewSessionId(value.sourceId);
      navigateView("sessions");
      return;
    }
    if (value.kind === "transfer" && value.sourceId) {
      openTransferRecords(value.sourceId);
      return;
    }
    if (value.kind === "attempt-closure" && value.sourceId) {
      openAttemptClosure(value.sourceId);
      return;
    }
    if (value.kind === "pattern-decision") {
      const lesson = PATTERN_LESSONS.find(
        (candidate) => candidate.pattern === value.topicKey,
      );
      if (lesson) {
        openPatternLesson(lesson.slug, "recognize");
        setToast(
          "Recognition cues opened · the objective decision miss remains in local history",
        );
        return;
      }
    }
    if (value.kind === "test-design" && value.sourceId) {
      const sourceAttempt = stateRef.current.testDesign.attempts.find(
        (candidate) => candidate.id === value.sourceId,
      );
      if (!sourceAttempt) {
        setToast("That Test Design attempt is no longer available in local history");
        return;
      }
      setView("learn");
      setPatternRouteId(undefined);
      setPatternLessonStep("recognize");
      setPatternReviewMode("tests");
      setPatternSprintId(undefined);
      setTestDesignSprintId(undefined);
      setTestDesignLane(sourceAttempt.lane);
      setTestDesignSource(sourceAttempt.source);
      setTestDesignAttemptId(sourceAttempt.id);
      writeRoute({
        view: "learn",
        learnReview: "tests",
        testDesignLane: sourceAttempt.lane,
        testDesignAttemptId: sourceAttempt.id,
      });
      return;
    }
    const itemToOpen = value.itemId
      ? allItems.find((candidate) => candidate.itemId === value.itemId)
      : undefined;
    if (!itemToOpen) {
      setToast("That source item is no longer available in the current catalog");
      return;
    }
    const sourceAttempt = value.sourceId
      ? stateRef.current.attempts.find(
          (candidate) => candidate.id === value.sourceId,
        )
      : undefined;
    const sourcePracticeKind = coercePracticeKind(
      itemToOpen,
      sourceAttempt?.practiceKind ??
        (itemToOpen.track === "ios" ? "concept" : "typing"),
    );
    openItem(
      itemToOpen,
      sourcePracticeKind === "solving" || sourcePracticeKind === "concept"
        ? 5
        : recommendedStage(stateRef.current, itemToOpen),
      undefined,
      undefined,
      sourcePracticeKind,
    );
  }

  function browseWeaknessCase(value: WeaknessCase) {
    if (blockVirtualRoundNavigation()) return;
    const hasMatchingPattern = curriculumItems.some(
      (candidate) =>
        candidate.pattern === value.topicKey &&
        (value.lane === "ios"
          ? candidate.track === "ios"
          : candidate.track === "interview" && candidate.language === value.lane),
    );
    updateCatalogRoute(
      normalizeCatalogQuery({
        ...DEFAULT_CATALOG_QUERY,
        lanes: [value.lane],
        patterns: hasMatchingPattern ? [value.topicKey] : [],
      }),
      "push",
    );
  }

  function updateRecordsRoute(
    nextSection: RecordsSection,
    nextQuery: SubmissionWorkLogQuery = submissionLogQuery,
    history: "push" | "replace" = "push",
  ) {
    if (blockVirtualRoundNavigation()) return;
    const normalized = normalizeSubmissionWorkLogQuery(nextQuery);
    setView("records");
    setRecordsSection(nextSection);
    setReviewAttemptId(undefined);
    setClosureRouteId(undefined);
    setFluencyClinicRouteId(undefined);
    setTransferRecordVariantId(undefined);
    setTransferRecordAttemptId(undefined);
    setSubmissionLogQuery(normalized);
    const route: AppRoute =
      nextSection === "submissions"
        ? {
            view: "records",
            recordsSection: "submissions",
            submissions: normalized,
          }
        : nextSection === "reviews"
          ? { view: "records", recordsSection: "reviews" }
          : nextSection === "closures"
            ? { view: "records", recordsSection: "closures" }
          : nextSection === "fluency"
            ? { view: "records", recordsSection: "fluency" }
          : nextSection === "activity"
            ? { view: "records", recordsSection: "activity" }
          : nextSection === "trends"
            ? { view: "records", recordsSection: "trends" }
            : nextSection === "transfer"
              ? { view: "records", recordsSection: "transfer" }
            : { view: "records", recordsSection: "overview" };
    const href = serializeRoute(route, window.location.href);
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href === currentHref) return;
    window.history[history === "replace" ? "replaceState" : "pushState"](
      {},
      "",
      href,
    );
  }

  function resumeChallengeSet(
    manifestId: string,
    execution: RunManifestExecution,
  ) {
    try {
      const manifest = resumeRunManifest(
        stateRef.current.runManifests,
        manifestId,
      );
      if (
        manifest.execution.kind !== execution.kind ||
        manifest.execution.id !== execution.id
      ) {
        throw new Error("The Challenge Set execution link no longer matches");
      }
      if (execution.kind === "virtual-round") {
        resumeVirtualRound(execution.id);
        return;
      }
      const session = stateRef.current.activeSession;
      if (!session || session.id !== execution.id) {
        throw new Error("The linked practice session is no longer active");
      }
      const entry = session.entries[session.currentIndex];
      const snapshot = manifest.entries.find(
        (candidate) => candidate.itemId === entry?.itemId,
      );
      const item = curriculumItems.find(
        (candidate) =>
          candidate.itemId === entry?.itemId &&
          candidate.contentRevision === snapshot?.contentRevision &&
          (snapshot?.judgeRevision === undefined
            ? !candidate.verification && !candidate.trustedChallengeKey
            : currentJudgeRevision(candidate) === snapshot.judgeRevision),
      );
      if (!entry || !item) {
        throw new Error(
          "The frozen problem revision is unavailable in this build",
        );
      }
      openItem(
        item,
        entry.stage,
        undefined,
        session.id,
        entry.practiceKind ?? "typing",
      );
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "That Challenge Set cannot resume",
      );
    }
  }

  function openChallengeSetExecution(execution: RunManifestExecution) {
    if (execution.kind === "virtual-round") {
      openVirtualRoundReport(execution.id);
      return;
    }
    openSessionRecap(execution.id);
  }

  function archiveChallengeSet(manifestId: string) {
    try {
      commitStateImmediately((current) => ({
        ...current,
        runManifests: archiveRunManifest(
          current.runManifests,
          manifestId,
          { now: new Date().toISOString() },
        ),
      }));
      setToast("Challenge Set activity archived");
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "That Challenge Set could not be archived",
      );
    }
  }

  function openTransferRecords(variantId?: string, attemptId?: string) {
    if (blockVirtualRoundNavigation()) return;
    setView("records");
    setRecordsSection("transfer");
    setReviewAttemptId(undefined);
    setClosureRouteId(undefined);
    setFluencyClinicRouteId(undefined);
    setTransferRecordVariantId(variantId);
    setTransferRecordAttemptId(variantId ? attemptId : undefined);
    setResult(null);
    writeRoute({
      view: "records",
      recordsSection: "transfer",
      transferVariantId: variantId,
      transferAttemptId: variantId ? attemptId : undefined,
    });
  }

  function openAttemptClosure(closureId?: string) {
    if (blockVirtualRoundNavigation()) return;
    setView("records");
    setRecordsSection("closures");
    setReviewAttemptId(undefined);
    setClosureRouteId(closureId);
    setFluencyClinicRouteId(undefined);
    setTransferRecordVariantId(undefined);
    setTransferRecordAttemptId(undefined);
    setResult(null);
    writeRoute({
      view: "records",
      recordsSection: "closures",
      closureId,
    });
  }

  function openFluencyClinic(caseId?: string) {
    if (blockVirtualRoundNavigation()) return;
    setView("records");
    setRecordsSection("fluency");
    setReviewAttemptId(undefined);
    setClosureRouteId(undefined);
    setFluencyClinicRouteId(caseId);
    setTransferRecordVariantId(undefined);
    setTransferRecordAttemptId(undefined);
    setResult(null);
    writeRoute({
      view: "records",
      recordsSection: "fluency",
      fluencyClinicCaseId: caseId,
    });
  }

  function openWeakLineInFluencyClinic(item: PracticeItem, weakLine: WeakLine) {
    const caseId = fluencyClinicCaseId(
      item.itemId,
      item.contentRevision,
      weakLine.line,
    );
    try {
      commitStateImmediately((current) => ({
        ...current,
        fluencyClinic: enqueueFluencyClinicCase(
          current.fluencyClinic,
          { item, weakLine },
          { now: new Date().toISOString() },
        ),
      }));
      openFluencyClinic(caseId);
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "That line could not be queued",
      );
    }
  }

  function saveFluencyClinicPass(
    caseId: string,
    input: {
      kind: FluencyClinicPassKind;
      startedAt: string;
      durationMs: number;
      corrections: number;
    },
    expectedRevision: number,
  ) {
    const completedAt = new Date().toISOString();
    try {
      commitStateImmediately((current) => {
        return {
          ...current,
          fluencyClinic: recordFluencyClinicPass(
            current.fluencyClinic,
            caseId,
            input,
            {
              now: completedAt,
              expectedRevision,
              attempts: current.attempts,
            },
          ),
        };
      });
      setToast(
        input.kind === "recheck"
          ? "Delayed blank recheck saved · implementation-fluency evidence only"
          : `${input.kind} line repair saved · guided evidence only`,
      );
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "That Clinic pass could not be saved",
      );
    }
  }

  function startFluencyReconstruction(record: FluencyClinicRecord) {
    const candidate = allItems.find(
      (entry) =>
        entry.itemId === record.itemId &&
        entry.contentRevision === record.itemRevision,
    );
    if (!candidate) {
      setToast("That frozen item revision is no longer available");
      return;
    }
    openItem(
      candidate,
      5,
      undefined,
      undefined,
      "typing",
      undefined,
      undefined,
      true,
    );
    setToast("Fresh stage-5 reconstruction opened · the line repair stays guided");
  }

  function startFluencyTransfer(record: FluencyClinicRecord) {
    if (!record.transferVariantId) {
      setToast("No current mapped transfer is available for this case");
      return;
    }
    if (record.transferKind === "python-transfer") {
      const candidate = transferItems.find(
        (entry) => entry.itemId === record.transferVariantId,
      );
      if (!candidate) {
        setToast("That mapped Python transfer is unavailable in this build");
        return;
      }
      commitStateImmediately((current) => ({
        ...current,
        transferWorkspace: recordTransferTargeted(
          current.transferWorkspace,
          candidate.itemId,
          {
            now: new Date().toISOString(),
            variantRevision: candidate.contentRevision,
          },
        ),
      }));
      openItem(candidate, 5, undefined, undefined, "solving");
      setToast("Targeted sibling opened · it cannot count as cold-transfer proof");
      return;
    }
    const variant = CONCEPT_TRANSFER_VARIANTS.find(
      (entry) => entry.id === record.transferVariantId,
    );
    if (!variant) {
      setToast("That mapped Swift/iOS reconstruction is unavailable");
      return;
    }
    const active = stateRef.current.conceptTransfer.attempts.find(
      (attempt) => attempt.id === stateRef.current.conceptTransfer.activeAttemptId,
    );
    if (active && active.variantId !== variant.id) {
      setToast("Finish the active reconstruction scenario before opening this mapping");
      openConceptTransferLab("clinic", active.lane, active.variantId);
      return;
    }
    startConceptTransferLab("clinic", variant.lane, variant.id);
    setToast("Targeted sibling opened · it is recorded as assisted selection");
  }

  function timedSolutionReviewAttemptIds(current: AppState) {
    const timedSessionIds = new Set(
      current.sessionHistory
        .filter((session) => session.kind === "mock")
        .map((session) => session.id),
    );
    const finishedRoundIds = new Set(
      current.virtualRoundWorkspace.history.map((round) => round.id),
    );
    const submissionsById = new Map(
      current.submissionLog.receipts.map((receipt) => [receipt.id, receipt]),
    );
    return new Set(
      current.attempts
        .filter((attempt) => {
          if (attempt.sessionId && timedSessionIds.has(attempt.sessionId))
            return true;
          const receipt = attempt.submissionId
            ? submissionsById.get(attempt.submissionId)
            : undefined;
          return Boolean(
            receipt?.context.virtualRoundId &&
              finishedRoundIds.has(receipt.context.virtualRoundId),
          );
        })
        .map((attempt) => attempt.id),
    );
  }

  function solutionReviewOptions(current: AppState) {
    return {
      attemptsById: new Map(
        current.attempts.map((attempt) => [attempt.id, attempt]),
      ),
      validItemIds: new Set(
        [...BUILTIN_ITEMS, ...current.customItems].map(
          (candidate) => candidate.itemId,
        ),
      ),
      submissionIds: new Set(
        current.submissionLog.receipts.map((receipt) => receipt.id),
      ),
      submissionsById: new Map(
        current.submissionLog.receipts.map((receipt) => [receipt.id, receipt]),
      ),
      timedAttemptIds: timedSolutionReviewAttemptIds(current),
    };
  }

  function teachBackPromptFor(itemToReview: PracticeItem) {
    return (
      itemToReview.transfer?.teachBackQuestion ??
      itemToReview.recallChecks?.[1] ??
      `Explain the invariant for ${itemToReview.title}, then name one input that would break a weaker approach.`
    );
  }

  function openSolutionReview(attemptId: string) {
    if (blockVirtualRoundNavigation()) return;
    const current = stateRef.current;
    const attempt = current.attempts.find(
      (candidate) => candidate.id === attemptId,
    );
    const itemToReview = attempt
      ? allItems.find((candidate) => candidate.itemId === attempt.itemId)
      : undefined;
    if (
      !attempt ||
      !itemToReview ||
      attempt.practiceKind !== "solving" ||
      attempt.outcome !== "completed" ||
      !attempt.verification ||
      attempt.verification.total < 1 ||
      attempt.verification.passed !== attempt.verification.total
    ) {
      setToast("Solution review requires a completed accepted solve");
      return;
    }
    try {
      commitStateImmediately(
        (latest) => {
          const existing = latest.solutionReviews.find(
            (review) => review.attemptId === attemptId,
          );
          if (existing) return latest;
          const submission = attempt.submissionId
            ? latest.submissionLog.receipts.find(
                (receipt) =>
                  receipt.id === attempt.submissionId &&
                  receipt.lifecycle === "settled" &&
                  receipt.status === "accepted" &&
                  receipt.itemId === attempt.itemId &&
                  receipt.itemRevision === attempt.itemRevision,
              )
            : undefined;
          const review = createSolutionReview({
            id: makeId(),
            attempt,
            submissionId: submission?.id,
            teachBackPrompt: teachBackPromptFor(itemToReview),
            now: new Date().toISOString(),
            unlockContext: timedSolutionReviewAttemptIds(latest).has(attempt.id)
              ? "finished-timed-run"
              : "accepted-practice",
          });
          return {
            ...latest,
            solutionReviews: upsertSolutionReview(
              latest.solutionReviews,
              review,
              solutionReviewOptions(latest),
            ),
          };
        },
        { requirePersistence: true },
      );
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Solution review could not be saved locally",
      );
      return;
    }
    setResult(null);
    setView("records");
    setRecordsSection("reviews");
    setReviewAttemptId(attemptId);
    writeRoute({
      view: "records",
      recordsSection: "reviews",
      reviewAttemptId: attemptId,
    });
  }

  function saveSolutionReviewDraft(review: SolutionReviewRecord) {
    try {
      commitStateImmediately(
        (current) => ({
          ...current,
          solutionReviews: upsertSolutionReview(
            current.solutionReviews,
            { ...review, updatedAt: new Date().toISOString() },
            solutionReviewOptions(current),
          ),
        }),
        { requirePersistence: true },
      );
      setToast("Solution review draft saved on this device");
      return true;
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Solution review draft could not be saved",
      );
      return false;
    }
  }

  function learningFrictionForReview(
    category: SolutionReviewRecord["mistakeCategory"],
  ): LearningEvent["friction"] {
    if (category === "recognition") return "recognition";
    if (category === "invariant") return "invariant";
    if (category === "complexity") return "complexity";
    if (category === "python-syntax") return "syntax";
    if (category === "swift-syntax-api") return "api";
    if (category === "implementation-plan" || category === "edge-case")
      return "implementation";
    return "none";
  }

  function completeSolutionReview(review: SolutionReviewRecord) {
    if (!review.grade || !review.teachBackCommittedAt) {
      setToast("Commit a teach-back answer and self-rate it before finishing");
      return false;
    }
    try {
      commitStateImmediately(
        (current) => {
          const attempt = current.attempts.find(
            (candidate) => candidate.id === review.attemptId,
          );
          if (!attempt) throw new Error("The linked attempt is no longer available");
          const completedAt = new Date().toISOString();
          const existingEvent = current.learningEvents.find(
            (event) => event.attemptId === attempt.id,
          );
          const event: LearningEvent = {
            id: existingEvent?.id ?? makeId(),
            attemptId: attempt.id,
            itemId: attempt.itemId,
            itemRevision: attempt.itemRevision,
            practiceKind: "solving",
            activityKind: "solve",
            grade: review.grade!,
            friction: learningFrictionForReview(review.mistakeCategory),
            confidence:
              review.grade === "again"
                ? 1
                : review.grade === "hard"
                  ? 2
                  : review.grade === "good"
                    ? 4
                    : 5,
            createdAt: completedAt,
            promptSnapshot: review.teachBackPrompt,
            response: review.teachBackResponse,
          };
          const learningEvents = upsertLearningEvent(
            current.learningEvents,
            event,
          );
          const projected = { ...current, learningEvents };
          const dueAt =
            reviewDueAt(projected, attempt.itemId) ??
            new Date(Date.parse(completedAt) + 86_400_000);
          const completedReview: SolutionReviewRecord = {
            ...review,
            status: "completed",
            step: "complete",
            activityKind: event.activityKind,
            dueAt: dueAt.toISOString(),
            scheduleReason: scheduleReasonForReview({
              mistakeCategory: review.mistakeCategory,
              grade: review.grade,
              qualification: attempt.qualification,
            }),
            updatedAt: completedAt,
            completedAt,
          };
          return {
            ...projected,
            solutionReviews: upsertSolutionReview(
              current.solutionReviews,
              completedReview,
              solutionReviewOptions(current),
            ),
          };
        },
        { requirePersistence: true },
      );
      setToast("Review completed · the next activity is scheduled locally");
      return true;
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Solution review could not be completed",
      );
      return false;
    }
  }

  function closeSolutionReview() {
    setReviewAttemptId(undefined);
    updateRecordsRoute("reviews");
  }

  function retryFromSolutionReview(attemptId: string) {
    const current = stateRef.current;
    const attempt = current.attempts.find(
      (candidate) => candidate.id === attemptId,
    );
    const itemToRetry = attempt
      ? allItems.find((candidate) => candidate.itemId === attempt.itemId)
      : undefined;
    if (!itemToRetry || !canSolveItem(itemToRetry)) {
      setToast("This reviewed item no longer has a runnable judge");
      return;
    }
    mutateState((latest) => {
      const abandoned = recordAbandon(latest);
      return {
        ...abandoned,
        draft: {
          ...freshDraft(
            itemToRetry.itemId,
            5,
            itemToRetry.contentRevision,
            undefined,
            undefined,
            "solving",
            itemToRetry.starterCode ?? "",
          ),
          peeks: 1,
        },
        lastItemId: itemToRetry.itemId,
        lastStage: 5,
      };
    });
    setSelectedId(itemToRetry.itemId);
    setStage(5);
    setPracticeKind("solving");
    setPracticeEpoch((value) => value + 1);
    setReveal(false);
    setResult(null);
    setView("practice");
    writeRoute(routeForItem(itemToRetry, 5, "solving"));
    setToast("Review-informed retry opened · this solve is marked assisted");
  }

  function saveSubmissionAnnotation(
    submissionId: string,
    annotation: Pick<SubmissionAnnotation, "note" | "tags">,
  ) {
    mutateState((current) => ({
      ...current,
      submissionAnnotations: updateSubmissionAnnotation(
        current.submissionAnnotations,
        submissionId,
        annotation,
        {
          validSubmissionIds: new Set(
            current.submissionLog.receipts.map((receipt) => receipt.id),
          ),
          now: new Date().toISOString(),
        },
      ),
    }));
    setToast("Private submission reflection saved locally");
  }

  function saveAttemptClosureDraft(
    closureId: string,
    patch: Partial<
      Pick<
        AttemptClosureRecord,
        | "mistakeTags"
        | "firstWrongDecision"
        | "verificationNotes"
        | "teachBack"
        | "grade"
      >
    >,
    expectedUpdatedAt: string,
  ) {
    try {
      const savedAt = new Date().toISOString();
      commitStateImmediately(
        (current) => ({
          ...current,
          attemptClosures: updateAttemptClosureDraft(
            current.attemptClosures,
            closureId,
            patch,
            {
              now: savedAt,
              expectedRevision: current.attemptClosures.revision,
              expectedUpdatedAt,
            },
          ),
        }),
        { requirePersistence: true },
      );
      setToast("Attempt closure draft saved locally");
      return true;
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Attempt closure could not be saved",
      );
      return false;
    }
  }

  function finishAttemptClosure(
    closureId: string,
    expectedUpdatedAt: string,
  ) {
    try {
      const completedAt = new Date().toISOString();
      commitStateImmediately(
        (current) => ({
          ...current,
          attemptClosures: completeAttemptClosureRecord(
            current.attemptClosures,
            closureId,
            {
              now: completedAt,
              expectedRevision: current.attemptClosures.revision,
              expectedUpdatedAt,
            },
          ),
        }),
        { requirePersistence: true },
      );
      setToast("Closure saved · clean retry scheduled for tomorrow");
      return true;
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Attempt closure could not be completed",
      );
      return false;
    }
  }

  function retryAttemptClosure(closureId: string) {
    const current = stateRef.current;
    const model = deriveAttemptClosureModel(current.attemptClosures, {
      items: [...BUILTIN_ITEMS, ...current.customItems],
      attempts: current.attempts,
      submissionLog: current.submissionLog,
      selectedId: closureId,
      now: new Date().toISOString(),
    });
    const closure = model.selected;
    const itemToRetry = closure
      ? allItems.find(
          (candidate) => candidate.itemId === closure.anchor.itemId,
        )
      : undefined;
    if (!closure || !itemToRetry || !canSolveItem(itemToRetry)) {
      setToast("This closure no longer has a runnable current problem");
      return;
    }
    if (closure.status !== "due") {
      setToast("This clean retry is not due yet");
      return;
    }
    if (current.virtualRoundWorkspace.active) {
      setToast("Finish or archive the active virtual round before retrying");
      return;
    }
    openItem(itemToRetry, 5, undefined, undefined, "solving");
    setToast("Clean retry opened · pass without hints to resolve the closure");
  }

  function openSubmissionClean(itemToOpen: PracticeItem) {
    if (stateRef.current.virtualRoundWorkspace.active) {
      setToast("Finish or archive the active virtual round before starting a clean retry");
      return;
    }
    openItem(itemToOpen, 5, undefined, undefined, "solving");
  }

  function continueFromSubmission(
    receipt: SubmissionReceipt,
    itemToOpen: PracticeItem,
    source: string,
  ) {
    const current = stateRef.current;
    if (current.virtualRoundWorkspace.active) {
      setToast("Finish or archive the active virtual round before restoring saved source");
      return;
    }
    if (!canSolveItem(itemToOpen)) {
      setToast("This item no longer has a runnable judge");
      return;
    }
    const meaningfulDraft = Boolean(
      current.draft &&
        (current.draft.startedAt || current.draft.value.trim().length > 4),
    );
    const warnings = [
      "Continue from this saved source? The new solve will use the current prompt and judge and will be marked assisted.",
      receipt.itemRevision !== itemToOpen.contentRevision
        ? `Saved prompt revision ${receipt.itemRevision}; current revision ${itemToOpen.contentRevision}.`
        : "",
      receipt.judge.revision !== currentJudgeRevision(itemToOpen)
        ? `Saved judge revision ${receipt.judge.revision}; current revision ${currentJudgeRevision(itemToOpen)}.`
        : "",
      meaningfulDraft
        ? "Your current draft will be saved as abandoned before this source is opened."
        : "",
    ].filter(Boolean);
    if (!window.confirm(warnings.join("\n\n"))) return;
    mutateState((latest) => {
      const abandoned = recordAbandon(latest);
      const restored = {
        ...freshDraft(
          itemToOpen.itemId,
          5,
          itemToOpen.contentRevision,
          undefined,
          undefined,
          "solving",
          source,
        ),
        value: source,
        startedAt: Date.now(),
        peeks: 1,
      };
      return {
        ...abandoned,
        draft: restored,
        lastItemId: itemToOpen.itemId,
        lastStage: 5,
        transferWorkspace: itemToOpen.transfer
          ? recordTransferHint(
              abandoned.transferWorkspace,
              itemToOpen.itemId,
              3,
              {
                now: new Date().toISOString(),
                variantRevision: itemToOpen.contentRevision,
                referenceRevealed: true,
              },
            )
          : abandoned.transferWorkspace,
      };
    });
    setSelectedId(itemToOpen.itemId);
    setStage(5);
    setPracticeKind("solving");
    setPracticeEpoch((currentEpoch) => currentEpoch + 1);
    setReveal(false);
    setResult(null);
    setView("practice");
    writeRoute(routeForItem(itemToOpen, 5, "solving"));
    setToast("Saved source opened · this solve is marked assisted");
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLElement>(
            ".solve-code-editor .cm-content, .editor-wrap textarea",
          )
          ?.focus(),
      50,
    );
  }

  function createAttempt(
    active: Draft,
    activeItem: PracticeItem,
    outcome: AttemptRecord["outcome"],
    current: AppState,
    verification?: AttemptRecord["verification"],
    submissionId?: string,
  ) {
    const live = currentMetrics(active, activeItem.code);
    const isConcept = active.practiceKind === "concept";
    const finalTimeline = isConcept
      ? []
      : normalizeTimelineSamples([
          ...active.timeline,
          {
            atMs: live.durationMs,
            wpm: live.wpm,
            progress:
              active.practiceKind === "solving" && outcome === "completed"
                ? 100
                : live.progress,
          },
        ]);
    const attempt: AttemptRecord = {
      id: makeId(),
      itemId: active.itemId,
      itemRevision: active.itemRevision,
      titleSnapshot: activeItem.title,
      language: activeItem.language,
      stage: active.stage,
      practiceKind: active.practiceKind,
      mode: active.challengeDate
        ? "strict"
        : current.settings.strictMode
          ? "strict"
          : "free",
      startedAt: new Date(active.startedAt ?? Date.now()).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: live.durationMs,
      totalKeystrokes: active.totalKeystrokes,
      correctKeystrokes: isConcept ? 0 : active.correctKeystrokes,
      rejectedKeystrokes: isConcept ? 0 : active.rejectedKeystrokes,
      corrections: active.corrections,
      peeks: active.peeks,
      rawWpm: isConcept ? 0 : live.rawWpm,
      wpm: isConcept ? 0 : live.wpm,
      accuracy: isConcept ? 0 : live.accuracy,
      timeline: finalTimeline,
      consistency: isConcept
        ? 0
        : consistencyFromSamples(finalTimeline.map((sample) => sample.wpm)),
      outcome,
      qualification: "assisted",
      verification,
      challengeDate: active.challengeDate,
      sessionId: active.sessionId,
      assessmentRunId: active.assessmentRunId,
      assessmentProbeId: active.assessmentProbeId,
      submissionId:
        active.practiceKind === "solving" ? submissionId : undefined,
      keyErrors: { ...active.keyErrors },
      lineErrors: { ...active.lineErrors },
    };
    attempt.qualification = qualificationFor(attempt);
    return attempt;
  }

  function recordAbandon(current: AppState) {
    const active = current.draft;
    const mockSynchronized =
      current.activeSession?.kind === "mock" &&
      active?.sessionId === current.activeSession.id
        ? {
            ...current,
            activeSession: withMockDraftSnapshot(current.activeSession, active),
          }
        : current;
    const synchronized =
      active?.virtualRoundId &&
      mockSynchronized.virtualRoundWorkspace.active?.id === active.virtualRoundId
        ? {
            ...mockSynchronized,
            virtualRoundWorkspace: updateVirtualRoundSource(
              mockSynchronized.virtualRoundWorkspace,
              active.virtualRoundId,
              active.itemId,
              active.value,
            ),
          }
        : mockSynchronized;
    if (active?.virtualRoundId) return { ...synchronized, draft: null };
    if (!active?.startedAt || active.value.length < 5) return synchronized;
    const activeItem = [...BUILTIN_ITEMS, ...synchronized.customItems].find(
      (candidate) => candidate.itemId === active.itemId,
    );
    if (!activeItem) return { ...synchronized, draft: null };
    const attempt = createAttempt(active, activeItem, "abandoned", synchronized);
    const currentSession = synchronized.activeSession;
    let activeSession = currentSession;
    if (currentSession && currentSession.id === active.sessionId) {
      activeSession = {
        ...currentSession,
        entries: currentSession.entries.map((entry, index) =>
          index === currentSession.currentIndex && entry.itemId === active.itemId
            ? { ...entry, attemptId: attempt.id }
            : entry,
        ),
      };
    }
    return withReconciledAttemptEvidence({
      ...synchronized,
      activeSession,
      attempts: [...synchronized.attempts, attempt].slice(-1000),
      typingProgress: applyTypingAttempt(
        synchronized.typingProgress,
        attempt,
        { now: attempt.completedAt },
      ),
      draft: null,
    }, attempt.completedAt);
  }

  function openItem(
    next: PracticeItem,
    nextStage?: number,
    challengeDate?: string,
    sessionId?: string,
    nextPracticeKind?: PracticeKind,
    assessment?: { runId: string; probeId: string },
    virtualRoundId?: string,
    forceFresh = false,
  ) {
    if (!virtualRoundId && blockVirtualRoundNavigation()) return;
    const chosenPracticeKind = coercePracticeKind(next, nextPracticeKind);
    const chosenStage =
      chosenPracticeKind === "solving"
        ? 5
        : chosenPracticeKind === "concept"
          ? (nextStage ?? 5)
          : (nextStage ?? recommendedStage(state, next));
    mutateState((current) => {
      const resuming =
        !forceFresh &&
        !challengeDate &&
        current.draft?.itemId === next.itemId &&
        current.draft.stage === chosenStage &&
        current.draft.practiceKind === chosenPracticeKind &&
        current.draft.itemRevision === next.contentRevision &&
        current.draft.sessionId === sessionId &&
        current.draft.assessmentRunId === assessment?.runId &&
        current.draft.assessmentProbeId === assessment?.probeId &&
        current.draft.virtualRoundId === virtualRoundId;
      const abandoned = resuming ? current : recordAbandon(current);
      const base =
        next.transfer
          ? {
              ...abandoned,
              transferWorkspace: recordTransferOpened(
                abandoned.transferWorkspace,
                next.itemId,
                {
                  now: new Date().toISOString(),
                  variantRevision: next.contentRevision,
                },
              ),
            }
          : abandoned;
      const mockWorkspaceSource =
        sessionId &&
        base.activeSession?.kind === "mock" &&
        base.activeSession.id === sessionId
          ? base.activeSession.mockProblems?.find(
              (workspace) => workspace.itemId === next.itemId,
            )?.source
          : undefined;
      const virtualRoundSource =
        virtualRoundId && base.virtualRoundWorkspace.active?.id === virtualRoundId
          ? base.virtualRoundWorkspace.active.problems.find(
              (problem) => problem.itemId === next.itemId,
            )?.source
          : undefined;
      return {
        ...base,
        draft: resuming
          ? current.draft
          : challengeDate || sessionId || assessment || virtualRoundId
            ? freshDraft(
                next.itemId,
                chosenStage,
                next.contentRevision,
                challengeDate,
                sessionId,
                chosenPracticeKind,
                chosenPracticeKind === "solving"
                  ? (virtualRoundSource ?? mockWorkspaceSource ?? next.starterCode ?? "")
                  : "",
                assessment,
                virtualRoundId,
              )
            : null,
        lastItemId: next.itemId,
        lastStage: chosenStage,
      };
    });
    setSelectedId(next.itemId);
    setStage(chosenStage);
    setPracticeKind(chosenPracticeKind);
    setPracticeEpoch((current) => current + 1);
    setReveal(false);
    setResult(null);
    setView("practice");
    writeRoute(routeForItem(next, chosenStage, chosenPracticeKind));
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLTextAreaElement>(
            ".concept-response-card textarea, .editor-wrap textarea",
          )
          ?.focus(),
      50,
    );
  }

  function chooseStage(nextStage: number) {
    if (state.draft?.assessmentRunId) {
      setToast("This assessment checkpoint has a frozen response stage");
      return;
    }
    if (state.draft?.sessionId) {
      setToast("Stage is fixed for this session step");
      return;
    }
    const recommended = recommendedStage(stateRef.current, item);
    if (
      nextStage > recommended &&
      !window.confirm(
        `Jump ahead to Stage ${nextStage} as a diagnostic?\n\nYou can practice it, but it will not count as retained typing evidence until you complete a worked example, a later faded reconstruction, and then blank recall in order.`,
      )
    )
      return;
    mutateState((current) => {
      const sessionId = current.draft?.sessionId;
      const base = recordAbandon(current);
      const activeSession =
        sessionId && base.activeSession?.id === sessionId
          ? {
              ...base.activeSession,
              entries: base.activeSession.entries.map((entry, index) =>
                index === base.activeSession?.currentIndex
                  ? { ...entry, stage: nextStage }
                  : entry,
              ),
            }
          : base.activeSession;
      return {
        ...base,
        activeSession,
        draft: sessionId
          ? freshDraft(
              selectedId,
              nextStage,
              item.contentRevision,
              undefined,
              sessionId,
            )
          : null,
        lastStage: nextStage,
      };
    });
    setStage(nextStage);
    setPracticeKind("typing");
    setReveal(false);
    setResult(null);
    writeRoute(routeForItem(item, nextStage, "typing"));
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLTextAreaElement>(
            ".concept-response-card textarea, .editor-wrap textarea",
          )
          ?.focus(),
      0,
    );
  }

  function choosePracticeKind(nextKind: PracticeKind) {
    if (nextKind === practiceKind) return;
    if (draft.assessmentRunId) {
      setToast("This assessment checkpoint has a frozen response mode");
      return;
    }
    if (draft.sessionId) {
      setToast("This session step has a fixed practice mode");
      return;
    }
    if (nextKind === "solving" && (!canSolveItem(item) || draft.challengeDate)) {
      setToast(
        canSolveItem(item)
          ? "Solve mode is unavailable during Daily Type"
          : "Solve mode currently supports verified Python or server-judged Swift exercises",
      );
      return;
    }
    if (
      nextKind === "concept" &&
      !supportsConceptPractice(item)
    ) {
      setToast("Concept recall is available for authored Swift / iOS cards");
      return;
    }
    const nextStage =
      nextKind === "solving" || nextKind === "concept"
        ? 5
        : recommendedStage(state, item);
    mutateState((current) => {
      const base = recordAbandon(current);
      return {
        ...base,
        draft: freshDraft(
          selectedId,
          nextStage,
          item.contentRevision,
          undefined,
          undefined,
          nextKind,
          nextKind === "solving" ? (item.starterCode ?? "") : "",
        ),
        lastStage: nextStage,
      };
    });
    setPracticeKind(nextKind);
    setStage(nextStage);
    setReveal(false);
    setResult(null);
    writeRoute(routeForItem(item, nextStage, nextKind));
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLTextAreaElement>(
            ".concept-response-card textarea, .editor-wrap textarea",
          )
          ?.focus(),
      0,
    );
  }

  function updateDraft(next: Draft) {
    if (
      next.virtualRoundId &&
      new TextEncoder().encode(next.value).byteLength >
        VIRTUAL_ROUND_LIMITS.maxSourceBytes
    ) {
      setToast("Round source limit reached · shorten the solution to keep editing");
      return;
    }
    const live = currentMetrics(next, item.code);
    let timeline = next.timeline;
    if (next.startedAt && live.wpm > 0) {
      const sample: TimelineSample = {
        atMs: live.durationMs,
        wpm: live.wpm,
        progress: live.progress,
      };
      const previous = timeline.at(-1);
      if (
        !previous ||
        sample.atMs - previous.atMs >= 750 ||
        sample.progress === 100
      ) {
        timeline = normalizeTimelineSamples([...timeline, sample]);
      }
    }
    mutateState((current) => {
      const nextDraft = { ...next, timeline };
      let activeSession = current.activeSession;
      if (
        activeSession?.kind === "mock" &&
        nextDraft.sessionId === activeSession.id
      ) {
        activeSession = withMockDraftSnapshot(activeSession, nextDraft);
        if (nextDraft.value !== (item.starterCode ?? "")) {
          activeSession = withMockCheckpoint(
            activeSession,
            nextDraft.itemId,
            "codingStarted",
          );
        }
      }
      const virtualRoundWorkspace =
        nextDraft.virtualRoundId &&
        current.virtualRoundWorkspace.active?.id === nextDraft.virtualRoundId
          ? updateVirtualRoundSource(
              current.virtualRoundWorkspace,
              nextDraft.virtualRoundId,
              nextDraft.itemId,
              nextDraft.value,
            )
          : current.virtualRoundWorkspace;
      return {
        ...current,
        activeSession,
        virtualRoundWorkspace,
        draft: nextDraft,
        lastItemId: selectedId,
        lastStage: stage,
      };
    });
  }

  function updateActiveMockNotebook(nextNotebook: MockNotebookValue) {
    const liveSession = stateRef.current.activeSession;
    const liveDraft = stateRef.current.draft;
    const liveWorkspace =
      liveSession?.kind === "mock" &&
      liveDraft?.sessionId === liveSession.id
        ? liveSession.mockProblems?.find(
            (workspace) => workspace.itemId === liveDraft.itemId,
          )
        : undefined;
    if (!liveSession || !liveDraft || !liveWorkspace) return;
    const changedField = MOCK_NOTEBOOK_FIELDS.find(
      (field) => nextNotebook[field] !== liveWorkspace.notebook[field],
    );
    if (!changedField) return;
    let validatedNotebook: MockNotebookValue;
    try {
      validatedNotebook = updateMockNotebook(
        liveWorkspace.notebook,
        changedField,
        nextNotebook[changedField],
      );
    } catch {
      setToast("Notebook limit reached · shorten this section to keep writing");
      return;
    }
    mutateState((current) => {
      const session = current.activeSession;
      const activeDraft = current.draft;
      if (
        session?.kind !== "mock" ||
        !activeDraft ||
        activeDraft.sessionId !== session.id ||
        !session.mockProblems
      )
        return current;
      const maxElapsedMs = Math.max(1, session.durationMinutes ?? 45) * 60_000;
      const mockProblems = session.mockProblems.map((workspace) => {
        if (workspace.itemId !== activeDraft.itemId) return workspace;
        let updated = normalizeMockProblemWorkspace(
          {
            ...workspace,
            notebook: validatedNotebook,
            source: activeDraft.value,
          },
          { maxElapsedMs },
        );
        if (
          !workspace.notebook.finalExplanation.trim() &&
          updated.notebook.finalExplanation.trim()
        ) {
          updated = recordMockCheckpoint(
            updated,
            "explanationReady",
            mockElapsedMs(session),
            maxElapsedMs,
          );
        }
        return updated;
      });
      return { ...current, activeSession: { ...session, mockProblems } };
    });
  }

  function recordActiveMockCheckpoint(kind: MockCheckpointKind) {
    mutateState((current) => {
      const session = current.activeSession;
      const activeDraft = current.draft;
      if (
        session?.kind !== "mock" ||
        !activeDraft ||
        activeDraft.sessionId !== session.id
      )
        return current;
      return {
        ...current,
        activeSession: withMockCheckpoint(
          withMockDraftSnapshot(session, activeDraft),
          activeDraft.itemId,
          kind,
        ),
      };
    });
  }

  function updateCustomCaseInput(customCaseInput: string) {
    const bounded = customCaseInput.slice(0, 12000);
    mutateState((current) => ({
      ...current,
      customCaseInputs: {
        ...current.customCaseInputs,
        [item.itemId]: bounded,
      },
      draft:
        current.draft?.itemId === item.itemId
          ? { ...current.draft, customCaseInput: bounded }
          : current.draft,
    }));
  }

  function updateCustomTestcases(collection: CustomTestcaseCollection) {
    mutateState((current) => ({
      ...current,
      customTestcases: {
        ...current.customTestcases,
        [item.itemId]: collection,
      },
    }));
  }

  function withPrunedSubmissionAnnotations(
    current: AppState,
    submissionLog: AppState["submissionLog"],
  ) {
    return {
      ...current,
      submissionLog,
      submissionAnnotations: pruneSubmissionAnnotations(
        current.submissionAnnotations,
        new Set(submissionLog.receipts.map((receipt) => receipt.id)),
      ),
    };
  }

  function requestLocalSubmission(request: SubmissionRequest) {
    try {
      commitStateImmediately(
        (current) =>
          withPrunedSubmissionAnnotations(
            current,
            requestSubmissionReceipt(current.submissionLog, request),
          ),
        { requirePersistence: true },
      );
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Submission could not be queued");
      return false;
    }
  }

  function recordSubmission(submission: SubmissionRecord) {
    try {
      const settledAt = new Date().toISOString();
      commitStateImmediately((current) =>
        withReconciledAttemptEvidence(
          withPrunedSubmissionAnnotations(
          current,
          settleSubmissionReceipt(current.submissionLog, submission.id, {
            settledAt,
            status: submission.status,
            durationMs: submission.durationMs,
            passed: submission.passed,
            total: submission.total,
            ...(submission.status === "judge-error"
              ? { interruptionReason: "local-judge-error" }
              : {}),
          }),
          ),
          settledAt,
        ),
      );
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Submission receipt could not be settled");
    }
  }

  function recordTrustedAssessmentReceipt(event: TrustedAssessmentReceiptEvent) {
    const receiptId = `trusted:${event.submissionId}`;
    const itemId = `custom:trusted-${event.challengeKey}` as ItemId;
    const settledAt = event.settledAt;
    const durationMs = Math.max(
      0,
      Math.min(86_400_000, Date.parse(settledAt) - Date.parse(event.submittedAt)),
    );
    try {
      commitStateImmediately(
        (current) => {
          if (current.submissionLog.receipts.some((receipt) => receipt.id === receiptId)) {
            return current;
          }
          const requested = requestSubmissionReceipt(current.submissionLog, {
            id: receiptId,
            itemId,
            titleSnapshot: event.title,
            language: event.language,
            itemRevision: event.contentRevision,
            requestedAt: event.submittedAt,
            source: event.source,
            judge: {
              kind: event.language === "swift"
                ? "server-isolated-swift"
                : "server-isolated-python",
              revision: event.judgeRevision,
            },
            context: { kind: "assessment" },
            assistance: "unknown",
          });
          const settled = settleSubmissionReceipt(requested, receiptId, {
            settledAt,
            status: event.status,
            durationMs,
            passed: event.passed,
            total: event.total,
          });
          return withReconciledAttemptEvidence(
            { ...current, submissionLog: settled },
            settledAt,
          );
        },
        { requirePersistence: true },
      );
      setToast(
        event.status === "accepted"
          ? `${event.language === "swift" ? "Swift" : "Python"} receipt saved to the assessment work log`
          : `${event.language === "swift" ? "Swift" : "Python"} ${event.status.replace("-", " ")} saved for review`,
      );
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Verified receipt could not be saved locally");
    }
  }

  function restoreSubmissionSource(submission: SubmissionRecord) {
    if (
      practiceKind !== "solving" ||
      !canSolveItem(item) ||
      submission.itemId !== item.itemId
    ) {
      return;
    }
    const liveDraft = stateRef.current.draft;
    if (
      liveDraft?.itemId === item.itemId &&
      liveDraft.practiceKind === "solving" &&
      liveDraft.value === submission.source
    ) {
      return;
    }
    mutateState((current) => {
      const currentDraft =
        current.draft?.itemId === item.itemId &&
        current.draft.practiceKind === "solving"
          ? current.draft
          : freshDraft(
              item.itemId,
              5,
              item.contentRevision,
              undefined,
              undefined,
              "solving",
              item.starterCode ?? "",
            );
      if (currentDraft.value === submission.source) return current;
      return {
        ...current,
        draft: {
          ...currentDraft,
          value: submission.source,
          startedAt: currentDraft.startedAt ?? Date.now(),
          peeks: currentDraft.peeks + 1,
        },
        transferWorkspace: item.transfer
          ? recordTransferHint(
              current.transferWorkspace,
              item.itemId,
              3,
              {
                now: new Date().toISOString(),
                variantRevision: item.contentRevision,
                referenceRevealed: true,
              },
            )
          : current.transferWorkspace,
        lastItemId: item.itemId,
        lastStage: 5,
      };
    });
    setToast("Submission restored - this solve is now marked assisted");
  }

  function completeAttempt(
    next: Draft,
    attempt: AttemptRecord,
    learningEvent?: LearningEvent,
  ) {
    const transferAttemptEvidence = item.transfer
      ? deriveTransferProgress({
          variants: transferItems,
          workspace: state.transferWorkspace,
          attempts: [...state.attempts, attempt],
          submissions: settledSubmissionRecords(state.submissionLog),
          now: attempt.completedAt,
        })
          .find((entry) => entry.variantId === item.itemId)
          ?.solveEvidenceEvents.find(
            (entry) => entry.source === "attempt" && entry.id === attempt.id,
          )
      : undefined;
    const transferEvidenceClass: Result["transferEvidenceClass"] = item.transfer
      ? transferAttemptEvidence?.evidenceClass ?? "assisted-reconstruction"
      : undefined;
    const attemptCompletedAt = Date.parse(attempt.completedAt);
    const transferDebriefRevealedAt = item.transfer
      ? new Date(
          Math.max(
            Date.now(),
            Number.isFinite(attemptCompletedAt)
              ? attemptCompletedAt + 1
              : Date.now(),
          ),
        ).toISOString()
      : null;
    const previousBest =
      attempt.practiceKind === "typing"
        ? personalBest(state, selectedId, stage, attempt.mode)
        : null;
    let projected: AppState = {
      ...state,
      attempts: [...state.attempts, attempt].slice(-1000),
      typingProgress: applyTypingAttempt(state.typingProgress, attempt, {
        now: attempt.completedAt,
      }),
      learningEvents: learningEvent
        ? upsertLearningEvent(state.learningEvents, learningEvent)
        : state.learningEvents,
      transferWorkspace: transferDebriefRevealedAt
        ? recordTransferDebriefReveal(state.transferWorkspace, item.itemId, {
            now: transferDebriefRevealedAt,
            variantRevision: item.contentRevision,
          })
        : state.transferWorkspace,
      draft: null,
    };
    let sessionNext: Result["sessionNext"];
    let sessionComplete = false;
    const session = state.activeSession;
    if (session && next.sessionId === session.id) {
      const completedSession =
        session.kind === "mock"
          ? withMockCheckpoint(
              withMockDraftSnapshot(session, next),
              next.itemId,
              "codeCompleted",
            )
          : session;
      const entries = completedSession.entries.map((entry, index) =>
        index === completedSession.currentIndex
          ? { ...entry, status: "completed" as const, attemptId: attempt.id }
          : entry,
      );
      const nextIndex = entries.findIndex(
        (entry, index) =>
          index > completedSession.currentIndex && entry.status === "pending",
      );
      if (nextIndex >= 0) {
        const nextEntry = entries[nextIndex];
        projected = {
          ...projected,
          activeSession: {
            ...completedSession,
            entries,
            currentIndex: nextIndex,
          },
        };
        sessionNext = {
          itemId: nextEntry.itemId,
          stage: nextEntry.stage,
          practiceKind: nextEntry.practiceKind ?? "typing",
        };
      } else {
        sessionComplete = true;
        projected = {
          ...projected,
          activeSession: null,
          sessionHistory: [
            ...projected.sessionHistory,
            sessionHistoryRecord(completedSession, entries, "completed"),
          ].slice(-25),
          runManifests: finishLinkedRunManifest(
            projected.runManifests,
            { kind: "session", id: completedSession.id },
            "completed",
            attempt.completedAt,
          ),
        };
      }
    }
    mutateState((current) => {
      let committed: AppState = {
        ...current,
        attempts: [...current.attempts, attempt].slice(-1000),
        typingProgress: applyTypingAttempt(current.typingProgress, attempt, {
          now: attempt.completedAt,
        }),
        learningEvents: learningEvent
          ? upsertLearningEvent(current.learningEvents, learningEvent)
          : current.learningEvents,
        transferWorkspace: transferDebriefRevealedAt
          ? recordTransferDebriefReveal(
              current.transferWorkspace,
              item.itemId,
              {
                now: transferDebriefRevealedAt,
                variantRevision: item.contentRevision,
              },
            )
          : current.transferWorkspace,
        draft:
          current.draft?.itemId === next.itemId &&
          current.draft.itemRevision === next.itemRevision &&
          current.draft.practiceKind === next.practiceKind
            ? null
            : current.draft,
      };
      if (next.assessmentRunId && next.assessmentProbeId) {
        const frozenAssessmentEntry = current.assessments.runs
          .find((run) => run.id === next.assessmentRunId)
          ?.form?.find((entry) => entry.entryId === next.assessmentProbeId);
        committed = {
          ...committed,
          assessments: recordAssessmentObjectiveAttempt(
            current.assessments,
            next.assessmentRunId,
            next.assessmentProbeId,
            {
              ...attempt,
              responseMode: frozenAssessmentEntry?.responseMode,
              conceptCheckIndex:
                attempt.conceptCheckIndex ??
                frozenAssessmentEntry?.conceptCheckIndex,
              stage: frozenAssessmentEntry?.stage ?? attempt.stage,
            },
            { now: attempt.completedAt },
          ),
        };
      }
      const liveSession = current.activeSession;
      if (liveSession && next.sessionId === liveSession.id) {
        const isStudioSession =
          current.interviewStudio.active?.id === liveSession.id ||
          current.interviewStudio.history.some(
            (record) => record.id === liveSession.id,
          );
        const completedSession =
          liveSession.kind === "mock"
            ? withMockCheckpoint(
                withMockDraftSnapshot(liveSession, next),
                next.itemId,
                "codeCompleted",
              )
            : liveSession;
        const entries = completedSession.entries.map((entry, index) =>
          index === completedSession.currentIndex
            ? { ...entry, status: "completed" as const, attemptId: attempt.id }
            : entry,
        );
        const nextIndex = entries.findIndex(
          (entry, index) =>
            index > completedSession.currentIndex && entry.status === "pending",
        );
        committed =
          nextIndex >= 0
            ? {
                ...committed,
                activeSession: {
                  ...completedSession,
                  entries,
                  currentIndex: nextIndex,
                },
              }
            : {
                ...committed,
                activeSession: null,
                sessionHistory: isStudioSession
                  ? committed.sessionHistory
                  : [
                      ...committed.sessionHistory,
                      sessionHistoryRecord(
                        completedSession,
                        entries,
                        "completed",
                      ),
                    ].slice(-25),
              };
        if (nextIndex < 0) {
          committed = {
            ...committed,
            runManifests: finishLinkedRunManifest(
              committed.runManifests,
              { kind: "session", id: completedSession.id },
              "completed",
              attempt.completedAt,
            ),
          };
        }
      }
      return withReconciledAttemptEvidence(committed, attempt.completedAt);
    });
    if (next.assessmentRunId && next.assessmentProbeId) {
      setResult(null);
      selectAssessment(next.assessmentRunId);
      setToast("Checkpoint saved · add a short debrief before continuing");
      return;
    }
    if (session?.kind === "mock") {
      setResult(null);
      const isStudioSession = state.interviewStudio.active?.id === session.id;
      if (sessionNext) {
        const nextItem = allItems.find(
          (candidate) => candidate.itemId === sessionNext?.itemId,
        );
        if (nextItem) {
          window.setTimeout(
            () =>
              openItem(
                nextItem,
                sessionNext?.stage,
                undefined,
                session.id,
                sessionNext?.practiceKind,
              ),
            0,
          );
          setToast("Problem saved · continuing the same interview clock");
          return;
        }
      }
      if (isStudioSession) {
        navigateView("sessions");
        setToast("Interview archived · transcript and evidence saved locally");
        return;
      }
      setMockReviewSessionId(session.id);
      navigateView("sessions");
      setToast("Mock complete · your debrief is ready");
      return;
    }
    setResult({
      ...attempt,
      item,
      previousBest,
      nextReview: reviewDueAt(projected, selectedId),
      typingEvidence:
        attempt.practiceKind === "typing"
          ? (() => {
              const evidence = deriveTypingProgression(
                projected.typingProgress,
                attempt.itemId,
                attempt.itemRevision,
                attempt.completedAt,
              );
              return {
                owned: evidence.owned,
                retained: evidence.retained,
                nextStage: evidence.nextStage,
                diagnosticOnly: evidence.diagnosticOnly,
                recallLevel: evidence.recallLevel,
              };
            })()
          : undefined,
      sessionNext,
      sessionComplete,
      transferEvidenceClass,
    });
  }

  function finish(
    next: Draft,
    verification?: AttemptRecord["verification"],
    submissionId?: string,
  ) {
    const attempt = createAttempt(
      next,
      item,
      "completed",
      state,
      verification,
      submissionId,
    );
    completeAttempt(next, attempt);
  }

  function updateConceptResponse(value: string) {
    const added = Math.max(0, value.length - draft.value.length);
    const removed = Math.max(0, draft.value.length - value.length);
    updateDraft({
      ...draft,
      value,
      startedAt: draft.startedAt ?? Date.now(),
      totalKeystrokes: draft.totalKeystrokes + added,
      correctKeystrokes: draft.correctKeystrokes + added,
      corrections: draft.corrections + removed,
    });
  }

  function revealConceptAnswer(assisted: boolean, responseSnapshot: string) {
    updateDraft({
      ...draft,
      startedAt: draft.startedAt ?? Date.now(),
      conceptCommittedAt: Date.now(),
      conceptCommittedResponse: responseSnapshot.slice(0, 1000),
      peeks: draft.peeks + (assisted ? 1 : 0),
    });
  }

  function finishConcept(input: ConceptCompletionInput) {
    if (practiceKind !== "concept" || item.track !== "ios") return;
    const completedAt = new Date();
    const startedAt = draft.startedAt ?? completedAt.getTime();
    const durationMs = Math.max(0, completedAt.getTime() - startedAt);
    const attempt: AttemptRecord = {
      id: makeId(),
      itemId: item.itemId,
      itemRevision: item.contentRevision,
      titleSnapshot: item.title,
      language: item.language,
      stage,
      practiceKind: "concept",
      mode: "free",
      startedAt: new Date(startedAt).toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      totalKeystrokes: draft.totalKeystrokes,
      correctKeystrokes: 0,
      rejectedKeystrokes: 0,
      corrections: draft.corrections,
      peeks: draft.peeks,
      keyErrors: {},
      lineErrors: {},
      timeline: [],
      rawWpm: 0,
      wpm: 0,
      accuracy: 0,
      consistency: 0,
      outcome: "completed",
      qualification: "assisted",
      conceptGrade: input.grade,
      conceptCheckIndex: input.checkIndex,
      sessionId: draft.sessionId,
      assessmentRunId: draft.assessmentRunId,
      assessmentProbeId: draft.assessmentProbeId,
    };
    attempt.qualification = qualificationFor(attempt);
    const promptSnapshot = item.recallChecks?.[input.checkIndex] ?? item.summary;
    const event: LearningEvent = {
      id: makeId(),
      attemptId: attempt.id,
      itemId: item.itemId,
      itemRevision: item.contentRevision,
      practiceKind: "concept",
      activityKind: "concept",
      grade: input.grade,
      friction: input.friction,
      confidence: input.confidence,
      createdAt: completedAt.toISOString(),
      promptSnapshot: promptSnapshot.slice(0, 500),
      ...(input.response.trim()
        ? { response: input.response.trim().slice(0, 1000) }
        : {}),
    };
    completeAttempt(draft, attempt, event);
  }

  function handleValueChange(proposed: string) {
    if (
      draft.practiceKind === "solving" &&
      new TextEncoder().encode(proposed).byteLength >
        PYTHON_RUNNER_LIMITS.maxSourceBytes
    ) {
      setToast("Editor limit reached · keep the solution under 48 KB");
      return;
    }
    const edit = analyzeEdit(draft.value, proposed, item.code);
    const startedAt = draft.startedAt ?? Date.now();
    if (draft.practiceKind === "solving") {
      updateDraft({
        ...draft,
        value: proposed,
        startedAt,
        totalKeystrokes: draft.totalKeystrokes + edit.insertedCount,
        correctKeystrokes: draft.correctKeystrokes + edit.insertedCount,
        corrections: draft.corrections + edit.deletedCount,
      });
      return;
    }
    const correctPrefix = item.code.startsWith(proposed);
    const keyErrors = edit.inserted.split("").reduce(
      (next, character, index) => {
        if (character === item.code[edit.prefix + index]) return next;
        const keyName =
          character === "\n" ? "↵" : character === " " ? "space" : character;
        return { ...next, [keyName]: (next[keyName] ?? 0) + 1 };
      },
      { ...draft.keyErrors },
    );
    const lineErrors = edit.inserted.split("").reduce(
      (next, character, index) => {
        if (character === item.code[edit.prefix + index]) return next;
        const line = item.code.slice(0, edit.prefix + index).split("\n").length;
        const key = String(line);
        return { ...next, [key]: (next[key] ?? 0) + 1 };
      },
      { ...draft.lineErrors },
    );
    if (
      (draft.challengeDate || state.settings.strictMode) &&
      !correctPrefix &&
      edit.insertedCount > 0
    ) {
      const rejected = Math.max(
        1,
        edit.incorrectInserted || edit.insertedCount,
      );
      updateDraft({
        ...draft,
        keyErrors,
        lineErrors,
        startedAt,
        totalKeystrokes: draft.totalKeystrokes + edit.insertedCount,
        rejectedKeystrokes: draft.rejectedKeystrokes + rejected,
        corrections: draft.corrections + edit.deletedCount,
      });
      setToast(
        `Expected ${JSON.stringify(item.code[edit.prefix] ?? "end of solution")}`,
      );
      return;
    }
    const next: Draft = {
      ...draft,
      value: proposed,
      startedAt,
      keyErrors,
      lineErrors,
      totalKeystrokes: draft.totalKeystrokes + edit.insertedCount,
      correctKeystrokes: draft.correctKeystrokes + edit.correctInserted,
      corrections: draft.corrections + edit.deletedCount,
    };
    updateDraft(next);
    if (proposed === item.code) finish(next);
  }

  function finishSolve(
    source: string,
    verificationResult: PythonVerificationResult,
    runs: number,
    submissions = 1,
    purpose: "submit" | "full" = "submit",
    submissionId?: string,
  ) {
    const liveDraft = stateRef.current.draft;
    const activeMock =
      stateRef.current.activeSession?.kind === "mock" &&
      liveDraft?.sessionId === stateRef.current.activeSession.id
        ? stateRef.current.activeSession
        : null;
    if (activeMock && mockInterviewRemainingMs(activeMock, Date.now()) === 0) {
      expireMockInterview(activeMock.id);
      return;
    }
    if (
      practiceKind !== "solving" ||
      !item.verification ||
      !liveDraft ||
      liveDraft.itemId !== item.itemId ||
      liveDraft.itemRevision !== item.contentRevision ||
      liveDraft.practiceKind !== "solving" ||
      liveDraft.value !== source ||
      !isRecordableChallengeResult(
        verificationResult,
        purpose,
        Boolean(activeMock),
      )
    )
      return;
    const next: Draft = {
      ...liveDraft,
      practiceKind: "solving",
      stage: 5,
      value: source,
      startedAt: liveDraft.startedAt ?? Date.now(),
      testRuns: Math.max(liveDraft.testRuns, runs),
      submissions: Math.max(liveDraft.submissions, submissions),
    };
    finish(
      next,
      {
        revision: item.verification.revision ?? 1,
        passed: verificationResult.cases.filter((testCase) => testCase.passed)
          .length,
        total: verificationResult.cases.length,
        runs: Math.max(1, runs),
        submissions: Math.max(1, submissions),
      },
      submissionId,
    );
  }

  function finishTrustedSolve(
    source: string,
    judgeRevision: number,
    passed: number,
    total: number,
    submissionId?: string,
  ) {
    const liveDraft = stateRef.current.draft;
    if (
      practiceKind !== "solving" ||
      !canSolveItem(item) ||
      item.language !== "swift" ||
      !liveDraft ||
      liveDraft.itemId !== item.itemId ||
      liveDraft.itemRevision !== item.contentRevision ||
      liveDraft.practiceKind !== "solving" ||
      liveDraft.value !== source ||
      passed !== total ||
      total <= 0
    )
      return;
    const next: Draft = {
      ...liveDraft,
      practiceKind: "solving",
      stage: 5,
      value: source,
      startedAt: liveDraft.startedAt ?? Date.now(),
      testRuns: Math.max(liveDraft.testRuns, 1),
      submissions: Math.max(liveDraft.submissions, 1),
    };
    finish(
      next,
      {
        revision: judgeRevision,
        passed,
        total,
        runs: Math.max(1, next.testRuns),
        submissions: Math.max(1, next.submissions),
      },
      submissionId,
    );
  }

  function insertAtCursor(input: HTMLTextAreaElement, text: string) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    handleValueChange(
      `${draft.value.slice(0, start)}${text}${draft.value.slice(end)}`,
    );
    window.requestAnimationFrame(() => {
      input.selectionStart = input.selectionEnd = start + text.length;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.currentTarget.blur();
      setFocusMode(false);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      insertAtCursor(event.currentTarget, " ".repeat(state.settings.tabSize));
    }
  }

  function resetAttempt() {
    mutateState((current) => {
      const sessionId = current.draft?.sessionId;
      const virtualRoundId = current.draft?.virtualRoundId;
      const assessment =
        current.draft?.assessmentRunId && current.draft.assessmentProbeId
          ? {
              runId: current.draft.assessmentRunId,
              probeId: current.draft.assessmentProbeId,
            }
          : undefined;
      const base = recordAbandon(current);
      const roundProblem =
        virtualRoundId && base.virtualRoundWorkspace.active?.id === virtualRoundId
          ? base.virtualRoundWorkspace.active.problems.find(
              (problem) => problem.itemId === selectedId,
            )
          : undefined;
      const initialValue =
        practiceKind === "solving"
          ? (roundProblem?.starterSource ?? item.starterCode ?? "")
          : "";
      const virtualRoundWorkspace =
        virtualRoundId && roundProblem
          ? updateVirtualRoundSource(
              base.virtualRoundWorkspace,
              virtualRoundId,
              selectedId,
              initialValue,
            )
          : base.virtualRoundWorkspace;
      return {
        ...base,
        virtualRoundWorkspace,
        draft: freshDraft(
          selectedId,
          stage,
          item.contentRevision,
          undefined,
          sessionId,
          practiceKind,
          initialValue,
          assessment,
          virtualRoundId,
        ),
      };
    });
    setReveal(false);
    setResult(null);
    setToast("Attempt reset");
    setPracticeEpoch((current) => current + 1);
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLTextAreaElement>(
            ".concept-response-card textarea, .editor-wrap textarea",
          )
          ?.focus(),
      0,
    );
  }

  function toggleReveal() {
    setReveal((current) => !current);
    if (!reveal) updateDraft({ ...draft, peeks: draft.peeks + 1 });
  }
  function toggleFavorite(itemId: ItemId) {
    mutateState((current) => ({
      ...current,
      favorites: current.favorites.includes(itemId)
        ? current.favorites.filter((id) => id !== itemId)
        : [...current.favorites, itemId],
    }));
  }
  function updateSettings(patch: Partial<Settings>) {
    mutateState((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  }
  function toggleCommunityUploads(enabled: boolean) {
    mutateState((current) => ({
      ...current,
      cloud: { ...current.cloud, communityEnabled: enabled },
    }));
    setToast(
      enabled ? "Built-in attempt uploads enabled" : "Community uploads paused",
    );
  }
  function randomItem(mode: "all" | "due" = "all") {
    const pool =
      mode === "due" && dueItems.length ? dueItems : curriculumItems;
    openItem(pool[Math.floor(Math.random() * pool.length)]);
  }

  function selectAssessment(assessmentId?: string) {
    if (blockVirtualRoundNavigation()) return;
    setView("assessments");
    setAssessmentRouteId(assessmentId);
    setContestSection("overview");
    setContestRoundId(undefined);
    setResult(null);
    writeRoute({ view: "assessments", assessment: assessmentId });
    window.setTimeout(() => document.getElementById("main-content")?.focus(), 0);
  }

  function openTransferLab() {
    selectAssessment("transfer-lab");
  }

  function startTransferVariant(variantId: string) {
    const candidate = transferItems.find(
      (entry) => entry.itemId === variantId && entry.transfer,
    );
    if (!candidate) {
      setToast("That transfer variant is not available in this build");
      return;
    }
    openItem(candidate, 5, undefined, undefined, "solving");
    setToast(
      "Cold prompt opened · pattern hidden · hints permanently mark this attempt assisted",
    );
  }

  function updateContestRoute(
    nextSection: ContestSection,
    roundId?: string,
    replace = false,
  ) {
    if (blockVirtualRoundNavigation()) return;
    const selectedRoundId = nextSection === "review" ? roundId : undefined;
    setView("assessments");
    setAssessmentRouteId("virtual-rounds");
    setContestSection(nextSection);
    setContestRoundId(selectedRoundId);
    setResult(null);
    writeRoute(
      {
        view: "assessments",
        assessment: "virtual-rounds",
        contestSection: nextSection,
        contestRoundId: selectedRoundId,
      },
      replace,
    );
  }

  function openVirtualRounds(section: ContestSection = "overview") {
    updateContestRoute(section);
  }

  function openVirtualRoundReport(roundId: string) {
    const exists = stateRef.current.virtualRoundWorkspace.history.some(
      (run) => run.id === roundId,
    );
    if (!exists) {
      setToast("That retained round report is no longer available");
      updateContestRoute("history");
      return;
    }
    updateContestRoute("review", roundId);
  }

  function openVirtualRoundItem(roundId: string, itemId: string) {
    const run = stateRef.current.virtualRoundWorkspace.active;
    if (!run || run.id !== roundId || run.status !== "active") {
      openVirtualRounds();
      return;
    }
    const snapshot = run.problems.find((problem) => problem.itemId === itemId);
    const candidate = allItems.find(
      (entry) =>
        entry.itemId === itemId &&
        entry.contentRevision === snapshot?.itemRevision &&
        (entry.verification?.revision ?? 1) === snapshot?.verificationRevision,
    );
    if (!snapshot || !candidate?.verification) {
      setToast("This frozen round problem is unavailable in the current build");
      return;
    }
    mutateState((current) => ({
      ...current,
      virtualRoundWorkspace: openVirtualRoundProblem(
        current.virtualRoundWorkspace,
        roundId,
        itemId,
        { now: new Date().toISOString() },
      ),
    }));
    openItem(
      candidate,
      5,
      undefined,
      undefined,
      "solving",
      undefined,
      roundId,
    );
  }

  function resumeSavedDraft() {
    const live = stateRef.current.draft;
    if (!live) return;
    if (live.virtualRoundId) {
      openVirtualRoundItem(live.virtualRoundId, live.itemId);
      return;
    }
    const candidate = allItems.find(
      (entry) =>
        entry.itemId === live.itemId &&
        entry.contentRevision === live.itemRevision,
    );
    if (!candidate) {
      setToast("This saved draft is unavailable in the current build");
      return;
    }
    const assessment =
      live.assessmentRunId && live.assessmentProbeId
        ? { runId: live.assessmentRunId, probeId: live.assessmentProbeId }
        : undefined;
    openItem(
      candidate,
      live.stage,
      live.challengeDate,
      live.sessionId,
      live.practiceKind,
      assessment,
    );
  }

  function startChallengeSet(itemIds: ItemId[], mode: RunManifestMode) {
    const current = stateRef.current;
    const selected = itemIds.flatMap((itemId) => {
      const candidate = curriculumItems.find(
        (item) => item.itemId === itemId,
      );
      return candidate &&
        candidate.source === "builtin" &&
        !candidate.transfer &&
        !candidate.archivedAt
        ? [candidate]
        : [];
    });
    if (
      selected.length !== itemIds.length ||
      selected.length < 2 ||
      selected.length > 12 ||
      new Set(selected.map((item) => item.itemId)).size !== selected.length
    ) {
      setToast("Choose 2–12 current built-in problems for a Challenge Set");
      return;
    }
    const activeRound = current.virtualRoundWorkspace.active;
    if (activeRound) {
      setToast("Finish the active timed round before starting a Challenge Set");
      openVirtualRoundItem(activeRound.id, activeRound.currentProblemId);
      return;
    }
    if (
      mode === "timed" &&
      (selected.length > 4 ||
        selected.some(
          (item) =>
            item.track !== "interview" ||
            item.language !== "python" ||
            !item.verification,
        ))
    ) {
      setToast("Timed Challenge Sets require 2–4 runnable Python problems");
      return;
    }
    const activeManifest = current.runManifests.manifests.find(
      (manifest) => manifest.status === "active",
    );
    if (
      (current.activeSession || current.interviewStudio.active || activeManifest) &&
      !window.confirm(
        "Replace the active learning run with this Challenge Set? Completed work stays in Records, and the previous run will be marked ended.",
      )
    ) {
      return;
    }

    const runId = `challenge-set-${makeId()}`;
    const startedAt = new Date().toISOString();
    const title = `Challenge Set · ${selected.length} problems`;

    try {
      if (mode === "practice") {
        const entries: SessionQueueEntry[] = selected.map((item) => {
          const practiceKind: PracticeKind =
            canSolveItem(item)
              ? "solving"
              : supportsConceptPractice(item)
                ? "concept"
                : "typing";
          return {
            itemId: item.itemId,
            itemRevision: item.contentRevision,
            stage:
              practiceKind === "typing"
                ? recommendedStage(current, item)
                : 5,
            status: "pending",
            practiceKind,
            estimatedMinutes: item.estimatedMinutes,
            rationale:
              "Exact catalog selection · prompt and judge revisions frozen at launch.",
            lane:
              item.track === "ios"
                ? "ios"
                : item.language === "python"
                  ? "python"
                  : "interview",
          };
        });
        const session: TrainingSession = {
          id: runId,
          name: title,
          kind: "practice",
          source: "mixed",
          track: "all",
          language: "all",
          stageMode: "recommended",
          createdAt: startedAt,
          entries,
          currentIndex: 0,
        };
        commitStateImmediately((latest) => {
          const base = recordAbandon(latest);
          const previous = base.activeSession;
          let runManifests = endActiveRunManifest(
            base.runManifests,
            startedAt,
          );
          runManifests = createRunManifest(
            runManifests,
            {
              id: runId,
              title,
              source: "catalog",
              mode: "practice",
              durationMinutes: null,
              itemIds: selected.map((item) => item.itemId),
              execution: { kind: "session", id: runId },
            },
            curriculumItems,
            { now: startedAt },
          );
          runManifests = startRunManifest(runManifests, runId, {
            now: startedAt,
            execution: { kind: "session", id: runId },
          });
          return {
            ...base,
            activeSession: session,
            sessionHistory: previous
              ? [
                  ...base.sessionHistory,
                  sessionHistoryRecord(
                    previous,
                    previous.entries,
                    "ended",
                    startedAt,
                  ),
                ].slice(-25)
              : base.sessionHistory,
            interviewStudio: archiveActiveInterviewStudio(
              base.interviewStudio,
              startedAt,
              "ended",
            ),
            runManifests,
            draft: null,
          };
        });
        openItem(
          selected[0],
          entries[0].stage,
          undefined,
          runId,
          entries[0].practiceKind ?? "typing",
        );
        setToast(`${selected.length}-problem Challenge Set started · untimed`);
        return;
      }

      const presetId =
        selected.length === 2
          ? "sprint"
          : selected.length === 3
            ? "standard"
            : "endurance";
      const durationMinutes =
        selected.length === 2 ? 45 : selected.length === 3 ? 75 : 105;
      const preset = VIRTUAL_ROUND_PRESETS.find(
        (candidate) => candidate.id === presetId,
      );
      if (!preset) throw new Error("The matching timed format is unavailable");
      if (
        !window.confirm(
          `Start this exact ${selected.length}-problem timed Challenge Set?\n\n${durationMinutes} minutes · one continuous browser clock · prompt and judge revisions frozen now.`,
        )
      ) {
        return;
      }
      const snapshots = selected.map((item) => ({
        itemId: item.itemId,
        itemRevision: item.contentRevision,
        verificationRevision: item.verification?.revision ?? 1,
        title: item.title,
        pattern: item.pattern,
        difficulty: item.difficulty,
        starterSource: item.starterCode ?? "",
        source: item.starterCode ?? "",
      }));
      const next = commitStateImmediately((latest) => {
        const base = recordAbandon(latest);
        const previous = base.activeSession;
        let runManifests = endActiveRunManifest(
          base.runManifests,
          startedAt,
        );
        runManifests = createRunManifest(
          runManifests,
          {
            id: runId,
            title,
            source: "catalog",
            mode: "timed",
            durationMinutes,
            itemIds: selected.map((item) => item.itemId),
            execution: { kind: "virtual-round", id: runId },
          },
          curriculumItems,
          { now: startedAt },
        );
        runManifests = startRunManifest(runManifests, runId, {
          now: startedAt,
          execution: { kind: "virtual-round", id: runId },
        });
        return {
          ...base,
          activeSession: null,
          sessionHistory: previous
            ? [
                ...base.sessionHistory,
                sessionHistoryRecord(
                  previous,
                  previous.entries,
                  "ended",
                  startedAt,
                ),
              ].slice(-25)
            : base.sessionHistory,
          interviewStudio: archiveActiveInterviewStudio(
            base.interviewStudio,
            startedAt,
            "ended",
          ),
          virtualRoundWorkspace: startVirtualRound(
            base.virtualRoundWorkspace,
            preset.id,
            snapshots,
            { id: runId, now: startedAt },
          ),
          runManifests,
          draft: null,
        };
      });
      const active = next.virtualRoundWorkspace.active;
      if (active) openVirtualRoundItem(active.id, active.currentProblemId);
      setToast(
        `${selected.length}-problem Challenge Set started · ${durationMinutes} minutes`,
      );
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "That Challenge Set could not start",
      );
    }
  }

  function startVirtualRoundPreset(presetId: string) {
    const preset = VIRTUAL_ROUND_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) {
      setToast("That round format is unavailable");
      return;
    }
    const current = stateRef.current;
    const existing = current.virtualRoundWorkspace.active;
    if (existing) {
      setToast("Finish the active round before starting another");
      openVirtualRoundItem(existing.id, existing.currentProblemId);
      return;
    }
    const activeManifest = current.runManifests.manifests.find(
      (manifest) => manifest.status === "active",
    );
    const replacesLearningRun = Boolean(
      current.activeSession || current.interviewStudio.active || activeManifest,
    );
    if (
      !window.confirm(
        `Start ${preset.title}?\n\n${preset.problemCount} problems · ${preset.durationMinutes} minutes · one continuous browser clock. Problem identities reveal as you open them, and a finished score cannot be changed.${replacesLearningRun ? "\n\nThis replaces the active learning run. Completed work stays in Records, and that run will be marked ended." : ""}`,
      )
    )
      return;
    const candidates = virtualRoundEligibleItems.map((candidate) => {
      const itemAttempts = current.attempts.filter(
        (attempt) =>
          attempt.itemId === candidate.itemId &&
          attempt.itemRevision === candidate.contentRevision,
      );
      const roundAppearances = current.virtualRoundWorkspace.history.filter(
        (round) =>
          round.problems.some((problem) => problem.itemId === candidate.itemId),
      );
      return {
        item: candidate,
        itemId: candidate.itemId,
        pattern: candidate.pattern,
        difficulty: candidate.difficulty,
        independentSolves: itemAttempts.filter(
          (attempt) =>
            attempt.practiceKind === "solving" &&
            attempt.outcome === "completed" &&
            attempt.qualification === "solved",
        ).length,
        roundAppearances: roundAppearances.length,
        lastAttemptAt: [
          ...itemAttempts.map((attempt) => attempt.completedAt),
          ...roundAppearances.map((round) => round.finishedAt),
        ]
          .sort()
          .at(-1),
      };
    });
    const selected = selectVirtualRoundItems(candidates, preset.problemCount);
    if (selected.length !== preset.problemCount) {
      setToast(`This format needs ${preset.problemCount} runnable Python problems`);
      return;
    }
    const runId = `virtual-round-${makeId()}`;
    const startedAt = new Date().toISOString();
    const manifestDuration = RUN_MANIFEST_DURATIONS.includes(
      preset.durationMinutes as RunManifestDuration,
    )
      ? (preset.durationMinutes as RunManifestDuration)
      : null;
    if (manifestDuration === null) {
      setToast("That round duration is unavailable in Records");
      return;
    }
    const snapshots = selected.map(({ item: candidate }) => ({
      itemId: candidate.itemId,
      itemRevision: candidate.contentRevision,
      verificationRevision: candidate.verification?.revision ?? 1,
      title: candidate.title,
      pattern: candidate.pattern,
      difficulty: candidate.difficulty,
      starterSource: candidate.starterCode ?? "",
      source: candidate.starterCode ?? "",
    }));
    const next = commitStateImmediately((latest) => {
      const base = recordAbandon(latest);
      const previous = base.activeSession;
      let runManifests = endActiveRunManifest(base.runManifests, startedAt);
      runManifests = createRunManifest(
        runManifests,
        {
          id: runId,
          title: `Virtual Round · ${preset.title}`,
          source: "catalog",
          mode: "timed",
          durationMinutes: manifestDuration,
          itemIds: selected.map(({ item }) => item.itemId),
          execution: { kind: "virtual-round", id: runId },
        },
        curriculumItems,
        { now: startedAt },
      );
      runManifests = startRunManifest(runManifests, runId, {
        now: startedAt,
        execution: { kind: "virtual-round", id: runId },
      });
      return {
        ...base,
        activeSession: null,
        sessionHistory: previous
          ? [
              ...base.sessionHistory,
              sessionHistoryRecord(previous, previous.entries, "ended"),
            ].slice(-25)
          : base.sessionHistory,
        interviewStudio: archiveActiveInterviewStudio(
          base.interviewStudio,
          startedAt,
          "ended",
        ),
        runManifests,
        virtualRoundWorkspace: startVirtualRound(
          base.virtualRoundWorkspace,
          presetId,
          snapshots,
          { id: runId, now: startedAt },
        ),
        draft: null,
      };
    });
    const active = next.virtualRoundWorkspace.active;
    if (active) openVirtualRoundItem(active.id, active.currentProblemId);
    setToast(`${preset.title} started · ${preset.durationMinutes} minutes on one local clock`);
  }

  function resumeVirtualRound(roundId: string) {
    const active = stateRef.current.virtualRoundWorkspace.active;
    if (!active || active.id !== roundId) {
      openVirtualRounds();
      return;
    }
    openVirtualRoundItem(roundId, active.currentProblemId);
  }

  function flagVirtualRoundProblem(roundId: string, itemId: string) {
    mutateState((current) => ({
      ...current,
      virtualRoundWorkspace: toggleVirtualRoundFlag(
        current.virtualRoundWorkspace,
        roundId,
        itemId,
      ),
    }));
  }

  function finishActiveVirtualRound(roundId: string, outcome: "submitted" | "expired" = "submitted") {
    const activeBeforeFinish = stateRef.current.virtualRoundWorkspace.active;
    if (!activeBeforeFinish || activeBeforeFinish.id !== roundId) return;
    if (outcome === "submitted") {
      const unresolved = activeBeforeFinish.problems.filter(
        (problem) => virtualRoundProblemStatus(problem) !== "accepted",
      ).length;
      const flagged = activeBeforeFinish.problems.filter(
        (problem) => problem.flagged,
      ).length;
      if (
        !window.confirm(
          `Finish and lock ${activeBeforeFinish.title}?\n\n${unresolved} problem${unresolved === 1 ? "" : "s"} not accepted · ${flagged} flagged. The score and submission timeline become an immutable local report.`,
        )
      )
        return;
    }
    const finishedAt = new Date().toISOString();
    const next = commitStateImmediately((current) => {
      const virtualRoundWorkspace = finishVirtualRound(
        current.virtualRoundWorkspace,
        roundId,
        { now: finishedAt, outcome },
      );
      return {
        ...current,
        virtualRoundWorkspace,
        runManifests: !virtualRoundWorkspace.active
          ? finishLinkedRunManifest(
              current.runManifests,
              { kind: "virtual-round", id: roundId },
              outcome === "expired" ? "ended" : "completed",
              finishedAt,
            )
          : current.runManifests,
        draft:
          !virtualRoundWorkspace.active && current.draft?.virtualRoundId === roundId
            ? null
            : current.draft,
      };
    });
    if (next.virtualRoundWorkspace.active?.status === "finalizing") {
      setToast("Clock locked · waiting for the on-time submission to settle");
      return;
    }
    openVirtualRoundReport(roundId);
    setToast(outcome === "expired" ? "Time expired · local report locked" : "Virtual round finished · local report locked");
  }

  function expireActiveVirtualRound(roundId: string) {
    const active = stateRef.current.virtualRoundWorkspace.active;
    if (!active || active.id !== roundId) return;
    const expiredAt = new Date().toISOString();
    const next = commitStateImmediately((current) => {
      const virtualRoundWorkspace = expireVirtualRound(
        current.virtualRoundWorkspace,
        { now: expiredAt },
      );
      return {
        ...current,
        virtualRoundWorkspace,
        runManifests: !virtualRoundWorkspace.active
          ? finishLinkedRunManifest(
              current.runManifests,
              { kind: "virtual-round", id: roundId },
              "ended",
              expiredAt,
            )
          : current.runManifests,
        draft:
          !virtualRoundWorkspace.active && current.draft?.virtualRoundId === roundId
            ? null
            : current.draft,
      };
    });
    if (!next.virtualRoundWorkspace.active) {
      openVirtualRoundReport(roundId);
      setToast("Time expired · local report locked");
    }
  }

  function requestActiveVirtualRoundSubmission(request: SubmissionRequest) {
    const roundId = request.context.virtualRoundId;
    if (!roundId) return false;
    try {
      commitStateImmediately(
        (current) => {
          const virtualRoundWorkspace = requestVirtualRoundSubmission(
            current.virtualRoundWorkspace,
            roundId,
            request.itemId,
            {
              id: request.id,
              requestedAt: new Date(request.requestedAt).toISOString(),
              source: request.source,
            },
          );
          const submissionLog = requestSubmissionReceipt(
            current.submissionLog,
            request,
          );
          return {
            ...withPrunedSubmissionAnnotations(current, submissionLog),
            virtualRoundWorkspace,
          };
        },
        { requirePersistence: true },
      );
      return true;
    } catch (error) {
      if (error instanceof Error && /deadline passed/i.test(error.message)) {
        expireActiveVirtualRound(roundId);
      } else {
        setToast(error instanceof Error ? error.message : "Submission could not be queued");
      }
      return false;
    }
  }

  function settleActiveVirtualRoundSubmission(submission: SubmissionRecord) {
    const roundId = submission.virtualRoundId;
    if (!roundId) return;
    const settledAt = new Date().toISOString();
    const next = commitStateImmediately((current) => {
      const virtualRoundWorkspace = settleVirtualRoundSubmission(
        current.virtualRoundWorkspace,
        roundId,
        submission.id,
        {
          judgedAt: settledAt,
          status: submission.status,
          durationMs: submission.durationMs,
          passed: submission.passed,
          total: submission.total,
        },
      );
      const submissionLog = settleSubmissionReceipt(
        current.submissionLog,
        submission.id,
        {
          settledAt,
          status: submission.status,
          durationMs: submission.durationMs,
          passed: submission.passed,
          total: submission.total,
          ...(submission.status === "judge-error"
            ? { interruptionReason: "local-judge-error" }
            : {}),
        },
      );
      const finishedRound = !virtualRoundWorkspace.active
        ? virtualRoundWorkspace.history.find((round) => round.id === roundId)
        : undefined;
      return withReconciledAttemptEvidence({
        ...withPrunedSubmissionAnnotations(current, submissionLog),
        virtualRoundWorkspace,
        runManifests: finishedRound
          ? finishLinkedRunManifest(
              current.runManifests,
              { kind: "virtual-round", id: roundId },
              finishedRound.outcome === "expired" ? "ended" : "completed",
              settledAt,
            )
          : current.runManifests,
        draft:
          !virtualRoundWorkspace.active && current.draft?.virtualRoundId === roundId
            ? null
            : current.draft,
      }, settledAt);
    });
    if (!next.virtualRoundWorkspace.active) {
      openVirtualRoundReport(roundId);
      setToast("Round report locked after the final on-time judgment");
    }
  }

  function archiveVirtualRoundReport(roundId: string) {
    mutateState((current) => ({
      ...current,
      virtualRoundWorkspace: archiveVirtualRound(
        current.virtualRoundWorkspace,
        roundId,
      ),
    }));
    setToast("Virtual round report archived");
  }

  function retryVirtualRoundProblem(roundId: string, itemId: string) {
    const round = stateRef.current.virtualRoundWorkspace.history.find(
      (candidate) => candidate.id === roundId,
    );
    const snapshot = round?.problems.find(
      (problem) => problem.itemId === itemId,
    );
    const candidate = allItems.find(
      (item) =>
        item.itemId === itemId &&
        item.contentRevision === snapshot?.itemRevision &&
        (item.verification?.revision ?? 1) === snapshot?.verificationRevision,
    );
    if (!round || !snapshot || !candidate?.verification) {
      setToast("That frozen problem revision is not available for a clean retry");
      return;
    }
    openItem(candidate, 5, undefined, undefined, "solving");
    setToast("Fresh practice opened · the locked contest report will not change");
  }

  function inspectVirtualRoundSubmission(submissionId: string) {
    updateRecordsRoute(
      "submissions",
      normalizeSubmissionWorkLogQuery({
        ...DEFAULT_SUBMISSION_WORK_LOG_QUERY,
        origins: ["round"],
        selectedId: submissionId,
      }),
    );
  }

  function startAssessmentProgram(programId: string) {
    const runId = `assessment-${makeId()}`;
    mutateState((current) => ({
      ...current,
      assessments: startAssessment(current.assessments, programId, {
        id: runId,
        now: new Date().toISOString(),
        evidence: current.attempts,
      }),
    }));
    selectAssessment(runId);
    setToast("Baseline started · complete one short checkpoint at a time");
  }

  function resumeAssessmentRun(runId: string) {
    mutateState((current) => ({
      ...current,
      assessments: resumeAssessment(current.assessments, runId, {
        now: new Date().toISOString(),
      }),
    }));
    selectAssessment(runId);
    setToast("Baseline resumed");
  }

  function openAssessmentProbe(
    runId: string,
    probe: AssessmentProbe,
    refresher = false,
  ) {
    const candidate = allItems.find(
      (entry) =>
        entry.itemId === probe.itemId &&
        (!probe.itemRevision || entry.contentRevision === probe.itemRevision),
    );
    if (!candidate) {
      setToast("This frozen checkpoint revision is unavailable in this build");
      return;
    }
    if (
      probe.currentEvidenceEligible === false ||
      (probe.judgeRevision &&
        candidate.verification?.revision !== probe.judgeRevision)
    ) {
      setToast("This checkpoint is preserved for history but cannot create current evidence");
      return;
    }
    const responseMode = probe.responseMode ??
      (candidate.track === "ios"
        ? "concept-recall"
        : candidate.language === "swift"
          ? "swift-reconstruction"
          : "local-verified-solve");
    const chosenPracticeKind: PracticeKind = refresher
      ? responseMode === "concept-recall"
        ? "concept"
        : "typing"
      : responseMode === "local-verified-solve"
        ? "solving"
        : responseMode === "concept-recall"
          ? "concept"
          : "typing";
    const chosenStage = refresher && chosenPracticeKind === "typing"
      ? 1
      : (probe.stage ?? 5);
    openItem(
      candidate,
      chosenStage,
      undefined,
      undefined,
      chosenPracticeKind,
      refresher ? undefined : { runId, probeId: probe.id },
    );
    setToast(
      refresher
        ? responseMode === "concept-recall"
          ? "Concept refresher opened · this checkpoint stays labeled assisted"
          : "Known answer opened · return for the frozen response when ready"
        : "Frozen checkpoint started · response mode and revision are locked",
    );
  }

  function useAssessmentRefresher(runId: string, probe: AssessmentProbe) {
    mutateState((current) => ({
      ...current,
      assessments: recordAssessmentRefresher(
        current.assessments,
        runId,
        probe.id,
        {
          kind:
            probe.responseMode === "concept-recall" ||
            probe.lane === "ios-self-assessed"
              ? "concept-review"
              : "known-answer",
          stage:
            probe.responseMode === "concept-recall" ||
            probe.lane === "ios-self-assessed"
              ? 0
              : 1,
        },
        { now: new Date().toISOString() },
      ),
    }));
    window.setTimeout(() => openAssessmentProbe(runId, probe, true), 0);
  }

  function saveAssessmentReflection(
    runId: string,
    probeId: string,
    input: {
      rubric: AssessmentRubric;
      blockers: AssessmentBlocker[];
      note: string;
    },
  ) {
    mutateState((current) => {
      let assessments = recordAssessmentDebrief(
        current.assessments,
        runId,
        probeId,
        input,
        { now: new Date().toISOString() },
      );
      const run = assessments.runs.find((candidate) => candidate.id === runId);
      if (run?.results.every((result) => result.status === "debriefed")) {
        assessments = finishAssessment(assessments, runId, {
          now: new Date().toISOString(),
          outcome: "completed",
        });
      }
      return { ...current, assessments };
    });
    selectAssessment(runId);
    setToast("Debrief saved · evidence updated");
  }

  function finishAssessmentEarly(runId: string) {
    mutateState((current) => ({
      ...current,
      assessments: finishAssessment(current.assessments, runId, {
        now: new Date().toISOString(),
        outcome: "ended",
      }),
      draft:
        current.draft?.assessmentRunId === runId ? null : current.draft,
    }));
    selectAssessment(runId);
    setToast("Baseline ended · partial evidence was preserved");
  }

  function archiveAssessmentReport(runId: string) {
    mutateState((current) => ({
      ...current,
      assessments: archiveAssessment(current.assessments, runId, {
        now: new Date().toISOString(),
      }),
    }));
    setToast("Assessment report archived");
  }

  function createPlanFromAssessment(runId: string) {
    if (
      stateRef.current.studyWorkspace.collections.length >=
        STUDY_PLAN_LIMITS.maxCollections ||
      stateRef.current.studyWorkspace.plans.length >= STUDY_PLAN_LIMITS.maxPlans
    ) {
      setToast("Study plan limit reached · delete an unused plan first");
      return;
    }
    const seed = buildAssessmentStudyPlanSeed(
      stateRef.current.assessments,
      { runId },
    );
    if (!seed) {
      setToast("Complete at least one checkpoint before building a plan");
      return;
    }
    const availableIds = new Set(allItems.map((candidate) => candidate.itemId));
    const itemIds = seed.collection.itemIds.filter(
      (itemId): itemId is ItemId => availableIds.has(itemId as ItemId),
    );
    if (!itemIds.length) {
      setToast("The assessed items are no longer available in the catalog");
      return;
    }
    const modules = seed.collection.modules
      .map((module) => ({
        ...module,
        itemIds: module.itemIds.filter(
          (itemId): itemId is ItemId => availableIds.has(itemId as ItemId),
        ),
      }))
      .filter((module) => module.itemIds.length > 0);
    const collectionId = `assessment-collection-${makeId()}`;
    mutateState((current) => {
      const withCollection = createStudyCollection(
        current.studyWorkspace,
        {
          title: seed.collection.title,
          description: seed.collection.description,
          outcome: seed.collection.outcome,
          source: "custom",
          itemIds,
          modules,
        },
        { id: collectionId, now: new Date().toISOString() },
      );
      return {
        ...current,
        studyWorkspace: createStudyPlan(
          withCollection,
          {
            collectionId,
            ...seed.plan,
          },
          { now: new Date().toISOString() },
        ),
      };
    });
    navigateView("plans");
    setToast("Assessment plan created · your weakest evidence comes first");
  }

  function instantiateStudyTemplate(
    templateId: string,
    paceMinutes: StudyPlanPace,
  ) {
    if (
      stateRef.current.studyWorkspace.collections.length >=
        STUDY_PLAN_LIMITS.maxCollections ||
      stateRef.current.studyWorkspace.plans.length >= STUDY_PLAN_LIMITS.maxPlans
    ) {
      setToast("Study plan limit reached · delete an unused plan or collection first");
      return;
    }
    mutateState((current) => ({
      ...current,
      studyWorkspace: instantiateStudyPlanTemplate(
        current.studyWorkspace,
        templateId,
        allItems,
        { paceMinutes, now: new Date().toISOString() },
      ),
    }));
    setToast("Study plan created · your first focus block is ready");
  }

  function addStudyCollection(input: StudyCollectionInput) {
    if (
      stateRef.current.studyWorkspace.collections.length >=
      STUDY_PLAN_LIMITS.maxCollections
    ) {
      setToast("Collection limit reached · delete an unused collection first");
      return;
    }
    mutateState((current) => ({
      ...current,
      studyWorkspace: createStudyCollection(current.studyWorkspace, input, {
        now: new Date().toISOString(),
      }),
    }));
    setToast("Collection saved");
  }

  function appendCatalogSelectionToCollection(
    collectionId: string,
    itemIds: ItemId[],
  ) {
    const collection = stateRef.current.studyWorkspace.collections.find(
      (entry) => entry.id === collectionId,
    );
    if (!collection) {
      setToast("That collection is no longer available");
      return;
    }
    const existing = new Set(collection.itemIds);
    const additions = [...new Set(itemIds)].filter((id) => !existing.has(id));
    if (!additions.length) {
      setToast("Every selected item is already in that collection");
      return;
    }
    if (
      collection.itemIds.length + additions.length >
      STUDY_PLAN_LIMITS.maxItemsPerCollection
    ) {
      setToast(
        `Collection capacity exceeded · ${STUDY_PLAN_LIMITS.maxItemsPerCollection} items maximum`,
      );
      return;
    }
    mutateState((current) => ({
      ...current,
      studyWorkspace: appendStudyCollectionItems(
        current.studyWorkspace,
        collectionId,
        additions,
        { now: new Date().toISOString() },
      ),
    }));
    setToast(
      `${additions.length} ${additions.length === 1 ? "item" : "items"} added to ${collection.title}`,
    );
  }

  function createCatalogSelectionCollection(name: string, itemIds: ItemId[]) {
    addStudyCollection({
      title: name,
      description: "Fixed selection created from the Library workspace.",
      itemIds: [...new Set(itemIds)].slice(
        0,
        STUDY_PLAN_LIMITS.maxItemsPerCollection,
      ),
    });
  }

  function commitStateImmediately(
    updater: (current: AppState) => AppState,
    options: { requirePersistence?: boolean } = {},
  ) {
    const next = updater(stateRef.current);
    const activeScope = persistenceScopeRef.current;
    const persisted = Boolean(
      activeScope && saveStateForScope(next, activeScope),
    );
    if (options.requirePersistence && !persisted) {
      throw new Error(
        "Local storage is unavailable · free browser storage before submitting",
      );
    }
    stateRef.current = next;
    setState(next);
    return next;
  }

  function blockVirtualRoundNavigation() {
    const active = stateRef.current.virtualRoundWorkspace.active;
    const pending = active?.problems.some((problem) =>
      problem.submissions.some((submission) => submission.status === "pending"),
    );
    if (!active || !pending) return false;
    setToast("Local judging is still running · stay here until the verdict is saved");
    return true;
  }

  function useSolveHint(level: 1 | 2 | 3) {
    const hintedAt = new Date().toISOString();
    mutateState((current) => {
      const active =
        current.draft?.itemId === item.itemId &&
        current.draft.itemRevision === item.contentRevision &&
        current.draft.practiceKind === "solving"
          ? current.draft
          : draft;
      return {
        ...current,
        draft: {
          ...active,
          startedAt: active.startedAt ?? Date.now(),
          peeks: active.peeks + 1,
        },
        transferWorkspace: item.transfer
          ? recordTransferHint(
              current.transferWorkspace,
              item.itemId,
              level,
              {
                now: hintedAt,
                variantRevision: item.contentRevision,
                referenceRevealed: level === 3,
              },
            )
          : current.transferWorkspace,
      };
    });
  }

  function saveCatalogSavedView(name: string, query: CatalogQuery) {
    if (
      stateRef.current.catalogWorkspace.savedViews.length >=
      CATALOG_LIMITS.maxSavedViews
    ) {
      setToast("Saved-view limit reached · delete a view before adding another");
      return;
    }
    mutateState((current) => ({
      ...current,
      catalogWorkspace: saveCatalogView(current.catalogWorkspace, {
        name,
        query,
      }),
    }));
    setToast("Library view saved on this device");
  }

  function updateCatalogSavedView(
    id: string,
    patch: { name?: string; query?: CatalogQuery },
  ) {
    mutateState((current) => ({
      ...current,
      catalogWorkspace: updateCatalogView(
        current.catalogWorkspace,
        id,
        patch,
      ),
    }));
    setToast(patch.query ? "Saved view updated" : "Saved view renamed");
  }

  function deleteCatalogSavedView(id: string) {
    mutateState((current) => ({
      ...current,
      catalogWorkspace: deleteCatalogView(current.catalogWorkspace, id),
    }));
    setToast("Saved view deleted");
  }

  function persistProblemNote(note: Omit<ProblemNote, "updatedAt">) {
    const noteItems = [...BUILTIN_ITEMS, ...stateRef.current.customItems];
    const validItemIds = new Set(noteItems.map((candidate) => candidate.itemId));
    try {
      commitStateImmediately((current) => ({
        ...current,
        problemNotes: saveProblemNote(current.problemNotes, note, {
          validItemIds,
          now: new Date().toISOString(),
        }),
      }), { requirePersistence: true });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Problem note could not be saved locally");
      return false;
    }
    setToast("Problem note saved on this device");
    return true;
  }

  function removeProblemNote(itemId: ItemId) {
    const noteItems = [...BUILTIN_ITEMS, ...stateRef.current.customItems];
    const validItemIds = new Set(noteItems.map((candidate) => candidate.itemId));
    try {
      commitStateImmediately((current) => ({
        ...current,
        problemNotes: deleteProblemNote(current.problemNotes, itemId, {
          validItemIds,
        }),
      }), { requirePersistence: true });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Problem note could not be deleted locally");
      return false;
    }
    setToast("Problem note deleted");
    return true;
  }

  function editStudyCollection(
    collectionId: string,
    changes: Partial<StudyCollectionInput>,
  ) {
    mutateState((current) => ({
      ...current,
      studyWorkspace: updateStudyCollection(
        current.studyWorkspace,
        collectionId,
        changes,
        { now: new Date().toISOString() },
      ),
    }));
    setToast("Collection updated · enrolled plans keep their snapshot");
  }

  function removeStudyCollection(collectionId: string) {
    mutateState((current) => ({
      ...current,
      studyWorkspace: deleteStudyCollection(
        current.studyWorkspace,
        collectionId,
        { now: new Date().toISOString() },
      ),
    }));
    setToast("Collection deleted · existing plan snapshots remain intact");
  }

  function addStudyPlan(input: StudyPlanInput) {
    if (
      stateRef.current.studyWorkspace.plans.length >= STUDY_PLAN_LIMITS.maxPlans
    ) {
      setToast("Study plan limit reached · delete an unused plan first");
      return;
    }
    mutateState((current) => ({
      ...current,
      studyWorkspace: createStudyPlan(current.studyWorkspace, input, {
        now: new Date().toISOString(),
      }),
    }));
    setToast("Study plan created and made active");
  }

  function editStudyPlan(
    planId: string,
    changes: { title?: string; paceMinutes?: StudyPlanPace },
  ) {
    mutateState((current) => ({
      ...current,
      studyWorkspace: updateStudyPlan(
        current.studyWorkspace,
        planId,
        changes,
        { now: new Date().toISOString() },
      ),
    }));
  }

  function removeStudyPlan(planId: string) {
    mutateState((current) => ({
      ...current,
      studyWorkspace: deleteStudyPlan(current.studyWorkspace, planId, {
        now: new Date().toISOString(),
      }),
    }));
    setToast("Study plan deleted");
  }

  function makeStudyPlanActive(planId: string) {
    mutateState((current) => ({
      ...current,
      studyWorkspace: activateStudyPlan(current.studyWorkspace, planId, {
        now: new Date().toISOString(),
      }),
    }));
    setToast("Active study plan changed");
  }

  function pauseActiveStudyPlan(planId: string) {
    mutateState((current) => ({
      ...current,
      studyWorkspace: pauseStudyPlan(current.studyWorkspace, planId, {
        now: new Date().toISOString(),
      }),
    }));
    setToast("Plan paused without penalty");
  }

  function linkPlanSession(
    workspace: AppState["studyWorkspace"],
    planId: string | undefined,
    sessionId: string,
    kind: "focus" | "studio",
    at: string,
  ) {
    if (!planId) return workspace;
    return linkStudyPlanSession(
      workspace,
      planId,
      sessionId,
      kind,
      { now: at },
    );
  }

  function startStudyFocusBlock(
    planId: string,
    entries: SessionQueueEntry[],
    budgetMinutes: StudyPlanPace,
  ) {
    const plan = stateRef.current.studyWorkspace.plans.find(
      (candidate) => candidate.id === planId,
    );
    if (!plan) {
      setToast("That study plan is no longer available");
      return;
    }
    startSession(
      {
        name: `${plan.title} · ${budgetMinutes} min`,
        count: entries.length,
        source: "mixed",
        track: "all",
        language: "all",
        pattern: "All",
        difficulty: "All",
        stageMode: "recommended",
        studyPlanId: plan.id,
        studyCollectionIds: plan.collectionIds,
      },
      entries,
    );
  }

  function startStudyCapstone(
    planId: string,
    format: InterviewStudioFormat,
    mode: InterviewStudioMode,
  ) {
    startInterviewStudio(format, mode, 45, planId);
  }

  function startSession(
    options: SessionBuildOptions,
    plannedEntries?: SessionQueueEntry[],
  ) {
    if (
      (state.activeSession || state.interviewStudio.active) &&
      !window.confirm(
        "Replace the active session with this new queue? Completed entries will stay in session history.",
      )
    )
      return;
    const signals = Object.fromEntries(
      curriculumItems.map((candidate) => {
        const itemProgress = itemStats(state, candidate.itemId);
        return [
          candidate.itemId,
          {
            due: isReviewDue(state, candidate.itemId),
            favorite: state.favorites.includes(candidate.itemId),
            completions: itemProgress.completions,
            recommendedStage: recommendedStage(state, candidate),
            itemRevision: candidate.contentRevision,
          },
        ];
      }),
    );
    const planned = plannedEntries
      ?.flatMap((entry): SessionQueueEntry[] => {
        const candidate = curriculumItems.find(
          (item) => item.itemId === entry.itemId,
        );
        if (
          !candidate ||
          candidate.transfer ||
          (options.track !== "all" && candidate.track !== options.track) ||
          (options.language !== "all" &&
            candidate.language !== options.language)
        )
          return [];
        const practiceKind =
          entry.practiceKind === "solving" && candidate.verification
            ? "solving"
            : entry.practiceKind === "concept" &&
                supportsConceptPractice(candidate)
              ? "concept"
            : "typing";
        return [
          {
            itemId: candidate.itemId,
            itemRevision: candidate.contentRevision,
            stage:
              practiceKind === "solving"
                ? 5
                : Math.max(1, Math.min(5, Math.round(entry.stage || 1))),
            status: "pending",
            practiceKind,
            estimatedMinutes: entry.estimatedMinutes,
            rationale: entry.rationale,
            lane: entry.lane,
          },
        ];
      })
      .slice(0, 20);
    const entries = planned?.length
      ? planned
      : buildSessionQueue(curriculumItems, signals, options);
    if (!entries.length) {
      setToast("No items match that session setup");
      return;
    }
    const session: TrainingSession = {
      id: makeId(),
      name: options.name.trim() || "Practice session",
      kind: "practice",
      source: options.source,
      track: options.track,
      language: options.language,
      stageMode: options.stageMode,
      createdAt: new Date().toISOString(),
      entries,
      currentIndex: 0,
      studyPlanId: options.studyPlanId,
      studyCollectionIds: options.studyCollectionIds,
    };
    mutateState((current) => {
      const base = recordAbandon(current);
      const previous = base.activeSession;
      const sessionHistory = previous
        ? [
            ...base.sessionHistory,
            sessionHistoryRecord(previous, previous.entries, "ended"),
          ].slice(-25)
        : base.sessionHistory;
      return {
        ...base,
        activeSession: session,
        sessionHistory,
        runManifests: previous
          ? finishLinkedRunManifest(
              base.runManifests,
              { kind: "session", id: previous.id },
              "ended",
              session.createdAt,
            )
          : base.runManifests,
        studyWorkspace: linkPlanSession(
          base.studyWorkspace,
          options.studyPlanId,
          session.id,
          "focus",
          session.createdAt,
        ),
        interviewStudio: archiveActiveInterviewStudio(
          base.interviewStudio,
          new Date().toISOString(),
          "ended",
        ),
        draft: null,
      };
    });
    const first = allItems.find(
      (candidate) => candidate.itemId === entries[0].itemId,
    );
    if (first)
      openItem(
        first,
        entries[0].stage,
        undefined,
        session.id,
        entries[0].practiceKind ?? "typing",
      );
    setToast(`${entries.length}-item session started`);
  }

  function startMockInterview(
    presetId: MockInterviewPresetId,
    problemCount: MockInterviewProblemCount,
  ) {
    if (
      (state.activeSession || state.interviewStudio.active) &&
      !window.confirm(
        "Replace the active session with this timed mock? Completed work will stay in session history.",
      )
    )
      return;
    const preset = mockInterviewPreset(presetId);
    const candidates = selectMockInterviewItems(
      curriculumItems,
      state.attempts,
      preset.id,
      problemCount,
    );
    if (candidates.length !== problemCount) {
      setToast(
        `Could not find ${problemCount} distinct verified Python problem${problemCount === 1 ? "" : "s"} for this preset`,
      );
      return;
    }
    const startedAt = new Date().toISOString();
    const expiresAt = mockInterviewEndsAt(startedAt, preset.durationMinutes);
    if (!expiresAt) {
      setToast("The mock timer could not start");
      return;
    }
    const entries: SessionQueueEntry[] = candidates.map((candidate) => ({
      itemId: candidate.itemId,
      itemRevision: candidate.contentRevision,
      stage: 5,
      status: "pending",
      practiceKind: "solving",
      estimatedMinutes: Math.max(
        1,
        Math.round(preset.durationMinutes / problemCount),
      ),
      rationale: "Cold verified solve · guidance stays hidden until the mock ends.",
    }));
    const mockProblems = candidates.map((candidate) =>
      createMockProblemWorkspace(
        {
          itemId: candidate.itemId,
          itemRevision: candidate.contentRevision,
          source: candidate.starterCode ?? "",
        },
        { maxElapsedMs: preset.durationMinutes * 60_000 },
      ),
    );
    const session: TrainingSession = {
      id: makeId(),
      name: preset.label,
      kind: "mock",
      source: "mixed",
      track: "interview",
      language: "python",
      stageMode: "recall",
      createdAt: startedAt,
      entries,
      currentIndex: 0,
      mockPreset: preset.id,
      problemCount,
      durationMinutes: preset.durationMinutes,
      expiresAt,
      mockProblems,
    };
    mutateState((current) => {
      const base = recordAbandon(current);
      const previous = base.activeSession;
      return {
        ...base,
        activeSession: session,
        interviewStudio: archiveActiveInterviewStudio(
          base.interviewStudio,
          startedAt,
          "ended",
        ),
        sessionHistory: previous
          ? [
              ...base.sessionHistory,
              sessionHistoryRecord(previous, previous.entries, "ended"),
            ].slice(-25)
          : base.sessionHistory,
        runManifests: previous
          ? finishLinkedRunManifest(
              base.runManifests,
              { kind: "session", id: previous.id },
              "ended",
              startedAt,
            )
          : base.runManifests,
        draft: null,
      };
    });
    openItem(candidates[0], 5, undefined, session.id, "solving");
    setToast(
      `${preset.durationMinutes}-minute mock started · ${problemCount} problem${problemCount === 1 ? "" : "s"} · guidance locked`,
    );
  }

  function startInterviewStudio(
    format: InterviewStudioFormat,
    mode: InterviewStudioMode,
    durationMinutes: 30 | 45 | 60,
    studyPlanId?: string,
  ) {
    if (
      (state.activeSession || state.interviewStudio.active) &&
      !window.confirm(
        "Replace the active practice with this Interview Studio screen? Existing completed work and interview evidence will stay in history.",
      )
    ) {
      return;
    }
    const startedAt = new Date().toISOString();
    const selected =
      format === "python-coding"
        ? selectMockInterviewItems(
            curriculumItems,
            state.attempts,
            durationMinutes === 30
              ? "screen"
              : durationMinutes === 60
                ? "stretch"
                : "standard",
            1,
          )[0]
        : allItems
            .filter(
              (candidate) =>
                candidate.source === "builtin" &&
                candidate.track === "ios" &&
                supportsConceptPractice(candidate),
            )
            .map((candidate) => ({
              candidate,
              attempts: state.attempts.filter(
                (attempt) =>
                  attempt.itemId === candidate.itemId &&
                  attempt.itemRevision === candidate.contentRevision &&
                  attempt.practiceKind === "concept",
              ).length,
            }))
            .sort(
              (left, right) =>
                left.attempts - right.attempts ||
                left.candidate.itemId.localeCompare(right.candidate.itemId),
            )[0]?.candidate;
    if (!selected) {
      setToast(
        format === "python-coding"
          ? "No verified Python problem matches this interview length"
          : "No authored Swift/iOS screen is available",
      );
      return;
    }
    const sessionId = makeId();
    const studio = createInterviewStudioSession({
      id: sessionId,
      format,
      mode,
      itemId: selected.itemId,
      itemRevision: selected.contentRevision,
      startedAt,
      script:
        format === "python-coding"
          ? pythonInterviewScript(selected)
          : iosTechnicalScreenScript(selected),
    });

    if (format === "python-coding") {
      const expiresAt = mockInterviewEndsAt(startedAt, durationMinutes);
      if (!expiresAt) {
        setToast("The interview timer could not start");
        return;
      }
      const entry: SessionQueueEntry = {
        itemId: selected.itemId,
        itemRevision: selected.contentRevision,
        stage: 5,
        status: "pending",
        practiceKind: "solving",
        estimatedMinutes: durationMinutes,
        rationale:
          "Scripted interview · transcript and observable runner evidence are saved locally.",
      };
      const session: TrainingSession = {
        id: sessionId,
        name: `${mode === "mock" ? "Interview" : "Coached interview"} · ${selected.title}`,
        kind: "mock",
        source: "mixed",
        track: "interview",
        language: "python",
        stageMode: "recall",
        createdAt: startedAt,
        entries: [entry],
        currentIndex: 0,
        mockPreset:
          durationMinutes === 30
            ? "screen"
            : durationMinutes === 60
              ? "stretch"
              : "standard",
        problemCount: 1,
        durationMinutes,
        expiresAt,
        mockProblems: [
          createMockProblemWorkspace(
            {
              itemId: selected.itemId,
              itemRevision: selected.contentRevision,
              source: selected.starterCode ?? "",
            },
            { maxElapsedMs: durationMinutes * 60_000 },
          ),
        ],
        studyPlanId,
        studyCollectionIds: studyPlanId
          ? state.studyWorkspace.plans.find((plan) => plan.id === studyPlanId)
              ?.collectionIds
          : undefined,
      };
      mutateState((current) => {
        const base = recordAbandon(current);
        const previous = base.activeSession;
        return {
          ...base,
          activeSession: session,
          studyWorkspace: linkPlanSession(
            base.studyWorkspace,
            studyPlanId,
            sessionId,
            "studio",
            startedAt,
          ),
          sessionHistory: previous
            ? [
                ...base.sessionHistory,
                sessionHistoryRecord(previous, previous.entries, "ended"),
              ].slice(-25)
            : base.sessionHistory,
          runManifests: previous
            ? finishLinkedRunManifest(
                base.runManifests,
                { kind: "session", id: previous.id },
                "ended",
                startedAt,
              )
            : base.runManifests,
          interviewStudio: replaceActiveInterviewStudio(
            base.interviewStudio,
            studio,
            startedAt,
          ),
          draft: null,
        };
      });
      openItem(selected, 5, undefined, sessionId, "solving");
      setToast(
        `${durationMinutes}-minute ${mode === "mock" ? "interview" : "coached interview"} started · transcript is local`,
      );
      return;
    }

    mutateState((current) => {
      const base = recordAbandon(current);
      const previous = base.activeSession;
      return {
        ...base,
        activeSession: null,
        studyWorkspace: linkPlanSession(
          base.studyWorkspace,
          studyPlanId,
          sessionId,
          "studio",
          startedAt,
        ),
        sessionHistory: previous
          ? [
              ...base.sessionHistory,
              sessionHistoryRecord(previous, previous.entries, "ended"),
            ].slice(-25)
          : base.sessionHistory,
        runManifests: previous
          ? finishLinkedRunManifest(
              base.runManifests,
              { kind: "session", id: previous.id },
              "ended",
              startedAt,
            )
          : base.runManifests,
        interviewStudio: replaceActiveInterviewStudio(
          base.interviewStudio,
          studio,
          startedAt,
        ),
        draft: null,
      };
    });
    navigateView("sessions");
    setToast(
      `${mode === "mock" ? "Swift/iOS screen" : "Coached Swift/iOS screen"} started · no compiler or automatic scoring`,
    );
  }

  function updateActiveInterviewStudio(
    updater: (session: InterviewStudioSession) => InterviewStudioSession,
  ) {
    mutateState((current) => {
      if (!current.interviewStudio.active) return current;
      try {
        return {
          ...current,
          interviewStudio: {
            ...current.interviewStudio,
            active: updater(current.interviewStudio.active),
          },
        };
      } catch (error) {
        setToast(
          error instanceof Error
            ? error.message
            : "That interview step could not be recorded",
        );
        return current;
      }
    });
  }

  function commitActiveInterviewResponse(text: string) {
    const at = new Date().toISOString();
    updateActiveInterviewStudio((session) =>
      advanceInterviewPhase(
        commitInterviewResponse(session, { text, at }),
        { at },
      ),
    );
  }

  function advanceActiveInterview() {
    const at = new Date().toISOString();
    updateActiveInterviewStudio((session) =>
      advanceInterviewPhase(session, { at }),
    );
  }

  function requestActiveInterviewHint() {
    const at = new Date().toISOString();
    updateActiveInterviewStudio((session) =>
      requestInterviewCoachHint(session, { at }),
    );
  }

  function recordActiveInterviewRunnerEvidence(
    expectedSessionId: string,
    status: InterviewRunnerEventStatus,
    source: string,
    passed: number,
    total: number,
  ) {
    const at = new Date().toISOString();
    mutateState((current) => {
      const active = current.interviewStudio.active;
      if (
        !active ||
        active.id !== expectedSessionId ||
        active.format !== "python-coding"
      ) {
        return current;
      }
      try {
        return {
          ...current,
          interviewStudio: {
            ...current.interviewStudio,
            active: recordInterviewRunnerEventForSession(
              active,
              expectedSessionId,
              {
                status,
                source,
                passed,
                total,
                at,
              },
            ),
          },
        };
      } catch (error) {
        setToast(
          error instanceof Error
            ? error.message
            : "That runner evidence could not be recorded",
        );
        return current;
      }
    });
  }

  function finishActiveInterview() {
    const current = stateRef.current;
    const active = current.interviewStudio.active;
    if (!active || active.phase !== "completed") {
      setToast("Complete every interview step before finishing");
      return;
    }
    const completedAt = new Date().toISOString();
    if (active.format === "ios-technical") {
      mutateState((latest) => ({
        ...latest,
        interviewStudio: archiveActiveInterviewStudio(
          latest.interviewStudio,
          completedAt,
          "completed",
          active.id,
        ),
      }));
      setToast(
        "Technical screen archived · authored criteria are available in history",
      );
      return;
    }
    const liveDraft = current.draft;
    const accepted = settledSubmissionRecords(current.submissionLog)
      .slice()
      .reverse()
      .find(
        (submission) =>
          submission.sessionId === active.id &&
          submission.status === "accepted" &&
          submission.itemId === active.itemId &&
          submission.itemRevision === active.itemRevision,
      );
    if (
      !accepted ||
      !liveDraft ||
      liveDraft.sessionId !== active.id ||
      liveDraft.value !== accepted.source
    ) {
      setToast("Submit the current source successfully before finishing");
      return;
    }
    mutateState((latest) => ({
      ...latest,
      interviewStudio: archiveActiveInterviewStudio(
        latest.interviewStudio,
        completedAt,
        "completed",
        active.id,
      ),
    }));
    finish(liveDraft, {
      revision: accepted.verificationRevision,
      passed: accepted.passed,
      total: accepted.total,
      runs: Math.max(1, liveDraft.testRuns),
      submissions: Math.max(1, liveDraft.submissions),
    }, accepted.id);
  }

  function expireMockInterview(sessionId: string) {
    const session = state.activeSession;
    if (!session || session.id !== sessionId || session.kind !== "mock") return;
    const expiredAt = new Date().toISOString();
    mutateState((current) => {
      const active = current.activeSession;
      if (!active || active.id !== sessionId || active.kind !== "mock")
        return current;
      const base =
        current.draft?.sessionId === sessionId
          ? recordAbandon(current)
          : current;
      const archived =
        base.activeSession?.id === sessionId && base.activeSession.kind === "mock"
          ? base.activeSession
          : active;
      return {
        ...base,
        draft: null,
        activeSession: null,
        interviewStudio: archiveActiveInterviewStudio(
          base.interviewStudio,
          expiredAt,
          "expired",
          sessionId,
        ),
        sessionHistory: [
          ...base.sessionHistory,
          sessionHistoryRecord(archived, archived.entries, "expired", expiredAt),
        ].slice(-25),
        runManifests: finishLinkedRunManifest(
          base.runManifests,
          { kind: "session", id: sessionId },
          "ended",
          expiredAt,
        ),
      };
    });
    setResult(null);
    setMockReviewSessionId(sessionId);
    setFocusMode(false);
    navigateView("sessions");
    setToast("Time is up · the mock workspace is now locked");
  }

  function resumeSession() {
    const session = state.activeSession;
    if (!session) return;
    const entry = session.entries[session.currentIndex];
    const next = allItems.find(
      (candidate) => candidate.itemId === entry?.itemId,
    );
    if (entry && next)
      openItem(
        next,
        entry.stage,
        undefined,
        session.id,
        entry.practiceKind ?? "typing",
      );
  }

  function skipSessionEntry() {
    const session = state.activeSession;
    if (!session) return;
    if (session.kind === "mock") {
      setToast("Mock problems cannot be skipped during an active interview");
      return;
    }
    const entries = session.entries.map((entry, index) =>
      index === session.currentIndex
        ? { ...entry, status: "skipped" as const }
        : entry,
    );
    const nextIndex = entries.findIndex(
      (entry, index) =>
        index > session.currentIndex && entry.status === "pending",
    );
    if (nextIndex < 0) {
      const endedAt = new Date().toISOString();
      mutateState((current) => {
        const base =
          current.draft?.sessionId === session.id
            ? recordAbandon(current)
            : current;
        const archivedSession =
          base.activeSession?.id === session.id ? base.activeSession : session;
        const archivedEntries = archivedSession.entries.map((entry, index) =>
          index === archivedSession.currentIndex
            ? { ...entry, status: "skipped" as const }
            : entry,
        );
        return {
          ...base,
          activeSession: null,
          sessionHistory: [
            ...base.sessionHistory,
            sessionHistoryRecord(
              archivedSession,
              archivedEntries,
              "ended",
              endedAt,
            ),
          ].slice(-25),
          runManifests: finishLinkedRunManifest(
            base.runManifests,
            { kind: "session", id: archivedSession.id },
            "ended",
            endedAt,
          ),
        };
      });
      setResult(null);
      navigateView("sessions");
      setToast("Session finished");
      return;
    }
    mutateState((current) => {
      const base =
        current.draft?.sessionId === session.id
          ? recordAbandon(current)
          : current;
      const activeSession =
        base.activeSession?.id === session.id ? base.activeSession : session;
      return {
        ...base,
        activeSession: {
          ...activeSession,
          entries: activeSession.entries.map((entry, index) =>
            index === activeSession.currentIndex
              ? { ...entry, status: "skipped" as const }
              : entry,
          ),
          currentIndex: nextIndex,
        },
      };
    });
    const next = allItems.find(
      (candidate) => candidate.itemId === entries[nextIndex].itemId,
    );
    if (next)
      openItem(
        next,
        entries[nextIndex].stage,
        undefined,
        session.id,
        entries[nextIndex].practiceKind ?? "typing",
      );
  }

  function endSession() {
    const session = state.activeSession;
    if (
      !session ||
      !window.confirm(
        session.kind === "mock"
          ? "End this timed mock? Your current code will be saved as an incomplete attempt for review."
          : "End this session? Completed entries stay recorded.",
      )
    )
      return;
    const endedAt = new Date().toISOString();
    mutateState((current) => {
      const base =
        current.draft?.sessionId === session.id
          ? recordAbandon(current)
          : current;
      const archived =
        base.activeSession?.id === session.id ? base.activeSession : session;
      return {
        ...base,
        activeSession: null,
        interviewStudio: archiveActiveInterviewStudio(
          base.interviewStudio,
          endedAt,
          "ended",
          session.id,
        ),
        sessionHistory: [
          ...base.sessionHistory,
          sessionHistoryRecord(archived, archived.entries, "ended", endedAt),
        ].slice(-25),
        runManifests: finishLinkedRunManifest(
          base.runManifests,
          { kind: "session", id: archived.id },
          "ended",
          endedAt,
        ),
      };
    });
    setResult(null);
    if (session.kind === "mock") setMockReviewSessionId(session.id);
    navigateView("sessions");
    setFocusMode(false);
    setToast(session.kind === "mock" ? "Mock ended · review saved" : "Session ended");
  }

  function saveCustom(input: Parameters<typeof makeCustomItem>[0]) {
    if (customEditor && customEditor !== "new") {
      const updated = updateCustomItem(customEditor, input);
      const codeChanged =
        updated.contentRevision !== customEditor.contentRevision;
      const activeDraft =
        state.draft?.itemId === customEditor.itemId &&
        Boolean(state.draft.startedAt || state.draft.value);
      const queuedInTrackSession =
        ((updated.track !== customEditor.track &&
          state.activeSession?.track !== "all") ||
          (updated.language !== customEditor.language &&
            state.activeSession?.language !== "all")) &&
        state.activeSession?.entries.some(
          (entry) =>
            entry.itemId === customEditor.itemId && entry.status === "pending",
        );
      if (queuedInTrackSession) {
        setToast(
          "End the active track-specific session before moving this snippet",
        );
        return;
      }
      if (
        codeChanged &&
        activeDraft &&
        !window.confirm(
          "The practice content changed. Save this revision and close the current draft? The old draft will be kept as an abandoned attempt.",
        )
      )
        return;
      try {
        commitStateImmediately((current) => {
          const base =
            codeChanged && current.draft?.itemId === customEditor.itemId
              ? recordAbandon(current)
              : current;
          const activeSession = base.activeSession
            ? {
                ...base.activeSession,
                entries: base.activeSession.entries.map((entry) =>
                  entry.itemId === updated.itemId && entry.status === "pending"
                    ? { ...entry, itemRevision: updated.contentRevision }
                    : entry,
                ),
              }
            : null;
          const customTestcases = { ...base.customTestcases };
          const customCaseInputs = { ...base.customCaseInputs };
          if (codeChanged) {
            delete customTestcases[updated.itemId];
            delete customCaseInputs[updated.itemId];
          }
          return {
            ...base,
            customItems: base.customItems.map((item) =>
              item.itemId === updated.itemId ? updated : item,
            ),
            draft:
              codeChanged && base.draft?.itemId === updated.itemId
                ? null
                : base.draft,
            activeSession,
            customTestcases,
            customCaseInputs,
          };
        }, { requirePersistence: true });
      } catch (error) {
        setToast(
          error instanceof Error
            ? error.message
            : "This practice item could not be saved locally",
        );
        return;
      }
      setCustomEditor(null);
      setResult(null);
      setReveal(false);
      if (codeChanged) setStage(1);
      setToast(
        codeChanged
          ? "Practice item updated · mastery restarted for revision"
          : "Practice item details updated",
      );
      return;
    }
    const custom = makeCustomItem(input);
    try {
      commitStateImmediately(
        (current) => ({
          ...current,
          customItems: [...current.customItems, custom],
          lastItemId: custom.itemId,
        }),
        { requirePersistence: true },
      );
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "This practice item could not be saved locally",
      );
      return;
    }
    setCustomEditor(null);
    setToast(
      custom.verification
        ? "Runnable challenge saved on this device"
        : "Custom snippet saved on this device",
    );
    openItem(
      custom,
      custom.verification ? 5 : 1,
      undefined,
      undefined,
      custom.verification ? "solving" : undefined,
    );
  }

  function archiveCustom(itemId: ItemId) {
    if (
      !window.confirm(
        "Archive this custom practice item? Its attempt and submission history will stay in Records.",
      )
    )
      return;
    mutateState((current) => {
      const base =
        current.draft?.itemId === itemId ? recordAbandon(current) : current;
      let activeSession = base.activeSession;
      let sessionHistory = base.sessionHistory;
      if (
        activeSession?.entries.some(
          (entry) => entry.itemId === itemId && entry.status === "pending",
        )
      ) {
        const entries = activeSession.entries.map((entry) =>
          entry.itemId === itemId && entry.status === "pending"
            ? { ...entry, status: "skipped" as const }
            : entry,
        );
        const nextIndex = entries.findIndex(
          (entry) => entry.status === "pending",
        );
        if (nextIndex >= 0)
          activeSession = {
            ...activeSession,
            entries,
            currentIndex: nextIndex,
          };
        else {
          sessionHistory = [
            ...sessionHistory,
            sessionHistoryRecord(activeSession, entries, "ended"),
          ].slice(-25);
          activeSession = null;
        }
      }
      return {
        ...base,
        customItems: base.customItems.map((custom) =>
          custom.itemId === itemId
            ? { ...custom, archivedAt: new Date().toISOString() }
            : custom,
        ),
        favorites: base.favorites.filter((id) => id !== itemId),
        lastItemId:
          base.lastItemId === itemId
            ? BUILTIN_ITEMS[0].itemId
            : base.lastItemId,
        activeSession,
        sessionHistory,
      };
    });
    if (selectedId === itemId) {
      setSelectedId(BUILTIN_ITEMS[0].itemId);
      setStage(1);
      setReveal(false);
      setResult(null);
    }
    setToast("Snippet archived");
  }

  function exportProgress() {
    const portableState = {
      ...state,
      cloud: { communityEnabled: false, uploadedAttemptIds: [] },
    };
    const blob = new Blob(
      [JSON.stringify(createBackupEnvelope(portableState), null, 2)],
      { type: "application/json" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `swift-ghost-progress-${dayKey(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setToast("Progress exported · Fluency Clinic and spaced evidence included");
  }

  async function importProgress(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("backup too large");
      const parsed = JSON.parse(await file.text()) as unknown;
      const backup = readBackupPayload(parsed, SUPPORTED_STATE_VERSIONS);
      if (!backup) throw new Error("invalid");
      const normalized = normalizeState(backup.payload);
      const inventory = backupInventory(normalized);
      const activeScope = persistenceScopeRef.current;
      if (!activeScope) throw new Error("profile unavailable");
      const profileLabel =
        activeScope === GUEST_PERSISTENCE_SCOPE
          ? "this browser's guest profile"
          : `${cloud.session?.user?.displayName ?? "your signed-in"} account profile`;
      const exportedLabel = backup.exportedAt
        ? ` from ${new Date(backup.exportedAt).toLocaleDateString()}`
        : "";
      if (
        !window.confirm(
          `Replace ${profileLabel} with this backup${exportedLabel}?\n\nIt contains ${inventory.attempts} attempts, ${inventory.submissions} submissions, ${inventory.attemptClosures} attempt closures, ${inventory.fluencyClinicCases} Fluency Clinic cases, ${inventory.challengeSets} Challenge Sets, ${inventory.sessions} sessions, ${inventory.customItems} custom items, ${inventory.typingProgressRecords} typing progress records, ${inventory.plans} study plans, ${inventory.testDesignAttempts} Test Design attempts, ${inventory.testDesignDrafts} Test Design drafts, ${inventory.activeTestDesignSprints} active Test Design lab, ${inventory.conceptTransferAttempts} Cold Reconstruction attempts, ${inventory.conceptTransferDrafts} Cold Reconstruction drafts, and ${inventory.activeConceptTransferAttempts} active Cold Reconstruction attempt. Community sharing stays off. Hosted Study Plans are preserved and merged after import.`,
        )
      ) {
        event.target.value = "";
        return;
      }
      const restored: AppState = {
        ...normalized,
        studyWorkspace:
          activeScope === GUEST_PERSISTENCE_SCOPE
            ? normalized.studyWorkspace
            : mergeStudyWorkspaces(
                normalized.studyWorkspace,
                stateRef.current.studyWorkspace,
                { now: new Date().toISOString() },
              ),
        cloud: { communityEnabled: false, uploadedAttemptIds: [] },
      };
      const restoredItem = [
        ...BUILTIN_ITEMS,
        ...restored.customItems.filter((candidate) => !candidate.archivedAt),
      ].find((candidate) => candidate.itemId === restored.lastItemId);
      const restoredPracticeKind = restoredItem
        ? coercePracticeKind(
            restoredItem,
            restored.draft?.itemId === restoredItem.itemId
              ? restored.draft.practiceKind
              : "typing",
          )
        : "typing";
      invalidateCloudWork();
      if (!saveStateForScope(restored, activeScope))
        throw new Error("storage unavailable");
      clearStateFallbacksForScope(activeScope);
      stateRef.current = restored;
      setState(restored);
      setSelectedId(restoredItem?.itemId ?? BUILTIN_ITEMS[0].itemId);
      setStage(restoredPracticeKind === "solving" ? 5 : restored.lastStage);
      setPracticeKind(restoredPracticeKind);
      setPracticeEpoch((current) => current + 1);
      setReveal(false);
      setResult(null);
      setToast("Backup restored · community sharing remains off");
    } catch {
      setToast("That backup could not be read");
    }
    event.target.value = "";
  }

  function resetAllData() {
    const activeScope = persistenceScopeRef.current;
    if (!activeScope) {
      setToast("Your profile is still loading");
      return;
    }
    const profileLabel =
      activeScope === GUEST_PERSISTENCE_SCOPE
        ? "this browser's guest profile"
        : `${cloud.session?.user?.displayName ?? "your signed-in"} account profile on this browser`;
    if (
      !window.confirm(
        `Clear ${profileLabel}?\n\nThis removes browser-only code, attempts, sessions, notes, custom items, and settings for this profile. Hosted Study Plans stay intact and will return after sync.`,
      )
    )
      return;
    invalidateCloudWork();
    if (!saveStateForScope(EMPTY_STATE, activeScope)) {
      setToast("Local storage is unavailable · data was not cleared");
      return;
    }
    clearStateFallbacksForScope(activeScope);
    stateRef.current = EMPTY_STATE;
    setState(EMPTY_STATE);
    setSelectedId(BUILTIN_ITEMS[0].itemId);
    setStage(1);
    setPracticeKind("typing");
    setPracticeEpoch((current) => current + 1);
    setToast("Browser data cleared · hosted Study Plans preserved");
  }

  function copyGuestDataToAccount() {
    const activeScope = persistenceScopeRef.current;
    const userId = cloud.session?.user?.id;
    if (
      !activeScope ||
      activeScope === GUEST_PERSISTENCE_SCOPE ||
      !scopeMatchesAuthenticatedUser(activeScope, userId)
    )
      return;
    const guestState = loadStateForScope(GUEST_PERSISTENCE_SCOPE);
    if (!hasMeaningfulBackupState(guestState)) {
      setGuestDataAvailable(false);
      setToast("No guest progress is available to copy");
      return;
    }
    const inventory = backupInventory(guestState);
    if (
      !window.confirm(
        `Copy guest progress into ${cloud.session?.user?.displayName ?? "this account"}?\n\nThis replaces browser-only account data with ${inventory.attempts} attempts, ${inventory.attemptClosures} attempt closures, ${inventory.fluencyClinicCases} Fluency Clinic cases, ${inventory.challengeSets} Challenge Sets, ${inventory.sessions} sessions, ${inventory.customItems} custom items, ${inventory.typingProgressRecords} typing progress records, ${inventory.testDesignAttempts} Test Design attempts, ${inventory.testDesignDrafts} Test Design drafts, ${inventory.activeTestDesignSprints} active Test Design lab, ${inventory.conceptTransferAttempts} Cold Reconstruction attempts, ${inventory.conceptTransferDrafts} Cold Reconstruction drafts, and ${inventory.activeConceptTransferAttempts} active Cold Reconstruction attempt. Account Study Plans are merged, community sharing stays off, and the guest copy remains available.`,
      )
    )
      return;
    const restored: AppState = {
      ...guestState,
      studyWorkspace: mergeStudyWorkspaces(
        guestState.studyWorkspace,
        stateRef.current.studyWorkspace,
        { now: new Date().toISOString() },
      ),
      cloud: { communityEnabled: false, uploadedAttemptIds: [] },
    };
    invalidateCloudWork();
    if (!saveStateForScope(restored, activeScope)) {
      setToast("Local storage is unavailable · guest data was not copied");
      return;
    }
    clearStateFallbacksForScope(activeScope);
    stateRef.current = restored;
    setState(restored);
    setSelectedId(restored.lastItemId ?? BUILTIN_ITEMS[0].itemId);
    setStage(restored.lastStage || 1);
    setPracticeKind("typing");
    setPracticeEpoch((current) => current + 1);
    setReveal(false);
    setResult(null);
    setToast("Guest progress copied · original guest profile kept");
  }

  function handleResultNext() {
    if (!result) return;
    if (result.sessionNext && state.activeSession) {
      const next = allItems.find(
        (candidate) => candidate.itemId === result.sessionNext?.itemId,
      );
      if (next) {
        openItem(
          next,
          result.sessionNext.stage,
          undefined,
          state.activeSession.id,
          result.sessionNext.practiceKind,
        );
        return;
      }
    }
    if (result.sessionComplete) {
      const completedSessionId = result.sessionId;
      setResult(null);
      if (completedSessionId && !result.mockInterview)
        openSessionRecap(completedSessionId);
      else navigateView("sessions");
      setToast(result.mockInterview ? "Mock verified and saved" : "Session complete");
      return;
    }
    if (result.practiceKind === "concept") {
      openItem(result.item, 5, undefined, undefined, "concept");
      return;
    }
    chooseStage(recommendedStage(stateRef.current, result.item));
  }

  function handleResultRetry() {
    if (!result) return;
    if (result.item.transfer) {
      if (stateRef.current.virtualRoundWorkspace.active) {
        setToast(
          "Finish or archive the active virtual round before reconstructing this variant",
        );
        return;
      }
      const transferItem = result.item;
      mutateState((current) => {
        const abandoned = recordAbandon(current);
        return {
          ...abandoned,
          draft: {
            ...freshDraft(
              transferItem.itemId,
              5,
              transferItem.contentRevision,
              undefined,
              undefined,
              "solving",
              transferItem.starterCode ?? "",
            ),
            peeks: 1,
          },
          lastItemId: transferItem.itemId,
          lastStage: 5,
        };
      });
      setSelectedId(transferItem.itemId);
      setStage(5);
      setPracticeKind("solving");
      setPracticeEpoch((current) => current + 1);
      setReveal(false);
      setResult(null);
      setView("practice");
      writeRoute(routeForItem(transferItem, 5, "solving"));
      setToast(
        "Reconstruction opened · this revealed retry is recorded as assisted",
      );
      return;
    }
    openItem(
      result.item,
      result.stage,
      result.challengeDate,
      undefined,
      result.practiceKind,
    );
  }

  function saveResultDebrief(input: DebriefInput) {
    if (!result) return;
    mutateState((current) => {
      const existing = current.learningEvents.find(
        (event) => event.attemptId === result.id,
      );
      const event: LearningEvent = {
        id: existing?.id ?? makeId(),
        attemptId: result.id,
        itemId: result.itemId,
        itemRevision: result.itemRevision,
        practiceKind: result.practiceKind,
        activityKind: activityKindFor({
          track: result.item.track,
          practiceKind: result.practiceKind,
        }),
        grade: input.grade,
        friction: input.friction,
        confidence: input.confidence,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        ...(input.promptSnapshot
          ? { promptSnapshot: input.promptSnapshot }
          : {}),
        ...(input.response ? { response: input.response } : {}),
      };
      return {
        ...current,
        learningEvents: upsertLearningEvent(current.learningEvents, event),
      };
    });
    setToast("Debrief saved for your next plan");
  }

  function updateMockHistoryDebrief(
    sessionId: string,
    debrief: MockDebrief,
  ) {
    let boundedDebrief: MockDebrief;
    try {
      boundedDebrief = createMockDebrief(debrief);
    } catch {
      setToast("Debrief limit reached · shorten this response to keep writing");
      return;
    }
    mutateState((current) => ({
      ...current,
      sessionHistory: current.sessionHistory.map((session) =>
        session.id === sessionId && session.kind === "mock"
          ? { ...session, debrief: boundedDebrief }
          : session,
      ),
    }));
  }

  function finishMockHistoryDebrief(
    sessionId: string,
    debrief: MockDebrief,
  ) {
    const completed = updateMockDebrief(debrief, {
      completedAt: new Date().toISOString(),
    });
    updateMockHistoryDebrief(sessionId, completed);
    setMockReviewSessionId(null);
    setToast("Mock debrief saved locally");
  }

  const mockReviewRecord = mockReviewSessionId
    ? state.sessionHistory.find(
        (session) =>
          session.id === mockReviewSessionId && session.kind === "mock",
      )
    : undefined;
  const mockReviewProblems = (mockReviewRecord?.problems ?? []).map(
    (workspace, index) => ({
      title: `Problem ${index + 1}: ${
        allItems.find((candidate) => candidate.itemId === workspace.itemId)
          ?.title ?? workspace.itemId
      }`,
      notebook: workspace.notebook,
      checkpoints: workspace.checkpoints,
      source: workspace.source,
    }),
  );
  const firstMockReviewProblem = mockReviewProblems[0];

  const expectedPersistenceScope = resolvePersistenceScope({
    status: cloud.status,
    authenticated: cloud.session?.authenticated,
    userId: cloud.session?.user?.id,
    currentScope: persistenceScope,
  });
  if (
    !ready ||
    (expectedPersistenceScope !== undefined &&
      persistenceScope !== expectedPersistenceScope)
  ) {
    return (
      <div className="app-shell" aria-busy="true">
        <header className="topbar">
          <span className="brand" aria-label="Swift Ghost">
            <span className="brand-mark" aria-hidden="true">
              S<span>G</span>
            </span>
            <span>
              <strong>Swift Ghost</strong>
              <small>loading your private practice profile</small>
            </span>
          </span>
        </header>
        <main id="main-content" className="page-container settings-page">
          <PageHeading
            eyebrow="One moment"
            title="Loading your practice profile."
            copy="Your browser data stays separated by signed-in account."
          />
        </main>
      </div>
    );
  }

  return (
    <div className={`app-shell ${focusMode ? "is-focus" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => navigateView("today")}
          aria-label="Swift Ghost home"
        >
          <span className="brand-mark" aria-hidden="true">
            S<span>G</span>
          </span>
          <span>
            <strong>Swift Ghost</strong>
            <small>type it · fade it · own it</small>
          </span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {NAV.map((nav) => (
            <button
              key={nav.id}
              className={view === nav.id ? "active" : ""}
              aria-current={view === nav.id ? "page" : undefined}
              onClick={() => navigateView(nav.id)}
            >
              <span aria-hidden="true">{nav.icon}</span>
              {nav.label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button
            className="goal-pill"
            onClick={() => navigateView("today")}
            title="Today's practice goal"
          >
            <span
              className="goal-ring"
              style={
                { "--goal": `${dailyPercent * 3.6}deg` } as React.CSSProperties
              }
            >
              {dailyPercent}%
            </span>
            <span>
              <strong>
                {todayMinutes}/{state.settings.dailyGoalMinutes} min
              </strong>
              <small>{activeStreak(state)} day streak</small>
            </span>
          </button>
          <button
            className="icon-button"
            onClick={() => randomItem()}
            title="Random problem"
            aria-label="Open a random problem"
          >
            ↝
          </button>
        </div>
      </header>

      {view === "today" && (
        <TodayView
          ready={ready}
          state={state}
          items={curriculumItems}
          cloudStatus={cloud.status}
          cloudDaily={cloud.dailyChallenge}
          attemptClosureModel={attemptClosureModel}
          fluencyClinic={fluencyClinicModel}
          weaknessCase={weaknessModel.nextCase}
          weaknessActiveCount={weaknessModel.summary.active}
          onOpen={openItem}
          onResumeDraft={resumeSavedDraft}
          onReview={() => randomItem("due")}
          onBrowse={() => navigateView("library")}
          onCreate={() => setCustomEditor("new")}
          onSessions={() => navigateView("sessions")}
          onPlans={() => navigateView("plans")}
          onAttemptClosure={openAttemptClosure}
          onFluencyClinic={openFluencyClinic}
          onWeakness={() =>
            updateWeaknessRoute({
              filter: "priority",
              lane: "all",
              caseId: weaknessModel.nextCase?.id,
            })
          }
          onAssess={() =>
            selectAssessment(state.assessments.activeRunId ?? "python-reentry")
          }
          onPatternReview={() => openPatternDecisionReview("today")}
          onTestDesign={(lane) => openTestDesignLab("today", lane)}
          onConceptTransfer={(lane) =>
            openConceptTransferLab("today", lane)
          }
          onStartCoach={(entries, budgetMinutes) =>
            startSession(
              {
                name: `Daily Coach · ${budgetMinutes} min`,
                count: entries.length,
                source: "mixed",
                track: "all",
                language: "all",
                pattern: "All",
                difficulty: "All",
                stageMode: "recommended",
              },
              entries,
            )
          }
          onResumeSession={resumeSession}
        />
      )}
      {view === "plans" && (
        <StudyPlans
          workspace={state.studyWorkspace}
          items={curriculumItems}
          attempts={state.attempts}
          learningEvents={state.learningEvents}
          typingProgress={state.typingProgress}
          interviewStudioHistory={state.interviewStudio.history}
          sessionHistory={state.sessionHistory}
          activeSession={state.activeSession}
          syncStatus={studySyncStatus}
          onInstantiateTemplate={instantiateStudyTemplate}
          onCreateCollection={addStudyCollection}
          onUpdateCollection={editStudyCollection}
          onDeleteCollection={removeStudyCollection}
          onCreatePlan={addStudyPlan}
          onUpdatePlan={editStudyPlan}
          onDeletePlan={removeStudyPlan}
          onActivatePlan={makeStudyPlanActive}
          onPausePlan={pauseActiveStudyPlan}
          onStartFocusBlock={startStudyFocusBlock}
          onResumeActiveSession={resumeSession}
          onStartCapstone={startStudyCapstone}
        />
      )}
      {view === "learn" && patternReviewMode === "mixed" && (
        <PatternDecisionReview
          lessons={PATTERN_LESSONS}
          probes={PATTERN_DECISION_PROBES}
          items={BUILTIN_ITEMS}
          workspace={state.patternLearning}
          draftBoundary={`${persistenceScope ?? "loading"}:${practiceEpoch}`}
          routedSprintId={patternSprintId}
          onStartSprint={openPatternDecisionReview}
          onCommit={commitAcademyDecision}
          onReveal={revealAcademyDecision}
          onGrade={gradeAcademyDecision}
          onExit={() => openPatternLesson()}
          onOpenLesson={(lesson) =>
            openPatternLesson(lesson.slug, "recognize")
          }
          onStartSolve={startDecisionSolve}
        />
      )}
      {view === "learn" && patternReviewMode === "tests" && (
        <TestDesignLab
          probes={TEST_DESIGN_PROBES}
          items={BUILTIN_ITEMS}
          workspace={state.testDesign}
          selectedLane={testDesignLane}
          entrySource={testDesignSource}
          routedSprintId={testDesignSprintId}
          selectedAttemptId={testDesignAttemptId}
          onStartSprint={startTestDesignLab}
          onSaveDraft={saveTestDraft}
          onCommit={commitTestDesign}
          onReveal={revealTestDesign}
          onGrade={gradeTestDesign}
          onExit={() =>
            testDesignAttemptId
              ? updateWeaknessRoute({
                  filter: weaknessFilter,
                  lane: weaknessLane,
                  caseId: weaknessCaseId,
                })
              : exitTestDesignLab()
          }
          onStartSolve={startTestDesignSolve}
        />
      )}
      {view === "learn" && patternReviewMode === "reconstruct" && (
        <ConceptTransferLab
          variants={CONCEPT_TRANSFER_VARIANTS}
          workspace={state.conceptTransfer}
          selectedLane={conceptTransferLane}
          routedVariantId={conceptTransferVariantId}
          entrySource={conceptTransferSource}
          onStart={startConceptTransferLab}
          onSaveDraft={saveConceptTransferDraft}
          onRevealHint={revealConceptTransferHintForAttempt}
          onCommit={commitConceptTransfer}
          onSaveDebrief={saveConceptTransferDebrief}
          onFinish={finishConceptTransfer}
          onExit={exitConceptTransferLab}
        />
      )}
      {view === "learn" && patternReviewMode === undefined && (
        <PatternAcademy
          lessons={PATTERN_LESSONS}
          decisionProbes={PATTERN_DECISION_PROBES}
          items={BUILTIN_ITEMS}
          attempts={state.attempts}
          workspace={state.patternLearning}
          now={now}
          draftBoundary={`${persistenceScope ?? "loading"}:${practiceEpoch}`}
          selectedPatternId={patternRouteId}
          lessonStep={patternLessonStep}
          onSelectPattern={openPatternLesson}
          onCommitResponse={commitAcademyResponse}
          onRevealAnswer={revealAcademyAnswer}
          onGradeCheck={gradeAcademyCheck}
          onStartPractice={startAcademyPractice}
          onBrowsePattern={browseAcademyPattern}
          onOpenTransferLab={openTransferLab}
          onOpenDecisionReview={() => openPatternDecisionReview("academy")}
          onOpenTestDesign={(lane) => openTestDesignLab("academy", lane)}
          testDesignSummaries={testDesignLaneSummaries}
          onOpenConceptTransfer={(lane) =>
            openConceptTransferLab("academy", lane)
          }
          conceptTransferSummaries={conceptTransferLaneSummaries}
        />
      )}
      {view === "improve" && (
        <WeaknessLab
          model={weaknessModel}
          filter={weaknessFilter}
          lane={weaknessLane}
          selectedCaseId={weaknessCaseId}
          onRouteChange={updateWeaknessRoute}
          onStartCase={startWeaknessCase}
          onOpenEvidence={openWeaknessEvidence}
          onBrowseCase={browseWeaknessCase}
          onOpenAssessment={() => selectAssessment("python-reentry")}
          onOpenTransferLab={openTransferLab}
          onOpenConceptTransfer={(lane) =>
            openConceptTransferLab("weakness", lane)
          }
        />
      )}
      {view === "practice" && (
        <PracticeView
          key={`${selectedId}:${item.contentRevision}:${stage}:${practiceKind}:${practiceEpoch}`}
          state={state}
          items={allItems}
          item={item}
          draft={draft}
          practiceKind={practiceKind}
          stage={stage}
          metrics={metrics}
          ghostCode={ghostCode}
          stats={stats}
          conceptCheckIndex={conceptCheckIndex}
          assessmentResponseMode={assessmentEntry?.responseMode}
          dueCount={dueItems.length}
          reveal={reveal}
          focusMode={focusMode}
          errorKeys={draft.keyErrors}
          now={now}
          activeSession={state.activeSession}
          virtualRound={state.virtualRoundWorkspace.active}
          interviewStudio={
            state.interviewStudio.active?.format === "python-coding" &&
            state.interviewStudio.active.id === state.activeSession?.id
              ? state.interviewStudio.active
              : null
          }
          onOpenItem={openItem}
          onChooseStage={chooseStage}
          onChoosePracticeKind={choosePracticeKind}
          onChange={handleValueChange}
          onKeyDown={handleKeyDown}
          onPaste={(event) => {
            if (practiceKind === "solving") return;
            event.preventDefault();
            const count = Math.max(
              1,
              event.clipboardData.getData("text").length,
            );
            updateDraft({
              ...draft,
              startedAt: draft.startedAt ?? Date.now(),
              totalKeystrokes: draft.totalKeystrokes + count,
              rejectedKeystrokes: draft.rejectedKeystrokes + count,
            });
            setToast("Pasting is disabled during a practice pass");
          }}
          onReset={resetAttempt}
          onTestRun={() =>
            updateDraft({
              ...draft,
              startedAt: draft.startedAt ?? Date.now(),
              testRuns: draft.testRuns + 1,
            })
          }
          onSubmissionRun={() =>
            updateDraft({
              ...draft,
              startedAt: draft.startedAt ?? Date.now(),
              testRuns: draft.testRuns + 1,
              submissions: draft.submissions + 1,
            })
          }
          onSubmissionRequested={requestLocalSubmission}
          onSubmissionSettled={recordSubmission}
          onVirtualRoundSubmissionRequested={requestActiveVirtualRoundSubmission}
          onVirtualRoundSubmissionSettled={settleActiveVirtualRoundSubmission}
          onVirtualRoundOpenProblem={openVirtualRoundItem}
          onVirtualRoundToggleFlag={flagVirtualRoundProblem}
          onVirtualRoundFinish={finishActiveVirtualRound}
          onRestoreSubmission={restoreSubmissionSource}
          onCustomCaseChange={updateCustomCaseInput}
          onCustomTestcasesChange={updateCustomTestcases}
          onUseHint={useSolveHint}
          onMockNotebookChange={updateActiveMockNotebook}
          onMockCheckpoint={recordActiveMockCheckpoint}
          onInterviewCommitResponse={commitActiveInterviewResponse}
          onInterviewAdvance={advanceActiveInterview}
          onInterviewHint={requestActiveInterviewHint}
          onInterviewRunnerEvidence={recordActiveInterviewRunnerEvidence}
          onFinishInterview={finishActiveInterview}
          onSolveComplete={finishSolve}
          onTrustedSolveComplete={finishTrustedSolve}
          onConceptChange={updateConceptResponse}
          onConceptReveal={revealConceptAnswer}
          onConceptComplete={finishConcept}
          onReveal={toggleReveal}
          onFavorite={() => toggleFavorite(selectedId)}
          onFocusMode={() => setFocusMode((value) => !value)}
          onReview={() => randomItem("due")}
          onBrowse={() => navigateView("library")}
          onRandom={() => randomItem()}
          onSession={() => {
            if (draft.virtualRoundId) {
              openVirtualRounds();
              return;
            }
            if (item.transfer) {
              openTransferLab();
              return;
            }
            if (draft.assessmentRunId) {
              selectAssessment(draft.assessmentRunId);
              return;
            }
            navigateView(state.activeSession?.studyPlanId ? "plans" : "sessions");
          }}
          onSkipSession={skipSessionEntry}
          onEndSession={endSession}
          trustedJudgeAvailable={cloud.capabilities?.trustedAssessments === true}
          trustedJudgeAuthenticated={cloud.session?.authenticated === true}
        />
      )}
      {view === "sessions" && (
        <SessionsView
          state={state}
          items={curriculumItems}
          selectedSessionId={selectedSessionId}
          onStart={startSession}
          onStartMock={startMockInterview}
          onStartInterview={startInterviewStudio}
          onInterviewCommitResponse={commitActiveInterviewResponse}
          onInterviewAdvance={advanceActiveInterview}
          onInterviewHint={requestActiveInterviewHint}
          onFinishInterview={finishActiveInterview}
          now={now}
          onResume={resumeSession}
          onSkip={skipSessionEntry}
          onEnd={endSession}
          onOpenMockDebrief={setMockReviewSessionId}
          onOpenSessionRecap={openSessionRecap}
          onCloseSessionRecap={closeSessionRecap}
          onReplaySession={replayPracticeSession}
          onOpenItem={(item, nextStage, nextPracticeKind) =>
            openItem(
              item,
              nextStage,
              undefined,
              undefined,
              nextPracticeKind,
            )
          }
        />
      )}
      {view === "assessments" && assessmentRouteId === "transfer-lab" && (
        <main
          id="main-content"
          tabIndex={-1}
          className="page-container assessments-page transfer-lab-page"
        >
          <TransferLab
            variants={transferVariants}
            recommendedVariantId={recommendedTransferItem?.itemId}
            totals={transferTotals}
            onStart={startTransferVariant}
            onReview={(variantId) => openTransferRecords(variantId)}
            onBack={() => selectAssessment(undefined)}
          />
        </main>
      )}
      {view === "assessments" && assessmentRouteId === "virtual-rounds" && (
        <VirtualRounds
          section={contestSection}
          selectedReportId={contestRoundId}
          presets={virtualRoundPresets}
          activeRound={activeVirtualRoundView}
          history={virtualRoundReports}
          standings={personalRoundStandings}
          summary={contestSummary}
          remainingMs={virtualRoundRemainingMs(
            state.virtualRoundWorkspace.active,
            now,
          )}
          onSectionChange={(section) => updateContestRoute(section)}
          onOpenReport={openVirtualRoundReport}
          onStart={startVirtualRoundPreset}
          onResume={resumeVirtualRound}
          onOpenProblem={openVirtualRoundItem}
          onToggleFlag={flagVirtualRoundProblem}
          onFinish={finishActiveVirtualRound}
          onArchive={archiveVirtualRoundReport}
          onRetryProblem={retryVirtualRoundProblem}
          onInspectSubmission={inspectVirtualRoundSubmission}
        />
      )}
      {view === "assessments" &&
        assessmentRouteId !== "transfer-lab" &&
        assessmentRouteId !== "virtual-rounds" && (
        <AssessmentCenter
          workspace={state.assessments}
          items={curriculumItems}
          transferSummary={{
            total: transferTotals.total,
            unseen: transferTotals.unseen,
            due: transferTotals.due,
            proven: transferTotals.proven,
          }}
          virtualRoundSummary={{
            eligible: virtualRoundEligibleItems.length,
            active: Boolean(state.virtualRoundWorkspace.active),
            finished: state.virtualRoundWorkspace.history.length,
          }}
          trustedAssessmentsAvailable={
            cloud.capabilities?.trustedAssessments === true
          }
          trustedAssessmentsAuthenticated={
            cloud.session?.authenticated === true
          }
          onTrustedReceipt={recordTrustedAssessmentReceipt}
          selectedAssessment={assessmentRouteId}
          activeDraft={state.draft}
          onSelect={selectAssessment}
          onStart={startAssessmentProgram}
          onResume={resumeAssessmentRun}
          onOpenProbe={openAssessmentProbe}
          onUseRefresher={useAssessmentRefresher}
          onSaveDebrief={saveAssessmentReflection}
          onFinish={finishAssessmentEarly}
          onCreatePlan={createPlanFromAssessment}
          onArchive={archiveAssessmentReport}
          onOpenTransferLab={openTransferLab}
          onOpenVirtualRounds={openVirtualRounds}
          onOpenPatternReview={() => openPatternDecisionReview("assessment")}
          onOpenTestDesign={(lane) => openTestDesignLab("assessment", lane)}
          onOpenConceptTransfer={(lane) =>
            openConceptTransferLab("assessment", lane)
          }
          patternDecisionSummary={derivePatternDecisionOverview(
            PATTERN_LESSONS,
            PATTERN_DECISION_PROBES,
            state.patternLearning,
            { now: new Date(now || Date.now()).toISOString() },
          )}
          testDesignSummaries={testDesignLaneSummaries}
          conceptTransferSummaries={conceptTransferLaneSummaries}
        />
      )}
      {view === "library" && (
        <CatalogLibrary
          state={state}
          items={curriculumItems}
          now={Math.floor(now / 60_000) * 60_000}
          query={catalogQuery}
          onQueryChange={updateCatalogRoute}
          onOpen={openItem}
          onFavorite={toggleFavorite}
          onCreateSnippet={() => setCustomEditor("new")}
          onEditSnippet={setCustomEditor}
          onArchiveSnippet={archiveCustom}
          onSaveView={saveCatalogSavedView}
          onUpdateView={updateCatalogSavedView}
          onDeleteView={deleteCatalogSavedView}
          onSaveProblemNote={persistProblemNote}
          onDeleteProblemNote={removeProblemNote}
          onAppendToCollection={appendCatalogSelectionToCollection}
          onCreateCollection={createCatalogSelectionCollection}
          onStartChallengeSet={startChallengeSet}
        />
      )}
      {view === "records" && (
        <RecordsView
          key={`${cloud.status}:${cloud.refresh}:${cloud.session?.user?.id ?? "guest"}:${cloud.session?.profile?.handle ?? "local"}:${cloud.session?.profile?.updatedAt ?? "new"}`}
          state={state}
          items={allItems}
          section={recordsSection}
          reviewAttemptId={reviewAttemptId}
          closureRouteId={closureRouteId}
          attemptClosureModel={attemptClosureModel}
          fluencyClinicRouteId={fluencyClinicRouteId}
          fluencyClinicModel={fluencyClinicModel}
          transferRecordVariantId={transferRecordVariantId}
          transferRecordAttemptId={transferRecordAttemptId}
          submissionQuery={submissionLogQuery}
          now={now}
          transferVariants={transferVariants}
          transferTotals={transferTotals}
          cloud={cloud}
          onOpen={openItem}
          onReview={() => randomItem("due")}
          onAssess={selectAssessment}
          onToggleUploads={toggleCommunityUploads}
          onCloudRefresh={() =>
            setCloud((current) => ({
              ...current,
              refresh: current.refresh + 1,
            }))
          }
          onSectionChange={(nextSection) =>
            updateRecordsRoute(nextSection, submissionLogQuery, "push")
          }
          onResumeChallengeSet={resumeChallengeSet}
          onOpenChallengeSetExecution={openChallengeSetExecution}
          onArchiveChallengeSet={archiveChallengeSet}
          onSelectAttemptClosure={openAttemptClosure}
          onSaveAttemptClosure={saveAttemptClosureDraft}
          onCompleteAttemptClosure={finishAttemptClosure}
          onRetryAttemptClosure={retryAttemptClosure}
          onSelectFluencyClinic={openFluencyClinic}
          onSaveFluencyClinicPass={saveFluencyClinicPass}
          onOpenFluencyReconstruction={startFluencyReconstruction}
          onOpenFluencyTransfer={startFluencyTransfer}
          onOpenWeakLineInFluencyClinic={openWeakLineInFluencyClinic}
          onSelectTransferRecord={openTransferRecords}
          onOpenTransferVariant={startTransferVariant}
          onSubmissionQueryChange={(nextQuery, history) =>
            updateRecordsRoute("submissions", nextQuery, history)
          }
          onSaveSubmissionAnnotation={saveSubmissionAnnotation}
          onOpenSubmissionClean={openSubmissionClean}
          onContinueFromSubmission={continueFromSubmission}
          onOpenSolutionReview={openSolutionReview}
          onSaveSolutionReview={saveSolutionReviewDraft}
          onCompleteSolutionReview={completeSolutionReview}
          onCloseSolutionReview={closeSolutionReview}
          onRetrySolutionReview={retryFromSolutionReview}
        />
      )}
      {view === "settings" && (
        <SettingsView
          state={state}
          profileLabel={
            persistenceScope === GUEST_PERSISTENCE_SCOPE
              ? "Guest profile on this browser"
              : `${cloud.session?.user?.displayName ?? "Signed-in"} account on this browser`
          }
          accountScoped={persistenceScope !== GUEST_PERSISTENCE_SCOPE}
          guestDataAvailable={guestDataAvailable}
          studySyncStatus={studySyncStatus}
          onUpdate={updateSettings}
          onExport={exportProgress}
          onImport={() => importRef.current?.click()}
          onReset={resetAllData}
          onCopyGuestData={copyGuestDataToAccount}
        />
      )}

      <input
        ref={importRef}
        className="visually-hidden"
        type="file"
        accept="application/json"
        onChange={importProgress}
      />
      {result && !result.mockInterview && (
        <ResultDialog
          key={result.id}
          result={result}
          onClose={() => setResult(null)}
          onNext={handleResultNext}
          onRetry={handleResultRetry}
          onRandom={() => randomItem()}
          onRecords={() =>
            result.item.transfer
              ? openTransferRecords(result.itemId, result.id)
              : navigateView("records")
          }
          onTransferLab={openTransferLab}
          onSolutionReview={() => openSolutionReview(result.id)}
          debrief={state.learningEvents.find(
            (event) => event.attemptId === result.id,
          )}
          onSaveDebrief={saveResultDebrief}
          cloud={cloud}
        />
      )}
      {mockReviewRecord && firstMockReviewProblem && (
        <MockDebriefDialog
          key={mockReviewRecord.id}
          outcome={mockReviewRecord.outcome ?? "ended"}
          startedAt={mockReviewRecord.startedAt}
          endedAt={mockReviewRecord.completedAt}
          durationMinutes={mockReviewRecord.durationMinutes ?? 45}
          notebook={firstMockReviewProblem.notebook}
          checkpoints={firstMockReviewProblem.checkpoints}
          problems={mockReviewProblems}
          value={mockReviewRecord.debrief ?? createMockDebrief()}
          title={`${mockReviewRecord.name} debrief`}
          onChange={(next) =>
            updateMockHistoryDebrief(mockReviewRecord.id, next)
          }
          onSave={(next) =>
            finishMockHistoryDebrief(mockReviewRecord.id, next)
          }
          onClose={() => setMockReviewSessionId(null)}
        />
      )}
      {customEditor && (
        <CustomChallengeDialog
          item={customEditor === "new" ? undefined : customEditor}
          onClose={() => setCustomEditor(null)}
          onSave={saveCustom}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function TodayView({
  ready,
  state,
  items,
  cloudStatus,
  cloudDaily,
  attemptClosureModel,
  fluencyClinic,
  weaknessCase,
  weaknessActiveCount,
  onOpen,
  onResumeDraft,
  onReview,
  onBrowse,
  onCreate,
  onSessions,
  onPlans,
  onAttemptClosure,
  onFluencyClinic,
  onWeakness,
  onAssess,
  onPatternReview,
  onTestDesign,
  onConceptTransfer,
  onStartCoach,
  onResumeSession,
}: {
  ready: boolean;
  state: AppState;
  items: PracticeItem[];
  cloudStatus: CloudRuntime["status"];
  cloudDaily: CloudDailyChallenge | null;
  attemptClosureModel: ReturnType<typeof deriveAttemptClosureModel>;
  fluencyClinic: ReturnType<typeof deriveFluencyClinicModel>;
  weaknessCase: WeaknessCase | null;
  weaknessActiveCount: number;
  onOpen: (
    item: PracticeItem,
    stage?: number,
    challengeDate?: string,
    sessionId?: string,
    practiceKind?: PracticeKind,
  ) => void;
  onResumeDraft: () => void;
  onReview: () => void;
  onBrowse: () => void;
  onCreate: () => void;
  onSessions: () => void;
  onPlans: () => void;
  onAttemptClosure: (closureId?: string) => void;
  onFluencyClinic: (caseId?: string) => void;
  onWeakness: () => void;
  onAssess: () => void;
  onPatternReview: () => void;
  onTestDesign: (lane: TestDesignLane) => void;
  onConceptTransfer: (lane: ConceptTransferLane) => void;
  onStartCoach: (
    entries: SessionQueueEntry[],
    budgetMinutes: number,
  ) => void;
  onResumeSession: () => void;
}) {
  const todayDate = ready ? new Date() : new Date(2000, 0, 1, 12);
  const today = cloudDaily?.date ?? dayKey(todayDate);
  const interviewItems = BUILTIN_ITEMS.filter(
    (item) =>
      !item.transfer &&
      item.track === "interview" &&
      item.difficulty !== "Hard",
  );
  const preferredInterviewItems = interviewItems.filter(
    (item) =>
      item.language === state.settings.preferredLanguage &&
      item.pattern !== "Python Fluency",
  );
  const iosItems = BUILTIN_ITEMS.filter((item) => item.track === "ios");
  const pythonFluency = BUILTIN_ITEMS.filter(
    (item) => item.language === "python" && item.pattern === "Python Fluency",
  );
  const remoteDaily = cloudDaily
    ? interviewItems.find(
        (item) =>
          item.itemId === cloudDaily.itemId &&
          item.contentRevision === cloudDaily.itemRevision,
      )
    : undefined;
  const daily =
    remoteDaily ??
    dailyItem(
      preferredInterviewItems.length ? preferredInterviewItems : interviewItems,
      todayDate,
    );
  // The hosted edition may expose cloud capabilities while the learner is
  // signed out. Keep the deterministic local fallback startable in that
  // state; a missing remote benchmark should not disable the core practice
  // loop.
  const dailyAvailable = Boolean(daily);
  const iosDaily = dailyItem(
    iosItems,
    new Date(todayDate.getTime() + 86400000),
  );
  const pythonDaily = dailyItem(
    pythonFluency,
    new Date(todayDate.getTime() + 43200000),
  );
  const due = items.filter((item) => isReviewDue(state, item.itemId));
  const dailyDone = state.attempts.some(
    (attempt) =>
      attempt.challengeDate === today &&
      attempt.itemId === daily?.itemId &&
      eligibleAttempt(attempt),
  );
  const draftItem = state.draft
    ? items.find((item) => item.itemId === state.draft?.itemId)
    : null;
  const minutes = practicedMinutesToday(state);
  const goal = state.settings.dailyGoalMinutes;
  const activePlan = state.studyWorkspace.plans.find(
    (plan) => plan.id === state.studyWorkspace.activePlanId && plan.status === "active",
  );
  const activeAssessment = state.assessments.runs.find(
    (run) => run.id === state.assessments.activeRunId,
  );
  const latestAssessment = state.assessments.runs.at(-1);
  const patternDecisionOverview = derivePatternDecisionOverview(
    PATTERN_LESSONS,
    PATTERN_DECISION_PROBES,
    state.patternLearning,
    { now: todayDate.toISOString() },
  );
  const testDesignLaneOverviews = Object.fromEntries(
    (["python", "swift", "ios"] as TestDesignLane[]).map((lane) => [
      lane,
      deriveTestDesignOverview(TEST_DESIGN_PROBES, state.testDesign, {
        lane,
        now: todayDate.toISOString(),
      }),
    ]),
  ) as Record<TestDesignLane, ReturnType<typeof deriveTestDesignOverview>>;
  const readyTestDesignCount = Object.values(testDesignLaneOverviews).reduce(
    (total, summary) => total + summary.readyCount,
    0,
  );
  const conceptTransferLaneOverviews = Object.fromEntries(
    (["swift", "ios"] as ConceptTransferLane[]).map((lane) => [
      lane,
      summarizeConceptTransferWorkspace(
        state.conceptTransfer,
        CONCEPT_TRANSFER_VARIANTS,
        { lane, now: todayDate.toISOString() },
      ),
    ]),
  ) as Record<
    ConceptTransferLane,
    ReturnType<typeof summarizeConceptTransferWorkspace>
  >;
  const readyConceptTransferCount = Object.values(
    conceptTransferLaneOverviews,
  ).reduce((total, summary) => total + summary.dueCount, 0);
  return (
    <main id="main-content" tabIndex={-1} className="page-container today-page">
      <PageHeading
        eyebrow={
          ready
            ? new Intl.DateTimeFormat(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(todayDate)
            : "Today"
        }
        title="Build recall, one clean pass at a time."
        copy="Reactivate Python for interviews, keep Swift and iOS sharp, and return to each solution on a spaced schedule."
      />
      {activePlan && (
        <section className="today-study-plan" aria-label="Active study plan">
          <div>
            <span className="eyebrow">Active study plan</span>
            <h2>{activePlan.title}</h2>
            <p>{activePlan.outcome}</p>
          </div>
          <button className="primary-button" onClick={onPlans}>
            Continue plan <span>→</span>
          </button>
        </section>
      )}
      {attemptClosureModel.summary.active > 0 && attemptClosureModel.next && (
        <section
          className="today-weakness today-attempt-closure"
          aria-label="Unclosed coding attempts"
        >
          <div>
            <span className="eyebrow">Attempt closure · evidence before retry</span>
            <h2>{attemptClosureModel.next.titleSnapshot}</h2>
            <p>
              {attemptClosureModel.summary.due > 0
                ? `${attemptClosureModel.summary.due} clean ${attemptClosureModel.summary.due === 1 ? "retry is" : "retries are"} due.`
                : attemptClosureModel.next.state === "draft"
                  ? `${attemptClosureModel.summary.drafts} failed or abandoned ${attemptClosureModel.summary.drafts === 1 ? "attempt needs" : "attempts need"} a short debrief. Capture the first wrong decision, verification plan, and teach-back before another clean solve.`
                  : "The closure is saved. Its clean retry stays gated until the next-day retrieval window."}
            </p>
          </div>
          <span className={`weakness-status is-${attemptClosureModel.next.status}`}>
            {attemptClosureModel.next.status === "due"
              ? "Retry due"
              : attemptClosureModel.next.state === "draft"
                ? "Closure open"
                : "Retry scheduled"}
          </span>
          <button
            className="primary-button"
            onClick={() => onAttemptClosure(attemptClosureModel.next?.id)}
          >
            {attemptClosureModel.next.state === "draft"
              ? "Close this attempt →"
              : "View retry schedule →"}
          </button>
          <small>
            Reflection schedules remediation; it never counts as a solved problem or mastery.
          </small>
        </section>
      )}
      {weaknessCase && (
        <section className="today-weakness" aria-label="Highest-priority remediation">
          <div className="today-weakness-rank" aria-hidden="true">01</div>
          <div>
            <span className="eyebrow">Weakness Lab · highest priority</span>
            <h2>{weaknessCase.title}</h2>
            <p>
              {weaknessCase.recurrence} signal{weaknessCase.recurrence === 1 ? "" : "s"} across {weaknessCase.sourceKinds.length} evidence source{weaknessCase.sourceKinds.length === 1 ? "" : "s"}. {weaknessCase.prompt}
            </p>
          </div>
          <span className={`weakness-status is-${weaknessCase.status}`}>
            {weaknessCase.status === "due" ? "Due now" : weaknessCase.status}
          </span>
          <button className="primary-button" onClick={onWeakness}>
            Open repair plan →
          </button>
          <small>{weaknessActiveCount} active remediation case{weaknessActiveCount === 1 ? "" : "s"}</small>
        </section>
      )}
      <section className="today-assessment" aria-label="Interview baseline">
        <div>
          <span className="eyebrow">
            {activeAssessment ? "Baseline in progress" : "New · Calibration center"}
          </span>
          <h2>
            {activeAssessment
              ? "Continue the next short checkpoint."
              : latestAssessment
                ? "Recheck what changed since your last baseline."
                : "Start with evidence before choosing a study queue."}
          </h2>
          <p>
            Separate Python fluency, algorithm selection, and Swift/iOS recall.
            No global score, no proctoring claim, and no penalty for needing a refresher.
          </p>
        </div>
        <button className="primary-button" onClick={onAssess}>
          {activeAssessment ? "Resume assessment" : "Open assessment center"} →
        </button>
      </section>
      <section className="today-pattern-review" aria-label="Pattern decision review">
        <div>
          <span className="eyebrow">Core Pattern Skill Check · 12-18 minutes</span>
          <h2>
            {patternDecisionOverview.readyCount
              ? `${patternDecisionOverview.readyCount} pattern ${patternDecisionOverview.readyCount === 1 ? "decision is" : "decisions are"} ready.`
              : "Map your recognition across all twelve core patterns."}
          </h2>
          <p>
            Classify four unlabeled prompts, state the invariant and expected
            complexity, then see one bounded confirmation after a miss.
            Recognition evidence remains separate from solve and transfer receipts.
          </p>
        </div>
        <div className="today-pattern-review-stats" aria-label="Pattern decision status">
          <span><strong>{patternDecisionOverview.newCount}</strong> new</span>
          <span><strong>{patternDecisionOverview.dueCount}</strong> due</span>
          <span><strong>{patternDecisionOverview.retainedCount}</strong> retained</span>
        </div>
        <button className="secondary-button" onClick={onPatternReview}>
          Open skill check →
        </button>
      </section>
      <section className="today-test-design" aria-label="Test design lab">
        <div>
          <span className="eyebrow">Counterexample Lab · Python, Swift, and iOS</span>
          <h2>{readyTestDesignCount ? `${readyTestDesignCount} test-design skill${readyTestDesignCount === 1 ? " is" : "s are"} ready.` : "Practice turning assumptions into tiny counterexamples."}</h2>
          <p>Commit a purpose, structured scenario, expected observation, and defect before seeing original reference cases. Novel cases are never auto-marked wrong.</p>
        </div>
        <div className="test-design-entry-lanes today-test-design-lanes" aria-label="Test design lanes">
          {(["python", "swift", "ios"] as TestDesignLane[]).map((lane) => {
            const summary = testDesignLaneOverviews[lane];
            return (
              <button key={lane} className="secondary-button" onClick={() => onTestDesign(lane)}>
                <strong>{lane === "ios" ? "iOS" : lane[0].toUpperCase() + lane.slice(1)}</strong>
                <span>{summary.newCount} new · {summary.dueCount} due · {summary.retainedCount}/{summary.totalSkills} retained</span>
              </button>
            );
          })}
        </div>
      </section>
      <section
        className="today-concept-transfer"
        aria-label="Cold reconstruction lab"
      >
        <div>
          <span className="eyebrow">Cold Reconstruction · Swift and iOS</span>
          <h2>
            {readyConceptTransferCount
              ? `${readyConceptTransferCount} reconstruction ${readyConceptTransferCount === 1 ? "is" : "are"} due.`
              : "Type one known boundary before seeing the answer."}
          </h2>
          <p>
            Commit a prediction, a small Swift fragment, and a tradeoff before
            the grey project-authored reference appears. It runs as a
            standalone lab so it never silently replaces the Python tasks in
            your adaptive plan.
          </p>
        </div>
        <div
          className="concept-transfer-entry-lanes today-test-design-lanes"
          aria-label="Cold reconstruction lanes"
        >
          {(["swift", "ios"] as ConceptTransferLane[]).map((lane) => {
            const summary = conceptTransferLaneOverviews[lane];
            return (
              <button
                key={lane}
                className="secondary-button"
                onClick={() => onConceptTransfer(lane)}
              >
                <strong>{lane === "ios" ? "iOS" : "Swift"}</strong>
                <span>
                  {summary.newCount} new · {summary.dueCount} due · {summary.coldSelfAssessedCount} cold
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <DailyCoach
        ready={ready}
        state={state}
        items={items}
        onStart={onStartCoach}
        onResume={onResumeSession}
        fluencyClinic={fluencyClinic}
        onOpenFluencyClinic={onFluencyClinic}
      />
      <section className="today-hero">
        <div className="today-copy">
          <span className="eyebrow">
            Daily Type{" "}
            {dailyDone
              ? "· complete"
              : dailyAvailable
                ? "· ready"
                : "· connecting"}
          </span>
          <h2>{daily?.title}</h2>
          <p>{daily?.cue}</p>
          <div className="problem-tags">
            <span className={`difficulty ${daily?.difficulty.toLowerCase()}`}>
              {daily?.difficulty}
            </span>
            <span>{daily && LANGUAGE_META[daily.language].label}</span>
            <span>{daily?.pattern}</span>
            <span>Fixed stage 1</span>
            <span>{daily ? problemLineCount(daily) : 0} lines</span>
          </div>
          <button
            className="primary-button"
            disabled={!daily || !dailyAvailable}
            onClick={() => daily && dailyAvailable && onOpen(daily, 1, today)}
          >
            {dailyDone
              ? "Practice it again"
              : dailyAvailable
                ? "Start today's benchmark"
                : cloudStatus === "checking"
                  ? "Checking today's benchmark"
                  : "Benchmark temporarily unavailable"}
            <span>→</span>
          </button>
        </div>
        <div className="today-score">
          <div
            className="today-ring"
            role="progressbar"
            aria-label="Minutes practiced toward today's goal"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={Math.min(goal, minutes)}
            style={
              {
                "--goal": `${Math.min(360, (minutes / goal) * 360)}deg`,
              } as React.CSSProperties
            }
          >
            <strong>{minutes}</strong>
            <small>of {goal} min</small>
          </div>
          <span>{activeStreak(state)} day streak</span>
          <small>Only completed and abandoned practice time counts.</small>
        </div>
      </section>
      <div className="today-grid">
        {draftItem && (
          <article className="today-card priority">
            <span className="eyebrow">Continue draft</span>
            <h3>{draftItem.title}</h3>
            <p>
              Stage {state.draft?.stage} · {state.draft?.value.length}{" "}
              characters typed{state.draft?.sessionId ? " · session queue" : ""}
            </p>
            <button
              className="outline-button"
              onClick={onResumeDraft}
            >
              Resume exactly where you left off →
            </button>
          </article>
        )}
        <article className="today-card priority">
          <span className="eyebrow">Python reactivation</span>
          <h3>{pythonDaily?.title ?? "Python fundamentals"}</h3>
          <p>
            {pythonDaily?.cue ??
              "Short syntax and standard-library drills will appear here."}
          </p>
          <button
            className="outline-button"
            disabled={!pythonDaily}
            onClick={() => pythonDaily && onOpen(pythonDaily)}
          >
            Warm up Python fluency →
          </button>
        </article>
        <article className="today-card ios-reactivation">
          <span className="eyebrow">iOS reactivation</span>
          <h3>{iosDaily?.title ?? "iOS fundamentals"}</h3>
          <p>
            {iosDaily?.cue ??
              "Short Swift and platform exercises will appear here."}
          </p>
          <button
            className="outline-button"
            disabled={!iosDaily}
            onClick={() => iosDaily && onOpen(iosDaily)}
          >
            Practice this fundamental →
          </button>
        </article>
        <article className="today-card">
          <span className="eyebrow">Due recall</span>
          <h3>
            {due.length
              ? `${due.length} solution${due.length === 1 ? "" : "s"} ready`
              : "Queue is clear"}
          </h3>
          <p>
            {due.length
              ? "A short return now strengthens retrieval more than another fresh problem."
              : "Your next reviews will appear here automatically."}
          </p>
          <button
            className="outline-button"
            disabled={!due.length}
            onClick={onReview}
          >
            {due.length ? "Start due review →" : "Nothing due today"}
          </button>
        </article>
        <article className="today-card">
          <span className="eyebrow">Focused set</span>
          <h3>Build a deliberate session.</h3>
          <p>
            Queue due work, new problems, favorites, or custom Python and Swift
            snippets with a fixed recall policy.
          </p>
          <div className="card-actions">
            <button className="outline-button" onClick={onSessions}>
              Build session
            </button>
            <button className="outline-button" onClick={onCreate}>
              Add snippet
            </button>
            <button className="outline-button" onClick={onBrowse}>
              Library
            </button>
          </div>
        </article>
      </div>
    </main>
  );
}

function compatibleSubmissionRecord(
  request: SubmissionRequest,
  outcome: Pick<SubmissionRecord, "status" | "durationMs" | "passed" | "total">,
): SubmissionRecord {
  const kind = request.context.kind;
  return {
    id: request.id,
    itemId: request.itemId as ItemId,
    titleSnapshot: request.titleSnapshot,
    language: request.language,
    itemRevision: request.itemRevision,
    verificationRevision: request.judge.revision,
    submittedAt: new Date(request.requestedAt).toISOString(),
    ...outcome,
    source: request.source,
    origin:
      kind === "round"
        ? "round"
        : kind === "mock" || kind === "studio"
          ? "mock"
          : "practice",
    sessionId: request.context.sessionId,
    virtualRoundId: request.context.virtualRoundId,
  };
}

type PracticeProps = {
  state: AppState;
  items: PracticeItem[];
  item: PracticeItem;
  draft: Draft;
  practiceKind: PracticeKind;
  stage: number;
  metrics: ReturnType<typeof currentMetrics>;
  ghostCode: string;
  stats: ReturnType<typeof itemStats>;
  conceptCheckIndex: 0 | 1 | 2;
  assessmentResponseMode?:
    | "local-verified-solve"
    | "swift-reconstruction"
    | "concept-recall";
  dueCount: number;
  reveal: boolean;
  focusMode: boolean;
  errorKeys: Record<string, number>;
  now: number;
  activeSession: TrainingSession | null;
  virtualRound: ActiveVirtualRoundRun | null;
  interviewStudio: InterviewStudioSession | null;
  onOpenItem: (
    item: PracticeItem,
    stage?: number,
    challengeDate?: string,
    sessionId?: string,
    practiceKind?: PracticeKind,
  ) => void;
  onChooseStage: (stage: number) => void;
  onChoosePracticeKind: (kind: PracticeKind) => void;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  onReset: () => void;
  onTestRun: () => void;
  onSubmissionRun: () => void;
  onSubmissionRequested: (request: SubmissionRequest) => boolean;
  onSubmissionSettled: (submission: SubmissionRecord) => void;
  onVirtualRoundSubmissionRequested: (request: SubmissionRequest) => boolean;
  onVirtualRoundSubmissionSettled: (submission: SubmissionRecord) => void;
  onVirtualRoundOpenProblem: (roundId: string, itemId: string) => void;
  onVirtualRoundToggleFlag: (roundId: string, itemId: string) => void;
  onVirtualRoundFinish: (roundId: string) => void;
  onRestoreSubmission: (submission: SubmissionRecord) => void;
  onCustomCaseChange: (value: string) => void;
  onCustomTestcasesChange: (collection: CustomTestcaseCollection) => void;
  onUseHint: (level: 1 | 2 | 3) => void;
  onMockNotebookChange: (notebook: MockNotebookValue) => void;
  onMockCheckpoint: (kind: MockCheckpointKind) => void;
  onInterviewCommitResponse: (text: string) => void;
  onInterviewAdvance: () => void;
  onInterviewHint: () => void;
  onInterviewRunnerEvidence: (
    expectedSessionId: string,
    status: InterviewRunnerEventStatus,
    source: string,
    passed: number,
    total: number,
  ) => void;
  onFinishInterview: () => void;
  onSolveComplete: (
    source: string,
    result: PythonVerificationResult,
    runs: number,
    submissions?: number,
    purpose?: "submit" | "full",
    submissionId?: string,
  ) => void;
  onTrustedSolveComplete: (
    source: string,
    judgeRevision: number,
    passed: number,
    total: number,
    submissionId?: string,
  ) => void;
  onConceptChange: (value: string) => void;
  onConceptReveal: (assisted: boolean, responseSnapshot: string) => void;
  onConceptComplete: (input: ConceptCompletionInput) => void;
  onReveal: () => void;
  onFavorite: () => void;
  onFocusMode: () => void;
  onReview: () => void;
  onBrowse: () => void;
  onRandom: () => void;
  onSession: () => void;
  onSkipSession: () => void;
  onEndSession: () => void;
  trustedJudgeAvailable: boolean;
  trustedJudgeAuthenticated: boolean;
};

function PracticeView(props: PracticeProps) {
  const submissionHistory = useMemo(
    () => settledSubmissionRecords(props.state.submissionLog) as SubmissionRecord[],
    [props.state.submissionLog],
  );
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const activeSubmissionRequest = useRef<SubmissionRequest | null>(null);
  const submissionSettledRef = useRef(props.onSubmissionSettled);
  const roundSubmissionSettledRef = useRef(
    props.onVirtualRoundSubmissionSettled,
  );
  useEffect(() => {
    submissionSettledRef.current = props.onSubmissionSettled;
    roundSubmissionSettledRef.current =
      props.onVirtualRoundSubmissionSettled;
  }, [props.onSubmissionSettled, props.onVirtualRoundSubmissionSettled]);
  const [verificationState, setVerificationState] = useState<{
    itemId: ItemId;
    status: "idle" | "loading" | "running" | "passed" | "failed" | "error";
    purpose?: "examples" | "submit" | "full";
    result?: PythonVerificationResult;
    message?: string;
    source?: string;
    runs?: number;
  }>({ itemId: props.item.itemId, status: "idle" });
  const [customExecutionState, setCustomExecutionState] = useState<{
    itemId: ItemId;
    status: "idle" | "loading" | "running" | "finished" | "error";
    result?: PythonVerificationResult;
    message?: string;
    caseIds?: readonly string[];
  }>({ itemId: props.item.itemId, status: "idle" });
  const [solveHintLevel, setSolveHintLevel] = useState(0);
  const [consoleTab, setConsoleTab] = useState<
    "examples" | "custom" | "output" | "submissions"
  >("examples");
  const [swiftRetryAvailable, setSwiftRetryAvailable] = useState(false);
  const [mobileWorkspacePane, setMobileWorkspacePane] =
    useState<MobilePane>("problem");
  const [runnerActive, setRunnerActive] = useState(false);
  const pythonRunner = useRef<PythonRunner | null>(null);
  const verificationRunId = useRef(0);
  const customExecutionRunId = useRef(0);
  const runnerGeneration = useRef(0);
  const inspectedSubmissionIds = useRef(new Set<string>());
  const runnerBusy = useRef(false);
  const disposed = useRef(false);
  const [lastRunnableSource, setLastRunnableSource] = useState<{
    itemId: ItemId;
    source: string;
  } | null>(null);
  const visibleVerificationState =
    verificationState.itemId === props.item.itemId
      ? verificationState
      : { itemId: props.item.itemId, status: "idle" as const };
  const visibleCustomExecutionState =
    customExecutionState.itemId === props.item.itemId
      ? customExecutionState
      : { itemId: props.item.itemId, status: "idle" as const };
  const isMock = Boolean(
    props.activeSession?.kind === "mock" &&
      props.draft.sessionId === props.activeSession.id,
  );
  const isAssessment = Boolean(
    props.draft.assessmentRunId && props.draft.assessmentProbeId,
  );
  const activeVirtualRound =
    props.draft.virtualRoundId &&
    props.virtualRound?.id === props.draft.virtualRoundId
      ? props.virtualRound
      : null;
  const isVirtualRound = Boolean(activeVirtualRound);
  const isTransfer = Boolean(props.item.transfer);
  const isTrustedSwiftSolve = Boolean(
    props.practiceKind === "solving" &&
      props.item.language === "swift" &&
      props.item.trustedChallengeKey,
  );
  const isLocked = isMock || isAssessment || isVirtualRound;
  const activeStudio =
    props.interviewStudio?.format === "python-coding" &&
    props.interviewStudio.id === props.draft.sessionId
      ? props.interviewStudio
      : null;
  const isStudio = Boolean(activeStudio);
  const [swiftAssignment, setSwiftAssignment] =
    useState<CloudTrustedAssignment | null>(null);
  const [swiftSubmission, setSwiftSubmission] =
    useState<CloudTrustedSubmission | null>(null);
  const [swiftExampleRun, setSwiftExampleRun] =
    useState<CloudTrustedExampleRun | null>(null);
  const [swiftLoadState, setSwiftLoadState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [swiftAction, setSwiftAction] = useState<
    "idle" | "loading" | "submitting"
  >("idle");
  const [swiftExampleAction, setSwiftExampleAction] = useState<
    "idle" | "running"
  >("idle");
  const [swiftMessage, setSwiftMessage] = useState("");
  const reconciledSwiftSubmissionIds = useRef(new Set<string>());
  const activeSwiftExampleRequest = useRef<{
    assignmentId: string;
    clientRunId: string;
    source: string;
  } | null>(null);
  const swiftSubmitInFlight = useRef(false);
  const onSwiftSubmissionSettled = props.onSubmissionSettled;
  const onSwiftSolveComplete = props.onTrustedSolveComplete;
  const swiftItemId = props.item.itemId;

  const persistedSwiftRequestFor = useCallback((
    assignment: CloudTrustedAssignment,
  ): SubmissionRequest | null => {
    const remoteClientSubmissionId = assignment.latestSubmission?.clientSubmissionId;
    if (!remoteClientSubmissionId) return null;
    const pending = props.state.submissionLog.receipts
      .filter(
        (receipt) =>
          receipt.lifecycle === "pending" &&
          receipt.itemId === props.item.itemId &&
          receipt.id === remoteClientSubmissionId &&
          receipt.judge.kind === "server-isolated-swift" &&
          receipt.context.kind === "practice",
      )
      .slice()
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
    const receipt = pending[0];
    if (!receipt) return null;
    const source = resolveSubmissionSource(props.state.submissionLog, receipt.id);
    if (!source) return null;
    return {
      id: receipt.id,
      itemId: receipt.itemId,
      titleSnapshot: receipt.titleSnapshot,
      language: "swift",
      itemRevision: receipt.itemRevision,
      requestedAt: receipt.requestedAt,
      source,
      judge: {
        kind: "server-isolated-swift",
        revision: receipt.judge.revision || assignment.challenge.judgeRevision,
      },
      context: { kind: "practice" },
      assistance: receipt.assistance,
    };
  }, [props.item.itemId, props.state.submissionLog]);

  const reconcileSettledSwiftAssignment = useCallback((
    assignment: CloudTrustedAssignment,
  ) => {
    const latest = assignment.latestSubmission;
    if (
      !latest ||
      latest.status !== "settled" ||
      reconciledSwiftSubmissionIds.current.has(latest.id)
    )
      return;
    const pending =
      activeSubmissionRequest.current ?? persistedSwiftRequestFor(assignment);
    if (!pending || pending.itemId !== props.item.itemId) return;
    if (latest.clientSubmissionId !== pending.id) return;
    const resultPayload = latest.result;
    const settled = compatibleSubmissionRecord(pending, {
      status: latest.verdict ?? "judge-error",
      durationMs: Math.max(
        0,
        Date.parse(latest.settledAt ?? pending.requestedAt.toString()) -
          Date.parse(latest.submittedAt),
      ),
      passed: resultPayload?.passed ?? 0,
      total: resultPayload?.total ?? 0,
    });
    reconciledSwiftSubmissionIds.current.add(latest.id);
    activeSubmissionRequest.current = null;
    setSwiftRetryAvailable(false);
    swiftSubmitInFlight.current = false;
    onSwiftSubmissionSettled(settled);
    if (
      settled.status === "accepted" &&
      resultPayload &&
      resultPayload.passed === resultPayload.total
    ) {
      onSwiftSolveComplete(
        pending.source,
        resultPayload.judgeRevision,
        resultPayload.passed,
        resultPayload.total,
        pending.id,
      );
    }
  }, [
    onSwiftSolveComplete,
    onSwiftSubmissionSettled,
    persistedSwiftRequestFor,
    props.item.itemId,
  ]);

  const loadSwiftAssignment = useCallback(async () => {
    if (!isTrustedSwiftSolve) return;
    if (!props.trustedJudgeAvailable || !props.trustedJudgeAuthenticated) {
      setSwiftLoadState("idle");
      setSwiftAssignment(null);
      setSwiftSubmission(null);
      setSwiftExampleRun(null);
      activeSwiftExampleRequest.current = null;
      setSwiftRetryAvailable(false);
      return;
    }
    const challengeKey = props.item.trustedChallengeKey;
    if (!challengeKey) return;
    setSwiftRetryAvailable(false);
    setSwiftLoadState("loading");
    setSwiftMessage("");
    const listed = await cloudClient.trustedAssignments({
      limit: 50,
      challengeKey,
    });
    if (listed.available) {
      const matching = listed.data.entries.find(
        (entry) =>
          entry.challenge.key === challengeKey && entry.status === "active",
      );
      if (matching) {
        setSwiftAssignment(matching);
        setSwiftSubmission(matching.latestSubmission);
        if (swiftAssignment?.id !== matching.id) {
          setSwiftExampleRun(null);
          activeSwiftExampleRequest.current = null;
        }
        reconcileSettledSwiftAssignment(matching);
        setSwiftLoadState("ready");
        return;
      }
      const settledHistory = listed.data.entries.find(
        (entry) =>
          entry.challenge.key === challengeKey &&
          entry.latestSubmission?.status === "settled",
      );
      if (settledHistory) reconcileSettledSwiftAssignment(settledHistory);
    }
    const issued = await cloudClient.issueTrustedAssignment(
      `practice:${props.item.itemId}:${makeId()}`,
      { language: "swift", challengeKey },
    );
    if (!issued.available) {
      setSwiftLoadState("error");
      setSwiftMessage(
        issued.reason === "unauthorized"
          ? "Sign in again before starting a verified Swift solve."
          : "The isolated Swift judge could not issue this assignment.",
      );
      return;
    }
    setSwiftAssignment(issued.data);
    setSwiftSubmission(issued.data.latestSubmission);
    setSwiftExampleRun(null);
    activeSwiftExampleRequest.current = null;
    setSwiftLoadState("ready");
  }, [
    isTrustedSwiftSolve,
    props.item.itemId,
    props.item.trustedChallengeKey,
    props.trustedJudgeAuthenticated,
    props.trustedJudgeAvailable,
    reconcileSettledSwiftAssignment,
    swiftAssignment?.id,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!isTrustedSwiftSolve) return;
    const timer = window.setTimeout(() => {
      void loadSwiftAssignment().catch((error) => {
        if (cancelled) return;
        setSwiftLoadState("error");
        setSwiftMessage(
          error instanceof Error
            ? error.message
            : "The isolated Swift judge could not be reached.",
        );
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isTrustedSwiftSolve, loadSwiftAssignment]);

  const trustedJudgeAvailable = props.trustedJudgeAvailable;
  const trustedJudgeAuthenticated = props.trustedJudgeAuthenticated;
  const trustedChallengeKey = props.item.trustedChallengeKey;

  useEffect(() => {
    if (
      !isTrustedSwiftSolve ||
      !trustedJudgeAvailable ||
      !trustedJudgeAuthenticated ||
      !swiftAssignment ||
      swiftSubmission?.status !== "pending"
    )
      return;
    const controller = new AbortController();
    let timer: number | undefined;
    let cancelled = false;
    async function pollSwiftSubmission() {
      const result = await cloudClient.trustedAssignments({
        limit: 50,
        challengeKey: trustedChallengeKey,
        signal: controller.signal,
      });
      if (cancelled) return;
      if (result.available) {
        const refreshed = result.data.entries.find(
          (entry) => entry.id === swiftAssignment?.id,
        );
        if (refreshed) {
          setSwiftAssignment(refreshed);
          setSwiftSubmission(refreshed.latestSubmission);
          if (refreshed.latestSubmission?.status === "settled") {
            reconcileSettledSwiftAssignment(refreshed);
            setSwiftMessage(
              refreshed.latestSubmission.verdict === "accepted"
                ? "Accepted. Swift evidence was sealed by the server."
                : refreshed.latestSubmission.verdict === "compile-error"
                  ? "The server could not compile this Swift source. Fix the signature or syntax and submit again."
                  : "The server returned aggregate feedback; sealed cases remain private.",
            );
            return;
          }
        }
      }
      timer = window.setTimeout(() => void pollSwiftSubmission(), 1_500);
    }
    timer = window.setTimeout(() => void pollSwiftSubmission(), 1_500);
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [
    isTrustedSwiftSolve,
    swiftItemId,
    onSwiftSubmissionSettled,
    onSwiftSolveComplete,
    trustedJudgeAuthenticated,
    trustedJudgeAvailable,
    trustedChallengeKey,
    swiftAssignment,
    swiftSubmission?.status,
    reconcileSettledSwiftAssignment,
  ]);
  const mockRemainingMs = isMock
    ? (mockInterviewRemainingMs(props.activeSession, props.now) ?? 0)
    : null;
  const mockWorkspace = isMock
    ? props.activeSession?.mockProblems?.find(
        (workspace) => workspace.itemId === props.item.itemId,
      )
    : undefined;
  const virtualRoundRemaining = activeVirtualRound
    ? virtualRoundRemainingMs(activeVirtualRound, props.now)
    : null;
  const currentVirtualRoundProblem = activeVirtualRound?.problems.find(
    (problem) => problem.itemId === props.item.itemId,
  );
  const acceptedStudioSubmission = activeStudio
    ? submissionHistory
        .slice()
        .reverse()
        .find(
          (submission) =>
            submission.sessionId === activeStudio.id &&
            submission.status === "accepted" &&
            submission.itemId === props.item.itemId &&
            submission.source === props.draft.value,
        )
    : undefined;

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      const pendingRequest = activeSubmissionRequest.current;
      if (pendingRequest && pendingRequest.judge.kind !== "server-isolated-swift") {
        const interrupted = compatibleSubmissionRecord(pendingRequest, {
          status: "judge-error",
          durationMs: 0,
          passed: 0,
          total: 0,
        });
        activeSubmissionRequest.current = null;
        if (pendingRequest.context.kind === "round")
          roundSubmissionSettledRef.current(interrupted);
        else submissionSettledRef.current(interrupted);
      }
      verificationRunId.current += 1;
      customExecutionRunId.current += 1;
      runnerGeneration.current += 1;
      pythonRunner.current?.dispose();
    };
  }, []);
  const visible = useMemo(
    () =>
      props.items
        .filter(
          (item) =>
            !item.transfer &&
            `${itemDisplayId(item)} ${item.title} ${item.pattern}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .slice(0, 12),
    [props.items, query],
  );
  const favorite = props.state.favorites.includes(props.item.itemId);
  const errorCount = Object.values(props.draft.lineErrors).reduce(
    (total, count) => total + count,
    0,
  );
  const currentEditorLineCount = props.draft.value.split("\n").length;
  const editorLineCount =
    props.practiceKind === "solving"
      ? Math.max(1, currentEditorLineCount)
      : Math.max(problemLineCount(props.item), currentEditorLineCount);
  const linesLeft = Math.max(
    0,
    problemLineCount(props.item) - props.draft.value.split("\n").length,
  );
  const prompt = problemUrl(props.item);
  const runnerSource =
    props.practiceKind === "solving"
      ? props.draft.value
      : props.draft.value.trim()
        ? props.draft.value
        : lastRunnableSource?.itemId === props.item.itemId
          ? lastRunnableSource.source
          : "";

  async function runSwiftSubmit() {
    if (
      !isTrustedSwiftSolve ||
      isLocked ||
      !swiftAssignment ||
      swiftAssignment.status !== "active" ||
      (swiftSubmission?.status === "pending" && !activeSubmissionRequest.current) ||
      swiftAction !== "idle" ||
      swiftSubmitInFlight.current ||
      !runnerSource.trim()
    )
      return;
    const activeRequest = activeSubmissionRequest.current;
    if (
      activeRequest &&
      (activeRequest.itemId !== props.item.itemId ||
        activeRequest.judge.kind !== "server-isolated-swift")
    ) {
      activeSubmissionRequest.current = null;
      setSwiftRetryAvailable(false);
    }
    const retryRequest = activeSubmissionRequest.current;
    if (retryRequest && retryRequest.source !== runnerSource) {
      setSwiftMessage(
        "A previous queue attempt is still safe to retry. Restore that exact source before retrying.",
      );
      return;
    }
    swiftSubmitInFlight.current = true;
    setSwiftRetryAvailable(false);
    const submissionRequest: SubmissionRequest = retryRequest ?? {
      id: makeId(),
      itemId: props.item.itemId,
      titleSnapshot: props.item.title,
      language: "swift",
      itemRevision: props.item.contentRevision,
      requestedAt: new Date().toISOString(),
      source: runnerSource,
      judge: {
        kind: "server-isolated-swift",
        revision: swiftAssignment.challenge.judgeRevision,
      },
      context: { kind: "practice" },
      assistance: props.draft.peeks > 0 ? "used" : "none-recorded",
    };
    if (!retryRequest) {
      if (!props.onSubmissionRequested(submissionRequest)) {
        swiftSubmitInFlight.current = false;
        return;
      }
      activeSubmissionRequest.current = submissionRequest;
      props.onSubmissionRun();
    }
    setSwiftAction("submitting");
    setSwiftMessage("");
    const result = await cloudClient.submitTrustedAssignment(
      swiftAssignment.id,
      { clientSubmissionId: submissionRequest.id, source: runnerSource },
    );
    setSwiftAction("idle");
    if (!result.available) {
      if (result.reason === "judge-enqueue-unavailable") {
        swiftSubmitInFlight.current = false;
        setSwiftRetryAvailable(true);
        setSwiftMessage(
          "The judge is temporarily busy. Your source is safely saved as a pending receipt; retry with the same code in a moment.",
        );
        return;
      }
      const interrupted = compatibleSubmissionRecord(submissionRequest, {
        status: "judge-error",
        durationMs: 0,
        passed: 0,
        total: 0,
      });
      activeSubmissionRequest.current = null;
      setSwiftRetryAvailable(false);
      swiftSubmitInFlight.current = false;
      props.onSubmissionSettled(interrupted);
      setSwiftMessage(
        result.reason === "unauthorized"
          ? "Sign in again before submitting Swift code."
          : "The submission did not reach the isolated Swift judge.",
      );
      return;
    }
    setSwiftSubmission(result.data);
    setSwiftAssignment((current) =>
      current ? { ...current, latestSubmission: result.data } : current,
    );
    if (result.data.status === "pending") {
      setSwiftMessage("Queued. The isolated judge is compiling and running your source.");
      return;
    }
    const resultPayload = result.data.result;
    const settled = compatibleSubmissionRecord(submissionRequest, {
      status: result.data.verdict ?? "judge-error",
      durationMs: Math.max(
        0,
        Date.parse(result.data.settledAt ?? result.data.submittedAt) -
          Date.parse(result.data.submittedAt),
      ),
      passed: resultPayload?.passed ?? 0,
      total: resultPayload?.total ?? 0,
    });
    activeSubmissionRequest.current = null;
    setSwiftRetryAvailable(false);
    swiftSubmitInFlight.current = false;
    props.onSubmissionSettled(settled);
    if (
      settled.status === "accepted" &&
      resultPayload &&
      resultPayload.passed === resultPayload.total
    ) {
      props.onTrustedSolveComplete(
        submissionRequest.source,
        resultPayload.judgeRevision,
        resultPayload.passed,
        resultPayload.total,
        submissionRequest.id,
      );
    }
    setSwiftMessage(
      result.data.verdict === "accepted"
        ? "Accepted. Swift evidence was sealed by the server."
        : result.data.verdict === "compile-error"
          ? "The server could not compile this Swift source."
      : "The server returned aggregate feedback; sealed cases remain private.",
    );
  }

  async function runSwiftExamples() {
    if (
      !isTrustedSwiftSolve ||
      isLocked ||
      !swiftAssignment ||
      swiftAssignment.status !== "active" ||
      swiftAction !== "idle" ||
      swiftExampleAction !== "idle" ||
      swiftExampleRun?.status === "pending" ||
      !runnerSource.trim()
    )
      return;
    const request = {
      assignmentId: swiftAssignment.id,
      clientRunId: `example:${props.item.itemId}:${makeId()}`,
      source: runnerSource,
    };
    activeSwiftExampleRequest.current = request;
    setSwiftExampleAction("running");
    setSwiftExampleRun(null);
    setSwiftMessage("");
    try {
      const result = await cloudClient.runTrustedExamples(
        request.assignmentId,
        { clientRunId: request.clientRunId, source: request.source },
        { challenge: swiftAssignment.challenge },
      );
      if (
        activeSwiftExampleRequest.current?.clientRunId !== request.clientRunId
      ) return;
      setSwiftExampleAction("idle");
      if (!result.available) {
        if (result.reason === "judge-enqueue-unavailable") {
          setSwiftMessage(
            "The Swift example run is saved but the judge is busy. It will retry with the same source.",
          );
          setSwiftExampleRun({
            id: request.clientRunId,
            assignmentId: request.assignmentId,
            clientRunId: request.clientRunId,
            status: "pending",
            verdict: null,
            requestedAt: new Date().toISOString(),
            settledAt: null,
            result: null,
          });
          return;
        }
        activeSwiftExampleRequest.current = null;
        setSwiftMessage(
          result.reason === "unauthorized"
            ? "Sign in again before running Swift examples."
            : "The Swift examples could not reach the isolated judge.",
        );
        return;
      }
      if (
        result.data.assignmentId !== request.assignmentId ||
        result.data.clientRunId !== request.clientRunId
      ) {
        activeSwiftExampleRequest.current = null;
        setSwiftMessage("The Swift example result did not match this source. Run examples again.");
        return;
      }
      setSwiftExampleRun(result.data);
      if (result.data.status === "pending") {
        setSwiftMessage("Examples queued. The isolated Swift runtime is compiling your source.");
        return;
      }
      activeSwiftExampleRequest.current = null;
      setSwiftMessage(
        result.data.verdict === "accepted"
          ? "Public examples passed. Submit when you are ready for sealed cases."
          : "Public examples found a problem. Fix this before using the sealed judge.",
      );
    } catch (error) {
      if (activeSwiftExampleRequest.current?.clientRunId !== request.clientRunId)
        return;
      activeSwiftExampleRequest.current = null;
      setSwiftExampleAction("idle");
      setSwiftMessage(
        error instanceof Error
          ? error.message
          : "The Swift examples could not reach the isolated judge.",
      );
    }
  }

  useEffect(() => {
    if (
      !isTrustedSwiftSolve ||
      !trustedJudgeAvailable ||
      !trustedJudgeAuthenticated ||
      swiftExampleRun?.status !== "pending"
    )
      return;
    const request = activeSwiftExampleRequest.current;
    if (!request) return;
    const pollRequest = { ...request };
    const controller = new AbortController();
    let timer: number | undefined;
    let cancelled = false;
    async function pollSwiftExamples() {
      const result = await cloudClient.runTrustedExamples(
        pollRequest.assignmentId,
        { clientRunId: pollRequest.clientRunId, source: pollRequest.source },
        { signal: controller.signal, challenge: swiftAssignment?.challenge },
      );
      if (cancelled) return;
      if (
        result.available &&
        (result.data.assignmentId !== pollRequest.assignmentId ||
          result.data.clientRunId !== pollRequest.clientRunId)
      ) {
        activeSwiftExampleRequest.current = null;
        setSwiftExampleRun(null);
        setSwiftMessage("The Swift example result did not match this source. Run examples again.");
        return;
      }
      if (result.available) {
        setSwiftExampleRun(result.data);
        if (result.data.status === "settled") {
          activeSwiftExampleRequest.current = null;
          setSwiftMessage(
            result.data.verdict === "accepted"
              ? "Public examples passed. Submit when you are ready for sealed cases."
              : "Public examples found a problem. Fix this before using the sealed judge.",
          );
          return;
        }
      } else if (result.reason !== "aborted") {
        setSwiftMessage(
          result.reason === "judge-enqueue-unavailable"
            ? "The Swift example run is still waiting for the isolated judge."
            : "The Swift example run is still pending; retry examples if it does not settle.",
        );
      }
      timer = window.setTimeout(() => void pollSwiftExamples(), 1_500);
    }
    timer = window.setTimeout(() => void pollSwiftExamples(), 1_500);
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [
    isTrustedSwiftSolve,
    swiftExampleRun?.status,
    trustedJudgeAuthenticated,
    trustedJudgeAvailable,
    swiftAssignment?.challenge,
  ]);
  const customCaseInput =
    props.state.customCaseInputs[props.item.itemId] ??
    props.draft.customCaseInput;
  const customTestcaseSchema = useMemo(
    () => customTestcaseSchemaForItem(props.item),
    [props.item],
  );
  const customTestcases = useMemo(
    () =>
      customTestcaseSchema
        ? (props.state.customTestcases[props.item.itemId] ??
          createCustomTestcaseCollection(customTestcaseSchema))
        : null,
    [customTestcaseSchema, props.item.itemId, props.state.customTestcases],
  );
  const checksAreBusy =
    runnerActive ||
    visibleVerificationState.status === "loading" ||
    visibleVerificationState.status === "running" ||
    visibleCustomExecutionState.status === "loading" ||
    visibleCustomExecutionState.status === "running" ||
    activeVirtualRound?.status === "finalizing";
  async function copyPracticeLink() {
    const url = window.location.href;
    let didCopy = false;
    try {
      await navigator.clipboard.writeText(url);
      didCopy = true;
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = url;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      didCopy = document.execCommand("copy");
      fallback.remove();
    }
    if (didCopy) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  function cancelPythonRun() {
    const pendingRequest = activeSubmissionRequest.current;
    if (pendingRequest && pendingRequest.judge.kind !== "server-isolated-swift") {
      const interrupted = compatibleSubmissionRecord(pendingRequest, {
        status: "judge-error",
        durationMs: 0,
        passed: 0,
        total: 0,
      });
      activeSubmissionRequest.current = null;
      if (pendingRequest.context.kind === "round")
        props.onVirtualRoundSubmissionSettled(interrupted);
      else props.onSubmissionSettled(interrupted);
    }
    verificationRunId.current += 1;
    customExecutionRunId.current += 1;
    runnerGeneration.current += 1;
    runnerBusy.current = false;
    pythonRunner.current?.dispose();
    pythonRunner.current = null;
    setRunnerActive(false);
    setVerificationState({ itemId: props.item.itemId, status: "idle" });
    setCustomExecutionState({ itemId: props.item.itemId, status: "idle" });
  }

  async function runPythonChecks(
    purpose: "examples" | "submit" | "full" = "full",
  ) {
    if (!props.item.verification || !runnerSource.trim()) return;
    if (isMock && mockRemainingMs === 0) return;
    if (
      activeVirtualRound &&
      (activeVirtualRound.status !== "active" || virtualRoundRemaining === 0)
    )
      return;
    if (runnerBusy.current) return;
    if (isMock) props.onMockCheckpoint("firstTest");
    const sourceToVerify = runnerSource;
    const runs = props.draft.testRuns + 1;
    const submissions =
      props.draft.submissions + (purpose === "submit" ? 1 : 0);
    const runId = ++verificationRunId.current;
    const generation = ++runnerGeneration.current;
    const submissionContextKind: SubmissionContextKind = isVirtualRound
      ? "round"
      : isStudio
        ? "studio"
        : isMock
          ? "mock"
          : isAssessment
            ? "assessment"
            : isTransfer
              ? "transfer"
              : "practice";
    const submissionRequest: SubmissionRequest | null =
      purpose === "submit" || (isMock && purpose === "full")
        ? {
            id: makeId(),
            itemId: props.item.itemId,
            titleSnapshot: props.item.title,
            language: props.item.language,
            itemRevision: props.item.contentRevision,
            requestedAt: new Date().toISOString(),
            source: sourceToVerify,
            judge: {
              kind: "browser-python-local",
              revision: props.item.verification.revision ?? 1,
            },
            context: {
              kind: submissionContextKind,
              sessionId: props.draft.sessionId,
              assessmentRunId: props.draft.assessmentRunId,
              assessmentProbeId: props.draft.assessmentProbeId,
              virtualRoundId: props.draft.virtualRoundId,
            },
            assistance: props.draft.peeks > 0 ? "used" : "none-recorded",
          }
        : null;
    if (submissionRequest) {
      const queued = isVirtualRound
        ? props.onVirtualRoundSubmissionRequested(submissionRequest)
        : props.onSubmissionRequested(submissionRequest);
      if (!queued) return;
      activeSubmissionRequest.current = submissionRequest;
    }
    runnerBusy.current = true;
    setRunnerActive(true);
    const verificationStartedAt = performance.now();
    setConsoleTab("output");
    setMobileWorkspacePane("tests");
    if (purpose === "submit") props.onSubmissionRun();
    else props.onTestRun();
    try {
      const runner = pythonRunner.current ?? createPythonRunner();
      pythonRunner.current = runner;
      setVerificationState({
        itemId: props.item.itemId,
        status:
          visibleVerificationState.status === "idle" ? "loading" : "running",
        purpose,
      });
      const result = await runner.verify(
        sourceToVerify,
        challengeVerificationForPurpose(props.item.verification, purpose),
      );
      if (disposed.current) return;
      if (result.kind !== "verification")
        throw new Error("Python runner returned an unexpected result");
      const passedCount = result.cases.filter(
        (testCase) => testCase.passed,
      ).length;
      if (
        submissionRequest &&
        activeSubmissionRequest.current?.id === submissionRequest.id
      ) {
        const settledSubmission = compatibleSubmissionRecord(submissionRequest, {
          status: classifySubmissionResult(result),
          durationMs: result.durationMs,
          passed: passedCount,
          total: result.cases.length,
        });
        activeSubmissionRequest.current = null;
        if (isVirtualRound)
          props.onVirtualRoundSubmissionSettled(settledSubmission);
        else props.onSubmissionSettled(settledSubmission);
      }
      if (runId !== verificationRunId.current) return;
      setVerificationState({
        itemId: props.item.itemId,
        status: result.ok ? "passed" : "failed",
        purpose,
        result,
        source: sourceToVerify,
        runs,
      });
      if (activeStudio) {
        props.onInterviewRunnerEvidence(
          activeStudio.id,
          result.ok ? "passed" : "failed",
          sourceToVerify,
          passedCount,
          result.cases.length,
        );
      }
      if (
        isRecordableChallengeResult(result, purpose, isMock) &&
        !isStudio &&
        !isVirtualRound
      ) {
        props.onSolveComplete(
          sourceToVerify,
          result,
          runs,
          submissions,
          purpose === "full" ? "full" : "submit",
          submissionRequest?.id,
        );
      }
    } catch (error) {
      if (disposed.current) return;
      if (
        submissionRequest &&
        activeSubmissionRequest.current?.id === submissionRequest.id
      ) {
        const settledSubmission = compatibleSubmissionRecord(submissionRequest, {
          status:
            error instanceof Error &&
            /time(?:d)? out|time limit/i.test(error.message)
              ? "time-limit"
              : "judge-error",
          durationMs: Math.max(0, performance.now() - verificationStartedAt),
          passed: 0,
          total: 0,
        });
        activeSubmissionRequest.current = null;
        if (isVirtualRound)
          props.onVirtualRoundSubmissionSettled(settledSubmission);
        else props.onSubmissionSettled(settledSubmission);
      }
      if (runId !== verificationRunId.current) return;
      if (activeStudio) {
        props.onInterviewRunnerEvidence(
          activeStudio.id,
          "error",
          sourceToVerify,
          0,
          0,
        );
      }
      setVerificationState({
        itemId: props.item.itemId,
        status: "error",
        purpose,
        message:
          error instanceof Error
            ? error.message
            : "Python checks could not run.",
      });
    } finally {
      if (generation === runnerGeneration.current) {
        runnerBusy.current = false;
        if (!disposed.current) setRunnerActive(false);
      }
    }
  }

  async function runCustomCase(caseIds: "selected" | "all" = "selected") {
    if (
      !props.item.verification ||
      !customTestcaseSchema ||
      !customTestcases ||
      !runnerSource.trim()
    ) {
      return;
    }
    if (runnerBusy.current) return;
    let execution;
    const executedCaseIds =
      caseIds === "all"
        ? customTestcases.cases.map((testCase) => testCase.id)
        : [customTestcases.selectedCaseId];
    try {
      const firstCase = props.item.verification.cases[0];
      if (!firstCase) throw new Error("This problem has no runnable testcase schema");
      execution = buildCustomTestcaseExecution(
        customTestcases,
        customTestcaseSchema,
        {
          entrypoint: props.item.verification.entrypoint,
          argCodecs:
            firstCase.argCodecs ?? firstCase.args.map(() => "json" as const),
          outputCodec: firstCase.outputCodec ?? "json",
          revision: props.item.verification.revision ?? 1,
          caseIds,
        },
      );
    } catch (error) {
      setCustomExecutionState({
        itemId: props.item.itemId,
        status: "error",
        message: error instanceof Error ? error.message : "Invalid custom testcase",
      });
      return;
    }
    runnerBusy.current = true;
    setRunnerActive(true);
    const runId = ++customExecutionRunId.current;
    const generation = ++runnerGeneration.current;
    setConsoleTab("custom");
    setMobileWorkspacePane("tests");
    props.onTestRun();
    try {
      const runner = pythonRunner.current ?? createPythonRunner();
      pythonRunner.current = runner;
      setCustomExecutionState({
        itemId: props.item.itemId,
        status:
          visibleCustomExecutionState.status === "idle" ? "loading" : "running",
        caseIds: executedCaseIds,
      });
      const result = await runner.run(runnerSource, execution);
      if (disposed.current || runId !== customExecutionRunId.current) return;
      if (result.kind !== "execution")
        throw new Error("Python runner returned an unexpected result");
      if (disposed.current || runId !== customExecutionRunId.current) return;
      setCustomExecutionState({
        itemId: props.item.itemId,
        status: "finished",
        result,
        caseIds: executedCaseIds,
      });
    } catch (error) {
      if (disposed.current || runId !== customExecutionRunId.current) return;
      setCustomExecutionState({
        itemId: props.item.itemId,
        status: "error",
        message:
          error instanceof Error ? error.message : "Custom testcase could not run",
      });
    } finally {
      if (generation === runnerGeneration.current) {
        runnerBusy.current = false;
        if (!disposed.current) setRunnerActive(false);
      }
    }
  }

  function changeCustomCaseInput(value: string) {
    customExecutionRunId.current += 1;
    setCustomExecutionState({ itemId: props.item.itemId, status: "idle" });
    props.onCustomCaseChange(value.slice(0, 12000));
  }

  function changeCustomTestcases(collection: CustomTestcaseCollection) {
    customExecutionRunId.current += 1;
    setCustomExecutionState({ itemId: props.item.itemId, status: "idle" });
    props.onCustomTestcasesChange(collection);
  }

  function updateStructuredCustomTestcases(
    operation: (
      collection: CustomTestcaseCollection,
      schema: NonNullable<typeof customTestcaseSchema>,
    ) => CustomTestcaseCollection,
  ) {
    if (!customTestcases || !customTestcaseSchema) {
      throw new Error("Structured testcases are unavailable for this problem");
    }
    changeCustomTestcases(operation(customTestcases, customTestcaseSchema));
  }

  function changeCustomTestcaseMode(
    caseId: string,
    mode: CustomTestcase["mode"],
    snapshot: {
      raw?: string;
      fields?: readonly CustomTestcaseField[];
    },
  ) {
    updateStructuredCustomTestcases((collection, schema) =>
      updateCustomTestcase(
        collection,
        schema,
        caseId,
        mode === "raw"
          ? { mode, raw: snapshot.raw ?? "" }
          : {
              mode,
              ...(snapshot.fields ? { fields: snapshot.fields } : {}),
            },
      ),
    );
  }

  function handleEditorChange(proposed: string) {
    const accepted =
      props.practiceKind === "solving" ||
      !(props.draft.challengeDate || props.state.settings.strictMode) ||
      props.item.code.startsWith(proposed);
    if (
      props.practiceKind === "typing" &&
      props.item.verification &&
      proposed === props.item.code &&
      accepted
    ) {
      setLastRunnableSource({
        itemId: props.item.itemId,
        source: proposed,
      });
    }
    if (accepted) {
      verificationRunId.current += 1;
      customExecutionRunId.current += 1;
      setVerificationState({ itemId: props.item.itemId, status: "idle" });
      setCustomExecutionState({ itemId: props.item.itemId, status: "idle" });
      if (
        isTrustedSwiftSolve &&
        (activeSwiftExampleRequest.current || swiftExampleRun)
      ) {
        activeSwiftExampleRequest.current = null;
        setSwiftExampleRun(null);
        setSwiftExampleAction("idle");
      }
    }
    props.onChange(proposed);
  }

  function revealSolveHint() {
    const nextLevel = Math.min(3, solveHintLevel + 1) as 1 | 2 | 3;
    setSolveHintLevel(nextLevel);
    props.onUseHint(nextLevel);
  }

  function resetPractice() {
    if (lastRunnableSource?.itemId === props.item.itemId) {
      setLastRunnableSource(null);
    }
    verificationRunId.current += 1;
    customExecutionRunId.current += 1;
    setVerificationState({ itemId: props.item.itemId, status: "idle" });
    setCustomExecutionState({ itemId: props.item.itemId, status: "idle" });
    if (isTrustedSwiftSolve) {
      activeSwiftExampleRequest.current = null;
      setSwiftExampleRun(null);
      setSwiftExampleAction("idle");
    }
    props.onReset();
  }

  function inspectSubmission(submission: SubmissionRecord) {
    if (
      runnerSource === submission.source ||
      inspectedSubmissionIds.current.has(submission.id)
    ) {
      return;
    }
    inspectedSubmissionIds.current.add(submission.id);
    props.onUseHint(3);
  }

  function restoreSubmission(submission: SubmissionRecord) {
    if (checksAreBusy) return;
    if (submission.itemId !== props.item.itemId) return;
    if (runnerSource === submission.source) {
      setMobileWorkspacePane("code");
      return;
    }
    const revisionWarnings = [
      submission.itemRevision !== props.item.contentRevision
        ? `It was written for prompt revision ${submission.itemRevision}; the current prompt is revision ${props.item.contentRevision}.`
        : "",
      submission.verificationRevision !==
      (props.item.verification?.revision ?? 1)
        ? `It used judge revision ${submission.verificationRevision}; the current judge is revision ${props.item.verification?.revision ?? 1}.`
        : "",
    ].filter(Boolean);
    if (
      runnerSource.trim() &&
      !window.confirm(
        [
          "Replace the current editor with this submitted solution? This marks the solve assisted; the saved submission remains in history.",
          ...revisionWarnings,
        ].join("\n\n"),
      )
    )
      return;
    verificationRunId.current += 1;
    customExecutionRunId.current += 1;
    setVerificationState({ itemId: props.item.itemId, status: "idle" });
    setCustomExecutionState({ itemId: props.item.itemId, status: "idle" });
    setMobileWorkspacePane("code");
    props.onRestoreSubmission(submission);
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          ".solve-code-editor .cm-content, .editor-wrap textarea",
        )
        ?.focus();
    });
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      props.practiceKind === "solving" &&
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      if (isTrustedSwiftSolve) {
        if (event.shiftKey) void runSwiftSubmit();
        else void runSwiftExamples();
        return;
      }
      if (event.shiftKey && (!isMock || isStudio)) {
        void runPythonChecks("submit");
      } else {
        void runPythonChecks(
          isStudio ? "examples" : isMock ? "full" : "examples",
        );
      }
      return;
    }
    props.onKeyDown(event);
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`practice-layout ${props.practiceKind === "solving" ? "is-solving" : ""}${isVirtualRound ? " is-virtual-round" : ""}`}
    >
      <aside className="problem-rail">
        <div className="rail-head">
          <span className="eyebrow">
            {isVirtualRound
              ? "Virtual round"
              : isAssessment
              ? "Calibration checkpoint"
              : props.activeSession?.studyPlanId
              ? "Study plan focus block"
              : props.activeSession
                ? "Active session"
                : "Problem queue"}
          </span>
          <span className="count-badge">
            {isVirtualRound && activeVirtualRound
              ? `${deriveVirtualRoundScore(activeVirtualRound).score}/${deriveVirtualRoundScore(activeVirtualRound).maxScore}`
              : isAssessment
              ? "Locked"
              : props.activeSession
              ? `${props.activeSession.currentIndex + 1}/${props.activeSession.entries.length}`
              : props.items.length}
          </span>
        </div>
        {isVirtualRound && activeVirtualRound ? (
          <div className="virtual-round-practice-rail">
            <div className="virtual-round-practice-clock" role="timer" aria-live="off">
              <span>{activeVirtualRound.status === "finalizing" ? "Finalizing" : "Time left"}</span>
              <strong>
                {activeVirtualRound.status === "finalizing"
                  ? "Judging"
                  : formatMockClock(virtualRoundRemaining ?? 0)}
              </strong>
            </div>
            <p>
              Switch between runs. While the local judge is working, you can
              still flag problems; switching resumes after the verdict is saved.
            </p>
            <ol>
              {activeVirtualRound.problems.map((problem, index) => {
                const score = deriveVirtualRoundProblemScore(problem);
                const status = virtualRoundProblemStatus(problem);
                const switchingDisabled =
                  checksAreBusy || activeVirtualRound.status !== "active";
                const flagDisabled = activeVirtualRound.status !== "active";
                return (
                  <li
                    className={`${status}${problem.itemId === props.item.itemId ? " current" : ""}`}
                    key={problem.itemId}
                  >
                    <button
                      type="button"
                      disabled={switchingDisabled}
                      aria-current={problem.itemId === props.item.itemId ? "step" : undefined}
                      onClick={() =>
                        props.onVirtualRoundOpenProblem(
                          activeVirtualRound.id,
                          problem.itemId,
                        )
                      }
                    >
                      <span>{index + 1}</span>
                      <span>
                        <strong>{problem.openedAt ? problem.title : `Problem ${index + 1}`}</strong>
                        <small>{status} · {score}/{VIRTUAL_ROUND_POINTS_PER_PROBLEM}</small>
                      </span>
                    </button>
                    <button
                      className="virtual-round-practice-flag"
                      type="button"
                      disabled={flagDisabled}
                      aria-pressed={problem.flagged}
                      aria-label={`${problem.flagged ? "Remove flag from" : "Flag"} problem ${index + 1}`}
                      onClick={() =>
                        props.onVirtualRoundToggleFlag(
                          activeVirtualRound.id,
                          problem.itemId,
                        )
                      }
                    >
                      {problem.flagged ? "Flagged" : "Flag"}
                    </button>
                  </li>
                );
              })}
            </ol>
            <small>
              Device-local practice · not proctored · no global rank or readiness claim
            </small>
            <button
              className="danger-button"
              type="button"
              disabled={checksAreBusy || activeVirtualRound.status !== "active"}
              onClick={() => props.onVirtualRoundFinish(activeVirtualRound.id)}
            >
              {checksAreBusy ? "Wait for local judge" : "Finish and lock score"}
            </button>
          </div>
        ) : isTransfer ? (
          <div className="assessment-practice-rail transfer-practice-rail">
            <span className="eyebrow">Local transfer rehearsal</span>
            <strong>Identity opened. Pattern still hidden.</strong>
            <p>
              This prompt was unseen in Swift Ghost history on this device when
              you opened it. That is a local practice claim, not proctoring.
            </p>
            <ul>
              <li>Examples stay available for iteration</li>
              <li>Every hint permanently marks assistance</li>
              <li>The contrastive debrief unlocks after an attempt</li>
            </ul>
            <button className="outline-button" onClick={props.onSession}>
              Back to Transfer Lab
            </button>
          </div>
        ) : isAssessment ? (
          <div className="assessment-practice-rail">
            <span className="eyebrow">Evidence contract</span>
            <strong>
              {props.assessmentResponseMode === "swift-reconstruction"
                ? "Reconstruct one authored Swift solution from a blank editor."
                : props.assessmentResponseMode === "concept-recall"
                  ? "Commit your explanation before the reference appears."
                  : "Solve one Python prompt against the local judge."}
            </strong>
            <p>
              {props.assessmentResponseMode === "swift-reconstruction"
                ? "Keystroke correction can verify this exact reconstruction; it does not compile Swift or evaluate alternate solutions."
                : props.assessmentResponseMode === "concept-recall"
                  ? "The comparison and grade are self-assessed. They are never presented as compiled code or certified iOS knowledge."
                  : "Executable feedback is local and unproctored. An accepted result is objective device-local practice evidence, not certification."}
            </p>
            <ul>
              <li>Source stays on this device</li>
              <li>Answer reveal is unavailable during the frozen response</li>
              <li>No proctoring or identity claim</li>
            </ul>
            <button className="outline-button" onClick={props.onSession}>
              Back to assessment
            </button>
          </div>
        ) : props.activeSession ? (
          <div className="session-rail">
            <strong>{props.activeSession.name}</strong>
            {props.activeSession.entries.map((entry, index) => {
              const queued = props.items.find(
                (candidate) => candidate.itemId === entry.itemId,
              );
              return (
                <div
                  className={`${entry.status} ${index === props.activeSession?.currentIndex ? "current" : ""}`}
                  key={`${entry.itemId}-${index}`}
                >
                  <span>
                    {entry.status === "completed"
                      ? "✓"
                      : entry.status === "skipped"
                        ? "–"
                        : index + 1}
                  </span>
                  <p>
                    <b>{queued?.title ?? "Unavailable item"}</b>
                    <small>
                      {entry.practiceKind === "solving"
                        ? props.activeSession?.kind === "mock"
                          ? "Timed mock solve"
                          : "Independent solve"
                        : entry.practiceKind === "concept"
                          ? "Concept recall"
                        : `Stage ${entry.stage} recall`}
                    </small>
                  </p>
                </div>
              );
            })}
            <button className="outline-button" onClick={props.onSession}>
              {props.activeSession.studyPlanId ? "Back to study plan" : "View session"}
            </button>
          </div>
        ) : (
          <>
            <label className="search-box">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title or pattern"
              />
            </label>
            {props.dueCount > 0 && (
              <button className="review-callout" onClick={props.onReview}>
                <span>Review due</span>
                <strong>{props.dueCount} problems →</strong>
              </button>
            )}
            <div className="problem-list">
              {visible.map((candidate) => {
                const progress = itemStats(props.state, candidate.itemId);
                return (
                  <button
                    key={candidate.itemId}
                    className={`problem-row ${props.item.itemId === candidate.itemId ? "selected" : ""}`}
                    onClick={() => props.onOpenItem(candidate)}
                  >
                    <span
                      className={`status-dot stage-${progress.highestStage}`}
                    >
                      {progress.highestStage || ""}
                    </span>
                    <span className="problem-row-copy">
                      <strong>
                        {itemDisplayId(candidate)} {candidate.title}
                      </strong>
                      <small>
                        {candidate.pattern} · {candidate.difficulty}
                      </small>
                    </span>
                    {props.state.favorites.includes(candidate.itemId) && (
                      <span className="favorite-star">★</span>
                    )}
                  </button>
                );
              })}
            </div>
            <button className="rail-link" onClick={props.onBrowse}>
              Browse all {props.items.length} items <span>→</span>
            </button>
            <div className="legend">
              <span>
                <i className="dot-new" />
                New
              </span>
              <span>
                <i className="dot-learning" />
                Learning
              </span>
              <span>
                <i className="dot-owned" />
                Owned
              </span>
            </div>
          </>
        )}
      </aside>
      <section className="practice-main">
        <nav
          className={`mobile-practice-controls${isVirtualRound ? " virtual-round-mobile-controls" : ""}`}
          aria-label="Practice problem controls"
        >
          {isVirtualRound && activeVirtualRound ? (
            <>
              <span className="virtual-round-mobile-status">
                Round {activeVirtualRound.problems.findIndex(
                  (problem) => problem.itemId === props.item.itemId,
                ) + 1}/{activeVirtualRound.problems.length} · {formatMockClock(
                  virtualRoundRemaining ?? 0,
                )}
              </span>
              <label>
                <span className="visually-hidden">Switch round problem</span>
                <select
                  value={props.item.itemId}
                  disabled={checksAreBusy || activeVirtualRound.status !== "active"}
                  aria-label="Switch round problem"
                  onChange={(event) =>
                    props.onVirtualRoundOpenProblem(
                      activeVirtualRound.id,
                      event.target.value,
                    )
                  }
                >
                  {activeVirtualRound.problems.map((problem, index) => (
                    <option value={problem.itemId} key={problem.itemId}>
                      {problem.openedAt ? problem.title : `Problem ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={activeVirtualRound.status !== "active"}
                aria-pressed={currentVirtualRoundProblem?.flagged ?? false}
                onClick={() =>
                  currentVirtualRoundProblem &&
                  props.onVirtualRoundToggleFlag(
                    activeVirtualRound.id,
                    currentVirtualRoundProblem.itemId,
                  )
                }
              >
                {currentVirtualRoundProblem?.flagged ? "Flagged" : "Flag"}
              </button>
              <button
                type="button"
                disabled={checksAreBusy || activeVirtualRound.status !== "active"}
                onClick={() => props.onVirtualRoundFinish(activeVirtualRound.id)}
              >
                Finish
              </button>
            </>
          ) : isTransfer ? (
            <span>Local transfer rehearsal · pattern hidden</span>
          ) : isAssessment ? (
            <span>Assessment checkpoint · pattern hidden</span>
          ) : props.activeSession ? (
            <span>
              Session item {props.activeSession.currentIndex + 1} of{" "}
              {props.activeSession.entries.length}
            </span>
          ) : (
            <label>
              <span className="visually-hidden">Current practice problem</span>
              <select
                value={props.item.itemId}
                onChange={(event) => {
                  const next = props.items.find(
                    (candidate) => candidate.itemId === event.target.value,
                  );
                  if (next)
                    props.onOpenItem(
                      next,
                      props.practiceKind === "solving" ? 5 : undefined,
                      undefined,
                      undefined,
                      props.practiceKind === "solving" && next.verification
                        ? "solving"
                        : "typing",
                    );
                }}
                aria-label="Switch practice problem"
              >
                <optgroup label="Python interview">
                  {props.items
                    .filter(
                      (candidate) =>
                        !candidate.transfer &&
                        candidate.language === "python" &&
                        candidate.track === "interview",
                    )
                    .map((candidate) => (
                      <option value={candidate.itemId} key={candidate.itemId}>
                        {itemDisplayId(candidate)} {candidate.title}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Swift interview">
                  {props.items
                    .filter(
                      (candidate) =>
                        !candidate.transfer &&
                        candidate.language === "swift" &&
                        candidate.track === "interview",
                    )
                    .map((candidate) => (
                      <option value={candidate.itemId} key={candidate.itemId}>
                        {itemDisplayId(candidate)} {candidate.title}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="iOS and Swift">
                  {props.items
                    .filter(
                      (candidate) =>
                        !candidate.transfer && candidate.track === "ios",
                    )
                    .map((candidate) => (
                      <option value={candidate.itemId} key={candidate.itemId}>
                        {itemDisplayId(candidate)} {candidate.title}
                      </option>
                    ))}
                </optgroup>
              </select>
            </label>
          )}
          {!isVirtualRound && <button onClick={resetPractice}>Restart</button>}
          {!props.activeSession && !isAssessment && !isTransfer && !isVirtualRound && (
            <button onClick={props.onRandom}>Random</button>
          )}
        </nav>
        {isTransfer && (
          <button
            className="transfer-workbench-back"
            type="button"
            onClick={props.onSession}
          >
            ← Back to Transfer Lab
          </button>
        )}
        {props.activeSession &&
          props.draft.sessionId === props.activeSession.id && (
            <div className={`session-strip ${isMock ? "mock" : ""}`}>
              <span>
                <small>
                  {isMock
                    ? "Timed mock interview"
                    : props.activeSession.studyPlanId
                      ? `Study plan · task ${props.activeSession.currentIndex + 1} of ${props.activeSession.entries.length}`
                    : `Session ${props.activeSession.currentIndex + 1} of ${props.activeSession.entries.length}`}
                </small>
                <strong>{props.activeSession.name}</strong>
              </span>
              {isMock && mockRemainingMs !== null && (
                <span className="mock-clock" role="timer" aria-live="off">
                  <small>Time remaining</small>
                  <strong>{formatMockClock(mockRemainingMs)}</strong>
                </span>
              )}
              <div>
                {!isLocked && (
                  <button onClick={props.onSkipSession}>Skip item</button>
                )}
                <button onClick={props.onEndSession}>
                  {isMock ? "End mock" : "End session"}
                </button>
              </div>
            </div>
          )}
        <div className="problem-header">
          <div>
            <div className="problem-kicker">
              <span>{itemDisplayId(props.item)}</span>
              <span
                className={`difficulty ${props.item.difficulty.toLowerCase()}`}
              >
                {props.item.difficulty}
              </span>
              <span>{laneLabel(props.item)}</span>
              <span>
                {isLocked || isTransfer ? "Pattern hidden" : props.item.pattern}
              </span>
              {props.item.source === "custom" && <span>Device-local</span>}
            </div>
            <h1>{props.item.title}</h1>
            <p>{props.item.summary}</p>
          </div>
          <div className="problem-actions">
            {!isTransfer && !isVirtualRound && (
              <button
                className={favorite ? "favorite active" : "favorite"}
                onClick={props.onFavorite}
                aria-label={favorite ? "Remove favorite" : "Add favorite"}
              >
              {favorite ? "★" : "☆"}
              </button>
            )}
            {prompt && !isLocked && !isTransfer && (
              <a
                className="outline-button"
                href={prompt}
                target="_blank"
                rel="noreferrer"
              >
                Open prompt ↗
              </a>
            )}
          </div>
        </div>
        {isLocked ? (
          <div className="mock-policy" role="status">
            <span>
              {isVirtualRound
                ? "Virtual round mode locked"
                : isAssessment
                  ? "Assessment mode locked"
                  : "Interview mode locked"}
            </span>
            <strong>Solve from the prompt and executable feedback only.</strong>
            <small>
              Pattern guidance, hints, the reference solution, and prior
              submissions stay out of this view until the timed work ends.
              Sample outputs remain part of the prompt.
            </small>
          </div>
        ) : isTransfer ? (
          <div className="mock-policy transfer-policy" role="status">
            <span>Cold-transfer evidence contract</span>
            <strong>Solve from the prompt before asking for recognition help.</strong>
            <small>
              The pattern stays hidden while you work. Progressive hints remain
              available, but the first hint permanently changes this run from
              independent to assisted on this device.
            </small>
          </div>
        ) : (
        <div className="practice-kind-switch" aria-label="Practice style">
          <button
            className={props.practiceKind === "typing" ? "active" : ""}
            aria-pressed={props.practiceKind === "typing"}
            onClick={() => props.onChoosePracticeKind("typing")}
          >
            <strong>Type</strong>
            <small>Fade the known answer</small>
          </button>
          <button
            className={props.practiceKind === "solving" ? "active" : ""}
            aria-pressed={props.practiceKind === "solving"}
            disabled={
              !canSolveItem(props.item) ||
              Boolean(props.draft.challengeDate || props.draft.sessionId)
            }
            onClick={() => props.onChoosePracticeKind("solving")}
          >
            <strong>Solve</strong>
            <small>
              {props.draft.sessionId
                ? props.practiceKind === "solving"
                  ? "Planned independent solve"
                  : "This session step uses recall typing"
                : canSolveItem(props.item)
                ? props.item.language === "swift"
                  ? "Submit to the isolated Swift judge"
                  : "Write any passing Python solution"
                : "Verified exercises only"}
            </small>
          </button>
          <button
            className={props.practiceKind === "concept" ? "active" : ""}
            aria-pressed={props.practiceKind === "concept"}
            disabled={
              props.item.track !== "ios" ||
              !props.item.recallChecks ||
              !props.item.conceptAnswers ||
              Boolean(
                props.draft.sessionId && props.practiceKind !== "concept",
              )
            }
            onClick={() => props.onChoosePracticeKind("concept")}
          >
            <strong>Recall</strong>
            <small>
              {props.item.track === "ios"
                ? "Answer, reveal, trace, self-grade"
                : "Authored Swift / iOS cards"}
            </small>
          </button>
        </div>
        )}
        {props.practiceKind === "concept" ? (
          <ConceptPractice
            item={props.item}
            checkIndex={props.conceptCheckIndex}
            response={props.draft.value}
            committedResponse={props.draft.conceptCommittedResponse}
            revealed={Boolean(props.draft.conceptCommittedAt)}
            onResponseChange={props.onConceptChange}
            onReveal={props.onConceptReveal}
            onComplete={props.onConceptComplete}
          />
        ) : props.practiceKind === "solving" && canSolveItem(props.item) ? (
          <SolveWorkbench
            mobilePane={mobileWorkspacePane}
            onMobilePaneChange={setMobileWorkspacePane}
            notebookLabel={isStudio ? "Interview" : undefined}
            notebook={
              isStudio && activeStudio ? (
                <div className="interview-notebook-stack">
                  <InterviewStudioPanel
                    compact
                    session={activeStudio as InterviewPanelSession}
                    onCommitResponse={props.onInterviewCommitResponse}
                    onAdvance={props.onInterviewAdvance}
                    onRequestHint={props.onInterviewHint}
                    onFinish={props.onFinishInterview}
                    canFinish={
                      activeStudio.phase === "completed" &&
                      Boolean(acceptedStudioSubmission)
                    }
                    finishLabel="Archive verified interview"
                  />
                  {mockWorkspace && (
                    <details className="interview-notebook-details">
                      <summary>Structured notebook</summary>
                      <MockNotebook
                        notebook={mockWorkspace.notebook}
                        promptReady={
                          mockWorkspace.checkpoints.promptAcknowledged !==
                          undefined
                        }
                        approachReady={
                          mockWorkspace.checkpoints.approachReady !== undefined
                        }
                        onAcknowledgePrompt={() =>
                          props.onMockCheckpoint("promptAcknowledged")
                        }
                        onAcknowledgeApproach={() =>
                          props.onMockCheckpoint("approachReady")
                        }
                        onChange={props.onMockNotebookChange}
                      />
                    </details>
                  )}
                </div>
              ) : isMock && mockWorkspace ? (
                <MockNotebook
                  notebook={mockWorkspace.notebook}
                  promptReady={
                    mockWorkspace.checkpoints.promptAcknowledged !== undefined
                  }
                  approachReady={
                    mockWorkspace.checkpoints.approachReady !== undefined
                  }
                  onAcknowledgePrompt={() =>
                    props.onMockCheckpoint("promptAcknowledged")
                  }
                  onAcknowledgeApproach={() =>
                    props.onMockCheckpoint("approachReady")
                  }
                  onChange={props.onMockNotebookChange}
                />
              ) : undefined
            }
            problem={
              <div className="solve-workbench-problem-content">
                <ChallengeStatement item={props.item} />
                {!isLocked && (
                  <div className="solve-workbench-guidance">
                    <div className="solve-hint-bar">
                      <span>
                        <small>
                          {props.draft.peeks > 0
                            ? "Assisted solve"
                            : "Independent solve"}
                        </small>
                        <strong>
                          {solveHintLevel === 0
                            ? props.draft.peeks > 0
                              ? "Assistance already used"
                              : "No hints used"
                            : `${solveHintLevel} hint${solveHintLevel === 1 ? "" : "s"} used`}
                        </strong>
                      </span>
                      <div className="solve-hint-actions">
                        {props.draft.peeks > 0 && (
                          <span className="assisted-label">Assisted solve</span>
                        )}
                        {solveHintLevel < 3 && (
                          <button
                            className="outline-button"
                            onClick={revealSolveHint}
                          >
                            {solveHintLevel === 0
                              ? "Reveal cue"
                              : solveHintLevel === 1
                                ? "Reveal invariant"
                                : "Reveal reference"}
                          </button>
                        )}
                      </div>
                    </div>
                    {solveHintLevel >= 1 && (
                      <article>
                        <small>Pattern cue</small>
                        <p>{props.item.cue}</p>
                      </article>
                    )}
                    {solveHintLevel >= 2 && (
                      <article>
                        <small>Invariant</small>
                        <p>{props.item.invariant}</p>
                      </article>
                    )}
                    {solveHintLevel >= 3 && (
                      <details className="solve-reference" open>
                        <summary>Reference solution</summary>
                        <pre>{props.item.code}</pre>
                      </details>
                    )}
                  </div>
                )}
                <div className="solve-brief">
                  <span className="eyebrow">
                    {isVirtualRound
                      ? "Timed virtual-round workspace"
                      : isTransfer
                        ? "Cold transfer workspace"
                        : "Verified solve workspace"}
                  </span>
                  <strong>
                    {isVirtualRound
                      ? "Triage, implement, submit, and switch when the clock says to."
                      : isTransfer
                      ? "Commit to an approach, pass every local check, then compare."
                      : "Pass every local check, then submit."}
                  </strong>
                  <p>
                    {isVirtualRound
                      ? "Examples support iteration. Only Submit changes the local round score."
                      : isTransfer
                      ? "Examples help you iterate. Pattern and contrast stay hidden until attempt evidence exists."
                      : "Examples help you iterate. Only a complete accepted judge run records solving evidence."}
                  </p>
                </div>
                {isMock && (
                  <section className="mock-rules">
                    <span className="eyebrow">Mock interview contract</span>
                    <strong>
                      Clarify, plan, implement, test, and explain.
                    </strong>
                    <p>
                      Sample outputs stay in the prompt. Hints and submission
                      history remain out of the interview view.
                    </p>
                  </section>
                )}
                {isVirtualRound && (
                  <section className="mock-rules virtual-round-rules">
                    <span className="eyebrow">Virtual round contract</span>
                    <strong>One clock, any problem order, explicit local scoring.</strong>
                    <p>
                      Submit uses the full local judge. A request made on time may
                      finish judging after the deadline; the report waits for it.
                    </p>
                  </section>
                )}
              </div>
            }
            editor={
              <PracticeEditor
                item={props.item}
                draft={props.draft}
                practiceKind={props.practiceKind}
                settings={props.state.settings}
                metrics={props.metrics}
                ghostCode={props.ghostCode}
                editorLineCount={editorLineCount}
                errorCount={errorCount}
                linesLeft={linesLeft}
                isMock={isLocked}
                readOnly={activeVirtualRound?.status === "finalizing"}
                reveal={props.reveal}
                focusMode={props.focusMode}
                copied={copied}
                hideReveal={isAssessment}
                onCopyLink={() => void copyPracticeLink()}
                onReveal={props.onReveal}
                onRestart={resetPractice}
                onFocusMode={props.onFocusMode}
                onChange={handleEditorChange}
                onRunExamples={() =>
                  isTrustedSwiftSolve
                    ? void runSwiftExamples()
                    : void runPythonChecks(
                        isStudio ? "examples" : isMock ? "full" : "examples",
                      )
                }
                onSubmit={() =>
                  isTrustedSwiftSolve
                    ? void runSwiftSubmit()
                    : void runPythonChecks("submit")
                }
                onKeyDown={handleEditorKeyDown}
                onPaste={props.onPaste}
              />
            }
            tests={
              isTrustedSwiftSolve ? (
                <SwiftSolveConsole
                  item={props.item}
                  assignment={swiftAssignment}
                  submission={swiftSubmission}
                  exampleRun={swiftExampleRun}
                  loadState={swiftLoadState}
                  action={swiftAction}
                  exampleAction={swiftExampleAction}
                  message={swiftMessage}
                  available={props.trustedJudgeAvailable}
                  authenticated={props.trustedJudgeAuthenticated}
                  sourcePresent={Boolean(runnerSource.trim())}
                  retryAvailable={swiftRetryAvailable}
                  onRequestAssignment={() => void loadSwiftAssignment()}
                  onRunExamples={() => void runSwiftExamples()}
                  onSubmit={() => void runSwiftSubmit()}
                />
              ) : (
              <ChallengeConsole
                practiceKind={props.practiceKind}
                isMock={isLocked}
                isStudio={isStudio || isAssessment || isVirtualRound}
                runnerSourcePresent={Boolean(runnerSource.trim())}
                checksAreBusy={checksAreBusy}
                consoleTab={consoleTab}
                onConsoleTabChange={setConsoleTab}
                customCaseInput={customCaseInput}
                defaultCustomCaseInput={defaultCustomCaseInput(
                  props.item.verification!,
                )}
                onCustomCaseInputChange={changeCustomCaseInput}
                onLoadDefaultCustomCase={() =>
                  changeCustomCaseInput(
                    defaultCustomCaseInput(props.item.verification!),
                  )
                }
                onRunCustomCase={runCustomCase}
                customTestcaseSchema={customTestcaseSchema}
                customTestcases={customTestcases}
                onSelectCustomTestcase={(caseId) =>
                  updateStructuredCustomTestcases((collection) =>
                    selectCustomTestcase(collection, caseId),
                  )
                }
                onAddCustomTestcase={(afterCaseId) =>
                  updateStructuredCustomTestcases((collection, schema) =>
                    addCustomTestcase(collection, schema, { afterCaseId }),
                  )
                }
                onDuplicateCustomTestcase={(caseId) =>
                  updateStructuredCustomTestcases((collection) =>
                    duplicateCustomTestcase(collection, caseId),
                  )
                }
                onDeleteCustomTestcase={(caseId) =>
                  updateStructuredCustomTestcases((collection) =>
                    deleteCustomTestcase(collection, caseId),
                  )
                }
                onRenameCustomTestcase={(caseId, name) =>
                  updateStructuredCustomTestcases((collection, schema) =>
                    updateCustomTestcase(collection, schema, caseId, { name }),
                  )
                }
                onCustomTestcaseModeChange={changeCustomTestcaseMode}
                onCustomTestcaseFieldChange={(caseId, parameterId, text) =>
                  updateStructuredCustomTestcases((collection, schema) =>
                    updateCustomTestcaseField(
                      collection,
                      schema,
                      caseId,
                      parameterId,
                      text,
                    ),
                  )
                }
                onCustomTestcaseRawChange={(caseId, raw) =>
                  updateStructuredCustomTestcases((collection, schema) =>
                    updateCustomTestcase(collection, schema, caseId, {
                      mode: "raw",
                      raw,
                    }),
                  )
                }
                onRunCustomTestcases={runCustomCase}
                customExecutionState={visibleCustomExecutionState}
                verificationState={visibleVerificationState}
                exampleExpectedValues={challengeVerificationForPurpose(
                  props.item.verification!,
                  "examples",
                ).cases.map((testCase) => testCase.expected)}
                onRunExamples={() => runPythonChecks("examples")}
                onSubmit={() => runPythonChecks("submit")}
                onRunFull={() => runPythonChecks("full")}
                onCancelRun={cancelPythonRun}
                submissionHistory={submissionHistory.filter(
                  (submission) => submission.itemId === props.item.itemId,
                )}
                currentItemRevision={props.item.contentRevision}
                currentVerificationRevision={props.item.verification!.revision ?? 1}
                currentSource={runnerSource}
                onInspectSubmission={inspectSubmission}
                onRestoreSubmission={restoreSubmission}
                canRecordMock={Boolean(
                  isMock &&
                    visibleVerificationState.status === "passed" &&
                    visibleVerificationState.result &&
                    isRecordableChallengeResult(
                      visibleVerificationState.result,
                      visibleVerificationState.purpose ?? "full",
                      true,
                    ) &&
                    visibleVerificationState.source === runnerSource,
                )}
                onRecordMock={() => {
                  if (!visibleVerificationState.result) return;
                  props.onSolveComplete(
                    runnerSource,
                    visibleVerificationState.result,
                    visibleVerificationState.runs ?? props.draft.testRuns,
                    Math.max(1, props.draft.submissions),
                    "full",
                  );
                }}
              />
              )
            }
          />
        ) : (
          <>
        {props.practiceKind === "solving" && props.item.verification && (
          <ChallengeStatement item={props.item} />
        )}
        {!isLocked && <div className="insight-grid">
          <article>
            <span className="card-icon">⌁</span>
            <div>
              <small>Pattern cue</small>
              <p>
                {props.practiceKind === "typing" || solveHintLevel >= 1
                  ? props.item.cue
                  : "Hidden for independent problem recognition."}
              </p>
            </div>
          </article>
          <article>
            <span className="card-icon">∞</span>
            <div>
              <small>Invariant</small>
              <p>
                {props.practiceKind === "typing" || solveHintLevel >= 2
                  ? props.item.invariant
                  : "Explain the invariant before requesting this hint."}
              </p>
            </div>
          </article>
          <article>
            <span className="card-icon">
              {LANGUAGE_META[props.item.language].short}
            </span>
            <div>
              <small>{LANGUAGE_META[props.item.language].note}</small>
              <p>
                {props.practiceKind === "typing" || solveHintLevel >= 2
                  ? props.item.languageNote
                  : "Use executable feedback only after forming an approach."}
              </p>
            </div>
          </article>
        </div>}
        {props.practiceKind === "solving" && !isLocked && (
          <div className="solve-hint-bar">
            <span>
              <small>Independent solve</small>
              <strong>
                {solveHintLevel === 0
                  ? props.draft.peeks > 0
                    ? "Assistance already used"
                    : "No hints used"
                  : `${solveHintLevel} hint${solveHintLevel === 1 ? "" : "s"} used`}
              </strong>
            </span>
            {solveHintLevel < 3 ? (
              <button className="outline-button" onClick={revealSolveHint}>
                {solveHintLevel === 0
                  ? "Reveal cue"
                  : solveHintLevel === 1
                    ? "Reveal invariant"
                    : "Reveal reference"}
              </button>
            ) : (
              <span className="assisted-label">Assisted solve</span>
            )}
          </div>
        )}
        {props.practiceKind === "solving" && !isLocked && solveHintLevel >= 3 && (
          <details className="solve-reference" open>
            <summary>Reference solution</summary>
            <pre>{props.item.code}</pre>
          </details>
        )}
        {props.practiceKind === "typing" ? (
          <div className="stage-panel">
            <div className="stage-title">
              <span className="eyebrow">
                {props.stage === 1
                  ? "Worked example"
                  : props.stage === 5
                    ? "Blank recall"
                    : "Faded reconstruction"}
              </span>
              <span>{STAGES[props.stage - 1].note}</span>
            </div>
            <div className="stage-track">
              {STAGES.map((step) => (
                <button
                  key={step.id}
                  className={`${props.stage === step.id ? "active" : ""} ${props.stats.typingCompletedStages.includes(step.id as 1 | 2 | 3 | 4 | 5) ? "complete" : ""}`}
                  aria-pressed={props.stage === step.id}
                  disabled={Boolean(
                    props.draft.sessionId || props.draft.assessmentRunId,
                  )}
                  onClick={() => props.onChooseStage(step.id)}
                  title={
                    props.draft.assessmentRunId
                      ? "This assessment checkpoint has a frozen response stage"
                      : props.draft.sessionId
                        ? "This session step has a fixed recall stage"
                        : step.note
                  }
                >
                  <span>
                    {props.stats.typingCompletedStages.includes(
                      step.id as 1 | 2 | 3 | 4 | 5,
                    )
                      ? "✓"
                      : step.id}
                  </span>
                  <small>{step.short}</small>
                </button>
              ))}
            </div>
            <p className="stage-progression-note">
              {props.stats.typingOwned
                ? props.stats.typingRetained
                  ? `Independent recall recorded · review level ${props.stats.typingRecallLevel}`
                  : "Recall lapsed · repeat Stage 5 without help"
                : props.stats.typingDiagnosticOnly
                  ? "Diagnostic only · complete worked then faded practice before another blank recall"
                  : `Next evidence step: Stage ${props.stats.typingNextStage}. Guided stages teach; only ordered blank recall schedules review.`}
            </p>
          </div>
        ) : (
          <div className="solve-brief">
            <span className="eyebrow">Verified solve workspace</span>
            <strong>Pass every local check, then record the solve.</strong>
            <p>
              Alternate correct implementations are welcome. Solve results stay
              separate from typing speed and public leaderboards.
            </p>
          </div>
        )}
          <PracticeEditor
            item={props.item}
            draft={props.draft}
            practiceKind={props.practiceKind}
            settings={props.state.settings}
            metrics={props.metrics}
            ghostCode={props.ghostCode}
            editorLineCount={editorLineCount}
            errorCount={errorCount}
            linesLeft={linesLeft}
            isMock={isLocked}
            readOnly={activeVirtualRound?.status === "finalizing"}
            reveal={props.reveal}
            focusMode={props.focusMode}
            copied={copied}
            hideReveal={isAssessment}
            onCopyLink={() => void copyPracticeLink()}
            onReveal={props.onReveal}
            onRestart={resetPractice}
            onFocusMode={props.onFocusMode}
            onChange={handleEditorChange}
            onRunExamples={() =>
              void runPythonChecks(
                isStudio ? "examples" : isMock ? "full" : "examples",
              )
            }
            onSubmit={() => void runPythonChecks("submit")}
            onKeyDown={handleEditorKeyDown}
            onPaste={props.onPaste}
          />
        {props.item.verification && (
          <ChallengeConsole
            practiceKind={props.practiceKind}
            isMock={isLocked}
            isStudio={isStudio || isAssessment || isVirtualRound}
            runnerSourcePresent={Boolean(runnerSource.trim())}
            checksAreBusy={checksAreBusy}
            consoleTab={consoleTab}
            onConsoleTabChange={setConsoleTab}
            customCaseInput={customCaseInput}
            defaultCustomCaseInput={defaultCustomCaseInput(
              props.item.verification,
            )}
            onCustomCaseInputChange={changeCustomCaseInput}
            onLoadDefaultCustomCase={() =>
              changeCustomCaseInput(
                defaultCustomCaseInput(props.item.verification!),
              )
            }
            onRunCustomCase={runCustomCase}
            customTestcaseSchema={customTestcaseSchema}
            customTestcases={customTestcases}
            onSelectCustomTestcase={(caseId) =>
              updateStructuredCustomTestcases((collection) =>
                selectCustomTestcase(collection, caseId),
              )
            }
            onAddCustomTestcase={(afterCaseId) =>
              updateStructuredCustomTestcases((collection, schema) =>
                addCustomTestcase(collection, schema, { afterCaseId }),
              )
            }
            onDuplicateCustomTestcase={(caseId) =>
              updateStructuredCustomTestcases((collection) =>
                duplicateCustomTestcase(collection, caseId),
              )
            }
            onDeleteCustomTestcase={(caseId) =>
              updateStructuredCustomTestcases((collection) =>
                deleteCustomTestcase(collection, caseId),
              )
            }
            onRenameCustomTestcase={(caseId, name) =>
              updateStructuredCustomTestcases((collection, schema) =>
                updateCustomTestcase(collection, schema, caseId, { name }),
              )
            }
            onCustomTestcaseModeChange={changeCustomTestcaseMode}
            onCustomTestcaseFieldChange={(caseId, parameterId, text) =>
              updateStructuredCustomTestcases((collection, schema) =>
                updateCustomTestcaseField(
                  collection,
                  schema,
                  caseId,
                  parameterId,
                  text,
                ),
              )
            }
            onCustomTestcaseRawChange={(caseId, raw) =>
              updateStructuredCustomTestcases((collection, schema) =>
                updateCustomTestcase(collection, schema, caseId, {
                  mode: "raw",
                  raw,
                }),
              )
            }
            onRunCustomTestcases={runCustomCase}
            customExecutionState={visibleCustomExecutionState}
            verificationState={visibleVerificationState}
            exampleExpectedValues={challengeVerificationForPurpose(
              props.item.verification,
              "examples",
            ).cases.map((testCase) => testCase.expected)}
            onRunExamples={() => runPythonChecks("examples")}
            onSubmit={() => runPythonChecks("submit")}
            onRunFull={() => runPythonChecks("full")}
            onCancelRun={cancelPythonRun}
            submissionHistory={submissionHistory.filter(
              (submission) => submission.itemId === props.item.itemId,
            )}
            currentItemRevision={props.item.contentRevision}
            currentVerificationRevision={props.item.verification.revision ?? 1}
            currentSource={runnerSource}
            onInspectSubmission={inspectSubmission}
            onRestoreSubmission={restoreSubmission}
            canRecordMock={Boolean(
              isMock &&
                visibleVerificationState.status === "passed" &&
                visibleVerificationState.result &&
                isRecordableChallengeResult(
                  visibleVerificationState.result,
                  visibleVerificationState.purpose ?? "full",
                  true,
                ) &&
                visibleVerificationState.source === runnerSource,
            )}
            onRecordMock={() => {
              if (!visibleVerificationState.result) return;
              props.onSolveComplete(
                runnerSource,
                visibleVerificationState.result,
                visibleVerificationState.runs ?? props.draft.testRuns,
                Math.max(1, props.draft.submissions),
                "full",
              );
            }}
          />
        )}
        {isLocked ? (
          <section className="mock-rules">
            <span className="eyebrow">
              {isAssessment ? "Assessment evidence contract" : "Mock interview contract"}
            </span>
            <strong>Recognize, reason, implement, verify, and explain.</strong>
            <p>
              This is local practice evidence, not a proctored score. A clean
              verified solve records independent evidence. Swift/iOS answers
              remain self-assessed and never receive an automated correctness claim.
            </p>
          </section>
        ) : (
        <div className="practice-notes">
          <article>
            <small>
              {props.item.track === "ios"
                ? "Behavior / tradeoff"
                : "Complexity check"}
            </small>
            <strong>{props.item.complexity}</strong>
          </article>
          <article>
            <small>
              {props.item.track === "ios" ? "Recall check" : "Ownership rule"}
            </small>
            <strong>
              {props.item.track === "ios"
                ? (props.item.recallChecks?.[
                    Math.min(2, Math.max(0, props.stage - 2))
                  ] ?? "Explain the API boundary before typing.")
                : props.practiceKind === "solving"
                  ? "A clean all-tests pass records solving evidence. Hints make the attempt assisted; typing records stay separate."
                  : "95%+ accuracy, no peeks. Stage 5 proves independent recall; other passes build syntax."}
            </strong>
          </article>
          {Object.keys(props.errorKeys).length > 0 && (
            <article>
              <small>Recent friction</small>
              <strong>
                {Object.entries(props.errorKeys)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([key, count]) => `${key} ×${count}`)
                  .join(" · ")}
              </strong>
            </article>
          )}
        </div>
        )}
        {!isLocked && props.state.settings.showKeyboard && (
          <KeyboardGuide errors={props.errorKeys} />
        )}
          </>
        )}
      </section>
    </main>
  );
}

function SessionsView({
  state,
  items,
  selectedSessionId,
  onStart,
  onStartMock,
  onStartInterview,
  onInterviewCommitResponse,
  onInterviewAdvance,
  onInterviewHint,
  onFinishInterview,
  now,
  onResume,
  onSkip,
  onEnd,
  onOpenMockDebrief,
  onOpenSessionRecap,
  onCloseSessionRecap,
  onReplaySession,
  onOpenItem,
}: {
  state: AppState;
  items: PracticeItem[];
  selectedSessionId?: string;
  onStart: (
    options: SessionBuildOptions,
    entries?: SessionQueueEntry[],
  ) => void;
  onStartMock: (
    preset: MockInterviewPresetId,
    problemCount: MockInterviewProblemCount,
  ) => void;
  onStartInterview: (
    format: InterviewStudioFormat,
    mode: InterviewStudioMode,
    durationMinutes: 30 | 45 | 60,
  ) => void;
  onInterviewCommitResponse: (text: string) => void;
  onInterviewAdvance: () => void;
  onInterviewHint: () => void;
  onFinishInterview: () => void;
  now: number;
  onResume: () => void;
  onSkip: () => void;
  onEnd: () => void;
  onOpenMockDebrief: (sessionId: string) => void;
  onOpenSessionRecap: (sessionId: string) => void;
  onCloseSessionRecap: () => void;
  onReplaySession: (sessionId: string, mode: SessionReplayMode) => void;
  onOpenItem: (
    item: PracticeItem,
    stage: number,
    practiceKind?: PracticeKind,
  ) => void;
}) {
  const [name, setName] = useState("Focused interview set");
  const [count, setCount] = useState(5);
  const [source, setSource] = useState<SessionSource>("mixed");
  const [track, setTrack] = useState<SessionTrack>("interview");
  const [language, setLanguage] = useState<SessionLanguage>(
    state.settings.preferredLanguage,
  );
  const [pattern, setPattern] = useState<string>("All");
  const [difficulty, setDifficulty] = useState<string>("All");
  const [stageMode, setStageMode] = useState<SessionStageMode>("recommended");
  const [mockProblemCount, setMockProblemCount] =
    useState<MockInterviewProblemCount>(1);
  const [studioFormat, setStudioFormat] =
    useState<InterviewStudioFormat>("python-coding");
  const [studioMode, setStudioMode] =
    useState<InterviewStudioMode>("mock");
  const [studioDuration, setStudioDuration] = useState<30 | 45 | 60>(45);
  const signals = useMemo(
    () =>
      Object.fromEntries(
        items.map((item) => {
          const progress = itemStats(state, item.itemId);
          return [
            item.itemId,
            {
              due: isReviewDue(state, item.itemId),
              favorite: state.favorites.includes(item.itemId),
              completions: progress.completions,
              recommendedStage: recommendedStage(state, item),
              itemRevision: item.contentRevision,
            },
          ];
        }),
      ),
    [items, state],
  );
  const preview = useMemo(
    () =>
      buildSessionQueue(
        items,
        signals,
        { count, source, track, language, pattern, difficulty, stageMode },
        () => 0.5,
      ),
    [
      items,
      signals,
      count,
      source,
      track,
      language,
      pattern,
      difficulty,
      stageMode,
    ],
  );
  const active = state.activeSession;
  const activeStudio = state.interviewStudio.active;
  const activeMockRemaining =
    active?.kind === "mock"
      ? (mockInterviewRemainingMs(active, now) ?? 0)
      : null;
  const selectedSession = selectedSessionId
    ? state.sessionHistory.find(
        (session) =>
          session.id === selectedSessionId && session.kind === "practice",
      )
    : undefined;
  if (selectedSessionId) {
    return (
      <main id="main-content" tabIndex={-1} className="page-container sessions-page">
        {selectedSession ? (
          <SessionRecap
            record={selectedSession}
            state={state}
            items={items}
            onBack={onCloseSessionRecap}
            onReplay={(mode) => onReplaySession(selectedSession.id, mode)}
            onOpenItem={onOpenItem}
          />
        ) : (
          <section className="session-recap session-recap-missing" role="status">
            <button className="text-button" type="button" onClick={onCloseSessionRecap}>
              ← All sessions
            </button>
            <h2>That session recap is unavailable.</h2>
            <p>
              The link may point to a record that was removed by the bounded local history or restored from another device.
            </p>
          </section>
        )}
      </main>
    );
  }
  return (
    <main id="main-content" tabIndex={-1} className="page-container sessions-page">
      <PageHeading
        eyebrow="Deliberate practice"
        title="Practice deliberately, then rehearse the real conversation."
        copy="Use a scripted interviewer for clarification, implementation, testing, tradeoffs, and follow-ups—or build a focused practice queue."
      />
      {activeStudio?.format === "ios-technical" && (
        <section className="active-technical-screen">
          <div className="technical-screen-scenario">
            <span className="eyebrow">Current Swift/iOS scenario</span>
            <h2>{activeStudio.script.title}</h2>
            <p>{activeStudio.script.scenario}</p>
            <small>
              No Swift compiler or automatic correctness claim. Your committed
              answers are compared with authored criteria after completion.
            </small>
          </div>
          <InterviewStudioPanel
            session={activeStudio as InterviewPanelSession}
            responseLabel="Your interview answer"
            onCommitResponse={onInterviewCommitResponse}
            onAdvance={onInterviewAdvance}
            onRequestHint={onInterviewHint}
            onFinish={onFinishInterview}
            canFinish={activeStudio.phase === "completed"}
            finishLabel="Archive technical screen"
          />
        </section>
      )}
      {activeStudio?.format === "python-coding" && active && (
        <section className="studio-resume-banner">
          <div>
            <span className="eyebrow">Interview Studio in progress</span>
            <strong>{activeStudio.script.title}</strong>
            <p>
              {activeStudio.phase === "completed"
                ? "The script is complete. Return to the workspace to archive the verified solution."
                : `Current turn: ${activeStudio.phase.replace("-", " ")}. The transcript and timer survive reloads.`}
            </p>
          </div>
          <button className="primary-button" onClick={onResume}>
            Resume interview →
          </button>
        </section>
      )}
      <section className="interview-studio-launcher">
        <div className="interview-launch-copy">
          <span className="eyebrow">Interview Studio</span>
          <h2>An interviewer that waits for your decisions—not just your code.</h2>
          <p>
            Work through eight forward-only turns. Python screens capture real
            runner evidence. Swift/iOS screens use authored scenarios and never
            pretend to execute or grade Swift.
          </p>
          <ul>
            <li>Clarification and approach before implementation</li>
            <li>Timestamped local transcript and runner evidence</li>
            <li>Pattern-specific follow-ups and post-screen criteria</li>
          </ul>
        </div>
        <div className="interview-launch-controls">
          <fieldset>
            <legend>Screen format</legend>
            <div className="interview-option-grid">
              <label className={studioFormat === "python-coding" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="studio-format"
                  checked={studioFormat === "python-coding"}
                  onChange={() => setStudioFormat("python-coding")}
                />
                <strong>Python coding</strong>
                <small>Real editor, samples, unshown checks, and submissions</small>
              </label>
              <label className={studioFormat === "ios-technical" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="studio-format"
                  checked={studioFormat === "ios-technical"}
                  onChange={() => setStudioFormat("ios-technical")}
                />
                <strong>Swift / iOS screen</strong>
                <small>Authored design, debugging, ownership, and API scenarios</small>
              </label>
            </div>
          </fieldset>
          <div className="interview-control-row">
            <label>
              <span>Interview behavior</span>
              <select
                value={studioMode}
                onChange={(event) =>
                  setStudioMode(event.target.value as InterviewStudioMode)
                }
              >
                <option value="mock">Interview mode · no hints</option>
                <option value="coach">Coach mode · logged hints</option>
              </select>
            </label>
            {studioFormat === "python-coding" ? (
              <label>
                <span>Interview clock</span>
                <select
                  value={studioDuration}
                  onChange={(event) =>
                    setStudioDuration(Number(event.target.value) as 30 | 45 | 60)
                  }
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
                <small>Runs as a real deadline.</small>
              </label>
            ) : (
              <div className="interview-static-control">
                <span>Pacing</span>
                <strong>Self-paced technical screen</strong>
                <small>Finish after your closing explanation.</small>
              </div>
            )}
          </div>
          <button
            className="primary-button interview-start-button"
            type="button"
            onClick={() =>
              onStartInterview(studioFormat, studioMode, studioDuration)
            }
          >
            Start {studioFormat === "python-coding" ? "coding interview" : "technical screen"} →
          </button>
          <small className="interview-privacy-note">
            Transcript stays on this device and is excluded from community
            uploads. No microphone, camera, or network compiler.
          </small>
        </div>
      </section>
      <section className="mock-interview-center">
        <div className="mock-interview-copy">
          <span className="eyebrow">Classic timed mock</span>
          <h2>Prefer the old format? Keep the one- or two-problem clock.</h2>
          <p>
            This simpler mode keeps the existing locked notebook and debrief
            without the scripted interviewer transcript.
          </p>
        </div>
        <fieldset className="mock-problem-count">
          <legend>Interview length</legend>
          <div>
            {MOCK_INTERVIEW_PROBLEM_COUNTS.map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name="mock-problem-count"
                  value={option}
                  checked={mockProblemCount === option}
                  onChange={() => setMockProblemCount(option)}
                />
                <span>
                  {option} problem{option === 1 ? "" : "s"}
                </span>
              </label>
            ))}
          </div>
          <small>
            Two-problem mocks keep the same absolute deadline between problems.
          </small>
        </fieldset>
        <div className="mock-preset-grid">
          {MOCK_INTERVIEW_PRESETS.map((preset) => (
            <article key={preset.id}>
              <span>{preset.durationMinutes} min</span>
              <strong>{preset.label}</strong>
              <small>{preset.note}</small>
              <button
                className="primary-button"
                onClick={() => onStartMock(preset.id, mockProblemCount)}
              >
                Start mock →
              </button>
            </article>
          ))}
        </div>
      </section>
      {active && (
        <section
          className={`active-session-card ${active.kind === "mock" ? "mock" : ""}`}
        >
          <div>
            <span className="eyebrow">In progress</span>
            <h2>{active.name}</h2>
            <p>
              {active.kind === "mock" && activeMockRemaining !== null
                ? `${formatMockClock(activeMockRemaining)} remaining · `
                : ""}
              {
                active.entries.filter((entry) => entry.status === "completed")
                  .length
              }{" "}
              complete ·{" "}
              {
                active.entries.filter((entry) => entry.status === "pending")
                  .length
              }{" "}
              remaining
            </p>
          </div>
          <div
            className="session-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={active.entries.length}
            aria-valuenow={
              active.entries.filter((entry) => entry.status !== "pending")
                .length
            }
            aria-label={`${active.currentIndex + 1} of ${active.entries.length}`}
          >
            <i
              style={{
                width: `${(active.entries.filter((entry) => entry.status !== "pending").length / active.entries.length) * 100}%`,
              }}
            />
          </div>
          <div className="session-actions">
            <button className="primary-button" onClick={onResume}>
              {active.kind === "mock"
                ? "Resume timed mock →"
                : "Resume next item →"}
            </button>
            {active.kind !== "mock" && (
              <button className="outline-button" onClick={onSkip}>
                Skip current
              </button>
            )}
            <button className="outline-button" onClick={onEnd}>
              {active.kind === "mock" ? "End mock" : "End session"}
            </button>
          </div>
          <div className="session-preview-list">
            {active.entries.map((entry, index) => {
              const item = items.find(
                (candidate) => candidate.itemId === entry.itemId,
              );
              return (
                <article
                  className={`${entry.status} ${index === active.currentIndex ? "current" : ""}`}
                  key={`${entry.itemId}-${index}`}
                >
                  <span>
                    {entry.status === "completed"
                      ? "✓"
                      : entry.status === "skipped"
                        ? "–"
                        : index + 1}
                  </span>
                  <div>
                    <strong>{item?.title ?? "Unavailable item"}</strong>
                    <small>
                      {entry.practiceKind === "solving"
                        ? active.kind === "mock"
                          ? "Timed independent solve"
                          : "Independent solve"
                        : `Stage ${entry.stage} recall`}
                      {entry.estimatedMinutes
                        ? ` · ${entry.estimatedMinutes} min`
                        : ""}
                      {` · revision ${entry.itemRevision}`}
                    </small>
                    {entry.rationale && <small>{entry.rationale}</small>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <section className="session-builder">
        <div className="session-form">
          <span className="eyebrow">Session builder</span>
          <h2>{active ? "Plan the next set" : "Choose the work"}</h2>
          <label>
            <span>Session name</span>
            <input
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="form-pair">
            <label>
              <span>Track</span>
              <select
                value={track}
                onChange={(event) => {
                  const next = event.target.value as SessionTrack;
                  setTrack(next);
                  if (next === "ios") setLanguage("swift");
                  setPattern("All");
                }}
              >
                <option value="all">All practice</option>
                <option value="interview">Coding interviews</option>
                <option value="ios">iOS &amp; Swift fundamentals</option>
              </select>
            </label>
            <label>
              <span>Language</span>
              <select
                value={language}
                disabled={track === "ios"}
                onChange={(event) => {
                  setLanguage(event.target.value as SessionLanguage);
                  setPattern("All");
                }}
              >
                <option value="all">Python + Swift</option>
                <option value="python">Python</option>
                <option value="swift">Swift</option>
              </select>
            </label>
          </div>
          <div className="form-pair">
            <label>
              <span>Source</span>
              <select
                value={source}
                onChange={(event) =>
                  setSource(event.target.value as SessionSource)
                }
              >
                <option value="mixed">Smart mix · due first</option>
                <option value="due">Due review only</option>
                <option value="new">New items only</option>
                <option value="favorites">Favorites</option>
                <option value="custom">My snippets</option>
              </select>
            </label>
            <label>
              <span>Number of items</span>
              <select
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              >
                {[3, 5, 8, 10, 15, 20].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-pair">
            <label>
              <span>Pattern</span>
              <select
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
              >
                <option>All</option>
                {(track === "ios"
                  ? IOS_PATTERN_ORDER
                  : language === "python"
                    ? PYTHON_PATTERN_ORDER
                    : language === "swift"
                      ? INTERVIEW_PATTERN_ORDER
                      : PATTERN_ORDER
                ).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Difficulty</span>
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
              >
                <option>All</option>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </label>
          </div>
          <label>
            <span>Recall policy</span>
            <select
              value={stageMode}
              onChange={(event) =>
                setStageMode(event.target.value as SessionStageMode)
              }
            >
              <option value="recommended">Recommended next stage</option>
              <option value="recall">Blank editor for every item</option>
            </select>
          </label>
          <button
            className="primary-button"
            disabled={!preview.length}
            onClick={() =>
              onStart(
                {
                  name,
                  count,
                  source,
                  track,
                  language,
                  pattern,
                  difficulty,
                  stageMode,
                },
                preview,
              )
            }
          >
            {active ? "Replace active session" : "Start session"} ·{" "}
            {preview.length} item{preview.length === 1 ? "" : "s"} →
          </button>
        </div>
        <div className="session-plan">
          <div className="section-head">
            <div>
              <small>Queue preview</small>
              <h2>
                {preview.length
                  ? `${preview.length} selected`
                  : "No matching items"}
              </h2>
            </div>
            <span>Mode and stage lock when started</span>
          </div>
          <div className="session-preview-list">
            {preview.map((entry, index) => {
              const item = items.find(
                (candidate) => candidate.itemId === entry.itemId,
              );
              return (
                <article key={`${entry.itemId}-${index}`}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item?.title}</strong>
                    <small>
                      {item ? laneLabel(item) : "Unavailable"} · {item?.pattern}{" "}
                      ·{" "}
                      {entry.practiceKind === "solving"
                        ? "Independent solve"
                        : entry.practiceKind === "concept"
                          ? "Concept recall"
                        : `Stage ${entry.stage}`}
                    </small>
                  </div>
                </article>
              );
            })}
          </div>
          {!preview.length && (
            <p className="session-empty">
              Broaden the track, language, source, or filters to create this
              queue.
            </p>
          )}
        </div>
      </section>
      <section className="interview-history">
        <div className="section-head">
          <div>
            <small>Evidence replay</small>
            <h2>Interview Studio history</h2>
          </div>
          <span>{state.interviewStudio.history.length} saved locally</span>
        </div>
        {state.interviewStudio.history.length ? (
          <div className="interview-history-list">
            {state.interviewStudio.history
              .slice()
              .reverse()
              .map((session) => {
                const responseCount = session.transcript.filter(
                  (entry) => entry.kind === "candidate-response",
                ).length;
                const hintCount = session.transcript.filter(
                  (entry) => entry.kind === "coach-hint",
                ).length;
                return (
                  <details key={session.id}>
                    <summary>
                      <span>
                        <strong>{session.script.title}</strong>
                        <small>
                          {session.format === "python-coding"
                            ? "Python coding"
                            : "Swift / iOS technical"}
                          {` · ${session.mode === "mock" ? "Interview" : "Coach"} · ${session.outcome} · ${formatDate(session.completedAt)}`}
                        </small>
                      </span>
                      <span className="interview-history-metrics">
                        {responseCount} responses · {session.runnerEvents.length}{" "}
                        runner events · {hintCount} hints
                      </span>
                    </summary>
                    <div className="interview-history-report">
                      <section>
                        <span className="eyebrow">Observed transcript</span>
                        <div className="interview-history-transcript">
                          {session.transcript.map((entry) => (
                            <article key={entry.id}>
                              <header>
                                <strong>
                                  {entry.role === "candidate"
                                    ? "You"
                                    : entry.role === "interviewer"
                                      ? "Interviewer"
                                      : "Evidence"}
                                </strong>
                                <time dateTime={entry.at}>
                                  {formatDate(entry.at)}
                                </time>
                              </header>
                              <p>{entry.text}</p>
                            </article>
                          ))}
                        </div>
                      </section>
                      <section>
                        <span className="eyebrow">Authored review criteria</span>
                        <p>
                          Compare these with your committed answers. Swift/iOS
                          responses are never automatically marked correct.
                        </p>
                        <ol>
                          {session.script.referenceCriteria.map(
                            (criterion, index) => (
                              <li key={`${session.id}-criterion-${index}`}>
                                {criterion}
                              </li>
                            ),
                          )}
                        </ol>
                      </section>
                    </div>
                  </details>
                );
              })}
          </div>
        ) : (
          <p className="interview-history-empty">
            Complete your first scripted interview to unlock transcript replay
            and authored review criteria.
          </p>
        )}
      </section>
      <section className="session-history">
        <div className="section-head">
          <div>
            <small>Recent sets</small>
            <h2>Session history</h2>
          </div>
          <span>{state.sessionHistory.length} saved</span>
        </div>
        {state.sessionHistory.length ? (
          <div>
            {state.sessionHistory
              .slice()
              .reverse()
              .map((session) => (
                <article key={session.id}>
                  <span>
                    <strong>{session.name}</strong>
                    <small>
                      {session.kind === "mock"
                        ? `Mock · ${session.durationMinutes ?? 45} min · ${session.outcome ?? "ended"}`
                        : "Practice session"}
                      {` · ${formatDate(session.completedAt)}`}
                    </small>
                  </span>
                  {session.kind === "mock" &&
                  session.problems?.length === session.problemCount ? (
                    <button
                      className="outline-button"
                      type="button"
                      onClick={() => onOpenMockDebrief(session.id)}
                    >
                      {session.debrief?.completedAt
                        ? "Open debrief"
                        : "Debrief mock"}
                    </button>
                  ) : session.kind === "practice" ? (
                    <>
                      <b>{`${session.completed}/${session.total}`}</b>
                      <button
                        className="outline-button"
                        type="button"
                        onClick={() => onOpenSessionRecap(session.id)}
                      >
                        {session.entries?.length ? "Open recap" : "View summary"}
                      </button>
                    </>
                  ) : (
                    <b>{`${session.completed}/${session.total}`}</b>
                  )}
                </article>
              ))}
          </div>
        ) : (
          <p>No finished sessions yet. Your first summary will land here.</p>
        )}
      </section>
    </main>
  );
}

const RECORDS_SECTION_LABELS: Record<RecordsSection, string> = {
  overview: "Overview",
  activity: "Activity",
  trends: "Trends",
  transfer: "Transfer",
  submissions: "Submissions",
  closures: "Closures",
  fluency: "Fluency",
  reviews: "Reviews",
};

function RecordsSectionSwitch({
  section,
  onChange,
}: {
  section: RecordsSection;
  onChange: (section: RecordsSection) => void;
}) {
  const sections = Object.keys(RECORDS_SECTION_LABELS) as RecordsSection[];
  return (
    <div className="records-section-switch" role="group" aria-label="Records section">
      {sections.map((candidate) => (
        <button
          className={candidate === section ? "is-active" : undefined}
          type="button"
          aria-current={candidate === section ? "page" : undefined}
          onClick={() => candidate !== section && onChange(candidate)}
          key={candidate}
        >
          {RECORDS_SECTION_LABELS[candidate]}
        </button>
      ))}
    </div>
  );
}

function RecordsView({
  state,
  items,
  section,
  reviewAttemptId,
  closureRouteId,
  attemptClosureModel,
  fluencyClinicRouteId,
  fluencyClinicModel,
  transferRecordVariantId,
  transferRecordAttemptId,
  submissionQuery,
  now,
  transferVariants,
  transferTotals,
  cloud,
  onOpen,
  onReview,
  onAssess,
  onToggleUploads,
  onCloudRefresh,
  onSectionChange,
  onResumeChallengeSet,
  onOpenChallengeSetExecution,
  onArchiveChallengeSet,
  onSelectAttemptClosure,
  onSaveAttemptClosure,
  onCompleteAttemptClosure,
  onRetryAttemptClosure,
  onSelectFluencyClinic,
  onSaveFluencyClinicPass,
  onOpenFluencyReconstruction,
  onOpenFluencyTransfer,
  onOpenWeakLineInFluencyClinic,
  onSelectTransferRecord,
  onOpenTransferVariant,
  onSubmissionQueryChange,
  onSaveSubmissionAnnotation,
  onOpenSubmissionClean,
  onContinueFromSubmission,
  onOpenSolutionReview,
  onSaveSolutionReview,
  onCompleteSolutionReview,
  onCloseSolutionReview,
  onRetrySolutionReview,
}: {
  state: AppState;
  items: PracticeItem[];
  section: RecordsSection;
  reviewAttemptId?: string;
  closureRouteId?: string;
  attemptClosureModel: ReturnType<typeof deriveAttemptClosureModel>;
  fluencyClinicRouteId?: string;
  fluencyClinicModel: ReturnType<typeof deriveFluencyClinicModel>;
  transferRecordVariantId?: string;
  transferRecordAttemptId?: string;
  submissionQuery: SubmissionWorkLogQuery;
  now: number;
  transferVariants: TransferVariant[];
  transferTotals: TransferTotals;
  cloud: CloudRuntime;
  onOpen: (
    item: PracticeItem,
    stage?: number,
    challengeDate?: string,
    sessionId?: string,
    practiceKind?: PracticeKind,
  ) => void;
  onReview: () => void;
  onAssess: (assessmentId?: string) => void;
  onToggleUploads: (enabled: boolean) => void;
  onCloudRefresh: () => void;
  onSectionChange: (section: RecordsSection) => void;
  onResumeChallengeSet: (
    manifestId: string,
    execution: RunManifestExecution,
  ) => void;
  onOpenChallengeSetExecution: (execution: RunManifestExecution) => void;
  onArchiveChallengeSet: (manifestId: string) => void;
  onSelectAttemptClosure: (closureId?: string) => void;
  onSaveAttemptClosure: (
    closureId: string,
    patch: Partial<
      Pick<
        AttemptClosureRecord,
        | "mistakeTags"
        | "firstWrongDecision"
        | "verificationNotes"
        | "teachBack"
        | "grade"
      >
    >,
    expectedUpdatedAt: string,
  ) => boolean;
  onCompleteAttemptClosure: (
    closureId: string,
    expectedUpdatedAt: string,
  ) => boolean;
  onRetryAttemptClosure: (closureId: string) => void;
  onSelectFluencyClinic: (caseId?: string) => void;
  onSaveFluencyClinicPass: (
    caseId: string,
    input: {
      kind: FluencyClinicPassKind;
      startedAt: string;
      durationMs: number;
      corrections: number;
    },
    expectedRevision: number,
  ) => void;
  onOpenFluencyReconstruction: (record: FluencyClinicRecord) => void;
  onOpenFluencyTransfer: (record: FluencyClinicRecord) => void;
  onOpenWeakLineInFluencyClinic: (
    item: PracticeItem,
    weakLine: WeakLine,
  ) => void;
  onSelectTransferRecord: (variantId?: string, attemptId?: string) => void;
  onOpenTransferVariant: (variantId: string) => void;
  onSubmissionQueryChange: (
    query: SubmissionWorkLogQuery,
    history: "push" | "replace",
  ) => void;
  onSaveSubmissionAnnotation: (
    submissionId: string,
    annotation: Pick<SubmissionAnnotation, "note" | "tags">,
  ) => void;
  onOpenSubmissionClean: (item: PracticeItem) => void;
  onContinueFromSubmission: (
    receipt: SubmissionReceipt,
    item: PracticeItem,
    source: string,
  ) => void;
  onOpenSolutionReview: (attemptId: string) => void;
  onSaveSolutionReview: (review: SolutionReviewRecord) => boolean;
  onCompleteSolutionReview: (review: SolutionReviewRecord) => boolean;
  onCloseSolutionReview: () => void;
  onRetrySolutionReview: (attemptId: string) => void;
}) {
  const curriculumRecordItems = items.filter((item) => !item.transfer);
  if (section === "activity") {
    const reports = state.runManifests.manifests.flatMap((manifest) => {
      const report = deriveRunManifestReport(
        manifest,
        {
          attempts: state.attempts,
          submissions: state.submissionLog.receipts,
        },
        BUILTIN_ITEMS,
      );
      return report ? [report] : [];
    });
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="page-container challenge-set-activity-page"
      >
        <PageHeading
          eyebrow="Private run ledger"
          title="Every selected problem set, in one place."
          copy="Reopen the exact catalog snapshot, see attempts and judge receipts tied to its execution, and keep current-revision acceptance separate from mastery or interview readiness."
        />
        <RecordsSectionSwitch section="activity" onChange={onSectionChange} />
        <ChallengeSetActivity
          workspace={state.runManifests}
          reports={reports}
          onResume={onResumeChallengeSet}
          onOpenExecution={onOpenChallengeSetExecution}
          onArchive={onArchiveChallengeSet}
        />
      </main>
    );
  }
  if (section === "fluency") {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="page-container fluency-clinic-page"
      >
        <PageHeading
          eyebrow="Private implementation evidence"
          title="Repair the exact syntax that keeps breaking."
          copy="Move from progressively weaker line cues to a fresh full reconstruction, a delayed blank recheck, and a source-mapped sibling—without turning guided repetitions into a mastery claim."
        />
        <RecordsSectionSwitch section="fluency" onChange={onSectionChange} />
        <FluencyClinic
          model={fluencyClinicModel}
          workspaceRevision={state.fluencyClinic.revision}
          routedCaseId={fluencyClinicRouteId}
          onSelect={onSelectFluencyClinic}
          onRecordPass={onSaveFluencyClinicPass}
          onOpenReconstruction={onOpenFluencyReconstruction}
          onOpenTransfer={onOpenFluencyTransfer}
        />
      </main>
    );
  }
  if (section === "trends") {
    return (
      <main id="main-content" tabIndex={-1} className="page-container">
        <PageHeading
          eyebrow="Private longitudinal evidence"
          title="See the shape of your practice."
          copy="Compare current-revision evidence across time without collapsing independent solves, retrieval, explanations, and language balance into a misleading readiness score."
        />
        <RecordsSectionSwitch section="trends" onChange={onSectionChange} />
        <ReadinessTrends
          state={state}
          items={curriculumRecordItems}
          now={now}
        />
      </main>
    );
  }

  if (section === "transfer") {
    const model = buildTransferRecords({
      variants: items.filter((candidate) => Boolean(candidate.transfer)),
      workspace: state.transferWorkspace,
      attempts: state.attempts,
      submissionLog: state.submissionLog,
      reviews: state.solutionReviews,
      now: new Date(now).toISOString(),
    });
    return (
      <main id="main-content" tabIndex={-1} className="page-container transfer-records-page">
        <PageHeading
          eyebrow="Private transfer ledger"
          title="Follow the evidence, not the feeling."
          copy="Separate a first cold proof from a delayed recheck, an early reconstruction, or a help-contaminated retry—then reopen the exact attempt, source receipt, and review that produced it."
        />
        <RecordsSectionSwitch section="transfer" onChange={onSectionChange} />
        <TransferEvidenceRecords
          model={model}
          variants={transferVariants}
          selectedVariantId={transferRecordVariantId}
          selectedAttemptId={transferRecordAttemptId}
          onSelect={onSelectTransferRecord}
          onOpenVariant={onOpenTransferVariant}
          onOpenSubmission={(submissionId) =>
            onSubmissionQueryChange(
              normalizeSubmissionWorkLogQuery({
                ...DEFAULT_SUBMISSION_WORK_LOG_QUERY,
                origins: ["transfer"],
                selectedId: submissionId,
              }),
              "push",
            )
          }
          onOpenReview={onOpenSolutionReview}
          onOpenLab={() => onAssess("transfer-lab")}
        />
      </main>
    );
  }

  if (section === "closures") {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="page-container attempt-closure-page"
      >
        <PageHeading
          eyebrow="Private remediation ledger"
          title="Close the loop before the next clean solve."
          copy="Wrong answers and abandoned solves keep their exact local evidence anchor. Name the first wrong decision, plan verification, teach it back, and return tomorrow without turning reflection into a mastery claim."
        />
        <RecordsSectionSwitch section="closures" onChange={onSectionChange} />
        {closureRouteId && !attemptClosureModel.selected ? (
          <p className="solution-review-route-warning" role="status">
            That closure is unavailable, stale, or no longer linked to surviving local evidence.
          </p>
        ) : null}
        <AttemptClosureCenter
          workspace={state.attemptClosures}
          model={attemptClosureModel}
          items={items}
          selectedId={closureRouteId}
          onSelect={onSelectAttemptClosure}
          onSave={onSaveAttemptClosure}
          onComplete={onCompleteAttemptClosure}
          onRetry={onRetryAttemptClosure}
        />
      </main>
    );
  }

  if (section === "reviews") {
    const reviewableAttempts = state.attempts
      .filter(
        (attempt) =>
          attempt.practiceKind === "solving" &&
          attempt.outcome === "completed" &&
          Boolean(attempt.verification) &&
          (attempt.verification?.total ?? 0) > 0 &&
          attempt.verification?.passed === attempt.verification?.total,
      )
      .sort(
        (left, right) =>
          Date.parse(right.completedAt) - Date.parse(left.completedAt),
      );
    const activeReview = reviewAttemptId
      ? state.solutionReviews.find(
          (review) => review.attemptId === reviewAttemptId,
        )
      : undefined;
    const activeAttempt = activeReview
      ? state.attempts.find(
          (attempt) => attempt.id === activeReview.attemptId,
        )
      : undefined;
    const activeItem = activeAttempt
      ? items.find((candidate) => candidate.itemId === activeAttempt.itemId)
      : undefined;
    const guide =
      activeItem &&
      (activeItem.itemId.startsWith("python:") ||
        activeItem.itemId.startsWith("transfer:"))
        ? getSolutionGuide(activeItem.itemId, activeReview?.itemRevision)
        : null;
    if (activeReview && activeAttempt && activeItem) {
      return (
        <SolutionReviewWorkspace
          key={`${activeReview.attemptId}:${activeReview.updatedAt}`}
          review={activeReview}
          attempt={activeAttempt}
          item={activeItem}
          submittedSource={
            activeReview.submissionId
              ? resolveSubmissionSource(
                  state.submissionLog,
                  activeReview.submissionId,
                )
              : null
          }
          guide={guide}
          onSave={onSaveSolutionReview}
          onComplete={onCompleteSolutionReview}
          onExit={onCloseSolutionReview}
          onRetry={() => onRetrySolutionReview(activeAttempt.id)}
        />
      );
    }
    return (
      <main id="main-content" tabIndex={-1} className="page-container">
        <PageHeading
          eyebrow="Private learning workspace"
          title="Solution review library."
          copy="Explain first, compare against reviewed project-authored guides, capture the first wrong turn, teach it back, and schedule the next retrieval. Accepted attempts remain immutable."
        />
        <RecordsSectionSwitch section="reviews" onChange={onSectionChange} />
        {reviewAttemptId && !activeReview ? (
          <p className="solution-review-route-warning" role="status">
            That review is unavailable or no longer linked to a surviving accepted attempt. No attempt was inferred from timestamps or matching code.
          </p>
        ) : null}
        <section className="solution-review-library" aria-labelledby="solution-review-library-title">
          <div className="section-head">
            <div><small>Accepted local solves</small><h2 id="solution-review-library-title">Reviewable attempts</h2></div>
            <span>{state.solutionReviews.filter((review) => review.status === "completed").length} complete · {state.solutionReviews.filter((review) => review.status === "draft").length} drafts</span>
          </div>
          <p className="solution-review-library-trust">References are bundled project-authored content. There are no synthetic votes, peer counts, acceptance rates, “fastest” claims, or automated explanation grades.</p>
          {reviewableAttempts.length ? (
            <div className="solution-review-library-list">
              {reviewableAttempts.map((attempt) => {
                const saved = state.solutionReviews.find(
                  (review) => review.attemptId === attempt.id,
                );
                return (
                  <article key={attempt.id}>
                    <div>
                      <small>{attempt.qualification === "solved" ? "Independent accepted" : "Assisted accepted"} · {formatDate(attempt.completedAt)}</small>
                      <strong>{attempt.titleSnapshot}</strong>
                      <span>{attempt.verification?.passed}/{attempt.verification?.total} checks · prompt revision {attempt.itemRevision}</span>
                    </div>
                    <span className={`solution-review-library-status is-${saved?.status ?? "ready"}`}>
                      {saved?.status === "completed" ? "Completed" : saved ? `Draft · ${saved.step.replaceAll("-", " ")}` : "Ready"}
                    </span>
                    <button className={saved ? "outline-button" : "primary-button"} type="button" onClick={() => onOpenSolutionReview(attempt.id)}>
                      {saved?.status === "completed" ? "Open review" : saved ? "Resume review" : "Start review"}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-history"><strong>No accepted solves to review yet.</strong><p>Submit a Python solution that passes every local check. The accepted result will unlock an explain-first review.</p></div>
          )}
        </section>
      </main>
    );
  }
  if (section === "submissions") {
    return (
      <main id="main-content" tabIndex={-1} className="page-container">
        <PageHeading
          eyebrow="Records workspace"
          title="Evidence you can reopen."
          copy="Every submit creates a durable local receipt before judging starts. Inspect exact sources, compare attempts, and turn mistakes into the next clean retry."
        />
        <RecordsSectionSwitch section="submissions" onChange={onSectionChange} />
        <SubmissionWorkLog
          log={state.submissionLog}
          annotations={state.submissionAnnotations}
          items={items}
          query={submissionQuery}
          now={now}
          onQueryChange={onSubmissionQueryChange}
          onSaveAnnotation={onSaveSubmissionAnnotation}
          onOpenClean={onOpenSubmissionClean}
          onContinueAssisted={onContinueFromSubmission}
          reviewAttemptIdsBySubmission={Object.fromEntries(
            state.attempts.flatMap((attempt) =>
              attempt.submissionId
                ? [[attempt.submissionId, attempt.id] as const]
                : [],
            ),
          )}
          closureIdsBySubmission={Object.fromEntries(
            attemptClosureModel.records.flatMap((closure) =>
              closure.anchorSubmissionId
                ? [[closure.anchorSubmissionId, closure.id] as const]
                : [],
            ),
          )}
          onOpenAttemptClosure={onSelectAttemptClosure}
          onOpenSolutionReview={onOpenSolutionReview}
        />
      </main>
    );
  }
  const attempts = completedAttempts(state);
  const typingAttempts = attempts.filter(
    (attempt) => attempt.practiceKind === "typing",
  );
  const solveAttempts = attempts.filter(
    (attempt) => attempt.practiceKind === "solving",
  );
  const conceptAttempts = attempts.filter(
    (attempt) => attempt.practiceKind === "concept",
  );
  const mockHistory = state.sessionHistory.filter(
    (session) => session.kind === "mock",
  );
  const verifiedMocks = mockHistory.filter(
    (session) => session.outcome === "completed" && session.completed > 0,
  );
  const assessmentReports = state.assessments.runs
    .map((run) => ({ run, report: deriveAssessmentReport(run) }))
    .filter(
      (entry): entry is typeof entry & { report: NonNullable<typeof entry.report> } =>
        Boolean(entry.report),
    );
  const latestAssessmentReport = assessmentReports.at(-1);
  const eligible = attempts.filter(eligibleAttempt);
  const currentEligible = eligible.filter((attempt) =>
    curriculumRecordItems.some(
      (item) =>
        item.itemId === attempt.itemId &&
        item.contentRevision === attempt.itemRevision,
    ),
  );
  const recent = typingAttempts.slice(-14);
  const avgWpm = currentEligible.length
    ? Math.round(
        currentEligible.reduce((sum, attempt) => sum + attempt.wpm, 0) /
          currentEligible.length,
      )
    : 0;
  const avgAccuracy = typingAttempts.length
    ? Math.round(
        typingAttempts.reduce((sum, attempt) => sum + attempt.accuracy, 0) /
          typingAttempts.length,
      )
    : 0;
  const owned = curriculumRecordItems.filter(
    (item) => itemStats(state, item.itemId).owned,
  ).length;
  const due = curriculumRecordItems.filter((item) =>
    isReviewDue(state, item.itemId),
  );
  const maxWpm = Math.max(1, ...recent.map((attempt) => attempt.wpm));
  const patternStats = PATTERN_ORDER.map((pattern) => {
    const group = BUILTIN_ITEMS.filter(
      (item) => !item.transfer && item.pattern === pattern,
    );
    const points = group.reduce(
      (sum, item) => sum + itemStats(state, item.itemId).highestStage,
      0,
    );
    return {
      pattern,
      percent: Math.round((points / (group.length * 5)) * 100),
      count: group.length,
    };
  });
  const bests = currentEligible
    .reduce<AttemptRecord[]>((records, attempt) => {
      const existing = records.findIndex(
        (record) =>
          record.itemId === attempt.itemId &&
          record.itemRevision === attempt.itemRevision &&
          record.stage === attempt.stage &&
          record.mode === attempt.mode,
      );
      if (existing < 0) records.push(attempt);
      else if (
        attempt.wpm > records[existing].wpm ||
        (attempt.wpm === records[existing].wpm &&
          attempt.accuracy > records[existing].accuracy)
      )
        records[existing] = attempt;
      return records;
    }, [])
    .sort((a, b) => b.wpm - a.wpm)
    .slice(0, 8);
  const trackCoverage = (["python", "swift", "ios"] as const).map((lane) => {
    const group = curriculumRecordItems.filter((item) => matchesLane(item, lane));
    const started = group.filter(
      (item) => itemStats(state, item.itemId).completions > 0,
    ).length;
    const trackOwned = group.filter(
      (item) => itemStats(state, item.itemId).owned,
    ).length;
    return {
      lane,
      total: group.length,
      started,
      owned: trackOwned,
      percent: group.length
        ? lane === "ios"
          ? Math.round((trackOwned / group.length) * 100)
          : Math.round(
              (group.reduce(
                (sum, item) => sum + itemStats(state, item.itemId).highestStage,
                0,
              ) /
                (group.length * 5)) *
                100,
            )
        : 0,
    };
  });
  const friction = Object.entries(
    state.attempts.reduce<Record<string, number>>((counts, attempt) => {
      Object.entries(attempt.keyErrors).forEach(([key, count]) => {
        counts[key] = (counts[key] ?? 0) + count;
      });
      return counts;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxFriction = Math.max(1, ...friction.map(([, count]) => count));
  return (
    <main id="main-content" tabIndex={-1} className="page-container">
      <PageHeading
        eyebrow="Local profile + community beta"
        title="Records you can trust."
        copy="Your learning history stays local. If you opt in, built-in completed runs can also power a private profile, recent activity, and server-ranked community records."
      />
      <RecordsSectionSwitch section="overview" onChange={onSectionChange} />
      <CommunityPanel
        state={state}
        items={curriculumRecordItems}
        status={cloud.status}
        session={cloud.session}
        onToggleUploads={onToggleUploads}
        onRefresh={onCloudRefresh}
      />
      <ReadinessAnalytics
        state={state}
        items={curriculumRecordItems}
        dueCount={due.length}
      />
      <section className="dashboard-card assessment-records-card">
        <div className="section-head">
          <div>
            <small>Calibration history</small>
            <h2>Baseline evidence</h2>
          </div>
          <span>{assessmentReports.length} saved run{assessmentReports.length === 1 ? "" : "s"}</span>
        </div>
        {latestAssessmentReport ? (
          <div className="assessment-records-summary">
            <div>
              <strong>{latestAssessmentReport.report.title}</strong>
              <p>{latestAssessmentReport.report.disclaimer}</p>
            </div>
            <div>
              <span>
                {latestAssessmentReport.report.completion.debriefed}/
                {latestAssessmentReport.report.completion.total}
              </span>
              <small>checkpoints reflected</small>
            </div>
            <button
              className="outline-button"
              onClick={() => onAssess(latestAssessmentReport.run.id)}
            >
              Open detailed report →
            </button>
          </div>
        ) : (
          <div className="assessment-records-empty">
            <p>
              No baseline yet. Start with a short Python checkpoint so future
              practice recommendations have something concrete to work from.
            </p>
            <button className="outline-button" onClick={() => onAssess("python-reentry")}>
              Start a baseline →
            </button>
          </div>
        )}
      </section>
      <section className="dashboard-card assessment-records-card transfer-records-card">
        <div className="section-head">
          <div>
            <small>Local cold-transfer history</small>
            <h2>Transfer evidence</h2>
          </div>
          <span>
            {transferTotals.proven} proven · {transferTotals.due} due
          </span>
        </div>
        <div className="assessment-records-summary">
          <div>
            <strong>
              {transferTotals.unseen} of {transferTotals.total} variants remain
              unseen in this device&apos;s Swift Ghost history
            </strong>
            <p>
              Independent and assisted results stay separate. These are local
              practice signals—not proctored, identity-verified credentials.
            </p>
            {transferVariants.some((entry) => entry.status !== "unseen") ? (
              <small>
                {transferVariants
                  .filter((entry) => entry.status !== "unseen")
                  .slice(-3)
                  .map(
                    (entry) =>
                      `${entry.displayLabel}: ${entry.status.replaceAll("-", " ")}`,
                  )
                  .join(" · ")}
              </small>
            ) : null}
          </div>
          <div>
            <span>{transferTotals.proven}</span>
            <small>current-revision independent proofs</small>
          </div>
          <div className="transfer-records-actions">
            <button
              className="primary-button"
              onClick={() => onSelectTransferRecord()}
            >
              View transfer records →
            </button>
            <button
              className="outline-button"
              onClick={() => onAssess("transfer-lab")}
            >
              Open Transfer Lab
            </button>
          </div>
        </div>
      </section>
      <div className="stat-grid">
        <StatCard
          label="Completed passes"
          value={String(attempts.length)}
          note={`${solveAttempts.length} solves · ${conceptAttempts.length} concept recalls · ${currentEligible.length} typing records`}
        />
        <StatCard
          label="Eligible speed"
          value={`${avgWpm} WPM`}
          note={`${avgAccuracy}% average across all passes`}
        />
        <StatCard
          label="Current streak"
          value={`${activeStreak(state)} days`}
          note={`${practicedMinutesToday(state)} minutes today`}
        />
        <StatCard
          label="Mock interviews"
          value={`${verifiedMocks.length}/${mockHistory.length}`}
          note={
            mockHistory.length
              ? `${mockHistory.filter((session) => session.outcome === "expired").length} expired · ${mockHistory.filter((session) => session.outcome === "ended").length} ended early`
              : "Start a timed mock from Sessions"
          }
        />
        <StatCard
          label="Owned solutions"
          value={`${owned}/${curriculumRecordItems.length}`}
          note="Clean typing, self-rated concept recall, or verified solve"
        />
      </div>
      <div className="dashboard-grid">
        <section className="dashboard-card chart-card">
          <div className="section-head">
            <div>
              <small>Last 14 completed typing passes</small>
              <h2>Typing rhythm</h2>
            </div>
            <span>WPM</span>
          </div>
          {recent.length ? (
            <div className="bar-chart">
              {recent.map((attempt) => (
                <div
                  className={`bar-column ${eligibleAttempt(attempt) ? "" : "assisted"}`}
                  key={attempt.id}
                  title={`${attempt.wpm} WPM · ${attempt.accuracy}% · ${attempt.qualification}`}
                >
                  <span>{attempt.wpm}</span>
                  <i
                    style={{
                      height: `${Math.max(8, (attempt.wpm / maxWpm) * 100)}%`,
                    }}
                  />
                  <small>S{attempt.stage}</small>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart />
          )}
        </section>
        <section className="dashboard-card review-card">
          <div className="section-head">
            <div>
              <small>Spaced review</small>
              <h2>{due.length ? `${due.length} due now` : "Queue is clear"}</h2>
            </div>
            <span className="review-orbit">↻</span>
          </div>
          <p>
            Clean passes expand from 1 to 30 days. Peeks, low accuracy, and
            abandoned attempts return tomorrow and reduce the interval.
          </p>
          {due.slice(0, 3).map((item) => (
            <button
              className="review-row"
              key={item.itemId}
              onClick={() => onOpen(item)}
            >
              <span>
                {itemDisplayId(item)} {item.title}
              </span>
              <strong>Stage {recommendedStage(state, item)} →</strong>
            </button>
          ))}
          <button
            className="primary-button"
            disabled={!due.length}
            onClick={onReview}
          >
            {due.length ? "Start due review" : "Nothing due yet"}
          </button>
        </section>
      </div>
      <section className="dashboard-card milestone-card">
        <div className="section-head">
          <div>
            <small>Learning milestones</small>
            <h2>Evidence of durable recall</h2>
          </div>
          <span>
            {milestones(state).filter((milestone) => milestone.achieved).length}
            /{milestones(state).length} unlocked
          </span>
        </div>
        <div className="milestone-grid">
          {milestones(state).map((milestone) => (
            <article
              className={milestone.achieved ? "achieved" : ""}
              key={milestone.id}
            >
              <span>{milestone.achieved ? "✓" : "○"}</span>
              <div>
                <strong>{milestone.title}</strong>
                <small>{milestone.note}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="dashboard-card mastery-card">
        <div className="section-head">
          <div>
            <small>Curriculum coverage</small>
            <h2>Pattern mastery</h2>
          </div>
          <span>
            {patternStats.filter((pattern) => pattern.percent > 0).length}/
            {patternStats.length} patterns started
          </span>
        </div>
        <div className="mastery-grid">
          {patternStats.map((value) => (
            <div className="mastery-row" key={value.pattern}>
              <span>
                <strong>{value.pattern}</strong>
                <small>{value.count} problems</small>
              </span>
              <div>
                <i style={{ width: `${value.percent}%` }} />
              </div>
              <b>{value.percent}%</b>
            </div>
          ))}
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="dashboard-card">
          <div className="section-head">
            <div>
              <small>Three learning lanes</small>
              <h2>Track coverage</h2>
            </div>
            <span>Independent recall</span>
          </div>
          <div className="track-coverage">
            {trackCoverage.map((value) => (
              <article key={value.lane}>
                <span>
                  <strong>
                    {value.lane === "ios"
                      ? "iOS & Swift fundamentals"
                      : `${LANGUAGE_META[value.lane].label} interviews`}
                  </strong>
                  <small>
                    {value.started} started · {value.owned} owned ·{" "}
                    {value.total} total
                  </small>
                </span>
                <div>
                  <i style={{ width: `${value.percent}%` }} />
                </div>
                <b>{value.percent}%</b>
              </article>
            ))}
          </div>
        </section>
        <section className="dashboard-card">
          <div className="section-head">
            <div>
              <small>Across every attempt</small>
              <h2>Key friction</h2>
            </div>
            <span>Persisted misses</span>
          </div>
          {friction.length ? (
            <div className="friction-list">
              {friction.map(([key, count]) => (
                <div key={key}>
                  <span>
                    <kbd>{key === " " ? "space" : key}</kbd>
                    <small>{count} misses</small>
                  </span>
                  <i>
                    <b style={{ width: `${(count / maxFriction) * 100}%` }} />
                  </i>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-history">
              Mistyped keys will accumulate here after practice.
            </div>
          )}
        </section>
      </div>
      <LearningAnalytics
        attempts={state.attempts}
        items={items}
        onOpenFluencyClinic={onOpenWeakLineInFluencyClinic}
      />
      <section className="dashboard-card records-card">
        <div className="section-head">
          <div>
            <small>Qualified only</small>
            <h2>Personal bests</h2>
          </div>
          <span>Exact item · stage · mode</span>
        </div>
        {bests.length ? (
          <div className="records-grid">
            {bests.map((attempt) => (
              <article key={attempt.id}>
                <span>
                  <small>
                    {LANGUAGE_META[attempt.language].label} · {attempt.mode} ·
                    stage {attempt.stage}
                  </small>
                  <strong>{attempt.titleSnapshot}</strong>
                </span>
                <b>
                  {attempt.wpm}
                  <small> WPM</small>
                </b>
                <em>{attempt.accuracy}%</em>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-history">
            Complete a 95%+ no-peek pass to set your first personal best.
          </div>
        )}
      </section>
      <section className="dashboard-card history-card">
        <div className="section-head">
          <div>
            <small>Bounded local log</small>
            <h2>Attempt history</h2>
          </div>
          <span>{state.attempts.length} recorded</span>
        </div>
        <div className="history-table">
          <div className="history-head">
            <span>Item</span>
            <span>Stage</span>
            <span>Result</span>
            <span>Speed</span>
            <span>Accuracy</span>
            <span>When</span>
          </div>
          {state.attempts
            .slice()
            .reverse()
            .slice(0, 30)
            .map((attempt) => {
              const found = items.find(
                (item) => item.itemId === attempt.itemId,
              );
              const superseded = Boolean(
                found && found.contentRevision !== attempt.itemRevision,
              );
              return (
                <button
                  className="history-row"
                  key={attempt.id}
                  disabled={!found}
                  title={
                    found
                      ? "Practice this item again"
                      : "This custom practice item is archived"
                  }
                  onClick={() =>
                    found &&
                    onOpen(
                      found,
                      superseded ? 1 : attempt.stage,
                      undefined,
                      undefined,
                      attempt.practiceKind,
                    )
                  }
                >
                  <span>
                    <strong>{attempt.titleSnapshot}</strong>
                    <small>
                      {found
                        ? `${attempt.qualification} · revision ${attempt.itemRevision}${superseded ? " · superseded" : ""}`
                        : `${attempt.qualification} · archived`}
                    </small>
                  </span>
                  <span>
                    {attempt.practiceKind === "solving"
                      ? "Solve"
                      : attempt.practiceKind === "concept"
                        ? "Concept"
                      : STAGES[attempt.stage - 1]?.short}
                  </span>
                  <span className={attempt.outcome}>{attempt.outcome}</span>
                  <span>
                    {attempt.practiceKind === "solving"
                      ? `${attempt.verification?.runs ?? 0} runs`
                      : attempt.practiceKind === "concept"
                        ? `${attempt.conceptGrade ?? "—"} self-grade`
                      : `${attempt.wpm} WPM`}
                  </span>
                  <span>
                    {attempt.practiceKind === "solving"
                      ? `${attempt.verification?.passed ?? 0}/${attempt.verification?.total ?? 0} checks`
                      : attempt.practiceKind === "concept"
                        ? attempt.peeks > 0
                          ? "assisted reveal"
                          : "answer first"
                      : `${attempt.accuracy}%`}
                  </span>
                  <span>{formatDate(attempt.completedAt)}</span>
                </button>
              );
            })}
        </div>
        {!state.attempts.length && (
          <div className="empty-history">
            Your first practice pass will appear here.
          </div>
        )}
      </section>
    </main>
  );
}

function SettingsView({
  state,
  profileLabel,
  accountScoped,
  guestDataAvailable,
  studySyncStatus,
  onUpdate,
  onExport,
  onImport,
  onReset,
  onCopyGuestData,
}: {
  state: AppState;
  profileLabel: string;
  accountScoped: boolean;
  guestDataAvailable: boolean;
  studySyncStatus: StudyPlanSyncStatus;
  onUpdate: (patch: Partial<Settings>) => void;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
  onCopyGuestData: () => void;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="page-container settings-page">
      <PageHeading
        eyebrow="Make it yours"
        title="Practice settings."
        copy="Tune the editor for comfort and see exactly where each kind of practice data lives."
      />
      <section className="settings-section">
        <div className="settings-intro">
          <small>Appearance</small>
          <h2>Color theme</h2>
          <p>Six low-distraction palettes built for long practice sessions.</p>
        </div>
        <div className="theme-grid">
          {THEMES.map((theme) => (
            <button
              className={state.settings.theme === theme.id ? "active" : ""}
              onClick={() => onUpdate({ theme: theme.id })}
              key={theme.id}
              aria-pressed={state.settings.theme === theme.id}
            >
              <span>
                {theme.colors.map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              <strong>{theme.label}</strong>
              {state.settings.theme === theme.id && <b>✓</b>}
            </button>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-intro">
          <small>Editor</small>
          <h2>Typing surface</h2>
          <p>Match the rhythm of the editor you use every day.</p>
        </div>
        <div className="setting-list">
          <SettingRow
            label="Preferred interview language"
            note="Used for local Daily Type and new focused sessions."
          >
            <Segmented
              value={state.settings.preferredLanguage}
              options={["python", "swift"]}
              onChange={(value) =>
                onUpdate({ preferredLanguage: value as CodeLanguage })
              }
            />
          </SettingRow>
          <SettingRow label="Font family" note="Choose a coding voice.">
            <select
              value={state.settings.font}
              onChange={(event) =>
                onUpdate({ font: event.target.value as Settings["font"] })
              }
            >
              <option value="mono">Jet Mono</option>
              <option value="rounded">Rounded Mono</option>
              <option value="classic">Classic Mono</option>
            </select>
          </SettingRow>
          <SettingRow label="Font size" note="Editor text size.">
            <div className="stepper">
              <button
                aria-label="Decrease editor font size"
                onClick={() =>
                  onUpdate({
                    fontSize: Math.max(12, state.settings.fontSize - 1),
                  })
                }
              >
                −
              </button>
              <span>{state.settings.fontSize}px</span>
              <button
                aria-label="Increase editor font size"
                onClick={() =>
                  onUpdate({
                    fontSize: Math.min(24, state.settings.fontSize + 1),
                  })
                }
              >
                +
              </button>
            </div>
          </SettingRow>
          <SettingRow label="Indentation" note="Spaces inserted by Tab.">
            <Segmented
              value={String(state.settings.tabSize)}
              options={["2", "4"]}
              onChange={(value) =>
                onUpdate({ tabSize: Number(value) as 2 | 4 })
              }
            />
          </SettingRow>
          <SettingRow
            label="Editor height"
            note="Visible lines before scrolling."
          >
            <Segmented
              value={String(state.settings.editorLines)}
              options={["12", "16", "20"]}
              onChange={(value) =>
                onUpdate({ editorLines: Number(value) as 12 | 16 | 20 })
              }
            />
          </SettingRow>
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-intro">
          <small>Behavior</small>
          <h2>Practice rules</h2>
          <p>Strict mode is ideal while rebuilding muscle memory.</p>
        </div>
        <div className="setting-list">
          <ToggleRow
            label="Strict correction"
            note="Reject incorrect characters immediately."
            checked={state.settings.strictMode}
            onChange={(checked) => onUpdate({ strictMode: checked })}
          />
          <ToggleRow
            label="Live WPM"
            note="Show speed during the attempt."
            checked={state.settings.showLiveWpm}
            onChange={(checked) => onUpdate({ showLiveWpm: checked })}
          />
          <ToggleRow
            label="Keyboard guide"
            note="Show a friction heatmap below the editor."
            checked={state.settings.showKeyboard}
            onChange={(checked) => onUpdate({ showKeyboard: checked })}
          />
          <SettingRow
            label="Daily practice goal"
            note="Minutes practiced before the ring closes."
          >
            <div className="stepper">
              <button
                aria-label="Decrease daily practice goal"
                onClick={() =>
                  onUpdate({
                    dailyGoalMinutes: Math.max(
                      5,
                      state.settings.dailyGoalMinutes - 5,
                    ),
                  })
                }
              >
                −
              </button>
              <span>{state.settings.dailyGoalMinutes} min</span>
              <button
                aria-label="Increase daily practice goal"
                onClick={() =>
                  onUpdate({
                    dailyGoalMinutes: Math.min(
                      120,
                      state.settings.dailyGoalMinutes + 5,
                    ),
                  })
                }
              >
                +
              </button>
            </div>
          </SettingRow>
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-intro">
          <small>Your data</small>
          <h2>Account and data</h2>
          <p>
            Current profile: <strong>{profileLabel}</strong>. Each signed-in
            account and the guest profile have separate browser data.
          </p>
          <p>
            Browser only: code, drafts, attempts, submissions, transcripts,
            notes, settings, and custom content. Private sync: Study Plan
            structure only ({studySyncStatus}). Community: only qualifying
            attempt summaries when you explicitly turn sharing on.
          </p>
          <p>
            Exports use a portable v35 backup envelope and imports accept
            supported v2-v35 backups, including Fluency Clinic cases, Challenge Sets, typing progress, Cold
            Reconstruction work, and attempt-closure drafts. Account-bound
            sharing consent and upload receipts are never carried into another
            profile.
          </p>
        </div>
        <div className="data-actions">
          <button className="outline-button" onClick={onExport}>
            Export progress
          </button>
          <button className="outline-button" onClick={onImport}>
            Import backup
          </button>
          {accountScoped && guestDataAvailable && (
            <button className="outline-button" onClick={onCopyGuestData}>
              Copy guest progress here
            </button>
          )}
          <button className="danger-button" onClick={onReset}>
            Clear this browser profile
          </button>
        </div>
      </section>
    </main>
  );
}

// Kept temporarily for v24 source-level backup compatibility tests; the v25
// authoring path renders CustomChallengeDialog instead.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CustomSnippetDialog({
  item,
  onClose,
  onSave,
}: {
  item?: PracticeItem;
  onClose: () => void;
  onSave: (input: Parameters<typeof makeCustomItem>[0]) => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [track, setTrack] = useState<"interview" | "ios">(
    item?.track ?? "interview",
  );
  const [language, setLanguage] = useState<CodeLanguage>(
    item?.language ?? "python",
  );
  const [pattern, setPattern] = useState<Pattern>(
    item?.pattern ?? PYTHON_PATTERN_ORDER[0],
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    item?.difficulty ?? "Easy",
  );
  const [code, setCode] = useState(
    item?.code ??
      "def example(values: list[int]) -> list[int]:\n    # Type your Python implementation here\n    return values",
  );
  const [cue, setCue] = useState(item?.cue ?? "");
  const [invariant, setInvariant] = useState(item?.invariant ?? "");
  const [complexity, setComplexity] = useState(item?.complexity ?? "");
  const [languageNote, setLanguageNote] = useState(item?.languageNote ?? "");
  const valid =
    title.trim().length >= 1 &&
    title.trim().length <= 80 &&
    code.trim().length >= 10 &&
    code.length <= 20000;
  const dialogRef = useRef<HTMLElement>(null);
  useModalKeyboard(onClose, dialogRef);
  const patterns =
    track === "ios"
      ? IOS_PATTERN_ORDER
      : language === "python"
        ? PYTHON_PATTERN_ORDER
        : INTERVIEW_PATTERN_ORDER;
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="custom-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <span className="eyebrow">
          Device-local curriculum
          {item ? ` · revision ${item.contentRevision}` : ""}
        </span>
        <h2 id="custom-title">
          {item ? "Edit code snippet" : "Add a code snippet"}
        </h2>
        <p>
          {item
            ? "Metadata edits preserve mastery. Changing code creates a new revision while keeping the complete attempt history."
            : "Turn a Python solution, Swift algorithm, or iOS pattern into the same progressive recall exercise."}
        </p>
        <div className="custom-form">
          <label>
            <span>Title</span>
            <input
              data-modal-autofocus="true"
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Top-k with a min heap"
            />
          </label>
          <div className="form-pair">
            <label>
              <span>Track</span>
              <select
                value={track}
                onChange={(event) => {
                  const next = event.target.value as "interview" | "ios";
                  setTrack(next);
                  if (next === "ios") {
                    setLanguage("swift");
                    setPattern(IOS_PATTERN_ORDER[0]);
                  } else
                    setPattern(
                      language === "python"
                        ? PYTHON_PATTERN_ORDER[0]
                        : INTERVIEW_PATTERN_ORDER[0],
                    );
                }}
              >
                <option value="interview">Coding interviews</option>
                <option value="ios">iOS &amp; Swift fundamentals</option>
              </select>
            </label>
            <label>
              <span>Language</span>
              <select
                value={language}
                disabled={track === "ios"}
                onChange={(event) => {
                  const next = event.target.value as CodeLanguage;
                  setLanguage(next);
                  setPattern(
                    next === "python"
                      ? PYTHON_PATTERN_ORDER[0]
                      : INTERVIEW_PATTERN_ORDER[0],
                  );
                  if (!item)
                    setCode(
                      next === "python"
                        ? "def example(values: list[int]) -> list[int]:\n    # Type your Python implementation here\n    return values"
                        : "func example(_ values: [Int]) -> [Int] {\n    // Type your Swift implementation here\n    values\n}",
                    );
                }}
              >
                <option value="python">Python</option>
                <option value="swift">Swift</option>
              </select>
            </label>
          </div>
          <div className="form-pair">
            <label>
              <span>Pattern</span>
              <select
                value={pattern}
                onChange={(event) => setPattern(event.target.value as Pattern)}
              >
                {patterns.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Difficulty</span>
              <select
                value={difficulty}
                onChange={(event) =>
                  setDifficulty(event.target.value as Difficulty)
                }
              >
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </label>
          </div>
          <label>
            <span>{LANGUAGE_META[language].label} code</span>
            <textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              spellCheck={false}
            />
          </label>
          <label>
            <span>Pattern cue</span>
            <input
              value={cue}
              onChange={(event) => setCue(event.target.value)}
              placeholder="What should you recognize before coding?"
            />
          </label>
          <label>
            <span>Invariant</span>
            <input
              value={invariant}
              onChange={(event) => setInvariant(event.target.value)}
              placeholder="What must remain true?"
            />
          </label>
          <div className="form-pair">
            <label>
              <span>Complexity or tradeoff</span>
              <input
                value={complexity}
                onChange={(event) => setComplexity(event.target.value)}
                placeholder="Behavior, cost, or lifecycle tradeoff"
              />
            </label>
            <label>
              <span>{LANGUAGE_META[language].note}</span>
              <input
                value={languageNote}
                onChange={(event) => setLanguageNote(event.target.value)}
                placeholder="Syntax or API detail to remember"
              />
            </label>
          </div>
        </div>
        <div className="result-actions">
          <button className="outline-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={!valid}
            onClick={() =>
              onSave({
                title,
                track,
                language,
                pattern,
                difficulty,
                code,
                cue,
                invariant,
                complexity,
                languageNote,
              })
            }
          >
            {item ? "Save changes" : "Save and practice"} →
          </button>
        </div>
      </section>
    </div>
  );
}

function ResultDialog({
  result,
  onClose,
  onNext,
  onRetry,
  onRandom,
  onRecords,
  onTransferLab,
  onSolutionReview,
  debrief,
  onSaveDebrief,
  cloud,
}: {
  result: Result;
  onClose: () => void;
  onNext: () => void;
  onRetry: () => void;
  onRandom: () => void;
  onRecords: () => void;
  onTransferLab: () => void;
  onSolutionReview: () => void;
  debrief?: LearningEvent;
  onSaveDebrief: (input: DebriefInput) => void;
  cloud: CloudRuntime;
}) {
  const eligible = eligibleAttempt(result);
  const isSolve = result.practiceKind === "solving";
  const isConcept = result.practiceKind === "concept";
  const isTransfer = Boolean(result.item.transfer);
  const isCleanSolve = result.qualification === "solved";
  const transferEvidenceClass =
    result.transferEvidenceClass ??
    (isCleanSolve ? "cold-proof" : "assisted-reconstruction");
  const transferEvidenceLabel =
    transferEvidenceClass === "cold-proof"
      ? "Cold transfer proof"
      : transferEvidenceClass === "spaced-recheck"
        ? "Due recheck"
        : transferEvidenceClass === "early-reconstruction"
          ? "Unassisted reconstruction"
          : "Assisted reconstruction";
  const isStrongConcept =
    isConcept && result.qualification === "independent";
  const successful = eligible || isCleanSolve || isStrongConcept;
  const isBest =
    eligible &&
    (!result.previousBest ||
      result.wpm > result.previousBest.wpm ||
      (result.wpm === result.previousBest.wpm &&
        result.accuracy > result.previousBest.accuracy));
  const delta =
    eligible && result.previousBest
      ? result.wpm - result.previousBest.wpm
      : null;
  const dialogRef = useRef<HTMLElement>(null);
  const [board, setBoard] = useState<CloudItemLeaderboard | null>(null);
  const [boardStatus, setBoardStatus] = useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");
  useModalKeyboard(onClose, dialogRef);
  const comparability = assessCommunityComparability(result, result.item);
  const leaderboardPreview = buildLeaderboardPreview({
    attempt: result,
    item: result.item,
    entries: board?.entries ?? [],
  });

  useEffect(() => {
    if (
      !cloud.capabilities?.leaderboards ||
      cloud.status === "local" ||
      cloud.status === "checking" ||
      cloud.status === "error" ||
      !comparability.eligible
    ) {
      return;
    }
    const controller = new AbortController();
    void cloudClient
      .itemLeaderboard(result.itemId, {
        limit: 25,
        itemRevision: result.itemRevision,
        stage: result.stage,
        signal: controller.signal,
      })
      .then((response) => {
        if (controller.signal.aborted) return;
        if (response.available) {
          setBoard(response.data);
          setBoardStatus("ready");
        } else {
          setBoard(null);
          setBoardStatus("unavailable");
        }
      });
    return () => controller.abort();
  }, [
    cloud.capabilities?.leaderboards,
    cloud.status,
    comparability.eligible,
    result.itemId,
    result.itemRevision,
    result.stage,
  ]);

  function benchmarkCopy() {
    if (!comparability.eligible)
      return "Only current-revision, strict, clean typing passes can be compared publicly.";
    if (!cloud.capabilities?.leaderboards || cloud.status === "local")
      return "Community benchmarks are available in the hosted edition; this local result stays private.";
    if (boardStatus === "idle" || boardStatus === "loading")
      return "Loading the matching public top 25…";
    if (boardStatus === "unavailable")
      return "The matching community benchmark is temporarily unavailable.";
    if (leaderboardPreview.kind === "empty")
      return "No opted-in public records exist for this exact stage yet.";
    if (leaderboardPreview.kind === "top-window")
      return `Your metrics would enter near position ${leaderboardPreview.aheadOfVisible + 1} within the visible top ${leaderboardPreview.visibleCount}.`;
    if (leaderboardPreview.kind === "cutoff")
      return `Visible top-${leaderboardPreview.visibleCount} cutoff: ${leaderboardPreview.cutoff.wpm} WPM at ${leaderboardPreview.cutoff.accuracy}% accuracy.`;
    return "Public comparison is unavailable for this pass.";
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="result-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className={`result-mark ${successful ? "" : "assisted"}`}>
          {successful ? "✓" : "~"}
        </div>
        <span className="eyebrow">
          {isTransfer
            ? `${transferEvidenceLabel} recorded`
            : isSolve
            ? result.mockInterview
              ? "Mock interview verified"
              : "Solution verified"
            : isConcept
              ? "Concept recall saved"
            : `Pass complete · Stage ${result.stage}`}
        </span>
        <h2 id="result-title">{result.item.title}</h2>
        <p>
          {isTransfer
            ? transferEvidenceClass === "cold-proof"
              ? "All local checks passed without recorded help before the identity was revealed. This is local cold-transfer evidence, not a proctored or identity-verified result."
              : transferEvidenceClass === "spaced-recheck"
                ? "You reconstructed the revealed variant without current-attempt help after it became due. This advances the local 1/3/7/14/30-day retrieval cadence without claiming another cold solve."
                : transferEvidenceClass === "early-reconstruction"
                  ? "You reconstructed a previously revealed variant without current-attempt help. It remains useful retrieval evidence, but an early reconstruction does not advance the due schedule or become cold proof."
                  : "Hints or revealed work influenced this attempt. The reconstruction stays useful and is permanently labeled assisted."
            : result.sessionComplete
            ? result.mockInterview
              ? "You produced a verified solution before the deadline. The mock is saved as independent interview evidence."
              : "That was the final item in this session. Your set is saved in session history."
            : isSolve
              ? isCleanSolve
                ? "All executable checks passed without hints. This records independent problem-solving evidence without changing typing records."
                : "All executable checks passed. Because hints or the reference were used, this solve is saved as assisted."
              : isConcept
                ? isStrongConcept
                  ? "You recorded an unassisted Good/Easy retrieval. This is self-rated concept evidence, not automated correctness."
                  : "This recall is saved as assisted or still developing. The coach will bring it back sooner."
              : eligible
                ? result.typingEvidence?.owned
                  ? `Independent blank recall completed in order. Typing recall is now scheduled at level ${result.typingEvidence.recallLevel}.`
                  : result.typingEvidence?.diagnosticOnly
                    ? "Blank recall recorded as a diagnostic. Complete a worked example and a later faded reconstruction before blank recall can establish ownership."
                    : `Clean learning step recorded. The next evidence step is Stage ${result.typingEvidence?.nextStage ?? Math.min(5, result.stage + 1)}; guided typing does not claim mastery.`
                : result.peeks
                  ? "Assisted pass recorded. Because you peeked, it does not advance mastery or personal records."
                  : "Practice saved, but 95% accuracy is required for mastery and personal records."}
        </p>
        <div className="result-stats">
          {isConcept ? (
            <>
              <span>
                <small>Self-grade</small>
                <strong>{result.conceptGrade ?? "—"}</strong>
              </span>
              <span>
                <small>Reference</small>
                <strong>
                  {result.peeks > 0 ? "Revealed early" : "After answer"}
                </strong>
              </span>
            </>
          ) : isSolve ? (
            <>
              <span>
                <small>Checks</small>
                <strong>
                  {result.verification?.passed ?? 0}/
                  {result.verification?.total ?? 0}
                </strong>
              </span>
              <span>
                <small>Runs</small>
                <strong>{result.verification?.runs ?? 0}</strong>
              </span>
              <span>
                <small>Submissions</small>
                <strong>{result.verification?.submissions ?? 1}</strong>
              </span>
            </>
          ) : (
            <>
              <span>
                <small>WPM</small>
                <strong>{result.wpm}</strong>
              </span>
              <span>
                <small>Accuracy</small>
                <strong>{result.accuracy}%</strong>
              </span>
            </>
          )}
          <span>
            <small>Time</small>
            <strong>{formatDuration(result.durationMs)}</strong>
          </span>
          <span>
            <small>{isSolve || isConcept ? "Evidence" : "Record"}</small>
            <strong>
              {isConcept
                ? isStrongConcept
                  ? "Independent"
                  : "Assisted"
                : isSolve
                ? isTransfer
                  ? transferEvidenceLabel
                  : isCleanSolve
                    ? "Independent"
                    : "Assisted"
                : isBest
                  ? "New PB"
                  : delta === null
                    ? "—"
                    : `${delta >= 0 ? "+" : ""}${delta}`}
            </strong>
          </span>
        </div>
        {!isConcept && !isSolve && (
          <AttemptForensics attempt={result} item={result.item} />
        )}
        {isTransfer && result.item.transfer && (
          <section className="result-benchmark transfer-result-debrief">
            <span>
              <small>Pattern revealed after attempt</small>
              <strong>{result.item.transfer.postAttemptPatternLabel}</strong>
            </span>
            <p>{result.item.transfer.contrastExplanation}</p>
            <div>
              <small>Teach it back</small>
              <strong>{result.item.transfer.teachBackQuestion}</strong>
            </div>
          </section>
        )}
        {!isConcept && !isSolve && (
          <PostAttemptDebrief
            item={result.item}
            stage={result.stage}
            existing={debrief}
            onSave={onSaveDebrief}
          />
        )}
        {!isSolve && !isConcept && (
          <section className="result-benchmark">
            <span>
              <small>Opt-in community benchmark</small>
              <strong>Exact item · revision · stage · strict mode</strong>
            </span>
            <p>{benchmarkCopy()}</p>
          </section>
        )}
        {result.nextReview && !isTransfer && (
          <div className="result-review">
            <span>Next review</span>
            <strong>{formatDay(result.nextReview)}</strong>
            <small>
              {successful ? "Interval advanced" : "Returns tomorrow"}
            </small>
          </div>
        )}
        <div className="result-actions">
          {isTransfer ? (
            <>
              <button className="outline-button" onClick={onRetry}>
                Reconstruct this revealed variant
              </button>
              <button className="outline-button" onClick={onRecords}>
                View transfer evidence
              </button>
              <button className="outline-button" onClick={onSolutionReview}>
                Review this solution
              </button>
              <button
                className="primary-button"
                data-modal-autofocus="true"
                autoFocus
                onClick={onTransferLab}
              >
                Back to Transfer Lab -&gt;
              </button>
            </>
          ) : (
            <>
          <button className="outline-button" onClick={onRetry}>
            Retry same {isSolve ? "solve" : isConcept ? "concept" : "stage"}
          </button>
          <button className="outline-button" onClick={onRandom}>
            Different problem
          </button>
          <button className="outline-button" onClick={onRecords}>
            Full analysis
          </button>
          {isSolve && (
            <button
              className="primary-button"
              data-modal-autofocus="true"
              autoFocus
              onClick={onSolutionReview}
            >
              Review how this solution works -&gt;
            </button>
          )}
          <button
            className={isSolve ? "outline-button" : "primary-button"}
            data-modal-autofocus={isSolve ? undefined : "true"}
            autoFocus={!isSolve}
            onClick={onNext}
          >
            {result.sessionNext
              ? "Next in session →"
              : result.sessionComplete
                ? "View session summary →"
                : isConcept
                  ? "Review next concept →"
                  : isSolve
                  ? "Practice recall next →"
                  : result.typingEvidence?.owned
                    ? "Review blank recall →"
                    : `Continue to Stage ${result.typingEvidence?.nextStage ?? Math.min(5, result.stage + 1)} →`}
          </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <header className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{copy}</p>
    </header>
  );
}
function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="stat-card">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}
function EmptyChart() {
  return (
    <div className="empty-chart">
      <span>⌨</span>
      <strong>No completed passes yet</strong>
      <small>Finish one practice stage to start your rhythm chart.</small>
    </div>
  );
}
function KeyboardGuide({ errors }: { errors: Record<string, number> }) {
  const rows = ["1234567890", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const max = Math.max(1, ...Object.values(errors));
  return (
    <section className="keyboard-guide">
      <div>
        <small>Key friction</small>
        <strong>Rejected-key heatmap</strong>
      </div>
      <div className="keyboard-rows">
        {rows.map((row) => (
          <div key={row}>
            {row.split("").map((key) => {
              const count = errors[key] ?? errors[key.toLowerCase()] ?? 0;
              return (
                <span
                  key={key}
                  className={count ? "hot" : ""}
                  style={
                    { "--heat": String(count / max) } as React.CSSProperties
                  }
                >
                  {key}
                  <small>{count || ""}</small>
                </span>
              );
            })}
          </div>
        ))}
        <div>
          <span className="space-key">
            space<small>{errors.space || ""}</small>
          </span>
        </div>
      </div>
    </section>
  );
}
function SettingRow({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <span>
        <strong>{label}</strong>
        <small>{note}</small>
      </span>
      {children}
    </div>
  );
}
function ToggleRow({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <SettingRow label={label} note={note}>
      <button
        role="switch"
        aria-label={label}
        aria-checked={checked}
        className={`toggle ${checked ? "on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
    </SettingRow>
  );
}
function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          className={value === option ? "active" : ""}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          key={option}
        >
          {/^[a-z]/.test(option)
            ? option[0].toUpperCase() + option.slice(1)
            : option}
        </button>
      ))}
    </div>
  );
}
