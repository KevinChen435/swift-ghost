import assert from "node:assert/strict";
import test from "node:test";
import { FUNDAMENTALS } from "../app/data/fundamentals.ts";
import { PROBLEMS } from "../app/data/problems.ts";
import { PYTHON_PROBLEMS } from "../app/data/python-problems.ts";
import { TEST_DESIGN_PROBES } from "../app/data/test-design-probes.ts";
import {
  TEST_DESIGN_ATTEMPT_LIMIT,
  TEST_DESIGN_LANES,
  canonicalTestValue,
  commitTestDesignAttempt,
  createTestDesignWorkspace,
  deriveTestDesignOverview,
  deriveTestDesignState,
  gradeTestDesignAttempt,
  normalizeTestDesignWorkspace,
  revealTestDesignAttempt,
  saveTestDesignDraft,
  startTestDesignSprint,
} from "../app/lib/test-design.mjs";

const T0 = "2026-07-29T12:00:00.000Z";
const ITEMS = TEST_DESIGN_PROBES.map((probe) => ({
  itemId: probe.itemId,
  contentRevision: probe.itemRevision,
}));
const iso = (days, minutes = 0) => new Date(Date.parse(T0) + days * 86400000 + minutes * 60000).toISOString();
function current(workspace) {
  const entry = workspace.activeSprint.entries[workspace.activeSprint.cursor];
  return TEST_DESIGN_PROBES.find((probe) => probe.id === entry.probeId && probe.revision === entry.probeRevision);
}
function start(workspace, id, now, source = "academy", lane = "python") {
  return startTestDesignSprint(workspace, TEST_DESIGN_PROBES, ITEMS, {
    id,
    now,
    count: 3,
    source,
    lane,
  });
}
function inputFor(probe, overrides = {}) {
  const reference = probe.referenceCases[0];
  return {purpose:probe.primaryPurpose,assumption:"The public contract applies.",input:reference.input,expected:reference.expected,defectCaught:reference.defectCaught,assisted:false,...overrides};
}
function completeCurrent(workspace, id, now, overrides = {}, grade = "good") {
  const probe = current(workspace);
  let next = commitTestDesignAttempt(workspace, probe, inputFor(probe, overrides), {id, probes:TEST_DESIGN_PROBES,items:ITEMS,now});
  const attempt = next.attempts.at(-1);
  next = revealTestDesignAttempt(next, attempt.id, {probes:TEST_DESIGN_PROBES,items:ITEMS,now:iso((Date.parse(now)-Date.parse(T0))/86400000,1)});
  return gradeTestDesignAttempt(next, attempt.id, grade, {probes:TEST_DESIGN_PROBES,items:ITEMS,now:iso((Date.parse(now)-Date.parse(T0))/86400000,2)});
}
function completeSprint(workspace, prefix, now) {
  let next = workspace;
  while (next.activeSprint.status === "active") next = completeCurrent(next, `${prefix}-${next.activeSprint.cursor}`, now);
  return next;
}

test("canonical JSON comparison is safe and semantic comparators accept unordered anagram groups", () => {
  assert.equal(canonicalTestValue(' {"b":2,"a":1} '), '{"a":1,"b":2}');
  let workspace = start(createTestDesignWorkspace(T0), "oracle", T0);
  const anagram = TEST_DESIGN_PROBES.find((probe) => probe.id.includes("anagram"));
  workspace = {...workspace, activeSprint:{...workspace.activeSprint,entries:[{probeId:anagram.id,probeRevision:anagram.revision}],cursor:0}};
  workspace = commitTestDesignAttempt(workspace, anagram, inputFor(anagram,{expected:'[["ab"],["abb"]]'}), {id:"unordered",probes:TEST_DESIGN_PROBES,items:ITEMS,now:T0});
  assert.equal(workspace.attempts[0].oracleStatus, "confirmed");
});

