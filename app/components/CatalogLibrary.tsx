"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CATALOG_DIFFICULTIES,
  CATALOG_LIMITS,
  CATALOG_PAGE_SIZES,
  CATALOG_SORTS,
  CATALOG_STATUSES,
  catalogQuerySnapshot,
  discoverCatalog,
  type CatalogDifficulty,
  type CatalogLane,
  type CatalogQuery,
  type CatalogRecord,
  type CatalogSort,
  type CatalogStatus,
} from "../lib/catalog-discovery.mjs";
import { supportsConceptPractice } from "../lib/concept-practice.mjs";
import {
  canSolveItem,
  itemDisplayId,
  type ItemId,
  type PracticeItem,
} from "../lib/items";
import {
  itemStats,
  reviewDueAt,
  type AppState,
  type PracticeKind,
} from "../lib/product";
import { STUDY_PLAN_LIMITS } from "../lib/study-plans.mjs";
import { ProblemNotesDialog } from "./ProblemNotesDialog";
import type { ProblemNote } from "../lib/problem-notes.mjs";

// Question marks are deliberately outside the persisted study-collection ID allowlist.
const ANY_COLLECTION_ID = "catalog:any-collection?";
const NO_COLLECTION_ID = "catalog:no-collection?";
const LINE_RANGES: Array<[CatalogQuery["lineRange"], string]> = [
  ["all", "Any length"],
  ["up-to-15", "Up to 15 lines"],
  ["16-25", "16–25 lines"],
  ["26-40", "26–40 lines"],
  ["41-plus", "41+ lines"],
];
const TIME_RANGES: Array<[CatalogQuery["timeRange"], string]> = [
  ["all", "Any time"],
  ["up-to-5", "Up to 5 min"],
  ["6-10", "6–10 min"],
  ["11-15", "11–15 min"],
  ["16-plus", "16+ min"],
];
const LANE_OPTIONS: Array<[CatalogLane, string]> = [
  ["python", "Python interview"],
  ["swift", "Swift interview"],
  ["ios", "iOS & Swift"],
];
const SORT_LABELS: Record<CatalogSort, string> = {
  recommended: "Recommended",
  relevance: "Relevance",
  catalog: "Catalog ID",
  title: "Title",
  difficulty: "Difficulty",
  "last-practiced": "Last practiced",
  "next-review": "Next review",
  "estimated-time": "Estimated time",
};
const STATUS_LABELS: Record<CatalogStatus, string> = {
  new: "Not started",
  learning: "Attempted",
  owned: "Solved / owned",
  due: "Review due",
  favorite: "Favorite",
  custom: "Custom",
};

type CatalogRecordView = CatalogRecord & {
  itemId: ItemId;
  item: PracticeItem;
  lifecycle: "new" | "learning" | "owned";
  recommendationReason:
    | "Review due"
    | "Needs independent Python solve"
    | "Needs independent Swift solve"
    | "Continue current evidence"
    | "New iOS concept"
    | "New Swift recall"
    | "New interview problem"
    | "Retained—schedule later";
  collectionTitles: string[];
  currentRevision: number;
  highestPracticedStage: number;
  verifiedSolves: number;
  strongConceptEvidence: number;
};

export type CatalogLibraryProps = {
  state: AppState;
  items: PracticeItem[];
  now: number;
  query: CatalogQuery;
  onQueryChange: (
    nextQuery: CatalogQuery,
    history: "push" | "replace",
  ) => void;
  onOpen: (
    item: PracticeItem,
    stage?: number,
    challengeDate?: string,
    sessionId?: string,
    practiceKind?: PracticeKind,
  ) => void;
  onFavorite: (id: ItemId) => void;
  onCreateSnippet: () => void;
  onEditSnippet: (item: PracticeItem) => void;
  onArchiveSnippet: (id: ItemId) => void;
  onSaveView: (name: string, query: CatalogQuery) => void;
  onUpdateView: (
    id: string,
    patch: { name?: string; query?: CatalogQuery },
  ) => void;
  onDeleteView: (id: string) => void;
  onSaveProblemNote: (note: Omit<ProblemNote, "updatedAt">) => boolean;
  onDeleteProblemNote: (id: ItemId) => boolean;
  onAppendToCollection: (collectionId: string, itemIds: ItemId[]) => void;
  onCreateCollection: (name: string, itemIds: ItemId[]) => void;
  onStartChallengeSet: (
    itemIds: ItemId[],
    mode: "practice" | "timed",
  ) => void;
};

function latestIso(values: Array<string | null | undefined>) {
  let latest: string | undefined;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const time = Date.parse(value);
    if (!Number.isNaN(time) && time > latestTime) {
      latest = value;
      latestTime = time;
    }
  }
  return latest;
}

function displayDate(value?: string) {
  if (!value) return "No activity yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function laneLabel(lane: CatalogLane) {
  return LANE_OPTIONS.find(([value]) => value === lane)?.[1] ?? lane;
}

function toggleValue<T extends string>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function queryMatches(left: CatalogQuery, right: CatalogQuery) {
  return JSON.stringify(catalogQuerySnapshot(left)) === JSON.stringify(catalogQuerySnapshot(right));
}

function PageSelectionCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label="Select all results on this page"
      onChange={onChange}
    />
  );
}

function CollectionBadges({ titles }: { titles: string[] }) {
  if (!titles.length) return <span className="catalog-muted">None</span>;
  const hidden = titles.slice(2);
  return (
    <span className="catalog-collection-badges" title={titles.join(", ")}>
      {titles.slice(0, 2).map((title) => (
        <span className="catalog-collection-badge" key={title}>{title}</span>
      ))}
      {hidden.length ? (
        <span
          className="catalog-collection-badge catalog-collection-more"
          aria-label={`${hidden.length} more collections: ${hidden.join(", ")}`}
        >
          +{hidden.length}
        </span>
      ) : null}
    </span>
  );
}

