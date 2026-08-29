import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [component, curriculum, studyPlans, appShell] = await Promise.all([
  readFile(new URL("../app/components/IOSReactivationTrack.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/data/ios-curriculum.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/components/StudyPlans.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8"),
]);

test("Swift and iOS track is a finite, evidence-aware standalone surface", () => {
  assert.match(curriculum, /IOS_REACTIVATION_PHASES/);
  assert.match(curriculum, /swift-foundations/);
  assert.match(curriculum, /ownership-concurrency/);
  assert.match(curriculum, /production-quality/);
  assert.match(curriculum, /ios:value-reference-snapshots/);
  assert.match(curriculum, /swift:swift-two-sum/);
  assert.match(component, /export type IOSReactivationTrackProps/);
  assert.match(component, /deriveIOSReactivationProgress/);
  assert.match(component, /onOpenItem/);
  assert.match(component, /not a composite readiness score/);
  assert.match(component, /Concept[\s\S]*answers remain self-assessed/);
  assert.match(component, /aria-labelledby="ios-reactivation-track-title"/);
  assert.match(component, /Open next exercise/);
});

test("Study Plans routes the track through the existing revision-aware item opener", () => {
  assert.match(studyPlans, /IOSReactivationTrack/);
  assert.match(studyPlans, /onOpenItem=\{\(itemId\)/);
  assert.match(studyPlans, /canSolveItem\(item\)/);
  assert.match(appShell, /onOpenItem=\{\(item, stage, practiceKind\)/);
  assert.match(appShell, /openItem\(item, stage, undefined, undefined, practiceKind\)/);
});
