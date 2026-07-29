"use client";

import { useMemo, useState } from "react";
import type { PracticeItem } from "../lib/items";
import type { TestDesignLane } from "../data/test-design-probes";
import type { ConceptTransferLane } from "../data/concept-transfer-variants";
import { CROSS_LANE_REENTRY_BLUEPRINT } from "../lib/assessment-bank.mjs";
import { TrustedAssessmentPanel } from "./TrustedAssessmentPanel";
import {
  ASSESSMENT_BLOCKERS,
  ASSESSMENT_PROGRAMS,
  ASSESSMENT_RUBRIC_DIMENSIONS,
  assessmentProgram,
  currentAssessmentProbe,
  deriveAssessmentReport,
  type AssessmentBlocker,
  type AssessmentProbe,
  type AssessmentRubric,
  type AssessmentRun,
  type AssessmentWorkspace,
} from "../lib/assessments.mjs";

const EMPTY_RUBRIC: AssessmentRubric = {
  recognition: 0,
  reasoning: 0,
  implementation: 0,
  verification: 0,
  communication: 0,
};

function formatDate(value?: string) {
  if (!value) return "Not completed";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}

function evidenceLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function responseModeLabel(value?: string) {
  if (value === "local-verified-solve") return "Local verified Python solve";
  if (value === "swift-reconstruction") return "Swift exact reconstruction";
  if (value === "concept-recall") return "Self-assessed concept recall";
  return "Practice response";
}

function responseModeTrust(value?: string) {
  if (value === "local-verified-solve")
    return "All bundled checks must pass in the device-local Python judge.";
  if (value === "swift-reconstruction")
    return "Exact authored reconstruction only; Swift is not compiled and alternatives are not evaluated.";
  if (value === "concept-recall")
    return "Commit before reveal, then self-grade against the authored reference.";
  return "Evidence remains private, local, and explicitly labeled.";
}

