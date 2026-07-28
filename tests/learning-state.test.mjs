import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDebriefToReviewState,
  activityKindFor,
  normalizeLearningEvents,
  upsertLearningEvent,
} from "../app/lib/learning-state.mjs";

function event(overrides = {}) {
  return {
    id: "event-1",
    attemptId: "attempt-1",
    itemId: "python:1",
    itemRevision: 1,
    practiceKind: "solving",
    activityKind: "solve",
    grade: "hard",
    friction: "implementation",
    confidence: 3,
    createdAt: "2026-07-27T12:00:00.000Z",
    promptSnapshot: "Explain the invariant.",
    response: "The map contains values already visited.",
    ...overrides,
  };
}

test("normalizes a linked learning event and bounds learner text", () => {
  const attemptsById = new Map([
    [
      "attempt-1",
      { itemId: "python:1", itemRevision: 1, practiceKind: "solving" },
    ],
  ]);
  const [normalized] = normalizeLearningEvents(
    [event({ confidence: 99, response: `  ${"x".repeat(1200)}  ` })],
    { validItemIds: new Set(["python:1"]), attemptsById },
  );
  assert.equal(normalized.confidence, 5);
  assert.equal(normalized.response.length, 1000);
  assert.equal(normalized.practiceKind, "solving");
  assert.equal(normalized.activityKind, "solve");
});

test("drops empty identifiers, orphan links, invalid enums, and inconsistent modes", () => {
  const attemptsById = new Map([
    [
      "attempt-1",
      { itemId: "python:1", itemRevision: 1, practiceKind: "solving" },
    ],
  ]);
  const invalid = [
    event({ id: "   " }),
    event({ attemptId: "missing" }),
    event({ grade: "perfect" }),
    event({ friction: "typing-speed" }),
    event({ activityKind: "syntax", practiceKind: "solving" }),
    event({ itemRevision: 2 }),
  ];
  assert.deepEqual(
    normalizeLearningEvents(invalid, {
      validItemIds: new Set(["python:1"]),
      attemptsById,
    }),
    [],
  );
});

test("keeps only the latest event per attempt in chronological order", () => {
  const normalized = normalizeLearningEvents([
    event(),
    event({ id: "replacement", grade: "good", createdAt: "2026-07-28T12:00:00.000Z" }),
    event({ id: "other", attemptId: "attempt-2", createdAt: "2026-07-26T12:00:00.000Z" }),
  ]);
  assert.deepEqual(normalized.map((entry) => entry.id), ["other", "replacement"]);
});

test("upsert replaces one attempt without mutating the caller", () => {
  const original = [event()];
  const before = structuredClone(original);
  const updated = upsertLearningEvent(
    original,
    event({ id: "event-1", grade: "easy", friction: "none", response: undefined }),
  );
  assert.deepEqual(original, before);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].grade, "easy");
  assert.equal(updated[0].response, undefined);
});

test("activity kinds keep solving, syntax, and iOS concepts separate", () => {
  assert.equal(activityKindFor({ practiceKind: "solving" }), "solve");
  assert.equal(activityKindFor({ practiceKind: "typing" }), "syntax");
  assert.equal(activityKindFor({ track: "ios", practiceKind: "typing" }), "concept");
});

test("learning history is capped to the newest one thousand events", () => {
  const events = Array.from({ length: 1002 }, (_, index) =>
    event({
      id: `event-${index}`,
      attemptId: `attempt-${index}`,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    }),
  );
  const normalized = normalizeLearningEvents(events);
  assert.equal(normalized.length, 1000);
  assert.equal(normalized[0].id, "event-2");
});

test("shared debrief scheduling accelerates Again and ignores stale events", () => {
  const originalDue = new Date("2026-08-20T12:00:00.000Z");
  const adjusted = applyDebriefToReviewState(
    {
      level: 4,
      dueAt: originalDue,
      lapses: 1,
      lastAttemptAt: Date.parse("2026-07-27T11:00:00.000Z"),
    },
    event({ grade: "again" }),
  );
  assert.equal(adjusted.level, 3);
  assert.equal(adjusted.lapses, 2);
  assert.equal(adjusted.dueAt?.toISOString(), "2026-07-28T12:00:00.000Z");

  const stale = applyDebriefToReviewState(
    {
      level: 4,
      dueAt: originalDue,
      lastAttemptAt: Date.parse("2026-07-28T12:00:00.000Z"),
    },
    event({ grade: "again" }),
  );
  assert.equal(stale.level, 4);
  assert.equal(stale.dueAt?.toISOString(), originalDue.toISOString());
});
