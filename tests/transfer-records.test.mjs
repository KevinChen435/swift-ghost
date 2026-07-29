import assert from "node:assert/strict";
import test from "node:test";

import {
  TRANSFER_RECORDS_LIMITS,
  buildTransferRecords,
} from "../app/lib/transfer-records.mjs";

const t0 = "2026-01-01T00:00:00.000Z";
const hour = 3_600_000;
const day = 86_400_000;

function at(offset) {
  return new Date(Date.parse(t0) + offset).toISOString();
}

function variant(itemId = "transfer:1", contentRevision = 2, overrides = {}) {
  return {
    itemId,
    contentRevision,
    title: `Title ${itemId}`,
    difficulty: "Medium",
    language: "python",
    pattern: "Arrays & Hashing",
    transfer: {
      family: `family:${itemId}`,
      sourceItemIds: ["python:1"],
    },
    ...overrides,
  };
}

function attempt(id, completedAt, overrides = {}) {
  return {
    id,
    itemId: "transfer:1",
    itemRevision: 2,
    practiceKind: "solving",
    outcome: "completed",
    qualification: "solved",
    peeks: 0,
    completedAt,
    verification: { passed: 5, total: 5 },
    ...overrides,
  };
}

function receipt(id, requestedAt, overrides = {}) {
  return {
    id,
    itemId: "transfer:1",
    titleSnapshot: "Title transfer:1",
    language: "python",
    itemRevision: 2,
    requestedAt,
    judge: { kind: "browser-python-local", revision: 1 },
    context: { kind: "transfer" },
    assistance: "none-recorded",
    snapshotProvenance: "recorded",
    lifecycle: "settled",
    settledAt: at(Date.parse(requestedAt) - Date.parse(t0) + 1_000),
    status: "accepted",
    durationMs: 1_000,
    passed: 5,
    total: 5,
    ...overrides,
  };
}

function review(id, attemptId, updatedAt, overrides = {}) {
  return {
    id,
    attemptId,
    itemId: "transfer:1",
    itemRevision: 2,
    status: "draft",
    step: "explain",
    createdAt: updatedAt,
    updatedAt,
    ...overrides,
  };
}

