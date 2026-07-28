"use client";

import { useMemo, useState } from "react";
import type { PracticeItem } from "../lib/items";
import { buildDailyPlan } from "../lib/planner.mjs";
import type { AppState } from "../lib/product";
import type { SessionQueueEntry } from "../lib/sessions.mjs";

const BUDGETS = [15, 30, 45] as const;

function nearestBudget(minutes: number) {
  return BUDGETS.reduce((best, candidate) =>
    Math.abs(candidate - minutes) < Math.abs(best - minutes)
      ? candidate
      : best,
  );
}

function taskLabel(item: PracticeItem | undefined, entry: SessionQueueEntry) {
  if (entry.practiceKind === "solving") return "Independent Python solve";
  if (entry.practiceKind === "concept") return "iOS concept recall";
  if (item?.pattern === "Python Fluency") return "Python fluency warm-up";
  return entry.stage === 5 ? "Blank-editor recall" : `Stage ${entry.stage} recall`;
}

export function DailyCoach({
  ready,
  state,
  items,
  onStart,
  onResume,
}: {
  ready: boolean;
  state: AppState;
  items: PracticeItem[];
  onStart: (entries: SessionQueueEntry[], budgetMinutes: number) => void;
  onResume: () => void;
}) {
  const [budgetMinutes, setBudgetMinutes] = useState<15 | 30 | 45>(() =>
    nearestBudget(state.settings.dailyGoalMinutes),
  );
  const planningDate = ready
    ? new Date().toISOString().slice(0, 10)
    : "2000-01-01";
  const plan = useMemo(
    () =>
      buildDailyPlan(
        {
          items,
          attempts: state.attempts,
          learningEvents: state.learningEvents,
          favorites: state.favorites,
          profile: {
            preferredLanguage: state.settings.preferredLanguage,
            dailyGoalMinutes: state.settings.dailyGoalMinutes,
            pythonShare: 0.6,
            reviewShare: 0.2,
            iosShare: 0.2,
          },
          recentLaneMinutes: state.sessionHistory
            .filter((session) => session.laneMinutes)
            .slice(-12)
            .map((session) => ({ laneMinutes: session.laneMinutes ?? {} })),
        },
        { now: planningDate, budgetMinutes },
      ),
    [
      budgetMinutes,
      items,
      planningDate,
      state.attempts,
      state.learningEvents,
      state.favorites,
      state.settings.dailyGoalMinutes,
      state.settings.preferredLanguage,
      state.sessionHistory,
    ],
  );
  const active = state.activeSession;

  return (
    <section className="daily-coach" aria-labelledby="daily-coach-title">
      <div className="daily-coach-copy">
        <span className="eyebrow">Adaptive Daily Coach</span>
        <h2 id="daily-coach-title">Practice the skill that needs evidence.</h2>
        <p>
          This plan keeps Python syntax, independent solving, delayed recall,
          and iOS maintenance separate. Every task says why it earned time.
        </p>
        <div className="coach-budget" aria-label="Plan duration">
          {BUDGETS.map((minutes) => (
            <button
              key={minutes}
              className={budgetMinutes === minutes ? "active" : ""}
              aria-pressed={budgetMinutes === minutes}
              onClick={() => setBudgetMinutes(minutes)}
            >
              {minutes} min
            </button>
          ))}
        </div>
        <div className="coach-summary" aria-label="Plan allocation">
          <span>{plan.entries.length} focused tasks</span>
          <span>{plan.estimatedMinutes} min planned</span>
          {plan.deferredDueCount > 0 && (
            <span>{plan.deferredDueCount} due item(s) deferred</span>
          )}
        </div>
        {active ? (
          <button className="primary-button" onClick={onResume}>
            Resume {active.name} →
          </button>
        ) : (
          <button
            className="primary-button"
            disabled={!plan.entries.length}
            onClick={() => onStart(plan.entries, budgetMinutes)}
          >
            Start this {budgetMinutes}-minute plan →
          </button>
        )}
      </div>
      <ol className="coach-plan">
        {plan.entries.map((entry, index) => {
          const item = items.find(
            (candidate) => candidate.itemId === entry.itemId,
          );
          return (
            <li key={`${entry.itemId}:${entry.practiceKind}:${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{taskLabel(item, entry)}</small>
                <strong>{item?.title ?? "Unavailable item"}</strong>
                <p>{entry.rationale ?? "Selected for balanced retrieval."}</p>
              </div>
              <b>{entry.estimatedMinutes ?? item?.estimatedMinutes ?? 5}m</b>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
