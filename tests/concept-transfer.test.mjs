import assert from "node:assert/strict";
import test from "node:test";

import { CONCEPT_TRANSFER_VARIANTS } from "../app/data/concept-transfer-variants.ts";
import { FUNDAMENTALS } from "../app/data/fundamentals.ts";
import {
  CONCEPT_TRANSFER_INTERVAL_DAYS,
  CONCEPT_TRANSFER_LIMITS,
  CURRENT_CONCEPT_TRANSFER_WORKSPACE,
  commitConceptTransferAttempt,
  createConceptTransferWorkspace,
  deriveConceptTransferVariantState,
  finishConceptTransferAttempt,
  normalizeConceptTransferText,
  normalizeConceptTransferWorkspace,
  projectConceptTransferVariant,
  recordConceptTransferCriteria,
  recordConceptTransferTeachBack,
  resumeConceptTransferAttempt,
  revealConceptTransferHint,
  selectConceptTransferVariant,
  selfGradeConceptTransferAttempt,
  startConceptTransferAttempt,
  summarizeConceptTransferWorkspace,
  updateConceptTransferDraft,
} from "../app/lib/concept-transfer.mjs";

const T0 = "2026-07-29T12:00:00.000Z";
const iso = (days, minutes = 0) =>
  new Date(Date.parse(T0) + days * 86_400_000 + minutes * 60_000).toISOString();
const options = (now = T0) => ({ variants: CONCEPT_TRANSFER_VARIANTS, now });
const variantById = (id) =>
  CONCEPT_TRANSFER_VARIANTS.find((variant) => variant.id === id);

test("Clinic-targeted concept reconstruction starts assisted in attempt and draft", () => {
  const variant = CONCEPT_TRANSFER_VARIANTS[0];
  const workspace = startConceptTransferAttempt(
    createConceptTransferWorkspace(T0),
    CONCEPT_TRANSFER_VARIANTS,
    {
      id: "clinic-targeted",
      variantId: variant.id,
      lane: variant.lane,
      assisted: true,
      clinicTargeted: true,
      now: T0,
    },
  );
  assert.equal(workspace.attempts[0].assisted, true);
  assert.equal(workspace.drafts[0].assisted, true);
  assert.equal(workspace.attempts[0].clinicTargeted, true);
  assert.equal(workspace.drafts[0].clinicTargeted, true);
});

function authoredNeutralText(variant) {
  return JSON.stringify({
    neutralLabel: variant.neutralLabel,
    scenario: variant.scenario,
    constraints: variant.constraints,
    estimatedMinutes: variant.estimatedMinutes,
    predictionPrompt: variant.predictionPrompt,
    reconstructionPrompt: variant.reconstructionPrompt,
    tradeoffPrompt: variant.tradeoffPrompt,
    hints: variant.hints,
  }).toLowerCase();
}

function startSpecific(workspace, variant, id, now) {
  return startConceptTransferAttempt(workspace, CONCEPT_TRANSFER_VARIANTS, {
    id,
    variantId: variant.id,
    lane: variant.lane,
    now,
  });
}

