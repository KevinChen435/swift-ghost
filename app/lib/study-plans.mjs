import { buildDailyPlan } from "./planner.mjs";

const DAY_MS = 86_400_000;
const REVIEW_DAYS = [1, 3, 7, 14, 30];
const ISO_EPOCH = "1970-01-01T00:00:00.000Z";

export const STUDY_PLAN_LIMITS = Object.freeze({
  maxCollections: 50,
  maxPlans: 50,
  maxItemsPerCollection: 200,
  maxTombstones: 200,
  maxName: 80,
  maxDescription: 240,
  maxSessionLinks: 100,
});

const BACK_TO_SHAPE_MODULES = [
  { id: "keyboard-reentry", title: "Python keyboard re-entry", outcome: "Write common Python without syntax friction.", patterns: ["Python Fluency"] },
  { id: "arrays-windows", title: "Arrays, hashing, and windows", outcome: "Select and explain the invariant before coding.", patterns: ["Arrays & Hashing", "Two Pointers", "Sliding Window"] },
  { id: "search-structures", title: "Stacks, search, and linked structures", outcome: "Handle boundaries and representation choices cleanly.", patterns: ["Stack", "Binary Search", "Linked List"] },
  { id: "trees-heaps-intervals", title: "Trees, heaps, and intervals", outcome: "Move between traversal, ordering, and top-k reasoning.", patterns: ["Trees", "Heaps & Priority Queues", "Intervals"] },
  { id: "graphs-transfer", title: "Graphs, backtracking, and greedy", outcome: "Transfer the right invariant to a hidden-label problem.", patterns: ["Graphs", "Backtracking", "Greedy", "Union-Find"] },
  { id: "ios-maintenance", title: "Swift and iOS maintenance", outcome: "Keep platform fundamentals available without displacing Python prep.", track: "ios" },
];

export const STUDY_PLAN_TEMPLATES = Object.freeze([
  {
    id: "back-to-interview-shape",
    title: "Back to Interview Shape",
    description: "Rebuild Python fluency, pattern transfer, and interview communication while keeping Swift and iOS active.",
    outcome: "A balanced return to interview readiness",
    recommended: true,
    estimatedBlocks: 18,
    defaultPace: 30,
    lanes: ["Python", "Delayed review", "Swift / iOS", "Interview simulation"],
    modules: BACK_TO_SHAPE_MODULES,
    selector: { excludeHard: true, excludePatterns: ["Dynamic Programming"] },
    capstone: { format: "python-coding", mode: "mock" },
  },
  {
    id: "python-reentry",
    title: "Python Re-entry: Type → Recall → Solve",
    description: "Fade known code from visible syntax to blank reconstruction, then produce verified solutions independently.",
    outcome: "Reliable Python implementation from a blank editor",
    estimatedBlocks: 10,
    defaultPace: 30,
    lanes: ["Python", "Delayed review"],
    modules: [
      { id: "python-fluency", title: "Syntax activation", outcome: "Recover the small Python moves interviews depend on.", patterns: ["Python Fluency"] },
      { id: "python-core", title: "Recall to solve", outcome: "Separate implementation recall from independent algorithm evidence.", patterns: ["Arrays & Hashing", "Two Pointers", "Sliding Window", "Stack", "Binary Search"] },
    ],
    selector: { language: "python", excludeHard: true },
    capstone: { format: "python-coding", mode: "mock" },
  },
  {
    id: "swift-ios-reactivation",
    title: "Swift & iOS Reactivation",
    description: "Refresh language semantics, ownership, concurrency, architecture, testing, accessibility, and technical communication.",
    outcome: "Clear, current, self-assessed Swift and iOS explanations",
    estimatedBlocks: 12,
    defaultPace: 30,
    lanes: ["Swift / iOS", "Delayed review", "Interview simulation"],
    modules: [
      { id: "swift-semantics", title: "Swift language and ownership", outcome: "Explain values, references, optionals, protocols, ARC, and captures.", patterns: ["Swift Semantics", "Optionals & Errors", "Protocols & Generics", "Memory Management"] },
      { id: "ios-systems", title: "iOS systems reasoning", outcome: "Reason about concurrency, lifecycle, networking, architecture, testing, and accessibility.", track: "ios" },
    ],
    selector: { track: "ios" },
    capstone: { format: "ios-technical", mode: "mock", selfAssessed: true },
  },
  {
    id: "interview-simulation",
    title: "Interview Simulation",
    description: "Move from coached communication into timed Python and Swift/iOS interview rehearsals.",
    outcome: "Repeatable interview execution under realistic constraints",
    estimatedBlocks: 8,
    defaultPace: 45,
    lanes: ["Interview simulation", "Python", "Swift / iOS"],
    modules: [
      { id: "simulation-prep", title: "Communication rehearsal", outcome: "Clarify, explain an invariant, test, and close without losing the thread.", patterns: ["Arrays & Hashing", "Trees", "Graphs"] },
      { id: "simulation-capstone", title: "Interview capstones", outcome: "Produce current-source evidence in a complete interview transcript.", simulation: true },
    ],
    selector: { excludeHard: true },
    capstone: { format: "python-coding", mode: "mock" },
  },
]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value, limit, fallback = "") {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) || fallback
    : fallback;
}

