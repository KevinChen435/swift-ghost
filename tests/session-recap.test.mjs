import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSessionRecap,
  buildSessionReplayQueue,
  normalizeSessionHistoryEntries,
} from "../app/lib/session-recap.mjs";

const items = [
  {
    itemId: "python:hash",
    title: "Hash lookup",
    contentRevision: 4,
    language: "python",
    track: "interview",
    source: "builtin",
    verification: { entrypoint: "solve", cases: [{}] },
  },
  {
    itemId: "swift:window",
    title: "Sliding window",
    contentRevision: 2,
    language: "swift",
    track: "interview",
    source: "builtin",
  },
  {
    itemId: "ios:actor",
    title: "Actor isolation",
    contentRevision: 3,
    language: "swift",
    track: "ios",
    source: "builtin",
    recallChecks: ["one", "two", "three"],
    conceptAnswers: ["a", "b", "c"],
  },
  {
    itemId: "transfer:sealed",
    title: "Sealed variant",
    contentRevision: 1,
    language: "python",
    track: "interview",
    source: "builtin",
    transfer: { id: "sealed" },
  },
];

const record = {
  id: "session-1",
  name: "Focused set",
  kind: "practice",
  startedAt: "2026-07-28T10:00:00.000Z",
  completedAt: "2026-07-28T10:20:00.000Z",
  completed: 3,
  total: 5,
  outcome: "ended",
  entries: [
    { itemId: "python:hash", itemRevision: 3, stage: 5, status: "completed", practiceKind: "solving", attemptId: "attempt-solve" },
    { itemId: "swift:window", itemRevision: 2, stage: 3, status: "completed", practiceKind: "typing", attemptId: "attempt-type" },
    { itemId: "ios:actor", itemRevision: 3, stage: 5, status: "completed", practiceKind: "concept", attemptId: "attempt-concept" },
    { itemId: "custom:removed", itemRevision: 8, stage: 4, status: "skipped", practiceKind: "typing" },
    { itemId: "transfer:sealed", itemRevision: 1, stage: 5, status: "pending", practiceKind: "solving" },
  ],
};

const attempts = [
  {
    id: "attempt-solve",
    sessionId: "session-1",
    itemId: "python:hash",
    itemRevision: 3,
    titleSnapshot: "Hash lookup v3",
    practiceKind: "solving",
    outcome: "completed",
    peeks: 0,
    verification: { passed: 8, total: 8 },
    durationMs: 600000,
  },
  {
    id: "attempt-type",
    sessionId: "session-1",
    itemId: "swift:window",
    itemRevision: 2,
    titleSnapshot: "Sliding window",
    practiceKind: "typing",
    outcome: "completed",
    peeks: 0,
    accuracy: 91,
    wpm: 37,
    durationMs: 300000,
  },
  {
    id: "attempt-concept",
    sessionId: "session-1",
    itemId: "ios:actor",
    itemRevision: 3,
    titleSnapshot: "Actor isolation",
    practiceKind: "concept",
    outcome: "completed",
    peeks: 0,
    conceptGrade: "good",
    durationMs: 180000,
  },
];

test("session history entry normalization is bounded, allowlisted, and snapshot-safe", () => {
  const normalized = normalizeSessionHistoryEntries([
    ...record.entries,
    { itemId: "../../bad", stage: 99, status: "owned", attemptId: "bad/id" },
    ...Array.from({ length: 30 }, (_, index) => ({
      itemId: `custom:${index}`,
      itemRevision: 0,
      stage: 99,
      status: "pending",
      practiceKind: "typing",
      rationale: "r".repeat(400),
      estimatedMinutes: 999,
    })),
  ]);
  assert.equal(normalized.length, 20);
  assert.equal(normalized.some((entry) => entry.itemId === "../../bad"), false);
  assert.equal(normalized[0].stage, 5);
  assert.equal(normalized[5].itemRevision, 1);
  assert.equal(normalized[5].stage, 5);
  assert.equal(normalized[5].rationale.length, 240);
  assert.equal(normalized[5].estimatedMinutes, 180);
});

test("recaps bind evidence by immutable session, item, revision, kind, and attempt id", () => {
  const recap = buildSessionRecap(record, [
    ...attempts,
    {
      ...attempts[1],
      id: "unreferenced-fast-attempt",
      accuracy: 100,
      wpm: 200,
    },
  ], items);
  assert.equal(recap.hasEntryDetail, true);
  assert.equal(recap.elapsedMs, 20 * 60_000);
  assert.equal(recap.strongCount, 2);
  assert.equal(recap.weakCount, 3);
  assert.equal(recap.weakAvailableCount, 1);
  assert.equal(recap.typing.averageWpm, 37);
  assert.equal(recap.typing.averageAccuracy, 91);
  assert.equal(recap.solving.accepted, 1);
  assert.equal(recap.concept.strong, 1);
  assert.equal(recap.entries[0].superseded, true);
  assert.equal(recap.entries[3].available, false);
});

