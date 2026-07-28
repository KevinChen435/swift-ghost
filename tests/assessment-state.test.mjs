import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createAssessmentWorkspace,
  normalizeAssessmentWorkspace,
  startAssessment,
} from "../app/lib/assessments.mjs";

test("state v21 retains bounded local assessments and the v20 fallback", async () => {
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  assert.match(product, /export type AppState = \{\s+version: 21;/);
  assert.match(product, /assessments: AssessmentWorkspace/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v21"/);
  assert.match(product, /TWENTIETH_STORAGE_KEY = "swift-ghost-state-v20"/);
  assert.match(product, /NINETEENTH_STORAGE_KEY = "swift-ghost-state-v19"/);
  assert.match(product, /EIGHTEENTH_STORAGE_KEY = "swift-ghost-state-v18"/);
  assert.match(product, /assessments: createAssessmentWorkspace\(\)/);
  assert.match(
    product,
    /Number\(value\.version\) >= 19 \? value\.assessments : undefined/,
  );
  assert.match(product, /assessmentRunId\?: string/);
  assert.match(product, /assessmentProbeId\?: string/);
});

test("an empty migrated assessment workspace is deterministic", () => {
  assert.deepEqual(normalizeAssessmentWorkspace(undefined), {
    version: 1,
    revision: 0,
    updatedAt: "1970-01-01T00:00:00.000Z",
    activeRunId: null,
    runs: [],
  });
});

test("assessment workspace round-trips without changing the active run", () => {
  const created = startAssessment(
    createAssessmentWorkspace("2026-07-28T12:00:00.000Z"),
    "python-reentry",
    { id: "assessment-roundtrip", now: "2026-07-28T12:01:00.000Z" },
  );
  const restored = normalizeAssessmentWorkspace(
    JSON.parse(JSON.stringify(created)),
    { now: "2026-07-28T13:00:00.000Z" },
  );
  assert.equal(restored.activeRunId, "assessment-roundtrip");
  assert.equal(restored.runs[0].status, "active");
  assert.equal(restored.runs[0].results.length, 6);
});
