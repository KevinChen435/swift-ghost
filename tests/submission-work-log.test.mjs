import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SUBMISSION_WORK_LOG_QUERY,
  deriveSubmissionWorkLog,
  normalizeSubmissionWorkLogQuery,
} from "../app/lib/submission-work-log.mjs";

const NOW = "2026-07-28T12:00:00.000Z";

function item(overrides = {}) {
  return {
    itemId: "python:1",
    title: "Two Sum",
    language: "python",
    pattern: "Arrays & Hashing",
    difficulty: "Easy",
    tags: ["dictionary", "lookup"],
    contentRevision: 2,
    ...overrides,
  };
}

function submission(overrides = {}) {
  return {
    id: "submission-1",
    itemId: "python:1",
    itemRevision: 2,
    verificationRevision: 1,
    submittedAt: "2026-07-27T12:00:00.000Z",
    status: "accepted",
    durationMs: 100,
    passed: 3,
    total: 3,
    source: "print('ok')",
    origin: "practice",
    ...overrides,
  };
}

test("query normalization bounds values, deduplicates filters, and does not mutate input", () => {
  const raw = {
    text: `  Two\n${"x".repeat(140)}  `,
    statuses: ["accepted", "accepted", "bogus", null],
    origins: ["round", "round", "elsewhere"],
    languages: ["swift", "swift", "ruby"],
    revision: "broken",
    range: "7d",
    sort: "oldest",
    page: 0,
    pageSize: 100,
    selectedId: `  selected\n${"s".repeat(120)}  `,
    compareId: 42,
  };
  const before = structuredClone(raw);
  const normalized = normalizeSubmissionWorkLogQuery(raw);
  assert.deepEqual(raw, before);
  assert.equal(normalized.text.length, 120);
  assert.deepEqual(normalized.statuses, ["accepted"]);
  assert.deepEqual(normalized.origins, ["round"]);
  assert.deepEqual(normalized.languages, ["swift"]);
  assert.equal(normalized.revision, "all");
  assert.equal(normalized.range, "7d");
  assert.equal(normalized.sort, "oldest");
  assert.equal(normalized.page, 1);
  assert.equal(normalized.pageSize, 25);
  assert.equal(normalized.selectedId.length, 100);
  assert.equal(normalized.selectedId.includes("\n"), false);
  assert.equal(normalized.compareId, undefined);
  assert.deepEqual(normalizeSubmissionWorkLogQuery(null), DEFAULT_SUBMISSION_WORK_LOG_QUERY);
});

test("status, origin, language, revision, and range filters compose", () => {
  const items = [
    item(),
    item({ itemId: "builtin:2", title: "Swift Search", language: "swift", contentRevision: 4 }),
  ];
  const submissions = [
    submission(),
    submission({
      id: "submission-2",
      itemId: "builtin:2",
      itemRevision: 3,
      submittedAt: "2026-07-25T12:00:00.000Z",
      status: "wrong-answer",
      origin: "round",
    }),
    submission({
      id: "submission-3",
      itemId: "builtin:2",
      itemRevision: 4,
      submittedAt: "2026-06-01T12:00:00.000Z",
      status: "wrong-answer",
      origin: "round",
    }),
  ];
  const result = deriveSubmissionWorkLog({
    submissions,
    items,
    now: NOW,
    query: {
      statuses: ["wrong-answer", "runtime-error"],
      origins: ["round"],
      languages: ["swift"],
      revision: "older",
      range: "7d",
    },
  });
  assert.deepEqual(result.rows.map((row) => row.submission.id), ["submission-2"]);
  assert.equal(result.total, 1);
  assert.deepEqual(result.counts, { all: 3, accepted: 1, nonAccepted: 2, uniqueProblems: 2 });
});

test("pending receipts use requestedAt and participate in status filtering", () => {
  const pendingReceipt = {
    id: "receipt-1",
    itemId: "python:1",
    itemRevision: 2,
    requestedAt: "2026-07-28T10:00:00.000Z",
    lifecycle: "pending",
    status: "accepted",
    context: { kind: "studio" },
    source: "print('waiting')",
  };
  const settled = submission({ id: "settled", submittedAt: "2026-07-28T11:00:00.000Z" });
  const result = deriveSubmissionWorkLog({
    submissions: [pendingReceipt, settled],
    items: [item()],
    now: NOW,
    query: { statuses: ["pending"], origins: ["studio"], range: "7d" },
  });
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].submission.id, "receipt-1");
  assert.equal(result.rows[0].status, "pending");
  assert.equal(result.rows[0].origin, "studio");
  assert.deepEqual(result.counts, { all: 2, accepted: 1, nonAccepted: 1, uniqueProblems: 1 });
});

