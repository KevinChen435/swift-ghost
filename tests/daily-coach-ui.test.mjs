import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("daily coach exposes a muted-answer crib for python, swift, and iOS study", async () => {
  const component = await read("../app/components/DailyCoach.tsx");
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const styles = await read("../app/globals.css");

  assert.match(component, /Grey answer crib/);
  assert.match(component, /Read the prompt, keep the answer visible/);
  assert.match(component, /aria-label="Crib lane"/);
  assert.match(component, /aria-pressed=\{cribLane === lane\}/);
  assert.match(component, /Focus answer/);
  assert.match(component, /Soft blur/);
  assert.match(component, /onOpenCribItem/);
  assert.match(component, /Start ghost typing/);
  assert.match(component, /Open recall card/);
  assert.match(component, /pythonInterviewScript/);
  assert.match(component, /iosTechnicalScreenScript/);
  assert.match(component, /coachCribLaneLabel/);
  assert.match(component, /coachCribActionLabel/);
  assert.match(component, /coach-crib-answer/);
  assert.match(component, /coach-crib-actions/);
  assert.match(component, /is-focused/);
  assert.match(component, /coach-crib-filters/);
  assert.match(styles, /\.coach-crib\s*\{/);
  assert.match(styles, /\.coach-crib-grid\s*\{/);
  assert.match(styles, /\.coach-crib-actions\s*\{/);
  assert.match(styles, /\.coach-crib-answer\.is-muted/);
  assert.match(styles, /\.coach-crib-answer\.is-focused/);
  assert.match(styles, /filter:\s*blur\(1\.8px\);/);
  assert.match(app, /onOpenCribItem=\{\(cribItem\) =>/);
  assert.match(app, /onOpen\(cribItem, 1, undefined, undefined, "typing"\)/);
  assert.match(app, /onOpen\(cribItem, 5, undefined, undefined, "concept"\)/);
});
