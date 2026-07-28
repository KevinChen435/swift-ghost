import assert from "node:assert/strict";
import test from "node:test";
import {
  SOLUTION_REVIEW_LIMITS,
  activityKindForMistake,
  createSolutionReview,
  normalizeSolutionReviews,
  scheduleReasonForReview,
  upsertSolutionReview,
} from "../app/lib/solution-review.mjs";

function acceptedAttempt(overrides = {}) {
  return {
    id: "attempt-1",
    itemId: "python:1",
    itemRevision: 2,
    titleSnapshot: "Two Sum",
    language: "python",
    stage: 5,
    practiceKind: "solving",
    mode: "strict",
    startedAt: "2026-07-28T10:00:00.000Z",
    completedAt: "2026-07-28T10:10:00.000Z",
    durationMs: 600_000,
    totalKeystrokes: 100,
    correctKeystrokes: 100,
    rejectedKeystrokes: 0,
    corrections: 0,
    peeks: 0,
    keyErrors: {},
    lineErrors: {},
    timeline: [],
    rawWpm: 0,
    wpm: 0,
    accuracy: 100,
    consistency: 0,
    outcome: "completed",
    qualification: "solved",
    verification: { revision: 2, passed: 8, total: 8, runs: 2, submissions: 1 },
    submissionId: "submission-1",
    ...overrides,
  };
}

test("accepted solve creates a private explain-first draft linked to its exact submission", () => {
  const review = createSolutionReview({
    id: "review-1",
    attempt: acceptedAttempt(),
    submissionId: "submission-1",
    teachBackPrompt: "Why does the complement lookup only use earlier indices?",
    now: "2026-07-28T10:11:00.000Z",
  });
  assert.equal(review.attemptId, "attempt-1");
  assert.equal(review.submissionId, "submission-1");
  assert.equal(review.step, "explain");
  assert.equal(review.status, "draft");
  assert.equal(review.revealedAt, undefined);
  assert.equal(review.explanationSkipped, false);
});

test("nonaccepted or non-solving evidence cannot unlock a solution review", () => {
  assert.throws(
    () =>
      createSolutionReview({
        id: "review-1",
        attempt: acceptedAttempt({ verification: { revision: 2, passed: 7, total: 8 } }),
        teachBackPrompt: "Explain it",
        now: "2026-07-28T10:11:00.000Z",
      }),
    /accepted solve/,
  );
  assert.throws(
    () =>
      createSolutionReview({
        id: "review-2",
        attempt: acceptedAttempt({ practiceKind: "typing" }),
        teachBackPrompt: "Explain it",
        now: "2026-07-28T10:11:00.000Z",
      }),
    /accepted solve/,
  );
  assert.throws(
    () =>
      createSolutionReview({
        id: "review-3",
        attempt: acceptedAttempt(),
        submissionId: "submission-other",
        teachBackPrompt: "Explain it",
        now: "2026-07-28T10:11:00.000Z",
      }),
    /must match/,
  );
});

test("timed-run context is derived from trusted attempt membership", () => {
  const attempt = acceptedAttempt();
  const review = createSolutionReview({
    id: "review-1",
    attempt,
    teachBackPrompt: "Explain it",
    now: "2026-07-28T10:11:00.000Z",
    unlockContext: "finished-timed-run",
  });
  const options = {
    attemptsById: new Map([[attempt.id, attempt]]),
    validItemIds: new Set([attempt.itemId]),
    submissionIds: new Set(),
    submissionsById: new Map(),
  };
  assert.equal(
    normalizeSolutionReviews([review], {
      ...options,
      timedAttemptIds: new Set(),
    })[0].unlockContext,
    "accepted-practice",
  );
  assert.equal(
    normalizeSolutionReviews([review], {
      ...options,
      timedAttemptIds: new Set([attempt.id]),
    })[0].unlockContext,
    "finished-timed-run",
  );
});

test("normalization rejects orphan and mismatched reviews", () => {
  const attempt = acceptedAttempt();
  const base = createSolutionReview({
    id: "review-1",
    attempt,
    teachBackPrompt: "Explain it",
    now: "2026-07-28T10:11:00.000Z",
  });
  const options = {
    attemptsById: new Map([[attempt.id, attempt]]),
    validItemIds: new Set([attempt.itemId]),
    submissionIds: new Set(["submission-1"]),
  };
  assert.equal(normalizeSolutionReviews([base], options).length, 1);
  assert.deepEqual(
    normalizeSolutionReviews([{ ...base, attemptId: "missing" }], options),
    [],
  );
  assert.deepEqual(
    normalizeSolutionReviews([{ ...base, itemRevision: 99 }], options),
    [],
  );
  assert.deepEqual(
    normalizeSolutionReviews([base], {
      ...options,
      attemptsById: new Map([
        [
          attempt.id,
          acceptedAttempt({
            verification: {
              revision: 2,
              passed: 7,
              total: 8,
              runs: 2,
              submissions: 1,
            },
          }),
        ],
      ]),
    }),
    [],
  );
});

