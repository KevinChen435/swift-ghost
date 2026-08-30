import assert from "node:assert/strict";
import test from "node:test";
import {
  createProgressSnapshot,
  isProgressSyncableItemId,
  mergeProgressSnapshots,
  normalizeProgressSnapshot,
  progressSnapshotFingerprint,
  PROGRESS_SYNC_LIMITS,
} from "../app/lib/progress-sync.mjs";

function attempt(id, overrides = {}) {
  return {
    id,
    itemId: "builtin:1",
    itemRevision: 1,
    stage: 2,
    practiceKind: "typing",
    mode: "strict",
    startedAt: "2026-08-20T12:00:00.000Z",
    completedAt: "2026-08-20T12:02:00.000Z",
    durationMs: 120_000,
    totalKeystrokes: 100,
    correctKeystrokes: 98,
    rejectedKeystrokes: 2,
    corrections: 1,
    peeks: 0,
    rawWpm: 50,
    wpm: 49,
    accuracy: 98,
    consistency: 85,
    outcome: "completed",
    qualification: "independent",
    timeline: [{ atMs: 1000, wpm: 10 }],
    keyErrors: { x: 4 },
    lineErrors: { 2: 1 },
    source: "print('do not sync')",
    ...overrides,
  };
}

test("progress snapshots are bounded, catalog-only, and source-free", () => {
  assert.equal(isProgressSyncableItemId("builtin:1"), true);
  assert.equal(isProgressSyncableItemId("swift:two-sum"), true);
  assert.equal(isProgressSyncableItemId("custom:secret-problem"), false);

  const snapshot = createProgressSnapshot(
    {
      attempts: [
        attempt("attempt-1"),
        attempt("attempt-custom", { itemId: "custom:secret-problem" }),
      ],
      learningEvents: [
        {
          id: "event-1",
          attemptId: "attempt-1",
          itemId: "builtin:1",
          itemRevision: 1,
          practiceKind: "typing",
          activityKind: "syntax",
          grade: "hard",
          friction: "syntax",
          confidence: 2,
          createdAt: "2026-08-20T12:03:00.000Z",
          promptSnapshot: "private prompt",
          response: "private response",
        },
      ],
    },
    { now: "2026-08-20T12:04:00.000Z" },
  );
  assert.ok(snapshot);
  assert.equal(snapshot.attempts.length, 1);
  assert.equal(snapshot.attempts[0].id, "attempt-1");
  assert.equal("source" in snapshot.attempts[0], false);
  assert.equal("timeline" in snapshot.attempts[0], false);
  assert.equal(snapshot.learningEvents[0].promptSnapshot, undefined);
  assert.equal(snapshot.learningEvents[0].response, undefined);
  assert.ok(JSON.stringify(snapshot).length < PROGRESS_SYNC_LIMITS.maxBytes);
});

test("invalid or oversized snapshots fail closed and never revive custom ids", () => {
  assert.equal(normalizeProgressSnapshot({ version: 99 }), undefined);
  const snapshot = normalizeProgressSnapshot({
    version: 1,
    revision: 3,
    updatedAt: "2026-08-20T12:04:00.000Z",
    attempts: [attempt("attempt-1", { itemId: "custom:secret" })],
    typingProgress: { version: 1, revision: 0, updatedAt: "2026-08-20T12:04:00.000Z" },
    learningEvents: [],
  });
  assert.ok(snapshot);
  assert.deepEqual(snapshot.attempts, []);
  assert.equal(
    normalizeProgressSnapshot({
      version: 1,
      revision: 1,
      updatedAt: "2026-08-20T12:04:00.000Z",
      attempts: [],
      learningEvents: [],
      favorites: [],
      privateSource: "x".repeat(PROGRESS_SYNC_LIMITS.maxBytes),
    }),
    undefined,
  );
});

test("merging progress snapshots unions evidence and remains source-free", () => {
  const left = createProgressSnapshot(
    { attempts: [attempt("attempt-a")] },
    { now: "2026-08-20T12:04:00.000Z" },
  );
  const right = createProgressSnapshot(
    {
      attempts: [
        attempt("attempt-b", {
          itemId: "swift:two-sum",
          practiceKind: "solving",
          completedAt: "2026-08-21T12:02:00.000Z",
        }),
      ],
    },
    { now: "2026-08-21T12:04:00.000Z" },
  );
  const merged = mergeProgressSnapshots(left, right, {
    now: "2026-08-22T12:04:00.000Z",
  });
  assert.deepEqual(
    merged.attempts.map((entry) => entry.id),
    ["attempt-a", "attempt-b"],
  );
  assert.equal(merged.revision, 1);
  assert.equal(merged.updatedAt, "2026-08-22T12:04:00.000Z");
  assert.equal("source" in merged, false);
});

test("progress fingerprints ignore transport revision and timestamps", () => {
  const first = createProgressSnapshot(
    { attempts: [attempt("attempt-fingerprint")] },
    { now: "2026-08-20T12:04:00.000Z" },
  );
  const second = {
    ...first,
    revision: 42,
    updatedAt: "2026-08-21T12:04:00.000Z",
  };
  assert.equal(progressSnapshotFingerprint(first), progressSnapshotFingerprint(second));
});

test("daily challenge dates stay day keys across private sync", () => {
  const snapshot = createProgressSnapshot(
    {
      attempts: [attempt("attempt-daily", { challengeDate: "2026-08-20" })],
    },
    { now: "2026-08-20T12:04:00.000Z" },
  );
  assert.equal(snapshot.attempts[0].challengeDate, "2026-08-20");
  const normalized = normalizeProgressSnapshot({
    ...snapshot,
    attempts: [
      attempt("attempt-daily", { challengeDate: "2026-02-30" }),
    ],
  });
  assert.equal(normalized.attempts[0].challengeDate, undefined);
});