test("search uses AND tokens across title, IDs, pattern, difficulty, and tags", () => {
  const items = [
    item({ itemId: "python:17", title: "Café Window", pattern: "Sliding Window", difficulty: "Medium", tags: ["unicode", "frequency"] }),
    item({ itemId: "python:18", title: "Graph Walk", pattern: "Graphs", difficulty: "Hard", tags: ["depth first"] }),
  ];
  const submissions = [
    submission({ id: "attempt-special", itemId: "python:17" }),
    submission({ id: "attempt-other", itemId: "python:18" }),
  ];
  assert.deepEqual(
    deriveSubmissionWorkLog({ submissions, items, query: { text: "CAFE sliding frequency" } }).rows.map((row) => row.submission.id),
    ["attempt-special"],
  );
  assert.deepEqual(
    deriveSubmissionWorkLog({ submissions, items, query: { text: "python:18 Hard" } }).rows.map((row) => row.submission.id),
    ["attempt-other"],
  );
  assert.equal(deriveSubmissionWorkLog({ submissions, items, query: { text: "graph easy" } }).total, 0);
});

test("date ranges include the lower boundary and exclude invalid or future timestamps", () => {
  const submissions = [
    submission({ id: "boundary-7", submittedAt: "2026-07-21T12:00:00.000Z" }),
    submission({ id: "too-old", submittedAt: "2026-07-21T11:59:59.999Z" }),
    submission({ id: "future", submittedAt: "2026-07-28T12:00:00.001Z" }),
    submission({ id: "boundary-30", submittedAt: "2026-06-28T12:00:00.000Z" }),
    submission({ id: "too-old-30", submittedAt: "2026-06-28T11:59:59.999Z" }),
    submission({ id: "invalid", submittedAt: "not-a-date" }),
  ];
  const recent = deriveSubmissionWorkLog({ submissions, items: [item()], query: { range: "7d" }, now: NOW });
  assert.deepEqual(recent.rows.map((row) => row.submission.id), ["boundary-7"]);
  const monthly = deriveSubmissionWorkLog({ submissions, items: [item()], query: { range: "30d", sort: "oldest" }, now: NOW });
  assert.deepEqual(monthly.rows.map((row) => row.submission.id), ["boundary-30", "too-old", "boundary-7"]);
  assert.equal(deriveSubmissionWorkLog({ submissions, items: [item()], query: { range: "all" }, now: NOW }).total, 6);
});

test("enrichment uses snapshot fallbacks and marks unavailable or stale revisions", () => {
  const items = [item(), item({ itemId: "builtin:2", title: "Item Title", language: "swift", contentRevision: 4 })];
  const submissions = [
    submission({ id: "snapshot", titleSnapshot: "Snapshot Title", language: "swift" }),
    submission({ id: "item-fallback", itemId: "builtin:2", itemRevision: 3, language: "ruby" }),
    submission({ id: "missing", itemId: "custom:gone", itemRevision: 1 }),
    submission({ id: "no-language", itemId: "custom:also-gone", itemRevision: 1 }),
  ];
  const rows = deriveSubmissionWorkLog({ submissions, items, query: { sort: "oldest" } }).rows;
  const byId = new Map(rows.map((row) => [row.submission.id, row]));
  assert.deepEqual(
    { title: byId.get("snapshot").title, language: byId.get("snapshot").language, revision: byId.get("snapshot").revision },
    { title: "Snapshot Title", language: "swift", revision: "current" },
  );
  assert.deepEqual(
    { title: byId.get("item-fallback").title, language: byId.get("item-fallback").language, revision: byId.get("item-fallback").revision },
    { title: "Item Title", language: "swift", revision: "older" },
  );
  assert.equal(byId.get("missing").item, null);
  assert.equal(byId.get("missing").title, "custom:gone");
  assert.equal(byId.get("missing").revision, "unavailable");
  assert.equal(byId.get("no-language").language, "python");
  assert.equal(deriveSubmissionWorkLog({ submissions, items, query: { revision: "current" } }).total, 1);
  assert.equal(deriveSubmissionWorkLog({ submissions, items, query: { revision: "older" } }).total, 1);
  assert.deepEqual(
    deriveSubmissionWorkLog({ submissions, items, query: { languages: ["swift"] } }).rows.map((row) => row.submission.id),
    ["item-fallback", "snapshot"],
  );
});