test("an explicit attempt-submission link must point to matching accepted receipt evidence", () => {
  const attempt = acceptedAttempt();
  const review = createSolutionReview({
    id: "review-1",
    attempt,
    submissionId: "submission-1",
    teachBackPrompt: "Explain it",
    now: "2026-07-28T10:11:00.000Z",
  });
  const options = {
    attemptsById: new Map([[attempt.id, attempt]]),
    validItemIds: new Set([attempt.itemId]),
    submissionIds: new Set(["submission-1"]),
  };
  const receipt = {
    id: "submission-1",
    lifecycle: "settled",
    status: "accepted",
    itemId: "python:1",
    itemRevision: 2,
    language: "python",
  };
  assert.equal(
    normalizeSolutionReviews([review], {
      ...options,
      submissionsById: new Map([[receipt.id, receipt]]),
    }).length,
    1,
  );
  assert.deepEqual(
    normalizeSolutionReviews([review], {
      ...options,
      submissionsById: new Map([
        [receipt.id, { ...receipt, status: "wrong-answer" }],
      ]),
    }),
    [],
  );
  assert.deepEqual(
    normalizeSolutionReviews([review], {
      ...options,
      submissionsById: new Map([
        [receipt.id, { ...receipt, itemId: "python:217" }],
      ]),
    }),
    [],
  );
  assert.deepEqual(
    normalizeSolutionReviews(
      [{ ...review, submissionId: "submission-other" }],
      {
        ...options,
        submissionIds: new Set(["submission-1", "submission-other"]),
        submissionsById: new Map([
          [receipt.id, receipt],
          ["submission-other", { ...receipt, id: "submission-other" }],
        ]),
      },
    ),
    [],
  );
});

test("normalization bounds text, drops missing source links, and keeps receipt-independent review", () => {
  const attempt = acceptedAttempt();
  const base = createSolutionReview({
    id: "review-1",
    attempt,
    teachBackPrompt: "Explain it",
    now: "2026-07-28T10:11:00.000Z",
  });
  const [review] = normalizeSolutionReviews(
    [
      {
        ...base,
        linkedSubmissionId: "missing-link",
        explainApproach: "x".repeat(SOLUTION_REVIEW_LIMITS.maxExplanationBytes + 50),
      },
    ],
    {
      attemptsById: new Map([[attempt.id, attempt]]),
      validItemIds: new Set([attempt.itemId]),
      submissionIds: new Set(),
      submissionsById: new Map(),
    },
  );
  assert.equal(review.submissionId, undefined);
  assert.equal(review.linkedSubmissionId, undefined);
  assert.equal(new TextEncoder().encode(review.explainApproach).byteLength, SOLUTION_REVIEW_LIMITS.maxExplanationBytes);
});

test("latest record wins per attempt and completed records require a real schedule", () => {
  const attempt = acceptedAttempt();
  const first = createSolutionReview({
    id: "review-1",
    attempt,
    teachBackPrompt: "Explain it",
    now: "2026-07-28T10:11:00.000Z",
  });
  const second = {
    ...first,
    updatedAt: "2026-07-28T10:12:00.000Z",
    step: "compare",
    revealedAt: "2026-07-28T10:12:00.000Z",
  };
  const options = {
    attemptsById: new Map([[attempt.id, attempt]]),
    validItemIds: new Set([attempt.itemId]),
  };
  assert.equal(upsertSolutionReview([first], second, options)[0].step, "compare");
  assert.deepEqual(
    normalizeSolutionReviews(
      [{ ...second, status: "completed", step: "complete" }],
      options,
    ),
    [],
  );
});

test("mistake routing and recommendation copy are deterministic", () => {
  assert.equal(activityKindForMistake("python-syntax"), "syntax");
  assert.equal(activityKindForMistake("complexity"), "concept");
  assert.equal(activityKindForMistake("edge-case"), "solve");
  assert.match(scheduleReasonForReview({ grade: "again" }), /tomorrow/);
  assert.match(
    scheduleReasonForReview({ grade: "easy", qualification: "solved" }),
    /advance/,
  );
  assert.match(
    scheduleReasonForReview({ mistakeCategory: "python-syntax" }),
    /next full solve/,
  );
  assert.match(
    scheduleReasonForReview({ mistakeCategory: "complexity" }),
    /next full solve/,
  );
});

test("completed schedule copy is re-derived instead of trusting stale imports", () => {
  const attempt = acceptedAttempt();
  const draft = createSolutionReview({
    id: "review-1",
    attempt,
    teachBackPrompt: "Explain it",
    now: "2026-07-28T10:11:00.000Z",
  });
  const [review] = normalizeSolutionReviews(
    [
      {
        ...draft,
        status: "completed",
        step: "complete",
        mistakeCategory: "python-syntax",
        grade: "hard",
        activityKind: "solve",
        dueAt: "2026-07-29T10:11:00.000Z",
        completedAt: "2026-07-28T10:12:00.000Z",
        scheduleReason: "Repair language separately before the next task.",
      },
    ],
    {
      attemptsById: new Map([[attempt.id, attempt]]),
      validItemIds: new Set([attempt.itemId]),
      submissionIds: new Set(),
      submissionsById: new Map(),
    },
  );
  assert.match(review.scheduleReason, /next full solve/);
  assert.doesNotMatch(review.scheduleReason, /separately/);
});
