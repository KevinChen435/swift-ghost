import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders a private profile-loading shell before browser identity resolves", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Swift Ghost/);
  assert.match(html, /loading your private practice profile/);
  assert.match(html, /Loading your practice profile/);
  assert.match(html, /browser data stays separated by signed-in account/i);
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("local production capability checks degrade quietly without Worker bindings", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("capabilities-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/v1/capabilities"),
    undefined,
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    apiVersion: "v1",
    cloudSync: false,
    studySync: false,
    community: false,
    leaderboards: false,
    trustedAssessments: false,
    auth: "anonymous",
    maxAttemptBatch: 100,
    privacy: {
      profileDefault: "private",
      activityDefault: "off",
      leaderboardsDefault: "off",
    },
  });
});

test("ships the full five-stage practice model and original problem links", async () => {
  const page = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  const catalog = await readFile(
    new URL("../app/data/problems.ts", import.meta.url),
    "utf8",
  );
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );
  const community = await readFile(
    new URL("../app/components/CommunityPanel.tsx", import.meta.url),
    "utf8",
  );
  const worker = await readFile(
    new URL("../worker/index.ts", import.meta.url),
    "utf8",
  );
  const coach = await readFile(
    new URL("../app/components/DailyCoach.tsx", import.meta.url),
    "utf8",
  );
  const planner = await readFile(
    new URL("../app/lib/planner.mjs", import.meta.url),
    "utf8",
  );
  const debrief = await readFile(
    new URL("../app/components/PostAttemptDebrief.tsx", import.meta.url),
    "utf8",
  );
  const learningState = await readFile(
    new URL("../app/lib/learning-state.mjs", import.meta.url),
    "utf8",
  );
  const readinessPanel = await readFile(
    new URL("../app/components/ReadinessAnalytics.tsx", import.meta.url),
    "utf8",
  );
  const readiness = await readFile(
    new URL("../app/lib/readiness.mjs", import.meta.url),
    "utf8",
  );
  const catalogLibrary = await readFile(
    new URL("../app/components/CatalogLibrary.tsx", import.meta.url),
    "utf8",
  );

  for (const stage of [
    "Full ghost",
    "Missing expressions",
    "Missing lines",
    "Skeleton only",
    "Blank editor",
  ]) {
    assert.match(product, new RegExp(stage));
  }

  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v28"/);
  assert.match(product, /TWENTY_SIXTH_STORAGE_KEY = "swift-ghost-state-v26"/);
  assert.match(product, /TWENTY_FIFTH_STORAGE_KEY = "swift-ghost-state-v25"/);
  assert.match(product, /TWENTY_FOURTH_STORAGE_KEY = "swift-ghost-state-v24"/);
  assert.match(product, /TWENTY_FIRST_STORAGE_KEY = "swift-ghost-state-v21"/);
  assert.match(product, /TWENTIETH_STORAGE_KEY = "swift-ghost-state-v20"/);
  assert.match(product, /NINETEENTH_STORAGE_KEY = "swift-ghost-state-v19"/);
  assert.match(product, /EIGHTEENTH_STORAGE_KEY = "swift-ghost-state-v18"/);
  assert.match(product, /SEVENTEENTH_STORAGE_KEY = "swift-ghost-state-v17"/);
  assert.match(product, /SIXTEENTH_STORAGE_KEY = "swift-ghost-state-v16"/);
  assert.match(product, /FIFTEENTH_STORAGE_KEY = "swift-ghost-state-v15"/);
  assert.match(product, /FOURTEENTH_STORAGE_KEY = "swift-ghost-state-v14"/);
  assert.match(product, /THIRTEENTH_STORAGE_KEY = "swift-ghost-state-v13"/);
  assert.match(product, /TWELFTH_STORAGE_KEY = "swift-ghost-state-v12"/);
  assert.match(product, /PREVIOUS_STORAGE_KEY = "swift-ghost-state-v11"/);
  assert.match(product, /FIRST_VERSION_STORAGE_KEY = "swift-ghost-state-v2"/);
  assert.match(product, /version: 28/);
  assert.match(product, /swift-ghost-state-v10/);
  assert.match(product, /swift-ghost-state-v9/);
  assert.match(product, /swift-ghost-state-v8/);
  assert.match(product, /swift-ghost-state-v7/);
  assert.match(product, /swift-ghost-state-v6/);
  assert.match(product, /swift-ghost-state-v5/);
  assert.match(product, /swift-ghost-state-v4/);
  assert.match(product, /swift-ghost-state-v3/);
  assert.match(product, /swift-ghost-state-v2/);
  assert.match(product, /readStoredJson\([\s\S]*SUPPORTED_STATE_VERSIONS/);
  assert.match(product, /localDayKey\(date\)}-catalog-v2/);
  assert.match(product, /replace\(\/\\r\\n\?\/g, "\\n"\)/);
  assert.match(product, /correctKeystrokes/);
  assert.match(product, /keyErrors: Record<string, number>/);
  assert.match(product, /keyErrors: normalizeKeyErrors\(rawDraft\.keyErrors\)/);
  assert.match(worker, /isCurrentDailyChallenge\(existing, CHALLENGE_ITEMS\)/);
  assert.match(worker, /UPDATE daily_challenges/);
  assert.match(product, /outcome: "completed" \| "abandoned"/);
  assert.match(product, /PracticeKind = "typing" \| "solving" \| "concept"/);
  assert.match(product, /learningEvents: LearningEvent\[\]/);
  assert.match(product, /normalizeLearningEvents/);
  assert.match(product, /attempt\.practiceKind === "typing"/);
  assert.match(product, /attempt\.practiceKind === "solving"/);
  assert.match(product, /resolveSessionCurrentIndex/);
  assert.match(page, /Stage is fixed for this session step/);
  assert.match(page, /disabled=\{Boolean\(props\.draft\.sessionId\)\}/);
  assert.match(
    product,
    /attempt\.verification\.passed === attempt\.verification\.total/,
  );
  assert.match(
    catalog,
    /`https:\/\/leetcode\.com\/problems\/\$\{problem\.slug\}\/`/,
  );
  assert.equal((catalog.match(/^    id:/gm) ?? []).length, 50);
  const fundamentals = await readFile(
    new URL("../app/data/fundamentals.ts", import.meta.url),
    "utf8",
  );
  const python = await readFile(
    new URL("../app/data/python-problems.ts", import.meta.url),
    "utf8",
  );
  assert.equal((fundamentals.match(/^    id: "ios:/gm) ?? []).length, 16);
  assert.equal(
    (
      fundamentals.match(
        /^    sourceUrl: "https:\/\/(?:developer\.apple\.com|docs\.swift\.org)/gm,
      ) ?? []
    ).length,
    16,
  );
  assert.equal(
    (fundamentals.match(/^    recallChecks: \[/gm) ?? []).length,
    16,
  );
  assert.equal((python.match(/^    id:/gm) ?? []).length, 36);
  assert.equal((python.match(/^    languageNote:/gm) ?? []).length, 36);
  assert.equal((python.match(/^    recallChecks: \[/gm) ?? []).length, 36);
  assert.match(page, /Python reactivation/);
  assert.match(page, /solution\.py/);
  assert.match(page, /Three learning lanes/);
  assert.match(page, /iOS reactivation/);
  assert.match(page, /Key friction/);
  assert.match(page, /Strict correction/);
  assert.match(page, /Spaced review/);
  assert.match(page, /Pattern mastery/);
  assert.match(page, /Personal bests/);
  assert.match(community, /Community beta/);
  assert.match(community, /itemRevision:/);
  assert.match(community, /stage: boardStage/);
  assert.match(community, /Exact item · revision · stage/);
  assert.match(community, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(page, /Fixed stage 1/);
  assert.match(page, /cloudClient\.dailyLeaderboard/);
  assert.match(page, /dailyAvailable/);
  assert.match(
    worker,
    /item\.track === "interview" && item\.difficulty !== "Hard"/,
  );
  assert.match(
    page,
    /!item\.transfer &&[\s\S]{0,120}item\.track === "interview" &&[\s\S]{0,80}item\.difficulty !== "Hard"/,
  );
  assert.match(
    product,
    /readStoredJson/,
  );
  assert.match(page, /<ChallengeConsole/);
  assert.match(page, /Write any passing Python solution/);
  const consoleUi = await readFile(
    new URL("../app/components/ChallengeConsole.tsx", import.meta.url),
    "utf8",
  );
  const structuredTests = await readFile(
    new URL("../app/components/StructuredCustomTestcases.tsx", import.meta.url),
    "utf8",
  );
  const submissionInspector = await readFile(
    new URL("../app/components/SubmissionInspector.tsx", import.meta.url),
    "utf8",
  );
  assert.match(consoleUi, /Run examples/);
  assert.match(consoleUi, /Submit solution/);
  assert.match(consoleUi, /Run custom testcase/);
  assert.match(consoleUi, /Submissions/);
  assert.match(consoleUi, /aria-label=\{/);
  assert.match(consoleUi, /Submissions, \$\{submissionHistory\.length\}/);
  assert.match(structuredTests, /Run selected/);
  assert.match(structuredTests, /Run all/);
  assert.match(structuredTests, /Raw JSON/);
  assert.match(submissionInspector, /Restore source/);
  assert.match(submissionInspector, /Older prompt/);
  assert.match(submissionInspector, /View details/);
  assert.match(page, /challengeVerificationForPurpose/);
  assert.match(page, /isRecordableChallengeResult/);
  assert.match(page, /purpose === "submit"/);
  assert.match(consoleUi, /Record verified solve/);
  assert.match(consoleUi, /expected:/);
  assert.match(page, /Skip to main content/);
  assert.match(page, /Planned independent solve/);
  assert.match(coach, /15, 30, 45/);
  assert.match(coach, /Every task says why it earned time/);
  assert.match(planner, /activityKind === "solve"/);
  assert.match(planner, /input\?\.learningEvents/);
  assert.match(planner, /deferredDueCount/);
  assert.match(debrief, /30-second debrief/);
  assert.match(debrief, /How did retrieval feel/);
  assert.match(debrief, /No meaningful friction/);
  assert.match(debrief, /role="radiogroup"/);
  assert.match(debrief, /role="radio"/);
  assert.match(debrief, /ArrowLeft/);
  assert.match(debrief, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(learningState, /upsertLearningEvent/);
  assert.match(learningState, /applyDebriefToReviewState/);
  assert.match(product, /applyDebriefToReviewState/);
  assert.match(readinessPanel, /Interview readiness evidence/);
  assert.match(readinessPanel, /Rates appear after 3 observations/);
  assert.match(readiness, /attempt\.practiceKind === "solving"/);
  assert.match(readiness, /attempt\.verification\?\.total/);
  assert.match(readiness, /Number\(item\.contentRevision/);
  assert.match(page, /<ReadinessAnalytics/);
  assert.match(page, /saveResultDebrief/);
  assert.match(page, /attempt\.practiceKind === "typing"/);
  assert.match(page, /Exact item/);
  assert.match(page, /Retry same/);
  assert.match(page, /data-modal-autofocus="true"/);
  assert.match(page, /autoFocus/);
  assert.match(page, /Full analysis/);
  assert.match(catalogLibrary, /Estimated time/);
  assert.match(catalogLibrary, /Saved views/);
  assert.match(catalogLibrary, /Live collections/);
  assert.match(catalogLibrary, /Rows per page/);
  assert.match(catalogLibrary, /Show filters/);
  assert.match(catalogLibrary, /aria-controls="catalog-facet-controls"/);
  assert.match(catalogLibrary, /Future search matches are not auto-added/);
  assert.match(catalogLibrary, /Update saved view/);
  assert.match(catalogLibrary, /Needs independent Python solve/);
  assert.doesNotMatch(catalogLibrary, /cold Python solve/i);
  assert.doesNotMatch(page, /function LibraryView/);
  assert.match(page, /mobile-practice-controls/);
  assert.match(page, /coercePracticeKind/);
  assert.match(page, /practiceEpoch/);
  assert.match(page, /setPracticeKind\("typing"\)/);
  assert.match(page, /LearningAnalytics/);
  assert.match(page, /onToggleUploads/);
  assert.match(page, /CustomChallengeDialog/);
  assert.match(page, /SessionsView/);
  assert.match(page, /updateCustomItem/);
  assert.match(page, /sessionNext/);
  assert.match(
    page,
    /restoredPracticeKind === "solving" \? 5 : restored\.lastStage/,
  );
  assert.match(page, /edit\.insertedCount > 0/);
  assert.match(layout, /"og-v7\.png"/);
});

test("ships reload-safe timed mock interviews", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  const mock = await readFile(
    new URL("../app/lib/mock-interview.mjs", import.meta.url),
    "utf8",
  );
  assert.match(product, /kind: "practice" \| "mock"/);
  assert.match(product, /outcome\?: "completed" \| "ended" \| "expired"/);
  assert.match(product, /durationMinutes\?: number/);
  assert.match(product, /expiresAt\?: string/);
  assert.match(mock, /MOCK_INTERVIEW_PRESETS/);
  assert.match(mock, /selectMockInterviewItems/);
  assert.match(mock, /mockInterviewRemainingMs/);
  assert.match(app, /Prefer the old format\? Keep the one- or two-problem clock\./);
  assert.match(app, /Two-problem mocks keep the same absolute deadline/);
  assert.match(app, /<MockNotebook/);
  assert.match(app, /<MockDebriefDialog/);
  const mockDebrief = await readFile(
    new URL("../app/components/MockDebriefDialog.tsx", import.meta.url),
    "utf8",
  );
  assert.match(mockDebrief, /Final source snapshot/);
  assert.match(app, /Interview mode locked/);
  assert.match(app, /<ChallengeStatement item=\{props\.item\}/);
  assert.match(app, /prompt && !isLocked/);
  const consoleUi = await readFile(
    new URL("../app/components/ChallengeConsole.tsx", import.meta.url),
    "utf8",
  );
  assert.match(consoleUi, /Unshown judge details stay out of the interface/);
  assert.match(app, /role="timer"/);
});

test("ships first-class Swift and iOS concept recall", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  const concept = await readFile(
    new URL("../app/components/ConceptPractice.tsx", import.meta.url),
    "utf8",
  );
  const fundamentals = await readFile(
    new URL("../app/data/fundamentals.ts", import.meta.url),
    "utf8",
  );
  assert.match(product, /PracticeKind = "typing" \| "solving" \| "concept"/);
  assert.match(product, /conceptCommittedResponse/);
  assert.match(app, /finishConcept/);
  assert.match(app, /practiceKind: "concept"/);
  assert.match(app, /saveStateForScope/);
  assert.match(app, /portable v28 backup envelope/);
  assert.match(app, /supported v2-v28 backups/);
  assert.match(app, /notes, settings/);
  assert.match(concept, /Commit & compare answer/);
  assert.match(concept, /Optional guided typing/);
  assert.match(concept, /Self-rated recall · not automated correctness/);
  assert.equal((fundamentals.match(/conceptAnswers:/g) ?? []).length, 17);
});

test("ships resumable assessment navigation without changing refresher mode", async () => {
  const center = await readFile(
    new URL("../app/components/AssessmentCenter.tsx", import.meta.url),
    "utf8",
  );
  assert.match(center, /selectedRun \?\? \(selectedAssessment \? null : activeRun\)/);
  assert.match(center, /detailRun\.status === "paused"/);
  assert.match(center, /onResume\(detailRun\.id\)/);
  assert.match(center, /currentResult\.status === "refreshed"/);
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  assert.match(app, /!attempt\.assessmentRunId/);
  assert.match(app, /\{!isLocked && \(/);
  assert.match(app, /modules,/);
});

test("keeps sealed transfer variants out of generic sessions and labels revealed reconstruction honestly", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const sessions = await readFile(
    new URL("../app/lib/sessions.mjs", import.meta.url),
    "utf8",
  );
  assert.match(sessions, /if \(item\.transfer\) return false/);
  assert.match(app, /candidate\.transfer/);
  assert.match(app, /recordTransferDebriefReveal/);
  assert.match(app, /Reconstruct this revealed variant/);
  assert.match(app, /this revealed retry is recorded as assisted/);
  assert.match(app, /className="transfer-workbench-back"/);
  assert.match(app, /← Back to Transfer Lab/);
});
