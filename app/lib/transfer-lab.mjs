const ISO_EPOCH = "1970-01-01T00:00:00.000Z";
const DAY_MS = 86_400_000;
const REVIEW_DAYS = Object.freeze([1, 3, 7, 14, 30]);
const MAX_EXPOSURES = 1_000;
const MAX_ID_LENGTH = 160;
const MAX_OPEN_COUNT = 1_000_000;
const MAX_REVISION = 2_147_483_647;
const MAX_EVIDENCE_COUNT = 1_000_000;

export const TRANSFER_REVIEW_INTERVAL_DAYS = REVIEW_DAYS;
export const TRANSFER_WORKSPACE_LIMITS = Object.freeze({
  maxExposures: MAX_EXPOSURES,
  maxIdLength: MAX_ID_LENGTH,
  maxOpenCount: MAX_OPEN_COUNT,
  maxRevision: MAX_REVISION,
  maxEvidenceCount: MAX_EVIDENCE_COUNT,
});

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function boundedInt(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.round(number)))
    : fallback;
}

function cleanId(value) {
  if (typeof value !== "string") return "";
  const id = value.trim().slice(0, MAX_ID_LENGTH);
  return /^[A-Za-z0-9][A-Za-z0-9:._-]*$/.test(id) ? id : "";
}

function timeMs(value) {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value, fallback = ISO_EPOCH) {
  const parsed = timeMs(value);
  return parsed === null ? fallback : new Date(parsed).toISOString();
}

function nullableIso(value) {
  const parsed = timeMs(value);
  return parsed === null ? null : new Date(parsed).toISOString();
}

