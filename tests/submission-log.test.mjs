import assert from "node:assert/strict";
import test from "node:test";
import {
  createSubmissionLog,
  normalizeSubmissionLog,
  recoverInterruptedSubmissions,
  requestSubmission,
  resolveSubmissionSource,
  settleSubmission,
  settledSubmissionEvidence,
  settledSubmissionRecords,
  sourceAvailable,
  SUBMISSION_INTERRUPTION_REASON,
  SUBMISSION_LOG_LIMITS,
  submissionLogSourceBytes,
} from "../app/lib/submission-log.mjs";

const REQUESTED_AT = "2026-07-28T12:00:00.000Z";
const SETTLED_AT = "2026-07-28T12:00:01.000Z";

function request(overrides = {}) {
  return {
    id: "submission-1",
    itemId: "python:1",
    titleSnapshot: "Two Sum",
    language: "python",
    itemRevision: 2,
    requestedAt: REQUESTED_AT,
    source: "class Solution:\n    pass\n",
    judge: { kind: "browser-python-local", revision: 3 },
    context: { kind: "practice", sessionId: "session-1" },
    assistance: "none-recorded",
    ...overrides,
  };
}

function outcome(overrides = {}) {
  return {
    settledAt: SETTLED_AT,
    status: "accepted",
    durationMs: 24,
    passed: 4,
    total: 4,
    ...overrides,
  };
}

function requestedLog(overrides = {}) {
  return requestSubmission(createSubmissionLog(), request(overrides));
}

function catalogItem(overrides = {}) {
  return {
    itemId: "python:1",
    title: "Two Sum",
    language: "python",
    contentRevision: 2,
    verification: { revision: 3 },
    ...overrides,
  };
}

test("requests atomically preserve immutable metadata and exact source without mutating input", () => {
  const empty = createSubmissionLog();
  const input = request({ source: "print('é雪🐍')\r\n" });
  const before = structuredClone(input);
  const log = requestSubmission(empty, input);
  assert.deepEqual(input, before);
  assert.deepEqual(empty, { version: 1, receipts: [], sources: {} });
  assert.equal(log.receipts.length, 1);
  assert.equal(log.receipts[0].lifecycle, "pending");
  assert.equal(log.receipts[0].snapshotProvenance, "recorded");
  assert.equal(resolveSubmissionSource(log, input.id), input.source);
  assert.equal(sourceAvailable(log, input.id), true);
});

test("server-isolated Swift receipts are durable work-log evidence", () => {
  let log = requestedLog({
    id: "trusted:verified-swift12345",
    itemId: "custom:trusted-swift-two-sum",
    titleSnapshot: "Swift Two Sum",
    language: "swift",
    itemRevision: 1,
    source: "import Foundation\nfunc twoSum() -> [Int] { [] }\n",
    judge: { kind: "server-isolated-swift", revision: 1 },
    context: { kind: "assessment" },
    assistance: "unknown",
  });
  log = settleSubmission(log, "trusted:verified-swift12345", outcome({
    status: "compile-error",
    passed: 0,
    total: 8,
  }));
  assert.equal(log.receipts[0].language, "swift");
  assert.equal(log.receipts[0].judge.kind, "server-isolated-swift");
  assert.equal(log.receipts[0].status, "compile-error");
  assert.equal(settledSubmissionRecords(log)[0].language, "swift");
});

test("settled evidence distinguishes tracked clean, assisted, and unknown receipts", () => {
  const receipts = [
    ["clean", "none-recorded"],
    ["assisted", "used"],
    ["legacy", "unknown"],
  ];
  let log = createSubmissionLog();
  for (const [id, assistance] of receipts) {
    log = requestSubmission(log, request({ id, assistance }));
    log = settleSubmission(log, id, outcome());
  }
  const evidence = settledSubmissionEvidence(log);
  assert.equal(evidence.find((entry) => entry.id === "clean")?.assistanceUsed, false);
  assert.equal(evidence.find((entry) => entry.id === "assisted")?.assistanceUsed, true);
  assert.equal(evidence.find((entry) => entry.id === "legacy")?.assistanceUsed, undefined);
});

test("duplicate request IDs are idempotent only for the same canonical metadata and exact source", () => {
  const log = requestedLog();
  assert.equal(requestSubmission(log, request()), log);
  assert.throws(
    () => requestSubmission(log, request({ source: "different" })),
    /different metadata or source/,
  );
  assert.throws(
    () => requestSubmission(log, request({ titleSnapshot: "Changed" })),
    /different metadata or source/,
  );
});