function Evidence({ record }: { record: CatalogRecordView }) {
  const canSolve = canSolveItem(record.item);
  const solveAuthority = record.item.solveCapability === "server" ? "server" : "local";
  const modalityEvidence = canSolve
    ? record.verifiedSolves
      ? `${record.verifiedSolves} accepted ${solveAuthority} solve${record.verifiedSolves === 1 ? "" : "s"}`
      : `No accepted ${solveAuthority} solve`
    : record.item.track === "ios"
      ? record.strongConceptEvidence
        ? `${record.strongConceptEvidence} strong concept recall${record.strongConceptEvidence === 1 ? "" : "s"}`
        : "Self-assessed concept practice"
      : record.highestPracticedStage
        ? `Stage ${record.highestPracticedStage} implementation recall`
        : record.item.solveCapability === "server"
          ? "Server-judged Swift solve"
          : "Swift recall · not locally executed";
  const evidenceParts = [
    `Revision ${record.currentRevision}`,
    modalityEvidence,
  ];
  return (
    <div className="catalog-evidence">
      <strong>{STATUS_LABELS[record.lifecycle]}</strong>
      {record.statuses.includes("due") ? <span>Review due</span> : null}
      <small>{evidenceParts.join(" · ")}</small>
      <small>
        Last activity: {record.lastPracticedAt ? (
          <time dateTime={record.lastPracticedAt}>{displayDate(record.lastPracticedAt)}</time>
        ) : "none"}
        {" · "}
        {record.nextReviewAt ? (
          <>Next review: <time dateTime={record.nextReviewAt}>{displayDate(record.nextReviewAt)}</time></>
        ) : "No review scheduled"}
      </small>
    </div>
  );
}

function ItemActions({
  record,
  state,
  onOpen,
  onFavorite,
  onEditSnippet,
  onArchiveSnippet,
  onNotes,
  hasNote,
}: Pick<
  CatalogLibraryProps,
  "state" | "onOpen" | "onFavorite" | "onEditSnippet" | "onArchiveSnippet"
> & { record: CatalogRecordView; onNotes: () => void; hasNote: boolean }) {
  const { item } = record;
  const isFavorite = state.favorites.includes(item.itemId);
  const concept = supportsConceptPractice(item);
  const due = record.statuses.includes("due");
  const primaryKind: PracticeKind = due
    ? concept
      ? "concept"
      : "typing"
    : canSolveItem(item)
      ? "solving"
      : concept
        ? "concept"
        : "typing";
  const primaryLabel = record.statuses.includes("due")
    ? "Recall"
    : canSolveItem(item)
      ? "Solve"
      : concept
      ? "Practice concept"
      : record.lifecycle === "new"
        ? "Start practice"
        : "Continue practice";
  const stage = Math.min(5, Math.max(1, record.highestStage ? record.highestStage + 1 : 1));
  const canSolve = canSolveItem(item);
  return (
    <div className="catalog-row-actions">
      <button type="button" className="catalog-primary-action" onClick={() => onOpen(item, stage, undefined, undefined, primaryKind)}>
        {primaryLabel}
      </button>
      {canSolve && due ? (
        <button type="button" onClick={() => onOpen(item, 1, undefined, undefined, "solving")}>
          Solve
        </button>
      ) : null}
      <button type="button" className={hasNote ? "has-note" : undefined} onClick={onNotes}>
        {hasNote ? "Edit notes" : "Notes"}
      </button>
      <button
        type="button"
        aria-pressed={isFavorite}
        aria-label={`${isFavorite ? "Remove" : "Add"} ${item.title} ${isFavorite ? "from" : "to"} favorites`}
        onClick={() => onFavorite(item.itemId)}
      >
        {isFavorite ? "Unfavorite" : "Favorite"}
      </button>
      {item.source === "custom" ? (
        <>
          <button type="button" aria-label={`Edit custom ${item.verification ? "challenge" : "snippet"} ${item.title}`} onClick={() => onEditSnippet(item)}>Edit</button>
          <button type="button" aria-label={`Archive custom practice item ${item.title}`} onClick={() => onArchiveSnippet(item.itemId)}>Archive</button>
        </>
      ) : null}
    </div>
  );
}

