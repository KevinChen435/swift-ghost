import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSESSMENT_BANK_ENTRIES,
  ASSESSMENT_BANK_REVISION,
  CROSS_LANE_REENTRY_BLUEPRINT,
  assessmentBankEntry,
  selectAssessmentForm,
} from "../app/lib/assessment-bank.mjs";
import {
  createAssessmentWorkspace,
  currentAssessmentProbe,
  deriveAssessmentReport,
  normalizeAssessmentWorkspace,
  recordAssessmentObjectiveAttempt,
  recordAssessmentRefresher,
  startAssessment,
} from "../app/lib/assessments.mjs";

const now = "2026-07-29T12:00:00.000Z";

test("cross-lane bank has 24 unique revisioned entries across six ordered four-candidate sections", () => {
  assert.equal(ASSESSMENT_BANK_REVISION, 1);
  assert.equal(ASSESSMENT_BANK_ENTRIES.length, 24);
  assert.equal(new Set(ASSESSMENT_BANK_ENTRIES.map(({ id }) => id)).size, 24);
  assert.equal(new Set(ASSESSMENT_BANK_ENTRIES.map(({ itemId }) => itemId)).size, 24);
  assert.equal(CROSS_LANE_REENTRY_BLUEPRINT.formSize, 6);
  assert.equal(CROSS_LANE_REENTRY_BLUEPRINT.candidateCount, 24);
  assert.deepEqual(CROSS_LANE_REENTRY_BLUEPRINT.sections.map(({ id }) => id), [
    "python-fluency",
    "python-data-structures",
    "python-traversal-state",
    "swift-algorithm-reconstruction",
    "swift-language-boundaries",
    "ios-engineering-boundaries",
  ]);
  assert.ok(CROSS_LANE_REENTRY_BLUEPRINT.sections.every(({ candidateIds, count }) => candidateIds.length === 4 && count === 1));
  assert.ok(ASSESSMENT_BANK_ENTRIES.every(({ itemId, itemRevision, stage }) =>
    itemRevision === (itemId.startsWith("ios:") ? 2 : 1) && stage === 5));
  assert.ok(ASSESSMENT_BANK_ENTRIES.filter(({ lane }) => lane === "python").every(({ judgeRevision }) => judgeRevision === 2));
  assert.ok(ASSESSMENT_BANK_ENTRIES.filter(({ responseMode }) => responseMode === "concept-recall").every(({ conceptCheckIndex }) => conceptCheckIndex === 1));
  assert.equal(ASSESSMENT_BANK_ENTRIES.filter(({ sectionId }) => sectionId === "swift-language-boundaries").every(({ lane }) => lane === "swift"), true);
  assert.equal(ASSESSMENT_BANK_ENTRIES.filter(({ sectionId }) => sectionId === "ios-engineering-boundaries").every(({ lane }) => lane === "ios"), true);
  assert.deepEqual(
    CROSS_LANE_REENTRY_BLUEPRINT.sections.map(({ candidateIds }) =>
      candidateIds.map((id) => assessmentBankEntry(id).itemId)),
    [
      ["python:10001", "python:10004", "python:10005", "python:10006"],
      ["python:1", "python:20", "python:206", "python:215"],
      ["python:3", "python:102", "python:200", "python:39"],
      ["builtin:1", "builtin:125", "builtin:20", "builtin:704"],
      ["ios:value-reference-snapshots", "ios:optional-throwing-boundary", "ios:weak-stored-closure", "ios:actor-response-cache"],
      ["ios:uikit-lifecycle-boundaries", "ios:swiftui-owned-observable-state", "ios:network-decode-cache-policy", "ios:dependency-injected-test"],
    ],
  );
  const columnTotals = [0, 1, 2, 3].map((column) =>
    CROSS_LANE_REENTRY_BLUEPRINT.sections.reduce(
      (total, section) =>
        total + assessmentBankEntry(section.candidateIds[column]).estimatedMinutes,
      0,
    ));
  assert.deepEqual(columnTotals, [33, 34, 41, 43]);
  assert.equal(assessmentBankEntry("missing"), null);
});

