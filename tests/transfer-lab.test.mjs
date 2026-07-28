import assert from "node:assert/strict";
import test from "node:test";

import {
  TRANSFER_REVIEW_INTERVAL_DAYS,
  TRANSFER_WORKSPACE_LIMITS,
  createTransferWorkspace,
  deriveTransferProgress,
  normalizeTransferWorkspace,
  recordTransferHint,
  recordTransferOpened,
  selectNextTransferVariant,
} from "../app/lib/transfer-lab.mjs";
import {
  createSubmissionLog,
  requestSubmission,
  settleSubmission,
  settledSubmissionEvidence,
} from "../app/lib/submission-log.mjs";

const t0 = "2026-01-01T00:00:00.000Z";
const hour = 3_600_000;
const day = 86_400_000;

function at(offsetMs) {
  return new Date(Date.parse(t0) + offsetMs).toISOString();
}

function variant(variantId, overrides = {}) {
  return { variantId, variantRevision: 1, eligible: true, ...overrides };
}

function solve(variantId, completedAt, overrides = {}) {
  return {
    id: `attempt:${variantId}:${completedAt}`,
    variantId,
    variantRevision: 1,
    practiceKind: "solving",
    outcome: "completed",
    qualification: "solved",
    peeks: 0,
    completedAt,
    verification: { passed: 5, total: 5 },
    ...overrides,
  };
}

function submission(variantId, submittedAt, overrides = {}) {
  return {
    id: `submission:${variantId}:${submittedAt}`,
    variantId,
    variantRevision: 1,
    submittedAt,
    status: "accepted",
    passed: 8,
    total: 8,
    assistanceUsed: false,
    ...overrides,
  };
}

function progressFor(variantInput, options = {}) {
  return deriveTransferProgress({
    variants: [variantInput],
    workspace: options.workspace ?? createTransferWorkspace(t0),
    attempts: options.attempts ?? [],
    submissions: options.submissions ?? [],
    now: options.now ?? t0,
  })[0];
}

test("creates a deterministic, complete, empty workspace", () => {
  assert.deepEqual(createTransferWorkspace(t0), {
    version: 1,
    revision: 0,
    updatedAt: t0,
    coverage: "complete",
    exposures: [],
  });
  assert.deepEqual(createTransferWorkspace("not a date"), createTransferWorkspace());
  assert.deepEqual(TRANSFER_REVIEW_INTERVAL_DAYS, [1, 3, 7, 14, 30]);
});

test("normalizes hostile imports deterministically, merges duplicates, and bounds fields", () => {
  const input = {
    version: 999,
    revision: Number.POSITIVE_INFINITY,
    updatedAt: "invalid",
    coverage: "complete",
    exposures: [
      {
        variantId: "v:b",
        variantRevision: -4,
        firstOpenedAt: at(3 * hour),
        lastOpenedAt: at(hour),
        openCount: -20,
        maxHintLevel: 99,
        hintedAt: at(2 * hour),
      },
      {
        variantId: "v:b",
        variantRevision: 1,
        firstOpenedAt: at(4 * hour),
        lastOpenedAt: at(5 * hour),
        openCount: Number.POSITIVE_INFINITY,
        maxHintLevel: 1,
        referenceRevealedAt: at(6 * hour),
      },
      { variantId: "bad id!", openCount: 10 },
      null,
    ],
  };
  const snapshot = structuredClone(input);
  const normalized = normalizeTransferWorkspace(input, { now: at(10 * hour) });

  assert.deepEqual(input, snapshot);
  assert.equal(normalized.version, 1);
  assert.equal(normalized.revision, 0);
  assert.equal(normalized.updatedAt, at(10 * hour));
  assert.equal(normalized.coverage, "partial");
  assert.deepEqual(normalized.exposures, [
    {
      variantId: "v:b",
      variantRevision: 1,
      firstOpenedAt: at(hour),
      lastOpenedAt: at(5 * hour),
      openCount: 1,
      maxHintLevel: 3,
      firstHintedAt: at(2 * hour),
      lastHintedAt: at(2 * hour),
      referenceRevealedAt: at(6 * hour),
    },
  ]);
  assert.deepEqual(
    normalizeTransferWorkspace(normalized, { now: at(20 * hour) }),
    normalized,
  );
});

