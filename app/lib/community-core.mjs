const MAX_UPLOAD_AGE_MS = 3 * 365 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000;
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, maxLength, { required = false } = {}) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string") throw new Error("must be a string");
  const normalized = value.trim().replace(/\s+/g, " ");
  if (required && !normalized) throw new Error("must not be empty");
  if (normalized.length > maxLength) throw new Error(`must be at most ${maxLength} characters`);
  return normalized || null;
}

function booleanField(value, name) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${name} must be a boolean`);
  return value;
}

function patchableText(value, current, maxLength) {
  if (value === undefined) return current ?? null;
  if (value === null) return null;
  return cleanText(value, maxLength) ?? null;
}

export function normalizeProfilePatch(input, current) {
  if (!plainObject(input)) throw new Error("profile must be an object");
  const allowed = new Set(["handle", "displayName", "bio", "timezone", "shareCommunity", "isPublic", "shareActivity", "showOnLeaderboards"]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`unknown profile field: ${key}`);
  }

  const shareCommunity = booleanField(input.shareCommunity, "shareCommunity");
  const timezone = patchableText(input.timezone, current.timezone, 64);
  if (timezone && !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(timezone)) throw new Error("timezone is invalid");
  const next = {
    handle: input.handle === undefined ? current.handle : validateHandle(input.handle),
    displayName: patchableText(input.displayName, current.displayName, 48),
    bio: patchableText(input.bio, current.bio, 160),
    timezone,
    isPublic: shareCommunity ?? booleanField(input.isPublic, "isPublic") ?? Boolean(current.isPublic),
    shareActivity: shareCommunity ?? booleanField(input.shareActivity, "shareActivity") ?? Boolean(current.shareActivity),
    showOnLeaderboards:
      shareCommunity ?? booleanField(input.showOnLeaderboards, "showOnLeaderboards") ?? Boolean(current.showOnLeaderboards),
  };

  // This is the core privacy invariant: a private profile can never leak through
  // either public surface, even when a stale client submits sharing=true.
  if (!next.isPublic) {
    next.shareActivity = false;
    next.showOnLeaderboards = false;
  }
  return next;
}

export function validateHandle(value) {
  if (typeof value !== "string") throw new Error("handle must be a string");
  const handle = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/.test(handle) || handle.includes("--")) {
    throw new Error("handle must be 3-24 lowercase letters, numbers, or single hyphens");
  }
  return handle;
}

export function validateAttemptUpload(raw, now = Date.now()) {
  if (!plainObject(raw)) return { ok: false, error: "attempt must be an object" };
  try {
    const allowed = new Set([
      "id", "clientAttemptId", "itemId", "itemRevision", "itemTitle", "title", "titleSnapshot", "track", "stage", "mode",
      "startedAt", "completedAt", "durationMs", "totalKeystrokes", "correctKeystrokes", "rejectedKeystrokes",
      "corrections", "peeks", "rawWpm", "wpm", "accuracy", "consistency", "outcome", "qualification",
      "challengeDate", "sessionId", "typedChars", "completed",
    ]);
    for (const key of Object.keys(raw)) {
      if (!allowed.has(key)) throw new Error(`unknown attempt field: ${key}`);
    }
    if (raw.completed !== true && raw.outcome !== "completed") throw new Error("only completed attempts can be uploaded");

    const clientAttemptId = cleanText(raw.clientAttemptId ?? raw.id, 96, { required: true });
    const itemId = cleanText(raw.itemId, 96, { required: true });
    const itemTitle = cleanText(raw.itemTitle ?? raw.title ?? raw.titleSnapshot ?? raw.itemId, 120, { required: true });
    if (!/^(?:builtin:\d+|python:\d+|ios:[a-z0-9][a-z0-9-]*)$/i.test(itemId)) throw new Error("only built-in items can be uploaded");
    if (!Number.isInteger(raw.itemRevision) || raw.itemRevision < 1 || raw.itemRevision > 1_000_000) {
      throw new Error("itemRevision is invalid");
    }
    const track = raw.track ?? (itemId.startsWith("ios:") ? "ios" : "interview");
    if (track !== "interview" && track !== "ios") throw new Error("track must be interview or ios");
    if (!Number.isInteger(raw.stage) || raw.stage < 1 || raw.stage > 5) throw new Error("stage must be an integer from 1 to 5");
    if (raw.mode !== "strict" && raw.mode !== "free") throw new Error("mode must be strict or free");
    if (typeof raw.accuracy !== "number" || !Number.isFinite(raw.accuracy) || raw.accuracy < 0 || raw.accuracy > 100) {
      throw new Error("accuracy must be from 0 to 100");
    }
    if (!Number.isInteger(raw.durationMs) || raw.durationMs < 250 || raw.durationMs > MAX_DURATION_MS) {
      throw new Error("durationMs is outside the accepted range");
    }
    const typedChars = raw.typedChars ?? raw.totalKeystrokes;
    if (!Number.isInteger(typedChars) || typedChars < 1 || typedChars > 100_000) {
      throw new Error("typedChars is outside the accepted range");
    }
    const completedAt = Date.parse(raw.completedAt);
    if (!Number.isFinite(completedAt)) throw new Error("completedAt must be an ISO date");
    if (completedAt > now + MAX_FUTURE_SKEW_MS || completedAt < now - MAX_UPLOAD_AGE_MS) {
      throw new Error("completedAt is outside the accepted upload window");
    }

    const accuracyBps = Math.round(raw.accuracy * 100);
    const wpmBps = Math.round((typedChars / 5 / (raw.durationMs / 60_000)) * 100);
    const peeks = Number.isInteger(raw.peeks) ? raw.peeks : 0;
    if (peeks < 0 || peeks > 100_000) throw new Error("peeks is invalid");
    const plausible = typedChars >= 20 && raw.durationMs >= 1_000 && wpmBps <= 30_000;
    const cleanPass = plausible && peeks === 0 && accuracyBps >= 9_500;
    const completedDay = new Date(completedAt).toISOString().slice(0, 10);
    let challengeDate = null;
    if (raw.challengeDate !== undefined) {
      if (typeof raw.challengeDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.challengeDate)) {
        throw new Error("challengeDate must be a YYYY-MM-DD date");
      }
      if (raw.challengeDate !== completedDay) throw new Error("challengeDate must match the completedAt UTC day");
      challengeDate = raw.challengeDate;
    }
    return {
      ok: true,
      value: {
        clientAttemptId,
        itemId,
        itemRevision: raw.itemRevision,
        itemTitle,
        track,
        stage: raw.stage,
        mode: raw.mode,
        accuracyBps,
        wpmBps,
        durationMs: raw.durationMs,
        typedChars,
        peeks,
        completedAt,
        completedDay,
        challengeDate,
        feedEligible: cleanPass && raw.mode === "strict",
        // Free mode allows arbitrary editing and therefore cannot produce a
        // comparable ranked result. The client cannot override this decision.
        rankingEligible: cleanPass && raw.mode === "strict",
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "invalid attempt" };
  }
}

export function rankItemRows(rows) {
  return [...rows]
    .sort((a, b) =>
      b.stage - a.stage ||
      b.wpmBps - a.wpmBps ||
      b.accuracyBps - a.accuracyBps ||
      a.durationMs - b.durationMs ||
      a.completedAt - b.completedAt,
    )
    .map((row, index) => ({
      rank: index + 1,
      user: { displayName: row.displayName || "Swift learner" },
      stage: row.stage,
      itemRevision: row.itemRevision,
      wpm: row.wpmBps / 100,
      accuracy: row.accuracyBps / 100,
      durationMs: row.durationMs,
      completedAt: new Date(row.completedAt).toISOString(),
    }));
}

export function rankDailyRows(rows) {
  return [...rows]
    .sort((a, b) =>
      b.wpmBps - a.wpmBps ||
      b.averageAccuracyBps - a.averageAccuracyBps ||
      a.totalDurationMs - b.totalDurationMs,
    )
    .map((row, index) => ({
      rank: index + 1,
      user: { displayName: row.displayName || "Swift learner" },
      score: Math.round(row.wpmBps / 100),
      completions: row.completions,
      completed: row.completions,
      wpm: row.wpmBps / 100,
      accuracy: Math.round(row.averageAccuracyBps) / 100,
      averageAccuracy: Math.round(row.averageAccuracyBps) / 100,
      totalDurationMs: row.totalDurationMs,
      minutes: Math.round((row.totalDurationMs / 60_000) * 10) / 10,
      highestStage: row.highestStage,
    }));
}

export function redactCommunityRow(row) {
  return {
    user: { displayName: row.displayName || "Swift learner" },
    itemId: row.itemId,
    itemRevision: row.itemRevision,
    itemTitle: row.itemTitle,
    track: row.track,
    stage: row.stage,
    accuracy: row.accuracyBps / 100,
    wpm: row.wpmBps / 100,
    durationMs: row.durationMs,
    completedAt: new Date(row.completedAt).toISOString(),
  };
}

export function isSameOrigin(requestUrl, origin) {
  if (!origin) return true;
  try {
    return new URL(requestUrl).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

export function deterministicChallenge(date, items) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(items) || items.length === 0) {
    throw new Error("cannot create daily challenge");
  }
  let hash = 2166136261;
  for (const character of date) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const item = items[(hash >>> 0) % items.length];
  return {
    date,
    itemId: item.itemId,
    itemRevision: item.itemRevision,
    itemTitle: item.itemTitle,
    track: item.track,
    stage: 1,
    mode: "strict",
  };
}
