import {
  BUILTIN_ITEMS,
  type CodeLanguage,
  type ItemId,
  type PracticeItem,
} from "./items";
import {
  normalizeLineErrors,
  normalizeTimelineSamples,
  type TimelineSample,
} from "./analytics.mjs";
import { correctPositionCount } from "./typing-engine.mjs";
import { supportsConceptPractice } from "./concept-practice.mjs";
import { resolveSessionCurrentIndex } from "./sessions.mjs";
import {
  applyDebriefToReviewState,
  normalizeLearningEvents,
  type LearningEvent,
  type RetrievalGrade,
} from "./learning-state.mjs";
import type {
  SessionLanguage,
  SessionQueueEntry,
  SessionSource,
  SessionStageMode,
  SessionTrack,
} from "./sessions.mjs";

export { analyzeEdit, correctPositionCount } from "./typing-engine.mjs";

export const STAGES = [
  {
    id: 1,
    name: "Full ghost",
    short: "Full",
    note: "Copy once while noticing the solution shape.",
  },
  {
    id: 2,
    name: "Missing expressions",
    short: "Gaps",
    note: "Recover names, conditions, and updates.",
  },
  {
    id: 3,
    name: "Missing lines",
    short: "Lines",
    note: "Recall complete implementation steps.",
  },
  {
    id: 4,
    name: "Skeleton only",
    short: "Skeleton",
    note: "Rebuild from signatures and braces.",
  },
  {
    id: 5,
    name: "Blank editor",
    short: "Recall",
    note: "Produce the solution without ghost text.",
  },
] as const;

export type View =
  "today" | "practice" | "sessions" | "library" | "records" | "settings";
export type Theme =
  "midnight" | "paper" | "forest" | "synthwave" | "ember" | "ocean";
export type AttemptQualification =
  "syntax" | "guided" | "independent" | "solved" | "assisted" | "incomplete";
export type PracticeKind = "typing" | "solving" | "concept";
export type VerificationSummary = {
  revision: number;
  passed: number;
  total: number;
  runs: number;
  submissions: number;
};

export type Settings = {
  theme: Theme;
  font: "mono" | "rounded" | "classic";
  fontSize: number;
  tabSize: 2 | 4;
  editorLines: 12 | 16 | 20;
  strictMode: boolean;
  showLiveWpm: boolean;
  showKeyboard: boolean;
  dailyGoalMinutes: number;
  preferredLanguage: CodeLanguage;
};

export type AttemptRecord = {
  id: string;
  itemId: ItemId;
  itemRevision: number;
  titleSnapshot: string;
  language: CodeLanguage;
  stage: number;
  practiceKind: PracticeKind;
  mode: "strict" | "free";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
  rejectedKeystrokes: number;
  corrections: number;
  peeks: number;
  keyErrors: Record<string, number>;
  lineErrors: Record<string, number>;
  timeline: TimelineSample[];
  rawWpm: number;
  wpm: number;
  accuracy: number;
  consistency: number;
  outcome: "completed" | "abandoned";
  qualification: AttemptQualification;
  conceptGrade?: RetrievalGrade;
  conceptCheckIndex?: 0 | 1 | 2;
  verification?: VerificationSummary;
  challengeDate?: string;
  sessionId?: string;
};

export type Draft = {
  itemId: ItemId;
  itemRevision: number;
  stage: number;
  practiceKind: PracticeKind;
  value: string;
  startedAt: number | null;
  totalKeystrokes: number;
  correctKeystrokes: number;
  rejectedKeystrokes: number;
  corrections: number;
  peeks: number;
  keyErrors: Record<string, number>;
  lineErrors: Record<string, number>;
  timeline: TimelineSample[];
  testRuns: number;
  submissions: number;
  customCaseInput: string;
  conceptCommittedAt?: number;
  conceptCommittedResponse?: string;
  challengeDate?: string;
  sessionId?: string;
};

export type TrainingSession = {
  id: string;
  name: string;
  kind: "practice" | "mock";
  source: SessionSource;
  track: SessionTrack;
  language: SessionLanguage;
  stageMode: SessionStageMode;
  createdAt: string;
  entries: SessionQueueEntry[];
  currentIndex: number;
  mockPreset?: "screen" | "standard" | "stretch";
  durationMinutes?: number;
  expiresAt?: string;
};

export type SessionHistoryRecord = {
  id: string;
  name: string;
  kind: "practice" | "mock";
  startedAt: string;
  completedAt: string;
  completed: number;
  total: number;
  durationMinutes?: number;
  outcome?: "completed" | "ended" | "expired";
};

export type CloudPreferences = {
  communityEnabled: boolean;
  uploadedAttemptIds: string[];
  lastSyncedAt?: string;
};

export type AppState = {
  version: 13;
  attempts: AttemptRecord[];
  learningEvents: LearningEvent[];
  favorites: ItemId[];
  customItems: PracticeItem[];
  customCaseInputs: Partial<Record<ItemId, string>>;
  settings: Settings;
  draft: Draft | null;
  lastItemId: ItemId;
  lastStage: number;
  activeSession: TrainingSession | null;
  sessionHistory: SessionHistoryRecord[];
  cloud: CloudPreferences;
};

export const STORAGE_KEY = "swift-ghost-state-v13";
export const TWELFTH_STORAGE_KEY = "swift-ghost-state-v12";
export const PREVIOUS_STORAGE_KEY = "swift-ghost-state-v11";
export const LEGACY_STORAGE_KEY = "swift-ghost-state-v10";
export const OLDER_STORAGE_KEY = "swift-ghost-state-v9";
export const OLDEST_STORAGE_KEY = "swift-ghost-state-v8";
export const ORIGINAL_STORAGE_KEY = "swift-ghost-state-v7";
export const FIRST_STORAGE_KEY = "swift-ghost-state-v6";
export const EARLIEST_STORAGE_KEY = "swift-ghost-state-v5";
export const INITIAL_STORAGE_KEY = "swift-ghost-state-v4";
export const SECOND_VERSION_STORAGE_KEY = "swift-ghost-state-v3";
export const FIRST_VERSION_STORAGE_KEY = "swift-ghost-state-v2";

