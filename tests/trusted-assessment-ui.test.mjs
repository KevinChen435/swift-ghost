import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("verified assessment samples use the isolated runner for both languages", async () => {
  const panel = await readFile(
    new URL("../app/components/TrustedAssessmentPanel.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(panel, /createPythonRunner/);
  assert.match(panel, /runTrustedExamples\(/);
  assert.match(panel, /matching isolated Linux runtime/);
  assert.match(panel, /Isolated public examples:/);
  assert.match(panel, /publicCaseResults/);
  assert.match(panel, /hidden cases stay sealed/);
  assert.match(panel, /language === "swift" \? "Swift" : "Python"/);
  assert.match(panel, /judge-enqueue-unavailable/);
  assert.match(panel, /The example run is saved and waiting for the isolated judge/);
  assert.match(panel, /source is sent only when you run or submit/);
});
