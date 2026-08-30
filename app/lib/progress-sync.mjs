import {
  normalizeLearningEvents,
} from "./learning-state.mjs";
import {
  rebuildTypingProgression,
  normalizeTypingProgression,
} from "./typing-progression.mjs";

/**
 * Private progress sync intentionally contains only bounded, source-free
 * evidence.  It is separate from Study Plans so a future sync expansion does
 * not accidentally make drafts, source, or custom authored content remote.
 */
export const PROGRESS_SYNC_VERSION = 1;
export const PROGRESS_SYNC_LIMITS = Object.freeze({
  maxAttempts: 1_000,
  maxLearningEvents: 1_000,
  maxBytes: 256 * 1024,
});

/**
 * Conflict history intentionally stores a small, source-free account of a
 * transport collision. It is not an evidence ledger and must never grow with
 * the full progress snapshot.
 */
export const PROGRESS_CONFLICT_SUMMARY_VERSION = 1;
export const PROGRESS_CONFLICT_LIMITS = Object.freeze({
  maxEntities: 50,
  maxBytes: 32 * 1024,
});

const encoder = new TextEncoder();
const MAX_DATE_MS = 253_402_300_799_999;
const QUALIFICATIONS = new Set([
  "syntax",
  "guided",
  "independent",
  "solved",
  "assisted",
  "incomplete",
]);
const PRACTICE_KINDS = new Set(["typing", "solving", "concept"]);
const MODES = new Set(["strict", "free"]);

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

/** Only catalog-backed identifiers can cross the private progress boundary. */
export function isProgressSyncableItemId(value) {
  const itemId = cleanId(value, 96);
  return /^(?:builtin:\d{1,8}|python:\d{1,8}|swift:[a-z0-9][a-z0-9-]{0,79}|ios:[a-z0-9][a-z0-9-]{0,79})$/i.test(
    itemId,
  );
}

function cleanIso(value, fallback = null) {
  if (typeof value !== "string" || value.length > 64) return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= 0 && timestamp <= MAX_DATE_MS
    ? new Date(timestamp).toISOString()
    : fallback;
}

function cleanDayKey(value, fallback = null) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return fallback;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return fallback;
  const date = new Date(timestamp);
  return date.toISOString().slice(0, 10) === value ? value : fallback;
}

function integer(value, fallback, min, max) {
  const number = Number(value);
  return Number.isInteger(number)
    ? Math.max(min, Math.min(max, number))
    : fallback;
}

function finite(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, number))
    : fallback;
}

