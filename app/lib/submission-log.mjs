export const SUBMISSION_LOG_VERSION = 1;

export const SUBMISSION_LOG_LIMITS = Object.freeze({
  maxReceipts: 500,
  maxReceiptsPerItem: 100,
  maxSourceBytes: 48_000,
  maxTotalSourceBytes: 1_000_000,
  maxIdBytes: 160,
  maxTitleBytes: 1_000,
  maxInterruptionReasonBytes: 240,
  maxDurationMs: 86_400_000,
  maxChecks: 10_000,
  maxRevision: 1_000_000,
});

export const SUBMISSION_STATUSES = Object.freeze([
  "accepted",
  "wrong-answer",
  "compile-error",
  "runtime-error",
  "time-limit",
  "invalid-entrypoint",
  "judge-error",
]);
export const SUBMISSION_LANGUAGES = Object.freeze(["python", "swift"]);
export const SUBMISSION_CONTEXT_KINDS = Object.freeze([
  "practice",
  "transfer",
  "assessment",
  "mock",
  "studio",
  "round",
]);
export const SUBMISSION_ASSISTANCE = Object.freeze([
  "used",
  "none-recorded",
  "unknown",
]);
export const SUBMISSION_SNAPSHOT_PROVENANCE = Object.freeze([
  "recorded",
  "migrated-catalog-fallback",
]);
export const SUBMISSION_JUDGE_KIND = "browser-python-local";
export const SUBMISSION_JUDGE_KINDS = Object.freeze([
  "browser-python-local",
  "server-isolated-python",
  "server-isolated-swift",
]);
export const SUBMISSION_INTERRUPTION_REASON = "interrupted-before-settlement";
export const SUBMISSION_LOG_STATUSES = SUBMISSION_STATUSES;
export const SUBMISSION_LOG_LANGUAGES = SUBMISSION_LANGUAGES;
export const SUBMISSION_LOG_CONTEXT_KINDS = SUBMISSION_CONTEXT_KINDS;
export const SUBMISSION_LOG_ASSISTANCE = SUBMISSION_ASSISTANCE;
export const SUBMISSION_LOG_SNAPSHOT_PROVENANCE = SUBMISSION_SNAPSHOT_PROVENANCE;
export const SUBMISSION_LOG_JUDGE_KIND = SUBMISSION_JUDGE_KIND;

const statusSet = new Set(SUBMISSION_STATUSES);
const languageSet = new Set(SUBMISSION_LANGUAGES);
const contextKindSet = new Set(SUBMISSION_CONTEXT_KINDS);
const assistanceSet = new Set(SUBMISSION_ASSISTANCE);
const provenanceSet = new Set(SUBMISSION_SNAPSHOT_PROVENANCE);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function cleanBoundedString(value, maxBytes, { allowEmpty = false } = {}) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  if ((!allowEmpty && !result) || /[\u0000-\u001f\u007f]/u.test(result)) return null;
  return utf8Bytes(result) <= maxBytes ? result : null;
}

function cleanSource(value) {
  return typeof value === "string"
    && utf8Bytes(value) <= SUBMISSION_LOG_LIMITS.maxSourceBytes
    ? value
    : null;
}

function positiveInteger(value, maximum = SUBMISSION_LOG_LIMITS.maxRevision) {
  return Number.isSafeInteger(value) && value >= 1 && value <= maximum ? value : null;
}

function boundedInteger(value, maximum) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : null;
}

