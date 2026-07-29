import { repairLineExcerpt } from "./analytics.mjs";

export const FLUENCY_CLINIC_VERSION = 1;
export const FLUENCY_CLINIC_RECHECK_DELAY_MS = 86_400_000;
export const FLUENCY_CLINIC_PASS_ORDER = Object.freeze([
  "visible",
  "faded",
  "blank",
  "recheck",
]);
export const FLUENCY_CLINIC_LIMITS = Object.freeze({
  maxCases: 120,
  maxSourceAttemptIds: 12,
  maxSnapshotCharacters: 1_000,
  maxContextLines: 3,
  maxRevision: 1_000_000,
});

const EPOCH = "1970-01-01T00:00:00.000Z";
const CASE_ID = /^[a-zA-Z0-9](?:[a-zA-Z0-9._:-]{0,198}[a-zA-Z0-9])?$/;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanSnapshot(value) {
  return typeof value === "string"
    ? value.replace(/\r/g, "").slice(0, FLUENCY_CLINIC_LIMITS.maxSnapshotCharacters)
    : "";
}

function cleanId(value) {
  const id = cleanText(value, 200);
  return CASE_ID.test(id) ? id : "";
}

function cleanIso(value, fallback = "") {
  const parsed = value instanceof Date
    ? value.getTime()
    : typeof value === "number" && Number.isFinite(value)
      ? value
      : Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, Math.trunc(number)))
    : fallback;
}

function currentItems(items) {
  return new Map(
    (Array.isArray(items) ? items : [])
      .filter((item) => item && typeof item.itemId === "string")
      .map((item) => [item.itemId, item]),
  );
}

export function fluencyClinicCaseId(itemId, itemRevision, line) {
  const id = cleanText(itemId, 140);
  const revision = boundedInteger(itemRevision, 1, 1, 1_000_000);
  const lineNumber = boundedInteger(line, 1, 1, 10_000);
  const candidate = `${id}:r${revision}:line${lineNumber}`;
  return cleanId(candidate) || "";
}

function normalizeContext(value) {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const lineNumber = boundedInteger(entry.lineNumber, 0, 1, 10_000);
      const text = cleanSnapshot(entry.text);
      if (!lineNumber || !text) return [];
      return [{ lineNumber, text, isTarget: entry.isTarget === true }];
    })
    .slice(0, FLUENCY_CLINIC_LIMITS.maxContextLines);
}

function normalizePasses(value, createdAt) {
  if (!Array.isArray(value)) return [];
  const byKind = new Map();
  for (const raw of value) {
    if (!isRecord(raw) || !FLUENCY_CLINIC_PASS_ORDER.includes(raw.kind)) continue;
    const completedAt = cleanIso(raw.completedAt);
    if (!completedAt || Date.parse(completedAt) < Date.parse(createdAt)) continue;
    const pass = {
      id: cleanId(raw.id) || `${raw.kind}:${completedAt}`,
      kind: raw.kind,
      startedAt: cleanIso(raw.startedAt, completedAt),
      completedAt,
      durationMs: boundedInteger(raw.durationMs, 0, 0, 3_600_000),
      corrections: boundedInteger(raw.corrections, 0, 0, 100_000),
      characters: boundedInteger(raw.characters, 0, 0, 100_000),
      assistance: "guided-line-repair",
    };
    const current = byKind.get(pass.kind);
    if (!current || pass.completedAt < current.completedAt) byKind.set(pass.kind, pass);
  }
  const ordered = [];
  let lastAt = createdAt;
  for (const kind of FLUENCY_CLINIC_PASS_ORDER) {
    const pass = byKind.get(kind);
    if (!pass || Date.parse(pass.completedAt) < Date.parse(lastAt)) break;
    ordered.push(pass);
    lastAt = pass.completedAt;
  }
  return ordered;
}

