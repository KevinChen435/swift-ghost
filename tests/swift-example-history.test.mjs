import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSwiftExampleHistory,
  swiftExampleHistoryEntryFromRun,
  SWIFT_EXAMPLE_HISTORY_LIMITS,
} from "../app/lib/swift-example-history.mjs";

const challenge = Object.freeze({
  key: "swift-two-sum",
  language: "swift",
  contentRevision: 3,
  judgeRevision: 5,
  samples: [
    { id: "sample-1", name: "simple", args: [[2, 7], 9], expected: [0, 1] },
    { id: "sample-2", name: "late pair", args: [[3, 2, 4], 6], expected: [1, 2] },
  ],
});

function settledRun(overrides = {}) {
  return {
    id: "example-server-1",
    assignmentId: "assignment-1",
    clientRunId: "example:client-1",
    status: "settled",
    verdict: "wrong-answer",
    requestedAt: "2026-08-29T10:00:00.000Z",
    settledAt: "2026-08-29T10:01:00.000Z",
    result: {
      passed: 1,
      total: 2,
      authority: "server-isolated-swift",
      language: "swift",
      runtime: "swift-6.3.3-linux",
      contractDigest: "a".repeat(64),
      contentRevision: 3,
      judgeRevision: 5,
      failedCaseIndex: 1,
      publicCaseResults: [
        { id: "sample-1", visibility: "sample", passed: true, status: "passed", actual: [0, 1] },
        {
          id: "sample-2",
          visibility: "sample",
          passed: false,
          status: "wrong-answer",
          actual: [0, 2],
          diagnostic: "The complement index is off by one.",
          expected: [1, 2],
          hiddenCases: [{ actual: "do not store" }],
        },
      ],
      diagnostic: "private aggregate diagnostic should not be copied",
    },
    ...overrides,
  };
}

test("public example history stores visible feedback without private run fields", () => {
  const entry = swiftExampleHistoryEntryFromRun(settledRun(), challenge);
  assert.deepEqual(entry, {
    id: "example:client-1",
    settledAt: "2026-08-29T10:01:00.000Z",
    verdict: "wrong-answer",
    passed: 1,
    total: 2,
    contentRevision: 3,
    judgeRevision: 5,
    failedCaseIndex: 1,
    publicCaseResults: [
      { id: "sample-1", passed: true, status: "passed", actual: [0, 1] },
      {
        id: "sample-2",
        passed: false,
        status: "wrong-answer",
        actual: [0, 2],
        diagnostic: "The complement index is off by one.",
      },
    ],
  });
  const encoded = JSON.stringify(entry);
  assert.equal(encoded.includes("expected"), false);
  assert.equal(encoded.includes("hidden"), false);
  assert.equal(encoded.includes("source"), false);
  assert.equal(encoded.includes("private aggregate"), false);
  assert.equal(encoded.includes("contractDigest"), false);
});

test("history is revision-bound, settled-only, ordered by public catalog, and capped", () => {
  const first = settledRun();
  const stale = settledRun({
    clientRunId: "example:stale",
    result: { ...first.result, contentRevision: 2 },
  });
  const pending = { ...first, clientRunId: "example:pending", status: "pending", result: null };
  const reordered = {
    ...first,
    clientRunId: "example:reordered",
    result: {
      ...first.result,
      publicCaseResults: [...first.result.publicCaseResults].reverse(),
    },
  };
  const entries = normalizeSwiftExampleHistory(
    [stale, pending, reordered, ...Array.from({ length: 8 }, (_, index) => ({
      ...first,
      clientRunId: `example:extra-${index}`,
      settledAt: `2026-08-29T10:${String(index + 2).padStart(2, "0")}:00.000Z`,
    }))].flatMap((run) => {
      const entry = swiftExampleHistoryEntryFromRun(run, challenge);
      return entry ? [entry] : [];
    }),
    challenge,
  );
  assert.equal(entries.length, SWIFT_EXAMPLE_HISTORY_LIMITS.maxEntries);
  assert.equal(entries[0].id, "example:reordered");
  assert.deepEqual(entries[0].publicCaseResults.map((result) => result.id), [
    "sample-1",
    "sample-2",
  ]);
  assert.equal(entries.some((entry) => entry.id === "example:stale"), false);
  assert.equal(entries.some((entry) => entry.id === "example:pending"), false);
});

test("history bounds oversized public output and diagnostics", () => {
  const huge = settledRun({
    result: {
      ...settledRun().result,
      publicCaseResults: [
        {
          id: "sample-1",
          passed: false,
          status: "wrong-answer",
          actual: "x".repeat(10_000),
          diagnostic: "d".repeat(10_000),
        },
      ],
    },
  });
  const entry = swiftExampleHistoryEntryFromRun(huge, challenge);
  assert.ok(entry);
  assert.ok(entry.publicCaseResults[0].actual.length <= SWIFT_EXAMPLE_HISTORY_LIMITS.maxValueCharacters);
  assert.equal(entry.publicCaseResults[0].diagnostic.length, SWIFT_EXAMPLE_HISTORY_LIMITS.maxDiagnosticCharacters);
});
