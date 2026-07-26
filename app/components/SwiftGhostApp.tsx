"use client";

import { ChangeEvent, ClipboardEvent as ReactClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { PATTERN_ORDER, problemLineCount, problemUrl, type Difficulty, type Pattern } from "../data/problems";
import { BUILTIN_ITEMS, itemDisplayId, makeCustomItem, updateCustomItem, type ItemId, type PracticeItem } from "../lib/items";
import { buildSessionQueue, type SessionQueueEntry, type SessionSource, type SessionStageMode } from "../lib/sessions.mjs";
import {
  EMPTY_STATE,
  LEGACY_STORAGE_KEY,
  OLDER_STORAGE_KEY,
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
  type Settings,
  type Theme,
  type TrainingSession,
  type View,
} from "../lib/product";

type Result = AttemptRecord & { item: PracticeItem; previousBest: AttemptRecord | null; nextReview: Date | null; sessionNext?: { itemId: ItemId; stage: number }; sessionComplete?: boolean };
type Sort = "recommended" | "number" | "title" | "difficulty";
type SessionBuildOptions = { name: string; count: number; source: SessionSource; pattern: string; difficulty: string; stageMode: SessionStageMode };

const THEMES: { id: Theme; label: string; colors: string[] }[] = [
  { id: "midnight", label: "Midnight", colors: ["#09111f", "#5eead4", "#a78bfa"] },
  { id: "paper", label: "Paper", colors: ["#f6f2e8", "#166534", "#b45309"] },
  { id: "forest", label: "Forest", colors: ["#0c1914", "#86efac", "#fcd34d"] },
  { id: "synthwave", label: "Synthwave", colors: ["#1d102b", "#f472b6", "#22d3ee"] },
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

function freshDraft(itemId: ItemId, stage: number, itemRevision = 1, challengeDate?: string, sessionId?: string): Draft {
  return { itemId, itemRevision, stage, value: "", startedAt: null, totalKeystrokes: 0, correctKeystrokes: 0, rejectedKeystrokes: 0, corrections: 0, peeks: 0, challengeDate, sessionId };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDay(value: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(value);
}

function useModalKeyboard(onClose: () => void, dialogRef: React.RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') ?? [])];
    const frame = window.requestAnimationFrame(() => (dialogRef.current?.querySelector<HTMLElement>("[data-modal-autofocus]") ?? focusable()[0])?.focus());
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const controls = focusable(); if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener("keydown", handleKeyDown); previous?.focus(); };
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
  const [errorKeys, setErrorKeys] = useState<Record<string, number>>({});
  const [customEditor, setCustomEditor] = useState<PracticeItem | "new" | null>(null);
  const wpmSamples = useRef<number[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  const allItems = useMemo(() => [...BUILTIN_ITEMS, ...state.customItems.filter((item) => !item.archivedAt)], [state.customItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = loadState();
      const items = [...BUILTIN_ITEMS, ...restored.customItems.filter((item) => !item.archivedAt)];
      setState(restored);
      setSelectedId(items.some((item) => item.itemId === restored.lastItemId) ? restored.lastItemId : BUILTIN_ITEMS[0].itemId);
      setStage(restored.lastStage || 1);
      setNow(Date.now());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => { if (ready) saveState(state); }, [ready, state]);
  useEffect(() => { document.documentElement.dataset.theme = state.settings.theme; document.documentElement.dataset.font = state.settings.font; }, [state.settings.theme, state.settings.font]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);

  const item = allItems.find((candidate) => candidate.itemId === selectedId) ?? allItems[0] ?? BUILTIN_ITEMS[0];
  const draft = state.draft?.itemId === selectedId && state.draft.stage === stage ? state.draft : freshDraft(selectedId, stage, item.contentRevision);
  const metrics = currentMetrics(draft, item.code, now);
  const ghostCode = maskCode(item.code, stage, reveal, item.masks);
  const stats = itemStats(state, selectedId);
  const dueItems = allItems.filter((candidate) => isReviewDue(state, candidate.itemId));
  const todayMinutes = practicedMinutesToday(state);
  const dailyPercent = Math.min(100, Math.round((todayMinutes / state.settings.dailyGoalMinutes) * 100));

  function mutateState(updater: (current: AppState) => AppState) { setState((current) => updater(current)); }

  function createAttempt(active: Draft, activeItem: PracticeItem, outcome: AttemptRecord["outcome"], current: AppState) {
    const live = currentMetrics(active, activeItem.code);
    const attempt: AttemptRecord = {
      id: makeId(), itemId: active.itemId, itemRevision: active.itemRevision, titleSnapshot: activeItem.title, stage: active.stage,
      mode: current.settings.strictMode ? "strict" : "free",
      startedAt: new Date(active.startedAt ?? Date.now()).toISOString(), completedAt: new Date().toISOString(),
      durationMs: live.durationMs, totalKeystrokes: active.totalKeystrokes, correctKeystrokes: active.correctKeystrokes,
      rejectedKeystrokes: active.rejectedKeystrokes, corrections: active.corrections, peeks: active.peeks,
      rawWpm: live.rawWpm, wpm: live.wpm, accuracy: live.accuracy,
      consistency: consistencyFromSamples(wpmSamples.current), outcome, qualification: "assisted", challengeDate: active.challengeDate, sessionId: active.sessionId,
    };
    attempt.qualification = qualificationFor(attempt);
    return attempt;
  }

  function recordAbandon(current: AppState) {
    const active = current.draft;
    if (!active?.startedAt || active.value.length < 5) return current;
    const activeItem = [...BUILTIN_ITEMS, ...current.customItems].find((candidate) => candidate.itemId === active.itemId);
    if (!activeItem) return { ...current, draft: null };
    const attempt = createAttempt(active, activeItem, "abandoned", current);
    return { ...current, attempts: [...current.attempts, attempt].slice(-1000), draft: null };
  }

  function openItem(next: PracticeItem, nextStage?: number, challengeDate?: string, sessionId?: string) {
    const chosenStage = nextStage ?? recommendedStage(state, next);
    mutateState((current) => {
      const resuming = !challengeDate && current.draft?.itemId === next.itemId && current.draft.stage === chosenStage && current.draft.itemRevision === next.contentRevision && current.draft.sessionId === sessionId;
      const base = resuming ? current : recordAbandon(current);
      return { ...base, draft: resuming ? current.draft : challengeDate || sessionId ? freshDraft(next.itemId, chosenStage, next.contentRevision, challengeDate, sessionId) : null, lastItemId: next.itemId, lastStage: chosenStage };
    });
    setSelectedId(next.itemId); setStage(chosenStage); setReveal(false); setResult(null); setView("practice"); setErrorKeys({}); wpmSamples.current = [];
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".editor-wrap textarea")?.focus(), 50);
  }

  function chooseStage(nextStage: number) {
    mutateState((current) => {
      const sessionId = current.draft?.sessionId; const base = recordAbandon(current);
      const activeSession = sessionId && base.activeSession?.id === sessionId ? { ...base.activeSession, entries: base.activeSession.entries.map((entry, index) => index === base.activeSession?.currentIndex ? { ...entry, stage: nextStage } : entry) } : base.activeSession;
      return { ...base, activeSession, draft: sessionId ? freshDraft(selectedId, nextStage, item.contentRevision, undefined, sessionId) : null, lastStage: nextStage };
    });
    setStage(nextStage); setReveal(false); setResult(null); setErrorKeys({}); wpmSamples.current = [];
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".editor-wrap textarea")?.focus(), 0);
  }

  function updateDraft(next: Draft) {
    const live = currentMetrics(next, item.code);
    if (next.startedAt && live.wpm > 0) wpmSamples.current.push(live.wpm);
    mutateState((current) => ({ ...current, draft: next, lastItemId: selectedId, lastStage: stage }));
  }

  function finish(next: Draft) {
    const attempt = createAttempt(next, item, "completed", state);
    const previousBest = personalBest(state, selectedId, stage, attempt.mode);
    let projected: AppState = { ...state, attempts: [...state.attempts, attempt].slice(-1000), draft: null };
    let sessionNext: Result["sessionNext"];
    let sessionComplete = false;
    const session = state.activeSession;
    if (session && next.sessionId === session.id) {
      const entries = session.entries.map((entry, index) => index === session.currentIndex ? { ...entry, status: "completed" as const, attemptId: attempt.id } : entry);
      const nextIndex = entries.findIndex((entry, index) => index > session.currentIndex && entry.status === "pending");
      if (nextIndex >= 0) {
        const nextEntry = entries[nextIndex];
        projected = { ...projected, activeSession: { ...session, entries, currentIndex: nextIndex } };
        sessionNext = { itemId: nextEntry.itemId, stage: nextEntry.stage };
      } else {
        sessionComplete = true;
        projected = {
          ...projected,
          activeSession: null,
          sessionHistory: [...projected.sessionHistory, { id: session.id, name: session.name, startedAt: session.createdAt, completedAt: new Date().toISOString(), completed: entries.filter((entry) => entry.status === "completed").length, total: entries.length }].slice(-25),
        };
      }
    }
    mutateState(() => projected);
    setResult({ ...attempt, item, previousBest, nextReview: reviewDueAt(projected, selectedId), sessionNext, sessionComplete });
    wpmSamples.current = [];
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const proposed = event.target.value;
    const edit = analyzeEdit(draft.value, proposed, item.code);
    const startedAt = draft.startedAt ?? Date.now();
    const correctPrefix = item.code.startsWith(proposed);
    if (state.settings.strictMode && !correctPrefix && edit.insertedCount > 0) {
      const rejected = Math.max(1, edit.incorrectInserted || edit.insertedCount);
      setErrorKeys((keys) => edit.inserted.split("").reduce((next, character, index) => {
        if (character === item.code[edit.prefix + index]) return next;
        const keyName = character === "\n" ? "↵" : character === " " ? "space" : character;
        return { ...next, [keyName]: (next[keyName] ?? 0) + 1 };
      }, keys));
      updateDraft({ ...draft, startedAt, totalKeystrokes: draft.totalKeystrokes + edit.insertedCount, rejectedKeystrokes: draft.rejectedKeystrokes + rejected, corrections: draft.corrections + edit.deletedCount });
      setToast(`Expected ${JSON.stringify(item.code[edit.prefix] ?? "end of solution")}`);
      return;
    }
    const next: Draft = {
      ...draft, value: proposed, startedAt,
      totalKeystrokes: draft.totalKeystrokes + edit.insertedCount,
      correctKeystrokes: draft.correctKeystrokes + edit.correctInserted,
      corrections: draft.corrections + edit.deletedCount,
    };
    updateDraft(next);
    if (proposed === item.code) finish(next);
  }

  function insertAtCursor(input: HTMLTextAreaElement, text: string) {
    const start = input.selectionStart; const end = input.selectionEnd;
    handleChange({ target: { value: `${draft.value.slice(0, start)}${text}${draft.value.slice(end)}` } } as ChangeEvent<HTMLTextAreaElement>);
    window.requestAnimationFrame(() => { input.selectionStart = input.selectionEnd = start + text.length; });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") { event.currentTarget.blur(); setFocusMode(false); return; }
    if (event.key === "Tab") { event.preventDefault(); insertAtCursor(event.currentTarget, " ".repeat(state.settings.tabSize)); }
  }

  function resetAttempt() {
    mutateState((current) => { const sessionId = current.draft?.sessionId; const base = recordAbandon(current); return { ...base, draft: sessionId ? freshDraft(selectedId, stage, item.contentRevision, undefined, sessionId) : null }; }); setReveal(false); setResult(null); wpmSamples.current = []; setToast("Attempt reset");
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".editor-wrap textarea")?.focus(), 0);
  }

  function toggleReveal() { setReveal((current) => !current); if (!reveal) updateDraft({ ...draft, peeks: draft.peeks + 1 }); }
  function toggleFavorite(itemId: ItemId) { mutateState((current) => ({ ...current, favorites: current.favorites.includes(itemId) ? current.favorites.filter((id) => id !== itemId) : [...current.favorites, itemId] })); }
  function updateSettings(patch: Partial<Settings>) { mutateState((current) => ({ ...current, settings: { ...current.settings, ...patch } })); }
  function randomItem(mode: "all" | "due" = "all") { const pool = mode === "due" && dueItems.length ? dueItems : allItems; openItem(pool[Math.floor(Math.random() * pool.length)]); }

  function startSession(options: SessionBuildOptions, plannedEntries?: SessionQueueEntry[]) {
    if (state.activeSession && !window.confirm("Replace the active session with this new queue? Completed entries will stay in session history.")) return;
    const signals = Object.fromEntries(allItems.map((candidate) => {
      const itemProgress = itemStats(state, candidate.itemId);
      return [candidate.itemId, { due: isReviewDue(state, candidate.itemId), favorite: state.favorites.includes(candidate.itemId), completions: itemProgress.completions, recommendedStage: recommendedStage(state, candidate), itemRevision: candidate.contentRevision }];
    }));
    const entries = plannedEntries?.length ? plannedEntries : buildSessionQueue(allItems, signals, options);
    if (!entries.length) { setToast("No items match that session setup"); return; }
    const session: TrainingSession = { id: makeId(), name: options.name.trim() || "Practice session", source: options.source, stageMode: options.stageMode, createdAt: new Date().toISOString(), entries, currentIndex: 0 };
    mutateState((current) => {
      const base = recordAbandon(current); const previous = base.activeSession;
      const sessionHistory = previous ? [...base.sessionHistory, { id: previous.id, name: previous.name, startedAt: previous.createdAt, completedAt: new Date().toISOString(), completed: previous.entries.filter((entry) => entry.status === "completed").length, total: previous.entries.length }].slice(-25) : base.sessionHistory;
      return { ...base, activeSession: session, sessionHistory, draft: null };
    });
    const first = allItems.find((candidate) => candidate.itemId === entries[0].itemId);
    if (first) openItem(first, entries[0].stage, undefined, session.id);
    setToast(`${entries.length}-item session started`);
  }

  function resumeSession() {
    const session = state.activeSession; if (!session) return;
    const entry = session.entries[session.currentIndex]; const next = allItems.find((candidate) => candidate.itemId === entry?.itemId);
    if (entry && next) openItem(next, entry.stage, undefined, session.id);
  }

  function skipSessionEntry() {
    const session = state.activeSession; if (!session) return;
    const entries = session.entries.map((entry, index) => index === session.currentIndex ? { ...entry, status: "skipped" as const } : entry);
    const nextIndex = entries.findIndex((entry, index) => index > session.currentIndex && entry.status === "pending");
    if (nextIndex < 0) {
      mutateState((current) => {
        const base = current.draft?.sessionId === session.id ? recordAbandon(current) : current;
        return { ...base, activeSession: null, sessionHistory: [...base.sessionHistory, { id: session.id, name: session.name, startedAt: session.createdAt, completedAt: new Date().toISOString(), completed: entries.filter((entry) => entry.status === "completed").length, total: entries.length }].slice(-25) };
      });
      setResult(null); setView("sessions"); setToast("Session finished"); return;
    }
    const nextSession = { ...session, entries, currentIndex: nextIndex };
    mutateState((current) => ({ ...current, activeSession: nextSession }));
    const next = allItems.find((candidate) => candidate.itemId === entries[nextIndex].itemId);
    if (next) openItem(next, entries[nextIndex].stage, undefined, session.id);
  }

  function endSession() {
    const session = state.activeSession; if (!session || !window.confirm("End this session? Completed entries stay recorded.")) return;
    mutateState((current) => {
      const base = current.draft?.sessionId === session.id ? recordAbandon(current) : current;
      return { ...base, activeSession: null, sessionHistory: [...base.sessionHistory, { id: session.id, name: session.name, startedAt: session.createdAt, completedAt: new Date().toISOString(), completed: session.entries.filter((entry) => entry.status === "completed").length, total: session.entries.length }].slice(-25) };
    });
    setResult(null); setView("sessions"); setToast("Session ended");
  }

  function saveCustom(input: Parameters<typeof makeCustomItem>[0]) {
    if (customEditor && customEditor !== "new") {
      const updated = updateCustomItem(customEditor, input); const codeChanged = updated.contentRevision !== customEditor.contentRevision;
      const activeDraft = state.draft?.itemId === customEditor.itemId && Boolean(state.draft.startedAt || state.draft.value);
      if (codeChanged && activeDraft && !window.confirm("The Swift code changed. Save this edit and close the current draft? The old draft will be kept as an abandoned attempt.")) return;
      mutateState((current) => {
        const base = codeChanged && current.draft?.itemId === customEditor.itemId ? recordAbandon(current) : current;
        const activeSession = base.activeSession ? { ...base.activeSession, entries: base.activeSession.entries.map((entry) => entry.itemId === updated.itemId && entry.status === "pending" ? { ...entry, itemRevision: updated.contentRevision } : entry) } : null;
        return { ...base, customItems: base.customItems.map((item) => item.itemId === updated.itemId ? updated : item), draft: codeChanged && base.draft?.itemId === updated.itemId ? null : base.draft, activeSession };
      });
      setCustomEditor(null); setResult(null); setReveal(false); if (codeChanged) { setStage(1); setErrorKeys({}); }
      setToast(codeChanged ? "Snippet updated · mastery restarted for revision" : "Snippet details updated"); return;
    }
    const custom = makeCustomItem(input);
    mutateState((current) => ({ ...current, customItems: [...current.customItems, custom], lastItemId: custom.itemId }));
    setCustomEditor(null); setToast("Custom snippet saved on this device"); openItem(custom, 1);
  }

  function archiveCustom(itemId: ItemId) {
    if (!window.confirm("Archive this custom snippet? Its attempt history will stay in Records.")) return;
    mutateState((current) => {
      const base = current.draft?.itemId === itemId ? recordAbandon(current) : current;
      let activeSession = base.activeSession; let sessionHistory = base.sessionHistory;
      if (activeSession?.entries.some((entry) => entry.itemId === itemId && entry.status === "pending")) {
        const entries = activeSession.entries.map((entry) => entry.itemId === itemId && entry.status === "pending" ? { ...entry, status: "skipped" as const } : entry);
        const nextIndex = entries.findIndex((entry) => entry.status === "pending");
        if (nextIndex >= 0) activeSession = { ...activeSession, entries, currentIndex: nextIndex };
        else { sessionHistory = [...sessionHistory, { id: activeSession.id, name: activeSession.name, startedAt: activeSession.createdAt, completedAt: new Date().toISOString(), completed: entries.filter((entry) => entry.status === "completed").length, total: entries.length }].slice(-25); activeSession = null; }
      }
      return { ...base, customItems: base.customItems.map((custom) => custom.itemId === itemId ? { ...custom, archivedAt: new Date().toISOString() } : custom), favorites: base.favorites.filter((id) => id !== itemId), lastItemId: base.lastItemId === itemId ? BUILTIN_ITEMS[0].itemId : base.lastItemId, activeSession, sessionHistory };
    });
    if (selectedId === itemId) { setSelectedId(BUILTIN_ITEMS[0].itemId); setStage(1); setReveal(false); setResult(null); setErrorKeys({}); }
    setToast("Snippet archived");
  }

  function exportProgress() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `swift-ghost-progress-${dayKey(new Date())}.json`; link.click(); URL.revokeObjectURL(link.href); setToast("Progress exported");
  }

  async function importProgress(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try { const parsed = JSON.parse(await file.text()) as unknown; const restored = normalizeState(parsed); if (!parsed || typeof parsed !== "object" || ![2, 3, 4].includes(Number((parsed as { version?: unknown }).version))) throw new Error("invalid"); setState(restored); setSelectedId(restored.lastItemId); setStage(restored.lastStage); setReveal(false); setResult(null); setErrorKeys({}); wpmSamples.current = []; setToast("Progress restored and migrated"); } catch { setToast("That backup could not be read"); }
    event.target.value = "";
  }

  function resetAllData() {
    if (!window.confirm("Delete all Swift Ghost progress, custom snippets, and settings from this device?")) return;
    localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_STORAGE_KEY); localStorage.removeItem(OLDER_STORAGE_KEY); setState(EMPTY_STATE); setSelectedId(BUILTIN_ITEMS[0].itemId); setStage(1); setToast("Local data cleared");
  }

  function handleResultNext() {
    if (!result) return;
    if (result.sessionNext && state.activeSession) {
      const next = allItems.find((candidate) => candidate.itemId === result.sessionNext?.itemId);
      if (next) { openItem(next, result.sessionNext.stage, undefined, state.activeSession.id); return; }
    }
    if (result.sessionComplete) { setResult(null); setView("sessions"); setToast("Session complete"); return; }
    chooseStage(Math.min(5, stage + 1));
  }

  return (
    <div className={`app-shell ${focusMode ? "is-focus" : ""}`}>
      <header className="topbar">
        <button className="brand" onClick={() => setView("today")} aria-label="Swift Ghost home"><span className="brand-mark" aria-hidden="true">S<span>G</span></span><span><strong>Swift Ghost</strong><small>type it · fade it · own it</small></span></button>
        <nav className="main-nav" aria-label="Main navigation">{NAV.map((nav) => <button key={nav.id} className={view === nav.id ? "active" : ""} aria-current={view === nav.id ? "page" : undefined} onClick={() => setView(nav.id)}><span aria-hidden="true">{nav.icon}</span>{nav.label}</button>)}</nav>
        <div className="top-actions"><button className="goal-pill" onClick={() => setView("today")} title="Today's practice goal"><span className="goal-ring" style={{ "--goal": `${dailyPercent * 3.6}deg` } as React.CSSProperties}>{dailyPercent}%</span><span><strong>{todayMinutes}/{state.settings.dailyGoalMinutes} min</strong><small>{activeStreak(state)} day streak</small></span></button><button className="icon-button" onClick={() => randomItem()} title="Random problem" aria-label="Open a random problem">↝</button></div>
      </header>

      {view === "today" && <TodayView ready={ready} state={state} items={allItems} onOpen={openItem} onReview={() => randomItem("due")} onBrowse={() => setView("library")} onCreate={() => setCustomEditor("new")} onSessions={() => setView("sessions")} />}
      {view === "practice" && <PracticeView state={state} items={allItems} item={item} draft={draft} stage={stage} metrics={metrics} ghostCode={ghostCode} stats={stats} dueCount={dueItems.length} reveal={reveal} focusMode={focusMode} errorKeys={errorKeys} activeSession={state.activeSession} onOpenItem={openItem} onChooseStage={chooseStage} onChange={handleChange} onKeyDown={handleKeyDown} onPaste={(event) => { event.preventDefault(); const count = Math.max(1, event.clipboardData.getData("text").length); updateDraft({ ...draft, startedAt: draft.startedAt ?? Date.now(), totalKeystrokes: draft.totalKeystrokes + count, rejectedKeystrokes: draft.rejectedKeystrokes + count }); setToast("Pasting is disabled during a practice pass"); }} onReset={resetAttempt} onReveal={toggleReveal} onFavorite={() => toggleFavorite(selectedId)} onFocusMode={() => setFocusMode((value) => !value)} onReview={() => randomItem("due")} onBrowse={() => setView("library")} onSession={() => setView("sessions")} onSkipSession={skipSessionEntry} onEndSession={endSession} />}
      {view === "sessions" && <SessionsView state={state} items={allItems} onStart={startSession} onResume={resumeSession} onSkip={skipSessionEntry} onEnd={endSession} />}
      {view === "library" && <LibraryView state={state} items={allItems} onOpen={openItem} onFavorite={toggleFavorite} onCreate={() => setCustomEditor("new")} onEdit={setCustomEditor} onArchive={archiveCustom} />}
      {view === "records" && <RecordsView state={state} items={allItems} onOpen={openItem} onReview={() => randomItem("due")} />}
      {view === "settings" && <SettingsView state={state} onUpdate={updateSettings} onExport={exportProgress} onImport={() => importRef.current?.click()} onReset={resetAllData} />}

      <input ref={importRef} className="visually-hidden" type="file" accept="application/json" onChange={importProgress} />
      {result && <ResultDialog result={result} onClose={() => setResult(null)} onNext={handleResultNext} onRandom={() => randomItem()} />}
      {customEditor && <CustomSnippetDialog item={customEditor === "new" ? undefined : customEditor} onClose={() => setCustomEditor(null)} onSave={saveCustom} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function TodayView({ ready, state, items, onOpen, onReview, onBrowse, onCreate, onSessions }: { ready: boolean; state: AppState; items: PracticeItem[]; onOpen: (item: PracticeItem, stage?: number, challengeDate?: string, sessionId?: string) => void; onReview: () => void; onBrowse: () => void; onCreate: () => void; onSessions: () => void }) {
  const todayDate = ready ? new Date() : new Date(2000, 0, 1, 12); const today = dayKey(todayDate); const daily = dailyItem(BUILTIN_ITEMS, todayDate); const due = items.filter((item) => isReviewDue(state, item.itemId));
  const dailyDone = state.attempts.some((attempt) => attempt.challengeDate === today && attempt.itemId === daily?.itemId && eligibleAttempt(attempt));
  const draftItem = state.draft ? items.find((item) => item.itemId === state.draft?.itemId) : null;
  const minutes = practicedMinutesToday(state); const goal = state.settings.dailyGoalMinutes;
  return <main className="page-container today-page">
    <PageHeading eyebrow={ready ? new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(todayDate) : "Today"} title="Build recall, one clean pass at a time." copy="Start with today's deterministic challenge, clear anything due, or continue exactly where you stopped." />
    <section className="today-hero">
      <div className="today-copy"><span className="eyebrow">Daily Type {dailyDone ? "· complete" : "· ready"}</span><h2>{daily?.title}</h2><p>{daily?.cue}</p><div className="problem-tags"><span className={`difficulty ${daily?.difficulty.toLowerCase()}`}>{daily?.difficulty}</span><span>{daily?.pattern}</span><span>{daily ? problemLineCount(daily) : 0} lines</span></div><button className="primary-button" disabled={!daily} onClick={() => daily && onOpen(daily, recommendedStage(state, daily), today)}>{dailyDone ? "Practice it again" : "Start today's challenge"}<span>→</span></button></div>
      <div className="today-score"><div className="today-ring" style={{ "--goal": `${Math.min(360, (minutes / goal) * 360)}deg` } as React.CSSProperties}><strong>{minutes}</strong><small>of {goal} min</small></div><span>{activeStreak(state)} day streak</span><small>Only completed and abandoned practice time counts.</small></div>
    </section>
    <div className="today-grid">
      {draftItem && <article className="today-card priority"><span className="eyebrow">Continue draft</span><h3>{draftItem.title}</h3><p>Stage {state.draft?.stage} · {state.draft?.value.length} characters typed{state.draft?.sessionId ? " · session queue" : ""}</p><button className="outline-button" onClick={() => onOpen(draftItem, state.draft?.stage, undefined, state.draft?.sessionId)}>Resume exactly where you left off →</button></article>}
      <article className="today-card"><span className="eyebrow">Due recall</span><h3>{due.length ? `${due.length} solution${due.length === 1 ? "" : "s"} ready` : "Queue is clear"}</h3><p>{due.length ? "A short return now strengthens retrieval more than another fresh problem." : "Your next reviews will appear here automatically."}</p><button className="outline-button" disabled={!due.length} onClick={onReview}>{due.length ? "Start due review →" : "Nothing due today"}</button></article>
      <article className="today-card"><span className="eyebrow">Focused set</span><h3>Build a deliberate session.</h3><p>Queue due work, new problems, favorites, or custom Swift snippets with a fixed recall policy.</p><div className="card-actions"><button className="outline-button" onClick={onSessions}>Build session</button><button className="outline-button" onClick={onCreate}>Add snippet</button><button className="outline-button" onClick={onBrowse}>Library</button></div></article>
    </div>
  </main>;
}

type PracticeProps = { state: AppState; items: PracticeItem[]; item: PracticeItem; draft: Draft; stage: number; metrics: ReturnType<typeof currentMetrics>; ghostCode: string; stats: ReturnType<typeof itemStats>; dueCount: number; reveal: boolean; focusMode: boolean; errorKeys: Record<string, number>; activeSession: TrainingSession | null; onOpenItem: (item: PracticeItem, stage?: number) => void; onChooseStage: (stage: number) => void; onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void; onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void; onPaste: (event: ReactClipboardEvent<HTMLTextAreaElement>) => void; onReset: () => void; onReveal: () => void; onFavorite: () => void; onFocusMode: () => void; onReview: () => void; onBrowse: () => void; onSession: () => void; onSkipSession: () => void; onEndSession: () => void };

function PracticeView(props: PracticeProps) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => props.items.filter((item) => `${itemDisplayId(item)} ${item.title} ${item.pattern}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12), [props.items, query]);
  const favorite = props.state.favorites.includes(props.item.itemId); const prompt = problemUrl(props.item);
  return <main className="practice-layout">
    <aside className="problem-rail"><div className="rail-head"><span className="eyebrow">{props.activeSession ? "Active session" : "Problem queue"}</span><span className="count-badge">{props.activeSession ? `${props.activeSession.currentIndex + 1}/${props.activeSession.entries.length}` : props.items.length}</span></div>{props.activeSession ? <div className="session-rail"><strong>{props.activeSession.name}</strong>{props.activeSession.entries.map((entry, index) => { const queued = props.items.find((candidate) => candidate.itemId === entry.itemId); return <div className={`${entry.status} ${index === props.activeSession?.currentIndex ? "current" : ""}`} key={`${entry.itemId}-${index}`}><span>{entry.status === "completed" ? "✓" : entry.status === "skipped" ? "–" : index + 1}</span><p><b>{queued?.title ?? "Unavailable item"}</b><small>Stage {entry.stage}</small></p></div>; })}<button className="outline-button" onClick={props.onSession}>View session</button></div> : <><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or pattern" /></label>{props.dueCount > 0 && <button className="review-callout" onClick={props.onReview}><span>Review due</span><strong>{props.dueCount} problems →</strong></button>}<div className="problem-list">{visible.map((candidate) => { const progress = itemStats(props.state, candidate.itemId); return <button key={candidate.itemId} className={`problem-row ${props.item.itemId === candidate.itemId ? "selected" : ""}`} onClick={() => props.onOpenItem(candidate)}><span className={`status-dot stage-${progress.highestStage}`}>{progress.highestStage || ""}</span><span className="problem-row-copy"><strong>{itemDisplayId(candidate)} {candidate.title}</strong><small>{candidate.pattern} · {candidate.difficulty}</small></span>{props.state.favorites.includes(candidate.itemId) && <span className="favorite-star">★</span>}</button>; })}</div><button className="rail-link" onClick={props.onBrowse}>Browse all {props.items.length} items <span>→</span></button><div className="legend"><span><i className="dot-new" />New</span><span><i className="dot-learning" />Learning</span><span><i className="dot-owned" />Owned</span></div></> }</aside>
    <section className="practice-main">
      {props.activeSession && props.draft.sessionId === props.activeSession.id && <div className="session-strip"><span><small>Session {props.activeSession.currentIndex + 1} of {props.activeSession.entries.length}</small><strong>{props.activeSession.name}</strong></span><div><button onClick={props.onSkipSession}>Skip item</button><button onClick={props.onEndSession}>End session</button></div></div>}
      <div className="problem-header"><div><div className="problem-kicker"><span>{itemDisplayId(props.item)}</span><span className={`difficulty ${props.item.difficulty.toLowerCase()}`}>{props.item.difficulty}</span><span>{props.item.pattern}</span>{props.item.source === "custom" && <span>Device-local</span>}</div><h1>{props.item.title}</h1><p>{props.item.summary}</p></div><div className="problem-actions"><button className={favorite ? "favorite active" : "favorite"} onClick={props.onFavorite} aria-label={favorite ? "Remove favorite" : "Add favorite"}>{favorite ? "★" : "☆"}</button>{prompt && <a className="outline-button" href={prompt} target="_blank" rel="noreferrer">Open prompt ↗</a>}</div></div>
      <div className="insight-grid"><article><span className="card-icon">⌁</span><div><small>Pattern cue</small><p>{props.item.cue}</p></div></article><article><span className="card-icon">∞</span><div><small>Invariant</small><p>{props.item.invariant}</p></div></article><article><span className="card-icon">S</span><div><small>Swift note</small><p>{props.item.swiftNote}</p></div></article></div>
      <div className="stage-panel"><div className="stage-title"><span className="eyebrow">Recall ladder</span><span>{STAGES[props.stage - 1].note}</span></div><div className="stage-track">{STAGES.map((step) => <button key={step.id} className={`${props.stage === step.id ? "active" : ""} ${step.id <= props.stats.highestStage ? "complete" : ""}`} aria-pressed={props.stage === step.id} onClick={() => props.onChooseStage(step.id)} title={step.note}><span>{step.id <= props.stats.highestStage ? "✓" : step.id}</span><small>{step.short}</small></button>)}</div></div>
      <div className="editor-card"><div className="editor-toolbar"><div className="window-dots" aria-hidden="true"><i /><i /><i /></div><div className="file-tab"><span className="swift-badge">S</span>Solution.swift <small>{problemLineCount(props.item)} lines</small></div><div className="editor-actions"><button onClick={props.onReveal}>{props.reveal ? "Hide answer" : "Peek"}</button><button onClick={props.onReset}>Restart</button><button onClick={props.onFocusMode}>{props.focusMode ? "Exit focus" : "Focus"}</button></div></div>
        <div className="metric-strip" aria-live="polite"><span><small>Progress</small><strong>{props.metrics.progress}%</strong></span>{props.state.settings.showLiveWpm && <span><small>WPM</small><strong>{props.metrics.wpm}</strong></span>}<span><small>Accuracy</small><strong>{props.metrics.accuracy}%</strong></span><span><small>Errors</small><strong>{props.draft.rejectedKeystrokes}</strong></span><span><small>Time</small><strong>{formatDuration(props.metrics.durationMs)}</strong></span><span className="strict-indicator"><i />{props.state.settings.strictMode ? "Strict correction" : "Free correction"}</span></div>
        <div className="editor-wrap" style={{ "--font-size": `${props.state.settings.fontSize}px`, "--editor-lines": props.state.settings.editorLines, "--code-height": `${problemLineCount(props.item) * props.state.settings.fontSize * 1.65 + 56}px` } as React.CSSProperties}><pre className="line-numbers" aria-hidden="true">{Array.from({ length: problemLineCount(props.item) }, (_, index) => index + 1).join("\n")}</pre><pre className="ghost-layer" aria-hidden="true">{props.ghostCode}</pre><pre className="typed-layer" aria-hidden="true">{props.draft.value.split("").map((char, index) => <span className={char === props.item.code[index] ? "right" : "wrong"} key={`${index}-${char}`}>{char}</span>)}</pre><textarea value={props.draft.value} onChange={props.onChange} onKeyDown={props.onKeyDown} onPaste={props.onPaste} spellCheck={false} autoCapitalize="off" autoComplete="off" aria-label={`Type the Swift solution for ${props.item.title}. Press Escape to leave the editor.`} /></div>
        <div className="editor-footer"><span><i className="key-swatch typed" />typed</span><span><i className="key-swatch ghost" />ghost</span><span><i className="key-swatch hidden" />hidden</span><span className="spacer" /><span>Tab inserts {props.state.settings.tabSize} spaces · Esc leaves editor</span></div><div className="progress-line"><i style={{ width: `${props.metrics.progress}%` }} /></div>
      </div>
      <div className="practice-notes"><article><small>Complexity check</small><strong>{props.item.complexity}</strong></article><article><small>Ownership rule</small><strong>95%+ accuracy, no peeks. Stage 5 proves independent recall; other passes build syntax.</strong></article>{Object.keys(props.errorKeys).length > 0 && <article><small>Recent friction</small><strong>{Object.entries(props.errorKeys).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key, count]) => `${key} ×${count}`).join(" · ")}</strong></article>}</div>{props.state.settings.showKeyboard && <KeyboardGuide errors={props.errorKeys} />}
    </section>
  </main>;
}

function SessionsView({ state, items, onStart, onResume, onSkip, onEnd }: { state: AppState; items: PracticeItem[]; onStart: (options: SessionBuildOptions, entries?: SessionQueueEntry[]) => void; onResume: () => void; onSkip: () => void; onEnd: () => void }) {
  const [name, setName] = useState("Focused Swift set"); const [count, setCount] = useState(5); const [source, setSource] = useState<SessionSource>("mixed"); const [pattern, setPattern] = useState<string>("All"); const [difficulty, setDifficulty] = useState<string>("All"); const [stageMode, setStageMode] = useState<SessionStageMode>("recommended");
  const signals = useMemo(() => Object.fromEntries(items.map((item) => { const progress = itemStats(state, item.itemId); return [item.itemId, { due: isReviewDue(state, item.itemId), favorite: state.favorites.includes(item.itemId), completions: progress.completions, recommendedStage: recommendedStage(state, item), itemRevision: item.contentRevision }]; })), [items, state]);
  const preview = useMemo(() => buildSessionQueue(items, signals, { count, source, pattern, difficulty, stageMode }, () => 0.5), [items, signals, count, source, pattern, difficulty, stageMode]);
  const active = state.activeSession;
  return <main className="page-container sessions-page"><PageHeading eyebrow="Deliberate practice" title="Build a session that has a finish line." copy="Create a persistent queue, lock in the recall stage for every item, and come back later without losing your place." />
    {active && <section className="active-session-card"><div><span className="eyebrow">In progress</span><h2>{active.name}</h2><p>{active.entries.filter((entry) => entry.status === "completed").length} complete · {active.entries.filter((entry) => entry.status === "pending").length} remaining</p></div><div className="session-progress" aria-label={`${active.currentIndex + 1} of ${active.entries.length}`}><i style={{ width: `${(active.entries.filter((entry) => entry.status !== "pending").length / active.entries.length) * 100}%` }} /></div><div className="session-actions"><button className="primary-button" onClick={onResume}>Resume next item →</button><button className="outline-button" onClick={onSkip}>Skip current</button><button className="outline-button" onClick={onEnd}>End session</button></div><div className="session-preview-list">{active.entries.map((entry, index) => { const item = items.find((candidate) => candidate.itemId === entry.itemId); return <article className={`${entry.status} ${index === active.currentIndex ? "current" : ""}`} key={`${entry.itemId}-${index}`}><span>{entry.status === "completed" ? "✓" : entry.status === "skipped" ? "–" : index + 1}</span><div><strong>{item?.title ?? "Unavailable item"}</strong><small>Stage {entry.stage} · revision {entry.itemRevision}</small></div></article>; })}</div></section>}
    <section className="session-builder"><div className="session-form"><span className="eyebrow">Session builder</span><h2>{active ? "Plan the next set" : "Choose the work"}</h2><label><span>Session name</span><input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label><div className="form-pair"><label><span>Source</span><select value={source} onChange={(event) => setSource(event.target.value as SessionSource)}><option value="mixed">Smart mix · due first</option><option value="due">Due review only</option><option value="new">New items only</option><option value="favorites">Favorites</option><option value="custom">My snippets</option></select></label><label><span>Number of items</span><select value={count} onChange={(event) => setCount(Number(event.target.value))}>{[3, 5, 8, 10, 15, 20].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><div className="form-pair"><label><span>Pattern</span><select value={pattern} onChange={(event) => setPattern(event.target.value)}><option>All</option>{PATTERN_ORDER.map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>All</option><option>Easy</option><option>Medium</option></select></label></div><label><span>Recall policy</span><select value={stageMode} onChange={(event) => setStageMode(event.target.value as SessionStageMode)}><option value="recommended">Recommended next stage</option><option value="recall">Blank editor for every item</option></select></label><button className="primary-button" disabled={!preview.length} onClick={() => onStart({ name, count, source, pattern, difficulty, stageMode }, preview)}>{active ? "Replace active session" : "Start session"} · {preview.length} item{preview.length === 1 ? "" : "s"} →</button></div><div className="session-plan"><div className="section-head"><div><small>Queue preview</small><h2>{preview.length ? `${preview.length} selected` : "No matching items"}</h2></div><span>Stages lock when started</span></div><div className="session-preview-list">{preview.map((entry, index) => { const item = items.find((candidate) => candidate.itemId === entry.itemId); return <article key={`${entry.itemId}-${index}`}><span>{index + 1}</span><div><strong>{item?.title}</strong><small>{item?.pattern} · Stage {entry.stage}</small></div></article>; })}</div>{!preview.length && <p className="session-empty">Broaden the source or filters to create this queue.</p>}</div></section>
    <section className="session-history"><div className="section-head"><div><small>Recent sets</small><h2>Session history</h2></div><span>{state.sessionHistory.length} saved</span></div>{state.sessionHistory.length ? <div>{state.sessionHistory.slice().reverse().map((session) => <article key={session.id}><span><strong>{session.name}</strong><small>{formatDate(session.completedAt)}</small></span><b>{session.completed}/{session.total}</b></article>)}</div> : <p>No finished sessions yet. Your first summary will land here.</p>}</section>
  </main>;
}

function LibraryView({ state, items, onOpen, onFavorite, onCreate, onEdit, onArchive }: { state: AppState; items: PracticeItem[]; onOpen: (item: PracticeItem, stage?: number) => void; onFavorite: (id: ItemId) => void; onCreate: () => void; onEdit: (item: PracticeItem) => void; onArchive: (id: ItemId) => void }) {
  const [query, setQuery] = useState(""); const [pattern, setPattern] = useState<Pattern | "All">("All"); const [difficulty, setDifficulty] = useState<Difficulty | "All">("All"); const [status, setStatus] = useState<"All" | "New" | "Learning" | "Owned" | "Due" | "Favorites" | "My snippets">("All"); const [sort, setSort] = useState<Sort>("recommended");
  const filtered = useMemo(() => items.filter((item) => { const stats = itemStats(state, item.itemId); const text = `${itemDisplayId(item)} ${item.title} ${item.pattern} ${item.cue} ${item.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()); const statusMatch = status === "All" || (status === "New" && !stats.completions) || (status === "Learning" && stats.highestStage > 0 && !stats.owned) || (status === "Owned" && stats.owned) || (status === "Due" && isReviewDue(state, item.itemId)) || (status === "Favorites" && state.favorites.includes(item.itemId)) || (status === "My snippets" && item.source === "custom"); return text && (pattern === "All" || item.pattern === pattern) && (difficulty === "All" || item.difficulty === difficulty) && statusMatch; }).sort((a, b) => sort === "number" ? a.id - b.id : sort === "title" ? a.title.localeCompare(b.title) : sort === "difficulty" ? a.difficulty.localeCompare(b.difficulty) : itemStats(state, a.itemId).highestStage - itemStats(state, b.itemId).highestStage || a.title.localeCompare(b.title)), [items, state, query, pattern, difficulty, status, sort]);
  return <main className="page-container"><div className="heading-actions"><PageHeading eyebrow="Swift interview catalog" title="Choose what to own next." copy="Built-in interview patterns plus your own iOS and Swift snippets, all practiced through the same recall ladder." /><button className="primary-button" onClick={onCreate}>+ Add Swift snippet</button></div><div className="library-toolbar"><label className="search-box wide"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${items.length} items, patterns, or cues`} /></label><select value={pattern} onChange={(event) => setPattern(event.target.value as Pattern | "All")}><option>All</option>{PATTERN_ORDER.map((value) => <option key={value}>{value}</option>)}</select><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty | "All")}><option>All</option><option>Easy</option><option>Medium</option></select><select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="recommended">Recommended</option><option value="number">Problem number</option><option value="title">Title</option><option value="difficulty">Difficulty</option></select></div>
    <div className="filter-chips">{(["All", "New", "Learning", "Owned", "Due", "Favorites", "My snippets"] as const).map((value) => <button className={status === value ? "active" : ""} aria-pressed={status === value} onClick={() => setStatus(value)} key={value}>{value}{value === "Due" && ` (${items.filter((item) => isReviewDue(state, item.itemId)).length})`}</button>)}</div><div className="library-summary"><strong>{filtered.length}</strong> results <span /><small>Ownership requires clean stage-5 recall</small></div>
    <div className="problem-grid">{filtered.map((item) => { const stats = itemStats(state, item.itemId); const due = reviewDueAt(state, item.itemId); return <article className="problem-card" key={item.itemId}><div className="problem-card-top"><span className="problem-number">{itemDisplayId(item)}{item.source === "custom" ? ` · LOCAL R${item.contentRevision}` : ""}</span><div><button onClick={() => onFavorite(item.itemId)} aria-label="Toggle favorite">{state.favorites.includes(item.itemId) ? "★" : "☆"}</button>{item.source === "custom" && <button className="edit-button" onClick={() => onEdit(item)} aria-label="Edit snippet">Edit</button>}{item.source === "custom" && <button className="archive-button" onClick={() => onArchive(item.itemId)} aria-label="Archive snippet">×</button>}</div></div><h2>{item.title}</h2><div className="problem-tags"><span className={`difficulty ${item.difficulty.toLowerCase()}`}>{item.difficulty}</span><span>{item.pattern}</span></div><p>{item.cue}</p><div className="mini-stage-track">{STAGES.map((step) => <i key={step.id} className={step.id <= stats.highestStage ? "complete" : step.id === stats.highestStage + 1 ? "next" : ""} />)}</div><div className="problem-card-meta"><span>{stats.completions ? `${stats.completions} passes · ${stats.bestWpm} eligible best WPM` : `${problemLineCount(item)} lines · ~${item.estimatedMinutes} min`}</span>{due && <span className={isReviewDue(state, item.itemId) ? "due" : ""}>{isReviewDue(state, item.itemId) ? "Due now" : `Review ${formatDay(due)}`}</span>}</div><button className="primary-button" onClick={() => onOpen(item)}>{stats.owned ? "Practice independent recall" : stats.highestStage ? `Continue at stage ${Math.min(5, stats.highestStage + 1)}` : "Start with full ghost"}<span>→</span></button></article>; })}</div>{!filtered.length && <div className="empty-state"><span>⌕</span><h2>No matching items</h2><p>Try a broader filter or add your own Swift snippet.</p></div>}
  </main>;
}

function RecordsView({ state, items, onOpen, onReview }: { state: AppState; items: PracticeItem[]; onOpen: (item: PracticeItem, stage?: number) => void; onReview: () => void }) {
  const attempts = completedAttempts(state); const eligible = attempts.filter(eligibleAttempt); const currentEligible = eligible.filter((attempt) => items.some((item) => item.itemId === attempt.itemId && item.contentRevision === attempt.itemRevision)); const recent = attempts.slice(-14); const avgWpm = currentEligible.length ? Math.round(currentEligible.reduce((sum, attempt) => sum + attempt.wpm, 0) / currentEligible.length) : 0; const avgAccuracy = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.accuracy, 0) / attempts.length) : 0; const owned = items.filter((item) => itemStats(state, item.itemId).owned).length; const due = items.filter((item) => isReviewDue(state, item.itemId)); const maxWpm = Math.max(1, ...recent.map((attempt) => attempt.wpm));
  const patternStats = PATTERN_ORDER.map((pattern) => { const group = BUILTIN_ITEMS.filter((item) => item.pattern === pattern); const points = group.reduce((sum, item) => sum + itemStats(state, item.itemId).highestStage, 0); return { pattern, percent: Math.round((points / (group.length * 5)) * 100), count: group.length }; });
  const bests = currentEligible.reduce<AttemptRecord[]>((records, attempt) => { const existing = records.findIndex((record) => record.itemId === attempt.itemId && record.itemRevision === attempt.itemRevision && record.stage === attempt.stage && record.mode === attempt.mode); if (existing < 0) records.push(attempt); else if (attempt.wpm > records[existing].wpm) records[existing] = attempt; return records; }, []).sort((a, b) => b.wpm - a.wpm).slice(0, 8);
  return <main className="page-container"><PageHeading eyebrow="Private local profile" title="Records you can trust." copy="Personal bests require 95%+ accuracy and no peeks. Assisted and superseded-revision passes stay visible, but never inflate current mastery or records." /><div className="stat-grid"><StatCard label="Completed passes" value={String(attempts.length)} note={`${currentEligible.length} current-revision records`} /><StatCard label="Eligible speed" value={`${avgWpm} WPM`} note={`${avgAccuracy}% average across all passes`} /><StatCard label="Current streak" value={`${activeStreak(state)} days`} note={`${practicedMinutesToday(state)} minutes today`} /><StatCard label="Owned solutions" value={`${owned}/${items.length}`} note="Clean blank-editor recall" /></div>
    <div className="dashboard-grid"><section className="dashboard-card chart-card"><div className="section-head"><div><small>Last 14 completed passes</small><h2>Typing rhythm</h2></div><span>WPM</span></div>{recent.length ? <div className="bar-chart">{recent.map((attempt) => <div className={`bar-column ${eligibleAttempt(attempt) ? "" : "assisted"}`} key={attempt.id} title={`${attempt.wpm} WPM · ${attempt.accuracy}% · ${attempt.qualification}`}><span>{attempt.wpm}</span><i style={{ height: `${Math.max(8, (attempt.wpm / maxWpm) * 100)}%` }} /><small>S{attempt.stage}</small></div>)}</div> : <EmptyChart />}</section><section className="dashboard-card review-card"><div className="section-head"><div><small>Spaced review</small><h2>{due.length ? `${due.length} due now` : "Queue is clear"}</h2></div><span className="review-orbit">↻</span></div><p>Clean passes expand from 1 to 30 days. Peeks, low accuracy, and abandoned attempts return tomorrow and reduce the interval.</p>{due.slice(0, 3).map((item) => <button className="review-row" key={item.itemId} onClick={() => onOpen(item)}><span>{itemDisplayId(item)} {item.title}</span><strong>Stage {recommendedStage(state, item)} →</strong></button>)}<button className="primary-button" disabled={!due.length} onClick={onReview}>{due.length ? "Start due review" : "Nothing due yet"}</button></section></div>
    <section className="dashboard-card milestone-card"><div className="section-head"><div><small>Learning milestones</small><h2>Evidence of durable recall</h2></div><span>{milestones(state).filter((milestone) => milestone.achieved).length}/{milestones(state).length} unlocked</span></div><div className="milestone-grid">{milestones(state).map((milestone) => <article className={milestone.achieved ? "achieved" : ""} key={milestone.id}><span>{milestone.achieved ? "✓" : "○"}</span><div><strong>{milestone.title}</strong><small>{milestone.note}</small></div></article>)}</div></section>
    <section className="dashboard-card mastery-card"><div className="section-head"><div><small>Curriculum coverage</small><h2>Pattern mastery</h2></div><span>{patternStats.filter((pattern) => pattern.percent > 0).length}/{patternStats.length} patterns started</span></div><div className="mastery-grid">{patternStats.map((value) => <div className="mastery-row" key={value.pattern}><span><strong>{value.pattern}</strong><small>{value.count} problems</small></span><div><i style={{ width: `${value.percent}%` }} /></div><b>{value.percent}%</b></div>)}</div></section>
    <section className="dashboard-card records-card"><div className="section-head"><div><small>Qualified only</small><h2>Personal bests</h2></div><span>Exact item · stage · mode</span></div>{bests.length ? <div className="records-grid">{bests.map((attempt) => <article key={attempt.id}><span><small>{attempt.mode} · stage {attempt.stage}</small><strong>{attempt.titleSnapshot}</strong></span><b>{attempt.wpm}<small> WPM</small></b><em>{attempt.accuracy}%</em></article>)}</div> : <div className="empty-history">Complete a 95%+ no-peek pass to set your first personal best.</div>}</section>
    <section className="dashboard-card history-card"><div className="section-head"><div><small>Immutable local log</small><h2>Attempt history</h2></div><span>{state.attempts.length} recorded</span></div><div className="history-table"><div className="history-head"><span>Item</span><span>Stage</span><span>Result</span><span>Speed</span><span>Accuracy</span><span>When</span></div>{state.attempts.slice().reverse().slice(0, 30).map((attempt) => { const found = items.find((item) => item.itemId === attempt.itemId); const superseded = Boolean(found && found.contentRevision !== attempt.itemRevision); return <button className="history-row" key={attempt.id} disabled={!found} title={found ? "Practice this item again" : "This custom snippet is archived"} onClick={() => found && onOpen(found, superseded ? 1 : attempt.stage)}><span><strong>{attempt.titleSnapshot}</strong><small>{found ? `${attempt.qualification} · revision ${attempt.itemRevision}${superseded ? " · superseded" : ""}` : `${attempt.qualification} · archived`}</small></span><span>{STAGES[attempt.stage - 1]?.short}</span><span className={attempt.outcome}>{attempt.outcome}</span><span>{attempt.wpm} WPM</span><span>{attempt.accuracy}%</span><span>{formatDate(attempt.completedAt)}</span></button>; })}</div>{!state.attempts.length && <div className="empty-history">Your first practice pass will appear here.</div>}</section>
  </main>;
}

function SettingsView({ state, onUpdate, onExport, onImport, onReset }: { state: AppState; onUpdate: (patch: Partial<Settings>) => void; onExport: () => void; onImport: () => void; onReset: () => void }) {
  return <main className="page-container settings-page"><PageHeading eyebrow="Make it yours" title="Practice settings." copy="Tune the editor for comfort. Preferences, snippets, and history stay in this browser unless you export them." /><section className="settings-section"><div className="settings-intro"><small>Appearance</small><h2>Color theme</h2><p>Six low-distraction palettes built for long practice sessions.</p></div><div className="theme-grid">{THEMES.map((theme) => <button className={state.settings.theme === theme.id ? "active" : ""} onClick={() => onUpdate({ theme: theme.id })} key={theme.id}><span>{theme.colors.map((color) => <i key={color} style={{ background: color }} />)}</span><strong>{theme.label}</strong>{state.settings.theme === theme.id && <b>✓</b>}</button>)}</div></section><section className="settings-section"><div className="settings-intro"><small>Editor</small><h2>Typing surface</h2><p>Match the rhythm of the editor you use every day.</p></div><div className="setting-list"><SettingRow label="Font family" note="Choose a coding voice."><select value={state.settings.font} onChange={(event) => onUpdate({ font: event.target.value as Settings["font"] })}><option value="mono">Jet Mono</option><option value="rounded">Rounded Mono</option><option value="classic">Classic Mono</option></select></SettingRow><SettingRow label="Font size" note="Editor text size."><div className="stepper"><button onClick={() => onUpdate({ fontSize: Math.max(12, state.settings.fontSize - 1) })}>−</button><span>{state.settings.fontSize}px</span><button onClick={() => onUpdate({ fontSize: Math.min(24, state.settings.fontSize + 1) })}>+</button></div></SettingRow><SettingRow label="Indentation" note="Spaces inserted by Tab."><Segmented value={String(state.settings.tabSize)} options={["2", "4"]} onChange={(value) => onUpdate({ tabSize: Number(value) as 2 | 4 })} /></SettingRow><SettingRow label="Editor height" note="Visible lines before scrolling."><Segmented value={String(state.settings.editorLines)} options={["12", "16", "20"]} onChange={(value) => onUpdate({ editorLines: Number(value) as 12 | 16 | 20 })} /></SettingRow></div></section><section className="settings-section"><div className="settings-intro"><small>Behavior</small><h2>Practice rules</h2><p>Strict mode is ideal while rebuilding muscle memory.</p></div><div className="setting-list"><ToggleRow label="Strict correction" note="Reject incorrect characters immediately." checked={state.settings.strictMode} onChange={(checked) => onUpdate({ strictMode: checked })} /><ToggleRow label="Live WPM" note="Show speed during the attempt." checked={state.settings.showLiveWpm} onChange={(checked) => onUpdate({ showLiveWpm: checked })} /><ToggleRow label="Keyboard guide" note="Show a friction heatmap below the editor." checked={state.settings.showKeyboard} onChange={(checked) => onUpdate({ showKeyboard: checked })} /><SettingRow label="Daily practice goal" note="Minutes practiced before the ring closes."><div className="stepper"><button onClick={() => onUpdate({ dailyGoalMinutes: Math.max(5, state.settings.dailyGoalMinutes - 5) })}>−</button><span>{state.settings.dailyGoalMinutes} min</span><button onClick={() => onUpdate({ dailyGoalMinutes: Math.min(120, state.settings.dailyGoalMinutes + 5) })}>+</button></div></SettingRow></div></section><section className="settings-section"><div className="settings-intro"><small>Your data</small><h2>Local profile</h2><p>Export a portable v4 JSON backup with sessions and revisioned custom snippets, or restore a v2/v3 backup.</p></div><div className="data-actions"><button className="outline-button" onClick={onExport}>Export progress</button><button className="outline-button" onClick={onImport}>Import backup</button><button className="danger-button" onClick={onReset}>Clear local data</button></div></section></main>;
}

function CustomSnippetDialog({ item, onClose, onSave }: { item?: PracticeItem; onClose: () => void; onSave: (input: Parameters<typeof makeCustomItem>[0]) => void }) {
  const [title, setTitle] = useState(item?.title ?? ""); const [pattern, setPattern] = useState<Pattern>(item?.pattern ?? PATTERN_ORDER[0]); const [difficulty, setDifficulty] = useState<"Easy" | "Medium">(item?.difficulty ?? "Easy"); const [code, setCode] = useState(item?.code ?? "func example() {\n    // Type your Swift implementation here\n}"); const [cue, setCue] = useState(item?.cue ?? ""); const [invariant, setInvariant] = useState(item?.invariant ?? ""); const [complexity, setComplexity] = useState(item?.complexity ?? ""); const [swiftNote, setSwiftNote] = useState(item?.swiftNote ?? ""); const valid = title.trim().length >= 1 && title.trim().length <= 80 && code.trim().length >= 10 && code.length <= 20000;
  const dialogRef = useRef<HTMLElement>(null); useModalKeyboard(onClose, dialogRef);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="custom-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-title"><button className="dialog-close" onClick={onClose} aria-label="Close">×</button><span className="eyebrow">Device-local curriculum{item ? ` · revision ${item.contentRevision}` : ""}</span><h2 id="custom-title">{item ? "Edit Swift snippet" : "Add a Swift snippet"}</h2><p>{item ? "Metadata edits preserve mastery. Changing code creates a new revision while keeping the complete attempt history." : "Turn an iOS pattern, API example, or interview solution into the same progressive recall exercise."}</p><div className="custom-form"><label><span>Title</span><input data-modal-autofocus maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Debounced async search" /></label><div className="form-pair"><label><span>Pattern</span><select value={pattern} onChange={(event) => setPattern(event.target.value as Pattern)}>{PATTERN_ORDER.map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value as "Easy" | "Medium")}><option>Easy</option><option>Medium</option></select></label></div><label><span>Swift code</span><textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} /></label><label><span>Pattern cue</span><input value={cue} onChange={(event) => setCue(event.target.value)} placeholder="What should you recognize before coding?" /></label><label><span>Invariant</span><input value={invariant} onChange={(event) => setInvariant(event.target.value)} placeholder="What must remain true?" /></label><div className="form-pair"><label><span>Complexity</span><input value={complexity} onChange={(event) => setComplexity(event.target.value)} placeholder="O(n) time · O(1) space" /></label><label><span>Swift note</span><input value={swiftNote} onChange={(event) => setSwiftNote(event.target.value)} placeholder="Syntax or API detail to remember" /></label></div></div><div className="result-actions"><button className="outline-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!valid} onClick={() => onSave({ title, pattern, difficulty, code, cue, invariant, complexity, swiftNote })}>{item ? "Save changes" : "Save and practice"} →</button></div></section></div>;
}

function ResultDialog({ result, onClose, onNext, onRandom }: { result: Result; onClose: () => void; onNext: () => void; onRandom: () => void }) {
  const eligible = eligibleAttempt(result); const isBest = eligible && (!result.previousBest || result.wpm > result.previousBest.wpm); const delta = result.previousBest ? result.wpm - result.previousBest.wpm : null;
  const dialogRef = useRef<HTMLElement>(null); useModalKeyboard(onClose, dialogRef);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="result-dialog" role="dialog" aria-modal="true" aria-labelledby="result-title"><button className="dialog-close" onClick={onClose} aria-label="Close">×</button><div className={`result-mark ${eligible ? "" : "assisted"}`}>{eligible ? "✓" : "~"}</div><span className="eyebrow">Pass complete · Stage {result.stage}</span><h2 id="result-title">{result.item.title}</h2><p>{result.sessionComplete ? "That was the final item in this session. Your set is saved in session history." : eligible ? result.qualification === "independent" ? "Independent recall verified. This solution now counts as owned." : "Clean pass recorded. Keep climbing toward blank-editor recall." : result.peeks ? "Assisted pass recorded. Because you peeked, it does not advance mastery or personal records." : "Practice saved, but 95% accuracy is required for mastery and personal records."}</p><div className="result-stats"><span><small>WPM</small><strong>{result.wpm}</strong></span><span><small>Accuracy</small><strong>{result.accuracy}%</strong></span><span><small>Time</small><strong>{formatDuration(result.durationMs)}</strong></span><span><small>Record</small><strong>{isBest ? "New PB" : delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta}`}</strong></span></div>{result.nextReview && <div className="result-review"><span>Next review</span><strong>{formatDay(result.nextReview)}</strong><small>{eligible ? "Interval advanced" : "Returns tomorrow"}</small></div>}<div className="result-actions"><button className="outline-button" onClick={onRandom}>Different problem</button><button className="primary-button" onClick={onNext}>{result.sessionNext ? "Next in session →" : result.sessionComplete ? "View session summary →" : result.stage < 5 ? "Climb to next stage →" : "Practice recall again →"}</button></div></section></div>;
}

function PageHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <header className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></header>; }
function StatCard({ label, value, note }: { label: string; value: string; note: string }) { return <article className="stat-card"><small>{label}</small><strong>{value}</strong><span>{note}</span></article>; }
function EmptyChart() { return <div className="empty-chart"><span>⌨</span><strong>No completed passes yet</strong><small>Finish one practice stage to start your rhythm chart.</small></div>; }
function KeyboardGuide({ errors }: { errors: Record<string, number> }) { const rows = ["1234567890", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]; const max = Math.max(1, ...Object.values(errors)); return <section className="keyboard-guide"><div><small>Key friction</small><strong>Rejected-key heatmap</strong></div><div className="keyboard-rows">{rows.map((row) => <div key={row}>{row.split("").map((key) => { const count = errors[key] ?? errors[key.toLowerCase()] ?? 0; return <span key={key} className={count ? "hot" : ""} style={{ "--heat": String(count / max) } as React.CSSProperties}>{key}<small>{count || ""}</small></span>; })}</div>)}<div><span className="space-key">space<small>{errors.space || ""}</small></span></div></div></section>; }
function SettingRow({ label, note, children }: { label: string; note: string; children: React.ReactNode }) { return <div className="setting-row"><span><strong>{label}</strong><small>{note}</small></span>{children}</div>; }
function ToggleRow({ label, note, checked, onChange }: { label: string; note: string; checked: boolean; onChange: (checked: boolean) => void }) { return <SettingRow label={label} note={note}><button role="switch" aria-label={label} aria-checked={checked} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i /></button></SettingRow>; }
function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { return <div className="segmented">{options.map((option) => <button className={value === option ? "active" : ""} aria-pressed={value === option} onClick={() => onChange(option)} key={option}>{option}</button>)}</div>; }