export const DEFAULT_SETTINGS: Settings = {
  theme: "midnight",
  font: "mono",
  fontSize: 16,
  tabSize: 4,
  editorLines: 16,
  strictMode: true,
  showLiveWpm: true,
  showKeyboard: false,
  dailyGoalMinutes: 20,
  preferredLanguage: "python",
};

export const EMPTY_STATE: AppState = {
  version: 13,
  attempts: [],
  learningEvents: [],
  favorites: [],
  customItems: [],
  customCaseInputs: {},
  settings: DEFAULT_SETTINGS,
  draft: null,
  lastItemId: BUILTIN_ITEMS[0].itemId,
  lastStage: 1,
  activeSession: null,
  sessionHistory: [],
  cloud: { communityEnabled: false, uploadedAttemptIds: [] },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function finiteNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function normalizeKeyErrors(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .flatMap(([key, count]) => {
        const normalizedKey = key.slice(0, 20);
        const normalizedCount = Math.round(finiteNumber(count, 0, 0, 1000000));
        return normalizedKey && normalizedCount
          ? [[normalizedKey, normalizedCount]]
          : [];
      })
      .slice(0, 100),
  );
}

function normalizeVerificationSummary(value: unknown) {
  if (!isRecord(value)) return undefined;
  const total = Math.round(finiteNumber(value.total, 0, 0, 100));
  const passed = Math.round(finiteNumber(value.passed, 0, 0, total));
  if (total < 1) return undefined;
  return {
    revision: Math.round(finiteNumber(value.revision, 1, 1, 1000000)),
    passed,
    total,
    runs: Math.round(finiteNumber(value.runs, 1, 1, 100000)),
    submissions: Math.round(
      finiteNumber(value.submissions, 1, 1, 100000),
    ),
  };
}

function normalizeSettings(value: unknown): Settings {
  const raw = isRecord(value) ? value : {};
  const themes: Theme[] = [
    "midnight",
    "paper",
    "forest",
    "synthwave",
    "ember",
    "ocean",
  ];
  const fonts: Settings["font"][] = ["mono", "rounded", "classic"];
  const tabSize = finiteNumber(raw.tabSize, DEFAULT_SETTINGS.tabSize, 2, 4);
  const editorLines = finiteNumber(
    raw.editorLines,
    DEFAULT_SETTINGS.editorLines,
    12,
    20,
  );
  return {
    theme: themes.includes(raw.theme as Theme)
      ? (raw.theme as Theme)
      : DEFAULT_SETTINGS.theme,
    font: fonts.includes(raw.font as Settings["font"])
      ? (raw.font as Settings["font"])
      : DEFAULT_SETTINGS.font,
    fontSize: Math.round(
      finiteNumber(raw.fontSize, DEFAULT_SETTINGS.fontSize, 12, 24),
    ),
    tabSize: tabSize <= 2 ? 2 : 4,
    editorLines: editorLines <= 12 ? 12 : editorLines <= 16 ? 16 : 20,
    strictMode:
      typeof raw.strictMode === "boolean"
        ? raw.strictMode
        : DEFAULT_SETTINGS.strictMode,
    showLiveWpm:
      typeof raw.showLiveWpm === "boolean"
        ? raw.showLiveWpm
        : DEFAULT_SETTINGS.showLiveWpm,
    showKeyboard:
      typeof raw.showKeyboard === "boolean"
        ? raw.showKeyboard
        : DEFAULT_SETTINGS.showKeyboard,
    dailyGoalMinutes: Math.round(
      finiteNumber(
        raw.dailyGoalMinutes,
        DEFAULT_SETTINGS.dailyGoalMinutes,
        5,
        120,
      ),
    ),
    preferredLanguage: raw.preferredLanguage === "swift" ? "swift" : "python",
  };
}

function normalizeCustomItems(value: unknown): PracticeItem[] {
  if (!Array.isArray(value)) return [];
  const patterns = new Set(BUILTIN_ITEMS.map((item) => item.pattern));
  const normalized = value
    .filter((item): item is PracticeItem => {
      if (!isRecord(item)) return false;
      return (
        typeof item.itemId === "string" &&
        item.itemId.startsWith("custom:") &&
        item.source === "custom" &&
        typeof item.title === "string" &&
        item.title.trim().length > 0 &&
        item.title.length <= 80 &&
        typeof item.code === "string" &&
        item.code.length >= 10 &&
        item.code.length <= 20000 &&
        typeof item.pattern === "string" &&
        patterns.has(item.pattern as PracticeItem["pattern"]) &&
        (item.difficulty === "Easy" ||
          item.difficulty === "Medium" ||
          item.difficulty === "Hard")
      );
    })
    .map((item) => {
      const legacySwiftNote = (item as unknown as Record<string, unknown>)
        .swiftNote;
      const normalizedLanguage: CodeLanguage =
        item.track === "ios"
          ? "swift"
          : item.language === "python"
            ? "python"
            : "swift";
      let sourceUrl: string | undefined;
      if (typeof item.sourceUrl === "string") {
        try {
          const parsed = new URL(item.sourceUrl);
          if (parsed.protocol === "https:" || parsed.protocol === "http:")
            sourceUrl = parsed.toString();
        } catch {
          /* ignore malformed and unsafe imported links */
        }
      }
      return {
        ...item,
        track: (item.track === "ios"
          ? "ios"
          : "interview") as PracticeItem["track"],
        language: normalizedLanguage,
        id: 0,
        title: item.title.trim(),
        slug:
          typeof item.slug === "string"
            ? item.slug.slice(0, 140)
            : item.itemId.replace(":", "-"),
        difficulty: item.difficulty,
        pattern: item.pattern,
        summary:
          typeof item.summary === "string"
            ? item.summary.slice(0, 500)
            : `A device-local ${normalizedLanguage === "python" ? "Python" : "Swift"} snippet for deliberate recall practice.`,
        cue:
          typeof item.cue === "string"
            ? item.cue.slice(0, 1000)
            : "State what this code is trying to preserve before typing.",
        invariant:
          typeof item.invariant === "string"
            ? item.invariant.slice(0, 1000)
            : "Describe the condition that must stay true throughout the implementation.",
        complexity:
          typeof item.complexity === "string"
            ? item.complexity.slice(0, 300)
            : "Add your own complexity check.",
        languageNote:
          typeof item.languageNote === "string"
            ? item.languageNote.slice(0, 1000)
            : typeof legacySwiftNote === "string"
              ? legacySwiftNote.slice(0, 1000)
              : `Notice the ${normalizedLanguage === "python" ? "Python" : "Swift"} syntax and APIs you want to recall reliably.`,
        estimatedMinutes: Math.round(
          finiteNumber(item.estimatedMinutes, 5, 2, 30),
        ),
        contentRevision: Math.round(
          finiteNumber(item.contentRevision, 1, 1, 1000000),
        ),
        isCustom: true,
        code: item.code.replace(/\r\n?/g, "\n").trimEnd(),
        sourceUrl,
        tags: Array.isArray(item.tags)
          ? item.tags
              .filter((tag): tag is string => typeof tag === "string")
              .map((tag) => tag.slice(0, 40))
              .slice(0, 8)
          : [],
        createdAt:
          typeof item.createdAt === "string" &&
          !Number.isNaN(Date.parse(item.createdAt))
            ? item.createdAt
            : undefined,
        updatedAt:
          typeof item.updatedAt === "string" &&
          !Number.isNaN(Date.parse(item.updatedAt))
            ? item.updatedAt
            : undefined,
        archivedAt:
          typeof item.archivedAt === "string" &&
          !Number.isNaN(Date.parse(item.archivedAt))
            ? item.archivedAt
            : undefined,
      };
    });
  return [
    ...new Map(normalized.map((item) => [item.itemId, item])).values(),
  ].slice(-100);
}

