"use client";

import { useMemo, useRef, useState } from "react";
import type {
  RunManifest,
  RunManifestEntry,
  RunManifestEntryReport,
  RunManifestExecution,
  RunManifestReport,
  RunManifestWorkspace,
} from "../lib/run-manifests.mjs";

export type ChallengeSetActivityProps = {
  workspace: RunManifestWorkspace;
  reports: readonly RunManifestReport[];
  selectedManifestId?: string;
  onSelectManifest?: (manifestId: string) => void;
  onResume: (manifestId: string, execution: RunManifestExecution) => void;
  onOpenExecution: (execution: RunManifestExecution) => void;
  onArchive: (manifestId: string) => void;
};

type DisplayEntry = RunManifestEntry &
  Pick<
    RunManifestEntryReport,
    | "status"
    | "attempted"
    | "pending"
    | "accepted"
    | "acceptedCurrent"
    | "attemptCount"
    | "submissionCount"
  >;

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: RunManifest["status"]) {
  if (status === "ended") return "Ended early";
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function sourceLabel(source: RunManifest["source"]) {
  if (source === "study-plan") return "Study plan";
  return `${source.charAt(0).toUpperCase()}${source.slice(1)}`;
}

function modeLabel(manifest: RunManifest) {
  return manifest.mode === "timed" ? "Timed round" : "Untimed practice";
}

function durationLabel(manifest: RunManifest) {
  return manifest.durationMinutes
    ? `${manifest.durationMinutes} minute limit`
    : "No time limit";
}

function executionLabel(execution: RunManifestExecution) {
  return execution.kind === "virtual-round" ? "timed round" : "practice session";
}

function evidenceLabel(status: RunManifestEntryReport["status"]) {
  switch (status) {
    case "accepted-current":
      return "Accepted · current";
    case "accepted-stale":
      return "Accepted · stale";
    case "pending":
      return "Pending verification";
    case "attempted":
      return "Attempted";
    default:
      return "Not started";
  }
}

function manifestTimestamp(manifest: RunManifest) {
  if ("finishedAt" in manifest) return manifest.finishedAt;
  if ("startedAt" in manifest) return manifest.startedAt;
  return manifest.createdAt;
}

function withoutReport(entry: RunManifestEntry): DisplayEntry {
  return {
    ...entry,
    status: "not-started",
    attempted: false,
    pending: false,
    accepted: false,
    acceptedCurrent: false,
    attemptCount: 0,
    submissionCount: 0,
  };
}

function ManifestListItem({
  manifest,
  report,
  selected,
  onSelect,
}: {
  manifest: RunManifest;
  report?: RunManifestReport;
  selected: boolean;
  onSelect: () => void;
}) {
  const attempted = report?.attemptedCount ?? 0;
  return (
    <li>
      <button
        type="button"
        className={selected ? "is-selected" : undefined}
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
      >
        <span className="challenge-set-list-topline">
          <strong>{manifest.title}</strong>
          <span data-status={manifest.status}>{statusLabel(manifest.status)}</span>
        </span>
        <span>{modeLabel(manifest)} · {manifest.entries.length} problems</span>
        <small>{attempted}/{manifest.entries.length} attempted · {formatDate(manifestTimestamp(manifest))}</small>
      </button>
    </li>
  );
}

export default function ChallengeSetActivity({
  workspace,
  reports,
  selectedManifestId,
  onSelectManifest,
  onResume,
  onOpenExecution,
  onArchive,
}: ChallengeSetActivityProps) {
  const [localSelectedId, setLocalSelectedId] = useState<string>();
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);

  const allManifests = useMemo(
    () => [...workspace.manifests].sort((left, right) =>
      manifestTimestamp(right).localeCompare(manifestTimestamp(left))),
    [workspace.manifests],
  );
  const archivedCount = allManifests.filter(
    (manifest) => manifest.status === "archived",
  ).length;
  const manifests = showArchived
    ? allManifests
    : allManifests.filter((manifest) => manifest.status !== "archived");
  const reportById = useMemo(
    () => new Map(reports.map((report) => [report.manifestId, report])),
    [reports],
  );
  const active = manifests.find((manifest) => manifest.status === "active");
  const history = manifests.filter((manifest) => manifest.status !== "active");
  const requestedId = selectedManifestId ?? localSelectedId;
  const selected = manifests.find((manifest) => manifest.id === requestedId)
    ?? active
    ?? manifests[0];
  const selectedReport = selected ? reportById.get(selected.id) : undefined;
  const entries: DisplayEntry[] = selected
    ? selected.entries.map((entry) =>
      selectedReport?.entries.find((candidate) => candidate.itemId === entry.itemId)
      ?? withoutReport(entry))
    : [];

  function selectManifest(manifestId: string) {
    setLocalSelectedId(manifestId);
    setMobileListOpen(false);
    onSelectManifest?.(manifestId);
    window.requestAnimationFrame(() => detailHeadingRef.current?.focus());
  }

  if (!allManifests.length) {
    return (
      <section className="challenge-set-activity challenge-set-empty" aria-labelledby="challenge-set-empty-title">
        <h2 id="challenge-set-empty-title">No Challenge Set activity yet</h2>
        <p>
          Select two or more problems in the catalog, then launch the exact
          selection as untimed practice or a timed round.
        </p>
      </section>
    );
  }

  return (
    <section className="challenge-set-activity" aria-labelledby="challenge-set-activity-title">
      <header className="challenge-set-hero">
        <div>
          <span className="eyebrow">Challenge Set activity</span>
          <h2 id="challenge-set-activity-title">One immutable ledger for each problem set</h2>
          <p>
            Follow an exact catalog selection from launch through attempts,
            verification, and completion without losing its original revisions.
          </p>
        </div>
        <aside className="challenge-set-trust" aria-label="Challenge Set evidence scope">
          <strong>Activity progress only</strong>
          <p>
            Counts below describe this run. They are not a composite mastery,
            ranking, or interview-readiness score.
          </p>
        </aside>
      </header>

      <div className={`challenge-set-layout${selected && !mobileListOpen ? " has-selection" : ""}`}>
        <aside className="challenge-set-list-panel" aria-labelledby="challenge-set-list-title">
          <div className="challenge-set-list-heading">
            <div>
              <span className="eyebrow">Run ledger</span>
              <h3 id="challenge-set-list-title" ref={listHeadingRef} tabIndex={-1}>Challenge Sets</h3>
            </div>
            <div className="challenge-set-list-tools">
              <span aria-label={`${manifests.length} visible Challenge Sets`}>
                {manifests.length}
              </span>
              {archivedCount ? (
                <button
                  type="button"
                  aria-pressed={showArchived}
                  onClick={() => setShowArchived((visible) => !visible)}
                >
                  {showArchived
                    ? "Hide archived"
                    : `Show archived (${archivedCount})`}
                </button>
              ) : null}
            </div>
          </div>

          {active ? (
            <section className="challenge-set-list-group" aria-labelledby="challenge-set-active-title">
              <h4 id="challenge-set-active-title">Active now</h4>
              <ol>
                <ManifestListItem
                  manifest={active}
                  report={reportById.get(active.id)}
                  selected={selected?.id === active.id}
                  onSelect={() => selectManifest(active.id)}
                />
              </ol>
            </section>
          ) : null}

          {history.length ? (
            <section className="challenge-set-list-group" aria-labelledby="challenge-set-history-title">
              <h4 id="challenge-set-history-title">History</h4>
              <ol>
                {history.map((manifest) => (
                  <ManifestListItem
                    key={manifest.id}
                    manifest={manifest}
                    report={reportById.get(manifest.id)}
                    selected={selected?.id === manifest.id}
                    onSelect={() => selectManifest(manifest.id)}
                  />
                ))}
              </ol>
            </section>
          ) : null}
          {!active && !history.length ? (
            <p className="challenge-set-filter-empty">
              All Challenge Set activity is archived. Show archived runs to
              inspect their immutable snapshots.
            </p>
          ) : null}
        </aside>

        {selected ? (
          <article className="challenge-set-detail" aria-labelledby="challenge-set-detail-title">
            <button
              type="button"
              className="challenge-set-back"
              onClick={() => {
                setMobileListOpen(true);
                window.requestAnimationFrame(() => listHeadingRef.current?.focus());
              }}
            >
              ← All Challenge Sets
            </button>

            <header className="challenge-set-detail-heading">
              <div>
                <span className="eyebrow">{sourceLabel(selected.source)} snapshot</span>
                <h3 id="challenge-set-detail-title" ref={detailHeadingRef} tabIndex={-1}>{selected.title}</h3>
                <p>{modeLabel(selected)} · {durationLabel(selected)} · created {formatDate(selected.createdAt)}</p>
              </div>
              <span data-status={selected.status}>{statusLabel(selected.status)}</span>
            </header>

            <dl className="challenge-set-summary" aria-label="Challenge Set activity summary">
              <div>
                <dt>Attempted</dt>
                <dd>{selectedReport?.attemptedCount ?? 0}<small> / {entries.length}</small></dd>
              </div>
              <div>
                <dt>Accepted</dt>
                <dd>{selectedReport?.acceptedCount ?? 0}<small> / {entries.length}</small></dd>
              </div>
              <div>
                <dt>Current accepted</dt>
                <dd>{selectedReport?.currentAcceptedCount ?? 0}<small> / {entries.length}</small></dd>
              </div>
              <div>
                <dt>Pending</dt>
                <dd>{selectedReport?.pendingCount ?? 0}</dd>
              </div>
            </dl>

            <section className="challenge-set-snapshot" aria-labelledby="challenge-set-snapshot-title">
              <div>
                <span className="eyebrow">Frozen at launch</span>
                <h4 id="challenge-set-snapshot-title">Immutable problem snapshot</h4>
              </div>
              <p>
                Titles, order, content revisions, judge revisions, and expected
                time stay attached to this run even when the live catalog changes.
              </p>
              <ol>
                {entries.map((entry) => (
                  <li key={`${entry.itemId}:${entry.contentRevision}`}>
                    <article className="challenge-set-entry">
                      <span className="challenge-set-entry-order" aria-label={`Problem ${entry.order + 1}`}>
                        {entry.order + 1}
                      </span>
                      <div className="challenge-set-entry-body">
                        <div className="challenge-set-entry-heading">
                          <div>
                            <h5>{entry.title}</h5>
                            <p>{entry.lane} · {entry.difficulty} · about {entry.estimatedMinutes} min</p>
                          </div>
                          <span data-evidence={entry.status}>{evidenceLabel(entry.status)}</span>
                        </div>
                        <dl>
                          <div><dt>Content rev</dt><dd>{entry.contentRevision}</dd></div>
                          <div><dt>Judge rev</dt><dd>{entry.judgeRevision ?? "Not judged"}</dd></div>
                          <div><dt>Attempts</dt><dd>{entry.attemptCount}</dd></div>
                          <div><dt>Submissions</dt><dd>{entry.submissionCount}</dd></div>
                        </dl>
                        {!entry.currentEvidenceEligible ? (
                          <p className="challenge-set-entry-disclosure">
                            The live catalog no longer matches this snapshot. Its
                            history remains visible, but it cannot claim current evidence.
                          </p>
                        ) : entry.accepted && !entry.acceptedCurrent ? (
                          <p className="challenge-set-entry-disclosure">
                            Accepted under the frozen run, but the judge receipt does
                            not match the current evidence revision.
                          </p>
                        ) : null}
                      </div>
                    </article>
                  </li>
                ))}
              </ol>
            </section>

            <footer className="challenge-set-actions">
              <p>
                {selected.execution
                  ? `Linked to ${executionLabel(selected.execution)} ${selected.execution.id}.`
                  : "This draft has not launched an execution yet."}
              </p>
              <div>
                {selected.status === "active" && selected.execution ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onResume(selected.id, selected.execution!)}
                  >
                    Resume Challenge Set
                  </button>
                ) : selected.execution ? (
                  <button
                    type="button"
                    className="outline-button"
                    onClick={() => onOpenExecution(selected.execution!)}
                  >
                    Open linked {executionLabel(selected.execution)}
                  </button>
                ) : null}
                {selected.status === "completed" || selected.status === "ended" ? (
                  <button type="button" onClick={() => onArchive(selected.id)}>Archive activity</button>
                ) : null}
              </div>
            </footer>
          </article>
        ) : null}
      </div>
    </section>
  );
}
