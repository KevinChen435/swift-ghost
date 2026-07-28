import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("state v12 has explicit persistence guards for reload-safe timed mocks", async () => {
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(product, /export type AppState = \{\s+version: 12;/);
  assert.match(product, /export const STORAGE_KEY = "swift-ghost-state-v12"/);
  assert.match(product, /export const PREVIOUS_STORAGE_KEY = "swift-ghost-state-v11"/);
  assert.match(product, /SECOND_VERSION_STORAGE_KEY = "swift-ghost-state-v3"/);
  assert.match(product, /value\.kind === "mock" &&\s+entries\.length === 1/);
  assert.match(product, /entries\[0\]\.practiceKind === "solving"/);
  assert.match(product, /expiresAt &&\s+durationMinutes >= 1/);
  assert.match(product, /kind === "mock"\s+\? \{/);
  assert.match(product, /mockPreset: \(\["screen", "standard", "stretch"\] as const\)/);
  assert.match(product, /durationMinutes,\s+expiresAt,/);
  assert.match(product, /\[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12\]/);

  assert.match(app, /expireMockInterviewRef/);
  assert.match(app, /mockInterviewRemainingMs\(session, now\) !== 0/);
  assert.match(app, /recordAbandon\(current\)/);
  assert.match(app, /sessionHistoryRecord\(active, active\.entries, "expired"\)/);
});
