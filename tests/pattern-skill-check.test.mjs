import assert from "node:assert/strict";
import test from "node:test";
import { PATTERN_DECISION_PROBES } from "../app/data/pattern-decision-probes.ts";
import { PATTERN_LESSONS } from "../app/data/pattern-lessons.ts";
import {
  PATTERN_DECISION_COMPLEXITY_LIMIT,
  commitPatternDecision,
  createPatternLearningWorkspace,
  derivePatternDecisionOverview,
  derivePatternDecisionState,
  gradePatternDecision,
  normalizePatternLearningWorkspace,
  revealPatternDecision,
  selectPatternDecisionProbes,
  startPatternDecisionSprint,
} from "../app/lib/pattern-learning.mjs";

const T0 = "2026-07-29T12:00:00.000Z";
const T1 = "2026-07-30T12:00:00.000Z";

function active(workspace, lessons = PATTERN_LESSONS, probes = PATTERN_DECISION_PROBES) {
  const entry = workspace.activeSprint.entries[workspace.activeSprint.cursor];
  const probe = probes.find(
    (candidate) =>
      candidate.id === entry.probeId && candidate.revision === entry.probeRevision,
  );
  const lesson = lessons.find((candidate) => candidate.id === probe.lessonId);
  return { entry, probe, lesson };
}

function commitActive(workspace, id, now, overrides = {}, lessons = PATTERN_LESSONS, probes = PATTERN_DECISION_PROBES) {
  const { probe, lesson } = active(workspace, lessons, probes);
  return commitPatternDecision(
    workspace,
    probe,
    lesson,
    {
      selectedLessonId: lesson.id,
      cue: "The decisive constraint exposes the structure that must be maintained.",
      invariant: "The maintained state describes exactly the processed search region.",
      whyNot: "The confusable alternative cannot exploit the decisive constraint safely.",
      complexity: "O(n) time and O(n) auxiliary space for the maintained state.",
      assisted: false,
      ...overrides,
    },
    { id, now, probes },
  );
}

function completeActive(workspace, id, now, grade = "good", lessons = PATTERN_LESSONS, probes = PATTERN_DECISION_PROBES) {
  return gradePatternDecision(
    revealPatternDecision(workspace, id, { now, probes }),
    id,
    grade,
    { now, lessons, probes },
  );
}

test("the concealed bank has two honest, distinct contexts for all twelve lessons", () => {
  assert.equal(PATTERN_DECISION_PROBES.length, 24);
  assert.equal(new Set(PATTERN_DECISION_PROBES.map((probe) => probe.id)).size, 24);
  assert.equal(new Set(PATTERN_DECISION_PROBES.map((probe) => probe.prompt)).size, 24);
  const byLesson = Map.groupBy(PATTERN_DECISION_PROBES, (probe) => probe.lessonId);
  assert.equal(byLesson.size, 12);
  assert.deepEqual([...byLesson.values()].map((entries) => entries.length).sort(), Array(12).fill(2));
  const byCluster = Map.groupBy(PATTERN_DECISION_PROBES, (probe) => probe.clusterId);
  assert.equal(byCluster.size, 4);
  assert.deepEqual([...byCluster.values()].map((entries) => entries.length).sort(), [6, 6, 6, 6]);
  for (const lesson of PATTERN_LESSONS) {
    const legalItems = new Set(Object.values(lesson.practice));
    const contexts = byLesson.get(lesson.id) ?? [];
    assert.equal(contexts.length, 2);
    for (const probe of contexts) {
      assert.equal(probe.revision, 1);
      assert.equal(probe.candidateLessonIds.length, 3);
      assert.ok(probe.candidateLessonIds.includes(probe.lessonId));
      assert.notEqual(probe.confusableLessonId, probe.lessonId);
      assert.ok(probe.candidateLessonIds.includes(probe.confusableLessonId));
      assert.ok(legalItems.has(probe.solveItemId), `${probe.id} has an honest solve handoff`);
      assert.ok(probe.authoredCue.length >= 60);
      assert.ok(probe.authoredInvariant.length >= 60);
      assert.ok(probe.whyConfusableLoses.length >= 60);
      assert.ok(probe.expectedComplexity.length >= 40);
      assert.equal(probe.authoredComplexity, probe.expectedComplexity);
    }
  }
});

test("default selection is deterministic, four-probe, due-first, and cluster-diverse", () => {
  const workspace = createPatternLearningWorkspace(T0);
  const first = selectPatternDecisionProbes(PATTERN_LESSONS, PATTERN_DECISION_PROBES, workspace, { now: T0 });
  const second = selectPatternDecisionProbes(PATTERN_LESSONS, PATTERN_DECISION_PROBES, workspace, { now: T0 });
  assert.deepEqual(second.map((probe) => probe.id), first.map((probe) => probe.id));
  assert.equal(first.length, 4);
  assert.equal(new Set(first.map((probe) => probe.lessonId)).size, 4);
  assert.equal(new Set(first.map((probe) => probe.clusterId)).size, 4);
  assert.equal(
    selectPatternDecisionProbes(PATTERN_LESSONS, PATTERN_DECISION_PROBES, workspace, { now: T0, count: 99 }).length,
    6,
  );
});

