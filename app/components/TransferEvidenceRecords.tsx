"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  TransferRecord,
  TransferRecordTimelineEvent,
  TransferRecordsResult,
} from "../lib/transfer-records.mjs";
import type { TransferVariant } from "./TransferLab";

type TransferRecordFilter = "all" | "due" | "proven" | "assisted" | "unseen";

export interface TransferEvidenceRecordsProps {
  model: TransferRecordsResult;
  variants: TransferVariant[];
  selectedVariantId?: string;
  selectedAttemptId?: string;
  onSelect: (variantId?: string, attemptId?: string) => void;
  onOpenVariant: (variantId: string) => void;
  onOpenSubmission: (submissionId: string) => void;
  onOpenReview: (attemptId: string) => void;
  onOpenLab: () => void;
}

const STATUS_LABELS: Record<TransferRecord["status"], string> = {
  unseen: "Unseen",
  opened: "Opened",
  attempted: "Attempted",
  assisted: "Assisted",
  proven: "Cold proof",
  due: "Recheck due",
};

const EVIDENCE_LABELS: Record<string, string> = {
  "cold-proof": "Cold proof",
  "spaced-recheck": "Spaced recheck",
  "early-reconstruction": "Early reconstruction",
  "assisted-reconstruction": "Assisted reconstruction",
  "not-schedule-evidence": "Does not advance cadence",
};

const FILTERS: Array<{ value: TransferRecordFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "proven", label: "Proven" },
  { value: "assisted", label: "Assisted" },
  { value: "unseen", label: "Unseen" },
];

const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

