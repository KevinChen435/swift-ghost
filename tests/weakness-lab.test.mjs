import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWeaknessLab,
  filterWeaknessCases,
} from "../app/lib/weakness-lab.mjs";
import { PATTERN_DECISION_PROBES } from "../app/data/pattern-decision-probes.ts";
import { PATTERN_LESSONS } from "../app/data/pattern-lessons.ts";
import { TEST_DESIGN_PROBES } from "../app/data/test-design-probes.ts";
import {
  rebuildTypingProgression,
} from "../app/lib/typing-progression.mjs";

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
  {
    itemId: "swift:value-a",
    contentRevision: 2,
    title: "Swift Value A",
    pattern: "Swift Semantics",
    track: "ios",
    language: "swift",
    conceptLane: "swift",
    estimatedMinutes: 7,
  },
  {
    itemId: "swift:value-b",
    contentRevision: 2,
    title: "Swift Value B",
    pattern: "Swift Semantics",
    track: "ios",
    language: "swift",
    conceptLane: "swift",
    estimatedMinutes: 7,
  },
  {
    itemId: "ios:reuse-a",
    contentRevision: 2,
    title: "iOS Reuse A",
    pattern: "UIKit",
    track: "ios",
    language: "swift",
    conceptLane: "ios",
    estimatedMinutes: 7,
  },
  {
    itemId: "ios:reuse-b",
    contentRevision: 2,
    title: "iOS Reuse B",
    pattern: "UIKit",
    track: "ios",
    language: "swift",
    conceptLane: "ios",
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

function typingAttempt(id, itemId, completedAt, stage, overrides = {}) {
  const item = items.find((candidate) => candidate.itemId === itemId);
  return {
    id,
    itemId,
    itemRevision: item.contentRevision,
    stage,
    practiceKind: "typing",
    outcome: "completed",
    qualification: stage === 5 ? "independent" : stage === 1 ? "syntax" : "guided",
    accuracy: 100,
    corrections: 0,
    peeks: 0,
    completedAt,
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

test("typing success requires canonical ownership and permanently excludes diagnostic bypasses", () => {
  const learningEvent = {
    id: "swift-typing-evidence",
    attemptId: "swift-typing-old",
    itemId: "swift:value-a",
    itemRevision: 2,
    friction: "syntax",
    grade: "again",
    createdAt: "2026-07-01T12:00:00.000Z",
  };
  const bypass = typingAttempt(
    "typing-bypass",
    "swift:value-a",
    "2026-07-10T12:00:00.000Z",
    5,
  );
  const diagnosticProgress = rebuildTypingProgression([bypass], {
    revisions: { "swift:value-a": 2 },
  });
  const diagnostic = buildWeaknessLab({
    items,
    attempts: [bypass],
    typingProgress: diagnosticProgress,
    learningEvents: [learningEvent],
    now: "2026-07-20T12:00:00.000Z",
  }).cases.find((entry) => entry.lane === "swift");
  assert.equal(diagnostic.status, "due");
  assert.deepEqual(diagnostic.successes, []);

  const worked = typingAttempt(
    "typing-worked",
    "swift:value-a",
    "2026-07-11T12:00:00.000Z",
    1,
  );
  const faded = typingAttempt(
    "typing-faded",
    "swift:value-a",
    "2026-07-11T13:00:00.000Z",
    3,
  );
  const recall = typingAttempt(
    "typing-owned",
    "swift:value-a",
    "2026-07-12T12:00:00.000Z",
    5,
  );
  const ownedProgress = rebuildTypingProgression(
    [bypass, worked, faded, recall],
    { revisions: { "swift:value-a": 2 } },
  );
  const owned = buildWeaknessLab({
    items,
    attempts: [bypass, worked, faded, recall],
    typingProgress: ownedProgress,
    learningEvents: [learningEvent],
    now: "2026-07-20T12:00:00.000Z",
  }).cases.find((entry) => entry.lane === "swift");
  assert.equal(owned.status, "stabilizing");
  assert.deepEqual(owned.successes.map((entry) => entry.id), [
    "attempt:typing-owned",
  ]);
});

test("ordered canonical typing ownership can resolve Swift cases across distinct items", () => {
  const learningEvent = {
    id: "swift-typing-resolution-evidence",
    attemptId: "swift-typing-resolution-old",
    itemId: "swift:value-a",
    itemRevision: 2,
    friction: "syntax",
    grade: "again",
    createdAt: "2026-07-01T12:00:00.000Z",
  };
  const chain = (itemId, prefix, day) => [
    typingAttempt(`${prefix}-worked`, itemId, `2026-07-${day}T08:00:00.000Z`, 1),
    typingAttempt(`${prefix}-faded`, itemId, `2026-07-${day}T09:00:00.000Z`, 2),
    typingAttempt(`${prefix}-owned`, itemId, `2026-07-${day}T10:00:00.000Z`, 5),
  ];
  const attempts = [
    ...chain("swift:value-a", "typing-a", "10"),
    ...chain("swift:value-b", "typing-b", "12"),
  ];
  const model = buildWeaknessLab({
    items,
    attempts,
    typingProgress: rebuildTypingProgression(attempts, {
      revisions: { "swift:value-a": 2, "swift:value-b": 2 },
    }),
    learningEvents: [learningEvent],
    now: "2026-07-20T12:00:00.000Z",
  });
  const evidenceCase = model.cases.find((entry) => entry.lane === "swift");
  assert.equal(evidenceCase.status, "resolved");
  assert.deepEqual(evidenceCase.successes.map((entry) => entry.itemId), [
    "swift:value-a",
    "swift:value-b",
  ]);
});

test("canonical typing ownership from a stale item revision cannot stabilize a case", () => {
  const staleAttempts = [
    typingAttempt("stale-worked", "swift:value-a", "2026-07-10T08:00:00.000Z", 1, { itemRevision: 1 }),
    typingAttempt("stale-faded", "swift:value-a", "2026-07-10T09:00:00.000Z", 2, { itemRevision: 1 }),
    typingAttempt("stale-owned", "swift:value-a", "2026-07-10T10:00:00.000Z", 5, { itemRevision: 1 }),
  ];
  const model = buildWeaknessLab({
    items,
    attempts: staleAttempts,
    typingProgress: rebuildTypingProgression(staleAttempts, {
      revisions: { "swift:value-a": 1 },
    }),
    learningEvents: [{
      id: "swift-current-revision-evidence",
      attemptId: "swift-current-revision-old",
      itemId: "swift:value-a",
      itemRevision: 2,
      friction: "syntax",
      grade: "again",
      createdAt: "2026-07-01T12:00:00.000Z",
    }],
    now: "2026-07-20T12:00:00.000Z",
  });
  const evidenceCase = model.cases.find((entry) => entry.lane === "swift");
  assert.equal(evidenceCase.status, "due");
  assert.deepEqual(evidenceCase.successes, []);
});

test("Swift and iOS cases resolve with a delayed pair on distinct non-transfer concepts", () => {
  for (const scenario of [
    {
      lane: "swift",
      itemIds: ["swift:value-a", "swift:value-b"],
      pattern: "Swift Semantics",
    },
    {
      lane: "ios",
      itemIds: ["ios:reuse-a", "ios:reuse-b"],
      pattern: "UIKit",
    },
  ]) {
    const learningEvent = {
      id: `${scenario.lane}-event`,
      attemptId: `${scenario.lane}-old`,
      itemId: scenario.itemIds[0],
      itemRevision: 2,
      friction: "implementation",
      grade: "again",
      createdAt: "2026-07-01T12:00:00.000Z",
    };
    const conceptAttempt = (id, itemId, completedAt) => ({
      id,
      itemId,
      itemRevision: 2,
      practiceKind: "concept",
      outcome: "completed",
      qualification: "independent",
      conceptGrade: "good",
      peeks: 0,
      completedAt,
    });

    const stabilizing = buildWeaknessLab({
      items,
      learningEvents: [learningEvent],
      attempts: [
        conceptAttempt(`${scenario.lane}-one`, scenario.itemIds[0], "2026-07-10T12:00:00.000Z"),
      ],
      now: "2026-07-20T12:00:00.000Z",
    }).cases.find((entry) => entry.lane === scenario.lane);
    assert.equal(stabilizing.status, "stabilizing", scenario.lane);
    assert.equal(stabilizing.transferRequired, false, scenario.lane);

    const sameItemTwice = buildWeaknessLab({
      items,
      learningEvents: [learningEvent],
      attempts: [
        conceptAttempt(`${scenario.lane}-one`, scenario.itemIds[0], "2026-07-10T12:00:00.000Z"),
        conceptAttempt(`${scenario.lane}-repeat`, scenario.itemIds[0], "2026-07-12T12:00:00.000Z"),
      ],
      now: "2026-07-20T12:00:00.000Z",
    }).cases.find((entry) => entry.lane === scenario.lane);
    assert.equal(sameItemTwice.status, "stabilizing", `${scenario.lane} needs distinct items`);

    const resolved = buildWeaknessLab({
      items,
      learningEvents: [learningEvent],
      attempts: [
        conceptAttempt(`${scenario.lane}-one`, scenario.itemIds[0], "2026-07-10T12:00:00.000Z"),
        conceptAttempt(`${scenario.lane}-two`, scenario.itemIds[1], "2026-07-12T12:00:00.000Z"),
      ],
      now: "2026-07-20T12:00:00.000Z",
    }).cases.find((entry) => entry.lane === scenario.lane);
    assert.equal(resolved.status, "resolved", scenario.lane);
    assert.equal(resolved.successes.length, 2, scenario.lane);
  }
});

test("cold self-assessed reconstruction can resolve Swift and iOS cases only across distinct variants", () => {
  for (const scenario of [
    {
      lane: "swift",
      itemId: "swift:value-a",
      family: "Swift Semantics",
      variantIds: ["concept-transfer:ct-01", "concept-transfer:ct-07"],
    },
    {
      lane: "ios",
      itemId: "ios:reuse-a",
      family: "UIKit",
      variantIds: ["concept-transfer:ct-08", "concept-transfer:ct-09"],
    },
  ]) {
    const learningEvent = {
      id: `${scenario.lane}-reconstruction-event`,
      attemptId: `${scenario.lane}-old`,
      itemId: scenario.itemId,
      itemRevision: 2,
      friction: "implementation",
      grade: "again",
      createdAt: "2026-07-01T12:00:00.000Z",
    };
    const reconstruction = (id, variantId, finishedAt, overrides = {}) => ({
      id,
      variantId,
      variantRevision: 1,
      lane: scenario.lane,
      family: scenario.family,
      qualification: "cold-self-assessed",
      finishedAt,
      ...overrides,
    });
    const conceptTransferVariants = scenario.variantIds.map((id) => ({
      id,
      revision: 1,
      lane: scenario.lane,
      family: scenario.family,
    }));

    const sameVariantTwice = buildWeaknessLab({
      items,
      learningEvents: [learningEvent],
      conceptTransferAttempts: [
        reconstruction(`${scenario.lane}-cold-one`, scenario.variantIds[0], "2026-07-10T12:00:00.000Z"),
        reconstruction(`${scenario.lane}-cold-repeat`, scenario.variantIds[0], "2026-07-12T12:00:00.000Z"),
      ],
      conceptTransferVariants,
      now: "2026-07-20T12:00:00.000Z",
    }).cases.find((entry) => entry.lane === scenario.lane);
    assert.equal(sameVariantTwice.status, "stabilizing", `${scenario.lane} needs distinct contexts`);

    const resolved = buildWeaknessLab({
      items,
      learningEvents: [learningEvent],
      conceptTransferAttempts: [
        reconstruction(`${scenario.lane}-cold-one`, scenario.variantIds[0], "2026-07-10T12:00:00.000Z"),
        reconstruction(`${scenario.lane}-cold-two`, scenario.variantIds[1], "2026-07-12T12:00:00.000Z"),
      ],
      conceptTransferVariants,
      now: "2026-07-20T12:00:00.000Z",
    }).cases.find((entry) => entry.lane === scenario.lane);
    assert.equal(resolved.status, "resolved", scenario.lane);
    assert.equal(resolved.successes.length, 2, scenario.lane);
    assert.equal(resolved.successes.every((entry) => entry.selfAssessed), true, scenario.lane);
  }
});

test("assisted, stale, mismatched, and pre-evidence reconstruction attempts never stabilize a weakness", () => {
  const learningEvent = {
    id: "swift-filter-event",
    attemptId: "swift-old",
    itemId: "swift:value-a",
    itemRevision: 2,
    friction: "implementation",
    grade: "again",
    createdAt: "2026-07-05T12:00:00.000Z",
  };
  const base = {
    id: "ignored-concept-transfer",
    variantId: "concept-transfer:ct-01",
    variantRevision: 1,
    lane: "swift",
    family: "Swift Semantics",
    qualification: "cold-self-assessed",
    finishedAt: "2026-07-10T12:00:00.000Z",
  };
  const ignoredAttempts = [
    { ...base, id: "assisted", qualification: "assisted" },
    { ...base, id: "reference", qualification: "reference-reconstruction" },
    { ...base, id: "retired", retired: true },
    { ...base, id: "before", finishedAt: "2026-07-04T12:00:00.000Z" },
    { ...base, id: "wrong-lane", lane: "ios" },
    { ...base, id: "wrong-family", family: "Memory Management" },
    { ...base, id: "stale-revision", variantRevision: 2 },
  ];
  const model = buildWeaknessLab({
    items,
    learningEvents: [learningEvent],
    conceptTransferAttempts: ignoredAttempts,
    conceptTransferVariants: [
      {
        id: base.variantId,
        revision: 1,
        lane: "swift",
        family: "Swift Semantics",
      },
    ],
    now: "2026-07-20T12:00:00.000Z",
  });
  const evidenceCase = model.cases.find((entry) => entry.lane === "swift");
  assert.equal(evidenceCase.status, "due");
  assert.equal(evidenceCase.successes.length, 0);
});

test("Test Design evidence requires current probe, item, and structural lane identity", () => {
  const probeFor = (lane) => TEST_DESIGN_PROBES.find((probe) => probe.lane === lane);
  for (const lane of ["python", "swift", "ios"]) {
    const probe = probeFor(lane);
    const item = {
      itemId: probe.itemId,
      contentRevision: probe.itemRevision,
      title: probe.title,
      pattern: `Test topic ${lane}`,
      track: lane === "python" ? "interview" : "ios",
      language: lane === "python" ? "python" : "swift",
      ...(lane !== "python" ? { conceptLane: lane } : {}),
      estimatedMinutes: 8,
    };
    const attempt = {
      id: `test-design-${lane}`,
      probeId: probe.id,
      probeRevision: probe.revision,
      lane,
      itemId: probe.itemId,
      itemRevision: probe.itemRevision,
      purposeMatch: false,
      oracleStatus: "confirmed",
      completedAt: "2026-07-10T12:00:00.000Z",
    };
    const model = buildWeaknessLab({
      items: [item],
      testDesignAttempts: [attempt],
      testDesignProbes: TEST_DESIGN_PROBES,
      now: "2026-07-20T12:00:00.000Z",
    });
    const evidenceCase = model.cases.find((entry) =>
      entry.sourceKinds.includes("test-design"),
    );
    assert.equal(evidenceCase.lane, lane);
    assert.equal(evidenceCase.weakness, "boundary");
    assert.equal(evidenceCase.topicKey, item.pattern);

    const mismatched = buildWeaknessLab({
      items: [item],
      testDesignAttempts: [{ ...attempt, lane: lane === "ios" ? "swift" : "ios" }],
      testDesignProbes: TEST_DESIGN_PROBES,
      now: "2026-07-20T12:00:00.000Z",
    });
    assert.equal(mismatched.cases.length, 0, `${lane} mismatch must not leak evidence`);
  }
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

test("two distinct objective pattern misses create recognition evidence, but one or repeats do not", () => {
  const lesson = PATTERN_LESSONS[0];
  const probes = PATTERN_DECISION_PROBES.filter(
    (probe) => probe.lessonId === lesson.id,
  );
  const miss = (probe, id, completedAt) => ({
    id,
    sprintId: `sprint-${id}`,
    source: "academy",
    probeId: probe.id,
    probeRevision: probe.revision,
    lessonId: lesson.id,
    lessonRevision: lesson.revision,
    selectedLessonId: "pattern:two-pointers",
    cue: "I chose the wrong cue.",
    invariant: "I stated an invariant.",
    whyNot: "I rejected another pattern.",
    assisted: false,
    wasDue: true,
    match: false,
    committedAt: completedAt,
    revealedAt: completedAt,
    grade: "again",
    completedAt,
    dueAt: "2026-07-31T12:00:00.000Z",
    levelAfter: 0,
    lapseCount: 1,
    updatedAt: completedAt,
  });
  const base = {
    items,
    patternLessons: PATTERN_LESSONS,
    patternDecisionProbes: PATTERN_DECISION_PROBES,
    now: "2026-08-02T12:00:00.000Z",
  };
  assert.equal(
    buildWeaknessLab({
      ...base,
      patternDecisionAttempts: [
        miss(probes[0], "one", "2026-07-29T12:00:00.000Z"),
      ],
    }).cases.some((entry) => entry.sourceKinds.includes("pattern-decision")),
    false,
  );
  assert.equal(
    buildWeaknessLab({
      ...base,
      patternDecisionAttempts: [
        miss(probes[0], "one", "2026-07-29T12:00:00.000Z"),
        miss(probes[0], "repeat", "2026-07-30T12:00:00.000Z"),
      ],
    }).cases.some((entry) => entry.sourceKinds.includes("pattern-decision")),
    false,
  );
  const model = buildWeaknessLab({
    ...base,
    patternDecisionAttempts: [
      miss(probes[0], "one", "2026-07-29T12:00:00.000Z"),
      miss(probes[1], "two", "2026-07-30T12:00:00.000Z"),
    ],
  });
  const patternCase = model.cases.find((entry) =>
    entry.sourceKinds.includes("pattern-decision"),
  );
  assert.equal(patternCase.weakness, "missed-cue");
  assert.equal(patternCase.recurrence, 2);
  assert.equal(patternCase.topicKey, lesson.pattern);
  assert.match(patternCase.evidence[0].summary, /Free-text reasoning was not auto-scored/);
});