test("normalization supports keyed legacy shapes but marks unknown coverage partial", () => {
  const normalized = normalizeTransferWorkspace({
    variants: {
      "v:z": { openCount: 7, lastOpenedAt: t0 },
      "v:a": { firstOpenedAt: at(hour), maxHintLevel: 2 },
    },
  });
  assert.equal(normalized.coverage, "partial");
  assert.deepEqual(normalized.exposures.map(({ variantId }) => variantId), ["v:a", "v:z"]);
  assert.equal(normalized.exposures[0].lastOpenedAt, at(hour));
  assert.equal(normalized.exposures[1].firstOpenedAt, t0);
});

test("malformed current workspaces fail closed while an absent workspace is a fresh start", () => {
  assert.equal(normalizeTransferWorkspace(undefined, { now: t0 }).coverage, "complete");
  assert.equal(normalizeTransferWorkspace("corrupt", { now: t0 }).coverage, "partial");
  assert.equal(
    normalizeTransferWorkspace({ coverage: "complete" }, { now: t0 }).coverage,
    "partial",
  );
});

test("normalization caps exposure records and fails closed after truncation", () => {
  const count = TRANSFER_WORKSPACE_LIMITS.maxExposures + 3;
  const exposures = Array.from({ length: count }, (_, index) => ({
    variantId: `v:${String(index).padStart(4, "0")}`,
    variantRevision: 1,
    firstOpenedAt: at(index * hour),
    lastOpenedAt: at(index * hour),
    openCount: TRANSFER_WORKSPACE_LIMITS.maxOpenCount + 50,
    maxHintLevel: index % 4,
  }));
  const normalized = normalizeTransferWorkspace({ coverage: "complete", exposures });
  assert.equal(normalized.exposures.length, TRANSFER_WORKSPACE_LIMITS.maxExposures);
  assert.equal(normalized.coverage, "partial");
  assert.equal(normalized.exposures.some(({ variantId }) => variantId === "v:0000"), false);
  assert.equal(
    normalized.exposures.every(
      ({ openCount }) => openCount === TRANSFER_WORKSPACE_LIMITS.maxOpenCount,
    ),
    true,
  );
});

test("records first and repeated prompt opens immutably for an exact revision", () => {
  const initial = createTransferWorkspace(t0);
  const first = recordTransferOpened(initial, "v:one", {
    variantRevision: 2,
    now: at(2 * hour),
  });
  const later = recordTransferOpened(first, "v:one", {
    variantRevision: 2,
    now: at(4 * hour),
  });
  const outOfOrder = recordTransferOpened(later, "v:one", {
    variantRevision: 2,
    now: at(hour),
  });

  assert.deepEqual(initial.exposures, []);
  assert.equal(first.revision, 1);
  assert.equal(later.revision, 2);
  assert.equal(outOfOrder.revision, 3);
  assert.deepEqual(outOfOrder.exposures[0], {
    variantId: "v:one",
    variantRevision: 2,
    firstOpenedAt: at(hour),
    lastOpenedAt: at(4 * hour),
    openCount: 3,
    maxHintLevel: 0,
    firstHintedAt: null,
    lastHintedAt: null,
    referenceRevealedAt: null,
  });
  assert.equal(first.exposures[0].openCount, 1);
});

test("records bounded hints and reference exposure without laundering prior evidence", () => {
  const opened = recordTransferOpened(createTransferWorkspace(t0), "v:hinted", { now: t0 });
  const hinted = recordTransferHint(opened, "v:hinted", 99, { now: at(hour) });
  const lowerHint = recordTransferHint(hinted, "v:hinted", 1, { now: at(2 * hour) });
  const revealed = recordTransferHint(lowerHint, "v:hinted", 0, {
    now: at(3 * hour),
    referenceRevealed: true,
  });

  assert.equal(opened.exposures[0].maxHintLevel, 0);
  assert.equal(revealed.exposures[0].maxHintLevel, 3);
  assert.equal(revealed.exposures[0].firstHintedAt, at(hour));
  assert.equal(revealed.exposures[0].lastHintedAt, at(2 * hour));
  assert.equal(revealed.exposures[0].referenceRevealedAt, at(3 * hour));
  assert.equal(revealed.exposures[0].openCount, 1);
});

