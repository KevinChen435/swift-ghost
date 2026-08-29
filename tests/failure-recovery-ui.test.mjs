import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, challenge, swift, closures] = await Promise.all([
  readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/components/ChallengeConsole.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/components/SwiftSolveConsole.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/lib/attempt-closures.mjs", import.meta.url), "utf8"),
]);

test("failed submissions retain an exact receipt id for repair routing", () => {
  assert.match(app, /submissionId\?: string;/);
  assert.match(app, /submissionStatus\?: SubmissionRecord\["status"\];/);
  assert.match(app, /submissionId: submissionRequest\?\.id/);
  assert.match(app, /submissionStatus,/);
  assert.match(app, /openAttemptClosureForSubmission\(submissionId: string\)/);
  assert.match(app, /record\.anchor\.kind === "submission"/);
  assert.match(app, /record\.anchor\.submissionId === submissionId/);
});

test("Python and Swift result panels expose repair plans only for learner failures", () => {
  assert.match(challenge, /onOpenAttemptClosure\?: \(submissionId: string\) => void/);
  assert.match(challenge, /Open repair plan →/);
  assert.match(challenge, /repairableSubmission/);
  assert.match(swift, /onOpenAttemptClosure\?: \(submissionId: string\) => void/);
  assert.match(swift, /submission\.verdict !== "judge-error"/);
  assert.match(swift, /submission\.clientSubmissionId/);
  assert.match(swift, /Open repair plan →/);
});

test("compile errors are closure anchors while judge errors remain infrastructure-only", () => {
  assert.match(closures, /"compile-error"/);
  assert.match(closures, /"judge-error"/);
  assert.match(swift, /submission\.verdict !== "judge-error"/);
});
