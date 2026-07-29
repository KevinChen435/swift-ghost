import test from "node:test";
import assert from "node:assert/strict";
import {
  TYPING_PROGRESSION_ATTEMPT_LIMIT,
  TYPING_PROGRESSION_RECORD_LIMIT,
  TYPING_PROGRESSION_REFERENCE_LIMIT,
  applyTypingAttempt,
  createTypingProgression,
  deriveTypingProgression,
  isCleanTypingRecall,
  normalizeTypingProgression,
  rebuildTypingProgression,
  recommendedTypingStage,
  summarizeTypingProgression,
  typingReviewStatus,
  typingStagePhase,
} from "../app/lib/typing-progression.mjs";

const DAY = 86_400_000;

function at(day, hour = 12) {
  return new Date(Date.UTC(2026, 0, day, hour)).toISOString();
}

function attempt(id, stage, completedAt, overrides = {}) {
  return {
    id,
    itemId: "builtin:two-sum",
    itemRevision: 1,
    stage,
    practiceKind: "typing",
    outcome: "completed",
    qualification: stage === 5 ? "independent" : stage === 1 ? "syntax" : "guided",
    accuracy: 100,
    corrections: 0,
    peeks: 0,
    completedAt,
    ...overrides,
  };
}

function applyAll(attempts, options) {
  return attempts.reduce(
    (workspace, entry) => applyTypingAttempt(workspace, entry, options),
    createTypingProgression(at(1)),
  );
}

test("stage phases and the ordered worked-faded-recall chain are canonical", () => {
  assert.equal(typingStagePhase(1), "worked");
  assert.equal(typingStagePhase(2), "faded");
  assert.equal(typingStagePhase(4), "faded");
  assert.equal(typingStagePhase(5), "recall");
  assert.equal(typingStagePhase(99), null);

  let workspace = createTypingProgression(at(1));
  assert.equal(recommendedTypingStage(workspace, "builtin:two-sum", 1), 1);
  workspace = applyTypingAttempt(workspace, attempt("a1", 1, at(1)));
  assert.equal(recommendedTypingStage(workspace, "builtin:two-sum", 1), 2);
  workspace = applyTypingAttempt(workspace, attempt("a2", 2, at(1, 13)));
  assert.equal(recommendedTypingStage(workspace, "builtin:two-sum", 1), 3);
  workspace = applyTypingAttempt(workspace, attempt("a3", 3, at(1, 14)));
  assert.equal(recommendedTypingStage(workspace, "builtin:two-sum", 1), 4);
  workspace = applyTypingAttempt(workspace, attempt("a4", 4, at(1, 15)));
  assert.equal(recommendedTypingStage(workspace, "builtin:two-sum", 1), 5);
  workspace = applyTypingAttempt(workspace, attempt("a5", 5, at(1, 16)));

  const progress = deriveTypingProgression(workspace, "builtin:two-sum", 1, at(1, 17));
  assert.deepEqual(progress.completedStages, [1, 2, 3, 4, 5]);
  assert.deepEqual(progress.attemptIds, ["a1", "a2", "a3", "a4", "a5"]);
  assert.deepEqual(progress.attemptTimestamps, [at(1), at(1, 13), at(1, 14), at(1, 15), at(1, 16)]);
  assert.equal(progress.nextStage, 5);
  assert.equal(progress.phase, "recall");
  assert.equal(progress.owned, true);
  assert.equal(progress.recallLevel, 1);
});

test("direct stage 5 is retained as an explicit cold diagnostic, not ownership", () => {
  const workspace = applyTypingAttempt(
    createTypingProgression(at(1)),
    attempt("cold-1", 5, at(1), { corrections: 4 }),
  );
  const progress = deriveTypingProgression(workspace, "builtin:two-sum", 1, at(2));
  assert.equal(progress.owned, false);
  assert.equal(progress.retained, false);
  assert.equal(progress.recallLevel, 0);
  assert.equal(progress.nextStage, 1);
  assert.equal(progress.hasDiagnosticBypass, true);
  assert.equal(progress.diagnosticOnly, true);
  assert.deepEqual(progress.bypassAttemptIds, ["cold-1"]);
  assert.equal(typingReviewStatus(workspace, "builtin:two-sum", 1, at(2)).status, "diagnostic");
});

test("stage 1 plus any earlier faded stage permits ownership at stage 5", () => {
  const recall = attempt("recall", 5, at(1, 14), { corrections: 3, accuracy: 96 });
  assert.equal(isCleanTypingRecall(recall), true, "self-correction is diagnostic, not disqualifying");
  const workspace = applyAll([
    attempt("worked", 1, at(1)),
    attempt("faded-3", 3, at(1, 13)),
    recall,
  ]);
  const progress = deriveTypingProgression(workspace, "builtin:two-sum", 1, at(1, 15));
  assert.equal(progress.owned, true);
  assert.equal(progress.retained, true);
  assert.equal(progress.diagnosticOnly, false);
  assert.equal(progress.firstWorkedAt, at(1));
  assert.equal(progress.firstFadedAt, at(1, 13));
  assert.equal(progress.firstOwnedAt, at(1, 14));
  assert.equal(progress.dueAt, at(2, 14));
});