test("request validation enforces relational context and immutable identity fields", () => {
  assert.throws(
    () => requestedLog({ context: { kind: "assessment", assessmentRunId: "run" } }),
    /invalid/,
  );
  assert.throws(
    () => requestedLog({ context: { kind: "round", virtualRoundId: "round", sessionId: "leak" } }),
    /invalid/,
  );
  assert.throws(() => requestedLog({ language: "ruby" }), /invalid/);
  assert.throws(() => requestedLog({ itemRevision: 0 }), /invalid/);
  assert.throws(() => requestedLog({ requestedAt: "not-a-time" }), /invalid/);
  const assessment = requestedLog({
    context: {
      kind: "assessment",
      assessmentRunId: "run-1",
      assessmentProbeId: "probe-1",
    },
  });
  assert.deepEqual(assessment.receipts[0].context, {
    kind: "assessment",
    assessmentRunId: "run-1",
    assessmentProbeId: "probe-1",
  });
  assert.deepEqual(requestedLog({ context: { kind: "studio" } }).receipts[0].context, {
    kind: "studio",
  });
  assert.deepEqual(requestedLog({ context: { kind: "round" } }).receipts[0].context, {
    kind: "round",
  });
});

test("settlement is pending-only, idempotent when identical, and rejects contradiction", () => {
  const pending = requestedLog();
  const settled = settleSubmission(pending, "submission-1", outcome());
  assert.equal(pending.receipts[0].lifecycle, "pending");
  assert.deepEqual(settled.receipts[0], {
    ...pending.receipts[0],
    lifecycle: "settled",
    settledAt: SETTLED_AT,
    status: "accepted",
    durationMs: 24,
    passed: 4,
    total: 4,
  });
  assert.equal(settleSubmission(settled, "submission-1", outcome()), settled);
  assert.throws(
    () => settleSubmission(settled, "submission-1", outcome({ status: "runtime-error" })),
    /different outcome/,
  );
  assert.throws(() => settleSubmission(pending, "missing", outcome()), /not found/);
  assert.throws(
    () => settleSubmission(pending, "submission-1", outcome({ settledAt: "2020-01-01" })),
    /invalid/,
  );
});

test("accepted verdicts fail closed to wrong-answer unless all nonzero checks pass", () => {
  const zero = settleSubmission(requestedLog(), "submission-1", outcome({ passed: 0, total: 0 }));
  assert.equal(zero.receipts[0].status, "wrong-answer");
  const partial = settleSubmission(requestedLog(), "submission-1", outcome({ passed: 3, total: 4 }));
  assert.equal(partial.receipts[0].status, "wrong-answer");
  const complete = settleSubmission(requestedLog(), "submission-1", outcome());
  assert.equal(complete.receipts[0].status, "accepted");
});

test("interrupted pending receipts recover once as explicit judge errors", () => {
  const pending = requestedLog();
  const recovered = recoverInterruptedSubmissions(pending, {
    now: "2026-07-28T12:01:00Z",
  });
  assert.deepEqual(recovered.receipts[0], {
    ...pending.receipts[0],
    lifecycle: "settled",
    settledAt: "2026-07-28T12:01:00.000Z",
    status: "judge-error",
    durationMs: 0,
    passed: 0,
    total: 0,
    interruptionReason: SUBMISSION_INTERRUPTION_REASON,
  });
  assert.deepEqual(
    recoverInterruptedSubmissions(recovered, { now: "2026-07-28T13:00:00Z" }),
    recovered,
  );
});

test("server judge receipts can remain pending across a local reload", () => {
  const pending = requestedLog({
    id: "server-pending",
    judge: { kind: "server-isolated-swift", revision: 4 },
    language: "swift",
    itemId: "swift:two-sum",
  });
  const recovered = recoverInterruptedSubmissions(pending, {
    now: "2026-07-28T12:01:00Z",
    preservePendingJudgeKinds: ["server-isolated-swift"],
  });
  assert.deepEqual(recovered, pending);
});

test("normalization repairs malformed settlements and missing pending sources fail closed", () => {
  const pending = requestedLog();
  const malformed = {
    ...pending,
    receipts: [{
      ...pending.receipts[0],
      lifecycle: "settled",
      settledAt: "bad",
      status: "accepted",
      durationMs: -1,
      passed: 10,
      total: 2,
    }],
  };
  const normalized = normalizeSubmissionLog(malformed, {
    items: [catalogItem()],
    now: "2026-07-28T12:05:00Z",
  });
  assert.deepEqual(
    {
      lifecycle: normalized.receipts[0].lifecycle,
      status: normalized.receipts[0].status,
      durationMs: normalized.receipts[0].durationMs,
      passed: normalized.receipts[0].passed,
      total: normalized.receipts[0].total,
      interruptionReason: normalized.receipts[0].interruptionReason,
    },
    {
      lifecycle: "settled",
      status: "judge-error",
      durationMs: 0,
      passed: 0,
      total: 0,
      interruptionReason: "malformed-settlement",
    },
  );

  const missing = normalizeSubmissionLog({ ...pending, sources: {} }, {
    items: [catalogItem()],
    now: "2026-07-28T12:05:00Z",
  });
  assert.equal(missing.receipts[0].lifecycle, "settled");
  assert.equal(missing.receipts[0].status, "judge-error");
  assert.equal(missing.receipts[0].interruptionReason, "source-unavailable");
});

