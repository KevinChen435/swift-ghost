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

test("Today expands an active study plan into a launchable focus queue", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  assert.match(app, /buildNextFocusBlock/);
  assert.match(app, /deriveStudyPlanProgress/);
  assert.match(app, /activePlanBlock\?\.entries\.slice\(0, 4\)/);
  assert.match(app, /aria-label="Active plan evidence"/);
  assert.match(app, /today-study-plan-queue/);
  assert.match(app, /activePlanProgress\.currentModule\.title/);
  assert.match(app, /onStartPlanBlock\(/);
  assert.match(app, /onStartPlanBlock=\{startStudyFocusBlock\}/);
  assert.match(app, /Resume block/);
  assert.match(app, /Plan details/);
});

test("Today command deck has responsive console-style layout", async () => {
  const css = await read("../app/globals.css");
  assert.match(css, /\.today-command-deck\s*\{/);
  assert.match(css, /\.today-command-grid\s*\{/);
  assert.match(css, /\.today-command-row:hover:not\(:disabled\)/);
  assert.match(css, /\.today-study-plan\s*\{[\s\S]*?grid-template-columns: minmax\(0, 0\.95fr\) minmax\(340px, 1\.05fr\)/);
  assert.match(css, /\.today-study-plan-queue\s*\{/);
  assert.match(css, /\.today-study-plan-evidence\s*\{/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.today-study-plan,[\s\S]*grid-template-columns: 1fr/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.today-study-plan-actions[\s\S]*display: grid/);
  assert.match(css, /@media \(max-width: 1000px\)[\s\S]*\.today-command-grid[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.today-command-grid[\s\S]*grid-template-columns: 1fr/);
});

test("Today and Settings share a concise progress sync relay", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  assert.match(app, /ProgressSyncCard/);
  assert.match(app, /cloudStatusCopy/);
  assert.match(app, /studySyncStatusCopy/);
  assert.match(app, /cloudStatus=\{cloud\.status\}/);
  assert.match(app, /studySyncStatus=\{studySyncStatus\}/);
  assert.match(app, /Practice progress relay/);
  assert.match(app, /Practice profile relay/);
  assert.match(app, /Private progress sync/);
  assert.match(app, /progressSyncEnabled/);
  assert.match(app, /getProgressSnapshot/);
  assert.match(app, /putProgressSnapshot/);
  assert.match(app, /applyProgressSnapshotToState/);

  const css = await read("../app/globals.css");
  assert.match(css, /\.progress-sync-card\s*\{/);
  assert.match(css, /\.progress-sync-metrics\s*\{/);
  assert.match(css, /\.progress-sync-card p\s*\{/);
});
