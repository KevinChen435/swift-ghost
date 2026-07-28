"use client";

import type { CSSProperties, ReactNode } from "react";
import type { PracticeItem } from "../lib/items";
import {
  buildReadinessTimeline,
  type ReadinessPeriodSummary,
  type ReadinessRate,
} from "../lib/readiness.mjs";
import type { AppState } from "../lib/product";

const FRICTION_LABELS: Record<string, string> = {
  recognition: "Pattern recognition",
  invariant: "Invariant / approach",
  implementation: "Implementation plan",
  syntax: "Language syntax",
  complexity: "Complexity reasoning",
  api: "Swift / iOS API",
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return DATE_FORMAT.format(new Date(`${value}T00:00:00.000Z`));
}

function formatMinutes(value: number) {
  const rounded = Math.round(value);
  return `${rounded} min`;
}

function rateValue(rate: ReadinessRate) {
  if (!rate.denominator) return "No evidence";
  if (rate.denominator < 3) return `${rate.numerator}/${rate.denominator}`;
  return `${rate.percent}%`;
}

function rateDetail(rate: ReadinessRate) {
  if (!rate.denominator) return "No observations in this period";
  if (rate.denominator < 3) {
    return `${3 - rate.denominator} more observation${rate.denominator === 2 ? "" : "s"} before showing a rate`;
  }
  return `${rate.numerator} of ${rate.denominator}`;
}

function deltaValue(delta: number | null) {
  if (delta === null) return "Need 3 in both periods";
  if (delta === 0) return "No rate change";
  return `${delta > 0 ? "+" : ""}${delta} pp`;
}

function EvidenceRow({
  label,
  current,
  previous,
  change,
}: {
  label: string;
  current: ReactNode;
  previous: ReactNode;
  change: ReactNode;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{current}</td>
      <td>{previous}</td>
      <td>{change}</td>
    </tr>
  );
}

function RateCell({ rate }: { rate: ReadinessRate }) {
  return (
    <span className="readiness-rate-cell">
      <strong>{rateValue(rate)}</strong>
      <small>{rateDetail(rate)}</small>
    </span>
  );
}

