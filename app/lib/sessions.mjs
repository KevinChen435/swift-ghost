import { supportsConceptPractice } from "./concept-practice.mjs";

export const SESSION_SOURCES = ["mixed", "due", "new", "favorites", "custom"];
export const SESSION_TRACKS = ["all", "interview", "ios"];
export const SESSION_LANGUAGES = ["all", "python", "swift"];
export const SESSION_STAGE_MODES = ["recommended", "recall"];
export const SESSION_PRACTICE_MODES = ["smart", "typing", "solving"];

// Keep the session builder independent from the catalog's TypeScript module:
// this module is also consumed directly by the persistence/test runtime. A
// solve session is deliberately limited to the trusted, server-backed Swift
// lane; local Python execution belongs to the regular Python practice flow.
function isServerRunnableSwift(item) {
  return Boolean(
    item?.solveCapability === "server" &&
      item?.language === "swift" &&
      typeof item?.trustedChallengeKey === "string" &&
      item.trustedChallengeKey.length > 0,
  );
}

export function resolveSessionCurrentIndex(entries, requestedRawIndex) {
  const requested = Math.max(0, Math.round(Number(requestedRawIndex) || 0));
  const nextPending = entries.findIndex(
    (entry) =>
      entry?.status === "pending" && Number(entry.rawIndex) >= requested,
  );
  return nextPending >= 0
    ? nextPending
    : entries.findIndex((entry) => entry?.status === "pending");
}

export function buildSessionQueue(items, signals, options, random = Math.random) {
  const source = SESSION_SOURCES.includes(options.source) ? options.source : "mixed";
  const track = SESSION_TRACKS.includes(options.track) ? options.track : "all";
  const language = SESSION_LANGUAGES.includes(options.language) ? options.language : "all";
  const count = Math.max(1, Math.min(20, Math.round(Number(options.count) || 5)));
  const stageMode = SESSION_STAGE_MODES.includes(options.stageMode) ? options.stageMode : "recommended";
  const practiceMode = SESSION_PRACTICE_MODES.includes(options.practiceMode)
    ? options.practiceMode
    : "smart";
  const candidates = items.filter((item) => {
    const signal = signals[item.itemId] ?? {};
    // Transfer variants are intentionally sealed inside Transfer Lab. Generic
    // practice queues must never surface them before their dedicated exposure
    // contract records the prompt opening.
    if (item.transfer) return false;
    if (track !== "all" && item.track !== track) return false;
    if (language !== "all" && item.language !== language) return false;
    if (options.pattern && options.pattern !== "All" && item.pattern !== options.pattern) return false;
    if (options.difficulty && options.difficulty !== "All" && item.difficulty !== options.difficulty) return false;
    if (source === "due" && !signal.due) return false;
    if (source === "new" && Number(signal.completions || 0) > 0) return false;
    if (source === "favorites" && !signal.favorite) return false;
    if (source === "custom" && item.source !== "custom") return false;
    if (practiceMode === "solving" && !isServerRunnableSwift(item)) return false;
    return true;
  });

  const ranked = candidates.map((item) => {
    const signal = signals[item.itemId] ?? {};
    const priority = source === "mixed" ? (signal.due ? 0 : Number(signal.completions || 0) === 0 ? 1 : 2) : 0;
    return { item, priority, tie: random() };
  }).sort((a, b) => a.priority - b.priority || a.tie - b.tie);

  return ranked.slice(0, count).map(({ item }) => {
    const practiceKind =
      practiceMode === "solving"
        ? "solving"
        : supportsConceptPractice(item)
          ? "concept"
          : practiceMode === "typing"
            ? "typing"
            : undefined;
    return {
      itemId: item.itemId,
      itemRevision: Math.max(1, Math.round(Number(signals[item.itemId]?.itemRevision) || Number(item.contentRevision) || 1)),
      stage:
        practiceMode === "solving"
          ? 5
          : stageMode === "recall"
            ? 5
            : Math.max(1, Math.min(5, Math.round(Number(signals[item.itemId]?.recommendedStage) || 1))),
      status: "pending",
      ...(practiceKind ? { practiceKind } : {}),
    };
  });
}
