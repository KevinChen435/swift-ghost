import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDY_PLAN_LIMITS,
  STUDY_PLAN_TEMPLATES,
  activateStudyPlan,
  appendStudyCollectionItems,
  buildNextFocusBlock,
  createStudyCollection,
  createStudyPlan,
  createStudyWorkspace,
  deleteStudyCollection,
  deriveStudyPlanProgress,
  instantiateStudyPlanTemplate,
  linkStudyPlanSession,
  mergeStudyWorkspaces,
  normalizeStudyWorkspace,
  updateStudyCollection,
  updateStudyPlan,
} from "../app/lib/study-plans.mjs";

const items = [
  { itemId: "python:10001", contentRevision: 1, source: "builtin", title: "Loop warm-up", language: "python", track: "interview", pattern: "Python Fluency", difficulty: "Easy", estimatedMinutes: 4 },
  { itemId: "python:1", contentRevision: 2, source: "builtin", title: "Two Sum", language: "python", track: "interview", pattern: "Arrays & Hashing", difficulty: "Easy", estimatedMinutes: 8, verification: { cases: [{}] } },
  { itemId: "python:3", contentRevision: 1, source: "builtin", title: "Window", language: "python", track: "interview", pattern: "Sliding Window", difficulty: "Medium", estimatedMinutes: 9, verification: { cases: [{}] } },
  { itemId: "ios:arc", contentRevision: 2, source: "builtin", title: "ARC", language: "swift", track: "ios", pattern: "Memory Management", difficulty: "Medium", estimatedMinutes: 5, recallChecks: ["a", "b", "c"], conceptAnswers: ["a", "b", "c"] },
];

const at = "2026-07-28T12:00:00.000Z";

function attempt(overrides = {}) {
  return {
    id: "attempt-1",
    itemId: "python:1",
    itemRevision: 2,
    practiceKind: "solving",
    stage: 5,
    outcome: "completed",
    peeks: 0,
    accuracy: 100,
    completedAt: "2026-07-20T12:00:00.000Z",
    verification: { total: 4, passed: 4 },
    ...overrides,
  };
}

function fixedPlan() {
  let workspace = createStudyWorkspace(at);
  workspace = createStudyCollection(
    workspace,
    { title: "Core", description: "Core evidence", itemIds: ["python:1", "ios:arc"] },
    { id: "collection:core", now: at },
  );
  workspace = createStudyPlan(
    workspace,
    { collectionId: "collection:core", title: "Core plan", paceMinutes: 30 },
    { id: "plan:core", now: at },
  );
  return workspace;
}

test("ships four evidence-based plan templates with the recommended reactivation plan first", () => {
  assert.equal(STUDY_PLAN_TEMPLATES.length, 4);
  assert.equal(STUDY_PLAN_TEMPLATES[0].id, "back-to-interview-shape");
  assert.equal(STUDY_PLAN_TEMPLATES[0].recommended, true);
  assert.ok(STUDY_PLAN_TEMPLATES.some((entry) => entry.id === "swift-ios-reactivation"));
});

test("instantiating a template snapshots current catalog membership and activates one plan", () => {
  const workspace = instantiateStudyPlanTemplate(
    createStudyWorkspace(at),
    "back-to-interview-shape",
    items,
    { collectionId: "collection:shape", planId: "plan:shape", paceMinutes: 45, now: at },
  );
  assert.equal(workspace.activePlanId, "plan:shape");
  assert.equal(workspace.plans[0].paceMinutes, 45);
  assert.deepEqual(workspace.collections[0].itemIds, items.map((item) => item.itemId));
  assert.ok(workspace.plans[0].collectionSnapshot.modules.length >= 3);
});