test("invalid mutations are deterministic no-ops and never mutate their inputs", () => {
  const workspace = recordTransferOpened(createTransferWorkspace(t0), "v:one", { now: t0 });
  const snapshot = structuredClone(workspace);
  const badOpen = recordTransferOpened(workspace, "not valid!", { now: at(hour) });
  const badHint = recordTransferHint(workspace, "v:one", Number.NaN, { now: at(hour) });
  assert.deepEqual(workspace, snapshot);
  assert.deepEqual(badOpen, workspace);
  assert.deepEqual(badHint, workspace);
});

test("derives unseen, opened, and attempted states separately", () => {
  const item = variant("v:states");
  const unseen = progressFor(item);
  assert.equal(unseen.status, "unseen");
  assert.equal(unseen.isUnseen, true);

  const workspace = recordTransferOpened(createTransferWorkspace(t0), item.variantId, { now: t0 });
  const opened = progressFor(item, { workspace });
  assert.equal(opened.status, "opened");
  assert.equal(opened.isOpened, true);
  assert.equal(opened.isAttempted, false);

  const attempted = progressFor(item, {
    workspace,
    attempts: [
      solve(item.variantId, at(hour), {
        outcome: "abandoned",
        qualification: "incomplete",
        verification: { passed: 1, total: 5 },
      }),
    ],
    now: at(2 * hour),
  });
  assert.equal(attempted.status, "attempted");
  assert.equal(attempted.isAttempted, true);
  assert.equal(attempted.isProven, false);
});

test("generic catalog records prefer stable string item IDs over numeric authoring IDs", () => {
  const item = {
    id: 20_001,
    itemId: "python:20001",
    contentRevision: 4,
    eligible: true,
  };
  const progress = progressFor(item);
  assert.equal(progress.variantId, "python:20001");
  assert.equal(progress.variantRevision, 4);
  assert.equal(progress.status, "unseen");
});

test("a current-revision, hint-free, fully verified solve is initial proven evidence", () => {
  const item = variant("v:proof", { variantRevision: 3 });
  const attempt = solve(item.variantId, at(hour), {
    variantRevision: 3,
    itemRevision: 999,
  });
  const progress = progressFor(item, { attempts: [attempt], now: at(2 * hour) });
  assert.equal(progress.status, "proven");
  assert.equal(progress.isProven, true);
  assert.equal(progress.independentSolveCount, 1);
  assert.equal(progress.spacedSolveCount, 1);
  assert.equal(progress.firstProvenAt, at(hour));
  assert.equal(progress.dueAt, at(hour + day));
});

test("hints and an earlier reference contaminate otherwise passing evidence", () => {
  const item = variant("v:contaminated");
  let workspace = recordTransferOpened(createTransferWorkspace(t0), item.variantId, { now: t0 });
  workspace = recordTransferHint(workspace, item.variantId, 1, { now: at(hour) });
  const hinted = progressFor(item, {
    workspace,
    attempts: [solve(item.variantId, at(2 * hour))],
    now: at(3 * hour),
  });
  assert.equal(hinted.status, "assisted");
  assert.equal(hinted.isAssisted, true);
  assert.equal(hinted.isProven, false);

  let referenceWorkspace = recordTransferOpened(createTransferWorkspace(t0), item.variantId, { now: t0 });
  referenceWorkspace = recordTransferHint(referenceWorkspace, item.variantId, 0, {
    now: at(hour),
    referenceRevealed: true,
  });
  const referenced = progressFor(item, {
    workspace: referenceWorkspace,
    submissions: [submission(item.variantId, at(2 * hour))],
    now: at(3 * hour),
  });
  assert.equal(referenced.status, "assisted");
  assert.equal(referenced.isProven, false);
});

test("later reference exposure remains visible without erasing an earlier clean proof", () => {
  const item = variant("v:later-reference");
  let workspace = recordTransferOpened(createTransferWorkspace(t0), item.variantId, { now: t0 });
  workspace = recordTransferHint(workspace, item.variantId, 0, {
    now: at(2 * hour),
    referenceRevealed: true,
  });
  const progress = progressFor(item, {
    workspace,
    attempts: [solve(item.variantId, at(hour))],
    now: at(3 * hour),
  });
  assert.equal(progress.status, "proven");
  assert.equal(progress.isProven, true);
  assert.equal(progress.isAssisted, true);
});