function itemIdFromRaw(value: unknown): ItemId | null {
  if (
    typeof value === "string" &&
    /^(builtin:\d+|python:\d+|ios:[\w-]+|custom:[\w-]+)$/.test(value)
  )
    return value as ItemId;
  if (typeof value === "number" && Number.isFinite(value))
    return `builtin:${value}` as ItemId;
  return null;
}

function normalizeActiveSession(
  value: unknown,
  activeIds: Set<ItemId>,
  revisions: Map<ItemId, number>,
  tracks: Map<ItemId, PracticeItem["track"]>,
  languages: Map<ItemId, CodeLanguage>,
  supportsSolving: Map<ItemId, boolean>,
  supportsConcept: Map<ItemId, boolean>,
): TrainingSession | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !Array.isArray(value.entries)
  )
    return null;
  const sessionTrack: SessionTrack =
    value.track === "interview" || value.track === "ios" ? value.track : "all";
  const sessionLanguage: SessionLanguage =
    value.language === "python" || value.language === "swift"
      ? value.language
      : "all";
  const seen = new Set<string>();
  const indexedEntries = value.entries
    .flatMap(
      (
        raw,
        rawIndex,
      ): Array<SessionQueueEntry & { rawIndex: number }> => {
        if (!isRecord(raw)) return [];
        const itemId = itemIdFromRaw(raw.itemId);
        if (!itemId || !activeIds.has(itemId)) return [];
        if (sessionTrack !== "all" && tracks.get(itemId) !== sessionTrack)
          return [];
        if (
          sessionLanguage !== "all" &&
          languages.get(itemId) !== sessionLanguage
        )
          return [];
        const stage = Math.round(finiteNumber(raw.stage, 1, 1, 5));
        const practiceKind: PracticeKind =
          raw.practiceKind === "solving" && supportsSolving.get(itemId)
            ? "solving"
            : raw.practiceKind === "concept" && supportsConcept.get(itemId)
              ? "concept"
              : "typing";
        const key = `${itemId}:${stage}:${practiceKind}`;
        if (seen.has(key)) return [];
        seen.add(key);
        const status =
          raw.status === "completed" || raw.status === "skipped"
            ? raw.status
            : "pending";
        return [
          {
            itemId,
            itemRevision:
              status === "pending"
                ? (revisions.get(itemId) ?? 1)
                : Math.round(finiteNumber(raw.itemRevision, 1, 1, 1000000)),
            stage,
            status,
            attemptId:
              typeof raw.attemptId === "string" ? raw.attemptId : undefined,
            practiceKind,
            estimatedMinutes:
              Math.round(finiteNumber(raw.estimatedMinutes, 0, 0, 120)) ||
              undefined,
            rationale:
              typeof raw.rationale === "string" && raw.rationale.trim()
                ? raw.rationale.trim().slice(0, 240)
                : undefined,
            rawIndex,
          },
        ];
      },
    )
    .slice(0, 20);
  if (
    !indexedEntries.length ||
    indexedEntries.every((entry) => entry.status !== "pending")
  )
    return null;
  const requestedRawIndex = Math.round(
    finiteNumber(value.currentIndex, 0, 0, value.entries.length - 1),
  );
  const currentIndex = resolveSessionCurrentIndex(
    indexedEntries,
    requestedRawIndex,
  );
  const entries = indexedEntries.map((entry) => {
    const normalized = { ...entry };
    Reflect.deleteProperty(normalized, "rawIndex");
    return normalized;
  });
  const sources: SessionSource[] = [
    "mixed",
    "due",
    "new",
    "favorites",
    "custom",
  ];
  const createdAt =
    typeof value.createdAt === "string" &&
    !Number.isNaN(Date.parse(value.createdAt))
      ? value.createdAt
      : new Date(0).toISOString();
  const expiresAt =
    typeof value.expiresAt === "string" &&
    !Number.isNaN(Date.parse(value.expiresAt))
      ? value.expiresAt
      : undefined;
  const durationMinutes = Math.round(
    finiteNumber(value.durationMinutes, 0, 0, 180),
  );
  const kind =
    value.kind === "mock" &&
    entries.length === 1 &&
    entries[0].practiceKind === "solving" &&
    expiresAt &&
    durationMinutes >= 1
      ? "mock"
      : "practice";
  return {
    id: value.id,
    name:
      typeof value.name === "string" && value.name.trim()
        ? value.name.trim().slice(0, 80)
        : "Practice session",
    kind,
    source: sources.includes(value.source as SessionSource)
      ? (value.source as SessionSource)
      : "mixed",
    track: sessionTrack,
    language: sessionLanguage,
    stageMode: value.stageMode === "recall" ? "recall" : "recommended",
    createdAt,
    entries,
    currentIndex,
    ...(kind === "mock"
      ? {
          mockPreset: (["screen", "standard", "stretch"] as const).includes(
            value.mockPreset as "screen" | "standard" | "stretch",
          )
            ? (value.mockPreset as "screen" | "standard" | "stretch")
            : "standard",
          durationMinutes,
          expiresAt,
        }
      : {}),
  };
}

