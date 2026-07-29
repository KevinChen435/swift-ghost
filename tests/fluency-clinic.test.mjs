import test from "node:test";
import assert from "node:assert/strict";
import {
  createFluencyClinicWorkspace,
  deriveFluencyClinicModel,
  enqueueFluencyClinicCase,
  fluencyClinicCaseId,
  nextFluencyClinicPass,
  normalizeFluencyClinicWorkspace,
  reconcileFluencyClinicWorkspace,
  recordFluencyClinicPass,
} from "../app/lib/fluency-clinic.mjs";

const ITEM = {
  itemId: "python:101",
  contentRevision: 2,
  title: "Pair Index",
  language: "python",
  code: "def pair_index(nums, target):\n    seen = {}\n    for index, value in enumerate(nums):\n        if target - value in seen:\n            return [seen[target - value], index]\n        seen[value] = index\n    return []",
};
const AT = "2026-07-29T10:00:00.000Z";

function attempt(overrides = {}) {
  return {
    id: overrides.id ?? "attempt-1",
    itemId: ITEM.itemId,
    itemRevision: ITEM.contentRevision,
    titleSnapshot: ITEM.title,
    language: "python",
    practiceKind: "typing",
    stage: 3,
    mode: "strict",
    startedAt: overrides.startedAt ?? "2026-07-29T09:58:00.000Z",
    completedAt: overrides.completedAt ?? AT,
    durationMs: overrides.durationMs ?? 120_000,
    corrections: overrides.corrections ?? 4,
    peeks: overrides.peeks ?? 0,
    lineErrors: overrides.lineErrors ?? { 4: 2 },
    wpm: overrides.wpm ?? 24,
    accuracy: overrides.accuracy ?? 92,
    outcome: overrides.outcome ?? "completed",
    qualification: overrides.qualification ?? "guided",
    ...overrides,
  };
}

function buildRepair(workspace, id) {
  let next = recordFluencyClinicPass(
    workspace,
    id,
    { kind: "visible", startedAt: AT, durationMs: 4_000, corrections: 1 },
    { now: "2026-07-29T10:01:00.000Z" },
  );
  next = recordFluencyClinicPass(
    next,
    id,
    { kind: "faded", durationMs: 5_000, corrections: 2 },
    { now: "2026-07-29T10:02:00.000Z" },
  );
  return recordFluencyClinicPass(
    next,
    id,
    { kind: "blank", durationMs: 6_000, corrections: 0 },
    { now: "2026-07-29T10:03:00.000Z" },
  );
}

test("reconciliation creates a revision-bound case from repeated line friction", () => {
  const workspace = reconcileFluencyClinicWorkspace(
    createFluencyClinicWorkspace(AT),
    {
      now: "2026-07-29T10:05:00.000Z",
      items: [ITEM],
      attempts: [
        attempt({ id: "a", completedAt: "2026-07-28T10:00:00.000Z" }),
        attempt({ id: "b", lineErrors: { 4: 1 } }),
      ],
    },
  );
  assert.equal(workspace.cases.length, 1);
  const record = workspace.cases[0];
  assert.equal(record.id, fluencyClinicCaseId(ITEM.itemId, 2, 4));
  assert.equal(record.itemRevision, 2);
  assert.equal(record.targetLineSnapshot, "        if target - value in seen:");
  assert.equal(record.errorCount, 3);
  assert.equal(record.attemptCount, 2);
  assert.deepEqual(record.sourceAttemptIds, ["a", "b"]);
  assert.equal(record.contextSnapshot.length, 3);
});

test("a single low-error attempt does not auto-enroll, while a burst does", () => {
  const quiet = reconcileFluencyClinicWorkspace(undefined, {
    now: AT,
    items: [ITEM],
    attempts: [attempt({ id: "quiet", lineErrors: { 4: 1 } })],
  });
  assert.equal(quiet.cases.length, 0);
  const burst = reconcileFluencyClinicWorkspace(undefined, {
    now: AT,
    items: [ITEM],
    attempts: [attempt({ id: "burst", lineErrors: { 4: 4 } })],
  });
  assert.equal(burst.cases.length, 1);
});