test("guided typing is exposure and cannot satisfy independent plan evidence", () => {
  const workspace = fixedPlan();
  const progress = deriveStudyPlanProgress(workspace.plans[0], workspace, {
    items,
    attempts: [attempt({ practiceKind: "typing", stage: 1, verification: undefined })],
    interviewStudioHistory: [],
    sessionHistory: [],
    now: at,
  });
  assert.equal(progress.evidence.independent, 0);
  assert.equal(progress.evidence.assisted, 1);
  assert.equal(progress.curriculumComplete, false);
});

test("verified Python and committed Good iOS concept attempts count in separate honest evidence", () => {
  const workspace = fixedPlan();
  const progress = deriveStudyPlanProgress(workspace.plans[0], workspace, {
    items,
    attempts: [
      attempt(),
      attempt({ id: "ios-good", itemId: "ios:arc", itemRevision: 2, practiceKind: "concept", stage: 5, verification: undefined, conceptGrade: "good" }),
    ],
    interviewStudioHistory: [],
    sessionHistory: [],
    now: at,
  });
  assert.equal(progress.evidence.independent, 2);
  assert.equal(progress.evidence.assisted, 0);
});

test("stale revisions are preserved as outdated but do not satisfy current evidence", () => {
  const workspace = fixedPlan();
  const progress = deriveStudyPlanProgress(workspace.plans[0], workspace, {
    items,
    attempts: [attempt({ itemRevision: 1 })],
    interviewStudioHistory: [],
    sessionHistory: [],
    now: at,
  });
  assert.equal(progress.evidence.outdated, 1);
  assert.equal(progress.evidence.independent, 0);
});

test("coach Studio never satisfies a mock capstone while a hint-free passing mock does", () => {
  let workspace = instantiateStudyPlanTemplate(
    createStudyWorkspace(at),
    "interview-simulation",
    items,
    { collectionId: "collection:sim", planId: "plan:sim", now: at },
  );
  workspace = updateStudyPlan(workspace, "plan:sim", { studioSessionIds: ["coach", "mock"] }, { now: "2026-07-28T12:01:00.000Z" });
  const base = {
    version: 1,
    format: "python-coding",
    itemId: "python:1",
    itemRevision: 2,
    startedAt: "2026-07-28T10:00:00.000Z",
    updatedAt: "2026-07-28T10:45:00.000Z",
    completedAt: "2026-07-28T10:45:00.000Z",
    phase: "completed",
    outcome: "completed",
    script: {},
    transcript: [],
    runnerEvents: [{ status: "passed", passed: 4, total: 4 }],
  };
  const coached = deriveStudyPlanProgress(workspace.plans[0], workspace, {
    items,
    attempts: [],
    interviewStudioHistory: [{ ...base, id: "coach", mode: "coach" }],
    sessionHistory: [],
    now: at,
  });
  assert.equal(coached.capstone.completed, false);
  const mocked = deriveStudyPlanProgress(workspace.plans[0], workspace, {
    items,
    attempts: [],
    interviewStudioHistory: [{ ...base, id: "mock", mode: "mock" }],
    sessionHistory: [],
    now: at,
  });
  assert.equal(mocked.capstone.completed, true);
});

test("next focus blocks prioritize due work and stay inside the selected time box", () => {
  let workspace = instantiateStudyPlanTemplate(
    createStudyWorkspace(at),
    "python-reentry",
    items,
    { collectionId: "collection:python", planId: "plan:python", now: at },
  );
  const block = buildNextFocusBlock(workspace.plans[0], workspace, {
    items,
    attempts: [attempt()],
    learningEvents: [],
    interviewStudioHistory: [],
    sessionHistory: [],
    now: at,
  }, { now: at, budgetMinutes: 15 });
  assert.ok(block.estimatedMinutes <= 15);
  assert.equal(block.entries[0].itemId, "python:1");
  assert.match(block.entries[0].rationale, /due|overdue/i);
});

