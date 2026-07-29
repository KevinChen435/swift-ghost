export const TYPING_PROGRESSION_VERSION = 1;
export const TYPING_PROGRESSION_RECORD_LIMIT = 256;
export const TYPING_PROGRESSION_ATTEMPT_LIMIT = 256;
export const TYPING_PROGRESSION_REFERENCE_LIMIT = 64;
export const TYPING_REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30];
export const TYPING_STAGE_PHASES = Object.freeze({
  1: "worked",
  2: "faded",
  3: "faded",
  4: "faded",
  5: "recall",
});

const EPOCH = "1970-01-01T00:00:00.000Z";
const DAY_MS = 86_400_000;
const MAX_DATE_MS = 253_402_300_799_999;
const MAX_ATTEMPT_DATE_MS = MAX_DATE_MS - 30 * DAY_MS;
const QUALIFICATIONS = new Set([
  "syntax",
  "guided",
  "independent",
  "solved",
  "assisted",
  "incomplete",
]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanId(value, limit = 160) {
  if (typeof value !== "string") return "";
  const cleaned = Array.from(value.trim()).slice(0, limit).join("");
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9._:/-]{0,158}[a-zA-Z0-9])?$/.test(cleaned)
    ? cleaned
    : "";
}

function cleanIso(value, fallback = null) {
  if (typeof value !== "string" || value.length > 64) return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= 0 && timestamp <= MAX_DATE_MS
    ? new Date(timestamp).toISOString()
    : fallback;
}

function integer(value, fallback, min, max) {
  const number = Number(value);
  return Number.isInteger(number)
    ? Math.max(min, Math.min(max, number))
    : fallback;
}

function exactInteger(value, min, max) {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : 0;
}

function exactFiniteNumber(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function revisionRegistry(options) {
  const source = options?.revisions;
  if (source instanceof Map) return new Map(source);
  if (isRecord(source)) return new Map(Object.entries(source));
  return null;
}

function validItemRegistry(options) {
  if (!options || !("validItemIds" in options)) return null;
  try {
    return new Set(options.validItemIds ?? []);
  } catch {
    return new Set();
  }
}

function allowedItem(itemId, itemRevision, options) {
  const validIds = validItemRegistry(options);
  if (validIds && !validIds.has(itemId)) return false;
  const revisions = revisionRegistry(options);
  if (!revisions || !revisions.has(itemId)) return true;
  return exactInteger(revisions.get(itemId), 1, 1_000_000) === itemRevision;
}

function compareAttempt(a, b) {
  return a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id);
}

function compareReference(a, b) {
  return a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id);
}

function normalizeAttempt(value, options = {}) {
  if (!isRecord(value)) return null;
  const id = cleanId(value.id);
  const itemId = cleanId(value.itemId);
  const itemRevision = exactInteger(value.itemRevision, 1, 1_000_000);
  const stage = exactInteger(value.stage, 1, 5);
  const completedAt = cleanIso(value.completedAt);
  if (
    !id ||
    !itemId ||
    !itemRevision ||
    !stage ||
    !completedAt ||
    Date.parse(completedAt) > MAX_ATTEMPT_DATE_MS ||
    value.practiceKind !== "typing" ||
    !["completed", "abandoned"].includes(value.outcome) ||
    !QUALIFICATIONS.has(value.qualification) ||
    !allowedItem(itemId, itemRevision, options)
  )
    return null;
  const accuracy = exactFiniteNumber(value.accuracy, 0, 100);
  const corrections = exactInteger(value.corrections, 0, 1_000_000);
  const peeks = exactInteger(value.peeks, 0, 1_000_000);
  if (accuracy === null || (!corrections && value.corrections !== 0) || (!peeks && value.peeks !== 0))
    return null;
  return {
    id,
    itemId,
    itemRevision,
    stage,
    practiceKind: "typing",
    outcome: value.outcome,
    qualification: value.qualification,
    accuracy,
    corrections,
    peeks,
    completedAt,
  };
}

function cleanStageList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((stage) =>
    exactInteger(stage, 1, 5),
  ).filter(Boolean))].sort((a, b) => a - b);
}