function DebriefForm({
  run,
  probe,
  onSave,
}: {
  run: AssessmentRun;
  probe: AssessmentProbe;
  onSave: (
    runId: string,
    probeId: string,
    input: { rubric: AssessmentRubric; blockers: AssessmentBlocker[]; note: string },
  ) => void;
}) {
  const [rubric, setRubric] = useState<AssessmentRubric>(EMPTY_RUBRIC);
  const [blockers, setBlockers] = useState<AssessmentBlocker[]>([]);
  const [note, setNote] = useState("");
  return (
    <section className="assessment-debrief" aria-labelledby="checkpoint-debrief-title">
      <div className="assessment-section-heading">
        <div>
          <span className="eyebrow">Checkpoint debrief</span>
          <h2 id="checkpoint-debrief-title">Name what happened while it is fresh.</h2>
        </div>
        <span className="assessment-local-label">Private · device-local</span>
      </div>
      <p className="assessment-debrief-copy">
        This rubric is reflection, not an automated score. Zero means the skill was
        not demonstrated yet; two means it was clear in this one checkpoint.
      </p>
      <div className="assessment-rubric-grid">
        {ASSESSMENT_RUBRIC_DIMENSIONS.map((dimension) => (
          <fieldset key={dimension.id}>
            <legend>{dimension.label}</legend>
            <small>{dimension.description}</small>
            <div role="group" aria-label={`${dimension.label} rating`}>
              {[0, 1, 2].map((score) => (
                <button
                  type="button"
                  key={score}
                  className={rubric[dimension.id] === score ? "active" : ""}
                  aria-pressed={rubric[dimension.id] === score}
                  onClick={() =>
                    setRubric((current) => ({
                      ...current,
                      [dimension.id]: score as 0 | 1 | 2,
                    }))
                  }
                >
                  {score}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <fieldset className="assessment-blockers">
        <legend>What got in the way?</legend>
        <div>
          {ASSESSMENT_BLOCKERS.map((blocker) => (
            <label key={blocker.id}>
              <input
                type="checkbox"
                checked={blockers.includes(blocker.id)}
                onChange={(event) =>
                  setBlockers((current) =>
                    event.target.checked
                      ? [...current, blocker.id].slice(0, 4)
                      : current.filter((value) => value !== blocker.id),
                  )
                }
              />
              {blocker.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="assessment-note">
        <span>One useful observation</span>
        <textarea
          value={note}
          maxLength={1200}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Example: I recognized the data structure, but I did not state the invariant before coding."
        />
      </label>
      <div className="assessment-action-row">
        <p>
          Saving advances to the next short checkpoint. You can stop between any two.
        </p>
        <button
          className="primary-button"
          type="button"
          onClick={() => onSave(run.id, probe.id, { rubric, blockers, note })}
        >
          Save debrief and continue →
        </button>
      </div>
    </section>
  );
}

function AssessmentReportView({
  run,
  onCreatePlan,
  onArchive,
}: {
  run: AssessmentRun;
  onCreatePlan: (runId: string) => void;
  onArchive: (runId: string) => void;
}) {
  const report = deriveAssessmentReport(run);
  if (!report) return null;
  const canBuildPlan = report.completion.debriefed > 0;
  const laneCards = report.track === "python"
    ? [
        ["Python fluency", report.lanes.pythonFluency],
        ["Algorithmic work", report.lanes.algorithmic],
      ] as const
    : report.track === "cross-lane"
      ? [
          ["Python · local judge", report.lanes.python],
          ["Swift · reconstruction & recall", report.lanes.swift],
          ["iOS · self-assessed", report.lanes.crossLaneIos],
        ] as const
      : [["Swift & iOS concepts", report.lanes.ios]] as const;
  return (
    <section className="assessment-report" aria-labelledby={`report-${run.id}`}>
      <div className="assessment-section-heading">
        <div>
          <span className="eyebrow">Baseline report</span>
          <h2 id={`report-${run.id}`}>{report.title}</h2>
          <p>{report.disclaimer}</p>
        </div>
        <div className="assessment-report-meta">
          <span>{report.evidenceLabel}</span>
          <small>{formatDate(report.completedAt)}</small>
        </div>
      </div>
      <div className="assessment-lane-grid">
        {laneCards.map(([label, lane]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>
              {lane.debriefed}/{lane.totalProbes} checkpoints reflected
            </strong>
            <p>
              {lane.evidenceKind === "self-assessed"
                ? `${lane.selfAssessed} self-assessed · ${lane.assisted} assisted`
                : lane.evidenceKind === "reconstruction"
                  ? `${lane.reconstruction} exact reconstructions · ${lane.selfAssessed} self-assessed recalls · ${lane.assisted} assisted · ${lane.incomplete} incomplete`
                  : `${lane.independent} independent · ${lane.assisted} assisted`}
            </p>
            <span>
              Rubric average: {lane.rubricAverage === null ? "Not enough evidence" : `${lane.rubricAverage}/10`}
            </span>
          </article>
        ))}
      </div>
      <div className="assessment-evidence-table" role="table" aria-label="Checkpoint evidence">
        <div className="assessment-evidence-row header" role="row">
          <span role="columnheader">Checkpoint</span>
          <span role="columnheader">Evidence</span>
          <span role="columnheader">Reflection</span>
        </div>
        {report.probes.map((probe) => (
          <div className="assessment-evidence-row" role="row" key={probe.probeId}>
            <span role="cell">
              <strong>{probe.title}</strong>
              <small>{probe.focus}</small>
              {probe.responseMode && <small>{responseModeLabel(probe.responseMode)}</small>}
            </span>
            <span role="cell" className={`evidence-${probe.evidenceLevel}`}>
              {evidenceLabel(probe.evidenceLevel)}
              {probe.usedRefresher ? <small>Refresher used</small> : null}
              {probe.trustLabel ? <small>{probe.trustLabel}</small> : null}
            </span>
            <span role="cell">
              {probe.rubricTotal === null ? "Not recorded" : `${probe.rubricTotal}/10`}
              {probe.blockers.length ? <small>{probe.blockers.map(evidenceLabel).join(" · ")}</small> : null}
            </span>
          </div>
        ))}
      </div>
      <section className="assessment-next-steps">
        <div>
          <span className="eyebrow">Next three activities</span>
          <h3>Turn the evidence into training.</h3>
        </div>
        <ol>
          {report.recommendations.map((recommendation) => (
            <li key={recommendation.id}>
              <strong>{recommendation.title}</strong>
              <p>{recommendation.reason}</p>
            </li>
          ))}
        </ol>
      </section>
      <div className="assessment-action-row">
        <button className="outline-button" type="button" onClick={() => onArchive(run.id)}>
          Archive report
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!canBuildPlan}
          title={canBuildPlan ? undefined : "Complete and debrief one checkpoint first"}
          onClick={() => onCreatePlan(run.id)}
        >
          {canBuildPlan ? "Build my study plan →" : "Complete one checkpoint to build a plan"}
        </button>
      </div>
    </section>
  );
}

export function AssessmentCenter({
  workspace,
  items,
  transferSummary,
  virtualRoundSummary,
  trustedAssessmentsAvailable,
  trustedAssessmentsAuthenticated,
  selectedAssessment,
  activeDraft,
  onSelect,
  onStart,
  onResume,
  onOpenProbe,
  onUseRefresher,
  onSaveDebrief,
  onFinish,
  onCreatePlan,
  onArchive,
  onOpenTransferLab,
  onOpenVirtualRounds,
  onOpenPatternReview,
  onOpenTestDesign,
  onOpenConceptTransfer,
  patternDecisionSummary,
  testDesignSummaries,
  conceptTransferSummaries,
}: {
  workspace: AssessmentWorkspace;
  items: PracticeItem[];
  transferSummary: {
    total: number;
    unseen: number;
    due: number;
    proven: number;
  };
  virtualRoundSummary: {
    eligible: number;
    active: boolean;
    finished: number;
  };
  trustedAssessmentsAvailable: boolean;
  trustedAssessmentsAuthenticated: boolean;
  selectedAssessment?: string;
  activeDraft: { assessmentRunId?: string; assessmentProbeId?: string } | null;
  onSelect: (assessmentId?: string) => void;
  onStart: (programId: string) => void;
  onResume: (runId: string) => void;
  onOpenProbe: (runId: string, probe: AssessmentProbe, refresher?: boolean) => void;
  onUseRefresher: (runId: string, probe: AssessmentProbe) => void;
  onSaveDebrief: (
    runId: string,
    probeId: string,
    input: { rubric: AssessmentRubric; blockers: AssessmentBlocker[]; note: string },
  ) => void;
  onFinish: (runId: string) => void;
  onCreatePlan: (runId: string) => void;
  onArchive: (runId: string) => void;
  onOpenTransferLab: () => void;
  onOpenVirtualRounds: () => void;
  onOpenPatternReview: () => void;
  onOpenTestDesign: (lane: TestDesignLane) => void;
  onOpenConceptTransfer: (lane: ConceptTransferLane) => void;
  patternDecisionSummary: {
    newCount: number;
    dueCount: number;
    retainedCount: number;
    totalPatterns: number;
  };
  testDesignSummaries: Record<TestDesignLane, { newCount: number; dueCount: number; retainedCount: number; totalSkills: number }>;
  conceptTransferSummaries: Record<
    ConceptTransferLane,
    { newCount: number; dueCount: number; coldSelfAssessedCount: number }
  >;
}) {
  const selectedRun = useMemo(
    () => workspace.runs.find((run) => run.id === selectedAssessment) ?? null,
    [selectedAssessment, workspace.runs],
  );
  const activeRun = workspace.runs.find((run) => run.id === workspace.activeRunId) ?? null;
  const detailRun = selectedRun ?? (selectedAssessment ? null : activeRun);
  const currentProbe = detailRun ? currentAssessmentProbe(detailRun) : null;
  const currentResult = detailRun && currentProbe
    ? detailRun.results.find((result) => result.probeId === currentProbe.id)
    : null;
  const selectedProgram = assessmentProgram(
    selectedAssessment && !selectedRun ? selectedAssessment : detailRun?.programId ?? "",
  );
  const availableItemIds = new Set(items.map((item) => item.itemId));
  const crossLaneProgram = assessmentProgram("cross-lane-reentry");
  const crossLaneRuns = workspace.runs.filter(
    (run) => run.programId === "cross-lane-reentry",
  );
  const latestCrossLaneRun = crossLaneRuns.at(-1);
  const latestCrossLaneReport = latestCrossLaneRun
    ? deriveAssessmentReport(latestCrossLaneRun)
    : null;
  const crossLaneMinutes = CROSS_LANE_REENTRY_BLUEPRINT.sections.reduce(
    (total, section) => ({
      minimum: total.minimum + section.estimatedMinutes.minimum,
      maximum: total.maximum + section.estimatedMinutes.maximum,
    }),
    { minimum: 0, maximum: 0 },
  );

  return (
    <main id="main-content" tabIndex={-1} className="page-container assessments-page">
      <header className="page-heading assessment-heading">
        <div>
          <span className="eyebrow">Calibration center</span>
          <h1>Find the rust before it costs interview time.</h1>
          <p>
            Use short, resumable checkpoints to separate Python fluency, algorithmic
            reasoning, and Swift/iOS recall. Local programs stay on this device;
            verified Python checkpoints use server-owned receipts.
          </p>
        </div>
        <div className="assessment-trust-card">
          <span>No global score</span>
          <strong>Observed evidence, clearly labeled</strong>
          <small>Local practice · not proctored · not a certification</small>
        </div>
      </header>

      <TrustedAssessmentPanel
        available={trustedAssessmentsAvailable}
        authenticated={trustedAssessmentsAuthenticated}
      />

      <section className="assessment-program-grid" aria-label="Assessment programs">
        {crossLaneProgram && (
          <article
            className={`assessment-cross-lane-card ${
              selectedProgram?.id === crossLaneProgram.id ? "selected" : ""
            }`}
          >
            <div className="assessment-program-topline">
              <span>Full re-entry diagnostic</span>
              <small>
                {crossLaneMinutes.minimum}–{crossLaneMinutes.maximum} min · one frozen form
              </small>
            </div>
            <h2>{crossLaneProgram.title}</h2>
            <p>{crossLaneProgram.description}</p>
            <div className="assessment-program-stats">
              <span><strong>{CROSS_LANE_REENTRY_BLUEPRINT.formSize}</strong> checkpoints</span>
              <span><strong>{latestCrossLaneReport?.completion.debriefed ?? 0}</strong> reflected</span>
              <span><strong>{crossLaneRuns.length}</strong> run{crossLaneRuns.length === 1 ? "" : "s"}</span>
            </div>
            <div className="assessment-mode-ledger" aria-label="Evidence modes">
              <span><b>Python</b> local judge</span>
              <span><b>Swift</b> exact reconstruction</span>
              <span><b>iOS</b> self-assessed recall</span>
            </div>
            <small className="assessment-program-disclaimer">
              A run selects one current entry from each of six revisioned sections,
              then preserves that exact form. It never creates a readiness score,
              certification, or mastery claim.
            </small>
            <div className="assessment-card-actions">
              <button
                className="outline-button"
                type="button"
                onClick={() => onSelect(crossLaneProgram.id)}
              >
                View six-section blueprint
              </button>
              {latestCrossLaneRun?.status === "paused" ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => onResume(latestCrossLaneRun.id)}
                >
                  Resume frozen form →
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => onStart(crossLaneProgram.id)}
                >
                  {crossLaneRuns.length ? "Start another form" : "Start re-entry assessment"} →
                </button>
              )}
            </div>
          </article>
        )}
        <article className="assessment-pattern-decision-card">
          <div className="assessment-program-topline">
            <span>Pattern selection</span>
            <small>Private · 12-18 minutes</small>
          </div>
          <h2>Core Pattern Skill Check</h2>
          <p>
            Sample a revisioned 24-prompt bank across all twelve core families.
            Commit the cue, invariant, rejected alternative, and expected
            complexity before seeing the authored comparison.
          </p>
          <div className="assessment-program-stats">
            <span><strong>{patternDecisionSummary.newCount}</strong> new</span>
            <span><strong>{patternDecisionSummary.dueCount}</strong> due</span>
            <span><strong>{patternDecisionSummary.retainedCount}/{patternDecisionSummary.totalPatterns}</strong> retained</span>
          </div>
          <small className="assessment-program-disclaimer">
            This checks prompt classification only. It does not replace the
            algorithm checkpoint or create solve evidence.
          </small>
          <div className="assessment-card-actions">
            <button className="primary-button" type="button" onClick={onOpenPatternReview}>
              Open pattern skill check →
            </button>
          </div>
        </article>
        <article className="assessment-test-design-card">
          <div className="assessment-program-topline"><span>Verification reasoning</span><small>Private · 7 minutes</small></div>
          <h2>Test Design Lab</h2>
          <p>Commit a purpose, structured scenario, expected observation, and defect for Python, Swift, or iOS before seeing original reference cases.</p>
          <div className="assessment-test-design-lanes">
            {(["python", "swift", "ios"] as TestDesignLane[]).map((lane) => {
              const summary = testDesignSummaries[lane];
              return (
                <button key={lane} className="secondary-button" type="button" onClick={() => onOpenTestDesign(lane)}>
                  <strong>{lane === "ios" ? "iOS" : lane[0].toUpperCase() + lane.slice(1)}</strong>
                  <span>{summary.newCount} new · {summary.dueCount} due · {summary.retainedCount}/{summary.totalSkills} retained</span>
                </button>
              );
            })}
          </div>
          <small className="assessment-program-disclaimer">Cases are not executed here. Novel oracles remain unverified rather than being marked wrong.</small>
        </article>
        <article className="assessment-concept-transfer-card">
          <div className="assessment-program-topline">
            <span>Swift typing transfer</span>
            <small>Private · 7–10 minutes</small>
          </div>
          <h2>Cold Reconstruction Lab</h2>
          <p>
            Type a small Swift or iOS boundary from a neutral scenario before
            its topic name and project-authored reference are revealed.
          </p>
          <div className="assessment-concept-transfer-lanes">
            {(["swift", "ios"] as ConceptTransferLane[]).map((lane) => {
              const summary = conceptTransferSummaries[lane];
              return (
                <button
                  key={lane}
                  className="secondary-button"
                  type="button"
                  onClick={() => onOpenConceptTransfer(lane)}
                >
                  <strong>{lane === "ios" ? "iOS" : "Swift"}</strong>
                  <span>
                    {summary.newCount} new · {summary.dueCount} due · {summary.coldSelfAssessedCount} cold
                  </span>
                </button>
              );
            })}
          </div>
          <small className="assessment-program-disclaimer">
            The result is self-assessed syntax comparison, never a compiled or
            verified Swift solve.
          </small>
        </article>
        <article className="assessment-virtual-round-card">
          <div className="assessment-program-topline">
            <span>Timed strategy</span>
            <small>{virtualRoundSummary.active ? "Round in progress" : "Device-local"}</small>
          </div>
          <h2>Virtual Rounds</h2>
          <p>
            Work through a two-to-four problem set against one clock. Switch
            problems freely, submit to the local Python judge, flag work to
            revisit, and finish with an immutable submission timeline.
          </p>
          <div className="assessment-program-stats">
            <span><strong>3</strong> formats</span>
            <span><strong>{virtualRoundSummary.eligible}</strong> eligible problems</span>
            <span><strong>{virtualRoundSummary.finished}</strong> finished</span>
          </div>
          <small className="assessment-program-disclaimer">
            Familiar catalog questions may appear. Scores are private practice
            evidence, not a global rank, readiness rating, or proctored result.
          </small>
          <div className="assessment-card-actions">
            <button
              className="primary-button"
              type="button"
              onClick={onOpenVirtualRounds}
            >
              {virtualRoundSummary.active ? "Resume virtual round →" : "Open Virtual Rounds →"}
            </button>
          </div>
        </article>
        <article className="assessment-transfer-card">
          <div className="assessment-program-topline">
            <span>Python transfer</span>
            <small>{transferSummary.unseen} locally unseen</small>
          </div>
          <h2>Transfer Lab</h2>
          <p>
            Solve original variants unseen in Swift Ghost history on this device,
            without a pattern label. After the attempt, compare the new prompt
            with the invariant you were expected to transfer.
          </p>
          <div className="assessment-program-stats">
            <span><strong>{transferSummary.total}</strong> variants</span>
            <span><strong>{transferSummary.proven}</strong> proven</span>
            <span><strong>{transferSummary.due}</strong> due</span>
          </div>
          <small className="assessment-program-disclaimer">
            First exposure is tracked locally. Hints and answer reveals remain
            visible in the evidence record.
          </small>
          <div className="assessment-card-actions">
            <button
              className="primary-button"
              type="button"
              onClick={onOpenTransferLab}
            >
              Open Transfer Lab →
            </button>
          </div>
        </article>
        {ASSESSMENT_PROGRAMS.filter(
          (program) => program.id !== "cross-lane-reentry",
        ).map((program) => {
          const programAvailable = program.probes.every((probe) =>
            availableItemIds.has(probe.itemId as PracticeItem["itemId"]),
          );
          const runs = workspace.runs.filter((run) => run.programId === program.id);
          const latest = runs.at(-1);
          const latestReport = latest ? deriveAssessmentReport(latest) : null;
          const isSelected = selectedProgram?.id === program.id;
          return (
            <article className={isSelected ? "selected" : ""} key={program.id}>
              <div className="assessment-program-topline">
                <span>{program.track === "python" ? "Python" : "Swift / iOS"}</span>
                <small>{program.probes.reduce((sum, probe) => sum + probe.estimatedMinutes, 0)} min across short checkpoints</small>
              </div>
              <h2>{program.title}</h2>
              <p>{program.description}</p>
              <div className="assessment-program-stats">
                <span><strong>{program.probes.length}</strong> checkpoints</span>
                <span><strong>{latestReport?.completion.debriefed ?? 0}</strong> reflected</span>
                <span><strong>{runs.length}</strong> run{runs.length === 1 ? "" : "s"}</span>
              </div>
              <small className="assessment-program-disclaimer">{program.disclaimer}</small>
              <div className="assessment-card-actions">
                <button className="outline-button" type="button" onClick={() => onSelect(program.id)}>
                  View outline
                </button>
                {latest?.status === "paused" ? (
                  <button className="primary-button" type="button" disabled={!programAvailable} onClick={() => onResume(latest.id)}>
                    Resume baseline →
                  </button>
                ) : (
                  <button className="primary-button" type="button" disabled={!programAvailable} onClick={() => onStart(program.id)}>
                    {programAvailable
                      ? `${runs.length ? "Start a fresh run" : "Start baseline"} →`
                      : "Catalog update required"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {selectedProgram?.id === "cross-lane-reentry" && !detailRun && (
        <section className="assessment-outline assessment-cross-lane-outline">
          <div className="assessment-section-heading">
            <div>
              <span className="eyebrow">Frozen-form blueprint · bank revision 1</span>
              <h2>Six independent checkpoints across three lanes</h2>
              <p>
                The bank contains 24 authored candidates. Starting a run selects
                one from each section and saves the complete form before the first
                checkpoint opens.
              </p>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => onStart(selectedProgram.id)}
            >
              Select and lock my form →
            </button>
          </div>
          <ol>
            {CROSS_LANE_REENTRY_BLUEPRINT.sections.map((section) => (
              <li key={section.id}>
                <span>{String(section.order).padStart(2, "0")}</span>
                <div>
                  <strong>{section.title}</strong>
                  <p>
                    One of {section.candidateCount} current candidates · {section.lane === "python"
                      ? "local verified solve"
                      : section.lane === "swift"
                        ? "exact reconstruction or self-assessed recall"
                        : "self-assessed engineering recall"}
                  </p>
                </div>
                <small>
                  {section.estimatedMinutes.minimum}–{section.estimatedMinutes.maximum} min
                </small>
              </li>
            ))}
          </ol>
          <div className="assessment-freeze-contract">
            <span><b>Rotation</b> least-seen current entries first</span>
            <span><b>Persistence</b> reload-safe immutable form</span>
            <span><b>Revisions</b> stale entries stay history-only</span>
          </div>
        </section>
      )}

      {selectedProgram && selectedProgram.id !== "cross-lane-reentry" && !detailRun && (
        <section className="assessment-outline">
          <div className="assessment-section-heading">
            <div>
              <span className="eyebrow">Program outline</span>
              <h2>{selectedProgram.shortTitle}</h2>
              <p>{selectedProgram.evidenceLabel}</p>
            </div>
            <button className="primary-button" type="button" onClick={() => onStart(selectedProgram.id)}>
              Start first checkpoint →
            </button>
          </div>
          <ol>
            {selectedProgram.probes.map((probe) => (
              <li key={probe.id}>
                <span>{String(selectedProgram.probes.indexOf(probe) + 1).padStart(2, "0")}</span>
                <div><strong>{probe.title}</strong><p>{probe.focus}</p></div>
                <small>{probe.estimatedMinutes} min</small>
              </li>
            ))}
          </ol>
        </section>
      )}

      {detailRun && detailRun.status !== "completed" && detailRun.status !== "archived" && currentProbe && currentResult && (
        <section className="assessment-active-run">
          <div className="assessment-progress-head">
            <div>
              <span className="eyebrow">Active baseline</span>
              <h2>{assessmentProgram(detailRun.programId)?.shortTitle}</h2>
              <p>
                Checkpoint {detailRun.currentProbeIndex + 1} of {detailRun.results.length} · stop safely between checkpoints.
              </p>
              {detailRun.formKind === "bank" && (
                <div className="assessment-form-lock">
                  <span>Form locked</span>
                  <small>
                    Blueprint r{detailRun.blueprintRevision} · bank r{detailRun.formRevision} · exact revisions preserved
                  </small>
                </div>
              )}
            </div>
            <div className="assessment-progress-ring" aria-label={`${detailRun.results.filter((result) => result.status === "debriefed").length} of ${detailRun.results.length} checkpoints debriefed`}>
              <strong>{detailRun.results.filter((result) => result.status === "debriefed").length}/{detailRun.results.length}</strong>
              <small>reflected</small>
            </div>
          </div>
          <div className="assessment-stepper">
            {detailRun.results.map((result, index) => (
              <span className={`${result.status} ${result.probeId === currentProbe.id ? "current" : ""}`} key={result.probeId}>
                <b>{result.status === "debriefed" ? "✓" : index + 1}</b>
                <small>{result.status}</small>
              </span>
            ))}
          </div>
          {detailRun.status === "paused" ? (
            <section className="assessment-briefing">
              <div>
                <span className="eyebrow">Paused baseline</span>
                <h2>Resume before opening the next checkpoint.</h2>
                <p>
                  Resuming makes this the active baseline again. Any saved checkpoint
                  draft stays on this device.
                </p>
              </div>
              <div className="assessment-briefing-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => onResume(detailRun.id)}
                >
                  Resume baseline →
                </button>
              </div>
            </section>
          ) : currentResult.status === "attempted" ? (
            <DebriefForm run={detailRun} probe={currentProbe} onSave={onSaveDebrief} />
          ) : (
            <section className="assessment-briefing">
              <div>
                <span className="eyebrow">Next checkpoint · {currentProbe.estimatedMinutes} min</span>
                <h2>{currentProbe.title}</h2>
                <p>{currentProbe.focus}</p>
                <div className="assessment-response-contract">
                  <span>{responseModeLabel(currentProbe.responseMode)}</span>
                  <p>{responseModeTrust(currentProbe.responseMode)}</p>
                </div>
                <ul>
                  <li>Item revision {currentProbe.itemRevision ?? "legacy"}{currentProbe.judgeRevision ? ` · judge revision ${currentProbe.judgeRevision}` : ""}</li>
                  <li>Pattern labels and solution help stay hidden during the frozen response.</li>
                  <li>A refresher is always labeled and never becomes clean current evidence.</li>
                  <li>You will reflect on recognition, reasoning, implementation, verification, and communication.</li>
                </ul>
                {currentProbe.currentEvidenceEligible === false && (
                  <p className="assessment-stale-warning" role="status">
                    This checkpoint revision remains in history, but the current
                    build cannot use it to create new evidence.
                  </p>
                )}
              </div>
              <div className="assessment-briefing-actions">
                {activeDraft?.assessmentRunId === detailRun.id && activeDraft.assessmentProbeId === currentProbe.id ? (
                  <button
                    className="primary-button"
                    type="button"
                    disabled={currentProbe.currentEvidenceEligible === false}
                    onClick={() =>
                      onOpenProbe(
                        detailRun.id,
                        currentProbe,
                        currentResult.status === "refreshed",
                      )
                    }
                  >
                    Resume checkpoint →
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    type="button"
                    disabled={currentProbe.currentEvidenceEligible === false}
                    onClick={() => onOpenProbe(detailRun.id, currentProbe)}
                  >
                    Start without help →
                  </button>
                )}
                <button
                  className="outline-button"
                  type="button"
                  disabled={currentProbe.currentEvidenceEligible === false}
                  onClick={() => onUseRefresher(detailRun.id, currentProbe)}
                >
                  I need a refresher
                </button>
                <button className="text-button" type="button" onClick={() => onFinish(detailRun.id)}>
                  End this run for now
                </button>
              </div>
            </section>
          )}
        </section>
      )}

      {detailRun && (detailRun.status === "completed" || detailRun.status === "archived") && (
        <AssessmentReportView run={detailRun} onCreatePlan={onCreatePlan} onArchive={onArchive} />
      )}

      {workspace.runs.length > 0 && (
        <section className="assessment-history">
          <div className="assessment-section-heading">
            <div><span className="eyebrow">History</span><h2>Baseline runs</h2></div>
          </div>
          <div>
            {[...workspace.runs].reverse().map((run) => {
              const program = assessmentProgram(run.programId);
              const report = deriveAssessmentReport(run);
              return (
                <button type="button" key={run.id} onClick={() => onSelect(run.id)}>
                  <span><strong>{program?.shortTitle}</strong><small>{formatDate(run.completedAt ?? run.updatedAt)}</small></span>
                  <span>{report?.completion.debriefed ?? 0}/{report?.completion.total ?? run.results.length}</span>
                  <span>{run.status} →</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
