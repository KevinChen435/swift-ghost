export const PATTERN_LEARNING_VERSION = 1;
export const PATTERN_RESPONSE_LIMIT = 1_000;
export const PATTERN_REVIEW_LIMIT = 36;
export const PATTERN_GRADES = ["again", "hard", "good", "easy"];

const EPOCH = "1970-01-01T00:00:00.000Z";

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanIso(value, fallback = EPOCH) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : fallback;
}

function cleanText(value, limit = PATTERN_RESPONSE_LIMIT) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, limit).join("");
}

function lessonRegistry(lessons) {
  return new Map(
    (Array.isArray(lessons) ? lessons : []).map((lesson) => [
      lesson.id,
      {
        revision: lesson.revision,
        checkIds: new Set(lesson.checks.map((check) => check.id)),
      },
    ]),
  );
}

export function createPatternLearningWorkspace(now = EPOCH) {
  return {
    version: PATTERN_LEARNING_VERSION,
    revision: 0,
    updatedAt: cleanIso(now),
    reviews: [],
  };
}

export function normalizePatternLearningWorkspace(value, options = {}) {
  const lessons = lessonRegistry(options.lessons);
  if (!isRecord(value) || value.version !== PATTERN_LEARNING_VERSION)
    return createPatternLearningWorkspace(options.now);
  const deduped = new Map();
  for (const raw of Array.isArray(value.reviews) ? value.reviews : []) {
    if (!isRecord(raw)) continue;
    const lesson = lessons.get(raw.lessonId);
    if (!lesson || typeof raw.checkId !== "string") continue;
    const lessonRevision = Number(raw.lessonRevision);
    if (
      !Number.isInteger(lessonRevision) ||
      lessonRevision !== lesson.revision ||
      !lesson.checkIds.has(raw.checkId)
    )
      continue;
    const response = cleanText(raw.response);
    if (!response) continue;
    const committedAt = cleanIso(raw.committedAt);
    const updatedAt = cleanIso(raw.updatedAt, committedAt);
    const revealedAt = raw.revealedAt
      ? cleanIso(raw.revealedAt, updatedAt)
      : undefined;
    const grade =
      revealedAt && PATTERN_GRADES.includes(raw.grade) ? raw.grade : undefined;
    const review = {
      lessonId: raw.lessonId,
      lessonRevision,
      checkId: raw.checkId,
      response,
      committedAt,
      ...(revealedAt ? { revealedAt } : {}),
      ...(grade ? { grade } : {}),
      updatedAt,
    };
    const key = `${review.lessonId}:${review.lessonRevision}:${review.checkId}`;
    const prior = deduped.get(key);
    if (!prior || prior.updatedAt <= review.updatedAt) deduped.set(key, review);
  }
  const reviews = [...deduped.values()]
    .sort((a, b) =>
      a.updatedAt.localeCompare(b.updatedAt) ||
      a.lessonId.localeCompare(b.lessonId) ||
      a.checkId.localeCompare(b.checkId),
    )
    .slice(-PATTERN_REVIEW_LIMIT);
  return {
    version: PATTERN_LEARNING_VERSION,
    revision: Math.max(0, Math.min(1_000_000, Math.round(Number(value.revision) || 0))),
    updatedAt: cleanIso(value.updatedAt, options.now),
    reviews,
  };
}

function mutateReview(workspace, lesson, checkId, now, update) {
  const normalized =
    isRecord(workspace) && workspace.version === PATTERN_LEARNING_VERSION
      ? {
          version: PATTERN_LEARNING_VERSION,
          revision: Math.max(
            0,
            Math.min(1_000_000, Math.round(Number(workspace.revision) || 0)),
          ),
          updatedAt: cleanIso(workspace.updatedAt, now),
          reviews: (Array.isArray(workspace.reviews) ? workspace.reviews : [])
            .filter(isRecord)
            .slice(-PATTERN_REVIEW_LIMIT),
        }
      : createPatternLearningWorkspace(now);
  const check = lesson?.checks?.find((candidate) => candidate.id === checkId);
  if (!check) return workspace;
  const key = `${lesson.id}:${lesson.revision}:${checkId}`;
  const reviews = normalized.reviews.filter(
    (review) =>
      `${review.lessonId}:${review.lessonRevision}:${review.checkId}` !== key,
  );
  const existing = normalized.reviews.find(
    (review) =>
      review.lessonId === lesson.id &&
      review.lessonRevision === lesson.revision &&
      review.checkId === checkId,
  );
  const next = update(existing, cleanIso(now));
  if (!next) return workspace;
  return {
    ...normalized,
    revision: normalized.revision + 1,
    updatedAt: cleanIso(now),
    reviews: [...reviews, next].slice(-PATTERN_REVIEW_LIMIT),
  };
}

