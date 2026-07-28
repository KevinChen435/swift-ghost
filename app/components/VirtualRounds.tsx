"use client";

export type VirtualRoundProblemStatus =
  | "unopened"
  | "opened"
  | "attempted"
  | "partial"
  | "accepted"
  | "skipped";

/** Display-ready difficulty text supplied by the parent view model. */
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
  /** Announced politely when it changes; do not put timer text here. */
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
  submissions: VirtualRoundSubmission[];
};

export type VirtualRoundReport = {
  id: string;
  title: string;
  completedAt: string;
  score: number;
  maxScore: number;
  acceptedCount: number;
  problemCount: number;
  elapsed: string;
  penalty: string;
  archived?: boolean;
  problems: VirtualRoundReportProblem[];
};

export type VirtualRoundsProps = {
  presets: VirtualRoundPreset[];
  activeRound: ActiveVirtualRound | null;
  history: VirtualRoundReport[];
  remainingMs: number;
  onStart: (presetId: string) => void;
  onResume: (roundId: string) => void;
  onOpenProblem: (roundId: string, problemId: string) => void;
  onToggleFlag: (roundId: string, problemId: string) => void;
  onFinish: (roundId: string) => void;
  onArchive: (roundId: string) => void;
};

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
        <span>{preset.available ? "Available" : "Unavailable"}</span>
      </div>
      <h3>{preset.title}</h3>
      <p>{preset.description}</p>
      <dl className="virtual-round-preset-stats">
        <div>
          <dt>Problems</dt>
          <dd>{preset.problemCount}</dd>
        </div>
        <div>
          <dt>Local points</dt>
          <dd>{preset.maxScore}</dd>
        </div>
        <div>
          <dt>Order</dt>
          <dd>Any</dd>
        </div>
      </dl>
      {preset.detail ? <p className="virtual-round-preset-detail">{preset.detail}</p> : null}
      {disabledReason ? (
        <p className="virtual-round-disabled-reason" id={reasonId}>
          {disabledReason}
        </p>
      ) : null}
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
  const currentProblem = round.problems.find(
    (problem) => problem.id === round.currentProblemId,
  );
  const finalizing = round.status === "finalizing";
  return (
    <section className="virtual-round-active" aria-labelledby={`active-round-${round.id}`}>
      <div className="virtual-round-section-heading">
        <div>
          <span className="eyebrow">
            {finalizing ? "Finalizing local round" : "Active local round"}
          </span>
          <h2 id={`active-round-${round.id}`}>{round.title}</h2>
          <p>
            {finalizing
              ? "The clock is locked. The last on-time submission is still being judged."
              : "Move between problems in any order. Opened identities stay visible."}
          </p>
        </div>
        <div className="virtual-round-clock">
          <span>Time remaining</span>
          <time dateTime={`PT${remainingSeconds}S`}>
            <strong>{remaining}</strong>
          </time>
        </div>
      </div>

      {round.announcement ? (
        <p className="virtual-round-announcement" role="status" aria-live="polite">
          {round.announcement}
        </p>
      ) : null}

      <dl className="virtual-round-scoreboard" aria-label="Current round score">
        <div>
          <dt>Local score</dt>
          <dd>{round.score}/{round.maxScore}</dd>
        </div>
        <div>
          <dt>Accepted</dt>
          <dd>{round.acceptedCount}/{round.problems.length}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd>{round.problems.filter((problem) => problem.identityRevealed).length}/{round.problems.length}</dd>
        </div>
      </dl>

      <div className="virtual-round-actions">
        <button
          className="primary-button"
          type="button"
          disabled={!currentProblem || finalizing}
          onClick={() => onResume(round.id)}
        >
          {currentProblem ? `Resume ${problemLabel(currentProblem)}` : "No current problem"}
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={finalizing}
          onClick={() => onFinish(round.id)}
        >
          {finalizing ? "Waiting for local judge" : "Finish and lock score"}
        </button>
      </div>

      <nav className="virtual-round-navigator" aria-label="Round problems">
        <ol>
          {round.problems.map((problem) => {
            const label = problemLabel(problem);
            const isCurrent = problem.id === round.currentProblemId;
            return (
              <li
                className={`${problem.status}${isCurrent ? " is-current" : ""}${problem.flagged ? " is-flagged" : ""}`}
                key={problem.id}
              >
                <button
                  className="virtual-round-problem-open"
                  type="button"
                  disabled={finalizing}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => onOpenProblem(round.id, problem.id)}
                >
                  <span className="virtual-round-problem-number">{problem.index + 1}</span>
                  <span className="virtual-round-problem-copy">
                    <strong>{label}</strong>
                    <small>
                      {statusLabel(problem.status)} / {problem.score}/{problem.maxScore} points / {problem.submissionCount} submission{problem.submissionCount === 1 ? "" : "s"}
                    </small>
                  </span>
                </button>
                <button
                  className="virtual-round-flag-button"
                  type="button"
                  disabled={finalizing}
                  aria-pressed={problem.flagged}
                  aria-label={`${problem.flagged ? "Remove flag from" : "Flag"} ${label}`}
                  onClick={() => onToggleFlag(round.id, problem.id)}
                >
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

function ReportProblem({ problem }: { problem: VirtualRoundReportProblem }) {
  return (
    <li className="virtual-round-report-problem">
      <div className="virtual-round-report-problem-heading">
        <div>
          <span>Problem {problem.index + 1}</span>
          <h4>{problem.title}</h4>
        </div>
        <strong>{problem.score}/{problem.maxScore}</strong>
      </div>
      <dl className="virtual-round-problem-evidence">
        <div><dt>Pattern</dt><dd>{problem.pattern}</dd></div>
        <div><dt>Difficulty</dt><dd>{problem.difficulty}</dd></div>
        <div><dt>Revision</dt><dd>{problem.revision}</dd></div>
        <div><dt>Status</dt><dd>{statusLabel(problem.status)}</dd></div>
        <div><dt>Submissions</dt><dd>{problem.submissionCount}</dd></div>
      </dl>
      <div className="virtual-round-timeline">
        <h5>Submission timeline</h5>
        {problem.submissions.length ? (
          <table aria-label={`Submission timeline for ${problem.title}`}>
            <thead>
              <tr>
                <th scope="col">Elapsed</th>
                <th scope="col">Verdict</th>
                <th scope="col">Score</th>
                <th scope="col">Evidence note</th>
              </tr>
            </thead>
            <tbody>
              {problem.submissions.map((submission) => (
                <tr key={submission.id}>
                  <td>{submission.elapsed}</td>
                  <td>{submission.verdict}</td>
                  <td>{submission.score}/{submission.maxScore}</td>
                  <td>{submission.note ?? "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No submissions recorded.</p>
        )}
      </div>
    </li>
  );
}

function RoundReportCard({
  report,
  onArchive,
}: {
  report: VirtualRoundReport;
  onArchive: (roundId: string) => void;
}) {
  return (
    <article className={`virtual-round-report${report.archived ? " is-archived" : ""}`} aria-labelledby={`round-report-${report.id}`}>
      <div className="virtual-round-report-heading">
        <div>
          <span className="eyebrow">Immutable local report</span>
          <h3 id={`round-report-${report.id}`}>{report.title}</h3>
          <p>Finished {formatCompletedAt(report.completedAt)}</p>
        </div>
        <div className="virtual-round-report-score">
          <strong>{report.score}/{report.maxScore}</strong>
          <span>locked local points</span>
        </div>
      </div>
      <dl className="virtual-round-report-stats">
        <div><dt>Accepted</dt><dd>{report.acceptedCount}/{report.problemCount}</dd></div>
        <div><dt>Elapsed</dt><dd>{report.elapsed}</dd></div>
        <div><dt>Penalty</dt><dd>{report.penalty}</dd></div>
      </dl>
      <ol className="virtual-round-report-problems">
        {report.problems.map((problem) => (
          <ReportProblem problem={problem} key={problem.id} />
        ))}
      </ol>
      <div className="virtual-round-report-actions">
        {report.archived ? (
          <span>Archived</span>
        ) : (
          <button className="outline-button" type="button" onClick={() => onArchive(report.id)}>
            Archive report
          </button>
        )}
      </div>
    </article>
  );
}

export function VirtualRounds({
  presets,
  activeRound,
  history,
  remainingMs,
  onStart,
  onResume,
  onOpenProblem,
  onToggleFlag,
  onFinish,
  onArchive,
}: VirtualRoundsProps) {
  return (
    <main id="main-content" tabIndex={-1} className="page-container virtual-rounds-page">
      <header className="page-heading virtual-rounds-heading">
        <div>
          <span className="eyebrow">Virtual rounds</span>
          <h1>Practice the clock. Keep the claims honest.</h1>
          <p>
            Run a timed set in this browser, switch problems in any order, and keep a detailed local evidence trail.
          </p>
        </div>
        <aside className="virtual-round-trust-card" aria-label="Round trust and privacy details">
          <strong>Device-local / not proctored</strong>
          <p>
            The browser clock and local judge are inspectable. This is practice evidence, not a secure assessment.
          </p>
        </aside>
      </header>

      <section className="virtual-round-disclosure" aria-labelledby="virtual-round-disclosure-title">
        <div>
          <span className="eyebrow">Evidence boundary</span>
          <h2 id="virtual-round-disclosure-title">Useful practice data, without a readiness claim.</h2>
        </div>
        <ul>
          <li>Scores and reports stay on this device unless you export them.</li>
          <li>There are no secure hidden tests, remote proctoring, or tamper-resistant controls.</li>
          <li>No global rank, interview-readiness rating, certification, or hiring signal is produced.</li>
        </ul>
      </section>

      <section className="virtual-round-presets" aria-labelledby="virtual-round-presets-title">
        <div className="virtual-round-section-heading">
          <div>
            <span className="eyebrow">Choose a format</span>
            <h2 id="virtual-round-presets-title">Round presets</h2>
          </div>
          <span>{presets.length} formats</span>
        </div>
        <div className="virtual-round-preset-grid">
          {presets.map((preset) => (
            <PresetCard preset={preset} onStart={onStart} key={preset.id} />
          ))}
        </div>
      </section>

      {activeRound ? (
        <ActiveRoundDashboard
          round={activeRound}
          remainingMs={remainingMs}
          onResume={onResume}
          onOpenProblem={onOpenProblem}
          onToggleFlag={onToggleFlag}
          onFinish={onFinish}
        />
      ) : (
        <section className="virtual-round-empty" aria-label="Active round">
          <span className="eyebrow">No active round</span>
          <h2>Pick a preset when you are ready.</h2>
          <p>A finished score never changes; a new attempt creates a new local report.</p>
        </section>
      )}

      <section className="virtual-round-history" aria-labelledby="virtual-round-history-title">
        <div className="virtual-round-section-heading">
          <div>
            <span className="eyebrow">Local history</span>
            <h2 id="virtual-round-history-title">Finished round reports</h2>
          </div>
          <span>{history.length} report{history.length === 1 ? "" : "s"}</span>
        </div>
        {history.length ? (
          <div className="virtual-round-history-list">
            {history.map((report) => (
              <RoundReportCard report={report} onArchive={onArchive} key={report.id} />
            ))}
          </div>
        ) : (
          <p className="virtual-round-history-empty">Finished rounds will appear here with their full submission timelines.</p>
        )}
      </section>
    </main>
  );
}