test("unordered object-array observations ignore scheduler order without ignoring object fields", () => {
  const probe = TEST_DESIGN_PROBES.find(
    (entry) => entry.id === "test-design:swift-async-let-overlap",
  );
  let workspace = start(
    createTestDesignWorkspace(T0),
    "swift-order",
    T0,
    "academy",
    "swift",
  );
  workspace = {
    ...workspace,
    activeSprint: {
      ...workspace.activeSprint,
      entries: [{ probeId: probe.id, probeRevision: probe.revision }],
      cursor: 0,
    },
  };
  workspace = commitTestDesignAttempt(
    workspace,
    probe,
    inputFor(probe, {
      expected:
        '{"dashboardReturnedAfterBothCompleted":true,"startedBeforeRelease":["messages","profile"]}',
    }),
    { id: "swift-unordered", probes: TEST_DESIGN_PROBES, items: ITEMS, now: T0 },
  );
  assert.equal(workspace.attempts[0].oracleStatus, "confirmed");

  const contradicted = commitTestDesignAttempt(
    {
      ...workspace,
      attempts: [],
    },
    probe,
    inputFor(probe, {
      expected:
        '{"dashboardReturnedAfterBothCompleted":false,"startedBeforeRelease":["messages","profile"]}',
    }),
    { id: "swift-wrong-field", probes: TEST_DESIGN_PROBES, items: ITEMS, now: T0 },
  );
  assert.equal(contradicted.attempts[0].oracleStatus, "contradicted");
});

test("novel inputs stay unverified while a known input with a different oracle is contradicted", () => {
  let novel = start(createTestDesignWorkspace(T0), "novel", T0);
  const probe = current(novel);
  novel = commitTestDesignAttempt(novel, probe, inputFor(probe,{input:'["novel planning input"]',expected:'"maybe"'}), {id:"novel-attempt",probes:TEST_DESIGN_PROBES,items:ITEMS,now:T0});
  assert.equal(novel.attempts[0].oracleStatus, "unverified");
  let contradicted = start(createTestDesignWorkspace(T0), "wrong", T0);
  const known = current(contradicted);
  contradicted = commitTestDesignAttempt(contradicted, known, inputFor(known,{expected:'"definitely wrong"'}), {id:"wrong-attempt",probes:TEST_DESIGN_PROBES,items:ITEMS,now:T0});
  assert.equal(contradicted.attempts[0].oracleStatus, "contradicted");
});

test("drafts persist explicit empty purpose, hints stay assisted, and commit locks required fields", () => {
  let workspace = start(createTestDesignWorkspace(T0), "draft", T0);
  const probe = current(workspace);
  workspace = saveTestDesignDraft(workspace, probe, {purpose:"",assumption:"a",input:"[]",expected:"[]",defectCaught:"d",assisted:true}, {probes:TEST_DESIGN_PROBES,items:ITEMS,now:T0});
  const outsideProbe = TEST_DESIGN_PROBES.find(
    (candidate) =>
      candidate.lane === workspace.activeSprint.lane &&
      !workspace.activeSprint.entries.some(
        (entry) => entry.probeId === candidate.id,
      ),
  );
  workspace.drafts.push({
    ...workspace.drafts[0],
    probeId: outsideProbe.id,
    probeRevision: outsideProbe.revision,
  });
  const restored = normalizeTestDesignWorkspace(JSON.parse(JSON.stringify(workspace)), {probes:TEST_DESIGN_PROBES,items:ITEMS,now:T0});
  assert.equal(restored.drafts.length, 1);
  assert.equal(restored.drafts[0].purpose, "");
  assert.equal(restored.drafts[0].assisted, true);
  assert.equal(commitTestDesignAttempt(restored, probe, restored.drafts[0], {id:"blocked",probes:TEST_DESIGN_PROBES,items:ITEMS,now:T0}).attempts.length, 0);
});

test("new exposure schedules tomorrow, early strong practice preserves due date, and delayed distinct probes retain a skill", () => {
  let workspace = completeSprint(start(createTestDesignWorkspace(T0), "day0", T0), "d0", T0);
  const collection = deriveTestDesignState("collection-contracts", workspace, TEST_DESIGN_PROBES, {now:iso(0,3)});
  assert.equal(collection.level, 0);
  assert.equal(collection.dueAt, iso(1,2));
  workspace = completeSprint(start(workspace, "early", iso(0,10)), "early", iso(0,10));
  assert.equal(deriveTestDesignState("collection-contracts", workspace, TEST_DESIGN_PROBES, {now:iso(0,13)}).dueAt, iso(1,2));
  workspace = completeSprint(start(workspace, "due1", iso(2)), "due1", iso(2));
  assert.equal(deriveTestDesignState("collection-contracts", workspace, TEST_DESIGN_PROBES, {now:iso(2,3)}).retainedProbeCount, 1);
  workspace = completeSprint(start(workspace, "due2", iso(4)), "due2", iso(4));
  const retained = deriveTestDesignState("collection-contracts", workspace, TEST_DESIGN_PROBES, {now:iso(4,3)});
  assert.equal(retained.retainedProbeCount, 2);
  assert.equal(retained.retained, true);
});

