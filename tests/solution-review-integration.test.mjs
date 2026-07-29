import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

test("v24 state adds bounded reviews while preserving the v23 migration fallback", async () => {
  const product = await read("../app/lib/product.ts");
  assert.match(product, /version: 28;/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v28"/);
  assert.match(product, /TWENTY_SIXTH_STORAGE_KEY = "swift-ghost-state-v26"/);
  assert.match(product, /TWENTY_FIFTH_STORAGE_KEY = "swift-ghost-state-v25"/);
  assert.match(product, /TWENTY_FOURTH_STORAGE_KEY = "swift-ghost-state-v24"/);
  assert.match(product, /TWENTY_THIRD_STORAGE_KEY = "swift-ghost-state-v23"/);
  assert.match(product, /solutionReviews: SolutionReviewRecord\[\]/);
  assert.match(product, /solutionReviews: \[\]/);
  assert.match(
    product,
    /Number\(value\.version\) >= 24 \? value\.solutionReviews : undefined/,
  );
  assert.match(product, /normalizeSolutionReviews/);
});

test("accepted submit carries the exact durable receipt ID into its immutable attempt", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const product = await read("../app/lib/product.ts");
  assert.match(product, /submissionId\?: string;/);
  assert.match(app, /submissionRequest\?\.id/);
  assert.match(
    app,
    /active\.practiceKind === "solving" \? submissionId : undefined/,
  );
  assert.match(
    app,
    /finish\(liveDraft, \{[\s\S]*?submissions:[\s\S]*?\}, accepted\.id\);/,
  );
});

test("result, Records, and Work Log expose the reload-safe review workflow", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const workLog = await read("../app/components/SubmissionWorkLog.tsx");
  const workspace = await read("../app/components/SolutionReviewWorkspace.tsx");
  assert.match(app, /Review how this solution works/);
  assert.match(
    app,
    /!isConcept && !isSolve && \(\s+<PostAttemptDebrief/,
  );
  assert.match(app, /recordsSection: "reviews"/);
  assert.match(app, /Solution review library/);
  assert.match(workLog, /Review how this solution works/);
  assert.match(workspace, /Explain before you reveal/);
  assert.match(workspace, /Private on this device/);
  assert.match(workspace, /No AI or semantic grader/);
  assert.match(workspace, /Source snapshot unavailable/);
});

test("review completion and its LearningEvent are committed in one required local write", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const completionStart = app.indexOf("function completeSolutionReview");
  const completionEnd = app.indexOf("function closeSolutionReview", completionStart);
  const completion = app.slice(completionStart, completionEnd);
  assert.match(completion, /upsertLearningEvent/);
  assert.match(completion, /upsertSolutionReview/);
  assert.match(completion, /requirePersistence: true/);
  assert.match(completion, /reviewDueAt/);
  assert.match(completion, /activityKind: event\.activityKind/);
  assert.doesNotMatch(completion, /activityKindForMistake/);
});

test("timed review labels come only from finished mock or virtual-round evidence", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  assert.match(app, /function timedSolutionReviewAttemptIds/);
  assert.match(app, /session\.kind === "mock"/);
  assert.match(app, /virtualRoundWorkspace\.history/);
  assert.match(app, /timedAttemptIds: timedSolutionReviewAttemptIds\(current\)/);
  assert.doesNotMatch(app, /unlockContext: attempt\.sessionId/);
});

test("private review state is absent from cloud and worker payload contracts", async () => {
  const cloud = await read("../app/lib/cloud.mjs");
  const community = await read("../app/lib/community-core.mjs");
  const worker = await read("../worker/index.ts");
  assert.doesNotMatch(cloud, /solutionReviews/);
  assert.doesNotMatch(community, /solutionReviews/);
  assert.doesNotMatch(worker, /solutionReviews/);
});
