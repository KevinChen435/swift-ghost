export const PROBLEM_NOTE_LIMITS = Object.freeze({
  maxNotes: 250,
  maxApproachLength: 3000,
  maxPitfallsLength: 2000,
  maxComplexityLength: 800,
  maxTotalBytes: 512_000,
});

function cleanText(value, limit) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").slice(0, limit) : "";
}

function cleanTimestamp(value, fallback) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : fallback;
}

export function normalizeProblemNotes(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const validItemIds = options.validItemIds;
  const fallbackNow = cleanTimestamp(options.now, "1970-01-01T00:00:00.000Z");
  const candidates = Object.entries(value)
    .flatMap(([rawItemId, raw]) => {
      if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw) ||
        (validItemIds instanceof Set && !validItemIds.has(rawItemId))
      ) return [];
      const itemRevision = Math.max(1, Math.min(1_000_000, Math.round(Number(raw.itemRevision) || 1)));
      const approach = cleanText(raw.approach, PROBLEM_NOTE_LIMITS.maxApproachLength);
      const pitfalls = cleanText(raw.pitfalls, PROBLEM_NOTE_LIMITS.maxPitfallsLength);
      const complexity = cleanText(raw.complexity, PROBLEM_NOTE_LIMITS.maxComplexityLength);
      if (!approach.trim() && !pitfalls.trim() && !complexity.trim()) return [];
      return [[rawItemId, {
        itemId: rawItemId,
        itemRevision,
        approach,
        pitfalls,
        complexity,
        updatedAt: cleanTimestamp(raw.updatedAt, fallbackNow),
      }]];
    })
    .sort((left, right) => Date.parse(right[1].updatedAt) - Date.parse(left[1].updatedAt));
  const entries = [];
  let totalBytes = 2;
  for (const entry of candidates) {
    if (entries.length >= PROBLEM_NOTE_LIMITS.maxNotes) break;
    const entryBytes = new TextEncoder().encode(
      `${entries.length ? "," : ""}${JSON.stringify(entry[0])}:${JSON.stringify(entry[1])}`,
    ).byteLength;
    if (entryBytes + totalBytes > PROBLEM_NOTE_LIMITS.maxTotalBytes) continue;
    entries.push(entry);
    totalBytes += entryBytes;
  }
  return Object.fromEntries(entries);
}

export function saveProblemNote(notes, input, options = {}) {
  const now = cleanTimestamp(options.now, new Date().toISOString());
  const itemId = typeof input?.itemId === "string" ? input.itemId : "";
  if (!itemId) return normalizeProblemNotes(notes, options);
  return normalizeProblemNotes({
    ...notes,
    [itemId]: {
      itemId,
      itemRevision: input.itemRevision,
      approach: input.approach,
      pitfalls: input.pitfalls,
      complexity: input.complexity,
      updatedAt: now,
    },
  }, options);
}

export function deleteProblemNote(notes, itemId, options = {}) {
  const next = { ...(notes ?? {}) };
  delete next[itemId];
  return normalizeProblemNotes(next, options);
}
