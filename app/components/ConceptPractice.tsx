"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import type { PracticeItem } from "../lib/items";
import type {
  FrictionCategory,
  RetrievalGrade,
} from "../lib/learning-state.mjs";

export type ConceptCompletionInput = {
  response: string;
  grade: RetrievalGrade;
  friction: FrictionCategory;
  confidence: 1 | 2 | 3 | 4 | 5;
  checkIndex: 0 | 1 | 2;
};

const GRADES: Array<{ id: RetrievalGrade; label: string; note: string }> = [
  { id: "again", label: "Again", note: "Could not retrieve the core idea" },
  { id: "hard", label: "Hard", note: "Got there with effort or gaps" },
  { id: "good", label: "Good", note: "Covered the core points" },
  { id: "easy", label: "Easy", note: "Precise and immediate recall" },
];

const FRICTIONS: Array<{ id: FrictionCategory; label: string }> = [
  { id: "none", label: "No friction" },
  { id: "recognition", label: "Recognizing the pattern" },
  { id: "invariant", label: "Naming the invariant" },
  { id: "implementation", label: "Explaining the mechanics" },
  { id: "syntax", label: "Swift syntax" },
  { id: "complexity", label: "Tradeoffs / complexity" },
  { id: "api", label: "Apple API details" },
];