test("failed submissions are attempted evidence, never proven evidence", () => {
  const item = variant("v:failed");
  const progress = progressFor(item, {
    submissions: [
      submission(item.variantId, at(hour), {
        status: "wrong-answer",
        passed: 6,
        total: 8,
      }),
    ],
    now: at(2 * hour),
  });
  assert.equal(progress.status, "attempted");
  assert.equal(progress.submissionCount, 1);
  assert.equal(progress.failedSubmissionCount, 1);
  assert.equal(progress.independentSolveCount, 0);
});

test("judge interruptions are infrastructure evidence, not learner failures", () => {
  const item = variant("v:judge-interrupted");
  const progress = progressFor(item, {
    submissions: [
      submission(item.variantId, at(hour), {
        status: "judge-error",
        passed: 0,
        total: 0,
      }),
    ],
    now: at(2 * hour),
  });
  assert.equal(progress.status, "attempted");
  assert.equal(progress.submissionCount, 1);
  assert.equal(progress.failedSubmissionCount, 0);
  assert.equal(progress.isProven, false);
});

test("accepted submissions fail closed unless assistance is explicitly absent", () => {
  const item = variant("v:receipt");
  const missingAssistance = progressFor(item, {
    submissions: [submission(item.variantId, at(hour), { assistanceUsed: undefined })],
    now: at(2 * hour),
  });
  assert.equal(missingAssistance.status, "attempted");
  assert.equal(missingAssistance.isProven, false);

  const clean = progressFor(item, {
    submissions: [submission(item.variantId, at(hour))],
    now: at(2 * hour),
  });
  assert.equal(clean.status, "proven");
});

test("a current clean submission receipt crosses the real log-to-transfer evidence bridge", () => {
  const item = variant("v:durable-clean");
  let log = requestSubmission(createSubmissionLog(), {
    id: "receipt:durable-clean",
    itemId: item.variantId,
    titleSnapshot: "Durable clean transfer",
    language: "python",
    itemRevision: item.variantRevision,
    requestedAt: at(hour),
    source: "class Solution:\n    pass\n",
    judge: { kind: "browser-python-local", revision: 1 },
    context: { kind: "transfer" },
    assistance: "none-recorded",
  });
  log = settleSubmission(log, "receipt:durable-clean", {
    settledAt: at(hour + 1_000),
    status: "accepted",
    durationMs: 20,
    passed: 8,
    total: 8,
  });

  const progress = progressFor(item, {
    submissions: settledSubmissionEvidence(log),
    now: at(2 * hour),
  });
  assert.equal(progress.status, "proven");
  assert.equal(progress.isProven, true);
  assert.equal(progress.independentSolveCount, 1);
});

test("every assisted accepted-receipt alias is excluded from proof", () => {
  const item = variant("v:assisted-receipts");
  const assistedReceipts = [
    submission(item.variantId, at(hour), { peeks: 1 }),
    submission(item.variantId, at(hour), { hintLevel: 1 }),
    submission(item.variantId, at(hour), { answerUnlockedAt: at(hour / 2) }),
  ];
  for (const receipt of assistedReceipts) {
    const progress = progressFor(item, {
      submissions: [receipt],
      now: at(2 * hour),
    });
    assert.equal(progress.isAssisted, true);
    assert.equal(progress.isProven, false);
  }
});

test("stale revisions remain exposure but cannot attempt or prove the current revision", () => {
  const item = variant("v:revised", { variantRevision: 2 });
  const progress = progressFor(item, {
    attempts: [solve(item.variantId, at(hour), { variantRevision: 1 })],
    submissions: [submission(item.variantId, at(2 * hour), { variantRevision: 1 })],
    now: at(3 * hour),
  });
  assert.equal(progress.status, "opened");
  assert.equal(progress.isUnseen, false);
  assert.equal(progress.isOpened, true);
  assert.equal(progress.isAttempted, false);
  assert.equal(progress.isProven, false);
  assert.equal(progress.attemptCount, 0);
  assert.equal(progress.submissionCount, 0);
});