function normalizeSessionHistory(value: unknown): SessionHistoryRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((raw): SessionHistoryRecord[] => {
      if (!isRecord(raw) || typeof raw.id !== "string") return [];
      const total = Math.round(finiteNumber(raw.total, 1, 1, 20));
      const kind = raw.kind === "mock" ? "mock" : "practice";
      const completed = Math.round(finiteNumber(raw.completed, 0, 0, total));
      return [
        {
          id: raw.id,
          name:
            typeof raw.name === "string" && raw.name.trim()
              ? raw.name.trim().slice(0, 80)
              : "Practice session",
          kind,
          startedAt:
            typeof raw.startedAt === "string" &&
            !Number.isNaN(Date.parse(raw.startedAt))
              ? raw.startedAt
              : new Date(0).toISOString(),
          completedAt:
            typeof raw.completedAt === "string" &&
            !Number.isNaN(Date.parse(raw.completedAt))
              ? raw.completedAt
              : new Date(0).toISOString(),
          completed,
          total,
          ...(kind === "mock"
            ? {
                durationMinutes: Math.round(
                  finiteNumber(raw.durationMinutes, 45, 1, 180),
                ),
                outcome: (["completed", "ended", "expired"] as const).includes(
                  raw.outcome as "completed" | "ended" | "expired",
                )
                  ? (raw.outcome as "completed" | "ended" | "expired")
                  : completed === total
                    ? "completed"
                    : "ended",
              }
            : {}),
        },
      ];
    })
    .slice(-25);
}

function normalizeCloudPreferences(value: unknown): CloudPreferences {
  const raw = isRecord(value) ? value : {};
  const uploadedAttemptIds = Array.isArray(raw.uploadedAttemptIds)
    ? [
        ...new Set(
          raw.uploadedAttemptIds.filter(
            (id): id is string =>
              typeof id === "string" && id.length > 0 && id.length <= 120,
          ),
        ),
      ].slice(-1000)
    : [];
  return {
    communityEnabled: raw.communityEnabled === true,
    uploadedAttemptIds,
    lastSyncedAt:
      typeof raw.lastSyncedAt === "string" &&
      !Number.isNaN(Date.parse(raw.lastSyncedAt))
        ? raw.lastSyncedAt
        : undefined,
  };
}

export function qualificationFor(
  input: Pick<
    AttemptRecord,
    | "outcome"
    | "stage"
    | "peeks"
    | "accuracy"
    | "practiceKind"
    | "verification"
    | "conceptGrade"
  >,
): AttemptQualification {
  if (input.outcome !== "completed") return "incomplete";
  if (input.practiceKind === "concept") {
    return input.peeks === 0 &&
      (input.conceptGrade === "good" || input.conceptGrade === "easy")
      ? "independent"
      : "assisted";
  }
  if (input.practiceKind === "solving") {
    const verification = input.verification;
    if (
      !verification ||
      verification.total < 1 ||
      verification.passed !== verification.total
    )
      return "incomplete";
    return input.peeks > 0 ? "assisted" : "solved";
  }
  if (input.peeks > 0 || input.accuracy < 95) return "assisted";
  if (input.stage === 5) return "independent";
  if (input.stage === 4) return "guided";
  return "syntax";
}

