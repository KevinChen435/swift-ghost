import assert from "node:assert/strict";
import test from "node:test";
import {
  VIRTUAL_ROUND_LIMITS,
  VIRTUAL_ROUND_PRESETS,
  VIRTUAL_ROUND_WRONG_PENALTY_MS,
  archiveVirtualRound,
  createVirtualRoundWorkspace,
  deriveVirtualRoundProblemScore,
  deriveVirtualRoundReport,
  deriveVirtualRoundScore,
  expireVirtualRound,
  finishVirtualRound,
  normalizeVirtualRoundWorkspace,
  openVirtualRoundProblem,
  requestVirtualRoundSubmission,
  selectVirtualRoundItems,
  settleVirtualRoundSubmission,
  startVirtualRound,
  toggleVirtualRoundFlag,
  updateVirtualRoundSource,
  virtualRoundProblemStatus,
  virtualRoundRemainingMs,
} from "../app/lib/virtual-rounds.mjs";

const START = "2026-07-28T12:00:00.000Z";

function problem(index, difficulty = ["Easy", "Medium", "Hard", "Medium"][index]) {
  return {
    itemId: `problem-${index + 1}`,
    itemRevision: index + 1,
    verificationRevision: index + 10,
    title: `Problem ${index + 1}`,
    pattern: ["Arrays", "Graphs", "Trees", "Dynamic programming"][index],
    difficulty,
    starterSource: `def solve_${index + 1}():\n    pass`,
  };
}

function start(presetId = "sprint", id = `round-${presetId}`) {
  const preset = VIRTUAL_ROUND_PRESETS.find((entry) => entry.id === presetId);
  return startVirtualRound(
    createVirtualRoundWorkspace(),
    presetId,
    Array.from({ length: preset.problemCount }, (_, index) => problem(index)),
    { id, now: START },
  );
}

function request(workspace, itemId, id, requestedAt, source = "def answer():\n    return 1") {
  return requestVirtualRoundSubmission(workspace, workspace.active.id, itemId, {
    id,
    requestedAt,
    source,
  });
}

function settle(workspace, id, input) {
  return settleVirtualRoundSubmission(workspace, workspace.active.id, id, {
    judgedAt: input.judgedAt ?? "2026-07-28T12:10:01.000Z",
    status: input.status,
    passed: input.passed,
    total: input.total,
    durationMs: input.durationMs ?? 25,
  });
}

test("presets expose the fixed 45/75/105 minute two-to-four problem contract", () => {
  assert.deepEqual(
    VIRTUAL_ROUND_PRESETS.map(({ id, durationMinutes, problemCount }) => ({
      id,
      durationMinutes,
      problemCount,
    })),
    [
      { id: "sprint", durationMinutes: 45, problemCount: 2 },
      { id: "standard", durationMinutes: 75, problemCount: 3 },
      { id: "endurance", durationMinutes: 105, problemCount: 4 },
    ],
  );
});

test("selection is deterministic, difficulty-balanced, pattern-diverse, and least-proven first", () => {
  const candidates = [
    { itemId: "easy-owned", difficulty: "Easy", pattern: "Arrays", independentSolves: 5 },
    { itemId: "easy-new", difficulty: "Easy", pattern: "Strings", independentSolves: 0 },
    { itemId: "medium-arrays", difficulty: "Medium", pattern: "Arrays", independentSolves: 0 },
    { itemId: "medium-strings", difficulty: "Medium", pattern: "Strings", independentSolves: 0 },
    { itemId: "hard-graphs", difficulty: "Hard", pattern: "Graphs", independentSolves: 0 },
  ];
  const selected = selectVirtualRoundItems(candidates, 3);
  assert.deepEqual(selected.map((entry) => entry.itemId), [
    "easy-new",
    "medium-arrays",
    "hard-graphs",
  ]);
  assert.deepEqual(selectVirtualRoundItems([...candidates].reverse(), 3), selected);
  assert.deepEqual(selectVirtualRoundItems(candidates, 6), []);
});

