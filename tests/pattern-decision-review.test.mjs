import assert from "node:assert/strict";
import test from "node:test";
import { PATTERN_DECISION_PROBES } from "../app/data/pattern-decision-probes.ts";
import { PATTERN_LESSONS } from "../app/data/pattern-lessons.ts";
import {
  commitPatternDecision,
  commitPatternResponse,
  createPatternLearningWorkspace,
  derivePatternDecisionOverview,
  derivePatternDecisionState,
  gradePatternDecision,
  normalizePatternLearningWorkspace,
  revealPatternDecision,
  selectPatternDecisionProbes,
  startPatternDecisionSprint,
} from "../app/lib/pattern-learning.mjs";

const clusterLessons = PATTERN_LESSONS.slice(0, 3);
const startAt = "2026-07-29T12:00:00.000Z";

function start(workspace, id, now = startAt) {
  return startPatternDecisionSprint(
    workspace,
    clusterLessons,
    PATTERN_DECISION_PROBES,
    { id, now, count: 3, source: "academy" },
  );
}

function current(workspace) {
  const entry = workspace.activeSprint.entries[workspace.activeSprint.cursor];
  const probe = PATTERN_DECISION_PROBES.find(
    (candidate) =>
      candidate.id === entry.probeId &&
      candidate.revision === entry.probeRevision,
  );
  const lesson = clusterLessons.find((candidate) => candidate.id === probe.lessonId);
  return { probe, lesson };
}

function commitCurrent(workspace, attemptId, now, overrides = {}) {
  const { probe, lesson } = current(workspace);
  return commitPatternDecision(
    workspace,
    probe,
    lesson,
    {
      selectedLessonId: lesson.id,
      cue: "The prompt exposes a monotonic or remembered-state decision.",
      invariant: "The maintained state describes exactly the processed region.",
      whyNot: "The nearby pattern cannot use the decisive constraint.",
      complexity: "O(n) time and O(n) auxiliary space for the maintained state.",
      assisted: false,
      ...overrides,
    },
    { id: attemptId, now, probes: PATTERN_DECISION_PROBES },
  );
}

function completeCurrent(workspace, attemptId, now, grade = "good") {
  const revealed = revealPatternDecision(workspace, attemptId, {
    now,
    probes: PATTERN_DECISION_PROBES,
  });
  return gradePatternDecision(revealed, attemptId, grade, {
    now,
    lessons: clusterLessons,
    probes: PATTERN_DECISION_PROBES,
  });
}

test("Pattern Learning v1 migrates to v3 without losing retrieval checks", () => {
  const lesson = PATTERN_LESSONS[0];
  const check = lesson.checks[0];
  const v1 = commitPatternResponse(
    { version: 1, revision: 0, updatedAt: startAt, reviews: [] },
    lesson,
    check.id,
    "the table contains the processed prefix",
    { now: startAt },
  );
  const normalized = normalizePatternLearningWorkspace(
    { ...v1, version: 1 },
    { lessons: PATTERN_LESSONS, probes: PATTERN_DECISION_PROBES, now: startAt },
  );
  assert.equal(normalized.version, 3);
  assert.equal(normalized.reviews.length, 1);
  assert.deepEqual(normalized.decisionAttempts, []);
});

test("a mixed sprint freezes one current prompt per confusable pattern", () => {
  const workspace = start(createPatternLearningWorkspace(startAt), "sprint-one");
  assert.equal(workspace.activeSprint.status, "active");
  assert.equal(workspace.activeSprint.entries.length, 3);
  assert.equal(new Set(workspace.activeSprint.entries.map((entry) => entry.probeId)).size, 3);
  const selectedLessons = workspace.activeSprint.entries.map((entry) =>
    PATTERN_DECISION_PROBES.find((probe) => probe.id === entry.probeId).lessonId,
  );
  assert.deepEqual(new Set(selectedLessons), new Set(clusterLessons.map((lesson) => lesson.id)));
  const normalized = normalizePatternLearningWorkspace(workspace, {
    lessons: PATTERN_LESSONS,
    probes: PATTERN_DECISION_PROBES,
    now: startAt,
  });
  assert.deepEqual(normalized.activeSprint.entries, workspace.activeSprint.entries);
  assert.equal(normalized.activeSprint.cursor, 0);
});

