import { matchesCatalogRanges } from "./catalog-filters.mjs";

const ISO_EPOCH = "1970-01-01T00:00:00.000Z";
const LINE_RANGES = new Set(["all", "up-to-15", "16-25", "26-40", "41-plus"]);
const TIME_RANGES = new Set(["all", "up-to-5", "6-10", "11-15", "16-plus"]);

export const CATALOG_LIMITS = Object.freeze({
  maxTextLength: 120,
  maxFacetValues: 50,
  maxFacetValueLength: 120,
  maxSavedViews: 20,
  maxViewNameLength: 80,
  maxViewIdLength: 120,
});

export const CATALOG_LANES = Object.freeze(["python", "swift", "ios"]);
export const CATALOG_DIFFICULTIES = Object.freeze(["Easy", "Medium", "Hard"]);
export const CATALOG_STATUSES = Object.freeze([
  "new",
  "learning",
  "owned",
  "due",
  "favorite",
  "custom",
]);
export const CATALOG_SORTS = Object.freeze([
  "recommended",
  "relevance",
  "catalog",
  "title",
  "difficulty",
  "last-practiced",
  "next-review",
  "estimated-time",
]);
export const CATALOG_LAYOUTS = Object.freeze(["table", "cards"]);
export const CATALOG_PAGE_SIZES = Object.freeze([25, 50, 100]);

const DEFAULT_QUERY_VALUE = {
  text: "",
  lanes: [],
  patterns: [],
  difficulties: [],
  statuses: [],
  lineRange: "all",
  timeRange: "all",
  collectionIds: [],
  sort: "recommended",
  direction: "asc",
  layout: "table",
  page: 1,
  pageSize: 25,
};

export const DEFAULT_CATALOG_QUERY = Object.freeze({
  ...DEFAULT_QUERY_VALUE,
  lanes: Object.freeze([]),
  patterns: Object.freeze([]),
  difficulties: Object.freeze([]),
  statuses: Object.freeze([]),
  collectionIds: Object.freeze([]),
});

const laneSet = new Set(CATALOG_LANES);
const difficultySet = new Set(CATALOG_DIFFICULTIES);
const statusSet = new Set(CATALOG_STATUSES);
const sortSet = new Set(CATALOG_SORTS);
const layoutSet = new Set(CATALOG_LAYOUTS);
const pageSizeSet = new Set(CATALOG_PAGE_SIZES);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value, limit, fallback = "") {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
  return cleaned || fallback;
}

function cleanId(value, fallback = "") {
  const id = cleanText(value, CATALOG_LIMITS.maxViewIdLength);
  return /^[\w:.-]+$/.test(id) ? id : fallback;
}

function boundedInteger(value, fallback, minimum, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = typeof value === "number" ? value : Number.NaN;
  return Number.isInteger(numeric) && numeric >= minimum && numeric <= maximum
    ? numeric
    : fallback;
}

function normalizeFacet(value, allowed) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const raw of value) {
    const entry = cleanText(raw, CATALOG_LIMITS.maxFacetValueLength);
    if (!entry || seen.has(entry) || (allowed && !allowed.has(entry))) continue;
    seen.add(entry);
    result.push(entry);
    if (result.length >= CATALOG_LIMITS.maxFacetValues) break;
  }
  return result;
}

export function normalizeCatalogQuery(raw) {
  const value = isRecord(raw) ? raw : {};
  return {
    text: cleanText(value.text, CATALOG_LIMITS.maxTextLength),
    lanes: normalizeFacet(value.lanes, laneSet),
    patterns: normalizeFacet(value.patterns),
    difficulties: normalizeFacet(value.difficulties, difficultySet),
    statuses: normalizeFacet(value.statuses, statusSet),
    lineRange: LINE_RANGES.has(value.lineRange) ? value.lineRange : "all",
    timeRange: TIME_RANGES.has(value.timeRange) ? value.timeRange : "all",
    collectionIds: normalizeFacet(value.collectionIds),
    sort: sortSet.has(value.sort) ? value.sort : "recommended",
    direction: value.direction === "desc" ? "desc" : "asc",
    layout: layoutSet.has(value.layout) ? value.layout : "table",
    page: boundedInteger(value.page, 1, 1),
    pageSize: pageSizeSet.has(value.pageSize) ? value.pageSize : 25,
  };
}