function cleanReferences(value) {
  const byId = new Map();
  for (const raw of Array.isArray(value) ? value : []) {
    if (!isRecord(raw)) continue;
    const id = cleanId(raw.id);
    const completedAt = cleanIso(raw.completedAt);
    const stage = exactInteger(raw.stage, 1, 5);
    if (!id || !completedAt || !stage) continue;
    const reference = {
      id,
      stage,
      completedAt,
      ...(raw.diagnosticBypass ? { diagnosticBypass: true } : {}),
    };
    const prior = byId.get(id);
    if (!prior || compareReference(prior, reference) <= 0) byId.set(id, reference);
  }
  return [...byId.values()]
    .sort(compareReference)
    .slice(-TYPING_PROGRESSION_REFERENCE_LIMIT);
}

function nextStageFor(completedStages, owned) {
  if (owned) return 5;
  if (!completedStages.includes(1)) return 1;
  const highestFaded = completedStages.reduce(
    (highest, stage) => (stage >= 2 && stage <= 4 ? Math.max(highest, stage) : highest),
    0,
  );
  return highestFaded ? Math.min(5, highestFaded + 1) : 2;
}

function normalizeRecord(value, options = {}) {
  if (!isRecord(value)) return null;
  const itemId = cleanId(value.itemId);
  const itemRevision = exactInteger(value.itemRevision, 1, 1_000_000);
  const updatedAt = cleanIso(value.updatedAt);
  if (!itemId || !itemRevision || !updatedAt || !allowedItem(itemId, itemRevision, options))
    return null;
  const completedStages = cleanStageList(value.completedStages);
  const references = cleanReferences(value.references);
  const recallLevel = integer(value.recallLevel, 0, 0, 5);
  const dueAt = cleanIso(value.dueAt);
  const firstWorkedAt = completedStages.includes(1) ? cleanIso(value.firstWorkedAt) : null;
  const firstFadedAt = completedStages.some((stage) => stage >= 2 && stage <= 4)
    ? cleanIso(value.firstFadedAt)
    : null;
  const candidateFirstOwnedAt = cleanIso(value.firstOwnedAt);
  const firstEligibleFadedAt = firstWorkedAt
    ? cleanIso(value.firstEligibleFadedAt) ??
      references.find(
        (reference) =>
          reference.stage >= 2 &&
          reference.stage <= 4 &&
          reference.completedAt >= firstWorkedAt &&
          (!candidateFirstOwnedAt || reference.completedAt <= candidateFirstOwnedAt),
      )?.completedAt ??
      null
    : null;
  const validOwnership = Boolean(
    value.owned &&
      recallLevel > 0 &&
      dueAt &&
      completedStages.includes(5) &&
      firstWorkedAt &&
      firstEligibleFadedAt &&
      candidateFirstOwnedAt &&
      firstWorkedAt <= candidateFirstOwnedAt &&
      firstEligibleFadedAt <= candidateFirstOwnedAt,
  );
  const owned = validOwnership;
  const firstOwnedAt = owned ? candidateFirstOwnedAt : null;
  const lastAttemptAt = cleanIso(value.lastAttemptAt, references.at(-1)?.completedAt ?? null);
  const bypassAttemptIds = [...new Set(
    (Array.isArray(value.bypassAttemptIds) ? value.bypassAttemptIds : [])
      .map((id) => cleanId(id))
      .filter(Boolean),
  )].slice(-TYPING_PROGRESSION_REFERENCE_LIMIT);
  return {
    itemId,
    itemRevision,
    completedStages,
    references,
    attemptCount: integer(value.attemptCount, references.length, references.length, 1_000_000),
    diagnosticCount: integer(value.diagnosticCount, bypassAttemptIds.length, bypassAttemptIds.length, 1_000_000),
    bypassAttemptIds,
    owned,
    retained: owned && Boolean(value.retained),
    recallLevel: owned ? recallLevel : 0,
    dueAt: dueAt ?? null,
    lapses: integer(value.lapses, 0, 0, 1_000_000),
    firstWorkedAt: firstWorkedAt ?? null,
    firstFadedAt: firstFadedAt ?? null,
    firstEligibleFadedAt,
    firstOwnedAt: firstOwnedAt ?? null,
    lastAttemptAt: lastAttemptAt ?? null,
    updatedAt,
  };
}

