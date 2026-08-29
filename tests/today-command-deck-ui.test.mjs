import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Today exposes a direct re-entry command deck for rusty practice", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  assert.match(app, /aria-label="Practice re-entry commands"/);
  assert.match(app, /Pick the next kind of reps/);
  assert.match(app, /onOpen\(typingTarget, recommendedStage\(state, typingTarget\)\)/);
  assert.match(app, /onOpen\(swiftSolveDaily, 5, undefined, undefined, "solving"\)/);
  assert.match(app, /onClick=\{onResumeDraft\}/);
});

test("Today command deck has responsive console-style layout", async () => {
  const css = await read("../app/globals.css");
  assert.match(css, /\.today-command-deck\s*\{/);
  assert.match(css, /\.today-command-grid\s*\{/);
  assert.match(css, /\.today-command-row:hover:not\(:disabled\)/);
  assert.match(css, /@media \(max-width: 1000px\)[\s\S]*\.today-command-grid[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.today-command-grid[\s\S]*grid-template-columns: 1fr/);
});