test("manual enrollment preserves a one-off weak line without inventing evidence", () => {
  const workspace = enqueueFluencyClinicCase(
    createFluencyClinicWorkspace(AT),
    {
      item: ITEM,
      weakLine: {
        line: 5,
        errorCount: 1,
        attemptCount: 1,
        lastSeenAtMs: Date.parse(AT),
      },
    },
    { now: "2026-07-29T10:04:00.000Z" },
  );
  assert.equal(workspace.cases.length, 1);
  assert.equal(workspace.cases[0].line, 5);
  assert.equal(workspace.cases[0].errorCount, 1);
  assert.equal(workspace.cases[0].attemptCount, 1);
  assert.equal(workspace.cases[0].passes.length, 0);
});

test("repair passes are ordered, immutable, guided evidence", () => {
  const seeded = reconcileFluencyClinicWorkspace(undefined, {
    now: AT,
    items: [ITEM],
    attempts: [attempt({ lineErrors: { 4: 3 } })],
  });
  const id = seeded.cases[0].id;
  assert.equal(nextFluencyClinicPass(seeded.cases[0]), "visible");
  assert.throws(
    () =>
      recordFluencyClinicPass(
        seeded,
        id,
        { kind: "blank" },
        { now: "2026-07-29T10:01:00.000Z" },
      ),
    /visible pass next/,
  );
  assert.throws(
    () =>
      recordFluencyClinicPass(
        seeded,
        id,
        { kind: "visible" },
        { expectedRevision: seeded.revision + 1, now: "2026-07-29T10:01:00.000Z" },
      ),
    /revision conflict/,
  );
  const repaired = buildRepair(seeded, id);
  assert.deepEqual(
    repaired.cases[0].passes.map((pass) => pass.kind),
    ["visible", "faded", "blank"],
  );
  assert.ok(
    repaired.cases[0].passes.every(
      (pass) => pass.assistance === "guided-line-repair",
    ),
  );
  assert.equal(nextFluencyClinicPass(repaired.cases[0]), null);
  const duplicate = recordFluencyClinicPass(
    repaired,
    id,
    { kind: "blank" },
    { now: "2026-07-29T10:04:00.000Z" },
  );
  assert.deepEqual(duplicate, repaired);
});

test("three micro-repairs never claim reconstruction or mastery", () => {
  const seeded = reconcileFluencyClinicWorkspace(undefined, {
    now: AT,
    items: [ITEM],
    attempts: [attempt({ lineErrors: { 4: 3 } })],
  });
  const repaired = buildRepair(seeded, seeded.cases[0].id);
  const model = deriveFluencyClinicModel(repaired, {
    now: "2026-07-29T10:10:00.000Z",
    items: [ITEM],
    attempts: [attempt({ lineErrors: { 4: 3 } })],
  });
  assert.equal(model.records[0].status, "reconstruction-ready");
  assert.equal(model.records[0].claimsMastery, false);
  assert.equal(model.records[0].claimsIndependentSolve, false);
  assert.equal(model.records[0].evidenceClaim, "repair-in-progress");
});

test("only a later clean stage-five attempt starts the delayed recheck", () => {
  const baseline = attempt({ id: "baseline", lineErrors: { 4: 3 } });
  const seeded = reconcileFluencyClinicWorkspace(undefined, {
    now: AT,
    items: [ITEM],
    attempts: [baseline],
  });
  const repaired = buildRepair(seeded, seeded.cases[0].id);
  const invalid = attempt({
    id: "peeked",
    stage: 5,
    qualification: "independent",
    accuracy: 100,
    peeks: 1,
    startedAt: "2026-07-29T10:04:00.000Z",
    completedAt: "2026-07-29T10:06:00.000Z",
    lineErrors: {},
  });
  const clean = attempt({
    id: "clean-reconstruction",
    stage: 5,
    qualification: "independent",
    accuracy: 100,
    peeks: 0,
    wpm: 31,
    corrections: 1,
    startedAt: "2026-07-29T10:07:00.000Z",
    completedAt: "2026-07-29T10:09:00.000Z",
    lineErrors: {},
  });
  const waiting = deriveFluencyClinicModel(repaired, {
    now: "2026-07-29T11:00:00.000Z",
    items: [ITEM],
    attempts: [baseline, invalid, clean],
  });
  assert.equal(waiting.records[0].status, "recheck-waiting");
  assert.equal(waiting.records[0].reconstructionAttemptId, clean.id);
  assert.equal(waiting.records[0].comparison.delta.wpm, 7);
  assert.equal(waiting.records[0].comparison.delta.accuracy, 8);
  const due = deriveFluencyClinicModel(repaired, {
    now: "2026-07-30T10:09:00.000Z",
    items: [ITEM],
    attempts: [baseline, clean],
  });
  assert.equal(due.records[0].status, "recheck-due");
});

