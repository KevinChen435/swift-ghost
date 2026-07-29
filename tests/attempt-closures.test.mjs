import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTEMPT_CLOSURE_MISTAKE_TAGS,
  attemptClosureCompletionIssues,
  completeAttemptClosure,
  createAttemptClosureWorkspace,
  deriveAttemptClosureModel,
  normalizeAttemptClosureWorkspace,
  reconcileAttemptClosureWorkspace,
  selectAttemptClosureById,
  selectAttemptClosures,
  updateAttemptClosureDraft,
} from "../app/lib/attempt-closures.mjs";

const T0 = "2026-07-20T12:00:00.000Z";
const T1 = "2026-07-21T12:00:00.000Z";
const T2 = "2026-07-22T12:00:00.000Z";
const item = {
  itemId: "python:1",
  contentRevision: 3,
  title: "Two Sum",
  language: "python",
  track: "interview",
  verification: { revision: 7 },
};

function failedReceipt(overrides = {}) {
  return {
    id: "submission-failed",
    itemId: item.itemId,
    itemRevision: item.contentRevision,
    language: "python",
    lifecycle: "settled",
    requestedAt: T0,
    settledAt: T0,
    status: "wrong-answer",
    assistance: "used",
    judge: { kind: "browser-python-local", revision: 7 },
    passed: 2,
    total: 4,
    ...overrides,
  };
}

function abandonedAttempt(overrides = {}) {
  return {
    id: "attempt-abandoned",
    itemId: item.itemId,
    itemRevision: item.contentRevision,
    titleSnapshot: item.title,
    language: "python",
    practiceKind: "solving",
    outcome: "abandoned",
    qualification: "assisted",
    peeks: 1,
    startedAt: T0,
    completedAt: T0,
    ...overrides,
  };
}

function acceptedPair(overrides = {}) {
  const receipt = {
    id: "submission-accepted",
    itemId: item.itemId,
    itemRevision: item.contentRevision,
    language: "python",
    lifecycle: "settled",
    requestedAt: T2,
    settledAt: T2,
    status: "accepted",
    assistance: "none-recorded",
    judge: { kind: "browser-python-local", revision: 7 },
    passed: 4,
    total: 4,
    ...overrides.receipt,
  };
  const attempt = {
    id: "attempt-accepted",
    itemId: item.itemId,
    itemRevision: item.contentRevision,
    titleSnapshot: item.title,
    language: "python",
    practiceKind: "solving",
    outcome: "completed",
    qualification: "solved",
    peeks: 0,
    startedAt: T2,
    completedAt: T2,
    submissionId: receipt.id,
    verification: { revision: 7, passed: 4, total: 4 },
    ...overrides.attempt,
  };
  return { attempt, receipt };
}

function fill(workspace, id, now = T0) {
  return updateAttemptClosureDraft(workspace, id, {
    mistakeTags: ["boundary", "not-supported"],
    firstWrongDecision: "I skipped the duplicate-value case.",
    verificationNotes: "Trace duplicates before the next submission.",
    teachBack: "Check the complement before storing the current index.",
    grade: "again",
  }, { now });
}

test("reconciliation creates one immutable draft for each eligible evidence anchor", () => {
  const workspace = reconcileAttemptClosureWorkspace(createAttemptClosureWorkspace(T0), {
    items: [item],
    attempts: [abandonedAttempt()],
    submissionReceipts: [failedReceipt(), failedReceipt()],
    now: T0,
  });
  assert.equal(workspace.closures.length, 2);
  assert.deepEqual(workspace.closures.map((entry) => entry.anchor.kind), [
    "attempt",
    "submission",
  ]);
  const submission = workspace.closures.find((entry) => entry.anchor.kind === "submission");
  assert.deepEqual(
    {
      itemId: submission.anchor.itemId,
      revision: submission.anchor.itemRevision,
      lane: submission.anchor.lane,
      outcome: submission.anchor.outcome,
      assistance: submission.anchor.assistance,
      submissionId: submission.anchor.submissionId,
    },
    {
      itemId: "python:1",
      revision: 3,
      lane: "python",
      outcome: "wrong-answer",
      assistance: "used",
      submissionId: "submission-failed",
    },
  );
});