export function normalizeState(value: unknown): AppState {
  if (!hasSupportedStateVersion(value)) return EMPTY_STATE;
  const customItems = normalizeCustomItems(value.customItems);
  const validIds = new Set<ItemId>([
    ...BUILTIN_ITEMS.map((item) => item.itemId),
    ...customItems.map((item) => item.itemId),
  ]);
  const activeIds = new Set<ItemId>([
    ...BUILTIN_ITEMS.map((item) => item.itemId),
    ...customItems
      .filter((item) => !item.archivedAt)
      .map((item) => item.itemId),
  ]);
  const revisions = new Map<ItemId, number>(
    [...BUILTIN_ITEMS, ...customItems].map((item) => [
      item.itemId,
      item.contentRevision,
    ]),
  );
  const tracks = new Map<ItemId, PracticeItem["track"]>(
    [...BUILTIN_ITEMS, ...customItems].map((item) => [item.itemId, item.track]),
  );
  const languages = new Map<ItemId, CodeLanguage>(
    [...BUILTIN_ITEMS, ...customItems].map((item) => [
      item.itemId,
      item.language,
    ]),
  );
  const supportsSolving = new Map<ItemId, boolean>(
    [...BUILTIN_ITEMS, ...customItems].map((item) => [
      item.itemId,
      Boolean(item.language === "python" && item.verification),
    ]),
  );
  const supportsConcept = new Map<ItemId, boolean>(
    [...BUILTIN_ITEMS, ...customItems].map((item) => [
      item.itemId,
      supportsConceptPractice(item),
    ]),
  );
  const attempts = (Array.isArray(value.attempts) ? value.attempts : [])
    .flatMap((raw): AttemptRecord[] => {
      if (
        !isRecord(raw) ||
        typeof raw.id !== "string" ||
        (raw.outcome !== "completed" && raw.outcome !== "abandoned")
      )
        return [];
      const itemId = itemIdFromRaw(raw.itemId ?? raw.problemId);
      if (!itemId || !validIds.has(itemId)) return [];
      const stage = Math.round(finiteNumber(raw.stage, 1, 1, 5));
      const outcome = raw.outcome as AttemptRecord["outcome"];
      const peeks = Math.round(finiteNumber(raw.peeks, 0, 0, 100000));
      const accuracy = Math.round(finiteNumber(raw.accuracy, 0, 0, 100));
      const item = [...BUILTIN_ITEMS, ...customItems].find(
        (candidate) => candidate.itemId === itemId,
      );
      if (
        raw.practiceKind === "solving" &&
        !(item?.language === "python" && item.verification)
      )
        return [];
      if (
        raw.practiceKind === "concept" &&
        !supportsConceptPractice(item)
      )
        return [];
      const keyErrors = normalizeKeyErrors(raw.keyErrors);
      const practiceKind: PracticeKind =
        raw.practiceKind === "solving"
          ? "solving"
          : raw.practiceKind === "concept"
            ? "concept"
            : "typing";
      const conceptGrade: RetrievalGrade | undefined = [
        "again",
        "hard",
        "good",
        "easy",
      ].includes(String(raw.conceptGrade))
        ? (raw.conceptGrade as RetrievalGrade)
        : undefined;
      const attempt: AttemptRecord = {
        id: raw.id,
        itemId,
        itemRevision: Math.round(finiteNumber(raw.itemRevision, 1, 1, 1000000)),
        titleSnapshot:
          typeof raw.titleSnapshot === "string"
            ? raw.titleSnapshot
            : (item?.title ?? itemId),
        language:
          raw.language === "python" || raw.language === "swift"
            ? raw.language
            : (item?.language ?? "swift"),
        stage,
        practiceKind,
        mode: raw.mode === "free" ? "free" : "strict",
        startedAt:
          typeof raw.startedAt === "string" &&
          !Number.isNaN(Date.parse(raw.startedAt))
            ? raw.startedAt
            : new Date(0).toISOString(),
        completedAt:
          typeof raw.completedAt === "string" &&
          !Number.isNaN(Date.parse(raw.completedAt))
            ? raw.completedAt
            : new Date(0).toISOString(),
        durationMs: finiteNumber(raw.durationMs, 0, 0, 86400000),
        totalKeystrokes: Math.round(
          finiteNumber(raw.totalKeystrokes, 0, 0, 1000000),
        ),
        correctKeystrokes: Math.round(
          finiteNumber(raw.correctKeystrokes, 0, 0, 1000000),
        ),
        rejectedKeystrokes: Math.round(
          finiteNumber(raw.rejectedKeystrokes, 0, 0, 1000000),
        ),
        corrections: Math.round(finiteNumber(raw.corrections, 0, 0, 1000000)),
        peeks,
        rawWpm: Math.round(finiteNumber(raw.rawWpm, 0, 0, 500)),
        wpm: Math.round(finiteNumber(raw.wpm, 0, 0, 500)),
        accuracy,
        consistency: Math.round(finiteNumber(raw.consistency, 0, 0, 100)),
        outcome,
        qualification: "assisted",
        conceptGrade:
          practiceKind === "concept" ? conceptGrade : undefined,
        conceptCheckIndex:
          practiceKind === "concept" &&
          Number.isInteger(Number(raw.conceptCheckIndex)) &&
          Number(raw.conceptCheckIndex) >= 0 &&
          Number(raw.conceptCheckIndex) <= 2
            ? (Math.round(
                finiteNumber(raw.conceptCheckIndex, 0, 0, 2),
              ) as 0 | 1 | 2)
            : undefined,
        verification: normalizeVerificationSummary(raw.verification),
        keyErrors,
        lineErrors: normalizeLineErrors(raw.lineErrors),
        timeline: normalizeTimelineSamples(raw.timeline),
        challengeDate:
          typeof raw.challengeDate === "string" ? raw.challengeDate : undefined,
        sessionId:
          typeof raw.sessionId === "string" ? raw.sessionId : undefined,
      };
      attempt.qualification = qualificationFor(attempt);
      return [attempt];
    })
    .slice(-1000);

  const rawDraft = isRecord(value.draft) ? value.draft : null;
  const draftItemId = rawDraft
    ? itemIdFromRaw(rawDraft.itemId ?? rawDraft.problemId)
    : null;
  const draftCurrentRevision = draftItemId
    ? ([...BUILTIN_ITEMS, ...customItems].find(
        (item) => item.itemId === draftItemId,
      )
        ?.contentRevision ?? 1)
    : 1;
  const draftItem = draftItemId
    ? [...BUILTIN_ITEMS, ...customItems].find(
        (candidate) => candidate.itemId === draftItemId,
      )
    : undefined;
  const draftSupportsSolve = Boolean(
    draftItem?.language === "python" && draftItem.verification,
  );
  const draftSupportsConcept = Boolean(
    supportsConceptPractice(draftItem),
  );
  const draft: Draft | null =
    rawDraft &&
    draftItemId &&
    activeIds.has(draftItemId) &&
    Math.round(finiteNumber(rawDraft.itemRevision, 1, 1, 1000000)) ===
      draftCurrentRevision &&
    !(rawDraft.practiceKind === "solving" && !draftSupportsSolve) &&
    !(rawDraft.practiceKind === "concept" && !draftSupportsConcept) &&
    typeof rawDraft.value === "string" &&
    rawDraft.value.length <= 50000
      ? {
          itemId: draftItemId,
          itemRevision: Math.round(
            finiteNumber(rawDraft.itemRevision, 1, 1, 1000000),
          ),
          stage: Math.round(finiteNumber(rawDraft.stage, 1, 1, 5)),
          practiceKind:
            rawDraft.practiceKind === "solving"
              ? "solving"
              : rawDraft.practiceKind === "concept"
                ? "concept"
                : "typing",
          value: rawDraft.value,
          startedAt:
            typeof rawDraft.startedAt === "number" &&
            Number.isFinite(rawDraft.startedAt)
              ? rawDraft.startedAt
              : null,
          totalKeystrokes: Math.round(
            finiteNumber(rawDraft.totalKeystrokes, 0, 0, 1000000),
          ),
          correctKeystrokes: Math.round(
            finiteNumber(rawDraft.correctKeystrokes, 0, 0, 1000000),
          ),
          rejectedKeystrokes: Math.round(
            finiteNumber(rawDraft.rejectedKeystrokes, 0, 0, 1000000),
          ),
          corrections: Math.round(
            finiteNumber(rawDraft.corrections, 0, 0, 1000000),
          ),
          peeks: Math.round(finiteNumber(rawDraft.peeks, 0, 0, 100000)),
          keyErrors: normalizeKeyErrors(rawDraft.keyErrors),
          lineErrors: normalizeLineErrors(rawDraft.lineErrors),
          timeline: normalizeTimelineSamples(rawDraft.timeline),
          testRuns: Math.round(finiteNumber(rawDraft.testRuns, 0, 0, 100000)),
          submissions: Math.round(
            finiteNumber(rawDraft.submissions, 0, 0, 100000),
          ),
          customCaseInput:
            typeof rawDraft.customCaseInput === "string"
              ? rawDraft.customCaseInput.slice(0, 12000)
              : "",
          conceptCommittedAt:
            typeof rawDraft.conceptCommittedAt === "number" &&
            Number.isFinite(rawDraft.conceptCommittedAt)
              ? rawDraft.conceptCommittedAt
              : undefined,
          conceptCommittedResponse:
            typeof rawDraft.conceptCommittedResponse === "string"
              ? rawDraft.conceptCommittedResponse.slice(0, 1000)
              : undefined,
          challengeDate:
            typeof rawDraft.challengeDate === "string"
              ? rawDraft.challengeDate
              : undefined,
          sessionId:
            typeof rawDraft.sessionId === "string"
              ? rawDraft.sessionId
              : undefined,
        }
      : null;

  const lastItemId = itemIdFromRaw(value.lastItemId ?? value.lastProblemId);
  const favorites = Array.isArray(value.favorites)
    ? [
        ...new Set(
          value.favorites
            .map(itemIdFromRaw)
            .filter((id): id is ItemId => Boolean(id && activeIds.has(id))),
        ),
      ]
    : [];
  const customCaseInputs = isRecord(value.customCaseInputs)
    ? Object.fromEntries(
        Object.entries(value.customCaseInputs)
          .flatMap(([rawItemId, rawInput]) => {
            const itemId = itemIdFromRaw(rawItemId);
            return itemId && activeIds.has(itemId) && typeof rawInput === "string"
              ? [[itemId, rawInput.slice(0, 12000)]]
              : [];
          })
          .slice(0, 200),
      )
    : {};
  if (
    draftItemId &&
    draft?.customCaseInput &&
    customCaseInputs[draftItemId] === undefined
  ) {
    customCaseInputs[draftItemId] = draft.customCaseInput;
  }
  const activeSession = normalizeActiveSession(
    value.activeSession,
    activeIds,
    revisions,
    tracks,
    languages,
    supportsSolving,
    supportsConcept,
  );
  const activeEntry = activeSession?.entries[activeSession.currentIndex];
  const draftMatchesSession = Boolean(
    draft?.sessionId &&
    activeSession &&
    activeEntry &&
    draft.sessionId === activeSession.id &&
    draft.itemId === activeEntry.itemId &&
    draft.stage === activeEntry.stage &&
    draft.itemRevision === activeEntry.itemRevision &&
    draft.practiceKind === (activeEntry.practiceKind ?? "typing"),
  );
  const normalizedDraft = draft
    ? { ...draft, sessionId: draftMatchesSession ? draft.sessionId : undefined }
    : null;
  return {
    version: 13,
    attempts,
    learningEvents: normalizeLearningEvents(value.learningEvents, {
      validItemIds: validIds,
      attemptsById: new Map(attempts.map((attempt) => [attempt.id, attempt])),
    }),
    favorites,
    customItems,
    customCaseInputs,
    settings: normalizeSettings(value.settings),
    draft: normalizedDraft,
    lastItemId:
      lastItemId && activeIds.has(lastItemId)
        ? lastItemId
        : EMPTY_STATE.lastItemId,
    lastStage: Math.round(
      finiteNumber(value.lastStage, draft?.stage ?? 1, 1, 5),
    ),
    activeSession,
    sessionHistory: normalizeSessionHistory(value.sessionHistory),
    cloud: normalizeCloudPreferences(value.cloud),
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    for (const key of [
      STORAGE_KEY,
      TWELFTH_STORAGE_KEY,
      PREVIOUS_STORAGE_KEY,
      LEGACY_STORAGE_KEY,
      OLDER_STORAGE_KEY,
      OLDEST_STORAGE_KEY,
      ORIGINAL_STORAGE_KEY,
      FIRST_STORAGE_KEY,
      EARLIEST_STORAGE_KEY,
      INITIAL_STORAGE_KEY,
      SECOND_VERSION_STORAGE_KEY,
      FIRST_VERSION_STORAGE_KEY,
    ]) {
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      try {
        const parsed = JSON.parse(stored);
        if (!hasSupportedStateVersion(parsed)) continue;
        return normalizeState(parsed);
      } catch {
        // Try the next older backup when a newer write was interrupted.
      }
    }
  } catch {
    // Storage may be unavailable in private or hardened browser contexts.
  }
  return EMPTY_STATE;
}