test("probe rotation never repeats the immediately previous prompt when a sibling exists", () => {
  const lesson = clusterLessons[0];
  const probes = PATTERN_DECISION_PROBES.filter(
    (probe) => probe.lessonId === lesson.id,
  );
  const attempts = [
    probes[0],
    probes[0],
    probes[0],
    probes[1],
  ].map((probe, index) => ({
    id: `history-${index}`,
    lessonId: lesson.id,
    lessonRevision: lesson.revision,
    probeId: probe.id,
    probeRevision: probe.revision,
    committedAt: new Date(Date.parse(startAt) + index * 1_000).toISOString(),
  }));
  const selected = selectPatternDecisionProbes(
    [lesson],
    probes,
    { ...createPatternLearningWorkspace(startAt), decisionAttempts: attempts },
    { now: startAt, count: 1 },
  );
  assert.equal(selected[0].id, probes[0].id);
  assert.notEqual(selected[0].id, attempts.at(-1).probeId);
});

test("decision fields must be committed before reveal and self-grade", () => {
  const sprint = start(createPatternLearningWorkspace(startAt), "sprint-gated");
  const { probe, lesson } = current(sprint);
  const incomplete = commitPatternDecision(
    sprint,
    probe,
    lesson,
    { selectedLessonId: lesson.id, cue: "", invariant: "x", whyNot: "y" },
    { id: "attempt-incomplete", now: startAt, probes: PATTERN_DECISION_PROBES },
  );
  assert.equal(incomplete, sprint);
  assert.equal(
    revealPatternDecision(sprint, "missing", {
      now: startAt,
      probes: PATTERN_DECISION_PROBES,
    }),
    sprint,
  );
  assert.equal(
    gradePatternDecision(sprint, "missing", "good", {
      now: startAt,
      lessons: clusterLessons,
      probes: PATTERN_DECISION_PROBES,
    }),
    sprint,
  );
  const committed = commitCurrent(sprint, "attempt-gated", startAt);
  assert.equal(committed.decisionAttempts.length, 1);
  assert.equal(committed.decisionAttempts[0].revealedAt, undefined);
  const revealed = revealPatternDecision(committed, "attempt-gated", {
    now: startAt,
    probes: PATTERN_DECISION_PROBES,
  });
  assert.equal(revealed.decisionAttempts[0].match, true);
  assert.equal(revealed.decisionAttempts[0].grade, undefined);
});

test("a due unassisted match advances 1 then 3 days and rotates prompts", () => {
  let workspace = start(createPatternLearningWorkspace(startAt), "sprint-day-zero");
  const first = current(workspace);
  workspace = commitCurrent(workspace, "attempt-day-zero", startAt);
  workspace = completeCurrent(workspace, "attempt-day-zero", startAt, "good");
  const firstAttempt = workspace.decisionAttempts.at(-1);
  assert.equal(firstAttempt.wasDue, true);
  assert.equal(firstAttempt.levelAfter, 1);
  assert.equal(firstAttempt.dueAt, "2026-07-30T12:00:00.000Z");

  while (workspace.activeSprint.status === "active") {
    const id = `finish-${workspace.activeSprint.cursor}`;
    workspace = commitCurrent(workspace, id, startAt, { assisted: true });
    workspace = completeCurrent(workspace, id, startAt, "hard");
  }

  workspace = start(workspace, "sprint-day-one", "2026-07-30T12:00:00.000Z");
  const dueEntryIndex = workspace.activeSprint.entries.findIndex((entry) =>
    PATTERN_DECISION_PROBES.find((probe) => probe.id === entry.probeId).lessonId === first.lesson.id,
  );
  workspace = {
    ...workspace,
    activeSprint: { ...workspace.activeSprint, cursor: dueEntryIndex },
  };
  const second = current(workspace);
  assert.notEqual(second.probe.id, first.probe.id);
  workspace = commitCurrent(
    workspace,
    "attempt-day-one",
    "2026-07-30T12:00:00.000Z",
  );
  workspace = completeCurrent(
    workspace,
    "attempt-day-one",
    "2026-07-30T12:00:00.000Z",
    "easy",
  );
  const secondAttempt = workspace.decisionAttempts.at(-1);
  assert.equal(secondAttempt.levelAfter, 2);
  assert.equal(secondAttempt.dueAt, "2026-08-02T12:00:00.000Z");
  const state = derivePatternDecisionState(
    first.lesson,
    workspace,
    PATTERN_DECISION_PROBES,
    { now: "2026-07-30T12:00:00.000Z" },
  );
  assert.equal(state.retained, true);
  assert.equal(state.retainedProbeCount, 2);
});

