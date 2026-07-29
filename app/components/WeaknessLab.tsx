"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  WEAKNESS_FILTERS,
  WEAKNESS_LANES,
  filterWeaknessCases,
  type WeaknessCase,
  type WeaknessEvidence,
  type WeaknessFilter,
  type WeaknessLabModel,
  type WeaknessLane,
} from "../lib/weakness-lab.mjs";

type WeaknessLabProps = {
  model: WeaknessLabModel;
  filter: WeaknessFilter;
  lane: WeaknessLane;
  selectedCaseId?: string;
  onRouteChange: (input: {
    filter: WeaknessFilter;
    lane: WeaknessLane;
    caseId?: string;
  }) => void;
  onStartCase: (value: WeaknessCase) => void;
  onOpenEvidence: (value: WeaknessEvidence) => void;
  onBrowseCase: (value: WeaknessCase) => void;
  onOpenAssessment: () => void;
  onOpenTransferLab: () => void;
};

const FILTER_LABELS: Record<WeaknessFilter, string> = {
  priority: "Priority inbox",
  due: "Due now",
  stabilizing: "Stabilizing",
  resolved: "Resolved",
  all: "All cases",
};

const LANE_LABELS: Record<WeaknessLane, string> = {
  all: "All lanes",
  python: "Python",
  swift: "Swift",
  ios: "iOS systems",
};

const STATUS_LABELS = {
  open: "Open",
  due: "Due now",
  stabilizing: "Stabilizing",
  resolved: "Resolved",
} as const;

const SOURCE_LABELS: Record<WeaknessEvidence["kind"], string> = {
  "learning-event": "Practice reflection",
  "solution-review": "Solution review",
  assessment: "Baseline assessment",
  "mock-debrief": "Mock debrief",
  transfer: "Transfer Lab",
};

function compactDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
      }).format(date);
}

function dueCopy(value: WeaknessCase, now = Date.now()) {
  if (value.status === "resolved") return "Closed with delayed transfer evidence";
  const due = Date.parse(value.dueAt);
  if (!Number.isFinite(due)) return "Review date unavailable";
  const days = Math.ceil((due - now) / 86_400_000);
  if (days <= 0) return "Ready for remediation now";
  if (days === 1) return "Next check tomorrow";
  return `Next check in ${days} days`;
}

function laneTone(value: WeaknessCase["lane"]) {
  if (value === "ios") return "ios";
  if (value === "swift") return "swift";
  return "python";
}

function caseSummary(value: WeaknessCase) {
  const sourceCount = value.sourceKinds.length;
  const evidenceCount = value.recurrence;
  return `${evidenceCount} piece${evidenceCount === 1 ? "" : "s"} of evidence across ${sourceCount} source${sourceCount === 1 ? "" : "s"}`;
}