function jsonBytes(value) {
  try {
    return encoder.encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function normalizeVerification(value) {
  if (!isRecord(value)) return undefined;
  const total = integer(value.total, 0, 0, 10_000);
  const passed = integer(value.passed, 0, 0, total);
  if (total < 1) return undefined;
  return {
    revision: integer(value.revision, 1, 1, 1_000_000),
    passed,
    total,
    runs: integer(value.runs, 0, 0, 100_000),
    submissions: integer(value.submissions, 0, 0, 100_000),
  };
}

/**
 * Keep attempt metrics useful for analytics while dropping source-adjacent
 * fields such as timelines, key errors, line errors, title snapshots, and
 * session/custom-content references.
 */
function allowedProgressItemId(value, options = {}) {
  if (!isProgressSyncableItemId(value)) return false;
  if (!Array.isArray(options.validItemIds)) return true;
  return options.validItemIds.includes(value);
}

function normalizeProgressAttempt(value, options = {}) {
  if (!isRecord(value)) return undefined;
  const id = cleanId(value.id);
  const itemId = cleanId(value.itemId, 96);
  const itemRevision = integer(value.itemRevision, 0, 1, 1_000_000);
  const stage = integer(value.stage, 0, 1, 5);
  const practiceKind = PRACTICE_KINDS.has(value.practiceKind)
    ? value.practiceKind
    : null;
  const mode = MODES.has(value.mode) ? value.mode : null;
  const startedAt = cleanIso(value.startedAt);
  const completedAt = cleanIso(value.completedAt);
  const outcome = value.outcome === "abandoned" ? "abandoned" : value.outcome === "completed" ? "completed" : null;
  const qualification = QUALIFICATIONS.has(value.qualification)
    ? value.qualification
    : null;
  if (
    !id ||
    !allowedProgressItemId(itemId, options) ||
    !itemRevision ||
    !stage ||
    !practiceKind ||
    !mode ||
    !startedAt ||
    !completedAt ||
    !outcome ||
    !qualification
  )
    return undefined;
  return {
    id,
    itemId,
    itemRevision,
    stage,
    practiceKind,
    mode,
    startedAt,
    completedAt,
    durationMs: integer(value.durationMs, 0, 0, 14_400_000),
    totalKeystrokes: integer(
      value.totalKeystrokes ?? value.typedChars,
      0,
      0,
      100_000,
    ),
    correctKeystrokes: integer(value.correctKeystrokes, 0, 0, 100_000),
    rejectedKeystrokes: integer(value.rejectedKeystrokes, 0, 0, 100_000),
    corrections: integer(value.corrections, 0, 0, 100_000),
    peeks: integer(value.peeks, 0, 0, 100_000),
    rawWpm: finite(value.rawWpm, 0, 0, 1_000),
    wpm: finite(value.wpm, 0, 0, 1_000),
    accuracy: finite(value.accuracy, 0, 0, 100),
    consistency: finite(value.consistency, 0, 0, 100),
    outcome,
    qualification,
    ...(value.conceptGrade &&
    ["again", "hard", "good", "easy"].includes(value.conceptGrade)
      ? { conceptGrade: value.conceptGrade }
      : {}),
    ...(Number.isInteger(value.conceptCheckIndex) &&
    value.conceptCheckIndex >= 0 &&
    value.conceptCheckIndex <= 2
      ? { conceptCheckIndex: value.conceptCheckIndex }
      : {}),
    ...(normalizeVerification(value.verification)
      ? { verification: normalizeVerification(value.verification) }
      : {}),
    ...(cleanDayKey(value.challengeDate)
      ? { challengeDate: cleanDayKey(value.challengeDate) }
      : {}),
  };
}

function compareAttempts(left, right) {
  return left.completedAt.localeCompare(right.completedAt) || left.id.localeCompare(right.id);
}

function normalizeAttempts(value, options = {}) {
  const byId = new Map();
  for (const raw of Array.isArray(value) ? value : []) {
    const attempt = normalizeProgressAttempt(raw, options);
    if (!attempt) continue;
    const existing = byId.get(attempt.id);
    if (
      !existing ||
      compareAttempts(existing, attempt) < 0 ||
      (compareAttempts(existing, attempt) === 0 &&
        stableJson(existing) < stableJson(attempt))
    )
      byId.set(attempt.id, attempt);
  }
  return [...byId.values()]
    .sort(compareAttempts)
    .slice(-PROGRESS_SYNC_LIMITS.maxAttempts);
}

function normalizeTypingSnapshot(value, updatedAt, options = {}) {
  const normalized = normalizeTypingProgression(value, {
    now: updatedAt,
  });
  return {
    version: 1,
    revision: integer(normalized.revision, 0, 0, 1_000_000),
    updatedAt: cleanIso(normalized.updatedAt, updatedAt),
    records: normalized.records
      .filter((record) => allowedProgressItemId(record.itemId, options))
      .map((record) => ({
        ...record,
        references: record.references.filter((reference) => cleanId(reference.id)),
        bypassAttemptIds: record.bypassAttemptIds.filter((id) => cleanId(id)),
      })),
    attempts: normalized.attempts.filter((attempt) =>
      allowedProgressItemId(attempt.itemId, options),
    ),
  };
}

function normalizeProgressEvents(value, attempts, options = {}) {
  const attemptsById = new Map(
    attempts.map((attempt) => [
      attempt.id,
      {
        itemId: attempt.itemId,
        itemRevision: attempt.itemRevision,
        practiceKind: attempt.practiceKind,
      },
    ]),
  );
  const source = (Array.isArray(value) ? value : []).flatMap((raw) => {
    if (!isRecord(raw) || !allowedProgressItemId(raw.itemId, options)) return [];
    // Deliberately omit promptSnapshot and response: sync carries outcomes,
    // not learner-authored text.
    return [{
      id: raw.id,
      attemptId: raw.attemptId,
      itemId: raw.itemId,
      itemRevision: raw.itemRevision,
      practiceKind: raw.practiceKind,
      activityKind: raw.activityKind,
      grade: raw.grade,
      friction: raw.friction,
      confidence: raw.confidence,
      createdAt: raw.createdAt,
    }];
  });
  return normalizeLearningEvents(source, { attemptsById })
    .filter((event) => allowedProgressItemId(event.itemId, options))
    .sort(compareEvents)
    .slice(-PROGRESS_SYNC_LIMITS.maxLearningEvents);
}

export function normalizeProgressSnapshot(value, options = {}) {
  const raw = isRecord(value) && isRecord(value.snapshot) ? value.snapshot : value;
  if (!isRecord(raw) || raw.version !== PROGRESS_SYNC_VERSION) return undefined;
  const updatedAt = cleanIso(raw.updatedAt, cleanIso(options.now, new Date().toISOString()));
  const revision = integer(raw.revision, 0, 0, 2_147_483_647);
  if (!updatedAt || jsonBytes(raw) > PROGRESS_SYNC_LIMITS.maxBytes) return undefined;
  const attempts = normalizeAttempts(raw.attempts, options);
  const typingProgress = normalizeTypingSnapshot(raw.typingProgress, updatedAt, options);
  const learningEvents = normalizeProgressEvents(raw.learningEvents, attempts, options);
  const snapshot = {
    version: PROGRESS_SYNC_VERSION,
    revision,
    updatedAt,
    attempts,
    typingProgress,
    learningEvents,
  };
  return jsonBytes(snapshot) <= PROGRESS_SYNC_LIMITS.maxBytes ? snapshot : undefined;
}

export function createProgressSnapshot(state = {}, options = {}) {
  const now = cleanIso(options.now, new Date().toISOString());
  return normalizeProgressSnapshot({
    version: PROGRESS_SYNC_VERSION,
    revision: 0,
    updatedAt: now,
    attempts: state.attempts,
    typingProgress: state.typingProgress,
    learningEvents: state.learningEvents,
  }, { now, validItemIds: options.validItemIds });
}

function stableJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function mergeById(left, right, compare) {
  const byId = new Map();
  for (const value of [...left, ...right]) {
    const existing = byId.get(value.id);
    if (
      !existing ||
      compare(existing, value) < 0 ||
      (compare(existing, value) === 0 && stableJson(existing) < stableJson(value))
    )
      byId.set(value.id, value);
  }
  return [...byId.values()];
}

function compareEvents(left, right) {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function recordSetById(value) {
  return new Map(value.map((entry) => [entry.id, entry]));
}

function conflictEntityKey(value) {
  return `${value.itemId}\u0000${value.itemRevision}\u0000${value.practiceKind}`;
}

function conflictEntityFor(value) {
  return {
    itemId: value.itemId,
    itemRevision: value.itemRevision,
    practiceKind: value.practiceKind,
  };
}

function summarizeRecordSet(left, right) {
  const leftById = recordSetById(left);
  const rightById = recordSetById(right);
  let leftOnly = 0;
  let rightOnly = 0;
  let shared = 0;
  let divergent = 0;
  for (const [id, value] of leftById) {
    if (!rightById.has(id)) leftOnly += 1;
    else {
      shared += 1;
      if (stableJson(value) !== stableJson(rightById.get(id))) divergent += 1;
    }
  }
  for (const id of rightById.keys()) if (!leftById.has(id)) rightOnly += 1;
  return { leftOnly, rightOnly, shared, divergent };
}

/**
 * Describe which catalog-backed entities participated in a progress snapshot
 * collision. The returned object contains counts and identifiers only; it
 * deliberately excludes source, prompts, timelines, and raw event payloads.
 */
export function summarizeProgressConflict(leftInput, rightInput, options = {}) {
  const now = cleanIso(options.now, new Date().toISOString());
  const left = normalizeProgressSnapshot(leftInput, {
    now,
    validItemIds: options.validItemIds,
  });
  const right = normalizeProgressSnapshot(rightInput, {
    now,
    validItemIds: options.validItemIds,
  });
  if (!left || !right || !now) return undefined;

  const entities = new Map();
  const add = (records, kind) => {
    for (const record of records) {
      const key = conflictEntityKey(record);
      const entry = entities.get(key) ?? {
        ...conflictEntityFor(record),
        submittedAttempts: 0,
        serverAttempts: 0,
        sharedAttempts: 0,
        divergentAttempts: 0,
        submittedEvents: 0,
        serverEvents: 0,
        sharedEvents: 0,
        divergentEvents: 0,
      };
      if (kind === "attempt") entry.submittedAttempts += 1;
      else entry.submittedEvents += 1;
      entities.set(key, entry);
    }
  };
  add(left.attempts, "attempt");
  add(right.attempts, "serverAttempt");
  add(left.learningEvents, "event");
  add(right.learningEvents, "serverEvent");

  const byEntity = (records) => {
    const grouped = new Map();
    for (const record of records) {
      const key = conflictEntityKey(record);
      const values = grouped.get(key) ?? [];
      values.push(record);
      grouped.set(key, values);
    }
    return grouped;
  };
  const leftAttempts = byEntity(left.attempts, "attempt");
  const rightAttempts = byEntity(right.attempts, "attempt");
  const leftEvents = byEntity(left.learningEvents, "event");
  const rightEvents = byEntity(right.learningEvents, "event");
  for (const [key, entry] of entities) {
    const attempts = summarizeRecordSet(
      leftAttempts.get(key) ?? [],
      rightAttempts.get(key) ?? [],
    );
    const events = summarizeRecordSet(
      leftEvents.get(key) ?? [],
      rightEvents.get(key) ?? [],
    );
    entry.submittedAttempts = attempts.leftOnly;
    entry.serverAttempts = attempts.rightOnly;
    entry.sharedAttempts = attempts.shared;
    entry.divergentAttempts = attempts.divergent;
    entry.submittedEvents = events.leftOnly;
    entry.serverEvents = events.rightOnly;
    entry.sharedEvents = events.shared;
    entry.divergentEvents = events.divergent;
  }

  const ordered = [...entities.values()]
    .filter((entry) =>
      entry.submittedAttempts ||
      entry.serverAttempts ||
      entry.divergentAttempts ||
      entry.submittedEvents ||
      entry.serverEvents ||
      entry.divergentEvents,
    )
    .sort((a, b) =>
      a.itemId.localeCompare(b.itemId) ||
      a.itemRevision - b.itemRevision ||
      a.practiceKind.localeCompare(b.practiceKind),
    );
  const summary = {
    version: PROGRESS_CONFLICT_SUMMARY_VERSION,
    baseRevision: integer(options.baseRevision, Math.max(0, left.revision - 1), 0, 2_147_483_647),
    serverRevision: right.revision,
    resolution: "merged",
    entities: ordered.slice(0, PROGRESS_CONFLICT_LIMITS.maxEntities),
    truncated: ordered.length > PROGRESS_CONFLICT_LIMITS.maxEntities,
  };
  return jsonBytes(summary) <= PROGRESS_CONFLICT_LIMITS.maxBytes
    ? summary
    : {
        ...summary,
        entities: summary.entities.slice(0, Math.max(1, Math.floor(summary.entities.length / 2))),
        truncated: true,
      };
}

/** Merge device snapshots deterministically; the server still owns revision. */
export function mergeProgressSnapshots(local, remote, options = {}) {
  const now = cleanIso(options.now, new Date().toISOString());
  const left = normalizeProgressSnapshot(local, {
    now,
    validItemIds: options.validItemIds,
  });
  const right = normalizeProgressSnapshot(remote, {
    now,
    validItemIds: options.validItemIds,
  });
  if (!left && !right) return createProgressSnapshot({}, { now });
  if (!left) return right;
  if (!right) return left;
  const attempts = mergeById(left.attempts, right.attempts, compareAttempts)
    .sort(compareAttempts)
    .slice(-PROGRESS_SYNC_LIMITS.maxAttempts);
  const learningEvents = normalizeProgressEvents(
    mergeById(left.learningEvents, right.learningEvents, compareEvents),
    attempts,
    options,
  );
  const typingAttempts = mergeById(
    left.typingProgress.attempts,
    right.typingProgress.attempts,
    compareAttempts,
  );
  const typingProgress = rebuildTypingProgression(typingAttempts, {
    now,
    validItemIds: options.validItemIds,
  });
  return normalizeProgressSnapshot({
    version: PROGRESS_SYNC_VERSION,
    revision: Math.max(left.revision, right.revision) + 1,
    updatedAt: now,
    attempts,
    typingProgress,
    learningEvents,
  }, { now, validItemIds: options.validItemIds });
}

export function progressSnapshotFingerprint(snapshot) {
  const normalized = normalizeProgressSnapshot(snapshot);
  if (!normalized) return "";
  // Server revisions and timestamps are transport metadata. Excluding them
  // keeps the client debounce stable while still comparing every evidence
  // record and every privacy-filtered field.
  return stableJson({ ...normalized, revision: 0, updatedAt: "" });
}
