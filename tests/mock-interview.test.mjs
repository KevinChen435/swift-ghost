import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMockClock,
  mockInterviewEndsAt,
  mockInterviewPreset,
  mockInterviewRemainingMs,
  selectMockInterviewItem,
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
