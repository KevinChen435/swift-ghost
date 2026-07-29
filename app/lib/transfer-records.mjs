import {
  deriveTransferProgress,
  normalizeTransferWorkspace,
} from "./transfer-lab.mjs";
import { settledSubmissionEvidence } from "./submission-log.mjs";

const ISO_EPOCH = "1970-01-01T00:00:00.000Z";
const MAX_ID_LENGTH = 160;
const MAX_TEXT_LENGTH = 500;
const MAX_REVISION = 2_147_483_647;
const MAX_CHECKS = 10_000;
const MAX_TIMELINE_EVENTS = 100;

export const TRANSFER_RECORDS_LIMITS = Object.freeze({
  maxTimelineEvents: MAX_TIMELINE_EVENTS,
  maxIdLength: MAX_ID_LENGTH,
  maxTextLength: MAX_TEXT_LENGTH,
  maxRevision: MAX_REVISION,
  maxChecks: MAX_CHECKS,
});

const ATTEMPT_QUALIFICATIONS = new Set([
  "syntax",
  "guided",
  "independent",
  "solved",
  "assisted",
  "incomplete",
]);
const SUBMISSION_STATUSES = new Set([
  "accepted",
  "wrong-answer",
  "runtime-error",
  "time-limit",
  "invalid-entrypoint",
  "judge-error",
]);
const SUBMISSION_CONTEXTS = new Set([
  "practice",
  "transfer",
  "assessment",
  "mock",
  "studio",
  "round",
]);
const SUBMISSION_ASSISTANCE = new Set(["used", "none-recorded", "unknown"]);
const REVIEW_GRADES = new Set(["again", "hard", "good", "easy"]);
const EVENT_ORDER = Object.freeze({
  "prompt-open": 0,
  hint: 1,
  "reference-or-debrief-reveal": 2,
  attempt: 3,
  submission: 4,
  review: 5,
});

