const WINDOW_DAYS = 30;
const WINDOW_MS = WINDOW_DAYS * 86_400_000;
const TIMELINE_DAYS = 90;
const DAY_MS = 86_400_000;

function asTime(value) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function exactTime(value) {
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value ?? "");
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

function utcDayStart(timestamp) {
  const date = new Date(timestamp);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

function dateKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function currentRevision(item, record) {
  return (
    item &&
    Number(item.contentRevision ?? 1) === Number(record?.itemRevision ?? 1)
  );
}

function verifiedSolve(attempt) {
  const total = Number(attempt?.verification?.total ?? 0);
  return (
    attempt?.practiceKind === "solving" &&
    total > 0 &&
    Number(attempt.verification?.passed) === total
  );
}

function strongConceptAttempt(attempt) {
  return (
    attempt?.practiceKind === "concept" &&
    Number(attempt.peeks ?? 0) === 0 &&
    (attempt.conceptGrade === "good" || attempt.conceptGrade === "easy")
  );
}

function emptyLaneMinutes() {
  return { python: 0, swift: 0, ios: 0 };
}

function rate(numerator, denominator) {
  return { numerator, denominator, percent: percent(numerator, denominator) };
}

function frictionSummary(events) {
  const counts = new Map();
  for (const event of events) {
    if (!event.friction || event.friction === "none") continue;
    counts.set(event.friction, (counts.get(event.friction) ?? 0) + 1);
  }
  const [category, count] = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0] ?? [null, 0];
  return { category, count, denominator: events.length };
}

function inPeriod(timestamp, startTime, endTime) {
  return timestamp >= startTime && timestamp < endTime;
}

function summarizeEvidence(
  evidence,
  startTime,
  endTime,
  { includeRates = false } = {},
) {
  const attempts = evidence.attempts.filter((attempt) =>
    inPeriod(attempt.completedTime, startTime, endTime),
  );
  const events = evidence.events.filter((event) =>
    inPeriod(event.createdTime, startTime, endTime),
  );
  const attemptIds = new Set(attempts.map((attempt) => attempt.record.id));
  const debriefedIds = new Set(
    events
      .map((event) => event.record.attemptId)
      .filter((attemptId) => attemptIds.has(attemptId)),
  );
  const solves = attempts.filter((attempt) => verifiedSolve(attempt.record));
  const hintFree = solves.filter(
    (attempt) => Number(attempt.record.peeks ?? 0) === 0,
  );
  const concepts = attempts.filter(
    (attempt) => attempt.record.practiceKind === "concept",
  );
  const strongConcept = concepts.filter((attempt) =>
    strongConceptAttempt(attempt.record),
  );
  const strongRetrieval = events.filter((event) => {
    if (event.record.grade !== "good" && event.record.grade !== "easy") {
      return false;
    }
    if (event.record.activityKind !== "concept") return true;
    return strongConceptAttempt(event.attempt);
  });
  const laneMinutes = emptyLaneMinutes();
  for (const attempt of attempts) {
    laneMinutes[laneFor(attempt.item)] += attempt.durationMs / 60_000;
  }
  const minutes = Object.values(laneMinutes).reduce(
    (total, laneMinutesValue) => total + laneMinutesValue,
    0,
  );
  const summary = {
    startDate: dateKey(startTime),
    endDate: dateKey(endTime - 1),
    activeDays: new Set(
      attempts.map((attempt) => dateKey(attempt.completedTime)),
    ).size,
    completedAttempts: attempts.length,
    minutes,
    laneMinutes,
    verifiedSolves: solves.length,
    hintFreeSolves: hintFree.length,
    retrievalEvents: events.length,
    strongRetrieval: strongRetrieval.length,
    conceptAttempts: concepts.length,
    strongConcept: strongConcept.length,
    debriefedAttempts: debriefedIds.size,
  };
  if (!includeRates) return summary;
  return {
    ...summary,
    hintFreeSolveRate: rate(hintFree.length, solves.length),
    strongRetrievalRate: rate(strongRetrieval.length, events.length),
    conceptRecallRate: rate(strongConcept.length, concepts.length),
    debriefCoverage: rate(debriefedIds.size, attempts.length),
    topFriction: frictionSummary(events.map((event) => event.record)),
  };
}