function completeAttempt(
  workspace,
  variant,
  id,
  now,
  { grade = "good", hinted = false } = {},
) {
  let next = startSpecific(workspace, variant, id, now);
  next = updateConceptTransferDraft(
    next,
    id,
    {
      prediction: "I predict the boundary preserves the stated observations.",
      reconstruction: "My reconstructed Swift sketch and explanation.",
      tradeoff: "The alternative changes ownership or coupling.",
    },
    options(iso((Date.parse(now) - Date.parse(T0)) / 86_400_000, 1)),
  );
  if (hinted) {
    next = revealConceptTransferHint(
      next,
      id,
      options(iso((Date.parse(now) - Date.parse(T0)) / 86_400_000, 2)),
    );
  }
  next = commitConceptTransferAttempt(
    next,
    id,
    options(iso((Date.parse(now) - Date.parse(T0)) / 86_400_000, 3)),
  );
  next = selfGradeConceptTransferAttempt(
    next,
    id,
    grade,
    options(iso((Date.parse(now) - Date.parse(T0)) / 86_400_000, 4)),
  );
  next = recordConceptTransferCriteria(
    next,
    id,
    [0, 0, variant.review.criteria[1]],
    options(iso((Date.parse(now) - Date.parse(T0)) / 86_400_000, 5)),
  );
  next = recordConceptTransferTeachBack(
    next,
    id,
    "The boundary keeps the relevant state and lifetime relationship explicit.",
    options(iso((Date.parse(now) - Date.parse(T0)) / 86_400_000, 6)),
  );
  return finishConceptTransferAttempt(
    next,
    id,
    options(iso((Date.parse(now) - Date.parse(T0)) / 86_400_000, 7)),
  );
}

test("the cold reconstruction bank has twelve original revisioned contexts with valid lineage", () => {
  assert.equal(CONCEPT_TRANSFER_VARIANTS.length, 12);
  assert.equal(
    CONCEPT_TRANSFER_VARIANTS.filter((variant) => variant.lane === "swift").length,
    6,
  );
  assert.equal(
    CONCEPT_TRANSFER_VARIANTS.filter((variant) => variant.lane === "ios").length,
    6,
  );
  assert.equal(
    new Set(CONCEPT_TRANSFER_VARIANTS.map((variant) => variant.id)).size,
    12,
  );
  assert.equal(
    new Set(CONCEPT_TRANSFER_VARIANTS.map((variant) => variant.scenario)).size,
    12,
  );
  const sourceIds = new Set(FUNDAMENTALS.map((item) => item.id));
  const swiftFamilies = new Set(
    CONCEPT_TRANSFER_VARIANTS.filter((variant) => variant.lane === "swift").map(
      (variant) => variant.family,
    ),
  );
  assert.deepEqual(
    [...swiftFamilies].sort(),
    [
      "Concurrency",
      "Memory Management",
      "Optionals & Errors",
      "Protocols & Generics",
      "Swift Semantics",
    ].sort(),
  );
  assert.equal(
    CONCEPT_TRANSFER_VARIANTS.filter(
      (variant) => variant.lane === "swift" && variant.family === "Concurrency",
    ).length,
    2,
  );
  const iosFamilies = new Set(
    CONCEPT_TRANSFER_VARIANTS.filter((variant) => variant.lane === "ios").map(
      (variant) => variant.family,
    ),
  );
  for (const required of [
    "UIKit",
    "SwiftUI",
    "Networking",
    "Architecture & Testing",
    "Accessibility",
  ]) {
    assert.equal(iosFamilies.has(required), true, required);
  }
  assert.equal(
    CONCEPT_TRANSFER_VARIANTS.filter(
      (variant) => variant.lane === "ios" && variant.family === "UIKit",
    ).length,
    2,
  );

  for (const variant of CONCEPT_TRANSFER_VARIANTS) {
    assert.match(variant.id, /^concept-transfer:ct-\d{2}$/);
    assert.equal(variant.revision, 1, variant.id);
    assert.equal(variant.sourceItemIds.length >= 1, true, variant.id);
    assert.equal(new Set(variant.sourceItemIds).size, variant.sourceItemIds.length);
    for (const sourceId of variant.sourceItemIds) {
      assert.equal(sourceIds.has(sourceId), true, `${variant.id}: ${sourceId}`);
    }
    assert.equal(variant.hints.length, 3, variant.id);
    assert.equal(variant.review.criteria.length >= 3, true, variant.id);
    assert.equal(variant.review.criteria.length <= 5, true, variant.id);
    const codeLines = variant.referenceSnippet.split("\n").length;
    assert.equal(codeLines >= 4 && codeLines <= 15, true, `${variant.id}: ${codeLines}`);
    assert.equal(variant.estimatedMinutes > 0, true, variant.id);
    const neutral = authoredNeutralText(variant);
    for (const hidden of [
      variant.revealedTitle,
      variant.family,
      variant.review.patternLabel,
    ]) {
      assert.equal(
        neutral.includes(hidden.toLowerCase()),
        false,
        `${variant.id} leaks ${hidden}`,
      );
    }
  }
});