function hasSupportedStateVersion(
  value: unknown,
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].includes(Number(value.version))
  );
}

export function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* local-only mode still works */
  }
}

export function maskCode(
  code: string,
  stage: number,
  reveal = false,
  authored?: PracticeItem["masks"],
  language: CodeLanguage = "swift",
) {
  if (reveal || stage === 1) return code;
  if (stage >= 2 && stage <= 4 && authored?.[stage as 2 | 3 | 4])
    return authored[stage as 2 | 3 | 4] as string;
  if (stage === 5) return code.replace(/[^\n]/g, " ");
  return code
    .split("\n")
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      const structural =
        language === "python"
          ? /^(class |def |async def |if |elif |else:|for |while |try:|except |finally:)/.test(
              trimmed,
            )
          : /^(class |struct |func |}|\{)/.test(trimmed) ||
            trimmed.endsWith("{");
      if (stage === 4)
        return /^(class |def |async def |func |struct )/.test(trimmed)
          ? line
          : line.replace(/\S/g, " ");
      if (stage === 3)
        return index === 0 || index % 3 === 0 || structural
          ? line
          : line.replace(/\S/g, " ");
      const keywords =
        language === "python"
          ? /\b(?:def|class|if|elif|else|for|while|return|in|not|and|or|None|True|False)\b|(?<=[=\[(, ])\w+(?=[\], ):=+\-])/g
          : /\b(?:var|let|if|else|for|while|return|guard)\b|(?<=[=\[(, ])\w+(?=[\], ):=+\-])/g;
      return line.replace(keywords, (match) => "_".repeat(match.length));
    })
    .join("\n");
}

