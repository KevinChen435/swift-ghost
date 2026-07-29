import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSESSMENT_BLOCKERS,
  ASSESSMENT_PROGRAMS,
  ASSESSMENT_RUBRIC_DIMENSIONS,
  archiveAssessment,
  assessmentProgram,
  buildAssessmentStudyPlanSeed,
  createAssessmentWorkspace,
  currentAssessmentProbe,
  deriveAssessmentReport,
  finishAssessment,
  normalizeAssessmentProbeResult,
  normalizeAssessmentRun,
  normalizeAssessmentWorkspace,
  recordAssessmentDebrief,
  recordAssessmentObjectiveAttempt,
  recordAssessmentRefresher,
  resumeAssessment,
  startAssessment,
} from "../app/lib/assessments.mjs";

const t0 = "2026-07-28T12:00:00.000Z";
const t1 = "2026-07-28T12:01:00.000Z";
const t2 = "2026-07-28T12:02:00.000Z";
const t3 = "2026-07-28T12:03:00.000Z";

function completedPythonAttempt(itemId, overrides = {}) {
  return {
    id: `attempt:${itemId}`,
    itemId,
    itemRevision: 2,
    practiceKind: "solving",
    outcome: "completed",
    qualification: "solved",
    peeks: 0,
    durationMs: 300_000,
    completedAt: t1,
    verification: { revision: 1, passed: 4, total: 4 },
    ...overrides,
  };
}

function iosAttempt(itemId, overrides = {}) {
  return {
    id: `attempt:${itemId}`,
    itemId,
    itemRevision: 1,
    practiceKind: "concept",
    outcome: "completed",
    qualification: "independent",
    conceptGrade: "good",
    peeks: 0,
    durationMs: 180_000,
    completedAt: t1,
    ...overrides,
  };
}

const fullRubric = {
  recognition: 2,
  reasoning: 2,
  implementation: 2,
  verification: 2,
  communication: 2,
};

function start(programId = "python-reentry", id = "assessment:one") {
  return startAssessment(createAssessmentWorkspace(t0), programId, { id, now: t0 });
}

function recordAndDebrief(workspace, runId, probeId, attempt, options = {}) {
  let next = recordAssessmentObjectiveAttempt(workspace, runId, probeId, attempt, { now: t1 });
  next = recordAssessmentDebrief(next, runId, probeId, {
    rubric: options.rubric ?? fullRubric,
    blockers: options.blockers ?? [],
    note: options.note ?? "Clear evidence for this one probe.",
  }, { now: t2 });
  return next;
}

test("ships bounded Python and iOS programs with the exact requested item sequence", () => {
  assert.equal(ASSESSMENT_PROGRAMS.length, 3);
  assert.deepEqual(
    assessmentProgram("python-reentry").probes.map(({ itemId }) => itemId),
    ["python:10001", "python:1", "python:125", "python:20", "python:104", "python:200"],
  );
  assert.deepEqual(
    assessmentProgram("ios-pulse").probes.map(({ itemId }) => itemId),
    ["ios:value-reference-snapshots", "ios:weak-stored-closure", "ios:cancellable-search"],
  );
  assert.equal(assessmentProgram("missing"), null);
  assert.deepEqual(ASSESSMENT_RUBRIC_DIMENSIONS.map(({ id }) => id), Object.keys(fullRubric));
  assert.equal(new Set(ASSESSMENT_BLOCKERS.map(({ id }) => id)).size, ASSESSMENT_BLOCKERS.length);
});

test("starts a deterministic resumable run without mutating the source workspace", () => {
  const empty = createAssessmentWorkspace(t0);
  const before = structuredClone(empty);
  const workspace = startAssessment(empty, "python-reentry", { id: "assessment:fixed", now: t1 });
  assert.deepEqual(empty, before);
  assert.equal(workspace.activeRunId, "assessment:fixed");
  assert.equal(workspace.revision, 1);
  assert.equal(workspace.updatedAt, t1);
  assert.equal(workspace.runs[0].startedAt, t1);
  assert.equal(workspace.runs[0].status, "active");
  assert.equal(workspace.runs[0].results.length, 6);
  assert.ok(workspace.runs[0].results.every(({ status }) => status === "pending"));
  assert.equal(currentAssessmentProbe(workspace.runs[0]).itemId, "python:10001");
});

