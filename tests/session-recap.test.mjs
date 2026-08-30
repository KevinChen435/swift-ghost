import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSessionRecap,
  buildSessionReplayQueue,
  normalizeSessionHistoryEntries,
} from "../app/lib/session-recap.mjs";
import { rebuildTypingProgression } from "../app/lib/typing-progression.mjs";

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

test("session recaps distinguish guided typing success from independent recall", () => {
  const progressionRecord = {
    ...record,
    completed: 3,
    total: 3,
    entries: [
      {
        itemId: "swift:window",
        itemRevision: 2,
        stage: 1,
        status: "completed",
        practiceKind: "typing",
        attemptId: "worked-typing",
      },
      {
        itemId: "swift:window",
        itemRevision: 2,
        stage: 3,
        status: "completed",
        practiceKind: "typing",
        attemptId: "guided-typing",
      },
      {
        itemId: "swift:window",
        itemRevision: 2,
        stage: 5,
        status: "completed",
        practiceKind: "typing",
        attemptId: "independent-recall",
      },
    ],
  };
  const recap = buildSessionRecap(
    progressionRecord,
    [
      {
        ...attempts[1],
        id: "worked-typing",
        stage: 1,
        qualification: "syntax",
        accuracy: 100,
        corrections: 0,
        completedAt: "2026-07-28T10:01:00.000Z",
      },
      {
        ...attempts[1],
        id: "guided-typing",
        stage: 3,
        qualification: "guided",
        accuracy: 100,
        corrections: 0,
        completedAt: "2026-07-28T10:02:00.000Z",
      },
      {
        ...attempts[1],
        id: "independent-recall",
        stage: 5,
        qualification: "independent",
        accuracy: 99,
        corrections: 0,
        completedAt: "2026-07-28T10:03:00.000Z",
      },
    ],
    items,
  );

  assert.equal(recap.strongCount, 1);
  assert.equal(recap.weakCount, 2);
  assert.equal(recap.entries[0].needsRetry, true);
  assert.equal(recap.entries[1].needsRetry, true);
  assert.equal(recap.entries[2].needsRetry, false);
});

test("session recaps keep a direct Stage 5 diagnostic weak after ordered ownership", () => {
  const typingAttempts = [
    {
      ...attempts[1],
      id: "direct-stage-five",
      stage: 5,
      qualification: "independent",
      accuracy: 100,
      corrections: 0,
      completedAt: "2026-07-28T10:01:00.000Z",
    },
    {
      ...attempts[1],
      id: "ordered-worked",
      stage: 1,
      qualification: "syntax",
      accuracy: 100,
      corrections: 0,
      completedAt: "2026-07-28T10:02:00.000Z",
    },
    {
      ...attempts[1],
      id: "ordered-faded",
      stage: 3,
      qualification: "guided",
      accuracy: 100,
      corrections: 0,
      completedAt: "2026-07-28T10:03:00.000Z",
    },
    {
      ...attempts[1],
      id: "ordered-owned-recall",
      stage: 5,
      qualification: "independent",
      accuracy: 100,
      corrections: 0,
      completedAt: "2026-07-28T10:04:00.000Z",
    },
  ];
  const progression = rebuildTypingProgression(typingAttempts, {
    revisions: new Map([["swift:window", 2]]),
  });
  const progressionRecord = {
    ...record,
    completed: 2,
    total: 2,
    entries: [
      {
        itemId: "swift:window",
        itemRevision: 2,
        stage: 5,
        status: "completed",
        practiceKind: "typing",
        attemptId: "direct-stage-five",
      },
      {
        itemId: "swift:window",
        itemRevision: 2,
        stage: 5,
        status: "completed",
        practiceKind: "typing",
        attemptId: "ordered-owned-recall",
      },
    ],
  };

  const recap = buildSessionRecap(
    progressionRecord,
    typingAttempts,
    items,
    progression,
  );
  assert.equal(recap.strongCount, 1);
  assert.equal(recap.weakCount, 1);
  assert.equal(recap.entries[0].diagnosticBypass, true);
  assert.match(recap.entries[0].evidence, /^Diagnostic only/);
  assert.equal(recap.entries[0].needsRetry, true);
  assert.equal(recap.entries[1].diagnosticBypass, false);
  assert.equal(recap.entries[1].needsRetry, false);

  const mixedRecap = buildSessionRecap(record, attempts, items, progression);
  assert.equal(mixedRecap.solving.accepted, 1);
  assert.equal(mixedRecap.concept.strong, 1);

  const weak = buildSessionReplayQueue(
    progressionRecord,
    typingAttempts,
    items,
    "weak",
    progression,
  );
  assert.deepEqual(weak.map((entry) => entry.itemId), ["swift:window"]);
});

