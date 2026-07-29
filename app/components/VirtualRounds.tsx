"use client";

import type { KeyboardEvent } from "react";
import type { ContestSection } from "../lib/routes.mjs";

export type VirtualRoundProblemStatus =
  | "unopened"
  | "opened"
  | "attempted"
  | "partial"
  | "accepted"
  | "skipped";

export type VirtualRoundDifficulty = string;

export type VirtualRoundPreset = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  problemCount: number;
  maxScore: number;
  available: boolean;
  disabledReason?: string;
  detail?: string;
};

export type ActiveVirtualRoundProblem = {
  id: string;
  index: number;
  identityRevealed: boolean;
  title?: string;
  status: VirtualRoundProblemStatus;
  score: number;
  maxScore: number;
  submissionCount: number;
  flagged: boolean;
};

export type ActiveVirtualRound = {
  id: string;
  title: string;
  status: "active" | "finalizing";
  score: number;
  maxScore: number;
  acceptedCount: number;
  currentProblemId: string;
  problems: ActiveVirtualRoundProblem[];
  announcement?: string;
};

export type VirtualRoundSubmission = {
  id: string;
  elapsed: string;
  verdict: string;
  score: number;
  maxScore: number;
  note?: string;
};

export type VirtualRoundReportProblem = {
  id: string;
  index: number;
  title: string;
  pattern: string;
  difficulty: VirtualRoundDifficulty;
  revision: string;
  status: VirtualRoundProblemStatus;
  score: number;
  maxScore: number;
  submissionCount: number;
  availableForRetry: boolean;
  submissions: VirtualRoundSubmission[];
};

export type VirtualRoundReport = {
  id: string;
  presetId: string;
  title: string;
  completedAt: string;
  outcome: "submitted" | "expired";
  score: number;
  maxScore: number;
  scorePercent: number;
  acceptedCount: number;
  problemCount: number;
  elapsed: string;
  elapsedMs: number;
  penalty: string;
  penaltyMs: number;
  archived?: boolean;
  problems: VirtualRoundReportProblem[];
};

export type VirtualRoundStanding = {
  id: string;
  presetId: string;
  title: string;
  completedAt: string;
  score: number;
  maxScore: number;
  acceptedCount: number;
  problemCount: number;
  elapsed: string;
  penalty: string;
  rank: number;
  cohortSize: number;
  archived: boolean;
};

export type VirtualRoundSummary = {
  totalRounds: number;
  averageScorePercent: number;
  bestScorePercent: number;
  totalAccepted: number;
  totalProblems: number;
  latestRoundId?: string;
  latestScorePercent: number;
  strongestPreset?: null | {
    title: string;
    rounds: number;
    averageScorePercent: number;
  };
  patternPerformance: Array<{
    pattern: string;
    problems: number;
    accepted: number;
    scorePercent: number;
  }>;
};

export type VirtualRoundsProps = {
  section: ContestSection;
  selectedReportId?: string;
  presets: VirtualRoundPreset[];
  activeRound: ActiveVirtualRound | null;
  history: VirtualRoundReport[];
  standings: VirtualRoundStanding[];
  summary: VirtualRoundSummary;
  remainingMs: number;
  onSectionChange: (section: ContestSection) => void;
  onOpenReport: (roundId: string) => void;
  onStart: (presetId: string) => void;
  onResume: (roundId: string) => void;
  onOpenProblem: (roundId: string, problemId: string) => void;
  onToggleFlag: (roundId: string, problemId: string) => void;
  onFinish: (roundId: string) => void;
  onArchive: (roundId: string) => void;
  onRetryProblem: (roundId: string, problemId: string) => void;
  onInspectSubmission: (submissionId: string) => void;
};

const SECTION_LABELS: Record<ContestSection, string> = {
  overview: "Overview",
  live: "Live round",
  history: "History",
  standings: "Personal standings",
  review: "Review",
};

const SECTIONS = Object.keys(SECTION_LABELS) as ContestSection[];

function secondsRemaining(remainingMs: number) {
  return Number.isFinite(remainingMs)
    ? Math.max(0, Math.floor(remainingMs / 1000))
    : 0;
}

