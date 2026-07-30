const MAX_TEXT_LENGTH = 120;
const MAX_ID_LENGTH = 100;
const MAX_FILTER_VALUES = 20;

export const SUBMISSION_WORK_LOG_STATUSES = Object.freeze([
  "accepted",
  "wrong-answer",
  "compile-error",
  "runtime-error",
  "time-limit",
  "invalid-entrypoint",
  "judge-error",
  "pending",
]);
export const SUBMISSION_WORK_LOG_ORIGINS = Object.freeze([
  "practice",
  "mock",
  "round",
  "transfer",
  "assessment",
  "studio",
]);
export const SUBMISSION_WORK_LOG_LANGUAGES = Object.freeze(["python", "swift"]);
export const SUBMISSION_WORK_LOG_REVISIONS = Object.freeze(["all", "current", "older"]);
export const SUBMISSION_WORK_LOG_RANGES = Object.freeze(["all", "7d", "30d"]);
export const SUBMISSION_WORK_LOG_SORTS = Object.freeze([
  "newest",
  "oldest",
  "problem",
  "verdict",
]);
export const SUBMISSION_WORK_LOG_PAGE_SIZES = Object.freeze([25, 50]);

export const DEFAULT_SUBMISSION_WORK_LOG_QUERY = Object.freeze({
  text: "",
  statuses: Object.freeze([]),
  origins: Object.freeze([]),
  languages: Object.freeze([]),
  revision: "all",
  range: "all",
  sort: "newest",
  page: 1,
  pageSize: 25,
  selectedId: undefined,
  compareId: undefined,
});

const statusSet = new Set(SUBMISSION_WORK_LOG_STATUSES);
const originSet = new Set(SUBMISSION_WORK_LOG_ORIGINS);
const languageSet = new Set(SUBMISSION_WORK_LOG_LANGUAGES);
const revisionSet = new Set(SUBMISSION_WORK_LOG_REVISIONS);
const rangeSet = new Set(SUBMISSION_WORK_LOG_RANGES);
const sortSet = new Set(SUBMISSION_WORK_LOG_SORTS);
const pageSizeSet = new Set(SUBMISSION_WORK_LOG_PAGE_SIZES);
const verdictRank = new Map(SUBMISSION_WORK_LOG_STATUSES.map((status, index) => [status, index]));

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value, maximum = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function normalizeSelectionId(value) {
  const cleaned = cleanText(value, MAX_ID_LENGTH);
  return cleaned || undefined;
}

function normalizeFilter(value, allowed) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== "string" || !allowed.has(entry) || seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry);
    if (result.length >= MAX_FILTER_VALUES) break;
  }
  return result;
}

export function normalizeSubmissionWorkLogQuery(raw) {
  const value = isRecord(raw) ? raw : {};
  return {
    text: cleanText(value.text),
    statuses: normalizeFilter(value.statuses, statusSet),
    origins: normalizeFilter(value.origins, originSet),
    languages: normalizeFilter(value.languages, languageSet),
    revision: revisionSet.has(value.revision) ? value.revision : "all",
    range: rangeSet.has(value.range) ? value.range : "all",
    sort: sortSet.has(value.sort) ? value.sort : "newest",
    page: Number.isSafeInteger(value.page) && value.page >= 1 ? value.page : 1,
    pageSize: pageSizeSet.has(value.pageSize) ? value.pageSize : 25,
    selectedId: normalizeSelectionId(value.selectedId),
    compareId: normalizeSelectionId(value.compareId),
  };
}

function searchable(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compareText(left, right) {
  const a = searchable(left);
  const b = searchable(right);
  if (a < b) return -1;
  if (a > b) return 1;
  const rawA = String(left ?? "");
  const rawB = String(right ?? "");
  return rawA < rawB ? -1 : rawA > rawB ? 1 : 0;
}

function timestamp(value) {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
    return null;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function itemRevisionState(submission, item) {
  if (!item) return "unavailable";
  const submittedRevision = submission?.itemRevision;
  const currentRevision = item?.contentRevision;
  if (!Number.isFinite(submittedRevision) || !Number.isFinite(currentRevision)) return "unavailable";
  return submittedRevision === currentRevision ? "current" : "older";
}

function enrichedRows(submissions, items) {
  const itemsById = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!isRecord(item)) continue;
    const itemId = String(item.itemId ?? "");
    if (itemId && !itemsById.has(itemId)) itemsById.set(itemId, item);
  }

  const rows = [];
  const input = Array.isArray(submissions) ? submissions : [];
  input.forEach((submission, index) => {
    if (!isRecord(submission)) return;
    const submissionId = cleanText(submission.id, MAX_ID_LENGTH);
    const itemId = cleanText(submission.itemId, 500);
    if (!submissionId || !itemId) return;
    const item = itemsById.get(itemId) ?? null;
    const title = cleanText(submission.titleSnapshot, 500)
      || cleanText(item?.title, 500)
      || itemId;
    const submissionLanguage = cleanText(submission.language, 50);
    const itemLanguage = cleanText(item?.language, 50);
    const language = languageSet.has(submissionLanguage)
      ? submissionLanguage
      : languageSet.has(itemLanguage)
        ? itemLanguage
        : "python";
    const status = submission.lifecycle === "pending"
      ? "pending"
      : statusSet.has(submission.status)
        ? submission.status
        : "pending";
    const contextKind = isRecord(submission.context)
      ? cleanText(submission.context.kind, 50)
      : "";
    const legacyOrigin = cleanText(submission.origin, 50);
    const origin = originSet.has(contextKind) ? contextKind : legacyOrigin;
    rows.push({
      submission,
      item,
      title,
      language,
      status,
      origin,
      revision: itemRevisionState(submission, item),
      _index: index,
      _submittedAt: timestamp(submission.requestedAt) ?? timestamp(submission.submittedAt),
    });
  });
  return rows;
}