test("faded work must follow exposure before it can unlock recall ownership", () => {
  let workspace = applyAll([
    attempt("premature-fade", 3, at(1)),
    attempt("worked-later", 1, at(2)),
    attempt("blocked-recall", 5, at(3)),
  ]);
  let progress = deriveTypingProgression(workspace, "builtin:two-sum", 1, at(3, 13));
  assert.equal(progress.owned, false);
  assert.equal(progress.diagnosticOnly, true);
  assert.equal(progress.firstFadedAt, at(1));
  assert.equal(progress.firstEligibleFadedAt, null);

  workspace = applyTypingAttempt(workspace, attempt("ordered-fade", 4, at(4)));
  workspace = applyTypingAttempt(workspace, attempt("allowed-recall", 5, at(5)));
  progress = deriveTypingProgression(workspace, "builtin:two-sum", 1, at(5, 13));
  assert.equal(progress.owned, true);
  assert.equal(progress.firstEligibleFadedAt, at(4));
  assert.equal(progress.firstOwnedAt, at(5));
});

test("worked and guided completion never establishes a review schedule", () => {
  const workspace = applyAll([
    attempt("worked", 1, at(1)),
    attempt("fade-2", 2, at(1, 13)),
    attempt("fade-3", 3, at(2)),
    attempt("fade-4", 4, at(3)),
  ]);
  const progress = deriveTypingProgression(workspace, "builtin:two-sum", 1, at(30));
  assert.equal(progress.owned, false);
  assert.equal(progress.due, false);
  assert.equal(progress.dueAt, null);
  assert.equal(progress.recallLevel, 0);
  assert.equal(typingReviewStatus(workspace, "builtin:two-sum", 1, at(30)).status, "learning");
});

test("due stage 5 reviews advance exactly through 1, 3, 7, 14, and 30 day intervals", () => {
  let workspace = applyAll([
    attempt("worked", 1, at(1, 8)),
    attempt("faded", 2, at(1, 9)),
    attempt("own", 5, at(1, 10)),
  ]);
  let dueAt = at(2, 10);
  assert.equal(deriveTypingProgression(workspace, "builtin:two-sum", 1, at(2, 9)).due, false);
  assert.equal(deriveTypingProgression(workspace, "builtin:two-sum", 1, dueAt).due, true);

  const intervals = [3, 7, 14, 30];
  for (let index = 0; index < intervals.length; index += 1) {
    workspace = applyTypingAttempt(workspace, attempt(`review-${index}`, 5, dueAt));
    const progress = deriveTypingProgression(workspace, "builtin:two-sum", 1, dueAt);
    assert.equal(progress.recallLevel, index + 2);
    const expected = new Date(Date.parse(dueAt) + intervals[index] * DAY).toISOString();
    assert.equal(progress.dueAt, expected);
    dueAt = expected;
  }
  const retained = deriveTypingProgression(workspace, "builtin:two-sum", 1, dueAt);
  assert.equal(retained.recallLevel, 5);
  assert.equal(retained.due, true);
});

test("premature same-day success preserves both level and due date", () => {
  let workspace = applyAll([
    attempt("worked", 1, at(1, 8)),
    attempt("faded", 2, at(1, 9)),
    attempt("own", 5, at(1, 10)),
  ]);
  workspace = applyTypingAttempt(workspace, attempt("early-a", 5, at(1, 11)));
  workspace = applyTypingAttempt(workspace, attempt("early-b", 5, at(1, 12)));
  const progress = deriveTypingProgression(workspace, "builtin:two-sum", 1, at(1, 13));
  assert.equal(progress.recallLevel, 1);
  assert.equal(progress.dueAt, at(2, 10));
});

test("failure, assistance, peeking, and low accuracy lapse recall and return tomorrow", () => {
  const failures = [
    { id: "abandoned", outcome: "abandoned" },
    { id: "assisted", qualification: "assisted" },
    { id: "peeked", peeks: 1 },
    { id: "low", accuracy: 94.9 },
  ];
  for (const failure of failures) {
    let workspace = applyAll([
      attempt("worked", 1, at(1, 8)),
      attempt("faded", 2, at(1, 9)),
      attempt("own", 5, at(1, 10)),
    ]);
    workspace = applyTypingAttempt(workspace, attempt(failure.id, 5, at(2, 10), failure));
    const progress = deriveTypingProgression(workspace, "builtin:two-sum", 1, at(2, 11));
    assert.equal(progress.owned, true, failure.id);
    assert.equal(progress.retained, false, failure.id);
    assert.equal(progress.recallLevel, 1, failure.id);
    assert.equal(progress.lapses, 1, failure.id);
    assert.equal(progress.dueAt, at(3, 10), failure.id);
    assert.deepEqual(progress.completedStages.slice(0, 2), [1, 2], failure.id);
    assert.equal(typingReviewStatus(workspace, "builtin:two-sum", 1, at(2, 11)).status, "lapsed");
  }
});