export function WeaknessLab({
  model,
  filter,
  lane,
  selectedCaseId,
  onRouteChange,
  onStartCase,
  onOpenEvidence,
  onBrowseCase,
  onOpenAssessment,
  onOpenTransferLab,
}: WeaknessLabProps) {
  const visibleCases = useMemo(
    () => filterWeaknessCases(model.cases, { filter, lane }),
    [model.cases, filter, lane],
  );
  const selectedCase =
    visibleCases.find((entry) => entry.id === selectedCaseId) ??
    visibleCases[0] ??
    null;
  const detailRef = useRef<HTMLElement>(null);
  const lastSelectedRef = useRef(selectedCase?.id);

  useEffect(() => {
    if (!selectedCase || lastSelectedRef.current === selectedCase.id) return;
    lastSelectedRef.current = selectedCase.id;
    if (window.matchMedia("(max-width: 760px)").matches) {
      window.requestAnimationFrame(() => detailRef.current?.focus());
    }
  }, [selectedCase]);

  function chooseFilter(next: WeaknessFilter) {
    const nextCases = filterWeaknessCases(model.cases, { filter: next, lane });
    onRouteChange({ filter: next, lane, caseId: nextCases[0]?.id });
  }

  function chooseLane(next: WeaknessLane) {
    const nextCases = filterWeaknessCases(model.cases, { filter, lane: next });
    onRouteChange({ filter, lane: next, caseId: nextCases[0]?.id });
  }

  return (
    <main id="main-content" tabIndex={-1} className="page-container weakness-lab-page">
      <section className="weakness-hero" aria-labelledby="weakness-lab-title">
        <div className="weakness-hero-copy">
          <span className="eyebrow">Private remediation center</span>
          <h1 id="weakness-lab-title">Turn mistakes into the next right practice.</h1>
          <p>
            Weakness Lab unifies your debriefs, accepted-solve reviews, baselines,
            mocks, and transfer evidence. One typo never becomes a diagnosis; recurring,
            deliberate evidence does.
          </p>
          <div className="weakness-hero-actions">
            {model.nextCase ? (
              <button className="primary-button" onClick={() => onStartCase(model.nextCase!)}>
                Start highest-priority repair →
              </button>
            ) : (
              <button className="primary-button" onClick={onOpenAssessment}>
                Create a baseline →
              </button>
            )}
            <button className="outline-button" onClick={onOpenAssessment}>
              Run a diagnostic
            </button>
          </div>
        </div>
        <div className="weakness-scoreboard" aria-label="Weakness Lab summary">
          <div className="weakness-score is-due">
            <strong>{model.summary.due}</strong>
            <span>due now</span>
          </div>
          <div className="weakness-score">
            <strong>{model.summary.open}</strong>
            <span>open</span>
          </div>
          <div className="weakness-score is-stable">
            <strong>{model.summary.stabilizing}</strong>
            <span>stabilizing</span>
          </div>
          <div className="weakness-score is-resolved">
            <strong>{model.summary.resolved}</strong>
            <span>resolved</span>
          </div>
          <p>
            Local learning evidence only. This is a remediation queue—not a score,
            certification, or hiring signal.
          </p>
        </div>
      </section>

      {model.summary.tagCounts.length > 0 && (
        <section className="weakness-signal-strip" aria-label="Most repeated weakness signals">
          <span>Repeated signals</span>
          {model.summary.tagCounts.slice(0, 4).map((entry) => (
            <b key={entry.id}>
              {entry.label} <em>{entry.count}</em>
            </b>
          ))}
        </section>
      )}

      <section className="weakness-controls" aria-label="Weakness Lab filters">
        <div className="weakness-filter-tabs" role="tablist" aria-label="Case status">
          {WEAKNESS_FILTERS.map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              className={filter === value ? "active" : ""}
              onClick={() => chooseFilter(value)}
            >
              {FILTER_LABELS[value]}
              {value === "due" && model.summary.due > 0 && <span>{model.summary.due}</span>}
            </button>
          ))}
        </div>
        <div className="weakness-lane-filter" aria-label="Practice lane">
          {WEAKNESS_LANES.map((value) => (
            <button
              key={value}
              aria-pressed={lane === value}
              className={lane === value ? "active" : ""}
              onClick={() => chooseLane(value)}
            >
              {LANE_LABELS[value]}
              {value !== "all" && <small>{model.summary.laneCounts[value]}</small>}
            </button>
          ))}
        </div>
      </section>

      {visibleCases.length === 0 ? (
        <section className="weakness-empty">
          <span className="empty-orbit" aria-hidden="true">◎</span>
          <div>
            <span className="eyebrow">No cases here</span>
            <h2>{filter === "resolved" ? "Nothing has cleared the transfer gate yet." : "No matching remediation evidence."}</h2>
            <p>
              Complete a diagnostic, add a post-attempt reflection, or debrief a mock.
              Weakness Lab waits for deliberate evidence instead of guessing from raw errors.
            </p>
            <button className="primary-button" onClick={onOpenAssessment}>Open Assess →</button>
          </div>
        </section>
      ) : (
        <div className="weakness-workspace">
          <aside className="weakness-case-list" aria-label="Remediation cases">
            <header>
              <span>{FILTER_LABELS[filter]}</span>
              <strong>{visibleCases.length}</strong>
            </header>
            {visibleCases.map((entry, index) => (
              <button
                key={entry.id}
                className={`weakness-case-card ${selectedCase?.id === entry.id ? "active" : ""}`}
                aria-current={selectedCase?.id === entry.id ? "true" : undefined}
                onClick={() => onRouteChange({ filter, lane, caseId: entry.id })}
              >
                <span className={`weakness-rank ${laneTone(entry.lane)}`}>{String(index + 1).padStart(2, "0")}</span>
                <span className="weakness-case-card-copy">
                  <small>
                    {LANE_LABELS[entry.lane]} · {STATUS_LABELS[entry.status]}
                  </small>
                  <strong>{entry.title}</strong>
                  <em>{caseSummary(entry)}</em>
                </span>
                <span className={`weakness-status is-${entry.status}`}>{entry.recurrence}</span>
              </button>
            ))}
          </aside>

          {selectedCase && (
            <article
              ref={detailRef}
              tabIndex={-1}
              className="weakness-case-detail"
              aria-labelledby="weakness-case-title"
            >
              <header className="weakness-detail-header">
                <div>
                  <span className={`weakness-lane-badge ${laneTone(selectedCase.lane)}`}>
                    {LANE_LABELS[selectedCase.lane]}
                  </span>
                  <span className={`weakness-status is-${selectedCase.status}`}>
                    {STATUS_LABELS[selectedCase.status]}
                  </span>
                  <h2 id="weakness-case-title">{selectedCase.title}</h2>
                  <p>{selectedCase.prompt}</p>
                </div>
                <div className="weakness-priority-meter" aria-label={`Priority ${selectedCase.priority}`}>
                  <span>Priority</span>
                  <strong>{selectedCase.priority}</strong>
                  <small>{dueCopy(selectedCase)}</small>
                </div>
              </header>

              <div className="weakness-detail-metrics">
                <span><strong>{selectedCase.recurrence}</strong> signals</span>
                <span><strong>{selectedCase.sourceKinds.length}</strong> evidence sources</span>
                <span><strong>{selectedCase.successes.length}</strong> later clean proofs</span>
                <span><strong>{selectedCase.transferRequired ? "Needed" : "Recorded"}</strong> transfer proof</span>
              </div>

              <section className="weakness-contract" aria-labelledby="weakness-contract-title">
                <header>
                  <span className="eyebrow">Closed-book repair contract</span>
                  <h3 id="weakness-contract-title">Retrieve → repair → transfer → rehearse</h3>
                </header>
                <ol>
                  <li><b>01</b><span><strong>Retrieve</strong><small>Commit the cue, invariant, and test plan before prior notes.</small></span></li>
                  <li><b>02</b><span><strong>Repair</strong><small>Find the first wrong decision—not only the first wrong line.</small></span></li>
                  <li><b>03</b><span><strong>Transfer</strong><small>Apply the decision to a sibling problem with changed constraints.</small></span></li>
                  <li><b>04</b><span><strong>Rehearse</strong><small>Explain the approach, verification, complexity, and closing aloud.</small></span></li>
                </ol>
              </section>

              <section className="weakness-queue" aria-labelledby="weakness-queue-title">
                <header>
                  <div>
                    <span className="eyebrow">Targeted practice queue</span>
                    <h3 id="weakness-queue-title">Three contexts, one decision.</h3>
                  </div>
                  <strong>{selectedCase.queue.reduce((sum, entry) => sum + entry.estimatedMinutes, 0)} min</strong>
                </header>
                {selectedCase.queue.length ? (
                  <ol>
                    {selectedCase.queue.map((entry, index) => (
                      <li key={entry.itemId}>
                        <span className="weakness-queue-index">{index + 1}</span>
                        <span>
                          <strong>{entry.title}</strong>
                          <small>{entry.rationale}</small>
                        </span>
                        <em>{entry.practiceKind === "solving" ? "Cold solve" : entry.practiceKind === "concept" ? "Concept recall" : `Stage ${entry.stage}`}</em>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="weakness-queue-empty">No current-revision catalog items match this evidence yet.</p>
                )}
                <div className="weakness-queue-actions">
                  <button
                    className="primary-button"
                    disabled={!selectedCase.queue.length || selectedCase.status === "resolved"}
                    onClick={() => onStartCase(selectedCase)}
                  >
                    {selectedCase.status === "resolved" ? "Case resolved" : "Start targeted session →"}
                  </button>
                  <button className="outline-button" onClick={() => onBrowseCase(selectedCase)}>
                    Browse matching problems
                  </button>
                  {selectedCase.transferRequired && selectedCase.lane === "python" && (
                    <button className="text-button" onClick={onOpenTransferLab}>Open Transfer Lab</button>
                  )}
                </div>
              </section>

              <section className="weakness-evidence" aria-labelledby="weakness-evidence-title">
                <header>
                  <div>
                    <span className="eyebrow">Why this is here</span>
                    <h3 id="weakness-evidence-title">Exact evidence trail</h3>
                  </div>
                  <small>Newest first · current device</small>
                </header>
                <ol>
                  {selectedCase.evidence.map((entry) => (
                    <li key={entry.id}>
                      <span className="weakness-evidence-dot" aria-hidden="true" />
                      <span>
                        <small>{SOURCE_LABELS[entry.kind]} · {compactDate(entry.occurredAt)}</small>
                        <strong>{entry.label}</strong>
                        <p>{entry.summary}</p>
                      </span>
                      <button className="text-button" onClick={() => onOpenEvidence(entry)}>
                        Open evidence →
                      </button>
                    </li>
                  ))}
                </ol>
              </section>

              <footer className="weakness-disclosure">
                A case resolves only after delayed independent evidence plus a distinct transfer proof.
                Hints, reference reveals, restored source, and self-ratings do not count as independent proof.
              </footer>
            </article>
          )}
        </div>
      )}
    </main>
  );
}
