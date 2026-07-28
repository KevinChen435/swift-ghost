"use client";

import { useEffect, useId, useRef } from "react";
import {
  MOCK_CHECKPOINT_KINDS,
  MOCK_MISTAKE_TAGS,
  MOCK_NOTEBOOK_FIELDS,
  MOCK_REFLECTION_FIELDS,
  MOCK_RUBRIC_DIMENSIONS,
  isMockDebriefComplete,
} from "../lib/mock-session.mjs";
import type {
  MockCheckpointKind,
  MockCheckpoints,
  MockDebrief,
  MockMistakeTag,
  MockNotebook,
  MockRubricDimension,
} from "../lib/mock-session.mjs";

const NOTEBOOK_LABELS = {
  clarifications: "Clarifications",
  approach: "Approach",
  invariant: "Working invariant",
  complexity: "Time and space complexity",
  edgeCases: "Edge cases",
  finalExplanation: "Final explanation",
} as const satisfies Record<keyof MockNotebook, string>;

const CHECKPOINT_LABELS = {
  promptAcknowledged: "Prompt acknowledged",
  approachReady: "Approach ready",
  codingStarted: "Coding started",
  firstTest: "First test",
  codeCompleted: "Code completed",
  explanationReady: "Explanation ready",
} as const satisfies Record<MockCheckpointKind, string>;

const RUBRIC_LABELS = {
  recognition: "Recognition",
  reasoning: "Reasoning",
  implementation: "Implementation",
  verification: "Verification",
  communication: "Communication",
} as const satisfies Record<MockRubricDimension, string>;

const REFLECTION_LABELS = {
  algorithmic: "Algorithmic reflection",
  languageFluency: "Language fluency",
  communication: "Communication reflection",
  nextStep: "Next step",
} as const satisfies Record<
  (typeof MOCK_REFLECTION_FIELDS)[number],
  string
>;

export type MockDebriefOutcome = "completed" | "ended" | "expired";

export type MockDebriefDialogProps = {
  outcome: MockDebriefOutcome;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  notebook: MockNotebook;
  checkpoints: MockCheckpoints;
  problems?: ReadonlyArray<{
    title: string;
    notebook: MockNotebook;
    checkpoints: MockCheckpoints;
    source?: string;
  }>;
  value: MockDebrief;
  onChange: (debrief: MockDebrief) => void;
  onSave: (debrief: MockDebrief) => void;
  onClose: () => void;
  title?: string;
  saving?: boolean;
};

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function elapsedBetween(startedAt: string, endedAt: string) {
  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return null;
  return Math.max(0, ended - started);
}

function mistakeTagLabel(tag: MockMistakeTag) {
  return tag
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function useDialogKeyboard(
  dialogRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = () => [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]",
      ) ?? []),
    ];
    const frame = window.requestAnimationFrame(() => {
      const initial =
        dialogRef.current?.querySelector<HTMLElement>(
          "[data-modal-autofocus]",
        ) ?? focusable()[0];
      initial?.focus();
    });

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [dialogRef]);
}