function emptyRecord(itemId, itemRevision, now) {
  return {
    itemId,
    itemRevision,
    completedStages: [],
    references: [],
    attemptCount: 0,
    diagnosticCount: 0,
    bypassAttemptIds: [],
    owned: false,
    retained: false,
    recallLevel: 0,
    dueAt: null,
    lapses: 0,
    firstWorkedAt: null,
    firstFadedAt: null,
    firstEligibleFadedAt: null,
    firstOwnedAt: null,
    lastAttemptAt: null,
    updatedAt: now,
  };
}

export function typingStagePhase(stage) {
  return TYPING_STAGE_PHASES[exactInteger(stage, 1, 5)] ?? null;
}

export function isCleanTypingRecall(attempt) {
  const normalized = normalizeAttempt(attempt);
  return Boolean(
    normalized &&
      normalized.stage === 5 &&
      normalized.outcome === "completed" &&
      normalized.qualification === "independent" &&
      normalized.accuracy >= 95 &&
      normalized.peeks === 0
  );
}

export function createTypingProgression(now = EPOCH) {
  return {
    version: TYPING_PROGRESSION_VERSION,
    revision: 0,
    updatedAt: cleanIso(now, EPOCH),
    records: [],
    attempts: [],
  };
}

export function normalizeTypingProgression(value, options = {}) {
  if (!isRecord(value) || value.version !== TYPING_PROGRESSION_VERSION)
    return createTypingProgression(options.now);
  const byItem = new Map();
  for (const raw of Array.isArray(value.records) ? value.records : []) {
    const record = normalizeRecord(raw, options);
    if (!record) continue;
    const prior = byItem.get(record.itemId);
    if (
      !prior ||
      record.itemRevision > prior.itemRevision ||
      (record.itemRevision === prior.itemRevision && record.updatedAt >= prior.updatedAt)
    )
      byItem.set(record.itemId, record);
  }
  const records = [...byItem.values()]
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.itemId.localeCompare(b.itemId))
    .slice(-TYPING_PROGRESSION_RECORD_LIMIT);
  const currentRevision = new Map(records.map((record) => [record.itemId, record.itemRevision]));
  const attemptsById = new Map();
  for (const raw of Array.isArray(value.attempts) ? value.attempts : []) {
    const attempt = normalizeAttempt(raw, options);
    if (!attempt || currentRevision.get(attempt.itemId) !== attempt.itemRevision) continue;
    const prior = attemptsById.get(attempt.id);
    if (!prior || compareAttempt(prior, attempt) <= 0) attemptsById.set(attempt.id, attempt);
  }
  const attempts = [...attemptsById.values()]
    .sort(compareAttempt)
    .slice(-TYPING_PROGRESSION_ATTEMPT_LIMIT);
  return {
    version: TYPING_PROGRESSION_VERSION,
    revision: integer(value.revision, 0, 0, 1_000_000),
    updatedAt: cleanIso(value.updatedAt, cleanIso(options.now, EPOCH)),
    records,
    attempts,
  };
}

function addDays(iso, days) {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}

