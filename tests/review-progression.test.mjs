import assert from "node:assert/strict";
import test from "node:test";
import {
  REVIEW_INTERVAL_DAYS,
  deriveReviewProgression,
} from "../app/lib/review-progression.mjs";

const itemId = "python:canonical";
const day = (value, hour = 12) =>
  `2026-07-${String(value).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;

function solve(id, completedAt, overrides = {}) {
  return {
    id,
    itemId,
    itemRevision: 2,
    practiceKind: "solving",
    outcome: "completed",
    qualification: "independent",
    peeks: 0,
    verification: { passed: 4, total: 4 },
    completedAt,
    ...overrides,
  };
}

function derive(attempts, now, events = []) {
  return deriveReviewProgression(attempts, {
    itemId,
    itemRevision: 2,
    activityKind: "solve",
    events,
    now,
  });
}

test("publishes the canonical 1/3/7/14/30 day intervals", () => {
  assert.deepEqual(REVIEW_INTERVAL_DAYS, [1, 3, 7, 14, 30]);
  assert.equal(Object.isFrozen(REVIEW_INTERVAL_DAYS), true);
});

test("first clean acquisition schedules tomorrow and massed clean retries do not inflate cadence", () => {
  const attempts = [
    solve("acquire", day(1)),
    solve("same-day", day(1, 13)),
    solve("early", day(2, 11)),
  ];
  const state = derive(attempts, day(2, 11));
  assert.equal(state.level, 1);
  assert.equal(state.dueAt, day(2));
  assert.equal(state.due, false);
  assert.equal(state.successes, 1);
  assert.deepEqual(state.evidenceAttemptIds, ["acquire"]);
});

test("clean due retrievals advance through the canonical delayed intervals", () => {
  const attempts = [
    solve("acquire", day(1)),
    solve("review-1", day(2)),
    solve("review-2", day(5)),
    solve("review-3", day(12)),
  ];
  const state = derive(attempts, day(26));
  assert.equal(state.level, 4);
  assert.equal(state.dueAt, day(26));
  assert.equal(state.due, true);
  assert.equal(state.successes, 4);
  assert.equal(state.lastReviewAttemptId, "review-3");
});

test("failure, abandonment, peeking, and explicit assistance lapse to tomorrow", () => {
  const failures = [
    solve("failed", day(2), { verification: { passed: 3, total: 4 } }),
    solve("abandoned", day(2), { outcome: "abandoned" }),
    solve("peeked", day(2), { peeks: 1 }),
    solve("assisted", day(2), { qualification: "assisted" }),
  ];
  for (const failure of failures) {
    const state = derive([solve("acquire", day(1)), failure], day(2));
    assert.equal(state.level, 0, failure.id);
    assert.equal(state.dueAt, day(3), failure.id);
    assert.equal(state.lapses, 1, failure.id);
  }
});

test("the first clean due retrieval after a lapse restarts at the one-day interval", () => {
  const state = derive(
    [
      solve("acquire", day(1)),
      solve("lapse", day(2), { qualification: "assisted", peeks: 1 }),
      solve("restore", day(3)),
    ],
    day(3),
  );
  assert.equal(state.level, 1);
  assert.equal(state.dueAt, day(4));
  assert.equal(state.lapses, 1);
  assert.deepEqual(state.evidenceAttemptIds, ["acquire", "restore"]);
});

test("debrief grades adjust only gate-eligible retrievals", () => {
  const attempts = [
    solve("acquire", day(1)),
    solve("early", day(1, 13)),
    solve("due", day(2)),
  ];
  const events = [
    {
      id: "early-easy",
      attemptId: "early",
      itemId,
      itemRevision: 2,
      activityKind: "solve",
      grade: "easy",
      createdAt: day(1, 13),
    },
    {
      id: "due-hard",
      attemptId: "due",
      itemId,
      itemRevision: 2,
      activityKind: "solve",
      grade: "hard",
      createdAt: day(2),
    },
  ];
  const state = derive(attempts, day(2), events);
  assert.equal(state.level, 1);
  assert.equal(state.dueAt, day(3));
  assert.equal(state.successes, 2);
});

test("an early Again debrief cannot move or reset the existing gate", () => {
  const attempts = [
    solve("acquire", day(1)),
    solve("early", day(1, 13)),
  ];
  const state = derive(attempts, day(1, 13), [
    {
      id: "early-again",
      attemptId: "early",
      itemId,
      itemRevision: 2,
      activityKind: "solve",
      grade: "again",
      createdAt: day(1, 13),
    },
  ]);
  assert.equal(state.level, 1);
  assert.equal(state.dueAt, day(2));
  assert.equal(state.lapses, 0);
  assert.deepEqual(state.evidenceAttemptIds, ["acquire"]);
});

test("Again debriefs lapse a nominally clean attempt and revisions stay isolated", () => {
  const attempt = solve("due", day(2));
  const state = derive(
    [solve("stale", day(1), { itemRevision: 1 }), attempt],
    day(2),
    [
      {
        id: "again",
        attemptId: "due",
        itemId,
        itemRevision: 2,
        activityKind: "solve",
        grade: "again",
        createdAt: day(2),
      },
    ],
  );
  assert.equal(state.level, 0);
  assert.equal(state.dueAt, day(3));
  assert.equal(state.successes, 0);
  assert.deepEqual(state.lapseAttemptIds, ["due"]);
});

test("clean concept acquisition uses the same scheduler", () => {
  const attempt = {
    id: "concept",
    itemId: "ios:arc",
    itemRevision: 4,
    practiceKind: "concept",
    outcome: "completed",
    qualification: "independent",
    peeks: 0,
    conceptGrade: "good",
    completedAt: day(1),
  };
  const state = deriveReviewProgression([attempt], {
    itemId: "ios:arc",
    itemRevision: 4,
    activityKind: "concept",
    now: day(2),
  });
  assert.equal(state.level, 1);
  assert.equal(state.dueAt, day(2));
  assert.equal(state.due, true);
});

test("malformed or missing now values never make scheduled work spuriously due", () => {
  const attempt = solve("acquire", day(1));
  assert.equal(derive([attempt], "not-a-date").due, false);
  assert.equal(derive([attempt], undefined).due, false);
  assert.equal(derive([attempt], Number.NaN).due, false);
});