test("joins current metadata with current and stale evidence in stable chronological order", () => {
  const workspace = {
    coverage: "complete",
    updatedAt: at(5 * hour),
    exposures: [
      {
        variantId: "transfer:1",
        variantRevision: 1,
        firstOpenedAt: t0,
        lastOpenedAt: at(hour),
        openCount: 3,
        maxHintLevel: 0,
      },
      {
        variantId: "transfer:1",
        variantRevision: 2,
        firstOpenedAt: at(2 * hour),
        lastOpenedAt: at(3 * hour),
        openCount: 2,
        maxHintLevel: 1,
        firstHintedAt: at(3 * hour),
        lastHintedAt: at(4 * hour),
        referenceRevealedAt: at(5 * hour),
      },
    ],
  };
  const attempts = [
    attempt("attempt:current", at(6 * hour), { submissionId: "submission:accepted" }),
    attempt("attempt:stale", at(hour), { itemRevision: 1, qualification: "assisted", peeks: 1 }),
  ];
  const submissions = [
    receipt("submission:failed", at(7 * hour), { status: "wrong-answer", passed: 2 }),
    receipt("submission:accepted", at(6 * hour)),
    receipt("submission:pending", at(8 * hour), {
      lifecycle: "pending",
      settledAt: undefined,
      status: undefined,
      passed: undefined,
      total: undefined,
    }),
    receipt("submission:stale", at(2 * hour), { itemRevision: 1 }),
  ];
  const reviews = [
    review("review:draft", "attempt:stale", at(2 * hour), { itemRevision: 1 }),
    review("review:complete", "attempt:current", at(9 * hour), {
      status: "completed",
      step: "complete",
      completedAt: at(9 * hour),
      grade: "good",
      dueAt: at(4 * day),
      submissionId: "submission:accepted",
    }),
  ];

  const result = buildTransferRecords({
    variants: [variant("transfer:2"), variant()],
    workspace,
    attempts: [...attempts].reverse(),
    submissionLog: { receipts: [...submissions].reverse() },
    reviews: [...reviews].reverse(),
    now: at(10 * hour),
  });

  assert.deepEqual(result.records.map((entry) => entry.variantId), ["transfer:1", "transfer:2"]);
  const joined = result.records[0];
  assert.equal(joined.currentRevision, 2);
  assert.equal(joined.title, "Title transfer:1");
  assert.equal(joined.currentAttemptCount, 1);
  assert.equal(joined.staleAttemptCount, 1);
  assert.equal(joined.currentSubmissionCount, 3);
  assert.equal(joined.staleSubmissionCount, 1);
  assert.equal(joined.latestSubmissionId, "submission:pending");
  assert.equal(joined.latestReviewAttemptId, "attempt:current");
  assert.equal(joined.currentAcceptedAttemptId, "attempt:current");
  assert.equal(joined.reviewDueAt, at(4 * day));
  assert.equal(joined.evidenceCoverage.promptOpens, "first-and-last-only");
  assert.equal(joined.evidenceCoverage.scope, "local-practice-evidence");
  assert.ok(joined.timeline.every((event, index, all) => !index || event.at >= all[index - 1].at));
  assert.equal(
    joined.timeline.find((event) => event.kind === "submission" && event.submissionId === "submission:accepted")?.attemptId,
    "attempt:current",
  );
  assert.equal(
    joined.timeline.find((event) => event.kind === "review" && event.reviewId === "review:complete")?.grade,
    "good",
  );
  assert.deepEqual(
    result.totals,
    {
      records: 2,
      eligible: 2,
      unseen: 1,
      opened: 0,
      attempted: 0,
      assisted: 1,
      proven: 0,
      independentEvidence: 0,
      due: 0,
      attempts: 2,
      currentAttempts: 1,
      staleAttempts: 1,
      submissions: 4,
      currentSubmissions: 3,
      staleSubmissions: 1,
      pendingSubmissions: 1,
      settledSubmissions: 3,
      acceptedSubmissions: 2,
      failedSubmissions: 1,
      reviews: 2,
      draftReviews: 1,
      completedReviews: 1,
      partialEvidenceRecords: 0,
      truncatedTimelines: 0,
    },
  );
});

test("uses deriveTransferProgress classifications and never promotes a helped-first retry", () => {
  const revealed = {
    coverage: "complete",
    exposures: [{
      variantId: "transfer:1",
      variantRevision: 2,
      firstOpenedAt: t0,
      lastOpenedAt: t0,
      openCount: 1,
      maxHintLevel: 0,
      referenceRevealedAt: at(hour),
    }],
  };
  const helpedFirst = buildTransferRecords({
    variants: [variant()],
    workspace: revealed,
    attempts: [attempt("attempt:retry", at(2 * day))],
    now: at(3 * day),
  }).records[0];
  const retry = helpedFirst.timeline.find((event) => event.kind === "attempt");
  assert.equal(helpedFirst.progress.isProven, false);
  assert.equal(retry.evidenceClass, "assisted-reconstruction");
  assert.equal(retry.advancesSchedule, false);

  const explicitlyAssisted = buildTransferRecords({
    variants: [variant()],
    attempts: [attempt("attempt:assisted", at(hour), { qualification: "assisted", peeks: 1 })],
    now: at(2 * hour),
  }).records[0];
  assert.equal(explicitlyAssisted.status, "assisted");
  assert.equal(explicitlyAssisted.progress.isProven, false);
  assert.equal(
    explicitlyAssisted.timeline.find((event) => event.kind === "attempt").advancesSchedule,
    false,
  );
});