test("legacy settled records migrate with catalog snapshots, unknown assistance, and fail-closed verdicts", () => {
  const legacy = {
    id: "legacy-1",
    itemId: "python:1",
    itemRevision: 2,
    verificationRevision: 3,
    submittedAt: REQUESTED_AT,
    status: "accepted",
    durationMs: 10,
    passed: 2,
    total: 3,
    source: "print('legacy')",
    origin: "mock",
    sessionId: "mock-session",
  };
  const log = normalizeSubmissionLog(null, {
    items: [catalogItem()],
    now: SETTLED_AT,
    legacyHistory: [legacy],
  });
  assert.equal(log.receipts.length, 1);
  assert.deepEqual(
    {
      title: log.receipts[0].titleSnapshot,
      language: log.receipts[0].language,
      provenance: log.receipts[0].snapshotProvenance,
      assistance: log.receipts[0].assistance,
      status: log.receipts[0].status,
      context: log.receipts[0].context,
    },
    {
      title: "Two Sum",
      language: "python",
      provenance: "migrated-catalog-fallback",
      assistance: "unknown",
      status: "wrong-answer",
      context: { kind: "mock", sessionId: "mock-session" },
    },
  );
  assert.equal(resolveSubmissionSource(log, "legacy-1"), legacy.source);
});

test("removed items survive only with complete recorded snapshots", () => {
  const recorded = requestedLog({ id: "recorded" });
  const normalizedRecorded = normalizeSubmissionLog(recorded, { items: [], now: SETTLED_AT });
  assert.deepEqual(normalizedRecorded.receipts.map((entry) => entry.id), ["recorded"]);

  const migrated = {
    ...recorded,
    receipts: [{
      ...recorded.receipts[0],
      id: "fallback",
      snapshotProvenance: "migrated-catalog-fallback",
    }],
    sources: { fallback: "source" },
  };
  assert.equal(normalizeSubmissionLog(migrated, { items: [], now: SETTLED_AT }).receipts.length, 0);
  assert.equal(normalizeSubmissionLog(null, {
    items: [],
    legacyHistory: [{
      id: "removed-legacy",
      itemId: "removed",
      itemRevision: 1,
      verificationRevision: 1,
      submittedAt: REQUESTED_AT,
      status: "wrong-answer",
      durationMs: 1,
      passed: 0,
      total: 1,
      source: "source",
    }],
  }).receipts.length, 0);
});

test("receipt ordering and metadata retention are deterministic by requestedAt then ID", () => {
  let log = createSubmissionLog();
  for (let index = 0; index < 510; index += 1) {
    const id = `id-${String(509 - index).padStart(3, "0")}`;
    log = requestSubmission(log, request({
      id,
      itemId: `python:${index}`,
      requestedAt: `2026-07-28T12:${String(index % 60).padStart(2, "0")}:00Z`,
      source: id,
    }));
    log = settleSubmission(log, id, outcome({
      settledAt: "2026-07-28T13:00:00Z",
      status: "wrong-answer",
      passed: 0,
      total: 1,
    }));
  }
  assert.equal(log.receipts.length, SUBMISSION_LOG_LIMITS.maxReceipts);
  assert.deepEqual(log.receipts, log.receipts.slice().sort((left, right) =>
    left.requestedAt.localeCompare(right.requestedAt) || left.id.localeCompare(right.id)));

  let perItem = createSubmissionLog();
  for (let index = 0; index < 105; index += 1) {
    const id = `same-${String(index).padStart(3, "0")}`;
    perItem = requestSubmission(perItem, request({
      id,
      requestedAt: new Date(Date.parse(REQUESTED_AT) + index).toISOString(),
      source: id,
    }));
    perItem = settleSubmission(perItem, id, outcome({
      settledAt: new Date(Date.parse(SETTLED_AT) + index).toISOString(),
      status: "wrong-answer",
      passed: 0,
      total: 1,
    }));
  }
  assert.equal(perItem.receipts.length, SUBMISSION_LOG_LIMITS.maxReceiptsPerItem);
  assert.equal(perItem.receipts[0].id, "same-005");
});