test("attempt and linked accepted receipt count as one independent solve", () => {
  const item = variant("v:dedupe");
  const attempt = solve(item.variantId, at(hour), { id: "attempt:shared" });
  const receipt = submission(item.variantId, at(2 * hour), { attemptId: "attempt:shared" });
  const progress = progressFor(item, {
    attempts: [attempt],
    submissions: [receipt],
    now: at(3 * hour),
  });
  assert.equal(progress.attemptCount, 1);
  assert.equal(progress.submissionCount, 1);
  assert.equal(progress.independentSolveCount, 1);
});

test("non-adjacent duplicate solve IDs count once", () => {
  const item = variant("v:duplicate-id");
  const attempts = [
    solve(item.variantId, t0, { id: "attempt:duplicate" }),
    solve(item.variantId, at(day), { id: "attempt:middle" }),
    solve(item.variantId, at(4 * day), { id: "attempt:duplicate" }),
  ];
  const progress = progressFor(item, { attempts, now: at(5 * day) });
  assert.equal(progress.independentSolveCount, 2);
  assert.equal(progress.spacedSolveCount, 2);
  assert.equal(progress.lastProvenAt, at(day));
});

test("spaced independent solves advance conservative 1, 3, 7, 14, and 30 day intervals", () => {
  const item = variant("v:spaced");
  const times = [
    at(0),
    at(12 * hour),
    at(day),
    at(4 * day),
    at(11 * day),
    at(25 * day),
    at(55 * day),
  ];
  const progress = progressFor(item, {
    attempts: times.map((completedAt, index) =>
      solve(item.variantId, completedAt, { id: `attempt:${index}` }),
    ),
    now: at(56 * day),
  });
  assert.equal(progress.independentSolveCount, 7);
  assert.equal(progress.spacedSolveCount, 6);
  assert.equal(progress.lastProvenAt, at(55 * day));
  assert.equal(progress.dueAt, at(85 * day));
  assert.equal(progress.isDue, false);
});

test("proven evidence becomes due at the exact scheduled boundary", () => {
  const item = variant("v:due");
  const before = progressFor(item, {
    attempts: [solve(item.variantId, t0)],
    now: at(day - 1),
  });
  const due = progressFor(item, {
    attempts: [solve(item.variantId, t0)],
    now: at(day),
  });
  assert.equal(before.status, "proven");
  assert.equal(before.isDue, false);
  assert.equal(due.status, "due");
  assert.equal(due.isDue, true);
});

test("a later hint preserves prior proof but blocks later solves from advancing spacing", () => {
  const item = variant("v:later-hint");
  let workspace = recordTransferOpened(createTransferWorkspace(t0), item.variantId, { now: t0 });
  workspace = recordTransferHint(workspace, item.variantId, 1, { now: at(2 * day) });
  const progress = progressFor(item, {
    workspace,
    attempts: [
      solve(item.variantId, t0, { id: "attempt:clean" }),
      solve(item.variantId, at(4 * day), { id: "attempt:after-hint" }),
    ],
    now: at(5 * day),
  });
  assert.equal(progress.isProven, true);
  assert.equal(progress.isAssisted, true);
  assert.equal(progress.independentSolveCount, 1);
  assert.equal(progress.spacedSolveCount, 1);
  assert.equal(progress.dueAt, at(day));
  assert.equal(progress.isDue, true);
});

test("future-dated successes cannot create proof", () => {
  const item = variant("v:future");
  const progress = progressFor(item, {
    attempts: [solve(item.variantId, at(day))],
    now: t0,
  });
  assert.equal(progress.status, "attempted");
  assert.equal(progress.isProven, false);
});

test("partial coverage fails closed instead of calling absent evidence unseen", () => {
  const item = variant("v:unknown");
  const workspace = normalizeTransferWorkspace({ version: 1, exposures: [] }, { now: t0 });
  const progress = progressFor(item, { workspace });
  assert.equal(workspace.coverage, "partial");
  assert.equal(progress.exposureUnknown, true);
  assert.equal(progress.isUnseen, false);
  assert.equal(progress.status, "opened");
});