test("starting another run pauses the first and resume restores its first incomplete probe", () => {
  let workspace = start("python-reentry", "assessment:python");
  workspace = startAssessment(workspace, "ios-pulse", { id: "assessment:ios", now: t1 });
  assert.equal(workspace.runs.find(({ id }) => id === "assessment:python").status, "paused");
  assert.equal(workspace.activeRunId, "assessment:ios");
  workspace = resumeAssessment(workspace, "assessment:python", { now: t2 });
  assert.equal(workspace.activeRunId, "assessment:python");
  assert.equal(workspace.runs.find(({ id }) => id === "assessment:ios").status, "paused");
  assert.equal(currentAssessmentProbe(workspace.runs.find(({ id }) => id === "assessment:python")).itemId, "python:10001");
});

test("refresher use is captured before the objective attempt and permanently makes its solve evidence assisted", () => {
  let workspace = start();
  workspace = recordAssessmentRefresher(workspace, "assessment:one", "python:10001", {
    kind: "typing",
    stage: 3,
    attemptId: "typing:one",
  }, { now: t1 });
  let result = workspace.runs[0].results[0];
  assert.equal(result.status, "refreshed");
  assert.deepEqual(result.refresher, {
    kind: "typing",
    stage: 3,
    usedAt: t1,
    attemptId: "typing:one",
  });
  workspace = recordAndDebrief(
    workspace,
    "assessment:one",
    "python:10001",
    completedPythonAttempt("python:10001"),
  );
  result = workspace.runs[0].results[0];
  assert.equal(result.status, "debriefed");
  const report = deriveAssessmentReport(workspace, "assessment:one");
  assert.equal(report.probes[0].evidenceLevel, "assisted");
  assert.equal(report.lanes.pythonFluency.assisted, 1);
  assert.equal(report.lanes.pythonFluency.independent, 0);
  assert.ok(
    report.recommendations.some(({ reason }) => /assisted|delayed cold/i.test(reason)),
  );
});

test("objective attempt recording rejects mismatched items and requires an active resumed run", () => {
  let workspace = start();
  const unchanged = recordAssessmentObjectiveAttempt(
    workspace,
    "assessment:one",
    "python:1",
    completedPythonAttempt("python:125"),
    { now: t1 },
  );
  assert.deepEqual(unchanged, workspace);
  workspace = startAssessment(workspace, "ios-pulse", { id: "assessment:ios", now: t1 });
  const paused = recordAssessmentObjectiveAttempt(
    workspace,
    "assessment:one",
    "python:1",
    completedPythonAttempt("python:1"),
    { now: t2 },
  );
  assert.deepEqual(paused, workspace);
});

test("only verified hint-free solve attempts count as independent Python evidence", () => {
  let workspace = start();
  workspace = recordAndDebrief(workspace, "assessment:one", "python:10001", completedPythonAttempt("python:10001"));
  workspace = recordAndDebrief(
    workspace,
    "assessment:one",
    "python:1",
    completedPythonAttempt("python:1", { peeks: 1, qualification: "assisted" }),
  );
  workspace = recordAndDebrief(
    workspace,
    "assessment:one",
    "python:125",
    completedPythonAttempt("python:125", { verification: { passed: 3, total: 4 } }),
  );
  const report = deriveAssessmentReport(workspace, "assessment:one");
  assert.equal(report.lanes.pythonFluency.independent, 1);
  assert.equal(report.lanes.algorithmic.independent, 0);
  assert.equal(report.lanes.algorithmic.assisted, 2);
  assert.deepEqual(report.probes.slice(0, 3).map(({ evidenceLevel }) => evidenceLevel), [
    "independent",
    "assisted",
    "assisted",
  ]);
  assert.equal("readiness" in report, false);
  assert.equal("certification" in report, false);
});

test("iOS evidence is always labeled self-assessed even for a strong committed concept attempt", () => {
  let workspace = start("ios-pulse", "assessment:ios");
  workspace = recordAndDebrief(
    workspace,
    "assessment:ios",
    "ios:value-reference-snapshots",
    iosAttempt("ios:value-reference-snapshots"),
  );
  const report = deriveAssessmentReport(workspace, "assessment:ios");
  assert.equal(report.evidenceLabel, "Self-assessed evidence");
  assert.equal(report.probes[0].evidenceLevel, "self-assessed");
  assert.equal(report.lanes.ios.selfAssessed, 1);
  assert.equal(report.lanes.ios.independent, 0);
  assert.match(report.disclaimer, /self-assessed|not validated/i);
});

