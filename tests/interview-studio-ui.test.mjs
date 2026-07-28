import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the scripted Python and Swift/iOS Interview Studio surfaces", async () => {
  const [app, panel, scripts, workbench, consoleUi, css] = await Promise.all([
    readFile(
      new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/InterviewStudioPanel.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/data/interview-scripts.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/SolveWorkbench.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/ChallengeConsole.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Interview Studio/);
  assert.match(app, /Python coding/);
  assert.match(app, /Swift \/ iOS screen/);
  assert.match(app, /No microphone, camera, or network compiler/);
  assert.match(app, /recordActiveInterviewRunnerEvidence/);
  assert.match(app, /active\.id !== expectedSessionId/);
  assert.match(app, /onInterviewRunnerEvidence\(\s+activeStudio\.id,/);
  assert.match(app, /Submit the current source successfully before finishing/);
  assert.match(app, /Self-paced technical screen/);
  assert.match(
    app,
    /isStudioSession\s+\? committed\.sessionHistory\s+: \[/,
  );
  assert.match(app, /Interview archived · transcript and evidence saved locally/);
  assert.match(app, /event\.shiftKey && \(!isMock \|\| isStudio\)/);
  assert.match(app, /Interview\s+Studio transcripts and criteria/);

  for (const phase of [
    "introduction",
    "clarification",
    "approach",
    "implementation",
    "testing",
    "complexity",
    "follow-up",
    "closing",
  ]) {
    assert.match(panel, new RegExp(`"${phase}"`));
  }
  assert.match(panel, /aria-current=\{current \? "step" : undefined\}/);
  assert.match(panel, /recorded, not automatically interpreted/i);
  assert.match(panel, /session\.mode === "mock"/);
  assert.match(panel, /Hints locked/);
  assert.match(panel, /Private on this device/);
  assert.match(workbench, /notebookLabel/);
  assert.match(consoleUi, /isSolving && \(!isMock \|\| isStudio\)/);
  assert.match(consoleUi, /isMock &&\s+!isStudio &&/);

  assert.match(scripts, /pythonInterviewScript/);
  assert.match(scripts, /iosTechnicalScreenScript/);
  assert.match(scripts, /PYTHON_PATTERN_PACKS/);
  assert.match(scripts, /referenceCriteria/);
  assert.match(scripts, /never semantically scored/i);
  assert.doesNotMatch(scripts, /hire|hiring recommendation/i);

  assert.match(css, /\.interview-studio-launcher\s*\{/);
  assert.match(css, /\.interview-stepper\s*\{/);
  assert.match(css, /\.interview-history-report\s*\{/);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
});

test("community upload path remains attempt-only and excludes Studio state", async () => {
  const [app, cloud] = await Promise.all([
    readFile(
      new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/lib/cloud.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(app, /state\.attempts/);
  assert.match(app, /postAttemptBatch/);
  assert.doesNotMatch(cloud, /interviewStudio|transcript|referenceCriteria/);
});