export function CatalogLibrary({
  state,
  items,
  now,
  query,
  onQueryChange,
  onOpen,
  onFavorite,
  onCreateSnippet,
  onEditSnippet,
  onArchiveSnippet,
  onSaveView,
  onUpdateView,
  onDeleteView,
  onSaveProblemNote,
  onDeleteProblemNote,
  onAppendToCollection,
  onCreateCollection,
  onStartChallengeSet,
}: CatalogLibraryProps) {
  const [selectedIds, setSelectedIds] = useState<Set<ItemId>>(() => new Set());
  const [selectionMessage, setSelectionMessage] = useState("");
  const [saveName, setSaveName] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [bulkCollectionId, setBulkCollectionId] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [noteItemId, setNoteItemId] = useState<ItemId | null>(null);

  const liveCollections = state.studyWorkspace.collections;
  const liveItemIds = useMemo(
    () => new Set(items.map((item) => item.itemId)),
    [items],
  );
  const collectionById = useMemo(
    () => new Map(liveCollections.map((collection) => [collection.id, collection])),
    [liveCollections],
  );
  const records = useMemo<CatalogRecordView[]>(() => {
    const membershipByItem = new Map<ItemId, string[]>();
    for (const collection of state.studyWorkspace.collections) {
      for (const itemId of collection.itemIds) {
        const memberships = membershipByItem.get(itemId) ?? [];
        if (!memberships.includes(collection.id)) memberships.push(collection.id);
        membershipByItem.set(itemId, memberships);
      }
    }
    const favoriteIds = new Set(state.favorites);
    return items.map((item) => {
      const stats = itemStats(state, item.itemId);
      const dueAt = reviewDueAt(state, item.itemId);
      const currentAttempts = state.attempts.filter(
        (attempt) => attempt.itemId === item.itemId && attempt.itemRevision === item.contentRevision,
      );
      const currentEvents = state.learningEvents.filter(
        (event) => event.itemId === item.itemId && event.itemRevision === item.contentRevision,
      );
      const hasCurrentEvidence = currentAttempts.length > 0 || currentEvents.length > 0;
      const lifecycle: CatalogRecordView["lifecycle"] = stats.owned
        ? "owned"
        : hasCurrentEvidence
          ? "learning"
          : "new";
      const due = Boolean(dueAt && dueAt.getTime() <= now);
      const memberships = membershipByItem.get(item.itemId) ?? [];
      const collectionTitles = memberships.flatMap((id) => {
        const title = state.studyWorkspace.collections.find((collection) => collection.id === id)?.title;
        return title ? [title] : [];
      });
      const canSolve = canSolveItem(item);
      const recommendationReason: CatalogRecordView["recommendationReason"] = due
        ? "Review due"
        : canSolve && stats.solveCompletions === 0
          ? item.language === "swift"
            ? "Needs independent Swift solve"
            : "Needs independent Python solve"
          : lifecycle === "learning"
            ? "Continue current evidence"
            : lifecycle === "new"
              ? item.track === "ios"
                ? "New iOS concept"
                : item.language === "swift"
                  ? "New Swift recall"
                  : "New interview problem"
              : "Retained—schedule later";
      const recommendedRank = due
        ? 0
        : canSolve && stats.solveCompletions === 0
          ? 1
          : lifecycle === "learning"
            ? 2
            : lifecycle === "new"
              ? 3
              : 4;
      const lastActivityAt = latestIso([
        ...currentAttempts.map((attempt) => attempt.completedAt),
        ...currentEvents.map((event) => event.createdAt),
      ]);
      const highestPracticedStage = currentAttempts.reduce(
        (highest, attempt) => Math.max(highest, attempt.stage),
        stats.highestPracticedStage,
      );
      const collectionIds = memberships.length
        ? [...memberships, ANY_COLLECTION_ID]
        : [NO_COLLECTION_ID];
      const statuses: CatalogStatus[] = [
        lifecycle,
        ...(due ? ["due" as const] : []),
        ...(favoriteIds.has(item.itemId) ? ["favorite" as const] : []),
        ...(item.source === "custom" ? ["custom" as const] : []),
      ];
      return {
        item,
        itemId: item.itemId,
        displayId: itemDisplayId(item),
        ...(item.source === "builtin" ? { numericId: item.id } : {}),
        title: item.title,
        lane: item.track === "ios" ? "ios" : item.language,
        pattern: item.pattern,
        difficulty: item.difficulty,
        tags: item.tags,
        cue: `${item.cue} ${item.invariant} ${item.complexity}`,
        lineCount: item.code.split("\n").length,
        estimatedMinutes: item.estimatedMinutes,
        statuses,
        collectionIds,
        recommendedRank,
        highestStage: stats.highestStage,
        lastPracticedAt: lastActivityAt,
        nextReviewAt: dueAt?.toISOString(),
        lifecycle,
        recommendationReason,
        collectionTitles,
        currentRevision: item.contentRevision,
        highestPracticedStage,
        verifiedSolves: stats.solveCompletions,
        strongConceptEvidence: stats.strongConceptCompletions,
      };
    });
  }, [items, now, state]);

  const result = useMemo(() => discoverCatalog(records, query), [records, query]);
  const workspaceStats = useMemo(() => ({
    total: records.length,
    solved: records.filter((record) => record.lifecycle === "owned").length,
    attempted: records.filter((record) => record.lifecycle === "learning").length,
    due: records.filter((record) => record.statuses.includes("due")).length,
    notes: records.filter((record) => Boolean(state.problemNotes[record.itemId])).length,
  }), [records, state.problemNotes]);
  const laneCounts = useMemo(() => ({
    python: records.filter((record) => record.lane === "python").length,
    swift: records.filter((record) => record.lane === "swift").length,
    ios: records.filter((record) => record.lane === "ios").length,
  }), [records]);
  const activeSelectedIds = useMemo(
    () =>
      new Set([...selectedIds].filter((itemId) => liveItemIds.has(itemId))),
    [liveItemIds, selectedIds],
  );
  const patternOptions = useMemo(
    () => [...new Set(items.map((item) => item.pattern))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const selectedResultCount = useMemo(() => {
    if (!activeSelectedIds.size) return 0;
    return discoverCatalog(
      records.filter((record) => activeSelectedIds.has(record.item.itemId)),
      { ...query, page: 1, pageSize: 100 },
    ).total;
  }, [activeSelectedIds, query, records]);
  const selected = [...activeSelectedIds];
  const selectedItems = selected.flatMap((itemId) => {
    const candidate = items.find((item) => item.itemId === itemId);
    return candidate ? [candidate] : [];
  });
  const challengeSetSizeIsValid =
    selectedItems.length >= 2 &&
    selectedItems.length <= 12 &&
    selectedItems.every(
      (candidate) =>
        candidate.source === "builtin" &&
        !candidate.transfer &&
        !candidate.archivedAt,
    );
  const timedSetIsValid =
    selectedItems.length >= 2 &&
    selectedItems.length <= 4 &&
    selectedItems.every(
      (candidate) =>
        !candidate.transfer &&
        candidate.source === "builtin" &&
        candidate.track === "interview" &&
        candidate.language === "python" &&
        Boolean(candidate.verification),
    );
  const selectedOutsideResults = activeSelectedIds.size - selectedResultCount;
  const pageIds = result.items.map((record) => record.item.itemId);
  const selectedOnPage = pageIds.filter((itemId) => activeSelectedIds.has(itemId)).length;
  const allPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const somePageSelected = selectedOnPage > 0 && !allPageSelected;
  const selectionFull = activeSelectedIds.size >= STUDY_PLAN_LIMITS.maxItemsPerCollection;

  const changeQuery = (
    patch: Partial<CatalogQuery>,
    history: "push" | "replace",
    resetPage = false,
  ) => {
    onQueryChange(
      { ...query, ...patch, ...(resetPage ? { page: 1 } : {}) },
      history,
    );
  };

  const togglePageSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(
        [...current].filter((itemId) => liveItemIds.has(itemId)),
      );
      if (allPageSelected) {
        pageIds.forEach((itemId) => next.delete(itemId));
        setSelectionMessage(`Deselected ${pageIds.length} items on this page.`);
        return next;
      }
      let added = 0;
      for (const itemId of pageIds) {
        if (next.size >= STUDY_PLAN_LIMITS.maxItemsPerCollection) break;
        if (!next.has(itemId)) {
          next.add(itemId);
          added += 1;
        }
      }
      setSelectionMessage(
        next.size >= STUDY_PLAN_LIMITS.maxItemsPerCollection && added < pageIds.length - selectedOnPage
          ? `Selected ${added} more items. Selection is capped at ${STUDY_PLAN_LIMITS.maxItemsPerCollection}.`
          : `Selected ${added} items on this page.`,
      );
      return next;
    });
  };

  const toggleItemSelection = (itemId: ItemId) => {
    setSelectedIds((current) => {
      const next = new Set(
        [...current].filter((candidate) => liveItemIds.has(candidate)),
      );
      if (next.has(itemId)) {
        next.delete(itemId);
        setSelectionMessage("Item deselected.");
      } else if (next.size < STUDY_PLAN_LIMITS.maxItemsPerCollection) {
        next.add(itemId);
        setSelectionMessage("Item selected.");
      } else {
        setSelectionMessage(`Selection is capped at ${STUDY_PLAN_LIMITS.maxItemsPerCollection} items.`);
      }
      return next;
    });
  };

  const activeFilters: Array<{
    key: string;
    label: string;
    remove: () => void;
  }> = [];
  if (query.text) {
    activeFilters.push({
      key: "text",
      label: `Search: ${query.text}`,
      remove: () => changeQuery({ text: "" }, "push", true),
    });
  }
  query.lanes.forEach((lane) => activeFilters.push({
    key: `lane-${lane}`,
    label: laneLabel(lane),
    remove: () => changeQuery({ lanes: query.lanes.filter((value) => value !== lane) }, "push", true),
  }));
  query.patterns.forEach((pattern) => activeFilters.push({
    key: `pattern-${pattern}`,
    label: pattern,
    remove: () => changeQuery({ patterns: query.patterns.filter((value) => value !== pattern) }, "push", true),
  }));
  query.difficulties.forEach((difficulty) => activeFilters.push({
    key: `difficulty-${difficulty}`,
    label: difficulty,
    remove: () => changeQuery({ difficulties: query.difficulties.filter((value) => value !== difficulty) }, "push", true),
  }));
  query.statuses.forEach((status) => activeFilters.push({
    key: `status-${status}`,
    label: STATUS_LABELS[status],
    remove: () => changeQuery({ statuses: query.statuses.filter((value) => value !== status) }, "push", true),
  }));
  query.collectionIds.forEach((collectionId) => {
    const label = collectionId === ANY_COLLECTION_ID
      ? "In any collection"
      : collectionId === NO_COLLECTION_ID
        ? "In no collection"
        : collectionById.get(collectionId)?.title ?? "Unavailable collection";
    activeFilters.push({
      key: `collection-${collectionId}`,
      label,
      remove: () => changeQuery({ collectionIds: query.collectionIds.filter((value) => value !== collectionId) }, "push", true),
    });
  });
  if (query.lineRange !== "all") activeFilters.push({
    key: "line-range",
    label: LINE_RANGES.find(([value]) => value === query.lineRange)?.[1] ?? "Line range",
    remove: () => changeQuery({ lineRange: "all" }, "push", true),
  });
  if (query.timeRange !== "all") activeFilters.push({
    key: "time-range",
    label: TIME_RANGES.find(([value]) => value === query.timeRange)?.[1] ?? "Time range",
    remove: () => changeQuery({ timeRange: "all" }, "push", true),
  });

  const clearAll = () => changeQuery({
    text: "",
    lanes: [],
    patterns: [],
    difficulties: [],
    statuses: [],
    lineRange: "all",
    timeRange: "all",
    collectionIds: [],
  }, "push", true);

  const saveCurrentView = (event: FormEvent) => {
    event.preventDefault();
    const name = saveName.trim();
    if (!name || state.catalogWorkspace.savedViews.length >= CATALOG_LIMITS.maxSavedViews) return;
    onSaveView(name, query);
    setSaveName("");
  };

  const renameView = (event: FormEvent, id: string) => {
    event.preventDefault();
    const name = renameName.trim();
    if (!name) return;
    onUpdateView(id, { name });
    setRenamingViewId(null);
    setRenameName("");
  };

  const selectedCollection = collectionById.get(bulkCollectionId);
  const selectedCollectionIds = new Set(selectedCollection?.itemIds ?? []);
  const newItemsForCollection = selected.filter((itemId) => !selectedCollectionIds.has(itemId));
  const selectedCollectionCapacity = selectedCollection
    ? STUDY_PLAN_LIMITS.maxItemsPerCollection - selectedCollectionIds.size
    : 0;
  const selectedCollectionOverflows = Boolean(
    selectedCollection && newItemsForCollection.length > selectedCollectionCapacity,
  );
  const addToCollection = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCollection || !selected.length || selectedCollectionOverflows || !newItemsForCollection.length) return;
    onAppendToCollection(selectedCollection.id, selected);
    setSelectedIds(new Set());
    setSelectionMessage(`Added the selection snapshot to ${selectedCollection.title}.`);
  };
  const createCollection = (event: FormEvent) => {
    event.preventDefault();
    const name = newCollectionName.trim();
    if (
      !name || !selected.length ||
      liveCollections.length >= STUDY_PLAN_LIMITS.maxCollections
    ) return;
    onCreateCollection(name, selected);
    setSelectedIds(new Set());
    setNewCollectionName("");
    setSelectionMessage(`Created ${name} from the selection snapshot.`);
  };

  const pageWindowStart = Math.max(1, Math.min(result.page - 2, result.pageCount - 4));
  const pageNumbers = Array.from(
    { length: Math.min(5, result.pageCount) },
    (_, index) => Math.max(1, pageWindowStart) + index,
  );

  const renderRecordBody = (record: CatalogRecordView) => (
    <>
      <Evidence record={record} />
      <div className="catalog-problem-cell">
        <span className="catalog-display-id">{record.displayId}</span>
        <strong>{record.title}</strong>
        <span>{record.recommendationReason}</span>
        <small>{record.item.cue}</small>
      </div>
      <div className="catalog-taxonomy">
        <span>{laneLabel(record.lane)}</span>
        <span>{record.pattern}</span>
      </div>
      <div className="catalog-size">
        <span>{record.difficulty}</span>
        <span>{record.lineCount} lines · about {record.estimatedMinutes} min</span>
      </div>
      <CollectionBadges titles={record.collectionTitles} />
      <ItemActions
        record={record}
        state={state}
        onOpen={onOpen}
        onFavorite={onFavorite}
        onEditSnippet={onEditSnippet}
        onArchiveSnippet={onArchiveSnippet}
        onNotes={() => setNoteItemId(record.itemId)}
        hasNote={Boolean(state.problemNotes[record.itemId])}
      />
    </>
  );

  return (
    <main id="main-content" tabIndex={-1} className="catalog-library" aria-labelledby="catalog-library-title">
      <header className="catalog-library-header">
        <div>
          <p className="catalog-eyebrow">Problem workspace</p>
          <h1 id="catalog-library-title">Build recall, one problem at a time</h1>
          <p>Search the full local problem set, see honest progress by practice mode, and keep the approach notes you want before the next attempt.</p>
        </div>
        <button type="button" className="catalog-create-snippet" onClick={onCreateSnippet}>Build practice item</button>
      </header>

      <section className="problem-workspace-overview" aria-label="Problem progress overview">
        <div><strong>{workspaceStats.total}</strong><span>Problems</span><small>Python, Swift, and iOS</small></div>
        <div><strong>{workspaceStats.solved}</strong><span>Solved / owned</span><small>Independent current-revision evidence</small></div>
        <div><strong>{workspaceStats.attempted}</strong><span>Attempted</span><small>Work in progress</small></div>
        <div><strong>{workspaceStats.due}</strong><span>Review due</span><small>Ready for retrieval</small></div>
        <div><strong>{workspaceStats.notes}</strong><span>With notes</span><small>Saved only on this device</small></div>
      </section>

      <nav className="problem-lane-tabs" aria-label="Problem lanes">
        <button type="button" aria-current={query.lanes.length === 0 ? "page" : undefined} onClick={() => changeQuery({ lanes: [] }, "push", true)}>
          <span>All problems</span><strong>{records.length}</strong>
        </button>
        {LANE_OPTIONS.map(([lane, label]) => (
          <button type="button" key={lane} aria-current={query.lanes.length === 1 && query.lanes[0] === lane ? "page" : undefined} onClick={() => changeQuery({ lanes: [lane] }, "push", true)}>
            <span>{label}</span><strong>{laneCounts[lane]}</strong>
          </button>
        ))}
      </nav>

      <section className="catalog-saved-views" aria-labelledby="catalog-saved-views-title">
        <div className="catalog-section-heading">
          <h2 id="catalog-saved-views-title">Saved views</h2>
          <span>{state.catalogWorkspace.savedViews.length}/{CATALOG_LIMITS.maxSavedViews}</span>
        </div>
        {state.catalogWorkspace.savedViews.length ? (
          <ul className="catalog-saved-view-list">
            {state.catalogWorkspace.savedViews.map((view) => (
              <li key={view.id} className={queryMatches(view.query, query) ? "is-current" : undefined}>
                {renamingViewId === view.id ? (
                  <form onSubmit={(event) => renameView(event, view.id)}>
                    <label htmlFor={`rename-view-${view.id}`}>Rename {view.name}</label>
                    <input
                      id={`rename-view-${view.id}`}
                      value={renameName}
                      maxLength={CATALOG_LIMITS.maxViewNameLength}
                      onChange={(event) => setRenameName(event.target.value)}
                      autoFocus
                    />
                    <button type="submit" disabled={!renameName.trim()}>Save name</button>
                    <button type="button" onClick={() => setRenamingViewId(null)}>Cancel</button>
                  </form>
                ) : (
                  <>
                    <button type="button" onClick={() => onQueryChange(view.query, "push")}>
                      {view.name}{queryMatches(view.query, query) ? " (current)" : ""}
                    </button>
                    <button
                      type="button"
                      disabled={queryMatches(view.query, query)}
                      aria-label={`Update saved view ${view.name} with the current filters`}
                      onClick={() => onUpdateView(view.id, { query })}
                    >Update</button>
                    <button type="button" aria-label={`Rename saved view ${view.name}`} onClick={() => {
                      setRenamingViewId(view.id);
                      setRenameName(view.name);
                    }}>Rename</button>
                    <button type="button" aria-label={`Delete saved view ${view.name}`} onClick={() => onDeleteView(view.id)}>Delete</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : <p>No saved views yet.</p>}
        <form className="catalog-save-view-form" onSubmit={saveCurrentView}>
          <label htmlFor="catalog-save-view-name">Save current filters</label>
          <input
            id="catalog-save-view-name"
            value={saveName}
            maxLength={CATALOG_LIMITS.maxViewNameLength}
            placeholder="View name"
            onChange={(event) => setSaveName(event.target.value)}
          />
          <button
            type="submit"
            disabled={!saveName.trim() || state.catalogWorkspace.savedViews.length >= CATALOG_LIMITS.maxSavedViews}
          >Save view</button>
          <small>Up to {CATALOG_LIMITS.maxSavedViews} views; names can be {CATALOG_LIMITS.maxViewNameLength} characters. The saved-view ID is not part of the URL.</small>
        </form>
      </section>

      <section
        className={`catalog-discovery-controls${filtersExpanded ? " is-expanded" : ""}`}
        aria-labelledby="catalog-filters-title"
      >
        <h2 id="catalog-filters-title">Search and filters</h2>
        <button
          type="button"
          className="catalog-filter-toggle"
          aria-expanded={filtersExpanded}
          aria-controls="catalog-facet-controls"
          onClick={() => setFiltersExpanded((current) => !current)}
        >
          {filtersExpanded ? "Hide filters" : "Show filters"} · {activeFilters.length} active
        </button>
        <div className="catalog-search-control">
          <label htmlFor="catalog-search">Search by ID, title, pattern, tag, cue, invariant, or complexity</label>
          <div>
            <input
              id="catalog-search"
              type="search"
              value={query.text}
              maxLength={CATALOG_LIMITS.maxTextLength}
              placeholder="Search the library"
              onChange={(event) => changeQuery({ text: event.target.value.slice(0, CATALOG_LIMITS.maxTextLength) }, "replace", true)}
            />
            {query.text ? <button type="button" aria-label="Clear library search" onClick={() => changeQuery({ text: "" }, "replace", true)}>Clear</button> : null}
          </div>
        </div>

        <div className="catalog-facet-grid" id="catalog-facet-controls">
          <fieldset>
            <legend>Lane</legend>
            {LANE_OPTIONS.map(([value, label]) => (
              <label key={value}>
                <input type="checkbox" checked={query.lanes.includes(value)} onChange={() => changeQuery({ lanes: toggleValue(query.lanes, value) }, "push", true)} />
                <span>{label} ({result.facets.lanes[value] ?? 0})</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Pattern</legend>
            <div className="catalog-pattern-options">
              {patternOptions.map((pattern) => (
                <label key={pattern}>
                  <input type="checkbox" checked={query.patterns.includes(pattern)} onChange={() => changeQuery({ patterns: toggleValue(query.patterns, pattern) }, "push", true)} />
                  <span>{pattern} ({result.facets.patterns[pattern] ?? 0})</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Difficulty</legend>
            {CATALOG_DIFFICULTIES.map((difficulty) => (
              <label key={difficulty}>
                <input type="checkbox" checked={query.difficulties.includes(difficulty)} onChange={() => changeQuery({ difficulties: toggleValue<CatalogDifficulty>(query.difficulties, difficulty) }, "push", true)} />
                <span>{difficulty} ({result.facets.difficulties[difficulty] ?? 0})</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Status</legend>
            {CATALOG_STATUSES.map((status) => (
              <label key={status}>
                <input type="checkbox" checked={query.statuses.includes(status)} onChange={() => changeQuery({ statuses: toggleValue<CatalogStatus>(query.statuses, status) }, "push", true)} />
                <span>{STATUS_LABELS[status]} ({result.facets.statuses[status] ?? 0})</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Live collections</legend>
            <label>
              <input type="checkbox" checked={query.collectionIds.includes(ANY_COLLECTION_ID)} onChange={() => changeQuery({ collectionIds: toggleValue(query.collectionIds, ANY_COLLECTION_ID) }, "push", true)} />
              <span>Any collection ({result.facets.collections[ANY_COLLECTION_ID] ?? 0})</span>
            </label>
            <label>
              <input type="checkbox" checked={query.collectionIds.includes(NO_COLLECTION_ID)} onChange={() => changeQuery({ collectionIds: toggleValue(query.collectionIds, NO_COLLECTION_ID) }, "push", true)} />
              <span>No collection ({result.facets.collections[NO_COLLECTION_ID] ?? 0})</span>
            </label>
            {liveCollections.map((collection) => (
              <label key={collection.id}>
                <input type="checkbox" checked={query.collectionIds.includes(collection.id)} onChange={() => changeQuery({ collectionIds: toggleValue(query.collectionIds, collection.id) }, "push", true)} />
                <span>{collection.title} ({result.facets.collections[collection.id] ?? 0})</span>
              </label>
            ))}
          </fieldset>
          <label>
            <span>Code length</span>
            <select value={query.lineRange} onChange={(event) => changeQuery({ lineRange: event.target.value as CatalogQuery["lineRange"] }, "push", true)}>
              {LINE_RANGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Estimated time</span>
            <select value={query.timeRange} onChange={(event) => changeQuery({ timeRange: event.target.value as CatalogQuery["timeRange"] }, "push", true)}>
              {TIME_RANGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </div>

        {activeFilters.length ? (
          <div className="catalog-active-filters" aria-label="Active filters">
            {activeFilters.map((filter) => (
              <button type="button" key={filter.key} onClick={filter.remove} aria-label={`Remove filter ${filter.label}`}>
                {filter.label} <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" className="catalog-clear-all" onClick={clearAll}>Clear all</button>
          </div>
        ) : null}
      </section>

      <section className="catalog-results" aria-labelledby="catalog-results-title">
        <div className="catalog-results-toolbar">
          <div>
            <h2 id="catalog-results-title">Problem set</h2>
            <p className="catalog-result-range" aria-live="polite" aria-atomic="true">
              {result.total ? `${result.from}–${result.to} of ${result.total}` : "0 results"}
            </p>
          </div>
          <label>
            <span>Sort</span>
            <select value={query.sort} onChange={(event) => changeQuery({ sort: event.target.value as CatalogSort }, "push", true)}>
              {CATALOG_SORTS.map((sort) => <option value={sort} key={sort}>{SORT_LABELS[sort]}</option>)}
            </select>
          </label>
          <label>
            <span>Direction</span>
            <select value={query.direction} onChange={(event) => changeQuery({ direction: event.target.value as CatalogQuery["direction"] }, "push", true)}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <div className="catalog-layout-toggle" role="group" aria-label="Result layout">
            <button type="button" aria-pressed={query.layout === "table"} onClick={() => changeQuery({ layout: "table" }, "push")}>Table</button>
            <button type="button" aria-pressed={query.layout === "cards"} onClick={() => changeQuery({ layout: "cards" }, "push")}>Cards</button>
          </div>
          <label>
            <span>Rows per page</span>
            <select value={query.pageSize} onChange={(event) => changeQuery({ pageSize: Number(event.target.value) as CatalogQuery["pageSize"] }, "push", true)}>
              {CATALOG_PAGE_SIZES.map((pageSize) => <option value={pageSize} key={pageSize}>{pageSize}</option>)}
            </select>
          </label>
        </div>

        <div className="catalog-selection-summary" aria-live="polite">
          <p>
            {activeSelectedIds.size} selected of {STUDY_PLAN_LIMITS.maxItemsPerCollection} maximum.
            {selectedOutsideResults > 0 ? ` ${selectedOutsideResults} selected ${selectedOutsideResults === 1 ? "item is" : "items are"} outside the current result set.` : ""}
          </p>
          <p>{selectionMessage}</p>
          {activeSelectedIds.size ? <button type="button" onClick={() => {
            setSelectedIds(new Set());
            setSelectionMessage("Selection cleared.");
          }}>Clear selection</button> : null}
        </div>

        {result.items.length ? (
          query.layout === "table" ? (
            <div className="catalog-table-wrap">
              <table className="catalog-table">
                <caption>Filtered practice items and their current-revision evidence</caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <PageSelectionCheckbox checked={allPageSelected} indeterminate={somePageSelected} disabled={!pageIds.length || (selectionFull && !allPageSelected)} onChange={togglePageSelection} />
                    </th>
                    <th scope="col">Evidence</th>
                    <th scope="col">Problem</th>
                    <th scope="col">Lane / pattern</th>
                    <th scope="col">Difficulty / time</th>
                    <th scope="col">Live collections</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((record) => (
                    <tr key={record.itemId}>
                      <td data-label="Select">
                        <input
                          type="checkbox"
                          checked={activeSelectedIds.has(record.item.itemId)}
                          disabled={!activeSelectedIds.has(record.item.itemId) && selectionFull}
                          aria-label={`Select ${record.title}`}
                          onChange={() => toggleItemSelection(record.item.itemId)}
                        />
                      </td>
                      <td data-label="Evidence"><Evidence record={record} /></td>
                      <th scope="row" data-label="Problem" className="catalog-problem-cell">
                        <span className="catalog-display-id">{record.displayId}</span>
                        <strong>{record.title}</strong>
                        <span>{record.recommendationReason}</span>
                        <small>{record.item.cue}</small>
                      </th>
                      <td data-label="Lane / pattern" className="catalog-taxonomy"><span>{laneLabel(record.lane)}</span><span>{record.pattern}</span></td>
                      <td data-label="Difficulty / time" className="catalog-size"><span>{record.difficulty}</span><span>{record.lineCount} lines · about {record.estimatedMinutes} min</span></td>
                      <td data-label="Live collections"><CollectionBadges titles={record.collectionTitles} /></td>
                      <td data-label="Actions"><ItemActions record={record} state={state} onOpen={onOpen} onFavorite={onFavorite} onEditSnippet={onEditSnippet} onArchiveSnippet={onArchiveSnippet} onNotes={() => setNoteItemId(record.itemId)} hasNote={Boolean(state.problemNotes[record.itemId])} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="catalog-card-grid">
              {result.items.map((record) => (
                <li className="catalog-card" key={record.itemId}>
                  <label className="catalog-card-select">
                    <input
                      type="checkbox"
                      checked={activeSelectedIds.has(record.item.itemId)}
                      disabled={!activeSelectedIds.has(record.item.itemId) && selectionFull}
                      onChange={() => toggleItemSelection(record.item.itemId)}
                    />
                    <span>Select {record.title}</span>
                  </label>
                  {renderRecordBody(record)}
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="catalog-empty-state">
            <h3>No items match these filters</h3>
            <p>Remove a filter or clear the current search to return to the full practice library.</p>
            {activeFilters.length ? <button type="button" onClick={clearAll}>Clear all filters</button> : <button type="button" onClick={onCreateSnippet}>Build the first practice item</button>}
          </div>
        )}

        {result.pageCount > 1 ? (
          <nav className="catalog-pagination" aria-label="Library result pages">
            <button type="button" disabled={result.page <= 1} onClick={() => changeQuery({ page: result.page - 1 }, "push")}>Previous</button>
            {pageNumbers.map((page) => (
              <button type="button" key={page} aria-current={page === result.page ? "page" : undefined} onClick={() => changeQuery({ page }, "push")}>{page}</button>
            ))}
            <button type="button" disabled={result.page >= result.pageCount} onClick={() => changeQuery({ page: result.page + 1 }, "push")}>Next</button>
          </nav>
        ) : null}
      </section>

      {activeSelectedIds.size ? (
        <aside className="catalog-bulk-panel" aria-labelledby="catalog-bulk-title">
          <h2 id="catalog-bulk-title">Use {activeSelectedIds.size} selected {activeSelectedIds.size === 1 ? "item" : "items"}</h2>
          <p>This selection is an ordered snapshot. Future search matches are not auto-added.</p>
          <section className="catalog-challenge-set-launch" aria-labelledby="catalog-challenge-set-title">
            <div>
              <span className="eyebrow">Challenge Set</span>
              <h3 id="catalog-challenge-set-title">Launch this exact problem set</h3>
              <p>
                Freeze prompt and judge revisions now, then carry attempts,
                submissions, and the final activity ledger under one run.
              </p>
            </div>
            <div className="catalog-challenge-set-actions">
              <button
                type="button"
                className="primary-button"
                disabled={!challengeSetSizeIsValid}
                onClick={() => onStartChallengeSet(selected, "practice")}
              >
                Start untimed practice
              </button>
              <button
                type="button"
                className="outline-button"
                disabled={!timedSetIsValid}
                onClick={() => onStartChallengeSet(selected, "timed")}
              >
                Start timed round
              </button>
            </div>
            <small>
              Practice sets support 2–12 current built-in problems. Timed sets
              support 2–4 runnable Python problems and use the matching
              45/75/105-minute round clock.
            </small>
          </section>
          <form onSubmit={addToCollection}>
            <label htmlFor="catalog-bulk-collection">Add to an existing live collection</label>
            <select id="catalog-bulk-collection" value={bulkCollectionId} onChange={(event) => setBulkCollectionId(event.target.value)}>
              <option value="">Choose a collection</option>
              {liveCollections.map((collection) => {
                const existingIds = new Set(collection.itemIds);
                const additions = selected.filter((itemId) => !existingIds.has(itemId)).length;
                const capacity = STUDY_PLAN_LIMITS.maxItemsPerCollection - existingIds.size;
                return (
                  <option key={collection.id} value={collection.id} disabled={additions > capacity}>
                    {collection.title} — {existingIds.size}/{STUDY_PLAN_LIMITS.maxItemsPerCollection}; {additions} new, {selected.length - additions} already included
                  </option>
                );
              })}
            </select>
            {selectedCollection ? (
              <small>
                {newItemsForCollection.length} new {newItemsForCollection.length === 1 ? "item" : "items"}; {selected.length - newItemsForCollection.length} duplicate {selected.length - newItemsForCollection.length === 1 ? "does" : "do"} not use capacity. {selectedCollectionCapacity} spaces available.
              </small>
            ) : null}
            <button type="submit" disabled={!selectedCollection || selectedCollectionOverflows || !newItemsForCollection.length}>Add snapshot</button>
          </form>
          <form onSubmit={createCollection}>
            <label htmlFor="catalog-new-collection">Create a collection from this fixed selection</label>
            <input
              id="catalog-new-collection"
              value={newCollectionName}
              maxLength={STUDY_PLAN_LIMITS.maxName}
              placeholder="Collection name"
              onChange={(event) => setNewCollectionName(event.target.value)}
            />
            <button type="submit" disabled={!newCollectionName.trim() || liveCollections.length >= STUDY_PLAN_LIMITS.maxCollections}>Create collection</button>
            <small>Up to {STUDY_PLAN_LIMITS.maxCollections} collections; names can be {STUDY_PLAN_LIMITS.maxName} characters; each collection holds {STUDY_PLAN_LIMITS.maxItemsPerCollection} items.</small>
          </form>
        </aside>
      ) : null}
      {noteItemId ? (() => {
        const noteItem = items.find((candidate) => candidate.itemId === noteItemId);
        if (!noteItem) return null;
        return (
          <ProblemNotesDialog
            item={noteItem}
            note={state.problemNotes[noteItemId]}
            onSave={onSaveProblemNote}
            onDelete={() => onDeleteProblemNote(noteItemId)}
            onClose={() => setNoteItemId(null)}
          />
        );
      })() : null}
    </main>
  );
}
