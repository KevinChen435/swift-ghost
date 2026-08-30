const MAX_ENTRIES = 5;
const MAX_ID_LENGTH = 160;
const MAX_DIAGNOSTIC_LENGTH = 2_000;
const MAX_VALUE_LENGTH = 1_600;
const MAX_VALUE_DEPTH = 4;
const MAX_COLLECTION_ENTRIES = 24;

const VERDICTS = new Set([
  "accepted",
  "wrong-answer",
  "compile-error",
  "runtime-error",
  "time-limit",
  "judge-error",
]);

const CASE_STATUSES = new Set([
  "passed",
  "failed",
  "compile-error",
  "runtime-error",
  "time-limit",
  "wrong-answer",
  "judge-error",
  "not-run",
]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value, limit) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .trim()
        .slice(0, limit)
    : "";
}

function finiteInteger(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function isoDate(value) {
  if (typeof value !== "string" || !value || !Number.isFinite(Date.parse(value)))
    return "";
  return value.slice(0, 64);
}

function boundedPublicValue(value, depth = 0) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, MAX_VALUE_LENGTH);
  if (depth >= MAX_VALUE_DEPTH || !value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_COLLECTION_ENTRIES)
      .map((entry) => boundedPublicValue(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  const output = {};
  for (const [key, entry] of Object.entries(value).slice(0, MAX_COLLECTION_ENTRIES)) {
    const normalizedKey = cleanString(key, 96);
    const normalizedValue = boundedPublicValue(entry, depth + 1);
    if (normalizedKey && normalizedValue !== undefined) output[normalizedKey] = normalizedValue;
  }
  return output;
}

function boundedValue(value) {
  const normalized = boundedPublicValue(value);
  if (normalized === undefined) return undefined;
  try {
    const encoded = JSON.stringify(normalized);
    if (encoded.length <= MAX_VALUE_LENGTH) return normalized;
    return `${encoded.slice(0, MAX_VALUE_LENGTH - 1)}…`;
  } catch {
    return undefined;
  }
}

function challengeSampleIds(challenge) {
  if (!isRecord(challenge) || challenge.language !== "swift" || !Array.isArray(challenge.samples))
    return [];
  return challenge.samples
    .map((sample) => cleanString(sample?.id, 96))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizePublicCaseResults(value, sampleIds) {
  if (!Array.isArray(value) || !sampleIds.length) return [];
  const byId = new Map();
  for (const candidate of value) {
    if (!isRecord(candidate)) continue;
    const id = cleanString(candidate.id, 96);
    if (!sampleIds.includes(id) || byId.has(id)) continue;
    const status = CASE_STATUSES.has(candidate.status) ? candidate.status : undefined;
    const passed = typeof candidate.passed === "boolean"
      ? candidate.passed
      : status === "passed"
        ? true
        : status
          ? false
          : undefined;
    if (passed === undefined) continue;
    const actual = Object.hasOwn(candidate, "actual")
      ? boundedValue(candidate.actual)
      : undefined;
    const diagnostic = cleanString(candidate.diagnostic, MAX_DIAGNOSTIC_LENGTH);
    byId.set(id, {
      id,
      passed,
      status: status ?? (passed ? "passed" : "failed"),
      ...(actual !== undefined ? { actual } : {}),
      ...(diagnostic ? { diagnostic } : {}),
    });
  }
  return sampleIds.flatMap((id) => (byId.has(id) ? [byId.get(id)] : []));
}

function normalizeEntry(value, challenge) {
  if (!isRecord(value)) return undefined;
  const sampleIds = challengeSampleIds(challenge);
  const id = cleanString(value.id, MAX_ID_LENGTH);
  const settledAt = isoDate(value.settledAt);
  const verdict = VERDICTS.has(value.verdict) ? value.verdict : undefined;
  const total = finiteInteger(value.total, 1, 64);
  const passed = total === null ? null : finiteInteger(value.passed, 0, total);
  const contentRevision = finiteInteger(value.contentRevision, 1, 1_000_000);
  const judgeRevision = finiteInteger(value.judgeRevision, 1, 1_000_000);
  if (
    !id ||
    !settledAt ||
    !verdict ||
    total === null ||
    passed === null ||
    contentRevision !== challenge.contentRevision ||
    judgeRevision !== challenge.judgeRevision
  ) return undefined;
  const failedCaseIndex = value.failedCaseIndex === undefined
    ? undefined
    : finiteInteger(value.failedCaseIndex, 0, total - 1);
  if (value.failedCaseIndex !== undefined && failedCaseIndex === null) return undefined;
  return {
    id,
    settledAt,
    verdict,
    passed,
    total,
    contentRevision,
    judgeRevision,
    ...(failedCaseIndex !== undefined ? { failedCaseIndex } : {}),
    publicCaseResults: normalizePublicCaseResults(value.publicCaseResults, sampleIds),
  };
}

/**
 * Normalize device-local history using an explicit public-only allowlist.
 * Expected values, source, runtime metadata, and sealed-case fields are never
 * copied into the persisted shape.
 */
export function normalizeSwiftExampleHistory(value, challenge) {
  if (!isRecord(challenge) || challenge.language !== "swift") return [];
  const entries = Array.isArray(value) ? value : [];
  const seen = new Set();
  return entries
    .slice(0, MAX_ENTRIES * 2)
    .flatMap((candidate) => {
      const entry = normalizeEntry(candidate, challenge);
      if (!entry || seen.has(entry.id)) return [];
      seen.add(entry.id);
      return [entry];
    })
    .slice(0, MAX_ENTRIES);
}

/** Build the safe persisted projection for one settled public example run. */
export function swiftExampleHistoryEntryFromRun(run, challenge) {
  if (!isRecord(run) || run.status !== "settled" || !run.result || !run.verdict)
    return undefined;
  const candidate = {
    id: run.clientRunId ?? run.id,
    settledAt: run.settledAt,
    verdict: run.verdict,
    passed: run.result.passed,
    total: run.result.total,
    contentRevision: run.result.contentRevision,
    judgeRevision: run.result.judgeRevision,
    failedCaseIndex: run.result.failedCaseIndex,
    publicCaseResults: run.result.publicCaseResults,
  };
  return normalizeEntry(candidate, challenge);
}

export const SWIFT_EXAMPLE_HISTORY_LIMITS = Object.freeze({
  maxEntries: MAX_ENTRIES,
  maxValueCharacters: MAX_VALUE_LENGTH,
  maxDiagnosticCharacters: MAX_DIAGNOSTIC_LENGTH,
});
