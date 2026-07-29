import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWeaknessLab,
  filterWeaknessCases,
} from "../app/lib/weakness-lab.mjs";

const items = [
  {
    itemId: "python:1",
    contentRevision: 2,
    title: "Pair Ledger",
    pattern: "Arrays & Hashing",
    track: "interview",
    language: "python",
    estimatedMinutes: 8,
    verification: { revision: 2, cases: [{}] },
  },
  {
    itemId: "python:2",
    contentRevision: 1,
    title: "Grouped Tokens",
    pattern: "Arrays & Hashing",
    track: "interview",
    language: "python",
    estimatedMinutes: 10,
    verification: { revision: 3, cases: [{}] },
  },
  {
    itemId: "transfer:1",
    contentRevision: 1,
    title: "Concealed Counter",
    pattern: "Arrays & Hashing",
    track: "interview",
    language: "python",
    transfer: { id: "transfer:1" },
  },
  {
    itemId: "builtin:1",
    contentRevision: 1,
    title: "Swift Pair Ledger",
    pattern: "Arrays & Hashing",
    track: "interview",
    language: "swift",
    estimatedMinutes: 8,
  },
  {
    itemId: "ios:arc",
    contentRevision: 2,
    title: "Break the Cycle",
    pattern: "Memory Management",
    track: "ios",
    language: "swift",
    estimatedMinutes: 7,
  },
];

function attempt(overrides = {}) {
  return {
    id: "attempt-1",
    itemId: "python:1",
    itemRevision: 2,
    practiceKind: "solving",
    outcome: "completed",
    qualification: "solved",
    peeks: 0,
    completedAt: "2026-07-10T12:00:00.000Z",
    verification: { revision: 2, passed: 4, total: 4 },
    submissionId: "submission-1",
    ...overrides,
  };
}

function receipt(overrides = {}) {
  return {
    id: "submission-1",
    lifecycle: "settled",
    status: "accepted",
    assistance: "none-recorded",
    itemId: "python:1",
    itemRevision: 2,
    passed: 4,
    total: 4,
    judge: { revision: 2 },
    ...overrides,
  };
}