function LaneBreakdown({
  title,
  period,
}: {
  title: string;
  period: ReadinessPeriodSummary;
}) {
  const total = Math.max(0, period.minutes);
  const lanes = [
    ["python", "Python"],
    ["swift", "Swift interviews"],
    ["ios", "iOS / Swift concepts"],
  ] as const;
  return (
    <article className="readiness-lane-card">
      <header>
        <strong>{title}</strong>
        <span>{formatMinutes(total)}</span>
      </header>
      {lanes.map(([lane, label]) => {
        const minutes = period.laneMinutes[lane];
        const percent = total ? Math.round((minutes / total) * 100) : 0;
        return (
          <div className="readiness-lane-row" key={lane}>
            <span>
              <strong>{label}</strong>
              <small>{formatMinutes(minutes)}</small>
            </span>
            <div
              role="progressbar"
              aria-label={`${label}: ${formatMinutes(minutes)} of ${formatMinutes(total)}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <i style={{ width: `${percent}%` }} />
            </div>
            <b>{percent}%</b>
          </div>
        );
      })}
    </article>
  );
}

function nextEvidence(period: ReadinessPeriodSummary) {
  const signals: string[] = [];
  if (period.verifiedSolves < 3) {
    signals.push(
      `Complete ${3 - period.verifiedSolves} more fully verified solve${period.verifiedSolves === 2 ? "" : "s"} before treating the hint-free rate as stable.`,
    );
  }
  if (period.completedAttempts >= 3 && period.debriefCoverage.percent !== null && period.debriefCoverage.percent < 67) {
    signals.push(
      "Explain more completed attempts so the plan can separate recognition, syntax, and verification friction.",
    );
  }
  if (period.conceptAttempts < 3) {
    signals.push(
      `Add ${3 - period.conceptAttempts} answer-first Swift or iOS recall${period.conceptAttempts === 2 ? "" : "s"} to establish a concept-retrieval baseline.`,
    );
  }
  if (period.topFriction.category && period.topFriction.count >= 2) {
    const label =
      FRICTION_LABELS[period.topFriction.category] ??
      period.topFriction.category;
    signals.push(
      `${label} appeared in ${period.topFriction.count} saved debriefs; choose the next exercise to isolate that decision.`,
    );
  }
  if (!signals.length) {
    signals.push(
      "Evidence is broad enough to mix patterns and keep the next solve explanation-first.",
    );
  }
  return signals.slice(0, 3);
}

export function ReadinessTrends({
  state,
  items,
  now,
}: {
  state: AppState;
  items: PracticeItem[];
  now: number;
}) {
  const timeline = buildReadinessTimeline({
    items,
    attempts: state.attempts,
    learningEvents: state.learningEvents,
    now,
  });
  const maxBucketMinutes = Math.max(
    1,
    ...timeline.buckets.map((bucket) => bucket.minutes),
  );
  const current = timeline.current30;
  const previous = timeline.previous30;
  const signals = nextEvidence(current);

  return (
    <>
      <section
        className="readiness-trends-hero"
        aria-labelledby="readiness-trends-title"
      >
        <div>
          <small>90 days · current content revisions · device local</small>
          <h2 id="readiness-trends-title">Read the evidence over time.</h2>
          <p>
            Independent solving, retrieval, explanation, and practice mix stay
            separate. Swift Ghost does not combine them into an invented
            readiness score or predict an interview outcome.
          </p>
        </div>
        <dl>
          <div>
            <dt>Active days</dt>
            <dd>{timeline.buckets.reduce((sum, bucket) => sum + bucket.activeDays, 0)}</dd>
          </div>
          <div>
            <dt>Hint-free solves</dt>
            <dd>{timeline.buckets.reduce((sum, bucket) => sum + bucket.hintFreeSolves, 0)}</dd>
          </div>
          <div>
            <dt>Strong retrievals</dt>
            <dd>{timeline.buckets.reduce((sum, bucket) => sum + bucket.strongRetrieval, 0)}</dd>
          </div>
        </dl>
      </section>

      <section className="readiness-trend-card" aria-labelledby="readiness-activity-title">
        <div className="section-head">
          <div>
            <small>Thirteen chronological blocks</small>
            <h2 id="readiness-activity-title">Evidence activity</h2>
          </div>
          <span>{formatDate(timeline.startDate)} – {formatDate(timeline.endDate)}</span>
        </div>
        <p className="readiness-trend-copy">
          Height follows practiced minutes. Exact attempt, solve, and retrieval
          counts remain visible without hover.
        </p>
        <div className="readiness-activity-scroll" tabIndex={0} aria-label="Ninety-day evidence timeline">
          <div className="readiness-activity-grid" role="list">
            {timeline.buckets.map((bucket) => {
              const intensity = Math.max(
                0.08,
                bucket.minutes / maxBucketMinutes,
              );
              return (
                <article
                  role="listitem"
                  key={bucket.startDate}
                  style={{ "--activity-level": intensity } as CSSProperties}
                >
                  <small>{formatDate(bucket.startDate)}</small>
                  <div className="readiness-activity-bar" aria-hidden="true"><i /></div>
                  <strong>{formatMinutes(bucket.minutes)}</strong>
                  <span>{bucket.completedAttempts} attempts</span>
                  <span>{bucket.hintFreeSolves} clean solves</span>
                  <span>{bucket.strongRetrieval} strong recalls</span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="readiness-trend-card" aria-labelledby="readiness-comparison-title">
        <div className="section-head">
          <div>
            <small>Observed change · no prediction</small>
            <h2 id="readiness-comparison-title">Recent 30 days vs prior 30</h2>
          </div>
          <span>Rates require 3 observations in each period</span>
        </div>
        <div className="readiness-comparison-scroll" tabIndex={0}>
          <table className="readiness-comparison-table">
            <caption>
              Separate evidence rates and counts for the current and previous
              30-day periods
            </caption>
            <thead>
              <tr>
                <th scope="col">Evidence</th>
                <th scope="col">Recent 30 days</th>
                <th scope="col">Prior 30 days</th>
                <th scope="col">Observed change</th>
              </tr>
            </thead>
            <tbody>
              <EvidenceRow
                label="Hint-free verified solves"
                current={<RateCell rate={current.hintFreeSolveRate} />}
                previous={<RateCell rate={previous.hintFreeSolveRate} />}
                change={deltaValue(timeline.rateDeltas.hintFreeSolveRate)}
              />
              <EvidenceRow
                label="Strong retrieval signals"
                current={<RateCell rate={current.strongRetrievalRate} />}
                previous={<RateCell rate={previous.strongRetrievalRate} />}
                change={deltaValue(timeline.rateDeltas.strongRetrievalRate)}
              />
              <EvidenceRow
                label="Swift / iOS concept recall"
                current={<RateCell rate={current.conceptRecallRate} />}
                previous={<RateCell rate={previous.conceptRecallRate} />}
                change={deltaValue(timeline.rateDeltas.conceptRecallRate)}
              />
              <EvidenceRow
                label="Debrief coverage"
                current={<RateCell rate={current.debriefCoverage} />}
                previous={<RateCell rate={previous.debriefCoverage} />}
                change={deltaValue(timeline.rateDeltas.debriefCoverage)}
              />
              <EvidenceRow
                label="Active practice days"
                current={<strong>{current.activeDays}</strong>}
                previous={<strong>{previous.activeDays}</strong>}
                change={`${current.activeDays - previous.activeDays >= 0 ? "+" : ""}${current.activeDays - previous.activeDays} days`}
              />
              <EvidenceRow
                label="Practice time"
                current={<strong>{formatMinutes(current.minutes)}</strong>}
                previous={<strong>{formatMinutes(previous.minutes)}</strong>}
                change={`${Math.round(current.minutes - previous.minutes) >= 0 ? "+" : ""}${Math.round(current.minutes - previous.minutes)} min`}
              />
            </tbody>
          </table>
        </div>
      </section>

      <div className="readiness-trends-lower-grid">
        <section className="readiness-trend-card" aria-labelledby="readiness-lanes-title">
          <div className="section-head">
            <div>
              <small>Minutes, not task count</small>
              <h2 id="readiness-lanes-title">Practice mix</h2>
            </div>
          </div>
          <div className="readiness-lane-grid">
            <LaneBreakdown title="Recent 30 days" period={current} />
            <LaneBreakdown title="Prior 30 days" period={previous} />
          </div>
        </section>

        <section className="readiness-trend-card readiness-next-evidence" aria-labelledby="readiness-next-title">
          <div className="section-head">
            <div>
              <small>Smallest useful next proof</small>
              <h2 id="readiness-next-title">What to collect next</h2>
            </div>
          </div>
          <ol>
            {signals.map((signal) => <li key={signal}>{signal}</li>)}
          </ol>
          <p>
            These prompts describe missing or repeated evidence. They are not
            a hiring recommendation, credential, or proctored assessment.
          </p>
        </section>
      </div>
    </>
  );
}