test("misses, hints, contradicted oracles, and Again reset to tomorrow without advancing", () => {
  for (const [name, overrides, grade] of [
    ["hint",{assisted:true},"good"], ["purpose",{purpose:"baseline"},"good"], ["oracle",{expected:'"wrong"'},"good"], ["again",{},"again"],
  ]) {
    let workspace = start(createTestDesignWorkspace(T0), name, T0);
    workspace = completeCurrent(workspace, `${name}-attempt`, T0, overrides, grade);
    const attempt = workspace.attempts[0];
    assert.equal(attempt.levelAfter, 0, name);
    assert.equal(attempt.dueAt, iso(1,2), name);
  }
});

test("stale content drops an active sprint as a unit and history remains bounded", () => {
  let workspace = start(createTestDesignWorkspace(T0), "stale", T0);
  workspace = saveTestDesignDraft(workspace, current(workspace), inputFor(current(workspace)), {probes:TEST_DESIGN_PROBES,items:ITEMS,now:T0});
  const changed = TEST_DESIGN_PROBES.map((probe) => ({...probe,revision:probe.revision+1}));
  const normalized = normalizeTestDesignWorkspace(workspace,{probes:changed,items:ITEMS,now:T0});
  assert.equal(normalized.activeSprint, undefined);
  assert.deepEqual(normalized.drafts, []);
  const probe = TEST_DESIGN_PROBES[0], raw = createTestDesignWorkspace(T0);
  raw.attempts = Array.from({length:TEST_DESIGN_ATTEMPT_LIMIT+5},(_,index)=>({id:`a-${index}`,sprintId:`s-${index}`,source:"academy",probeId:probe.id,probeRevision:probe.revision,itemId:probe.itemId,itemRevision:probe.itemRevision,skillId:probe.skillId,...inputFor(probe),wasDue:false,purposeMatch:true,oracleStatus:"confirmed",committedAt:iso(0,index),updatedAt:iso(0,index)}));
  assert.equal(normalizeTestDesignWorkspace(raw,{probes:TEST_DESIGN_PROBES,items:ITEMS,now:T0}).attempts.length,TEST_DESIGN_ATTEMPT_LIMIT);
});

test("the authored academy bank has 24 design-only probes and 12 skills across three lanes", () => {
  assert.deepEqual(TEST_DESIGN_LANES, ["python", "swift", "ios"]);
  assert.equal(TEST_DESIGN_PROBES.length, 24);

  const expected = {
    python: { probes: 6, skills: 3 },
    swift: { probes: 8, skills: 4 },
    ios: { probes: 10, skills: 5 },
  };
  const probeIds = new Set();
  const caseIds = new Set();
  for (const lane of TEST_DESIGN_LANES) {
    const probes = TEST_DESIGN_PROBES.filter((probe) => probe.lane === lane);
    assert.equal(probes.length, expected[lane].probes, `${lane} probe count`);
    assert.equal(
      new Set(probes.map((probe) => probe.skillId)).size,
      expected[lane].skills,
      `${lane} skill count`,
    );
    for (const skillId of new Set(probes.map((probe) => probe.skillId))) {
      assert.ok(
        probes.filter((probe) => probe.skillId === skillId).length >= 2,
        `${skillId} needs at least two distinct probes for retention`,
      );
    }
  }

  for (const probe of TEST_DESIGN_PROBES) {
    assert.equal(probeIds.has(probe.id), false, `duplicate probe ${probe.id}`);
    probeIds.add(probe.id);
    assert.equal(probe.executionPolicy, "design-only");
    assert.ok(["call-arguments", "event-sequence"].includes(probe.inputFormat));
    const itemExists =
      probe.lane === "python"
        ? [...PROBLEMS, ...PYTHON_PROBLEMS].some(
            (item) => `python:${item.id}` === probe.itemId,
          ) && probe.itemRevision === 1
        : FUNDAMENTALS.some((item) => item.id === probe.itemId) &&
          probe.itemRevision === 2;
    assert.equal(itemExists, true, `${probe.id} points at current authored content`);
    assert.equal(probe.referenceCases.length, 2);
    for (const authoredCase of probe.referenceCases) {
      const qualifiedId = `${probe.id}:${authoredCase.id}`;
      assert.equal(caseIds.has(qualifiedId), false, `duplicate case ${qualifiedId}`);
      caseIds.add(qualifiedId);
      assert.doesNotThrow(() => JSON.parse(authoredCase.input), qualifiedId);
      assert.doesNotThrow(() => JSON.parse(authoredCase.expected), qualifiedId);
      assert.ok(authoredCase.rationale.length > 0, qualifiedId);
      assert.ok(authoredCase.defectCaught.length > 0, qualifiedId);
    }
  }
  assert.equal(caseIds.size, 48);
});