test("malformed submission entries are ignored rather than counted as pending work", () => {
  const valid = submission();
  const result = deriveSubmissionWorkLog({
    submissions: [null, "bad", {}, { id: "missing-item" }, { itemId: "python:1" }, valid],
    items: [item()],
  });
  assert.equal(result.total, 1);
  assert.deepEqual(result.counts, { all: 1, accepted: 1, nonAccepted: 0, uniqueProblems: 1 });
  assert.equal(result.rows[0].submission, valid);
});

test("all sort modes are deterministic and never mutate the caller's arrays", () => {
  const items = [
    item({ itemId: "python:1", title: "Zulu" }),
    item({ itemId: "python:2", title: "Alpha" }),
    item({ itemId: "python:3", title: "Alpha" }),
  ];
  const submissions = [
    submission({ id: "b", itemId: "python:1", submittedAt: "2026-07-27T10:00:00Z", status: "wrong-answer" }),
    submission({ id: "a", itemId: "python:2", submittedAt: "2026-07-27T11:00:00Z", status: "accepted" }),
    submission({ id: "c", itemId: "python:3", submittedAt: "2026-07-27T11:00:00Z", status: "accepted" }),
  ];
  const beforeSubmissions = structuredClone(submissions);
  const beforeItems = structuredClone(items);
  assert.deepEqual(deriveSubmissionWorkLog({ submissions, items }).rows.map((row) => row.submission.id), ["a", "c", "b"]);
  assert.deepEqual(deriveSubmissionWorkLog({ submissions, items, query: { sort: "oldest" } }).rows.map((row) => row.submission.id), ["b", "a", "c"]);
  assert.deepEqual(deriveSubmissionWorkLog({ submissions, items, query: { sort: "problem" } }).rows.map((row) => row.submission.id), ["a", "c", "b"]);
  assert.deepEqual(deriveSubmissionWorkLog({ submissions, items, query: { sort: "verdict" } }).rows.map((row) => row.submission.id), ["a", "c", "b"]);
  assert.deepEqual(submissions, beforeSubmissions);
  assert.deepEqual(items, beforeItems);
});

test("pagination clamps after filtering and reports global counts independently", () => {
  const submissions = Array.from({ length: 63 }, (_, index) => submission({
    id: `submission-${String(index + 1).padStart(2, "0")}`,
    itemId: `python:${(index % 4) + 1}`,
    submittedAt: new Date(Date.UTC(2026, 6, 1, 0, index)).toISOString(),
    status: index < 30 ? "accepted" : "wrong-answer",
  }));
  const items = Array.from({ length: 4 }, (_, index) => item({ itemId: `python:${index + 1}` }));
  const first = deriveSubmissionWorkLog({ submissions, items, query: { sort: "oldest", pageSize: 25 } });
  const second = deriveSubmissionWorkLog({ submissions, items, query: { sort: "oldest", page: 2, pageSize: 25 } });
  const last = deriveSubmissionWorkLog({ submissions, items, query: { sort: "oldest", page: 99, pageSize: 25 } });
  assert.deepEqual([first.from, first.to, first.pageCount], [1, 25, 3]);
  assert.deepEqual([second.from, second.to], [26, 50]);
  assert.deepEqual([last.page, last.from, last.to, last.rows.length], [3, 51, 63, 13]);
  assert.equal(new Set([...first.rows, ...second.rows, ...last.rows].map((row) => row.submission.id)).size, 63);
  assert.deepEqual(last.counts, { all: 63, accepted: 30, nonAccepted: 33, uniqueProblems: 4 });

  const filtered = deriveSubmissionWorkLog({ submissions, items, query: { statuses: ["accepted"], page: 9, pageSize: 50 } });
  assert.deepEqual({ total: filtered.total, page: filtered.page, pageCount: filtered.pageCount }, { total: 30, page: 1, pageCount: 1 });
  assert.equal(filtered.counts.all, 63);

  const empty = deriveSubmissionWorkLog({ submissions: null, items: null, query: { page: 8 } });
  assert.deepEqual({ rows: empty.rows, total: empty.total, page: empty.page, pageCount: empty.pageCount }, { rows: [], total: 0, page: 1, pageCount: 1 });
});

test("selected and compare IDs accept only bounded normalized strings", () => {
  assert.deepEqual(
    normalizeSubmissionWorkLogQuery({ selectedId: "  sub-1  ", compareId: "\u0000 compare-2 \n" }),
    { ...DEFAULT_SUBMISSION_WORK_LOG_QUERY, selectedId: "sub-1", compareId: "compare-2" },
  );
  assert.equal(normalizeSubmissionWorkLogQuery({ selectedId: "", compareId: {} }).selectedId, undefined);
});
