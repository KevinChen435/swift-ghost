export const SOLUTION_REVIEW_STEPS = [
  "explain",
  "compare",
  "mistake",
  "teach-back",
  "schedule",
  "complete",
];

export const SOLUTION_REVIEW_MISTAKES = [
  "none",
  "recognition",
  "invariant",
  "implementation-plan",
  "edge-case",
  "python-syntax",
  "swift-syntax-api",
  "complexity",
];

export const SOLUTION_REVIEW_GRADES = ["again", "hard", "good", "easy"];
export const SOLUTION_REVIEW_ACTIVITY_KINDS = ["syntax", "solve", "concept"];

export const SOLUTION_REVIEW_LIMITS = Object.freeze({
  maxRecords: 250,
  maxIdBytes: 160,
  maxTitleBytes: 500,
  maxExplanationBytes: 2_000,
  maxNoteBytes: 1_200,
  maxPromptBytes: 800,
  maxResponseBytes: 2_000,
  maxReasonBytes: 600,
  maxApproachIds: 8,
  maxRevision: 1_000_000,
});

const encoder = new TextEncoder();

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function bytes(value) {
  return encoder.encode(value).byteLength;
}

function cleanText(value, limit, required = false) {
  if (typeof value !== "string") return required ? null : undefined;
  const normalized = value.trim();
  if (!normalized) return required ? null : undefined;
  if (bytes(normalized) <= limit) return normalized;
  let output = "";
  for (const character of normalized) {
    if (bytes(output + character) > limit) break;
    output += character;
  }
  return output || (required ? null : undefined);
}

function cleanDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value))
    return new Date(value).toISOString();
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function cleanRevision(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(
    1,
    Math.min(SOLUTION_REVIEW_LIMITS.maxRevision, Math.round(number)),
  );
}

function cleanApproachIds(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const candidate of value) {
    const id = cleanText(candidate, SOLUTION_REVIEW_LIMITS.maxIdBytes);
    if (!id || result.includes(id)) continue;
    result.push(id);
    if (result.length >= SOLUTION_REVIEW_LIMITS.maxApproachIds) break;
  }
  return result;
}

