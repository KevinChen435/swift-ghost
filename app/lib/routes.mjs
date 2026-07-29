import {
  DEFAULT_CATALOG_QUERY,
  normalizeCatalogQuery,
} from "./catalog-discovery.mjs";
import {
  DEFAULT_SUBMISSION_WORK_LOG_QUERY,
  normalizeSubmissionWorkLogQuery,
} from "./submission-work-log.mjs";
import {
  WEAKNESS_FILTERS,
  WEAKNESS_LANES,
} from "./weakness-lab.mjs";

export const ROUTE_VIEWS = [
  "today",
  "plans",
  "learn",
  "improve",
  "practice",
  "sessions",
  "assessments",
  "library",
  "records",
  "settings",
];
export const LEARN_STEPS = [
  "recognize",
  "reason",
  "trace",
  "template",
  "practice",
];
export const LEARN_REVIEW_MODES = ["mixed", "tests", "reconstruct"];
export const TEST_DESIGN_LANES = ["python", "swift", "ios"];
export const CONCEPT_TRANSFER_LANES = ["swift", "ios"];
export const CONCEPT_TRANSFER_SOURCES = [
  "academy",
  "today",
  "assessment",
  "weakness",
];
export const COMMUNITY_TABS = ["recent", "records", "daily", "profile"];
export const RECORDS_SECTIONS = [
  "overview",
  "trends",
  "transfer",
  "submissions",
  "closures",
  "reviews",
];
export const CONTEST_SECTIONS = [
  "overview",
  "live",
  "history",
  "standings",
  "review",
];
export const ROUTE_LANGUAGES = ["python", "swift"];

function sourceParams(input) {
  if (input instanceof URLSearchParams) return input;
  if (input instanceof URL) return input.searchParams;
  if (typeof input === "string") {
    try {
      return new URL(input, "https://swift-ghost.invalid/").searchParams;
    } catch {
      return new URLSearchParams();
    }
  }
  return new URLSearchParams();
}

function cleanHandle(value) {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])?$/.test(normalized)
    ? normalized
    : undefined;
}

function cleanAssessmentId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(normalized)
    ? normalized
    : undefined;
}

function cleanPatternId(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized.length <= 64 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)
    ? normalized
    : undefined;
}

function cleanReviewAttemptId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9._:-]{0,158}[a-zA-Z0-9])?$/.test(
    normalized,
  )
    ? normalized
    : undefined;
}

function cleanTransferRecordId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9._:-]{0,158}[a-zA-Z0-9])?$/.test(
    normalized,
  )
    ? normalized
    : undefined;
}

function cleanSessionId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9._:-]{0,158}[a-zA-Z0-9])?$/.test(
    normalized,
  )
    ? normalized
    : undefined;
}

function cleanContestRoundId(value) {
  return cleanSessionId(value);
}

function cleanWeaknessCaseId(value) {
  return cleanSessionId(value);
}

function legacyCatalogLanes(params) {
  if (params.has("lane")) return [];
  if (params.get("track") === "ios") return ["ios"];
  const language = params.get("lang");
  return language === "python" || language === "swift" ? [language] : [];
}

function catalogQueryFromParams(params) {
  return normalizeCatalogQuery({
    text: params.get("q") ?? "",
    lanes: params.has("lane")
      ? params.getAll("lane")
      : legacyCatalogLanes(params),
    patterns: params.getAll("pattern"),
    difficulties: params.getAll("difficulty"),
    statuses: params.getAll("status"),
    lineRange: params.get("lines"),
    timeRange: params.get("time"),
    collectionIds: params.getAll("collection"),
    sort: params.get("sort"),
    direction: params.get("dir"),
    layout: params.get("layout"),
    page: Number(params.get("page")),
    pageSize: Number(params.get("size")),
  });
}

function submissionQueryFromParams(params) {
  return normalizeSubmissionWorkLogQuery({
    text: params.get("sq") ?? "",
    statuses: params.getAll("verdict"),
    origins: params.getAll("origin"),
    languages: params.getAll("language"),
    revision: params.get("revision"),
    range: params.get("range"),
    sort: params.get("sort"),
    page: Number(params.get("page")),
    pageSize: Number(params.get("size")),
    selectedId: params.get("submission"),
    compareId: params.get("compare"),
  });
}

