import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PATTERN_DECISION_PROBES } from "../app/data/pattern-decision-probes.ts";
import { PATTERN_LESSONS } from "../app/data/pattern-lessons.ts";

test("the core pattern bank covers all twelve families with two current prompts each", () => {
  assert.equal(PATTERN_DECISION_PROBES.length, 24);
  assert.equal(new Set(PATTERN_DECISION_PROBES.map((probe) => probe.id)).size, 24);
  assert.equal(new Set(PATTERN_DECISION_PROBES.map((probe) => probe.clusterId)).size, 4);

  for (const lesson of PATTERN_LESSONS) {
    const lessonProbes = PATTERN_DECISION_PROBES.filter(
      (probe) => probe.lessonId === lesson.id,
    );
    assert.equal(lessonProbes.length, 2, lesson.title);
    assert.ok(lessonProbes.every((probe) => probe.expectedComplexity.trim()));
    assert.ok(lessonProbes.every((probe) => probe.solveItemId));
  }
});

test("skill-check UI requires complexity, labels confirmation, and renders an evidence map", async () => {
  const [review, app, academy, assessment, css] = await Promise.all([
    readFile(new URL("../app/components/PatternDecisionReview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PatternAcademy.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssessmentCenter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /startPatternDecisionSprint[\s\S]*count: 4/);
  assert.match(review, /Core Pattern Skill Check/);
  assert.match(review, /Expected time and space complexity/);
  assert.match(review, /complexity\.trim\(\)/);
  assert.match(review, /confirmationForAttemptId/);
  assert.match(review, /cannot recursively add another confirmation/);
  assert.match(review, /Twelve-family evidence map/);
  assert.match(review, /state\.status/);
  assert.match(review, /expectedComplexity/);
  assert.match(review, /not a solve, transfer result, score/);
  assert.match(academy, /24-prompt bank · all 12 families/);
  assert.match(assessment, /Core Pattern Skill Check/);
  assert.match(css, /\.decision-evidence-grid/);
  assert.match(css, /\.decision-evidence-status\.is-needs-contrast/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.decision-evidence-grid/);
});
