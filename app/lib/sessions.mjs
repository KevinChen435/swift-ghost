export const SESSION_SOURCES = ["mixed", "due", "new", "favorites", "custom"];
export const SESSION_TRACKS = ["all", "interview", "ios"];
export const SESSION_STAGE_MODES = ["recommended", "recall"];

export function buildSessionQueue(items, signals, options, random = Math.random) {
  const source = SESSION_SOURCES.includes(options.source) ? options.source : "mixed";
  const track = SESSION_TRACKS.includes(options.track) ? options.track : "all";
  const count = Math.max(1, Math.min(20, Math.round(Number(options.count) || 5)));
  const stageMode = SESSION_STAGE_MODES.includes(options.stageMode) ? options.stageMode : "recommended";
  const candidates = items.filter((item) => {
    const signal = signals[item.itemId] ?? {};
    if (track !== "all" && item.track !== track) return false;
    if (options.pattern && options.pattern !== "All" && item.pattern !== options.pattern) return false;
    if (options.difficulty && options.difficulty !== "All" && item.difficulty !== options.difficulty) return false;
    if (source === "due" && !signal.due) return false;
    if (source === "new" && Number(signal.completions || 0) > 0) return false;
    if (source === "favorites" && !signal.favorite) return false;
    if (source === "custom" && item.source !== "custom") return false;
    return true;
  });

  const ranked = candidates.map((item) => {
    const signal = signals[item.itemId] ?? {};
    const priority = source === "mixed" ? (signal.due ? 0 : Number(signal.completions || 0) === 0 ? 1 : 2) : 0;
    return { item, priority, tie: random() };
  }).sort((a, b) => a.priority - b.priority || a.tie - b.tie);

  return ranked.slice(0, count).map(({ item }) => ({
    itemId: item.itemId,
    itemRevision: Math.max(1, Math.round(Number(signals[item.itemId]?.itemRevision) || Number(item.contentRevision) || 1)),
    stage: stageMode === "recall" ? 5 : Math.max(1, Math.min(5, Math.round(Number(signals[item.itemId]?.recommendedStage) || 1))),
    status: "pending",
  }));
}
