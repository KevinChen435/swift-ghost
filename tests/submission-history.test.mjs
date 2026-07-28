import assert from "node:assert/strict";
import test from "node:test";
import {
  appendSubmissionHistory,
  isStorableSubmissionSource,
  SUBMISSION_HISTORY_LIMITS,
  submissionHistorySourceBytes,
} from "../app/lib/submission-history.mjs";

function submission(id, itemId = "python-two-sum", source = `# ${id}`) {
  return {
    id,
    itemId,
    itemRevision: 1,
    verificationRevision: 2,
    submittedAt: new Date(Date.UTC(2026, 6, 28, 8, 0, Number(id) || 0)).toISOString(),
    status: "wrong-answer",
    durationMs: 10,
    passed: 1,
    total: 4,
    source,
    origin: "practice",
  };
}

test("submission history keeps the newest ten records per problem", () => {
  let history = [];
  history = appendSubmissionHistory(
    history,
    submission("other", "python-valid-parentheses"),
  );
  for (let index = 0; index < 11; index += 1) {
    history = appendSubmissionHistory(history, submission(String(index)));
  }
  assert.deepEqual(
    history
      .filter((entry) => entry.itemId === "python-two-sum")
      .map((entry) => entry.id),
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  );
  assert.equal(history.some((entry) => entry.id === "other"), true);
});

test("duplicate submission ids settle once with the latest immutable snapshot", () => {
  const first = appendSubmissionHistory([], submission("same"));
  const accepted = {
    ...submission("same", "python-two-sum", "return [0, 1]"),
    status: "accepted",
    passed: 4,
  };
  const settled = appendSubmissionHistory(first, accepted);
  assert.equal(settled.length, 1);
  assert.equal(settled[0].status, "accepted");
  assert.equal(settled[0].source, "return [0, 1]");
});

test("restorable source is exact and oversized source is rejected, never truncated", () => {
  const unicodeSource = "def solve():\n    return '雪🐍'\n";
  const exact = appendSubmissionHistory(
    [],
    submission("unicode", "python-two-sum", unicodeSource),
  );
  assert.equal(exact[0].source, unicodeSource);

  const oversized = "x".repeat(SUBMISSION_HISTORY_LIMITS.maxSourceBytes + 1);
  assert.equal(isStorableSubmissionSource(oversized), false);
  assert.deepEqual(
    appendSubmissionHistory(exact, submission("large", "python-two-sum", oversized)),
    exact,
  );
});

test("global source-byte eviction stays within the local storage budget", () => {
  let history = [];
  for (let index = 0; index < 40; index += 1) {
    history = appendSubmissionHistory(
      history,
      submission(
        `record-${index}`,
        `python-item-${index}`,
        `${index}:${"x".repeat(39_000)}`,
      ),
    );
  }
  assert.ok(
    submissionHistorySourceBytes(history) <=
      SUBMISSION_HISTORY_LIMITS.maxTotalSourceBytes,
  );
  assert.ok(history.length < 40);
  assert.equal(history.at(-1)?.id, "record-39");
});
