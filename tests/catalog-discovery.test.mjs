import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOG_LIMITS,
  DEFAULT_CATALOG_QUERY,
  catalogQuerySnapshot,
  createCatalogWorkspace,
  deleteCatalogView,
  discoverCatalog,
  normalizeCatalogQuery,
  normalizeCatalogWorkspace,
  saveCatalogView,
  updateCatalogView,
} from "../app/lib/catalog-discovery.mjs";

const AT = "2026-07-28T12:00:00.000Z";

function record(overrides = {}) {
  return {
    itemId: "python:1",
    displayId: "Py #1",
    numericId: 1,
    title: "Two Sum",
    lane: "python",
    pattern: "Arrays & Hashing",
    difficulty: "Easy",
    tags: ["dictionary", "lookup"],
    cue: "Find a complement while scanning.",
    lineCount: 12,
    estimatedMinutes: 5,
    statuses: ["new"],
    collectionIds: ["core"],
    ...overrides,
  };
}

const SEARCH_RECORDS = [
  record(),
  record({
    itemId: "python:2",
    displayId: "Py #2",
    numericId: 2,
    title: "Two-Sum Variations",
    cue: "Practice sum variants.",
  }),
  record({
    itemId: "swift:3",
    displayId: "#3",
    numericId: 3,
    title: "Complement Lookup",
    lane: "swift",
    tags: ["two", "sum"],
    cue: "Use a lookup table.",
  }),
  record({
    itemId: "ios:cafe",
    displayId: "iOS 01",
    numericId: 10_001,
    title: "Café-Driven State",
    lane: "ios",
    pattern: "State & Data Flow",
    difficulty: "Medium",
    tags: ["unicode"],
    cue: "Connect view state safely.",
    lineCount: 22,
    estimatedMinutes: 9,
    statuses: ["learning", "favorite"],
    collectionIds: ["ios-core"],
  }),
];

test("query normalization is bounded, deduplicated, deterministic, and non-mutating", () => {
  const raw = {
    text: `  hello\n${"x".repeat(140)}  `,
    lanes: ["python", "python", "bad", 3],
    patterns: [" Trees ", "Trees", ""],
    difficulties: ["Easy", "easy", "Hard"],
    statuses: ["due", "bad", "due"],
    lineRange: "broken",
    timeRange: "6-10",
    collectionIds: [" core ", "core"],
    sort: "nope",
    direction: "sideways",
    layout: "bad",
    page: -3,
    pageSize: 30,
    selectedIds: ["transient"],
  };
  const before = structuredClone(raw);
  const normalized = normalizeCatalogQuery(raw);
  assert.deepEqual(raw, before);
  assert.equal(normalized.text.length, CATALOG_LIMITS.maxTextLength);
  assert.deepEqual(normalized.lanes, ["python"]);
  assert.deepEqual(normalized.patterns, ["Trees"]);
  assert.deepEqual(normalized.difficulties, ["Easy", "Hard"]);
  assert.deepEqual(normalized.statuses, ["due"]);
  assert.deepEqual(normalized.collectionIds, ["core"]);
  assert.deepEqual(
    { ...normalized, text: "" },
    { ...DEFAULT_CATALOG_QUERY, text: "", timeRange: "6-10", lanes: ["python"], patterns: ["Trees"], difficulties: ["Easy", "Hard"], statuses: ["due"], collectionIds: ["core"] },
  );
  assert.equal("selectedIds" in normalized, false);
  assert.deepEqual(normalizeCatalogQuery(null), DEFAULT_CATALOG_QUERY);
});

test("search normalizes Unicode, punctuation, and hyphens and ranks exact title and ID first", () => {
  const hyphenated = discoverCatalog(SEARCH_RECORDS, { text: "two—sum" });
  assert.deepEqual(hyphenated.items.map((item) => item.itemId), ["python:1", "python:2", "swift:3"]);
  assert.equal(hyphenated.effectiveSort, "relevance");

  const unicode = discoverCatalog(SEARCH_RECORDS, { text: "CAFE driven" });
  assert.deepEqual(unicode.items.map((item) => item.itemId), ["ios:cafe"]);

  const exactId = discoverCatalog(SEARCH_RECORDS, { text: "python:2" });
  assert.equal(exactId.items[0].itemId, "python:2");
});

test("tokenized search uses AND across tokens", () => {
  assert.deepEqual(
    discoverCatalog(SEARCH_RECORDS, { text: "complement scanning" }).items.map((item) => item.itemId),
    ["python:1"],
  );
  assert.equal(discoverCatalog(SEARCH_RECORDS, { text: "complement protocol" }).total, 0);
});

