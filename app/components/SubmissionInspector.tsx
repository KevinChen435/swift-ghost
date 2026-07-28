"use client";

import { useId, useMemo, useState } from "react";
import { buildSubmissionDiff } from "../lib/submission-diff.mjs";
import type { SubmissionRecord } from "../lib/product";

const MAX_VISIBLE_SUBMISSIONS = 50;

const STATUS_LABELS: Readonly<Record<SubmissionRecord["status"], string>> = {
  accepted: "Accepted",
  "wrong-answer": "Wrong answer",
  "runtime-error": "Runtime error",
  "time-limit": "Time limit exceeded",
  "invalid-entrypoint": "Invalid entrypoint",
  "judge-error": "Judge error",
};

type InspectorView = "diff" | "source";

export type SubmissionInspectorProps = {
  submissions: readonly SubmissionRecord[];
  currentSource: string;
  currentItemRevision: number;
  currentVerificationRevision: number;
  checksAreBusy: boolean;
  onInspect: (submission: SubmissionRecord) => void;
  onRestoreSubmission: (submission: SubmissionRecord) => void;
};

function timestampValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTimestamp(value: string) {
  const parsed = timestampValue(value);
  if (parsed === 0) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function revisionLabel(
  submission: SubmissionRecord,
  currentItemRevision: number,
  currentVerificationRevision: number,
) {
  const promptIsCurrent = submission.itemRevision === currentItemRevision;
  const judgeIsCurrent =
    submission.verificationRevision === currentVerificationRevision;

  if (promptIsCurrent && judgeIsCurrent) return "Current prompt and judge";
  if (!promptIsCurrent && !judgeIsCurrent) return "Older prompt and judge";
  if (!promptIsCurrent) return "Older prompt";
  return "Older judge";
}

function RevisionWarning({
  submission,
  currentItemRevision,
  currentVerificationRevision,
}: {
  submission: SubmissionRecord;
  currentItemRevision: number;
  currentVerificationRevision: number;
}) {
  const promptChanged = submission.itemRevision !== currentItemRevision;
  const judgeChanged =
    submission.verificationRevision !== currentVerificationRevision;

  if (!promptChanged && !judgeChanged) return null;

  return (
    <p className="submission-inspector-revision-warning" role="status">
      This result used
      {promptChanged
        ? ` prompt revision ${submission.itemRevision} (current: ${currentItemRevision})`
        : ` the current prompt revision ${currentItemRevision}`}
      {" and "}
      {judgeChanged
        ? `judge revision ${submission.verificationRevision} (current: ${currentVerificationRevision})`
        : `the current judge revision ${currentVerificationRevision}`}
      . Restoring the source does not restore the older prompt or judge.
    </p>
  );
}

function DiffView({
  diff,
}: {
  diff: ReturnType<typeof buildSubmissionDiff>;
}) {
  if (diff.identical) {
    return (
      <p className="submission-inspector-identical">
        This submitted source is already in the editor.
      </p>
    );
  }

  return (
    <div className="submission-inspector-diff-view">
      <p className="submission-inspector-diff-legend">
        <strong>Removed</strong> lines come from the submitted version;{" "}
        <strong>added</strong> lines come from the current editor.
      </p>
      <p className="submission-inspector-diff-summary" aria-live="polite">
        {diff.summary.removed} removed · {diff.summary.added} added ·{" "}
        {diff.summary.unchanged} unchanged
      </p>
      <div
        className="submission-inspector-diff"
        role="table"
        aria-label="Difference between submitted source and current editor"
        style={{ maxWidth: "100%", overflowX: "auto" }}
      >
        <div className="submission-inspector-diff-header" role="row">
          <span role="columnheader">Submitted</span>
          <span role="columnheader">Current</span>
          <span role="columnheader">Source</span>
        </div>
        {diff.rows.map((row, index) => {
          if (row.type === "omitted") {
            return (
              <div
                className="submission-inspector-diff-row is-omitted"
                role="row"
                key={`omitted-${index}`}
              >
                <span role="cell" aria-hidden="true" />
                <span role="cell" aria-hidden="true" />
                <code role="cell">… {row.text} …</code>
              </div>
            );
          }

          const prefix =
            row.type === "remove" ? "−" : row.type === "add" ? "+" : " ";
          return (
            <div
              className={`submission-inspector-diff-row is-${row.type}`}
              role="row"
              key={`${row.type}-${row.submittedLine ?? "x"}-${row.currentLine ?? "x"}-${index}`}
            >
              <span role="cell">{row.submittedLine ?? ""}</span>
              <span role="cell">{row.currentLine ?? ""}</span>
              <code role="cell">
                <span aria-hidden="true">{prefix} </span>
                {row.text || " "}
              </code>
            </div>
          );
        })}
      </div>
      {diff.finalNewline.changed && (
        <p className="submission-inspector-newline-note">
          Final newline changed: submitted{" "}
          {diff.finalNewline.submitted ? "included one" : "did not include one"};
          current editor {diff.finalNewline.current ? "includes one" : "does not"}.
        </p>
      )}
      {diff.truncated && (
        <p className="submission-inspector-truncation-note">
          This large comparison is summarized to keep the inspector responsive.
          The exact submitted source remains available in the Source tab.
        </p>
      )}
    </div>
  );
}

function SubmissionDetail({
  submission,
  currentSource,
  currentItemRevision,
  currentVerificationRevision,
  checksAreBusy,
  panelId,
  onRestoreSubmission,
}: {
  submission: SubmissionRecord;
  currentSource: string;
  currentItemRevision: number;
  currentVerificationRevision: number;
  checksAreBusy: boolean;
  panelId: string;
  onRestoreSubmission: (submission: SubmissionRecord) => void;
}) {
  const [view, setView] = useState<InspectorView>("diff");
  const diff = useMemo(
    () => buildSubmissionDiff(submission.source, currentSource),
    [currentSource, submission.source],
  );
  const tabPrefix = `${panelId}-view`;

  return (
    <section
      className="submission-inspector-detail"
      id={panelId}
      aria-label="Selected submission details"
    >
      <RevisionWarning
        submission={submission}
        currentItemRevision={currentItemRevision}
        currentVerificationRevision={currentVerificationRevision}
      />
      <div className="submission-inspector-detail-tabs" role="tablist">
        <button
          className={view === "diff" ? "is-active" : undefined}
          type="button"
          role="tab"
          id={`${tabPrefix}-diff-tab`}
          aria-selected={view === "diff"}
          aria-controls={`${tabPrefix}-diff-panel`}
          onClick={() => setView("diff")}
        >
          Changes
        </button>
        <button
          className={view === "source" ? "is-active" : undefined}
          type="button"
          role="tab"
          id={`${tabPrefix}-source-tab`}
          aria-selected={view === "source"}
          aria-controls={`${tabPrefix}-source-panel`}
          onClick={() => setView("source")}
        >
          Submitted source
        </button>
      </div>

      {view === "diff" ? (
        <div
          id={`${tabPrefix}-diff-panel`}
          role="tabpanel"
          aria-labelledby={`${tabPrefix}-diff-tab`}
        >
          <DiffView diff={diff} />
        </div>
      ) : (
        <div
          id={`${tabPrefix}-source-panel`}
          role="tabpanel"
          aria-labelledby={`${tabPrefix}-source-tab`}
          style={{ maxWidth: "100%", overflowX: "auto" }}
        >
          <textarea
            className="submission-inspector-source"
            aria-label="Exact submitted source"
            value={submission.source}
            readOnly
            wrap="off"
            spellCheck={false}
            style={{
              boxSizing: "border-box",
              maxWidth: "100%",
              minHeight: "18rem",
              overflow: "auto",
              resize: "vertical",
              width: "100%",
            }}
          />
        </div>
      )}

      <div className="submission-inspector-actions">
        <button
          className="outline-button"
          type="button"
          disabled={checksAreBusy || diff.identical}
          onClick={() => onRestoreSubmission(submission)}
        >
          {diff.identical
            ? "In editor"
            : submission.itemRevision === currentItemRevision &&
                submission.verificationRevision === currentVerificationRevision
              ? "Restore source"
              : "Restore older source"}
        </button>
      </div>
    </section>
  );
}

export function SubmissionInspector({
  submissions,
  currentSource,
  currentItemRevision,
  currentVerificationRevision,
  checksAreBusy,
  onInspect,
  onRestoreSubmission,
}: SubmissionInspectorProps) {
  const instanceId = useId().replaceAll(":", "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const newestFirst = useMemo(
    () =>
      submissions
        .map((submission, originalIndex) => ({ submission, originalIndex }))
        .sort(
          (left, right) =>
            timestampValue(right.submission.submittedAt) -
              timestampValue(left.submission.submittedAt) ||
            left.originalIndex - right.originalIndex,
        )
        .slice(0, MAX_VISIBLE_SUBMISSIONS)
        .map(({ submission }) => submission),
    [submissions],
  );

  if (newestFirst.length === 0) {
    return (
      <p className="challenge-console-empty">
        Your submitted solutions will appear here with their judge result.
      </p>
    );
  }

  return (
    <div className="submission-inspector">
      {submissions.length > newestFirst.length && (
        <p className="submission-inspector-list-limit">
          Showing the newest {newestFirst.length} of {submissions.length}{" "}
          submissions.
        </p>
      )}
      <ol className="challenge-console-submission-list">
        {newestFirst.map((submission, index) => {
          const expanded = selectedId === submission.id;
          const detailsId = `${instanceId}-submission-${index}-details`;
          return (
            <li
              className={`challenge-console-submission is-${submission.status}`}
              key={submission.id}
            >
              <div className="challenge-console-submission-head">
                <strong>{STATUS_LABELS[submission.status]}</strong>
                <time dateTime={submission.submittedAt}>
                  {formatTimestamp(submission.submittedAt)}
                </time>
              </div>
              <div className="challenge-console-submission-meta">
                <span>
                  {submission.passed}/{submission.total} checks
                </span>
                <span>{Math.round(submission.durationMs)} ms</span>
                <span>{submission.origin === "mock" ? "Mock" : "Practice"}</span>
                <span>
                  {revisionLabel(
                    submission,
                    currentItemRevision,
                    currentVerificationRevision,
                  )}
                </span>
              </div>
              <button
                className="outline-button"
                type="button"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={() => {
                  if (expanded) {
                    setSelectedId(null);
                    return;
                  }
                  onInspect(submission);
                  setSelectedId(submission.id);
                }}
              >
                {expanded ? "Hide details" : "View details"}
              </button>
              {expanded && (
                <SubmissionDetail
                  submission={submission}
                  currentSource={currentSource}
                  currentItemRevision={currentItemRevision}
                  currentVerificationRevision={currentVerificationRevision}
                  checksAreBusy={checksAreBusy}
                  panelId={detailsId}
                  onRestoreSubmission={onRestoreSubmission}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
