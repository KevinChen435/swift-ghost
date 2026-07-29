import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("assessment center presents one frozen six-section form without exposing the full bank", async () => {
  const component = await source("app/components/AssessmentCenter.tsx");

  assert.match(component, /Full re-entry diagnostic/);
  assert.match(component, /CROSS_LANE_REENTRY_BLUEPRINT\.formSize/);
  assert.match(component, /Select and lock my form/);
  assert.match(component, /one from each section and saves the complete form/);
  assert.match(component, /least-seen current entries first/);
  assert.match(component, /reload-safe immutable form/);
  assert.match(component, /stale entries stay history-only/);
  assert.match(component, /never creates a readiness score/);
  assert.doesNotMatch(component, /candidateIds\.map/);
});

test("checkpoint handoff locks revision, response mode, stage, and evidence claim", async () => {
  const app = await source("app/components/SwiftGhostApp.tsx");
  const editor = await source("app/components/PracticeEditor.tsx");

  assert.match(app, /entry\.contentRevision === probe\.itemRevision/);
  assert.match(app, /candidate\.verification\?\.revision !== probe\.judgeRevision/);
  assert.match(app, /probe\.currentEvidenceEligible === false/);
  assert.match(app, /responseMode === "local-verified-solve"/);
  assert.match(app, /assessmentResponseMode === "swift-reconstruction"/);
  assert.match(app, /assessmentResponseMode === "concept-recall"/);
  assert.match(app, /This assessment checkpoint has a frozen response stage/);
  assert.match(app, /This assessment checkpoint has a frozen response mode/);
  assert.match(app, /props\.draft\.sessionId \|\| props\.draft\.assessmentRunId/);
  assert.match(app, /hideReveal=\{isAssessment\}/);
  assert.match(app, /refresher \? undefined : \{ runId, probeId: probe\.id \}/);
  assert.match(editor, /props\.practiceKind === "typing" && !props\.hideReveal/);
});

test("completed practice is enriched from the frozen entry before assessment recording", async () => {
  const app = await source("app/components/SwiftGhostApp.tsx");

  assert.match(app, /frozenAssessmentEntry/);
  assert.match(app, /responseMode: frozenAssessmentEntry\?\.responseMode/);
  assert.match(app, /frozenAssessmentEntry\?\.conceptCheckIndex/);
  assert.match(app, /stage: frozenAssessmentEntry\?\.stage \?\? attempt\.stage/);
  assert.match(app, /assessmentEntry\?\.conceptCheckIndex \?\?/);
});

test("form selection receives the learner's current practice evidence", async () => {
  const app = await source("app/components/SwiftGhostApp.tsx");

  assert.match(app, /evidence: current\.attempts/);
});

test("cross-lane reports keep Python, Swift, and iOS evidence separate", async () => {
  const component = await source("app/components/AssessmentCenter.tsx");

  assert.match(component, /Python · local judge/);
  assert.match(component, /Swift · reconstruction & recall/);
  assert.match(component, /self-assessed recalls/);
  assert.match(component, /iOS · self-assessed/);
  assert.match(component, /Exact authored reconstruction only; Swift is not compiled/);
  assert.match(component, /Commit before reveal, then self-grade/);
  assert.match(component, /device-local Python judge/);
});
