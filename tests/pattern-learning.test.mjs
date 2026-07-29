import assert from "node:assert/strict";
import test from "node:test";
import { PATTERN_LESSONS } from "../app/data/pattern-lessons.ts";
import {
  commitPatternResponse,
  countStrongPatternChecks,
  createPatternLearningWorkspace,
  derivePatternEvidence,
  gradePatternCheck,
  normalizePatternLearningWorkspace,
  revealPatternAnswer,
  selectNextPatternLesson,
} from "../app/lib/pattern-learning.mjs";

const lesson = PATTERN_LESSONS[0];
const check = lesson.checks[0];
const now = "2026-07-29T12:00:00.000Z";

function attempt(overrides = {}) {
  return {
    itemId: lesson.practice.coldItemId,
    itemRevision: 1,
    outcome: "completed",
    practiceKind: "solving",
    peeks: 0,
    qualification: "solved",
    verification: { passed: 5, total: 5 },
    ...overrides,
  };
}

test("retrieval answers must be committed before reveal and grade", () => {
  const empty = createPatternLearningWorkspace(now);
  assert.equal(revealPatternAnswer(empty, lesson, check.id, { now }), empty);
  assert.equal(gradePatternCheck(empty, lesson, check.id, "good", { now }), empty);

  const committed = commitPatternResponse(
    empty,
    lesson,
    check.id,
    "The table contains exactly the already processed prefix.",
    { now },
  );
  assert.equal(committed.revision, 1);
  assert.equal(committed.reviews[0].revealedAt, undefined);

  const revealed = revealPatternAnswer(committed, lesson, check.id, {
    now: "2026-07-29T12:01:00.000Z",
  });
  assert.equal(revealed.reviews[0].revealedAt, "2026-07-29T12:01:00.000Z");
  const graded = gradePatternCheck(revealed, lesson, check.id, "good", {
    now: "2026-07-29T12:02:00.000Z",
  });
  assert.equal(graded.reviews[0].grade, "good");
  assert.equal(empty.reviews.length, 0);
});

test("recommitting starts a fresh retrieval attempt without laundering the grade", () => {
  const first = commitPatternResponse(
    createPatternLearningWorkspace(now),
    lesson,
    check.id,
    "first explanation",
    { now },
  );
  const revealed = revealPatternAnswer(first, lesson, check.id, { now });
  const graded = gradePatternCheck(revealed, lesson, check.id, "easy", { now });
  const second = commitPatternResponse(
    graded,
    lesson,
    check.id,
    "second explanation",
    { now: "2026-07-30T12:00:00.000Z" },
  );
  assert.equal(second.reviews.length, 1);
  assert.equal(second.reviews[0].response, "second explanation");
  assert.equal(second.reviews[0].grade, undefined);
  assert.equal(second.reviews[0].revealedAt, undefined);
});

test("updating one lesson preserves retrieval work from other lessons", () => {
  const secondLesson = PATTERN_LESSONS[1];
  const secondCheck = secondLesson.checks[0];
  let workspace = commitPatternResponse(
    createPatternLearningWorkspace(now),
    lesson,
    check.id,
    "prefix invariant",
    { now },
  );
  workspace = commitPatternResponse(
    workspace,
    secondLesson,
    secondCheck.id,
    "move the pointer that cannot help",
    { now: "2026-07-29T12:01:00.000Z" },
  );
  workspace = revealPatternAnswer(workspace, lesson, check.id, {
    now: "2026-07-29T12:02:00.000Z",
  });
  assert.equal(workspace.reviews.length, 2);
  assert.equal(
    workspace.reviews.find((review) => review.lessonId === secondLesson.id)?.response,
    "move the pointer that cannot help",
  );
});