test("normalization rejects unsupported tags, invalid drafts, and duplicate anchors", () => {
  const base = normalizeAttemptClosureWorkspace({}, {
    items: [item],
    submissionReceipts: [failedReceipt()],
    now: T0,
  });
  const draft = base.closures[0];
  const normalized = normalizeAttemptClosureWorkspace({
    ...base,
    closures: [
      { ...draft, mistakeTags: ["secret", "boundary"] },
      { ...draft, updatedAt: T1, mistakeTags: ["verification"] },
      { ...draft, anchor: { ...draft.anchor, id: "missing" } },
    ],
  }, {
    items: [item],
    submissionReceipts: [failedReceipt()],
    now: T2,
  });
  assert.equal(normalized.closures.length, 1);
  assert.deepEqual(normalized.closures[0].mistakeTags, ["verification"]);
  assert.deepEqual(
    ATTEMPT_CLOSURE_MISTAKE_TAGS.includes(normalized.closures[0].mistakeTags[0]),
    true,
  );
});

test("completion requires a real reflection and schedules retry tomorrow without mastery claims", () => {
  let workspace = normalizeAttemptClosureWorkspace({}, {
    items: [item],
    submissionReceipts: [failedReceipt()],
    now: T0,
  });
  const id = workspace.closures[0].id;
  assert.ok(attemptClosureCompletionIssues(workspace.closures[0]).length >= 5);
  assert.throws(() => completeAttemptClosure(workspace, id, { now: T0 }), /incomplete/);
  workspace = fill(workspace, id, T0);
  workspace = completeAttemptClosure(workspace, id, { now: T0 });
  assert.equal(workspace.closures[0].retryDueAt, T1);
  assert.throws(
    () => updateAttemptClosureDraft(workspace, id, { grade: "easy" }),
    /immutable/,
  );
  const model = deriveAttemptClosureModel(workspace, {
    items: [item],
    submissionReceipts: [failedReceipt()],
    now: T1,
  });
  assert.equal(model.records[0].status, "due");
  assert.equal(model.records[0].claimsIndependentSolve, false);
  assert.equal(model.records[0].claimsMastery, false);
  assert.equal(model.records[0].learningClaim, "remediation-only");
});

test("draft edits and completion reject stale record timestamps", () => {
  let workspace = normalizeAttemptClosureWorkspace({}, {
    items: [item],
    submissionReceipts: [failedReceipt()],
    now: T0,
  });
  const id = workspace.closures[0].id;
  const originalUpdatedAt = workspace.closures[0].updatedAt;
  workspace = fill(workspace, id, T1);
  assert.throws(
    () => updateAttemptClosureDraft(
      workspace,
      id,
      { teachBack: "This stale browser edit must not overwrite newer work." },
      { now: T2, expectedUpdatedAt: originalUpdatedAt },
    ),
    /changed before this edit was saved/,
  );
  assert.throws(
    () => completeAttemptClosure(workspace, id, {
      now: T2,
      expectedUpdatedAt: originalUpdatedAt,
    }),
    /changed before this edit was saved/,
  );
  assert.equal(workspace.closures[0].state, "draft");
});

