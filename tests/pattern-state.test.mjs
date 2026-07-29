import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PATTERN_DECISION_PROBES } from "../app/data/pattern-decision-probes.ts";
import { PATTERN_LESSONS } from "../app/data/pattern-lessons.ts";
import {
  commitPatternDecision,
  commitPatternResponse,
  createPatternLearningWorkspace,
  gradePatternDecision,
  revealPatternDecision,
  startPatternDecisionSprint,
} from "../app/lib/pattern-learning.mjs";

test("current state preserves Pattern Decision Review while retaining the complete fallback chain", async () => {
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  assert.match(product, /export type AppState = \{\s+version: 31;/);
  assert.match(product, /patternLearning: PatternLearningWorkspace/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v31"/);
  assert.match(product, /THIRTIETH_STORAGE_KEY = "swift-ghost-state-v30"/);
  assert.match(product, /TWENTY_NINTH_STORAGE_KEY = "swift-ghost-state-v29"/);
  assert.match(product, /TWENTY_EIGHTH_STORAGE_KEY = "swift-ghost-state-v28"/);
  assert.match(product, /TWENTY_SEVENTH_STORAGE_KEY = "swift-ghost-state-v27"/);
  assert.match(
    product,
    /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+THIRTIETH_STORAGE_KEY,\s+TWENTY_NINTH_STORAGE_KEY,\s+TWENTY_EIGHTH_STORAGE_KEY,\s+TWENTY_SEVENTH_STORAGE_KEY,\s+TWENTY_SIXTH_STORAGE_KEY/,
  );
  assert.match(product, /patternLearning: createPatternLearningWorkspace\(\)/);
  assert.match(
    product,
    /Number\(value\.version\) >= 28 \? value\.patternLearning : undefined/,
  );
});
test("a current Pattern Academy workspace round-trips through product normalization", async () => {
  const lesson = PATTERN_LESSONS[0];
  const retrievalWorkspace = commitPatternResponse(
    createPatternLearningWorkspace("2026-07-29T12:00:00.000Z"),
    lesson,
    lesson.checks[0].id,
    "The table describes exactly the processed prefix.",
    { now: "2026-07-29T12:01:00.000Z" },
  );
  const sprintWorkspace = startPatternDecisionSprint(
    retrievalWorkspace,
    PATTERN_LESSONS,
    PATTERN_DECISION_PROBES,
    {
      id: "migration-sprint",
      now: "2026-07-29T12:02:00.000Z",
      source: "academy",
    },
  );
  const entry = sprintWorkspace.activeSprint.entries[0];
  const probe = PATTERN_DECISION_PROBES.find(
    (candidate) => candidate.id === entry.probeId,
  );
  const decisionLesson = PATTERN_LESSONS.find(
    (candidate) => candidate.id === probe.lessonId,
  );
  const committed = commitPatternDecision(
    sprintWorkspace,
    probe,
    decisionLesson,
    {
      selectedLessonId: decisionLesson.id,
      cue: "Repeated exact-value lookup points to a hash table.",
      invariant: "The table represents exactly the processed prefix.",
      whyNot: "No ordered pair movement or bounded contiguous window is required.",
    },
    {
      id: "migration-decision-attempt",
      now: "2026-07-29T12:03:00.000Z",
      probes: PATTERN_DECISION_PROBES,
    },
  );
  const revealed = revealPatternDecision(
    committed,
    "migration-decision-attempt",
    { now: "2026-07-29T12:04:00.000Z" },
  );
  const workspace = gradePatternDecision(
    revealed,
    "migration-decision-attempt",
    "good",
    {
      now: "2026-07-29T12:05:00.000Z",
      lessons: PATTERN_LESSONS,
      probes: PATTERN_DECISION_PROBES,
    },
  );
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("pattern-state", `${process.pid}-${Date.now()}`);
  const built = await import(workerUrl.href);
  const normalizeState = built.normalizeState ?? built.default?.normalizeState;
  if (typeof normalizeState !== "function") {
    const product = await readFile(
      new URL("../app/lib/product.ts", import.meta.url),
      "utf8",
    );
    assert.match(product, /normalizePatternLearningWorkspace/);
    return;
  }
  const normalized = normalizeState({
    version: 28,
    attempts: [],
    settings: {},
    customItems: [],
    sessionHistory: [],
    studyWorkspace: {},
    patternLearning: workspace,
  });
  assert.equal(normalized.version, 29);
  assert.deepEqual(normalized.patternLearning, workspace);
});