export function parseRoute(input) {
  const params = sourceParams(input);
  const profile = cleanHandle(params.get("profile"));
  const requestedView = params.get("view");
  const view = ROUTE_VIEWS.includes(requestedView)
    ? requestedView
    : profile
      ? "records"
      : "today";
  const requestedLanguage = params.get("lang");
  const language = ROUTE_LANGUAGES.includes(requestedLanguage)
    ? requestedLanguage
    : undefined;
  const requestedTrack = params.get("track");
  const track =
    requestedTrack === "interview" || requestedTrack === "ios"
      ? requestedTrack
      : undefined;
  const item = (params.get("item") ?? "").trim().slice(0, 180) || undefined;
  const requestedStage = Number(params.get("stage"));
  const stage =
    Number.isInteger(requestedStage) &&
    requestedStage >= 1 &&
    requestedStage <= 5
      ? requestedStage
      : undefined;
  const requestedPractice = params.get("practice");
  const practiceKind =
    requestedPractice === "solve"
      ? "solving"
      : requestedPractice === "concept"
        ? "concept"
        : undefined;
  const requestedTab = params.get("tab");
  const communityTab = COMMUNITY_TABS.includes(requestedTab)
    ? requestedTab
    : profile
      ? "profile"
      : undefined;
  const assessment =
    view === "assessments"
      ? cleanAssessmentId(params.get("assessment"))
      : undefined;
  const requestedContestSection = params.get("contest");
  const contestSection =
    view === "assessments" && assessment === "virtual-rounds"
      ? CONTEST_SECTIONS.includes(requestedContestSection)
        ? requestedContestSection
        : "overview"
      : undefined;
  const contestRoundId =
    contestSection === "review"
      ? cleanContestRoundId(params.get("round"))
      : undefined;
  const requestedRecordsSection = params.get("section");
  const recordsSection =
    view === "records" && RECORDS_SECTIONS.includes(requestedRecordsSection)
      ? requestedRecordsSection
      : view === "records"
        ? "overview"
        : undefined;
  const reviewAttemptId =
    recordsSection === "reviews"
      ? cleanReviewAttemptId(params.get("attempt"))
      : undefined;
  const closureId =
    recordsSection === "closures"
      ? cleanReviewAttemptId(params.get("closure"))
      : undefined;
  const transferVariantId =
    recordsSection === "transfer"
      ? cleanTransferRecordId(params.get("variant"))
      : undefined;
  const transferAttemptId =
    recordsSection === "transfer" && transferVariantId
      ? cleanTransferRecordId(params.get("attempt"))
      : undefined;
  const sessionId =
    view === "sessions" ? cleanSessionId(params.get("session")) : undefined;
  const weaknessFilter =
    view === "improve" && WEAKNESS_FILTERS.includes(params.get("inbox"))
      ? params.get("inbox")
      : view === "improve"
        ? "priority"
        : undefined;
  const weaknessLane =
    view === "improve" && WEAKNESS_LANES.includes(params.get("lane"))
      ? params.get("lane")
      : view === "improve"
        ? "all"
        : undefined;
  const weaknessCaseId =
    view === "improve" ? cleanWeaknessCaseId(params.get("case")) : undefined;
  const patternId =
    view === "learn" && !LEARN_REVIEW_MODES.includes(params.get("review"))
      ? cleanPatternId(params.get("pattern"))
      : undefined;
  const learnReview =
    view === "learn" && LEARN_REVIEW_MODES.includes(params.get("review"))
      ? params.get("review")
      : undefined;
  const patternSprintId =
    learnReview === "mixed" ? cleanSessionId(params.get("sprint")) : undefined;
  const testDesignSprintId =
    learnReview === "tests" ? cleanSessionId(params.get("sprint")) : undefined;
  const testDesignLane =
    learnReview === "tests" && TEST_DESIGN_LANES.includes(params.get("lane"))
      ? params.get("lane")
      : undefined;
  const testDesignAttemptId =
    learnReview === "tests" ? cleanSessionId(params.get("attempt")) : undefined;
  const conceptTransferLane =
    learnReview === "reconstruct" &&
    CONCEPT_TRANSFER_LANES.includes(params.get("lane"))
      ? params.get("lane")
      : undefined;
  const conceptTransferVariantId =
    learnReview === "reconstruct"
      ? cleanSessionId(params.get("variant"))
      : undefined;
  const conceptTransferSource =
    learnReview === "reconstruct" &&
    CONCEPT_TRANSFER_SOURCES.includes(params.get("from"))
      ? params.get("from")
      : undefined;
  const lessonStep =
    view === "learn" && LEARN_STEPS.includes(params.get("lessonStep"))
      ? params.get("lessonStep")
      : view === "learn" && patternId
        ? "recognize"
        : undefined;
  return {
    view,
    language,
    track,
    item,
    stage,
    practiceKind,
    communityTab,
    profile,
    assessment,
    ...(view === "learn"
      ? {
          ...(learnReview
            ? {
                learnReview,
                ...(patternSprintId ? { patternSprintId } : {}),
                ...(testDesignSprintId ? { testDesignSprintId } : {}),
                ...(testDesignLane ? { testDesignLane } : {}),
                ...(testDesignAttemptId ? { testDesignAttemptId } : {}),
                ...(conceptTransferLane ? { conceptTransferLane } : {}),
                ...(conceptTransferVariantId
                  ? { conceptTransferVariantId }
                  : {}),
                ...(conceptTransferSource
                  ? { conceptTransferSource }
                  : {}),
              }
            : {
                ...(patternId ? { patternId } : {}),
                ...(lessonStep ? { lessonStep } : {}),
              }),
        }
      : {}),
    ...(contestSection
      ? {
          contestSection,
          ...(contestRoundId ? { contestRoundId } : {}),
        }
      : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(view === "improve"
      ? {
          weaknessFilter,
          weaknessLane,
          ...(weaknessCaseId ? { weaknessCaseId } : {}),
        }
      : {}),
    ...(view === "library" ? { catalog: catalogQueryFromParams(params) } : {}),
    ...(recordsSection
      ? {
          recordsSection,
          ...(recordsSection === "submissions"
            ? { submissions: submissionQueryFromParams(params) }
            : {}),
          ...(reviewAttemptId ? { reviewAttemptId } : {}),
          ...(closureId ? { closureId } : {}),
          ...(transferVariantId ? { transferVariantId } : {}),
          ...(transferAttemptId ? { transferAttemptId } : {}),
        }
      : {}),
  };
}

export function itemRouteToken(item) {
  return item.source === "custom" ? item.itemId : item.slug;
}

export function resolveRouteItem(items, route) {
  if (!route?.item) return null;
  const exact = items.find(
    (item) =>
      item.itemId === route.item &&
      (!route.track || item.track === route.track),
  );
  if (exact && (!route.language || exact.language === route.language))
    return exact;
  const slugMatches = items.filter(
    (item) =>
      item.slug === route.item &&
      (!route.language || item.language === route.language) &&
      (!route.track || item.track === route.track),
  );
  if (!route.language)
    return (
      slugMatches.find((item) => item.language === "swift") ??
      slugMatches[0] ??
      null
    );
  return slugMatches[0] ?? null;
}

export function routeForItem(item, stage = 1, practiceKind = "typing") {
  return {
    view: "practice",
    language: item.language,
    track: item.track,
    item: itemRouteToken(item),
    stage: Math.max(1, Math.min(5, Math.round(stage))),
    ...(practiceKind === "solving" || practiceKind === "concept"
      ? { practiceKind }
      : {}),
  };
}

export function serializeRoute(
  route,
  currentHref = "https://swift-ghost.invalid/",
) {
  const url = new URL(currentHref, "https://swift-ghost.invalid/");
  url.search = "";
  const view = ROUTE_VIEWS.includes(route?.view) ? route.view : "today";
  if (view !== "today") url.searchParams.set("view", view);
  if (view === "practice" && ROUTE_LANGUAGES.includes(route?.language))
    url.searchParams.set("lang", route.language);
  if (
    view === "practice" &&
    (route?.track === "interview" || route?.track === "ios")
  )
    url.searchParams.set("track", route.track);
  if (view === "library") {
    const legacyLanes =
      route?.track === "ios"
        ? ["ios"]
        : route?.language === "python" || route?.language === "swift"
          ? [route.language]
          : [];
    const query = normalizeCatalogQuery(
      route?.catalog ?? { lanes: legacyLanes },
    );
    if (query.text !== DEFAULT_CATALOG_QUERY.text)
      url.searchParams.append("q", query.text);
    for (const lane of query.lanes) url.searchParams.append("lane", lane);
    for (const pattern of query.patterns)
      url.searchParams.append("pattern", pattern);
    for (const difficulty of query.difficulties)
      url.searchParams.append("difficulty", difficulty);
    for (const status of query.statuses)
      url.searchParams.append("status", status);
    if (query.lineRange !== DEFAULT_CATALOG_QUERY.lineRange)
      url.searchParams.append("lines", query.lineRange);
    if (query.timeRange !== DEFAULT_CATALOG_QUERY.timeRange)
      url.searchParams.append("time", query.timeRange);
    for (const collectionId of query.collectionIds)
      url.searchParams.append("collection", collectionId);
    if (query.sort !== DEFAULT_CATALOG_QUERY.sort)
      url.searchParams.append("sort", query.sort);
    if (query.direction !== DEFAULT_CATALOG_QUERY.direction)
      url.searchParams.append("dir", query.direction);
    if (query.layout !== DEFAULT_CATALOG_QUERY.layout)
      url.searchParams.append("layout", query.layout);
    if (query.page !== DEFAULT_CATALOG_QUERY.page)
      url.searchParams.append("page", String(query.page));
    if (query.pageSize !== DEFAULT_CATALOG_QUERY.pageSize)
      url.searchParams.append("size", String(query.pageSize));
  }
  if (
    view === "practice" &&
    typeof route?.item === "string" &&
    route.item.trim()
  )
    url.searchParams.set("item", route.item.trim().slice(0, 180));
  if (
    view === "practice" &&
    Number.isInteger(route?.stage) &&
    route.stage >= 1 &&
    route.stage <= 5
  )
    url.searchParams.set("stage", String(route.stage));
  if (view === "practice" && route?.practiceKind === "solving")
    url.searchParams.set("practice", "solve");
  if (view === "practice" && route?.practiceKind === "concept")
    url.searchParams.set("practice", "concept");
  if (view === "records" && COMMUNITY_TABS.includes(route?.communityTab))
    url.searchParams.set("tab", route.communityTab);
  if (view === "records" && route?.recordsSection === "submissions") {
    url.searchParams.set("section", "submissions");
    const query = normalizeSubmissionWorkLogQuery(route?.submissions);
    if (query.text !== DEFAULT_SUBMISSION_WORK_LOG_QUERY.text)
      url.searchParams.set("sq", query.text);
    for (const status of query.statuses)
      url.searchParams.append("verdict", status);
    for (const origin of query.origins)
      url.searchParams.append("origin", origin);
    for (const language of query.languages)
      url.searchParams.append("language", language);
    if (query.revision !== DEFAULT_SUBMISSION_WORK_LOG_QUERY.revision)
      url.searchParams.set("revision", query.revision);
    if (query.range !== DEFAULT_SUBMISSION_WORK_LOG_QUERY.range)
      url.searchParams.set("range", query.range);
    if (query.sort !== DEFAULT_SUBMISSION_WORK_LOG_QUERY.sort)
      url.searchParams.set("sort", query.sort);
    if (query.page !== DEFAULT_SUBMISSION_WORK_LOG_QUERY.page)
      url.searchParams.set("page", String(query.page));
    if (query.pageSize !== DEFAULT_SUBMISSION_WORK_LOG_QUERY.pageSize)
      url.searchParams.set("size", String(query.pageSize));
    if (query.selectedId) url.searchParams.set("submission", query.selectedId);
    if (query.compareId) url.searchParams.set("compare", query.compareId);
  }
  if (view === "records" && route?.recordsSection === "reviews") {
    url.searchParams.set("section", "reviews");
    const reviewAttemptId = cleanReviewAttemptId(route?.reviewAttemptId);
    if (reviewAttemptId) url.searchParams.set("attempt", reviewAttemptId);
  }
  if (view === "records" && route?.recordsSection === "closures") {
    url.searchParams.set("section", "closures");
    const closureId = cleanReviewAttemptId(route?.closureId);
    if (closureId) url.searchParams.set("closure", closureId);
  }
  if (view === "records" && route?.recordsSection === "trends") {
    url.searchParams.set("section", "trends");
  }
  if (view === "records" && route?.recordsSection === "transfer") {
    url.searchParams.set("section", "transfer");
    const transferVariantId = cleanTransferRecordId(route?.transferVariantId);
    const transferAttemptId = cleanTransferRecordId(route?.transferAttemptId);
    if (transferVariantId) url.searchParams.set("variant", transferVariantId);
    if (transferVariantId && transferAttemptId)
      url.searchParams.set("attempt", transferAttemptId);
  }
  if (view === "sessions") {
    const sessionId = cleanSessionId(route?.sessionId);
    if (sessionId) url.searchParams.set("session", sessionId);
  }
  if (view === "improve") {
    const weaknessFilter = WEAKNESS_FILTERS.includes(route?.weaknessFilter)
      ? route.weaknessFilter
      : "priority";
    const weaknessLane = WEAKNESS_LANES.includes(route?.weaknessLane)
      ? route.weaknessLane
      : "all";
    const weaknessCaseId = cleanWeaknessCaseId(route?.weaknessCaseId);
    if (weaknessFilter !== "priority")
      url.searchParams.set("inbox", weaknessFilter);
    if (weaknessLane !== "all") url.searchParams.set("lane", weaknessLane);
    if (weaknessCaseId) url.searchParams.set("case", weaknessCaseId);
  }
  if (view === "learn") {
    const learnReview = LEARN_REVIEW_MODES.includes(route?.learnReview)
      ? route.learnReview
      : undefined;
    if (learnReview) {
      url.searchParams.set("review", learnReview);
      if (
        learnReview === "tests" &&
        TEST_DESIGN_LANES.includes(route?.testDesignLane)
      )
        url.searchParams.set("lane", route.testDesignLane);
      if (
        learnReview === "reconstruct" &&
        CONCEPT_TRANSFER_LANES.includes(route?.conceptTransferLane)
      )
        url.searchParams.set("lane", route.conceptTransferLane);
      const sprintId = cleanSessionId(
        learnReview === "tests"
          ? route?.testDesignSprintId
          : learnReview === "mixed"
            ? route?.patternSprintId
            : undefined,
      );
      if (sprintId) url.searchParams.set("sprint", sprintId);
      if (learnReview === "tests") {
        const attemptId = cleanSessionId(route?.testDesignAttemptId);
        if (attemptId) url.searchParams.set("attempt", attemptId);
      }
      if (learnReview === "reconstruct") {
        const variantId = cleanSessionId(route?.conceptTransferVariantId);
        if (variantId) url.searchParams.set("variant", variantId);
        if (CONCEPT_TRANSFER_SOURCES.includes(route?.conceptTransferSource))
          url.searchParams.set("from", route.conceptTransferSource);
      }
    } else {
      const patternId = cleanPatternId(route?.patternId);
      if (patternId) url.searchParams.set("pattern", patternId);
      const lessonStep = LEARN_STEPS.includes(route?.lessonStep)
        ? route.lessonStep
        : patternId
          ? "recognize"
          : undefined;
      if (lessonStep && lessonStep !== "recognize")
        url.searchParams.set("lessonStep", lessonStep);
    }
  }
  const assessment =
    view === "assessments" ? cleanAssessmentId(route?.assessment) : undefined;
  if (assessment) url.searchParams.set("assessment", assessment);
  if (assessment === "virtual-rounds") {
    const contestSection = CONTEST_SECTIONS.includes(route?.contestSection)
      ? route.contestSection
      : "overview";
    if (contestSection !== "overview")
      url.searchParams.set("contest", contestSection);
    const contestRoundId =
      contestSection === "review"
        ? cleanContestRoundId(route?.contestRoundId)
        : undefined;
    if (contestRoundId) url.searchParams.set("round", contestRoundId);
  }
  const profile = view === "records" ? cleanHandle(route?.profile) : undefined;
  if (profile) url.searchParams.set("profile", profile);
  return `${url.pathname}${url.search}${url.hash}`;
}