test("selection freezes exactly one candidate per section and is stable for a seed", () => {
  const first = selectAssessmentForm({ seed: "candidate-42" });
  const repeat = selectAssessmentForm({ seed: "candidate-42" });
  assert.deepEqual(first, repeat);
  assert.equal(first.length, 6);
  assert.deepEqual(first.map(({ sectionId }) => sectionId), CROSS_LANE_REENTRY_BLUEPRINT.sections.map(({ id }) => id));

  const workspace = startAssessment(createAssessmentWorkspace(now), "cross-lane-reentry", {
    id: "assessment:cross",
    now,
    selectionSeed: "candidate-42",
  });
  const run = workspace.runs[0];
  assert.equal(workspace.version, 2);
  assert.equal(run.formKind, "bank");
  assert.equal(run.form.length, 6);
  assert.deepEqual(run.form.map(({ itemId }) => itemId), first.map(({ itemId }) => itemId));
  assert.ok(run.form.every(({ currentEvidenceEligible }) => currentEvidenceEligible));
  assert.equal(currentAssessmentProbe(run).responseMode, "local-verified-solve");
});

test("fair selection prioritizes unseen, then missing current evidence, appearances, and oldest exposure", () => {
  const section = CROSS_LANE_REENTRY_BLUEPRINT.sections[0];
  const [a, b, c, d] = section.candidateIds.map(assessmentBankEntry);
  const history = [
    { itemId: a.itemId, exposedAt: "2026-07-01T00:00:00Z" },
    { itemId: b.itemId, exposedAt: "2026-07-02T00:00:00Z" },
    { itemId: c.itemId, exposedAt: "2026-07-03T00:00:00Z" },
  ];
  assert.equal(selectAssessmentForm({ seed: "fair", history })[0].id, d.id);

  const allSeen = [...history, { itemId: d.itemId, exposedAt: "2026-07-04T00:00:00Z" }];
  const evidence = [{
    itemId: a.itemId,
    itemRevision: 1,
    practiceKind: "solving",
    outcome: "completed",
    qualification: "solved",
    peeks: 0,
    verification: { revision: 2, passed: 4, total: 4 },
  }];
  assert.notEqual(selectAssessmentForm({ seed: "fair", history: allSeen, evidence })[0].id, a.id);
  assert.equal(selectAssessmentForm({ seed: "fair", history: allSeen })[0].id, a.id);

  const repeatedOldest = [
    ...allSeen,
    { itemId: a.itemId, exposedAt: "2026-07-20T00:00:00Z" },
    { itemId: b.itemId, exposedAt: "2026-07-10T00:00:00Z" },
    { itemId: c.itemId, exposedAt: "2026-07-15T00:00:00Z" },
    { itemId: d.itemId, exposedAt: "2026-07-18T00:00:00Z" },
  ];
  assert.equal(selectAssessmentForm({ seed: "fair", history: repeatedOldest })[0].id, b.id);
});

test("starting a later run uses successful assessment results as current evidence", () => {
  let workspace = createAssessmentWorkspace("2026-07-01T00:00:00.000Z");
  const firstSectionSelections = [];

  for (let index = 0; index < 4; index += 1) {
    const startedAt = `2026-07-0${index + 1}T00:00:00.000Z`;
    workspace = startAssessment(workspace, "cross-lane-reentry", {
      id: `assessment:evidence-${index + 1}`,
      now: startedAt,
      selectionSeed: `evidence-${index + 1}`,
    });
    const run = workspace.runs.find(({ id }) => id === `assessment:evidence-${index + 1}`);
    const entry = run.form[0];
    firstSectionSelections.push(entry.itemId);
    if (index === 0) {
      workspace = recordAssessmentObjectiveAttempt(workspace, run.id, entry.entryId, {
        itemId: entry.itemId,
        itemRevision: entry.itemRevision,
        responseMode: entry.responseMode,
        stage: entry.stage,
        practiceKind: "solving",
        outcome: "completed",
        qualification: "solved",
        peeks: 0,
        verification: { revision: entry.judgeRevision, passed: 4, total: 4 },
      }, { now: startedAt });
    }
  }

  assert.equal(new Set(firstSectionSelections).size, 4);
  workspace = startAssessment(workspace, "cross-lane-reentry", {
    id: "assessment:evidence-5",
    now: "2026-07-05T00:00:00.000Z",
    selectionSeed: "evidence-5",
  });
  const fifth = workspace.runs.find(({ id }) => id === "assessment:evidence-5");
  assert.equal(fifth.form[0].itemId, firstSectionSelections[1]);
  assert.notEqual(fifth.form[0].itemId, firstSectionSelections[0]);
});