function earlier(left, right) {
  if (!left) return right ?? null;
  if (!right) return left;
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

function later(left, right) {
  if (!left) return right ?? null;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function variantRevisionOf(value) {
  if (!isRecord(value)) return 1;
  return boundedInt(
    value.variantRevision ?? value.itemRevision ?? value.contentRevision ?? value.revision,
    1,
    1,
    MAX_REVISION,
  );
}

function variantIdOf(value) {
  return cleanId(isRecord(value) ? value.variantId ?? value.itemId ?? value.id : value);
}

function exposureKey(variantId, variantRevision) {
  return `${variantId}\u0000${variantRevision}`;
}

function normalizeExposure(value, keyedVariantId) {
  if (!isRecord(value)) return null;
  const variantId = cleanId(value.variantId ?? value.id ?? keyedVariantId);
  if (!variantId) return null;
  const variantRevision = variantRevisionOf(value);
  let firstOpenedAt = nullableIso(value.firstOpenedAt);
  let lastOpenedAt = nullableIso(value.lastOpenedAt);
  if (!firstOpenedAt && lastOpenedAt) firstOpenedAt = lastOpenedAt;
  if (firstOpenedAt && !lastOpenedAt) lastOpenedAt = firstOpenedAt;
  if (firstOpenedAt && lastOpenedAt && Date.parse(firstOpenedAt) > Date.parse(lastOpenedAt)) {
    [firstOpenedAt, lastOpenedAt] = [lastOpenedAt, firstOpenedAt];
  }
  const hasOpenEvidence = Boolean(firstOpenedAt || lastOpenedAt);
  const openCount = boundedInt(
    value.openCount,
    hasOpenEvidence ? 1 : 0,
    hasOpenEvidence ? 1 : 0,
    MAX_OPEN_COUNT,
  );
  const firstHintedAt = nullableIso(value.firstHintedAt ?? value.hintedAt);
  const lastHintedAt = nullableIso(value.lastHintedAt ?? value.hintedAt);
  const normalizedFirstHint = earlier(firstHintedAt, lastHintedAt);
  const normalizedLastHint = later(firstHintedAt, lastHintedAt);
  const referenceRevealedAt = nullableIso(value.referenceRevealedAt ?? value.answerUnlockedAt);
  const maxHintLevel = boundedInt(
    value.maxHintLevel ?? value.hintLevel,
    0,
    0,
    3,
  );
  return {
    variantId,
    variantRevision,
    firstOpenedAt,
    lastOpenedAt,
    openCount,
    maxHintLevel,
    firstHintedAt: normalizedFirstHint,
    lastHintedAt: normalizedLastHint,
    referenceRevealedAt,
  };
}

function mergeExposure(left, right) {
  return {
    variantId: left.variantId,
    variantRevision: left.variantRevision,
    firstOpenedAt: earlier(left.firstOpenedAt, right.firstOpenedAt),
    lastOpenedAt: later(left.lastOpenedAt, right.lastOpenedAt),
    openCount: Math.min(MAX_OPEN_COUNT, Math.max(left.openCount, right.openCount)),
    maxHintLevel: Math.max(left.maxHintLevel, right.maxHintLevel),
    firstHintedAt: earlier(left.firstHintedAt, right.firstHintedAt),
    lastHintedAt: later(left.lastHintedAt, right.lastHintedAt),
    referenceRevealedAt: earlier(left.referenceRevealedAt, right.referenceRevealedAt),
  };
}

function exposureActivityMs(exposure) {
  return Math.max(
    timeMs(exposure.lastOpenedAt) ?? 0,
    timeMs(exposure.lastHintedAt) ?? 0,
    timeMs(exposure.referenceRevealedAt) ?? 0,
  );
}

function rawExposures(value) {
  if (Array.isArray(value?.exposures)) return value.exposures.map((entry) => [undefined, entry]);
  if (isRecord(value?.exposures)) return Object.entries(value.exposures);
  if (Array.isArray(value?.variants)) return value.variants.map((entry) => [undefined, entry]);
  if (isRecord(value?.variants)) return Object.entries(value.variants);
  return [];
}

export function createTransferWorkspace(now = ISO_EPOCH) {
  return {
    version: 1,
    revision: 0,
    updatedAt: iso(now, ISO_EPOCH),
    coverage: "complete",
    exposures: [],
  };
}

export function normalizeTransferWorkspace(value, options = {}) {
  const now = iso(options.now, ISO_EPOCH);
  if (value == null) return createTransferWorkspace(now);
  if (!isRecord(value)) {
    return { ...createTransferWorkspace(now), coverage: "partial" };
  }
  const hasExposureContainer =
    Array.isArray(value.exposures) ||
    isRecord(value.exposures) ||
    Array.isArray(value.variants) ||
    isRecord(value.variants);
  const byVariantRevision = new Map();
  const importedExposures = rawExposures(value);
  let discardedExposure = false;
  for (const [keyedVariantId, raw] of importedExposures) {
    const exposure = normalizeExposure(raw, keyedVariantId);
    if (!exposure) {
      discardedExposure = true;
      continue;
    }
    const key = exposureKey(exposure.variantId, exposure.variantRevision);
    const previous = byVariantRevision.get(key);
    byVariantRevision.set(key, previous ? mergeExposure(previous, exposure) : exposure);
  }
  const wasTruncated = byVariantRevision.size > MAX_EXPOSURES;
  const retained = [...byVariantRevision.values()]
    .sort(
      (left, right) =>
        exposureActivityMs(right) - exposureActivityMs(left) ||
        left.variantId.localeCompare(right.variantId) ||
        left.variantRevision - right.variantRevision,
    )
    .slice(0, MAX_EXPOSURES)
    .sort(
      (left, right) =>
        left.variantId.localeCompare(right.variantId) ||
        left.variantRevision - right.variantRevision,
    );
  return {
    version: 1,
    revision: boundedInt(value.revision, 0, 0, MAX_REVISION),
    updatedAt: iso(value.updatedAt, now),
    coverage:
      value.coverage === "complete" &&
      hasExposureContainer &&
      !wasTruncated &&
      !discardedExposure
        ? "complete"
        : "partial",
    exposures: retained,
  };
}

function mutationNow(options, fallback) {
  if (isRecord(options)) return iso(options.now, fallback);
  return iso(options, fallback);
}

function mutationRevision(options) {
  return isRecord(options) ? variantRevisionOf(options) : 1;
}

function mutateExposure(workspace, variantIdInput, options, update) {
  const normalized = normalizeTransferWorkspace(workspace, {
    now: isRecord(options) ? options.now : options,
  });
  const variantId = cleanId(variantIdInput);
  if (!variantId) return normalized;
  const variantRevision = mutationRevision(options);
  const key = exposureKey(variantId, variantRevision);
  const existing = normalized.exposures.find(
    (entry) => exposureKey(entry.variantId, entry.variantRevision) === key,
  );
  const empty = {
    variantId,
    variantRevision,
    firstOpenedAt: null,
    lastOpenedAt: null,
    openCount: 0,
    maxHintLevel: 0,
    firstHintedAt: null,
    lastHintedAt: null,
    referenceRevealedAt: null,
  };
  const nextExposure = update({ ...(existing ?? empty) });
  if (!nextExposure) return normalized;
  const exposures = normalized.exposures
    .filter((entry) => exposureKey(entry.variantId, entry.variantRevision) !== key)
    .concat(nextExposure);
  return normalizeTransferWorkspace(
    {
      ...normalized,
      revision: Math.min(MAX_REVISION, normalized.revision + 1),
      updatedAt: mutationNow(options, normalized.updatedAt),
      exposures,
    },
    { now: normalized.updatedAt },
  );
}

export function recordTransferOpened(workspace, variantId, options = {}) {
  const openedAt = mutationNow(options, ISO_EPOCH);
  return mutateExposure(workspace, variantId, options, (entry) => ({
    ...entry,
    firstOpenedAt: earlier(entry.firstOpenedAt, openedAt),
    lastOpenedAt: later(entry.lastOpenedAt, openedAt),
    openCount: Math.min(MAX_OPEN_COUNT, entry.openCount + 1),
  }));
}

export function recordTransferHint(workspace, variantId, hintLevel, options = {}) {
  const level = boundedInt(hintLevel, 0, 0, 3);
  const hintedAt = mutationNow(options, ISO_EPOCH);
  const referenceValue = isRecord(options)
    ? options.referenceRevealedAt ?? (options.referenceRevealed === true ? hintedAt : null)
    : null;
  const referenceRevealedAt = nullableIso(referenceValue);
  if (level < 1 && !referenceRevealedAt) return normalizeTransferWorkspace(workspace, { now: hintedAt });
  return mutateExposure(workspace, variantId, options, (entry) => ({
    ...entry,
    maxHintLevel: Math.max(entry.maxHintLevel, level),
    firstHintedAt:
      level > 0 ? earlier(entry.firstHintedAt, hintedAt) : entry.firstHintedAt,
    lastHintedAt:
      level > 0 ? later(entry.lastHintedAt, hintedAt) : entry.lastHintedAt,
    referenceRevealedAt: earlier(entry.referenceRevealedAt, referenceRevealedAt),
  }));
}

/**
 * Marks the post-attempt identity/contrast reveal. It deliberately reuses the
 * durable reference-exposure boundary so later reconstruction cannot be
 * mistaken for a first cold transfer, while an earlier clean solve remains
 * valid evidence.
 */
export function recordTransferDebriefReveal(
  workspace,
  variantId,
  options = {},
) {
  const revealedAt = mutationNow(options, ISO_EPOCH);
  return recordTransferHint(workspace, variantId, 0, {
    ...options,
    now: revealedAt,
    referenceRevealedAt: revealedAt,
  });
}

function evidenceVariantId(value) {
  return cleanId(isRecord(value) ? value.variantId ?? value.itemId : "");
}

function evidenceRevision(value) {
  return variantRevisionOf(value);
}

function isCurrentEvidence(value, variantId, variantRevision) {
  return (
    isRecord(value) &&
    evidenceVariantId(value) === variantId &&
    evidenceRevision(value) === variantRevision
  );
}

function attemptAt(attempt) {
  return nullableIso(attempt?.completedAt ?? attempt?.submittedAt ?? attempt?.updatedAt);
}

function submissionAt(submission) {
  return nullableIso(submission?.submittedAt ?? submission?.completedAt ?? submission?.updatedAt);
}

function fullVerification(value) {
  const verification = isRecord(value?.verification) ? value.verification : value;
  const total = boundedInt(verification?.total, 0, 0, MAX_EVIDENCE_COUNT);
  const passed = boundedInt(verification?.passed, 0, 0, total);
  return total > 0 && passed === total;
}

function cleanAttemptSolve(attempt) {
  if (!attemptAt(attempt)) return false;
  if (attempt.practiceKind && attempt.practiceKind !== "solving") return false;
  if (attempt.outcome !== "completed") return false;
  if (attempt.qualification !== "solved" && attempt.qualification !== "independent") return false;
  if (Number(attempt.peeks) !== 0 || assistedEvidence(attempt)) return false;
  return fullVerification(attempt.verification);
}

function cleanSubmissionSolve(submission) {
  if (!submissionAt(submission)) return false;
  const verdict = String(submission.status ?? submission.verdict ?? "").toLowerCase();
  if (verdict !== "accepted" && verdict !== "passed") return false;
  if (submission.assistanceUsed !== false) return false;
  if (assistedEvidence(submission)) return false;
  return fullVerification(submission);
}

function assistedEvidence(value) {
  return Boolean(
    value?.assistanceUsed === true ||
      Number(value?.peeks ?? 0) > 0 ||
      Number(value?.maxHintLevel ?? value?.hintLevel ?? 0) > 0 ||
      value?.referenceRevealedAt ||
      value?.answerUnlockedAt ||
      value?.qualification === "assisted" ||
      value?.qualification === "guided",
  );
}

function contaminatedBefore(exposure, solveAt) {
  if (!exposure) return false;
  const solveTime = timeMs(solveAt);
  if (solveTime === null) return true;
  const firstHintTime = timeMs(exposure.firstHintedAt);
  const referenceTime = timeMs(exposure.referenceRevealedAt);
  if (exposure.maxHintLevel > 0 && firstHintTime === null) return true;
  return (
    (firstHintTime !== null && firstHintTime <= solveTime) ||
    (referenceTime !== null && referenceTime <= solveTime)
  );
}

function hintedBefore(exposure, solveAt) {
  if (!exposure) return false;
  const solveTime = timeMs(solveAt);
  if (solveTime === null) return true;
  const firstHintTime = timeMs(exposure.firstHintedAt);
  if (exposure.maxHintLevel > 0 && firstHintTime === null) return true;
  return firstHintTime !== null && firstHintTime <= solveTime;
}

function cappedCount(value) {
  return Math.min(MAX_EVIDENCE_COUNT, value);
}

function activityAt(value, timestampReader) {
  return timestampReader(value);
}

function latestIso(values) {
  return values.reduce((latest, value) => later(latest, value), null);
}

function classifiedSolveSchedule(events, exposure) {
  const firstColdIndex = events.findIndex(
    (event) => !contaminatedBefore(exposure, event.at),
  );
  if (firstColdIndex < 0) {
    return {
      evidenceEvents: events.map((event) => ({
        ...event,
        evidenceClass: "assisted-reconstruction",
        advancesSchedule: false,
        intervalIndex: null,
        nextDueAt: null,
      })),
      spacedEvents: [],
      dueAt: null,
    };
  }

  let spacedCount = 0;
  let dueTime = null;
  const spacedEvents = [];
  const evidenceEvents = events.map((event, index) => {
    const eventTime = Date.parse(event.at);
    if (index < firstColdIndex || hintedBefore(exposure, event.at)) {
      return {
        ...event,
        evidenceClass: "assisted-reconstruction",
        advancesSchedule: false,
        intervalIndex: null,
        nextDueAt: dueTime === null ? null : new Date(dueTime).toISOString(),
      };
    }
    if (index === firstColdIndex) {
      spacedEvents.push(event);
      dueTime = eventTime + REVIEW_DAYS[0] * DAY_MS;
      return {
        ...event,
        evidenceClass: "cold-proof",
        advancesSchedule: true,
        intervalIndex: 0,
        nextDueAt: new Date(dueTime).toISOString(),
      };
    }
    if (dueTime !== null && eventTime >= dueTime) {
      spacedCount += 1;
      spacedEvents.push(event);
      const interval = REVIEW_DAYS[
        Math.min(spacedCount, REVIEW_DAYS.length - 1)
      ];
      dueTime = eventTime + interval * DAY_MS;
      return {
        ...event,
        evidenceClass: "spaced-recheck",
        advancesSchedule: true,
        intervalIndex: spacedCount,
        nextDueAt: new Date(dueTime).toISOString(),
      };
    }
    return {
      ...event,
      evidenceClass: "early-reconstruction",
      advancesSchedule: false,
      intervalIndex: null,
      nextDueAt: dueTime === null ? null : new Date(dueTime).toISOString(),
    };
  });
  return {
    evidenceEvents,
    spacedEvents,
    dueAt: dueTime === null ? null : new Date(dueTime).toISOString(),
  };
}

function eligibleVariant(variant, eligibleVariantIds) {
  if (!isRecord(variant)) return false;
  const variantId = variantIdOf(variant);
  if (!variantId) return false;
  if (eligibleVariantIds && !eligibleVariantIds.has(variantId)) return false;
  if (variant.eligible === false || variant.active === false || variant.available === false) return false;
  if (variant.archivedAt) return false;
  return !["archived", "disabled", "inactive"].includes(variant.status);
}

function normalizedVariants(value) {
  const byId = new Map();
  for (const variant of Array.isArray(value) ? value : []) {
    const variantId = variantIdOf(variant);
    if (variantId) byId.set(variantId, variant);
  }
  return [...byId.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([variantId, variant]) => ({ variantId, variant, variantRevision: variantRevisionOf(variant) }));
}

export function deriveTransferProgress(input = {}) {
  const now = iso(input.now, ISO_EPOCH);
  const nowTime = Date.parse(now);
  const workspace = normalizeTransferWorkspace(input.workspace, { now });
  const attempts = Array.isArray(input.attempts) ? input.attempts : [];
  const submissions = Array.isArray(input.submissions) ? input.submissions : [];
  const allowedIds = eligibleIdSet(input.eligibleVariantIds);
  const exposureByKey = new Map(
    workspace.exposures.map((entry) => [exposureKey(entry.variantId, entry.variantRevision), entry]),
  );

  return normalizedVariants(input.variants).map(({ variantId, variant, variantRevision }) => {
    const exposure = exposureByKey.get(exposureKey(variantId, variantRevision)) ?? null;
    const allAttempts = attempts.filter((entry) => evidenceVariantId(entry) === variantId);
    const allSubmissions = submissions.filter((entry) => evidenceVariantId(entry) === variantId);
    const currentAttempts = allAttempts.filter((entry) => isCurrentEvidence(entry, variantId, variantRevision));
    const currentSubmissions = allSubmissions.filter((entry) => isCurrentEvidence(entry, variantId, variantRevision));
    const solveEvents = [];
    const solvedAttemptIds = new Set();
    for (const attempt of currentAttempts) {
      if (!cleanAttemptSolve(attempt)) continue;
      const at = attemptAt(attempt);
      if (!at || Date.parse(at) > nowTime) continue;
      const id = cleanId(attempt.id ?? attempt.attemptId);
      if (id) solvedAttemptIds.add(id);
      solveEvents.push({ at, source: "attempt", id: id || `attempt:${at}` });
    }
    for (const submission of currentSubmissions) {
      if (!cleanSubmissionSolve(submission)) continue;
      const at = submissionAt(submission);
      if (!at || Date.parse(at) > nowTime) continue;
      const linkedAttemptId = cleanId(submission.attemptId);
      if (linkedAttemptId && solvedAttemptIds.has(linkedAttemptId)) continue;
      const id = cleanId(submission.id ?? submission.submissionId);
      solveEvents.push({ at, source: "submission", id: id || `submission:${at}` });
    }
    solveEvents.sort((left, right) => Date.parse(left.at) - Date.parse(right.at) || left.id.localeCompare(right.id));
    const seenSolveIds = new Set();
    const deduplicatedSolveEvents = solveEvents.filter((event) => {
      const key = `${event.source}\u0000${event.id}`;
      if (seenSolveIds.has(key)) return false;
      seenSolveIds.add(key);
      return true;
    });
    const initialSolveIndex = deduplicatedSolveEvents.findIndex(
      (event) => !contaminatedBefore(exposure, event.at),
    );
    const independentSolveEvents =
      initialSolveIndex < 0
        ? []
        : deduplicatedSolveEvents
            .slice(initialSolveIndex)
            .filter((event) => !contaminatedBefore(exposure, event.at));
    // A debrief reveal permanently means later work is not another cold solve,
    // but it must not make spaced retrieval impossible. Once a genuine cold
    // proof exists, later attempt-specific clean solves can advance the review
    // cadence. A recorded hint still blocks later evidence because the
    // aggregate exposure model cannot safely prove which subsequent attempt it
    // influenced.
    const { evidenceEvents, spacedEvents, dueAt } = classifiedSolveSchedule(
      deduplicatedSolveEvents,
      exposure,
    );
    const unassistedRetestEvents = evidenceEvents.filter(
      (event) =>
        event.evidenceClass === "spaced-recheck" ||
        event.evidenceClass === "early-reconstruction",
    );
    const isProven = spacedEvents.length > 0;
    const isDue = Boolean(isProven && dueAt && Date.parse(dueAt) <= nowTime);
    const hasAnyEvidence = allAttempts.length > 0 || allSubmissions.length > 0;
    const hasOpenEvidence = Boolean(exposure);
    const isOpened = hasOpenEvidence || hasAnyEvidence;
    const isAttempted = currentAttempts.length > 0 || currentSubmissions.length > 0;
    const isAssisted = Boolean(
      exposure?.maxHintLevel > 0 ||
        exposure?.referenceRevealedAt ||
        currentAttempts.some(assistedEvidence) ||
        currentSubmissions.some(assistedEvidence),
    );
    const exposureUnknown = workspace.coverage !== "complete" && !exposure && !hasAnyEvidence;
    const isUnseen = !exposureUnknown && !isOpened && !isAttempted && !isAssisted;
    const status = isUnseen
      ? "unseen"
      : isDue
        ? "due"
        : isProven
          ? "proven"
          : isAssisted
            ? "assisted"
            : isAttempted
              ? "attempted"
              : "opened";
    const substantiveFailureVerdicts = new Set([
      "wrong-answer",
      "runtime-error",
      "time-limit",
      "invalid-entrypoint",
    ]);
    const failedSubmissionCount = currentSubmissions.filter((submission) => {
      const verdict = String(submission?.status ?? submission?.verdict ?? "").toLowerCase();
      return substantiveFailureVerdicts.has(verdict);
    }).length;
    const lastActivityAt = latestIso([
      exposure?.lastOpenedAt,
      exposure?.lastHintedAt,
      exposure?.referenceRevealedAt,
      ...allAttempts.map((entry) => activityAt(entry, attemptAt)),
      ...allSubmissions.map((entry) => activityAt(entry, submissionAt)),
    ]);
    return {
      variantId,
      variantRevision,
      eligible: eligibleVariant(variant, allowedIds),
      status,
      isUnseen,
      isOpened,
      isAttempted,
      isAssisted,
      isProven,
      isDue,
      exposureUnknown,
      evidenceCoverage: workspace.coverage,
      exposure,
      attemptCount: cappedCount(currentAttempts.length),
      submissionCount: cappedCount(currentSubmissions.length),
      failedSubmissionCount: cappedCount(failedSubmissionCount),
      independentSolveCount: cappedCount(independentSolveEvents.length),
      unassistedRetestCount: cappedCount(unassistedRetestEvents.length),
      spacedSolveCount: cappedCount(spacedEvents.length),
      solveEvidenceEvents: evidenceEvents,
      firstProvenAt: spacedEvents[0]?.at ?? null,
      lastProvenAt: spacedEvents.at(-1)?.at ?? null,
      dueAt,
      lastActivityAt,
    };
  });
}

function eligibleIdSet(value) {
  if (value == null) return null;
  const ids = new Set();
  if (typeof value?.[Symbol.iterator] !== "function") return ids;
  try {
    for (const entry of value) {
      const id = cleanId(entry);
      if (id) ids.add(id);
    }
  } catch {
    return new Set();
  }
  return ids;
}

export function selectNextTransferVariant(input = {}) {
  const variants = normalizedVariants(input.variants);
  const allowedIds = eligibleIdSet(input.eligibleVariantIds);
  const progress = deriveTransferProgress({ ...input, eligibleVariantIds: allowedIds });
  const progressById = new Map(progress.map((entry) => [entry.variantId, entry]));
  const candidates = variants.flatMap(({ variantId, variant }) => {
    if (!eligibleVariant(variant, allowedIds)) return [];
    const evidence = progressById.get(variantId);
    if (!evidence) return [];
    const bucket = evidence.isUnseen
      ? 0
      : evidence.isDue
        ? 1
        : !evidence.isProven && (evidence.isAttempted || evidence.isAssisted || evidence.isOpened)
          ? 2
          : Number.POSITIVE_INFINITY;
    return Number.isFinite(bucket) ? [{ variantId, variant, evidence, bucket }] : [];
  });
  candidates.sort((left, right) => {
    if (left.bucket !== right.bucket) return left.bucket - right.bucket;
    if (left.bucket === 1) {
      const dueDelta = (timeMs(left.evidence.dueAt) ?? 0) - (timeMs(right.evidence.dueAt) ?? 0);
      if (dueDelta) return dueDelta;
    }
    if (left.bucket === 2) {
      const statusRank = { attempted: 0, assisted: 1, opened: 2 };
      const statusDelta =
        (statusRank[left.evidence.status] ?? 3) - (statusRank[right.evidence.status] ?? 3);
      if (statusDelta) return statusDelta;
      const activityDelta =
        (timeMs(left.evidence.lastActivityAt) ?? 0) -
        (timeMs(right.evidence.lastActivityAt) ?? 0);
      if (activityDelta) return activityDelta;
    }
    return left.variantId.localeCompare(right.variantId);
  });
  return candidates[0]?.variant ?? null;
}
