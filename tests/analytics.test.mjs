import test from "node:test";
import assert from "node:assert/strict";
import {
  ANALYTICS_LIMITS,
  aggregateWeakLines,
  normalizeLineErrors,
  normalizeTimelineSamples,
  repairLineExcerpt,
  selectRepairDrillTarget,
  summarizeAttemptTimeline,
} from "../app/lib/analytics.mjs";

test("timeline normalization sorts, clamps, rounds, and ignores invalid samples", () => {
  assert.deepEqual(
    normalizeTimelineSamples([
      { atMs: 2_000.4, wpm: 42.26, progress: 110 },
      null,
      { atMs: "1000", wpm: "31.04", progress: "12.54" },
      { atMs: 3_000, wpm: Infinity, progress: 20 },
      { atMs: -20, wpm: -4, progress: -1 },
    ]),
    [
      { atMs: 0, wpm: 0, progress: 0 },
      { atMs: 1_000, wpm: 31, progress: 12.5 },
      { atMs: 2_000, wpm: 42.3, progress: 100 },
    ],
  );
});

test("duplicate timestamps keep the latest supplied sample", () => {
  assert.deepEqual(
    normalizeTimelineSamples([
      { atMs: 1_000, wpm: 20, progress: 10 },
      { atMs: 1_000, wpm: 24, progress: 15 },
    ]),
    [{ atMs: 1_000, wpm: 24, progress: 15 }],
  );
});

test("oversized timelines are evenly bounded while preserving endpoints", () => {
  const input = Array.from({ length: 20 }, (_, index) => ({
    atMs: index,
    wpm: index,
    progress: index,
  }));
  const output = normalizeTimelineSamples(input, { maxSamples: 4 });
  assert.equal(output.length, 4);
  assert.deepEqual(
    output.map((sample) => sample.atMs),
    [0, 6, 13, 19],
  );
});

test("timeline normalization has a safe default bound", () => {
  const input = Array.from({ length: 1_000 }, (_, index) => ({
    atMs: index,
    wpm: 40,
    progress: index / 10,
  }));
  assert.equal(
    normalizeTimelineSamples(input).length,
    ANALYTICS_LIMITS.timelineSamples,
  );
});

test("line errors normalize object, map, and tuple-like entries", () => {
  assert.deepEqual(normalizeLineErrors({ 3: 2.2, 1: "4", nope: 2, 7: 0 }), {
    1: 4,
    3: 2,
  });
  assert.deepEqual(
    normalizeLineErrors(
      new Map([
        [2, 3],
        [4, 1],
      ]),
    ),
    { 2: 3, 4: 1 },
  );
  assert.deepEqual(
    normalizeLineErrors([
      { line: 8, count: 3 },
      { lineNumber: 2, errors: 4 },
    ]),
    { 2: 4, 8: 3 },
  );
});

test("line errors merge duplicates and retain strongest entries under a bound", () => {
  const normalized = normalizeLineErrors(
    [
      { line: 8, count: 2 },
      { line: 8, count: 3 },
      { line: 2, count: 4 },
      { line: 4, count: 9 },
    ],
    { maxLines: 2 },
  );
  assert.deepEqual(normalized, { 4: 9, 8: 5 });
});

test("weak-line aggregation preserves language lanes and recurrence", () => {
  const weak = aggregateWeakLines([
    {
      itemId: "python:1",
      titleSnapshot: "Two Sum",
      language: "python",
      completedAt: "2026-07-20T00:00:00Z",
      lineErrors: { 3: 2, 8: 1 },
    },
    {
      itemId: "python:1",
      titleSnapshot: "Two Sum",
      language: "python",
      completedAt: "2026-07-21T00:00:00Z",
      errorsByLine: { 3: 4 },
    },
    {
      itemId: "builtin:1",
      titleSnapshot: "Two Sum",
      language: "swift",
      completedAt: "2026-07-22T00:00:00Z",
      lineErrors: { 3: 9 },
    },
  ]);
  assert.equal(weak.length, 3);
  assert.deepEqual(weak[0], {
    key: "python:python:1:3",
    itemId: "python:1",
    title: "Two Sum",
    language: "python",
    line: 3,
    errorCount: 6,
    attemptCount: 2,
    lastSeenAtMs: Date.parse("2026-07-21T00:00:00Z"),
  });
  assert.equal(weak[1].language, "swift");
  assert.equal(weak[1].errorCount, 9);
});

