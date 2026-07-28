import type { LineRange, TimeRange } from "./catalog-filters.mjs";

export type CatalogLane = "python" | "swift" | "ios";
export type CatalogDifficulty = "Easy" | "Medium" | "Hard";
export type CatalogStatus = "new" | "learning" | "owned" | "due" | "favorite" | "custom";
export type CatalogSort = "recommended" | "relevance" | "catalog" | "title" | "difficulty" | "last-practiced" | "next-review" | "estimated-time";
export type CatalogLayout = "table" | "cards";
export type CatalogDirection = "asc" | "desc";
export type CatalogPageSize = 25 | 50 | 100;
export type CatalogNow = string | number | Date;

export type CatalogQuery = {
  text: string;
  lanes: readonly CatalogLane[];
  patterns: readonly string[];
  difficulties: readonly CatalogDifficulty[];
  statuses: readonly CatalogStatus[];
  lineRange: LineRange;
  timeRange: TimeRange;
  collectionIds: readonly string[];
  sort: CatalogSort;
  direction: CatalogDirection;
  layout: CatalogLayout;
  page: number;
  pageSize: CatalogPageSize;
};

export type CatalogRecord = {
  itemId: string;
  displayId: string;
  numericId?: number;
  title: string;
  lane: CatalogLane;
  pattern: string;
  difficulty: CatalogDifficulty;
  tags: readonly string[];
  cue: string;
  lineCount: number;
  estimatedMinutes: number;
  statuses: readonly CatalogStatus[];
  collectionIds: readonly string[];
  recommendedRank?: number;
  highestStage?: number;
  lastPracticedAt?: string;
  nextReviewAt?: string;
};

export type CatalogFacetCounts = {
  lanes: Record<CatalogLane, number> & Record<string, number>;
  patterns: Record<string, number>;
  difficulties: Record<CatalogDifficulty, number> & Record<string, number>;
  statuses: Record<CatalogStatus, number> & Record<string, number>;
  collections: Record<string, number>;
};

export type CatalogDiscoveryResult<T extends CatalogRecord = CatalogRecord> = {
  query: CatalogQuery;
  effectiveSort: CatalogSort;
  items: T[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
  facets: CatalogFacetCounts;
};

export type CatalogSavedView = {
  id: string;
  name: string;
  query: CatalogQuery;
  createdAt: string;
  updatedAt: string;
};

export type CatalogWorkspace = {
  version: 1;
  revision: number;
  updatedAt: string;
  savedViews: CatalogSavedView[];
};

export const CATALOG_LIMITS: Readonly<{
  maxTextLength: 120;
  maxFacetValues: 50;
  maxFacetValueLength: 120;
  maxSavedViews: 20;
  maxViewNameLength: 80;
  maxViewIdLength: 120;
}>;
export const CATALOG_LANES: readonly CatalogLane[];
export const CATALOG_DIFFICULTIES: readonly CatalogDifficulty[];
export const CATALOG_STATUSES: readonly CatalogStatus[];
export const CATALOG_SORTS: readonly CatalogSort[];
export const CATALOG_LAYOUTS: readonly CatalogLayout[];
export const CATALOG_PAGE_SIZES: readonly CatalogPageSize[];
export const DEFAULT_CATALOG_QUERY: Readonly<CatalogQuery>;

export function normalizeCatalogQuery(raw: unknown): CatalogQuery;
export function catalogQuerySnapshot(raw: unknown): CatalogQuery;
export function discoverCatalog<T extends CatalogRecord>(
  records: readonly T[],
  rawQuery?: unknown,
): CatalogDiscoveryResult<T>;

export function createCatalogWorkspace(now?: CatalogNow): CatalogWorkspace;
export function normalizeCatalogWorkspace(
  value: unknown,
  options?: { now?: CatalogNow },
): CatalogWorkspace;
export function saveCatalogView(
  workspace: unknown,
  input: { name: string; query: unknown },
  options?: { id?: string; now?: CatalogNow },
): CatalogWorkspace;
export function updateCatalogView(
  workspace: unknown,
  id: string,
  patch: { name?: string; query?: unknown },
  options?: { now?: CatalogNow },
): CatalogWorkspace;
export function deleteCatalogView(
  workspace: unknown,
  id: string,
  options?: { now?: CatalogNow },
): CatalogWorkspace;
