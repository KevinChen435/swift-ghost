import { PROBLEMS, type Problem } from "../data/problems";

export const STAGES = [
  { id: 1, name: "Full ghost", short: "Full", note: "Copy once while noticing the Swift shape." },
  { id: 2, name: "Missing expressions", short: "Gaps", note: "Recover names, conditions, and updates." },
  { id: 3, name: "Missing lines", short: "Lines", note: "Recall complete implementation steps." },
  { id: 4, name: "Skeleton only", short: "Skeleton", note: "Rebuild from signatures and braces." },
  { id: 5, name: "Blank editor", short: "Recall", note: "Produce the solution without ghost text." },
] as const;

export type View = "practice" | "library" | "progress" | "settings";
export type Theme = "midnight" | "paper" | "forest" | "synthwave" | "ember" | "ocean";

export type Settings = {
  theme: Theme;
  font: "mono" | "rounded" | "classic";
  fontSize: number;
  tabSize: 2 | 4;
  editorLines: 12 | 16 | 20;
  strictMode: boolean;
  showLiveWpm: boolean;
  showKeyboard: boolean;
  autoIndent: boolean;
  dailyGoalMinutes: number;
};

export type AttemptRecord = {
  id: string;
  problemId: number;
  stage: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
  rejectedKeystrokes: number;
  corrections: number;
  peeks: number;
  rawWpm: number;
  wpm: number;
  accuracy: number;
  consistency: number;
  outcome: "completed" | "abandoned";
};

export type Draft = {
  problemId: number;
  stage: number;
  value: string;
  startedAt: number | null;
  totalKeystrokes: number;
  correctKeystrokes: number;
  rejectedKeystrokes: number;
  corrections: number;
  peeks: number;
};

export type AppState = {
  version: 2;
  attempts: AttemptRecord[];
  favorites: number[];
  settings: Settings;
  draft: Draft | null;
  lastProblemId: number;
  lastStage: number;
};

export const STORAGE_KEY = "swift-ghost-state-v2";

export const DEFAULT_SETTINGS: Settings = {
  theme: "midnight",
  font: "mono",
  fontSize: 16,
  tabSize: 4,
  editorLines: 16,
  strictMode: true,
  showLiveWpm: true,
  showKeyboard: false,
  autoIndent: true,
  dailyGoalMinutes: 20,
};