test("precommit projections exclude every identity and reference field until commit", () => {
  const variant = CONCEPT_TRANSFER_VARIANTS[0];
  const hidden = projectConceptTransferVariant(variant, { maxHintLevel: 0 });
  assert.equal(hidden.revealed, false);
  assert.deepEqual(hidden.hints, []);
  for (const key of [
    "revealedTitle",
    "family",
    "sourceItemIds",
    "referenceSnippet",
    "review",
  ]) {
    assert.equal(Object.hasOwn(hidden, key), false, key);
  }
  const oneHint = projectConceptTransferVariant(variant, { maxHintLevel: 1 });
  assert.deepEqual(oneHint.hints, [variant.hints[0]]);
  const revealed = projectConceptTransferVariant(variant, {
    committedAt: T0,
    maxHintLevel: 0,
  });
  assert.equal(revealed.revealed, true);
  assert.equal(revealed.revealedTitle, variant.revealedTitle);
  assert.equal(revealed.referenceSnippet, variant.referenceSnippet);
  assert.deepEqual(revealed.hints, [...variant.hints]);
});

test("draft autosave is normalized, hints are permanent, and commit freezes the response", () => {
  const variant = variantById("concept-transfer:ct-02");
  let workspace = startSpecific(createConceptTransferWorkspace(T0), variant, "attempt-draft", T0);
  const tooManyLines = Array.from({ length: 200 }, (_, index) => `line ${index}`).join("\r\n");
  workspace = updateConceptTransferDraft(
    workspace,
    "attempt-draft",
    {
      prediction: `\u0000${"😀".repeat(3_000)}`,
      reconstruction: tooManyLines,
      tradeoff: "own tradeoff",
    },
    options(iso(0, 1)),
  );
  workspace = revealConceptTransferHint(workspace, "attempt-draft", options(iso(0, 2)));
  const draft = workspace.drafts[0];
  assert.equal(Array.from(draft.prediction).length, CONCEPT_TRANSFER_LIMITS.predictionChars);
  assert.equal(
    draft.reconstruction.split("\n").length,
    CONCEPT_TRANSFER_LIMITS.reconstructionLines,
  );
  assert.equal(draft.maxHintLevel, 1);

  const tampered = JSON.parse(JSON.stringify(workspace));
  tampered.drafts[0].maxHintLevel = 0;
  tampered.drafts[0].assisted = false;
  const restored = normalizeConceptTransferWorkspace(tampered, options(iso(0, 3)));
  assert.equal(restored.drafts[0].maxHintLevel, 1);
  assert.equal(restored.drafts[0].assisted, true);
  assert.equal(resumeConceptTransferAttempt(restored, CONCEPT_TRANSFER_VARIANTS).draft.prediction, draft.prediction);

  const committed = commitConceptTransferAttempt(
    restored,
    "attempt-draft",
    options(iso(0, 4)),
  );
  const frozen = committed.attempts.find((attempt) => attempt.id === "attempt-draft");
  assert.equal(committed.drafts.length, 0);
  assert.equal(frozen.referenceRevealedAt, iso(0, 4));
  const edited = updateConceptTransferDraft(
    committed,
    "attempt-draft",
    { reconstruction: "replacement" },
    options(iso(0, 5)),
  );
  assert.equal(
    edited.attempts.find((attempt) => attempt.id === "attempt-draft").reconstruction,
    frozen.reconstruction,
  );
  assert.equal(
    resumeConceptTransferAttempt(edited, CONCEPT_TRANSFER_VARIANTS).projection.revealed,
    true,
  );
});