test("start freezes problem identity and source while revealing only the first problem", () => {
  const workspace = start("standard");
  assert.equal(workspace.active.status, "active");
  assert.equal(workspace.active.currentProblemId, "problem-1");
  assert.equal(workspace.active.problems[0].openedAt, START);
  assert.equal(workspace.active.problems[1].openedAt, undefined);
  assert.equal(workspace.active.problems[1].title, "Problem 2");
  assert.equal(workspace.active.problems[1].source, problem(1).starterSource);
  assert.equal(
    workspace.active.endsAt,
    "2026-07-28T13:15:00.000Z",
  );
});

test("free switching, flags, and source snapshots are immutable transitions", () => {
  const original = start();
  const opened = openVirtualRoundProblem(original, original.active.id, "problem-2", {
    now: "2026-07-28T12:03:00.000Z",
  });
  const flagged = toggleVirtualRoundFlag(opened, opened.active.id, "problem-2");
  const edited = updateVirtualRoundSource(
    flagged,
    flagged.active.id,
    "problem-2",
    "def solve_2():\n    return 2",
  );
  assert.equal(original.active.currentProblemId, "problem-1");
  assert.equal(original.active.problems[1].openedAt, undefined);
  assert.equal(edited.active.currentProblemId, "problem-2");
  assert.equal(edited.active.problems[1].flagged, true);
  assert.match(edited.active.problems[1].source, /return 2/);
});

test("source bounds are byte-accurate and normalization never creates replacement characters", () => {
  const workspace = start();
  const exact = "x".repeat(VIRTUAL_ROUND_LIMITS.maxSourceBytes);
  const updated = updateVirtualRoundSource(
    workspace,
    workspace.active.id,
    "problem-1",
    exact,
  );
  assert.equal(new TextEncoder().encode(updated.active.problems[0].source).byteLength, VIRTUAL_ROUND_LIMITS.maxSourceBytes);
  assert.throws(
    () =>
      updateVirtualRoundSource(
        workspace,
        workspace.active.id,
        "problem-1",
        `${exact}x`,
      ),
    /size limit/i,
  );
  const hostile = JSON.parse(JSON.stringify(workspace));
  hostile.active.problems[0].source = "€".repeat(VIRTUAL_ROUND_LIMITS.maxSourceBytes);
  const normalized = normalizeVirtualRoundWorkspace(hostile, { now: START });
  assert.ok(
    new TextEncoder().encode(normalized.active.problems[0].source).byteLength <=
      VIRTUAL_ROUND_LIMITS.maxSourceBytes,
  );
  assert.equal(normalized.active.problems[0].source.includes("�"), false);
});

test("a request at the deadline is eligible, while one millisecond late is rejected", () => {
  const workspace = start();
  const onTime = request(
    workspace,
    "problem-1",
    "on-time",
    workspace.active.endsAt,
  );
  assert.equal(onTime.active.problems[0].submissions[0].status, "pending");
  assert.throws(
    () => request(workspace, "problem-1", "late", "2026-07-28T12:45:00.001Z"),
    /deadline passed/i,
  );
  assert.throws(
    () => request(workspace, "problem-1", "early", "2026-07-28T11:59:59.999Z"),
    /predates/i,
  );
});

test("pending receipts are persisted before judging and may settle after the deadline", () => {
  let workspace = request(
    start(),
    "problem-1",
    "submission-1",
    "2026-07-28T12:44:59.900Z",
  );
  workspace = finishVirtualRound(workspace, workspace.active.id, {
    now: workspace.active.endsAt,
    outcome: "expired",
  });
  assert.equal(workspace.active.status, "finalizing");
  workspace = settle(workspace, "submission-1", {
    judgedAt: "2026-07-28T12:45:03.000Z",
    status: "accepted",
    passed: 8,
    total: 8,
  });
  assert.equal(workspace.active, null);
  assert.equal(workspace.history[0].outcome, "expired");
  assert.equal(deriveVirtualRoundReport(workspace.history[0]).score, 100);
});