test("a new item revision starts fresh and cannot inherit stale mastery", () => {
  let workspace = applyAll([
    attempt("worked-v1", 1, at(1, 8)),
    attempt("faded-v1", 2, at(1, 9)),
    attempt("own-v1", 5, at(1, 10)),
  ]);
  workspace = applyTypingAttempt(
    workspace,
    attempt("worked-v2", 1, at(2), { itemRevision: 2 }),
  );
  const current = deriveTypingProgression(workspace, "builtin:two-sum", 2, at(3));
  const stale = deriveTypingProgression(workspace, "builtin:two-sum", 1, at(3));
  assert.equal(current.owned, false);
  assert.deepEqual(current.completedStages, [1]);
  assert.equal(current.nextStage, 2);
  assert.equal(stale.owned, false);
  assert.deepEqual(stale.completedStages, []);
  assert.equal(workspace.attempts.some((entry) => entry.itemRevision === 1), false);
});

test("normalization is bounded, deduplicates, filters registries, and fails closed", () => {
  const valid = attempt("same", 1, at(1));
  const workspace = rebuildTypingProgression([valid, valid, { nope: true }], {
    validItemIds: ["builtin:two-sum"],
    revisions: { "builtin:two-sum": 1 },
  });
  assert.equal(workspace.attempts.length, 1);
  assert.equal(workspace.records[0].attemptCount, 1);
  assert.equal(applyTypingAttempt(workspace, valid).revision, workspace.revision);
  assert.deepEqual(normalizeTypingProgression({ version: 999 }), createTypingProgression());
  assert.equal(
    applyTypingAttempt(workspace, { ...valid, id: "bad id" }).revision,
    workspace.revision,
  );
  assert.equal(
    applyTypingAttempt(workspace, { ...valid, id: "wrong-rev", itemRevision: 2 }, {
      revisions: { "builtin:two-sum": 1 },
    }).revision,
    workspace.revision,
  );
  assert.equal(
    applyTypingAttempt(workspace, attempt("older", 5, at(0))).revision,
    workspace.revision,
    "stale events must use the sorted rebuild API instead of mutating a compact record",
  );

  const forged = normalizeTypingProgression({
    version: 1,
    revision: 1,
    updatedAt: at(1),
    records: [{
      itemId: "builtin:two-sum",
      itemRevision: 1,
      completedStages: [5],
      references: [],
      owned: true,
      retained: true,
      recallLevel: 5,
      dueAt: at(30),
      firstOwnedAt: at(1),
      updatedAt: at(1),
    }],
    attempts: [],
  });
  assert.equal(forged.records[0].owned, false);
  assert.equal(forged.records[0].recallLevel, 0);

  const records = Array.from({ length: TYPING_PROGRESSION_RECORD_LIMIT + 20 }, (_, index) => ({
    ...attempt(`record-${index}`, 1, new Date(Date.parse(at(1)) + index * 1_000).toISOString()),
    itemId: `custom:item-${index}`,
  }));
  const bounded = rebuildTypingProgression(records);
  assert.equal(bounded.records.length, TYPING_PROGRESSION_RECORD_LIMIT);
  assert.ok(bounded.attempts.length <= TYPING_PROGRESSION_ATTEMPT_LIMIT);
});

test("compact mastery survives capped detailed attempts and migration rebuild is ordered", () => {
  const history = [
    attempt("recall", 5, at(1, 10)),
    attempt("faded", 3, at(1, 9)),
    attempt("worked", 1, at(1, 8)),
  ];
  const rebuilt = rebuildTypingProgression(history);
  const migrated = deriveTypingProgression(rebuilt, "builtin:two-sum", 1, at(1, 11));
  assert.equal(migrated.owned, true);
  assert.deepEqual(migrated.attemptIds, ["worked", "faded", "recall"]);

  let workspace = rebuilt;
  for (let index = 0; index < TYPING_PROGRESSION_ATTEMPT_LIMIT + 40; index += 1) {
    workspace = applyTypingAttempt(
      workspace,
      attempt(`extra-${String(index).padStart(3, "0")}`, 1, new Date(Date.parse(at(2)) + index * 1_000).toISOString()),
    );
  }
  workspace = normalizeTypingProgression(workspace);
  const progress = deriveTypingProgression(workspace, "builtin:two-sum", 1, at(3));
  assert.equal(workspace.attempts.length, TYPING_PROGRESSION_ATTEMPT_LIMIT);
  assert.equal(progress.attemptIds.length, TYPING_PROGRESSION_REFERENCE_LIMIT);
  assert.equal(progress.attemptCount, TYPING_PROGRESSION_ATTEMPT_LIMIT + 43);
  assert.equal(progress.owned, true);
  assert.equal(progress.recallLevel, 1);
  assert.deepEqual(progress.completedStages, [1, 3, 5]);
  const summary = summarizeTypingProgression(workspace, { now: at(3) });
  assert.equal(summary.ownedCount, 1);
  assert.equal(summary.dueCount, 1);
});
