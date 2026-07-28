const ISO_EPOCH = "1970-01-01T00:00:00.000Z";
const MAX_ANNOTATIONS = 200;
const MAX_NOTE_CHARACTERS = 1_200;
const MAX_TAGS = 4;
const ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/;

export const SUBMISSION_ANNOTATION_TAGS = Object.freeze([
  "off-by-one",
  "syntax",
  "edge-case",
  "complexity",
  "review",
  "clean",
]);

const TAG_SET = new Set(SUBMISSION_ANNOTATION_TAGS);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validIdSet(validSubmissionIds) {
  if (
    validSubmissionIds === null ||
    validSubmissionIds === undefined ||
    typeof validSubmissionIds === "string"
  )
    return new Set();
  try {
    return new Set(
      [...validSubmissionIds].filter((value) => typeof value === "string"),
    );
  } catch {
    return new Set();
  }
}

/** Truncate at Unicode code-point boundaries after removing surrounding space. */
function note(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return [...trimmed].slice(0, MAX_NOTE_CHARACTERS).join("");
}

/** Return unique supported tags in stable allowlist order. */
function tags(value) {
  if (!Array.isArray(value)) return [];
  const selected = new Set(
    value.filter((tag) => typeof tag === "string" && TAG_SET.has(tag)),
  );
  return SUBMISSION_ANNOTATION_TAGS.filter((tag) => selected.has(tag)).slice(
    0,
    MAX_TAGS,
  );
}

function leapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isoTimestamp(value) {
  const match = typeof value === "string" ? ISO_TIMESTAMP.exec(value) : null;
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] =
    match.map(Number);
  const days = [
    31,
    leapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (offsetHour !== undefined && offsetHour > 23) ||
    (offsetMinute !== undefined && offsetMinute > 59)
  )
    return Number.NaN;
  return Date.parse(value);
}

function iso(value, fallback = ISO_EPOCH) {
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : typeof value === "string"
          ? isoTimestamp(value)
          : Number.NaN;
  if (!Number.isFinite(timestamp)) return fallback;
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return fallback;
  }
}

function annotation(raw) {
  if (!object(raw)) return null;
  const normalized = {
    note: note(raw.note),
    tags: tags(raw.tags),
    updatedAt: iso(raw.updatedAt),
  };
  return normalized.note || normalized.tags.length ? normalized : null;
}

/**
 * Repair persisted receipt annotations into a deterministic, bounded record.
 * Unknown fields, orphaned submission IDs, and empty annotations are removed.
 */
export function normalizeSubmissionAnnotations(value, validSubmissionIds) {
  if (!object(value)) return {};
  const validIds = validIdSet(validSubmissionIds);
  const entries = [];
  for (const [submissionId, raw] of Object.entries(value)) {
    if (!validIds.has(submissionId)) continue;
    const normalized = annotation(raw);
    if (normalized) entries.push([submissionId, normalized]);
  }
  return Object.fromEntries(entries.slice(-MAX_ANNOTATIONS));
}

/** Apply one annotation edit without mutating the current record or patch. */
export function updateSubmissionAnnotation(
  current,
  submissionId,
  patch,
  options = {},
) {
  const validIds = validIdSet(options.validSubmissionIds);
  const normalized = normalizeSubmissionAnnotations(current, validIds);
  if (typeof submissionId !== "string" || !validIds.has(submissionId))
    return normalized;
  if (!object(patch) || (!own(patch, "note") && !own(patch, "tags")))
    return normalized;

  const persisted =
    object(current) && own(current, submissionId)
      ? annotation(current[submissionId])
      : null;
  const previous = normalized[submissionId] ?? persisted;
  const candidate = annotation({
    note: own(patch, "note") ? patch.note : previous?.note,
    tags: own(patch, "tags") ? patch.tags : previous?.tags,
    updatedAt: iso(options.now),
  });
  const entries = Object.entries(normalized).filter(
    ([id]) => id !== submissionId,
  );
  if (candidate) entries.push([submissionId, candidate]);
  return normalizeSubmissionAnnotations(
    Object.fromEntries(entries),
    validIds,
  );
}

/** Remove annotations whose immutable submission receipts no longer exist. */
export function pruneSubmissionAnnotations(current, validSubmissionIds) {
  return normalizeSubmissionAnnotations(current, validSubmissionIds);
}
