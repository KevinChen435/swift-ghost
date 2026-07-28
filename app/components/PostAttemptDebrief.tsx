"use client";

import { useState } from "react";
import type { PracticeItem } from "../lib/items";
import type {
  FrictionCategory,
  LearningEvent,
  RetrievalGrade,
} from "../lib/learning-state.mjs";

const GRADES: Array<{
  id: RetrievalGrade;
  label: string;
  note: string;
}> = [
  { id: "again", label: "Again", note: "Could not retrieve it cleanly" },
  { id: "hard", label: "Hard", note: "Got there with real effort" },
  { id: "good", label: "Good", note: "Solid retrieval" },
  { id: "easy", label: "Easy", note: "Immediate and confident" },
];

const FRICTIONS: Array<{ id: FrictionCategory; label: string }> = [
  { id: "none", label: "No meaningful friction" },
  { id: "recognition", label: "Pattern recognition" },
  { id: "invariant", label: "Invariant / approach" },
  { id: "implementation", label: "Implementation plan" },
  { id: "syntax", label: "Language syntax" },
  { id: "complexity", label: "Complexity reasoning" },
  { id: "api", label: "Swift / iOS API" },
];

function recallPrompt(item: PracticeItem, stage: number) {
  if (!item.recallChecks?.length) return undefined;
  return item.recallChecks[Math.min(2, Math.max(0, stage - 2))];
}

export type DebriefInput = Pick<
  LearningEvent,
  "grade" | "friction" | "confidence" | "promptSnapshot" | "response"
>;

export function PostAttemptDebrief({
  item,
  stage,
  existing,
  onSave,
}: {
  item: PracticeItem;
  stage: number;
  existing?: LearningEvent;
  onSave: (input: DebriefInput) => void;
}) {
  const [grade, setGrade] = useState<RetrievalGrade | null>(
    existing?.grade ?? null,
  );
  const [friction, setFriction] = useState<FrictionCategory | null>(
    existing?.friction ?? null,
  );
  const [confidence, setConfidence] = useState<LearningEvent["confidence"]>(
    existing?.confidence ?? 3,
  );
  const prompt = recallPrompt(item, stage);
  const [response, setResponse] = useState(existing?.response ?? "");
  const [saved, setSaved] = useState(Boolean(existing));

  function save() {
    if (!grade || !friction) return;
    onSave({
      grade,
      friction,
      confidence,
      ...(prompt ? { promptSnapshot: prompt } : {}),
      ...(response.trim() ? { response: response.trim() } : {}),
    });
    setSaved(true);
  }

  return (
    <section className="post-attempt-debrief" aria-labelledby="debrief-title">
      <div className="debrief-heading">
        <div>
          <span className="eyebrow">30-second debrief</span>
          <h3 id="debrief-title">What kind of practice should come next?</h3>
        </div>
        <small>Optional · your answer only changes your local coach</small>
      </div>

      <fieldset>
        <legend>How did retrieval feel?</legend>
        <div className="debrief-grade-grid">
          {GRADES.map((option) => (
            <button
              type="button"
              key={option.id}
              className={grade === option.id ? "active" : ""}
              aria-pressed={grade === option.id}
              onClick={() => {
                setGrade(option.id);
                setSaved(false);
              }}
            >
              <strong>{option.label}</strong>
              <small>{option.note}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Where was the friction?</legend>
        <div className="debrief-friction-grid">
          {FRICTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={friction === option.id ? "active" : ""}
              aria-pressed={friction === option.id}
              onClick={() => {
                setFriction(option.id);
                setSaved(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="debrief-confidence">
        <span>Confidence</span>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={confidence}
          onChange={(event) => {
            setConfidence(
              Number(event.target.value) as LearningEvent["confidence"],
            );
            setSaved(false);
          }}
        />
        <strong>{confidence}/5</strong>
      </label>

      {prompt && (
        <label className="debrief-recall">
          <span>Optional teach-back</span>
          <strong>{prompt}</strong>
          <textarea
            value={response}
            maxLength={1000}
            rows={3}
            placeholder="Explain it in your own words. A sentence is enough."
            onChange={(event) => {
              setResponse(event.target.value);
              setSaved(false);
            }}
          />
        </label>
      )}

      <div className="debrief-save-row">
        <button
          type="button"
          className="outline-button"
          disabled={!grade || !friction}
          onClick={save}
        >
          {saved ? "Debrief saved ✓" : "Save debrief"}
        </button>
        <small>
          {saved
            ? "The Daily Coach will use this on your next plan."
            : "Choose a retrieval grade and one friction area, or continue without saving."}
        </small>
      </div>
    </section>
  );
}
