import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createCatalogWorkspace,
  normalizeCatalogWorkspace,
} from "../app/lib/catalog-discovery.mjs";

test("state v21 persists catalog saved views after every v20 field", async () => {
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  assert.match(product, /export type AppState = \{\s+version: 24;/);
  assert.match(product, /catalogWorkspace: CatalogWorkspace/);
  assert.match(product, /export const STORAGE_KEY = "swift-ghost-state-v24"/);
  assert.match(product, /TWENTY_FIRST_STORAGE_KEY = "swift-ghost-state-v21"/);
  assert.match(product, /TWENTIETH_STORAGE_KEY = "swift-ghost-state-v20"/);
  assert.match(product, /NINETEENTH_STORAGE_KEY = "swift-ghost-state-v19"/);
  assert.match(
    product,
    /SUPPORTED_STATE_VERSIONS[\s\S]*2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22/,
  );
  assert.match(
    product,
    /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+TWENTY_THIRD_STORAGE_KEY,\s+TWENTY_SECOND_STORAGE_KEY,\s+TWENTY_FIRST_STORAGE_KEY,\s+TWENTIETH_STORAGE_KEY,\s+NINETEENTH_STORAGE_KEY,\s+EIGHTEENTH_STORAGE_KEY/,
  );
  assert.match(
    product,
    /catalogWorkspace: createCatalogWorkspace\("1970-01-01T00:00:00\.000Z"\)/,
  );
  assert.match(
    product,
    /catalogWorkspace: normalizeCatalogWorkspace\(\s+Number\(value\.version\) >= 20 \? value\.catalogWorkspace : undefined,\s+\)/,
  );
});

test("a v19 migration receives a deterministic empty catalog workspace", () => {
  const legacyPayload = {
    savedViews: [{ id: "must-not-migrate", name: "Legacy", query: {} }],
  };
  const migrated = normalizeCatalogWorkspace(
    Number(19) >= 20 ? legacyPayload : undefined,
  );
  assert.deepEqual(migrated, createCatalogWorkspace("1970-01-01T00:00:00.000Z"));
});

test("a v20 catalog workspace round-trips with saved-view and query bounds", () => {
  const raw = {
    version: 1,
    revision: 7,
    updatedAt: "2026-07-28T12:00:00.000Z",
    savedViews: Array.from({ length: 25 }, (_, index) => ({
      id: `view-${index}`,
      name: `View ${index} ${"n".repeat(100)}`,
      query: {
        text: "q".repeat(200),
        lanes: ["python", "python", "ruby"],
        patterns: Array.from({ length: 60 }, (__, pattern) => `pattern-${pattern}`),
        difficulties: ["Easy", "easy", "Hard"],
        statuses: ["due", "due", "done"],
        lineRange: "26-40",
        timeRange: "11-15",
        collectionIds: Array.from({ length: 60 }, (__, collection) => `collection-${collection}`),
        sort: "title",
        direction: "desc",
        layout: "cards",
        page: 99,
        pageSize: 100,
      },
      createdAt: "2026-07-28T11:00:00.000Z",
      updatedAt: "2026-07-28T12:00:00.000Z",
    })),
  };
  const normalized = normalizeCatalogWorkspace(raw);
  assert.equal(normalized.savedViews.length, 20);
  assert.equal(normalized.savedViews[0].name.length, 80);
  assert.equal(normalized.savedViews[0].query.text.length, 120);
  assert.deepEqual(normalized.savedViews[0].query.lanes, ["python"]);
  assert.equal(normalized.savedViews[0].query.patterns.length, 50);
  assert.deepEqual(normalized.savedViews[0].query.difficulties, ["Easy", "Hard"]);
  assert.deepEqual(normalized.savedViews[0].query.statuses, ["due"]);
  assert.equal(normalized.savedViews[0].query.collectionIds.length, 50);
  assert.equal(normalized.savedViews[0].query.page, 1);
  assert.equal(normalized.savedViews[0].query.pageSize, 100);
  assert.deepEqual(
    normalizeCatalogWorkspace(JSON.parse(JSON.stringify(normalized))),
    normalized,
  );
});
