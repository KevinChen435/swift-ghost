import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("solve workbench ships accessible split and mobile panel controls", async () => {
  const [workbench, consoleUi, submissionInspector, app, css] = await Promise.all([
    readFile(
      new URL("../app/components/SolveWorkbench.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/ChallengeConsole.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/SubmissionInspector.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(workbench, /role="separator"/);
  assert.match(workbench, /aria-orientation="vertical"/);
  assert.match(workbench, /aria-valuemin=\{MIN_PROBLEM_PERCENT\}/);
  assert.match(workbench, /aria-controls=\{`\$\{paneId/);
  assert.match(workbench, /requestAnimationFrame/);
  assert.match(workbench, /event\.key !== "Enter"/);
  assert.match(workbench, /role="tablist"/);
  assert.match(workbench, /tabIndex=\{mobilePane === id \? 0 : -1\}/);
  assert.match(app, /mobilePane=\{mobileWorkspacePane\}/);
  assert.match(app, /setMobileWorkspacePane\("tests"\)/);

  assert.match(submissionInspector, /challenge-console-submission-list/);
  assert.match(consoleUi, /Hidden judge details stay out of the interface/);
  assert.doesNotMatch(consoleUi, /<pre>\{submission\.source\}<\/pre>/);
  assert.match(consoleUi, /availableTabs\.includes\(consoleTab\)/);

  assert.match(css, /\.solve-workbench-desktop-layout\s*\{/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /\.solve-workbench-pane\.is-mobile-active\s*\{\s*display:\s*block/);
  assert.match(css, /\.solve-workbench-pane\s*\{\s*display:\s*none/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});
