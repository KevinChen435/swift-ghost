import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("v23 state migrates v22 submissions into durable receipts and preserves every fallback", async () => {
  const product = await read("../app/lib/product.ts");
  assert.match(product, /version: 23/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v23"/);
  assert.match(product, /TWENTY_SECOND_STORAGE_KEY = "swift-ghost-state-v22"/);
  assert.match(
    product,
    /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+TWENTY_SECOND_STORAGE_KEY,\s+TWENTY_FIRST_STORAGE_KEY/,
  );
  assert.match(product, /submissionLog: SubmissionLog/);
  assert.match(product, /submissionAnnotations: SubmissionAnnotations/);
  assert.match(
    product,
    /Number\(value\.version\) <= 22 && Array\.isArray\(value\.submissionHistory\)/,
  );
  assert.match(product, /normalizeSubmissionLog/);
  assert.match(product, /recoverInterruptedSubmissions/);
  assert.match(product, /normalizeSubmissionAnnotations/);
});

test("ordinary and timed submissions persist pending receipts before invoking the judge", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const request = app.indexOf("if (submissionRequest) {");
  const persist = app.indexOf("props.onSubmissionRequested(submissionRequest)", request);
  const runner = app.indexOf(
    "const runner = pythonRunner.current ?? createPythonRunner();",
    request,
  );
  const verify = app.indexOf("const result = await runner.verify(", request);
  assert.ok(request >= 0 && persist > request);
  assert.ok(persist < runner && runner < verify);
  assert.match(app, /requestSubmissionReceipt\(current\.submissionLog, request\)/);
  assert.match(app, /const persisted = saveState\(next\)/);
  assert.match(app, /options\.requirePersistence && !persisted/);
  assert.equal(
    app.match(/\{ requirePersistence: true \}/g)?.length,
    2,
    "ordinary and virtual-round requests must both require durable storage",
  );
  assert.match(app, /activeSubmissionRequest\.current = submissionRequest/);
  assert.match(app, /interruptionReason: "local-judge-error"/);
});

test("the global Records inspector is read-only until an explicit assisted restore", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const workLog = await read("../app/components/SubmissionWorkLog.tsx");
  assert.match(app, /recordsSection: "submissions"/);
  assert.match(app, /<SubmissionWorkLog/);
  assert.match(app, /function continueFromSubmission/);
  assert.match(app, /peeks: 1/);
  assert.match(
    app,
    /freshDraft\(\s+itemToOpen\.itemId,\s+5,\s+itemToOpen\.contentRevision,\s+undefined,\s+undefined,\s+"solving",\s+source/,
  );
  assert.match(app, /Finish or archive the active virtual round/);
  assert.doesNotMatch(workLog, /onUseHint/);
  assert.match(workLog, /Continue from this source/);
  assert.match(workLog, /Open clean retry/);
  assert.match(workLog, /marks it assisted/);
});

test("work-log detail exposes honest local evidence, comparison, and private annotations", async () => {
  const workLog = await read("../app/components/SubmissionWorkLog.tsx");
  assert.match(workLog, /not peer rank, certification, or interview readiness/);
  assert.match(workLog, /Accepted/);
  assert.match(workLog, /Judge interrupted/);
  assert.match(workLog, /Compare attempts/);
  assert.match(workLog, /Source snapshot unavailable/);
  assert.match(workLog, /Private reflection/);
  assert.match(workLog, /aria-live="polite"/);
  assert.match(workLog, /role="tabpanel"/);
  assert.match(workLog, /ArrowLeft/);
  assert.match(workLog, /ArrowRight/);
});

test("local production does not probe leaderboard routes when capabilities disable them", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  assert.match(
    app,
    /capabilities\.data\.leaderboards\s+\? cloudClient\.dailyLeaderboard/,
  );
  assert.match(app, /: Promise\.resolve\(null\)/);
});