test("normalization restores a missing draft for the active uncommitted attempt", () => {
  const variant = variantById("concept-transfer:ct-02");
  let workspace = startSpecific(
    createConceptTransferWorkspace(T0),
    variant,
    "missing-draft",
    T0,
  );
  workspace = revealConceptTransferHint(
    workspace,
    "missing-draft",
    options(iso(0, 1)),
  );
  const malformed = { ...workspace, drafts: [] };
  const normalized = normalizeConceptTransferWorkspace(
    malformed,
    options(iso(0, 2)),
  );

  assert.equal(normalized.activeAttemptId, "missing-draft");
  assert.equal(normalized.drafts.length, 1);
  assert.equal(normalized.drafts[0].attemptId, "missing-draft");
  assert.equal(normalized.drafts[0].maxHintLevel, 1);
  assert.equal(normalized.drafts[0].assisted, true);

  const edited = updateConceptTransferDraft(
    normalized,
    "missing-draft",
    { reconstruction: "restored work" },
    options(iso(0, 3)),
  );
  assert.equal(edited.drafts[0].reconstruction, "restored work");
});

test("commit, grading, and debrief recording obey their gates without correctness claims", () => {
  const variant = CONCEPT_TRANSFER_VARIANTS[2];
  let workspace = startSpecific(createConceptTransferWorkspace(T0), variant, "gated", T0);
  workspace = selfGradeConceptTransferAttempt(workspace, "gated", "good", options(T0));
  workspace = recordConceptTransferCriteria(workspace, "gated", [0], options(T0));
  workspace = recordConceptTransferTeachBack(workspace, "gated", "premature", options(T0));
  assert.equal(workspace.attempts[0].grade, undefined);
  assert.equal(workspace.attempts[0].criteriaRecordedAt, undefined);
  assert.equal(workspace.attempts[0].teachBack, undefined);
  const blocked = commitConceptTransferAttempt(workspace, "gated", options(T0));
  assert.equal(blocked.attempts[0].committedAt, undefined);

  workspace = updateConceptTransferDraft(
    workspace,
    "gated",
    { prediction: "p", reconstruction: "r", tradeoff: "t" },
    options(iso(0, 1)),
  );
  workspace = commitConceptTransferAttempt(workspace, "gated", options(iso(0, 2)));
  workspace = selfGradeConceptTransferAttempt(workspace, "gated", "Good", options(iso(0, 3)));
  workspace = selfGradeConceptTransferAttempt(workspace, "gated", "again", options(iso(0, 4)));
  assert.equal(workspace.attempts[0].grade, "again", "debrief choices autosave until finish");
  workspace = selfGradeConceptTransferAttempt(workspace, "gated", "good", options(iso(0, 4)));
  workspace = recordConceptTransferCriteria(
    workspace,
    "gated",
    [0, 0, "not authored", variant.review.criteria[1]],
    options(iso(0, 5)),
  );
  assert.deepEqual(workspace.attempts[0].criteria, variant.review.criteria.slice(0, 2));
  workspace = recordConceptTransferCriteria(
    workspace,
    "gated",
    [],
    options(iso(0, 5)),
  );
  assert.deepEqual(workspace.attempts[0].criteria, []);
  workspace = recordConceptTransferCriteria(
    workspace,
    "gated",
    [0, 1],
    options(iso(0, 5)),
  );
  assert.equal(
    finishConceptTransferAttempt(workspace, "gated", options(iso(0, 6))).attempts[0]
      .finishedAt,
    undefined,
  );
  workspace = recordConceptTransferTeachBack(
    workspace,
    "gated",
    "I can describe the relationship, but the engine does not judge its semantics.",
    options(iso(0, 7)),
  );
  workspace = recordConceptTransferTeachBack(
    workspace,
    "gated",
    "",
    options(iso(0, 7)),
  );
  assert.equal(workspace.attempts[0].teachBack, "");
  workspace = recordConceptTransferTeachBack(
    workspace,
    "gated",
    "I can describe the relationship, but the engine does not judge its semantics.",
    options(iso(0, 7)),
  );
  workspace = finishConceptTransferAttempt(workspace, "gated", options(iso(0, 8)));
  assert.equal(workspace.attempts[0].qualification, "cold-self-assessed");
  assert.equal(Object.hasOwn(workspace.attempts[0], "correct"), false);
});