export function commitPatternResponse(workspace, lesson, checkId, response, options = {}) {
  const cleaned = cleanText(response);
  if (!cleaned) return workspace;
  return mutateReview(workspace, lesson, checkId, options.now, (_existing, now) => ({
    lessonId: lesson.id,
    lessonRevision: lesson.revision,
    checkId,
    response: cleaned,
    committedAt: now,
    updatedAt: now,
  }));
}

export function revealPatternAnswer(workspace, lesson, checkId, options = {}) {
  return mutateReview(workspace, lesson, checkId, options.now, (existing, now) =>
    existing
      ? { ...existing, revealedAt: existing.revealedAt ?? now, updatedAt: now }
      : null,
  );
}

export function gradePatternCheck(workspace, lesson, checkId, grade, options = {}) {
  if (!PATTERN_GRADES.includes(grade)) return workspace;
  return mutateReview(workspace, lesson, checkId, options.now, (existing, now) =>
    existing?.revealedAt
      ? { ...existing, grade, updatedAt: now }
      : null,
  );
}

function completedAttempt(attempt) {
  return attempt?.outcome === "completed";
}

function verifiedIndependent(attempt) {
  return Boolean(
    completedAttempt(attempt) &&
      attempt.practiceKind === "solving" &&
      attempt.peeks === 0 &&
      attempt.verification?.total > 0 &&
      attempt.verification.passed === attempt.verification.total &&
      (attempt.qualification === "solved" || attempt.qualification === "independent"),
  );
}

export function derivePatternEvidence(
  lesson,
  workspace,
  attempts = [],
  items = [],
) {
  const currentReviews = (workspace?.reviews ?? []).filter(
    (review) =>
      review.lessonId === lesson.id &&
      review.lessonRevision === lesson.revision,
  );
  const currentRevisions = new Map(
    (Array.isArray(items) ? items : []).map((item) => [
      item.itemId,
      item.contentRevision,
    ]),
  );
  const enforceCurrentRevision = currentRevisions.size > 0;
  const lessonAttempts = (Array.isArray(attempts) ? attempts : []).filter(
    (attempt) => {
      const belongsToLesson = [
        lesson.practice.workedItemId,
        lesson.practice.guidedItemId,
        lesson.practice.coldItemId,
        lesson.practice.transferItemId,
      ].includes(attempt.itemId);
      return (
        belongsToLesson &&
        (!enforceCurrentRevision ||
          currentRevisions.get(attempt.itemId) === attempt.itemRevision)
      );
    },
  );
  const worked = lessonAttempts.some(
    (attempt) =>
      attempt.itemId === lesson.practice.workedItemId &&
      attempt.practiceKind === "typing" &&
      attempt.stage === 1 &&
      completedAttempt(attempt),
  );
  const guided = lessonAttempts.some(
    (attempt) =>
      attempt.itemId === lesson.practice.guidedItemId &&
      attempt.practiceKind === "typing" &&
      attempt.stage === 3 &&
      completedAttempt(attempt),
  );
  const independent = lessonAttempts.some(
    (attempt) =>
      attempt.itemId === lesson.practice.coldItemId && verifiedIndependent(attempt),
  );
  const transfer = lesson.practice.transferItemId
    ? lessonAttempts.some(
        (attempt) =>
          attempt.itemId === lesson.practice.transferItemId &&
          verifiedIndependent(attempt),
      )
    : false;
  return {
    committedChecks: currentReviews.length,
    revealedChecks: currentReviews.filter((review) => review.revealedAt).length,
    strongChecks: currentReviews.filter((review) =>
      review.grade === "good" || review.grade === "easy",
    ).length,
    worked,
    guided,
    independent,
    transfer,
  };
}

export function countStrongPatternChecks(lessons, workspace) {
  return (Array.isArray(lessons) ? lessons : []).reduce(
    (total, lesson) =>
      total + derivePatternEvidence(lesson, workspace).strongChecks,
    0,
  );
}

export function selectNextPatternLesson(
  lessons,
  workspace,
  attempts = [],
  items = [],
) {
  const ranked = (Array.isArray(lessons) ? lessons : []).map((lesson) => {
    const evidence = derivePatternEvidence(lesson, workspace, attempts, items);
    const priority =
      evidence.committedChecks === 0
        ? 0
        : evidence.strongChecks < lesson.checks.length
          ? 1
          : !evidence.worked
            ? 2
            : !evidence.guided
              ? 3
              : !evidence.independent
                ? 4
                : lesson.practice.transferItemId && !evidence.transfer
                  ? 5
                  : 6;
    return { lesson, priority };
  });
  ranked.sort(
    (a, b) => a.priority - b.priority || a.lesson.order - b.lesson.order,
  );
  return ranked[0]?.lesson ?? null;
}