function cleanId(value, fallback = "") {
  const id = cleanText(value, 120);
  return /^[\w:.-]+$/.test(id) ? id : fallback;
}

function iso(value, fallback = ISO_EPOCH) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function boundedInt(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, Math.round(number)))
    : fallback;
}

function pace(value, fallback = 30) {
  const number = boundedInt(value, fallback, 15, 45);
  return number <= 15 ? 15 : number <= 30 ? 30 : 45;
}

function entityId(prefix, requested) {
  const supplied = cleanId(requested);
  if (supplied) return supplied;
  const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${token}`;
}

function itemId(value) {
  const id = cleanText(value, 160);
  return /^(?:builtin:\d+|python:\d+|ios:[\w-]+|custom:[\w-]+)$/.test(id) ? id : "";
}

function uniqueIds(value, limit = STUDY_PLAN_LIMITS.maxItemsPerCollection) {
  return Array.isArray(value)
    ? [...new Set(value.map((entry) => itemId(isRecord(entry) ? entry.itemId : entry)).filter(Boolean))].slice(0, limit)
    : [];
}

function uniqueSessionIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((entry) => cleanId(entry)).filter(Boolean))].slice(
        -STUDY_PLAN_LIMITS.maxSessionLinks,
      )
    : [];
}

function normalizeModules(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    return [{
      id: cleanId(raw.id, `module-${index + 1}`),
      title: cleanText(raw.title, 80, `Module ${index + 1}`),
      outcome: cleanText(raw.outcome ?? raw.description, 240, "Build current-revision evidence."),
      itemIds: uniqueIds(raw.itemIds),
      patterns: Array.isArray(raw.patterns) ? raw.patterns.map((entry) => cleanText(entry, 80)).filter(Boolean).slice(0, 20) : [],
      ...(raw.simulation === true ? { simulation: true } : {}),
    }];
  });
}

function normalizeCollection(raw, now) {
  if (!isRecord(raw)) return null;
  const id = cleanId(raw.id);
  if (!id) return null;
  const createdAt = iso(raw.createdAt, now);
  return {
    id,
    revision: boundedInt(raw.revision, 1, 1, 2_147_483_647),
    source: raw.source === "builtin" ? "builtin" : "custom",
    title: cleanText(raw.title ?? raw.name, STUDY_PLAN_LIMITS.maxName, "Untitled collection"),
    description: cleanText(raw.description, STUDY_PLAN_LIMITS.maxDescription),
    outcome: cleanText(raw.outcome, STUDY_PLAN_LIMITS.maxDescription, "Build reliable current-revision evidence."),
    itemIds: uniqueIds(raw.itemIds ?? raw.items),
    modules: normalizeModules(raw.modules),
    createdAt,
    updatedAt: iso(raw.updatedAt, createdAt),
  };
}

function normalizeSnapshot(raw, fallbackCollection) {
  const normalized = normalizeCollection(
    isRecord(raw) ? raw : fallbackCollection,
    fallbackCollection?.createdAt ?? ISO_EPOCH,
  );
  return normalized ?? {
    id: fallbackCollection?.id ?? "snapshot:missing",
    revision: 1,
    source: "custom",
    title: fallbackCollection?.title ?? "Unavailable collection",
    description: "The original collection is unavailable, but historical plan references remain preserved.",
    outcome: "Restore or replace unavailable items.",
    itemIds: [],
    modules: [],
    createdAt: ISO_EPOCH,
    updatedAt: ISO_EPOCH,
  };
}

function normalizePlan(raw, collectionsById, now) {
  if (!isRecord(raw)) return null;
  const id = cleanId(raw.id);
  if (!id) return null;
  const collectionIds = Array.isArray(raw.collectionIds)
    ? [...new Set(raw.collectionIds.map((value) => cleanId(value)).filter(Boolean))].slice(0, 20)
    : cleanId(raw.collectionId)
      ? [cleanId(raw.collectionId)]
      : [];
  const firstCollection = collectionsById.get(collectionIds[0]);
  const snapshot = normalizeSnapshot(raw.collectionSnapshot, firstCollection);
  const createdAt = iso(raw.createdAt ?? raw.startedAt, now);
  const statuses = ["active", "paused", "curriculum-complete", "archived"];
  const status = statuses.includes(raw.status) ? raw.status : "paused";
  return {
    id,
    revision: boundedInt(raw.revision, 1, 1, 2_147_483_647),
    templateId: cleanId(raw.templateId) || undefined,
    title: cleanText(raw.title ?? raw.name, STUDY_PLAN_LIMITS.maxName, snapshot.title),
    description: cleanText(raw.description, STUDY_PLAN_LIMITS.maxDescription, snapshot.description),
    outcome: cleanText(raw.outcome, STUDY_PLAN_LIMITS.maxDescription, snapshot.outcome),
    collectionIds,
    collectionSnapshot: snapshot,
    status,
    paceMinutes: pace(raw.paceMinutes ?? raw.pace?.minutesPerBlock),
    blocksPerWeek: boundedInt(raw.blocksPerWeek ?? raw.pace?.blocksPerWeek, 3, 1, 7),
    sessionIds: Array.isArray(raw.sessionIds) ? [...new Set(raw.sessionIds.map((value) => cleanId(value)).filter(Boolean))].slice(-STUDY_PLAN_LIMITS.maxSessionLinks) : [],
    studioSessionIds: Array.isArray(raw.studioSessionIds) ? [...new Set(raw.studioSessionIds.map((value) => cleanId(value)).filter(Boolean))].slice(-STUDY_PLAN_LIMITS.maxSessionLinks) : [],
    capstone: isRecord(raw.capstone)
      ? {
          format: raw.capstone.format === "ios-technical" ? "ios-technical" : "python-coding",
          mode: raw.capstone.mode === "coach" ? "coach" : "mock",
          selfAssessed: raw.capstone.selfAssessed === true,
        }
      : undefined,
    createdAt,
    updatedAt: iso(raw.updatedAt, createdAt),
    completedAt: raw.completedAt ? iso(raw.completedAt, createdAt) : undefined,
  };
}

function normalizeTombstones(value, now) {
  if (!Array.isArray(value)) return [];
  const seen = new Map();
  for (const raw of value) {
    if (!isRecord(raw) || !["collection", "plan"].includes(raw.entity)) continue;
    const id = cleanId(raw.id);
    if (!id) continue;
    const tombstone = { entity: raw.entity, id, deletedAt: iso(raw.deletedAt, now) };
    const key = `${tombstone.entity}:${id}`;
    if (!seen.has(key) || Date.parse(seen.get(key).deletedAt) < Date.parse(tombstone.deletedAt)) seen.set(key, tombstone);
  }
  return [...seen.values()].sort((a, b) => Date.parse(a.deletedAt) - Date.parse(b.deletedAt)).slice(-STUDY_PLAN_LIMITS.maxTombstones);
}

export function createStudyWorkspace(now = new Date().toISOString()) {
  const updatedAt = iso(now, ISO_EPOCH);
  return { version: 1, revision: 0, updatedAt, activePlanId: null, collections: [], plans: [], tombstones: [] };
}

export function normalizeStudyWorkspace(value, options = {}) {
  const now = iso(options.now, ISO_EPOCH);
  if (!isRecord(value)) return createStudyWorkspace(now);
  const tombstones = normalizeTombstones(value.tombstones, now);
  const deletedCollections = new Map(tombstones.filter((entry) => entry.entity === "collection").map((entry) => [entry.id, Date.parse(entry.deletedAt)]));
  const deletedPlans = new Map(tombstones.filter((entry) => entry.entity === "plan").map((entry) => [entry.id, Date.parse(entry.deletedAt)]));
  const collections = [];
  const seenCollections = new Map();
  for (const raw of Array.isArray(value.collections) ? value.collections : []) {
    const collection = normalizeCollection(raw, now);
    if (!collection) continue;
    if ((deletedCollections.get(collection.id) ?? -1) >= Date.parse(collection.updatedAt)) continue;
    const existing = seenCollections.get(collection.id);
    if (!existing || Date.parse(existing.updatedAt) <= Date.parse(collection.updatedAt)) seenCollections.set(collection.id, collection);
  }
  collections.push(...[...seenCollections.values()].slice(-STUDY_PLAN_LIMITS.maxCollections));
  const collectionsById = new Map(collections.map((collection) => [collection.id, collection]));
  const seenPlans = new Map();
  for (const raw of Array.isArray(value.plans) ? value.plans : []) {
    const plan = normalizePlan(raw, collectionsById, now);
    if (!plan) continue;
    if ((deletedPlans.get(plan.id) ?? -1) >= Date.parse(plan.updatedAt)) continue;
    const existing = seenPlans.get(plan.id);
    if (!existing || Date.parse(existing.updatedAt) <= Date.parse(plan.updatedAt)) seenPlans.set(plan.id, plan);
  }
  const plans = [...seenPlans.values()].slice(-STUDY_PLAN_LIMITS.maxPlans);
  const requestedActive = cleanId(value.activePlanId);
  const activePlan = plans.find((plan) => plan.id === requestedActive && plan.status !== "archived") ?? plans.find((plan) => plan.status === "active") ?? null;
  const normalizedPlans = plans.map((plan) => ({ ...plan, status: plan.id === activePlan?.id ? "active" : plan.status === "active" ? "paused" : plan.status }));
  return {
    version: 1,
    revision: boundedInt(value.revision, 0, 0, 2_147_483_647),
    updatedAt: iso(value.updatedAt, now),
    activePlanId: activePlan?.id ?? null,
    collections,
    plans: normalizedPlans,
    tombstones,
  };
}

function changed(workspace, changes, now) {
  return normalizeStudyWorkspace({
    ...workspace,
    ...changes,
    version: 1,
    revision: boundedInt(workspace?.revision, 0, 0, 2_147_483_646) + 1,
    updatedAt: iso(now, new Date().toISOString()),
  }, { now });
}

export function createStudyCollection(workspace, input = {}, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  const collection = normalizeCollection({
    ...input,
    id: entityId("collection", options.id ?? input.id),
    revision: 1,
    source: input.source === "builtin" ? "builtin" : "custom",
    createdAt: now,
    updatedAt: now,
  }, now);
  if (!collection || !collection.itemIds.length || workspace.collections.length >= STUDY_PLAN_LIMITS.maxCollections) return normalizeStudyWorkspace(workspace, { now });
  return changed(workspace, { collections: [...workspace.collections.filter((entry) => entry.id !== collection.id), collection] }, now);
}

export function updateStudyCollection(workspace, collectionId, patch = {}, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  const existing = workspace.collections.find((entry) => entry.id === collectionId);
  if (!existing) return normalizeStudyWorkspace(workspace, { now });
  const updated = normalizeCollection({ ...existing, ...patch, id: existing.id, revision: existing.revision + 1, source: existing.source, createdAt: existing.createdAt, updatedAt: now }, now);
  return updated ? changed(workspace, { collections: workspace.collections.map((entry) => entry.id === collectionId ? updated : entry) }, now) : workspace;
}

export function deleteStudyCollection(workspace, collectionId, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  if (!workspace.collections.some((entry) => entry.id === collectionId)) return normalizeStudyWorkspace(workspace, { now });
  return changed(workspace, {
    collections: workspace.collections.filter((entry) => entry.id !== collectionId),
    tombstones: [...(workspace.tombstones ?? []), { entity: "collection", id: collectionId, deletedAt: now }],
  }, now);
}

export function createStudyPlan(workspace, input = {}, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  const collection = workspace.collections.find((entry) => entry.id === input.collectionId);
  if (!collection || workspace.plans.length >= STUDY_PLAN_LIMITS.maxPlans) return normalizeStudyWorkspace(workspace, { now });
  const plan = normalizePlan({
    id: entityId("plan", options.id ?? input.id),
    revision: 1,
    title: input.title || collection.title,
    description: input.description || collection.description,
    outcome: collection.outcome,
    collectionIds: [collection.id],
    collectionSnapshot: structuredClone(collection),
    status: input.status === "paused" ? "paused" : "active",
    paceMinutes: input.paceMinutes,
    blocksPerWeek: input.blocksPerWeek,
    createdAt: now,
    updatedAt: now,
    sessionIds: [],
    studioSessionIds: [],
  }, new Map([[collection.id, collection]]), now);
  if (!plan) return workspace;
  const makeActive = input.status !== "paused";
  return changed(workspace, {
    plans: [...workspace.plans.map((entry) => makeActive && entry.status === "active" ? { ...entry, status: "paused", updatedAt: now } : entry), plan],
    activePlanId: makeActive ? plan.id : workspace.activePlanId,
  }, now);
}

export function updateStudyPlan(workspace, planId, patch = {}, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  const existing = workspace.plans.find((entry) => entry.id === planId);
  if (!existing) return normalizeStudyWorkspace(workspace, { now });
  const updated = normalizePlan({ ...existing, ...patch, id: existing.id, revision: existing.revision + 1, createdAt: existing.createdAt, updatedAt: now }, new Map(workspace.collections.map((entry) => [entry.id, entry])), now);
  return updated ? changed(workspace, { plans: workspace.plans.map((entry) => entry.id === planId ? updated : entry) }, now) : workspace;
}

export function activateStudyPlan(workspace, planId, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  if (!workspace.plans.some((entry) => entry.id === planId)) return normalizeStudyWorkspace(workspace, { now });
  return changed(workspace, {
    activePlanId: planId,
    plans: workspace.plans.map((entry) => ({ ...entry, status: entry.id === planId ? "active" : entry.status === "active" ? "paused" : entry.status, updatedAt: entry.id === planId || entry.status === "active" ? now : entry.updatedAt })),
  }, now);
}

export function pauseStudyPlan(workspace, planId, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  if (!workspace.plans.some((entry) => entry.id === planId)) return normalizeStudyWorkspace(workspace, { now });
  return changed(workspace, {
    activePlanId: workspace.activePlanId === planId ? null : workspace.activePlanId,
    plans: workspace.plans.map((entry) => entry.id === planId ? { ...entry, status: "paused", revision: entry.revision + 1, updatedAt: now } : entry),
  }, now);
}

export function deleteStudyPlan(workspace, planId, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  if (!workspace.plans.some((entry) => entry.id === planId)) return normalizeStudyWorkspace(workspace, { now });
  return changed(workspace, {
    activePlanId: workspace.activePlanId === planId ? null : workspace.activePlanId,
    plans: workspace.plans.filter((entry) => entry.id !== planId),
    tombstones: [...(workspace.tombstones ?? []), { entity: "plan", id: planId, deletedAt: now }],
  }, now);
}

function matchesTemplateItem(item, template) {
  if (!item || item.source !== "builtin") return false;
  const selector = template.selector ?? {};
  if (selector.language && item.language !== selector.language) return false;
  if (selector.track && item.track !== selector.track) return false;
  if (selector.excludeHard && item.difficulty === "Hard") return false;
  if (selector.excludePatterns?.includes(item.pattern)) return false;
  if (template.id === "back-to-interview-shape") return item.language === "python" || item.track === "ios";
  if (template.id === "interview-simulation") return (item.language === "python" && item.verification) || item.track === "ios";
  return true;
}

export function instantiateStudyPlanTemplate(workspace, templateId, items = [], options = {}) {
  const template = STUDY_PLAN_TEMPLATES.find((entry) => entry.id === templateId);
  if (!template) return normalizeStudyWorkspace(workspace, { now: options.now });
  if (
    workspace.collections.length >= STUDY_PLAN_LIMITS.maxCollections ||
    workspace.plans.length >= STUDY_PLAN_LIMITS.maxPlans
  )
    return workspace;
  const now = iso(options.now, new Date().toISOString());
  const selected = items.filter((item) => matchesTemplateItem(item, template)).slice(0, STUDY_PLAN_LIMITS.maxItemsPerCollection);
  const modules = template.modules.map((module) => ({
    id: module.id,
    title: module.title,
    outcome: module.outcome,
    patterns: module.patterns ?? [],
    simulation: module.simulation === true,
    itemIds: selected.filter((item) => module.simulation || module.track === "ios" ? item.track === "ios" : !module.patterns?.length || module.patterns.includes(item.pattern)).map((item) => item.itemId),
  }));
  const collectionId = entityId("collection", options.collectionId);
  const collection = normalizeCollection({
    id: collectionId,
    revision: 1,
    source: "builtin",
    title: template.title,
    description: template.description,
    outcome: template.outcome,
    itemIds: selected.map((item) => item.itemId),
    modules,
    createdAt: now,
    updatedAt: now,
  }, now);
  if (!collection || !collection.itemIds.length) return workspace;
  const planId = entityId("plan", options.planId);
  const plan = normalizePlan({
    id: planId,
    revision: 1,
    templateId: template.id,
    title: template.title,
    description: template.description,
    outcome: template.outcome,
    collectionIds: [collectionId],
    collectionSnapshot: collection,
    status: "active",
    paceMinutes: options.paceMinutes ?? template.defaultPace,
    blocksPerWeek: options.blocksPerWeek ?? 3,
    capstone: template.capstone,
    sessionIds: [],
    studioSessionIds: [],
    createdAt: now,
    updatedAt: now,
  }, new Map([[collectionId, collection]]), now);
  if (!plan) return workspace;
  return changed(workspace, {
    collections: [...workspace.collections, collection],
    plans: [...workspace.plans.map((entry) => entry.status === "active" ? { ...entry, status: "paused", updatedAt: now } : entry), plan],
    activePlanId: planId,
  }, now);
}

export function linkStudyPlanSession(workspace, planId, sessionId, kind = "focus", options = {}) {
  const normalized = normalizeStudyWorkspace(workspace, { now: options.now });
  const cleanPlanId = cleanId(planId);
  const cleanSessionId = cleanId(sessionId);
  if (!cleanPlanId || !cleanSessionId || (kind !== "focus" && kind !== "studio")) return normalized;
  const index = normalized.plans.findIndex((plan) => plan.id === cleanPlanId);
  if (index < 0) return normalized;
  const plan = normalized.plans[index];
  const field = kind === "studio" ? "studioSessionIds" : "sessionIds";
  if (plan[field].includes(cleanSessionId)) return normalized;
  const plans = normalized.plans.map((entry, planIndex) =>
    planIndex === index
      ? {
          ...entry,
          [field]: [...entry[field], cleanSessionId].slice(-STUDY_PLAN_LIMITS.maxSessionLinks),
        }
      : entry,
  );
  return changed(normalized, { plans }, iso(options.now, new Date().toISOString()));
}

function successfulAttempt(attempt, item) {
  if (!attempt || attempt.outcome !== "completed" || attempt.itemRevision !== item.contentRevision || Number(attempt.peeks ?? 0) > 0) return false;
  if (attempt.practiceKind === "solving") return Boolean(attempt.verification?.total > 0 && attempt.verification.passed === attempt.verification.total);
  if (attempt.practiceKind === "concept") return attempt.conceptGrade === "good" || attempt.conceptGrade === "easy";
  return attempt.stage === 5 && Number(attempt.accuracy ?? 0) >= 95;
}

function itemEvidence(item, attempts, now) {
  const all = attempts.filter((attempt) => attempt.itemId === item.itemId).sort((a, b) => Date.parse(a.completedAt ?? "") - Date.parse(b.completedAt ?? ""));
  const current = all.filter((attempt) => attempt.itemRevision === item.contentRevision);
  const successes = current.filter((attempt) => successfulAttempt(attempt, item));
  const last = current.at(-1);
  const lastSuccess = successes.at(-1);
  const interval = REVIEW_DAYS[Math.min(Math.max(0, successes.length - 1), REVIEW_DAYS.length - 1)];
  const dueAt = lastSuccess ? Date.parse(lastSuccess.completedAt) + interval * DAY_MS : null;
  const due = Number.isFinite(dueAt) && dueAt <= now;
  return {
    independent: successes.length > 0,
    assisted: current.length > 0 && !successes.length,
    attempted: current.length > 0,
    outdated: all.some((attempt) => attempt.itemRevision !== item.contentRevision),
    due,
    retained: successes.length > 0 && !due,
    last,
  };
}

export function deriveStudyCollectionProgress(collection, evidence = {}) {
  const itemsById = new Map((evidence.items ?? []).map((item) => [item.itemId, item]));
  const now = Date.parse(evidence.now ?? new Date().toISOString());
  const statuses = collection.itemIds.map((id) => {
    const item = itemsById.get(id);
    if (!item) return { itemId: id, unavailable: true, independent: false, assisted: false, due: false, retained: false, outdated: true };
    return { itemId: id, ...itemEvidence(item, evidence.attempts ?? [], now) };
  });
  return {
    totalItems: statuses.length,
    completedItems: statuses.filter((entry) => entry.independent).length,
    evidence: {
      independent: statuses.filter((entry) => entry.independent).length,
      assisted: statuses.filter((entry) => entry.assisted).length,
      due: statuses.filter((entry) => entry.due).length,
      retained: statuses.filter((entry) => entry.retained).length,
      outdated: statuses.filter((entry) => entry.outdated).length,
    },
    statuses,
  };
}

function capstoneEvidence(plan, history = []) {
  const linked = new Set(plan.studioSessionIds ?? []);
  const sessions = history.filter((session) => linked.has(session.id));
  const qualifying = sessions.some((session) => {
    if (session.outcome !== "completed" || session.phase !== "completed") return false;
    if (plan.capstone?.format && session.format !== plan.capstone.format) return false;
    if (plan.capstone?.mode === "mock" && session.mode !== "mock") return false;
    if (session.mode === "coach" && plan.capstone?.mode === "mock") return false;
    if (session.transcript?.some((entry) => entry.kind === "coach-hint")) return false;
    if (session.format === "python-coding") return session.runnerEvents?.some((event) => event.status === "passed" && Number(event.total) > 0 && event.passed === event.total);
    return true;
  });
  return { required: Boolean(plan.capstone), completed: qualifying, selfAssessed: plan.capstone?.format === "ios-technical" };
}

export function deriveStudyPlanProgress(plan, workspace, evidence = {}) {
  const collection = normalizeSnapshot(plan.collectionSnapshot, workspace.collections.find((entry) => plan.collectionIds?.includes(entry.id)));
  const progress = deriveStudyCollectionProgress(collection, evidence);
  const statusById = new Map(progress.statuses.map((entry) => [entry.itemId, entry]));
  const modules = collection.modules?.length ? collection.modules : [{ id: "focus", title: collection.title, outcome: collection.outcome, itemIds: collection.itemIds }];
  const moduleProgress = modules.map((module) => {
    const ids = module.itemIds?.length ? module.itemIds : collection.itemIds;
    const completed = ids.filter((id) => statusById.get(id)?.independent).length;
    return { ...module, total: ids.length, completed, evidenceMet: ids.length > 0 && completed === ids.length };
  });
  const currentModule = moduleProgress.find((module) => !module.evidenceMet) ?? moduleProgress.at(-1) ?? { title: "Interview capstone", outcome: "Rehearse the complete conversation." };
  const capstone = capstoneEvidence(plan, evidence.interviewStudioHistory ?? []);
  const allCoreEvidence = progress.totalItems > 0 && progress.completedItems === progress.totalItems;
  return {
    completedItems: progress.completedItems + (capstone.completed ? 1 : 0),
    totalItems: progress.totalItems + (capstone.required ? 1 : 0),
    evidence: progress.evidence,
    currentModule,
    modules: moduleProgress,
    whyNext: progress.evidence.due > 0
      ? `${progress.evidence.due} review${progress.evidence.due === 1 ? " is" : "s are"} due inside this plan, so retrieval comes before new exposure.`
      : progress.evidence.assisted > 0
        ? "Assisted exposure is recorded separately; the next block asks for cleaner reconstruction or verified evidence."
        : "Selected from the earliest module still missing current-revision evidence.",
    capstoneReady: allCoreEvidence && !capstone.completed,
    capstone,
    curriculumComplete: allCoreEvidence && (!capstone.required || capstone.completed),
  };
}

export function buildNextFocusBlock(plan, workspace, evidence = {}, options = {}) {
  const snapshot = normalizeSnapshot(plan.collectionSnapshot, workspace.collections.find((entry) => plan.collectionIds?.includes(entry.id)));
  const allowed = new Set(snapshot.itemIds);
  const currentProgress = deriveStudyPlanProgress(plan, workspace, evidence);
  const currentModuleIds = new Set(
    currentProgress.currentModule.itemIds?.length
      ? currentProgress.currentModule.itemIds
      : snapshot.itemIds,
  );
  const now = Date.parse(options.now ?? evidence.now ?? new Date().toISOString());
  const items = (evidence.items ?? []).filter(
    (item) =>
      allowed.has(item.itemId) &&
      (currentModuleIds.has(item.itemId) ||
        itemEvidence(item, evidence.attempts ?? [], now).due),
  );
  const recentLaneMinutes = (evidence.sessionHistory ?? [])
    .filter((session) => plan.sessionIds?.includes(session.id) && session.laneMinutes)
    .slice(-12)
    .map((session) => ({ laneMinutes: session.laneMinutes }));
  const dailyPlan = buildDailyPlan({
    items,
    attempts: evidence.attempts ?? [],
    learningEvents: evidence.learningEvents ?? [],
    profile: { preferredLanguage: "python", dailyGoalMinutes: plan.paceMinutes, pythonShare: 0.6, reviewShare: 0.2, iosShare: 0.2 },
    recentLaneMinutes,
  }, {
    now: options.now ?? evidence.now,
    budgetMinutes: options.budgetMinutes ?? plan.paceMinutes,
    maxItems: options.maxItems ?? 20,
    recentLaneMinutes,
  });
  return {
    queue: dailyPlan.entries,
    entries: dailyPlan.entries,
    dailyPlan,
    estimatedMinutes: dailyPlan.estimatedMinutes,
    deferredDueCount: dailyPlan.deferredDueCount,
    rationale: dailyPlan.deferredDueCount > 0
      ? `Due work comes first; ${dailyPlan.deferredDueCount} additional review${dailyPlan.deferredDueCount === 1 ? " remains" : "s remain"} outside this time box.`
      : "Due retrieval comes first, then the next missing evidence in this plan's current scope.",
  };
}

export function mergeStudyWorkspaces(local, remote, options = {}) {
  const now = iso(options.now, new Date().toISOString());
  const left = normalizeStudyWorkspace(local, { now });
  const right = normalizeStudyWorkspace(remote, { now });
  const comparable = (workspace) => JSON.stringify({
    activePlanId: workspace.activePlanId,
    collections: workspace.collections,
    plans: workspace.plans,
    tombstones: workspace.tombstones,
  });
  if (comparable(left) === comparable(right)) return right;
  const tombstones = normalizeTombstones([...(left.tombstones ?? []), ...(right.tombstones ?? [])], now);
  const mergeEntities = (leftEntities, rightEntities, entity) => {
    const byId = new Map();
    for (const value of [...leftEntities, ...rightEntities]) {
      const existing = byId.get(value.id);
      if (!existing || Date.parse(existing.updatedAt) <= Date.parse(value.updatedAt)) byId.set(value.id, value);
    }
    const deleted = new Map(tombstones.filter((entry) => entry.entity === entity).map((entry) => [entry.id, Date.parse(entry.deletedAt)]));
    return [...byId.values()].filter((value) => (deleted.get(value.id) ?? -1) < Date.parse(value.updatedAt));
  };
  const collections = mergeEntities(left.collections, right.collections, "collection");
  const plans = mergeEntities(left.plans, right.plans, "plan").map((plan) => {
    const leftPlan = left.plans.find((entry) => entry.id === plan.id);
    const rightPlan = right.plans.find((entry) => entry.id === plan.id);
    return {
      ...plan,
      sessionIds: uniqueSessionIds([
        ...(leftPlan?.sessionIds ?? []),
        ...(rightPlan?.sessionIds ?? []),
      ]),
      studioSessionIds: uniqueSessionIds([
        ...(leftPlan?.studioSessionIds ?? []),
        ...(rightPlan?.studioSessionIds ?? []),
      ]),
    };
  });
  const newer = Date.parse(left.updatedAt) >= Date.parse(right.updatedAt) ? left : right;
  const activePlanId = plans.some((plan) => plan.id === newer.activePlanId) ? newer.activePlanId : null;
  return normalizeStudyWorkspace({ version: 1, revision: Math.max(left.revision, right.revision) + 1, updatedAt: now, activePlanId, collections, plans, tombstones }, { now });
}
