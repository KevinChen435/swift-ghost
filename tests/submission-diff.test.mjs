import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSubmissionDiff,
  SUBMISSION_DIFF_LIMITS,
} from "../app/lib/submission-diff.mjs";

test("empty and identical sources produce no rendered rows", () => {
  const empty = buildSubmissionDiff("", "");
  assert.deepEqual(empty.summary, { added: 0, removed: 0, unchanged: 0 });
  assert.equal(empty.identical, true);
  assert.deepEqual(empty.rows, []);

  const source = "def solve():\n    return '雪🐍'\n";
  const identical = buildSubmissionDiff(source, source);
  assert.deepEqual(identical.summary, { added: 0, removed: 0, unchanged: 2 });
  assert.equal(identical.identical, true);
  assert.deepEqual(identical.rows, []);
});

test("CRLF is normalized for comparison while lone CR remains source content", () => {
  const lineEndingOnly = buildSubmissionDiff("one\r\ntwo\r\n", "one\ntwo\n");
  assert.equal(lineEndingOnly.identical, true);
  assert.deepEqual(lineEndingOnly.summary, { added: 0, removed: 0, unchanged: 2 });

  const loneCarriageReturn = buildSubmissionDiff("one\rtwo\n", "one two\n");
  assert.equal(loneCarriageReturn.identical, false);
  assert.deepEqual(
    loneCarriageReturn.rows.filter((row) => row.type !== "omitted").map((row) => [row.type, row.text]),
    [
      ["remove", "one\rtwo"],
      ["add", "one two"],
    ],
  );
});

test("final-newline changes are reported separately from line counts", () => {
  const added = buildSubmissionDiff("answer", "answer\n");
  assert.equal(added.identical, false);
  assert.deepEqual(added.summary, { added: 0, removed: 0, unchanged: 1 });
  assert.deepEqual(added.finalNewline, {
    submitted: false,
    current: true,
    changed: true,
  });

  const removed = buildSubmissionDiff("answer\n", "answer");
  assert.deepEqual(removed.finalNewline, {
    submitted: true,
    current: false,
    changed: true,
  });
});

test("line changes carry submitted and current line numbers", () => {
  const diff = buildSubmissionDiff(
    "zero\none\ntwo\nthree\nfour\n",
    "zero\none\nTWO\nthree\nfour\n",
  );
  assert.deepEqual(diff.summary, { added: 1, removed: 1, unchanged: 4 });
  assert.deepEqual(
    diff.rows.map(({ type, text, submittedLine, currentLine }) => ({
      type,
      text,
      submittedLine,
      currentLine,
    })),
    [
      { type: "context", text: "zero", submittedLine: 1, currentLine: 1 },
      { type: "context", text: "one", submittedLine: 2, currentLine: 2 },
      { type: "remove", text: "two", submittedLine: 3, currentLine: null },
      { type: "add", text: "TWO", submittedLine: null, currentLine: 3 },
      { type: "context", text: "three", submittedLine: 4, currentLine: 4 },
      { type: "context", text: "four", submittedLine: 5, currentLine: 5 },
    ],
  );
});

test("repeated lines use deterministic remove-first LCS tie-breaking", () => {
  const first = buildSubmissionDiff("A\nB\nA\n", "A\nA\nB\n");
  const second = buildSubmissionDiff("A\nB\nA\n", "A\nA\nB\n");
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.rows.filter((row) => row.type !== "context").map((row) => [row.type, row.text]),
    [
      ["remove", "B"],
      ["add", "B"],
    ],
  );
});

test("large changed middles use a removed block followed by an added block", () => {
  const submitted = Array.from({ length: 400 }, (_, index) => `old-${index}`).join("\n");
  const current = Array.from({ length: 400 }, (_, index) => `new-${index}`).join("\n");
  const diff = buildSubmissionDiff(submitted, current);
  assert.equal(diff.lcsCells, 160_000);
  assert.equal(diff.algorithm, "fallback");
  assert.deepEqual(diff.summary, { added: 400, removed: 400, unchanged: 0 });
  const visibleChanges = diff.rows.filter((row) => row.type !== "omitted");
  assert.equal(visibleChanges[0].type, "remove");
  assert.equal(visibleChanges.at(-1).type, "add");
  assert.equal(diff.truncated, true);
  assert.equal(diff.rows.length, SUBMISSION_DIFF_LIMITS.maxRenderRows);
  assert.equal(
    diff.rows.some((row) => row.type === "omitted" && row.reason === "render-cap"),
    true,
  );
});

test("the exact 100,000-cell boundary still uses LCS", () => {
  const submitted = Array.from({ length: 250 }, (_, index) => `left-${index}`).join("\n");
  const current = Array.from({ length: 400 }, (_, index) => `right-${index}`).join("\n");
  const diff = buildSubmissionDiff(submitted, current);
  assert.equal(diff.lcsCells, SUBMISSION_DIFF_LIMITS.maxLcsCells);
  assert.equal(diff.algorithm, "lcs");
});

test("long unchanged gaps use explicit omission rows", () => {
  const common = Array.from({ length: 100 }, (_, index) => `shared-${index}`);
  const submitted = ["old-start", ...common, "old-end"].join("\n");
  const current = ["new-start", ...common, "new-end"].join("\n");
  const diff = buildSubmissionDiff(submitted, current);
  assert.equal(
    diff.rows.some(
      (row) => row.type === "omitted" && row.reason === "context" && row.omitted === 94,
    ),
    true,
  );
  assert.ok(diff.rows.length <= SUBMISSION_DIFF_LIMITS.maxRenderRows);
});

test("48KB Unicode-heavy inputs stay bounded and inputs are unchanged", () => {
  const submitted = `${"雪🐍\n".repeat(7_900)}old`;
  const current = `${"雪🐍\n".repeat(7_900)}new`;
  const submittedCopy = submitted.slice();
  const currentCopy = current.slice();
  const diff = buildSubmissionDiff(submitted, current);

  assert.equal(submitted, submittedCopy);
  assert.equal(current, currentCopy);
  assert.deepEqual(diff.summary, { added: 1, removed: 1, unchanged: 7_900 });
  assert.ok(diff.rows.length <= SUBMISSION_DIFF_LIMITS.maxRenderRows);
  assert.equal(diff.rows.some((row) => row.type === "omitted"), true);
});
