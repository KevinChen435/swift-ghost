import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyPlan } from "../app/lib/planner.mjs";

const now = new Date("2026-07-27T12:00:00.000Z");
const items = [
  { itemId: "python:10001", contentRevision: 1, title: "Warm-up", language: "python", track: "interview", pattern: "Python Fluency", difficulty: "Easy", estimatedMinutes: 4 },
  { itemId: "python:1", contentRevision: 1, title: "Two Sum", language: "python", track: "interview", pattern: "Arrays & Hashing", difficulty: "Easy", estimatedMinutes: 8, verification: { cases: [{}] } },
  { itemId: "python:49", contentRevision: 1, title: "Group Anagrams", language: "python", track: "interview", pattern: "Arrays & Hashing", difficulty: "Medium", estimatedMinutes: 9, verification: { cases: [{}] } },
  { itemId: "builtin:1", contentRevision: 1, title: "Swift Two Sum", language: "swift", track: "interview", pattern: "Arrays & Hashing", difficulty: "Easy", estimatedMinutes: 5 },
  { itemId: "ios:arc", contentRevision: 1, title: "ARC", language: "swift", track: "ios", pattern: "Memory", difficulty: "Medium", estimatedMinutes: 5 },
];

function attempt(overrides = {}) {
  return {
    id: "a",
    itemId: "python:1",
    itemRevision: 1,
    practiceKind: "solving",
    stage: 5,
    outcome: "completed",
    peeks: 0,
    accuracy: 100,
    completedAt: "2026-07-20T12:00:00.000Z",
    verification: { total: 3, passed: 3 },
    ...overrides,
  };
}

test("plans are deterministic and bounded to the requested time", () => {
  const first = buildDailyPlan({ items, attempts: [] }, { now, budgetMinutes: 30 });
  const second = buildDailyPlan({ items, attempts: [] }, { now, budgetMinutes: 30 });
  assert.deepEqual(first, second);
  assert.ok(first.estimatedMinutes <= 30);
  assert.ok(first.entries.length <= 20);
});

test("supports 15, 30, and 45 minute plans without overflowing", () => {
  for (const budgetMinutes of [15, 30, 45]) {
    const plan = buildDailyPlan({ items }, { now, budgetMinutes });
    assert.equal(plan.budgetMinutes, budgetMinutes);
    assert.ok(plan.estimatedMinutes <= budgetMinutes);
    assert.ok(plan.entries.length > 0);
  }
});

test("due evidence is scheduled before new work", () => {
  const plan = buildDailyPlan(
    { items, attempts: [attempt()] },
    { now, budgetMinutes: 30 },
  );
  assert.equal(plan.entries[0].itemId, "python:1");
  assert.match(plan.entries[0].rationale, /due|overdue/i);
});

test("typing success never substitutes for independent solve evidence", () => {
  const typing = attempt({
    practiceKind: "typing",
    verification: undefined,
    stage: 1,
  });
  const plan = buildDailyPlan(
    { items: [items[1]], attempts: [typing] },
    { now, budgetMinutes: 15 },
  );
  assert.equal(plan.entries[0].practiceKind, "solving");
  assert.equal(plan.entries[0].stage, 5);
  assert.match(plan.entries[0].rationale, /No independent passing solve/i);
});

test("current item revisions isolate stale evidence", () => {
  const revised = { ...items[1], contentRevision: 2 };
  const plan = buildDailyPlan(
    { items: [revised], attempts: [attempt()] },
    { now, budgetMinutes: 15 },
  );
  assert.equal(plan.entries[0].itemRevision, 2);
  assert.match(plan.entries[0].rationale, /No independent passing solve/i);
});

test("larger plans include Python solving and iOS maintenance", () => {
  const plan = buildDailyPlan({ items }, { now, budgetMinutes: 45 });
  assert.ok(plan.entries.some((entry) => entry.practiceKind === "solving"));
  assert.ok(plan.entries.some((entry) => entry.activityKind === "concept"));
  assert.ok(plan.laneMinutes.ios > 0);
});

test("overdue work outside the time box is counted as deferred", () => {
  const dueAttempts = [
    attempt(),
    attempt({ id: "b", itemId: "python:49" }),
    attempt({ id: "c", itemId: "builtin:1", practiceKind: "typing", verification: undefined, stage: 5 }),
  ];
  const plan = buildDailyPlan(
    { items, attempts: dueAttempts },
    { now, budgetMinutes: 10, maxItems: 1 },
  );
  assert.equal(plan.entries.length, 1);
  assert.ok(plan.deferredDueCount >= 1);
});

test("empty and malformed inputs return an empty safe plan", () => {
  const plan = buildDailyPlan({ items: [null, {}] }, { now, budgetMinutes: 15 });
  assert.deepEqual(plan.entries, []);
  assert.equal(plan.estimatedMinutes, 0);
});

test("planning does not mutate caller-owned data", () => {
  const sourceItems = structuredClone(items);
  const sourceAttempts = [attempt()];
  const beforeItems = structuredClone(sourceItems);
  const beforeAttempts = structuredClone(sourceAttempts);
  buildDailyPlan({ items: sourceItems, attempts: sourceAttempts }, { now, budgetMinutes: 30 });
  assert.deepEqual(sourceItems, beforeItems);
  assert.deepEqual(sourceAttempts, beforeAttempts);
});