test("source retention evicts oldest settled attachments but keeps metadata and pending source", () => {
  let log = createSubmissionLog();
  for (let index = 0; index < 23; index += 1) {
    const id = `large-${String(index).padStart(2, "0")}`;
    log = requestSubmission(log, request({
      id,
      itemId: `python:${index}`,
      requestedAt: new Date(Date.parse(REQUESTED_AT) + index).toISOString(),
      source: `${index}:${"x".repeat(46_000)}`,
    }));
    if (index < 22) {
      log = settleSubmission(log, id, outcome({
        settledAt: new Date(Date.parse(SETTLED_AT) + index).toISOString(),
        status: "wrong-answer",
        passed: 0,
        total: 1,
      }));
    }
  }
  assert.equal(log.receipts.length, 23);
  assert.ok(submissionLogSourceBytes(log) <= SUBMISSION_LOG_LIMITS.maxTotalSourceBytes);
  assert.equal(sourceAvailable(log, "large-00"), false);
  assert.equal(sourceAvailable(log, "large-22"), true);
  assert.equal(log.receipts.find((entry) => entry.id === "large-22").lifecycle, "pending");
  assert.ok(log.receipts.some((entry) => entry.id === "large-00"));
});

test("pending metadata is never silently evicted and malformed pending overflow fails closed", () => {
  let log = createSubmissionLog();
  for (let index = 0; index < SUBMISSION_LOG_LIMITS.maxReceiptsPerItem; index += 1) {
    log = requestSubmission(log, request({
      id: `pending-${index}`,
      requestedAt: new Date(Date.parse(REQUESTED_AT) + index).toISOString(),
      source: `source-${index}`,
    }));
  }
  assert.throws(
    () => requestSubmission(log, request({
      id: "pending-overflow",
      requestedAt: "2026-07-28T12:01:00Z",
    })),
    /metadata limit/,
  );
  assert.equal(log.receipts.length, SUBMISSION_LOG_LIMITS.maxReceiptsPerItem);

  const template = requestedLog().receipts[0];
  const receipts = [];
  const sources = {};
  for (let index = 0; index < 22; index += 1) {
    const id = `raw-pending-${String(index).padStart(2, "0")}`;
    receipts.push({
      ...template,
      id,
      itemId: `python:${index}`,
      requestedAt: new Date(Date.parse(REQUESTED_AT) + index).toISOString(),
    });
    sources[id] = "x".repeat(SUBMISSION_LOG_LIMITS.maxSourceBytes);
  }
  const normalized = normalizeSubmissionLog({ version: 1, receipts, sources }, {
    now: SETTLED_AT,
  });
  assert.ok(submissionLogSourceBytes(normalized) <= SUBMISSION_LOG_LIMITS.maxTotalSourceBytes);
  assert.ok(normalized.receipts.some(
    (receipt) => receipt.interruptionReason === "pending-source-budget-overflow",
  ));
  assert.ok(normalized.receipts
    .filter((receipt) => receipt.lifecycle === "pending")
    .every((receipt) => sourceAvailable(normalized, receipt.id)));
});

test("UTF-8 byte limits are exact and sources are never truncated", () => {
  const exact = "é".repeat(SUBMISSION_LOG_LIMITS.maxSourceBytes / 2);
  const log = requestedLog({ source: exact });
  assert.equal(resolveSubmissionSource(log, "submission-1"), exact);
  assert.equal(submissionLogSourceBytes(log), SUBMISSION_LOG_LIMITS.maxSourceBytes);
  assert.throws(() => requestedLog({ source: `${exact}x` }), /invalid/);
  const empty = requestedLog({ source: "" });
  assert.equal(resolveSubmissionSource(empty, "submission-1"), "");
  assert.equal(sourceAvailable(empty, "submission-1"), true);
});

test("settled compatibility records require source and map expanded contexts to legacy origins", () => {
  const contexts = [
    [{ kind: "transfer", sessionId: "transfer-session" }, "practice"],
    [{ kind: "assessment", assessmentRunId: "run", assessmentProbeId: "probe" }, "practice"],
    [{ kind: "studio", sessionId: "studio-session" }, "mock"],
    [{ kind: "round", virtualRoundId: "round-1" }, "round"],
  ];
  for (const [context, origin] of contexts) {
    const pending = requestedLog({ context });
    const settled = settleSubmission(pending, "submission-1", outcome());
    const records = settledSubmissionRecords(settled);
    assert.equal(records[0].origin, origin);
    assert.equal(records[0].verificationRevision, 3);
    assert.equal(records[0].submittedAt, REQUESTED_AT);
    const withoutSource = { ...settled, sources: {} };
    assert.deepEqual(settledSubmissionRecords(withoutSource), []);
  }
});
