import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TEST_DESIGN_PROBES } from "../app/data/test-design-probes.ts";
import { backupInventory } from "../app/lib/backup.mjs";
import { buildWeaknessLab } from "../app/lib/weakness-lab.mjs";

test("v30 adds an isolated Test Design workspace while preserving the exact v29 fallback", async () => {
  const product = await readFile(new URL("../app/lib/product.ts", import.meta.url), "utf8");
  assert.match(product, /version: 30;/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v30"/);
  assert.match(product, /TWENTY_NINTH_STORAGE_KEY = "swift-ghost-state-v29"/);
  assert.match(product, /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+TWENTY_NINTH_STORAGE_KEY,\s+TWENTY_EIGHTH_STORAGE_KEY/);
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
  assert.match(component, /has not been executed or\s+copied/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /revealHeadingRef/);
  assert.match(app, /patternReviewMode === "tests"[\s\S]*<TestDesignLab/);
  assert.match(app, /onTestDesign=\{\(\) => openTestDesignLab\("today"\)\}/);
  assert.match(academy, /onOpenTestDesign/);
  assert.match(assessment, /onOpenTestDesign/);
});

test("only current completed objective failures feed boundary and verification evidence", () => {
  const probe = TEST_DESIGN_PROBES[0];
  const item = {itemId:probe.itemId,contentRevision:probe.itemRevision,title:probe.title,pattern:"Arrays & Hashing",track:"interview",language:"python",estimatedMinutes:8,verification:{revision:1,cases:[{}]}};
  const base = {id:"td-1",sprintId:"s",source:"academy",probeId:probe.id,probeRevision:probe.revision,itemId:probe.itemId,itemRevision:probe.itemRevision,skillId:probe.skillId,purpose:"baseline",assumption:"a",input:probe.referenceCases[0].input,expected:"wrong",defectCaught:"d",assisted:false,wasDue:false,purposeMatch:false,oracleStatus:"contradicted",committedAt:"2026-07-29T12:00:00.000Z",revealedAt:"2026-07-29T12:01:00.000Z",grade:"good",completedAt:"2026-07-29T12:02:00.000Z",dueAt:"2026-07-30T12:02:00.000Z",levelAfter:0,lapseCount:1,updatedAt:"2026-07-29T12:02:00.000Z"};
  const model = buildWeaknessLab({items:[item],testDesignAttempts:[base],testDesignProbes:TEST_DESIGN_PROBES,now:"2026-07-29T13:00:00.000Z"});
  const tags = model.cases.filter((entry)=>entry.sourceKinds.includes("test-design")).map((entry)=>entry.weakness);
  assert.deepEqual(tags.sort(), ["boundary","verification"]);
  const stale = buildWeaknessLab({items:[item],testDesignAttempts:[{...base,probeRevision:999}],testDesignProbes:TEST_DESIGN_PROBES,now:"2026-07-29T13:00:00.000Z"});
  assert.equal(stale.cases.some((entry)=>entry.sourceKinds.includes("test-design")),false);
  const hintOnly = buildWeaknessLab({items:[item],testDesignAttempts:[{...base,purpose:probe.primaryPurpose,purposeMatch:true,oracleStatus:"confirmed",assisted:true}],testDesignProbes:TEST_DESIGN_PROBES,now:"2026-07-29T13:00:00.000Z"});
  assert.equal(hintOnly.cases.some((entry)=>entry.sourceKinds.includes("test-design")),false);
});

test("backup inventory and user confirmation copy include Test Design attempts", async () => {
  assert.equal(backupInventory({testDesign:{attempts:[{},{}]}}).testDesignAttempts,2);
  const app = await readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8");
  assert.match(app, /inventory\.testDesignAttempts/);
  assert.match(app, /portable v30 backup envelope/);
  assert.match(app, /supported v2-v30 backups/);
});
