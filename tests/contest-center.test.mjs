import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContestSummary,
  buildPersonalStandings,
  normalizeContestCenterSection,
  selectContestReport,
} from "../app/lib/contest-center.mjs";

function problem(id, submissions = [], pattern = "Hashing") {
  return {
    id,
    itemId: id,
    itemRevision: 1,
    verificationRevision: 1,
    title: id,
    pattern,
    difficulty: "Easy",
    starterSource: "def solve(): pass",
    source: "def solve(): return True",
    openedAt: "2026-07-28T10:00:00.000Z",
    flagged: false,
    submissions,
  };
}

function accepted(id, requestedAt) {
  return {
    id,
    requestedAt,
    judgedAt: requestedAt,
    status: "accepted",
    durationMs: 20,
    passed: 3,
    total: 3,
  };
}

function run({
  id,
  presetId = "sprint",
  finishedAt,
  acceptedAt,
  secondAcceptedAt,
  archived = false,
}) {
  return {
    version: 1,
    id,
    presetId,
    title: presetId === "standard" ? "Standard Round" : "Sprint Round",
    status: archived ? "archived" : "finished",
    startedAt: "2026-07-28T10:00:00.000Z",
    endsAt:
      presetId === "standard"
        ? "2026-07-28T11:15:00.000Z"
        : "2026-07-28T10:45:00.000Z",
    currentProblemId: `${id}-a`,
    problems: [
      problem(
        `${id}-a`,
        acceptedAt ? [accepted(`${id}-submission-a`, acceptedAt)] : [],
      ),
      problem(
        `${id}-b`,
        secondAcceptedAt
          ? [accepted(`${id}-submission-b`, secondAcceptedAt)]
          : [],
        "Two pointers",
      ),
      ...(presetId === "standard" ? [problem(`${id}-c`, [], "Graphs")] : []),
    ],
    finishedAt,
    outcome: "submitted",
  };
}

test("contest sections normalize to a safe overview default", () => {
  assert.equal(normalizeContestCenterSection("standings"), "standings");
  assert.equal(normalizeContestCenterSection("../../admin"), "overview");
  assert.equal(normalizeContestCenterSection(undefined), "overview");
});

test("personal standings rank within each format without mutating history", () => {
  const history = [
    run({
      id: "later",
      finishedAt: "2026-07-28T10:20:00.000Z",
      acceptedAt: "2026-07-28T10:10:00.000Z",
    }),
    run({
      id: "best",
      finishedAt: "2026-07-28T10:18:00.000Z",
      acceptedAt: "2026-07-28T10:05:00.000Z",
      secondAcceptedAt: "2026-07-28T10:15:00.000Z",
    }),
    run({
      id: "standard",
      presetId: "standard",
      finishedAt: "2026-07-28T10:30:00.000Z",
      acceptedAt: "2026-07-28T10:08:00.000Z",
    }),
  ];
  const originalIds = history.map((entry) => entry.id);
  const rows = buildPersonalStandings(history);
  assert.deepEqual(
    rows.map((entry) => [entry.presetId, entry.rank, entry.id]),
    [
      ["sprint", 1, "best"],
      ["sprint", 2, "later"],
      ["standard", 1, "standard"],
    ],
  );
  assert.deepEqual(history.map((entry) => entry.id), originalIds);
});

test("identical performance receives a shared competition rank", () => {
  const rows = buildPersonalStandings([
    run({
      id: "older",
      finishedAt: "2026-07-28T10:20:00.000Z",
      acceptedAt: "2026-07-28T10:05:00.000Z",
    }),
    run({
      id: "newer",
      finishedAt: "2026-07-28T10:20:00.000Z",
      acceptedAt: "2026-07-28T10:05:00.000Z",
      archived: true,
    }),
  ]);
  assert.deepEqual(rows.map((entry) => entry.rank), [1, 1]);
  assert.deepEqual(rows.map((entry) => entry.id), ["newer", "older"]);
  assert.equal(rows[0].archived, true);
});

test("summary derives recent, aggregate, preset, and weak-pattern evidence", () => {
  const summary = buildContestSummary([
    run({
      id: "partial",
      finishedAt: "2026-07-28T10:20:00.000Z",
      acceptedAt: "2026-07-28T10:05:00.000Z",
    }),
    run({
      id: "complete",
      finishedAt: "2026-07-29T10:20:00.000Z",
      acceptedAt: "2026-07-28T10:05:00.000Z",
      secondAcceptedAt: "2026-07-28T10:10:00.000Z",
    }),
  ]);
  assert.equal(summary.totalRounds, 2);
  assert.equal(summary.bestScorePercent, 100);
  assert.equal(summary.averageScorePercent, 75);
  assert.equal(summary.totalAccepted, 3);
  assert.equal(summary.totalProblems, 4);
  assert.equal(summary.latestRoundId, "complete");
  assert.equal(summary.strongestPreset.presetId, "sprint");
  assert.equal(summary.patternPerformance[0].pattern, "Two pointers");
});

test("report selection is exact and falls back to the latest retained report", () => {
  const older = run({
    id: "older",
    finishedAt: "2026-07-28T10:20:00.000Z",
    acceptedAt: "2026-07-28T10:05:00.000Z",
  });
  const newer = run({
    id: "newer",
    finishedAt: "2026-07-29T10:20:00.000Z",
    acceptedAt: "2026-07-28T10:06:00.000Z",
  });
  assert.equal(selectContestReport([older, newer], "older").id, "older");
  assert.equal(selectContestReport([older, newer], "missing").id, "newer");
  assert.equal(selectContestReport([], "missing"), null);
});