test("facets are OR within a facet, AND across facets, and counts precede pagination", () => {
  const result = discoverCatalog(SEARCH_RECORDS, {
    lanes: ["python", "ios"],
    difficulties: ["Medium"],
  });
  assert.deepEqual(result.items.map((item) => item.itemId), ["ios:cafe"]);
  assert.equal(result.facets.lanes.ios, 1);
  assert.equal(result.facets.lanes.python, 0);
  assert.equal(result.facets.statuses.learning, 1);
  assert.equal(result.facets.statuses.favorite, 1);
});

test("statuses, collections, and existing line/time ranges compose", () => {
  assert.deepEqual(
    discoverCatalog(SEARCH_RECORDS, {
      statuses: ["favorite", "due"],
      collectionIds: ["ios-core", "other"],
      lineRange: "16-25",
      timeRange: "6-10",
    }).items.map((item) => item.itemId),
    ["ios:cafe"],
  );
  assert.equal(discoverCatalog(SEARCH_RECORDS, { statuses: ["owned"] }).total, 0);
});

test("recommended status order and explicit evidence rank are deterministic", () => {
  const records = [
    record({ itemId: "owned", title: "Owned", statuses: ["owned"] }),
    record({ itemId: "new", title: "New", statuses: ["new"] }),
    record({ itemId: "learning", title: "Learning", statuses: ["learning"] }),
    record({ itemId: "due", title: "Due", statuses: ["due"] }),
    record({ itemId: "evidence", title: "Evidence", statuses: ["owned"], recommendedRank: -1 }),
  ];
  assert.deepEqual(
    discoverCatalog(records, {}).items.map((item) => item.itemId),
    ["evidence", "due", "learning", "new", "owned"],
  );
});

test("every sort supports both directions and itemId is the stable final tie", () => {
  const records = [
    record({ itemId: "b", displayId: "#20", numericId: 20, title: "Beta", difficulty: "Hard", estimatedMinutes: 20, lastPracticedAt: "2026-07-20T00:00:00Z", nextReviewAt: "2026-08-02T00:00:00Z", statuses: ["owned"] }),
    record({ itemId: "a", displayId: "#10", numericId: 10, title: "Alpha", difficulty: "Easy", estimatedMinutes: 10, lastPracticedAt: "2026-07-10T00:00:00Z", nextReviewAt: "2026-08-01T00:00:00Z", statuses: ["due"] }),
    record({ itemId: "c", displayId: "#20", numericId: 20, title: "Beta", difficulty: "Hard", estimatedMinutes: 20, lastPracticedAt: "2026-07-20T00:00:00Z", nextReviewAt: "2026-08-02T00:00:00Z", statuses: ["owned"] }),
  ];
  for (const sort of ["recommended", "catalog", "title", "difficulty", "last-practiced", "next-review", "estimated-time"]) {
    const asc = discoverCatalog(records, { sort, direction: "asc" }).items.map((item) => item.itemId);
    const desc = discoverCatalog(records, { sort, direction: "desc" }).items.map((item) => item.itemId);
    assert.equal(asc.length, 3, sort);
    assert.equal(desc.length, 3, sort);
    assert.deepEqual(new Set(asc), new Set(desc), sort);
    assert.ok(asc.indexOf("a") !== desc.indexOf("a"), sort);
    assert.ok(asc.indexOf("b") < asc.indexOf("c"), `${sort} asc tie`);
    assert.ok(desc.indexOf("b") < desc.indexOf("c"), `${sort} desc tie`);
  }
  const relevantAsc = discoverCatalog(SEARCH_RECORDS, { text: "two sum", sort: "relevance", direction: "asc" });
  const relevantDesc = discoverCatalog(SEARCH_RECORDS, { text: "two sum", sort: "relevance", direction: "desc" });
  assert.equal(relevantAsc.items[0].itemId, "python:1");
  assert.notEqual(relevantDesc.items[0].itemId, "python:1");
});