function safeTime(value?: string | null) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value?: string | null) {
  const parsed = safeTime(value);
  if (parsed === null) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatRelative(value: string | null, now: string) {
  const target = safeTime(value);
  const reference = safeTime(now);
  if (target === null || reference === null) return "Not scheduled";
  const days = Math.ceil(Math.abs(target - reference) / 86_400_000);
  if (target <= reference) return days <= 1 ? "Due now" : `${days} days overdue`;
  return days <= 1 ? "Due within a day" : `Due in ${days} days`;
}

function identityIsSealed(record: TransferRecord, variant?: TransferVariant) {
  return record.status === "unseen" || record.progress.exposureUnknown || !variant?.revealed;
}

function titleFor(record: TransferRecord, variant?: TransferVariant) {
  return identityIsSealed(record, variant)
    ? record.status === "unseen"
      ? "Hidden until first open"
      : "Hidden until an attempt is recorded"
    : variant!.revealed!.title;
}

function patternFor(record: TransferRecord, variant?: TransferVariant) {
  return identityIsSealed(record, variant)
    ? "Pattern and family remain sealed"
    : variant!.revealed!.pattern;
}

function evidenceClassFor(event: TransferRecordTimelineEvent) {
  if (event.kind !== "attempt" && event.kind !== "submission") return null;
  return EVIDENCE_LABELS[event.evidenceClass] ?? "Recorded evidence";
}

function reviewableAttempt(event: TransferRecordTimelineEvent | undefined) {
  return Boolean(
    event?.kind === "attempt" &&
      event.outcome === "completed" &&
      event.verificationTotal &&
      event.verificationTotal > 0 &&
      event.verificationPassed === event.verificationTotal,
  );
}

function eventTitle(event: TransferRecordTimelineEvent) {
  if (event.kind === "prompt-open") {
    return event.occurrence === "first-and-last"
      ? "Prompt opened"
      : `${event.occurrence === "first" ? "First" : "Latest"} prompt open`;
  }
  if (event.kind === "hint") {
    return event.occurrence === "first-and-last"
      ? "Hint used"
      : `${event.occurrence === "first" ? "First" : "Latest"} hint use`;
  }
  if (event.kind === "reference-or-debrief-reveal") return "Identity or reference revealed";
  if (event.kind === "attempt") return "Practice attempt";
  if (event.kind === "submission") return event.lifecycle === "pending" ? "Submission pending" : "Submission judged";
  return event.status === "completed" ? "Solution review completed" : "Solution review draft";
}

function eventDetail(event: TransferRecordTimelineEvent) {
  if (event.kind === "prompt-open") return `${event.recordedOpenCount} recorded open${event.recordedOpenCount === 1 ? "" : "s"} for revision ${event.variantRevision}`;
  if (event.kind === "hint") return `Highest recorded hint level ${event.maxHintLevel}`;
  if (event.kind === "reference-or-debrief-reveal") return "Later work can still prove delayed retrieval, but this is no longer a first cold start.";
  if (event.kind === "attempt") {
    const checks = event.verificationTotal
      ? `${event.verificationPassed ?? 0}/${event.verificationTotal} checks`
      : "verification unavailable";
    return `${event.outcome} · ${event.qualification} · ${checks}`;
  }
  if (event.kind === "submission") {
    const checks = event.verificationTotal === null
      ? "judge result pending"
      : `${event.verificationPassed ?? 0}/${event.verificationTotal} checks`;
    return `${event.status?.replaceAll("-", " ") ?? "pending"} · ${checks} · ${event.contextKind}`;
  }
  return event.status === "completed"
    ? `${event.grade ?? "ungraded"} · next review ${formatDate(event.dueAt)}`
    : "Explain-first review is still in progress";
}

function TimelineAction({
  event,
  selectedAttemptId,
  onSelect,
  onOpenSubmission,
  onOpenReview,
}: {
  event: TransferRecordTimelineEvent;
  selectedAttemptId?: string;
  onSelect: (attemptId: string) => void;
  onOpenSubmission: (submissionId: string) => void;
  onOpenReview: (attemptId: string) => void;
}) {
  if (event.kind === "attempt") {
    return (
      <button
        className="transfer-record-event-action"
        type="button"
        aria-pressed={event.attemptId === selectedAttemptId}
        onClick={() => onSelect(event.attemptId)}
      >
        {event.attemptId === selectedAttemptId ? "Attempt selected" : "Select attempt"}
      </button>
    );
  }
  if (event.kind === "submission") {
    return (
      <button className="transfer-record-event-action" type="button" onClick={() => onOpenSubmission(event.submissionId)}>
        Open exact source
      </button>
    );
  }
  if (event.kind === "review") {
    return (
      <button className="transfer-record-event-action" type="button" onClick={() => onOpenReview(event.attemptId)}>
        {event.status === "draft" ? "Resume review" : "Open review"}
      </button>
    );
  }
  return null;
}

export function TransferEvidenceRecords({
  model,
  variants,
  selectedVariantId,
  selectedAttemptId,
  onSelect,
  onOpenVariant,
  onOpenSubmission,
  onOpenReview,
  onOpenLab,
}: TransferEvidenceRecordsProps) {
  const [filter, setFilter] = useState<TransferRecordFilter>("all");
  const [query, setQuery] = useState("");
  const indexHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const hadSelectionRef = useRef(false);
  const variantsById = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant])),
    [variants],
  );
  const selectedRecord = selectedVariantId
    ? model.records.find((record) => record.variantId === selectedVariantId)
    : undefined;
  const selectedRecordId = selectedRecord?.variantId;
  const selectedAttempt = selectedRecord && selectedAttemptId
    ? selectedRecord.timeline.find(
        (event) => event.kind === "attempt" && event.attemptId === selectedAttemptId,
      )
    : undefined;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecords = model.records.filter((record) => {
    const matchesFilter = filter === "all"
      ? true
      : filter === "proven"
        ? record.status === "proven" || record.status === "due"
        : record.status === filter;
    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;
    const variant = variantsById.get(record.variantId);
    const safeSearchText = identityIsSealed(record, variant)
      ? `${variant?.displayLabel ?? record.variantId} ${record.difficulty}`
      : `${variant?.displayLabel ?? record.variantId} ${record.title} ${record.pattern} ${record.family} ${record.difficulty}`;
    return safeSearchText.toLowerCase().includes(normalizedQuery);
  });

  const selectedVariant = selectedRecord
    ? variantsById.get(selectedRecord.variantId)
    : undefined;
  const reviewAttemptId = selectedAttemptId
    ? reviewableAttempt(selectedAttempt)
      ? selectedAttemptId
      : undefined
    : selectedRecord?.latestReviewAttemptId ?? selectedRecord?.currentAcceptedAttemptId;
  const hasSavedReview = Boolean(
    selectedRecord &&
      reviewAttemptId &&
      selectedRecord.timeline.some(
        (event) => event.kind === "review" && event.attemptId === reviewAttemptId,
      ),
  );
  const completedCheckpoints = selectedRecord?.progress.spacedSolveCount ?? 0;
  const selectedRouteInvalid = Boolean(selectedVariantId && !selectedRecord);
  const attemptRouteInvalid = Boolean(selectedRecord && selectedAttemptId && !selectedAttempt);

  useEffect(() => {
    const hadSelection = hadSelectionRef.current;
    hadSelectionRef.current = Boolean(selectedRecordId);
    const target = selectedRecordId
      ? detailHeadingRef.current
      : hadSelection
        ? indexHeadingRef.current
        : null;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => target.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [selectedRecordId]);

  return (
    <section className="transfer-records" aria-labelledby="transfer-records-title">
      <div className="transfer-records-hero">
        <div>
          <small>Transfer evidence ledger</small>
          <h2 id="transfer-records-title">Inspect what actually counts as retrieval.</h2>
          <p>
            Reopen every surviving local signal for a hidden variant: prompt exposure, attempts,
            durable submissions, explain-first reviews, and the recheck schedule they did—or did not—advance.
          </p>
        </div>
        <aside className="transfer-records-trust">
          <strong>Evidence boundary</strong>
          <p>
            This is device-local practice evidence, not an interview-readiness score. Open and hint history
            uses bounded aggregate markers; missing activity is never invented.
          </p>
        </aside>
      </div>

      <div className="transfer-records-stats" aria-label="Transfer evidence summary">
        <div><strong>{model.totals.independentEvidence}</strong><span>variants with cold proof</span></div>
        <div><strong>{model.totals.due}</strong><span>rechecks due</span></div>
        <div><strong>{model.totals.acceptedSubmissions}</strong><span>accepted receipts</span></div>
        <div><strong>{model.totals.completedReviews}</strong><span>reviews completed</span></div>
        <div><strong>{model.totals.partialEvidenceRecords}</strong><span>partial ledgers</span></div>
      </div>

      <div className="transfer-records-toolbar">
        <label className="transfer-records-search">
          <span>Search visible evidence</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Variant label, revealed pattern, status…"
          />
        </label>
        <div className="transfer-records-filter" role="group" aria-label="Filter transfer records">
          {FILTERS.map((candidate) => (
            <button
              key={candidate.value}
              type="button"
              className={filter === candidate.value ? "is-active" : undefined}
              aria-pressed={filter === candidate.value}
              onClick={() => setFilter(candidate.value)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
        <button className="outline-button" type="button" onClick={onOpenLab}>Open Transfer Lab</button>
      </div>

      {selectedRouteInvalid ? (
        <p className="transfer-records-route-warning" role="status">
          That transfer record is unavailable. No record was inferred from another variant.
        </p>
      ) : null}
      {attemptRouteInvalid ? (
        <p className="transfer-records-route-warning" role="status">
          That attempt is not part of this variant’s surviving timeline. The variant record is still shown.
        </p>
      ) : null}

      <div className={`transfer-records-layout${selectedRecord ? " has-selection" : ""}`}>
        <section className="transfer-records-index" aria-labelledby="transfer-records-index-title">
          <div className="transfer-records-panel-head">
            <div>
              <small>Local ledger</small>
              <h3 id="transfer-records-index-title" ref={indexHeadingRef} tabIndex={-1}>Variant records</h3>
            </div>
            <span>{filteredRecords.length} shown</span>
          </div>
          {filteredRecords.length ? (
            <ul className="transfer-records-list">
              {filteredRecords.map((record) => {
                const variant = variantsById.get(record.variantId);
                const active = record.variantId === selectedRecord?.variantId;
                return (
                  <li key={record.variantId}>
                    <button
                      type="button"
                      className={active ? "is-active" : undefined}
                      aria-current={active ? "true" : undefined}
                      onClick={() => onSelect(record.variantId)}
                    >
                      <span className="transfer-records-list-topline">
                        <strong>{variant?.displayLabel ?? record.variantId}</strong>
                        <span data-status={record.status}>{STATUS_LABELS[record.status]}</span>
                      </span>
                      <span className="transfer-records-list-title">{titleFor(record, variant)}</span>
                      <span className="transfer-records-list-meta">
                        {record.timelineEventCount} events · revision {record.currentRevision}
                        {record.dueAt ? ` · ${formatRelative(record.dueAt, model.generatedAt)}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="transfer-records-empty">
              <strong>No records match this view.</strong>
              <p>Clear the search or choose another evidence status.</p>
              <button type="button" className="outline-button" onClick={() => { setFilter("all"); setQuery(""); }}>
                Show every variant
              </button>
            </div>
          )}
        </section>

        {selectedRecord ? (
          <article className="transfer-record-detail" aria-labelledby="transfer-record-detail-title">
            <button className="transfer-records-back" type="button" onClick={() => onSelect()}>
              ← All variant records
            </button>
            <header className="transfer-record-detail-head">
              <div>
                <small>{selectedVariant?.displayLabel ?? selectedRecord.variantId} · prompt revision {selectedRecord.currentRevision}</small>
                <h3 id="transfer-record-detail-title" ref={detailHeadingRef} tabIndex={-1}>{titleFor(selectedRecord, selectedVariant)}</h3>
                <p>{patternFor(selectedRecord, selectedVariant)}</p>
              </div>
              <span className="transfer-record-detail-status" data-status={selectedRecord.status}>
                {STATUS_LABELS[selectedRecord.status]}
              </span>
            </header>

            <div className="transfer-record-actions">
              <button className="primary-button" type="button" onClick={() => onOpenVariant(selectedRecord.variantId)}>
                {selectedRecord.status === "due" ? "Start due recheck" : selectedRecord.status === "unseen" ? "Open cold" : "Practice this variant"}
              </button>
              {selectedRecord.latestSubmissionId ? (
                <button className="outline-button" type="button" onClick={() => onOpenSubmission(selectedRecord.latestSubmissionId!)}>
                  Open latest submission
                </button>
              ) : null}
              {reviewAttemptId ? (
                <button className="outline-button" type="button" onClick={() => onOpenReview(reviewAttemptId)}>
                  {hasSavedReview ? "Open solution review" : "Start solution review"}
                </button>
              ) : null}
            </div>

            <dl className="transfer-record-metrics">
              <div><dt>Current attempts</dt><dd>{selectedRecord.currentAttemptCount}</dd></div>
              <div><dt>Current submissions</dt><dd>{selectedRecord.currentSubmissionCount}</dd></div>
              <div><dt>Solution reviews</dt><dd>{selectedRecord.reviewCount}</dd></div>
              <div><dt>Last activity</dt><dd>{formatDate(selectedRecord.lastActivityAt)}</dd></div>
            </dl>

            <section className="transfer-record-schedule" aria-labelledby="transfer-record-schedule-title">
              <div className="transfer-records-panel-head">
                <div><small>Retrieval cadence</small><h4 id="transfer-record-schedule-title">1 · 3 · 7 · 14 · 30 day ladder</h4></div>
                <span>{formatRelative(selectedRecord.dueAt, model.generatedAt)}</span>
              </div>
              <ol>
                {REVIEW_INTERVALS.map((days, index) => {
                  const complete = index < completedCheckpoints;
                  const next = index === completedCheckpoints && completedCheckpoints < REVIEW_INTERVALS.length;
                  return (
                    <li key={days} className={complete ? "is-complete" : next ? "is-next" : undefined}>
                      <span aria-hidden="true">{complete ? "✓" : index + 1}</span>
                      <strong>{days} day{days === 1 ? "" : "s"}</strong>
                      <small>{complete ? "evidence recorded" : next ? "next interval" : "locked"}</small>
                    </li>
                  );
                })}
              </ol>
              <p>
                Only an independent cold proof or a clean attempt at or after its due time advances this ladder.
                Early and assisted reconstructions remain visible without inflating the cadence.
              </p>
            </section>

            <section className="transfer-record-coverage" aria-labelledby="transfer-record-coverage-title">
              <div className="transfer-records-panel-head">
                <div><small>Disclosure</small><h4 id="transfer-record-coverage-title">What this timeline can prove</h4></div>
                <span>{selectedRecord.evidenceCoverage.timeline === "truncated" ? "Bounded timeline" : "Complete bounded timeline"}</span>
              </div>
              <p>{selectedRecord.evidenceCoverage.disclosure}</p>
              <ul>
                <li>Prompt opens: {selectedRecord.evidenceCoverage.promptOpens.replaceAll("-", " ")}</li>
                <li>Hints: {selectedRecord.evidenceCoverage.hints.replaceAll("-", " ")}</li>
                <li>Reference/debrief reveal: {selectedRecord.evidenceCoverage.referenceOrDebriefReveal.replaceAll("-", " ")}</li>
                <li>{selectedRecord.staleAttemptCount + selectedRecord.staleSubmissionCount} stale-revision records retained and labeled</li>
              </ul>
            </section>

            <section className="transfer-record-timeline" aria-labelledby="transfer-record-timeline-title">
              <div className="transfer-records-panel-head">
                <div><small>Newest first</small><h4 id="transfer-record-timeline-title">Surviving evidence timeline</h4></div>
                <span>{selectedRecord.timelineEventCount} total{selectedRecord.omittedTimelineEventCount ? ` · ${selectedRecord.omittedTimelineEventCount} omitted by limit` : ""}</span>
              </div>
              {selectedRecord.timeline.length ? (
                <ol>
                  {[...selectedRecord.timeline].reverse().map((event) => {
                    const classification = evidenceClassFor(event);
                    const isSelected = event.kind === "attempt" && event.attemptId === selectedAttemptId;
                    return (
                      <li key={event.id} className={isSelected ? "is-selected" : undefined}>
                        <div className="transfer-record-event-marker" aria-hidden="true" />
                        <div className="transfer-record-event-body">
                          <div className="transfer-record-event-head">
                            <div>
                              <strong>{eventTitle(event)}</strong>
                              <time dateTime={event.at}>{formatDate(event.at)}</time>
                            </div>
                            <span className={event.isCurrentRevision ? "is-current" : "is-stale"}>
                              {event.isCurrentRevision ? "Current revision" : `Stale revision ${event.variantRevision}`}
                            </span>
                          </div>
                          <p>{eventDetail(event)}</p>
                          {classification && (event.kind === "attempt" || event.kind === "submission") ? (
                            <div className="transfer-record-event-evidence">
                              <strong>{classification}</strong>
                              <span>{event.advancesSchedule ? `Advanced cadence${event.nextDueAt ? ` · next ${formatDate(event.nextDueAt)}` : ""}` : "Did not advance cadence"}</span>
                            </div>
                          ) : null}
                          <TimelineAction
                            event={event}
                            selectedAttemptId={selectedAttemptId}
                            onSelect={(attemptId) => onSelect(selectedRecord.variantId, attemptId)}
                            onOpenSubmission={onOpenSubmission}
                            onOpenReview={onOpenReview}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="transfer-records-empty">
                  <strong>No local evidence yet.</strong>
                  <p>Open this variant cold to create the first bounded exposure marker.</p>
                </div>
              )}
            </section>
          </article>
        ) : (
          <aside className="transfer-record-detail-empty">
            <span aria-hidden="true">⌁</span>
            <h3>Select a variant record</h3>
            <p>
              Inspect exact evidence classifications, revision boundaries, linked source receipts,
              solution reviews, and the next legitimate delayed recheck.
            </p>
          </aside>
        )}
      </div>
    </section>
  );
}
