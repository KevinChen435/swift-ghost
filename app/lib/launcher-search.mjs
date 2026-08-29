const DEFAULT_LIMIT = 8;

function normalized(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, " ")
    : "";
}

function tokens(value) {
  return normalized(value)
    .split(/[^a-z0-9#:+-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function candidateText(item) {
  return {
    id: normalized(item?.itemId),
    slug: normalized(item?.slug),
    title: normalized(item?.title),
    pattern: normalized(item?.pattern),
    tags: Array.isArray(item?.tags) ? item.tags.map(normalized).filter(Boolean) : [],
    summary: normalized(item?.summary),
    cue: normalized(item?.cue),
    invariant: normalized(item?.invariant),
  };
}

function scoreCandidate(item, query) {
  const text = candidateText(item);
  const queryTokens = tokens(query);
  if (!queryTokens.length) return null;
  const joined = [text.id, text.slug, text.title, text.pattern, ...text.tags, text.summary, text.cue, text.invariant].join(" ");
  if (!queryTokens.every((token) => joined.includes(token))) return null;

  const compact = normalized(query);
  let score = 0;
  if (text.id === compact || text.slug === compact) score += 1_200;
  if (text.title === compact) score += 1_100;
  if (text.title.startsWith(compact)) score += 900;
  if (text.id.startsWith(compact) || text.slug.startsWith(compact)) score += 820;
  if (text.title.split(/[^a-z0-9]+/).some((token) => token.startsWith(compact))) score += 720;
  if (text.pattern === compact || text.tags.includes(compact)) score += 600;
  if (text.pattern.includes(compact) || text.tags.some((tag) => tag.includes(compact))) score += 520;
  if (text.summary.includes(compact) || text.cue.includes(compact) || text.invariant.includes(compact)) score += 260;
  score += queryTokens.reduce((total, token) => {
    if (text.title.includes(token)) return total + 50;
    if (text.pattern.includes(token) || text.tags.some((tag) => tag.includes(token))) return total + 25;
    return total;
  }, 0);
  return score;
}

/**
 * Find catalog items for the keyboard launcher without exposing source or
 * answer content. Archived custom items are intentionally omitted.
 */
export function searchLauncherItems(items, query, options = {}) {
  if (!normalized(query)) return [];
  const limit = Number.isInteger(options.limit)
    ? Math.max(1, Math.min(20, options.limit))
    : DEFAULT_LIMIT;
  const source = Array.isArray(items) ? items : [];
  const matches = source.flatMap((item, index) => {
    if (!item || item.archivedAt) return [];
    const score = scoreCandidate(item, query);
    return score === null ? [] : [{ item, score, index }];
  });
  return matches
    .sort((left, right) =>
      right.score - left.score ||
      normalized(left.item.title).localeCompare(normalized(right.item.title)) ||
      normalized(left.item.itemId).localeCompare(normalized(right.item.itemId)) ||
      left.index - right.index,
    )
    .slice(0, limit)
    .map(({ item, score }) => ({ item, score }));
}

export const LAUNCHER_ITEM_LIMIT = DEFAULT_LIMIT;
