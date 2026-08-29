import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Swift custom rehearsal stays bounded, persisted locally, and separate from evidence", async () => {
  const consoleUi = await readFile(
    new URL("../app/components/SwiftSolveConsole.tsx", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const cloud = await readFile(
    new URL("../app/lib/cloud.mjs", import.meta.url),
    "utf8",
  );
  assert.match(consoleUi, /Raw JSON/);
  assert.match(consoleUi, /swiftValueMatches/);
  assert.match(consoleUi, /localStorage/);
  assert.match(consoleUi, /Practice only/);
  assert.match(consoleUi, /execution-only/);
  assert.match(consoleUi, /onRunCustom/);
  assert.match(consoleUi, /actual:/);
  assert.match(consoleUi, /result\.error/);
  assert.match(page, /runTrustedCustomCases/);
  assert.match(page, /practice-only/);
  assert.match(cloud, /MAX_TRUSTED_CUSTOM_CASES/);
  assert.match(cloud, /trustedCustomCases/);
  assert.match(cloud, /runTrustedCustomCases/);
  assert.match(cloud, /custom-runs/);
});
