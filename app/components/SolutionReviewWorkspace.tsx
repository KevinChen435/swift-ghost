"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SolutionGuideV1 } from "../data/solution-guides";
import { buildSubmissionDiff } from "../lib/submission-diff.mjs";
import type { PracticeItem } from "../lib/items";
import type { AttemptRecord } from "../lib/product";
import type {
  SolutionReviewMistake,
  SolutionReviewRecord,
  SolutionReviewStep,
} from "../lib/solution-review.mjs";

const STEPS: ReadonlyArray<{
  id: Exclude<SolutionReviewStep, "complete">;
  short: string;
  title: string;
}> = [
  { id: "explain", short: "Explain", title: "Explain before you reveal" },
  { id: "compare", short: "Compare", title: "Compare the reasoning and code" },
  { id: "mistake", short: "Mistake", title: "Capture the first wrong turn" },
  { id: "teach-back", short: "Teach back", title: "Retrieve it without the reference" },
  { id: "schedule", short: "Schedule", title: "Turn reflection into the next action" },
];

const MISTAKES: ReadonlyArray<{
  id: SolutionReviewMistake;
  label: string;
  note: string;
}> = [
  { id: "recognition", label: "Pattern recognition", note: "I did not notice the selecting cue soon enough." },
  { id: "invariant", label: "Invariant or approach", note: "The core relationship was not stable in my explanation." },
  { id: "implementation-plan", label: "Implementation plan", note: "I started coding before the steps were concrete." },
  { id: "edge-case", label: "Edge case or test design", note: "A boundary or counterexample was missing." },
  { id: "python-syntax", label: "Python syntax", note: "Language fluency interrupted the algorithm." },
  { id: "swift-syntax-api", label: "Swift syntax or API", note: "A Swift language or library detail blocked recall." },
  { id: "complexity", label: "Complexity reasoning", note: "I could not justify the time or space bound." },
  { id: "none", label: "No meaningful friction", note: "The solve and explanation both felt stable." },
];

const GRADES = [
  { id: "again", label: "Again", note: "I could not reconstruct it yet." },
  { id: "hard", label: "Hard", note: "I reconstructed it with real effort." },
  { id: "good", label: "Good", note: "I recalled the important parts." },
  { id: "easy", label: "Easy", note: "The cue and invariant came back cleanly." },
] as const;

function formatDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
  }).format(timestamp);
}

function activityLabel(kind: SolutionReviewRecord["activityKind"]) {
  if (kind === "syntax") return "Short language repair, then a full retry";
  if (kind === "concept") return "Explanation recall";
  return "Full independent solve";
}

function ReviewDiff({ submitted, reference }: { submitted: string; reference: string }) {
  const diff = useMemo(
    () => buildSubmissionDiff(submitted, reference),
    [reference, submitted],
  );
  if (diff.identical)
    return <p className="solution-review-note">Your submitted source matches the bundled reference exactly.</p>;
  return (
    <div className="solution-review-diff" role="table" aria-label="Submitted source compared with bundled reference">
      <div className="solution-review-diff-summary" aria-live="polite">
        {diff.summary.removed} submitted-only · {diff.summary.added} reference-only · {diff.summary.unchanged} shared
      </div>
      <div className="solution-review-diff-head" role="row">
        <span role="columnheader">Yours</span>
        <span role="columnheader">Ref</span>
        <span role="columnheader">Line</span>
      </div>
      {diff.rows.map((row, index) =>
        row.type === "omitted" ? (
          <div className="solution-review-diff-row is-omitted" role="row" key={`omit-${index}`}>
            <span role="cell" />
            <span role="cell" />
            <code role="cell">… {row.text} …</code>
          </div>
        ) : (
          <div className={`solution-review-diff-row is-${row.type}`} role="row" key={`${row.type}-${index}`}>
            <span role="cell">{row.submittedLine ?? ""}</span>
            <span role="cell">{row.currentLine ?? ""}</span>
            <code role="cell">{row.text || " "}</code>
          </div>
        ),
      )}
    </div>
  );
}

