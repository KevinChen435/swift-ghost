"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PracticeItem } from "../lib/items";
import type { RetrievalGrade } from "../lib/learning-state.mjs";
import type {
  TestDesignProbe,
  TestDesignSource,
  TestPurpose,
} from "../data/test-design-probes";
import {
  deriveTestDesignOverview,
  type TestDesignInput,
  type TestDesignWorkspace,
} from "../lib/test-design.mjs";

type Props = {
  probes: readonly TestDesignProbe[];
  items: readonly PracticeItem[];
  workspace: TestDesignWorkspace;
  routedSprintId?: string;
  onStartSprint: (source: TestDesignSource) => void;
  onSaveDraft: (probe: TestDesignProbe, input: TestDesignInput) => void;
  onCommit: (probe: TestDesignProbe, input: TestDesignInput) => void;
  onReveal: (attemptId: string) => void;
  onGrade: (attemptId: string, grade: RetrievalGrade) => void;
  onExit: () => void;
  onStartSolve: (item: PracticeItem) => void;
};

const PURPOSES: { id: TestPurpose; label: string; note: string }[] = [
  { id: "baseline", label: "Baseline", note: "Prove the main contract" },
  {
    id: "boundary",
    label: "Boundary",
    note: "Exercise an edge of the input domain",
  },
  {
    id: "adversarial",
    label: "Adversarial",
    note: "Break a tempting wrong shortcut",
  },
  {
    id: "regression",
    label: "Regression",
    note: "Pin a specific defect after it is known",
  },
];
const GRADES: { id: RetrievalGrade; label: string }[] = [
  { id: "again", label: "Again" },
  { id: "hard", label: "Hard" },
  { id: "good", label: "Good" },
  { id: "easy", label: "Easy" },
];

function sourceLabel(source: TestDesignSource) {
  return {
    academy: "Pattern Academy",
    today: "Today",
    assessment: "Assessment follow-up",
    weakness: "Weakness Lab",
  }[source];
}