export function MockDebriefDialog({
  outcome,
  startedAt,
  endedAt,
  durationMinutes,
  notebook,
  checkpoints,
  problems,
  value,
  onChange,
  onSave,
  onClose,
  title = "Mock interview debrief",
  saving = false,
}: MockDebriefDialogProps) {
  const idPrefix = useId();
  const dialogRef = useRef<HTMLElement>(null);
  useDialogKeyboard(dialogRef, onClose);
  const elapsedMs = elapsedBetween(startedAt, endedAt);
  const allScoresSelected = isMockDebriefComplete(value);
  const selectedTags = new Set(
    value.mistakeTags.filter((tag) => MOCK_MISTAKE_TAGS.includes(tag)),
  );
  const outcomeLabel =
    outcome === "completed"
      ? "Completed"
      : outcome === "expired"
        ? "Time expired"
        : "Ended early";
  const problemEvidence =
    problems?.length
      ? problems
      : [{ title: "Problem evidence", notebook, checkpoints }];

  function updateScore(
    dimension: MockRubricDimension,
    score: 0 | 1 | 2,
  ) {
    onChange({
      ...value,
      scores: {
        ...value.scores,
        [dimension]: score,
      },
    });
  }

  function updateMistakeTag(tag: MockMistakeTag, checked: boolean) {
    const nextSelected = new Set(selectedTags);
    if (checked) nextSelected.add(tag);
    else nextSelected.delete(tag);
    onChange({
      ...value,
      mistakeTags: MOCK_MISTAKE_TAGS.filter((candidate) =>
        nextSelected.has(candidate),
      ),
    });
  }

  return (
    <div
      className="dialog-backdrop mock-debrief-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="result-dialog mock-debrief-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idPrefix}-title`}
        aria-describedby={`${idPrefix}-summary`}
        tabIndex={-1}
      >
        <button
          className="dialog-close"
          type="button"
          onClick={onClose}
          aria-label="Close mock interview debrief"
        >
          ×
        </button>

        <span className="eyebrow">Post-interview review</span>
        <h2 id={`${idPrefix}-title`} tabIndex={-1} data-modal-autofocus>
          {title}
        </h2>
        <p id={`${idPrefix}-summary`}>
          Review what happened, then assess the interview in your own words.
        </p>

        <section
          className="result-forensics mock-debrief-dialog__timing"
          aria-labelledby={`${idPrefix}-timing-title`}
        >
          <div className="result-forensics-head">
            <span>
              <small>Session outcome</small>
              <strong id={`${idPrefix}-timing-title`}>{outcomeLabel}</strong>
            </span>
          </div>
          <div className="forensics-summary">
            <span>
              <small>Elapsed</small>
              <strong>
                {elapsedMs === null ? "Unavailable" : formatElapsed(elapsedMs)}
              </strong>
            </span>
            <span>
              <small>Timebox</small>
              <strong>{Math.max(1, Math.round(durationMinutes))} min</strong>
            </span>
          </div>
        </section>

        <section
          className="mock-debrief-dialog__evidence"
          aria-labelledby={`${idPrefix}-evidence-title`}
        >
          <div className="debrief-heading">
            <div>
              <span className="eyebrow">Read-only evidence</span>
              <h3 id={`${idPrefix}-evidence-title`}>Notebook and checkpoints</h3>
            </div>
          </div>

          <div className="mock-debrief-dialog__problems">
            {problemEvidence.map((problem, problemIndex) => (
              <article key={`${problem.title}-${problemIndex}`}>
                <h4>{problem.title}</h4>
                <dl className="mock-debrief-dialog__notebook">
                  {MOCK_NOTEBOOK_FIELDS.map((field) => (
                    <div key={field}>
                      <dt>{NOTEBOOK_LABELS[field]}</dt>
                      <dd>
                        {problem.notebook[field].trim() || "Not recorded"}
                      </dd>
                    </div>
                  ))}
                </dl>

                <ol className="mock-debrief-dialog__checkpoints">
                  {MOCK_CHECKPOINT_KINDS.map((checkpoint) => {
                    const atMs = problem.checkpoints[checkpoint];
                    return (
                      <li key={checkpoint}>
                        <span>{CHECKPOINT_LABELS[checkpoint]}</span>
                        <strong>
                          {atMs === undefined
                            ? "Not recorded"
                            : formatElapsed(atMs)}
                        </strong>
                      </li>
                    );
                  })}
                </ol>
                {problem.source?.trim() && (
                  <details className="mock-debrief-dialog__source">
                    <summary>Final source snapshot</summary>
                    <pre>
                      <code>{problem.source}</code>
                    </pre>
                  </details>
                )}
              </article>
            ))}
          </div>
        </section>

        <section
          className="post-attempt-debrief mock-debrief-dialog__assessment"
          aria-labelledby={`${idPrefix}-assessment-title`}
        >
          <div className="debrief-heading">
            <div>
              <span className="eyebrow">Self-assessment</span>
              <h3 id={`${idPrefix}-assessment-title`}>Score each dimension</h3>
            </div>
            <small>0 = needs work · 1 = developing · 2 = strong</small>
          </div>

          <div className="mock-debrief-dialog__rubric">
            {MOCK_RUBRIC_DIMENSIONS.map((dimension) => (
              <fieldset key={dimension}>
                <legend>{RUBRIC_LABELS[dimension]}</legend>
                <div className="debrief-friction-grid">
                  {([0, 1, 2] as const).map((score) => {
                    const inputId = `${idPrefix}-${dimension}-${score}`;
                    return (
                      <label htmlFor={inputId} key={score}>
                        <input
                          id={inputId}
                          type="radio"
                          name={`${idPrefix}-${dimension}`}
                          value={score}
                          checked={value.scores[dimension] === score}
                          onChange={() => updateScore(dimension, score)}
                        />
                        <span>{score}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <fieldset className="mock-debrief-dialog__mistakes">
            <legend>Mistake tags</legend>
            <div className="debrief-friction-grid">
              {MOCK_MISTAKE_TAGS.map((tag) => {
                const inputId = `${idPrefix}-mistake-${tag}`;
                return (
                  <label htmlFor={inputId} key={tag}>
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={selectedTags.has(tag)}
                      onChange={(event) =>
                        updateMistakeTag(tag, event.target.checked)
                      }
                    />
                    <span>{mistakeTagLabel(tag)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="custom-form mock-debrief-dialog__reflections">
            {MOCK_REFLECTION_FIELDS.map((field) => {
              const inputId = `${idPrefix}-${field}`;
              return (
                <label htmlFor={inputId} key={field}>
                  <span>{REFLECTION_LABELS[field]}</span>
                  <textarea
                    id={inputId}
                    rows={3}
                    value={value[field]}
                    onChange={(event) =>
                      onChange({ ...value, [field]: event.target.value })
                    }
                  />
                </label>
              );
            })}
          </div>
        </section>

        <div className="debrief-save-row mock-debrief-dialog__actions">
          <button
            className="primary-button"
            type="button"
            disabled={!allScoresSelected || saving}
            onClick={() => onSave(value)}
          >
            {saving ? "Saving…" : "Save debrief"}
          </button>
          <button className="outline-button" type="button" onClick={onClose}>
            Close
          </button>
          {!allScoresSelected && (
            <small>Select a 0–2 score for all five dimensions to save.</small>
          )}
        </div>
      </section>
    </div>
  );
}