test("editing or deleting a collection never silently mutates an enrolled plan snapshot", () => {
  let workspace = fixedPlan();
  const before = structuredClone(workspace.plans[0].collectionSnapshot);
  workspace = updateStudyCollection(workspace, "collection:core", { title: "Changed", itemIds: ["python:3"] }, { now: "2026-07-29T12:00:00.000Z" });
  assert.deepEqual(workspace.plans[0].collectionSnapshot, before);
  workspace = deleteStudyCollection(workspace, "collection:core", { now: "2026-07-30T12:00:00.000Z" });
  assert.deepEqual(workspace.plans[0].collectionSnapshot, before);
});

test("appending collection items preserves order, dedupes normalized IDs, and is immutable", () => {
  const original = createStudyCollection(
    createStudyWorkspace(at),
    {
      title: "Scoped",
      itemIds: ["python:1"],
      modules: [{ id: "core", title: "Core", outcome: "Prove the core.", itemIds: ["python:1"] }],
    },
    { id: "collection:append", now: at },
  );
  const originalSnapshot = structuredClone(original);
  const originalCollection = original.collections[0];
  const nextAt = "2026-07-28T13:00:00.000Z";
  const appended = appendStudyCollectionItems(
    original,
    "collection:append",
    ["python:3", "python:1", "python:3", " bad ", " ios:arc "],
    { now: nextAt },
  );

  assert.deepEqual(original, originalSnapshot);
  assert.notStrictEqual(appended, original);
  assert.notStrictEqual(appended.collections, original.collections);
  assert.deepEqual(appended.collections[0].itemIds, ["python:1", "python:3", "ios:arc"]);
  assert.equal(appended.revision, original.revision + 1);
  assert.equal(appended.updatedAt, nextAt);
  assert.equal(appended.collections[0].revision, originalCollection.revision + 1);
  assert.equal(appended.collections[0].updatedAt, nextAt);
  assert.strictEqual(appended.collections[0].modules, originalCollection.modules);
  assert.strictEqual(appended.plans, original.plans);
});

test("collection append accepts exact capacity and rejects overflow atomically", () => {
  const startingIds = Array.from({ length: STUDY_PLAN_LIMITS.maxItemsPerCollection - 1 }, (_, index) => `python:${index + 1}`);
  const original = createStudyCollection(
    createStudyWorkspace(at),
    { title: "Nearly full", itemIds: startingIds },
    { id: "collection:capacity", now: at },
  );
  const exact = appendStudyCollectionItems(
    original,
    "collection:capacity",
    ["python:999"],
    { now: "2026-07-28T13:00:00.000Z" },
  );
  assert.equal(exact.collections[0].itemIds.length, STUDY_PLAN_LIMITS.maxItemsPerCollection);
  assert.equal(exact.collections[0].itemIds.at(-1), "python:999");

  const exactSnapshot = structuredClone(exact);
  const overflow = appendStudyCollectionItems(
    exact,
    "collection:capacity",
    ["python:1000", "python:1001"],
    { now: "2026-07-28T14:00:00.000Z" },
  );
  assert.strictEqual(overflow, exact);
  assert.deepEqual(overflow, exactSnapshot);
});

test("invalid, duplicate-only, and missing collection appends are exact no-ops", () => {
  const workspace = fixedPlan();
  assert.strictEqual(
    appendStudyCollectionItems(workspace, "collection:core", ["", "not-an-item", "python:1"], { now: "2026-07-29T12:00:00.000Z" }),
    workspace,
  );
  assert.strictEqual(
    appendStudyCollectionItems(workspace, "collection:missing", ["python:3"], { now: "2026-07-29T12:00:00.000Z" }),
    workspace,
  );
});