test("only a later current-revision hint-free accepted attempt with its exact receipt resolves", () => {
  let workspace = normalizeAttemptClosureWorkspace({}, {
    items: [item],
    submissionReceipts: [failedReceipt()],
    now: T0,
  });
  workspace = completeAttemptClosure(fill(workspace, workspace.closures[0].id), workspace.closures[0].id, { now: T0 });
  const { attempt, receipt } = acceptedPair();
  const unresolvedInputs = [
    { attempt: { ...attempt, peeks: 1 }, receipt },
    { attempt, receipt: { ...receipt, assistance: "used" } },
    { attempt, receipt: { ...receipt, judge: { ...receipt.judge, revision: 6 } } },
    { attempt, receipt: { ...receipt, id: "other-receipt" } },
    { attempt: { ...attempt, itemRevision: 2 }, receipt: { ...receipt, itemRevision: 2 } },
    {
      attempt: {
        ...attempt,
        completedAt: "2026-07-20T18:00:00.000Z",
      },
      receipt: {
        ...receipt,
        requestedAt: "2026-07-20T18:00:00.000Z",
        settledAt: "2026-07-20T18:00:00.000Z",
      },
    },
    {
      attempt: {
        ...attempt,
        startedAt: "2026-07-21T11:59:59.000Z",
      },
      receipt,
    },
    {
      attempt,
      receipt: {
        ...receipt,
        requestedAt: "2026-07-21T11:59:59.000Z",
      },
    },
  ];
  for (const candidate of unresolvedInputs) {
    const model = deriveAttemptClosureModel(workspace, {
      items: [item],
      attempts: [candidate.attempt],
      submissionReceipts: [failedReceipt(), candidate.receipt],
      now: T2,
    });
    assert.equal(model.records[0].status, "due");
  }
  const model = deriveAttemptClosureModel(workspace, {
    items: [item],
    attempts: [attempt],
    submissionReceipts: [failedReceipt(), receipt],
    selectedId: workspace.closures[0].id,
    now: T2,
  });
  assert.equal(model.records[0].status, "resolved");
  assert.equal(model.records[0].resolutionAttemptId, attempt.id);
  assert.equal(model.records[0].resolutionSubmissionId, receipt.id);
  assert.equal(model.selected.id, workspace.closures[0].id);
});

test("completed stale records retire while stale drafts are removed", () => {
  let draftWorkspace = normalizeAttemptClosureWorkspace({}, {
    items: [item],
    submissionReceipts: [failedReceipt()],
    now: T0,
  });
  const staleItem = { ...item, contentRevision: 4 };
  assert.equal(normalizeAttemptClosureWorkspace(draftWorkspace, {
    items: [staleItem],
    submissionReceipts: [failedReceipt()],
    now: T2,
  }).closures.length, 0);

  draftWorkspace = completeAttemptClosure(
    fill(draftWorkspace, draftWorkspace.closures[0].id),
    draftWorkspace.closures[0].id,
    { now: T0 },
  );
  const stale = normalizeAttemptClosureWorkspace(draftWorkspace, {
    items: [staleItem],
    submissionReceipts: [failedReceipt()],
    now: T2,
  });
  assert.equal(stale.closures.length, 1);
  assert.equal(stale.closures[0].retired, true);
  assert.equal(deriveAttemptClosureModel(stale, {
    items: [staleItem],
    submissionReceipts: [failedReceipt()],
    now: T2,
  }).records[0].status, "retired");
});

test("selectors and summary support Today and Weakness views", () => {
  let workspace = normalizeAttemptClosureWorkspace({}, {
    items: [item],
    attempts: [abandonedAttempt()],
    submissionReceipts: [failedReceipt()],
    now: T0,
  });
  const submission = workspace.closures.find((entry) => entry.anchor.kind === "submission");
  workspace = completeAttemptClosure(fill(workspace, submission.id), submission.id, { now: T0 });
  const model = deriveAttemptClosureModel(workspace, {
    items: [item],
    attempts: [abandonedAttempt()],
    submissionReceipts: [failedReceipt()],
    now: T1,
  });
  assert.deepEqual(selectAttemptClosures(model.records, { status: "due" }).map((entry) => entry.id), [submission.id]);
  assert.equal(selectAttemptClosureById(model.records, submission.id).id, submission.id);
  assert.equal(model.summary.total, 2);
  assert.equal(model.summary.due, 1);
  assert.equal(model.summary.open, 1);
  assert.equal(model.summary.laneCounts.python, 2);
  assert.equal(model.today.length, 1);
  assert.equal(model.weakness.length, 1);
});
