"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ConceptTransferLane,
  ConceptTransferVariant,
} from "../data/concept-transfer-variants";
import {
  CONCEPT_TRANSFER_GRADES,
  resumeConceptTransferAttempt,
  summarizeConceptTransferWorkspace,
  type ConceptTransferDraft,
  type ConceptTransferGrade,
  type ConceptTransferWorkspace,
} from "../lib/concept-transfer.mjs";

export type ConceptTransferSource =
  | "academy"
  | "today"
  | "assessment"
  | "weakness";

type Props = {
  variants: readonly ConceptTransferVariant[];
  workspace: ConceptTransferWorkspace;
  selectedLane: ConceptTransferLane;
  routedVariantId?: string;
  entrySource: ConceptTransferSource;
  onStart: (
    source: ConceptTransferSource,
    lane: ConceptTransferLane,
    variantId?: string,
  ) => void;
  onSaveDraft: (
    attemptId: string,
    patch: Partial<
      Pick<ConceptTransferDraft, "prediction" | "reconstruction" | "tradeoff">
    >,
  ) => void;
  onRevealHint: (attemptId: string) => void;
  onCommit: (attemptId: string) => void;
  onSaveDebrief: (
    attemptId: string,
    patch: {
      grade?: ConceptTransferGrade;
      criteria?: string[];
      teachBack?: string;
    },
  ) => void;
  onFinish: (
    attemptId: string,
    grade: ConceptTransferGrade,
    criteria: string[],
    teachBack: string,
  ) => void;
  onExit: () => void;
};

const LANES: {
  id: ConceptTransferLane;
  label: string;
  title: string;
  copy: string;
}[] = [
  {
    id: "swift",
    label: "Swift",
    title: "Language reconstruction",
    copy: "Rebuild value semantics, optionals, generics, ownership, actors, and structured concurrency from a sealed scenario.",
  },
  {
    id: "ios",
    label: "iOS",
    title: "Application reconstruction",
    copy: "Rebuild UIKit, SwiftUI, networking, testing, accessibility, and scene-state boundaries without a topic label.",
  },
];

const GRADE_COPY: Record<ConceptTransferGrade, string> = {
  again: "I could not reconstruct the core boundary.",
  hard: "I reconstructed it only after comparison.",
  good: "My answer captured the core invariant.",
  easy: "I could teach and vary this boundary now.",
};

function sourceLabel(source: ConceptTransferSource) {
  return {
    academy: "Pattern Academy",
    today: "Today",
    assessment: "Assessment Center",
    weakness: "Weakness Lab",
  }[source];
}

