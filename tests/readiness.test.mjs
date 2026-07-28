import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReadinessSummary,
  buildReadinessTimeline,
} from "../app/lib/readiness.mjs";

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

test("concept readiness counts only answer-first Good or Easy evidence", () => {
  const attempts = [
    attempt({
      id: "concept-strong",
      itemId: "ios:arc",
      practiceKind: "concept",
      conceptGrade: "good",
      verification: undefined,
      peeks: 0,
    }),
    attempt({
      id: "concept-assisted",
      itemId: "ios:arc",
      practiceKind: "concept",
      conceptGrade: "easy",
      verification: undefined,
      peeks: 1,
    }),
  ];
  const learningEvents = attempts.map((record, index) =>
    learningEvent({
      id: `concept-event-${index}`,
      attemptId: record.id,
      itemId: "ios:arc",
      activityKind: "concept",
      grade: record.conceptGrade,
    }),
  );
  const summary = buildReadinessSummary({ items, attempts, learningEvents, now });
  assert.deepEqual(summary.conceptRecall, {
    numerator: 1,
    denominator: 2,
    percent: 50,
  });
  assert.equal(summary.strongRetrieval.numerator, 1);
});

test("builds 13 chronological UTC buckets with a partial first bucket", () => {
  const timeline = buildReadinessTimeline({
    items,
    now,
    attempts: [
      attempt({ id: "before", completedAt: "2026-04-28T23:59:59.999Z" }),
      attempt({ id: "first", completedAt: "2026-04-29T00:00:00.000Z" }),
      attempt({ id: "second", completedAt: "2026-05-05T00:00:00.000Z" }),
      attempt({ id: "future", completedAt: "2026-07-27T12:00:00.001Z" }),
    ],
    learningEvents: [],
  });

  assert.equal(timeline.windowDays, 90);
  assert.equal(timeline.startDate, "2026-04-29");
  assert.equal(timeline.endDate, "2026-07-27");
  assert.equal(timeline.buckets.length, 13);
  assert.deepEqual(
    timeline.buckets.map(({ startDate, endDate }) => [startDate, endDate]),
    [
      ["2026-04-29", "2026-05-04"],
      ["2026-05-05", "2026-05-11"],
      ["2026-05-12", "2026-05-18"],
      ["2026-05-19", "2026-05-25"],
      ["2026-05-26", "2026-06-01"],
      ["2026-06-02", "2026-06-08"],
      ["2026-06-09", "2026-06-15"],
      ["2026-06-16", "2026-06-22"],
      ["2026-06-23", "2026-06-29"],
      ["2026-06-30", "2026-07-06"],
      ["2026-07-07", "2026-07-13"],
      ["2026-07-14", "2026-07-20"],
      ["2026-07-21", "2026-07-27"],
    ],
  );
  assert.equal(timeline.buckets[0].completedAttempts, 1);
  assert.equal(timeline.buckets[1].completedAttempts, 1);
  assert.equal(
    timeline.buckets.reduce(
      (total, bucket) => total + bucket.completedAttempts,
      0,
    ),
    2,
  );
});

test("partitions current and previous calendar periods at UTC midnight", () => {
  const timeline = buildReadinessTimeline({
    items,
    now,
    attempts: [
      attempt({ id: "before-previous", completedAt: "2026-05-28T23:59:59.999Z" }),
      attempt({ id: "previous-start", completedAt: "2026-05-29T00:00:00.000Z" }),
      attempt({ id: "previous-end", completedAt: "2026-06-27T23:59:59.999Z" }),
      attempt({ id: "current-start", completedAt: "2026-06-28T00:00:00.000Z" }),
      attempt({ id: "now", completedAt: "2026-07-27T12:00:00.000Z" }),
    ],
    learningEvents: [],
  });

  assert.deepEqual(
    [timeline.previous30.startDate, timeline.previous30.endDate],
    ["2026-05-29", "2026-06-27"],
  );
  assert.deepEqual(
    [timeline.current30.startDate, timeline.current30.endDate],
    ["2026-06-28", "2026-07-27"],
  );
  assert.equal(timeline.previous30.completedAttempts, 2);
  assert.equal(timeline.current30.completedAttempts, 2);
});