test("session recaps rebuild missing typing progression and fail closed on direct Stage 5", () => {
  const directAttempt = {
    ...attempts[1],
    id: "direct-without-workspace",
    stage: 5,
    qualification: "independent",
    accuracy: 100,
    corrections: 0,
    completedAt: "2026-07-28T10:01:00.000Z",
  };
  const directRecord = {
    ...record,
    completed: 1,
    total: 1,
    entries: [
      {
        itemId: "swift:window",
        itemRevision: 2,
        stage: 5,
        status: "completed",
        practiceKind: "typing",
        attemptId: directAttempt.id,
      },
    ],
  };

  const recap = buildSessionRecap(directRecord, [directAttempt], items);
  assert.equal(recap.strongCount, 0);
  assert.equal(recap.weakCount, 1);
  assert.equal(recap.entries[0].diagnosticBypass, true);
  assert.equal(recap.entries[0].needsRetry, true);
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

test("replay preserves solving for server-judged Swift in all and weak queues", () => {
  const serverSwift = {
    itemId: "swift:two-sum",
    title: "Two Sum in Swift",
    contentRevision: 1,
    language: "swift",
    track: "interview",
    source: "builtin",
    solveCapability: "server",
    trustedChallengeKey: "swift-two-sum",
  };
  const weakServerSwift = {
    ...serverSwift,
    itemId: "swift:valid-parentheses",
    title: "Valid Parentheses in Swift",
    trustedChallengeKey: "swift-valid-parentheses",
  };
  const serverRecord = {
    ...record,
    completed: 4,
    total: 4,
    entries: [
      {
        itemId: serverSwift.itemId,
        itemRevision: serverSwift.contentRevision,
        stage: 5,
        status: "completed",
        practiceKind: "solving",
        attemptId: "attempt-swift-solve",
      },
      {
        itemId: weakServerSwift.itemId,
        itemRevision: weakServerSwift.contentRevision,
        stage: 5,
        status: "completed",
        practiceKind: "solving",
        attemptId: "attempt-swift-weak",
      },
      {
        itemId: "python:hash",
        itemRevision: 4,
        stage: 5,
        status: "completed",
        practiceKind: "solving",
        attemptId: "attempt-python-solve",
      },
      {
        itemId: "ios:actor",
        itemRevision: 3,
        stage: 5,
        status: "completed",
        practiceKind: "concept",
        attemptId: "attempt-ios-concept",
      },
    ],
  };
  const replayAttempts = [
    {
      ...attempts[0],
      id: "attempt-swift-solve",
      itemId: serverSwift.itemId,
      itemRevision: serverSwift.contentRevision,
      practiceKind: "solving",
      verification: { passed: 2, total: 2 },
    },
    {
      ...attempts[0],
      id: "attempt-swift-weak",
      itemId: weakServerSwift.itemId,
      itemRevision: weakServerSwift.contentRevision,
      practiceKind: "solving",
      verification: { passed: 1, total: 2 },
    },
    {
      ...attempts[0],
      id: "attempt-python-solve",
      itemId: "python:hash",
      itemRevision: 4,
      practiceKind: "solving",
      verification: { passed: 3, total: 3 },
    },
    {
      ...attempts[2],
      id: "attempt-ios-concept",
      itemId: "ios:actor",
      itemRevision: 3,
      practiceKind: "concept",
      conceptGrade: "good",
    },
  ];
  const replayItems = [serverSwift, weakServerSwift, items[0], items[2]];
  const replay = buildSessionReplayQueue(serverRecord, replayAttempts, replayItems);
  assert.deepEqual(
    replay.map((entry) => [entry.itemId, entry.practiceKind, entry.stage]),
    [
      [serverSwift.itemId, "solving", 5],
      [weakServerSwift.itemId, "solving", 5],
      ["python:hash", "solving", 5],
      ["ios:actor", "concept", 5],
    ],
  );
  assert.deepEqual(
    buildSessionReplayQueue(serverRecord, replayAttempts, replayItems, "weak")
      .map((entry) => [entry.itemId, entry.practiceKind, entry.stage]),
    [[weakServerSwift.itemId, "solving", 5]],
  );
});

test("legacy aggregate-only records stay readable but cannot fabricate a replay queue", () => {
  const legacy = { ...record, entries: undefined };
  const recap = buildSessionRecap(legacy, attempts, items);
  assert.equal(recap.hasEntryDetail, false);
  assert.deepEqual(buildSessionReplayQueue(legacy, attempts, items), []);
});

test("current state persists session snapshots while retaining the complete fallback chain", async () => {
  const product = await readFile(new URL("../app/lib/product.ts", import.meta.url), "utf8");
  const app = await readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8");
  const recapUi = await readFile(new URL("../app/components/SessionRecap.tsx", import.meta.url), "utf8");
  assert.match(product, /version: 35;/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v35"/);
  assert.match(product, /THIRTY_SECOND_STORAGE_KEY = "swift-ghost-state-v32"/);
  assert.match(product, /THIRTY_FIRST_STORAGE_KEY = "swift-ghost-state-v31"/);
  assert.match(product, /THIRTIETH_STORAGE_KEY = "swift-ghost-state-v30"/);
  assert.match(product, /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+THIRTY_FOURTH_STORAGE_KEY,\s+THIRTY_THIRD_STORAGE_KEY,\s+THIRTY_SECOND_STORAGE_KEY,\s+THIRTY_FIRST_STORAGE_KEY,\s+THIRTIETH_STORAGE_KEY,\s+TWENTY_NINTH_STORAGE_KEY/);
  assert.match(product, /TWENTY_SIXTH_STORAGE_KEY = "swift-ghost-state-v26"/);
  assert.match(product, /entries\?: SessionQueueEntry\[\]/);
  assert.match(product, /kind === "practice" && stateVersion >= 27[\s\S]*normalizeSessionHistoryEntries\(raw\.entries\)/);
  assert.match(app, /entries: entries\.slice\(0, 20\)\.map/);
  assert.match(app, /currentSessionEntry\(\s*current\.activeSession[\s\S]*sessionEntryIdentity\(active\)/);
  assert.match(app, /index === draftSessionBinding\.index[\s\S]*attemptId: attempt\.id/);
  assert.match(app, /sessionHistoryRecord\(\s*archivedSession,\s*archivedEntries,\s*"ended",\s*endedAt,\s*\)/);
  assert.match(app, /buildSessionReplayQueue\(\s*record,\s*current\.attempts,\s*curriculumItems,\s*mode,\s*current\.typingProgress,\s*\)/);
  assert.match(recapUi, /buildSessionRecap\(record, state\.attempts, items, state\.typingProgress\)/);
  assert.match(recapUi, /Retry weak items/);
  assert.match(recapUi, /Replay available set/);
});