test("normalization is bounded, deterministic, and keeps only known lesson checks", () => {
  const reviews = Array.from({ length: 80 }, (_, index) => ({
    lessonId: index % 2 ? lesson.id : "pattern:unknown",
    lessonRevision: lesson.revision,
    checkId: check.id,
    response: `response ${index}`,
    committedAt: now,
    updatedAt: new Date(Date.parse(now) + index * 1000).toISOString(),
  }));
  const normalized = normalizePatternLearningWorkspace(
    { version: 1, revision: 9999999, updatedAt: now, reviews },
    { lessons: PATTERN_LESSONS, now },
  );
  assert.equal(normalized.revision, 1_000_000);
  assert.equal(normalized.reviews.length, 1);
  assert.equal(normalized.reviews[0].response, "response 79");
  assert.deepEqual(
    normalizePatternLearningWorkspace(normalized, { lessons: PATTERN_LESSONS, now }),
    normalized,
  );
});

test("stale lesson revisions cannot inflate current retrieval progress", () => {
  const stale = {
    version: 1,
    revision: 1,
    updatedAt: now,
    reviews: [
      {
        lessonId: lesson.id,
        lessonRevision: lesson.revision + 1,
        checkId: check.id,
        response: "old explanation",
        committedAt: now,
        revealedAt: now,
        grade: "easy",
        updatedAt: now,
      },
    ],
  };
  assert.equal(countStrongPatternChecks(PATTERN_LESSONS, stale), 0);
  assert.equal(
    normalizePatternLearningWorkspace(stale, {
      lessons: PATTERN_LESSONS,
      now,
    }).reviews.length,
    0,
  );
});

test("evidence distinguishes instruction, assisted work, local solve, and transfer", () => {
  const workspace = commitPatternResponse(
    createPatternLearningWorkspace(now),
    lesson,
    check.id,
    "prefix invariant",
    { now },
  );
  const assisted = attempt({
    itemId: lesson.practice.workedItemId,
    practiceKind: "typing",
    stage: 1,
    peeks: 1,
    qualification: "syntax",
    verification: undefined,
  });
  const wrong = attempt({ verification: { passed: 4, total: 5 } });
  let evidence = derivePatternEvidence(lesson, workspace, [assisted, wrong]);
  assert.equal(evidence.committedChecks, 1);
  assert.equal(evidence.worked, true);
  assert.equal(evidence.independent, false);
  evidence = derivePatternEvidence(lesson, workspace, [assisted, attempt()]);
  assert.equal(evidence.independent, true);
  assert.equal(evidence.transfer, false);
});

test("Academy evidence excludes attempts from a stale item revision", () => {
  const empty = createPatternLearningWorkspace(now);
  const stale = attempt({ itemRevision: 1 });
  const items = [
    { itemId: lesson.practice.coldItemId, contentRevision: 2 },
  ];
  assert.equal(
    derivePatternEvidence(lesson, empty, [stale], items).independent,
    false,
  );
  assert.equal(
    derivePatternEvidence(
      lesson,
      empty,
      [attempt({ itemRevision: 2 })],
      items,
    ).independent,
    true,
  );
});

test("solve attempts do not masquerade as worked or guided typing", () => {
  const empty = createPatternLearningWorkspace(now);
  const solve = attempt({ itemId: lesson.practice.guidedItemId });
  let evidence = derivePatternEvidence(lesson, empty, [solve]);
  assert.equal(evidence.guided, false);
  evidence = derivePatternEvidence(lesson, empty, [
    attempt({
      itemId: lesson.practice.guidedItemId,
      practiceKind: "typing",
      stage: 3,
      qualification: "syntax",
      verification: undefined,
    }),
  ]);
  assert.equal(evidence.guided, true);
});

test("next lesson selection follows authored activation order and current evidence", () => {
  const empty = createPatternLearningWorkspace(now);
  assert.equal(selectNextPatternLesson(PATTERN_LESSONS, empty)?.id, PATTERN_LESSONS[0].id);
  let workspace = empty;
  for (const currentCheck of lesson.checks) {
    workspace = commitPatternResponse(
      workspace,
      lesson,
      currentCheck.id,
      "a precise learner explanation",
      { now },
    );
    workspace = revealPatternAnswer(workspace, lesson, currentCheck.id, { now });
    workspace = gradePatternCheck(workspace, lesson, currentCheck.id, "good", { now });
  }
  assert.equal(selectNextPatternLesson(PATTERN_LESSONS, workspace)?.id, PATTERN_LESSONS[1].id);
});
