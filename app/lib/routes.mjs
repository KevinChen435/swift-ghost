export const ROUTE_VIEWS = [
  "today",
  "practice",
  "sessions",
  "library",
  "records",
  "settings",
];
export const COMMUNITY_TABS = ["recent", "records", "daily", "profile"];
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
  const practiceKind =
    params.get("practice") === "solve" ? "solving" : undefined;
  const requestedTab = params.get("tab");
  const communityTab = COMMUNITY_TABS.includes(requestedTab)
    ? requestedTab
    : profile
      ? "profile"
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
    ...(practiceKind === "solving" ? { practiceKind } : {}),
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
  if (ROUTE_LANGUAGES.includes(route?.language))
    url.searchParams.set("lang", route.language);
  if (
    (view === "library" || view === "practice") &&
    (route?.track === "interview" || route?.track === "ios")
  )
    url.searchParams.set("track", route.track);
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
  if (view === "records" && COMMUNITY_TABS.includes(route?.communityTab))
    url.searchParams.set("tab", route.communityTab);
  const profile = view === "records" ? cleanHandle(route?.profile) : undefined;
  if (profile) url.searchParams.set("profile", profile);
  return `${url.pathname}${url.search}${url.hash}`;
}