test("recheck fails closed until due and routes by sourceItemIds after success", () => {
  const baseline = attempt({ id: "baseline", lineErrors: { 4: 3 } });
  const seeded = reconcileFluencyClinicWorkspace(undefined, {
    now: AT,
    items: [ITEM],
    attempts: [baseline],
  });
  const id = seeded.cases[0].id;
  const repaired = buildRepair(seeded, id);
  const reconstruction = attempt({
    id: "clean-reconstruction",
    stage: 5,
    qualification: "independent",
    accuracy: 100,
    peeks: 0,
    startedAt: "2026-07-29T10:04:00.000Z",
    completedAt: "2026-07-29T10:06:00.000Z",
    lineErrors: {},
  });
  const dueAt = "2026-07-30T10:06:00.000Z";
  assert.throws(
    () =>
      recordFluencyClinicPass(
        repaired,
        id,
        { kind: "recheck" },
        {
          now: "2026-07-30T09:00:00.000Z",
          attempts: [reconstruction],
        },
      ),
    /not due/,
  );
  const checked = recordFluencyClinicPass(
    repaired,
    id,
    { kind: "recheck", durationMs: 4_000 },
    {
      now: dueAt,
      attempts: [reconstruction],
    },
  );
  const unrelated = {
    itemId: "transfer:other",
    transfer: { id: "other", sourceItemIds: ["python:999"] },
  };
  const mapped = {
    itemId: "transfer:mapped",
    title: "Mapped variant",
    transfer: { id: "mapped-variant", sourceItemIds: [ITEM.itemId] },
  };
  const ready = deriveFluencyClinicModel(checked, {
    now: dueAt,
    items: [ITEM],
    attempts: [baseline, reconstruction],
    transferVariants: [unrelated, mapped],
    transferProgress: [
      {
        variantId: "transfer:mapped",
        targetedTransferObserved: false,
        targetedTransferObservedAt: null,
      },
    ],
  });
  assert.equal(ready.records[0].status, "transfer-ready");
  assert.equal(ready.records[0].transferVariantId, "transfer:mapped");
  const observed = deriveFluencyClinicModel(checked, {
    now: dueAt,
    items: [ITEM],
    attempts: [baseline, reconstruction],
    transferVariants: [mapped],
    transferProgress: [
      {
        variantId: "transfer:mapped",
        targetedTransferObserved: true,
        targetedTransferObservedAt: "2026-07-30T10:07:00.000Z",
      },
    ],
  });
  assert.equal(observed.records[0].status, "transfer-observed");
  assert.equal(observed.records[0].claimsMastery, false);
});

test("content revision changes retire the frozen case without deleting its evidence", () => {
  const seeded = reconcileFluencyClinicWorkspace(undefined, {
    now: AT,
    items: [ITEM],
    attempts: [attempt({ lineErrors: { 4: 3 } })],
  });
  const normalized = normalizeFluencyClinicWorkspace(seeded, { now: AT });
  const model = deriveFluencyClinicModel(normalized, {
    now: AT,
    items: [{ ...ITEM, contentRevision: 3 }],
    attempts: [],
  });
  assert.equal(model.records.length, 1);
  assert.equal(model.records[0].status, "retired");
  assert.equal(model.summary.retired, 1);
});
