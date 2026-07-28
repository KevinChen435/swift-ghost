const WINDOW_DAYS = 30;
const WINDOW_MS = WINDOW_DAYS * 86_400_000;

function asTime(value) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function percent(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

function laneFor(item) {
  if (item?.track === "ios") return "ios";
  return item?.language === "python" ? "python" : "swift";
}

function distributionPercent(values) {
  const entries = Object.entries(values);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const result = Object.fromEntries(entries.map(([key]) => [key, 0]));
  if (!total) return result;
  const shares = entries.map(([key, value], index) => {
    const exact = (value / total) * 100;
    const floor = Math.floor(exact);
    result[key] = floor;
    return { key, index, remainder: exact - floor };
  });
  let remaining = 100 - Object.values(result).reduce((sum, value) => sum + value, 0);
  shares.sort((a, b) => {
    const remainderDelta = b.remainder - a.remainder;
    return Math.abs(remainderDelta) > 1e-9
      ? remainderDelta
      : a.index - b.index;
  });
  for (let index = 0; index < remaining; index += 1) {
    result[shares[index].key] += 1;
  }
  return result;
}

export function buildReadinessSummary(input = {}) {
  const now = new Date(input.now ?? Date.now());
  const nowTime = Number.isNaN(now.getTime()) ? Date.now() : now.getTime();
  const since = nowTime - WINDOW_MS;
  const items = Array.isArray(input.items) ? input.items : [];
  const itemById = new Map(
    items
      .filter((item) => item && typeof item.itemId === "string")
      .map((item) => [item.itemId, item]),
  );
  const attempts = (Array.isArray(input.attempts) ? input.attempts : []).filter(
    (attempt) => {
      const item = itemById.get(attempt?.itemId);
      const completedAt = asTime(attempt?.completedAt);
      return Boolean(
        item &&
          Number(item.contentRevision ?? 1) ===
            Number(attempt.itemRevision ?? 1) &&
          attempt.outcome === "completed" &&
          completedAt !== null &&
          completedAt >= since &&
          completedAt <= nowTime,
      );
    },
  );
  const solves = attempts.filter(
    (attempt) =>
      attempt.practiceKind === "solving" &&
      Number(attempt.verification?.total ?? 0) > 0 &&
      Number(attempt.verification?.passed) ===
        Number(attempt.verification?.total),
  );
  const hintFree = solves.filter((attempt) => Number(attempt.peeks ?? 0) === 0);
  const events = (
    Array.isArray(input.learningEvents) ? input.learningEvents : []
  ).filter((event) => {
    const item = itemById.get(event?.itemId);
    const createdAt = asTime(event?.createdAt);
    return Boolean(
      item &&
        Number(item.contentRevision ?? 1) === Number(event.itemRevision ?? 1) &&
        createdAt !== null &&
        createdAt >= since &&
        createdAt <= nowTime,
    );
  });
  const strongRetrieval = events.filter(
    (event) => event.grade === "good" || event.grade === "easy",
  );
  const debriefedAttempts = new Set(events.map((event) => event.attemptId));
  const frictionCounts = new Map();
  for (const event of events) {
    if (!event.friction || event.friction === "none") continue;
    frictionCounts.set(
      event.friction,
      (frictionCounts.get(event.friction) ?? 0) + 1,
    );
  }
  const topFriction = [...frictionCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0] ?? [null, 0];
  const laneMs = { python: 0, swift: 0, ios: 0 };
  for (const attempt of attempts) {
    const lane = laneFor(itemById.get(attempt.itemId));
    laneMs[lane] += Math.max(0, Number(attempt.durationMs) || 0);
  }
  const laneMinutes = Object.fromEntries(
    Object.entries(laneMs).map(([lane, durationMs]) => [
      lane,
      durationMs / 60_000,
    ]),
  );
  const totalMs = Object.values(laneMs).reduce(
    (sum, durationMs) => sum + durationMs,
    0,
  );
  const lanePercent = distributionPercent(laneMs);

  return {
    windowDays: WINDOW_DAYS,
    hintFreeSolves: {
      numerator: hintFree.length,
      denominator: solves.length,
      percent: percent(hintFree.length, solves.length),
    },
    strongRetrieval: {
      numerator: strongRetrieval.length,
      denominator: events.length,
      percent: percent(strongRetrieval.length, events.length),
    },
    debriefCoverage: {
      numerator: attempts.filter((attempt) => debriefedAttempts.has(attempt.id))
        .length,
      denominator: attempts.length,
      percent: percent(
        attempts.filter((attempt) => debriefedAttempts.has(attempt.id)).length,
        attempts.length,
      ),
    },
    topFriction: {
      category: topFriction[0],
      count: topFriction[1],
      denominator: events.length,
    },
    trackMix: {
      minutes: laneMinutes,
      percent: lanePercent,
      totalMinutes: Math.round(totalMs / 60_000),
    },
    dueToday: Math.max(0, Math.round(Number(input.dueCount) || 0)),
  };
}
