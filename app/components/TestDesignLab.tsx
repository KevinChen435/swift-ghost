"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PracticeItem } from "../lib/items";
import type { RetrievalGrade } from "../lib/learning-state.mjs";
import type {
  TestDesignProbe,
  TestDesignLane,
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
  selectedLane: TestDesignLane;
  entrySource: TestDesignSource;
  routedSprintId?: string;
  selectedAttemptId?: string;
  onStartSprint: (source: TestDesignSource, lane: TestDesignLane) => void;
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

const LANES: {
  id: TestDesignLane;
  label: string;
  title: string;
  copy: string;
}[] = [
  {
    id: "python",
    label: "Python",
    title: "Algorithm counterexamples",
    copy: "Design compact call cases for collections, normalization, and window boundaries.",
  },
  {
    id: "swift",
    label: "Swift",
    title: "Language and concurrency contracts",
    copy: "Plan observations for value semantics, errors, ownership, and structured concurrency.",
  },
  {
    id: "ios",
    label: "iOS",
    title: "Framework behavior scenarios",
    copy: "Exercise lifecycle, state restoration, networking, test seams, and accessibility.",
  },
];

function laneLabel(lane: TestDesignLane) {
  return LANES.find((entry) => entry.id === lane)?.label ?? lane;
}

function inputCopy(probe: TestDesignProbe) {
  if (probe.lane === "python")
    return {
      tag: "Python call arguments",
      help: "JSON list of Python call arguments, or plain planning text",
      placeholder: "Example: [[4], 8]",
    };
  if (probe.lane === "swift")
    return {
      tag: probe.inputFormat === "event-sequence" ? "Swift event sequence" : "Swift structured scenario",
      help: "JSON setup and observation steps, or plain planning text",
      placeholder: '{"setup":"smallest useful state","action":"one change"}',
    };
  return {
    tag: "iOS behavior scenario",
    help: "JSON lifecycle, state, network, or accessibility events",
    placeholder: '{"events":["load","appear","layout"]}',
  };
}

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
  selectedLane,
  entrySource,
  routedSprintId,
  selectedAttemptId,
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
  const currentLane = sprint?.lane ?? selectedLane;
  const laneOverviews = Object.fromEntries(
    LANES.map((lane) => [
      lane.id,
      deriveTestDesignOverview(probes, workspace, {
        lane: lane.id,
        now: new Date().toISOString(),
      }),
    ]),
  ) as Record<TestDesignLane, ReturnType<typeof deriveTestDesignOverview>>;
  const overview = laneOverviews[currentLane];
  const promptHeadingRef = useRef<HTMLHeadingElement>(null);
  const lockedHeadingRef = useRef<HTMLHeadingElement>(null);
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
    else if (attempt) lockedHeadingRef.current?.focus();
    else if (probe) promptHeadingRef.current?.focus();
  }, [attempt, probe]);

  const selectedAttempt = selectedAttemptId
    ? workspace.attempts.find((candidate) => candidate.id === selectedAttemptId)
    : undefined;
  if (selectedAttemptId) {
    const selectedProbe = probes.find(
      (candidate) =>
        candidate.id === selectedAttempt?.probeId &&
        candidate.revision === selectedAttempt.probeRevision,
    );
    const repairLane =
      workspace.activeSprint?.status === "active"
        ? workspace.activeSprint.lane
        : selectedAttempt?.lane;
    return (
      <main id="main-content" className="page-container test-design-page">
        <section className="test-design-summary test-design-evidence-detail">
          <p className="eyebrow">Private Test Design evidence</p>
          <h1>{selectedProbe?.title ?? "Retired test-design exercise"}</h1>
          {!selectedAttempt ? (
            <div className="test-design-boundary">
              This bounded attempt ID is not available in the current local history.
            </div>
          ) : (
            <>
              <div className="test-design-evidence-status">
                <span className={`oracle-${selectedAttempt.oracleStatus}`}>
                  Oracle {selectedAttempt.oracleStatus}
                </span>
                <span>{selectedAttempt.purposeMatch ? "Purpose matched" : "Purpose differed"}</span>
                <span>{selectedAttempt.assisted ? "Hint used" : "Unassisted"}</span>
                {selectedAttempt.retired ? <span>Retired content · history only</span> : null}
              </div>
              <p>
                {laneLabel(selectedAttempt.lane)} · {sourceLabel(selectedAttempt.source)} · committed {new Date(selectedAttempt.committedAt).toLocaleString()}
              </p>
              <div className="test-design-committed-evidence">
                <article><span>Purpose</span><strong>{selectedAttempt.purpose}</strong></article>
                <article><span>Assumption</span><p>{selectedAttempt.assumption}</p></article>
                <article><span>Structured scenario</span><pre><code>{selectedAttempt.input}</code></pre></article>
                <article><span>Expected observation</span><pre><code>{selectedAttempt.expected}</code></pre></article>
                <article><span>Defect named</span><p>{selectedAttempt.defectCaught}</p></article>
              </div>
              <div className="test-reference-notice">
                <strong>Design only · not executed</strong>
                <span>Objective status came only from exact authored structured cases. Assumption and defect prose were never semantically scored.</span>
              </div>
            </>
          )}
          <div className="test-design-summary-actions">
            {repairLane ? (
              <button className="primary-button" onClick={() => onStartSprint("weakness", repairLane)}>
                {workspace.activeSprint?.status === "active"
                  ? `Resume active ${laneLabel(repairLane)} lab`
                  : `Start ${laneLabel(repairLane)} repair lab`}
              </button>
            ) : null}
            <button className="secondary-button" onClick={onExit}>Back to Weakness Lab</button>
          </div>
        </section>
      </main>
    );
  }

  if (!sprint || routedSprintId !== sprint.id)
    return (
      <main id="main-content" className="page-container test-design-page">
        <section className="test-design-empty test-design-lane-entry">
          <p className="eyebrow">Test Design Academy</p>
          <h1>Make the failure concrete before writing code.</h1>
          <p>
            Choose a lane, then design three compact cases. Commit the purpose,
            assumption, structured scenario, expected observation, and defect
            before seeing project-authored references.
          </p>
          <div className="test-design-boundary">
            Design-only evidence. Python, Swift, and iOS scenarios are not
            executed, copied into practice, or treated as solves.
          </div>
          {sprint?.status === "active" ? (
            <article className="test-design-active-lane">
              <div>
                <span className="eyebrow">Active sprint</span>
                <h2>Resume {laneLabel(sprint.lane)} before switching lanes.</h2>
                <p>Your committed work and draft stay pinned to this sprint.</p>
              </div>
              <button
                className="primary-button"
                onClick={() => onStartSprint(sprint.source, sprint.lane)}
              >
                Resume active lab
              </button>
            </article>
          ) : (
            <div className="test-design-lane-grid" aria-label="Test design lanes">
              {LANES.map((lane) => {
                const laneOverview = laneOverviews[lane.id];
                return (
                  <article
                    key={lane.id}
                    className={lane.id === selectedLane ? "is-selected" : ""}
                  >
                    <span>{lane.label}</span>
                    <h2>{lane.title}</h2>
                    <p>{lane.copy}</p>
                    <dl>
                      <div><dt>New</dt><dd>{laneOverview.newCount}</dd></div>
                      <div><dt>Due</dt><dd>{laneOverview.dueCount}</dd></div>
                      <div><dt>Retained</dt><dd>{laneOverview.retainedCount}/{laneOverview.totalSkills}</dd></div>
                    </dl>
                    <button
                      className={lane.id === selectedLane ? "primary-button" : "secondary-button"}
                      onClick={() => onStartSprint(entrySource, lane.id)}
                    >
                      Start {lane.label} lab
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
          <p className="eyebrow">
            {laneLabel(sprint.lane)} lab complete · {sourceLabel(sprint.source)}
          </p>
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
                    (candidate) =>
                      candidate.completedAt && candidate.lane === sprint.lane,
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
                      {solve.track === "ios"
                        ? "Open blank concept reconstruction"
                        : "Continue to blank solve"}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
          <div className="test-design-summary-actions">
            <div className="test-design-next-lanes" aria-label="Start another lane">
              {LANES.map((lane) => (
                <button
                  key={lane.id}
                  className={lane.id === sprint.lane ? "primary-button" : "secondary-button"}
                  onClick={() => onStartSprint(sprint.source, lane.id)}
                >
                  {lane.id === sprint.lane ? `Repeat ${lane.label}` : `Start ${lane.label}`}
                </button>
              ))}
            </div>
            <button className="secondary-button" onClick={onExit}>
              Back to {sourceLabel(sprint.source)}
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
            onClick={() => onStartSprint(sprint.source, sprint.lane)}
          >
            Start current lab
          </button>
          <button className="text-button" onClick={onExit}>
            Back to {sourceLabel(sprint.source)}
          </button>
        </section>
      </main>
    );

  const display = attempt ?? draft;
  const inputPresentation = inputCopy(probe);
  return (
    <main id="main-content" className="page-container test-design-page">
      <section className="test-design-shell">
        <header className="test-design-header">
          <div>
            <p className="eyebrow">
              {laneLabel(sprint.lane)} test-design sprint · {sourceLabel(sprint.source)}
            </p>
            <h1>
              Prompt {sprint.cursor + 1} of {sprint.entries.length}
            </h1>
          </div>
          <button className="text-button" onClick={onExit}>
            Exit lab
          </button>
        </header>
        <div
          className="test-design-progress"
          role="progressbar"
          aria-label="Test design progress"
          aria-valuemin={1}
          aria-valuemax={sprint.entries.length}
          aria-valuenow={sprint.cursor + 1}
          aria-valuetext={`Prompt ${sprint.cursor + 1} of ${sprint.entries.length}`}
        >
          <span
            style={{
              width: `${((sprint.cursor + 1) / sprint.entries.length) * 100}%`,
            }}
          />
        </div>
        <article className="test-design-prompt">
          <span>
            Pattern and solution hidden · {inputPresentation.tag}
          </span>
          <h2 ref={promptHeadingRef} tabIndex={-1}>
            {probe.prompt}
          </h2>
          <p>
            <strong>Contract:</strong> {probe.constraint}
          </p>
          <p className="test-design-execution-policy">
            <strong>Design only · not executed.</strong> Objective status comes
            only from an exact match to an authored structured case.
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
                {inputPresentation.help}
              </small>
              <textarea
                className="test-code-input"
                spellCheck={false}
                maxLength={4000}
                value={display.input}
                onChange={(event) => update({ input: event.target.value })}
                placeholder={inputPresentation.placeholder}
              />
            </label>
            <label>
              Expected observation{" "}
              <small>Structured JSON when you want an authored oracle match</small>
              <textarea
                className="test-code-input"
                spellCheck={false}
                maxLength={4000}
                value={display.expected}
                onChange={(event) => update({ expected: event.target.value })}
                placeholder='Example: {"outcome":"expected state"}'
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
              <h2 ref={lockedHeadingRef} tabIndex={-1}>
                Now inspect the reference cases.
              </h2>
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
                judge cases. Your committed case has not been executed, copied,
                compiled, or sent anywhere.
              </span>
            </div>
            <div className="test-reference-grid">
              {probe.referenceCases.map((reference) => (
                <article key={reference.id}>
                  <span>{reference.purpose}</span>
                  <h3>{reference.rationale}</h3>
                  <pre>
                    <code>
                      {probe.lane === "python" ? "args" : "scenario"} = {reference.input}
                      {"\n"}expected observation = {reference.expected}
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