function formatRemaining(remainingMs: number) {
  const totalSeconds = secondsRemaining(remainingMs);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function formatCompletedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: VirtualRoundProblemStatus) {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function problemLabel(problem: ActiveVirtualRoundProblem) {
  return problem.identityRevealed && problem.title
    ? problem.title
    : `Problem ${problem.index + 1}`;
}

function ContestTabs({
  section,
  onChange,
}: {
  section: ContestSection;
  onChange: (section: ContestSection) => void;
}) {
  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    current: ContestSection,
  ) {
    const currentIndex = SECTIONS.indexOf(current);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % SECTIONS.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + SECTIONS.length) % SECTIONS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = SECTIONS.length - 1;
    else return;
    event.preventDefault();
    const next = SECTIONS[nextIndex];
    onChange(next);
    window.setTimeout(() => document.getElementById(`contest-tab-${next}`)?.focus(), 0);
  }

  return (
    <nav className="contest-tabs" aria-label="Contest center sections">
      <div role="tablist" aria-label="Contest center">
        {SECTIONS.map((candidate) => (
          <button
            id={`contest-tab-${candidate}`}
            type="button"
            role="tab"
            aria-selected={section === candidate}
            aria-controls="contest-center-panel"
            tabIndex={section === candidate ? 0 : -1}
            className={section === candidate ? "is-active" : undefined}
            onClick={() => onChange(candidate)}
            onKeyDown={(event) => handleKeyDown(event, candidate)}
            key={candidate}
          >
            {SECTION_LABELS[candidate]}
          </button>
        ))}
      </div>
    </nav>
  );
}

function PresetCard({
  preset,
  onStart,
}: {
  preset: VirtualRoundPreset;
  onStart: (presetId: string) => void;
}) {
  const reasonId = `round-preset-${preset.id}-reason`;
  const disabledReason = preset.available
    ? undefined
    : preset.disabledReason ?? "This preset is not available on this device yet.";
  return (
    <article className={`virtual-round-preset${preset.available ? "" : " is-unavailable"}`}>
      <div className="virtual-round-preset-topline">
        <span>{preset.durationMinutes} minutes</span>
        <span>{preset.available ? "Ready" : "Unavailable"}</span>
      </div>
      <h3>{preset.title}</h3>
      <p>{preset.description}</p>
      <dl className="virtual-round-preset-stats">
        <div><dt>Problems</dt><dd>{preset.problemCount}</dd></div>
        <div><dt>Local points</dt><dd>{preset.maxScore}</dd></div>
        <div><dt>Order</dt><dd>Any</dd></div>
      </dl>
      {preset.detail ? <p className="virtual-round-preset-detail">{preset.detail}</p> : null}
      {disabledReason ? <p className="virtual-round-disabled-reason" id={reasonId}>{disabledReason}</p> : null}
      <button
        className="primary-button"
        type="button"
        disabled={!preset.available}
        aria-describedby={disabledReason ? reasonId : undefined}
        onClick={() => onStart(preset.id)}
      >
        {preset.available ? `Start ${preset.title}` : `${preset.title} unavailable`}
      </button>
    </article>
  );
}

