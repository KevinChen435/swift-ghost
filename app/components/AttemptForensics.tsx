"use client";

import { summarizeAttemptTimeline } from "../lib/analytics.mjs";
import type { PracticeItem } from "../lib/items";
import type { AttemptRecord } from "../lib/product";

export function AttemptForensics({
  attempt,
  item,
}: {
  attempt: AttemptRecord;
  item: PracticeItem;
}) {
  if (attempt.practiceKind === "solving") {
    const verification = attempt.verification;
    return (
      <section className="result-forensics solve-evidence">
        <div className="result-forensics-head">
          <span>
            <small>Solution evidence</small>
            <strong>Executable checks</strong>
          </span>
          <b>
            {verification
              ? `${verification.passed}/${verification.total} passed`
              : "Not verified"}
          </b>
        </div>
        <div className="forensics-summary">
          <span>
            <small>Test runs</small>
            <strong>{verification?.runs ?? 0}</strong>
          </span>
          <span>
            <small>Hints</small>
            <strong>{attempt.peeks}</strong>
          </span>
          <span>
            <small>Edits</small>
            <strong>{attempt.corrections}</strong>
          </span>
          <span>
            <small>Reference</small>
            <strong>{item.language === "python" ? "Python" : "Swift"}</strong>
          </span>
        </div>
      </section>
    );
  }

  const summary = summarizeAttemptTimeline(attempt.timeline);
  const maxWpm = Math.max(1, ...attempt.timeline.map((sample) => sample.wpm));
  const missedLines = Object.entries(attempt.lineErrors)
    .map(([line, misses]) => ({ line: Number(line), misses }))
    .filter((entry) => Number.isInteger(entry.line) && entry.misses > 0)
    .sort((left, right) => right.misses - left.misses || left.line - right.line)
    .slice(0, 3);

  return (
    <section className="result-forensics">
      <div className="result-forensics-head">
        <span>
          <small>Attempt forensics</small>
          <strong>Pace and friction</strong>
        </span>
        <b>{attempt.consistency}% consistent</b>
      </div>
      {attempt.timeline.length ? (
        <div className="result-pace-chart" aria-label="Attempt WPM timeline">
          {attempt.timeline.map((sample, index) => (
            <i
              key={`${sample.atMs}-${index}`}
              style={{ height: `${Math.max(6, (sample.wpm / maxWpm) * 100)}%` }}
              title={`${sample.wpm} WPM at ${Math.round(sample.atMs / 100) / 10}s`}
            />
          ))}
        </div>
      ) : (
        <p className="forensics-legacy">
          No detailed pace trace for this pass.
        </p>
      )}
      <div className="forensics-summary">
        <span>
          <small>Peak</small>
          <strong>{summary.peakWpm} WPM</strong>
        </span>
        <span>
          <small>Raw pace</small>
          <strong>{attempt.rawWpm} WPM</strong>
        </span>
        <span>
          <small>Corrections</small>
          <strong>{attempt.corrections}</strong>
        </span>
        <span>
          <small>Finish</small>
          <strong>{summary.paceTrend}</strong>
        </span>
      </div>
      <div className="forensics-lines">
        <small>Most-missed lines</small>
        {missedLines.length ? (
          missedLines.map((entry) => (
            <span key={entry.line}>
              Line {entry.line} <b>{entry.misses} misses</b>
            </span>
          ))
        ) : (
          <span>Clean line-level pass</span>
        )}
      </div>
    </section>
  );
}