export function ConceptPractice({
  item,
  checkIndex,
  response,
  committedResponse,
  revealed,
  onResponseChange,
  onReveal,
  onComplete,
  companionItem,
  onOpenCompanion,
}: {
  item: PracticeItem;
  checkIndex: 0 | 1 | 2;
  response: string;
  committedResponse?: string;
  revealed: boolean;
  onResponseChange: (value: string) => void;
  onReveal: (assisted: boolean, responseSnapshot: string) => void;
  onComplete: (input: ConceptCompletionInput) => void;
  companionItem?: PracticeItem;
  onOpenCompanion?: (item: PracticeItem) => void;
}) {
  const [grade, setGrade] = useState<RetrievalGrade | null>(null);
  const [friction, setFriction] = useState<FrictionCategory>("none");
  const [confidence, setConfidence] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [traceValue, setTraceValue] = useState("");
  const question = item.recallChecks?.[checkIndex] ?? item.summary;
  const answer = item.conceptAnswers?.[checkIndex] ?? item.invariant;
  const snapshot = committedResponse ?? response;
  const traceProgress = useMemo(() => {
    if (!answer.length) return 100;
    let correct = 0;
    while (correct < traceValue.length && traceValue[correct] === answer[correct])
      correct += 1;
    return Math.round((correct / answer.length) * 100);
  }, [answer, traceValue]);

  function revealReference() {
    if (revealed) return;
    onReveal(!response.trim(), response);
  }

  function save() {
    if (!revealed || !grade) return;
    onComplete({ response: snapshot, grade, friction, confidence, checkIndex });
  }

  function moveGrade(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
      return;
    event.preventDefault();
    const direction =
      event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const nextIndex = (index + direction + GRADES.length) % GRADES.length;
    setGrade(GRADES[nextIndex].id);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]',
    );
    buttons?.[nextIndex]?.focus();
  }

  function handleShortcut(event: KeyboardEvent<HTMLElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
    event.preventDefault();
    if (!revealed) revealReference();
    else save();
  }

  return (
    <section className="concept-workbench" onKeyDown={handleShortcut}>
      <header className="concept-brief">
        <div>
          <span className="eyebrow">Swift / iOS concept recall · Card {checkIndex + 1} of 3</span>
          <h2>Explain it before the reference appears.</h2>
          <p>{question}</p>
        </div>
        <span className="concept-private">Private · saved on this device</span>
      </header>

      <div className="concept-answer-grid">
        <article className="concept-response-card">
          <div className="concept-card-heading">
            <div>
              <small>Your explanation</small>
              <strong>{revealed ? "Response committed" : "Use your own words"}</strong>
            </div>
            <span>{response.length}/1000</span>
          </div>
          <textarea
            value={revealed ? snapshot : response}
            readOnly={revealed}
            maxLength={1000}
            onChange={(event) => onResponseChange(event.target.value.slice(0, 1000))}
            placeholder="What happens, why does it happen, and what tradeoff matters?"
            aria-label="Your private concept explanation"
            autoFocus
          />
          {!revealed && (
            <div className="concept-commit-row">
              <button className="primary-button" onClick={revealReference} aria-keyshortcuts="Control+Enter Meta+Enter">
                {response.trim() ? "Commit & compare answer →" : "I don't know · reveal grey answer"}
              </button>
              <small>⌘/Ctrl + Enter · your response freezes before reveal</small>
            </div>
          )}
        </article>

        <article className={`concept-reference-card ${revealed ? "revealed" : "locked"}`}>
          <div className="concept-card-heading">
            <div>
              <small>Authored reference</small>
              <strong>{revealed ? "Compare the important claims" : "Hidden until you commit"}</strong>
            </div>
            <span aria-hidden="true">{revealed ? "✓" : "◌"}</span>
          </div>
          {revealed ? (
            <p>{answer}</p>
          ) : (
            <p className="concept-redacted" aria-label="Reference answer hidden">
              The reference answer stays greyed out until you commit your explanation.
            </p>
          )}
        </article>
      </div>

      {revealed && (
        <>
          <section className="concept-trace-card">
            <div className="concept-card-heading">
              <div>
                <small>Optional guided typing</small>
                <strong>Trace the known answer to rebuild typing fluency.</strong>
              </div>
              <span>{traceProgress}% traced</span>
            </div>
            <div className="concept-trace-editor">
              <p aria-hidden="true">{answer}</p>
              <textarea
                value={traceValue}
                onChange={(event) => {
                  const next = event.target.value;
                  if (answer.startsWith(next)) setTraceValue(next);
                }}
                spellCheck={false}
                aria-label="Type over the grey reference answer"
              />
            </div>
          </section>

          <section className="concept-assessment">
            <div>
              <span className="eyebrow">Self-rated recall · not automated correctness</span>
              <h3>How much did you retrieve before reveal?</h3>
            </div>
            <div className="concept-grade-grid" role="radiogroup" aria-label="Retrieval grade">
              {GRADES.map((option, index) => (
                <button
                  key={option.id}
                  role="radio"
                  aria-checked={grade === option.id}
                  tabIndex={grade === option.id || (!grade && index === 0) ? 0 : -1}
                  className={grade === option.id ? "active" : ""}
                  onClick={() => setGrade(option.id)}
                  onKeyDown={(event) => moveGrade(event, index)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.note}</small>
                </button>
              ))}
            </div>
            <div className="concept-reflection-grid">
              <label>
                <span>Main friction</span>
                <select value={friction} onChange={(event) => setFriction(event.target.value as FrictionCategory)}>
                  {FRICTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span>Confidence · {confidence}/5</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={confidence}
                  onChange={(event) => setConfidence(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}
                />
              </label>
            </div>
            <div className="concept-save-row">
              <p>Good/Easy counts as strong evidence only when you wrote an answer before revealing the reference.</p>
              <button className="primary-button" disabled={!grade} onClick={save} aria-keyshortcuts="Control+Enter Meta+Enter">
                Save concept recall →
              </button>
            </div>
          </section>

          {companionItem && onOpenCompanion ? (
            <aside className="concept-companion-card">
              <div>
                <span className="eyebrow">Next step · portable execution</span>
                <h3>{companionItem.title}</h3>
                <p>
                  Turn this recall card into an isolated Swift solve. Public
                  examples are practice feedback; sealed cases remain private.
                </p>
              </div>
              <button
                className="outline-button"
                type="button"
                onClick={() => onOpenCompanion(companionItem)}
              >
                Open isolated Swift solve →
              </button>
            </aside>
          ) : null}
        </>
      )}
    </section>
  );
}