export function TestDesignLab({
  probes,
  items,
  workspace,
  routedSprintId,
  onStartSprint,
  onSaveDraft,
  onCommit,
  onReveal,
  onGrade,
  onExit,
  onStartSolve,
}: Props) {
  const sprint = workspace.activeSprint;
  const entry =
    sprint?.status === "active" ? sprint.entries[sprint.cursor] : undefined;
  const probe = probes.find(
    (candidate) =>
      candidate.id === entry?.probeId &&
      candidate.revision === entry.probeRevision,
  );
  const item = items.find(
    (candidate) =>
      candidate.itemId === probe?.itemId &&
      candidate.contentRevision === probe.itemRevision,
  );
  const attempt = workspace.attempts.find(
    (candidate) =>
      candidate.sprintId === sprint?.id &&
      candidate.probeId === probe?.id &&
      !candidate.completedAt,
  );
  const persisted = workspace.drafts.find(
    (candidate) =>
      candidate.sprintId === sprint?.id && candidate.probeId === probe?.id,
  );
  const draft: TestDesignInput = persisted ?? {
    purpose: "",
    assumption: "",
    input: "",
    expected: "",
    defectCaught: "",
    assisted: false,
  };
  const overview = deriveTestDesignOverview(probes, workspace, {
    now: new Date().toISOString(),
  });
  const promptHeadingRef = useRef<HTMLHeadingElement>(null);
  const revealHeadingRef = useRef<HTMLHeadingElement>(null);
  const itemsById = useMemo(
    () => new Map(items.map((candidate) => [candidate.itemId, candidate])),
    [items],
  );
  const update = (partial: Partial<TestDesignInput>) =>
    probe && onSaveDraft(probe, { ...draft, ...partial });
  const canCommit = Boolean(
    draft.purpose &&
    draft.assumption.trim() &&
    draft.input.trim() &&
    draft.expected.trim() &&
    draft.defectCaught.trim(),
  );

  useEffect(() => {
    if (attempt?.revealedAt) revealHeadingRef.current?.focus();
    else if (probe) promptHeadingRef.current?.focus();
  }, [attempt?.revealedAt, probe]);

  if (!sprint || (routedSprintId && routedSprintId !== sprint.id))
    return (
      <main id="main-content" className="page-container test-design-page">
        <section className="test-design-empty">
          <p className="eyebrow">Test Design Lab</p>
          <h1>Make the failure concrete before writing code.</h1>
          <p>
            Design three small Python-call cases. Commit the purpose,
            assumption, input, oracle, and defect before seeing project-authored
            references.
          </p>
          <div className="test-design-boundary">
            This is design evidence only. Your case is not executed, copied into
            the editor, or treated as a solve.
          </div>
          <button
            className="primary-button"
            onClick={() => onStartSprint("academy")}
          >
            Start 3-prompt lab
          </button>
          <button className="text-button" onClick={onExit}>
            Back to Pattern Academy
          </button>
        </section>
      </main>
    );

  if (sprint.status === "completed") {
    const completed = workspace.attempts.filter(
      (candidate) => candidate.sprintId === sprint.id && candidate.completedAt,
    );
    const confirmed = completed.filter(
      (candidate) => candidate.oracleStatus === "confirmed",
    ).length;
    const purposeMatches = completed.filter(
      (candidate) => candidate.purposeMatch,
    ).length;
    return (
      <main id="main-content" className="page-container test-design-page">
        <section className="test-design-summary">
          <p className="eyebrow">Lab complete · {sourceLabel(sprint.source)}</p>
          <h1>
            {confirmed}/{completed.length} oracles confirmed against reference
            cases.
          </h1>
          <p>
            {purposeMatches} purpose choices matched. Novel cases remain
            unverified—not wrong—until they are actually checked.
          </p>
          <dl className="test-design-summary-stats">
            <div>
              <dt>Ready now</dt>
              <dd>{overview.readyCount}</dd>
            </div>
            <div>
              <dt>Retained</dt>
              <dd>
                {overview.retainedCount}/{overview.totalSkills}
              </dd>
            </div>
            <div>
              <dt>History</dt>
              <dd>
                {
                  workspace.attempts.filter(
                    (candidate) => candidate.completedAt,
                  ).length
                }
              </dd>
            </div>
          </dl>
          <div className="test-design-results">
            {completed.map((result) => {
              const resultProbe = probes.find(
                (candidate) =>
                  candidate.id === result.probeId &&
                  candidate.revision === result.probeRevision,
              );
              const solve = itemsById.get(result.itemId);
              return (
                <article key={result.id}>
                  <span className={`oracle-${result.oracleStatus}`}>
                    {result.oracleStatus}
                  </span>
                  <h2>{resultProbe?.title ?? "Retired exercise"}</h2>
                  <p>
                    {result.purposeMatch
                      ? "Purpose matched"
                      : "Purpose differed"}{" "}
                    · {result.assisted ? "hint used" : "unassisted"}
                  </p>
                  {solve ? (
                    <button
                      className="text-button"
                      onClick={() => onStartSolve(solve)}
                    >
                      Continue to blank solve
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
          <div className="test-design-summary-actions">
            <button
              className="primary-button"
              onClick={() => onStartSprint("academy")}
            >
              Start another lab
            </button>
            <button className="secondary-button" onClick={onExit}>
              Back to Pattern Academy
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!probe || !item)
    return (
      <main id="main-content" className="page-container test-design-page">
        <section className="test-design-empty">
          <p className="eyebrow">Lab unavailable</p>
          <h1>This sprint references retired content.</h1>
          <p>Start a fresh sprint to use current exercise revisions.</p>
          <button
            className="primary-button"
            onClick={() => onStartSprint("academy")}
          >
            Start current lab
          </button>
          <button className="text-button" onClick={onExit}>
            Back to Pattern Academy
          </button>
        </section>
      </main>
    );

  const display = attempt ?? draft;
  return (
    <main id="main-content" className="page-container test-design-page">
      <section className="test-design-shell">
        <header className="test-design-header">
          <div>
            <p className="eyebrow">
              Test-design sprint · {sourceLabel(sprint.source)}
            </p>
            <h1>
              Prompt {sprint.cursor + 1} of {sprint.entries.length}
            </h1>
          </div>
          <button className="text-button" onClick={onExit}>
            Exit to Academy
          </button>
        </header>
        <div
          className="test-design-progress"
          role="progressbar"
          aria-label="Test design progress"
          aria-valuemin={0}
          aria-valuemax={sprint.entries.length}
          aria-valuenow={sprint.cursor}
        >
          <span
            style={{
              width: `${(sprint.cursor / sprint.entries.length) * 100}%`,
            }}
          />
        </div>
        <article className="test-design-prompt">
          <span>Pattern and solution hidden · Python call arguments</span>
          <h2 ref={promptHeadingRef} tabIndex={-1}>
            {probe.prompt}
          </h2>
          <p>
            <strong>Contract:</strong> {probe.constraint}
          </p>
        </article>
        <section
          className="test-design-commit"
          aria-labelledby="test-design-commit-title"
        >
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Commit before reveal</p>
              <h2 id="test-design-commit-title">
                Name exactly what this case proves.
              </h2>
            </div>
            {!attempt ? (
              <button
                className="text-button"
                aria-expanded={draft.assisted}
                onClick={() => update({ assisted: true })}
              >
                {draft.assisted ? "Hint opened" : "Need a hint?"}
              </button>
            ) : null}
          </div>
          {draft.assisted && !attempt ? (
            <p className="test-design-hint" role="status">
              <strong>Hint:</strong> {probe.hint}
            </p>
          ) : null}
          <fieldset disabled={Boolean(attempt)}>
            <legend>Test purpose (choose one)</legend>
            <div className="test-purpose-grid">
              {PURPOSES.map((purpose) => (
                <label key={purpose.id}>
                  <input
                    type="radio"
                    name={`purpose-${sprint.id}-${probe.id}`}
                    checked={display.purpose === purpose.id}
                    onChange={() => update({ purpose: purpose.id })}
                  />
                  <span>
                    <strong>{purpose.label}</strong>
                    <small>{purpose.note}</small>
                  </span>
                </label>
              ))}
            </div>
            <label>
              One assumption
              <textarea
                maxLength={800}
                value={display.assumption}
                onChange={(event) => update({ assumption: event.target.value })}
                placeholder="What must be true about the input or output contract?"
              />
            </label>
            <label>
              Smallest useful input{" "}
              <small>
                JSON list of Python call arguments, or plain planning text
              </small>
              <textarea
                className="test-code-input"
                spellCheck={false}
                maxLength={4000}
                value={display.input}
                onChange={(event) => update({ input: event.target.value })}
                placeholder="Example: [[4], 8]"
              />
            </label>
            <label>
              Expected result{" "}
              <small>JSON when you want an authored oracle match</small>
              <textarea
                className="test-code-input"
                spellCheck={false}
                maxLength={4000}
                value={display.expected}
                onChange={(event) => update({ expected: event.target.value })}
                placeholder="Example: []"
              />
            </label>
            <label>
              Defect this catches
              <textarea
                maxLength={1000}
                value={display.defectCaught}
                onChange={(event) =>
                  update({ defectCaught: event.target.value })
                }
                placeholder="What tempting implementation would fail this case?"
              />
            </label>
          </fieldset>
          {!attempt ? (
            <button
              className="primary-button"
              disabled={!canCommit}
              onClick={() => onCommit(probe, draft)}
            >
              Commit test design
            </button>
          ) : null}
        </section>
        {attempt && !attempt.revealedAt ? (
          <section className="test-design-reveal">
            <div>
              <p className="eyebrow">Design locked</p>
              <h2>Now inspect the reference cases.</h2>
              <p>Your committed fields cannot be edited after reveal.</p>
            </div>
            <button
              className="primary-button"
              onClick={() => onReveal(attempt.id)}
            >
              Reveal project-authored cases
            </button>
          </section>
        ) : null}
        {attempt?.revealedAt ? (
          <section className="test-design-comparison" aria-live="polite">
            <header>
              <span>Objective checks</span>
              <h2 ref={revealHeadingRef} tabIndex={-1}>
                {attempt.purposeMatch
                  ? "Purpose matched"
                  : "Purpose did not match the authored target"}
              </h2>
              <p className={`oracle-${attempt.oracleStatus}`}>
                Oracle {attempt.oracleStatus}
                {attempt.oracleStatus === "unverified"
                  ? " · novel or non-JSON cases are not marked wrong"
                  : ""}
              </p>
            </header>
            <div className="test-reference-notice">
              <strong>Project-authored learning cases</strong>
              <span>
                These references are original teaching examples, not hidden
                judge cases. Your committed case has not been executed or copied
                anywhere.
              </span>
            </div>
            <div className="test-reference-grid">
              {probe.referenceCases.map((reference) => (
                <article key={reference.id}>
                  <span>{reference.purpose}</span>
                  <h3>{reference.rationale}</h3>
                  <pre>
                    <code>
                      args = {reference.input}
                      {"\n"}expected = {reference.expected}
                    </code>
                  </pre>
                  <p>
                    <strong>Catches:</strong> {reference.defectCaught}
                  </p>
                </article>
              ))}
            </div>
            <div className="test-design-self-grade">
              <p>
                Self-grade your reasoning quality. This schedules review but
                never changes the objective checks above.
              </p>
              <div>
                {GRADES.map((grade) => (
                  <button
                    key={grade.id}
                    onClick={() => onGrade(attempt.id, grade.id)}
                  >
                    {grade.label}
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