test("partial local score uses the best passed fraction and acceptance locks full points", () => {
  let workspace = request(start(), "problem-1", "partial-1", "2026-07-28T12:05:00.000Z");
  workspace = settle(workspace, "partial-1", {
    status: "wrong-answer",
    passed: 3,
    total: 8,
  });
  workspace = request(workspace, "problem-1", "partial-2", "2026-07-28T12:06:00.000Z");
  workspace = settle(workspace, "partial-2", {
    status: "wrong-answer",
    passed: 6,
    total: 8,
  });
  assert.equal(deriveVirtualRoundProblemScore(workspace.active.problems[0]), 75);
  assert.equal(virtualRoundProblemStatus(workspace.active.problems[0]), "partial");
  assert.deepEqual(deriveVirtualRoundScore(workspace.active), {
    score: 75,
    maxScore: 200,
    acceptedCount: 0,
  });
});

test("malformed accepted verdicts fail closed instead of minting full points", () => {
  let workspace = request(start(), "problem-1", "malformed-accepted", "2026-07-28T12:05:00.000Z");
  workspace = settle(workspace, "malformed-accepted", {
    status: "accepted",
    passed: 0,
    total: 0,
  });
  assert.equal(workspace.active.problems[0].submissions[0].status, "judge-error");
  assert.equal(deriveVirtualRoundProblemScore(workspace.active.problems[0]), 0);
});

test("five-minute wrong penalties apply only to solved problems", () => {
  let workspace = request(start(), "problem-1", "wrong-solved", "2026-07-28T12:02:00.000Z");
  workspace = settle(workspace, "wrong-solved", {
    status: "wrong-answer",
    passed: 2,
    total: 8,
  });
  workspace = request(workspace, "problem-1", "accepted", "2026-07-28T12:10:00.000Z");
  workspace = settle(workspace, "accepted", {
    status: "accepted",
    passed: 8,
    total: 8,
  });
  workspace = request(workspace, "problem-2", "wrong-unsolved", "2026-07-28T12:20:00.000Z");
  workspace = settle(workspace, "wrong-unsolved", {
    status: "wrong-answer",
    passed: 1,
    total: 8,
  });
  workspace = finishVirtualRound(workspace, workspace.active.id, {
    now: "2026-07-28T12:30:00.000Z",
    outcome: "submitted",
  });
  const report = deriveVirtualRoundReport(workspace.history[0]);
  assert.equal(report.penaltyMs, 10 * 60_000 + VIRTUAL_ROUND_WRONG_PENALTY_MS);
  assert.equal(report.problems[1].score, 12);
});

test("absolute countdown and expiry survive background time without interval arithmetic", () => {
  const workspace = start();
  assert.equal(virtualRoundRemainingMs(workspace.active, Date.parse(START)), 45 * 60_000);
  assert.equal(virtualRoundRemainingMs(workspace.active, Date.parse(workspace.active.endsAt)), 0);
  const early = expireVirtualRound(workspace, { now: "2026-07-28T12:44:59.999Z" });
  assert.equal(early.active.status, "active");
  const expired = expireVirtualRound(workspace, { now: workspace.active.endsAt });
  assert.equal(expired.active, null);
  assert.equal(expired.history[0].outcome, "expired");
});

test("normalization fails closed for orphan pending judgments and finalizes interrupted finalizing rounds", () => {
  let workspace = request(start(), "problem-1", "orphan", "2026-07-28T12:10:00.000Z");
  const recovered = normalizeVirtualRoundWorkspace(
    JSON.parse(JSON.stringify(workspace)),
    { now: "2026-07-28T12:11:00.000Z" },
  );
  assert.equal(recovered.active.problems[0].submissions[0].status, "judge-error");
  workspace = finishVirtualRound(workspace, workspace.active.id, {
    now: "2026-07-28T12:11:00.000Z",
    outcome: "submitted",
  });
  const finalized = normalizeVirtualRoundWorkspace(
    JSON.parse(JSON.stringify(workspace)),
    { now: "2026-07-28T12:12:00.000Z" },
  );
  assert.equal(finalized.active, null);
  assert.equal(finalized.history[0].problems[0].submissions[0].status, "judge-error");
});

