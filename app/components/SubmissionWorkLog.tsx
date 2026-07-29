"use client";

import {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildSubmissionDiff } from "../lib/submission-diff.mjs";
import {
  deriveSubmissionWorkLog,
  normalizeSubmissionWorkLogQuery,
  type SubmissionWorkLogQuery,
} from "../lib/submission-work-log.mjs";
import {
  resolveSubmissionSource,
  type SubmissionLog,
  type SubmissionReceipt,
} from "../lib/submission-log.mjs";
import {
  SUBMISSION_ANNOTATION_TAGS,
  type SubmissionAnnotation,
  type SubmissionAnnotationTag,
} from "../lib/submission-annotations.mjs";
import type { PracticeItem } from "../lib/items";

const STATUS_LABELS: Record<string, string> = {
  pending: "Judging",
  accepted: "Accepted",
  "wrong-answer": "Wrong answer",
  "runtime-error": "Runtime error",
  "time-limit": "Time limit exceeded",
  "invalid-entrypoint": "Invalid entrypoint",
  "judge-error": "Judge interrupted",
};

const CONTEXT_LABELS: Record<string, string> = {
  practice: "Practice",
  transfer: "Transfer Lab",
  assessment: "Assessment",
  mock: "Mock interview",
  studio: "Interview Studio",
  round: "Virtual round",
};

const TAG_LABELS: Record<SubmissionAnnotationTag, string> = {
  "off-by-one": "Off by one",
  syntax: "Syntax",
  "edge-case": "Edge case",
  complexity: "Complexity",
  review: "Review",
  clean: "Clean pass",
};

type DetailView = "source" | "changes";

export type SubmissionWorkLogProps = {
  log: SubmissionLog;
  annotations: Readonly<Record<string, SubmissionAnnotation>>;
  items: readonly PracticeItem[];
  query: SubmissionWorkLogQuery;
  now: number;
  onQueryChange: (
    query: SubmissionWorkLogQuery,
    history: "push" | "replace",
  ) => void;
  onSaveAnnotation: (
    submissionId: string,
    annotation: Pick<SubmissionAnnotation, "note" | "tags">,
  ) => void;
  onOpenClean: (item: PracticeItem) => void;
  onContinueAssisted: (
    receipt: SubmissionReceipt,
    item: PracticeItem,
    source: string,
  ) => void;
  reviewAttemptIdsBySubmission: Readonly<Record<string, string>>;
  closureIdsBySubmission: Readonly<Record<string, string>>;
  onOpenAttemptClosure: (closureId: string) => void;
  onOpenSolutionReview: (attemptId: string) => void;
};