test("reports exact lane, solve, retrieval, concept, debrief, and friction evidence", () => {
  const timelineItems = [
    items[0],
    items[1],
    { ...items[2], contentRevision: 2 },
  ];
  const attempts = [
    attempt({ id: "py", durationMs: 600_000 }),
    attempt({
      id: "swift",
      itemId: "builtin:1",
      durationMs: 300_000,
      peeks: 2,
    }),
    attempt({
      id: "ios-strong",
      itemId: "ios:arc",
      itemRevision: 2,
      practiceKind: "concept",
      conceptGrade: "good",
      completedAt: "2026-07-25T12:00:00.000Z",
      durationMs: 420_000,
      verification: undefined,
    }),
    attempt({
      id: "ios-assisted",
      itemId: "ios:arc",
      itemRevision: 2,
      practiceKind: "concept",
      conceptGrade: "easy",
      completedAt: "2026-07-24T12:00:00.000Z",
      durationMs: 180_000,
      peeks: 1,
      verification: undefined,
    }),
    attempt({ id: "failed", outcome: "abandoned", durationMs: 6_000_000 }),
    attempt({ id: "stale", itemId: "ios:arc", itemRevision: 1 }),
    attempt({ id: "future", completedAt: "2026-07-27T13:00:00.000Z" }),
  ];
  const learningEvents = [
    learningEvent({ attemptId: "py", friction: "recognition" }),
    learningEvent({ id: "e-swift", attemptId: "swift", itemId: "builtin:1", grade: "hard", friction: "syntax" }),
    learningEvent({ id: "e-ios-strong", attemptId: "ios-strong", itemId: "ios:arc", itemRevision: 2, activityKind: "concept", grade: "good", friction: "api", createdAt: "2026-07-25T12:01:00.000Z" }),
    learningEvent({ id: "e-ios-assisted", attemptId: "ios-assisted", itemId: "ios:arc", itemRevision: 2, activityKind: "concept", grade: "easy", friction: "syntax", createdAt: "2026-07-24T12:01:00.000Z" }),
    learningEvent({ id: "orphan", attemptId: "missing" }),
    learningEvent({ id: "failed-event", attemptId: "failed" }),
    learningEvent({ id: "stale-event", attemptId: "stale", itemId: "ios:arc", itemRevision: 1 }),
    learningEvent({ id: "future-event", attemptId: "py", createdAt: "2026-07-27T12:00:00.001Z" }),
    learningEvent({ id: "old-event", attemptId: "py", createdAt: "2026-04-28T23:59:59.999Z" }),
  ];
  const current = buildReadinessTimeline({
    items: timelineItems,
    attempts,
    learningEvents,
    now,
  }).current30;

  assert.equal(current.activeDays, 3);
  assert.equal(current.completedAttempts, 4);
  assert.equal(current.minutes, 25);
  assert.deepEqual(current.laneMinutes, { python: 10, swift: 5, ios: 10 });
  assert.deepEqual(
    {
      verifiedSolves: current.verifiedSolves,
      hintFreeSolves: current.hintFreeSolves,
      retrievalEvents: current.retrievalEvents,
      strongRetrieval: current.strongRetrieval,
      conceptAttempts: current.conceptAttempts,
      strongConcept: current.strongConcept,
      debriefedAttempts: current.debriefedAttempts,
    },
    {
      verifiedSolves: 2,
      hintFreeSolves: 1,
      retrievalEvents: 4,
      strongRetrieval: 2,
      conceptAttempts: 2,
      strongConcept: 1,
      debriefedAttempts: 4,
    },
  );
  assert.deepEqual(current.hintFreeSolveRate, {
    numerator: 1,
    denominator: 2,
    percent: 50,
  });
  assert.deepEqual(current.topFriction, {
    category: "syntax",
    count: 2,
    denominator: 4,
  });
});