function normalizeCase(raw) {
  if (!isRecord(raw)) return null;
  const itemId = cleanText(raw.itemId, 140);
  const itemRevision = boundedInteger(raw.itemRevision, 0, 1, 1_000_000);
  const line = boundedInteger(raw.line, 0, 1, 10_000);
  const id = fluencyClinicCaseId(itemId, itemRevision, line);
  const createdAt = cleanIso(raw.createdAt);
  const detectedAt = cleanIso(raw.detectedAt, createdAt);
  const lastErrorAt = cleanIso(raw.lastErrorAt, detectedAt);
  const targetLineSnapshot = cleanSnapshot(raw.targetLineSnapshot);
  if (!id || !itemId || !itemRevision || !line || !createdAt || !targetLineSnapshot)
    return null;
  const sourceAttemptIds = [...new Set(
    (Array.isArray(raw.sourceAttemptIds) ? raw.sourceAttemptIds : [])
      .map(cleanId)
      .filter(Boolean),
  )].slice(-FLUENCY_CLINIC_LIMITS.maxSourceAttemptIds);
  return {
    id,
    itemId,
    itemRevision,
    titleSnapshot: cleanText(raw.titleSnapshot, 180) || itemId,
    language: raw.language === "python" ? "python" : "swift",
    line,
    targetLineSnapshot,
    contextSnapshot: normalizeContext(raw.contextSnapshot),
    sourceAttemptIds,
    errorCount: boundedInteger(raw.errorCount, 1, 1, 1_000_000),
    attemptCount: boundedInteger(raw.attemptCount, 1, 1, 1_000_000),
    detectedAt,
    lastErrorAt,
    createdAt,
    updatedAt: cleanIso(raw.updatedAt, createdAt),
    passes: normalizePasses(raw.passes, createdAt),
  };
}

function candidateCases(attempts, itemsById) {
  const totals = new Map();
  for (const attempt of Array.isArray(attempts) ? attempts.slice(-500) : []) {
    if (!isRecord(attempt) || attempt.practiceKind !== "typing") continue;
    const item = itemsById.get(attempt.itemId);
    if (!item || Number(item.contentRevision) !== Number(attempt.itemRevision)) continue;
    const completedAt = cleanIso(attempt.completedAt);
    if (!completedAt || !isRecord(attempt.lineErrors)) continue;
    for (const [rawLine, rawCount] of Object.entries(attempt.lineErrors)) {
      const line = boundedInteger(rawLine, 0, 1, 10_000);
      const count = boundedInteger(rawCount, 0, 1, 1_000_000);
      if (!line || !count) continue;
      const excerpt = repairLineExcerpt(item.code, line, 1);
      if (!excerpt?.lineText) continue;
      const id = fluencyClinicCaseId(item.itemId, item.contentRevision, excerpt.lineNumber);
      if (!id) continue;
      const current = totals.get(id) ?? {
        id,
        itemId: item.itemId,
        itemRevision: item.contentRevision,
        titleSnapshot: item.title,
        language: item.language === "python" ? "python" : "swift",
        line: excerpt.lineNumber,
        targetLineSnapshot: excerpt.lineText,
        contextSnapshot: excerpt.context,
        sourceAttemptIds: [],
        errorCount: 0,
        attemptCount: 0,
        detectedAt: completedAt,
        lastErrorAt: completedAt,
      };
      current.errorCount = Math.min(1_000_000, current.errorCount + count);
      current.attemptCount = Math.min(1_000_000, current.attemptCount + 1);
      if (cleanId(attempt.id)) current.sourceAttemptIds.push(cleanId(attempt.id));
      if (completedAt < current.detectedAt) current.detectedAt = completedAt;
      if (completedAt > current.lastErrorAt) current.lastErrorAt = completedAt;
      totals.set(id, current);
    }
  }
  return [...totals.values()]
    .filter((candidate) => candidate.attemptCount >= 2 || candidate.errorCount >= 3)
    .map((candidate) => ({
      ...candidate,
      sourceAttemptIds: [...new Set(candidate.sourceAttemptIds)].slice(
        -FLUENCY_CLINIC_LIMITS.maxSourceAttemptIds,
      ),
    }))
    .sort(
      (left, right) =>
        right.attemptCount - left.attemptCount ||
        right.errorCount - left.errorCount ||
        right.lastErrorAt.localeCompare(left.lastErrorAt) ||
        left.id.localeCompare(right.id),
    );
}

function caseFromCandidate(candidate, now) {
  return {
    ...candidate,
    createdAt: now,
    updatedAt: now,
    passes: [],
  };
}

export function createFluencyClinicWorkspace(now = EPOCH) {
  return {
    version: FLUENCY_CLINIC_VERSION,
    revision: 0,
    updatedAt: cleanIso(now, EPOCH),
    cases: [],
  };
}