test("new decisions require bounded complexity while legacy v2 attempts remain readable", () => {
  const sprint = startPatternDecisionSprint(
    createPatternLearningWorkspace(T0),
    PATTERN_LESSONS,
    PATTERN_DECISION_PROBES,
    { id: "complexity-sprint", now: T0, count: 1 },
  );
  assert.equal(commitActive(sprint, "missing-complexity", T0, { complexity: "" }), sprint);
  const committed = commitActive(sprint, "bounded-complexity", T0, {
    complexity: "x".repeat(PATTERN_DECISION_COMPLEXITY_LIMIT + 100),
  });
  assert.equal(committed.decisionAttempts[0].complexity.length, PATTERN_DECISION_COMPLEXITY_LIMIT);

  const raw = { ...committed.decisionAttempts[0] };
  delete raw.complexity;
  const legacy = normalizePatternLearningWorkspace(
    {
      version: 2,
      revision: 1,
      updatedAt: T0,
      reviews: [],
      decisionAttempts: [raw],
    },
    { lessons: PATTERN_LESSONS, probes: PATTERN_DECISION_PROBES, now: T0 },
  );
  assert.equal(legacy.version, 3);
  assert.equal(legacy.decisionAttempts.length, 1);
  assert.equal(legacy.decisionAttempts[0].id, raw.id);
  assert.equal(legacy.decisionAttempts[0].complexity, undefined);
});

test("reveal fails closed for a stale sprint entry or missing current probe revision", () => {
  let workspace = startPatternDecisionSprint(
    createPatternLearningWorkspace(T0),
    PATTERN_LESSONS,
    PATTERN_DECISION_PROBES,
    { id: "stale-reveal-sprint", now: T0, count: 1 },
  );
  workspace = commitActive(workspace, "stale-reveal-attempt", T0);
  const staleEntry = {
    ...workspace,
    activeSprint: {
      ...workspace.activeSprint,
      entries: workspace.activeSprint.entries.map((entry, index) =>
        index === workspace.activeSprint.cursor
          ? { ...entry, probeRevision: entry.probeRevision + 1 }
          : entry,
      ),
    },
  };
  assert.equal(
    revealPatternDecision(staleEntry, "stale-reveal-attempt", {
      now: T0,
      probes: PATTERN_DECISION_PROBES,
    }),
    staleEntry,
  );
  assert.equal(
    revealPatternDecision(workspace, "stale-reveal-attempt", {
      now: T0,
      probes: PATTERN_DECISION_PROBES.map((probe) => ({
        ...probe,
        revision: probe.revision + 1,
      })),
    }),
    workspace,
  );
});

test("one wrong base choice appends exactly one current sibling confirmation", () => {
  let workspace = startPatternDecisionSprint(
    createPatternLearningWorkspace(T0),
    PATTERN_LESSONS,
    PATTERN_DECISION_PROBES,
    { id: "adaptive-sprint", now: T0 },
  );
  const originalLength = workspace.activeSprint.entries.length;
  const { probe, lesson } = active(workspace);
  const wrong = probe.candidateLessonIds.find((candidate) => candidate !== lesson.id);
  workspace = commitActive(workspace, "adaptive-miss", T0, { selectedLessonId: wrong });
  workspace = completeActive(workspace, "adaptive-miss", T0);
  assert.equal(workspace.activeSprint.entries.length, originalLength + 1);
  const confirmation = workspace.activeSprint.entries.at(-1);
  assert.equal(confirmation.confirmationForAttemptId, "adaptive-miss");
  const sibling = PATTERN_DECISION_PROBES.find((candidate) => candidate.id === confirmation.probeId);
  assert.equal(sibling.lessonId, lesson.id);
  assert.notEqual(sibling.id, probe.id);

  while (workspace.activeSprint.cursor < workspace.activeSprint.entries.length - 1) {
    const id = `adaptive-base-${workspace.activeSprint.cursor}`;
    workspace = commitActive(workspace, id, T0);
    workspace = completeActive(workspace, id, T0);
  }
  assert.ok(active(workspace).entry.confirmationForAttemptId);
  const beforeConfirmationGrade = workspace.activeSprint.entries.length;
  const confirmationLesson = active(workspace).lesson;
  const confirmationProbe = active(workspace).probe;
  const confirmationWrong = confirmationProbe.candidateLessonIds.find(
    (candidate) => candidate !== confirmationLesson.id,
  );
  workspace = commitActive(workspace, "adaptive-confirmation-miss", T0, {
    selectedLessonId: confirmationWrong,
  });
  assert.equal(
    workspace.decisionAttempts.at(-1).confirmationForAttemptId,
    "adaptive-miss",
  );
  workspace = completeActive(workspace, "adaptive-confirmation-miss", T0);
  assert.equal(workspace.activeSprint.entries.length, beforeConfirmationGrade);
  assert.equal(workspace.activeSprint.status, "completed");
});