test("collection appends preserve enrolled snapshots while later plans snapshot additions", () => {
  const original = fixedPlan();
  const enrolledSnapshot = structuredClone(original.plans[0].collectionSnapshot);
  const appended = appendStudyCollectionItems(
    original,
    "collection:core",
    ["python:3"],
    { now: "2026-07-29T12:00:00.000Z" },
  );
  assert.deepEqual(appended.plans[0].collectionSnapshot, enrolledSnapshot);
  assert.strictEqual(appended.plans[0], original.plans[0]);

  const withLaterPlan = createStudyPlan(
    appended,
    { collectionId: "collection:core", title: "Later plan", status: "paused" },
    { id: "plan:later", now: "2026-07-29T13:00:00.000Z" },
  );
  assert.deepEqual(
    withLaterPlan.plans.find((plan) => plan.id === "plan:later").collectionSnapshot.itemIds,
    ["python:1", "ios:arc", "python:3"],
  );
});

test("derived module scope ignores removed IDs and schedules unassigned collection additions", () => {
  let workspace = createStudyCollection(
    createStudyWorkspace(at),
    {
      title: "Re-scoped",
      itemIds: ["python:3"],
      modules: [{ id: "collection-additions", title: "Removed", outcome: "Historical scope.", itemIds: ["python:1"] }],
    },
    { id: "collection:rescoped", now: at },
  );
  workspace = createStudyPlan(
    workspace,
    { collectionId: "collection:rescoped", title: "Re-scoped plan" },
    { id: "plan:rescoped", now: at },
  );
  const evidence = {
    items,
    attempts: [],
    learningEvents: [],
    interviewStudioHistory: [],
    sessionHistory: [],
    now: at,
  };
  const progress = deriveStudyPlanProgress(workspace.plans[0], workspace, evidence);
  assert.deepEqual(progress.modules.map((module) => ({ id: module.id, itemIds: module.itemIds, evidenceMet: module.evidenceMet })), [
    { id: "authored-collection-additions-1", itemIds: [], evidenceMet: true },
    { id: "collection-additions", itemIds: ["python:3"], evidenceMet: false },
  ]);
  assert.equal(new Set(progress.modules.map((module) => module.id)).size, progress.modules.length);
  assert.equal(progress.currentModule.id, "collection-additions");
  assert.deepEqual(workspace.plans[0].collectionSnapshot.modules[0], {
    id: "collection-additions",
    title: "Removed",
    outcome: "Historical scope.",
    itemIds: ["python:1"],
    patterns: [],
  });

  const block = buildNextFocusBlock(workspace.plans[0], workspace, evidence, { now: at, budgetMinutes: 30 });
  assert.ok(block.entries.length > 0);
  assert.ok(block.entries.every((entry) => entry.itemId === "python:3"));
});

test("workspace merge is per-entity last-write-wins and tombstones prevent resurrection", () => {
  const original = fixedPlan();
  const renamed = updateStudyCollection(original, "collection:core", { title: "Newer title" }, { now: "2026-07-29T12:00:00.000Z" });
  const deleted = deleteStudyCollection(original, "collection:core", { now: "2026-07-30T12:00:00.000Z" });
  const merged = mergeStudyWorkspaces(renamed, deleted, { now: "2026-07-31T12:00:00.000Z" });
  assert.equal(merged.collections.length, 0);
  assert.equal(merged.tombstones[0].entity, "collection");
});

test("normalization bounds malformed imports and enforces a single active plan", () => {
  const workspace = normalizeStudyWorkspace({
    version: 1,
    revision: -99,
    activePlanId: "plan:one",
    collections: [{ id: "collection:one", title: "x".repeat(200), itemIds: ["python:1", "python:1", "bad"] }],
    plans: [
      { id: "plan:one", collectionId: "collection:one", title: "One", status: "active" },
      { id: "plan:two", collectionId: "collection:one", title: "Two", status: "active" },
    ],
  }, { now: at });
  assert.equal(workspace.revision, 0);
  assert.equal(workspace.collections[0].title.length, 80);
  assert.deepEqual(workspace.collections[0].itemIds, ["python:1"]);
  assert.equal(workspace.plans.filter((plan) => plan.status === "active").length, 1);
  assert.equal(workspace.activePlanId, "plan:one");
});