export function currentMetrics(draft: Draft, target: string, now = Date.now()) {
  const durationMs = draft.startedAt
    ? Math.max(1000, now - draft.startedAt)
    : 0;
  const minutes = durationMs / 60000;
  const rawWpm = minutes ? Math.round(draft.totalKeystrokes / 5 / minutes) : 0;
  if (draft.practiceKind === "solving") {
    return {
      durationMs,
      rawWpm,
      wpm: rawWpm,
      accuracy: 100,
      progress: target.length
        ? Math.min(99, Math.round((draft.value.length / target.length) * 100))
        : 0,
    };
  }
  const positionCorrect = correctPositionCount(draft.value, target);
  const wpm = minutes ? Math.round(positionCorrect / 5 / minutes) : 0;
  const accuracy = draft.totalKeystrokes
    ? Math.round((draft.correctKeystrokes / draft.totalKeystrokes) * 100)
    : 100;
  let correctPrefix = 0;
  while (
    correctPrefix < draft.value.length &&
    draft.value[correctPrefix] === target[correctPrefix]
  )
    correctPrefix += 1;
  return {
    durationMs,
    rawWpm,
    wpm,
    accuracy,
    progress: target.length
      ? Math.round((correctPrefix / target.length) * 100)
      : 0,
  };
}

export function consistencyFromSamples(samples: number[]) {
  if (samples.length < 2) return 100;
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  if (!mean) return 100;
  const variance =
    samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    samples.length;
  return Math.max(0, Math.round(100 - (Math.sqrt(variance) / mean) * 100));
}

export function completedAttempts(state: AppState) {
  return state.attempts.filter((attempt) => attempt.outcome === "completed");
}
export function eligibleAttempt(attempt: AttemptRecord) {
  return (
    attempt.practiceKind === "typing" &&
    attempt.outcome === "completed" &&
    attempt.peeks === 0 &&
    attempt.accuracy >= 95
  );
}

export function successfulLearningAttempt(attempt: AttemptRecord) {
  return (
    eligibleAttempt(attempt) ||
    (attempt.practiceKind === "concept" &&
      attempt.outcome === "completed" &&
      attempt.peeks === 0 &&
      (attempt.conceptGrade === "good" ||
        attempt.conceptGrade === "easy")) ||
    (attempt.practiceKind === "solving" &&
      attempt.outcome === "completed" &&
      attempt.peeks === 0 &&
      attempt.verification !== undefined &&
      attempt.verification.total > 0 &&
      attempt.verification.passed === attempt.verification.total)
  );
}

export function itemRevision(state: AppState, itemId: ItemId) {
  return (
    state.customItems.find((item) => item.itemId === itemId)?.contentRevision ??
    BUILTIN_ITEMS.find((item) => item.itemId === itemId)?.contentRevision ??
    1
  );
}

export function itemStats(state: AppState, itemId: ItemId) {
  const revision = itemRevision(state, itemId);
  const attempts = completedAttempts(state).filter(
    (attempt) => attempt.itemId === itemId && attempt.itemRevision === revision,
  );
  const typingAttempts = attempts.filter(
    (attempt) => attempt.practiceKind === "typing",
  );
  const qualified = typingAttempts.filter(eligibleAttempt);
  const independent = qualified.filter((attempt) => attempt.stage === 5);
  const verifiedSolves = attempts.filter(
    (attempt) =>
      attempt.practiceKind === "solving" && successfulLearningAttempt(attempt),
  );
  const conceptAttempts = attempts.filter(
    (attempt) => attempt.practiceKind === "concept",
  );
  const strongConceptAttempts = conceptAttempts.filter(successfulLearningAttempt);
  return {
    attempts,
    completions: attempts.length,
    solveCompletions: verifiedSolves.length,
    conceptCompletions: conceptAttempts.length,
    strongConceptCompletions: strongConceptAttempts.length,
    qualifiedCompletions: qualified.length,
    highestStage: qualified.reduce(
      (highest, attempt) => Math.max(highest, attempt.stage),
      0,
    ),
    highestPracticedStage: typingAttempts.reduce(
      (highest, attempt) => Math.max(highest, attempt.stage),
      0,
    ),
    owned:
      independent.length > 0 ||
      verifiedSolves.length > 0 ||
      strongConceptAttempts.length > 0,
    bestWpm: qualified.reduce(
      (best, attempt) => Math.max(best, attempt.wpm),
      0,
    ),
    bestAccuracy: qualified.reduce(
      (best, attempt) => Math.max(best, attempt.accuracy),
      0,
    ),
    lastCompletedAt: attempts.at(-1)?.completedAt ?? null,
  };
}

