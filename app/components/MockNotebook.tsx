"use client";

import { useId } from "react";
import type { MockNotebook as MockNotebookValue } from "../lib/mock-session.mjs";

const NOTEBOOK_FIELDS = [
  {
    key: "clarifications",
    label: "Clarifications",
    rows: 3,
  },
  {
    key: "approach",
    label: "Approach",
    rows: 4,
  },
  {
    key: "invariant",
    label: "Working invariant",
    rows: 3,
  },
  {
    key: "complexity",
    label: "Time and space complexity",
    rows: 3,
  },
  {
    key: "edgeCases",
    label: "Edge cases",
    rows: 3,
  },
  {
    key: "finalExplanation",
    label: "Final explanation",
    rows: 4,
  },
] as const satisfies ReadonlyArray<{
  key: keyof MockNotebookValue;
  label: string;
  rows: number;
}>;

export type MockNotebookProps = {
  notebook: MockNotebookValue;
  onChange: (notebook: MockNotebookValue) => void;
  promptReady?: boolean;
  approachReady?: boolean;
  onAcknowledgePrompt?: () => void;
  onAcknowledgeApproach?: () => void;
  disabled?: boolean;
};

export function MockNotebook({
  notebook,
  onChange,
  promptReady,
  approachReady,
  onAcknowledgePrompt,
  onAcknowledgeApproach,
  disabled = false,
}: MockNotebookProps) {
  const idPrefix = useId();
  const showsCheckpoints =
    promptReady !== undefined ||
    approachReady !== undefined ||
    Boolean(onAcknowledgePrompt) ||
    Boolean(onAcknowledgeApproach);

  return (
    <section className="mock-notebook" aria-labelledby={`${idPrefix}-title`}>
      <div className="mock-notebook__heading">
        <div>
          <span className="eyebrow">Interview notebook</span>
          <h3 id={`${idPrefix}-title`}>Your working notes</h3>
        </div>
        <small>Saved locally on this device as you write.</small>
      </div>

      {showsCheckpoints && (
        <fieldset className="mock-notebook__checkpoints">
          <legend>Interview checkpoints</legend>
          <div className="mock-notebook__checkpoint-actions">
            {(promptReady !== undefined || onAcknowledgePrompt) && (
              <button
                className="outline-button"
                type="button"
                aria-pressed={Boolean(promptReady)}
                disabled={
                  disabled || Boolean(promptReady) || !onAcknowledgePrompt
                }
                onClick={onAcknowledgePrompt}
              >
                {promptReady ? "Prompt ready recorded" : "I have read the prompt"}
              </button>
            )}
            {(approachReady !== undefined || onAcknowledgeApproach) && (
              <button
                className="outline-button"
                type="button"
                aria-pressed={Boolean(approachReady)}
                disabled={
                  disabled || Boolean(approachReady) || !onAcknowledgeApproach
                }
                onClick={onAcknowledgeApproach}
              >
                {approachReady
                  ? "Approach ready recorded"
                  : "My approach is ready"}
              </button>
            )}
          </div>
        </fieldset>
      )}

      <div className="mock-notebook__fields">
        {NOTEBOOK_FIELDS.map((field) => {
          const inputId = `${idPrefix}-${field.key}`;
          return (
            <label
              className="mock-notebook__field"
              htmlFor={inputId}
              key={field.key}
            >
              <span>{field.label}</span>
              <textarea
                id={inputId}
                name={field.key}
                rows={field.rows}
                value={notebook[field.key]}
                disabled={disabled}
                autoComplete="off"
                spellCheck
                onChange={(event) =>
                  onChange({
                    ...notebook,
                    [field.key]: event.target.value,
                  })
                }
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