function canonicalIso(value) {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function compareReceipts(left, right) {
  return left.requestedAt.localeCompare(right.requestedAt) || left.id.localeCompare(right.id);
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function setOwn(object, key, value) {
  Object.defineProperty(object, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function normalizeContext(value, { strict = false } = {}) {
  if (!isRecord(value) || !contextKindSet.has(value.kind)) return null;
  const sessionId = value.sessionId === undefined
    ? undefined
    : cleanBoundedString(value.sessionId, SUBMISSION_LOG_LIMITS.maxIdBytes);
  const assessmentRunId = value.assessmentRunId === undefined
    ? undefined
    : cleanBoundedString(value.assessmentRunId, SUBMISSION_LOG_LIMITS.maxIdBytes);
  const assessmentProbeId = value.assessmentProbeId === undefined
    ? undefined
    : cleanBoundedString(value.assessmentProbeId, SUBMISSION_LOG_LIMITS.maxIdBytes);
  const virtualRoundId = value.virtualRoundId === undefined
    ? undefined
    : cleanBoundedString(value.virtualRoundId, SUBMISSION_LOG_LIMITS.maxIdBytes);
  if (
    (value.sessionId !== undefined && !sessionId)
    || (value.assessmentRunId !== undefined && !assessmentRunId)
    || (value.assessmentProbeId !== undefined && !assessmentProbeId)
    || (value.virtualRoundId !== undefined && !virtualRoundId)
  ) return null;

  const result = { kind: value.kind };
  if (value.kind === "assessment") {
    if (Boolean(assessmentRunId) !== Boolean(assessmentProbeId)) return null;
    if (strict && (sessionId || virtualRoundId)) return null;
    if (assessmentRunId && assessmentProbeId) {
      result.assessmentRunId = assessmentRunId;
      result.assessmentProbeId = assessmentProbeId;
    }
  } else if (value.kind === "round") {
    if (strict && (sessionId || assessmentRunId || assessmentProbeId)) return null;
    if (virtualRoundId) result.virtualRoundId = virtualRoundId;
  } else {
    if (strict && (assessmentRunId || assessmentProbeId || virtualRoundId)) return null;
    if (sessionId) result.sessionId = sessionId;
  }
  return result;
}

function normalizeJudge(value) {
  if (!isRecord(value) || !SUBMISSION_JUDGE_KINDS.includes(value.kind)) return null;
  const revision = positiveInteger(value.revision);
  return revision ? { kind: value.kind, revision } : null;
}

function normalizeBaseReceipt(value, itemsById) {
  if (!isRecord(value)) return null;
  if (value.lifecycle !== "pending" && value.lifecycle !== "settled") return null;
  const id = cleanBoundedString(value.id, SUBMISSION_LOG_LIMITS.maxIdBytes);
  const itemId = cleanBoundedString(value.itemId, SUBMISSION_LOG_LIMITS.maxIdBytes);
  const itemRevision = positiveInteger(value.itemRevision);
  const requestedAt = canonicalIso(value.requestedAt);
  const judge = normalizeJudge(value.judge);
  const context = normalizeContext(value.context);
  if (!id || !itemId || !itemRevision || !requestedAt || !judge || !context) return null;

  const item = itemsById.get(itemId);
  const provenance = provenanceSet.has(value.snapshotProvenance)
    ? value.snapshotProvenance
    : null;
  let titleSnapshot = cleanBoundedString(value.titleSnapshot, SUBMISSION_LOG_LIMITS.maxTitleBytes);
  let language = languageSet.has(value.language) ? value.language : null;
  if (provenance === "migrated-catalog-fallback" && item) {
    titleSnapshot ||= cleanBoundedString(item.title, SUBMISSION_LOG_LIMITS.maxTitleBytes);
    language ||= languageSet.has(item.language) ? item.language : null;
  }
  if (!provenance || !titleSnapshot || !language) return null;
  if (!item && provenance !== "recorded") return null;

  return {
    id,
    itemId,
    titleSnapshot,
    language,
    itemRevision,
    requestedAt,
    lifecycle: value.lifecycle,
    judge,
    context,
    assistance: assistanceSet.has(value.assistance) ? value.assistance : "unknown",
    snapshotProvenance: provenance,
  };
}

function settlementFromOutcome(value, requestedAt, { failClosed = false, fallbackNow } = {}) {
  const settledAt = canonicalIso(value?.settledAt ?? value?.judgedAt);
  const durationMs = boundedInteger(value?.durationMs, SUBMISSION_LOG_LIMITS.maxDurationMs);
  const total = boundedInteger(value?.total, SUBMISSION_LOG_LIMITS.maxChecks);
  const passed = total === null ? null : boundedInteger(value?.passed, total);
  const rawStatus = statusSet.has(value?.status) ? value.status : null;
  const interruptionReason = value?.interruptionReason === undefined
    ? undefined
    : cleanBoundedString(
        value.interruptionReason,
        SUBMISSION_LOG_LIMITS.maxInterruptionReasonBytes,
      );
  const valid = settledAt
    && Date.parse(settledAt) >= Date.parse(requestedAt)
    && durationMs !== null
    && total !== null
    && passed !== null
    && rawStatus
    && (value?.interruptionReason === undefined || interruptionReason);
  if (!valid) {
    if (!failClosed) return null;
    const fallback = canonicalIso(fallbackNow) ?? requestedAt;
    return {
      settledAt: Date.parse(fallback) < Date.parse(requestedAt) ? requestedAt : fallback,
      status: "judge-error",
      durationMs: 0,
      passed: 0,
      total: 0,
      interruptionReason: "malformed-settlement",
    };
  }
  return {
    settledAt,
    status: rawStatus === "accepted" && !(total > 0 && passed === total)
      ? "wrong-answer"
      : rawStatus,
    durationMs,
    passed,
    total,
    ...(interruptionReason ? { interruptionReason } : {}),
  };
}

function receiptWithSettlement(receipt, settlement) {
  return { ...receipt, lifecycle: "settled", ...settlement };
}

function trimReceipts(receipts, maximum, throwOnPendingOverflow) {
  const result = receipts.slice();
  while (result.length > maximum) {
    const settledIndex = result.findIndex((receipt) => receipt.lifecycle === "settled");
    if (settledIndex < 0) {
      if (throwOnPendingOverflow) {
        throw new Error("Pending submission receipts exceed the metadata limit");
      }
      result.shift();
    } else {
      result.splice(settledIndex, 1);
    }
  }
  return result;
}

function retainReceiptMetadata(receipts, { throwOnPendingOverflow = false } = {}) {
  const sorted = receipts.slice().sort(compareReceipts);
  const perItem = new Map();
  for (const receipt of sorted) {
    const group = perItem.get(receipt.itemId) ?? [];
    group.push(receipt);
    perItem.set(
      receipt.itemId,
      trimReceipts(group, SUBMISSION_LOG_LIMITS.maxReceiptsPerItem, throwOnPendingOverflow),
    );
  }
  return trimReceipts(
    [...perItem.values()].flat().sort(compareReceipts),
    SUBMISSION_LOG_LIMITS.maxReceipts,
    throwOnPendingOverflow,
  );
}

function enforceSourceBudget(receipts, rawSources, { throwOnPendingOverflow = false } = {}) {
  const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  const sources = {};
  let totalBytes = 0;
  if (isRecord(rawSources)) {
    for (const receipt of receipts) {
      const source = own(rawSources, receipt.id) ? cleanSource(rawSources[receipt.id]) : null;
      if (source === null) continue;
      setOwn(sources, receipt.id, source);
      totalBytes += utf8Bytes(source);
    }
  }
  if (totalBytes <= SUBMISSION_LOG_LIMITS.maxTotalSourceBytes) return sources;

  const evictable = Object.keys(sources)
    .map((id) => receiptById.get(id))
    .filter((receipt) => receipt?.lifecycle === "settled")
    .sort(compareReceipts);
  for (const receipt of evictable) {
    if (totalBytes <= SUBMISSION_LOG_LIMITS.maxTotalSourceBytes) break;
    totalBytes -= utf8Bytes(sources[receipt.id]);
    delete sources[receipt.id];
  }
  if (totalBytes > SUBMISSION_LOG_LIMITS.maxTotalSourceBytes && throwOnPendingOverflow) {
    throw new Error("Pending submission sources exceed the local storage budget");
  }
  return sources;
}

function buildLog(receipts, sources, options) {
  const retained = retainReceiptMetadata(receipts, options);
  return {
    version: SUBMISSION_LOG_VERSION,
    receipts: retained,
    sources: enforceSourceBudget(retained, sources, options),
  };
}

function failClosePendingOverflows(receipts, rawSources, now) {
  const ordered = receipts.slice().sort(compareReceipts);
  const recover = new Map();
  const pendingByItem = new Map();
  for (const receipt of ordered) {
    if (receipt.lifecycle !== "pending") continue;
    const group = pendingByItem.get(receipt.itemId) ?? [];
    group.push(receipt);
    pendingByItem.set(receipt.itemId, group);
  }
  for (const group of pendingByItem.values()) {
    for (const receipt of group.slice(0, -SUBMISSION_LOG_LIMITS.maxReceiptsPerItem)) {
      recover.set(receipt.id, "pending-metadata-overflow");
    }
  }
  const stillPending = ordered.filter(
    (receipt) => receipt.lifecycle === "pending" && !recover.has(receipt.id),
  );
  for (const receipt of stillPending.slice(0, -SUBMISSION_LOG_LIMITS.maxReceipts)) {
    recover.set(receipt.id, "pending-metadata-overflow");
  }

  let pendingSourceBytes = 0;
  const pendingSources = [];
  for (const receipt of ordered) {
    if (receipt.lifecycle !== "pending" || recover.has(receipt.id)) continue;
    const source = isRecord(rawSources) && own(rawSources, receipt.id)
      ? cleanSource(rawSources[receipt.id])
      : null;
    if (source === null) {
      recover.set(receipt.id, "source-unavailable");
      continue;
    }
    const bytes = utf8Bytes(source);
    pendingSourceBytes += bytes;
    pendingSources.push({ receipt, bytes });
  }
  for (const { receipt, bytes } of pendingSources) {
    if (pendingSourceBytes <= SUBMISSION_LOG_LIMITS.maxTotalSourceBytes) break;
    pendingSourceBytes -= bytes;
    recover.set(receipt.id, "pending-source-budget-overflow");
  }
  if (!recover.size) return ordered;
  return ordered.map((receipt) => {
    if (!recover.has(receipt.id)) return receipt;
    const settledAt = Date.parse(now) < Date.parse(receipt.requestedAt)
      ? receipt.requestedAt
      : now;
    return receiptWithSettlement(receipt, {
      settledAt,
      status: "judge-error",
      durationMs: 0,
      passed: 0,
      total: 0,
      interruptionReason: recover.get(receipt.id),
    });
  });
}

function itemsMap(items) {
  const result = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!isRecord(item)) continue;
    const itemId = cleanBoundedString(item.itemId, SUBMISSION_LOG_LIMITS.maxIdBytes);
    if (itemId && !result.has(itemId)) result.set(itemId, item);
  }
  return result;
}

export function createSubmissionLog() {
  return { version: SUBMISSION_LOG_VERSION, receipts: [], sources: {} };
}

export function requestSubmission(log, input) {
  if (!isRecord(input)) throw new Error("Submission request metadata is required");
  const source = cleanSource(input.source);
  const id = cleanBoundedString(input.id, SUBMISSION_LOG_LIMITS.maxIdBytes);
  const itemId = cleanBoundedString(input.itemId, SUBMISSION_LOG_LIMITS.maxIdBytes);
  const titleSnapshot = cleanBoundedString(
    input.titleSnapshot,
    SUBMISSION_LOG_LIMITS.maxTitleBytes,
  );
  const language = languageSet.has(input.language) ? input.language : null;
  const itemRevision = positiveInteger(input.itemRevision);
  const requestedAt = canonicalIso(input.requestedAt);
  const judge = normalizeJudge(input.judge);
  const context = normalizeContext(input.context, { strict: true });
  const assistance = assistanceSet.has(input.assistance) ? input.assistance : null;
  if (
    source === null || !id || !itemId || !titleSnapshot || !language || !itemRevision
    || !requestedAt || !judge || !context || !assistance
  ) throw new Error("Submission request metadata or source is invalid");

  const receipt = {
    id,
    itemId,
    titleSnapshot,
    language,
    itemRevision,
    requestedAt,
    lifecycle: "pending",
    judge,
    context,
    assistance,
    snapshotProvenance: "recorded",
  };
  const current = isRecord(log) ? log : createSubmissionLog();
  const existing = Array.isArray(current.receipts)
    ? current.receipts.find((entry) => entry?.id === id)
    : undefined;
  if (existing) {
    if (
      sameValue(existing, receipt)
      && isRecord(current.sources)
      && own(current.sources, id)
      && current.sources[id] === source
    ) return current;
    throw new Error("Submission ID already exists with different metadata or source");
  }
  const nextSources = { ...(isRecord(current.sources) ? current.sources : {}), [id]: source };
  return buildLog(
    [...(Array.isArray(current.receipts) ? current.receipts : []), receipt],
    nextSources,
    { throwOnPendingOverflow: true },
  );
}

export function settleSubmission(log, id, outcome) {
  const submissionId = cleanBoundedString(id, SUBMISSION_LOG_LIMITS.maxIdBytes);
  if (!submissionId || !isRecord(log) || !Array.isArray(log.receipts)) {
    throw new Error("Submission log or ID is invalid");
  }
  const existing = log.receipts.find((receipt) => receipt?.id === submissionId);
  if (!existing) throw new Error("Submission receipt was not found");
  const settlement = settlementFromOutcome(outcome, existing.requestedAt);
  if (!settlement) throw new Error("Submission outcome is invalid");
  if (existing.lifecycle === "settled") {
    const current = {
      settledAt: existing.settledAt,
      status: existing.status,
      durationMs: existing.durationMs,
      passed: existing.passed,
      total: existing.total,
      ...(existing.interruptionReason
        ? { interruptionReason: existing.interruptionReason }
        : {}),
    };
    if (sameValue(current, settlement)) return log;
    throw new Error("Submission receipt is already settled with a different outcome");
  }
  if (existing.lifecycle !== "pending") throw new Error("Submission lifecycle is invalid");
  return buildLog(
    log.receipts.map((receipt) => receipt.id === submissionId
      ? receiptWithSettlement(receipt, settlement)
      : receipt),
    log.sources,
  );
}

export function recoverInterruptedSubmissions(log, options = {}) {
  if (!isRecord(log) || !Array.isArray(log.receipts)) return createSubmissionLog();
  const settledAt = canonicalIso(options.now);
  if (!settledAt) throw new Error("A valid recovery time is required");
  const preservedJudgeKinds = new Set(
    Array.isArray(options.preservePendingJudgeKinds)
      ? options.preservePendingJudgeKinds.filter((kind) => SUBMISSION_JUDGE_KINDS.includes(kind))
      : [],
  );
  return buildLog(
    log.receipts.map((receipt) => {
      if (
        receipt.lifecycle !== "pending" ||
        preservedJudgeKinds.has(receipt.judge.kind)
      )
        return receipt;
      const at = Date.parse(settledAt) < Date.parse(receipt.requestedAt)
        ? receipt.requestedAt
        : settledAt;
      return receiptWithSettlement(receipt, {
        settledAt: at,
        status: "judge-error",
        durationMs: 0,
        passed: 0,
        total: 0,
        interruptionReason: SUBMISSION_INTERRUPTION_REASON,
      });
    }),
    log.sources,
  );
}

function normalizeReceipt(value, itemsById, now) {
  const base = normalizeBaseReceipt(value, itemsById);
  if (!base) return null;
  if (value.lifecycle !== "settled") return base;
  return receiptWithSettlement(
    base,
    settlementFromOutcome(value, base.requestedAt, { failClosed: true, fallbackNow: now }),
  );
}

function legacyContext(value) {
  const sessionId = cleanBoundedString(value.sessionId, SUBMISSION_LOG_LIMITS.maxIdBytes);
  const virtualRoundId = cleanBoundedString(
    value.virtualRoundId,
    SUBMISSION_LOG_LIMITS.maxIdBytes,
  );
  if (value.origin === "round") return {
    kind: "round",
    ...(virtualRoundId ? { virtualRoundId } : {}),
  };
  if (value.origin === "mock") return {
    kind: "mock",
    ...(sessionId ? { sessionId } : {}),
  };
  return { kind: "practice", ...(sessionId ? { sessionId } : {}) };
}

function migrateLegacyReceipt(value, itemsById, now) {
  if (!isRecord(value)) return null;
  const itemId = cleanBoundedString(value.itemId, SUBMISSION_LOG_LIMITS.maxIdBytes);
  const item = itemId ? itemsById.get(itemId) : null;
  const source = cleanSource(value.source);
  const context = legacyContext(value);
  if (!itemId || !item || source === null || source.length === 0 || !context) return null;
  const candidate = {
    id: value.id,
    itemId,
    titleSnapshot: item.title,
    language: item.language,
    itemRevision: value.itemRevision,
    requestedAt: value.submittedAt ?? value.requestedAt,
    lifecycle: "settled",
    settledAt: value.settledAt ?? value.judgedAt ?? value.submittedAt ?? value.requestedAt,
    status: value.status,
    durationMs: value.durationMs,
    passed: value.passed,
    total: value.total,
    judge: {
      kind: SUBMISSION_JUDGE_KIND,
      revision: value.verificationRevision ?? value.judge?.revision,
    },
    context,
    assistance: "unknown",
    snapshotProvenance: "migrated-catalog-fallback",
  };
  const receipt = normalizeReceipt(candidate, itemsById, now);
  return receipt ? { receipt, source } : null;
}

export function normalizeSubmissionLog(raw, options = {}) {
  const now = canonicalIso(options.now) ?? new Date(0).toISOString();
  const byItem = itemsMap(options.items);
  const value = isRecord(raw) ? raw : {};
  const rawSources = isRecord(value.sources) ? value.sources : {};
  const normalized = [];
  for (const entry of Array.isArray(value.receipts) ? value.receipts : []) {
    const receipt = normalizeReceipt(entry, byItem, now);
    if (receipt) normalized.push(receipt);
  }

  const combinedLegacy = [
    ...(Array.isArray(raw) ? raw : []),
    ...(Array.isArray(options.legacyHistory) ? options.legacyHistory : []),
  ];
  const migratedSources = { ...rawSources };
  for (const legacy of combinedLegacy) {
    const migrated = migrateLegacyReceipt(legacy, byItem, now);
    if (!migrated) continue;
    normalized.push(migrated.receipt);
    setOwn(migratedSources, migrated.receipt.id, migrated.source);
  }

  const ordered = normalized.sort(compareReceipts);
  const deduplicated = [];
  const seen = new Set();
  for (const receipt of ordered) {
    if (seen.has(receipt.id)) continue;
    seen.add(receipt.id);
    deduplicated.push(receipt);
  }
  return buildLog(
    failClosePendingOverflows(deduplicated, migratedSources, now),
    migratedSources,
  );
}

export function resolveSubmissionSource(log, id) {
  if (!isRecord(log?.sources) || typeof id !== "string" || !own(log.sources, id)) return null;
  return cleanSource(log.sources[id]);
}

export function sourceAvailable(log, id) {
  return resolveSubmissionSource(log, id) !== null;
}

function legacyOrigin(kind) {
  if (kind === "round") return "round";
  if (kind === "mock" || kind === "studio") return "mock";
  return "practice";
}

export function settledSubmissionRecords(log) {
  if (!isRecord(log) || !Array.isArray(log.receipts)) return [];
  return log.receipts
    .filter((receipt) => receipt.lifecycle === "settled" && sourceAvailable(log, receipt.id))
    .sort(compareReceipts)
    .map((receipt) => ({
      id: receipt.id,
      itemId: receipt.itemId,
      titleSnapshot: receipt.titleSnapshot,
      language: receipt.language,
      itemRevision: receipt.itemRevision,
      verificationRevision: receipt.judge.revision,
      submittedAt: receipt.requestedAt,
      status: receipt.status,
      durationMs: receipt.durationMs,
      passed: receipt.passed,
      total: receipt.total,
      source: log.sources[receipt.id],
      origin: legacyOrigin(receipt.context.kind),
      ...(receipt.context.sessionId ? { sessionId: receipt.context.sessionId } : {}),
      ...(receipt.context.virtualRoundId
        ? { virtualRoundId: receipt.context.virtualRoundId }
        : {}),
    }));
}

export function settledSubmissionEvidence(log) {
  if (!isRecord(log) || !Array.isArray(log.receipts)) return [];
  return log.receipts
    .filter((receipt) => receipt.lifecycle === "settled")
    .sort(compareReceipts)
    .map((receipt) => ({
      id: receipt.id,
      itemId: receipt.itemId,
      itemRevision: receipt.itemRevision,
      status: receipt.status,
      passed: receipt.passed,
      total: receipt.total,
      submittedAt: receipt.requestedAt,
      assistanceUsed:
        receipt.assistance === "used"
          ? true
          : receipt.assistance === "none-recorded"
            ? false
            : undefined,
    }));
}

export function submissionLogSourceBytes(log) {
  if (!isRecord(log?.sources)) return 0;
  return Object.values(log.sources).reduce(
    (total, source) => total + (typeof source === "string" ? utf8Bytes(source) : 0),
    0,
  );
}
