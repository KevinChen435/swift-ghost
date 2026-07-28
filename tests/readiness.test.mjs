import assert from "node:assert/strict";
import test from "node:test";
import { buildReadinessSummary } from "../app/lib/readiness.mjs";

const now = new Date("2026-07-27T12:00:00.000Z");
const items = [
  { itemId: "python:1", contentRevision: 1, language: "python", track: "interview" },
  { itemId: "builtin:1", contentRevision: 1, language: "swift", track: "interview" },
  { itemId: "ios:arc", contentRevision: 1, language: "swift", track: "ios" },
];

function attempt(overrides = {}) {
  return {
    id: "a1",
    itemId: "python:1",
    itemRevision: 1,
    outcome: "completed",
    practiceKind: "solving",
    completedAt: "2026-07-26T12:00:00.000Z",
    durationMs: 600_000,
    peeks: 0,
    verification: { passed: 3, total: 3 },
    ...overrides,
  };
}

function learningEvent(overrides = {}) {
  return {
    id: "e1",
    attemptId: "a1",
    itemId: "python:1",
    itemRevision: 1,
    grade: "good",
    friction: "recognition",
    createdAt: "2026-07-26T12:05:00.000Z",
    ...overrides,
  };
}

test("summarizes honest current-revision readiness evidence", () => {
  const attempts = [
    attempt(),
    attempt({ id: "a2", peeks: 1 }),
    attempt({ id: "a3", itemId: "builtin:1", practiceKind: "typing", verification: undefined, durationMs: 300_000 }),
    attempt({ id: "a4", itemId: "ios:arc", practiceKind: "typing", verification: undefined, durationMs: 300_000 }),
  ];
  const learningEvents = [
    learningEvent(),
    learningEvent({ id: "e2", attemptId: "a2", grade: "easy", friction: "none" }),
    learningEvent({ id: "e3", attemptId: "a3", grade: "hard", friction: "syntax" }),
  ];
  const summary = buildReadinessSummary({ items, attempts, learningEvents, now, dueCount: 4 });
  assert.deepEqual(summary.hintFreeSolves, { numerator: 1, denominator: 2, percent: 50 });
  assert.deepEqual(summary.strongRetrieval, { numerator: 2, denominator: 3, percent: 67 });
  assert.equal(summary.debriefCoverage.numerator, 3);
  assert.equal(summary.topFriction.category, "recognition");
  assert.deepEqual(summary.trackMix.percent, { python: 67, swift: 17, ios: 16 });
  assert.equal(
    Object.values(summary.trackMix.percent).reduce((sum, value) => sum + value, 0),
    100,
  );
  assert.equal(summary.dueToday, 4);
});

test("excludes stale, old, and failed evidence while keeping completed practice time", () => {
  const summary = buildReadinessSummary({
    items,
    now,
    attempts: [
      attempt({ itemRevision: 2 }),
      attempt({ id: "old", completedAt: "2026-01-01T00:00:00.000Z" }),
      attempt({ id: "failed", outcome: "abandoned" }),
      attempt({ id: "unchecked", verification: { passed: 1, total: 3 } }),
    ],
    learningEvents: [learningEvent({ itemRevision: 2 })],
  });
  assert.equal(summary.hintFreeSolves.denominator, 0);
  assert.equal(summary.strongRetrieval.denominator, 0);
  assert.equal(summary.trackMix.totalMinutes, 10);
});

test("returns stable empty-state values without mutating input", () => {
  const source = { items, attempts: [], learningEvents: [], now };
  const before = structuredClone({ items, attempts: [], learningEvents: [] });
  const summary = buildReadinessSummary(source);
  assert.equal(summary.hintFreeSolves.percent, null);
  assert.equal(summary.topFriction.category, null);
  assert.deepEqual({ items: source.items, attempts: source.attempts, learningEvents: source.learningEvents }, before);
});
