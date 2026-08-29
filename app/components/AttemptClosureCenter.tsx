"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ATTEMPT_CLOSURE_LIMITS,
  ATTEMPT_CLOSURE_MISTAKE_TAGS,
  attemptClosureCompletionIssues,
  type AttemptClosureGrade,
  type AttemptClosureModel,
  type AttemptClosureRecord,
  type AttemptClosureStatus,
  type AttemptClosureWorkspace,
  type DerivedAttemptClosure,
} from "../lib/attempt-closures.mjs";
import { canSolveItem, type PracticeItem } from "../lib/items";

export type AttemptClosureDraftInput = Pick<
  AttemptClosureRecord,
  | "mistakeTags"
  | "firstWrongDecision"
  | "verificationNotes"
  | "teachBack"
  | "grade"
>;

export type AttemptClosureCenterProps = {
  workspace: AttemptClosureWorkspace;
  model: AttemptClosureModel;
  items: readonly PracticeItem[];
  selectedId?: string;
  onSelect: (id?: string) => void;
  onSave: (
    id: string,
    input: AttemptClosureDraftInput,
    expectedUpdatedAt: string,
  ) => boolean;
  onComplete: (id: string, expectedUpdatedAt: string) => boolean;
  onRetry: (id: string) => void;
};

type ClosureFilter = "all" | AttemptClosureStatus;
type LocalDraft = {
  recordId: string;
  baseUpdatedAt: string;
  input: AttemptClosureDraftInput;
};

const STATUS_LABELS: Record<AttemptClosureStatus, string> = {
  open: "Open",
  due: "Retry due",
  resolved: "Resolved",
  retired: "Retired",
};

const FILTERS: ReadonlyArray<{ id: ClosureFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "due", label: "Due" },
  { id: "resolved", label: "Resolved" },
  { id: "retired", label: "Retired" },
];

const TAG_LABELS: Record<string, string> = {
  "syntax-fluency": "Syntax fluency",
  "missed-cue": "Missed cue",
  "wrong-invariant": "Wrong invariant",
  "data-structure": "Data structure",
  complexity: "Complexity",
  boundary: "Boundary case",
  implementation: "Implementation",
  verification: "Verification",
  communication: "Communication",
  overfit: "Overfit to examples",
  api: "API knowledge",
};

const GRADE_OPTIONS: ReadonlyArray<{
  id: AttemptClosureGrade;
  label: string;
  note: string;
}> = [
  { id: "again", label: "Again", note: "I cannot yet explain the correction." },
  { id: "hard", label: "Hard", note: "I found the correction with substantial effort." },
  { id: "good", label: "Good", note: "I can explain the correction clearly." },
  { id: "easy", label: "Easy", note: "The correction is immediate and precise." },
];

function draftInput(record: AttemptClosureRecord): AttemptClosureDraftInput {
  return {
    mistakeTags: [...record.mistakeTags],
    firstWrongDecision: record.firstWrongDecision,
    verificationNotes: record.verificationNotes,
    teachBack: record.teachBack,
    grade: record.grade,
  };
}

