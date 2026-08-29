"use client";

import { useMemo, useState } from "react";
import { iosTechnicalScreenScript, pythonInterviewScript } from "../data/interview-scripts";
import type { PracticeItem } from "../lib/items";
import { buildDailyPlan } from "../lib/planner.mjs";
import type { AppState } from "../lib/product";
import type { SessionQueueEntry } from "../lib/sessions.mjs";
import type { FluencyClinicModel } from "../lib/fluency-clinic.mjs";

const BUDGETS = [15, 30, 45] as const;

function nearestBudget(minutes: number) {
  return BUDGETS.reduce((best, candidate) =>
    Math.abs(candidate - minutes) < Math.abs(best - minutes)
      ? candidate
      : best,
  );
}

function taskLabel(item: PracticeItem | undefined, entry: SessionQueueEntry) {
  if (entry.practiceKind === "solving")
    return item?.language === "swift"
      ? "Independent Swift solve"
      : "Independent Python solve";
  if (entry.practiceKind === "concept") return "iOS concept recall";
  if (item?.pattern === "Python Fluency") return "Python fluency warm-up";
  return entry.stage === 5 ? "Blank-editor recall" : `Stage ${entry.stage} recall`;
}

function clinicPriorityLabel(status: FluencyClinicModel["records"][number]["status"]) {
  if (status === "recheck-due") return "Delayed blank recheck";
  if (status === "repairing") return "Implementation repair";
  if (status === "reconstruction-ready") return "Full blank reconstruction";
  if (status === "transfer-ready") return "Mapped transfer check";
  return "Implementation fluency";
}

type CoachCribLane = "python" | "swift" | "ios";

type CoachCribCard = {
  id: string;
  lane: CoachCribLane;
  label: string;
  title: string;
  scenario: string;
  prompt: string;
  answerLines: string[];
  note: string;
};

function coachCribLaneLabel(lane: CoachCribLane) {
  if (lane === "python") return "Python";
  if (lane === "swift") return "Swift";
  return "iOS";
}

function buildCoachCribCard(
  item: PracticeItem,
  lane: CoachCribLane,
): CoachCribCard {
  if (lane === "python") {
    const script = pythonInterviewScript(item);
    return {
      id: item.itemId,
      lane,
      label: "Python re-entry",
      title: item.title,
      scenario: script.scenario,
      prompt: script.prompts.clarification,
      answerLines: script.referenceCriteria.slice(0, 4),
      note: script.prompts.complexity,
    };
  }

  const script = iosTechnicalScreenScript(item);
  return {
    id: item.itemId,
    lane,
    label: lane === "swift" ? "Swift fundamentals" : "iOS fundamentals",
    title: item.title,
    scenario: script.scenario,
    prompt: script.prompts.clarification,
    answerLines: script.referenceCriteria.slice(0, 4),
    note: script.prompts.complexity,
  };
}