test("adapters unify learning, review, assessment, mock, and transfer evidence", () => {
  const model = buildWeaknessLab({
    items,
    now: "2026-07-20T12:00:00.000Z",
    learningEvents: [
      {
        id: "event-1",
        attemptId: "attempt-old",
        itemId: "python:1",
        itemRevision: 2,
        friction: "invariant",
        grade: "again",
        createdAt: "2026-07-01T12:00:00.000Z",
      },
    ],
    solutionReviews: [
      {
        id: "review-1",
        status: "completed",
        mistakeCategory: "edge-case",
        itemId: "python:1",
        itemRevision: 2,
        attemptId: "attempt-review",
        completedAt: "2026-07-02T12:00:00.000Z",
      },
    ],
    assessmentReports: [
      {
        runId: "assessment-1",
        title: "Python re-entry",
        track: "python",
        startedAt: "2026-07-03T12:00:00.000Z",
        completedAt: "2026-07-03T12:30:00.000Z",
        probes: [
          {
            probeId: "probe-1",
            itemId: "python:1",
            title: "Hashing probe",
            focus: "Arrays & Hashing",
            blockers: ["verification"],
            rubricTotal: 3,
          },
        ],
      },
    ],
    sessionHistory: [
      {
        id: "mock-1",
        kind: "mock",
        name: "Screen mock",
        entries: [{ itemId: "python:1" }],
        debrief: {
          completedAt: "2026-07-04T12:00:00.000Z",
          mistakeTags: ["communication"],
        },
      },
    ],
    transferRecords: [
      {
        variantId: "transfer:1",
        currentRevision: 1,
        title: "Concealed Counter",
        pattern: "Arrays & Hashing",
        status: "assisted",
        lastActivityAt: "2026-07-05T12:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(
    new Set(model.cases.map((entry) => entry.weakness)),
    new Set(["wrong-invariant", "boundary", "verification", "communication", "overfit"]),
  );
  assert.equal(model.summary.due, 5);
  assert.equal(model.scope, "private-local-learning-evidence");
});

test("duplicate source evidence is idempotent and recurrence remains honest", () => {
  const repeated = {
    id: "event-1",
    attemptId: "attempt-old",
    itemId: "python:1",
    itemRevision: 2,
    friction: "syntax",
    grade: "hard",
    createdAt: "2026-07-01T12:00:00.000Z",
  };
  const model = buildWeaknessLab({
    items,
    learningEvents: [repeated, repeated],
    now: "2026-07-03T12:00:00.000Z",
  });
  assert.equal(model.cases.length, 1);
  assert.equal(model.cases[0].recurrence, 1);
  assert.equal(model.cases[0].evidence.length, 1);
});

test("stale or assisted attempts cannot stabilize a case", () => {
  const model = buildWeaknessLab({
    items,
    learningEvents: [
      {
        id: "event-1",
        attemptId: "attempt-old",
        itemId: "python:1",
        itemRevision: 2,
        friction: "implementation",
        grade: "again",
        createdAt: "2026-07-01T12:00:00.000Z",
      },
    ],
    attempts: [
      attempt({ id: "stale", itemRevision: 1 }),
      attempt({ id: "assisted", qualification: "assisted" }),
      attempt({ id: "peeked", peeks: 1 }),
      attempt({ id: "missing-receipt", submissionId: "missing" }),
    ],
    submissionReceipts: [receipt({ assistance: "used" })],
    now: "2026-07-20T12:00:00.000Z",
  });
  assert.equal(model.cases[0].status, "due");
  assert.equal(model.cases[0].successes.length, 0);
});

test("Python proof must use the current judge revision", () => {
  const base = {
    items,
    learningEvents: [
      {
        id: "event-judge-revision",
        attemptId: "attempt-old",
        itemId: "python:1",
        itemRevision: 2,
        friction: "implementation",
        grade: "again",
        createdAt: "2026-07-01T12:00:00.000Z",
      },
    ],
    now: "2026-07-20T12:00:00.000Z",
  };
  const bothStale = buildWeaknessLab({
    ...base,
    attempts: [
      attempt({ verification: { revision: 1, passed: 4, total: 4 } }),
    ],
    submissionReceipts: [receipt({ judge: { revision: 1 } })],
  });
  assert.equal(bothStale.cases[0].status, "due");
  assert.equal(bothStale.cases[0].successes.length, 0);

  const staleAttemptOnly = buildWeaknessLab({
    ...base,
    attempts: [
      attempt({ verification: { revision: 1, passed: 4, total: 4 } }),
    ],
    submissionReceipts: [receipt()],
  });
  assert.equal(staleAttemptOnly.cases[0].status, "due");
  assert.equal(staleAttemptOnly.cases[0].successes.length, 0);

  const staleReceiptOnly = buildWeaknessLab({
    ...base,
    attempts: [attempt()],
    submissionReceipts: [receipt({ judge: { revision: 1 } })],
  });
  assert.equal(staleReceiptOnly.cases[0].status, "due");
  assert.equal(staleReceiptOnly.cases[0].successes.length, 0);

  const current = buildWeaknessLab({
    ...base,
    attempts: [attempt()],
    submissionReceipts: [receipt()],
  });
  assert.equal(current.cases[0].status, "stabilizing");
  assert.equal(current.cases[0].successes.length, 1);
});

test("one independent success stabilizes and a delayed pair plus transfer resolves", () => {
  const base = {
    items,
    learningEvents: [
      {
        id: "event-1",
        attemptId: "attempt-old",
        itemId: "python:1",
        itemRevision: 2,
        friction: "invariant",
        grade: "again",
        createdAt: "2026-07-01T12:00:00.000Z",
      },
    ],
    now: "2026-07-20T12:00:00.000Z",
  };
  const stabilizing = buildWeaknessLab({
    ...base,
    attempts: [attempt()],
    submissionReceipts: [receipt()],
  });
  assert.equal(stabilizing.cases[0].status, "stabilizing");

  const resolved = buildWeaknessLab({
    ...base,
    attempts: [
      attempt(),
      attempt({
        id: "attempt-2",
        itemId: "python:2",
        itemRevision: 1,
        completedAt: "2026-07-12T12:00:00.000Z",
        submissionId: "submission-2",
        verification: { revision: 3, passed: 4, total: 4 },
      }),
    ],
    submissionReceipts: [
      receipt(),
      receipt({
        id: "submission-2",
        itemId: "python:2",
        itemRevision: 1,
        judge: { revision: 3 },
      }),
    ],
    transferRecords: [
      {
        variantId: "transfer:1",
        currentRevision: 1,
        title: "Concealed Counter",
        pattern: "Arrays & Hashing",
        status: "proven",
        lastActivityAt: "2026-07-14T12:00:00.000Z",
      },
    ],
  });
  assert.equal(resolved.cases[0].status, "resolved");
  assert.equal(resolved.cases[0].transferRequired, false);
});

test("targeted queues exclude sealed transfer variants and choose lane-appropriate modes", () => {
  const model = buildWeaknessLab({
    items,
    learningEvents: [
      {
        id: "python-event",
        attemptId: "attempt-py",
        itemId: "python:1",
        itemRevision: 2,
        friction: "implementation",
        grade: "hard",
        createdAt: "2026-07-01T12:00:00.000Z",
      },
      {
        id: "ios-event",
        attemptId: "attempt-ios",
        itemId: "ios:arc",
        itemRevision: 2,
        friction: "api",
        grade: "hard",
        createdAt: "2026-07-01T12:00:00.000Z",
      },
    ],
    itemSignals: {
      "python:1": { due: true, recommendedStage: 5 },
      "ios:arc": { recommendedStage: 4 },
    },
    now: "2026-07-04T12:00:00.000Z",
  });
  const pythonCase = model.cases.find((entry) => entry.lane === "python");
  const iosCase = model.cases.find((entry) => entry.lane === "ios");
  assert.equal(pythonCase.queue[0].practiceKind, "solving");
  assert.equal(iosCase.queue[0].practiceKind, "concept");
  assert.equal(model.cases.flatMap((entry) => entry.queue).some((entry) => entry.itemId === "transfer:1"), false);
});

test("filters preserve priority order and bound status/lane views", () => {
  const cases = [
    { id: "one", lane: "python", status: "due" },
    { id: "two", lane: "ios", status: "stabilizing" },
    { id: "three", lane: "python", status: "resolved" },
  ];
  assert.deepEqual(filterWeaknessCases(cases, { filter: "priority" }).map((entry) => entry.id), ["one", "two"]);
  assert.deepEqual(filterWeaknessCases(cases, { filter: "resolved", lane: "python" }).map((entry) => entry.id), ["three"]);
  assert.deepEqual(filterWeaknessCases(cases, { filter: "all", lane: "ios" }).map((entry) => entry.id), ["two"]);
});