test("early strong review does not advance or postpone the existing schedule", () => {
  let workspace = start(createPatternLearningWorkspace(startAt), "sprint-initial");
  const target = current(workspace);
  workspace = commitCurrent(workspace, "attempt-initial", startAt);
  workspace = completeCurrent(workspace, "attempt-initial", startAt);
  while (workspace.activeSprint.status === "active") {
    const id = `early-finish-${workspace.activeSprint.cursor}`;
    workspace = commitCurrent(workspace, id, startAt, { assisted: true });
    workspace = completeCurrent(workspace, id, startAt, "hard");
  }
  workspace = start(workspace, "sprint-early", "2026-07-29T18:00:00.000Z");
  const index = workspace.activeSprint.entries.findIndex((entry) =>
    PATTERN_DECISION_PROBES.find((probe) => probe.id === entry.probeId).lessonId === target.lesson.id,
  );
  workspace = { ...workspace, activeSprint: { ...workspace.activeSprint, cursor: index } };
  workspace = commitCurrent(workspace, "attempt-early", "2026-07-29T18:00:00.000Z");
  workspace = completeCurrent(workspace, "attempt-early", "2026-07-29T18:00:00.000Z");
  const attempt = workspace.decisionAttempts.at(-1);
  assert.equal(attempt.wasDue, false);
  assert.equal(attempt.levelAfter, 1);
  assert.equal(attempt.dueAt, "2026-07-30T12:00:00.000Z");
});

test("a miss or assisted recall schedules tomorrow without fabricating retention", () => {
  let workspace = start(createPatternLearningWorkspace(startAt), "sprint-miss");
  const { probe, lesson } = current(workspace);
  const wrong = probe.candidateLessonIds.find((id) => id !== lesson.id);
  workspace = commitCurrent(workspace, "attempt-miss", startAt, {
    selectedLessonId: wrong,
  });
  workspace = completeCurrent(workspace, "attempt-miss", startAt, "easy");
  const missed = workspace.decisionAttempts.at(-1);
  assert.equal(missed.match, false);
  assert.equal(missed.levelAfter, 0);
  assert.equal(missed.lapseCount, 1);
  assert.equal(missed.dueAt, "2026-07-30T12:00:00.000Z");
  const overview = derivePatternDecisionOverview(
    clusterLessons,
    PATTERN_DECISION_PROBES,
    workspace,
    { now: startAt },
  );
  assert.equal(overview.retainedCount, 0);
});

test("normalization drops stale probe revisions and bounds decision history", () => {
  const probe = PATTERN_DECISION_PROBES[0];
  const lesson = clusterLessons.find((candidate) => candidate.id === probe.lessonId);
  const attempts = Array.from({ length: 220 }, (_, index) => ({
    id: `attempt-${index}`,
    sprintId: "sprint-normalize",
    source: "academy",
    probeId: probe.id,
    probeRevision: index === 0 ? probe.revision + 1 : probe.revision,
    lessonId: lesson.id,
    lessonRevision: lesson.revision,
    selectedLessonId: lesson.id,
    cue: "cue",
    invariant: "invariant",
    whyNot: "why not",
    assisted: false,
    wasDue: true,
    committedAt: new Date(Date.parse(startAt) + index * 1_000).toISOString(),
    updatedAt: new Date(Date.parse(startAt) + index * 1_000).toISOString(),
  }));
  const normalized = normalizePatternLearningWorkspace(
    {
      version: 2,
      revision: 1,
      updatedAt: startAt,
      reviews: [],
      decisionAttempts: attempts,
    },
    { lessons: PATTERN_LESSONS, probes: PATTERN_DECISION_PROBES, now: startAt },
  );
  assert.equal(normalized.decisionAttempts.length, 180);
  assert.equal(normalized.decisionAttempts.some((attempt) => attempt.id === "attempt-0"), false);
  assert.deepEqual(
    normalizePatternLearningWorkspace(normalized, {
      lessons: PATTERN_LESSONS,
      probes: PATTERN_DECISION_PROBES,
      now: startAt,
    }),
    normalized,
  );
});

test("normalization retires an unusable sprint as a unit so recovery can start fresh", () => {
  const workspace = start(
    createPatternLearningWorkspace(startAt),
    "sprint-retired-content",
  );
  const { lesson } = current(workspace);
  const currentLessons = PATTERN_LESSONS.filter(
    (candidate) => candidate.id !== lesson.id,
  );
  const normalized = normalizePatternLearningWorkspace(workspace, {
    lessons: currentLessons,
    probes: PATTERN_DECISION_PROBES,
    now: startAt,
  });
  assert.equal(normalized.activeSprint, undefined);

  const restarted = startPatternDecisionSprint(
    normalized,
    currentLessons,
    PATTERN_DECISION_PROBES,
    {
      id: "sprint-current-content",
      now: startAt,
      count: 3,
      source: "academy",
    },
  );
  assert.equal(restarted.activeSprint.id, "sprint-current-content");
  assert.ok(restarted.activeSprint.entries.length > 0);
});