test("only emits rate deltas with at least three observations in both periods", () => {
  const attempts = [];
  const learningEvents = [];
  for (let index = 0; index < 4; index += 1) {
    const currentId = `current-solve-${index}`;
    const previousId = `previous-solve-${index}`;
    attempts.push(
      attempt({
        id: currentId,
        completedAt: `2026-07-${String(20 + index).padStart(2, "0")}T12:00:00.000Z`,
        peeks: index === 3 ? 1 : 0,
      }),
      attempt({
        id: previousId,
        completedAt: `2026-06-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
        peeks: index === 0 ? 0 : 1,
      }),
    );
    learningEvents.push(
      learningEvent({
        id: `event-${currentId}`,
        attemptId: currentId,
        createdAt: `2026-07-${String(20 + index).padStart(2, "0")}T12:01:00.000Z`,
        grade: index === 3 ? "hard" : "good",
      }),
      learningEvent({
        id: `event-${previousId}`,
        attemptId: previousId,
        createdAt: `2026-06-${String(10 + index).padStart(2, "0")}T12:01:00.000Z`,
        grade: index === 0 ? "good" : "hard",
      }),
    );
  }
  for (let index = 0; index < 3; index += 1) {
    const id = `current-concept-${index}`;
    attempts.push(
      attempt({
        id,
        itemId: "ios:arc",
        practiceKind: "concept",
        conceptGrade: "good",
        verification: undefined,
        completedAt: `2026-07-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
      }),
    );
    learningEvents.push(
      learningEvent({
        id: `event-${id}`,
        attemptId: id,
        itemId: "ios:arc",
        activityKind: "concept",
        grade: "hard",
        createdAt: `2026-07-${String(10 + index).padStart(2, "0")}T12:01:00.000Z`,
      }),
    );
  }
  for (let index = 0; index < 2; index += 1) {
    const id = `previous-concept-${index}`;
    attempts.push(
      attempt({
        id,
        itemId: "ios:arc",
        practiceKind: "concept",
        conceptGrade: "good",
        verification: undefined,
        completedAt: `2026-06-0${index + 1}T12:00:00.000Z`,
      }),
    );
    learningEvents.push(
      learningEvent({
        id: `event-${id}`,
        attemptId: id,
        itemId: "ios:arc",
        activityKind: "concept",
        grade: "hard",
        createdAt: `2026-06-0${index + 1}T12:01:00.000Z`,
      }),
    );
  }

  const timeline = buildReadinessTimeline({ items, attempts, learningEvents, now });
  assert.deepEqual(timeline.current30.hintFreeSolveRate, {
    numerator: 3,
    denominator: 4,
    percent: 75,
  });
  assert.deepEqual(timeline.previous30.hintFreeSolveRate, {
    numerator: 1,
    denominator: 4,
    percent: 25,
  });
  assert.equal(timeline.rateDeltas.hintFreeSolveRate, 50);
  assert.equal(timeline.rateDeltas.strongRetrievalRate, 26);
  assert.equal(timeline.rateDeltas.conceptRecallRate, null);
  assert.equal(timeline.rateDeltas.debriefCoverage, 0);
});

test("returns deterministic empty timeline values without mutating input", () => {
  const source = { items, attempts: [], learningEvents: [], now };
  const before = structuredClone(source);
  const first = buildReadinessTimeline(source);
  const second = buildReadinessTimeline(source);

  assert.deepEqual(first, second);
  assert.equal(first.current30.hintFreeSolveRate.percent, null);
  assert.equal(first.previous30.topFriction.category, null);
  assert.deepEqual(first.rateDeltas, {
    hintFreeSolveRate: null,
    strongRetrievalRate: null,
    conceptRecallRate: null,
    debriefCoverage: null,
  });
  assert.deepEqual(source, before);
});
