import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TEST_DESIGN_PROBES } from "../app/data/test-design-probes.ts";
import { backupInventory } from "../app/lib/backup.mjs";
import { buildWeaknessLab } from "../app/lib/weakness-lab.mjs";

test("v32 adds reconstruction state while preserving the exact v31 and v30 fallbacks", async () => {
  const product = await readFile(new URL("../app/lib/product.ts", import.meta.url), "utf8");
  assert.match(product, /version: 32;/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v32"/);
  assert.match(product, /THIRTY_FIRST_STORAGE_KEY = "swift-ghost-state-v31"/);
  assert.match(product, /THIRTIETH_STORAGE_KEY = "swift-ghost-state-v30"/);
  assert.match(product, /TWENTY_NINTH_STORAGE_KEY = "swift-ghost-state-v29"/);
  assert.match(product, /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+THIRTY_FIRST_STORAGE_KEY,\s+THIRTIETH_STORAGE_KEY,\s+TWENTY_NINTH_STORAGE_KEY,\s+TWENTY_EIGHTH_STORAGE_KEY/);
  assert.match(product, /testDesign: TestDesignWorkspace/);
  assert.match(product, /testDesign: createTestDesignWorkspace\(\)/);
  assert.match(product, /Number\(value\.version\) >= 30 \? value\.testDesign : undefined/);
  assert.match(product, /Number\(value\.version\) >= 28 \? value\.patternLearning : undefined/);
});

test("UI keeps objective checks separate and exposes all three core entry points", async () => {
  const [component, app, academy, assessment] = await Promise.all([
    readFile(new URL("../app/components/TestDesignLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PatternAcademy.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssessmentCenter.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(component, /Commit before reveal/);
  assert.match(component, /Novel cases remain\s+unverified/);
  assert.match(component, /not hidden\s+judge cases/);
  assert.match(component, /has not been executed, copied/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /lockedHeadingRef/);
  assert.match(component, /revealHeadingRef/);
  assert.match(component, /Design-only evidence\. Python, Swift, and iOS scenarios are not/);
  assert.match(component, /selectedAttemptId/);
  assert.match(component, /Retired content · history only/);
  assert.match(app, /patternReviewMode === "tests"[\s\S]*<TestDesignLab/);
  assert.match(app, /onTestDesign=\{\(lane\) => openTestDesignLab\("today", lane\)\}/);
  assert.match(app, /testDesignAttemptId/);
  assert.match(academy, /onOpenTestDesign/);
  assert.match(academy, /Python, Swift, or iOS contract/);
  assert.match(assessment, /onOpenTestDesign/);
  assert.match(assessment, /Python, Swift, or iOS before seeing/);
});

test("only current lane-matched Test Design failures feed multi-lane Weakness evidence", () => {
  const probeFor = (lane) => TEST_DESIGN_PROBES.find((probe) => probe.lane === lane);
  const attempts = ["python", "swift", "ios"].map((lane, index) => {
    const probe = probeFor(lane);
    return {
      id: `td-${lane}`,
      sprintId: `s-${lane}`,
      source: "academy",
      probeId: probe.id,
      probeRevision: probe.revision,
      lane,
      itemId: probe.itemId,
      itemRevision: probe.itemRevision,
      skillId: probe.skillId,
      purpose: "baseline",
      assumption: "a",
      input: probe.referenceCases[0].input,
      expected: "wrong",
      defectCaught: "d",
      assisted: false,
      wasDue: false,
      purposeMatch: false,
      oracleStatus: "contradicted",
      committedAt: `2026-07-29T12:0${index}:00.000Z`,
      revealedAt: `2026-07-29T12:1${index}:00.000Z`,
      grade: "good",
      completedAt: `2026-07-29T12:2${index}:00.000Z`,
      dueAt: "2026-07-30T12:20:00.000Z",
      levelAfter: 0,
      lapseCount: 1,
      updatedAt: `2026-07-29T12:2${index}:00.000Z`,
    };
  });
  const items = attempts.map((attempt) => ({
    itemId: attempt.itemId,
    contentRevision: attempt.itemRevision,
    title: attempt.itemId,
    pattern: `Topic ${attempt.lane}`,
    track: attempt.lane === "python" ? "interview" : "ios",
    language: attempt.lane === "python" ? "python" : "swift",
    ...(attempt.lane === "swift" ? { conceptLane: "swift" } : {}),
    estimatedMinutes: 8,
    verification: { revision: 1, cases: [{}] },
  }));
  const model = buildWeaknessLab({
    items,
    testDesignAttempts: attempts,
    testDesignProbes: TEST_DESIGN_PROBES,
    now: "2026-07-29T13:00:00.000Z",
  });
  const evidenceCases = model.cases.filter((entry) =>
    entry.sourceKinds.includes("test-design"),
  );
  assert.deepEqual(new Set(evidenceCases.map((entry) => entry.lane)), new Set(["python", "swift", "ios"]));
  for (const lane of ["python", "swift", "ios"]) {
    assert.deepEqual(
      evidenceCases
        .filter((entry) => entry.lane === lane)
        .map((entry) => entry.weakness)
        .sort(),
      ["boundary", "verification"],
    );
  }

  for (const invalidAttempt of [
    { ...attempts[0], probeRevision: 999 },
    { ...attempts[1], lane: "ios" },
    { ...attempts[2], itemRevision: 999 },
  ]) {
    const invalid = buildWeaknessLab({
      items,
      testDesignAttempts: [invalidAttempt],
      testDesignProbes: TEST_DESIGN_PROBES,
      now: "2026-07-29T13:00:00.000Z",
    });
    assert.equal(
      invalid.cases.some((entry) => entry.sourceKinds.includes("test-design")),
      false,
    );
  }
});

test("backup inventory and user confirmation copy include typing and both active lab families", async () => {
  const inventory = backupInventory({
    typingProgress: {
      records: [{ itemId: "swift:value-a", itemRevision: 2 }],
    },
    testDesign: {
      attempts: [{}, {}],
      drafts: [{}],
      activeSprint: { id: "active", status: "active" },
    },
    conceptTransfer: {
      attempts: [{ id: "cold-1" }],
      drafts: [{ attemptId: "cold-1" }],
      activeAttemptId: "cold-1",
    },
  });
  assert.equal(inventory.typingProgressRecords, 1);
  assert.equal(inventory.testDesignAttempts, 2);
  assert.equal(inventory.testDesignDrafts, 1);
  assert.equal(inventory.activeTestDesignSprints, 1);
  assert.equal(inventory.conceptTransferAttempts, 1);
  assert.equal(inventory.conceptTransferDrafts, 1);
  assert.equal(inventory.activeConceptTransferAttempts, 1);
  const app = await readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8");
  assert.match(app, /inventory\.typingProgressRecords/);
  assert.match(app, /inventory\.testDesignAttempts/);
  assert.match(app, /inventory\.testDesignDrafts/);
  assert.match(app, /inventory\.activeTestDesignSprints/);
  assert.match(app, /inventory\.conceptTransferAttempts/);
  assert.match(app, /inventory\.conceptTransferDrafts/);
  assert.match(app, /inventory\.activeConceptTransferAttempts/);
  assert.match(app, /portable v32 backup envelope/);
  assert.match(app, /supported v2-v32 backups/);
});