export function DailyCoach({
  ready,
  state,
  items,
  onStart,
  onResume,
  fluencyClinic,
  onOpenFluencyClinic,
}: {
  ready: boolean;
  state: AppState;
  items: PracticeItem[];
  onStart: (entries: SessionQueueEntry[], budgetMinutes: number) => void;
  onResume: () => void;
  fluencyClinic: FluencyClinicModel;
  onOpenFluencyClinic: (caseId?: string) => void;
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
          typingProgress: state.typingProgress,
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
      state.typingProgress,
      state.learningEvents,
      state.favorites,
      state.settings.dailyGoalMinutes,
      state.settings.preferredLanguage,
      state.sessionHistory,
    ],
  );
  const active = state.activeSession;
  const coachCribCards = useMemo(() => {
    const planItems = plan.entries
      .map((entry) => items.find((candidate) => candidate.itemId === entry.itemId))
      .filter((item): item is PracticeItem => Boolean(item));

    const pickItem = (predicate: (item: PracticeItem) => boolean) =>
      planItems.find(predicate) ?? items.find(predicate) ?? null;

    const selectedItems: Array<[PracticeItem | null, CoachCribLane]> = [
      [pickItem((item) => item.track === "interview" && item.language === "python"), "python"],
      [
        pickItem((item) => item.track === "ios" && item.conceptLane === "swift"),
        "swift",
      ],
      [
        pickItem((item) => item.track === "ios" && item.conceptLane === "ios"),
        "ios",
      ],
    ];

    return selectedItems
      .filter(
        (
          entry,
        ): entry is [PracticeItem, CoachCribLane] =>
          Boolean(entry[0]),
      )
      .map(([item, lane]) => buildCoachCribCard(item, lane));
  }, [items, plan.entries]);
  const [focusedCribAnswers, setFocusedCribAnswers] = useState<
    Record<string, boolean>
  >({});
  const [cribLane, setCribLane] = useState<CoachCribLane | "all">("all");
  const visibleCribCards =
    cribLane === "all"
      ? coachCribCards
      : coachCribCards.filter((card) => card.lane === cribLane);

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
        {fluencyClinic.next && (
          <div className="coach-clinic-priority">
            <span>
              <small>Priority before new work</small>
              <strong>{clinicPriorityLabel(fluencyClinic.next.status)}</strong>
            </span>
            <p>
              {fluencyClinic.next.titleSnapshot} · line {fluencyClinic.next.line}.
              This measures implementation fluency, not problem mastery.
            </p>
          </div>
        )}
        {active ? (
          <button className="primary-button" onClick={onResume}>
            Resume {active.name} →
          </button>
        ) : fluencyClinic.next ? (
          <button
            className="primary-button"
            onClick={() => onOpenFluencyClinic(fluencyClinic.next?.id)}
          >
            Open priority Clinic case →
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
      <section className="coach-crib" aria-labelledby="coach-crib-title">
        <header className="coach-crib-header">
          <div>
            <span className="eyebrow">Grey answer crib</span>
            <h3 id="coach-crib-title">
              Read the prompt, keep the answer visible, and decide whether you
              can type it cleanly from memory.
            </h3>
            <p>
              These are coached references from the interview bank. The answer
              stays on screen but muted until you choose to focus it.
            </p>
          </div>
          <span>{visibleCribCards.length} cards</span>
        </header>
        <div className="coach-crib-filters" role="group" aria-label="Crib lane">
          {(["all", "python", "swift", "ios"] as const).map((lane) => (
            <button
              key={lane}
              type="button"
              aria-pressed={cribLane === lane}
              className={cribLane === lane ? "active" : ""}
              onClick={() => setCribLane(lane)}
            >
              {lane === "all" ? "Mixed" : coachCribLaneLabel(lane)}
            </button>
          ))}
        </div>
        <div className="coach-crib-grid">
          {visibleCribCards.map((card) => {
            const focused = focusedCribAnswers[card.id] ?? false;
            return (
              <article
                key={card.id}
                className={`coach-crib-card lane-${card.lane}${focused ? " is-focused" : ""}`}
              >
                <header className="coach-crib-card-head">
                  <div>
                    <small>{card.label}</small>
                    <strong>{card.title}</strong>
                  </div>
                  <span>{coachCribLaneLabel(card.lane)}</span>
                </header>
                <p className="coach-crib-scenario">{card.scenario}</p>
                <div className="coach-crib-prompt">
                  <small>Question</small>
                  <p>{card.prompt}</p>
                </div>
                <div
                  className={`coach-crib-answer${focused ? " is-focused" : " is-muted"}`}
                >
                  <div className="coach-crib-answer-head">
                    <small>Answer sketch</small>
                    <button
                      type="button"
                      className="text-button"
                      aria-pressed={focused}
                      onClick={() =>
                        setFocusedCribAnswers((current) => ({
                          ...current,
                          [card.id]: !current[card.id],
                        }))
                      }
                    >
                      {focused ? "Soft blur" : "Focus answer"}
                    </button>
                  </div>
                  <ul>
                    {card.answerLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <small>{card.note}</small>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