export type SolutionReviewWorkspaceProps = {
  review: SolutionReviewRecord;
  attempt: AttemptRecord;
  item: PracticeItem;
  submittedSource: string | null;
  guide: SolutionGuideV1 | null;
  onSave: (review: SolutionReviewRecord) => boolean;
  onComplete: (review: SolutionReviewRecord) => boolean;
  onExit: () => void;
  onRetry: () => void;
};

export function SolutionReviewWorkspace({
  review,
  attempt,
  item,
  submittedSource,
  guide,
  onSave,
  onComplete,
  onExit,
  onRetry,
}: SolutionReviewWorkspaceProps) {
  const [draft, setDraft] = useState(review);
  const [announcement, setAnnouncement] = useState("");
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [draft.step]);

  const stepIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.id === draft.step),
  );
  const currentStep = STEPS[stepIndex] ?? STEPS[0];
  const approachId = guide
    ? `${guide.itemId}:r${guide.itemRevision}:canonical`
    : undefined;

  function save(next: SolutionReviewRecord, message: string) {
    if (!onSave(next)) return false;
    setDraft(next);
    setAnnouncement(message);
    return true;
  }

  function goBack() {
    if (draft.status === "completed") return;
    const previous = STEPS[Math.max(0, stepIndex - 1)];
    save({ ...draft, step: previous.id }, `Returned to ${previous.short}`);
  }

  function revealExplanation(skipped: boolean) {
    const now = new Date().toISOString();
    const noResponse = !(
      draft.explainApproach.trim() ||
      draft.explainInvariant.trim() ||
      draft.explainComplexity.trim()
    );
    save(
      {
        ...draft,
        explanationSkipped: skipped || noResponse,
        revealedAt: draft.revealedAt ?? now,
        step: "compare",
        viewedApproachIds:
          approachId && !draft.viewedApproachIds.includes(approachId)
            ? [...draft.viewedApproachIds, approachId]
            : draft.viewedApproachIds,
      },
      skipped || noResponse
        ? "Explanation skipped and reference unlocked"
        : "Explanation saved before reference reveal",
    );
  }

  function showReferenceCode() {
    save(
      { ...draft, referenceCodeRevealed: true },
      "Bundled reference code revealed",
    );
  }

  function continueFromCompare() {
    save(
      { ...draft, comparisonViewed: Boolean(guide), step: "mistake" },
      "Comparison saved",
    );
  }

  function continueFromMistake() {
    if (!draft.mistakeCategory) {
      setAnnouncement("Choose one category, including no meaningful friction");
      return;
    }
    save({ ...draft, step: "teach-back" }, "Mistake reflection saved");
  }

  function commitTeachBack(skipped: boolean) {
    const now = new Date().toISOString();
    save(
      {
        ...draft,
        teachBackResponse: skipped ? "" : draft.teachBackResponse,
        teachBackCommittedAt: now,
        teachBackReferenceRevealedAt: now,
      },
      skipped ? "Teach-back skipped and checklist revealed" : "Teach-back committed before checklist reveal",
    );
  }

  function continueFromTeachBack() {
    if (!draft.teachBackCommittedAt || !draft.grade) {
      setAnnouncement("Commit or skip the answer, then choose a self-rating");
      return;
    }
    save({ ...draft, step: "schedule" }, "Self-rating saved");
  }

  function finishReview() {
    if (onComplete(draft)) setAnnouncement("Review completed and scheduled");
  }

  async function copyReference() {
    if (!guide) return;
    try {
      await navigator.clipboard.writeText(item.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (draft.status === "completed") {
    return (
      <main id="main-content" tabIndex={-1} className="page-container solution-review-page">
        <section className="solution-review-complete" aria-labelledby="solution-review-complete-title">
          <span className="eyebrow">Review complete · private on this device</span>
          <h1 id="solution-review-complete-title">{draft.titleSnapshot}</h1>
          <p>Your accepted attempt remains unchanged. This reflection is learning evidence, not an automatic correctness grade or certification.</p>
          <div className="solution-review-schedule-card">
            <small>Recommended next activity</small>
            <strong>{activityLabel(draft.activityKind)}</strong>
            <time dateTime={draft.dueAt}>{draft.dueAt ? formatDate(draft.dueAt) : "Date unavailable"}</time>
            <p>{draft.scheduleReason}</p>
          </div>
          <dl className="solution-review-complete-summary">
            <div><dt>Self-rating</dt><dd>{draft.grade}</dd></div>
            <div><dt>Primary friction</dt><dd>{MISTAKES.find((entry) => entry.id === draft.mistakeCategory)?.label ?? "Not recorded"}</dd></div>
            <div><dt>Reference code</dt><dd>{draft.referenceCodeRevealed ? "Revealed" : "Not revealed"}</dd></div>
          </dl>
          <div className="solution-review-actions">
            <button className="outline-button" type="button" onClick={onExit}>Back to reviews</button>
            <button className="primary-button" type="button" onClick={onRetry}>Start assisted retry →</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="page-container solution-review-page">
      <header className="solution-review-header">
        <div>
          <button className="text-button" type="button" onClick={onExit}>← Review library</button>
          <span className="eyebrow">Solution review · private on this device</span>
          <h1>{item.title}</h1>
          <p>Reviewing never changes the recorded attempt. Your explanations, notes, source link, and schedule stay in this browser and are never sent to the community profile.</p>
        </div>
        <dl className="solution-review-evidence">
          <div><dt>Outcome</dt><dd>Accepted</dd></div>
          <div><dt>Evidence</dt><dd>{attempt.qualification === "solved" ? "Independent" : "Assisted"}</dd></div>
          <div><dt>Checks</dt><dd>{review.verificationPassed}/{review.verificationTotal}</dd></div>
          <div><dt>Prompt revision</dt><dd>{review.itemRevision}</dd></div>
        </dl>
      </header>

      <ol className="solution-review-stepper" aria-label="Solution review progress">
        {STEPS.map((step, index) => (
          <li className={index === stepIndex ? "is-current" : index < stepIndex ? "is-complete" : ""} aria-current={index === stepIndex ? "step" : undefined} key={step.id}>
            <span>{index + 1}</span><strong>{step.short}</strong>
          </li>
        ))}
      </ol>

      <section className="solution-review-workspace" aria-labelledby="solution-review-step-title">
        <div className="solution-review-step-copy">
          <small>Step {stepIndex + 1} of {STEPS.length} · {currentStep.short}</small>
          <h2 id="solution-review-step-title" ref={headingRef} tabIndex={-1}>{currentStep.title}</h2>
        </div>

        {draft.step === "explain" && (
          <div className="solution-review-form">
            <p>Write what you remember before seeing the bundled guide. This is not graded, and typing is never required to unlock the reference.</p>
            <label><span>Approach</span><small>What data structure or sequence of steps did you use?</small><textarea value={draft.explainApproach} maxLength={2000} onChange={(event) => setDraft({ ...draft, explainApproach: event.target.value })} /></label>
            <label><span>Invariant</span><small>What stayed true as the algorithm ran?</small><textarea value={draft.explainInvariant} maxLength={2000} onChange={(event) => setDraft({ ...draft, explainInvariant: event.target.value })} /></label>
            <label><span>Complexity</span><small>What dominates time and space?</small><textarea value={draft.explainComplexity} maxLength={2000} onChange={(event) => setDraft({ ...draft, explainComplexity: event.target.value })} /></label>
          </div>
        )}

        {draft.step === "compare" && (
          <div className="solution-review-compare">
            {guide ? (
              <>
                <article className="solution-guide-card">
                  <div><span>Project-authored guide</span><small>Reviewed {guide.provenance.reviewedAt} · bundled with Swift Ghost</small></div>
                  <h3>Core approach</h3>
                  <p>{guide.approach.summary}</p>
                  <ol>{guide.approach.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                  <h3>Why it works</h3><p>{guide.approach.correctness}</p>
                  <h3>Complexity reasoning</h3><p>{guide.complexityRationale}</p>
                  <div className="solution-guide-facts"><span><small>Authored invariant</small><strong>{item.invariant}</strong></span><span><small>Complexity headline</small><strong>{item.complexity}</strong></span></div>
                  <h3>Edge cases</h3><ul>{guide.edgeCases.map((edge) => <li key={edge.description}>{edge.description}</li>)}</ul>
                  {guide.alternatives.length ? <><h3>Honest alternatives</h3><div className="solution-guide-alternatives">{guide.alternatives.map((alternative) => <article key={alternative.name}><strong>{alternative.name}</strong><p>{alternative.tradeoff}</p></article>)}</div></> : <p className="solution-review-note">No second approach is authored for this revision, so this review does not pretend there is a comparison.</p>}
                  <h3>Implementation risks</h3><ul>{guide.pitfalls.map((pitfall) => <li key={pitfall}>{pitfall}</li>)}</ul>
                </article>
                <section className="solution-review-code-compare" aria-label="Code comparison">
                  <div className="section-head"><div><small>Exact attempt evidence</small><h3>Your code and the reference</h3></div><span>{submittedSource ? "Source retained" : "Source snapshot unavailable"}</span></div>
                  {!draft.referenceCodeRevealed ? (
                    <div className="solution-review-code-lock"><p>The reasoning is visible. Reveal code separately so conceptual review does not silently become answer copying.</p><button className="outline-button" type="button" onClick={showReferenceCode}>Reveal bundled reference code</button></div>
                  ) : (
                    <>
                      <div className="solution-review-code-columns">
                        <label><span>Your submitted source</span>{submittedSource ? <textarea value={submittedSource} readOnly wrap="off" spellCheck={false} /> : <div className="empty-history"><strong>Source snapshot unavailable.</strong><p>The receipt and review remain, but the source was evicted by the local storage budget.</p></div>}</label>
                        <label><span>Bundled reference</span><textarea value={item.code} readOnly wrap="off" spellCheck={false} /></label>
                      </div>
                      <div className="solution-review-copy-row"><button className="outline-button" type="button" onClick={() => void copyReference()}>{copied ? "Copied" : "Copy reference"}</button></div>
                      {submittedSource ? <details><summary>Show line-by-line comparison</summary><ReviewDiff submitted={submittedSource} reference={item.code} /></details> : null}
                    </>
                  )}
                </section>
              </>
            ) : (
              <div className="empty-history"><strong>No reviewed guide for this exact revision.</strong><p>Your explanation, mistake capture, teach-back, and schedule remain available. Swift Ghost will not invent an editorial or compare against stale content.</p></div>
            )}
          </div>
        )}

        {draft.step === "mistake" && (
          <div className="solution-review-form">
            <fieldset><legend>What was the first meaningful friction?</legend><div className="solution-review-choice-grid">{MISTAKES.map((choice) => <label key={choice.id}><input type="radio" name="solution-review-mistake" checked={draft.mistakeCategory === choice.id} onChange={() => setDraft({ ...draft, mistakeCategory: choice.id })} /><span><strong>{choice.label}</strong><small>{choice.note}</small></span></label>)}</div></fieldset>
            <label><span>What is the first decision you would change?</span><small>Optional private note. Do not diagnose yourself from code alone.</small><textarea value={draft.mistakeNote} maxLength={1200} onChange={(event) => setDraft({ ...draft, mistakeNote: event.target.value })} /></label>
          </div>
        )}

        {draft.step === "teach-back" && (
          <div className="solution-review-form solution-review-teach-back">
            <div className="solution-review-prompt"><small>Bundled retrieval prompt</small><strong>{draft.teachBackPrompt}</strong></div>
            <label><span>Your explanation</span><small>Commit before the checklist appears. No AI or semantic grader evaluates this.</small><textarea disabled={Boolean(draft.teachBackCommittedAt)} value={draft.teachBackResponse} maxLength={2000} onChange={(event) => setDraft({ ...draft, teachBackResponse: event.target.value })} /></label>
            {!draft.teachBackCommittedAt ? <div className="solution-review-inline-actions"><button className="outline-button" type="button" onClick={() => commitTeachBack(true)}>Skip and reveal checklist</button><button className="primary-button" type="button" onClick={() => commitTeachBack(false)}>Commit answer</button></div> : <div className="solution-review-checklist"><small>Self-check · not automatically graded</small><strong>{guide?.approach.correctness ?? item.invariant}</strong>{guide ? <ul>{guide.pitfalls.map((pitfall) => <li key={pitfall}>{pitfall}</li>)}</ul> : null}</div>}
            {draft.teachBackCommittedAt ? <fieldset><legend>How did retrieval feel?</legend><div className="solution-review-grade-grid">{GRADES.map((grade) => <label key={grade.id}><input type="radio" name="solution-review-grade" checked={draft.grade === grade.id} onChange={() => setDraft({ ...draft, grade: grade.id })} /><span><strong>{grade.label}</strong><small>{grade.note}</small></span></label>)}</div></fieldset> : null}
          </div>
        )}

        {draft.step === "schedule" && (
          <div className="solution-review-schedule-preview">
            <span className="eyebrow">Ready to schedule</span>
            <h3>{draft.grade === "again" ? "Full retry tomorrow" : draft.grade === "hard" || attempt.qualification === "assisted" ? "Review within three days" : draft.grade === "easy" ? "Advance the current interval" : "Keep the current interval"}</h3>
            <p>Completing writes one local learning event, computes the exact due date from your current review state, and preserves the original accepted attempt unchanged.</p>
            <dl><div><dt>Self-rating</dt><dd>{draft.grade}</dd></div><div><dt>Friction</dt><dd>{MISTAKES.find((choice) => choice.id === draft.mistakeCategory)?.label}</dd></div><div><dt>Reference exposure</dt><dd>{draft.referenceCodeRevealed ? "Code revealed" : "Reasoning only"}</dd></div></dl>
          </div>
        )}

        <div className="solution-review-footer">
          <button className="outline-button" type="button" disabled={stepIndex === 0} onClick={goBack}>Back</button>
          <div>
            {draft.step === "explain" ? <><button className="outline-button" type="button" onClick={() => revealExplanation(true)}>Skip and reveal</button><button className="primary-button" type="button" onClick={() => revealExplanation(false)}>Save and reveal →</button></> : null}
            {draft.step === "compare" ? <button className="primary-button" type="button" onClick={continueFromCompare}>Continue to mistake capture →</button> : null}
            {draft.step === "mistake" ? <button className="primary-button" type="button" onClick={continueFromMistake}>Save and continue →</button> : null}
            {draft.step === "teach-back" ? <button className="primary-button" type="button" disabled={!draft.teachBackCommittedAt || !draft.grade} onClick={continueFromTeachBack}>Continue to schedule →</button> : null}
            {draft.step === "schedule" ? <button className="primary-button" type="button" onClick={finishReview}>Complete review and schedule →</button> : null}
          </div>
        </div>
        <p className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</p>
      </section>

      <details className="solution-review-privacy"><summary>Private on this device</summary><p>Your explanation, submitted source link, mistake note, teach-back response, and schedule are stored only in the local Swift Ghost state and user-controlled export. Bundled guides are static project content. Nothing here creates peer votes, comments, rankings, certification, or automated grading.</p></details>
    </main>
  );
}