export const EMPTY_STATE: AppState = {
  version: 2,
  attempts: [],
  favorites: [],
  settings: DEFAULT_SETTINGS,
  draft: null,
  lastProblemId: 1,
  lastStage: 1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function normalizeState(value: unknown): AppState {
  if (!isRecord(value) || value.version !== 2) return EMPTY_STATE;
  const validIds = new Set(PROBLEMS.map((problem) => problem.id));
  const rawSettings = isRecord(value.settings) ? value.settings : {};
  const themes: Theme[] = ["midnight", "paper", "forest", "synthwave", "ember", "ocean"];
  const fonts: Settings["font"][] = ["mono", "rounded", "classic"];
  const tabSize = finiteNumber(rawSettings.tabSize, DEFAULT_SETTINGS.tabSize, 2, 4);
  const editorLines = finiteNumber(rawSettings.editorLines, DEFAULT_SETTINGS.editorLines, 12, 20);
  const settings: Settings = {
    theme: themes.includes(rawSettings.theme as Theme) ? rawSettings.theme as Theme : DEFAULT_SETTINGS.theme,
    font: fonts.includes(rawSettings.font as Settings["font"]) ? rawSettings.font as Settings["font"] : DEFAULT_SETTINGS.font,
    fontSize: Math.round(finiteNumber(rawSettings.fontSize, DEFAULT_SETTINGS.fontSize, 12, 24)),
    tabSize: tabSize <= 2 ? 2 : 4,
    editorLines: editorLines <= 12 ? 12 : editorLines <= 16 ? 16 : 20,
    strictMode: typeof rawSettings.strictMode === "boolean" ? rawSettings.strictMode : DEFAULT_SETTINGS.strictMode,
    showLiveWpm: typeof rawSettings.showLiveWpm === "boolean" ? rawSettings.showLiveWpm : DEFAULT_SETTINGS.showLiveWpm,
    showKeyboard: typeof rawSettings.showKeyboard === "boolean" ? rawSettings.showKeyboard : DEFAULT_SETTINGS.showKeyboard,
    autoIndent: typeof rawSettings.autoIndent === "boolean" ? rawSettings.autoIndent : DEFAULT_SETTINGS.autoIndent,
    dailyGoalMinutes: Math.round(finiteNumber(rawSettings.dailyGoalMinutes, DEFAULT_SETTINGS.dailyGoalMinutes, 5, 120)),
  };

  const attempts = (Array.isArray(value.attempts) ? value.attempts : [])
    .filter((attempt): attempt is Record<string, unknown> => isRecord(attempt) && typeof attempt.id === "string" && validIds.has(Number(attempt.problemId)) && (attempt.outcome === "completed" || attempt.outcome === "abandoned"))
    .map((attempt): AttemptRecord => ({
      id: attempt.id as string,
      problemId: Number(attempt.problemId),
      stage: Math.round(finiteNumber(attempt.stage, 1, 1, 5)),
      startedAt: typeof attempt.startedAt === "string" && !Number.isNaN(Date.parse(attempt.startedAt)) ? attempt.startedAt : new Date(0).toISOString(),
      completedAt: typeof attempt.completedAt === "string" && !Number.isNaN(Date.parse(attempt.completedAt)) ? attempt.completedAt : new Date(0).toISOString(),
      durationMs: finiteNumber(attempt.durationMs, 0, 0, 86400000),
      totalKeystrokes: Math.round(finiteNumber(attempt.totalKeystrokes, 0, 0, 1000000)),
      correctKeystrokes: Math.round(finiteNumber(attempt.correctKeystrokes, 0, 0, 1000000)),
      rejectedKeystrokes: Math.round(finiteNumber(attempt.rejectedKeystrokes, 0, 0, 1000000)),
      corrections: Math.round(finiteNumber(attempt.corrections, 0, 0, 1000000)),
      peeks: Math.round(finiteNumber(attempt.peeks, 0, 0, 100000)),
      rawWpm: Math.round(finiteNumber(attempt.rawWpm, 0, 0, 500)),
      wpm: Math.round(finiteNumber(attempt.wpm, 0, 0, 500)),
      accuracy: Math.round(finiteNumber(attempt.accuracy, 0, 0, 100)),
      consistency: Math.round(finiteNumber(attempt.consistency, 0, 0, 100)),
      outcome: attempt.outcome as AttemptRecord["outcome"],
    }))
    .slice(-500);

  const rawDraft = isRecord(value.draft) ? value.draft : null;
  const draft = rawDraft && validIds.has(Number(rawDraft.problemId)) && typeof rawDraft.value === "string" && rawDraft.value.length <= 50000
    ? {
        problemId: Number(rawDraft.problemId),
        stage: Math.round(finiteNumber(rawDraft.stage, 1, 1, 5)),
        value: rawDraft.value,
        startedAt: typeof rawDraft.startedAt === "number" && Number.isFinite(rawDraft.startedAt) ? rawDraft.startedAt : null,
        totalKeystrokes: Math.round(finiteNumber(rawDraft.totalKeystrokes, 0, 0, 1000000)),
        correctKeystrokes: Math.round(finiteNumber(rawDraft.correctKeystrokes, 0, 0, 1000000)),
        rejectedKeystrokes: Math.round(finiteNumber(rawDraft.rejectedKeystrokes, 0, 0, 1000000)),
        corrections: Math.round(finiteNumber(rawDraft.corrections, 0, 0, 1000000)),
        peeks: Math.round(finiteNumber(rawDraft.peeks, 0, 0, 100000)),
      } satisfies Draft
    : null;

  const lastProblemId = validIds.has(Number(value.lastProblemId)) ? Number(value.lastProblemId) : EMPTY_STATE.lastProblemId;
  return {
    version: 2,
    attempts,
    favorites: Array.isArray(value.favorites) ? [...new Set(value.favorites.map(Number).filter((id) => validIds.has(id)))] : [],
    settings,
    draft,
    lastProblemId,
    lastStage: Math.round(finiteNumber(value.lastStage, draft?.stage ?? 1, 1, 5)),
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return EMPTY_STATE;
  }
}

export function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Practice remains usable if storage is unavailable.
  }
}

