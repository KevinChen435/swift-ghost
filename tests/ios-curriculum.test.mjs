import assert from "node:assert/strict";
import test from "node:test";
import { deriveIOSReactivationProgress } from "../app/lib/ios-curriculum.mjs";

const phases = [
  {
    id: "phase-one",
    number: 1,
    title: "Foundations",
    modules: [
      {
        id: "module-one",
        title: "Boundaries",
        itemIds: ["ios:concept", "swift:companion", "ios:missing"],
      },
    ],
  },
  {
    id: "phase-two",
    number: 2,
    title: "Production",
    modules: [{ id: "module-two", title: "Systems", itemIds: ["ios:old"] }],
  },
];

const items = [
  {
    itemId: "ios:concept",
    contentRevision: 2,
    track: "ios",
    recallChecks: ["one", "two", "three"],
    conceptAnswers: ["one", "two", "three"],
  },
  {
    itemId: "swift:companion",
    contentRevision: 1,
    track: "interview",
    language: "swift",
    solveCapability: "server",
  },
  {
    itemId: "ios:old",
    contentRevision: 2,
    track: "ios",
    recallChecks: ["one", "two", "three"],
    conceptAnswers: ["one", "two", "three"],
  },
];

function conceptAttempt(overrides = {}) {
  return {
    id: "concept-attempt",
    itemId: "ios:concept",
    itemRevision: 2,
    practiceKind: "concept",
    outcome: "completed",
    qualification: "independent",
    conceptGrade: "good",
    peeks: 0,
    completedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function solveAttempt(overrides = {}) {
  return {
    id: "solve-attempt",
    itemId: "swift:companion",
    itemRevision: 1,
    practiceKind: "solving",
    outcome: "completed",
    qualification: "solved",
    peeks: 0,
    verification: { passed: 2, total: 2 },
    completedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

test("derives independent, due, practiced, outdated, and unavailable evidence without a score", () => {
  const result = deriveIOSReactivationProgress(phases, {
    items,
    attempts: [
      conceptAttempt(),
      solveAttempt(),
      conceptAttempt({
        id: "old-attempt",
        itemId: "ios:old",
        itemRevision: 1,
      }),
    ],
    now: "2026-08-03T12:00:00.000Z",
  });

  const moduleProgress = result.phases[0].modules[0];
  assert.equal(result.totalItems, 4);
  assert.equal(result.independent, 2);
  assert.equal(result.due, 2);
  assert.equal(result.attempted, 2);
  assert.equal(moduleProgress.items[0].status, "due");
  assert.equal(moduleProgress.items[1].status, "due");
  assert.equal(moduleProgress.items[2].status, "unavailable");
  assert.equal(result.phases[1].modules[0].items[0].status, "outdated");
  assert.equal(result.next.itemId, "ios:concept");
  assert.equal("readiness" in result, false);
  assert.equal("score" in result, false);
});

test("preserves curriculum order for next routing and accepts a clean typing workspace", () => {
  const result = deriveIOSReactivationProgress(
    [
      {
        id: "phase",
        number: 1,
        modules: [{ id: "module", itemIds: ["swift:blank", "swift:later"] }],
      },
    ],
    {
      items: [
        { itemId: "swift:blank", contentRevision: 1, language: "swift" },
        { itemId: "swift:later", contentRevision: 1, language: "swift" },
      ],
      attempts: [],
      typingProgress: { version: 1, revision: 1, updatedAt: "2026-08-01T00:00:00.000Z", records: [], attempts: [] },
      now: "2026-08-01T00:00:00.000Z",
    },
  );
  assert.equal(result.next.itemId, "swift:blank");
  assert.deepEqual(result.phases[0].modules[0].items.map((item) => item.itemId), ["swift:blank", "swift:later"]);
  assert.equal(result.phases[0].modules[0].items[0].status, "not-started");
});