function record(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanId(value) {
  if (typeof value !== "string") return "";
  const id = value.trim().slice(0, MAX_ID_LENGTH);
  return /^[A-Za-z0-9][A-Za-z0-9:._-]*$/.test(id) ? id : "";
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const text = value.trim().slice(0, MAX_TEXT_LENGTH);
  return text || fallback;
}

function cleanDate(value) {
  const time = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function cleanRevision(value) {
  const revision = Number(value);
  if (!Number.isFinite(revision)) return null;
  return Math.min(MAX_REVISION, Math.max(1, Math.round(revision)));
}

function boundedCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return null;
  return Math.min(MAX_CHECKS, Math.max(0, Math.round(count)));
}

function variantIdOf(value) {
  return cleanId(record(value) ? value.variantId ?? value.itemId ?? value.id : "");
}

function revisionOf(value) {
  return cleanRevision(
    record(value)
      ? value.variantRevision ?? value.itemRevision ?? value.contentRevision ?? value.revision ?? 1
      : 1,
  );
}

function later(left, right) {
  if (!left) return right ?? null;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function occurrenceEvents(kind, firstAt, lastAt, common, criticalEvents) {
  if (!firstAt && !lastAt) return [];
  if (!firstAt || !lastAt || firstAt === lastAt) {
    return [{
      id: `${kind}:${common.variantRevision}:first-and-last`,
      kind,
      at: firstAt ?? lastAt,
      occurrence: "first-and-last",
      ...common,
      critical: criticalEvents,
    }];
  }
  return [
    {
      id: `${kind}:${common.variantRevision}:first`,
      kind,
      at: firstAt,
      occurrence: "first",
      ...common,
      critical: criticalEvents,
    },
    {
      id: `${kind}:${common.variantRevision}:last`,
      kind,
      at: lastAt,
      occurrence: "last",
      ...common,
      critical: criticalEvents,
    },
  ];
}

function normalizeAttempt(raw, validVariantIds) {
  if (!record(raw)) return null;
  const attemptId = cleanId(raw.id ?? raw.attemptId);
  const variantId = cleanId(raw.variantId ?? raw.itemId);
  const variantRevision = revisionOf(raw);
  const at = cleanDate(raw.completedAt ?? raw.submittedAt ?? raw.updatedAt);
  const outcome = raw.outcome === "completed" || raw.outcome === "abandoned" ? raw.outcome : null;
  const qualification = ATTEMPT_QUALIFICATIONS.has(raw.qualification)
    ? raw.qualification
    : null;
  if (
    !attemptId ||
    !variantId ||
    !validVariantIds.has(variantId) ||
    !variantRevision ||
    !at ||
    !outcome ||
    !qualification
  ) return null;
  const passed = boundedCount(raw.verification?.passed);
  const total = boundedCount(raw.verification?.total);
  const submissionId = cleanId(raw.submissionId);
  const assisted = Boolean(
    qualification === "assisted" ||
      qualification === "guided" ||
      raw.assistanceUsed === true ||
      Number(raw.peeks ?? 0) > 0 ||
      Number(raw.maxHintLevel ?? raw.hintLevel ?? 0) > 0 ||
      cleanDate(raw.referenceRevealedAt ?? raw.answerUnlockedAt),
  );
  return {
    attemptId,
    variantId,
    variantRevision,
    at,
    outcome,
    qualification,
    assisted,
    verificationPassed: passed,
    verificationTotal: total,
    ...(submissionId ? { submissionId } : {}),
    raw,
  };
}

function normalizeReceipt(raw, validVariantIds) {
  if (!record(raw)) return null;
  const submissionId = cleanId(raw.id ?? raw.submissionId);
  const variantId = cleanId(raw.itemId ?? raw.variantId);
  const variantRevision = revisionOf(raw);
  const requestedAt = cleanDate(raw.requestedAt ?? raw.submittedAt);
  const lifecycle = raw.lifecycle === "pending" || raw.lifecycle === "settled"
    ? raw.lifecycle
    : null;
  const contextKind = record(raw.context) && SUBMISSION_CONTEXTS.has(raw.context.kind)
    ? raw.context.kind
    : null;
  const assistance = SUBMISSION_ASSISTANCE.has(raw.assistance)
    ? raw.assistance
    : raw.assistanceUsed === true
      ? "used"
      : raw.assistanceUsed === false
        ? "none-recorded"
        : null;
  if (
    !submissionId ||
    !variantId ||
    !validVariantIds.has(variantId) ||
    !variantRevision ||
    !requestedAt ||
    !lifecycle ||
    !contextKind ||
    !assistance
  ) return null;
  if (lifecycle === "pending") {
    return {
      submissionId,
      variantId,
      variantRevision,
      requestedAt,
      at: requestedAt,
      lifecycle,
      status: null,
      passed: null,
      total: null,
      contextKind,
      assistance,
      raw,
    };
  }
  const settledAt = cleanDate(raw.settledAt ?? raw.completedAt);
  const passed = boundedCount(raw.passed);
  const total = boundedCount(raw.total);
  const status = SUBMISSION_STATUSES.has(raw.status) ? raw.status : null;
  if (!settledAt || status === null || passed === null || total === null || passed > total) return null;
  return {
    submissionId,
    variantId,
    variantRevision,
    requestedAt,
    settledAt,
    at: settledAt,
    lifecycle,
    status,
    passed,
    total,
    contextKind,
    assistance,
    raw,
  };
}

function normalizeReview(raw, attemptsById, receiptsById) {
  if (!record(raw)) return null;
  const reviewId = cleanId(raw.id);
  const attemptId = cleanId(raw.attemptId);
  const variantId = cleanId(raw.itemId ?? raw.variantId);
  const variantRevision = revisionOf(raw);
  const status = raw.status === "draft" || raw.status === "completed" ? raw.status : null;
  const createdAt = cleanDate(raw.createdAt);
  const updatedAt = cleanDate(raw.updatedAt);
  const attempt = attemptsById.get(attemptId);
  if (
    !reviewId ||
    !attemptId ||
    !attempt ||
    !variantId ||
    attempt.variantId !== variantId ||
    !variantRevision ||
    attempt.variantRevision !== variantRevision ||
    !status ||
    !createdAt ||
    !updatedAt
  ) return null;
  const submissionId = cleanId(raw.submissionId);
  if (submissionId) {
    const receipt = receiptsById.get(submissionId);
    if (
      !receipt ||
      receipt.variantId !== variantId ||
      receipt.variantRevision !== variantRevision ||
      (attempt.submissionId && attempt.submissionId !== submissionId)
    ) return null;
  }
  const completedAt = cleanDate(raw.completedAt);
  const grade = REVIEW_GRADES.has(raw.grade) ? raw.grade : null;
  const dueAt = cleanDate(raw.dueAt);
  if (status === "completed" && (!completedAt || !grade || !dueAt)) return null;
  return {
    reviewId,
    attemptId,
    variantId,
    variantRevision,
    status,
    at: status === "completed" ? completedAt : updatedAt,
    createdAt,
    updatedAt,
    completedAt,
    grade,
    dueAt,
    ...(submissionId ? { submissionId } : {}),
  };
}

function deduplicate(values, idKey, dateKey) {
  const byId = new Map();
  for (const value of values) {
    if (!value) continue;
    const previous = byId.get(value[idKey]);
    if (
      !previous ||
      Date.parse(value[dateKey]) > Date.parse(previous[dateKey])
    ) byId.set(value[idKey], value);
  }
  return [...byId.values()];
}

function compareEvents(left, right) {
  return Date.parse(left.at) - Date.parse(right.at) ||
    EVENT_ORDER[left.kind] - EVENT_ORDER[right.kind] ||
    left.id.localeCompare(right.id);
}

function boundTimeline(events) {
  const ordered = events.sort(compareEvents);
  if (ordered.length <= MAX_TIMELINE_EVENTS) {
    return { timeline: ordered.map(stripInternalEvent), omitted: 0 };
  }
  const critical = ordered.filter((event) => event.critical);
  const retainedCritical = critical.slice(-MAX_TIMELINE_EVENTS);
  const capacity = MAX_TIMELINE_EVENTS - retainedCritical.length;
  const retainedIds = new Set(retainedCritical.map((event) => event.id));
  const latestOthers = capacity > 0
    ? ordered
        .filter((event) => !retainedIds.has(event.id))
        .slice(-capacity)
    : [];
  const timeline = [...retainedCritical, ...latestOthers]
    .sort(compareEvents)
    .map(stripInternalEvent);
  return { timeline, omitted: ordered.length - timeline.length };
}

function stripInternalEvent(value) {
  const event = { ...value };
  delete event.critical;
  return event;
}

function exposureEvents(exposure, currentRevision) {
  const common = {
    variantRevision: exposure.variantRevision,
    isCurrentRevision: exposure.variantRevision === currentRevision,
  };
  return [
    ...occurrenceEvents(
      "prompt-open",
      exposure.firstOpenedAt,
      exposure.lastOpenedAt,
      { ...common, recordedOpenCount: exposure.openCount },
      true,
    ),
    ...occurrenceEvents(
      "hint",
      exposure.firstHintedAt,
      exposure.lastHintedAt,
      { ...common, maxHintLevel: exposure.maxHintLevel },
      true,
    ),
    ...(exposure.referenceRevealedAt
      ? [{
          id: `reference-or-debrief-reveal:${exposure.variantRevision}`,
          kind: "reference-or-debrief-reveal",
          at: exposure.referenceRevealedAt,
          ...common,
          critical: true,
        }]
      : []),
  ];
}

function attemptEvent(attempt, currentRevision, progress) {
  const evidence = progress.solveEvidenceEvents.find(
    (entry) => entry.source === "attempt" && entry.id === attempt.attemptId,
  );
  return {
    id: `attempt:${attempt.attemptId}`,
    kind: "attempt",
    at: attempt.at,
    variantRevision: attempt.variantRevision,
    isCurrentRevision: attempt.variantRevision === currentRevision,
    attemptId: attempt.attemptId,
    outcome: attempt.outcome,
    qualification: attempt.qualification,
    assisted: attempt.assisted,
    verificationPassed: attempt.verificationPassed,
    verificationTotal: attempt.verificationTotal,
    ...(attempt.submissionId ? { submissionId: attempt.submissionId } : {}),
    evidenceClass: evidence?.evidenceClass ?? "not-schedule-evidence",
    advancesSchedule: evidence?.advancesSchedule ?? false,
    intervalIndex: evidence?.intervalIndex ?? null,
    nextDueAt: evidence?.nextDueAt ?? null,
    critical: false,
  };
}

function submissionEvent(submission, currentRevision, linkedAttemptId, progress) {
  const evidence = progress.solveEvidenceEvents.find(
    (entry) => entry.source === "submission" && entry.id === submission.submissionId,
  );
  return {
    id: `submission:${submission.submissionId}`,
    kind: "submission",
    at: submission.at,
    variantRevision: submission.variantRevision,
    isCurrentRevision: submission.variantRevision === currentRevision,
    submissionId: submission.submissionId,
    lifecycle: submission.lifecycle,
    status: submission.status,
    verificationPassed: submission.passed,
    verificationTotal: submission.total,
    contextKind: submission.contextKind,
    assistance: submission.assistance,
    ...(linkedAttemptId ? { attemptId: linkedAttemptId } : {}),
    evidenceClass: evidence?.evidenceClass ?? "not-schedule-evidence",
    advancesSchedule: evidence?.advancesSchedule ?? false,
    intervalIndex: evidence?.intervalIndex ?? null,
    nextDueAt: evidence?.nextDueAt ?? null,
    critical: false,
  };
}

function reviewEvent(review, currentRevision) {
  return {
    id: `review:${review.reviewId}`,
    kind: "review",
    at: review.at,
    variantRevision: review.variantRevision,
    isCurrentRevision: review.variantRevision === currentRevision,
    reviewId: review.reviewId,
    attemptId: review.attemptId,
    status: review.status,
    grade: review.grade,
    dueAt: review.dueAt,
    ...(review.submissionId ? { submissionId: review.submissionId } : {}),
    critical: false,
  };
}

function metadataFor(variant, variantId) {
  const sourceItemIds = Array.isArray(variant?.transfer?.sourceItemIds)
    ? [...new Set(variant.transfer.sourceItemIds.map(cleanId).filter(Boolean))].slice(0, 20)
    : [];
  return {
    title: cleanText(variant?.title, variantId),
    difficulty: cleanText(variant?.difficulty),
    language: cleanText(variant?.language),
    pattern: cleanText(variant?.pattern),
    family: cleanText(variant?.transfer?.family),
    sourceItemIds,
  };
}

function coverageFor(workspace, exposures, omitted) {
  const hasOpen = exposures.some((entry) => entry.openCount > 0);
  const hasHints = exposures.some((entry) => entry.maxHintLevel > 0);
  const hasReveal = exposures.some((entry) => entry.referenceRevealedAt);
  return {
    scope: "local-practice-evidence",
    workspace: workspace.coverage,
    promptOpens: hasOpen
      ? exposures.every((entry) => entry.openCount <= 1)
        ? "complete"
        : "first-and-last-only"
      : workspace.coverage === "complete"
        ? "none-recorded"
        : "unknown",
    hints: hasHints
      ? "first-and-last-only"
      : workspace.coverage === "complete"
        ? "none-recorded"
        : "unknown",
    referenceOrDebriefReveal: hasReveal
      ? "recorded"
      : workspace.coverage === "complete"
        ? "none-recorded"
        : "unknown",
    timeline: omitted > 0 ? "truncated" : "complete",
    omittedTimelineEventCount: omitted,
    disclosure:
      "Local practice evidence only. Opens and hints are aggregate first/last markers; missing events are not inferred.",
  };
}

function zeroTotals() {
  return {
    records: 0,
    eligible: 0,
    unseen: 0,
    opened: 0,
    attempted: 0,
    assisted: 0,
    proven: 0,
    independentEvidence: 0,
    due: 0,
    attempts: 0,
    currentAttempts: 0,
    staleAttempts: 0,
    submissions: 0,
    currentSubmissions: 0,
    staleSubmissions: 0,
    pendingSubmissions: 0,
    settledSubmissions: 0,
    acceptedSubmissions: 0,
    failedSubmissions: 0,
    reviews: 0,
    draftReviews: 0,
    completedReviews: 0,
    partialEvidenceRecords: 0,
    truncatedTimelines: 0,
  };
}

/** Build a deterministic, read-only Records > Transfer projection. */
export function buildTransferRecords(input = {}) {
  const now = cleanDate(input?.now) ?? ISO_EPOCH;
  const variantsById = new Map();
  for (const variant of Array.isArray(input?.variants) ? input.variants : []) {
    const variantId = variantIdOf(variant);
    if (variantId) variantsById.set(variantId, variant);
  }
  const variants = [...variantsById.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, variant]) => variant);
  const validVariantIds = new Set(variantsById.keys());
  const workspace = normalizeTransferWorkspace(input?.workspace, { now });

  const attempts = deduplicate(
    (Array.isArray(input?.attempts) ? input.attempts : [])
      .map((entry) => normalizeAttempt(entry, validVariantIds)),
    "attemptId",
    "at",
  );
  const attemptsById = new Map(attempts.map((entry) => [entry.attemptId, entry]));

  const rawReceipts = Array.isArray(input?.submissionLog?.receipts)
    ? input.submissionLog.receipts
    : Array.isArray(input?.submissions)
      ? input.submissions
      : [];
  const receipts = deduplicate(
    rawReceipts.map((entry) => normalizeReceipt(entry, validVariantIds)),
    "submissionId",
    "at",
  );
  const receiptsById = new Map(receipts.map((entry) => [entry.submissionId, entry]));
  const settledEvidence = settledSubmissionEvidence({
    receipts: receipts.filter((entry) => entry.lifecycle === "settled").map((entry) => entry.raw),
  });

  const reviews = deduplicate(
    (Array.isArray(input?.reviews) ? input.reviews : [])
      .map((entry) => normalizeReview(entry, attemptsById, receiptsById)),
    "reviewId",
    "at",
  );
  const progress = deriveTransferProgress({
    variants,
    workspace,
    attempts: attempts.map((entry) => entry.raw),
    submissions: settledEvidence,
    now,
  });
  const progressById = new Map(progress.map((entry) => [entry.variantId, entry]));

  const records = [...variantsById.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([variantId, variant]) => {
      const progressEntry = progressById.get(variantId);
      const currentRevision = progressEntry?.variantRevision ?? revisionOf(variant);
      if (!progressEntry || !currentRevision) return [];
      const variantAttempts = attempts.filter((entry) => entry.variantId === variantId);
      const variantReceipts = receipts.filter((entry) => entry.variantId === variantId);
      const variantReviews = reviews.filter((entry) => entry.variantId === variantId);
      const variantExposures = workspace.exposures.filter((entry) => entry.variantId === variantId);
      const linkedAttemptBySubmission = new Map(
        variantAttempts
          .filter((entry) => entry.submissionId && receiptsById.has(entry.submissionId))
          .map((entry) => [entry.submissionId, entry.attemptId]),
      );
      const events = [
        ...variantExposures.flatMap((entry) => exposureEvents(entry, currentRevision)),
        ...variantAttempts.map((entry) => attemptEvent(entry, currentRevision, progressEntry)),
        ...variantReceipts.map((entry) =>
          submissionEvent(
            entry,
            currentRevision,
            linkedAttemptBySubmission.get(entry.submissionId),
            progressEntry,
          ),
        ),
        ...variantReviews.map((entry) => reviewEvent(entry, currentRevision)),
      ];
      const { timeline, omitted } = boundTimeline(events);
      const currentAttempts = variantAttempts.filter((entry) => entry.variantRevision === currentRevision);
      const currentReceipts = variantReceipts.filter((entry) => entry.variantRevision === currentRevision);
      const currentAcceptedAttempts = currentAttempts
        .filter((entry) =>
          entry.outcome === "completed" &&
          ["solved", "independent", "assisted"].includes(entry.qualification) &&
          entry.verificationTotal > 0 &&
          entry.verificationPassed === entry.verificationTotal,
        )
        .sort((left, right) => Date.parse(right.at) - Date.parse(left.at) || left.attemptId.localeCompare(right.attemptId));
      const latestReceipt = [...variantReceipts]
        .sort((left, right) => Date.parse(right.at) - Date.parse(left.at) || left.submissionId.localeCompare(right.submissionId))[0];
      const latestReview = [...variantReviews]
        .sort((left, right) => Date.parse(right.at) - Date.parse(left.at) || left.reviewId.localeCompare(right.reviewId))[0];
      const currentCompletedReviews = variantReviews
        .filter((entry) => entry.variantRevision === currentRevision && entry.status === "completed")
        .sort((left, right) => Date.parse(right.at) - Date.parse(left.at) || left.reviewId.localeCompare(right.reviewId));
      const lastActivityAt = timeline.reduce(
        (latest, event) => later(latest, event.at),
        progressEntry.lastActivityAt,
      );
      return [{
        variantId,
        currentRevision,
        ...metadataFor(variant, variantId),
        eligible: progressEntry.eligible,
        status: progressEntry.status,
        progress: progressEntry,
        exposure: progressEntry.exposure,
        attemptCount: variantAttempts.length,
        currentAttemptCount: currentAttempts.length,
        staleAttemptCount: variantAttempts.length - currentAttempts.length,
        submissionCount: variantReceipts.length,
        currentSubmissionCount: currentReceipts.length,
        staleSubmissionCount: variantReceipts.length - currentReceipts.length,
        reviewCount: variantReviews.length,
        latestSubmissionId: latestReceipt?.submissionId ?? null,
        latestReviewAttemptId: latestReview?.attemptId ?? null,
        currentAcceptedAttemptId: currentAcceptedAttempts[0]?.attemptId ?? null,
        dueAt: progressEntry.dueAt,
        reviewDueAt: currentCompletedReviews[0]?.dueAt ?? null,
        lastActivityAt,
        timeline,
        timelineEventCount: events.length,
        omittedTimelineEventCount: omitted,
        evidenceCoverage: coverageFor(workspace, variantExposures, omitted),
      }];
    });

  const totals = records.reduce((total, entry) => {
    total.records += 1;
    total.eligible += entry.eligible ? 1 : 0;
    total[entry.status] += 1;
    total.independentEvidence += entry.progress.isProven ? 1 : 0;
    total.attempts += entry.attemptCount;
    total.currentAttempts += entry.currentAttemptCount;
    total.staleAttempts += entry.staleAttemptCount;
    total.submissions += entry.submissionCount;
    total.currentSubmissions += entry.currentSubmissionCount;
    total.staleSubmissions += entry.staleSubmissionCount;
    total.partialEvidenceRecords += entry.evidenceCoverage.workspace === "partial" ? 1 : 0;
    total.truncatedTimelines += entry.omittedTimelineEventCount > 0 ? 1 : 0;
    return total;
  }, zeroTotals());
  totals.pendingSubmissions = receipts.filter((entry) => entry.lifecycle === "pending").length;
  totals.settledSubmissions = receipts.filter((entry) => entry.lifecycle === "settled").length;
  totals.acceptedSubmissions = receipts.filter((entry) => entry.status === "accepted").length;
  totals.failedSubmissions = receipts.filter(
    (entry) => entry.lifecycle === "settled" && entry.status !== "accepted",
  ).length;
  totals.reviews = reviews.length;
  totals.draftReviews = reviews.filter((entry) => entry.status === "draft").length;
  totals.completedReviews = reviews.filter((entry) => entry.status === "completed").length;

  return {
    generatedAt: now,
    evidenceScope: "local-practice-evidence",
    records,
    totals,
  };
}