function ActiveRoundDashboard({
  round,
  remainingMs,
  onResume,
  onOpenProblem,
  onToggleFlag,
  onFinish,
}: {
  round: ActiveVirtualRound;
  remainingMs: number;
  onResume: (roundId: string) => void;
  onOpenProblem: (roundId: string, problemId: string) => void;
  onToggleFlag: (roundId: string, problemId: string) => void;
  onFinish: (roundId: string) => void;
}) {
  const remaining = formatRemaining(remainingMs);
  const remainingSeconds = secondsRemaining(remainingMs);
  const currentProblem = round.problems.find((problem) => problem.id === round.currentProblemId);
  const finalizing = round.status === "finalizing";
  return (
    <section className="virtual-round-active" aria-labelledby={`active-round-${round.id}`}>
      <div className="virtual-round-section-heading">
        <div>
          <span className="eyebrow">{finalizing ? "Finalizing local round" : "Round in progress"}</span>
          <h2 id={`active-round-${round.id}`}>{round.title}</h2>
          <p>{finalizing ? "The last on-time submission is still being judged." : "Move between problems in any order. Opened identities stay visible."}</p>
        </div>
        <div className="virtual-round-clock" role="timer" aria-label={`${remaining} remaining`}>
          <span>Time remaining</span>
          <time dateTime={`PT${remainingSeconds}S`}><strong>{remaining}</strong></time>
        </div>
      </div>
      {round.announcement ? <p className="virtual-round-announcement" role="status" aria-live="polite">{round.announcement}</p> : null}
      <dl className="virtual-round-scoreboard" aria-label="Current round score">
        <div><dt>Local score</dt><dd>{round.score}/{round.maxScore}</dd></div>
        <div><dt>Accepted</dt><dd>{round.acceptedCount}/{round.problems.length}</dd></div>
        <div><dt>Opened</dt><dd>{round.problems.filter((problem) => problem.identityRevealed).length}/{round.problems.length}</dd></div>
      </dl>
      <div className="virtual-round-actions">
        <button className="primary-button" type="button" disabled={!currentProblem || finalizing} onClick={() => onResume(round.id)}>
          {currentProblem ? `Resume ${problemLabel(currentProblem)}` : "No current problem"}
        </button>
        <button className="danger-button" type="button" disabled={finalizing} onClick={() => onFinish(round.id)}>
          {finalizing ? "Waiting for local judge" : "Finish and lock score"}
        </button>
      </div>
      <nav className="virtual-round-navigator" aria-label="Round problems">
        <ol>
          {round.problems.map((problem) => {
            const label = problemLabel(problem);
            const isCurrent = problem.id === round.currentProblemId;
            return (
              <li className={`${problem.status}${isCurrent ? " is-current" : ""}${problem.flagged ? " is-flagged" : ""}`} key={problem.id}>
                <button className="virtual-round-problem-open" type="button" disabled={finalizing} aria-current={isCurrent ? "step" : undefined} onClick={() => onOpenProblem(round.id, problem.id)}>
                  <span className="virtual-round-problem-number">{problem.index + 1}</span>
                  <span className="virtual-round-problem-copy">
                    <strong>{label}</strong>
                    <small>{statusLabel(problem.status)} / {problem.score}/{problem.maxScore} points / {problem.submissionCount} submission{problem.submissionCount === 1 ? "" : "s"}</small>
                  </span>
                </button>
                <button className="virtual-round-flag-button" type="button" disabled={finalizing} aria-pressed={problem.flagged} aria-label={`${problem.flagged ? "Remove flag from" : "Flag"} ${label}`} onClick={() => onToggleFlag(round.id, problem.id)}>
                  <span aria-hidden="true">{problem.flagged ? "Flagged" : "Flag"}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </section>
  );
}

function SummaryMetrics({ summary }: { summary: VirtualRoundSummary }) {
  return (
    <dl className="contest-summary-grid" aria-label="Personal contest summary">
      <div><dt>Rounds completed</dt><dd>{summary.totalRounds}</dd></div>
      <div><dt>Average score</dt><dd>{summary.averageScorePercent}%</dd></div>
      <div><dt>Best score</dt><dd>{summary.bestScorePercent}%</dd></div>
      <div><dt>Problems accepted</dt><dd>{summary.totalAccepted}/{summary.totalProblems}</dd></div>
    </dl>
  );
}

function HistoryList({
  history,
  onOpenReport,
}: {
  history: VirtualRoundReport[];
  onOpenReport: (roundId: string) => void;
}) {
  if (!history.length) return <p className="virtual-round-history-empty">Finish a round to create your first immutable local report.</p>;
  return (
    <div className="contest-history-list">
      {history.map((report) => (
        <article className={`contest-history-row${report.archived ? " is-archived" : ""}`} key={report.id}>
          <div className="contest-history-rank"><strong>{report.scorePercent}%</strong><span>{report.score}/{report.maxScore}</span></div>
          <div className="contest-history-copy">
            <span className="eyebrow">{report.title} · {report.outcome === "expired" ? "Time expired" : "Submitted"}</span>
            <h3>{report.acceptedCount}/{report.problemCount} accepted</h3>
            <p>{formatCompletedAt(report.completedAt)} · {report.elapsed} elapsed · {report.penalty}</p>
          </div>
          <div className="contest-history-actions">
            {report.archived ? <span>Archived</span> : null}
            <button className="outline-button" type="button" onClick={() => onOpenReport(report.id)}>Review round</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function PersonalStandings({
  standings,
  onOpenReport,
}: {
  standings: VirtualRoundStanding[];
  onOpenReport: (roundId: string) => void;
}) {
  if (!standings.length) return <p className="virtual-round-history-empty">Personal standings appear after your first finished round.</p>;
  return (
    <div className="contest-standings-scroll" role="region" aria-label="Personal standings table" tabIndex={0}>
      <table className="contest-standings-table">
        <caption>Ranks compare only your retained attempts within the same round format.</caption>
        <thead><tr><th scope="col">Personal rank</th><th scope="col">Format</th><th scope="col">Score</th><th scope="col">Accepted</th><th scope="col">Penalty</th><th scope="col">Elapsed</th><th scope="col">Finished</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {standings.map((entry) => (
            <tr key={entry.id}>
              <td><strong>#{entry.rank}</strong> of {entry.cohortSize}</td>
              <td>{entry.title}</td>
              <td>{entry.score}/{entry.maxScore}</td>
              <td>{entry.acceptedCount}/{entry.problemCount}</td>
              <td>{entry.penalty}</td>
              <td>{entry.elapsed}</td>
              <td>{formatCompletedAt(entry.completedAt)}</td>
              <td><button className="text-button" type="button" onClick={() => onOpenReport(entry.id)}>Review</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportProblem({
  reportId,
  problem,
  onRetryProblem,
  onInspectSubmission,
}: {
  reportId: string;
  problem: VirtualRoundReportProblem;
  onRetryProblem: (roundId: string, problemId: string) => void;
  onInspectSubmission: (submissionId: string) => void;
}) {
  return (
    <li className="virtual-round-report-problem">
      <div className="virtual-round-report-problem-heading">
        <div><span>Problem {problem.index + 1}</span><h4>{problem.title}</h4></div>
        <strong>{problem.score}/{problem.maxScore}</strong>
      </div>
      <dl className="virtual-round-problem-evidence">
        <div><dt>Pattern</dt><dd>{problem.pattern}</dd></div>
        <div><dt>Difficulty</dt><dd>{problem.difficulty}</dd></div>
        <div><dt>Revision</dt><dd>{problem.revision}</dd></div>
        <div><dt>Status</dt><dd>{statusLabel(problem.status)}</dd></div>
        <div><dt>Submissions</dt><dd>{problem.submissionCount}</dd></div>
      </dl>
      <div className="contest-problem-actions">
        <button className="outline-button" type="button" disabled={!problem.availableForRetry} onClick={() => onRetryProblem(reportId, problem.id)}>
          {problem.availableForRetry ? "Retry as fresh practice" : "Current revision unavailable"}
        </button>
        <span>A retry creates a separate practice attempt and never changes this score.</span>
      </div>
      <div className="virtual-round-timeline">
        <h5>Submission timeline</h5>
        {problem.submissions.length ? (
          <div className="contest-timeline-scroll" role="region" aria-label={`Submission timeline for ${problem.title}`} tabIndex={0}>
            <table>
              <thead><tr><th scope="col">Elapsed</th><th scope="col">Verdict</th><th scope="col">Score</th><th scope="col">Evidence note</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {problem.submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>{submission.elapsed}</td><td>{submission.verdict}</td><td>{submission.score}/{submission.maxScore}</td><td>{submission.note ?? "None"}</td>
                    <td><button className="text-button" type="button" onClick={() => onInspectSubmission(submission.id)}>Inspect source</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No submissions recorded.</p>}
      </div>
    </li>
  );
}

function RoundReview({
  report,
  onArchive,
  onRetryProblem,
  onInspectSubmission,
}: {
  report: VirtualRoundReport;
  onArchive: (roundId: string) => void;
  onRetryProblem: (roundId: string, problemId: string) => void;
  onInspectSubmission: (submissionId: string) => void;
}) {
  return (
    <article className={`virtual-round-report contest-review-report${report.archived ? " is-archived" : ""}`} aria-labelledby={`round-report-${report.id}`}>
      <div className="virtual-round-report-heading">
        <div><span className="eyebrow">Immutable local report</span><h2 id={`round-report-${report.id}`}>{report.title}</h2><p>Finished {formatCompletedAt(report.completedAt)}</p></div>
        <div className="virtual-round-report-score"><strong>{report.score}/{report.maxScore}</strong><span>locked local points</span></div>
      </div>
      <dl className="virtual-round-report-stats">
        <div><dt>Accepted</dt><dd>{report.acceptedCount}/{report.problemCount}</dd></div>
        <div><dt>Elapsed</dt><dd>{report.elapsed}</dd></div>
        <div><dt>Penalty</dt><dd>{report.penalty}</dd></div>
      </dl>
      <ol className="virtual-round-report-problems">
        {report.problems.map((problem) => <ReportProblem reportId={report.id} problem={problem} onRetryProblem={onRetryProblem} onInspectSubmission={onInspectSubmission} key={`${report.id}-${problem.id}`} />)}
      </ol>
      <div className="virtual-round-report-actions">
        {report.archived ? <span>Archived</span> : <button className="outline-button" type="button" onClick={() => onArchive(report.id)}>Archive report</button>}
      </div>
    </article>
  );
}

export function VirtualRounds({
  section,
  selectedReportId,
  presets,
  activeRound,
  history,
  standings,
  summary,
  remainingMs,
  onSectionChange,
  onOpenReport,
  onStart,
  onResume,
  onOpenProblem,
  onToggleFlag,
  onFinish,
  onArchive,
  onRetryProblem,
  onInspectSubmission,
}: VirtualRoundsProps) {
  const selectedReport = selectedReportId
    ? history.find((report) => report.id === selectedReportId) ?? null
    : history[0] ?? null;
  const weakestPatterns = summary.patternPerformance.slice(0, 3);
  return (
    <main id="main-content" tabIndex={-1} className="page-container virtual-rounds-page contest-center-page">
      <header className="page-heading virtual-rounds-heading">
        <div><span className="eyebrow">Contest center</span><h1>Train the whole interview clock.</h1><p>Run an adaptive timed set, manage several problems, then review every scoring decision and retry the gaps.</p></div>
        <aside className="virtual-round-trust-card" aria-label="Round trust and privacy details"><strong>Private practice standings</strong><p>Scores are device-local and not proctored. Your ranking compares only your own retained rounds.</p></aside>
      </header>

      {activeRound ? (
        <section className="contest-active-banner" aria-label="Active round summary">
          <div><span className="status-dot" aria-hidden="true" /><span><strong>{activeRound.title} is live</strong><small>{activeRound.acceptedCount}/{activeRound.problems.length} accepted · {activeRound.score}/{activeRound.maxScore} points</small></span></div>
          <button className="primary-button" type="button" onClick={() => onSectionChange("live")}>Open live round</button>
        </section>
      ) : null}

      <ContestTabs section={section} onChange={onSectionChange} />
      <div id="contest-center-panel" role="tabpanel" aria-labelledby={`contest-tab-${section}`} tabIndex={0} className="contest-panel">
        {section === "overview" ? (
          <>
            <section className="contest-overview-hero" aria-labelledby="contest-overview-title">
              <div><span className="eyebrow">Your season</span><h2 id="contest-overview-title">A contest dashboard built for deliberate practice.</h2><p>Use short rounds to rebuild implementation speed, then move up only when accuracy and pacing hold together.</p></div>
              <SummaryMetrics summary={summary} />
            </section>
            {summary.totalRounds ? (
              <section className="contest-insights" aria-labelledby="contest-insights-title">
                <div className="virtual-round-section-heading"><div><span className="eyebrow">Coach view</span><h2 id="contest-insights-title">What the round evidence says</h2></div></div>
                <div className="contest-insight-grid">
                  <article><span>Strongest format</span><strong>{summary.strongestPreset?.title ?? "Not enough evidence"}</strong><p>{summary.strongestPreset ? `${summary.strongestPreset.averageScorePercent}% average across ${summary.strongestPreset.rounds} round${summary.strongestPreset.rounds === 1 ? "" : "s"}.` : "Complete a round to begin."}</p></article>
                  <article><span>Latest result</span><strong>{summary.latestScorePercent}%</strong><p>Open the latest report to inspect timing, verdicts, and exact submitted source.</p>{summary.latestRoundId ? <button className="text-button" type="button" onClick={() => onOpenReport(summary.latestRoundId!)}>Review latest round →</button> : null}</article>
                  <article><span>Patterns to revisit</span><strong>{weakestPatterns[0]?.pattern ?? "Awaiting evidence"}</strong><p>{weakestPatterns.length ? weakestPatterns.map((entry) => `${entry.pattern} ${entry.scorePercent}%`).join(" · ") : "Your weakest recurring patterns will appear here."}</p></article>
                </div>
              </section>
            ) : (
              <section className="virtual-round-empty"><span className="eyebrow">First contest</span><h2>Start with Sprint Round.</h2><p>Two problems and 45 minutes is enough pressure to expose rusty syntax without turning practice into punishment.</p></section>
            )}
            <section className="virtual-round-presets" aria-labelledby="virtual-round-presets-title">
              <div className="virtual-round-section-heading"><div><span className="eyebrow">Choose a format</span><h2 id="virtual-round-presets-title">Adaptive round presets</h2></div><span>{presets.length} formats</span></div>
              <div className="virtual-round-preset-grid">{presets.map((preset) => <PresetCard preset={preset} onStart={onStart} key={preset.id} />)}</div>
            </section>
            <details className="virtual-round-disclosure">
              <summary>Scoring, privacy, and evidence boundary</summary>
              <div><p>Accepted problems earn 100 points. Partial test progress can earn partial points; a solved problem adds its acceptance time plus five minutes per earlier wrong submission.</p><ul><li>Problem sets adapt to your history and may differ between rounds.</li><li>Scores and source stay in this browser profile unless you export a backup.</li><li>No global rank, interview-readiness rating, certification, or hiring signal is produced.</li></ul></div>
            </details>
          </>
        ) : null}

        {section === "live" ? (
          activeRound ? <ActiveRoundDashboard round={activeRound} remainingMs={remainingMs} onResume={onResume} onOpenProblem={onOpenProblem} onToggleFlag={onToggleFlag} onFinish={onFinish} /> : (
            <section className="contest-live-empty"><div className="virtual-round-empty"><span className="eyebrow">No round in progress</span><h2>Start when you can protect the full clock.</h2><p>The timer keeps running if you change tabs or close the browser. A finished score is immutable.</p></div><div className="virtual-round-preset-grid">{presets.map((preset) => <PresetCard preset={preset} onStart={onStart} key={preset.id} />)}</div></section>
          )
        ) : null}

        {section === "history" ? (
          <section className="virtual-round-history" aria-labelledby="virtual-round-history-title"><div className="virtual-round-section-heading"><div><span className="eyebrow">Local history</span><h2 id="virtual-round-history-title">Finished round reports</h2><p>Compact summaries keep up to twelve retained reports easy to scan.</p></div><span>{history.length} report{history.length === 1 ? "" : "s"}</span></div><HistoryList history={history} onOpenReport={onOpenReport} /></section>
        ) : null}

        {section === "standings" ? (
          <section className="virtual-round-history contest-standings" aria-labelledby="contest-standings-title"><div className="virtual-round-section-heading"><div><span className="eyebrow">This browser profile only</span><h2 id="contest-standings-title">Personal standings</h2><p>Ranks restart for Sprint, Standard, and Endurance. Adaptive problem mixes can differ, so this is a pacing history—not a public leaderboard.</p></div><span>{standings.length} result{standings.length === 1 ? "" : "s"}</span></div><PersonalStandings standings={standings} onOpenReport={onOpenReport} /></section>
        ) : null}

        {section === "review" ? (
          <section className="contest-review" aria-labelledby="contest-review-title"><div className="virtual-round-section-heading"><div><span className="eyebrow">Post-contest review</span><h2 id="contest-review-title">Turn the score into the next practice decision.</h2><p>Inspect exact submission receipts or retry a current problem revision without altering the locked report.</p></div>{history.length ? <button className="outline-button" type="button" onClick={() => onSectionChange("history")}>Choose another report</button> : null}</div>{selectedReport ? <RoundReview report={selectedReport} onArchive={onArchive} onRetryProblem={onRetryProblem} onInspectSubmission={onInspectSubmission} /> : <p className="virtual-round-history-empty">{selectedReportId ? "That retained report is unavailable. Choose another report from History." : "Finish a round before opening post-contest review."}</p>}</section>
        ) : null}
      </div>
    </main>
  );
}