test("activating another plan pauses the previous active plan", () => {
  let workspace = fixedPlan();
  workspace = createStudyPlan(workspace, { collectionId: "collection:core", title: "Second", paceMinutes: 15, status: "paused" }, { id: "plan:two", now: "2026-07-28T12:01:00.000Z" });
  workspace = activateStudyPlan(workspace, "plan:two", { now: "2026-07-28T12:02:00.000Z" });
  assert.equal(workspace.activePlanId, "plan:two");
  assert.equal(workspace.plans.find((plan) => plan.id === "plan:core").status, "paused");
});

test("template enrollment refuses full workspaces without evicting saved data", () => {
  let collectionFull = createStudyWorkspace(at);
  for (let index = 0; index < 50; index += 1) {
    collectionFull = createStudyCollection(
      collectionFull,
      { title: `Collection ${index}`, itemIds: ["python:1"] },
      { id: `collection:${index}`, now: new Date(Date.parse(at) + index).toISOString() },
    );
  }
  const collectionSnapshot = structuredClone(collectionFull);
  assert.deepEqual(
    instantiateStudyPlanTemplate(collectionFull, "python-reentry", items, { now: "2026-07-29T12:00:00.000Z" }),
    collectionSnapshot,
  );
  const appendedAtWorkspaceCapacity = appendStudyCollectionItems(
    collectionFull,
    "collection:0",
    ["python:3"],
    { now: "2026-07-29T12:00:00.000Z" },
  );
  assert.equal(appendedAtWorkspaceCapacity.collections.length, STUDY_PLAN_LIMITS.maxCollections);
  assert.deepEqual(appendedAtWorkspaceCapacity.collections[0].itemIds, ["python:1", "python:3"]);

  let planFull = fixedPlan();
  for (let index = 1; index < 50; index += 1) {
    planFull = createStudyPlan(
      planFull,
      { collectionId: "collection:core", title: `Plan ${index}`, paceMinutes: 15 },
      { id: `plan:${index}`, now: new Date(Date.parse(at) + index).toISOString() },
    );
  }
  const planSnapshot = structuredClone(planFull);
  assert.deepEqual(
    instantiateStudyPlanTemplate(planFull, "python-reentry", items, { now: "2026-07-29T12:00:00.000Z" }),
    planSnapshot,
  );
});

test("session links merge without overwriting a newer scalar plan edit", () => {
  const original = fixedPlan();
  const renamed = updateStudyPlan(
    original,
    "plan:core",
    { title: "Renamed on device A" },
    { now: "2026-07-28T12:01:00.000Z" },
  );
  const linked = linkStudyPlanSession(
    original,
    "plan:core",
    "session:device-b",
    "focus",
    { now: "2026-07-28T12:02:00.000Z" },
  );
  const merged = mergeStudyWorkspaces(renamed, linked, {
    now: "2026-07-28T12:03:00.000Z",
  });
  assert.equal(merged.plans[0].title, "Renamed on device A");
  assert.deepEqual(merged.plans[0].sessionIds, ["session:device-b"]);
});

test("merging identical snapshots is a no-op without revision churn", () => {
  const workspace = fixedPlan();
  const merged = mergeStudyWorkspaces(workspace, structuredClone(workspace), {
    now: "2026-07-29T12:00:00.000Z",
  });
  assert.deepEqual(merged, workspace);
});

test("new work stays in the earliest incomplete module", () => {
  const workspace = instantiateStudyPlanTemplate(
    createStudyWorkspace(at),
    "python-reentry",
    items,
    { collectionId: "collection:scope", planId: "plan:scope", now: at },
  );
  const block = buildNextFocusBlock(
    workspace.plans[0],
    workspace,
    {
      items,
      attempts: [],
      learningEvents: [],
      interviewStudioHistory: [],
      sessionHistory: [],
      now: at,
    },
    { now: at, budgetMinutes: 30 },
  );
  assert.ok(block.entries.length > 0);
  assert.ok(block.entries.every((entry) => entry.itemId === "python:10001"));
});