test("accepted, failed, and pending durable receipts retain lifecycle details", () => {
  const result = buildTransferRecords({
    variants: [variant()],
    submissionLog: {
      receipts: [
        receipt("submission:accepted", at(hour)),
        receipt("submission:failed", at(2 * hour), { status: "runtime-error", passed: 0 }),
        receipt("submission:pending", at(3 * hour), {
          lifecycle: "pending",
          settledAt: undefined,
          status: undefined,
          passed: undefined,
          total: undefined,
          context: { kind: "practice" },
          assistance: "unknown",
        }),
      ],
    },
    now: at(4 * hour),
  });
  const events = result.records[0].timeline.filter((event) => event.kind === "submission");
  assert.deepEqual(events.map((event) => [event.lifecycle, event.status]), [
    ["settled", "accepted"],
    ["settled", "runtime-error"],
    ["pending", null],
  ]);
  assert.deepEqual(
    events.map((event) => [event.verificationPassed, event.verificationTotal, event.contextKind, event.assistance]),
    [[5, 5, "transfer", "none-recorded"], [0, 5, "transfer", "none-recorded"], [null, null, "practice", "unknown"]],
  );
  assert.equal(result.records[0].progress.isProven, true);
});

test("ignores malformed, orphaned, and mismatched evidence without mutating input", () => {
  const goodAttempt = attempt("attempt:good", at(hour));
  const goodReceipt = receipt("submission:good", at(2 * hour));
  const input = {
    variants: [null, { itemId: "bad id" }, variant()],
    workspace: "corrupt",
    attempts: [
      null,
      { ...goodAttempt, id: "bad id" },
      { ...goodAttempt, id: "attempt:orphan", itemId: "transfer:404" },
      goodAttempt,
    ],
    submissions: [
      { ...goodReceipt, id: "bad id" },
      { ...goodReceipt, id: "submission:orphan", itemId: "transfer:404" },
      goodReceipt,
    ],
    reviews: [
      review("review:missing-attempt", "attempt:missing", at(3 * hour)),
      review("review:mismatch", "attempt:good", at(3 * hour), { itemRevision: 1 }),
    ],
    now: at(4 * hour),
  };
  const snapshot = structuredClone(input);
  const result = buildTransferRecords(input);
  assert.deepEqual(input, snapshot);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].attemptCount, 1);
  assert.equal(result.records[0].submissionCount, 1);
  assert.equal(result.records[0].reviewCount, 0);
  assert.equal(result.records[0].evidenceCoverage.workspace, "partial");
  assert.equal(result.records[0].evidenceCoverage.promptOpens, "unknown");
});

test("bounds strings and timelines while totals include omitted events", () => {
  const attempts = Array.from(
    { length: TRANSFER_RECORDS_LIMITS.maxTimelineEvents + 25 },
    (_, index) => attempt(`attempt:${String(index).padStart(3, "0")}`, at(index * hour), {
      itemRevision: index % 2 ? 1 : 2,
      qualification: "incomplete",
      verification: { passed: 0, total: 5 },
    }),
  );
  const result = buildTransferRecords({
    variants: [variant("transfer:1", 2, { title: "x".repeat(2_000) })],
    attempts,
    now: at(200 * hour),
  });
  const entry = result.records[0];
  assert.equal(entry.title.length, TRANSFER_RECORDS_LIMITS.maxTextLength);
  assert.equal(entry.timeline.length, TRANSFER_RECORDS_LIMITS.maxTimelineEvents);
  assert.equal(entry.timelineEventCount, attempts.length);
  assert.equal(entry.omittedTimelineEventCount, 25);
  assert.equal(entry.evidenceCoverage.timeline, "truncated");
  assert.equal(result.totals.attempts, attempts.length);
  assert.equal(result.totals.truncatedTimelines, 1);
});

test("equal input evidence produces the same chronology regardless of array order", () => {
  const attempts = [
    attempt("attempt:z", at(hour), { qualification: "incomplete", verification: { passed: 0, total: 5 } }),
    attempt("attempt:a", at(hour), { qualification: "incomplete", verification: { passed: 0, total: 5 } }),
  ];
  const receipts = [
    receipt("submission:z", at(hour), { status: "wrong-answer", passed: 0 }),
    receipt("submission:a", at(hour), { status: "wrong-answer", passed: 0 }),
  ];
  const build = (attemptInput, receiptInput) => buildTransferRecords({
    variants: [variant()],
    attempts: attemptInput,
    submissionLog: { receipts: receiptInput },
    now: at(2 * hour),
  }).records[0].timeline;
  assert.deepEqual(build(attempts, receipts), build([...attempts].reverse(), [...receipts].reverse()));
});