export function maskCode(code: string, stage: number, reveal = false) {
  if (reveal || stage === 1) return code;
  if (stage === 5) return code.replace(/[^\n]/g, " ");

  return code
    .split("\n")
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (stage === 4) {
        const keep = /^(class |struct |func |}|\{)/.test(trimmed) || trimmed.endsWith("{");
        return keep ? line : line.replace(/\S/g, " ");
      }
      if (stage === 3) {
        const keep = index === 0 || index % 3 === 0 || /^(class |func |}|\{)/.test(trimmed);
        return keep ? line : line.replace(/\S/g, " ");
      }
      return line.replace(/\b(?:var|let|if|else|for|while|return|guard)\b|(?<=[=\[(, ])\w+(?=[\], ):=+\-])/g, (match) => "_".repeat(match.length));
    })
    .join("\n");
}

export function currentMetrics(draft: Draft, target: string, now = Date.now()) {
  const durationMs = draft.startedAt ? Math.max(1000, now - draft.startedAt) : 0;
  const minutes = durationMs / 60000;
  const rawWpm = minutes ? Math.round((draft.totalKeystrokes / 5) / minutes) : 0;
  const wpm = minutes ? Math.round((draft.value.length / 5) / minutes) : 0;
  const accuracy = draft.totalKeystrokes
    ? Math.round((draft.correctKeystrokes / draft.totalKeystrokes) * 100)
    : 100;
  const progress = target.length ? Math.min(100, Math.round((draft.value.length / target.length) * 100)) : 0;
  return { durationMs, rawWpm, wpm, accuracy, progress };
}

export function consistencyFromSamples(samples: number[]) {
  if (samples.length < 2) return 100;
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  if (!mean) return 100;
  const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
  return Math.max(0, Math.round(100 - (Math.sqrt(variance) / mean) * 100));
}

export function completedAttempts(state: AppState) {
  return state.attempts.filter((attempt) => attempt.outcome === "completed");
}

export function problemStats(state: AppState, problemId: number) {
  const attempts = completedAttempts(state).filter((attempt) => attempt.problemId === problemId);
  return {
    attempts,
    completions: attempts.length,
    highestStage: attempts.reduce((highest, attempt) => Math.max(highest, attempt.stage), 0),
    bestWpm: attempts.reduce((best, attempt) => Math.max(best, attempt.wpm), 0),
    bestAccuracy: attempts.reduce((best, attempt) => Math.max(best, attempt.accuracy), 0),
    lastCompletedAt: attempts.at(-1)?.completedAt ?? null,
  };
}

const REVIEW_DAYS = [1, 3, 7, 14, 30];

export function reviewDueAt(state: AppState, problemId: number) {
  const stats = problemStats(state, problemId);
  if (!stats.lastCompletedAt) return null;
  const days = REVIEW_DAYS[Math.max(0, Math.min(4, stats.highestStage - 1))];
  return new Date(new Date(stats.lastCompletedAt).getTime() + days * 86400000);
}

export function isReviewDue(state: AppState, problemId: number, now = Date.now()) {
  const due = reviewDueAt(state, problemId);
  return Boolean(due && due.getTime() <= now);
}

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function activeStreak(state: AppState) {
  const days = new Set(completedAttempts(state).map((attempt) => dayKey(new Date(attempt.completedAt))));
  let cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - 86400000);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}

export function practicedMinutesToday(state: AppState) {
  const today = dayKey(new Date());
  const ms = state.attempts
    .filter((attempt) => dayKey(new Date(attempt.startedAt)) === today)
    .reduce((sum, attempt) => sum + attempt.durationMs, 0);
  return Math.round(ms / 60000);
}

export function recommendedStage(state: AppState, problem: Problem) {
  return Math.min(5, problemStats(state, problem.id).highestStage + 1 || 1);
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

export function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