function applyToRecord(record, attempt) {
  const completed = attempt.outcome === "completed";
  const completedStages = completed
    ? cleanStageList([...record.completedStages, attempt.stage])
    : record.completedStages;
  const hasWorked = Boolean(record.firstWorkedAt);
  const hasOrderedFaded = Boolean(record.firstEligibleFadedAt);
  const stageFive = attempt.stage === 5;
  const cleanRecall = stageFive && isCleanTypingRecall(attempt);
  const diagnosticBypass = stageFive && !(hasWorked && hasOrderedFaded);
  let owned = record.owned;
  let retained = record.retained;
  let recallLevel = record.recallLevel;
  let dueAt = record.dueAt;
  let lapses = record.lapses;
  let firstOwnedAt = record.firstOwnedAt;
  if (stageFive && cleanRecall && !diagnosticBypass) {
    if (!owned) {
      owned = true;
      retained = true;
      recallLevel = 1;
      dueAt = addDays(attempt.completedAt, TYPING_REVIEW_INTERVAL_DAYS[0]);
      firstOwnedAt = attempt.completedAt;
    } else if (dueAt && Date.parse(attempt.completedAt) < Date.parse(dueAt)) {
      retained = true;
    } else {
      const intervalIndex = Math.min(recallLevel, TYPING_REVIEW_INTERVAL_DAYS.length - 1);
      recallLevel = Math.min(5, recallLevel + 1);
      retained = true;
      dueAt = addDays(attempt.completedAt, TYPING_REVIEW_INTERVAL_DAYS[intervalIndex]);
    }
  } else if (stageFive && !cleanRecall) {
    retained = false;
    lapses = Math.min(1_000_000, lapses + 1);
    dueAt = addDays(attempt.completedAt, 1);
  }
  const reference = {
    id: attempt.id,
    stage: attempt.stage,
    completedAt: attempt.completedAt,
    ...(diagnosticBypass ? { diagnosticBypass: true } : {}),
  };
  return {
    ...record,
    completedStages,
    references: [...record.references, reference]
      .sort(compareReference)
      .slice(-TYPING_PROGRESSION_REFERENCE_LIMIT),
    attemptCount: Math.min(1_000_000, record.attemptCount + 1),
    diagnosticCount: Math.min(
      1_000_000,
      record.diagnosticCount + (diagnosticBypass ? 1 : 0),
    ),
    bypassAttemptIds: diagnosticBypass
      ? [...new Set([...record.bypassAttemptIds, attempt.id])].slice(-TYPING_PROGRESSION_REFERENCE_LIMIT)
      : record.bypassAttemptIds,
    owned,
    retained: owned && retained,
    recallLevel: owned ? recallLevel : 0,
    dueAt,
    lapses,
    firstWorkedAt:
      record.firstWorkedAt ?? (completed && attempt.stage === 1 ? attempt.completedAt : null),
    firstFadedAt:
      record.firstFadedAt ??
      (completed && attempt.stage >= 2 && attempt.stage <= 4 ? attempt.completedAt : null),
    firstEligibleFadedAt:
      record.firstEligibleFadedAt ??
      (completed &&
      attempt.stage >= 2 &&
      attempt.stage <= 4 &&
      record.firstWorkedAt &&
      attempt.completedAt >= record.firstWorkedAt
        ? attempt.completedAt
        : null),
    firstOwnedAt,
    lastAttemptAt:
      !record.lastAttemptAt || attempt.completedAt >= record.lastAttemptAt
        ? attempt.completedAt
        : record.lastAttemptAt,
    updatedAt:
      attempt.completedAt >= record.updatedAt ? attempt.completedAt : record.updatedAt,
  };
}

export function applyTypingAttempt(workspace, input, options = {}) {
  const normalized = normalizeTypingProgression(workspace, options);
  const attempt = normalizeAttempt(input, options);
  if (!attempt) return normalized;
  if (
    normalized.attempts.some((candidate) => candidate.id === attempt.id) ||
    normalized.records.some((record) =>
      record.references.some((reference) => reference.id === attempt.id),
    )
  )
    return normalized;
  const existing = normalized.records.find((record) => record.itemId === attempt.itemId);
  if (existing && attempt.itemRevision < existing.itemRevision) return normalized;
  if (
    existing?.itemRevision === attempt.itemRevision &&
    existing.lastAttemptAt &&
    attempt.completedAt < existing.lastAttemptAt
  )
    return normalized;
  const base =
    existing?.itemRevision === attempt.itemRevision
      ? existing
      : emptyRecord(attempt.itemId, attempt.itemRevision, attempt.completedAt);
  const nextRecord = applyToRecord(base, attempt);
  const records = normalized.records
    .filter((record) => record.itemId !== attempt.itemId)
    .concat(nextRecord)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.itemId.localeCompare(b.itemId))
    .slice(-TYPING_PROGRESSION_RECORD_LIMIT);
  const keptItems = new Map(records.map((record) => [record.itemId, record.itemRevision]));
  const attempts = [...normalized.attempts, attempt]
    .filter((candidate) => keptItems.get(candidate.itemId) === candidate.itemRevision)
    .sort(compareAttempt)
    .slice(-TYPING_PROGRESSION_ATTEMPT_LIMIT);
  return {
    version: TYPING_PROGRESSION_VERSION,
    revision: Math.min(1_000_000, normalized.revision + 1),
    updatedAt:
      attempt.completedAt >= normalized.updatedAt ? attempt.completedAt : normalized.updatedAt,
    records,
    attempts,
  };
}