test("persisted assistance overrides forged cold qualification and long cadence", () => {
  const variant = CONCEPT_TRANSFER_VARIANTS[0];
  const finished = completeAttempt(
    createConceptTransferWorkspace(T0),
    variant,
    "tampered-evidence",
    T0,
  );
  const raw = JSON.parse(JSON.stringify(finished));
  Object.assign(raw.attempts[0], {
    assisted: true,
    maxHintLevel: 1,
    hintRevealedAt: [iso(0, 2)],
    qualification: "cold-self-assessed",
    levelAfter: 4,
    dueAt: iso(99),
  });
  const normalized = normalizeConceptTransferWorkspace(raw, options(iso(1)));
  assert.equal(normalized.attempts[0].qualification, "assisted");
  assert.equal(normalized.attempts[0].levelAfter, 0);
  assert.equal(normalized.attempts[0].dueAt, iso(1, 7));

  const forgedCold = JSON.parse(JSON.stringify(finished));
  Object.assign(forgedCold.attempts[0], {
    qualification: "cold-self-assessed",
    levelAfter: 0,
    dueAt: iso(30),
  });
  const rebuiltCold = normalizeConceptTransferWorkspace(
    forgedCold,
    options(iso(1)),
  );
  assert.equal(rebuiltCold.attempts[0].levelAfter, 0);
  assert.equal(rebuiltCold.attempts[0].dueAt, iso(1, 7));

  const invalidPersistedCriteria = JSON.parse(JSON.stringify(finished));
  invalidPersistedCriteria.attempts[0].criteria = ["not authored"];
  const gatedPersisted = normalizeConceptTransferWorkspace(
    invalidPersistedCriteria,
    options(iso(1)),
  );
  assert.equal(gatedPersisted.attempts[0].finishedAt, undefined);
  assert.equal(gatedPersisted.attempts[0].criteria, undefined);
  assert.equal(gatedPersisted.attempts[0].criteriaRecordedAt, undefined);
  assert.equal(
    finishConceptTransferAttempt(
      gatedPersisted,
      "tampered-evidence",
      options(iso(1, 1)),
    ).attempts[0].finishedAt,
    undefined,
  );

  let criteriaGate = startSpecific(
    createConceptTransferWorkspace(T0),
    variant,
    "criteria-gate",
    T0,
  );
  criteriaGate = updateConceptTransferDraft(
    criteriaGate,
    "criteria-gate",
    { prediction: "p", reconstruction: "r", tradeoff: "t" },
    options(iso(0, 1)),
  );
  criteriaGate = commitConceptTransferAttempt(
    criteriaGate,
    "criteria-gate",
    options(iso(0, 2)),
  );
  criteriaGate = recordConceptTransferCriteria(
    criteriaGate,
    "criteria-gate",
    ["not authored"],
    options(iso(0, 3)),
  );
  assert.equal(criteriaGate.attempts[0].criteriaRecordedAt, undefined);
});

