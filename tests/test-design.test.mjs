import assert from "node:assert/strict";
import test from "node:test";
import { TEST_DESIGN_PROBES } from "../app/data/test-design-probes.ts";
import {
  TEST_DESIGN_ATTEMPT_LIMIT,
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
const ITEMS = TEST_DESIGN_PROBES.map((probe) => ({itemId:probe.itemId,contentRevision:probe.itemRevision}));
const iso = (days, minutes = 0) => new Date(Date.parse(T0) + days * 86400000 + minutes * 60000).toISOString();
function current(workspace) {
  const entry = workspace.activeSprint.entries[workspace.activeSprint.cursor];
  return TEST_DESIGN_PROBES.find((probe) => probe.id === entry.probeId && probe.revision === entry.probeRevision);
}
function start(workspace, id, now, source = "academy") {
  return startTestDesignSprint(workspace, TEST_DESIGN_PROBES, ITEMS, {id, now, count:3, source});
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
  const restored = normalizeTestDesignWorkspace(JSON.parse(JSON.stringify(workspace)), {probes:TEST_DESIGN_PROBES,items:ITEMS,now:T0});
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

test("overview tracks three test-design skills independently", () => {
  const overview = deriveTestDesignOverview(TEST_DESIGN_PROBES, createTestDesignWorkspace(T0), {now:T0});
  assert.deepEqual({new:overview.newCount,ready:overview.readyCount,total:overview.totalSkills},{new:3,ready:3,total:3});
});