function formatDate(value?: string | null) {
  const timestamp = Date.parse(value ?? "");
  if (!Number.isFinite(timestamp)) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function retryLabel(record: DerivedAttemptClosure, generatedAt: string) {
  if (!record.retryDueAt) return "No retry scheduled";
  const due = Date.parse(record.retryDueAt);
  const now = Date.parse(generatedAt);
  if (!Number.isFinite(due) || !Number.isFinite(now))
    return `Retry ${formatDate(record.retryDueAt)}`;
  if (due <= now) return "Retry is due now";
  const days = Math.max(1, Math.ceil((due - now) / 86_400_000));
  return days === 1 ? "Retry due within a day" : `Retry due in ${days} days`;
}

function laneLabel(record: DerivedAttemptClosure) {
  if (record.anchor.lane === "ios") return "iOS / Swift concept";
  return record.anchor.lane === "swift" ? "Swift interview" : "Python interview";
}

function humanize(value: string) {
  return value.replaceAll("-", " ");
}

export function AttemptClosureCenter({
  workspace,
  model,
  items,
  selectedId,
  onSelect,
  onSave,
  onComplete,
  onRetry,
}: AttemptClosureCenterProps) {
  const [filter, setFilter] = useState<ClosureFilter>("all");
  const [localDraft, setLocalDraft] = useState<LocalDraft | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const hadSelectionRef = useRef(false);
  const selected = selectedId
    ? model.records.find((record) => record.id === selectedId) ?? null
    : null;
  const visibleRecords = useMemo(
    () =>
      filter === "all"
        ? model.records
        : model.records.filter((record) => record.status === filter),
    [filter, model.records],
  );
  const item = selected
    ? items.find((candidate) => candidate.itemId === selected.anchor.itemId)
    : undefined;
  const form = selected &&
      localDraft?.recordId === selected.id &&
      localDraft.baseUpdatedAt === selected.updatedAt
    ? localDraft.input
    : selected
      ? draftInput(selected)
      : {
          mistakeTags: [],
          firstWrongDecision: "",
          verificationNotes: "",
          teachBack: "",
          grade: undefined,
        };
  const selectedRecordId = selected?.id;
  const immutable = selected?.state === "completed";
  const retryAvailable = Boolean(
    selected &&
      item &&
      canSolveItem(item) &&
      selected.state === "completed" &&
      selected.currentRevision &&
      selected.status === "due",
  );
  const draftCompletionIssues = selected
    ? attemptClosureCompletionIssues({ ...selected, ...form })
    : ["no-selection"];
  const persistedCompletionIssues = selected
    ? attemptClosureCompletionIssues(selected)
    : ["no-selection"];
  const isDirty = Boolean(
    selected && JSON.stringify(draftInput(selected)) !== JSON.stringify(form),
  );

  useEffect(() => {
    const hadSelection = hadSelectionRef.current;
    hadSelectionRef.current = Boolean(selectedRecordId);
    const target = selectedRecordId
      ? detailHeadingRef.current
      : hadSelection
        ? listHeadingRef.current
        : null;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => target.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [selectedRecordId]);

  function changeForm(
    update: (current: AttemptClosureDraftInput) => AttemptClosureDraftInput,
  ) {
    if (!selected) return;
    setLocalDraft({
      recordId: selected.id,
      baseUpdatedAt: selected.updatedAt,
      input: update(form),
    });
  }

  function toggleMistakeTag(tag: string) {
    if (immutable) return;
    changeForm((current) => {
      const selectedTags = current.mistakeTags;
      if (selectedTags.includes(tag as (typeof selectedTags)[number])) {
        return {
          ...current,
          mistakeTags: selectedTags.filter((candidate) => candidate !== tag),
        };
      }
      if (selectedTags.length >= ATTEMPT_CLOSURE_LIMITS.maxTags) return current;
      return {
        ...current,
        mistakeTags: [...selectedTags, tag] as AttemptClosureDraftInput["mistakeTags"],
      };
    });
  }

  function updateText(
    field: "firstWrongDecision" | "verificationNotes" | "teachBack",
    value: string,
  ) {
    changeForm((current) => ({
      ...current,
      [field]: Array.from(value).slice(0, ATTEMPT_CLOSURE_LIMITS.maxTextChars).join(""),
    }));
  }

  function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selected ||
      immutable ||
      isDirty ||
      persistedCompletionIssues.length
    )
      return;
    onComplete(selected.id, selected.updatedAt);
  }

  return (
    <section className="attempt-closure-center" aria-labelledby="attempt-closure-title">
      <header className="attempt-closure-hero">
        <div>
          <small>Attempt closure center</small>
          <h2 id="attempt-closure-title">Turn failed work into a precise next attempt.</h2>
          <p>
            Preserve the exact failure or abandonment, name the first wrong decision,
            and schedule a clean retry without rewriting history.
          </p>
        </div>
        <aside className="attempt-closure-trust">
          <strong>Remediation, not mastery</strong>
          <p>
            Reflection and remediation do not count as a solve or mastery. A closure
            resolves only after separate, current-revision, hint-free accepted evidence.
          </p>
          <small>Private local workspace · revision {workspace.revision}</small>
        </aside>
      </header>

      <div className="attempt-closure-summary" aria-label="Attempt closure summary">
        <div><strong>{model.summary.open}</strong><span>open</span></div>
        <div><strong>{model.summary.due}</strong><span>retry due</span></div>
        <div><strong>{model.summary.resolved}</strong><span>resolved</span></div>
        <div><strong>{model.summary.retired}</strong><span>retired</span></div>
      </div>

      <div className="attempt-closure-toolbar">
        <div role="group" aria-label="Filter attempt closures by status">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              className={filter === option.id ? "is-active" : undefined}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p aria-live="polite">{visibleRecords.length} closure{visibleRecords.length === 1 ? "" : "s"} shown</p>
      </div>

      <div className={`attempt-closure-layout${selected ? " has-selection" : ""}`}>
        <section className="attempt-closure-list-panel" aria-labelledby="attempt-closure-list-title">
          <div className="attempt-closure-panel-heading">
            <div>
              <small>Immutable anchors</small>
              <h3 id="attempt-closure-list-title" ref={listHeadingRef} tabIndex={-1}>
                Failure and abandonment records
              </h3>
            </div>
          </div>
          {visibleRecords.length ? (
            <ul className="attempt-closure-list">
              {visibleRecords.map((record) => {
                const active = record.id === selected?.id;
                return (
                  <li key={record.id}>
                    <button
                      type="button"
                      className={active ? "is-active" : undefined}
                      aria-current={active ? "true" : undefined}
                      onClick={() => onSelect(record.id)}
                    >
                      <span className="attempt-closure-list-topline">
                        <strong>{record.titleSnapshot}</strong>
                        <span data-status={record.status}>{STATUS_LABELS[record.status]}</span>
                      </span>
                      <span>{laneLabel(record)} · {humanize(record.anchor.outcome)}</span>
                      <small>
                        {record.state === "draft" ? "Reflection draft" : retryLabel(record, model.generatedAt)}
                      </small>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="attempt-closure-empty">
              <strong>No closures match this status.</strong>
              <p>Choose another filter to inspect surviving remediation evidence.</p>
              <button type="button" className="outline-button" onClick={() => setFilter("all")}>
                Show all closures
              </button>
            </div>
          )}
        </section>

        {selected ? (
          <article className="attempt-closure-detail" aria-labelledby="attempt-closure-detail-title">
            <button className="attempt-closure-back" type="button" onClick={() => onSelect()}>
              ← All closure records
            </button>
            <header className="attempt-closure-detail-heading">
              <div>
                <small>{laneLabel(selected)} · item revision {selected.anchor.itemRevision}</small>
                <h3 id="attempt-closure-detail-title" ref={detailHeadingRef} tabIndex={-1}>
                  {selected.titleSnapshot}
                </h3>
                <p>{retryLabel(selected, model.generatedAt)}</p>
              </div>
              <span data-status={selected.status}>{STATUS_LABELS[selected.status]}</span>
            </header>

            <section className="attempt-closure-anchor" aria-labelledby="attempt-closure-anchor-title">
              <div className="attempt-closure-panel-heading">
                <div>
                  <small>Read-only evidence</small>
                  <h4 id="attempt-closure-anchor-title">Original attempt anchor</h4>
                </div>
                <span>{selected.anchor.kind === "submission" ? "Failed submission" : "Abandoned solve"}</span>
              </div>
              <dl>
                <div><dt>Outcome</dt><dd>{humanize(selected.anchor.outcome)}</dd></div>
                <div><dt>Occurred</dt><dd><time dateTime={selected.anchor.occurredAt}>{formatDate(selected.anchor.occurredAt)}</time></dd></div>
                <div><dt>Assistance</dt><dd>{humanize(selected.anchor.assistance)}</dd></div>
                <div><dt>Evidence ID</dt><dd><code>{selected.anchor.id}</code></dd></div>
              </dl>
              <p>
                This anchor is immutable. Completing the reflection cannot change its outcome,
                assistance, revision, or timestamp.
              </p>
            </section>

            <form className="attempt-closure-form" onSubmit={complete}>
              <fieldset className="attempt-closure-tags" disabled={immutable}>
                <legend>Mistake tags <span>Choose up to {ATTEMPT_CLOSURE_LIMITS.maxTags}</span></legend>
                <div>
                  {ATTEMPT_CLOSURE_MISTAKE_TAGS.map((tag) => {
                    const checked = form.mistakeTags.includes(tag);
                    const capped = !checked && form.mistakeTags.length >= ATTEMPT_CLOSURE_LIMITS.maxTags;
                    return (
                      <label key={tag}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={immutable || capped}
                          onChange={() => toggleMistakeTag(tag)}
                        />
                        <span>{TAG_LABELS[tag] ?? humanize(tag)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="attempt-closure-field">
                <span>First wrong decision</span>
                <small>Identify the earliest choice that made the failure likely.</small>
                <textarea
                  value={form.firstWrongDecision}
                  readOnly={immutable}
                  required={!immutable}
                  minLength={8}
                  maxLength={ATTEMPT_CLOSURE_LIMITS.maxTextChars}
                  onChange={(event) => updateText("firstWrongDecision", event.target.value)}
                />
              </label>

              <label className="attempt-closure-field">
                <span>Verification notes</span>
                <small>Record the edge case, trace, or check that would have exposed it.</small>
                <textarea
                  value={form.verificationNotes}
                  readOnly={immutable}
                  required={!immutable}
                  minLength={8}
                  maxLength={ATTEMPT_CLOSURE_LIMITS.maxTextChars}
                  onChange={(event) => updateText("verificationNotes", event.target.value)}
                />
              </label>

              <label className="attempt-closure-field">
                <span>Teach-back</span>
                <small>Explain the corrected decision in language you can retrieve tomorrow.</small>
                <textarea
                  value={form.teachBack}
                  readOnly={immutable}
                  required={!immutable}
                  minLength={8}
                  maxLength={ATTEMPT_CLOSURE_LIMITS.maxTextChars}
                  onChange={(event) => updateText("teachBack", event.target.value)}
                />
              </label>

              <fieldset className="attempt-closure-grades" disabled={immutable}>
                <legend>Retrieval grade</legend>
                <div role="radiogroup" aria-label="Attempt closure retrieval grade">
                  {GRADE_OPTIONS.map((option) => (
                    <label key={option.id} className={form.grade === option.id ? "is-selected" : undefined}>
                      <input
                        type="radio"
                        name={`attempt-closure-grade-${selected.id}`}
                        value={option.id}
                        checked={form.grade === option.id}
                        onChange={() => changeForm((current) => ({ ...current, grade: option.id }))}
                      />
                      <strong>{option.label}</strong>
                      <small>{option.note}</small>
                    </label>
                  ))}
                </div>
              </fieldset>

              {immutable ? (
                <div className="attempt-closure-immutable" role="status">
                  <strong>Closure completed {formatDate(selected.completedAt)}</strong>
                  <p>
                    This reflection is immutable. It remains remediation-only evidence and does
                    not count as a solve or mastery.
                  </p>
                </div>
              ) : (
                <div className="attempt-closure-form-actions">
                  <p aria-live="polite">
                    {draftCompletionIssues.length
                      ? `${draftCompletionIssues.length} required ${draftCompletionIssues.length === 1 ? "field remains" : "fields remain"}.`
                      : isDirty
                        ? "Save this complete draft before closing the record."
                        : "Ready to complete. A separate clean retry is still required."}
                  </p>
                  <button
                    type="button"
                    className="outline-button"
                    disabled={!isDirty}
                    onClick={() => onSave(selected.id, form, selected.updatedAt)}
                  >
                    Save draft
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      isDirty ||
                      persistedCompletionIssues.length > 0
                    }
                  >
                    Complete closure
                  </button>
                </div>
              )}
            </form>

            <section className="attempt-closure-retry" aria-labelledby="attempt-closure-retry-title">
              <div>
                <small>Separate evidence gate</small>
                <h4 id="attempt-closure-retry-title">
                  {selected.status === "resolved" ? "Clean retry verified" : retryLabel(selected, model.generatedAt)}
                </h4>
                <p>
                  Only a later current-revision, hint-free accepted attempt with its exact receipt
                  can resolve this closure.
                </p>
              </div>
              {retryAvailable ? (
                <button type="button" className="primary-button" onClick={() => onRetry(selected.id)}>
                  Start clean retry →
                </button>
              ) : selected.status === "resolved" && selected.resolution ? (
                <dl>
                  <div><dt>Resolved</dt><dd>{formatDate(selected.resolvedAt)}</dd></div>
                  <div><dt>Attempt</dt><dd><code>{selected.resolutionAttemptId}</code></dd></div>
                  <div><dt>Submission</dt><dd><code>{selected.resolutionSubmissionId}</code></dd></div>
                </dl>
              ) : selected.status === "retired" ? (
                <strong>Retry unavailable for a retired item revision.</strong>
              ) : selected.state === "completed" && selected.status === "open" ? (
                <strong>The clean retry unlocks when the next-day gate is due.</strong>
              ) : selected.state === "completed" && item && !canSolveItem(item) ? (
                <strong>No runnable retry lane is available for this closure.</strong>
              ) : (
                <strong>Complete the closure before starting its clean retry.</strong>
              )}
            </section>
          </article>
        ) : (
          <aside className="attempt-closure-detail-empty">
            <span aria-hidden="true">↺</span>
            <h3>Select a closure record</h3>
            <p>
              Inspect the immutable failure anchor, finish the remediation draft, and see whether
              a separate clean retry is open, due, resolved, or retired.
            </p>
          </aside>
        )}
      </div>
    </section>
  );
}