test("new exposure is due tomorrow and delayed cold self-assessment follows 1/3/7/14/30", () => {
  assert.deepEqual(CONCEPT_TRANSFER_INTERVAL_DAYS, [1, 3, 7, 14, 30]);
  const variant = variantById("concept-transfer:ct-01");
  let workspace = createConceptTransferWorkspace(T0);
  const completionDays = [0, 1, 4, 11, 25, 55];
  const expectedLevels = [0, 1, 2, 3, 4, 4];
  const expectedIntervals = [1, 3, 7, 14, 30, 30];
  for (let index = 0; index < completionDays.length; index += 1) {
    workspace = completeAttempt(
      workspace,
      variant,
      `cadence-${index}`,
      iso(completionDays[index]),
    );
    const attempt = workspace.attempts.at(-1);
    assert.equal(attempt.levelAfter, expectedLevels[index], `level ${index}`);
    assert.equal(
      attempt.dueAt,
      iso(completionDays[index] + expectedIntervals[index], 7),
      `due ${index}`,
    );
    assert.equal(attempt.qualification, "cold-self-assessed");
  }
  const state = deriveConceptTransferVariantState(variant, workspace, {
    variants: CONCEPT_TRANSFER_VARIANTS,
    now: iso(85, 7),
  });
  assert.equal(state.due, true);
  assert.equal(state.level, 4);
});

test("hinted success stays assisted and clean Hard is reference reconstruction", () => {
  const hintedVariant = variantById("concept-transfer:ct-09");
  let workspace = completeAttempt(
    createConceptTransferWorkspace(T0),
    hintedVariant,
    "hinted",
    T0,
    { hinted: true, grade: "easy" },
  );
  assert.equal(workspace.attempts[0].qualification, "assisted");
  assert.equal(workspace.attempts[0].levelAfter, 0);
  assert.equal(workspace.attempts[0].dueAt, iso(1, 7));

  const hardVariant = variantById("concept-transfer:ct-10");
  workspace = completeAttempt(workspace, hardVariant, "hard", iso(1), {
    grade: "hard",
  });
  assert.equal(workspace.attempts.at(-1).qualification, "reference-reconstruction");
  const summary = summarizeConceptTransferWorkspace(
    workspace,
    CONCEPT_TRANSFER_VARIANTS,
    { now: iso(2) },
  );
  assert.deepEqual(
    {
      assisted: summary.assistedAttemptCount,
      reference: summary.referenceReconstructionCount,
      cold: summary.coldSelfAssessedCount,
    },
    { assisted: 1, reference: 1, cold: 0 },
  );
});

test("lane summaries never mix Swift and iOS reconstruction history", () => {
  const swiftVariant = variantById("concept-transfer:ct-01");
  const iosVariant = variantById("concept-transfer:ct-07");
  let workspace = completeAttempt(
    createConceptTransferWorkspace(T0),
    swiftVariant,
    "swift-assisted",
    T0,
    { hinted: true, grade: "easy" },
  );
  workspace = completeAttempt(
    workspace,
    iosVariant,
    "ios-reference",
    iso(1),
    { grade: "hard" },
  );

  const swift = summarizeConceptTransferWorkspace(
    workspace,
    CONCEPT_TRANSFER_VARIANTS,
    { lane: "swift", now: iso(2) },
  );
  const ios = summarizeConceptTransferWorkspace(
    workspace,
    CONCEPT_TRANSFER_VARIANTS,
    { lane: "ios", now: iso(2) },
  );
  assert.deepEqual(
    {
      completed: swift.completedAttemptCount,
      assisted: swift.assistedAttemptCount,
      reference: swift.referenceReconstructionCount,
      cold: swift.coldSelfAssessedCount,
    },
    { completed: 1, assisted: 1, reference: 0, cold: 0 },
  );
  assert.deepEqual(
    {
      completed: ios.completedAttemptCount,
      assisted: ios.assistedAttemptCount,
      reference: ios.referenceReconstructionCount,
      cold: ios.coldSelfAssessedCount,
    },
    { completed: 1, assisted: 0, reference: 1, cold: 0 },
  );
});