function matchesText(row, text) {
  const queryTokens = searchable(text).split(" ").filter(Boolean);
  if (!queryTokens.length) return true;
  const haystack = searchable([
    row.submission?.id,
    row.submission?.itemId,
    row.title,
    row.item?.pattern,
    row.item?.difficulty,
    row.origin,
    ...(Array.isArray(row.item?.tags) ? row.item.tags : []),
  ].join(" "));
  return queryTokens.every((token) => haystack.includes(token));
}

function matchesDateRange(row, range, nowMs) {
  if (range === "all") return true;
  if (row._submittedAt === null) return false;
  const days = range === "7d" ? 7 : 30;
  const earliest = nowMs - days * 24 * 60 * 60 * 1000;
  return row._submittedAt >= earliest && row._submittedAt <= nowMs;
}

function matchesFilters(row, query, nowMs) {
  if (query.statuses.length && !query.statuses.includes(row.status)) return false;
  if (query.origins.length && !query.origins.includes(row.origin)) return false;
  if (query.languages.length && !query.languages.includes(row.language)) return false;
  if (query.revision !== "all" && row.revision !== query.revision) return false;
  return matchesDateRange(row, query.range, nowMs) && matchesText(row, query.text);
}

function compareSubmittedAt(left, right, direction) {
  if (left._submittedAt === null && right._submittedAt === null) return 0;
  if (left._submittedAt === null) return 1;
  if (right._submittedAt === null) return -1;
  return (left._submittedAt - right._submittedAt) * direction;
}

function stableSort(rows, sort) {
  return rows.slice().sort((left, right) => {
    let compared = 0;
    if (sort === "oldest") compared = compareSubmittedAt(left, right, 1);
    else if (sort === "newest") compared = compareSubmittedAt(left, right, -1);
    else if (sort === "problem") {
      compared = compareText(left.title, right.title)
        || compareText(left.submission?.itemId, right.submission?.itemId)
        || compareSubmittedAt(left, right, -1);
    } else {
      compared = (verdictRank.get(left.status) ?? verdictRank.size)
        - (verdictRank.get(right.status) ?? verdictRank.size)
        || compareText(left.status, right.status)
        || compareSubmittedAt(left, right, -1);
    }
    return compared
      || compareText(left.submission?.id, right.submission?.id)
      || left._index - right._index;
  });
}

function publicRow(row) {
  return {
    submission: row.submission,
    item: row.item,
    title: row.title,
    language: row.language,
    status: row.status,
    origin: row.origin,
    revision: row.revision,
  };
}

function globalCounts(rows) {
  const accepted = rows.filter((row) => row.status === "accepted").length;
  return {
    all: rows.length,
    accepted,
    nonAccepted: rows.length - accepted,
    uniqueProblems: new Set(
      rows.map((row) => String(row.submission?.itemId ?? "")).filter(Boolean),
    ).size,
  };
}

export function deriveSubmissionWorkLog(input) {
  const value = isRecord(input) ? input : {};
  const query = normalizeSubmissionWorkLogQuery(value.query);
  const rows = enrichedRows(value.submissions, value.items);
  const suppliedNow = timestamp(value.now);
  const nowMs = suppliedNow ?? Date.now();
  const filtered = rows.filter((row) => matchesFilters(row, query, nowMs));
  const sorted = stableSort(filtered, query.sort);
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const offset = (page - 1) * query.pageSize;
  const pageRows = sorted.slice(offset, offset + query.pageSize).map(publicRow);
  return {
    query: { ...query, page },
    rows: pageRows,
    total,
    page,
    pageCount,
    from: total ? offset + 1 : 0,
    to: total ? offset + pageRows.length : 0,
    counts: globalCounts(rows),
  };
}