export function normalizeSolutionReviews(value, options = {}) {
  if (!Array.isArray(value)) return [];
  const attemptsById = options.attemptsById;
  const validItemIds = options.validItemIds;
  const submissionIds = options.submissionIds;
  const submissionsById = options.submissionsById;
  const timedAttemptIds = options.timedAttemptIds;
  const normalized = value.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const id = cleanText(raw.id, SOLUTION_REVIEW_LIMITS.maxIdBytes, true);
    const attemptId = cleanText(
      raw.attemptId,
      SOLUTION_REVIEW_LIMITS.maxIdBytes,
      true,
    );
    const itemId = cleanText(
      raw.itemId,
      SOLUTION_REVIEW_LIMITS.maxIdBytes,
      true,
    );
    const titleSnapshot = cleanText(
      raw.titleSnapshot,
      SOLUTION_REVIEW_LIMITS.maxTitleBytes,
      true,
    );
    const createdAt = cleanDate(raw.createdAt);
    const updatedAt = cleanDate(raw.updatedAt);
    const linkedAttempt = attemptId ? attemptsById?.get?.(attemptId) : undefined;
    const itemRevision = cleanRevision(raw.itemRevision);
    if (
      !id ||
      !attemptId ||
      !itemId ||
      !titleSnapshot ||
      !createdAt ||
      !updatedAt ||
      (validItemIds instanceof Set && !validItemIds.has(itemId)) ||
      (attemptsById instanceof Map && !linkedAttempt) ||
      (linkedAttempt &&
        (linkedAttempt.itemId !== itemId ||
          Number(linkedAttempt.itemRevision) !== itemRevision ||
          linkedAttempt.practiceKind !== "solving" ||
          linkedAttempt.outcome !== "completed" ||
          !linkedAttempt.verification ||
          Number(linkedAttempt.verification.total) < 1 ||
          Number(linkedAttempt.verification.passed) !==
            Number(linkedAttempt.verification.total))) ||
      !["draft", "completed"].includes(raw.status) ||
      !SOLUTION_REVIEW_STEPS.includes(raw.step)
    )
      return [];

    const requestedSubmissionId = cleanText(
      raw.submissionId,
      SOLUTION_REVIEW_LIMITS.maxIdBytes,
    );
    const attemptSubmissionId = cleanText(
      linkedAttempt?.submissionId,
      SOLUTION_REVIEW_LIMITS.maxIdBytes,
    );
    if (
      requestedSubmissionId &&
      attemptSubmissionId &&
      requestedSubmissionId !== attemptSubmissionId
    )
      return [];
    const exactSubmissionId = linkedAttempt
      ? attemptSubmissionId
      : requestedSubmissionId;
    const linkedSubmission = exactSubmissionId
      ? submissionsById?.get?.(exactSubmissionId)
      : undefined;
    if (
      linkedSubmission &&
      submissionsById instanceof Map &&
      (linkedSubmission.lifecycle !== "settled" ||
        linkedSubmission.status !== "accepted" ||
        linkedSubmission.itemId !== itemId ||
        Number(linkedSubmission.itemRevision) !== itemRevision ||
        (linkedAttempt && linkedSubmission.language !== linkedAttempt.language))
    )
      return [];
    const submissionId =
      exactSubmissionId &&
      (!(submissionIds instanceof Set) || submissionIds.has(exactSubmissionId)) &&
      (!(submissionsById instanceof Map) || linkedSubmission)
        ? exactSubmissionId
        : undefined;
    const linkedSubmissionId = cleanText(
      raw.linkedSubmissionId,
      SOLUTION_REVIEW_LIMITS.maxIdBytes,
    );
    const mistakeCategory = SOLUTION_REVIEW_MISTAKES.includes(
      raw.mistakeCategory,
    )
      ? raw.mistakeCategory
      : undefined;
    const grade = SOLUTION_REVIEW_GRADES.includes(raw.grade)
      ? raw.grade
      : undefined;
    const activityKind = SOLUTION_REVIEW_ACTIVITY_KINDS.includes(
      raw.activityKind,
    )
      ? raw.activityKind
      : undefined;
    const dueAt = cleanDate(raw.dueAt);
    const completedAt = cleanDate(raw.completedAt);
    const revealedAt = cleanDate(raw.revealedAt);
    const teachBackCommittedAt = cleanDate(raw.teachBackCommittedAt);
    const teachBackReferenceRevealedAt = cleanDate(
      raw.teachBackReferenceRevealedAt,
    );
    const status = raw.status;
    if (
      status === "completed" &&
      (!completedAt || !grade || !activityKind || !dueAt)
    )
      return [];
    const qualification =
      linkedAttempt?.qualification === "solved" ||
      (!linkedAttempt && raw.qualification === "solved")
        ? "solved"
        : "assisted";

    return [
      {
        id,
        attemptId,
        ...(submissionId ? { submissionId } : {}),
        itemId,
        itemRevision,
        titleSnapshot,
        status,
        step: status === "completed" ? "complete" : raw.step,
        unlockContext:
          timedAttemptIds instanceof Set
            ? timedAttemptIds.has(attemptId)
              ? "finished-timed-run"
              : "accepted-practice"
            : raw.unlockContext === "finished-timed-run"
              ? "finished-timed-run"
              : "accepted-practice",
        qualification,
        verificationPassed: Math.max(
          0,
          Math.min(
            10_000,
            Math.round(
              Number(
                linkedAttempt?.verification?.passed ?? raw.verificationPassed,
              ) || 0,
            ),
          ),
        ),
        verificationTotal: Math.max(
          0,
          Math.min(
            10_000,
            Math.round(
              Number(
                linkedAttempt?.verification?.total ?? raw.verificationTotal,
              ) || 0,
            ),
          ),
        ),
        createdAt,
        updatedAt,
        explainApproach:
          cleanText(raw.explainApproach, SOLUTION_REVIEW_LIMITS.maxExplanationBytes) ??
          "",
        explainInvariant:
          cleanText(raw.explainInvariant, SOLUTION_REVIEW_LIMITS.maxExplanationBytes) ??
          "",
        explainComplexity:
          cleanText(raw.explainComplexity, SOLUTION_REVIEW_LIMITS.maxExplanationBytes) ??
          "",
        explanationSkipped: raw.explanationSkipped === true,
        ...(revealedAt ? { revealedAt } : {}),
        viewedApproachIds: cleanApproachIds(raw.viewedApproachIds),
        referenceCodeRevealed: raw.referenceCodeRevealed === true,
        comparisonViewed: raw.comparisonViewed === true,
        ...(mistakeCategory ? { mistakeCategory } : {}),
        mistakeNote:
          cleanText(raw.mistakeNote, SOLUTION_REVIEW_LIMITS.maxNoteBytes) ?? "",
        ...(linkedSubmissionId &&
        (!(submissionIds instanceof Set) || submissionIds.has(linkedSubmissionId))
          ? { linkedSubmissionId }
          : {}),
        teachBackPrompt:
          cleanText(raw.teachBackPrompt, SOLUTION_REVIEW_LIMITS.maxPromptBytes) ??
          "Explain the cue, invariant, complexity, and one counterexample from memory.",
        teachBackResponse:
          cleanText(raw.teachBackResponse, SOLUTION_REVIEW_LIMITS.maxResponseBytes) ??
          "",
        ...(teachBackCommittedAt ? { teachBackCommittedAt } : {}),
        ...(teachBackReferenceRevealedAt
          ? { teachBackReferenceRevealedAt }
          : {}),
        ...(grade ? { grade } : {}),
        ...(activityKind ? { activityKind } : {}),
        ...(dueAt ? { dueAt } : {}),
        ...(status === "completed"
          ? {
              scheduleReason: scheduleReasonForReview({
                mistakeCategory,
                grade,
                qualification,
              }),
            }
          : {}),
        ...(completedAt ? { completedAt } : {}),
      },
    ];
  });

  const byAttempt = new Map();
  for (const review of normalized) {
    const existing = byAttempt.get(review.attemptId);
    if (
      !existing ||
      Date.parse(review.updatedAt) >= Date.parse(existing.updatedAt)
    )
      byAttempt.set(review.attemptId, review);
  }
  return [...byAttempt.values()]
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .slice(-SOLUTION_REVIEW_LIMITS.maxRecords);
}