test("v1 programs migrate losslessly to legacy-fixed forms without bank candidates", () => {
  const old = {
    version: 1,
    revision: 3,
    updatedAt: now,
    activeRunId: "legacy-python",
    runs: [{
      id: "legacy-python",
      programId: "python-reentry",
      status: "active",
      startedAt: now,
      currentProbeIndex: 1,
      results: [{ probeId: "python:1", itemId: "python:1" }],
    }, {
      id: "legacy-ios",
      programId: "ios-pulse",
      status: "paused",
      startedAt: now,
      results: [],
    }],
  };
  const migrated = normalizeAssessmentWorkspace(old, { now });
  assert.equal(migrated.version, 2);
  const python = migrated.runs.find(({ id }) => id === "legacy-python");
  const ios = migrated.runs.find(({ id }) => id === "legacy-ios");
  assert.equal(python.formKind, "legacy-fixed");
  assert.deepEqual(python.form.map(({ itemId }) => itemId), [
    "python:10001", "python:1", "python:125", "python:20", "python:104", "python:200",
  ]);
  assert.deepEqual(ios.form.map(({ itemId }) => itemId), [
    "ios:value-reference-snapshots", "ios:weak-stored-closure", "ios:cancellable-search",
  ]);
  assert.ok(python.form.every(({ bankEntryId }) => bankEntryId.startsWith("legacy:")));
});

test("started forms retain stale and future snapshots but fail closed for current evidence", () => {
  const workspace = startAssessment(createAssessmentWorkspace(now), "cross-lane-reentry", {
    id: "assessment:stale",
    now,
    selectionSeed: "stale",
  });
  const snapshot = structuredClone(workspace);
  snapshot.runs[0].form[0].bankRevision = 0;
  snapshot.runs[0].form[1].itemRevision = 999;
  snapshot.runs[0].form[2].bankRevision = ASSESSMENT_BANK_REVISION + 100;
  const normalized = normalizeAssessmentWorkspace(snapshot, { now });
  assert.equal(normalized.runs[0].form[0].bankRevision, 0);
  assert.equal(normalized.runs[0].form[1].itemRevision, 999);
  assert.equal(normalized.runs[0].form[2].bankRevision, ASSESSMENT_BANK_REVISION + 100);
  assert.deepEqual(normalized.runs[0].form.slice(0, 3).map(({ currentEvidenceEligible }) => currentEvidenceEligible), [false, false, false]);
});