export function normalizeFluencyClinicWorkspace(value, options = {}) {
  const now = cleanIso(options.now, EPOCH);
  if (!isRecord(value) || value.version !== FLUENCY_CLINIC_VERSION)
    return createFluencyClinicWorkspace(now);
  const byId = new Map();
  for (const raw of Array.isArray(value.cases) ? value.cases : []) {
    const record = normalizeCase(raw);
    if (!record) continue;
    const prior = byId.get(record.id);
    if (!prior || record.updatedAt >= prior.updatedAt) byId.set(record.id, record);
  }
  return {
    version: FLUENCY_CLINIC_VERSION,
    revision: boundedInteger(
      value.revision,
      0,
      0,
      FLUENCY_CLINIC_LIMITS.maxRevision,
    ),
    updatedAt: cleanIso(value.updatedAt, now),
    cases: [...byId.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .slice(-FLUENCY_CLINIC_LIMITS.maxCases),
  };
}

export function reconcileFluencyClinicWorkspace(value, options = {}) {
  const now = cleanIso(options.now, new Date().toISOString());
  const normalized = normalizeFluencyClinicWorkspace(value, { now });
  const itemsById = currentItems(options.items);
  const candidates = candidateCases(options.attempts, itemsById);
  const byId = new Map(normalized.cases.map((record) => [record.id, record]));
  let changed = false;
  for (const candidate of candidates) {
    const current = byId.get(candidate.id);
    if (!current) {
      byId.set(candidate.id, caseFromCandidate(candidate, now));
      changed = true;
      continue;
    }
    const merged = {
      ...current,
      titleSnapshot: candidate.titleSnapshot,
      sourceAttemptIds: candidate.sourceAttemptIds,
      errorCount: candidate.errorCount,
      attemptCount: candidate.attemptCount,
      detectedAt: candidate.detectedAt,
      lastErrorAt: candidate.lastErrorAt,
      updatedAt:
        candidate.errorCount !== current.errorCount ||
        candidate.attemptCount !== current.attemptCount ||
        candidate.lastErrorAt !== current.lastErrorAt
          ? now
          : current.updatedAt,
    };
    if (JSON.stringify(merged) !== JSON.stringify(current)) {
      byId.set(candidate.id, merged);
      changed = true;
    }
  }
  const cases = [...byId.values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(-FLUENCY_CLINIC_LIMITS.maxCases);
  if (!changed && JSON.stringify(cases) === JSON.stringify(normalized.cases))
    return normalized;
  return {
    ...normalized,
    revision: Math.min(FLUENCY_CLINIC_LIMITS.maxRevision, normalized.revision + 1),
    updatedAt: now,
    cases,
  };
}

export function enqueueFluencyClinicCase(workspace, input, options = {}) {
  const now = cleanIso(options.now, new Date().toISOString());
  const normalized = normalizeFluencyClinicWorkspace(workspace, { now });
  const item = input?.item;
  const weakLine = input?.weakLine;
  const excerpt = item && weakLine
    ? repairLineExcerpt(item.code, weakLine.line, 1)
    : null;
  if (!item || !excerpt?.lineText) throw new Error("A current weak-line target is required");
  const id = fluencyClinicCaseId(item.itemId, item.contentRevision, excerpt.lineNumber);
  const current = normalized.cases.find((record) => record.id === id);
  if (current) return normalized;
  const detectedAt = cleanIso(weakLine.lastSeenAtMs, now);
  const next = {
    id,
    itemId: item.itemId,
    itemRevision: item.contentRevision,
    titleSnapshot: item.title,
    language: item.language === "python" ? "python" : "swift",
    line: excerpt.lineNumber,
    targetLineSnapshot: excerpt.lineText,
    contextSnapshot: excerpt.context,
    sourceAttemptIds: [],
    errorCount: boundedInteger(weakLine.errorCount, 1, 1, 1_000_000),
    attemptCount: boundedInteger(weakLine.attemptCount, 1, 1, 1_000_000),
    detectedAt,
    lastErrorAt: detectedAt,
    createdAt: now,
    updatedAt: now,
    passes: [],
  };
  return {
    ...normalized,
    revision: Math.min(FLUENCY_CLINIC_LIMITS.maxRevision, normalized.revision + 1),
    updatedAt: now,
    cases: [...normalized.cases, next].slice(-FLUENCY_CLINIC_LIMITS.maxCases),
  };
}

export function nextFluencyClinicPass(record) {
  const complete = new Set((record?.passes ?? []).map((pass) => pass.kind));
  return FLUENCY_CLINIC_PASS_ORDER.slice(0, 3).find((kind) => !complete.has(kind)) ?? null;
}

export function recordFluencyClinicPass(workspace, caseId, input = {}, options = {}) {
  const now = cleanIso(options.now, new Date().toISOString());
  const normalized = normalizeFluencyClinicWorkspace(workspace, { now });
  if (
    options.expectedRevision !== undefined &&
    Number(options.expectedRevision) !== normalized.revision
  )
    throw new Error("Fluency Clinic workspace revision conflict");
  const index = normalized.cases.findIndex((record) => record.id === cleanId(caseId));
  if (index < 0) throw new Error("Fluency Clinic case was not found");
  const current = normalized.cases[index];
  const requestedKind = FLUENCY_CLINIC_PASS_ORDER.includes(input.kind)
    ? input.kind
    : null;
  if (!requestedKind) throw new Error("A supported Fluency Clinic pass is required");
  if (current.passes.some((pass) => pass.kind === requestedKind)) return normalized;
  const expectedKind = nextFluencyClinicPass(current);
  if (requestedKind === "recheck") {
    const reconstruction = qualifyingReconstruction(current, options.attempts);
    const dueAt = reconstruction
      ? new Date(
          Date.parse(reconstruction.completedAt) + FLUENCY_CLINIC_RECHECK_DELAY_MS,
        ).toISOString()
      : null;
    if (
      expectedKind ||
      !dueAt ||
      Date.parse(now) < Date.parse(dueAt)
    )
      throw new Error("The delayed Fluency Clinic recheck is not due");
  } else if (requestedKind !== expectedKind) {
    throw new Error(`Complete the ${expectedKind ?? "delayed recheck"} pass next`);
  }
  const startedAt = cleanIso(input.startedAt, now);
  const pass = {
    id: `${current.id}:${requestedKind}:${now}`,
    kind: requestedKind,
    startedAt,
    completedAt: now,
    durationMs: boundedInteger(input.durationMs, 0, 0, 3_600_000),
    corrections: boundedInteger(input.corrections, 0, 0, 100_000),
    characters: current.targetLineSnapshot.length,
    assistance: "guided-line-repair",
  };
  const cases = normalized.cases.slice();
  cases[index] = {
    ...current,
    updatedAt: now,
    passes: [...current.passes, pass],
  };
  return {
    ...normalized,
    revision: Math.min(FLUENCY_CLINIC_LIMITS.maxRevision, normalized.revision + 1),
    updatedAt: now,
    cases,
  };
}

function qualifyingReconstruction(record, attempts) {
  const blank = record.passes.find((pass) => pass.kind === "blank");
  if (!blank) return null;
  return (Array.isArray(attempts) ? attempts : [])
    .filter(
      (attempt) =>
        attempt?.itemId === record.itemId &&
        Number(attempt.itemRevision) === record.itemRevision &&
        attempt.practiceKind === "typing" &&
        Number(attempt.stage) === 5 &&
        attempt.outcome === "completed" &&
        attempt.qualification === "independent" &&
        Number(attempt.peeks) === 0 &&
        Number(attempt.accuracy) >= 95 &&
        cleanIso(attempt.startedAt) &&
        Date.parse(attempt.startedAt) >= Date.parse(blank.completedAt),
    )
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))[0] ?? null;
}