function displayDue(value?: string) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function ConceptTransferLab({
  variants,
  workspace,
  selectedLane,
  routedVariantId,
  entrySource,
  onStart,
  onSaveDraft,
  onRevealHint,
  onCommit,
  onSaveDebrief,
  onFinish,
  onExit,
}: Props) {
  const [now] = useState(() => new Date().toISOString());
  const active = resumeConceptTransferAttempt(workspace, variants, { now });
  const attempt = active?.attempt;
  const draft = active?.draft;
  const projection = active?.projection;
  const currentLane = active?.variant.lane ?? selectedLane;
  const attemptId = attempt?.id;
  const committedAt = attempt?.committedAt;
  const grade = attempt?.grade;
  const criteria = attempt?.criteria ?? [];
  const teachBack = attempt?.teachBack ?? "";
  const promptHeadingRef = useRef<HTMLHeadingElement>(null);
  const revealHeadingRef = useRef<HTMLHeadingElement>(null);
  const laneSummaries = useMemo(
    () =>
      Object.fromEntries(
        LANES.map((lane) => [
          lane.id,
          summarizeConceptTransferWorkspace(workspace, variants, {
            lane: lane.id,
            now,
          }),
        ]),
      ) as Record<
        ConceptTransferLane,
        ReturnType<typeof summarizeConceptTransferWorkspace>
      >,
    [now, variants, workspace],
  );

  useEffect(() => {
    if (committedAt) revealHeadingRef.current?.focus();
    else if (attemptId) promptHeadingRef.current?.focus();
  }, [attemptId, committedAt]);

  if (!active || !attempt || !projection) {
    const routedVariant = routedVariantId
      ? variants.find((variant) => variant.id === routedVariantId)
      : undefined;
    return (
      <main id="main-content" className="page-container concept-transfer-page">
        <section className="concept-transfer-entry">
          <div>
            <p className="eyebrow">Cold Reconstruction Lab</p>
            <h1>Recognize the boundary, then type it from memory.</h1>
            <p>
              The topic label and reference stay hidden until you commit a
              prediction, a Swift reconstruction, and one tradeoff. Hints are
              permanent assistance evidence.
            </p>
          </div>
          <div className="concept-transfer-boundary">
            <strong>Self-assessed transfer · not compiled or semantically graded</strong>
            <span>
              Swift Ghost compares your syntax and reasoning with original
              project-authored references. It never calls this a verified solve.
            </span>
          </div>
          {routedVariant && routedVariant.lane === selectedLane ? (
            <article className="concept-transfer-routed-card">
              <span>{routedVariant.neutralLabel}</span>
              <h2>A specific sealed scenario is ready.</h2>
              <p>{routedVariant.estimatedMinutes} minute reconstruction</p>
              <button
                className="primary-button"
                onClick={() =>
                  onStart(entrySource, selectedLane, routedVariant.id)
                }
              >
                Start sealed scenario
              </button>
            </article>
          ) : (
            <div
              className="concept-transfer-lane-grid"
              aria-label="Cold reconstruction lanes"
            >
              {LANES.map((lane) => {
                const summary = laneSummaries[lane.id];
                return (
                  <article
                    key={lane.id}
                    className={lane.id === selectedLane ? "is-selected" : ""}
                  >
                    <span>{lane.label}</span>
                    <h2>{lane.title}</h2>
                    <p>{lane.copy}</p>
                    <dl>
                      <div>
                        <dt>New</dt>
                        <dd>{summary.newCount}</dd>
                      </div>
                      <div>
                        <dt>Due</dt>
                        <dd>{summary.dueCount}</dd>
                      </div>
                      <div>
                        <dt>Cold</dt>
                        <dd>{summary.coldSelfAssessedCount}</dd>
                      </div>
                    </dl>
                    <button
                      className={
                        lane.id === selectedLane
                          ? "primary-button"
                          : "secondary-button"
                      }
                      onClick={() => onStart(entrySource, lane.id)}
                    >
                      Start {lane.label} reconstruction
                    </button>
                  </article>
                );
              })}
            </div>
          )}
          <button className="text-button" onClick={onExit}>
            Back to {sourceLabel(entrySource)}
          </button>
        </section>
      </main>
    );
  }

  const response = draft ?? {
    prediction: attempt.prediction ?? "",
    reconstruction: attempt.reconstruction ?? "",
    tradeoff: attempt.tradeoff ?? "",
  };
  const canCommit = Boolean(
    response.prediction.trim() &&
      response.reconstruction.trim() &&
      response.tradeoff.trim(),
  );
  const revealed = projection.revealed ? projection : undefined;
  const canFinish = Boolean(
    grade && criteria.length && teachBack.trim().length,
  );
  const activeAttemptId = attempt.id;

  function toggleCriterion(criterion: string) {
    onSaveDebrief(activeAttemptId, {
      criteria: criteria.includes(criterion)
        ? criteria.filter((entry) => entry !== criterion)
        : [...criteria, criterion],
    });
  }

  return (
    <main id="main-content" className="page-container concept-transfer-page">
      <section className="concept-transfer-shell">
        <header className="concept-transfer-header">
          <div>
            <p className="eyebrow">
              {currentLane === "swift" ? "Swift" : "iOS"} cold reconstruction
            </p>
            <h1>{projection.neutralLabel}</h1>
          </div>
          <button className="text-button" onClick={onExit}>
            Exit lab
          </button>
        </header>

        <article className="concept-transfer-prompt">
          <span>Identity and pattern sealed</span>
          <h2 ref={promptHeadingRef} tabIndex={-1}>
            {projection.scenario}
          </h2>
          <ul>
            {projection.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
          <p>
            Estimated time: {projection.estimatedMinutes} minutes · visible
            answer remains greyed out until commit.
          </p>
        </article>

        <section
          className="concept-transfer-workspace"
          aria-labelledby="concept-transfer-response-title"
        >
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Commit before reveal</p>
              <h2 id="concept-transfer-response-title">
                Reconstruct the smallest honest boundary.
              </h2>
            </div>
            {!attempt.committedAt && draft ? (
              <button
                className="text-button"
                disabled={draft.maxHintLevel >= 3}
                aria-expanded={draft.maxHintLevel > 0}
                onClick={() => onRevealHint(attempt.id)}
              >
                {draft.maxHintLevel >= 3
                  ? "All hints opened"
                  : draft.maxHintLevel
                    ? "Reveal next hint"
                    : "Need a hint?"}
              </button>
            ) : null}
          </div>

          {projection.hints.length ? (
            <ol className="concept-transfer-hints" aria-label="Revealed hints">
              {projection.hints.map((hint, index) => (
                <li key={hint}>
                  <strong>Hint {index + 1}</strong>
                  <span>{hint}</span>
                </li>
              ))}
            </ol>
          ) : null}

          <fieldset disabled={Boolean(attempt.committedAt)}>
            <label>
              <span>{projection.predictionPrompt}</span>
              <textarea
                maxLength={1600}
                value={response.prediction}
                onChange={(event) =>
                  onSaveDraft(attempt.id, { prediction: event.target.value })
                }
                placeholder="Write the observable outcome before syntax."
              />
            </label>
            <label>
              <span>{projection.reconstructionPrompt}</span>
              <textarea
                className="concept-transfer-code"
                spellCheck={false}
                wrap="off"
                maxLength={6000}
                value={response.reconstruction}
                onChange={(event) =>
                  onSaveDraft(attempt.id, {
                    reconstruction: event.target.value,
                  })
                }
                placeholder={"func reconstruct(...) {\n    // type the Swift boundary\n}"}
              />
            </label>
            <label>
              <span>{projection.tradeoffPrompt}</span>
              <textarea
                maxLength={1600}
                value={response.tradeoff}
                onChange={(event) =>
                  onSaveDraft(attempt.id, { tradeoff: event.target.value })
                }
                placeholder="Name when a different boundary would be better."
              />
            </label>
          </fieldset>

          {!attempt.committedAt ? (
            <button
              className="primary-button"
              disabled={!canCommit}
              onClick={() => onCommit(attempt.id)}
            >
              Commit and reveal comparison
            </button>
          ) : null}
        </section>

        {revealed ? (
          <section className="concept-transfer-comparison" aria-live="polite">
            <header>
              <p className="eyebrow">Reference revealed after commitment</p>
              <h2 ref={revealHeadingRef} tabIndex={-1}>
                {revealed.revealedTitle}
              </h2>
              <span>
                {revealed.review.patternLabel} · {attempt.assisted ? "hint-assisted" : "unassisted"}
              </span>
            </header>
            <div className="concept-transfer-boundary">
              <strong>Syntax comparison · not compiled or semantically graded</strong>
              <span>
                The reference is one project-authored implementation. Check the
                invariant and criteria, not exact text equality.
              </span>
            </div>
            <div className="concept-transfer-compare-grid">
              <article>
                <span>Your committed reconstruction</span>
                <pre>
                  <code>{attempt.reconstruction}</code>
                </pre>
              </article>
              <article>
                <span>Project-authored reference</span>
                <pre className="ghosted-reference">
                  <code>{revealed.referenceSnippet}</code>
                </pre>
              </article>
            </div>
            <article className="concept-transfer-review-card">
              <span>Invariant</span>
              <strong>{revealed.review.invariant}</strong>
              <p>{revealed.review.contrast}</p>
            </article>

            <section className="concept-transfer-debrief">
              <div>
                <p className="eyebrow">Self-check · local evidence only</p>
                <h3>Select every criterion your answer actually covered.</h3>
              </div>
              <fieldset>
                <legend>Authored review criteria</legend>
                <div className="concept-transfer-criteria">
                  {revealed.review.criteria.map((criterion) => (
                    <label key={criterion}>
                      <input
                        type="checkbox"
                        checked={criteria.includes(criterion)}
                        onChange={() => toggleCriterion(criterion)}
                      />
                      <span>{criterion}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                <span>{revealed.review.teachBack}</span>
                <textarea
                  maxLength={2000}
                  value={teachBack}
                  onChange={(event) =>
                    onSaveDebrief(attempt.id, {
                      teachBack: event.target.value,
                    })
                  }
                  placeholder="Explain the boundary in your own words."
                />
              </label>
              <fieldset>
                <legend>How independent was this reconstruction?</legend>
                <div className="concept-transfer-grades">
                  {CONCEPT_TRANSFER_GRADES.map((entry) => (
                    <label key={entry}>
                      <input
                        type="radio"
                        name={`concept-transfer-grade-${attempt.id}`}
                        checked={grade === entry}
                        onChange={() =>
                          onSaveDebrief(attempt.id, { grade: entry })
                        }
                      />
                      <span>
                        <strong>
                          {entry[0].toUpperCase() + entry.slice(1)}
                        </strong>
                        <small>{GRADE_COPY[entry]}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="concept-transfer-finish-row">
                <span>
                  Current lane: {laneSummaries[currentLane].dueCount} due · next
                  completed review will receive a durable due date.
                </span>
                <button
                  className="primary-button"
                  disabled={!canFinish}
                  onClick={() =>
                    grade &&
                    onFinish(attempt.id, grade, criteria, teachBack.trim())
                  }
                >
                  Finish and schedule
                </button>
              </div>
            </section>
          </section>
        ) : null}

        <footer className="concept-transfer-footer">
          <span>
            {attempt.wasDue ? "Delayed review" : "New exposure"} · hints used {attempt.maxHintLevel}/3
          </span>
          <span>
            Lane history {laneSummaries[currentLane].completedAttemptCount} · next due {displayDue(
              laneSummaries[currentLane].states
                .filter((state) => state.dueAt)
                .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0]
                ?.dueAt,
            )}
          </span>
        </footer>
      </section>
    </main>
  );
}