export function createSolutionReview(input) {
  const now = cleanDate(input?.now) ?? new Date().toISOString();
  const attempt = input?.attempt;
  if (
    !attempt ||
    attempt.practiceKind !== "solving" ||
    attempt.outcome !== "completed" ||
    !attempt.verification ||
    attempt.verification.total < 1 ||
    attempt.verification.passed !== attempt.verification.total
  )
    throw new Error("Only a completed accepted solve can start solution review");
  if (
    input?.submissionId &&
    input.submissionId !== attempt.submissionId
  )
    throw new Error("Solution review submission must match the accepted attempt");
  return normalizeSolutionReviews(
    [
      {
        id: input.id,
        attemptId: attempt.id,
        submissionId: input.submissionId ?? attempt.submissionId,
        itemId: attempt.itemId,
        itemRevision: attempt.itemRevision,
        titleSnapshot: attempt.titleSnapshot,
        status: "draft",
        step: "explain",
        unlockContext: input.unlockContext ?? "accepted-practice",
        qualification: attempt.qualification,
        verificationPassed: attempt.verification.passed,
        verificationTotal: attempt.verification.total,
        createdAt: now,
        updatedAt: now,
        explainApproach: "",
        explainInvariant: "",
        explainComplexity: "",
        explanationSkipped: false,
        viewedApproachIds: [],
        referenceCodeRevealed: false,
        comparisonViewed: false,
        mistakeNote: "",
        teachBackPrompt: input.teachBackPrompt,
        teachBackResponse: "",
      },
    ],
    {
      attemptsById: new Map([[attempt.id, attempt]]),
      validItemIds: new Set([attempt.itemId]),
      submissionIds: input.submissionId
        ? new Set([input.submissionId])
        : undefined,
    },
  )[0];
}

export function upsertSolutionReview(records, record, options = {}) {
  return normalizeSolutionReviews(
    [
      ...(Array.isArray(records)
        ? records.filter((candidate) => candidate?.attemptId !== record?.attemptId)
        : []),
      record,
    ],
    options,
  );
}

export function activityKindForMistake(category) {
  if (category === "python-syntax" || category === "swift-syntax-api")
    return "syntax";
  if (category === "complexity") return "concept";
  return "solve";
}

export function scheduleReasonForReview(input = {}) {
  const category = input.mistakeCategory;
  const grade = input.grade;
  if (grade === "again")
    return "Recall broke down, so reconstruct the full solution tomorrow before rereading it.";
  if (category === "python-syntax" || category === "swift-syntax-api")
    return "In the next full solve, begin with a two-minute language/API reconstruction before implementing.";
  if (category === "complexity")
    return "In the next full solve, state the complexity argument aloud before implementing.";
  if (grade === "hard" || input.qualification === "assisted")
    return "This was hard or assisted evidence, so review it again within three days.";
  if (grade === "easy" && input.qualification === "solved")
    return "Independent recall felt easy, so the existing interval can advance.";
  return "Keep the current spaced-review interval and reconstruct the approach from memory next time.";
}