const REVIEW_DAYS = [1, 3, 7, 14, 30];
export function reviewStatus(state: AppState, itemId: ItemId) {
  const revision = itemRevision(state, itemId);
  const item =
    state.customItems.find((candidate) => candidate.itemId === itemId) ??
    BUILTIN_ITEMS.find((candidate) => candidate.itemId === itemId);
  const conceptItem = supportsConceptPractice(item);
  const attempts = state.attempts
    .filter(
      (attempt) =>
        attempt.itemId === itemId &&
        attempt.itemRevision === revision &&
        (!conceptItem || attempt.practiceKind === "concept"),
    )
    .slice()
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
  let level = 0;
  let dueAt: Date | null = null;
  for (const attempt of attempts) {
    if (successfulLearningAttempt(attempt)) {
      const days = REVIEW_DAYS[Math.min(level, REVIEW_DAYS.length - 1)];
      level = Math.min(REVIEW_DAYS.length, level + 1);
      dueAt = new Date(Date.parse(attempt.completedAt) + days * 86400000);
    } else if (
      attempt.outcome === "abandoned" ||
      attempt.qualification === "assisted"
    ) {
      level = Math.max(0, level - 1);
      dueAt = new Date(Date.parse(attempt.completedAt) + 86400000);
    }
  }
  const lastAttemptAt = attempts.length
    ? Date.parse(attempts.at(-1)?.completedAt ?? "")
    : 0;
  const lastDebrief = state.learningEvents
    .filter(
      (event) =>
        event.itemId === itemId &&
        event.itemRevision === revision &&
        (!conceptItem || event.activityKind === "concept") &&
        !Number.isNaN(Date.parse(event.createdAt)),
    )
    .slice()
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .at(-1);
  ({ level, dueAt } = applyDebriefToReviewState(
    { level, dueAt, lastAttemptAt },
    lastDebrief,
  ));
  return { level, dueAt };
}
export function reviewDueAt(state: AppState, itemId: ItemId) {
  return reviewStatus(state, itemId).dueAt;
}
export function isReviewDue(state: AppState, itemId: ItemId, now = Date.now()) {
  const due = reviewDueAt(state, itemId);
  return Boolean(due && due.getTime() <= now);
}

export function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const dayKey = localDayKey;
export function activeStreak(state: AppState) {
  const days = new Set(
    completedAttempts(state).map((attempt) =>
      localDayKey(new Date(attempt.completedAt)),
    ),
  );
  let cursor = new Date();
  if (!days.has(localDayKey(cursor)))
    cursor = new Date(cursor.getTime() - 86400000);
  let streak = 0;
  while (days.has(localDayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}
export function practicedMinutesToday(state: AppState) {
  const today = localDayKey(new Date());
  const ms = state.attempts
    .filter((attempt) => localDayKey(new Date(attempt.startedAt)) === today)
    .reduce((sum, attempt) => sum + attempt.durationMs, 0);
  return Math.round(ms / 60000);
}

export function recommendedStage(state: AppState, item: PracticeItem) {
  return Math.min(5, itemStats(state, item.itemId).highestStage + 1 || 1);
}

export function dailyItem(items: PracticeItem[], date = new Date()) {
  if (!items.length) return null;
  const key = `${localDayKey(date)}-catalog-v2`;
  let hash = 2166136261;
  for (const char of key) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return items[Math.abs(hash) % items.length];
}

export function personalBest(
  state: AppState,
  itemId: ItemId,
  stage: number,
  mode: AttemptRecord["mode"],
  excludeId?: string,
) {
  const revision = itemRevision(state, itemId);
  return state.attempts
    .filter(
      (attempt) =>
        attempt.id !== excludeId &&
        attempt.itemId === itemId &&
        attempt.itemRevision === revision &&
        attempt.stage === stage &&
        attempt.mode === mode &&
        eligibleAttempt(attempt),
    )
    .reduce<AttemptRecord | null>(
      (best, attempt) =>
        !best ||
        attempt.wpm > best.wpm ||
        (attempt.wpm === best.wpm && attempt.accuracy > best.accuracy)
          ? attempt
          : best,
      null,
    );
}

export type Milestone = {
  id: string;
  title: string;
  note: string;
  achieved: boolean;
};
export function milestones(state: AppState): Milestone[] {
  const completed = completedAttempts(state);
  const independent = completed.filter(
    (attempt) => attempt.qualification === "independent",
  );
  const qualifiedPatterns = new Set(
    BUILTIN_ITEMS.filter(
      (item) =>
        item.track === "interview" &&
        completed.some(
          (attempt) =>
            attempt.itemId === item.itemId && eligibleAttempt(attempt),
        ),
    ).map((item) => item.pattern),
  );
  const recovered = state.attempts.some(
    (attempt, index) =>
      attempt.outcome === "completed" &&
      eligibleAttempt(attempt) &&
      state.attempts
        .slice(0, index)
        .some(
          (earlier) =>
            earlier.itemId === attempt.itemId &&
            (earlier.outcome === "abandoned" ||
              earlier.qualification === "assisted"),
        ),
  );
  return [
    {
      id: "first-pass",
      title: "First clean pass",
      note: "Finish any pass at 95%+ without peeking.",
      achieved: completed.some(eligibleAttempt),
    },
    {
      id: "first-recall",
      title: "Independent recall",
      note: "Own one solution from a blank editor.",
      achieved: independent.length > 0,
    },
    {
      id: "pattern-transfer",
      title: "Pattern transfer",
      note: "Qualify across three interview patterns.",
      achieved: qualifiedPatterns.size >= 3,
    },
    {
      id: "recovery",
      title: "Recovery",
      note: "Return after a lapse and finish cleanly.",
      achieved: recovered,
    },
    {
      id: "custom-ownership",
      title: "Make it yours",
      note: "Independently recall a custom Python or Swift snippet.",
      achieved: independent.some((attempt) =>
        state.customItems.some(
          (item) =>
            item.itemId === attempt.itemId &&
            item.contentRevision === attempt.itemRevision,
        ),
      ),
    },
  ];
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
export function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