test("overviews and sprint selection stay isolated to the selected lane", () => {
  let workspace = createTestDesignWorkspace(T0);
  for (const [lane, total] of [
    ["python", 3],
    ["swift", 4],
    ["ios", 5],
  ]) {
    const overview = deriveTestDesignOverview(TEST_DESIGN_PROBES, workspace, {
      lane,
      now: T0,
    });
    assert.deepEqual(
      {
        new: overview.newCount,
        ready: overview.readyCount,
        total: overview.totalSkills,
      },
      { new: total, ready: total, total },
    );
  }

  workspace = start(workspace, "swift-only", T0, "academy", "swift");
  assert.equal(workspace.activeSprint.lane, "swift");
  assert.ok(
    workspace.activeSprint.entries.every((entry) =>
      TEST_DESIGN_PROBES.some(
        (probe) => probe.id === entry.probeId && probe.lane === "swift",
      ),
    ),
  );

  const stillSwift = start(workspace, "ios-cannot-replace", iso(1), "today", "ios");
  assert.equal(stillSwift.activeSprint.id, "swift-only");
  assert.equal(stillSwift.activeSprint.lane, "swift");
});

test("v1 workspaces migrate to v2 and future revisions retain completed history as retired", () => {
  let workspace = start(createTestDesignWorkspace(T0), "history", T0);
  workspace = completeSprint(workspace, "history-attempt", T0);
  workspace = start(workspace, "draft-sprint", iso(1), "today", "swift");
  workspace = saveTestDesignDraft(
    workspace,
    current(workspace),
    inputFor(current(workspace)),
    { probes: TEST_DESIGN_PROBES, items: ITEMS, now: iso(1, 1) },
  );

  const legacy = JSON.parse(JSON.stringify(workspace));
  legacy.version = 1;
  delete legacy.activeSprint.lane;
  for (const attempt of legacy.attempts) {
    delete attempt.lane;
    delete attempt.observationKind;
    delete attempt.executionPolicy;
  }
  const migrated = normalizeTestDesignWorkspace(legacy, {
    probes: TEST_DESIGN_PROBES,
    items: ITEMS,
    now: iso(1, 2),
  });
  assert.equal(migrated.version, 2);
  assert.equal(migrated.attempts[0].lane, "python");
  assert.equal(migrated.attempts[0].executionPolicy, "design-only");
  assert.equal(migrated.activeSprint.lane, "swift");
  assert.equal(migrated.drafts.length, 1);

  const revisedProbes = TEST_DESIGN_PROBES.map((probe) => ({
    ...probe,
    revision: probe.revision + 1,
  }));
  const retired = normalizeTestDesignWorkspace(migrated, {
    probes: revisedProbes,
    items: ITEMS,
    now: iso(2),
  });
  assert.equal(retired.activeSprint, undefined);
  assert.deepEqual(retired.drafts, []);
  assert.equal(retired.attempts.length, 3);
  assert.ok(retired.attempts.every((attempt) => attempt.retired === true));
  assert.equal(
    deriveTestDesignState(
      retired.attempts[0].skillId,
      retired,
      revisedProbes,
      { lane: "python", now: iso(2) },
    ).completedAttempts,
    0,
  );
});