test("selection rotates away from problems already used in retained rounds", () => {
  const candidates = [
    {
      itemId: "seen-easy",
      difficulty: "Easy",
      pattern: "Arrays",
      independentSolves: 0,
      roundAppearances: 3,
    },
    {
      itemId: "fresh-easy",
      difficulty: "Easy",
      pattern: "Strings",
      independentSolves: 0,
      roundAppearances: 0,
    },
    {
      itemId: "seen-medium",
      difficulty: "Medium",
      pattern: "Trees",
      independentSolves: 0,
      roundAppearances: 1,
    },
    {
      itemId: "fresh-medium",
      difficulty: "Medium",
      pattern: "Graphs",
      independentSolves: 0,
      roundAppearances: 0,
    },
  ];
  assert.deepEqual(
    selectVirtualRoundItems(candidates, 2).map((entry) => entry.itemId),
    ["fresh-easy", "fresh-medium"],
  );
});

test("normalization clamps imported round activity to the frozen clock window", () => {
  let workspace = request(
    start(),
    "problem-1",
    "late-import",
    "2026-07-28T12:10:00.000Z",
  );
  workspace = settle(workspace, "late-import", {
    judgedAt: "2026-07-28T12:10:01.000Z",
    status: "accepted",
    passed: 3,
    total: 3,
  });
  const imported = JSON.parse(JSON.stringify(workspace));
  imported.active.problems[0].openedAt = "2026-07-28T11:00:00.000Z";
  imported.active.problems[0].submissions[0].requestedAt =
    "2026-07-28T14:00:00.000Z";
  const normalized = normalizeVirtualRoundWorkspace(imported, {
    now: "2026-07-28T12:20:00.000Z",
  });
  assert.equal(normalized.active.problems[0].openedAt, START);
  assert.equal(
    normalized.active.problems[0].submissions[0].requestedAt,
    normalized.active.endsAt,
  );
});

test("normalization expires an active round when its frozen judge revision changed", () => {
  const workspace = start();
  const normalized = normalizeVirtualRoundWorkspace(
    JSON.parse(JSON.stringify(workspace)),
    {
      now: "2026-07-28T12:20:00.000Z",
      validItemIds: new Set(["problem-1", "problem-2"]),
      revisions: new Map([
        ["problem-1", 1],
        ["problem-2", 2],
      ]),
      verificationRevisions: new Map([
        ["problem-1", 999],
        ["problem-2", 11],
      ]),
    },
  );
  assert.equal(normalized.active, null);
  assert.equal(normalized.history[0].outcome, "expired");
});

test("normalization is bounded, strips unknown keys, and is idempotent", () => {
  const histories = Array.from({ length: 40 }, (_, index) => {
    const finished = finishVirtualRound(start("sprint", `history-${index}`), `history-${index}`, {
      now: "2026-07-28T12:20:00.000Z",
      outcome: "submitted",
    }).history[0];
    return { ...finished, unknown: "drop-me" };
  });
  const normalized = normalizeVirtualRoundWorkspace(
    { version: 99, active: null, history: histories, unknown: true },
    { now: START },
  );
  assert.equal(normalized.history.length, 12);
  assert.equal("unknown" in normalized.history[0], false);
  assert.deepEqual(
    normalizeVirtualRoundWorkspace(JSON.parse(JSON.stringify(normalized)), { now: START }),
    normalized,
  );
});

test("archive preserves the immutable report evidence", () => {
  let workspace = finishVirtualRound(start(), "round-sprint", {
    now: "2026-07-28T12:20:00.000Z",
    outcome: "submitted",
  });
  const before = deriveVirtualRoundReport(workspace.history[0]);
  workspace = archiveVirtualRound(workspace, "round-sprint");
  const after = deriveVirtualRoundReport(workspace.history[0]);
  assert.equal(after.status, "archived");
  assert.deepEqual(after.problems, before.problems);
  assert.equal(after.score, before.score);
});