test("response contracts reject mismatched revisions, modes, stage, and concept check", () => {
  let workspace = startAssessment(createAssessmentWorkspace(now), "cross-lane-reentry", {
    id: "assessment:contracts",
    now,
    selectionSeed: "contracts",
  });
  const run = workspace.runs[0];
  const python = run.form.find(({ responseMode }) => responseMode === "local-verified-solve");
  const validPython = {
    itemId: python.itemId,
    itemRevision: python.itemRevision,
    responseMode: python.responseMode,
    stage: 5,
    practiceKind: "solving",
    outcome: "completed",
    qualification: "solved",
    peeks: 0,
    verification: { revision: python.judgeRevision, passed: 4, total: 4 },
  };
  const mismatch = recordAssessmentObjectiveAttempt(workspace, run.id, python.entryId, {
    ...validPython,
    responseMode: "swift-reconstruction",
  }, { now });
  assert.deepEqual(mismatch, workspace);
  workspace = recordAssessmentObjectiveAttempt(workspace, run.id, python.entryId, validPython, { now });
  assert.equal(workspace.runs[0].results.find(({ probeId }) => probeId === python.entryId).objectiveAttempt.accepted, true);

  const swift = run.form.find(({ responseMode }) => responseMode === "swift-reconstruction");
  const wrongStage = recordAssessmentObjectiveAttempt(workspace, run.id, swift.entryId, {
    itemId: swift.itemId,
    itemRevision: swift.itemRevision,
    responseMode: swift.responseMode,
    stage: 4,
    practiceKind: "typing",
    outcome: "completed",
  }, { now });
  assert.equal(wrongStage.runs[0].results.find(({ probeId }) => probeId === swift.entryId).objectiveAttempt, undefined);

  const concept = run.form.find(({ responseMode }) => responseMode === "concept-recall");
  const wrongCheck = recordAssessmentObjectiveAttempt(workspace, run.id, concept.entryId, {
    itemId: concept.itemId,
    itemRevision: concept.itemRevision,
    responseMode: concept.responseMode,
    stage: 5,
    conceptCheckIndex: 2,
    practiceKind: "concept",
    outcome: "completed",
  }, { now });
  assert.equal(wrongCheck.runs[0].results.find(({ probeId }) => probeId === concept.entryId).objectiveAttempt, undefined);
});

test("Swift and concept refreshers remain assisted after a valid frozen response", () => {
  let workspace = startAssessment(createAssessmentWorkspace(now), "cross-lane-reentry", {
    id: "assessment:assisted-modes",
    now,
    selectionSeed: "assisted-modes",
  });
  const run = workspace.runs[0];
  for (const responseMode of ["swift-reconstruction", "concept-recall"]) {
    const entry = run.form.find((candidate) => candidate.responseMode === responseMode);
    workspace = recordAssessmentRefresher(
      workspace,
      run.id,
      entry.entryId,
      { kind: responseMode === "concept-recall" ? "concept-review" : "known-answer", stage: responseMode === "concept-recall" ? 0 : 1 },
      { now },
    );
    workspace = recordAssessmentObjectiveAttempt(
      workspace,
      run.id,
      entry.entryId,
      {
        itemId: entry.itemId,
        itemRevision: entry.itemRevision,
        responseMode,
        stage: 5,
        conceptCheckIndex: entry.conceptCheckIndex,
        practiceKind: responseMode === "concept-recall" ? "concept" : "typing",
        outcome: "completed",
        qualification: "independent",
        peeks: 0,
      },
      { now },
    );
  }
  const report = deriveAssessmentReport(workspace);
  for (const responseMode of ["swift-reconstruction", "concept-recall"]) {
    const probe = report.probes.find((candidate) => candidate.responseMode === responseMode);
    assert.equal(probe.usedRefresher, true);
    assert.equal(probe.evidenceLevel, "assisted");
  }
});

test("cross-lane report has six transparent rows and no composite score", () => {
  const workspace = startAssessment(createAssessmentWorkspace(now), "cross-lane-reentry", {
    id: "assessment:report",
    now,
    selectionSeed: "report",
  });
  const report = deriveAssessmentReport(workspace);
  assert.equal(report.sections.length, 6);
  assert.equal(report.lanes.swift.totalProbes, 2);
  assert.equal(report.lanes.crossLaneIos.totalProbes, 1);
  assert.equal(report.probes.length, 6);
  assert.ok(report.sections.every(({ trustLabel }) => /not |self-assessed/i.test(trustLabel)));
  assert.equal("score" in report, false);
  assert.equal("percent" in report, false);
  assert.equal("composite" in report, false);
});