function mappedTransfer(record, variants) {
  return (Array.isArray(variants) ? variants : []).find((variant) =>
    (Array.isArray(variant?.transfer?.sourceItemIds) &&
      variant.transfer.sourceItemIds.includes(record.itemId)) ||
    (Array.isArray(variant?.sourceItemIds) &&
      variant.sourceItemIds.includes(record.itemId)),
  ) ?? null;
}

function mappedTransferId(variant) {
  return typeof variant?.itemId === "string"
    ? variant.itemId
    : typeof variant?.id === "string"
      ? variant.id
      : "";
}

function statusFor(record, context) {
  const currentItem = context.itemsById.get(record.itemId);
  if (!currentItem || Number(currentItem.contentRevision) !== record.itemRevision)
    return "retired";
  const nextPass = nextFluencyClinicPass(record);
  if (nextPass) return "repairing";
  const reconstruction = qualifyingReconstruction(record, context.attempts);
  if (!reconstruction) return "reconstruction-ready";
  const dueAt = new Date(
    Date.parse(reconstruction.completedAt) + FLUENCY_CLINIC_RECHECK_DELAY_MS,
  ).toISOString();
  const recheck = record.passes.find(
    (pass) => pass.kind === "recheck" && Date.parse(pass.completedAt) >= Date.parse(dueAt),
  );
  if (!recheck)
    return Date.parse(context.now) >= Date.parse(dueAt)
      ? "recheck-due"
      : "recheck-waiting";
  const transfer = mappedTransfer(record, context.variants);
  if (!transfer) return "stabilized";
  const transferId = mappedTransferId(transfer);
  const progress = context.transferProgressById.get(transferId);
  const observedAt = cleanIso(progress?.targetedTransferObservedAt);
  return observedAt && Date.parse(observedAt) >= Date.parse(recheck.completedAt)
    ? "transfer-observed"
    : "transfer-ready";
}

