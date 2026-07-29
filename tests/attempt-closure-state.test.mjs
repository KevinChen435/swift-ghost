import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import {
  completeAttemptClosure,
  updateAttemptClosureDraft,
} from "../app/lib/attempt-closures.mjs";
import {
  createSubmissionLog,
  requestSubmission,
  settleSubmission,
} from "../app/lib/submission-log.mjs";

let bundledProductRuntime;

async function productRuntime() {
  if (!bundledProductRuntime) {
    bundledProductRuntime = build({
      entryPoints: [
        fileURLToPath(new URL("../app/lib/product.ts", import.meta.url)),
      ],
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      write: false,
      logLevel: "silent",
    }).then(({ outputFiles }) =>
      import(
        `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
      ),
    );
  }
  return bundledProductRuntime;
}

function solveAttempt(id, completedAt, overrides = {}) {
  return {
    id,
    itemId: "python:1",
    itemRevision: 1,
    titleSnapshot: "Two Sum",
    language: "python",
    stage: 5,
    practiceKind: "solving",
    mode: "strict",
    startedAt: completedAt,
    completedAt,
    durationMs: 60_000,
    totalKeystrokes: 10,
    correctKeystrokes: 10,
    rejectedKeystrokes: 0,
    corrections: 0,
    peeks: 0,
    rawWpm: 10,
    wpm: 10,
    accuracy: 100,
    consistency: 100,
    outcome: "completed",
    verification: { revision: 2, passed: 4, total: 4, runs: 1, submissions: 1 },
    ...overrides,
  };
}

function rawState(version, attempts, attemptClosures) {
  return {
    version,
    attempts,
    ...(attemptClosures ? { attemptClosures } : {}),
    settings: {},
    customItems: [],
    sessionHistory: [],
  };
}

test("v32 migration creates a v33 closure draft from current abandoned solve evidence", async () => {
  const { normalizeState } = await productRuntime();
  const abandoned = solveAttempt("abandoned-v32", "2026-07-20T12:00:00.000Z", {
    outcome: "abandoned",
    verification: undefined,
  });
  const normalized = normalizeState(rawState(32, [abandoned]));

  assert.equal(normalized.version, 33);
  assert.equal(normalized.attemptClosures.version, 1);
  assert.equal(normalized.attemptClosures.closures.length, 1);
  assert.deepEqual(
    {
      state: normalized.attemptClosures.closures[0].state,
      kind: normalized.attemptClosures.closures[0].anchor.kind,
      id: normalized.attemptClosures.closures[0].anchor.id,
      itemId: normalized.attemptClosures.closures[0].anchor.itemId,
    },
    {
      state: "draft",
      kind: "attempt",
      id: "abandoned-v32",
      itemId: "python:1",
    },
  );
});

test("v32 migration reconciles failed durable submission receipts into closures", async () => {
  const { normalizeState } = await productRuntime();
  let submissionLog = requestSubmission(createSubmissionLog(), {
    id: "failed-v32",
    itemId: "python:1",
    titleSnapshot: "Two Sum",
    language: "python",
    itemRevision: 1,
    requestedAt: "2026-07-20T12:00:00.000Z",
    source: "class Solution:\n    def twoSum(self, nums, target):\n        return []\n",
    judge: { kind: "browser-python-local", revision: 2 },
    context: { kind: "practice" },
    assistance: "none-recorded",
  });
  submissionLog = settleSubmission(submissionLog, "failed-v32", {
    settledAt: "2026-07-20T12:00:01.000Z",
    status: "wrong-answer",
    durationMs: 25,
    passed: 1,
    total: 4,
  });

  const normalized = normalizeState({
    ...rawState(32, []),
    submissionLog,
  });
  assert.equal(normalized.attemptClosures.closures.length, 1);
  assert.equal(
    normalized.attemptClosures.closures[0].id,
    "closure:submission:failed-v32",
  );
  assert.equal(
    normalized.attemptClosures.closures[0].anchor.outcome,
    "wrong-answer",
  );
});

test("v33 normalization preserves completed closure work and reconciles its evidence", async () => {
  const { normalizeState } = await productRuntime();
  const abandoned = solveAttempt("abandoned-v33", "2026-07-20T12:00:00.000Z", {
    outcome: "abandoned",
    verification: undefined,
  });
  const migrated = normalizeState(rawState(32, [abandoned]));
  const id = migrated.attemptClosures.closures[0].id;
  let workspace = updateAttemptClosureDraft(
    migrated.attemptClosures,
    id,
    {
      mistakeTags: ["boundary"],
      firstWrongDecision: "I skipped the duplicate-value boundary.",
      verificationNotes: "Trace duplicate complements before retrying.",
      teachBack: "Check the complement before storing the current index.",
      grade: "again",
    },
    { now: "2026-07-20T12:05:00.000Z" },
  );
  workspace = completeAttemptClosure(workspace, id, {
    now: "2026-07-20T12:06:00.000Z",
  });

  const normalized = normalizeState(rawState(33, [abandoned], workspace));
  assert.equal(normalized.attemptClosures.closures.length, 1);
  assert.equal(normalized.attemptClosures.closures[0].state, "completed");
  assert.deepEqual(normalized.attemptClosures.closures[0].mistakeTags, [
    "boundary",
  ]);
  assert.equal(
    normalized.attemptClosures.closures[0].completedAt,
    "2026-07-20T12:06:00.000Z",
  );
});

test("product review status uses gated solve progression while retaining a Date boundary", async () => {
  const { normalizeState, reviewStatus } = await productRuntime();
  const attempts = [
    solveAttempt("acquire", "2026-07-20T12:00:00.000Z"),
    solveAttempt("massed", "2026-07-20T13:00:00.000Z"),
    solveAttempt("early", "2026-07-21T11:00:00.000Z"),
  ];
  const normalized = normalizeState(rawState(32, attempts));
  const status = reviewStatus(normalized, "python:1");

  assert.equal(status.level, 1);
  assert.equal(status.dueAt instanceof Date, true);
  assert.equal(status.dueAt.toISOString(), "2026-07-21T12:00:00.000Z");
});