test("selection priority is active draft, due active family, unseen singleton, other due, then stable recency", () => {
  const dueVariant = variantById("concept-transfer:ct-05");
  const otherDue = variantById("concept-transfer:ct-07");
  let workspace = completeAttempt(
    createConceptTransferWorkspace(T0),
    dueVariant,
    "due-concurrency",
    T0,
  );
  workspace = completeAttempt(workspace, otherDue, "due-uikit", T0);
  const selectedDueFamily = selectConceptTransferVariant(
    CONCEPT_TRANSFER_VARIANTS,
    workspace,
    { now: iso(2), activeFamily: "Concurrency" },
  );
  assert.equal(selectedDueFamily.id, dueVariant.id);

  const singleton = selectConceptTransferVariant(
    CONCEPT_TRANSFER_VARIANTS,
    createConceptTransferWorkspace(T0),
    { now: T0 },
  );
  const expectedSingleton = CONCEPT_TRANSFER_VARIANTS.filter(
    (variant) =>
      CONCEPT_TRANSFER_VARIANTS.filter(
        (candidate) => candidate.family === variant.family,
      ).length === 1,
  )
    .map((variant) => variant.id)
    .sort()[0];
  assert.equal(singleton.id, expectedSingleton);

  workspace = startSpecific(workspace, otherDue, "active-draft", iso(2));
  assert.equal(
    selectConceptTransferVariant(CONCEPT_TRANSFER_VARIANTS, workspace, {
      now: iso(2),
      activeFamily: "Concurrency",
    }).id,
    otherDue.id,
  );

  const pairOnly = CONCEPT_TRANSFER_VARIANTS.filter(
    (variant) => variant.family === "Concurrency",
  );
  const stable = selectConceptTransferVariant(
    pairOnly,
    createConceptTransferWorkspace(T0),
    { now: T0, lane: "swift" },
  );
  assert.equal(stable.id, pairOnly.map((variant) => variant.id).sort()[0]);
});

test("stale completed revisions remain retired while stale drafts disappear from scheduling", () => {
  const variant = CONCEPT_TRANSFER_VARIANTS[0];
  let workspace = completeAttempt(
    createConceptTransferWorkspace(T0),
    variant,
    "old-complete",
    T0,
  );
  workspace = startSpecific(workspace, CONCEPT_TRANSFER_VARIANTS[1], "old-draft", iso(1));
  workspace = updateConceptTransferDraft(
    workspace,
    "old-draft",
    { prediction: "p", reconstruction: "r", tradeoff: "t" },
    options(iso(1, 1)),
  );
  const revised = CONCEPT_TRANSFER_VARIANTS.map((entry) => ({
    ...entry,
    revision: 2,
  }));
  const normalized = normalizeConceptTransferWorkspace(workspace, {
    variants: revised,
    now: iso(2),
  });
  assert.equal(normalized.attempts.length, 1);
  assert.equal(normalized.attempts[0].id, "old-complete");
  assert.equal(normalized.attempts[0].retired, true);
  assert.deepEqual(normalized.drafts, []);
  assert.equal(normalized.activeAttemptId, undefined);
  const state = deriveConceptTransferVariantState(revised[0], normalized, {
    variants: revised,
    now: iso(2),
  });
  assert.equal(state.isNew, true);
  assert.equal(state.completedAttempts, 0);
  assert.equal(
    summarizeConceptTransferWorkspace(normalized, revised, { now: iso(2) })
      .retiredAttemptCount,
    1,
  );
});

