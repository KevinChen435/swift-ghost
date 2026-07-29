import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const product = await readFile(
  new URL("../app/lib/product.ts", import.meta.url),
  "utf8",
);
const items = await readFile(
  new URL("../app/lib/items.ts", import.meta.url),
  "utf8",
);
const app = await readFile(
  new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
  "utf8",
);
const studio = await readFile(
  new URL("../app/components/CustomChallengeDialog.tsx", import.meta.url),
  "utf8",
);

test("current state keeps v26, v25, and v24 fallbacks and gates authored judges", () => {
  assert.match(product, /version: 32;/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v32"/);
  assert.match(product, /THIRTY_FIRST_STORAGE_KEY = "swift-ghost-state-v31"/);
  assert.match(product, /THIRTIETH_STORAGE_KEY = "swift-ghost-state-v30"/);
  assert.match(product, /TWENTY_SIXTH_STORAGE_KEY = "swift-ghost-state-v26"/);
  assert.match(product, /TWENTY_FIFTH_STORAGE_KEY = "swift-ghost-state-v25"/);
  assert.match(
    product,
    /TWENTY_FOURTH_STORAGE_KEY = "swift-ghost-state-v24"/,
  );
  assert.match(
    product,
    /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+THIRTY_FIRST_STORAGE_KEY,\s+THIRTIETH_STORAGE_KEY,\s+TWENTY_NINTH_STORAGE_KEY,\s+TWENTY_EIGHTH_STORAGE_KEY,\s+TWENTY_SEVENTH_STORAGE_KEY,\s+TWENTY_SIXTH_STORAGE_KEY,\s+TWENTY_FIFTH_STORAGE_KEY,\s+TWENTY_FOURTH_STORAGE_KEY,/,
  );
  assert.match(product, /stateVersion >= 25/);
  assert.match(product, /CUSTOM_ITEM_STATE_BYTE_LIMIT = 2_500_000/);
  assert.match(product, /usedBytes \+ itemBytes > CUSTOM_ITEM_STATE_BYTE_LIMIT/);
  assert.match(
    product,
    /normalizeCustomItems\(value\.customItems, Number\(value\.version\)\)/,
  );
});

test("imported custom items reconstruct an allowlisted shape", () => {
  const start = product.indexOf("function normalizeCustomItems");
  const end = product.indexOf("function itemIdFromRaw", start);
  const normalizer = product.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(normalizer, /\.\.\.item,/);
  assert.match(normalizer, /itemId: item\.itemId/);
  assert.match(normalizer, /source: "custom" as const/);
  assert.match(normalizer, /challenge: challengeBundle\?\.challenge/);
  assert.match(normalizer, /Invalid or oversized imported judge definitions degrade to snippets/);
  assert.doesNotMatch(normalizer, /transfer: item\.transfer/);
  assert.doesNotMatch(normalizer, /recallChecks: item\.recallChecks/);
});

test("challenge revisions clear stale drafts and structured custom inputs", () => {
  assert.match(items, /deriveCustomChallengeRevisions/);
  assert.match(items, /contentRevision: revisions\.contentRevision/);
  assert.match(items, /revision: revisions\.judgeRevision/);
  assert.match(app, /delete customTestcases\[updated\.itemId\]/);
  assert.match(app, /delete customCaseInputs\[updated\.itemId\]/);
  assert.match(app, /recordAbandon\(current\)/);
  assert.match(app, /itemRevision: updated\.contentRevision/);
});

test("the authoring studio is local-first and requires reference validation", () => {
  assert.match(studio, /Device-local challenge studio/);
  assert.match(studio, /Nothing in this studio uploads to the community/);
  assert.match(studio, /Visible sample/);
  assert.match(studio, /Hidden on submit/);
  assert.match(studio, /Validate reference/);
  assert.match(studio, /createPythonRunner/);
  assert.match(studio, /effectiveReferenceStatus === "passed"/);
  assert.match(studio, /normalizeCustomChallenge/);
  assert.match(studio, /starterCode/);
  assert.match(app, /custom\.verification \? "solving" : undefined/);
});