test("pagination clamps after filtering with no duplicate or skipped records", () => {
  const records = Array.from({ length: 63 }, (_, index) => record({
    itemId: `python:${index + 1}`,
    displayId: `Py #${index + 1}`,
    numericId: index + 1,
    title: `Problem ${String(index + 1).padStart(3, "0")}`,
  }));
  const first = discoverCatalog(records, { sort: "catalog", page: 1, pageSize: 25 });
  const second = discoverCatalog(records, { sort: "catalog", page: 2, pageSize: 25 });
  const last = discoverCatalog(records, { sort: "catalog", page: 999, pageSize: 25 });
  assert.deepEqual([first.from, first.to, first.pageCount], [1, 25, 3]);
  assert.deepEqual([second.from, second.to], [26, 50]);
  assert.deepEqual([last.page, last.from, last.to, last.items.length], [3, 51, 63, 13]);
  const allIds = [...first.items, ...second.items, ...last.items].map((item) => item.itemId);
  assert.equal(new Set(allIds).size, 63);
  const empty = discoverCatalog([], { page: 100 });
  assert.deepEqual({ page: empty.page, pageCount: empty.pageCount, from: empty.from, to: empty.to }, { page: 1, pageCount: 1, from: 0, to: 0 });
});

test("discovery never mutates records or queries", () => {
  const records = structuredClone(SEARCH_RECORDS);
  const query = { text: "two", statuses: ["new"], page: 7 };
  const recordsBefore = structuredClone(records);
  const queryBefore = structuredClone(query);
  discoverCatalog(records, query);
  assert.deepEqual(records, recordsBefore);
  assert.deepEqual(query, queryBefore);
});

test("saved views create, snapshot, update, and delete immutably", () => {
  const original = createCatalogWorkspace(AT);
  const created = saveCatalogView(original, { name: "  Due Python  ", query: { statuses: ["due"], page: 9, selectedIds: ["x"] } }, { id: "view-1", now: "2026-07-28T13:00:00Z" });
  assert.equal(original.savedViews.length, 0);
  assert.equal(created.revision, 1);
  assert.equal(created.savedViews[0].name, "Due Python");
  assert.equal(created.savedViews[0].query.page, 1);
  assert.equal("selectedIds" in created.savedViews[0].query, false);

  const updated = updateCatalogView(created, "view-1", { name: "Owned", query: { statuses: ["owned"], page: 3 } }, { now: "2026-07-28T14:00:00Z" });
  assert.equal(created.savedViews[0].name, "Due Python");
  assert.equal(updated.savedViews[0].name, "Owned");
  assert.equal(updated.savedViews[0].query.page, 1);
  assert.equal(updated.savedViews[0].createdAt, created.savedViews[0].createdAt);
  const deleted = deleteCatalogView(updated, "view-1", { now: "2026-07-28T15:00:00Z" });
  assert.equal(deleted.savedViews.length, 0);
  assert.equal(deleted.revision, 3);
});

test("saved view duplicate IDs and full workspaces do not evict or revise", () => {
  let workspace = createCatalogWorkspace(AT);
  workspace = saveCatalogView(workspace, { name: "First", query: {} }, { id: "same", now: AT });
  const duplicate = saveCatalogView(workspace, { name: "Replacement", query: {} }, { id: "same", now: AT });
  assert.deepEqual(duplicate, workspace);
  for (let index = 1; index < CATALOG_LIMITS.maxSavedViews; index += 1) {
    workspace = saveCatalogView(workspace, { name: `View ${index}`, query: {} }, { id: `view-${index}`, now: AT });
  }
  const before = structuredClone(workspace);
  const full = saveCatalogView(workspace, { name: "Overflow", query: {} }, { id: "overflow", now: AT });
  assert.deepEqual(full, before);
  assert.equal(full.savedViews.length, CATALOG_LIMITS.maxSavedViews);
});

test("malformed workspaces are repaired and duplicate IDs choose the latest view", () => {
  const repaired = normalizeCatalogWorkspace({
    version: 99,
    revision: -3,
    updatedAt: "invalid",
    savedViews: [
      null,
      { id: "bad id", name: "drop", query: {} },
      { id: "kept", name: " Old ", query: { page: 7 }, createdAt: "invalid", updatedAt: "2026-07-28T10:00:00Z" },
      { id: "kept", name: " New ", query: { layout: "cards", page: 8 }, createdAt: "2026-07-28T09:00:00Z", updatedAt: "2026-07-28T11:00:00Z" },
    ],
  }, { now: AT });
  assert.equal(repaired.version, 1);
  assert.equal(repaired.revision, 0);
  assert.equal(repaired.updatedAt, AT);
  assert.equal(repaired.savedViews.length, 1);
  assert.equal(repaired.savedViews[0].name, "New");
  assert.equal(repaired.savedViews[0].query.layout, "cards");
  assert.equal(repaired.savedViews[0].query.page, 1);
  assert.deepEqual(normalizeCatalogWorkspace(undefined, { now: AT }), createCatalogWorkspace(AT));
  assert.equal(catalogQuerySnapshot({ page: 50 }).page, 1);
});