test("debrief normalization clamps every rubric dimension, filters blockers, and bounds notes", () => {
  let workspace = start();
  workspace = recordAssessmentObjectiveAttempt(
    workspace,
    "assessment:one",
    "python:10001",
    completedPythonAttempt("python:10001"),
    { now: t1 },
  );
  workspace = recordAssessmentDebrief(workspace, "assessment:one", "python:10001", {
    rubric: { recognition: 99, reasoning: -10, implementation: 1.4, verification: "2", communication: null },
    blockers: ["syntax-fluency", "not-real", "syntax-fluency", "boundary"],
    note: `\u0000 ${"x".repeat(900)}`,
  }, { now: t2 });
  const debrief = workspace.runs[0].results[0].debrief;
  assert.deepEqual(debrief.rubric, {
    recognition: 2,
    reasoning: 0,
    implementation: 1,
    verification: 2,
    communication: 0,
  });
  assert.deepEqual(debrief.blockers, ["syntax-fluency", "boundary"]);
  assert.ok(debrief.note.length <= 480);
  assert.equal(deriveAssessmentReport(workspace).probes[0].rubricTotal, 5);
});

test("a debrief cannot be recorded before an objective attempt", () => {
  const workspace = start();
  const unchanged = recordAssessmentDebrief(workspace, "assessment:one", "python:10001", {
    rubric: fullRubric,
  }, { now: t1 });
  assert.deepEqual(unchanged, workspace);
});

test("normalization repairs malformed runs to the canonical program probe set", () => {
  const normalized = normalizeAssessmentWorkspace({
    version: 999,
    revision: -4,
    activeRunId: "run:two",
    updatedAt: "bad",
    runs: [
      {
        id: "run:one",
        programId: "python-reentry",
        status: "active",
        startedAt: t0,
        currentProbeIndex: 999,
        results: [
          { probeId: "python:1", itemId: "python:1", refresher: { kind: "typing", stage: 999 } },
          { probeId: "made-up", itemId: "made-up", debrief: { blockers: ["boundary"] } },
        ],
      },
      {
        id: "run:two",
        programId: "ios-pulse",
        status: "active",
        startedAt: t1,
        results: [],
      },
      { id: "invalid", programId: "invalid" },
    ],
  }, { now: t2 });
  assert.equal(normalized.version, 2);
  assert.equal(normalized.revision, 0);
  assert.equal(normalized.updatedAt, t2);
  assert.equal(normalized.runs.length, 2);
  assert.equal(normalized.runs.filter(({ status }) => status === "active").length, 1);
  assert.equal(normalized.activeRunId, "run:two");
  assert.equal(normalized.runs[0].results.length, 6);
  assert.equal(normalized.runs[0].results.find(({ probeId }) => probeId === "python:1").refresher.stage, 4);
  assert.equal(normalized.runs[0].currentProbeIndex, 5);
});

test("standalone run and result normalizers reject unknown identities", () => {
  assert.equal(normalizeAssessmentRun({ id: "x", programId: "unknown" }), null);
  assert.equal(normalizeAssessmentRun({ programId: "python-reentry" }), null);
  assert.equal(normalizeAssessmentProbeResult({ probeId: "unknown" }), null);
  const result = normalizeAssessmentProbeResult(
    { probeId: "python:1", debrief: { rubric: fullRubric } },
    "python:1",
    { now: t0 },
  );
  assert.equal(result.status, "pending");
  assert.equal(result.debrief, undefined);
  assert.equal(result.itemId, "python:1");
});

test("one probe records one immutable objective attempt", () => {
  let workspace = start();
  workspace = recordAssessmentObjectiveAttempt(
    workspace,
    "assessment:one",
    "python:10001",
    completedPythonAttempt("python:10001"),
    { now: t1 },
  );
  const before = structuredClone(workspace);
  const replacement = recordAssessmentObjectiveAttempt(
    workspace,
    "assessment:one",
    "python:10001",
    completedPythonAttempt("python:10001", { peeks: 9, qualification: "assisted" }),
    { now: t2 },
  );
  assert.deepEqual(replacement, before);
});

