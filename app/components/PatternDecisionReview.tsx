"use client";

import { useMemo, useState } from "react";
import type {
  PatternDecisionProbe,
  PatternDecisionSource,
} from "../data/pattern-decision-probes";
import type { PatternLesson } from "../data/pattern-lessons";
import type { PracticeItem } from "../lib/items";
import {
  derivePatternDecisionOverview,
  type PatternDecisionAttempt,
  type PatternLearningWorkspace,
} from "../lib/pattern-learning.mjs";
import type { RetrievalGrade } from "../lib/learning-state.mjs";

type DecisionInput = {
  selectedLessonId: string;
  cue: string;
  invariant: string;
  whyNot: string;
  assisted: boolean;
};

type Props = {
  lessons: readonly PatternLesson[];
  probes: readonly PatternDecisionProbe[];
  items: PracticeItem[];
  workspace: PatternLearningWorkspace;
  draftBoundary: string;
  routedSprintId?: string;
  onStartSprint: (source: PatternDecisionSource) => void;
  onCommit: (
    probe: PatternDecisionProbe,
    lesson: PatternLesson,
    input: DecisionInput,
  ) => void;
  onReveal: (attemptId: string) => void;
  onGrade: (attemptId: string, grade: RetrievalGrade) => void;
  onExit: () => void;
  onOpenLesson: (lesson: PatternLesson) => void;
  onStartSolve: (item: PracticeItem) => void;
};

const GRADES: { id: RetrievalGrade; label: string; note: string }[] = [
  { id: "again", label: "Again", note: "I could not explain the choice" },
  { id: "hard", label: "Hard", note: "The comparison was shaky" },
  { id: "good", label: "Good", note: "The reasoning was clear" },
  { id: "easy", label: "Easy", note: "I saw the distinction quickly" },
];

function formatDue(value?: string) {
  if (!value) return "New";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "Unscheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(due);
}

function sourceLabel(source: PatternDecisionSource) {
  return {
    academy: "Pattern Academy",
    today: "Today",
    plan: "Study plan",
    assessment: "Assessment follow-up",
    weakness: "Weakness Lab",
  }[source];
}

