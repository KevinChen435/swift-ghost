import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createTransferWorkspace,
  normalizeTransferWorkspace,
} from "../app/lib/transfer-lab.mjs";

test("state v21 persists transfer evidence after the v20 fallback", async () => {
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  assert.match(product, /export type AppState = \{\s+version: 23;/);
  assert.match(product, /transferWorkspace: TransferWorkspace/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v23"/);
  assert.match(product, /TWENTY_FIRST_STORAGE_KEY = "swift-ghost-state-v21"/);
  assert.match(product, /TWENTIETH_STORAGE_KEY = "swift-ghost-state-v20"/);
  assert.match(
    product,
    /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+TWENTY_SECOND_STORAGE_KEY,\s+TWENTY_FIRST_STORAGE_KEY,\s+TWENTIETH_STORAGE_KEY,/,
  );
  assert.match(
    product,
    /transferWorkspace: createTransferWorkspace\("1970-01-01T00:00:00\.000Z"\)/,
  );
  assert.match(
    product,
    /Number\(value\.version\) >= 21 \? value\.transferWorkspace : undefined/,
  );
});

test("a v20 backup receives a deterministic empty transfer workspace", () => {
  const legacyWorkspace = {
    exposures: [{ variantId: "transfer:20001", openCount: 99 }],
  };
  const migrated = normalizeTransferWorkspace(
    Number(20) >= 21 ? legacyWorkspace : undefined,
    { now: "1970-01-01T00:00:00.000Z" },
  );
  assert.deepEqual(
    migrated,
    createTransferWorkspace("1970-01-01T00:00:00.000Z"),
  );
});