function timelineEvidence(input, nowTime, windowStart) {
  const items = Array.isArray(input.items) ? input.items : [];
  const itemById = new Map(
    items
      .filter((item) => item && typeof item.itemId === "string")
      .map((item) => [item.itemId, item]),
  );
  const eligibleAttempts = (
    Array.isArray(input.attempts) ? input.attempts : []
  ).flatMap((record) => {
    const item = itemById.get(record?.itemId);
    const completedTime = exactTime(record?.completedAt);
    if (
      !currentRevision(item, record) ||
      record?.outcome !== "completed" ||
      completedTime === null ||
      completedTime > nowTime
    ) {
      return [];
    }
    return [
      {
        record,
        item,
        completedTime,
        durationMs: Math.max(0, Number(record.durationMs) || 0),
      },
    ];
  });
  const attemptById = new Map(
    eligibleAttempts.map((attempt) => [attempt.record.id, attempt]),
  );
  const events = (
    Array.isArray(input.learningEvents) ? input.learningEvents : []
  ).flatMap((record) => {
    const item = itemById.get(record?.itemId);
    const attempt = attemptById.get(record?.attemptId);
    const createdTime = exactTime(record?.createdAt);
    if (
      !currentRevision(item, record) ||
      !attempt ||
      attempt.record.itemId !== record.itemId ||
      Number(attempt.record.itemRevision ?? 1) !==
        Number(record.itemRevision ?? 1) ||
      createdTime === null ||
      createdTime < windowStart ||
      createdTime > nowTime
    ) {
      return [];
    }
    return [{ record, attempt: attempt.record, createdTime }];
  });
  return {
    attempts: eligibleAttempts.filter(
      (attempt) => attempt.completedTime >= windowStart,
    ),
    events,
  };
}

/**
 * Builds a read-only, UTC-calendar view of the learner's last 90 days.
 */
export function buildReadinessTimeline(input = {}) {
  const nowTime = exactTime(input.now);
  if (nowTime === null) {
    throw new TypeError("buildReadinessTimeline requires a valid input.now");
  }
  const todayStart = utcDayStart(nowTime);
  const tomorrowStart = todayStart + DAY_MS;
  const windowStart = todayStart - (TIMELINE_DAYS - 1) * DAY_MS;
  const evidence = timelineEvidence(input, nowTime, windowStart);
  const firstBucketDays = TIMELINE_DAYS % 7 || 7;
  const buckets = [];
  let bucketStart = windowStart;
  let bucketEnd = bucketStart + firstBucketDays * DAY_MS;
  while (bucketStart < tomorrowStart) {
    buckets.push(summarizeEvidence(evidence, bucketStart, bucketEnd));
    bucketStart = bucketEnd;
    bucketEnd = Math.min(bucketStart + 7 * DAY_MS, tomorrowStart);
  }

  const currentStart = todayStart - 29 * DAY_MS;
  const previousStart = currentStart - 30 * DAY_MS;
  const current30 = summarizeEvidence(evidence, currentStart, tomorrowStart, {
    includeRates: true,
  });
  const previous30 = summarizeEvidence(evidence, previousStart, currentStart, {
    includeRates: true,
  });
  const rateDeltas = Object.fromEntries(
    [
      "hintFreeSolveRate",
      "strongRetrievalRate",
      "conceptRecallRate",
      "debriefCoverage",
    ].map((key) => {
      const current = current30[key];
      const previous = previous30[key];
      return [
        key,
        current.denominator >= 3 && previous.denominator >= 3
          ? current.percent - previous.percent
          : null,
      ];
    }),
  );

  return {
    windowDays: TIMELINE_DAYS,
    startDate: dateKey(windowStart),
    endDate: dateKey(todayStart),
    buckets,
    current30,
    previous30,
    rateDeltas,
  };
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
  const conceptAttempts = attempts.filter(
    (attempt) => attempt.practiceKind === "concept",
  );
  const strongConceptAttempts = conceptAttempts.filter(
    (attempt) =>
      Number(attempt.peeks ?? 0) === 0 &&
      (attempt.conceptGrade === "good" || attempt.conceptGrade === "easy"),
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
  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const strongRetrieval = events.filter((event) => {
    if (event.grade !== "good" && event.grade !== "easy") return false;
    if (event.activityKind !== "concept") return true;
    const attempt = attemptById.get(event.attemptId);
    return Boolean(
      attempt?.practiceKind === "concept" && Number(attempt.peeks ?? 0) === 0,
    );
  });
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
    conceptRecall: {
      numerator: strongConceptAttempts.length,
      denominator: conceptAttempts.length,
      percent: percent(strongConceptAttempts.length, conceptAttempts.length),
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
