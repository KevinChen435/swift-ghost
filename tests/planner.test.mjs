import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyPlan } from "../app/lib/planner.mjs";

const now = new Date("2026-07-27T12:00:00.000Z");
const items = [
  { itemId: "python:10001", contentRevision: 1, title: "Warm-up", language: "python", track: "interview", pattern: "Python Fluency", difficulty: "Easy", estimatedMinutes: 4 },
  { itemId: "python:1", contentRevision: 1, title: "Two Sum", language: "python", track: "interview", pattern: "Arrays & Hashing", difficulty: "Easy", estimatedMinutes: 8, verification: { cases: [{}] } },
  { itemId: "python:49", contentRevision: 1, title: "Group Anagrams", language: "python", track: "interview", pattern: "Arrays & Hashing", difficulty: "Medium", estimatedMinutes: 9, verification: { cases: [{}] } },
  { itemId: "builtin:1", contentRevision: 1, title: "Swift Two Sum", language: "swift", track: "interview", pattern: "Arrays & Hashing", difficulty: "Easy", estimatedMinutes: 5 },
  { itemId: "ios:arc", contentRevision: 1, title: "ARC", language: "swift", track: "ios", pattern: "Memory", difficulty: "Medium", estimatedMinutes: 5, recallChecks: ["one", "two", "three"], conceptAnswers: ["a", "b", "c"] },
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

test("guided typing stays in the learning ladder and never becomes a due review", () => {
  const guided = [
    attempt({
      id: "worked",
      itemId: "builtin:1",
      practiceKind: "typing",
      verification: undefined,
      stage: 1,
      qualification: "syntax",
      corrections: 0,
    }),
    attempt({
      id: "skipped-fade",
      itemId: "builtin:1",
      practiceKind: "typing",
      verification: undefined,
      stage: 3,
      qualification: "guided",
      corrections: 0,
      completedAt: "2026-07-20T13:00:00.000Z",
    }),
  ];
  const plan = buildDailyPlan(
    { items: [items[3]], attempts: guided },
    { now, budgetMinutes: 15 },
  );

  assert.equal(plan.entries[0].stage, 4);
  assert.doesNotMatch(plan.entries[0].rationale, /due|overdue/i);
  assert.match(plan.entries[0].rationale, /clean learning step/i);
});

test("a direct blank-editor diagnostic is remediated without being mislabeled due", () => {
  const diagnostic = attempt({
    id: "diagnostic",
    itemId: "builtin:1",
    practiceKind: "typing",
    verification: undefined,
    stage: 5,
    qualification: "independent",
    corrections: 0,
  });
  const plan = buildDailyPlan(
    { items: [items[3]], attempts: [diagnostic] },
    { now, budgetMinutes: 15 },
  );

  assert.equal(plan.entries[0].stage, 1);
  assert.doesNotMatch(plan.entries[0].rationale, /due|overdue/i);
  assert.match(plan.entries[0].rationale, /diagnostic/i);
});

test("only an ordered blank recall establishes a due typing review", () => {
  const ordered = [
    attempt({
      id: "worked",
      itemId: "builtin:1",
      practiceKind: "typing",
      verification: undefined,
      stage: 1,
      qualification: "syntax",
      corrections: 0,
    }),
    attempt({
      id: "faded",
      itemId: "builtin:1",
      practiceKind: "typing",
      verification: undefined,
      stage: 2,
      qualification: "guided",
      corrections: 0,
      completedAt: "2026-07-20T13:00:00.000Z",
    }),
    attempt({
      id: "recall",
      itemId: "builtin:1",
      practiceKind: "typing",
      verification: undefined,
      stage: 5,
      qualification: "independent",
      corrections: 2,
      completedAt: "2026-07-20T14:00:00.000Z",
    }),
  ];
  const plan = buildDailyPlan(
    { items: [items[3]], attempts: ordered },
    { now, budgetMinutes: 15 },
  );

  assert.equal(plan.entries[0].stage, 5);
  assert.match(plan.entries[0].rationale, /due|overdue/i);
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

test("an Again debrief returns the matching competence sooner", () => {
  const repeatedSuccesses = [
    attempt({ id: "a1", completedAt: "2026-07-01T12:00:00.000Z" }),
    attempt({ id: "a2", completedAt: "2026-07-04T12:00:00.000Z" }),
    attempt({ id: "a3", completedAt: "2026-07-11T12:00:00.000Z" }),
  ];
  const learningEvents = [
    {
      id: "event-a3",
      attemptId: "a3",
      itemId: "python:1",
      itemRevision: 1,
      practiceKind: "solving",
      activityKind: "solve",
      grade: "again",
      friction: "recognition",
      confidence: 2,
      createdAt: "2026-07-19T12:00:00.000Z",
    },
  ];
  const plan = buildDailyPlan(
    { items: [items[1]], attempts: repeatedSuccesses, learningEvents },
    { now: new Date("2026-07-21T12:00:00.000Z"), budgetMinutes: 15 },
  );
  assert.match(plan.entries[0].rationale, /due|Again|recognition/i);
});

test("massed clean solves preserve the acquisition gate until tomorrow", () => {
  const attempts = [
    attempt({ id: "acquire", completedAt: "2026-07-27T12:00:00.000Z" }),
    attempt({ id: "massed", completedAt: "2026-07-27T13:00:00.000Z" }),
  ];
  const early = buildDailyPlan(
    { items: [items[1]], attempts },
    { now: "2026-07-27T14:00:00.000Z", budgetMinutes: 15 },
  );
  assert.equal(early.entries[0].lane, "interview");
  assert.doesNotMatch(early.entries[0].rationale, /evidence is due/i);

  const due = buildDailyPlan(
    { items: [items[1]], attempts },
    { now: "2026-07-28T12:00:00.000Z", budgetMinutes: 15 },
  );
  assert.equal(due.entries[0].lane, "review");
  assert.match(due.entries[0].rationale, /evidence is due/i);
});

test("an assisted solve lapses canonical review cadence to tomorrow", () => {
  const plan = buildDailyPlan(
    {
      items: [items[1]],
      attempts: [
        attempt({ id: "acquire", completedAt: "2026-07-20T12:00:00.000Z" }),
        attempt({
          id: "assisted",
          completedAt: "2026-07-27T12:00:00.000Z",
          qualification: "assisted",
          peeks: 1,
        }),
      ],
    },
    { now: "2026-07-27T18:00:00.000Z", budgetMinutes: 15 },
  );
  assert.equal(plan.entries[0].lane, "interview");

  const due = buildDailyPlan(
    {
      items: [items[1]],
      attempts: [
        attempt({ id: "acquire", completedAt: "2026-07-20T12:00:00.000Z" }),
        attempt({
          id: "assisted",
          completedAt: "2026-07-27T12:00:00.000Z",
          qualification: "assisted",
          peeks: 1,
        }),
      ],
    },
    { now: "2026-07-28T12:00:00.000Z", budgetMinutes: 15 },
  );
  assert.equal(due.entries[0].lane, "review");
});

test("iOS coaching emits first-class concept practice", () => {
  const item = items.find((candidate) => candidate.track === "ios");
  assert.ok(item);
  const plan = buildDailyPlan({
    items: [item],
    attempts: [],
    learningEvents: [],
    profile: { iosShare: 1, pythonShare: 0, reviewShare: 0 },
    now: "2026-07-27T12:00:00.000Z",
    budgetMinutes: 15,
  });
  assert.equal(plan.tasks[0]?.activityKind, "concept");
  assert.equal(plan.tasks[0]?.practiceKind, "concept");
});

test("requested shares are normalized instead of treated as percentages", () => {
  const decimal = buildDailyPlan(
    {
      items,
      profile: { pythonShare: 0.8, reviewShare: 0, iosShare: 0.2 },
      recentLaneMinutes: { python: 20, ios: 5 },
    },
    { now, budgetMinutes: 15 },
  );
  const whole = buildDailyPlan(
    {
      items,
      profile: { pythonShare: 80, reviewShare: 0, iosShare: 20 },
      recentLaneMinutes: { python: 20, ios: 5 },
    },
    { now, budgetMinutes: 15 },
  );
  assert.deepEqual(whole, decimal);
});

test("rolling allocation approaches a 20 percent iOS share without forcing it into every block", () => {
  const recentLaneMinutes = [];
  const blocks = [];
  for (let index = 0; index < 10; index += 1) {
    const plan = buildDailyPlan(
      {
        items,
        profile: { pythonShare: 0.8, reviewShare: 0, iosShare: 0.2 },
        recentLaneMinutes,
      },
      { now, budgetMinutes: 15 },
    );
    blocks.push(plan);
    recentLaneMinutes.push(plan.laneMinutes);
  }
  const totalMinutes = blocks.reduce(
    (sum, plan) => sum + plan.estimatedMinutes,
    0,
  );
  const iosMinutes = blocks.reduce(
    (sum, plan) => sum + plan.laneMinutes.ios,
    0,
  );
  const iosBlocks = blocks.filter((plan) => plan.laneMinutes.ios > 0).length;
  assert.ok(iosMinutes / totalMinutes >= 0.18);
  assert.ok(iosMinutes / totalMinutes <= 0.22);
  assert.ok(iosBlocks > 0);
  assert.ok(iosBlocks < blocks.length);
});

test("recent plan wrappers and direct lane-minute records aggregate identically", () => {
  const direct = buildDailyPlan(
    {
      items,
      profile: { pythonShare: 0.8, reviewShare: 0, iosShare: 0.2 },
      recentLaneMinutes: [
        { python: 8, interview: 4, ios: 5 },
        { python: 8, ios: 0 },
      ],
    },
    { now, budgetMinutes: 15 },
  );
  const wrapped = buildDailyPlan(
    {
      items,
      profile: { pythonShare: 0.8, reviewShare: 0, iosShare: 0.2 },
      recentLaneMinutes: [
        { laneMinutes: { python: 8, interview: 4, ios: 5 } },
        { laneMinutes: { python: 8, ios: 0 } },
      ],
    },
    { now, budgetMinutes: 15 },
  );
  assert.deepEqual(wrapped, direct);
});

test("due reviews remain ahead of allocation targets and respect item limits", () => {
  const plan = buildDailyPlan(
    {
      items,
      attempts: [attempt()],
      profile: { pythonShare: 1, reviewShare: 0, iosShare: 0 },
      recentLaneMinutes: { python: 100, review: 0, ios: 0 },
    },
    { now, budgetMinutes: 30, maxItems: 1 },
  );
  assert.equal(plan.entries.length, 1);
  assert.equal(plan.entries[0].itemId, "python:1");
  assert.equal(plan.laneMinutes.review, plan.entries[0].estimatedMinutes);
  assert.equal(plan.deferredDueCount, 0);
});

test("a due review larger than the block is time-boxed instead of displaced by new work", () => {
  const plan = buildDailyPlan(
    {
      items,
      attempts: [attempt()],
      profile: { pythonShare: 0.8, reviewShare: 0, iosShare: 0.2 },
    },
    { now, budgetMinutes: 5 },
  );
  assert.equal(plan.entries.length, 1);
  assert.equal(plan.entries[0].itemId, "python:1");
  assert.equal(plan.entries[0].estimatedMinutes, 5);
  assert.equal(plan.laneMinutes.review, 5);
});

test("rolling allocation remains deterministic, time bounded, and item bounded", () => {
  const input = {
    items,
    profile: { pythonShare: 6, reviewShare: 2, iosShare: 2 },
    recentLaneMinutes: [{ interview: 60, python: 20, review: 15, ios: 5 }],
  };
  const options = { now, budgetMinutes: 15, maxItems: 2 };
  const first = buildDailyPlan(input, options);
  const second = buildDailyPlan(input, options);
  assert.deepEqual(first, second);
  assert.ok(first.estimatedMinutes <= options.budgetMinutes);
  assert.ok(first.entries.length <= options.maxItems);
});
