"use client";

import {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent,
  useEffect,
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
import { DailyCoach } from "./DailyCoach";
import { ReadinessAnalytics } from "./ReadinessAnalytics";
import {
  ConceptPractice,
  type ConceptCompletionInput,
} from "./ConceptPractice";
import {
  PostAttemptDebrief,
  type DebriefInput,
} from "./PostAttemptDebrief";
import {
  createPythonRunner,
  type PythonRunner,
  type PythonVerificationResult,
} from "../lib/python-runner.mjs";
import {
  BUILTIN_ITEMS,
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
  parseRoute,
  resolveRouteItem,
  routeForItem,
  serializeRoute,
  type AppRoute,
} from "../lib/routes.mjs";
import {
  createCloudClient,
  type CloudCapabilities,
  type CloudDailyChallenge,
  type CloudItemLeaderboard,
  type CloudSession,
} from "../lib/cloud.mjs";
import {
  assessCommunityComparability,
  buildLeaderboardPreview,
} from "../lib/competitive.mjs";
import {
  LINE_RANGE_OPTIONS,
  TIME_RANGE_OPTIONS,
  matchesCatalogRanges,
  type LineRange,
  type TimeRange,
} from "../lib/catalog-filters.mjs";
import {
  EMPTY_STATE,
  EARLIEST_STORAGE_KEY,
  FIRST_STORAGE_KEY,
  FIRST_VERSION_STORAGE_KEY,
  INITIAL_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  OLDER_STORAGE_KEY,
  OLDEST_STORAGE_KEY,
  ORIGINAL_STORAGE_KEY,
  PREVIOUS_STORAGE_KEY,
  SECOND_VERSION_STORAGE_KEY,
  STAGES,
  STORAGE_KEY,
  activeStreak,
  analyzeEdit,
  completedAttempts,
  consistencyFromSamples,
  currentMetrics,
  dailyItem,
  dayKey,
  eligibleAttempt,
  formatDuration,
  isReviewDue,
  itemStats,
  loadState,
  makeId,
  maskCode,
  milestones,
  normalizeState,
  personalBest,
  practicedMinutesToday,
  qualificationFor,
  recommendedStage,
  reviewDueAt,
  saveState,
  type AppState,
  type AttemptRecord,
  type Draft,
  type PracticeKind,
  type Settings,
  type Theme,
  type TrainingSession,
  type View,
} from "../lib/product";
import {
  normalizeTimelineSamples,
  type TimelineSample,
} from "../lib/analytics.mjs";
import {
  activityKindFor,
  upsertLearningEvent,
  type LearningEvent,
} from "../lib/learning-state.mjs";
import {
  selectConceptCheckIndex,
  supportsConceptPractice,
} from "../lib/concept-practice.mjs";
import {
  MOCK_INTERVIEW_PRESETS,
  formatMockClock,
  mockInterviewEndsAt,
  mockInterviewRemainingMs,
  mockInterviewPreset,
  selectMockInterviewItem,
  type MockInterviewPresetId,
} from "../lib/mock-interview.mjs";

type Result = AttemptRecord & {
  item: PracticeItem;
  previousBest: AttemptRecord | null;
  nextReview: Date | null;
  sessionNext?: {
    itemId: ItemId;
    stage: number;
    practiceKind: PracticeKind;
  };
  sessionComplete?: boolean;
  mockInterview?: boolean;
};
type Sort = "recommended" | "number" | "title" | "difficulty";
type SessionBuildOptions = {
  name: string;
  count: number;
  source: SessionSource;
  track: SessionTrack;
  language: SessionLanguage;
  pattern: string;
  difficulty: string;
  stageMode: SessionStageMode;
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
  { id: "today", label: "Today", icon: "◉" },
  { id: "practice", label: "Practice", icon: "⌨" },
  { id: "sessions", label: "Sessions", icon: "≡" },
  { id: "library", label: "Library", icon: "▦" },
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

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  Easy: 0,
  Medium: 1,
  Hard: 2,
};

function laneLabel(item: Pick<PracticeItem, "track" | "language">) {
  if (item.track === "ios") return "iOS & Swift";
  return `${LANGUAGE_META[item.language].label} interview`;
}

function coercePracticeKind(
  item: Pick<
    PracticeItem,
    "language" | "verification" | "track" | "recallChecks" | "conceptAnswers"
  >,
  requested: PracticeKind | undefined,
): PracticeKind {
  if (
    requested === "solving" &&
    item.language === "python" &&
    item.verification
  )
    return "solving";
  const supportsConcept = supportsConceptPractice(item);
  if (supportsConcept && (requested === "concept" || requested === undefined))
    return "concept";
  return "typing";
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
    challengeDate,
    sessionId,
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

function formatMockEntrypoint(item: PracticeItem) {
  const entrypoint = item.verification?.entrypoint;
  if (!entrypoint) return "Implement the requested Python function.";
  if (entrypoint.kind === "method") {
    return `Implement ${entrypoint.className}.${entrypoint.name}(...)`;
  }
  return `Implement ${entrypoint.name}(...)`;
}

function formatMockArgs(args: readonly unknown[]) {
  return args.map((arg) => JSON.stringify(arg)).join(", ");
}

function sessionHistoryRecord(
  session: TrainingSession,
  entries: SessionQueueEntry[],
  outcome: "completed" | "ended" | "expired",
) {
  return {
    id: session.id,
    name: session.name,
    kind: session.kind,
    startedAt: session.createdAt,
    completedAt: new Date().toISOString(),
    completed: entries.filter((entry) => entry.status === "completed").length,
    total: entries.length,
    ...(session.kind === "mock"
      ? {
          durationMinutes: session.durationMinutes,
          outcome,
        }
      : {}),
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
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("today");
  const [selectedId, setSelectedId] = useState<ItemId>(BUILTIN_ITEMS[0].itemId);
  const [stage, setStage] = useState(1);
  const [reveal, setReveal] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
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
  const importRef = useRef<HTMLInputElement>(null);
  const expireMockInterviewRef = useRef<(sessionId: string) => void>(() => {});
  expireMockInterviewRef.current = expireMockInterview;

  const allItems = useMemo(
    () => [
      ...BUILTIN_ITEMS,
      ...state.customItems.filter((item) => !item.archivedAt),
    ],
    [state.customItems],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadState();
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
      setState(restored);
      setView(route.view);
      setSelectedId(initialItem.itemId);
      setStage(
        initialPracticeKind === "solving"
          ? 5
          : initialPracticeKind === "concept"
            ? (route.stage ?? 5)
            : (route.stage ?? (restored.lastStage || 1)),
      );
      setPracticeKind(initialPracticeKind);
      setNow(Date.now());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    function onPopState() {
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
      setView(route.view);
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
    if (ready) saveState(state);
  }, [ready, state]);
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
    document.documentElement.dataset.font = state.settings.font;
  }, [state.settings.theme, state.settings.font]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!ready) return;
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
      const [session, daily] = await Promise.all([
        cloudClient.session({ signal: controller.signal }),
        cloudClient.dailyLeaderboard(utcToday, {
          limit: 1,
          signal: controller.signal,
        }),
      ]);
      const dailyChallenge = daily.available ? daily.data.challenge : null;
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
  }, [ready, cloud.refresh]);

  useEffect(() => {
    if (
      !ready ||
      !state.cloud.communityEnabled ||
      !cloud.session?.authenticated
    )
      return;
    const known = new Set(state.cloud.uploadedAttemptIds);
    const pending = state.attempts
      .filter(
        (attempt) =>
          attempt.outcome === "completed" &&
          attempt.practiceKind === "typing" &&
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
  const conceptCheckIndex = selectConceptCheckIndex(
    state.attempts,
    selectedId,
    item.contentRevision,
  );
  const dueItems = allItems.filter((candidate) =>
    isReviewDue(state, candidate.itemId),
  );
  const todayMinutes = practicedMinutesToday(state);
  const dailyPercent = Math.min(
    100,
    Math.round((todayMinutes / state.settings.dailyGoalMinutes) * 100),
  );

  function mutateState(updater: (current: AppState) => AppState) {
    setState((current) => updater(current));
  }

  function writeRoute(route: AppRoute, replace = false) {
    const href = serializeRoute(route, window.location.href);
    window.history[replace ? "replaceState" : "pushState"]({}, "", href);
  }

  function navigateView(nextView: View) {
    setView(nextView);
    setResult(null);
    writeRoute({ view: nextView });
  }

  function createAttempt(
    active: Draft,
    activeItem: PracticeItem,
    outcome: AttemptRecord["outcome"],
    current: AppState,
    verification?: AttemptRecord["verification"],
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
      keyErrors: { ...active.keyErrors },
      lineErrors: { ...active.lineErrors },
    };
    attempt.qualification = qualificationFor(attempt);
    return attempt;
  }

  function recordAbandon(current: AppState) {
    const active = current.draft;
    if (!active?.startedAt || active.value.length < 5) return current;
    const activeItem = [...BUILTIN_ITEMS, ...current.customItems].find(
      (candidate) => candidate.itemId === active.itemId,
    );
    if (!activeItem) return { ...current, draft: null };
    const attempt = createAttempt(active, activeItem, "abandoned", current);
    return {
      ...current,
      attempts: [...current.attempts, attempt].slice(-1000),
      draft: null,
    };
  }

  function openItem(
    next: PracticeItem,
    nextStage?: number,
    challengeDate?: string,
    sessionId?: string,
    nextPracticeKind?: PracticeKind,
  ) {
    const chosenPracticeKind = coercePracticeKind(next, nextPracticeKind);
    const chosenStage =
      chosenPracticeKind === "solving"
        ? 5
        : chosenPracticeKind === "concept"
          ? (nextStage ?? 5)
          : (nextStage ?? recommendedStage(state, next));
    mutateState((current) => {
      const resuming =
        !challengeDate &&
        current.draft?.itemId === next.itemId &&
        current.draft.stage === chosenStage &&
        current.draft.practiceKind === chosenPracticeKind &&
        current.draft.itemRevision === next.contentRevision &&
        current.draft.sessionId === sessionId;
      const base = resuming ? current : recordAbandon(current);
      return {
        ...base,
        draft: resuming
          ? current.draft
          : challengeDate || sessionId
            ? freshDraft(
                next.itemId,
                chosenStage,
                next.contentRevision,
                challengeDate,
                sessionId,
                chosenPracticeKind,
                chosenPracticeKind === "solving"
                  ? (next.starterCode ?? "")
                  : "",
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
    if (state.draft?.sessionId) {
      setToast("Stage is fixed for this session step");
      return;
    }
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
    if (draft.sessionId) {
      setToast("This session step has a fixed practice mode");
      return;
    }
    if (nextKind === "solving" && (!item.verification || draft.challengeDate)) {
      setToast(
        item.verification
          ? "Solve mode is unavailable during Daily Type"
          : "Solve mode currently supports verified Python exercises",
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
    mutateState((current) => ({
      ...current,
      draft: { ...next, timeline },
      lastItemId: selectedId,
      lastStage: stage,
    }));
  }

  function completeAttempt(
    next: Draft,
    attempt: AttemptRecord,
    learningEvent?: LearningEvent,
  ) {
    const previousBest =
      attempt.practiceKind === "typing"
        ? personalBest(state, selectedId, stage, attempt.mode)
        : null;
    let projected: AppState = {
      ...state,
      attempts: [...state.attempts, attempt].slice(-1000),
      learningEvents: learningEvent
        ? upsertLearningEvent(state.learningEvents, learningEvent)
        : state.learningEvents,
      draft: null,
    };
    let sessionNext: Result["sessionNext"];
    let sessionComplete = false;
    const session = state.activeSession;
    if (session && next.sessionId === session.id) {
      const entries = session.entries.map((entry, index) =>
        index === session.currentIndex
          ? { ...entry, status: "completed" as const, attemptId: attempt.id }
          : entry,
      );
      const nextIndex = entries.findIndex(
        (entry, index) =>
          index > session.currentIndex && entry.status === "pending",
      );
      if (nextIndex >= 0) {
        const nextEntry = entries[nextIndex];
        projected = {
          ...projected,
          activeSession: { ...session, entries, currentIndex: nextIndex },
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
            sessionHistoryRecord(session, entries, "completed"),
          ].slice(-25),
        };
      }
    }
    mutateState(() => projected);
    setResult({
      ...attempt,
      item,
      previousBest,
      nextReview: reviewDueAt(projected, selectedId),
      sessionNext,
      sessionComplete,
      mockInterview: session?.kind === "mock",
    });
  }

  function finish(next: Draft, verification?: AttemptRecord["verification"]) {
    const attempt = createAttempt(next, item, "completed", state, verification);
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

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const proposed = event.target.value;
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
  ) {
    const activeMock =
      state.activeSession?.kind === "mock" &&
      draft.sessionId === state.activeSession.id
        ? state.activeSession
        : null;
    if (activeMock && mockInterviewRemainingMs(activeMock, Date.now()) === 0) {
      expireMockInterview(activeMock.id);
      return;
    }
    if (
      practiceKind !== "solving" ||
      !item.verification ||
      !verificationResult.ok
    )
      return;
    const next: Draft = {
      ...draft,
      practiceKind: "solving",
      stage: 5,
      value: source,
      startedAt: draft.startedAt ?? Date.now(),
      testRuns: Math.max(draft.testRuns, runs),
    };
    finish(next, {
      revision: item.contentRevision,
      passed: verificationResult.cases.filter((testCase) => testCase.passed)
        .length,
      total: verificationResult.cases.length,
      runs: Math.max(1, runs),
    });
  }

  function insertAtCursor(input: HTMLTextAreaElement, text: string) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    handleChange({
      target: {
        value: `${draft.value.slice(0, start)}${text}${draft.value.slice(end)}`,
      },
    } as ChangeEvent<HTMLTextAreaElement>);
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
      const base = recordAbandon(current);
      return {
        ...base,
        draft: sessionId
          ? freshDraft(
              selectedId,
              stage,
              item.contentRevision,
              undefined,
              sessionId,
              practiceKind,
              practiceKind === "solving" ? (item.starterCode ?? "") : "",
            )
          : freshDraft(
              selectedId,
              stage,
              item.contentRevision,
              undefined,
              undefined,
              practiceKind,
              practiceKind === "solving" ? (item.starterCode ?? "") : "",
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
    const pool = mode === "due" && dueItems.length ? dueItems : allItems;
    openItem(pool[Math.floor(Math.random() * pool.length)]);
  }

  function startSession(
    options: SessionBuildOptions,
    plannedEntries?: SessionQueueEntry[],
  ) {
    if (
      state.activeSession &&
      !window.confirm(
        "Replace the active session with this new queue? Completed entries will stay in session history.",
      )
    )
      return;
    const signals = Object.fromEntries(
      allItems.map((candidate) => {
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
        const candidate = allItems.find(
          (item) => item.itemId === entry.itemId,
        );
        if (
          !candidate ||
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
          },
        ];
      })
      .slice(0, 20);
    const entries = planned?.length
      ? planned
      : buildSessionQueue(allItems, signals, options);
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
      return { ...base, activeSession: session, sessionHistory, draft: null };
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

  function startMockInterview(presetId: MockInterviewPresetId) {
    if (
      state.activeSession &&
      !window.confirm(
        "Replace the active session with this timed mock? Completed work will stay in session history.",
      )
    )
      return;
    const preset = mockInterviewPreset(presetId);
    const candidate = selectMockInterviewItem(
      allItems,
      state.attempts,
      preset.id,
    );
    if (!candidate) {
      setToast("No verified Python problem matches this mock preset");
      return;
    }
    const startedAt = new Date().toISOString();
    const expiresAt = mockInterviewEndsAt(startedAt, preset.durationMinutes);
    if (!expiresAt) {
      setToast("The mock timer could not start");
      return;
    }
    const entry: SessionQueueEntry = {
      itemId: candidate.itemId,
      itemRevision: candidate.contentRevision,
      stage: 5,
      status: "pending",
      practiceKind: "solving",
      estimatedMinutes: preset.durationMinutes,
      rationale: "Cold verified solve · guidance stays hidden until the mock ends.",
    };
    const session: TrainingSession = {
      id: makeId(),
      name: preset.label,
      kind: "mock",
      source: "mixed",
      track: "interview",
      language: "python",
      stageMode: "recall",
      createdAt: startedAt,
      entries: [entry],
      currentIndex: 0,
      mockPreset: preset.id,
      durationMinutes: preset.durationMinutes,
      expiresAt,
    };
    mutateState((current) => {
      const base = recordAbandon(current);
      const previous = base.activeSession;
      return {
        ...base,
        activeSession: session,
        sessionHistory: previous
          ? [
              ...base.sessionHistory,
              sessionHistoryRecord(previous, previous.entries, "ended"),
            ].slice(-25)
          : base.sessionHistory,
        draft: null,
      };
    });
    openItem(candidate, 5, undefined, session.id, "solving");
    setToast(`${preset.durationMinutes}-minute mock started · guidance locked`);
  }

  function expireMockInterview(sessionId: string) {
    const session = state.activeSession;
    if (!session || session.id !== sessionId || session.kind !== "mock") return;
    mutateState((current) => {
      const active = current.activeSession;
      if (!active || active.id !== sessionId || active.kind !== "mock")
        return current;
      const base =
        current.draft?.sessionId === sessionId
          ? recordAbandon(current)
          : current;
      return {
        ...base,
        draft: null,
        activeSession: null,
        sessionHistory: [
          ...base.sessionHistory,
          sessionHistoryRecord(active, active.entries, "expired"),
        ].slice(-25),
      };
    });
    setResult(null);
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
      mutateState((current) => {
        const base =
          current.draft?.sessionId === session.id
            ? recordAbandon(current)
            : current;
        return {
          ...base,
          activeSession: null,
          sessionHistory: [
            ...base.sessionHistory,
            sessionHistoryRecord(session, entries, "ended"),
          ].slice(-25),
        };
      });
      setResult(null);
      navigateView("sessions");
      setToast("Session finished");
      return;
    }
    const nextSession = { ...session, entries, currentIndex: nextIndex };
    mutateState((current) => ({ ...current, activeSession: nextSession }));
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
    mutateState((current) => {
      const base =
        current.draft?.sessionId === session.id
          ? recordAbandon(current)
          : current;
      return {
        ...base,
        activeSession: null,
        sessionHistory: [
          ...base.sessionHistory,
          sessionHistoryRecord(session, session.entries, "ended"),
        ].slice(-25),
      };
    });
    setResult(null);
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
          "The code changed. Save this edit and close the current draft? The old draft will be kept as an abandoned attempt.",
        )
      )
        return;
      mutateState((current) => {
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
        };
      });
      setCustomEditor(null);
      setResult(null);
      setReveal(false);
      if (codeChanged) setStage(1);
      setToast(
        codeChanged
          ? "Snippet updated · mastery restarted for revision"
          : "Snippet details updated",
      );
      return;
    }
    const custom = makeCustomItem(input);
    mutateState((current) => ({
      ...current,
      customItems: [...current.customItems, custom],
      lastItemId: custom.itemId,
    }));
    setCustomEditor(null);
    setToast("Custom snippet saved on this device");
    openItem(custom, 1);
  }

  function archiveCustom(itemId: ItemId) {
    if (
      !window.confirm(
        "Archive this custom snippet? Its attempt history will stay in Records.",
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
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `swift-ghost-progress-${dayKey(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setToast("Progress exported");
  }

  async function importProgress(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const restored = normalizeState(parsed);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        ![2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(
          Number((parsed as { version?: unknown }).version),
        )
      )
        throw new Error("invalid");
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
      setState(restored);
      setSelectedId(restoredItem?.itemId ?? BUILTIN_ITEMS[0].itemId);
      setStage(restoredPracticeKind === "solving" ? 5 : restored.lastStage);
      setPracticeKind(restoredPracticeKind);
      setPracticeEpoch((current) => current + 1);
      setReveal(false);
      setResult(null);
      setToast("Progress restored and migrated");
    } catch {
      setToast("That backup could not be read");
    }
    event.target.value = "";
  }

  function resetAllData() {
    if (
      !window.confirm(
        "Delete all Swift Ghost progress, custom snippets, and settings from this device?",
      )
    )
      return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PREVIOUS_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(OLDER_STORAGE_KEY);
    localStorage.removeItem(OLDEST_STORAGE_KEY);
    localStorage.removeItem(ORIGINAL_STORAGE_KEY);
    localStorage.removeItem(FIRST_STORAGE_KEY);
    localStorage.removeItem(EARLIEST_STORAGE_KEY);
    localStorage.removeItem(INITIAL_STORAGE_KEY);
    localStorage.removeItem(SECOND_VERSION_STORAGE_KEY);
    localStorage.removeItem(FIRST_VERSION_STORAGE_KEY);
    setState(EMPTY_STATE);
    setSelectedId(BUILTIN_ITEMS[0].itemId);
    setStage(1);
    setPracticeKind("typing");
    setPracticeEpoch((current) => current + 1);
    setToast("Local data cleared");
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
      setResult(null);
      navigateView("sessions");
      setToast(result.mockInterview ? "Mock verified and saved" : "Session complete");
      return;
    }
    if (result.practiceKind === "concept") {
      openItem(result.item, 5, undefined, undefined, "concept");
      return;
    }
    chooseStage(Math.min(5, stage + 1));
  }

  function handleResultRetry() {
    if (!result) return;
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

  return (
    <div className={`app-shell ${focusMode ? "is-focus" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to practice content
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
          items={allItems}
          cloudStatus={cloud.status}
          cloudDaily={cloud.dailyChallenge}
          onOpen={openItem}
          onReview={() => randomItem("due")}
          onBrowse={() => navigateView("library")}
          onCreate={() => setCustomEditor("new")}
          onSessions={() => navigateView("sessions")}
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
      {view === "practice" && (
        <PracticeView
          key={`${selectedId}:${stage}:${practiceKind}:${practiceEpoch}`}
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
          dueCount={dueItems.length}
          reveal={reveal}
          focusMode={focusMode}
          errorKeys={draft.keyErrors}
          now={now}
          activeSession={state.activeSession}
          onOpenItem={openItem}
          onChooseStage={chooseStage}
          onChoosePracticeKind={choosePracticeKind}
          onChange={handleChange}
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
          onUseHint={() => updateDraft({ ...draft, peeks: draft.peeks + 1 })}
          onSolveComplete={finishSolve}
          onConceptChange={updateConceptResponse}
          onConceptReveal={revealConceptAnswer}
          onConceptComplete={finishConcept}
          onReveal={toggleReveal}
          onFavorite={() => toggleFavorite(selectedId)}
          onFocusMode={() => setFocusMode((value) => !value)}
          onReview={() => randomItem("due")}
          onBrowse={() => navigateView("library")}
          onRandom={() => randomItem()}
          onSession={() => navigateView("sessions")}
          onSkipSession={skipSessionEntry}
          onEndSession={endSession}
        />
      )}
      {view === "sessions" && (
        <SessionsView
          state={state}
          items={allItems}
          onStart={startSession}
          onStartMock={startMockInterview}
          now={now}
          onResume={resumeSession}
          onSkip={skipSessionEntry}
          onEnd={endSession}
        />
      )}
      {view === "library" && (
        <LibraryView
          state={state}
          items={allItems}
          onOpen={openItem}
          onFavorite={toggleFavorite}
          onCreate={() => setCustomEditor("new")}
          onEdit={setCustomEditor}
          onArchive={archiveCustom}
        />
      )}
      {view === "records" && (
        <RecordsView
          key={`${cloud.status}:${cloud.refresh}:${cloud.session?.profile?.handle ?? "local"}:${cloud.session?.profile?.updatedAt ?? "new"}`}
          state={state}
          items={allItems}
          cloud={cloud}
          onOpen={openItem}
          onReview={() => randomItem("due")}
          onToggleUploads={toggleCommunityUploads}
          onCloudRefresh={() =>
            setCloud((current) => ({
              ...current,
              refresh: current.refresh + 1,
            }))
          }
        />
      )}
      {view === "settings" && (
        <SettingsView
          state={state}
          onUpdate={updateSettings}
          onExport={exportProgress}
          onImport={() => importRef.current?.click()}
          onReset={resetAllData}
        />
      )}

      <input
        ref={importRef}
        className="visually-hidden"
        type="file"
        accept="application/json"
        onChange={importProgress}
      />
      {result && (
        <ResultDialog
          key={result.id}
          result={result}
          onClose={() => setResult(null)}
          onNext={handleResultNext}
          onRetry={handleResultRetry}
          onRandom={() => randomItem()}
          onRecords={() => navigateView("records")}
          debrief={state.learningEvents.find(
            (event) => event.attemptId === result.id,
          )}
          onSaveDebrief={saveResultDebrief}
          cloud={cloud}
        />
      )}
      {customEditor && (
        <CustomSnippetDialog
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
  onOpen,
  onReview,
  onBrowse,
  onCreate,
  onSessions,
  onStartCoach,
  onResumeSession,
}: {
  ready: boolean;
  state: AppState;
  items: PracticeItem[];
  cloudStatus: CloudRuntime["status"];
  cloudDaily: CloudDailyChallenge | null;
  onOpen: (
    item: PracticeItem,
    stage?: number,
    challengeDate?: string,
    sessionId?: string,
    practiceKind?: PracticeKind,
  ) => void;
  onReview: () => void;
  onBrowse: () => void;
  onCreate: () => void;
  onSessions: () => void;
  onStartCoach: (
    entries: SessionQueueEntry[],
    budgetMinutes: number,
  ) => void;
  onResumeSession: () => void;
}) {
  const todayDate = ready ? new Date() : new Date(2000, 0, 1, 12);
  const today = cloudDaily?.date ?? dayKey(todayDate);
  const interviewItems = BUILTIN_ITEMS.filter(
    (item) => item.track === "interview" && item.difficulty !== "Hard",
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
  const dailyAvailable =
    cloudStatus === "local" || Boolean(cloudDaily && remoteDaily);
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
      <DailyCoach
        ready={ready}
        state={state}
        items={items}
        onStart={onStartCoach}
        onResume={onResumeSession}
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
              onClick={() =>
                onOpen(
                  draftItem,
                  state.draft?.stage,
                  undefined,
                  state.draft?.sessionId,
                  state.draft?.practiceKind,
                )
              }
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
  dueCount: number;
  reveal: boolean;
  focusMode: boolean;
  errorKeys: Record<string, number>;
  now: number;
  activeSession: TrainingSession | null;
  onOpenItem: (
    item: PracticeItem,
    stage?: number,
    challengeDate?: string,
    sessionId?: string,
    practiceKind?: PracticeKind,
  ) => void;
  onChooseStage: (stage: number) => void;
  onChoosePracticeKind: (kind: PracticeKind) => void;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  onReset: () => void;
  onTestRun: () => void;
  onUseHint: () => void;
  onSolveComplete: (
    source: string,
    result: PythonVerificationResult,
    runs: number,
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
};

function PracticeView(props: PracticeProps) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [verificationState, setVerificationState] = useState<{
    itemId: ItemId;
    status: "idle" | "loading" | "running" | "passed" | "failed" | "error";
    result?: PythonVerificationResult;
    message?: string;
    source?: string;
    runs?: number;
  }>({ itemId: props.item.itemId, status: "idle" });
  const [solveHintLevel, setSolveHintLevel] = useState(0);
  const pythonRunner = useRef<PythonRunner | null>(null);
  const verificationRunId = useRef(0);
  const [lastRunnableSource, setLastRunnableSource] = useState<{
    itemId: ItemId;
    source: string;
  } | null>(null);
  const visibleVerificationState =
    verificationState.itemId === props.item.itemId
      ? verificationState
      : { itemId: props.item.itemId, status: "idle" as const };
  const isMock = Boolean(
    props.activeSession?.kind === "mock" &&
      props.draft.sessionId === props.activeSession.id,
  );
  const mockRemainingMs = isMock
    ? (mockInterviewRemainingMs(props.activeSession, props.now) ?? 0)
    : null;

  useEffect(
    () => () => {
      pythonRunner.current?.dispose();
    },
    [],
  );
  const visible = useMemo(
    () =>
      props.items
        .filter((item) =>
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
  const editorLineCount = Math.max(
    problemLineCount(props.item),
    props.draft.value.split("\n").length,
  );
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

  async function runPythonChecks() {
    if (!props.item.verification || !runnerSource.trim()) return;
    const sourceToVerify = runnerSource;
    const runs = props.draft.testRuns + 1;
    const runId = ++verificationRunId.current;
    props.onTestRun();
    try {
      const runner = pythonRunner.current ?? createPythonRunner();
      pythonRunner.current = runner;
      setVerificationState({
        itemId: props.item.itemId,
        status:
          visibleVerificationState.status === "idle" ? "loading" : "running",
      });
      const result = await runner.verify(
        sourceToVerify,
        props.item.verification,
      );
      if (runId !== verificationRunId.current) return;
      setVerificationState({
        itemId: props.item.itemId,
        status: result.ok ? "passed" : "failed",
        result,
        source: sourceToVerify,
        runs,
      });
    } catch (error) {
      if (runId !== verificationRunId.current) return;
      setVerificationState({
        itemId: props.item.itemId,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Python checks could not run.",
      });
    }
  }

  function handleEditorChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const proposed = event.target.value;
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
      setVerificationState({ itemId: props.item.itemId, status: "idle" });
    }
    props.onChange(event);
  }

  function revealSolveHint() {
    setSolveHintLevel((current) => Math.min(3, current + 1));
    props.onUseHint();
  }

  function resetPractice() {
    if (lastRunnableSource?.itemId === props.item.itemId) {
      setLastRunnableSource(null);
    }
    verificationRunId.current += 1;
    setVerificationState({ itemId: props.item.itemId, status: "idle" });
    props.onReset();
  }
  return (
    <main id="main-content" tabIndex={-1} className="practice-layout">
      <aside className="problem-rail">
        <div className="rail-head">
          <span className="eyebrow">
            {props.activeSession ? "Active session" : "Problem queue"}
          </span>
          <span className="count-badge">
            {props.activeSession
              ? `${props.activeSession.currentIndex + 1}/${props.activeSession.entries.length}`
              : props.items.length}
          </span>
        </div>
        {props.activeSession ? (
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
              View session
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
          className="mobile-practice-controls"
          aria-label="Practice problem controls"
        >
          {props.activeSession ? (
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
                    .filter((candidate) => candidate.track === "ios")
                    .map((candidate) => (
                      <option value={candidate.itemId} key={candidate.itemId}>
                        {itemDisplayId(candidate)} {candidate.title}
                      </option>
                    ))}
                </optgroup>
              </select>
            </label>
          )}
          <button onClick={resetPractice}>Restart</button>
          {!props.activeSession && (
            <button onClick={props.onRandom}>Random</button>
          )}
        </nav>
        {props.activeSession &&
          props.draft.sessionId === props.activeSession.id && (
            <div className={`session-strip ${isMock ? "mock" : ""}`}>
              <span>
                <small>
                  {isMock
                    ? "Timed mock interview"
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
                {!isMock && (
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
              <span>{isMock ? "Pattern hidden" : props.item.pattern}</span>
              {props.item.source === "custom" && <span>Device-local</span>}
            </div>
            <h1>{props.item.title}</h1>
            <p>{props.item.summary}</p>
          </div>
          <div className="problem-actions">
            <button
              className={favorite ? "favorite active" : "favorite"}
              onClick={props.onFavorite}
              aria-label={favorite ? "Remove favorite" : "Add favorite"}
            >
              {favorite ? "★" : "☆"}
            </button>
            {prompt && !isMock && (
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
        {isMock ? (
          <div className="mock-policy" role="status">
            <span>Interview mode locked</span>
            <strong>Solve from the prompt and executable feedback only.</strong>
            <small>
              Pattern guidance, hints, the reference solution, and expected test
              values stay hidden until this mock ends.
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
              !props.item.verification ||
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
                : props.item.verification
                ? "Write any passing Python solution"
                : "Verified Python exercises only"}
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
        ) : (
          <>
        {isMock && props.item.verification && (
          <section className="mock-prompt-card" aria-labelledby="mock-prompt-title">
            <div>
              <span className="eyebrow">Interview prompt</span>
              <h2 id="mock-prompt-title">{formatMockEntrypoint(props.item)}</h2>
              <p>{props.item.summary}</p>
            </div>
            <div className="mock-visible-cases">
              <strong>Visible inputs</strong>
              <ul>
                {props.item.verification.cases.slice(0, 3).map((testCase) => (
                  <li key={testCase.name}>
                    <span>{testCase.name}</span>
                    <code>input: {formatMockArgs(testCase.args)}</code>
                    <small>Expected output hidden during the mock</small>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
        {!isMock && <div className="insight-grid">
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
        {props.practiceKind === "solving" && !isMock && (
          <div className="solve-hint-bar">
            <span>
              <small>Independent solve</small>
              <strong>
                {solveHintLevel === 0
                  ? "No hints used"
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
        {props.practiceKind === "solving" && !isMock && solveHintLevel >= 3 && (
          <details className="solve-reference" open>
            <summary>Reference solution</summary>
            <pre>{props.item.code}</pre>
          </details>
        )}
        {props.practiceKind === "typing" ? (
          <div className="stage-panel">
            <div className="stage-title">
              <span className="eyebrow">Recall ladder</span>
              <span>{STAGES[props.stage - 1].note}</span>
            </div>
            <div className="stage-track">
              {STAGES.map((step) => (
                <button
                  key={step.id}
                  className={`${props.stage === step.id ? "active" : ""} ${step.id <= props.stats.highestStage ? "complete" : ""}`}
                  aria-pressed={props.stage === step.id}
                  disabled={Boolean(props.draft.sessionId)}
                  onClick={() => props.onChooseStage(step.id)}
                  title={
                    props.draft.sessionId
                      ? "This session step has a fixed recall stage"
                      : step.note
                  }
                >
                  <span>
                    {step.id <= props.stats.highestStage ? "✓" : step.id}
                  </span>
                  <small>{step.short}</small>
                </button>
              ))}
            </div>
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
        <div className="editor-card">
          <div className="editor-toolbar">
            <div className="window-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="file-tab">
              <span className={`swift-badge ${props.item.language}`}>
                {LANGUAGE_META[props.item.language].short}
              </span>
              {LANGUAGE_META[props.item.language].file}{" "}
              <small>{problemLineCount(props.item)} lines</small>
            </div>
            <div className="editor-actions">
              <button className="copy-action" onClick={copyPracticeLink}>
                {copied ? "Copied" : "Copy link"}
              </button>
              {props.practiceKind === "typing" && (
                <button className="peek-action" onClick={props.onReveal}>
                  {props.reveal ? "Hide answer" : "Peek"}
                </button>
              )}
              <button className="restart-action" onClick={resetPractice}>
                Restart
              </button>
              <button className="focus-action" onClick={props.onFocusMode}>
                {props.focusMode ? "Exit focus" : "Focus"}
              </button>
            </div>
          </div>
          <div className="metric-strip" aria-live="polite">
            {props.practiceKind === "typing" ? (
              <>
                <span>
                  <small>Progress</small>
                  <strong>{props.metrics.progress}%</strong>
                </span>
                {props.state.settings.showLiveWpm && (
                  <span>
                    <small>WPM</small>
                    <strong>{props.metrics.wpm}</strong>
                  </span>
                )}
                <span>
                  <small>Accuracy</small>
                  <strong>{props.metrics.accuracy}%</strong>
                </span>
                <span>
                  <small>Errors</small>
                  <strong>{errorCount}</strong>
                </span>
                <span>
                  <small>Lines left</small>
                  <strong>{linesLeft}</strong>
                </span>
              </>
            ) : (
              <>
                <span>
                  <small>Workspace</small>
                  <strong>{editorLineCount} lines</strong>
                </span>
                <span>
                  <small>Test runs</small>
                  <strong>{props.draft.testRuns}</strong>
                </span>
                <span>
                  <small>{isMock ? "Guidance" : "Hints"}</small>
                  <strong>{isMock ? "Locked" : props.draft.peeks}</strong>
                </span>
              </>
            )}
            <span>
              <small>Time</small>
              <strong>{formatDuration(props.metrics.durationMs)}</strong>
            </span>
            <span className="strict-indicator">
              <i />
              {props.practiceKind === "solving"
                ? "Free-form solve"
                : props.draft.challengeDate || props.state.settings.strictMode
                  ? "Strict correction"
                  : "Free correction"}
            </span>
          </div>
          <div
            className="editor-wrap"
            style={
              {
                "--font-size": `${props.state.settings.fontSize}px`,
                "--editor-lines": props.state.settings.editorLines,
                "--code-height": `${editorLineCount * props.state.settings.fontSize * 1.65 + 56}px`,
              } as React.CSSProperties
            }
          >
            <pre className="line-numbers" aria-hidden="true">
              {Array.from(
                { length: editorLineCount },
                (_, index) => index + 1,
              ).join("\n")}
            </pre>
            <pre className="ghost-layer" aria-hidden="true">
              {props.ghostCode}
            </pre>
            <pre className="typed-layer" aria-hidden="true">
              {props.draft.value.split("").map((char, index) => (
                <span
                  className={
                    props.practiceKind === "solving" ||
                    char === props.item.code[index]
                      ? "right"
                      : "wrong"
                  }
                  key={`${index}-${char}`}
                >
                  {char}
                </span>
              ))}
            </pre>
            <textarea
              value={props.draft.value}
              onChange={handleEditorChange}
              onKeyDown={props.onKeyDown}
              onPaste={props.onPaste}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label={`${props.practiceKind === "solving" ? "Solve" : "Type"} the ${LANGUAGE_META[props.item.language].label} solution for ${props.item.title}. Press Escape to leave the editor.`}
            />
          </div>
          <div className="editor-footer">
            <span>
              <i className="key-swatch typed" />
              typed
            </span>
            {props.practiceKind === "typing" && (
              <>
                <span>
                  <i className="key-swatch ghost" />
                  ghost
                </span>
                <span>
                  <i className="key-swatch hidden" />
                  hidden
                </span>
              </>
            )}
            <span className="spacer" />
            <span>
              Tab inserts {props.state.settings.tabSize} spaces · Esc leaves
              editor
            </span>
          </div>
          {props.practiceKind === "typing" && (
            <div className="progress-line">
              <i style={{ width: `${props.metrics.progress}%` }} />
            </div>
          )}
        </div>
        {props.item.verification && (
          <section className="python-verification" aria-live="polite">
            <div>
              <span className="eyebrow">Browser Python · local subset</span>
              <h2>
                {props.practiceKind === "solving"
                  ? "Verify your implementation."
                  : "Run the solution against real checks."}
              </h2>
              <p>
                Your code stays on this device. Every check starts in a fresh
                Python worker; the first one loads the bundled runtime. The
                full exercise catalog is tested here, while CPython-only
                packages and a few newer language features are intentionally
                outside this fast local subset.
                {props.practiceKind === "solving"
                  ? " A passing solve can be recorded as independent problem-solving evidence, separate from typing speed and rankings."
                  : " Checks never affect mastery or public rankings."}
              </p>
            </div>
            <div className="python-verification-actions">
              <button
                className="primary-button"
                disabled={
                  !runnerSource.trim() ||
                  visibleVerificationState.status === "loading" ||
                  visibleVerificationState.status === "running"
                }
                onClick={runPythonChecks}
              >
                {visibleVerificationState.status === "loading"
                  ? "Loading Python…"
                  : visibleVerificationState.status === "running"
                    ? "Running checks…"
                    : "Run checks"}
              </button>
              {!runnerSource.trim() && (
                <small>Type some code before running checks.</small>
              )}
              {props.practiceKind === "typing" &&
                !props.draft.value.trim() &&
                runnerSource.trim() && (
                  <small>Using your most recent completed solution.</small>
                )}
              {props.practiceKind === "solving" &&
                visibleVerificationState.status === "passed" &&
                visibleVerificationState.result?.ok &&
                visibleVerificationState.source === runnerSource && (
                  <button
                    className="primary-button record-solve"
                    onClick={() =>
                      props.onSolveComplete(
                        runnerSource,
                        visibleVerificationState.result as PythonVerificationResult,
                        visibleVerificationState.runs ?? props.draft.testRuns,
                      )
                    }
                  >
                    Record verified solve →
                  </button>
                )}
            </div>
            {visibleVerificationState.result && (
              <div
                className={`python-verification-results ${visibleVerificationState.result.ok ? "passed" : "failed"}`}
              >
                <strong>
                  {visibleVerificationState.result.ok
                    ? `All ${visibleVerificationState.result.cases.length} checks passed`
                    : `${visibleVerificationState.result.cases.filter((testCase) => testCase.passed).length}/${visibleVerificationState.result.cases.length} checks passed`}
                </strong>
                <small>
                  {visibleVerificationState.result.durationMs} ms after runtime
                  load
                </small>
                {visibleVerificationState.result.setupError && (
                  <code>{visibleVerificationState.result.setupError}</code>
                )}
                {isMock ? (
                  <p className="mock-test-note">
                    Individual inputs and expected values are withheld during
                    the mock. Use the aggregate result to test your own edge
                    cases.
                  </p>
                ) : (
                <ul>
                  {visibleVerificationState.result.cases.map((testCase, index) => (
                    <li
                      className={testCase.passed ? "passed" : "failed"}
                      key={testCase.name}
                    >
                      <span>{testCase.passed ? "✓" : "×"}</span>
                      <strong>{testCase.name}</strong>
                      {testCase.error && <code>{testCase.error}</code>}
                      {!testCase.passed && !testCase.error && (
                        <code>
                          expected: {JSON.stringify(
                            props.item.verification?.cases[index]?.expected,
                          )}
                          {"\n"}
                          received: {JSON.stringify(testCase.actual)}
                        </code>
                      )}
                    </li>
                  ))}
                </ul>
                )}
              </div>
            )}
            {visibleVerificationState.status === "error" && (
              <div className="python-verification-results failed">
                <strong>Checks could not run</strong>
                <code>{visibleVerificationState.message}</code>
              </div>
            )}
          </section>
        )}
        {isMock ? (
          <section className="mock-rules">
            <span className="eyebrow">Mock interview contract</span>
            <strong>Clarify, plan, implement, test, and explain.</strong>
            <p>
              This is local practice evidence, not a proctored score. A clean
              verified solve records independent evidence; ending or timing out
              preserves the attempt for review without advancing mastery.
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
        {!isMock && props.state.settings.showKeyboard && (
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
  onStart,
  onStartMock,
  now,
  onResume,
  onSkip,
  onEnd,
}: {
  state: AppState;
  items: PracticeItem[];
  onStart: (
    options: SessionBuildOptions,
    entries?: SessionQueueEntry[],
  ) => void;
  onStartMock: (preset: MockInterviewPresetId) => void;
  now: number;
  onResume: () => void;
  onSkip: () => void;
  onEnd: () => void;
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
  const activeMockRemaining =
    active?.kind === "mock"
      ? (mockInterviewRemainingMs(active, now) ?? 0)
      : null;
  return (
    <main id="main-content" tabIndex={-1} className="page-container sessions-page">
      <PageHeading
        eyebrow="Deliberate practice"
        title="Practice deliberately, then rehearse the real interview."
        copy="Build a persistent learning queue or enter a timed mock where guidance and expected test values stay locked."
      />
      <section className="mock-interview-center">
        <div className="mock-interview-copy">
          <span className="eyebrow">Interview simulator</span>
          <h2>One cold problem. A real countdown. No answer access.</h2>
          <p>
            Each preset chooses under-practiced verified Python work. The timer
            survives reloads, pattern guidance stays hidden, and only a clean
            executable pass counts as independent solve evidence.
          </p>
        </div>
        <div className="mock-preset-grid">
          {MOCK_INTERVIEW_PRESETS.map((preset) => (
            <article key={preset.id}>
              <span>{preset.durationMinutes} min</span>
              <strong>{preset.label}</strong>
              <small>{preset.note}</small>
              <button
                className="primary-button"
                onClick={() => onStartMock(preset.id)}
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
                  <b>
                    {session.kind === "mock"
                      ? session.completed
                        ? "Verified"
                        : "Review"
                      : `${session.completed}/${session.total}`}
                  </b>
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

function LibraryView({
  state,
  items,
  onOpen,
  onFavorite,
  onCreate,
  onEdit,
  onArchive,
}: {
  state: AppState;
  items: PracticeItem[];
  onOpen: (
    item: PracticeItem,
    stage?: number,
    challengeDate?: string,
    sessionId?: string,
    practiceKind?: PracticeKind,
  ) => void;
  onFavorite: (id: ItemId) => void;
  onCreate: () => void;
  onEdit: (item: PracticeItem) => void;
  onArchive: (id: ItemId) => void;
}) {
  const [query, setQuery] = useState("");
  const [lane, setLane] = useState<"All" | "python" | "swift" | "ios">("All");
  const [pattern, setPattern] = useState<Pattern | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [lineRange, setLineRange] = useState<LineRange>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [status, setStatus] = useState<
    "All" | "New" | "Learning" | "Owned" | "Due" | "Favorites" | "My snippets"
  >("All");
  const [sort, setSort] = useState<Sort>("recommended");
  useEffect(() => {
    function syncLane() {
      const route = parseRoute(window.location.href);
      setLane(
        route.track === "ios"
          ? "ios"
          : route.language === "python" || route.language === "swift"
            ? route.language
            : "All",
      );
      setPattern("All");
    }
    const tabs = document.querySelector<HTMLElement>(".track-tabs.four");
    function syncClick(event: Event) {
      const button =
        event.target instanceof Element ? event.target.closest("button") : null;
      const buttons = tabs ? [...tabs.querySelectorAll("button")] : [];
      const index = button ? buttons.indexOf(button) : -1;
      const lanes = ["All", "python", "swift", "ios"] as const;
      if (index >= 0) {
        const value = lanes[index];
        const route: AppRoute =
          value === "All"
            ? { view: "library" }
            : value === "ios"
              ? { view: "library", language: "swift", track: "ios" }
              : { view: "library", language: value, track: "interview" };
        window.history.pushState(
          {},
          "",
          serializeRoute(route, window.location.href),
        );
      }
    }
    syncLane();
    window.addEventListener("popstate", syncLane);
    tabs?.addEventListener("click", syncClick);
    return () => {
      window.removeEventListener("popstate", syncLane);
      tabs?.removeEventListener("click", syncClick);
    };
  }, []);
  const filtered = useMemo(
    () =>
      items
        .filter((item) => {
          const stats = itemStats(state, item.itemId);
          const text =
            `${itemDisplayId(item)} ${item.title} ${item.pattern} ${item.cue} ${item.tags.join(" ")}`
              .toLowerCase()
              .includes(query.toLowerCase());
          const statusMatch =
            status === "All" ||
            (status === "New" && !stats.completions) ||
            (status === "Learning" && stats.highestStage > 0 && !stats.owned) ||
            (status === "Owned" && stats.owned) ||
            (status === "Due" && isReviewDue(state, item.itemId)) ||
            (status === "Favorites" && state.favorites.includes(item.itemId)) ||
            (status === "My snippets" && item.source === "custom");
          return (
            text &&
            matchesLane(item, lane) &&
            (pattern === "All" || item.pattern === pattern) &&
            (difficulty === "All" || item.difficulty === difficulty) &&
            matchesCatalogRanges(
              {
                lineCount: problemLineCount(item),
                estimatedMinutes: item.estimatedMinutes,
              },
              lineRange,
              timeRange,
            ) &&
            statusMatch
          );
        })
        .sort((a, b) =>
          sort === "number"
            ? a.id - b.id
            : sort === "title"
              ? a.title.localeCompare(b.title)
              : sort === "difficulty"
                ? DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]
                : itemStats(state, a.itemId).highestStage -
                    itemStats(state, b.itemId).highestStage ||
                  a.title.localeCompare(b.title),
        ),
    [
      items,
      state,
      query,
      lane,
      pattern,
      difficulty,
      lineRange,
      timeRange,
      status,
      sort,
    ],
  );
  const activeFilterCount = [
    query.trim() ? query : "",
    lane !== "All" ? lane : "",
    pattern !== "All" ? pattern : "",
    difficulty !== "All" ? difficulty : "",
    lineRange !== "all" ? lineRange : "",
    timeRange !== "all" ? timeRange : "",
    status !== "All" ? status : "",
  ].filter(Boolean).length;

  function clearFilters() {
    setQuery("");
    setLane("All");
    setPattern("All");
    setDifficulty("All");
    setLineRange("all");
    setTimeRange("all");
    setStatus("All");
    setSort("recommended");
  }
  return (
    <main id="main-content" tabIndex={-1} className="page-container">
      <div className="heading-actions">
        <PageHeading
          eyebrow="Python, Swift, and iOS catalog"
          title="Choose what to own next."
          copy="Python interview fluency, Swift algorithms, and practical iOS fundamentals share one progressive recall ladder."
        />
        <button className="primary-button" onClick={onCreate}>
          + Add code snippet
        </button>
      </div>
      <div className="track-tabs four" aria-label="Curriculum lane">
        {(["All", "python", "swift", "ios"] as const).map((value) => (
          <button
            key={value}
            aria-pressed={lane === value}
            className={lane === value ? "active" : ""}
            onClick={() => {
              setLane(value);
              setPattern("All");
            }}
          >
            {value === "All"
              ? "All practice"
              : value === "ios"
                ? "iOS & Swift"
                : `${LANGUAGE_META[value].label} interview`}
            <small>
              {items.filter((item) => matchesLane(item, value)).length}
            </small>
          </button>
        ))}
      </div>
      <div className="library-toolbar">
        <label className="search-box wide">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${items.length} items, patterns, or cues`}
          />
        </label>
        <label className="filter-field">
          <span>Pattern</span>
          <select
            value={pattern}
            onChange={(event) =>
              setPattern(event.target.value as Pattern | "All")
            }
          >
            <option>All</option>
            {(lane === "python"
              ? PYTHON_PATTERN_ORDER
              : lane === "swift"
                ? INTERVIEW_PATTERN_ORDER
                : lane === "ios"
                  ? IOS_PATTERN_ORDER
                  : PATTERN_ORDER
            ).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Difficulty</span>
          <select
            value={difficulty}
            onChange={(event) =>
              setDifficulty(event.target.value as Difficulty | "All")
            }
          >
            <option>All</option>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Length</span>
          <select
            value={lineRange}
            onChange={(event) => setLineRange(event.target.value as LineRange)}
          >
            {LINE_RANGE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Estimated time</span>
          <select
            value={timeRange}
            onChange={(event) => setTimeRange(event.target.value as TimeRange)}
          >
            {TIME_RANGE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field sort-filter">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
          >
            <option value="recommended">Recommended</option>
            <option value="number">Catalog order</option>
            <option value="title">Title</option>
            <option value="difficulty">Difficulty</option>
          </select>
        </label>
      </div>
      <div className="filter-chips">
        {(
          [
            "All",
            "New",
            "Learning",
            "Owned",
            "Due",
            "Favorites",
            "My snippets",
          ] as const
        ).map((value) => (
          <button
            className={status === value ? "active" : ""}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
            key={value}
          >
            {value}
            {value === "Due" &&
              ` (${items.filter((item) => isReviewDue(state, item.itemId)).length})`}
          </button>
        ))}
      </div>
      <div className="library-summary">
        <strong>{filtered.length}</strong> results <span />
        <small>Ownership requires clean recall or a verified solve</small>
        {activeFilterCount > 0 && (
          <button className="clear-filters" onClick={clearFilters}>
            Clear {activeFilterCount} filter
            {activeFilterCount === 1 ? "" : "s"}
          </button>
        )}
      </div>
      <div className="problem-grid">
        {filtered.map((item) => {
          const stats = itemStats(state, item.itemId);
          const due = reviewDueAt(state, item.itemId);
          return (
            <article className="problem-card" key={item.itemId}>
              <div className="problem-card-top">
                <span className="problem-number">
                  {itemDisplayId(item)}
                  {item.source === "custom"
                    ? ` · LOCAL R${item.contentRevision}`
                    : ""}
                </span>
                <div>
                  <button
                    onClick={() => onFavorite(item.itemId)}
                    aria-label="Toggle favorite"
                  >
                    {state.favorites.includes(item.itemId) ? "★" : "☆"}
                  </button>
                  {item.source === "custom" && (
                    <button
                      className="edit-button"
                      onClick={() => onEdit(item)}
                      aria-label="Edit snippet"
                    >
                      Edit
                    </button>
                  )}
                  {item.source === "custom" && (
                    <button
                      className="archive-button"
                      onClick={() => onArchive(item.itemId)}
                      aria-label="Archive snippet"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <h2>{item.title}</h2>
              <div className="problem-tags">
                <span className={`difficulty ${item.difficulty.toLowerCase()}`}>
                  {item.difficulty}
                </span>
                <span>{laneLabel(item)}</span>
                <span>{item.pattern}</span>
              </div>
              <p>{item.cue}</p>
              <div className="mini-stage-track">
                {STAGES.map((step) => (
                  <i
                    key={step.id}
                    className={
                      step.id <= stats.highestStage
                        ? "complete"
                        : step.id === stats.highestStage + 1
                          ? "next"
                          : ""
                    }
                  />
                ))}
              </div>
              <div className="problem-card-meta">
                <span>
                  {item.track === "ios" && stats.completions
                    ? `${stats.conceptCompletions} concept recalls · ${stats.strongConceptCompletions} strong retrievals`
                    : stats.completions
                      ? `${stats.completions} attempts · ${stats.solveCompletions} verified solves · ${stats.bestWpm} best WPM`
                    : `${problemLineCount(item)} lines · ~${item.estimatedMinutes} min`}
                </span>
                {due && (
                  <span
                    className={isReviewDue(state, item.itemId) ? "due" : ""}
                  >
                    {isReviewDue(state, item.itemId)
                      ? "Due now"
                      : `Review ${formatDay(due)}`}
                  </span>
                )}
              </div>
              <div className="problem-card-actions">
                <button className="primary-button" onClick={() => onOpen(item)}>
                  {item.track === "ios"
                    ? stats.conceptCompletions
                      ? "Continue concept recall"
                      : "Start concept recall"
                    : stats.owned
                    ? "Practice independent recall"
                    : stats.highestStage
                      ? `Continue at stage ${Math.min(5, stats.highestStage + 1)}`
                      : "Start with full ghost"}
                  <span>→</span>
                </button>
                {item.verification && (
                  <button
                    className="outline-button solve-card-action"
                    onClick={() =>
                      onOpen(item, 5, undefined, undefined, "solving")
                    }
                  >
                    Solve from starter
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <span>⌕</span>
          <h2>No matching items</h2>
          <p>Try a broader filter or add your own Python or Swift snippet.</p>
        </div>
      )}
    </main>
  );
}

function RecordsView({
  state,
  items,
  cloud,
  onOpen,
  onReview,
  onToggleUploads,
  onCloudRefresh,
}: {
  state: AppState;
  items: PracticeItem[];
  cloud: CloudRuntime;
  onOpen: (
    item: PracticeItem,
    stage?: number,
    challengeDate?: string,
    sessionId?: string,
    practiceKind?: PracticeKind,
  ) => void;
  onReview: () => void;
  onToggleUploads: (enabled: boolean) => void;
  onCloudRefresh: () => void;
}) {
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
  const eligible = attempts.filter(eligibleAttempt);
  const currentEligible = eligible.filter((attempt) =>
    items.some(
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
  const owned = items.filter(
    (item) => itemStats(state, item.itemId).owned,
  ).length;
  const due = items.filter((item) => isReviewDue(state, item.itemId));
  const maxWpm = Math.max(1, ...recent.map((attempt) => attempt.wpm));
  const patternStats = PATTERN_ORDER.map((pattern) => {
    const group = BUILTIN_ITEMS.filter((item) => item.pattern === pattern);
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
    const group = items.filter((item) => matchesLane(item, lane));
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
      <CommunityPanel
        state={state}
        items={items}
        status={cloud.status}
        session={cloud.session}
        onToggleUploads={onToggleUploads}
        onRefresh={onCloudRefresh}
      />
      <ReadinessAnalytics state={state} items={items} dueCount={due.length} />
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
          value={`${owned}/${items.length}`}
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
        onOpenItem={onOpen}
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
                      : "This custom snippet is archived"
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
  onUpdate,
  onExport,
  onImport,
  onReset,
}: {
  state: AppState;
  onUpdate: (patch: Partial<Settings>) => void;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="page-container settings-page">
      <PageHeading
        eyebrow="Make it yours"
        title="Practice settings."
        copy="Tune the editor for comfort. Preferences, snippets, and history stay in this browser unless you explicitly enable community uploads or export them."
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
          <h2>Local profile</h2>
          <p>
            Export a portable v12 JSON backup with Python, Swift, iOS, sessions,
            learning debriefs, revisioned snippets, local pacing and weak-line
            analytics, and
            community preferences—or restore any v2–v9 backup.
          </p>
        </div>
        <div className="data-actions">
          <button className="outline-button" onClick={onExport}>
            Export progress
          </button>
          <button className="outline-button" onClick={onImport}>
            Import backup
          </button>
          <button className="danger-button" onClick={onReset}>
            Clear local data
          </button>
        </div>
      </section>
    </main>
  );
}

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
  debrief?: LearningEvent;
  onSaveDebrief: (input: DebriefInput) => void;
  cloud: CloudRuntime;
}) {
  const eligible = eligibleAttempt(result);
  const isSolve = result.practiceKind === "solving";
  const isConcept = result.practiceKind === "concept";
  const isCleanSolve = result.qualification === "solved";
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
          {isSolve
            ? result.mockInterview
              ? "Mock interview verified"
              : "Solution verified"
            : isConcept
              ? "Concept recall saved"
            : `Pass complete · Stage ${result.stage}`}
        </span>
        <h2 id="result-title">{result.item.title}</h2>
        <p>
          {result.sessionComplete
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
                ? result.qualification === "independent"
                  ? "Independent recall verified. This solution now counts as owned."
                  : "Clean pass recorded. Keep climbing toward blank-editor recall."
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
                ? isCleanSolve
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
        {!isConcept && (
          <AttemptForensics attempt={result} item={result.item} />
        )}
        {!isConcept && (
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
        {result.nextReview && (
          <div className="result-review">
            <span>Next review</span>
            <strong>{formatDay(result.nextReview)}</strong>
            <small>
              {successful ? "Interval advanced" : "Returns tomorrow"}
            </small>
          </div>
        )}
        <div className="result-actions">
          <button className="outline-button" onClick={onRetry}>
            Retry same {isSolve ? "solve" : isConcept ? "concept" : "stage"}
          </button>
          <button className="outline-button" onClick={onRandom}>
            Different problem
          </button>
          <button className="outline-button" onClick={onRecords}>
            Full analysis
          </button>
          <button
            className="primary-button"
            data-modal-autofocus="true"
            autoFocus
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
                  : result.stage < 5
                    ? "Climb to next stage →"
                    : "Practice recall again →"}
          </button>
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
