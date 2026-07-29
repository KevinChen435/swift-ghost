import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PATTERN_LESSONS } from "../app/data/pattern-lessons.ts";
import {
  commitPatternResponse,
  createPatternLearningWorkspace,
} from "../app/lib/pattern-learning.mjs";

test("state v28 persists Pattern Academy while retaining the complete v27 fallback", async () => {
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  assert.match(product, /export type AppState = \{\s+version: 28;/);
  assert.match(product, /patternLearning: PatternLearningWorkspace/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v28"/);
  assert.match(product, /TWENTY_SEVENTH_STORAGE_KEY = "swift-ghost-state-v27"/);
  assert.match(
    product,
    /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+TWENTY_SEVENTH_STORAGE_KEY,\s+TWENTY_SIXTH_STORAGE_KEY/,
  );
  assert.match(product, /patternLearning: createPatternLearningWorkspace\(\)/);
  assert.match(
    product,
    /Number\(value\.version\) >= 28 \? value\.patternLearning : undefined/,
  );
});
test("a current Pattern Academy workspace round-trips through product normalization", async () => {
  const lesson = PATTERN_LESSONS[0];
  const workspace = commitPatternResponse(
    createPatternLearningWorkspace("2026-07-29T12:00:00.000Z"),
    lesson,
    lesson.checks[0].id,
    "The table describes exactly the processed prefix.",
    { now: "2026-07-29T12:01:00.000Z" },
  );
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("pattern-state", `${process.pid}-${Date.now()}`);
  const built = await import(workerUrl.href);
  const normalizeState = built.normalizeState ?? built.default?.normalizeState;
  if (typeof normalizeState !== "function") {
    const product = await readFile(
      new URL("../app/lib/product.ts", import.meta.url),
      "utf8",
    );
    assert.match(product, /normalizePatternLearningWorkspace/);
    return;
  }
  const normalized = normalizeState({
    version: 28,
    attempts: [],
    settings: {},
    customItems: [],
    sessionHistory: [],
    studyWorkspace: {},
    patternLearning: workspace,
  });
  assert.deepEqual(normalized.patternLearning, workspace);
});