export function catalogQuerySnapshot(raw) {
  return { ...normalizeCatalogQuery(raw), page: 1 };
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

function tokens(value) {
  const normalized = searchable(value);
  return normalized ? normalized.split(" ") : [];
}

function bestTokenScore(token, fields) {
  let score = 0;
  for (const [weight, fieldTokens] of fields) {
    for (const fieldToken of fieldTokens) {
      if (fieldToken === token) score = Math.max(score, weight);
      else if (fieldToken.startsWith(token)) score = Math.max(score, weight - 5);
    }
  }
  return score;
}

function searchScore(record, queryTokens, normalizedQuery) {
  if (!queryTokens.length) return 0;
  const itemId = searchable(record?.itemId);
  const displayId = searchable(record?.displayId);
  const numericId = Number.isFinite(record?.numericId) ? searchable(record.numericId) : "";
  const title = searchable(record?.title);
  const idTokens = tokens(`${record?.itemId ?? ""} ${record?.displayId ?? ""} ${numericId}`);
  const titleTokens = tokens(record?.title);
  const patternTokens = tokens(record?.pattern);
  const tagTokens = tokens(Array.isArray(record?.tags) ? record.tags.join(" ") : "");
  const cueTokens = tokens(record?.cue);
  let score = 0;
  for (const token of queryTokens) {
    const tokenScore = bestTokenScore(token, [
      [90, idTokens],
      [75, titleTokens],
      [45, patternTokens],
      [40, tagTokens],
      [25, cueTokens],
    ]);
    if (!tokenScore) return null;
    score += tokenScore;
  }
  if (normalizedQuery === itemId || normalizedQuery === displayId || normalizedQuery === numericId) {
    score += 20_000;
  } else if (normalizedQuery === title) {
    score += 15_000;
  } else if (title.startsWith(normalizedQuery)) {
    score += 2_000;
  }
  return score;
}

function overlaps(selected, values) {
  if (!selected.length) return true;
  const candidates = new Set(Array.isArray(values) ? values : []);
  return selected.some((value) => candidates.has(value));
}

function matchesFacets(record, query) {
  if (query.lanes.length && !query.lanes.includes(record?.lane)) return false;
  if (query.patterns.length && !query.patterns.includes(record?.pattern)) return false;
  if (query.difficulties.length && !query.difficulties.includes(record?.difficulty)) return false;
  if (!overlaps(query.statuses, record?.statuses)) return false;
  if (!overlaps(query.collectionIds, record?.collectionIds)) return false;
  return matchesCatalogRanges(record, query.lineRange, query.timeRange);
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

function compareFinite(left, right) {
  const a = Number.isFinite(left) ? left : null;
  const b = Number.isFinite(right) ? right : null;
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function timestamp(value) {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function compareNullableDates(left, right) {
  const a = timestamp(left);
  const b = timestamp(right);
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

const difficultyRank = new Map(CATALOG_DIFFICULTIES.map((value, index) => [value, index]));
const recommendationRank = new Map(["due", "learning", "new", "owned"].map((value, index) => [value, index]));

function recommendedRank(record) {
  if (Number.isFinite(record?.recommendedRank)) return record.recommendedRank;
  let rank = recommendationRank.size;
  for (const status of Array.isArray(record?.statuses) ? record.statuses : []) {
    rank = Math.min(rank, recommendationRank.get(status) ?? recommendationRank.size);
  }
  return rank;
}

function catalogNumber(record) {
  if (Number.isFinite(record?.numericId)) return record.numericId;
  const match = String(record?.displayId ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function primaryComparator(sort, scores) {
  if (sort === "relevance") {
    return (a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || compareText(a?.title, b?.title);
  }
  if (sort === "recommended") {
    return (a, b) => recommendedRank(a) - recommendedRank(b)
      || compareFinite(a?.estimatedMinutes, b?.estimatedMinutes)
      || compareText(a?.title, b?.title);
  }
  if (sort === "catalog") {
    return (a, b) => compareFinite(catalogNumber(a), catalogNumber(b))
      || compareText(a?.displayId, b?.displayId);
  }
  if (sort === "title") return (a, b) => compareText(a?.title, b?.title);
  if (sort === "difficulty") {
    return (a, b) => compareFinite(difficultyRank.get(a?.difficulty), difficultyRank.get(b?.difficulty));
  }
  if (sort === "last-practiced") return (a, b) => compareNullableDates(a?.lastPracticedAt, b?.lastPracticedAt);
  if (sort === "next-review") return (a, b) => compareNullableDates(a?.nextReviewAt, b?.nextReviewAt);
  return (a, b) => compareFinite(a?.estimatedMinutes, b?.estimatedMinutes);
}

function stableSort(records, sort, direction, scores) {
  const primary = primaryComparator(sort, scores);
  const multiplier = direction === "desc" ? -1 : 1;
  return records.slice().sort((left, right) => {
    const compared = primary(left, right);
    if (compared) return compared * multiplier;
    return compareText(left?.itemId, right?.itemId);
  });
}

function increment(map, raw) {
  const value = cleanText(raw, CATALOG_LIMITS.maxFacetValueLength);
  if (value) map.set(value, (map.get(value) ?? 0) + 1);
}

function countMany(map, values) {
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const cleaned = cleanText(value, CATALOG_LIMITS.maxFacetValueLength);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    increment(map, cleaned);
  }
}

function countObject(map, fixedValues = []) {
  for (const value of fixedValues) if (!map.has(value)) map.set(value, 0);
  return Object.fromEntries([...map].sort(([left], [right]) => compareText(left, right)));
}

function facetCounts(records) {
  const lanes = new Map();
  const patterns = new Map();
  const difficulties = new Map();
  const statuses = new Map();
  const collections = new Map();
  for (const record of records) {
    increment(lanes, record?.lane);
    increment(patterns, record?.pattern);
    increment(difficulties, record?.difficulty);
    countMany(statuses, record?.statuses);
    countMany(collections, record?.collectionIds);
  }
  return {
    lanes: countObject(lanes, CATALOG_LANES),
    patterns: countObject(patterns),
    difficulties: countObject(difficulties, CATALOG_DIFFICULTIES),
    statuses: countObject(statuses, CATALOG_STATUSES),
    collections: countObject(collections),
  };
}

export function discoverCatalog(records, rawQuery) {
  const query = normalizeCatalogQuery(rawQuery);
  const input = Array.isArray(records) ? records : [];
  const queryTokens = tokens(query.text);
  const normalizedText = searchable(query.text);
  const scores = new Map();
  const filtered = [];
  for (const record of input) {
    if (!isRecord(record) || !matchesFacets(record, query)) continue;
    const score = searchScore(record, queryTokens, normalizedText);
    if (score === null) continue;
    scores.set(record, score);
    filtered.push(record);
  }
  const effectiveSort = query.text && query.sort === "recommended" ? "relevance" : query.sort;
  const sorted = stableSort(filtered, effectiveSort, query.direction, scores);
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const offset = (page - 1) * query.pageSize;
  const items = sorted.slice(offset, offset + query.pageSize);
  return {
    query: { ...query, page },
    effectiveSort,
    items,
    total,
    page,
    pageCount,
    from: total ? offset + 1 : 0,
    to: total ? offset + items.length : 0,
    facets: facetCounts(filtered),
  };
}

function iso(value, fallback) {
  const parsed = value instanceof Date
    ? value.getTime()
    : typeof value === "string" || typeof value === "number"
      ? new Date(value).getTime()
      : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function normalizeSavedView(raw, now) {
  if (!isRecord(raw)) return null;
  const id = cleanId(raw.id);
  if (!id) return null;
  const name = cleanText(raw.name, CATALOG_LIMITS.maxViewNameLength, "Untitled view");
  const createdAt = iso(raw.createdAt, now);
  const updatedAt = iso(raw.updatedAt, createdAt);
  return { id, name, query: catalogQuerySnapshot(raw.query), createdAt, updatedAt };
}

export function createCatalogWorkspace(now = new Date().toISOString()) {
  return {
    version: 1,
    revision: 0,
    updatedAt: iso(now, ISO_EPOCH),
    savedViews: [],
  };
}

export function normalizeCatalogWorkspace(value, options = {}) {
  const now = iso(options.now, ISO_EPOCH);
  if (!isRecord(value)) return createCatalogWorkspace(now);
  const workspaceUpdatedAt = iso(value.updatedAt, now);
  const byId = new Map();
  for (const raw of Array.isArray(value.savedViews) ? value.savedViews : []) {
    const savedView = normalizeSavedView(raw, workspaceUpdatedAt);
    if (!savedView) continue;
    const existing = byId.get(savedView.id);
    if (!existing || timestamp(savedView.updatedAt) > timestamp(existing.updatedAt)) {
      byId.set(savedView.id, savedView);
    }
  }
  return {
    version: 1,
    revision: boundedInteger(value.revision, 0, 0, 2_147_483_647),
    updatedAt: workspaceUpdatedAt,
    savedViews: [...byId.values()].slice(0, CATALOG_LIMITS.maxSavedViews),
  };
}

function generatedViewId(workspace, name, now) {
  const namePart = searchable(name).replace(/\s+/g, "-").slice(0, 32) || "view";
  const timePart = Math.max(0, timestamp(now) ?? 0).toString(36);
  const base = cleanId(`${namePart}-${timePart}`, `catalog-view-${timePart}`);
  if (!workspace.savedViews.some((view) => view.id === base)) return base;
  let suffix = 2;
  while (workspace.savedViews.some((view) => view.id === `${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function changedWorkspace(workspace, savedViews, now) {
  return {
    version: 1,
    revision: Math.min(workspace.revision + 1, 2_147_483_647),
    updatedAt: now,
    savedViews,
  };
}

export function saveCatalogView(workspaceValue, input = {}, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  const workspace = normalizeCatalogWorkspace(workspaceValue, { now });
  if (workspace.savedViews.length >= CATALOG_LIMITS.maxSavedViews) return workspace;
  const name = cleanText(input?.name, CATALOG_LIMITS.maxViewNameLength, "Untitled view");
  const explicitId = options.id === undefined ? "" : cleanId(options.id);
  if (options.id !== undefined && !explicitId) return workspace;
  const id = explicitId || generatedViewId(workspace, name, now);
  if (workspace.savedViews.some((view) => view.id === id)) return workspace;
  const savedView = { id, name, query: catalogQuerySnapshot(input?.query), createdAt: now, updatedAt: now };
  return changedWorkspace(workspace, [...workspace.savedViews, savedView], now);
}

export function updateCatalogView(workspaceValue, idValue, patch = {}, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  const workspace = normalizeCatalogWorkspace(workspaceValue, { now });
  const id = cleanId(idValue);
  const index = workspace.savedViews.findIndex((view) => view.id === id);
  if (index < 0) return workspace;
  const existing = workspace.savedViews[index];
  const updated = {
    ...existing,
    name: patch?.name === undefined
      ? existing.name
      : cleanText(patch.name, CATALOG_LIMITS.maxViewNameLength, existing.name),
    query: patch?.query === undefined ? existing.query : catalogQuerySnapshot(patch.query),
    updatedAt: now,
  };
  const savedViews = workspace.savedViews.map((view, viewIndex) => viewIndex === index ? updated : view);
  return changedWorkspace(workspace, savedViews, now);
}

export function deleteCatalogView(workspaceValue, idValue, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  const workspace = normalizeCatalogWorkspace(workspaceValue, { now });
  const id = cleanId(idValue);
  if (!workspace.savedViews.some((view) => view.id === id)) return workspace;
  return changedWorkspace(workspace, workspace.savedViews.filter((view) => view.id !== id), now);
}