test("selection prioritizes genuinely unseen eligible variants with stable ID ties", () => {
  const variants = [variant("v:z"), variant("v:a"), variant("v:blocked", { eligible: false })];
  const input = {
    variants,
    workspace: recordTransferOpened(createTransferWorkspace(t0), "v:z", { now: t0 }),
    attempts: [],
    submissions: [],
    now: at(hour),
  };
  const snapshot = structuredClone(input);
  assert.equal(selectNextTransferVariant(input)?.variantId, "v:a");
  assert.deepEqual(input, snapshot);
});

test("selection chooses the oldest due review after unseen work is exhausted", () => {
  const variants = [variant("v:later"), variant("v:earlier")];
  const attempts = [
    solve("v:later", at(day)),
    solve("v:earlier", t0),
  ];
  const selected = selectNextTransferVariant({
    variants,
    workspace: createTransferWorkspace(t0),
    attempts,
    submissions: [],
    now: at(3 * day),
  });
  assert.equal(selected?.variantId, "v:earlier");
});

test("selection falls back deterministically to incomplete, assisted, then opened work", () => {
  const variants = [variant("v:opened"), variant("v:assisted"), variant("v:attempted")];
  let workspace = createTransferWorkspace(t0);
  workspace = recordTransferOpened(workspace, "v:opened", { now: at(3 * hour) });
  workspace = recordTransferOpened(workspace, "v:assisted", { now: at(2 * hour) });
  workspace = recordTransferHint(workspace, "v:assisted", 2, { now: at(2 * hour) });
  workspace = recordTransferOpened(workspace, "v:attempted", { now: at(hour) });
  const attempts = [
    solve("v:attempted", at(hour), {
      outcome: "abandoned",
      qualification: "incomplete",
      verification: { passed: 0, total: 5 },
    }),
  ];

  const attemptedFirst = selectNextTransferVariant({
    variants,
    workspace,
    attempts,
    now: at(4 * hour),
  });
  assert.equal(attemptedFirst?.variantId, "v:attempted");

  const assistedNext = selectNextTransferVariant({
    variants: variants.slice(0, 2),
    workspace,
    attempts: [],
    now: at(4 * hour),
  });
  assert.equal(assistedNext?.variantId, "v:assisted");
});

test("selection honors explicit eligibility and excludes proven work that is not due", () => {
  const variants = [variant("v:a"), variant("v:b"), variant("v:c", { active: false })];
  const selected = selectNextTransferVariant({
    variants,
    workspace: createTransferWorkspace(t0),
    attempts: [solve("v:a", t0)],
    now: at(hour),
    eligibleVariantIds: new Set(["v:a", "v:b", "v:c"]),
  });
  assert.equal(selected?.variantId, "v:b");

  const none = selectNextTransferVariant({
    variants: [variant("v:a")],
    workspace: createTransferWorkspace(t0),
    attempts: [solve("v:a", t0)],
    now: at(hour),
  });
  assert.equal(none, null);
});

test("eligibility accepts any iterable and progress agrees with selection", () => {
  const variants = [variant("v:a"), variant("v:b")];
  const progress = deriveTransferProgress({
    variants,
    workspace: createTransferWorkspace(t0),
    eligibleVariantIds: new Set(["v:b"]),
    now: t0,
  });
  assert.equal(progress.find(({ variantId }) => variantId === "v:a")?.eligible, false);
  assert.equal(progress.find(({ variantId }) => variantId === "v:b")?.eligible, true);

  function* eligibleIds() {
    yield "v:b";
  }
  const selected = selectNextTransferVariant({
    variants,
    workspace: createTransferWorkspace(t0),
    eligibleVariantIds: eligibleIds(),
    now: t0,
  });
  assert.equal(selected?.variantId, "v:b");
});

test("invalid progress and selection inputs return safe empty results", () => {
  assert.deepEqual(deriveTransferProgress(), []);
  assert.deepEqual(deriveTransferProgress({ variants: [null, {}, { variantId: "bad id" }] }), []);
  assert.equal(selectNextTransferVariant(), null);
  assert.equal(selectNextTransferVariant({ variants: "not-an-array" }), null);
});
