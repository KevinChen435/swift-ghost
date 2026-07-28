import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMockClock,
  MOCK_INTERVIEW_PROBLEM_COUNTS,
  mockInterviewEndsAt,
  mockInterviewPreset,
  mockInterviewRemainingMs,
  selectMockInterviewItem,
  selectMockInterviewItems,
} from "../app/lib/mock-interview.mjs";

function item(id, difficulty = "Medium") {
  return {
    itemId: id,
    contentRevision: 2,
    source: "builtin",
    track: "interview",
    language: "python",
    pattern: "Arrays & Hashing",
    difficulty,
    verification: { cases: [{}] },
  };
}

test("mock presets have safe defaults and fixed interview clocks", () => {
  assert.equal(mockInterviewPreset("screen").durationMinutes, 30);
  assert.equal(mockInterviewPreset("standard").durationMinutes, 45);
  assert.equal(mockInterviewPreset("stretch").durationMinutes, 60);
  assert.equal(mockInterviewPreset("unknown").id, "standard");
  assert.deepEqual(MOCK_INTERVIEW_PROBLEM_COUNTS, [1, 2]);
});

test("mock selection prioritizes unsolved current-revision verified Python work", () => {
  const alpha = item("python:alpha");
  const beta = item("python:beta");
  const chosen = selectMockInterviewItem(
    [alpha, beta, { ...item("builtin:swift"), language: "swift" }],
    [
      {
        itemId: alpha.itemId,
        itemRevision: 2,
        outcome: "completed",
        practiceKind: "solving",
        qualification: "solved",
        completedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        itemId: beta.itemId,
        itemRevision: 1,
        outcome: "completed",
        practiceKind: "solving",
        qualification: "solved",
        completedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
    "standard",
  );
  assert.equal(chosen?.itemId, beta.itemId);
});

test("mock selection respects preset difficulty and excludes custom work", () => {
  const easy = item("python:easy", "Easy");
  const medium = item("python:medium", "Medium");
  const custom = { ...item("custom:medium", "Medium"), source: "custom" };
  const fluency = { ...item("python:fluency", "Easy"), pattern: "Python Fluency" };
  assert.equal(
    selectMockInterviewItem([medium, easy, custom, fluency], [], "screen")?.itemId,
    easy.itemId,
  );
  assert.equal(
    selectMockInterviewItem([medium, easy, custom], [], "standard")?.itemId,
    medium.itemId,
  );
});

test("mock selection returns the exact requested number in deterministic rank order", () => {
  const alpha = item("python:alpha");
  const beta = item("python:beta");
  const gamma = item("python:gamma");
  const attempts = [
    {
      itemId: alpha.itemId,
      itemRevision: 2,
      outcome: "completed",
      practiceKind: "solving",
      qualification: "solved",
      completedAt: "2026-01-03T00:00:00.000Z",
    },
    {
      itemId: beta.itemId,
      itemRevision: 2,
      outcome: "started",
      practiceKind: "solving",
      qualification: "attempted",
      completedAt: "2026-01-02T00:00:00.000Z",
    },
  ];

  assert.deepEqual(
    selectMockInterviewItems([alpha, beta, gamma], attempts, "standard", 2).map(
      ({ itemId }) => itemId,
    ),
    [gamma.itemId, beta.itemId],
  );
  assert.deepEqual(
    selectMockInterviewItems([alpha, beta, gamma], attempts, "standard", 1).map(
      ({ itemId }) => itemId,
    ),
    [gamma.itemId],
  );
});

test("mock selection requires enough distinct eligible catalog items", () => {
  const alpha = item("python:alpha");
  const duplicateAlpha = { ...alpha };
  assert.deepEqual(
    selectMockInterviewItems([alpha, duplicateAlpha], [], "standard", 2),
    [],
  );
  assert.deepEqual(selectMockInterviewItems([alpha], [], "standard", 1), [alpha]);
});

test("mock selection rejects unsupported problem counts", () => {
  const catalog = [item("python:alpha"), item("python:beta")];
  for (const count of [0, 3, 1.5, "2", null, undefined]) {
    assert.deepEqual(
      selectMockInterviewItems(catalog, [], "standard", count),
      [],
    );
  }
});

test("multi-item mock selection applies preset difficulty filters to every item", () => {
  const easyA = item("python:easy-a", "Easy");
  const easyB = item("python:easy-b", "Easy");
  const mediumA = item("python:medium-a", "Medium");
  const mediumB = item("python:medium-b", "Medium");
  const hard = item("python:hard", "Hard");

  assert.deepEqual(
    selectMockInterviewItems(
      [mediumA, easyB, hard, easyA, mediumB],
      [],
      "screen",
      2,
    ).map(({ itemId }) => itemId),
    [easyA.itemId, easyB.itemId],
  );
  assert.deepEqual(
    selectMockInterviewItems(
      [mediumB, hard, easyA, mediumA],
      [],
      "stretch",
      2,
    ).map(({ itemId }) => itemId),
    [hard.itemId, mediumA.itemId],
  );
});

test("mock selection does not mutate catalog or attempt inputs", () => {
  const catalog = [item("python:beta"), item("python:alpha")];
  const attempts = [
    {
      itemId: catalog[0].itemId,
      itemRevision: 2,
      practiceKind: "solving",
      outcome: "started",
      completedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  const catalogBefore = structuredClone(catalog);
  const attemptsBefore = structuredClone(attempts);

  selectMockInterviewItems(catalog, attempts, "standard", 2);

  assert.deepEqual(catalog, catalogBefore);
  assert.deepEqual(attempts, attemptsBefore);
});

test("mock clocks persist from absolute timestamps and clamp at zero", () => {
  const startedAt = "2026-01-01T12:00:00.000Z";
  const expiresAt = mockInterviewEndsAt(startedAt, 45);
  assert.equal(expiresAt, "2026-01-01T12:45:00.000Z");
  const session = { kind: "mock", expiresAt };
  assert.equal(
    mockInterviewRemainingMs(session, Date.parse("2026-01-01T12:44:01.000Z")),
    59_000,
  );
  assert.equal(
    mockInterviewRemainingMs(session, Date.parse("2026-01-01T13:00:00.000Z")),
    0,
  );
  assert.equal(formatMockClock(59_001), "01:00");
  assert.equal(formatMockClock(0), "00:00");
});
