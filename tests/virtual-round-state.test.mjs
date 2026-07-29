import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("state v23 preserves virtual rounds after the complete v22 fallback", async () => {
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  assert.match(product, /export type AppState = \{\s+version: 30;/);
  assert.match(product, /virtualRoundWorkspace: VirtualRoundWorkspace/);
  assert.match(product, /export const STORAGE_KEY = "swift-ghost-state-v30"/);
  assert.match(product, /TWENTY_SECOND_STORAGE_KEY = "swift-ghost-state-v22"/);
  assert.match(product, /TWENTY_FIRST_STORAGE_KEY = "swift-ghost-state-v21"/);
  assert.match(
    product,
    /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+TWENTY_NINTH_STORAGE_KEY,\s+TWENTY_EIGHTH_STORAGE_KEY,\s+TWENTY_SEVENTH_STORAGE_KEY,\s+TWENTY_SIXTH_STORAGE_KEY,\s+TWENTY_FIFTH_STORAGE_KEY,\s+TWENTY_FOURTH_STORAGE_KEY,\s+TWENTY_THIRD_STORAGE_KEY,\s+TWENTY_SECOND_STORAGE_KEY,\s+TWENTY_FIRST_STORAGE_KEY/,
  );
  assert.match(product, /virtualRoundWorkspace: createVirtualRoundWorkspace\(\)/);
  assert.match(
    product,
    /Number\(value\.version\) >= 22 \? value\.virtualRoundWorkspace : undefined/,
  );
  assert.match(product, /draftMatchesVirtualRound/);
  assert.match(product, /rejectedVirtualRoundDraft/);
  assert.match(product, /virtualRoundId\?: string/);
  assert.match(product, /origin: "practice" \| "mock" \| "round"/);
});

test("the runner persists an on-time round receipt before creating or invoking the judge", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const requestIndex = app.indexOf("props.onVirtualRoundSubmissionRequested(submissionRequest)");
  const runnerIndex = app.indexOf("const runner = pythonRunner.current ?? createPythonRunner();", requestIndex);
  const verifyIndex = app.indexOf("const result = await runner.verify(", requestIndex);
  assert.notEqual(requestIndex, -1);
  assert.ok(requestIndex < runnerIndex);
  assert.ok(runnerIndex < verifyIndex);
  assert.match(app, /commitStateImmediately[\s\S]*saveStateForScope\(next, activeScope\)/);
  assert.match(app, /const submissionContextKind:[\s\S]*\? "round"/);
  assert.match(app, /requestSubmissionReceipt\(\s*current\.submissionLog/);
  assert.match(app, /!isStudio &&\s+!isVirtualRound/);
});

test("virtual rounds have a first-class Assess route and a locked problem workspace", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const center = await readFile(
    new URL("../app/components/AssessmentCenter.tsx", import.meta.url),
    "utf8",
  );
  const rounds = await readFile(
    new URL("../app/components/VirtualRounds.tsx", import.meta.url),
    "utf8",
  );
  assert.match(app, /assessmentRouteId === "virtual-rounds"/);
  assert.match(app, /<VirtualRounds/);
  assert.match(app, /const isLocked = isMock \|\| isAssessment \|\| isVirtualRound/);
  assert.match(app, /Pattern guidance, hints, the reference solution, and prior/);
  assert.match(app, /Virtual round mode locked/);
  assert.match(center, /<h2>Virtual Rounds<\/h2>/);
  assert.match(center, /Familiar catalog questions may appear/);
  assert.match(rounds, /not proctored/i);
  assert.match(rounds, /No global rank, interview-readiness rating, certification, or hiring signal/);
});

test("the contest center exposes route-backed navigation, personal standings, and post-round actions", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const rounds = await readFile(
    new URL("../app/components/VirtualRounds.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(app, /function updateContestRoute/);
  assert.match(app, /contestSection: nextSection/);
  assert.match(app, /selectedReportId=\{contestRoundId\}/);
  assert.match(app, /buildPersonalStandings\(state\.virtualRoundWorkspace\.history\)/);
  assert.match(app, /function retryVirtualRoundProblem/);
  assert.match(app, /origins: \["round"\][\s\S]*selectedId: submissionId/);
  assert.match(app, /window\.confirm\([\s\S]*Finish and lock/);
  assert.match(rounds, /role="tablist"/);
  assert.match(rounds, /ArrowRight/);
  assert.match(rounds, /Personal standings/);
  assert.match(rounds, /adaptive problem mixes can differ/i);
  assert.match(rounds, /Retry as fresh practice/);
  assert.match(rounds, /Inspect source/);
  assert.match(rounds, /role="timer"/);
  assert.match(css, /\.contest-tabs/);
  assert.match(css, /\.contest-standings-scroll/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.contest-history-row/);
});

test("the Today draft card restores the virtual-round identity instead of opening ordinary practice", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const resumeStart = app.indexOf("function resumeSavedDraft()");
  const resumeEnd = app.indexOf("function startVirtualRoundPreset", resumeStart);
  const resume = app.slice(resumeStart, resumeEnd);
  assert.notEqual(resumeStart, -1);
  assert.match(resume, /if \(live\.virtualRoundId\)/);
  assert.match(
    resume,
    /openVirtualRoundItem\(live\.virtualRoundId, live\.itemId\)/,
  );
  assert.match(app, /<TodayView[\s\S]*onResumeDraft=\{resumeSavedDraft\}/);
  assert.match(app, /onClick=\{onResumeDraft\}/);
});

test("navigation waits for a pending round verdict instead of minting a judge error", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const blockStart = app.indexOf("function blockVirtualRoundNavigation()");
  const blockEnd = app.indexOf("function useSolveHint", blockStart);
  const blocker = app.slice(blockStart, blockEnd);
  assert.notEqual(blockStart, -1);
  assert.match(blocker, /submission\.status === "pending"/);
  assert.match(blocker, /return true/);
  assert.doesNotMatch(blocker, /settleVirtualRoundSubmission/);
  assert.match(app, /function navigateView[\s\S]*if \(blockVirtualRoundNavigation\(\)\) return/);
  assert.match(app, /function selectAssessment[\s\S]*if \(blockVirtualRoundNavigation\(\)\) return/);
  assert.match(
    app,
    /function openItem[\s\S]*if \(!virtualRoundId && blockVirtualRoundNavigation\(\)\) return/,
  );
  assert.match(app, /window\.history\.forward\(\)/);
});

test("the locked round workspace keeps switching, flags, and finishing reachable", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(app, /isVirtualRound \? " is-virtual-round"/);
  assert.match(app, /className=\{`mobile-practice-controls\$\{isVirtualRound/);
  assert.match(app, /aria-label="Switch round problem"/);
  assert.match(app, /currentVirtualRoundProblem\?\.flagged/);
  assert.match(css, /\.practice-layout\.is-solving\.is-virtual-round \.problem-rail \{\s+display: block/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.practice-layout\.is-solving\.is-virtual-round \.problem-rail \{\s+display: none/);
});

test("backup copy advertises the v30 envelope and all older supported imports", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const backup = await readFile(
    new URL("../app/lib/backup.mjs", import.meta.url),
    "utf8",
  );
  assert.match(app, /portable v30 backup envelope/);
  assert.match(app, /supported v2-v30 backups/);
  assert.match(backup, /virtualRoundWorkspace/);
});