test("a six-entry sprint never grows beyond its hard cap", () => {
  let workspace = startPatternDecisionSprint(
    createPatternLearningWorkspace(T0),
    PATTERN_LESSONS,
    PATTERN_DECISION_PROBES,
    { id: "capped-sprint", now: T0, count: 6 },
  );
  const { probe, lesson } = active(workspace);
  workspace = commitActive(workspace, "capped-miss", T0, {
    selectedLessonId: probe.candidateLessonIds.find((candidate) => candidate !== lesson.id),
  });
  workspace = completeActive(workspace, "capped-miss", T0);
  assert.equal(workspace.activeSprint.entries.length, 6);
});

test("normalization preserves a valid adaptive entry and retires malformed or stale sprints", () => {
  let workspace = startPatternDecisionSprint(
    createPatternLearningWorkspace(T0),
    PATTERN_LESSONS,
    PATTERN_DECISION_PROBES,
    { id: "reload-adaptive", now: T0 },
  );
  const { probe, lesson } = active(workspace);
  workspace = commitActive(workspace, "reload-miss", T0, {
    selectedLessonId: probe.candidateLessonIds.find((candidate) => candidate !== lesson.id),
  });
  workspace = completeActive(workspace, "reload-miss", T0);
  const normalized = normalizePatternLearningWorkspace(workspace, {
    lessons: PATTERN_LESSONS,
    probes: PATTERN_DECISION_PROBES,
    now: T0,
  });
  assert.equal(normalized.activeSprint.entries.at(-1).confirmationForAttemptId, "reload-miss");

  const malformed = structuredClone(workspace);
  malformed.activeSprint.entries.at(-1).confirmationForAttemptId = "unknown-attempt";
  assert.equal(
    normalizePatternLearningWorkspace(malformed, {
      lessons: PATTERN_LESSONS,
      probes: PATTERN_DECISION_PROBES,
      now: T0,
    }).activeSprint,
    undefined,
  );
  const stale = structuredClone(workspace);
  stale.activeSprint.entries[0].probeRevision += 1;
  assert.equal(
    normalizePatternLearningWorkspace(stale, {
      lessons: PATTERN_LESSONS,
      probes: PATTERN_DECISION_PROBES,
      now: T0,
    }).activeSprint,
    undefined,
  );
});

test("retention needs two distinct current probes separated by the due gate", () => {
  const lesson = PATTERN_LESSONS[0];
  const probes = PATTERN_DECISION_PROBES.filter((probe) => probe.lessonId === lesson.id);
  let sameDay = startPatternDecisionSprint(
    createPatternLearningWorkspace(T0),
    [lesson],
    probes,
    { id: "same-day-one", now: T0, count: 1 },
  );
  sameDay = completeActive(commitActive(sameDay, "same-day-a", T0, {}, [lesson], probes), "same-day-a", T0, "good", [lesson], probes);
  sameDay = startPatternDecisionSprint(sameDay, [lesson], probes, {
    id: "same-day-two",
    now: "2026-07-29T18:00:00.000Z",
    count: 1,
  });
  sameDay = completeActive(
    commitActive(sameDay, "same-day-b", "2026-07-29T18:00:00.000Z", {}, [lesson], probes),
    "same-day-b",
    "2026-07-29T18:00:00.000Z",
    "easy",
    [lesson],
    probes,
  );
  assert.equal(derivePatternDecisionState(lesson, sameDay, probes, { now: T1 }).retained, false);

  let delayed = startPatternDecisionSprint(createPatternLearningWorkspace(T0), [lesson], probes, {
    id: "delayed-one",
    now: T0,
    count: 1,
  });
  delayed = completeActive(commitActive(delayed, "delayed-a", T0, {}, [lesson], probes), "delayed-a", T0, "good", [lesson], probes);
  delayed = startPatternDecisionSprint(delayed, [lesson], probes, {
    id: "delayed-two",
    now: T1,
    count: 1,
  });
  delayed = completeActive(commitActive(delayed, "delayed-b", T1, {}, [lesson], probes), "delayed-b", T1, "easy", [lesson], probes);
  const retained = derivePatternDecisionState(lesson, delayed, probes, { now: T1 });
  assert.equal(retained.retained, true);
  assert.equal(retained.retainedProbeCount, 2);
  assert.equal(retained.status, "retained");
  const staleProbes = probes.map((probe) => ({ ...probe, revision: probe.revision + 1 }));
  assert.equal(
    derivePatternDecisionState(lesson, delayed, staleProbes, { now: T1 }).completedAttempts,
    0,
  );
});

test("the evidence map is categorical and never exposes a composite or mastery claim", () => {
  const overview = derivePatternDecisionOverview(
    PATTERN_LESSONS,
    PATTERN_DECISION_PROBES,
    createPatternLearningWorkspace(T0),
    { now: T0 },
  );
  assert.equal(overview.states.length, 12);
  assert.ok(overview.states.every((state) => state.status === "unobserved"));
  assert.deepEqual(
    new Set(overview.rows.map((row) => row.status)),
    new Set(["unobserved"]),
  );
  assert.doesNotMatch(JSON.stringify(overview), /composite|score|mastery|mastered/i);
});