export function rebuildTypingProgression(attempts, options = {}) {
  const normalizedAttempts = [];
  const seen = new Set();
  for (const raw of Array.isArray(attempts) ? attempts : []) {
    const attempt = normalizeAttempt(raw, options);
    if (!attempt || seen.has(attempt.id)) continue;
    seen.add(attempt.id);
    normalizedAttempts.push(attempt);
  }
  const revisions = revisionRegistry(options);
  const latestRevision = new Map();
  for (const attempt of normalizedAttempts) {
    if (revisions?.has(attempt.itemId)) continue;
    latestRevision.set(
      attempt.itemId,
      Math.max(latestRevision.get(attempt.itemId) ?? 0, attempt.itemRevision),
    );
  }
  let workspace = createTypingProgression(options.now);
  for (const attempt of normalizedAttempts
    .filter((candidate) => {
      const expected = revisions?.has(candidate.itemId)
        ? exactInteger(revisions.get(candidate.itemId), 1, 1_000_000)
        : latestRevision.get(candidate.itemId);
      return candidate.itemRevision === expected;
    })
    .sort(compareAttempt)) {
    workspace = applyTypingAttempt(workspace, attempt, options);
  }
  return workspace;
}

export function deriveTypingProgression(workspace, itemId, itemRevision, now = EPOCH) {
  const cleanItemId = cleanId(itemId);
  const cleanRevision = exactInteger(itemRevision, 1, 1_000_000);
  const asOf = cleanIso(now, EPOCH);
  const normalized = normalizeTypingProgression(workspace);
  const record = normalized.records.find(
    (candidate) => candidate.itemId === cleanItemId && candidate.itemRevision === cleanRevision,
  ) ?? emptyRecord(cleanItemId, cleanRevision, asOf);
  const nextStage = nextStageFor(record.completedStages, record.owned);
  const attemptIds = record.references.map((reference) => reference.id);
  const attemptTimestamps = record.references.map((reference) => reference.completedAt);
  const due = Boolean(record.owned && record.dueAt && Date.parse(record.dueAt) <= Date.parse(asOf));
  return {
    itemId: cleanItemId,
    itemRevision: cleanRevision,
    completedStages: [...record.completedStages],
    attemptIds,
    attemptTimestamps,
    attemptCount: record.attemptCount,
    nextStage,
    phase: typingStagePhase(nextStage),
    owned: record.owned,
    retained: record.retained,
    due,
    recallLevel: record.recallLevel,
    dueAt: record.dueAt,
    lapses: record.lapses,
    updatedAt: record.updatedAt,
    firstWorkedAt: record.firstWorkedAt,
    firstFadedAt: record.firstFadedAt,
    firstEligibleFadedAt: record.firstEligibleFadedAt,
    firstOwnedAt: record.firstOwnedAt,
    lastAttemptAt: record.lastAttemptAt,
    hasDiagnosticBypass: record.diagnosticCount > 0,
    diagnosticOnly: record.diagnosticCount > 0 && !record.owned,
    diagnosticCount: record.diagnosticCount,
    bypassAttemptIds: [...record.bypassAttemptIds],
  };
}

export function recommendedTypingStage(workspace, itemId, itemRevision, now = EPOCH) {
  return deriveTypingProgression(workspace, itemId, itemRevision, now).nextStage;
}

export function typingReviewStatus(workspace, itemId, itemRevision, now = EPOCH) {
  const progress = deriveTypingProgression(workspace, itemId, itemRevision, now);
  const status = !progress.owned
    ? progress.diagnosticOnly
      ? "diagnostic"
      : "learning"
    : !progress.retained
      ? "lapsed"
      : progress.due
        ? "due"
        : progress.recallLevel >= 5
          ? "retained"
          : "scheduled";
  return {
    status,
    owned: progress.owned,
    retained: progress.retained,
    due: progress.due,
    level: progress.recallLevel,
    dueAt: progress.dueAt,
    lapses: progress.lapses,
  };
}

export function summarizeTypingProgression(workspace, options = {}) {
  const normalized = normalizeTypingProgression(workspace, options);
  const now = cleanIso(options.now, EPOCH);
  const records = normalized.records.map((record) =>
    deriveTypingProgression(normalized, record.itemId, record.itemRevision, now),
  );
  return {
    itemCount: records.length,
    ownedCount: records.filter((record) => record.owned).length,
    retainedCount: records.filter((record) => record.retained).length,
    dueCount: records.filter((record) => record.due).length,
    learningCount: records.filter((record) => !record.owned).length,
    diagnosticCount: records.filter((record) => record.hasDiagnosticBypass).length,
    records,
  };
}