test("a mismatched attempt id is disclosed instead of guessed from another record", () => {
  const mismatched = {
    ...record,
    entries: [{ ...record.entries[1], attemptId: "attempt-wrong-session" }],
  };
  const recap = buildSessionRecap(
    mismatched,
    [{ ...attempts[1], id: "attempt-wrong-session", sessionId: "session-2" }],
    items,
  );
  assert.equal(recap.entries[0].attempt, undefined);
  assert.equal(recap.entries[0].evidence, "Attempt detail unavailable");
  assert.equal(recap.entries[0].needsRetry, true);
});

test("a linked abandoned attempt is reported as started work, not an unreached item", () => {
  const abandoned = {
    ...record,
    completed: 0,
    total: 1,
    entries: [
      {
        itemId: "swift:window",
        itemRevision: 2,
        stage: 3,
        status: "pending",
        practiceKind: "typing",
        attemptId: "attempt-abandoned",
      },
    ],
  };
  const recap = buildSessionRecap(
    abandoned,
    [
      {
        ...attempts[1],
        id: "attempt-abandoned",
        outcome: "abandoned",
      },
    ],
    items,
  );
  assert.equal(recap.entries[0].evidence, "Ended before completion");
  assert.equal(recap.entries[0].needsRetry, true);
});

test("a skipped item preserves evidence that the learner started it", () => {
  const skipped = {
    ...record,
    completed: 0,
    total: 1,
    entries: [
      {
        itemId: "swift:window",
        itemRevision: 2,
        stage: 3,
        status: "skipped",
        practiceKind: "typing",
        attemptId: "attempt-skipped",
      },
    ],
  };
  const recap = buildSessionRecap(
    skipped,
    [
      {
        ...attempts[1],
        id: "attempt-skipped",
        outcome: "abandoned",
      },
    ],
    items,
  );
  assert.equal(
    recap.entries[0].evidence,
    "Skipped after starting · ended before completion",
  );
  assert.equal(recap.entries[0].needsRetry, true);
});

test("targeted replay keeps order, uses current revisions, and drops unavailable or sealed items", () => {
  const all = buildSessionReplayQueue(record, attempts, items, "all");
  assert.deepEqual(
    all.map((entry) => [entry.itemId, entry.itemRevision, entry.stage, entry.status, entry.practiceKind]),
    [
      ["python:hash", 4, 5, "pending", "solving"],
      ["swift:window", 2, 3, "pending", "typing"],
      ["ios:actor", 3, 5, "pending", "concept"],
    ],
  );
  assert.equal(all.some((entry) => entry.attemptId), false);
  const weak = buildSessionReplayQueue(record, attempts, items, "weak");
  assert.deepEqual(weak.map((entry) => entry.itemId), ["swift:window"]);
});

test("legacy aggregate-only records stay readable but cannot fabricate a replay queue", () => {
  const legacy = { ...record, entries: undefined };
  const recap = buildSessionRecap(legacy, attempts, items);
  assert.equal(recap.hasEntryDetail, false);
  assert.deepEqual(buildSessionReplayQueue(legacy, attempts, items), []);
});

test("state v27 persists session snapshots while retaining the complete v26 fallback", async () => {
  const product = await readFile(new URL("../app/lib/product.ts", import.meta.url), "utf8");
  const app = await readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8");
  const recapUi = await readFile(new URL("../app/components/SessionRecap.tsx", import.meta.url), "utf8");
  assert.match(product, /version: 27;/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v27"/);
  assert.match(product, /TWENTY_SIXTH_STORAGE_KEY = "swift-ghost-state-v26"/);
  assert.match(product, /entries\?: SessionQueueEntry\[\]/);
  assert.match(product, /kind === "practice" && stateVersion >= 27[\s\S]*normalizeSessionHistoryEntries\(raw\.entries\)/);
  assert.match(app, /entries: entries\.slice\(0, 20\)\.map/);
  assert.match(app, /entry\.itemId === active\.itemId[\s\S]*attemptId: attempt\.id/);
  assert.match(app, /sessionHistoryRecord\(archivedSession, archivedEntries, "ended"\)/);
  assert.match(recapUi, /Retry weak items/);
  assert.match(recapUi, /Replay available set/);
});