test("finishing early records an ended diagnostic while a fully debriefed run completes", () => {
  let early = start();
  early = finishAssessment(early, "assessment:one", { now: t1 });
  assert.equal(early.runs[0].status, "completed");
  assert.equal(early.runs[0].outcome, "ended");
  assert.equal(early.activeRunId, null);

  let full = start("ios-pulse", "assessment:ios");
  for (const probe of assessmentProgram("ios-pulse").probes) {
    full = recordAndDebrief(full, "assessment:ios", probe.id, iosAttempt(probe.itemId));
  }
  full = finishAssessment(full, "assessment:ios", { now: t3 });
  assert.equal(full.runs[0].outcome, "completed");
  assert.equal(full.runs[0].completedAt, t3);
  assert.equal(deriveAssessmentReport(full, "assessment:ios").completion.debriefed, 3);
});

test("archive preserves the completed report while removing the run from active work", () => {
  let workspace = start();
  workspace = finishAssessment(workspace, "assessment:one", { now: t1 });
  workspace = archiveAssessment(workspace, "assessment:one", { now: t2 });
  assert.equal(workspace.runs[0].status, "archived");
  assert.equal(workspace.runs[0].archivedAt, t2);
  assert.equal(workspace.runs[0].outcome, "ended");
  assert.equal(deriveAssessmentReport(workspace, "assessment:one").status, "archived");
  assert.deepEqual(archiveAssessment(workspace, "assessment:one", { now: t3 }), workspace);
});

test("reports always return three deterministic next recommendations without a global score", () => {
  let workspace = start();
  workspace = recordAndDebrief(
    workspace,
    "assessment:one",
    "python:10001",
    completedPythonAttempt("python:10001"),
    {
      rubric: { ...fullRubric, verification: 0 },
      blockers: ["verification"],
      note: "Did not test empty input.",
    },
  );
  const report = deriveAssessmentReport(workspace);
  assert.equal(report.recommendations.length, 3);
  assert.equal(report.recommendations[0].itemId, "python:1");
  assert.equal(report.blockers[0].id, "verification");
  assert.equal(report.blockers[0].count, 1);
  assert.equal("score" in report, false);
  assert.equal("percent" in report, false);
});

test("study-plan seed is compatible with collection and plan creation inputs and preserves separate lanes", () => {
  let python = start();
  python = recordAndDebrief(
    python,
    "assessment:one",
    "python:10001",
    completedPythonAttempt("python:10001", { peeks: 1, qualification: "assisted" }),
  );
  const seed = buildAssessmentStudyPlanSeed(python, { runId: "assessment:one", title: "My follow-up" });
  assert.equal(seed.sourceAssessmentRunId, "assessment:one");
  assert.equal(seed.collection.title, "My follow-up");
  assert.equal(seed.collection.source, "custom");
  assert.deepEqual(seed.collection.itemIds, ["python:1", "python:104", "python:125", "python:20", "python:200", "python:10001"]);
  assert.deepEqual(seed.collection.modules.map(({ id }) => id), ["python-fluency", "algorithmic-transfer"]);
  assert.equal(seed.plan.paceMinutes, 30);
  assert.equal(seed.plan.blocksPerWeek, 3);

  assert.equal(
    buildAssessmentStudyPlanSeed(
      deriveAssessmentReport(start("ios-pulse", "assessment:empty")),
    ),
    null,
  );
  let ios = start("ios-pulse", "assessment:ios");
  ios = recordAndDebrief(
    ios,
    "assessment:ios",
    "ios:value-reference-snapshots",
    iosAttempt("ios:value-reference-snapshots"),
  );
  const iosSeed = buildAssessmentStudyPlanSeed(deriveAssessmentReport(ios));
  assert.equal(iosSeed.plan.paceMinutes, 15);
  assert.deepEqual(iosSeed.collection.modules.map(({ id }) => id), ["ios-reconstruction"]);
});

test("duplicate deterministic IDs and invalid program IDs are safe no-ops", () => {
  const workspace = start();
  assert.deepEqual(
    startAssessment(workspace, "python-reentry", { id: "assessment:one", now: t1 }),
    workspace,
  );
  assert.deepEqual(
    startAssessment(workspace, "not-a-program", { id: "assessment:two", now: t1 }),
    workspace,
  );
  assert.deepEqual(resumeAssessment(workspace, "missing", { now: t1 }), workspace);
});