function timestampValue(value: string | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTimestamp(value: string | undefined) {
  const parsed = timestampValue(value);
  if (!parsed) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function statusFor(receipt: SubmissionReceipt) {
  return receipt.lifecycle === "pending" ? "pending" : receipt.status;
}

function statusLabel(receipt: SubmissionReceipt) {
  return STATUS_LABELS[statusFor(receipt) ?? "judge-error"] ?? "Unknown";
}

function contextLabel(receipt: SubmissionReceipt) {
  return CONTEXT_LABELS[receipt.context.kind] ?? "Local practice";
}

function selectValue(values: readonly string[]) {
  return values[0] ?? "all";
}

function arrayValue(value: string) {
  return value === "all" ? [] : [value];
}

function DiffRows({
  earlier,
  selected,
}: {
  earlier: string;
  selected: string;
}) {
  const diff = useMemo(
    () => buildSubmissionDiff(earlier, selected),
    [earlier, selected],
  );
  if (diff.identical)
    return <p className="submission-work-log-note">The two saved sources are identical.</p>;
  return (
    <div className="submission-work-log-diff-wrap">
      <p className="submission-work-log-note">
        {diff.summary.removed} removed · {diff.summary.added} added ·{" "}
        {diff.summary.unchanged} unchanged. Earlier is on the left; selected is on the right.
      </p>
      <div className="submission-inspector-diff" role="table" aria-label="Difference between two saved submissions">
        <div className="submission-inspector-diff-header" role="row">
          <span role="columnheader">Earlier</span>
          <span role="columnheader">Selected</span>
          <span role="columnheader">Source</span>
        </div>
        {diff.rows.map((row, index) =>
          row.type === "omitted" ? (
            <div className="submission-inspector-diff-row is-omitted" role="row" key={`omitted-${index}`}>
              <span role="cell" />
              <span role="cell" />
              <code role="cell">… {row.text} …</code>
            </div>
          ) : (
            <div className={`submission-inspector-diff-row is-${row.type}`} role="row" key={`${row.type}-${index}`}>
              <span role="cell">{row.submittedLine ?? ""}</span>
              <span role="cell">{row.currentLine ?? ""}</span>
              <code role="cell">{row.type === "remove" ? "− " : row.type === "add" ? "+ " : "  "}{row.text || " "}</code>
            </div>
          ),
        )}
      </div>
      {diff.truncated ? (
        <p className="submission-work-log-note">This large comparison is summarized. Both exact sources remain available separately.</p>
      ) : null}
    </div>
  );
}

export function SubmissionWorkLog({
  log,
  annotations,
  items,
  query,
  now,
  onQueryChange,
  onSaveAnnotation,
  onOpenClean,
  onContinueAssisted,
  reviewAttemptIdsBySubmission,
  closureIdsBySubmission,
  onOpenAttemptClosure,
  onOpenSolutionReview,
}: SubmissionWorkLogProps) {
  const [detailView, setDetailView] = useState<DetailView>("source");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<SubmissionAnnotationTag[]>([]);
  const [copied, setCopied] = useState(false);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const sourceTabRef = useRef<HTMLButtonElement>(null);
  const changesTabRef = useRef<HTMLButtonElement>(null);
  const derived = useMemo(
    () => deriveSubmissionWorkLog({ submissions: log.receipts, items, query, now }),
    [items, log.receipts, now, query],
  );
  const selected = query.selectedId
    ? log.receipts.find((receipt) => receipt.id === query.selectedId) ?? null
    : null;
  const selectedItem = selected
    ? items.find((item) => item.itemId === selected.itemId) ?? null
    : null;
  const selectedSource = selected ? resolveSubmissionSource(log, selected.id) : null;
  const comparisons = useMemo(
    () =>
      selected
        ? log.receipts
            .filter(
              (candidate) =>
                candidate.id !== selected.id &&
                candidate.itemId === selected.itemId &&
                candidate.lifecycle === "settled" &&
                Boolean(resolveSubmissionSource(log, candidate.id)),
            )
            .sort((left, right) => timestampValue(right.requestedAt) - timestampValue(left.requestedAt))
        : [],
    [log, selected],
  );
  const compared =
    comparisons.find((candidate) => candidate.id === query.compareId) ??
    comparisons.find(
      (candidate) => timestampValue(candidate.requestedAt) < timestampValue(selected?.requestedAt),
    ) ??
    comparisons[0] ??
    null;
  const comparedSource = compared ? resolveSubmissionSource(log, compared.id) : null;
  const selectedAnnotation = selected ? annotations[selected.id] : undefined;
  const editingKey = `${selected?.id ?? ""}:${selectedAnnotation?.updatedAt ?? ""}`;
  const [activeEditingKey, setActiveEditingKey] = useState(editingKey);

  if (activeEditingKey !== editingKey) {
    setActiveEditingKey(editingKey);
    setNote(selectedAnnotation?.note ?? "");
    setTags(selectedAnnotation?.tags ? [...selectedAnnotation.tags] : []);
    setDetailView("source");
    setCopied(false);
  }

  useEffect(() => {
    if (!selected) return;
    window.requestAnimationFrame(() => detailHeadingRef.current?.focus());
  }, [selected]);

  function update(
    patch: Partial<SubmissionWorkLogQuery>,
    history: "push" | "replace" = "replace",
  ) {
    onQueryChange(
      normalizeSubmissionWorkLogQuery({ ...query, ...patch }),
      history,
    );
  }

  function updateFilter(patch: Partial<SubmissionWorkLogQuery>) {
    update({ ...patch, page: 1, selectedId: undefined, compareId: undefined });
  }

  function selectReceipt(receipt: SubmissionReceipt) {
    update({ selectedId: receipt.id, compareId: undefined }, "push");
  }

  function handleDetailTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: DetailView =
      event.key === "Home" || event.key === "ArrowLeft" ? "source" : "changes";
    setDetailView(next);
    (next === "source" ? sourceTabRef : changesTabRef).current?.focus();
  }

  async function copySource() {
    if (!selectedSource) return;
    try {
      await navigator.clipboard.writeText(selectedSource);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="submission-work-log" aria-labelledby="submission-work-log-title">
      <div className="submission-work-log-hero">
        <div>
          <small>Device-local judge evidence</small>
          <h2 id="submission-work-log-title">Submission work log</h2>
          <p>Find the exact work you submitted, compare revisions, annotate mistakes, and choose a clean or explicitly assisted retry.</p>
        </div>
        <p className="submission-work-log-trust">Receipts are local to this browser. Verdicts reflect the bundled judge at that time—not peer rank, certification, or interview readiness.</p>
      </div>

      <div className="submission-work-log-stats" aria-label="Submission summary">
        <span><strong>{derived.counts.all}</strong><small>receipts</small></span>
        <span><strong>{derived.counts.accepted}</strong><small>accepted</small></span>
        <span><strong>{derived.counts.nonAccepted}</strong><small>not accepted</small></span>
        <span><strong>{derived.counts.uniqueProblems}</strong><small>problems</small></span>
      </div>

      <div className="submission-work-log-filters">
        <label className="submission-work-log-search">
          <span>Search problems</span>
          <input value={query.text} onChange={(event) => updateFilter({ text: event.target.value })} placeholder="Title, ID, pattern, tag" />
        </label>
        <label><span>Verdict</span><select value={selectValue(query.statuses)} onChange={(event) => updateFilter({ statuses: arrayValue(event.target.value) as SubmissionWorkLogQuery["statuses"] })}>
          <option value="all">All verdicts</option><option value="pending">Judging</option><option value="accepted">Accepted</option><option value="wrong-answer">Wrong answer</option><option value="runtime-error">Runtime error</option><option value="time-limit">Time limit</option><option value="invalid-entrypoint">Invalid entrypoint</option><option value="judge-error">Judge interrupted</option>
        </select></label>
        <label><span>Context</span><select value={selectValue(query.origins)} onChange={(event) => updateFilter({ origins: arrayValue(event.target.value) as SubmissionWorkLogQuery["origins"] })}>
          <option value="all">All contexts</option><option value="practice">Practice</option><option value="transfer">Transfer Lab</option><option value="assessment">Assessment</option><option value="mock">Mock interview</option><option value="studio">Interview Studio</option><option value="round">Virtual round</option>
        </select></label>
        <label><span>Language</span><select value={selectValue(query.languages)} onChange={(event) => updateFilter({ languages: arrayValue(event.target.value) as SubmissionWorkLogQuery["languages"] })}><option value="all">All languages</option><option value="python">Python</option><option value="swift">Swift</option></select></label>
        <label><span>Revision</span><select value={query.revision} onChange={(event) => updateFilter({ revision: event.target.value as SubmissionWorkLogQuery["revision"] })}><option value="all">Any revision</option><option value="current">Current</option><option value="older">Older</option></select></label>
        <label><span>When</span><select value={query.range} onChange={(event) => updateFilter({ range: event.target.value as SubmissionWorkLogQuery["range"] })}><option value="all">All time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></label>
        <label><span>Sort</span><select value={query.sort} onChange={(event) => updateFilter({ sort: event.target.value as SubmissionWorkLogQuery["sort"] })}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="problem">Problem</option><option value="verdict">Verdict</option></select></label>
        <button className="outline-button" type="button" onClick={() => onQueryChange(normalizeSubmissionWorkLogQuery({}), "push")}>Clear filters</button>
      </div>

      <p className="submission-work-log-results" aria-live="polite" aria-atomic="true">
        {derived.total ? `${derived.from}–${derived.to} of ${derived.total} matching receipts` : "No receipts match these filters"}
      </p>

      <div className={`submission-work-log-layout${selected ? " has-selection" : ""}`}>
        <div className="submission-work-log-list" aria-label="Submission receipts">
          {derived.rows.length ? derived.rows.map((row) => {
            const receipt = row.submission as SubmissionReceipt;
            const active = selected?.id === receipt.id;
            return (
              <article className={`submission-work-log-row is-${statusFor(receipt)}${active ? " is-selected" : ""}`} key={receipt.id}>
                <div className="submission-work-log-row-head"><strong>{statusLabel(receipt)}</strong><time dateTime={receipt.requestedAt}>{formatTimestamp(receipt.requestedAt)}</time></div>
                <h3>{row.title}</h3>
                <p>{row.language === "swift" ? "Swift" : "Python"} · {contextLabel(receipt)} · {receipt.lifecycle === "settled" ? `${receipt.passed ?? 0}/${receipt.total ?? 0} checks` : "verdict pending"}</p>
                <div className="submission-work-log-row-foot"><span>{row.revision === "current" ? "Current revision" : row.revision === "older" ? "Older revision" : "Archived item"}</span><button className="outline-button" type="button" aria-pressed={active} onClick={() => selectReceipt(receipt)}>Inspect</button></div>
              </article>
            );
          }) : (
            <div className="empty-history"><strong>{log.receipts.length ? "No matching submissions." : "No submissions yet."}</strong><p>{log.receipts.length ? "Clear or change the filters to widen the work log." : "Submit a verified Python solution and its receipt will appear here."}</p></div>
          )}
          {derived.pageCount > 1 ? (
            <nav className="submission-work-log-pagination" aria-label="Submission pages"><button className="outline-button" type="button" disabled={derived.page <= 1} onClick={() => update({ page: derived.page - 1, selectedId: undefined, compareId: undefined }, "push")}>Previous</button><span>Page {derived.page} of {derived.pageCount}</span><button className="outline-button" type="button" disabled={derived.page >= derived.pageCount} onClick={() => update({ page: derived.page + 1, selectedId: undefined, compareId: undefined }, "push")}>Next</button></nav>
          ) : null}
        </div>

        {selected ? (
          <article className="submission-work-log-detail" aria-labelledby="submission-work-log-detail-title">
            <button className="submission-work-log-back outline-button" type="button" onClick={() => update({ selectedId: undefined, compareId: undefined }, "push")}>← Back to submissions</button>
            <div className="submission-work-log-detail-head"><div><small>{statusLabel(selected)} · {contextLabel(selected)}</small><h3 id="submission-work-log-detail-title" ref={detailHeadingRef} tabIndex={-1}>{selected.titleSnapshot}</h3><p><time dateTime={selected.requestedAt}>{formatTimestamp(selected.requestedAt)}</time> · local judge revision {selected.judge.revision}</p></div><span className={`submission-work-log-verdict is-${statusFor(selected)}`}>{statusLabel(selected)}</span></div>
            {selected.lifecycle === "settled" ? <dl className="submission-work-log-evidence"><div><dt>Checks</dt><dd>{selected.passed}/{selected.total}</dd></div><div><dt>Judge time</dt><dd>{Math.round(selected.durationMs ?? 0)} ms</dd></div><div><dt>Prompt</dt><dd>revision {selected.itemRevision}</dd></div><div><dt>Assistance</dt><dd>{selected.assistance === "used" ? "Recorded" : selected.assistance === "none-recorded" ? "None recorded" : "Unknown"}</dd></div></dl> : <p className="submission-work-log-warning" role="status">This request is still marked pending. If the browser was interrupted, reopening the app will recover it as a judge interruption without inferring correctness.</p>}
            {selectedItem && (selected.itemRevision !== selectedItem.contentRevision || selected.judge.revision !== (selectedItem.verification?.revision ?? 1)) ? <p className="submission-work-log-warning">The current prompt or judge has changed. Comparing or restoring this source does not restore the older problem definition.</p> : null}
            {selected.interruptionReason ? <p className="submission-work-log-warning">Infrastructure note: {selected.interruptionReason}</p> : null}

            <div className="submission-work-log-detail-tabs" role="tablist" aria-label="Submission evidence view">
              <button ref={sourceTabRef} className={detailView === "source" ? "is-active" : undefined} type="button" role="tab" id="submission-source-tab" aria-selected={detailView === "source"} aria-controls="submission-source-panel" tabIndex={detailView === "source" ? 0 : -1} onKeyDown={handleDetailTabKey} onClick={() => setDetailView("source")}>Submitted source</button>
              <button ref={changesTabRef} className={detailView === "changes" ? "is-active" : undefined} type="button" role="tab" id="submission-changes-tab" aria-selected={detailView === "changes"} aria-controls="submission-changes-panel" tabIndex={detailView === "changes" ? 0 : -1} onKeyDown={handleDetailTabKey} onClick={() => setDetailView("changes")}>Compare attempts</button>
            </div>
            {detailView === "source" ? <div id="submission-source-panel" role="tabpanel" aria-labelledby="submission-source-tab">{selectedSource ? <textarea className="submission-inspector-source" aria-label="Exact submitted source" value={selectedSource} readOnly wrap="off" spellCheck={false} /> : <div className="empty-history"><strong>Source snapshot unavailable.</strong><p>The receipt remains intact, but its source was evicted to stay within this browser’s storage budget.</p></div>}</div> : <div id="submission-changes-panel" role="tabpanel" aria-labelledby="submission-changes-tab"><label className="submission-work-log-compare"><span>Compare selected attempt with</span><select value={compared?.id ?? ""} disabled={!comparisons.length} onChange={(event) => update({ compareId: event.target.value || undefined }, "replace")}><option value="">{comparisons.length ? "Choose an attempt" : "No comparable source"}</option>{comparisons.map((candidate) => <option value={candidate.id} key={candidate.id}>{formatTimestamp(candidate.requestedAt)} · {statusLabel(candidate)}</option>)}</select></label>{selectedSource && comparedSource ? <DiffRows earlier={comparedSource} selected={selectedSource} /> : <p className="submission-work-log-note">Comparison requires another retained source from this same problem.</p>}</div>}

            <div className="submission-work-log-actions"><button className="outline-button" type="button" disabled={!selectedItem} onClick={() => selectedItem && onOpenClean(selectedItem)}>Open clean retry</button>{closureIdsBySubmission[selected.id] ? <button className="primary-button" type="button" onClick={() => onOpenAttemptClosure(closureIdsBySubmission[selected.id])}>Close this attempt</button> : null}{reviewAttemptIdsBySubmission[selected.id] ? <button className="primary-button" type="button" onClick={() => onOpenSolutionReview(reviewAttemptIdsBySubmission[selected.id])}>Review how this solution works</button> : null}<button className={reviewAttemptIdsBySubmission[selected.id] || closureIdsBySubmission[selected.id] ? "outline-button" : "primary-button"} type="button" disabled={!selectedItem || !selectedSource || selected.lifecycle !== "settled"} onClick={() => selectedItem && selectedSource && onContinueAssisted(selected, selectedItem, selectedSource)}>Continue from this source</button><button className="outline-button" type="button" disabled={!selectedSource} onClick={copySource}>{copied ? "Copied" : "Copy source"}</button></div>
            <p className="submission-work-log-note">“Close this attempt” records remediation without claiming a solve. “Continue from this source” creates an ordinary current-revision solve and marks it assisted. “Open clean retry” starts from the current starter code.</p>

            <form className="submission-work-log-annotation" onSubmit={(event) => { event.preventDefault(); onSaveAnnotation(selected.id, { note, tags }); }}>
              <div><small>Private reflection</small><h4>What should future-you remember?</h4></div>
              <label><span>Note</span><textarea value={note} maxLength={1200} onChange={(event) => setNote(event.target.value)} placeholder="Approach, mistake, edge case, or next action" /></label>
              <fieldset><legend>Mistake and review tags</legend><div>{SUBMISSION_ANNOTATION_TAGS.map((tag) => <label key={tag}><input type="checkbox" checked={tags.includes(tag)} disabled={!tags.includes(tag) && tags.length >= 4} onChange={() => setTags((current) => current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag])} /><span>{TAG_LABELS[tag]}</span></label>)}</div></fieldset>
              <button className="outline-button" type="submit">Save reflection</button>
            </form>
          </article>
        ) : (
          <div className="submission-work-log-detail-empty"><span>↗</span><h3>Inspect a receipt</h3><p>Select a submission to review its source, judge evidence, revision context, comparison, and private reflection.</p></div>
        )}
      </div>
    </section>
  );
}