export function PatternDecisionReview({
  lessons,
  probes,
  items,
  workspace,
  draftBoundary,
  routedSprintId,
  onStartSprint,
  onCommit,
  onReveal,
  onGrade,
  onExit,
  onOpenLesson,
  onStartSolve,
}: Props) {
  const sprint = workspace.activeSprint;
  const activeEntry = sprint?.status === "active"
    ? sprint.entries[sprint.cursor]
    : undefined;
  const probe = probes.find(
    (candidate) =>
      candidate.id === activeEntry?.probeId &&
      candidate.revision === activeEntry.probeRevision,
  );
  const lesson = lessons.find((candidate) => candidate.id === probe?.lessonId);
  const sprintAttempts = useMemo(
    () =>
      workspace.decisionAttempts.filter(
        (attempt) => attempt.sprintId === sprint?.id,
      ),
    [sprint?.id, workspace.decisionAttempts],
  );
  const saved = sprintAttempts.find(
    (attempt) => attempt.probeId === probe?.id && !attempt.completedAt,
  );
  const draftKey = `${draftBoundary}:${sprint?.id ?? "none"}:${probe?.id ?? "none"}`;
  const [draft, setDraft] = useState(() => ({
    key: draftKey,
    selectedLessonId: "",
    cue: "",
    invariant: "",
    whyNot: "",
    hintShown: false,
  }));
  const activeDraft = draft.key === draftKey
    ? draft
    : {
        key: draftKey,
        selectedLessonId: "",
        cue: "",
        invariant: "",
        whyNot: "",
        hintShown: false,
      };
  const overview = derivePatternDecisionOverview(lessons, probes, workspace, {
    now: new Date().toISOString(),
  });
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.itemId, item])),
    [items],
  );

  if (!sprint || (routedSprintId && routedSprintId !== sprint.id)) {
    return (
      <main id="main-content" className="page-container decision-review-page">
        <section className="decision-review-empty">
          <p className="eyebrow">Pattern Decision Review</p>
          <h1>Choose the pattern before the problem tells you.</h1>
          <p>
            A short mixed sprint hides the pattern label. Commit your cue,
            invariant, and rejected alternative before seeing the authored
            comparison.
          </p>
          <div className="decision-review-boundary">
            This records prompt classification only. It is not a solve,
            transfer result, or interview-readiness claim.
          </div>
          <button className="primary-button" onClick={() => onStartSprint("academy")}>
            Start 3-prompt review
          </button>
          <button className="text-button" onClick={onExit}>Back to Pattern Academy</button>
        </section>
      </main>
    );
  }

  if (sprint.status === "completed") {
    const completed = sprintAttempts.filter((attempt) => attempt.completedAt);
    const matches = completed.filter((attempt) => attempt.match).length;
    const unassisted = completed.filter(
      (attempt) => attempt.match && !attempt.assisted,
    ).length;
    return (
      <main id="main-content" className="page-container decision-review-page">
        <section className="decision-review-summary">
          <p className="eyebrow">Sprint complete · {sourceLabel(sprint.source)}</p>
          <h1>{matches}/{completed.length} pattern choices matched.</h1>
          <p>
            {unassisted} matched without a cue hint. Self-grades affect review
            timing, but only the authored pattern choice is checked objectively.
          </p>
          <dl className="decision-review-summary-stats">
            <div><dt>Ready now</dt><dd>{overview.readyCount}</dd></div>
            <div><dt>Retained</dt><dd>{overview.retainedCount}/{overview.totalPatterns}</dd></div>
            <div><dt>History</dt><dd>{workspace.decisionAttempts.filter((attempt) => attempt.completedAt).length}</dd></div>
          </dl>
          <div className="decision-review-results">
            {completed.map((attempt) => {
              const resultProbe = probes.find(
                (candidate) =>
                  candidate.id === attempt.probeId &&
                  candidate.revision === attempt.probeRevision,
              );
              const resultLesson = lessons.find(
                (candidate) => candidate.id === attempt.lessonId,
              );
              const solveItem = resultProbe
                ? itemsById.get(resultProbe.solveItemId)
                : undefined;
              return (
                <article key={attempt.id}>
                  <span className={attempt.match ? "decision-match" : "decision-miss"}>
                    {attempt.match ? "Matched" : "Missed"}
                  </span>
                  <h2>{resultLesson?.title ?? "Retired pattern"}</h2>
                  <p>Next review {formatDue(attempt.dueAt)} · {attempt.assisted ? "hint used" : "unassisted"}</p>
                  <div>
                    {resultLesson ? (
                      <button className="text-button" onClick={() => onOpenLesson(resultLesson)}>
                        Revisit recognition cues
                      </button>
                    ) : null}
                    {solveItem ? (
                      <button className="text-button" onClick={() => onStartSolve(solveItem)}>
                        Continue to blank solve
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="decision-review-summary-actions">
            <button className="primary-button" onClick={() => onStartSprint("academy")}>
              Start another mixed sprint
            </button>
            <button className="secondary-button" onClick={onExit}>Back to Pattern Academy</button>
          </div>
        </section>
      </main>
    );
  }

  if (!probe || !lesson) {
    return (
      <main id="main-content" className="page-container decision-review-page">
        <section className="decision-review-empty">
          <p className="eyebrow">Review unavailable</p>
          <h1>This sprint references retired lesson content.</h1>
          <p>Start a fresh sprint to use the current prompt and lesson revisions.</p>
          <button className="primary-button" onClick={() => onStartSprint("academy")}>
            Start current review
          </button>
          <button className="text-button" onClick={onExit}>Back to Pattern Academy</button>
        </section>
      </main>
    );
  }

  const candidateLessons = probe.candidateLessonIds.flatMap((id) => {
    const candidate = lessons.find((entry) => entry.id === id);
    return candidate ? [candidate] : [];
  });
  const selectedLessonId = saved?.selectedLessonId ?? activeDraft.selectedLessonId;
  const cue = saved?.cue ?? activeDraft.cue;
  const invariant = saved?.invariant ?? activeDraft.invariant;
  const whyNot = saved?.whyNot ?? activeDraft.whyNot;
  const canCommit = Boolean(
    selectedLessonId && cue.trim() && invariant.trim() && whyNot.trim(),
  );
  const comparisonLesson = lessons.find(
    (candidate) => candidate.id === probe.confusableLessonId,
  );

  return (
    <main id="main-content" className="page-container decision-review-page">
      <section className="decision-review-shell">
        <header className="decision-review-header">
          <div>
            <p className="eyebrow">Mixed decision sprint · {sourceLabel(sprint.source)}</p>
            <h1>Prompt {sprint.cursor + 1} of {sprint.entries.length}</h1>
          </div>
          <button className="text-button" onClick={onExit}>Exit to Academy</button>
        </header>
        <div
          className="decision-review-progress"
          role="progressbar"
          aria-label="Decision review progress"
          aria-valuemin={0}
          aria-valuemax={sprint.entries.length}
          aria-valuenow={sprint.cursor}
        >
          <span style={{ width: `${(sprint.cursor / sprint.entries.length) * 100}%` }} />
        </div>

        <article className="decision-prompt-card">
          <span>Pattern hidden · authored prompt revision {probe.revision}</span>
          <h2>{probe.prompt}</h2>
          <p><strong>Constraint:</strong> {probe.constraint}</p>
        </article>

        <section className="decision-commit-panel" aria-labelledby="decision-commit-title">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Commit before reveal</p>
              <h2 id="decision-commit-title">Make the decision explicit.</h2>
            </div>
            {!saved ? (
              <button
                className="text-button"
                aria-expanded={activeDraft.hintShown}
                onClick={() => setDraft({ ...activeDraft, hintShown: true })}
              >
                {activeDraft.hintShown ? "Cue hint opened" : "Need a cue hint?"}
              </button>
            ) : null}
          </div>
          {activeDraft.hintShown && !saved ? (
            <p className="decision-hint" role="status">
              <strong>Hint:</strong> {probe.hint}
            </p>
          ) : null}
          <fieldset disabled={Boolean(saved)}>
            <legend>Choose one pattern family</legend>
            <div className="decision-pattern-options">
              {candidateLessons.map((candidate) => (
                <label key={candidate.id}>
                  <input
                    type="radio"
                    name={`pattern-choice-${sprint.id}-${probe.id}`}
                    value={candidate.id}
                    checked={selectedLessonId === candidate.id}
                    onChange={() =>
                      setDraft({ ...activeDraft, selectedLessonId: candidate.id })
                    }
                  />
                  <span>{candidate.title}</span>
                </label>
              ))}
            </div>
            <label>
              Cue from this prompt
              <textarea
                value={cue}
                maxLength={600}
                onChange={(event) => setDraft({ ...activeDraft, cue: event.target.value })}
                placeholder="Which words or constraints make this pattern earn its keep?"
              />
            </label>
            <label>
              One-sentence invariant
              <textarea
                value={invariant}
                maxLength={800}
                onChange={(event) => setDraft({ ...activeDraft, invariant: event.target.value })}
                placeholder="What must remain true as the algorithm moves?"
              />
            </label>
            <label>
              Why a nearby pattern loses
              <textarea
                value={whyNot}
                maxLength={800}
                onChange={(event) => setDraft({ ...activeDraft, whyNot: event.target.value })}
                placeholder="Name one tempting alternative and the constraint it fails to use."
              />
            </label>
          </fieldset>
          {!saved ? (
            <button
              className="primary-button"
              disabled={!canCommit}
              onClick={() =>
                onCommit(probe, lesson, {
                  selectedLessonId,
                  cue,
                  invariant,
                  whyNot,
                  assisted: activeDraft.hintShown,
                })
              }
            >
              Commit decision
            </button>
          ) : null}
        </section>

        {saved && !saved.revealedAt ? (
          <section className="decision-reveal-gate">
            <div>
              <p className="eyebrow">Decision locked</p>
              <h2>Now compare the reasoning.</h2>
              <p>Your choice cannot be edited after the authored answer is opened.</p>
            </div>
            <button className="primary-button" onClick={() => onReveal(saved.id)}>
              Reveal authored comparison
            </button>
          </section>
        ) : null}

        {saved?.revealedAt ? (
          <section className="decision-comparison" aria-live="polite">
            <header className={saved.match ? "decision-match" : "decision-miss"}>
              <span>{saved.match ? "Pattern choice matched" : "Pattern choice missed"}</span>
              <h2>{lesson.title}</h2>
              <p>
                Your selection: {candidateLessons.find((candidate) => candidate.id === saved.selectedLessonId)?.title ?? "Unavailable"}
              </p>
            </header>
            <div className="decision-comparison-grid">
              <article><span>Authored cue</span><p>{probe.authoredCue}</p></article>
              <article><span>Authored invariant</span><p>{probe.authoredInvariant}</p></article>
              <article>
                <span>Why {comparisonLesson?.title ?? "the confusable"} loses</span>
                <p>{probe.whyConfusableLoses}</p>
              </article>
            </div>
            <div className="decision-self-grade">
              <p>
                Grade the quality of your explanation. This self-grade schedules
                another review; it never changes the objective match above.
              </p>
              <div className="decision-grade-grid" aria-label="Self-grade decision reasoning">
                {GRADES.map((grade) => (
                  <button key={grade.id} onClick={() => onGrade(saved.id, grade.id)}>
                    <strong>{grade.label}</strong>
                    <span>{grade.note}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export type { DecisionInput, PatternDecisionAttempt };
