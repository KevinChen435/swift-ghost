"use client";

import { ChangeEvent, ClipboardEvent as ReactClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { PATTERN_ORDER, PROBLEMS, problemLineCount, problemUrl, type Difficulty, type Pattern, type Problem } from "../data/problems";
import {
  EMPTY_STATE,
  STAGES,
  STORAGE_KEY,
  activeStreak,
  completedAttempts,
  consistencyFromSamples,
  currentMetrics,
  dayKey,
  formatDuration,
  isReviewDue,
  loadState,
  makeId,
  maskCode,
  normalizeState,
  practicedMinutesToday,
  problemStats,
  recommendedStage,
  reviewDueAt,
  saveState,
  type AppState,
  type AttemptRecord,
  type Draft,
  type Settings,
  type Theme,
  type View,
} from "../lib/product";

type Result = AttemptRecord & { problem: Problem };
type Sort = "recommended" | "number" | "title" | "difficulty";

const THEMES: { id: Theme; label: string; colors: string[] }[] = [
  { id: "midnight", label: "Midnight", colors: ["#09111f", "#5eead4", "#a78bfa"] },
  { id: "paper", label: "Paper", colors: ["#f6f2e8", "#166534", "#b45309"] },
  { id: "forest", label: "Forest", colors: ["#0c1914", "#86efac", "#fcd34d"] },
  { id: "synthwave", label: "Synthwave", colors: ["#1d102b", "#f472b6", "#22d3ee"] },
  { id: "ember", label: "Ember", colors: ["#1a100d", "#fb923c", "#facc15"] },
  { id: "ocean", label: "Ocean", colors: ["#071924", "#38bdf8", "#67e8f9"] },
];

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "practice", label: "Practice", icon: "⌨" },
  { id: "library", label: "Library", icon: "▦" },
  { id: "progress", label: "Progress", icon: "↗" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function freshDraft(problemId: number, stage: number): Draft {
  return {
    problemId,
    stage,
    value: "",
    startedAt: null,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    rejectedKeystrokes: 0,
    corrections: 0,
    peeks: 0,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function SwiftGhostApp() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("practice");
  const [selectedId, setSelectedId] = useState(PROBLEMS[0].id);
  const [stage, setStage] = useState(1);
  const [reveal, setReveal] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [now, setNow] = useState(0);
  const [toast, setToast] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [errorKeys, setErrorKeys] = useState<Record<string, number>>({});
  const wpmSamples = useRef<number[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadState();
      setState(restored);
      setSelectedId(PROBLEMS.some((problem) => problem.id === restored.lastProblemId) ? restored.lastProblemId : PROBLEMS[0].id);
      setStage(restored.lastStage || 1);
      setNow(Date.now());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const problem = PROBLEMS.find((item) => item.id === selectedId) ?? PROBLEMS[0];
  const draft = state.draft?.problemId === selectedId && state.draft.stage === stage
    ? state.draft
    : freshDraft(selectedId, stage);
  const metrics = currentMetrics(draft, problem.code, now);
  const ghostCode = maskCode(problem.code, stage, reveal);
  const stats = problemStats(state, selectedId);
  const dueCount = PROBLEMS.filter((item) => isReviewDue(state, item.id)).length;
  const todayMinutes = practicedMinutesToday(state);
  const dailyPercent = Math.min(100, Math.round((todayMinutes / state.settings.dailyGoalMinutes) * 100));

  function mutateState(updater: (current: AppState) => AppState) {
    setState((current) => updater(current));
  }

  function recordAbandon(current: AppState) {
    const active = current.draft;
    if (!active?.startedAt || active.value.length < 5) return current;
    const activeProblem = PROBLEMS.find((item) => item.id === active.problemId);
    if (!activeProblem) return current;
    const live = currentMetrics(active, activeProblem.code);
    const attempt: AttemptRecord = {
      id: makeId(),
      problemId: active.problemId,
      stage: active.stage,
      startedAt: new Date(active.startedAt).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: live.durationMs,
      totalKeystrokes: active.totalKeystrokes,
      correctKeystrokes: active.correctKeystrokes,
      rejectedKeystrokes: active.rejectedKeystrokes,
      corrections: active.corrections,
      peeks: active.peeks,
      rawWpm: live.rawWpm,
      wpm: live.wpm,
      accuracy: live.accuracy,
      consistency: consistencyFromSamples(wpmSamples.current),
      outcome: "abandoned",
    };
    return { ...current, attempts: [...current.attempts, attempt].slice(-500), draft: null };
  }

  function openProblem(next: Problem, nextStage?: number) {
    const chosenStage = nextStage ?? recommendedStage(state, next);
    mutateState((current) => ({ ...recordAbandon(current), draft: null, lastProblemId: next.id, lastStage: chosenStage }));
    setSelectedId(next.id);
    setStage(chosenStage);
    setReveal(false);
    setResult(null);
    setView("practice");
    wpmSamples.current = [];
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".editor-wrap textarea")?.focus(), 50);
  }

  function chooseStage(nextStage: number) {
    mutateState((current) => ({ ...recordAbandon(current), draft: null, lastStage: nextStage }));
    setStage(nextStage);
    setReveal(false);
    setResult(null);
    wpmSamples.current = [];
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".editor-wrap textarea")?.focus(), 0);
  }

  function updateDraft(next: Draft) {
    const live = currentMetrics(next, problem.code);
    if (next.startedAt && live.wpm > 0) wpmSamples.current.push(live.wpm);
    mutateState((current) => ({ ...current, draft: next, lastProblemId: selectedId, lastStage: stage }));
  }

  function finish(next: Draft) {
    const live = currentMetrics(next, problem.code);
    const attempt: AttemptRecord = {
      id: makeId(),
      problemId: selectedId,
      stage,
      startedAt: new Date(next.startedAt ?? Date.now()).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: live.durationMs,
      totalKeystrokes: next.totalKeystrokes,
      correctKeystrokes: next.correctKeystrokes,
      rejectedKeystrokes: next.rejectedKeystrokes,
      corrections: next.corrections,
      peeks: next.peeks,
      rawWpm: live.rawWpm,
      wpm: live.wpm,
      accuracy: live.accuracy,
      consistency: consistencyFromSamples(wpmSamples.current),
      outcome: "completed",
    };
    mutateState((current) => ({ ...current, attempts: [...current.attempts, attempt].slice(-500), draft: null }));
    setResult({ ...attempt, problem });
    wpmSamples.current = [];
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const proposed = event.target.value;
    const oldValue = draft.value;
    const startedAt = draft.startedAt ?? Date.now();
    const inserted = Math.max(0, proposed.length - oldValue.length);
    const deleted = Math.max(0, oldValue.length - proposed.length);
    const isCorrectPrefix = problem.code.startsWith(proposed);
    const addedText = inserted ? proposed.slice(Math.min(oldValue.length, proposed.length - inserted)) : "";
    const correctAdded = addedText.split("").filter((char, index) => char === problem.code[oldValue.length + index]).length;

    if (state.settings.strictMode && !isCorrectPrefix && inserted > 0) {
      const attempted = proposed.slice(oldValue.length);
      setErrorKeys((keys) => attempted.split("").reduce((next, character, index) => {
        if (character === problem.code[oldValue.length + index]) return next;
        const keyName = character === "\n" ? "↵" : character === " " ? "space" : character;
        return { ...next, [keyName]: (next[keyName] ?? 0) + 1 };
      }, keys));
      updateDraft({
        ...draft,
        startedAt,
        totalKeystrokes: draft.totalKeystrokes + inserted,
        rejectedKeystrokes: draft.rejectedKeystrokes + inserted,
      });
      setToast(`Expected ${JSON.stringify(problem.code[oldValue.length] ?? "end of solution")}`);
      return;
    }

    const next: Draft = {
      ...draft,
      value: proposed,
      startedAt,
      totalKeystrokes: draft.totalKeystrokes + inserted,
      correctKeystrokes: draft.correctKeystrokes + correctAdded,
      corrections: draft.corrections + deleted,
    };
    updateDraft(next);
    if (proposed === problem.code) finish(next);
  }

  function insertAtCursor(input: HTMLTextAreaElement, text: string) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const value = `${draft.value.slice(0, start)}${text}${draft.value.slice(end)}`;
    handleChange({ target: { value } } as ChangeEvent<HTMLTextAreaElement>);
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
      return;
    }
    if (event.key === "Enter" && state.settings.autoIndent) {
      event.preventDefault();
      const before = draft.value.slice(0, event.currentTarget.selectionStart);
      const indent = before.split("\n").at(-1)?.match(/^\s*/)?.[0] ?? "";
      const extra = before.trimEnd().endsWith("{") ? " ".repeat(state.settings.tabSize) : "";
      insertAtCursor(event.currentTarget, `\n${indent}${extra}`);
    }
  }

  function resetAttempt() {
    mutateState((current) => ({ ...recordAbandon(current), draft: null }));
    setReveal(false);
    setResult(null);
    wpmSamples.current = [];
    setToast("Attempt reset");
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".editor-wrap textarea")?.focus(), 0);
  }

  function toggleReveal() {
    setReveal((current) => !current);
    if (!reveal) updateDraft({ ...draft, peeks: draft.peeks + 1 });
  }

  function toggleFavorite(problemId: number) {
    mutateState((current) => ({
      ...current,
      favorites: current.favorites.includes(problemId)
        ? current.favorites.filter((id) => id !== problemId)
        : [...current.favorites, problemId],
    }));
  }

  function updateSettings(patch: Partial<Settings>) {
    mutateState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }

  function randomProblem(mode: "all" | "due" = "all") {
    const candidates = mode === "due" ? PROBLEMS.filter((item) => isReviewDue(state, item.id)) : PROBLEMS;
    const pool = candidates.length ? candidates : PROBLEMS;
    openProblem(pool[Math.floor(Math.random() * pool.length)]);
  }

  function exportProgress() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
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
      if (!parsed || typeof parsed !== "object" || (parsed as { version?: unknown }).version !== 2) throw new Error("invalid");
      setState(normalizeState(parsed));
      setToast("Progress restored");
    } catch {
      setToast("That backup could not be read");
    }
    event.target.value = "";
  }

  function resetAllData() {
    if (!window.confirm("Delete all Swift Ghost progress and settings from this device?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setState(EMPTY_STATE);
    setSelectedId(PROBLEMS[0].id);
    setStage(1);
    setToast("Local data cleared");
  }

  return (
    <div className={`app-shell ${focusMode ? "is-focus" : ""}`}>
      <header className="topbar">
        <button className="brand" onClick={() => setView("practice")} aria-label="Swift Ghost home">
          <span className="brand-mark" aria-hidden="true">S<span>G</span></span>
          <span><strong>Swift Ghost</strong><small>type it · fade it · own it</small></span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {NAV.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button className="goal-pill" onClick={() => setView("progress")} title="Today's practice goal">
            <span className="goal-ring" style={{ "--goal": `${dailyPercent * 3.6}deg` } as React.CSSProperties}>{dailyPercent}%</span>
            <span><strong>{todayMinutes}/{state.settings.dailyGoalMinutes} min</strong><small>{activeStreak(state)} day streak</small></span>
          </button>
          <button className="icon-button" onClick={() => randomProblem("all")} title="Random problem" aria-label="Open a random problem">↝</button>
        </div>
      </header>

      {view === "practice" && (
        <PracticeView
          state={state}
          problem={problem}
          draft={draft}
          stage={stage}
          metrics={metrics}
          ghostCode={ghostCode}
          stats={stats}
          dueCount={dueCount}
          reveal={reveal}
          focusMode={focusMode}
          errorKeys={errorKeys}
          onOpenProblem={openProblem}
          onChooseStage={chooseStage}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={(event) => {
            event.preventDefault();
            const count = Math.max(1, event.clipboardData.getData("text").length);
            updateDraft({ ...draft, startedAt: draft.startedAt ?? Date.now(), totalKeystrokes: draft.totalKeystrokes + count, rejectedKeystrokes: draft.rejectedKeystrokes + count });
            setToast("Pasting is disabled during a practice pass");
          }}
          onReset={resetAttempt}
          onReveal={toggleReveal}
          onFavorite={() => toggleFavorite(selectedId)}
          onFocusMode={() => setFocusMode((value) => !value)}
          onReview={() => randomProblem("due")}
          onBrowse={() => setView("library")}
        />
      )}
      {view === "library" && <LibraryView state={state} onOpen={openProblem} onFavorite={toggleFavorite} />}
      {view === "progress" && <ProgressView state={state} onOpen={openProblem} onReview={() => randomProblem("due")} />}
      {view === "settings" && (
        <SettingsView
          state={state}
          onUpdate={updateSettings}
          onExport={exportProgress}
          onImport={() => importRef.current?.click()}
          onReset={resetAllData}
        />
      )}

      <input ref={importRef} className="visually-hidden" type="file" accept="application/json" onChange={importProgress} />
      {result && <ResultDialog result={result} onClose={() => setResult(null)} onNext={() => chooseStage(Math.min(5, stage + 1))} onRandom={() => randomProblem("all")} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

type PracticeProps = {
  state: AppState;
  problem: Problem;
  draft: Draft;
  stage: number;
  metrics: ReturnType<typeof currentMetrics>;
  ghostCode: string;
  stats: ReturnType<typeof problemStats>;
  dueCount: number;
  reveal: boolean;
  focusMode: boolean;
  errorKeys: Record<string, number>;
  onOpenProblem: (problem: Problem, stage?: number) => void;
  onChooseStage: (stage: number) => void;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void;
  onReset: () => void;
  onReveal: () => void;
  onFavorite: () => void;
  onFocusMode: () => void;
  onReview: () => void;
  onBrowse: () => void;
};

function PracticeView(props: PracticeProps) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => PROBLEMS.filter((item) => `${item.id} ${item.title} ${item.pattern}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12), [query]);
  const favorite = props.state.favorites.includes(props.problem.id);

  return (
    <main className="practice-layout">
      <aside className="problem-rail">
        <div className="rail-head">
          <span className="eyebrow">Problem queue</span>
          <span className="count-badge">{PROBLEMS.length}</span>
        </div>
        <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or pattern" /></label>
        {props.dueCount > 0 && <button className="review-callout" onClick={props.onReview}><span>Review due</span><strong>{props.dueCount} problems →</strong></button>}
        <div className="problem-list">
          {visible.map((item) => {
            const progress = problemStats(props.state, item.id);
            return (
              <button key={item.id} className={`problem-row ${props.problem.id === item.id ? "selected" : ""}`} onClick={() => props.onOpenProblem(item)}>
                <span className={`status-dot stage-${progress.highestStage}`}>{progress.highestStage ? progress.highestStage : ""}</span>
                <span className="problem-row-copy"><strong>{item.id}. {item.title}</strong><small>{item.pattern} · {item.difficulty}</small></span>
                {props.state.favorites.includes(item.id) && <span className="favorite-star">★</span>}
              </button>
            );
          })}
        </div>
        <button className="rail-link" onClick={props.onBrowse}>Browse all {PROBLEMS.length} problems <span>→</span></button>
        <div className="legend"><span><i className="dot-new" />New</span><span><i className="dot-learning" />Learning</span><span><i className="dot-owned" />Owned</span></div>
      </aside>

      <section className="practice-main">
        <div className="problem-header">
          <div>
            <div className="problem-kicker"><span>#{props.problem.id}</span><span className={`difficulty ${props.problem.difficulty.toLowerCase()}`}>{props.problem.difficulty}</span><span>{props.problem.pattern}</span></div>
            <h1>{props.problem.title}</h1>
            <p>{props.problem.summary}</p>
          </div>
          <div className="problem-actions">
            <button className={favorite ? "favorite active" : "favorite"} onClick={props.onFavorite} aria-label={favorite ? "Remove favorite" : "Add favorite"}>{favorite ? "★" : "☆"}</button>
            <a className="outline-button" href={problemUrl(props.problem)} target="_blank" rel="noreferrer">Open prompt ↗</a>
          </div>
        </div>

        <div className="insight-grid">
          <article><span className="card-icon">⌁</span><div><small>Pattern cue</small><p>{props.problem.cue}</p></div></article>
          <article><span className="card-icon">∞</span><div><small>Invariant</small><p>{props.problem.invariant}</p></div></article>
          <article><span className="card-icon">S</span><div><small>Swift note</small><p>{props.problem.swiftNote}</p></div></article>
        </div>

        <div className="stage-panel">
          <div className="stage-title"><span className="eyebrow">Recall ladder</span><span>{STAGES[props.stage - 1].note}</span></div>
          <div className="stage-track">
            {STAGES.map((item) => {
              const unlocked = item.id <= Math.max(1, props.stats.highestStage + 1);
              return (
                <button key={item.id} className={`${props.stage === item.id ? "active" : ""} ${item.id <= props.stats.highestStage ? "complete" : ""}`} onClick={() => props.onChooseStage(item.id)} title={unlocked ? item.note : "You can preview any stage; complete earlier stages for the recommended path."}>
                  <span>{item.id <= props.stats.highestStage ? "✓" : item.id}</span><small>{item.short}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="editor-card">
          <div className="editor-toolbar">
            <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
            <div className="file-tab"><span className="swift-badge">S</span>Solution.swift <small>{problemLineCount(props.problem)} lines</small></div>
            <div className="editor-actions">
              <button onClick={props.onReveal}>{props.reveal ? "Hide answer" : "Peek"}</button>
              <button onClick={props.onReset}>Restart</button>
              <button onClick={props.onFocusMode}>{props.focusMode ? "Exit focus" : "Focus"}</button>
            </div>
          </div>
          <div className="metric-strip" aria-live="polite">
            <span><small>Progress</small><strong>{props.metrics.progress}%</strong></span>
            {props.state.settings.showLiveWpm && <span><small>WPM</small><strong>{props.metrics.wpm}</strong></span>}
            <span><small>Accuracy</small><strong>{props.metrics.accuracy}%</strong></span>
            <span><small>Errors</small><strong>{props.draft.rejectedKeystrokes}</strong></span>
            <span><small>Time</small><strong>{formatDuration(props.metrics.durationMs)}</strong></span>
            <span className="strict-indicator"><i />{props.state.settings.strictMode ? "Strict correction" : "Free correction"}</span>
          </div>
          <div className="editor-wrap" style={{ "--font-size": `${props.state.settings.fontSize}px`, "--editor-lines": props.state.settings.editorLines, "--code-height": `${problemLineCount(props.problem) * props.state.settings.fontSize * 1.65 + 56}px` } as React.CSSProperties}>
            <pre className="line-numbers" aria-hidden="true">{Array.from({ length: problemLineCount(props.problem) }, (_, index) => index + 1).join("\n")}</pre>
            <pre className="ghost-layer" aria-hidden="true">{props.ghostCode}</pre>
            <pre className="typed-layer" aria-hidden="true">{props.draft.value.split("").map((char, index) => <span className={char === props.problem.code[index] ? "right" : "wrong"} key={`${index}-${char}`}>{char}</span>)}</pre>
            <textarea
              value={props.draft.value}
              onChange={props.onChange}
              onKeyDown={props.onKeyDown}
              onPaste={props.onPaste}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label={`Type the Swift solution for ${props.problem.title}. Press Escape to leave the editor.`}
            />
          </div>
          <div className="editor-footer">
            <span><i className="key-swatch typed" />typed</span><span><i className="key-swatch ghost" />ghost</span><span><i className="key-swatch hidden" />hidden</span>
            <span className="spacer" />
            <span>Tab inserts {props.state.settings.tabSize} spaces · Esc leaves editor</span>
          </div>
          <div className="progress-line"><i style={{ width: `${props.metrics.progress}%` }} /></div>
        </div>

        <div className="practice-notes">
          <article><small>Complexity check</small><strong>{props.problem.complexity}</strong></article>
          <article><small>Before you type</small><strong>Say the invariant out loud. Transcription builds syntax; blank recall proves ownership.</strong></article>
          {Object.keys(props.errorKeys).length > 0 && <article><small>Recent friction</small><strong>{Object.entries(props.errorKeys).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key, count]) => `${key} ×${count}`).join(" · ")}</strong></article>}
        </div>
        {props.state.settings.showKeyboard && <KeyboardGuide errors={props.errorKeys} />}
      </section>
    </main>
  );
}

function LibraryView({ state, onOpen, onFavorite }: { state: AppState; onOpen: (problem: Problem, stage?: number) => void; onFavorite: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const [pattern, setPattern] = useState<Pattern | "All">("All");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [status, setStatus] = useState<"All" | "New" | "Learning" | "Owned" | "Due" | "Favorites">("All");
  const [sort, setSort] = useState<Sort>("recommended");

  const filtered = useMemo(() => {
    const result = PROBLEMS.filter((problem) => {
      const stats = problemStats(state, problem.id);
      const textMatch = `${problem.id} ${problem.title} ${problem.pattern} ${problem.cue}`.toLowerCase().includes(query.toLowerCase());
      const statusMatch = status === "All" || (status === "New" && !stats.completions) || (status === "Learning" && stats.highestStage > 0 && stats.highestStage < 5) || (status === "Owned" && stats.highestStage === 5) || (status === "Due" && isReviewDue(state, problem.id)) || (status === "Favorites" && state.favorites.includes(problem.id));
      return textMatch && (pattern === "All" || problem.pattern === pattern) && (difficulty === "All" || problem.difficulty === difficulty) && statusMatch;
    });
    return result.sort((a, b) => {
      if (sort === "number") return a.id - b.id;
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "difficulty") return a.difficulty.localeCompare(b.difficulty);
      return problemStats(state, a.id).highestStage - problemStats(state, b.id).highestStage || a.id - b.id;
    });
  }, [state, query, pattern, difficulty, status, sort]);

  return (
    <main className="page-container">
      <PageHeading eyebrow="Swift interview catalog" title="Choose what to own next." copy="Original Swift implementations organized by the patterns you need under interview pressure." />
      <div className="library-toolbar">
        <label className="search-box wide"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 33 problems, patterns, or cues" /></label>
        <select value={pattern} onChange={(event) => setPattern(event.target.value as Pattern | "All")}><option>All</option>{PATTERN_ORDER.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty | "All")}><option>All</option><option>Easy</option><option>Medium</option></select>
        <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="recommended">Recommended</option><option value="number">Problem number</option><option value="title">Title</option><option value="difficulty">Difficulty</option></select>
      </div>
      <div className="filter-chips">{(["All", "New", "Learning", "Owned", "Due", "Favorites"] as const).map((item) => <button className={status === item ? "active" : ""} onClick={() => setStatus(item)} key={item}>{item}{item === "Due" && ` (${PROBLEMS.filter((problem) => isReviewDue(state, problem.id)).length})`}</button>)}</div>
      <div className="library-summary"><strong>{filtered.length}</strong> results <span /> <small>Five progressive recall stages per problem</small></div>
      <div className="problem-grid">
        {filtered.map((problem) => {
          const stats = problemStats(state, problem.id);
          const due = reviewDueAt(state, problem.id);
          return (
            <article className="problem-card" key={problem.id}>
              <div className="problem-card-top"><span className="problem-number">#{problem.id}</span><button onClick={() => onFavorite(problem.id)} aria-label="Toggle favorite">{state.favorites.includes(problem.id) ? "★" : "☆"}</button></div>
              <h2>{problem.title}</h2>
              <div className="problem-tags"><span className={`difficulty ${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span><span>{problem.pattern}</span></div>
              <p>{problem.cue}</p>
              <div className="mini-stage-track">{STAGES.map((stage) => <i key={stage.id} className={stage.id <= stats.highestStage ? "complete" : stage.id === stats.highestStage + 1 ? "next" : ""} />)}</div>
              <div className="problem-card-meta"><span>{stats.completions ? `${stats.completions} passes · ${stats.bestWpm} best WPM` : `${problemLineCount(problem)} lines · ~${problem.estimatedMinutes} min`}</span>{due && <span className={isReviewDue(state, problem.id) ? "due" : ""}>{isReviewDue(state, problem.id) ? "Due now" : `Review ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(due)}`}</span>}</div>
              <button className="primary-button" onClick={() => onOpen(problem)}>{stats.highestStage ? `Continue at stage ${Math.min(5, stats.highestStage + 1)}` : "Start with full ghost"}<span>→</span></button>
            </article>
          );
        })}
      </div>
      {!filtered.length && <div className="empty-state"><span>⌕</span><h2>No matching problems</h2><p>Try a broader pattern or reset the status filter.</p></div>}
    </main>
  );
}

function ProgressView({ state, onOpen, onReview }: { state: AppState; onOpen: (problem: Problem, stage?: number) => void; onReview: () => void }) {
  const attempts = completedAttempts(state);
  const recent = attempts.slice(-14);
  const avgWpm = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.wpm, 0) / attempts.length) : 0;
  const avgAccuracy = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.accuracy, 0) / attempts.length) : 0;
  const mastered = PROBLEMS.filter((problem) => problemStats(state, problem.id).highestStage === 5).length;
  const due = PROBLEMS.filter((problem) => isReviewDue(state, problem.id));
  const maxWpm = Math.max(1, ...recent.map((item) => item.wpm));
  const patternStats = PATTERN_ORDER.map((pattern) => {
    const problems = PROBLEMS.filter((problem) => problem.pattern === pattern);
    const points = problems.reduce((sum, problem) => sum + problemStats(state, problem.id).highestStage, 0);
    return { pattern, percent: Math.round((points / (problems.length * 5)) * 100), count: problems.length };
  });

  return (
    <main className="page-container">
      <PageHeading eyebrow="Local practice profile" title="Your recall, not just your speed." copy="Every completed and abandoned attempt stays on this device. Blank-editor reconstruction is the strongest signal." />
      <div className="stat-grid">
        <StatCard label="Completed passes" value={String(attempts.length)} note={`${state.attempts.filter((item) => item.outcome === "abandoned").length} abandoned attempts`} />
        <StatCard label="Average speed" value={`${avgWpm} WPM`} note={`${avgAccuracy}% average accuracy`} />
        <StatCard label="Current streak" value={`${activeStreak(state)} days`} note={`${practicedMinutesToday(state)} minutes today`} />
        <StatCard label="Owned problems" value={`${mastered}/${PROBLEMS.length}`} note="Completed at blank recall" />
      </div>
      <div className="dashboard-grid">
        <section className="dashboard-card chart-card">
          <div className="section-head"><div><small>Last 14 completed passes</small><h2>Typing rhythm</h2></div><span>WPM</span></div>
          {recent.length ? <div className="bar-chart">{recent.map((item) => <div className="bar-column" key={item.id} title={`${item.wpm} WPM · ${item.accuracy}%`}><span>{item.wpm}</span><i style={{ height: `${Math.max(8, (item.wpm / maxWpm) * 100)}%` }} /><small>S{item.stage}</small></div>)}</div> : <EmptyChart />}
        </section>
        <section className="dashboard-card review-card">
          <div className="section-head"><div><small>Spaced review</small><h2>{due.length ? `${due.length} due now` : "Queue is clear"}</h2></div><span className="review-orbit">↻</span></div>
          <p>Successful passes return after 1, 3, 7, 14, and 30 days as your recall stage grows.</p>
          {due.slice(0, 3).map((problem) => <button className="review-row" key={problem.id} onClick={() => onOpen(problem)}><span>#{problem.id} {problem.title}</span><strong>Stage {recommendedStage(state, problem)} →</strong></button>)}
          <button className="primary-button" disabled={!due.length} onClick={onReview}>{due.length ? "Start due review" : "Nothing due yet"}</button>
        </section>
      </div>
      <section className="dashboard-card mastery-card">
        <div className="section-head"><div><small>Curriculum coverage</small><h2>Pattern mastery</h2></div><span>{patternStats.filter((item) => item.percent > 0).length}/{patternStats.length} patterns started</span></div>
        <div className="mastery-grid">{patternStats.map((item) => <div className="mastery-row" key={item.pattern}><span><strong>{item.pattern}</strong><small>{item.count} problems</small></span><div><i style={{ width: `${item.percent}%` }} /></div><b>{item.percent}%</b></div>)}</div>
      </section>
      <section className="dashboard-card history-card">
        <div className="section-head"><div><small>Immutable local log</small><h2>Attempt history</h2></div><span>{state.attempts.length} recorded</span></div>
        <div className="history-table"><div className="history-head"><span>Problem</span><span>Stage</span><span>Result</span><span>Speed</span><span>Accuracy</span><span>When</span></div>{state.attempts.slice().reverse().slice(0, 20).map((attempt) => { const problem = PROBLEMS.find((item) => item.id === attempt.problemId); return <button className="history-row" key={attempt.id} onClick={() => problem && onOpen(problem, attempt.stage)}><span><strong>{problem?.title ?? `#${attempt.problemId}`}</strong><small>#{attempt.problemId}</small></span><span>{STAGES[attempt.stage - 1]?.short}</span><span className={attempt.outcome}>{attempt.outcome}</span><span>{attempt.wpm} WPM</span><span>{attempt.accuracy}%</span><span>{formatDate(attempt.completedAt)}</span></button>; })}</div>
        {!state.attempts.length && <div className="empty-history">Your first completed pass will appear here.</div>}
      </section>
    </main>
  );
}

function SettingsView({ state, onUpdate, onExport, onImport, onReset }: { state: AppState; onUpdate: (patch: Partial<Settings>) => void; onExport: () => void; onImport: () => void; onReset: () => void }) {
  return (
    <main className="page-container settings-page">
      <PageHeading eyebrow="Make it yours" title="Practice settings." copy="Tune the editor for comfort. These preferences and your history stay in this browser." />
      <section className="settings-section"><div className="settings-intro"><small>Appearance</small><h2>Color theme</h2><p>Six low-distraction palettes built for long practice sessions.</p></div><div className="theme-grid">{THEMES.map((theme) => <button className={state.settings.theme === theme.id ? "active" : ""} onClick={() => onUpdate({ theme: theme.id })} key={theme.id}><span>{theme.colors.map((color) => <i key={color} style={{ background: color }} />)}</span><strong>{theme.label}</strong>{state.settings.theme === theme.id && <b>✓</b>}</button>)}</div></section>
      <section className="settings-section"><div className="settings-intro"><small>Editor</small><h2>Typing surface</h2><p>Match the rhythm of the editor you use every day.</p></div><div className="setting-list">
        <SettingRow label="Font family" note="Choose a coding voice."><select value={state.settings.font} onChange={(event) => onUpdate({ font: event.target.value as Settings["font"] })}><option value="mono">Jet Mono</option><option value="rounded">Rounded Mono</option><option value="classic">Classic Mono</option></select></SettingRow>
        <SettingRow label="Font size" note="Editor text size."><div className="stepper"><button onClick={() => onUpdate({ fontSize: Math.max(12, state.settings.fontSize - 1) })}>−</button><span>{state.settings.fontSize}px</span><button onClick={() => onUpdate({ fontSize: Math.min(24, state.settings.fontSize + 1) })}>+</button></div></SettingRow>
        <SettingRow label="Indentation" note="Spaces inserted by Tab."><Segmented value={String(state.settings.tabSize)} options={["2", "4"]} onChange={(value) => onUpdate({ tabSize: Number(value) as 2 | 4 })} /></SettingRow>
        <SettingRow label="Editor height" note="Visible lines before scrolling."><Segmented value={String(state.settings.editorLines)} options={["12", "16", "20"]} onChange={(value) => onUpdate({ editorLines: Number(value) as 12 | 16 | 20 })} /></SettingRow>
      </div></section>
      <section className="settings-section"><div className="settings-intro"><small>Behavior</small><h2>Practice rules</h2><p>Strict mode is ideal while rebuilding muscle memory.</p></div><div className="setting-list">
        <ToggleRow label="Strict correction" note="Reject incorrect characters immediately." checked={state.settings.strictMode} onChange={(checked) => onUpdate({ strictMode: checked })} />
        <ToggleRow label="Live WPM" note="Show speed during the attempt." checked={state.settings.showLiveWpm} onChange={(checked) => onUpdate({ showLiveWpm: checked })} />
        <ToggleRow label="Auto indentation" note="Carry indentation to the next line." checked={state.settings.autoIndent} onChange={(checked) => onUpdate({ autoIndent: checked })} />
        <ToggleRow label="Keyboard guide" note="Show a friction heatmap below the editor." checked={state.settings.showKeyboard} onChange={(checked) => onUpdate({ showKeyboard: checked })} />
        <SettingRow label="Daily practice goal" note="Minutes practiced before the ring closes."><div className="stepper"><button onClick={() => onUpdate({ dailyGoalMinutes: Math.max(5, state.settings.dailyGoalMinutes - 5) })}>−</button><span>{state.settings.dailyGoalMinutes} min</span><button onClick={() => onUpdate({ dailyGoalMinutes: Math.min(120, state.settings.dailyGoalMinutes + 5) })}>+</button></div></SettingRow>
      </div></section>
      <section className="settings-section"><div className="settings-intro"><small>Your data</small><h2>Local profile</h2><p>Export a portable JSON backup or restore one on another browser.</p></div><div className="data-actions"><button className="outline-button" onClick={onExport}>Export progress</button><button className="outline-button" onClick={onImport}>Import backup</button><button className="danger-button" onClick={onReset}>Clear local data</button></div></section>
    </main>
  );
}

function ResultDialog({ result, onClose, onNext, onRandom }: { result: Result; onClose: () => void; onNext: () => void; onRandom: () => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="result-dialog" role="dialog" aria-modal="true" aria-labelledby="result-title"><button className="dialog-close" onClick={onClose} aria-label="Close">×</button><div className="result-mark">✓</div><span className="eyebrow">Pass complete · Stage {result.stage}</span><h2 id="result-title">{result.problem.title}</h2><p>You completed the {STAGES[result.stage - 1].name.toLowerCase()} pass. Speed is useful; independent reconstruction is the goal.</p><div className="result-stats"><span><small>WPM</small><strong>{result.wpm}</strong></span><span><small>Accuracy</small><strong>{result.accuracy}%</strong></span><span><small>Time</small><strong>{formatDuration(result.durationMs)}</strong></span><span><small>Corrections</small><strong>{result.corrections + result.rejectedKeystrokes}</strong></span></div><div className="result-actions"><button className="outline-button" onClick={onRandom}>Different problem</button><button className="primary-button" onClick={onNext}>{result.stage < 5 ? "Climb to next stage →" : "Practice recall again →"}</button></div></section></div>;
}

function PageHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <header className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></header>;
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="stat-card"><small>{label}</small><strong>{value}</strong><span>{note}</span></article>;
}

function EmptyChart() {
  return <div className="empty-chart"><span>⌨</span><strong>No completed passes yet</strong><small>Finish one practice stage to start your rhythm chart.</small></div>;
}

function KeyboardGuide({ errors }: { errors: Record<string, number> }) {
  const rows = ["1234567890", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const max = Math.max(1, ...Object.values(errors));
  return <section className="keyboard-guide"><div><small>Key friction</small><strong>Rejected-key heatmap</strong></div><div className="keyboard-rows">{rows.map((row) => <div key={row}>{row.split("").map((key) => { const count = errors[key] ?? errors[key.toLowerCase()] ?? 0; return <span key={key} className={count ? "hot" : ""} style={{ "--heat": String(count / max) } as React.CSSProperties}>{key}<small>{count || ""}</small></span>; })}</div>)}<div><span className="space-key">space<small>{errors.space || ""}</small></span></div></div></section>;
}

function SettingRow({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return <div className="setting-row"><span><strong>{label}</strong><small>{note}</small></span>{children}</div>;
}

function ToggleRow({ label, note, checked, onChange }: { label: string; note: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <SettingRow label={label} note={note}><button role="switch" aria-checked={checked} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i /></button></SettingRow>;
}

function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <div className="segmented">{options.map((option) => <button className={value === option ? "active" : ""} onClick={() => onChange(option)} key={option}>{option}</button>)}</div>;
}
