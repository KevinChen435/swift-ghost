import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCommunityComparability,
  buildLeaderboardPreview,
  compareLeaderboardEntries,
  computeTrustedWpm,
  orderLeaderboardEntries,
} from "../app/lib/competitive.mjs";

const item = {
  itemId: "python:1",
  source: "builtin",
  contentRevision: 2,
  code: "x".repeat(250),
};

const attempt = {
  itemId: "python:1",
  itemRevision: 2,
  outcome: "completed",
  mode: "strict",
  stage: 5,
  peeks: 0,
  accuracy: 98,
  durationMs: 60_000,
  completedAt: "2026-07-26T07:00:00.000Z",
  // Deliberately untrusted values; neither may influence canonical WPM.
  totalKeystrokes: 50_000,
  wpm: 999,
};

function entry(displayName, overrides = {}) {
  return {
    user: { displayName },
    wpm: 50,
    accuracy: 98,
    durationMs: 60_000,
    completedAt: "2026-07-26T06:00:00.000Z",
    stage: 5,
    itemRevision: 2,
    ...overrides,
  };
}

test("trusted WPM uses only canonical source length and duration", () => {
  assert.equal(computeTrustedWpm(250, 60_000), 50);
  assert.equal(computeTrustedWpm(251, 60_000), 50.2);
  assert.equal(computeTrustedWpm(0, 60_000), null);
  assert.equal(computeTrustedWpm(250, 0), null);

  const assessed = assessCommunityComparability(attempt, item);
  assert.equal(assessed.eligible, true);
  assert.equal(assessed.trustedWpm, 50);
  assert.equal(assessed.activity, "recall");
});

test("comparability requires a current built-in completed strict typing or recall pass", () => {
  const cases = [
    [{ ...item, source: "custom" }, attempt, "not-built-in"],
    [item, { ...attempt, itemId: "python:2" }, "different-item"],
    [item, { ...attempt, itemRevision: 1 }, "stale-revision"],
    [item, { ...attempt, outcome: "abandoned" }, "incomplete"],
    [item, { ...attempt, mode: "free" }, "not-strict"],
    [item, { ...attempt, stage: 0 }, "not-typing-or-recall"],
    [item, { ...attempt, activity: "solve" }, "not-typing-or-recall"],
  ];
  for (const [candidateItem, candidateAttempt, reason] of cases) {
    assert.deepEqual(
      assessCommunityComparability(candidateAttempt, candidateItem).reason,
      reason,
    );
  }
});

test("assisted, inaccurate, malformed, or physically implausible runs are ineligible", () => {
  const cases = [
    [{ ...attempt, peeks: 1 }, item, "assisted"],
    [{ ...attempt, accuracy: 94.99 }, item, "low-accuracy"],
    [attempt, { ...item, code: "tiny" }, "implausible-characters"],
    [{ ...attempt, durationMs: 999 }, item, "implausible-duration"],
    [
      { ...attempt, durationMs: 1_000 },
      { ...item, code: "x".repeat(30_000) },
      "implausible-speed",
    ],
    [{ ...attempt, completedAt: "not-a-date" }, item, "invalid-completed-at"],
  ];
  for (const [candidateAttempt, candidateItem, reason] of cases) {
    assert.equal(
      assessCommunityComparability(candidateAttempt, candidateItem).reason,
      reason,
    );
  }
});

test("leaderboard ordering follows WPM, accuracy, duration, and completion time", () => {
  const rows = [
    entry("Later", { completedAt: "2026-07-26T07:00:00.000Z" }),
    entry("Longer", { durationMs: 61_000 }),
    entry("Less accurate", { accuracy: 97 }),
    entry("Faster", { wpm: 51 }),
    entry("Earlier"),
  ];
  assert.deepEqual(
    orderLeaderboardEntries(rows).map((row) => row.user.displayName),
    ["Faster", "Earlier", "Later", "Longer", "Less accurate"],
  );
  assert.ok(compareLeaderboardEntries(rows[3], rows[0]) < 0);
  assert.deepEqual(
    rows.map((row) => row.user.displayName),
    ["Later", "Longer", "Less accurate", "Faster", "Earlier"],
  );
});

test("ineligible and empty previews are explicit and never claim a rank", () => {
  const ineligible = buildLeaderboardPreview({
    attempt: { ...attempt, peeks: 1 },
    item,
    entries: [entry("One")],
  });
  assert.equal(ineligible.kind, "ineligible");
  assert.equal(ineligible.assessment.reason, "assisted");
  assert.equal("rank" in ineligible, false);

  const empty = buildLeaderboardPreview({ attempt, item, entries: [] });
  assert.equal(empty.kind, "empty");
  assert.equal(empty.context.length, 1);
  assert.equal(empty.context[0].kind, "attempt");
  assert.equal("rank" in empty.candidate, false);
});

test("top-window preview shows only a bounded visible relationship", () => {
  const preview = buildLeaderboardPreview({
    attempt,
    item,
    contextSize: 3,
    entries: [
      entry("Fast", { wpm: 70 }),
      entry("Slow", { wpm: 40 }),
      entry("Wrong stage", { wpm: 999, stage: 1 }),
      entry("Stale revision", { wpm: 999, itemRevision: 1 }),
      entry("Missing stage", { wpm: 999, stage: undefined }),
      entry("Missing revision", { wpm: 999, itemRevision: undefined }),
    ],
  });
  assert.equal(preview.kind, "top-window");
  assert.equal(preview.visibleCount, 2);
  assert.equal(preview.aheadOfVisible, 1);
  assert.equal(preview.behindVisible, 1);
  assert.deepEqual(
    preview.context.map((row) =>
      row.kind === "attempt" ? "You" : row.displayName,
    ),
    ["Fast", "You", "Slow"],
  );
  assert.equal("rank" in preview, false);
  assert.equal("rank" in preview.candidate, false);
});

test("a run below the fetched window returns a cutoff, not a guessed rank", () => {
  const preview = buildLeaderboardPreview({
    attempt: { ...attempt, durationMs: 100_000 },
    item,
    contextSize: 99,
    entries: Array.from({ length: 20 }, (_, index) =>
      entry(`Learner ${index + 1}`, { wpm: 80 - index }),
    ),
  });
  assert.equal(preview.kind, "cutoff");
  assert.equal(preview.visibleCount, 20);
  assert.equal(preview.cutoff.displayName, "Learner 20");
  assert.equal(preview.context.at(-1).kind, "attempt");
  assert.equal(preview.context.length, 9);
  assert.equal("rank" in preview, false);

  const candidateOnly = buildLeaderboardPreview({
    attempt: { ...attempt, durationMs: 100_000 },
    item,
    contextSize: 1,
    entries: [entry("Faster", { wpm: 80 })],
  });
  assert.equal(candidateOnly.kind, "cutoff");
  assert.deepEqual(
    candidateOnly.context.map((row) => row.kind),
    ["attempt"],
  );
});
