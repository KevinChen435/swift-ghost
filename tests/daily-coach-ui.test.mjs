import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("daily coach exposes a muted-answer crib for python, swift, and iOS study", async () => {
  const component = await read("../app/components/DailyCoach.tsx");
  const styles = await read("../app/globals.css");

  assert.match(component, /Grey answer crib/);
  assert.match(component, /Read the prompt, keep the answer visible/);
  assert.match(component, /aria-label="Crib lane"/);
  assert.match(component, /aria-pressed=\{cribLane === lane\}/);
  assert.match(component, /Focus answer/);
  assert.match(component, /Soft blur/);
  assert.match(component, /pythonInterviewScript/);
  assert.match(component, /iosTechnicalScreenScript/);
  assert.match(component, /coachCribLaneLabel/);
  assert.match(component, /coach-crib-answer/);
  assert.match(component, /is-focused/);
  assert.match(component, /coach-crib-filters/);
  assert.match(styles, /\.coach-crib\s*\{/);
  assert.match(styles, /\.coach-crib-grid\s*\{/);
  assert.match(styles, /\.coach-crib-answer\.is-muted/);
  assert.match(styles, /\.coach-crib-answer\.is-focused/);
  assert.match(styles, /filter:\s*blur\(1\.8px\);/);
});
