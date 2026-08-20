import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the Library is promoted into a lane-aware Problems workspace", async () => {
  const [app, catalog] = await Promise.all([
    read("../app/components/SwiftGhostApp.tsx"),
    read("../app/components/CatalogLibrary.tsx"),
  ]);
  assert.match(app, /id: "library", label: "Problems"/);
  assert.match(catalog, /Problem workspace/);
  assert.match(catalog, /Problem progress overview/);
  assert.match(catalog, /aria-label="Problem lanes"/);
  assert.match(catalog, /Self-assessed concept practice/);
  assert.match(catalog, /Swift recall · not locally executed/);
  assert.match(catalog, /accepted \$\{solveAuthority\} solve/);
});

test("problem notes are structured, focus-contained, and saved durably before closing", async () => {
  const [app, dialog, catalog] = await Promise.all([
    read("../app/components/SwiftGhostApp.tsx"),
    read("../app/components/ProblemNotesDialog.tsx"),
    read("../app/components/CatalogLibrary.tsx"),
  ]);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /Approach and invariant/);
  assert.match(dialog, /Mistakes and edge cases/);
  assert.match(dialog, /This note was written for revision/);
  assert.match(dialog, /Discard the unsaved changes to this problem note/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /if \(saved\) onClose\(\)/);
  assert.match(catalog, /state\.problemNotes\[record\.itemId\]/);
  assert.match(app, /commitStateImmediately[\s\S]*requirePersistence: true/);
  assert.match(app, /Problem note saved on this device/);
});

test("the Problems workspace and notes dialog have explicit mobile layouts", async () => {
  const css = await read("../app/globals.css");
  assert.match(css, /\.problem-workspace-overview/);
  assert.match(css, /\.problem-lane-tabs/);
  assert.match(css, /\.problem-notes-dialog/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.problem-notes-dialog[\s\S]*min-height: 100dvh/);
});
