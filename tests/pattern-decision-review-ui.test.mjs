import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PATTERN_DECISION_PROBES } from "../app/data/pattern-decision-probes.ts";

test("ships a balanced twelve-family bank with revisioned solve handoffs", () => {
  assert.equal(PATTERN_DECISION_PROBES.length, 24);
  const byLesson = Map.groupBy(
    PATTERN_DECISION_PROBES,
    (probe) => probe.lessonId,
  );
  assert.deepEqual(
    [...byLesson.values()].map((entries) => entries.length).sort(),
    Array(12).fill(2),
  );
  assert.equal(new Set(PATTERN_DECISION_PROBES.map((probe) => probe.id)).size, 24);
  for (const probe of PATTERN_DECISION_PROBES) {
    assert.equal(probe.revision, 1);
    assert.equal(probe.candidateLessonIds.length, 3);
    assert.ok(probe.prompt.length >= 70);
    assert.ok(probe.authoredCue.length >= 60);
    assert.ok(probe.authoredInvariant.length >= 60);
    assert.ok(probe.whyConfusableLoses.length >= 60);
    assert.ok(probe.expectedComplexity.length >= 40);
    assert.match(probe.solveItemId, /^python:/);
  }
});

test("mixed review is routed, commit-before-reveal, and evidence-honest", async () => {
  const [app, component, academy, routes] = await Promise.all([
    readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PatternDecisionReview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PatternAcademy.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/routes.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(app, /patternReviewMode === "mixed"[\s\S]*<PatternDecisionReview/);
  assert.match(app, /startPatternDecisionSprint/);
  assert.match(routes, /LEARN_REVIEW_MODES = \["mixed", "tests", "reconstruct"\]/);
  assert.match(routes, /patternSprintId/);
  assert.match(academy, /Can you recognize the pattern before coding/);
  assert.match(component, /Commit before reveal/);
  assert.match(component, /Reveal authored comparison/);
  assert.match(component, /Self-grade decision reasoning/);
  assert.match(component, /This records pattern selection objectively/);
  assert.match(component, /not a solve, transfer result, score/);
  assert.match(component, /Continue to blank solve/);
  assert.doesNotMatch(component, /mastered|certified|server verified/i);
});

test("decision review includes accessible progress, mobile stacking, and forced colors", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/components/PatternDecisionReview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /role="progressbar"/);
  assert.match(component, /aria-valuemax=\{sprint\.entries\.length\}/);
  assert.match(component, /fieldset disabled=\{Boolean\(saved\)\}/);
  assert.match(component, /type="radio"/);
  assert.match(component, /aria-expanded=\{activeDraft\.hintShown\}/);
  assert.match(css, /\.decision-pattern-options/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.decision-grade-grid/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*\.decision-review-shell/);
});