function attemptSnapshot(record, attempts, reconstruction) {
  const byId = new Map(
    (Array.isArray(attempts) ? attempts : []).map((attempt) => [attempt?.id, attempt]),
  );
  const baseline = [...record.sourceAttemptIds]
    .reverse()
    .map((id) => byId.get(id))
    .find(Boolean) ?? null;
  if (!baseline || !reconstruction) return { baseline, reconstruction, delta: null };
  return {
    baseline,
    reconstruction,
    delta: {
      wpm: Number(reconstruction.wpm) - Number(baseline.wpm),
      accuracy: Number(reconstruction.accuracy) - Number(baseline.accuracy),
      corrections: Number(reconstruction.corrections) - Number(baseline.corrections),
      durationMs: Number(reconstruction.durationMs) - Number(baseline.durationMs),
    },
  };
}

export function deriveFluencyClinicModel(workspace, options = {}) {
  const now = cleanIso(options.now, new Date().toISOString());
  const normalized = normalizeFluencyClinicWorkspace(workspace, { now });
  const itemsById = currentItems(options.items);
  const variants = Array.isArray(options.transferVariants) ? options.transferVariants : [];
  const transferProgressById = new Map(
    (Array.isArray(options.transferProgress) ? options.transferProgress : []).map(
      (entry) => [entry?.variantId, entry],
    ),
  );
  const context = {
    now,
    itemsById,
    attempts: options.attempts,
    variants,
    transferProgressById,
  };
  const records = normalized.cases.map((record) => {
    const reconstruction = qualifyingReconstruction(record, options.attempts);
    const dueAt = reconstruction
      ? new Date(
          Date.parse(reconstruction.completedAt) + FLUENCY_CLINIC_RECHECK_DELAY_MS,
        ).toISOString()
      : null;
    const transferVariant = mappedTransfer(record, variants);
    const transferVariantId = mappedTransferId(transferVariant) || null;
    const status = statusFor(record, context);
    return {
      ...record,
      status,
      nextPass: status === "repairing" ? nextFluencyClinicPass(record) : null,
      reconstructionAttempt: reconstruction,
      reconstructionAttemptId: reconstruction?.id ?? null,
      recheckDueAt: dueAt,
      transferVariant,
      transferVariantId,
      transferKind: transferVariant?.transfer ? "python-transfer" : "concept-transfer",
      transferProgress: transferVariantId
        ? transferProgressById.get(transferVariantId) ?? null
        : null,
      comparison: attemptSnapshot(record, options.attempts, reconstruction),
      evidenceClaim:
        ["stabilized", "transfer-ready", "transfer-observed"].includes(status)
          ? "implementation-fluency"
          : "repair-in-progress",
      claimsMastery: false,
      claimsIndependentSolve: false,
      scope: "private-local-implementation-fluency-evidence",
    };
  });
  const priority = {
    "recheck-due": 0,
    repairing: 1,
    "reconstruction-ready": 2,
    "transfer-ready": 3,
    "recheck-waiting": 4,
    stabilized: 5,
    "transfer-observed": 6,
    retired: 7,
  };
  records.sort(
    (left, right) =>
      (priority[left.status] ?? 8) - (priority[right.status] ?? 8) ||
      right.attemptCount - left.attemptCount ||
      right.errorCount - left.errorCount ||
      right.lastErrorAt.localeCompare(left.lastErrorAt) ||
      left.id.localeCompare(right.id),
  );
  const summary = {
    total: records.length,
    active: records.filter((record) =>
      ["repairing", "reconstruction-ready", "recheck-due", "transfer-ready"].includes(
        record.status,
      ),
    ).length,
    due: records.filter((record) => record.status === "recheck-due").length,
    repairing: records.filter((record) => record.status === "repairing").length,
    reconstructionReady: records.filter(
      (record) => record.status === "reconstruction-ready",
    ).length,
    transferReady: records.filter((record) => record.status === "transfer-ready").length,
    stabilized: records.filter((record) =>
      ["stabilized", "transfer-observed"].includes(record.status),
    ).length,
    retired: records.filter((record) => record.status === "retired").length,
  };
  return {
    generatedAt: now,
    scope: "private-local-implementation-fluency-evidence",
    records,
    cases: records,
    summary,
    selected: options.selectedId
      ? records.find((record) => record.id === cleanId(options.selectedId)) ?? null
      : null,
    next:
      records.find((record) => record.status === "recheck-due") ??
      records.find((record) => record.status === "repairing") ??
      records.find((record) => record.status === "reconstruction-ready") ??
      records.find((record) => record.status === "transfer-ready") ??
      null,
  };
}
