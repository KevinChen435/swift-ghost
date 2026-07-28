import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("state v21 persists Interview Studio and migrates all older state versions", async () => {
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );

  assert.match(product, /export type AppState = \{\s+version: 22;/);
  assert.match(product, /interviewStudio: InterviewStudioState/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v22"/);
  assert.match(product, /TWENTY_FIRST_STORAGE_KEY = "swift-ghost-state-v21"/);
  assert.match(product, /TWENTIETH_STORAGE_KEY = "swift-ghost-state-v20"/);
  assert.match(product, /NINETEENTH_STORAGE_KEY = "swift-ghost-state-v19"/);
  assert.match(product, /EIGHTEENTH_STORAGE_KEY = "swift-ghost-state-v18"/);
  assert.match(product, /SEVENTEENTH_STORAGE_KEY = "swift-ghost-state-v17"/);
  assert.match(product, /SIXTEENTH_STORAGE_KEY = "swift-ghost-state-v16"/);
  assert.match(
    product,
    /2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22/,
  );
  assert.match(
    product,
    /interviewStudio: normalizeInterviewStudioState\(\s+Number\(value\.version\) >= 17 \? value\.interviewStudio : undefined,\s+\{\s+validItemIds: validIds,\s+revisions,/,
  );
  assert.match(product, /interviewStudio: \{ active: null, history: \[\] \}/);
  assert.match(
    product,
    /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+TWENTY_FIRST_STORAGE_KEY,\s+TWENTIETH_STORAGE_KEY,\s+NINETEENTH_STORAGE_KEY,\s+EIGHTEENTH_STORAGE_KEY,\s+SEVENTEENTH_STORAGE_KEY,\s+SIXTEENTH_STORAGE_KEY,\s+FIFTEENTH_STORAGE_KEY/,
  );
});