test("weak-line aggregation is deterministic and bounded", () => {
  const attempts = Array.from({ length: 30 }, (_, index) => ({
    itemId: `python:${index}`,
    title: `Item ${index}`,
    language: "python",
    completedAt: index,
    lineErrors: { 1: 1 },
  }));
  const weak = aggregateWeakLines(attempts, { limit: 5 });
  assert.equal(weak.length, 5);
  assert.deepEqual(
    weak.map((entry) => entry.itemId),
    ["python:29", "python:28", "python:27", "python:26", "python:25"],
  );
});

test("weak-line aggregation ignores malformed attempts and signals", () => {
  assert.deepEqual(
    aggregateWeakLines([
      null,
      {},
      { itemId: "x", language: "python", lineErrors: { 0: 2, nope: 5 } },
    ]),
    [],
  );
});

test("repair selection prioritizes recurrence before a one-off error burst", () => {
  const recurring = {
    itemId: "python:1",
    line: 4,
    errorCount: 5,
    attemptCount: 3,
    lastSeenAtMs: 10,
  };
  const burst = {
    itemId: "python:2",
    line: 7,
    errorCount: 20,
    attemptCount: 1,
    lastSeenAtMs: 20,
  };
  assert.equal(selectRepairDrillTarget([burst, recurring]), recurring);
  assert.equal(selectRepairDrillTarget([null, {}]), null);
});

test("timeline summary reports extrema, average, duration, and faster pacing", () => {
  assert.deepEqual(
    summarizeAttemptTimeline([
      { atMs: 5_000, wpm: 30, progress: 10 },
      { atMs: 8_000, wpm: 54, progress: 70 },
      { atMs: 12_000, wpm: 43, progress: 100 },
    ]),
    {
      sampleCount: 3,
      durationMs: 7_000,
      averageWpm: 42.3,
      startWpm: 30,
      endWpm: 43,
      peakWpm: 54,
      peakAtMs: 8_000,
      slowestWpm: 30,
      slowestAtMs: 5_000,
      paceChangeWpm: 13,
      paceTrend: "faster",
    },
  );
});

test("timeline summary distinguishes slower, steady, and empty traces", () => {
  assert.equal(
    summarizeAttemptTimeline([
      { atMs: 0, wpm: 40, progress: 0 },
      { atMs: 1_000, wpm: 30, progress: 100 },
    ]).paceTrend,
    "slower",
  );
  assert.equal(
    summarizeAttemptTimeline([
      { atMs: 0, wpm: 40, progress: 0 },
      { atMs: 1_000, wpm: 39.5, progress: 100 },
    ]).paceTrend,
    "steady",
  );
  assert.deepEqual(summarizeAttemptTimeline(null), {
    sampleCount: 0,
    durationMs: 0,
    averageWpm: 0,
    startWpm: 0,
    endWpm: 0,
    peakWpm: 0,
    peakAtMs: null,
    slowestWpm: 0,
    slowestAtMs: null,
    paceChangeWpm: 0,
    paceTrend: "steady",
  });
});

test("repair excerpts include numbered context around the target", () => {
  assert.deepEqual(repairLineExcerpt("one\ntwo\nthree\nfour\nfive", 3, 1), {
    lineNumber: 3,
    lineText: "three",
    startLine: 2,
    endLine: 4,
    context: [
      { lineNumber: 2, text: "two", isTarget: false },
      { lineNumber: 3, text: "three", isTarget: true },
      { lineNumber: 4, text: "four", isTarget: false },
    ],
  });
});

test("repair excerpts stay bounded at the first and last lines", () => {
  assert.deepEqual(
    repairLineExcerpt("one\ntwo\nthree", 1, 2).context.map(
      (line) => line.lineNumber,
    ),
    [1, 2, 3],
  );
  assert.deepEqual(
    repairLineExcerpt("one\ntwo\nthree", 3, 2).context.map(
      (line) => line.lineNumber,
    ),
    [1, 2, 3],
  );
});

test("repair excerpts clamp out-of-range targets and reject non-code input", () => {
  assert.equal(repairLineExcerpt("one\ntwo\nthree", -20).lineNumber, 1);
  assert.equal(repairLineExcerpt("one\ntwo\nthree", 200).lineNumber, 3);
  assert.equal(repairLineExcerpt(null, 2), null);
});
