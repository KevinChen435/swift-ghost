"use client";

import { useMemo, useState } from "react";
import type { PracticeItem } from "../lib/items";
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
                ? `${lane.selfAssessed} self-assessed observations`
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
            </span>
            <span role="cell" className={`evidence-${probe.evidenceLevel}`}>
              {evidenceLabel(probe.evidenceLevel)}
              {probe.usedRefresher ? <small>Refresher used</small> : null}
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
        {ASSESSMENT_PROGRAMS.map((program) => {
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

      {selectedProgram && !detailRun && (
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
                <ul>
                  <li>Pattern labels and solution help stay hidden during the checkpoint.</li>
                  <li>Executable feedback is allowed; a refresher is recorded as assisted evidence.</li>
                  <li>You will reflect on recognition, reasoning, implementation, verification, and communication.</li>
                </ul>
              </div>
              <div className="assessment-briefing-actions">
                {activeDraft?.assessmentRunId === detailRun.id && activeDraft.assessmentProbeId === currentProbe.id ? (
                  <button
                    className="primary-button"
                    type="button"
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
                  <button className="primary-button" type="button" onClick={() => onOpenProbe(detailRun.id, currentProbe)}>
                    Start without help →
                  </button>
                )}
                <button className="outline-button" type="button" onClick={() => onUseRefresher(detailRun.id, currentProbe)}>
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
