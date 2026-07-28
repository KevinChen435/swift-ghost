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
  assert.match(workbench, /notebook\?: ReactNode/);
  assert.match(workbench, /\{ id: "notes" as const, label: "Notes" \}/);
  assert.match(workbench, /desktopPromptPane/);
  assert.match(workbench, /desktopPromptTabId/);
  assert.match(workbench, /selectDesktopPromptPane/);
  assert.match(workbench, /aria-labelledby=\{/);
  assert.match(workbench, /tabIndex=\{desktopPromptPane === "notes" \? 0 : -1\}/);
  assert.match(workbench, /matchMedia\("\(max-width: 1100px\)"\)/);
  assert.equal((workbench.match(/\{notebook\}/g) ?? []).length, 1);
  assert.match(workbench, /tabIndex=\{mobilePane === id \? 0 : -1\}/);
  assert.match(app, /mobilePane=\{mobileWorkspacePane\}/);
  assert.match(app, /setMobileWorkspacePane\("tests"\)/);

  assert.match(submissionInspector, /challenge-console-submission-list/);
  assert.match(consoleUi, /Hidden judge details stay out of the interface/);
  assert.doesNotMatch(consoleUi, /<pre>\{submission\.source\}<\/pre>/);
  assert.match(consoleUi, /availableTabs\.includes\(consoleTab\)/);

  assert.match(css, /\.solve-workbench-desktop-layout\s*\{/);
  assert.match(css, /\.solve-workbench-notes-pane\s*\{/);
  assert.match(css, /grid-column:\s*3/);
  assert.match(css, /repeat\(auto-fit, minmax\(0, 1fr\)\)/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /\.solve-workbench-pane\.is-mobile-active\s*\{\s*display:\s*block/);
  assert.match(css, /\.solve-workbench-pane\s*\{\s*display:\s*none/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);

  const mockDesktopPlacement = css.indexOf(".mock-problem-count {");
  const tabletBreakpoint = css.indexOf("@media (max-width: 1000px)");
  const tabletPlacementReset = css.indexOf(
    ".mock-interview-copy {",
    tabletBreakpoint,
  );
  assert.ok(mockDesktopPlacement >= 0);
  assert.ok(tabletPlacementReset > mockDesktopPlacement);

  const debriefBaseGrid = css.indexOf(".mock-debrief-dialog__rubric {");
  const finalMobileBreakpoint = css.lastIndexOf("@media (max-width: 760px)");
  const debriefMobileReset = css.indexOf(
    ".mock-debrief-dialog__rubric,",
    finalMobileBreakpoint,
  );
  assert.ok(debriefBaseGrid >= 0);
  assert.ok(debriefMobileReset > debriefBaseGrid);
});