test("normalization retires non-selected unfinished attempts so old work cannot resurrect", () => {
  const olderVariant = CONCEPT_TRANSFER_VARIANTS[0];
  const newerVariant = CONCEPT_TRANSFER_VARIANTS[1];
  const older = startSpecific(
    createConceptTransferWorkspace(T0),
    olderVariant,
    "older-unfinished",
    T0,
  );
  const newer = startSpecific(
    createConceptTransferWorkspace(iso(1)),
    newerVariant,
    "newer-active",
    iso(1),
  );
  const malformed = {
    ...createConceptTransferWorkspace(iso(1)),
    attempts: [...older.attempts, ...newer.attempts],
    drafts: [...older.drafts, ...newer.drafts],
    activeAttemptId: "newer-active",
  };
  let normalized = normalizeConceptTransferWorkspace(
    malformed,
    options(iso(1, 1)),
  );
  assert.equal(normalized.activeAttemptId, "newer-active");
  assert.equal(
    normalized.attempts.find((attempt) => attempt.id === "older-unfinished")
      .retired,
    true,
  );
  assert.deepEqual(
    normalized.drafts.map((draft) => draft.attemptId),
    ["newer-active"],
  );

  normalized = updateConceptTransferDraft(
    normalized,
    "newer-active",
    { prediction: "p", reconstruction: "r", tradeoff: "t" },
    options(iso(1, 2)),
  );
  normalized = commitConceptTransferAttempt(
    normalized,
    "newer-active",
    options(iso(1, 3)),
  );
  normalized = selfGradeConceptTransferAttempt(
    normalized,
    "newer-active",
    "good",
    options(iso(1, 4)),
  );
  normalized = recordConceptTransferCriteria(
    normalized,
    "newer-active",
    [0],
    options(iso(1, 5)),
  );
  normalized = recordConceptTransferTeachBack(
    normalized,
    "newer-active",
    "I can explain the relationship.",
    options(iso(1, 6)),
  );
  normalized = finishConceptTransferAttempt(
    normalized,
    "newer-active",
    options(iso(1, 7)),
  );
  assert.equal(normalized.activeAttemptId, undefined);
  assert.equal(
    resumeConceptTransferAttempt(normalized, CONCEPT_TRANSFER_VARIANTS, {
      now: iso(2),
    }),
    undefined,
  );
});

test("normalization bounds and deduplicates attempts, drafts, criteria, lines, and characters", () => {
  assert.equal(
    normalizeConceptTransferText(" a\r\nb\r\nc ", { maxChars: 20, maxLines: 2 }),
    "a\nb",
  );
  assert.equal(
    Array.from(normalizeConceptTransferText("😀😀😀", { maxChars: 2 })).length,
    2,
  );
  assert.deepEqual(CURRENT_CONCEPT_TRANSFER_WORKSPACE, {
    version: 1,
    revision: 0,
    updatedAt: "1970-01-01T00:00:00.000Z",
    attempts: [],
    drafts: [],
  });
  const variant = CONCEPT_TRANSFER_VARIANTS[0];
  const completed = completeAttempt(
    createConceptTransferWorkspace(T0),
    variant,
    "seed",
    T0,
  ).attempts[0];
  const raw = createConceptTransferWorkspace(T0);
  raw.attempts = Array.from(
    { length: CONCEPT_TRANSFER_LIMITS.attempts + 4 },
    (_, index) => ({
      ...completed,
      id: `bounded-${index}`,
      startedAt: iso(0, index),
      updatedAt: iso(0, index),
      finishedAt: iso(0, index),
      dueAt: iso(1, index),
      criteria: [
        variant.review.criteria[0],
        variant.review.criteria[0],
        "untrusted criterion",
      ],
    }),
  );
  raw.attempts.push({ ...raw.attempts.at(-1), dueAt: iso(99), updatedAt: iso(99) });
  const normalized = normalizeConceptTransferWorkspace(raw, options(iso(100)));
  assert.equal(normalized.attempts.length, CONCEPT_TRANSFER_LIMITS.attempts);
  assert.equal(new Set(normalized.attempts.map((attempt) => attempt.id)).size, normalized.attempts.length);
  const duplicate = normalized.attempts.find(
    (attempt) => attempt.id === `bounded-${CONCEPT_TRANSFER_LIMITS.attempts + 3}`,
  );
  assert.equal(duplicate.updatedAt, iso(99));
  assert.equal(duplicate.dueAt, iso(1, 4));
  assert.deepEqual(duplicate.criteria, [variant.review.criteria[0]]);
});
