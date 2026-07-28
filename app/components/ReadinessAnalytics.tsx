import type { PracticeItem } from "../lib/items";
import { buildReadinessSummary } from "../lib/readiness.mjs";
import type { AppState } from "../lib/product";

const FRICTION_LABELS: Record<string, string> = {
  recognition: "Pattern recognition",
  invariant: "Invariant / approach",
  implementation: "Implementation plan",
  syntax: "Language syntax",
  complexity: "Complexity reasoning",
  api: "Swift / iOS API",
};

function rateValue(rate: {
  denominator: number;
  percent: number | null;
}) {
  return rate.denominator >= 3 && rate.percent !== null
    ? `${rate.percent}%`
    : "—";
}

export function ReadinessAnalytics({
  state,
  items,
  dueCount,
}: {
  state: AppState;
  items: PracticeItem[];
  dueCount: number;
}) {
  const summary = buildReadinessSummary({
    items,
    attempts: state.attempts,
    learningEvents: state.learningEvents,
    dueCount,
  });
  const mix = summary.trackMix.percent;
  const friction = summary.topFriction;
  return (
    <section className="readiness-panel" aria-labelledby="readiness-title">
      <div className="section-head">
        <div>
          <small>Last {summary.windowDays} days · current revisions only</small>
          <h2 id="readiness-title">Interview readiness evidence</h2>
        </div>
        <span>Rates appear after 3 observations</span>
      </div>
      <div className="readiness-grid">
        <article>
          <small>Hint-free verified solves</small>
          <strong>{rateValue(summary.hintFreeSolves)}</strong>
          <p>
            {summary.hintFreeSolves.numerator}/
            {summary.hintFreeSolves.denominator} recorded verified solves
          </p>
        </article>
        <article>
          <small>Strong retrieval signals</small>
          <strong>{rateValue(summary.strongRetrieval)}</strong>
          <p>
            {summary.strongRetrieval.numerator}/
            {summary.strongRetrieval.denominator} debriefs marked Good or Easy
          </p>
        </article>
        <article>
          <small>Debrief coverage</small>
          <strong>{rateValue(summary.debriefCoverage)}</strong>
          <p>
            {summary.debriefCoverage.numerator}/
            {summary.debriefCoverage.denominator} completed attempts explained
          </p>
        </article>
        <article>
          <small>Top saved friction</small>
          <strong>
            {friction.denominator >= 3 && friction.category
              ? FRICTION_LABELS[friction.category] ?? friction.category
              : "—"}
          </strong>
          <p>
            {friction.count}/{friction.denominator} saved debriefs
          </p>
        </article>
        <article>
          <small>Recent practice mix</small>
          <strong>
            {summary.trackMix.totalMinutes
              ? `Py ${mix.python}% · Swift ${mix.swift}% · iOS ${mix.ios}%`
              : "—"}
          </strong>
          <p>{summary.trackMix.totalMinutes} practiced minutes</p>
        </article>
        <article>
          <small>Review burden today</small>
          <strong>{summary.dueToday}</strong>
          <p>current items due for another retrieval</p>
        </article>
      </div>
    </section>
  );
}
