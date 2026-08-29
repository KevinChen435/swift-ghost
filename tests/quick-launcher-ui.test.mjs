import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(
  new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
  "utf8",
);
const styles = await readFile(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

test("the app ships a keyboard-opened quick launcher", () => {
  assert.match(app, /launcherOpen/);
  assert.match(app, /launcherQuery/);
  assert.match(app, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(app, /key === "\/"/);
  assert.match(app, /Open quick launcher/);
  assert.match(app, /<QuickLauncherDialog/);
  assert.match(app, /data-modal-autofocus/);
});

test("quick launcher actions cover the primary workspaces", () => {
  for (const label of [
    "Today",
    "Learn",
    "Improve",
    "Practice",
    "Studio",
    "Assess",
    "Problems",
    "Plans",
    "Records",
    "Settings",
    "Random problem",
  ]) {
    assert.match(app, new RegExp(`label: "${label}"`));
  }
  assert.match(app, /Resume draft/);
  assert.match(app, /Review due/);
  assert.match(app, /launcherDraftItem/);
  assert.match(app, /launcherDueCount/);
});

test("quick launcher has a responsive command-grid presentation", () => {
  assert.match(styles, /\.launcher-dialog\s*\{/);
  assert.match(styles, /\.launcher-search\s*\{/);
  assert.match(styles, /\.launcher-grid\s*\{/);
  assert.match(styles, /grid-template-columns: repeat\(auto-fit, minmax\(210px, 1fr\)\)/);
  assert.match(styles, /\.launcher-action:focus-visible/);
});
