import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { CONCEPT_TRANSFER_VARIANTS } from "../app/data/concept-transfer-variants.ts";
import {
  commitConceptTransferAttempt,
  createConceptTransferWorkspace,
  finishConceptTransferAttempt,
  recordConceptTransferCriteria,
  recordConceptTransferTeachBack,
  selfGradeConceptTransferAttempt,
  startConceptTransferAttempt,
  updateConceptTransferDraft,
} from "../app/lib/concept-transfer.mjs";

let bundledProductRuntime;

async function productRuntime() {
  if (!bundledProductRuntime) {
    bundledProductRuntime = build({
      entryPoints: [
        fileURLToPath(new URL("../app/lib/product.ts", import.meta.url)),
      ],
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      write: false,
      logLevel: "silent",
    }).then(({ outputFiles }) =>
      import(
        `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
      ),
    );
  }
  const built = await bundledProductRuntime;
  const normalizeState = built.normalizeState;
  assert.equal(
    typeof normalizeState,
    "function",
    "the production worker must expose normalizeState for migration verification",
  );
  return {
    normalizeState,
    reviewStatus: built.reviewStatus ?? built.default?.reviewStatus,
    milestones: built.milestones ?? built.default?.milestones,
    activeStreak: built.activeStreak ?? built.default?.activeStreak,
    practicedMinutesToday:
      built.practicedMinutesToday ?? built.default?.practicedMinutesToday,
  };
}

function typingAttempt(item, id, stage, completedAt) {
  return {
    id,
    itemId: item.itemId,
    itemRevision: item.contentRevision,
    titleSnapshot: item.title,
    language: item.language,
    stage,
    practiceKind: "typing",
    mode: "strict",
    startedAt: completedAt,
    completedAt,
    outcome: "completed",
    accuracy: 100,
    peeks: 0,
    corrections: 0,
  };
}

test("v31 migration rebuilds ordered typing ownership and initializes Cold Reconstruction safely", async () => {
  const { normalizeState } = await productRuntime();
  const item = {
    itemId: "python:10001",
    contentRevision: 1,
    title: "Python Fluency 01",
    language: "python",
  };
  const normalized = normalizeState({
    version: 31,
    attempts: [
      typingAttempt(item, "worked", 1, "2026-07-01T12:00:00.000Z"),
      typingAttempt(item, "faded", 3, "2026-07-02T12:00:00.000Z"),
      typingAttempt(item, "recall", 5, "2026-07-03T12:00:00.000Z"),
    ],
    settings: {},
    customItems: [],
    sessionHistory: [],
  });

  assert.equal(normalized.version, 33);
  const record = normalized.typingProgress.records.find(
    (entry) => entry.itemId === item.itemId,
  );
  assert.equal(record.owned, true);
  assert.equal(record.retained, true);
  assert.deepEqual(record.completedStages, [1, 3, 5]);
  assert.deepEqual(normalized.conceptTransfer.attempts, []);
  assert.deepEqual(normalized.conceptTransfer.drafts, []);
  assert.equal(normalized.conceptTransfer.activeAttemptId, undefined);
});

test("v32 normalization preserves a bounded autosaved Cold Reconstruction draft", async () => {
  const { normalizeState } = await productRuntime();
  const variant = CONCEPT_TRANSFER_VARIANTS[0];
  let workspace = startConceptTransferAttempt(
    createConceptTransferWorkspace("2026-07-10T12:00:00.000Z"),
    CONCEPT_TRANSFER_VARIANTS,
    {
      id: "active-concept-transfer",
      variantId: variant.id,
      lane: variant.lane,
      now: "2026-07-10T12:00:00.000Z",
    },
  );
  workspace = updateConceptTransferDraft(
    workspace,
    "active-concept-transfer",
    {
      prediction: "The live owner does not change.",
      reconstruction: "func preview() { /* reconstructed boundary */ }",
      tradeoff: "Share identity when coordinated mutation is intentional.",
    },
    {
      variants: CONCEPT_TRANSFER_VARIANTS,
      now: "2026-07-10T12:01:00.000Z",
    },
  );

  const normalized = normalizeState({
    version: 32,
    attempts: [],
    typingProgress: {},
    conceptTransfer: workspace,
    settings: {},
    customItems: [],
    sessionHistory: [],
  });

  assert.equal(normalized.version, 33);
  assert.equal(normalized.conceptTransfer.activeAttemptId, "active-concept-transfer");
  assert.equal(normalized.conceptTransfer.attempts.length, 1);
  assert.equal(normalized.conceptTransfer.drafts.length, 1);
  assert.equal(
    normalized.conceptTransfer.drafts[0].reconstruction,
    "func preview() { /* reconstructed boundary */ }",
  );
});

test("v32 recovers canonical typing progress when the compact workspace is malformed", async () => {
  const { normalizeState } = await productRuntime();
  const item = {
    itemId: "python:10001",
    contentRevision: 1,
    title: "Python Fluency 01",
    language: "python",
  };
  const normalized = normalizeState({
    version: 32,
    attempts: [
      typingAttempt(item, "worked-v32", 1, "2026-07-01T12:00:00.000Z"),
      typingAttempt(item, "faded-v32", 3, "2026-07-02T12:00:00.000Z"),
      typingAttempt(item, "recall-v32", 5, "2026-07-03T12:00:00.000Z"),
    ],
    typingProgress: { version: 999, records: "corrupt" },
    conceptTransfer: {},
    settings: {},
    customItems: [],
    sessionHistory: [],
  });
  const record = normalized.typingProgress.records.find(
    (entry) => entry.itemId === item.itemId,
  );
  assert.equal(record.owned, true);
  assert.equal(record.retained, true);
});

test("a direct blank-editor diagnostic cannot create a due review or ownership milestone", async () => {
  const { normalizeState, reviewStatus, milestones } = await productRuntime();
  assert.equal(typeof reviewStatus, "function");
  assert.equal(typeof milestones, "function");
  const item = {
    itemId: "python:10001",
    contentRevision: 1,
    title: "Python Fluency 01",
    language: "python",
  };
  const diagnostic = {
    ...typingAttempt(
      item,
      "direct-diagnostic",
      5,
      "2026-07-01T12:00:00.000Z",
    ),
    accuracy: 80,
  };
  const normalized = normalizeState({
    version: 32,
    attempts: [diagnostic],
    typingProgress: {},
    conceptTransfer: {},
    settings: {},
    customItems: [],
    sessionHistory: [],
  });
  assert.equal(reviewStatus(normalized, item.itemId).dueAt, null);
  assert.equal(
    milestones(normalized).find((entry) => entry.id === "first-recall")
      .achieved,
    false,
  );
});

test("finished Cold Reconstruction counts toward today's private activity", async () => {
  const {
    normalizeState,
    activeStreak,
    practicedMinutesToday,
  } = await productRuntime();
  assert.equal(typeof activeStreak, "function");
  assert.equal(typeof practicedMinutesToday, "function");
  const localNoon = new Date();
  localNoon.setHours(12, 0, 0, 0);
  const startedAt = localNoon.toISOString();
  const atMinute = (minutes) =>
    new Date(localNoon.getTime() + minutes * 60_000).toISOString();
  const variant = CONCEPT_TRANSFER_VARIANTS[0];
  let workspace = startConceptTransferAttempt(
    createConceptTransferWorkspace(startedAt),
    CONCEPT_TRANSFER_VARIANTS,
    {
      id: "today-reconstruction",
      variantId: variant.id,
      lane: variant.lane,
      now: startedAt,
    },
  );
  const options = (now) => ({ variants: CONCEPT_TRANSFER_VARIANTS, now });
  workspace = updateConceptTransferDraft(
    workspace,
    "today-reconstruction",
    { prediction: "p", reconstruction: "r", tradeoff: "t" },
    options(atMinute(1)),
  );
  workspace = commitConceptTransferAttempt(
    workspace,
    "today-reconstruction",
    options(atMinute(2)),
  );
  workspace = selfGradeConceptTransferAttempt(
    workspace,
    "today-reconstruction",
    "good",
    options(atMinute(3)),
  );
  workspace = recordConceptTransferCriteria(
    workspace,
    "today-reconstruction",
    [0],
    options(atMinute(4)),
  );
  workspace = recordConceptTransferTeachBack(
    workspace,
    "today-reconstruction",
    "I can explain the boundary.",
    options(atMinute(5)),
  );
  workspace = finishConceptTransferAttempt(
    workspace,
    "today-reconstruction",
    options(atMinute(6)),
  );
  const normalized = normalizeState({
    version: 32,
    attempts: [],
    typingProgress: {},
    conceptTransfer: workspace,
    settings: {},
    customItems: [],
    sessionHistory: [],
  });
  assert.equal(practicedMinutesToday(normalized), 6);
  assert.ok(activeStreak(normalized) >= 1);
});
