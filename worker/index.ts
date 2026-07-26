/** Cloudflare Worker entry point for Swift Ghost's UI and privacy-safe community API. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { BUILTIN_ITEMS } from "../app/lib/items";
import {
  deterministicChallenge,
  isSameOrigin,
  normalizeProfilePatch,
  rankDailyRows,
  rankItemRows,
  redactCommunityRow,
  validateAttemptUpload,
  validateHandle,
} from "../app/lib/community-core.mjs";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type AuthenticatedUser = { email: string; fullName: string | null; userId: string; defaultHandle: string };
type ProfileRow = {
  user_id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  timezone: string | null;
  is_public: number;
  share_activity: number;
  show_on_leaderboards: number;
  updated_at: number;
};

const API_PREFIX = "/api/v1";
const MAX_BATCH = 100;
const MAX_BODY_BYTES = 512_000;
const ITEM_CATALOG = new Map(BUILTIN_ITEMS.map((item) => [item.itemId, item]));
const CHALLENGE_ITEMS = BUILTIN_ITEMS.filter((item) => item.track === "interview").map((item) => ({
  itemId: item.itemId,
  itemRevision: item.contentRevision,
  itemTitle: item.title,
  track: item.track,
}));

function responseHeaders(request: Request, cacheControl = "no-store") {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
  });
  const origin = request.headers.get("Origin");
  if (origin && isSameOrigin(request.url, origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function json(request: Request, body: unknown, status = 200, cacheControl?: string) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request, cacheControl) });
}

function errorResponse(request: Request, status: number, code: string, message: string) {
  return json(request, { error: { code, message } }, status);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function optionalFullName(request: Request) {
  if (request.headers.get("oai-authenticated-user-full-name-encoding") !== "percent-encoded-utf-8") return null;
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  if (!encoded) return null;
  try {
    const decoded = decodeURIComponent(encoded).trim().replace(/\s+/g, " ");
    return decoded ? decoded.slice(0, 48) : null;
  } catch {
    return null;
  }
}

async function authenticatedUser(request: Request): Promise<AuthenticatedUser | null> {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const digest = await sha256(email);
  return { email, fullName: optionalFullName(request), userId: digest, defaultHandle: `swift-${digest.slice(0, 18)}` };
}

async function readJson(request: Request) {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("CONTENT_TYPE");
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error("BODY_SIZE");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

async function getProfile(db: D1Database, userId: string) {
  return db.prepare(`
    SELECT user_id, handle, display_name, bio, timezone, is_public, share_activity,
           show_on_leaderboards, updated_at
    FROM community_profiles
    WHERE user_id = ?
  `).bind(userId).first<ProfileRow>();
}

function privateProfile(row: ProfileRow | null, user: AuthenticatedUser) {
  const isPublic = Boolean(row?.is_public);
  const shareActivity = isPublic && Boolean(row?.share_activity);
  const showOnLeaderboards = isPublic && Boolean(row?.show_on_leaderboards);
  return {
    handle: row?.handle ?? user.defaultHandle,
    displayName: row?.display_name ?? user.fullName ?? "Swift learner",
    bio: row?.bio ?? null,
    timezone: row?.timezone ?? null,
    isPublic,
    shareActivity,
    showOnLeaderboards,
    shareCommunity: isPublic && shareActivity && showOnLeaderboards,
    updatedAt: row ? new Date(row.updated_at).toISOString() : null,
    persisted: Boolean(row),
  };
}

async function ensurePrivateProfile(db: D1Database, user: AuthenticatedUser, now: number) {
  await db.prepare(`
    INSERT OR IGNORE INTO community_profiles
      (user_id, email, handle, display_name, bio, timezone, is_public, share_activity,
       show_on_leaderboards, created_at, updated_at)
    VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, 0, ?, ?)
  `).bind(user.userId, user.email, user.defaultHandle, user.fullName, now, now).run();
  const row = await getProfile(db, user.userId);
  if (!row) throw new Error("PROFILE_CREATE_FAILED");
  return row;
}

function limitFrom(url: URL, fallback = 25, maximum = 50) {
  const value = Number(url.searchParams.get("limit") ?? fallback);
  return Number.isInteger(value) ? Math.max(1, Math.min(maximum, value)) : fallback;
}

function dateParameter(raw: string | null, fallback: string) {
  const value = raw ?? fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) return null;
  return value;
}

async function getDailyChallenge(db: D1Database, date: string, persist = false) {
  const existing = await db.prepare(`
    SELECT date, item_id AS itemId, item_revision AS itemRevision, item_title AS itemTitle,
           track, stage, mode
    FROM daily_challenges
    WHERE date = ?
  `).bind(date).first<{
    date: string; itemId: string; itemRevision: number; itemTitle: string;
    track: "interview" | "ios"; stage: number; mode: "strict";
  }>();
  if (existing || !persist) return existing ?? deterministicChallenge(date, CHALLENGE_ITEMS);

  const planned = deterministicChallenge(date, CHALLENGE_ITEMS);
  await db.prepare(`
    INSERT OR IGNORE INTO daily_challenges
      (date, item_id, item_revision, item_title, track, stage, mode, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    planned.date,
    planned.itemId,
    planned.itemRevision,
    planned.itemTitle,
    planned.track,
    planned.stage,
    planned.mode,
    Date.now(),
  ).run();
  return db.prepare(`
    SELECT date, item_id AS itemId, item_revision AS itemRevision, item_title AS itemTitle,
           track, stage, mode
    FROM daily_challenges
    WHERE date = ?
  `).bind(date).first<{
    date: string; itemId: string; itemRevision: number; itemTitle: string;
    track: "interview" | "ios"; stage: number; mode: "strict";
  }>();
}

async function capabilities(request: Request) {
  const authenticated = Boolean(await authenticatedUser(request));
  return json(request, {
    apiVersion: "v1",
    cloudSync: true,
    community: true,
    leaderboards: true,
    auth: authenticated ? "session" : "anonymous",
    maxAttemptBatch: MAX_BATCH,
    privacy: { profileDefault: "private", activityDefault: "off", leaderboardsDefault: "off" },
  }, 200, "private, max-age=30");
}

async function session(request: Request, env: Env) {
  const user = await authenticatedUser(request);
  if (!user) return json(request, { authenticated: false, user: null, profile: null });
  // Deliberately read-only: simply loading the app never creates an account row.
  const row = await getProfile(env.DB, user.userId);
  const profile = privateProfile(row, user);
  return json(request, {
    authenticated: true,
    user: { id: user.userId, displayName: profile.displayName },
    profile,
  });
}

async function updateProfile(request: Request, env: Env) {
  const user = await authenticatedUser(request);
  if (!user) return errorResponse(request, 401, "AUTH_REQUIRED", "Sign in to update a profile.");
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_JSON";
    return errorResponse(request, code === "CONTENT_TYPE" ? 415 : 400, code, "Send a bounded JSON profile object.");
  }

  const now = Date.now();
  const existing = await ensurePrivateProfile(env.DB, user, now);
  let next;
  try {
    next = normalizeProfilePatch(body, {
      handle: existing.handle,
      displayName: existing.display_name,
      bio: existing.bio,
      timezone: existing.timezone,
      isPublic: Boolean(existing.is_public),
      shareActivity: Boolean(existing.share_activity),
      showOnLeaderboards: Boolean(existing.show_on_leaderboards),
    });
  } catch (error) {
    return errorResponse(request, 400, "INVALID_PROFILE", error instanceof Error ? error.message : "Invalid profile.");
  }

  const collision = await env.DB.prepare(`
    SELECT 1 AS found FROM community_profiles WHERE handle = ? AND user_id <> ? LIMIT 1
  `).bind(next.handle, user.userId).first<{ found: number }>();
  if (collision) return errorResponse(request, 409, "HANDLE_TAKEN", "That public handle is already in use.");

  try {
    await env.DB.prepare(`
      UPDATE community_profiles
      SET handle = ?, display_name = ?, bio = ?, timezone = ?, is_public = ?, share_activity = ?,
          show_on_leaderboards = ?, updated_at = ?
      WHERE user_id = ?
    `).bind(
      next.handle,
      next.displayName,
      next.bio,
      next.timezone,
      next.isPublic ? 1 : 0,
      next.shareActivity ? 1 : 0,
      next.showOnLeaderboards ? 1 : 0,
      now,
      user.userId,
    ).run();
  } catch (error) {
    if (error instanceof Error && /unique|handle/i.test(error.message)) {
      return errorResponse(request, 409, "HANDLE_TAKEN", "That public handle is already in use.");
    }
    throw error;
  }
  const updated = await getProfile(env.DB, user.userId);
  return json(request, { profile: privateProfile(updated, user) });
}

async function uploadAttempts(request: Request, env: Env) {
  const user = await authenticatedUser(request);
  if (!user) return errorResponse(request, 401, "AUTH_REQUIRED", "Sign in to sync completed attempts.");
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_JSON";
    return errorResponse(request, code === "CONTENT_TYPE" ? 415 : 400, code, "Send a bounded JSON attempt batch.");
  }
  if (!body || typeof body !== "object" || !Array.isArray((body as { attempts?: unknown }).attempts)) {
    return errorResponse(request, 400, "INVALID_BATCH", "attempts must be an array.");
  }
  const attempts = (body as { attempts: unknown[] }).attempts;
  if (attempts.length < 1 || attempts.length > MAX_BATCH) {
    return errorResponse(request, 400, "INVALID_BATCH_SIZE", `Send between 1 and ${MAX_BATCH} attempts.`);
  }

  const now = Date.now();
  await ensurePrivateProfile(env.DB, user, now);
  const accepted: string[] = [];
  const duplicates: string[] = [];
  const rejected: Array<{ id: string; code: string; message: string }> = [];

  for (const raw of attempts) {
    const fallbackId = raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string"
      ? (raw as { id: string }).id.slice(0, 96)
      : "unknown";
    const parsed = validateAttemptUpload(raw, now);
    if (!parsed.ok) {
      rejected.push({ id: fallbackId, code: "INVALID_ATTEMPT", message: parsed.error });
      continue;
    }
    const value = parsed.value;
    const canonical = ITEM_CATALOG.get(value.itemId as never);
    if (!canonical || canonical.contentRevision !== value.itemRevision) {
      rejected.push({ id: value.clientAttemptId, code: "STALE_OR_UNKNOWN_ITEM", message: "The item or revision is not current." });
      continue;
    }
    if (canonical.track !== value.track || canonical.title !== value.itemTitle) {
      rejected.push({ id: value.clientAttemptId, code: "ITEM_METADATA_MISMATCH", message: "The item metadata does not match the catalog." });
      continue;
    }

    if (value.challengeDate) {
      const challenge = await getDailyChallenge(env.DB, value.challengeDate, true);
      const matches = challenge && challenge.itemId === value.itemId &&
        challenge.itemRevision === value.itemRevision && challenge.stage === value.stage && challenge.mode === value.mode;
      if (!matches) {
        rejected.push({ id: value.clientAttemptId, code: "CHALLENGE_MISMATCH", message: "This attempt does not match that day's challenge." });
        continue;
      }
    }

    const id = await sha256(`${user.userId}\n${value.clientAttemptId}`);
    const result = await env.DB.prepare(`
      INSERT OR IGNORE INTO community_attempts
        (id, user_id, client_attempt_id, item_id, item_revision, item_title, track, stage, mode,
         accuracy_bps, wpm_bps, duration_ms, typed_chars, peeks, completed_at, completed_day,
         challenge_date, feed_eligible, ranking_eligible, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      user.userId,
      value.clientAttemptId,
      value.itemId,
      value.itemRevision,
      canonical.title,
      value.track,
      value.stage,
      value.mode,
      value.accuracyBps,
      value.wpmBps,
      value.durationMs,
      value.typedChars,
      value.peeks,
      value.completedAt,
      value.completedDay,
      value.challengeDate,
      value.feedEligible ? 1 : 0,
      value.rankingEligible ? 1 : 0,
      now,
    ).run();
    if (Number(result.meta.changes) > 0) accepted.push(value.clientAttemptId);
    else duplicates.push(value.clientAttemptId);
  }

  return json(request, { accepted, duplicates, rejected, serverTime: new Date(now).toISOString() });
}

async function recentCommunity(request: Request, env: Env, url: URL) {
  const limit = limitFrom(url);
  const rows = await env.DB.prepare(`
    SELECT p.display_name AS displayName, a.item_id AS itemId, a.item_revision AS itemRevision,
           a.item_title AS itemTitle, a.track, a.stage, a.accuracy_bps AS accuracyBps,
           a.wpm_bps AS wpmBps, a.duration_ms AS durationMs, a.completed_at AS completedAt
    FROM community_attempts a
    JOIN community_profiles p ON p.user_id = a.user_id
    WHERE a.feed_eligible = 1 AND p.is_public = 1 AND p.share_activity = 1
    ORDER BY a.completed_at DESC
    LIMIT ?
  `).bind(limit).all<Record<string, unknown>>();
  return json(request, { entries: rows.results.map((row) => redactCommunityRow(row as never)) }, 200, "public, max-age=15");
}

async function itemLeaderboard(request: Request, env: Env, url: URL, encodedItemId: string) {
  let itemId: string;
  try {
    itemId = decodeURIComponent(encodedItemId);
  } catch {
    return errorResponse(request, 400, "INVALID_ITEM", "The item id is malformed.");
  }
  const item = ITEM_CATALOG.get(itemId as never);
  if (!item) return errorResponse(request, 404, "ITEM_NOT_FOUND", "That built-in item does not exist.");
  const revision = Number(url.searchParams.get("itemRevision") ?? item.contentRevision);
  const stage = Number(url.searchParams.get("stage") ?? 1);
  const mode = url.searchParams.get("mode") ?? "strict";
  if (!Number.isInteger(revision) || revision !== item.contentRevision || !Number.isInteger(stage) || stage < 1 || stage > 5 || mode !== "strict") {
    return errorResponse(request, 400, "INVALID_RANKING_GROUP", "Use the current revision, stage 1–5, and strict mode.");
  }
  const limit = limitFrom(url);
  const rows = await env.DB.prepare(`
    WITH candidates AS (
      SELECT p.display_name AS displayName, a.user_id, a.item_revision AS itemRevision, a.stage,
             a.accuracy_bps AS accuracyBps, a.wpm_bps AS wpmBps, a.duration_ms AS durationMs,
             a.completed_at AS completedAt,
             ROW_NUMBER() OVER (
               PARTITION BY a.user_id
               ORDER BY a.wpm_bps DESC, a.accuracy_bps DESC, a.duration_ms ASC, a.completed_at ASC
             ) AS best
      FROM community_attempts a
      JOIN community_profiles p ON p.user_id = a.user_id
      WHERE a.item_id = ? AND a.item_revision = ? AND a.stage = ? AND a.mode = ?
        AND a.ranking_eligible = 1 AND p.is_public = 1 AND p.show_on_leaderboards = 1
    )
    SELECT displayName, itemRevision, stage, accuracyBps, wpmBps, durationMs, completedAt
    FROM candidates
    WHERE best = 1
    ORDER BY wpmBps DESC, accuracyBps DESC, durationMs ASC, completedAt ASC
    LIMIT ?
  `).bind(itemId, revision, stage, mode, limit).all<Record<string, unknown>>();
  return json(request, {
    itemId,
    itemRevision: revision,
    stage,
    mode,
    entries: rankItemRows(rows.results as never),
  }, 200, "public, max-age=30");
}

async function dailyLeaderboard(request: Request, env: Env, url: URL) {
  const today = new Date().toISOString().slice(0, 10);
  const date = dateParameter(url.searchParams.get("date"), today);
  if (!date) return errorResponse(request, 400, "INVALID_DATE", "Use a real YYYY-MM-DD UTC date.");
  const challenge = await getDailyChallenge(env.DB, date);
  if (!challenge) return errorResponse(request, 500, "CHALLENGE_UNAVAILABLE", "The daily challenge is unavailable.");
  const limit = limitFrom(url);
  const rows = await env.DB.prepare(`
    WITH candidates AS (
      SELECT p.display_name AS displayName, a.user_id, a.accuracy_bps AS averageAccuracyBps,
             a.duration_ms AS totalDurationMs, a.stage AS highestStage, a.wpm_bps AS wpmBps,
             ROW_NUMBER() OVER (
               PARTITION BY a.user_id
               ORDER BY a.wpm_bps DESC, a.accuracy_bps DESC, a.duration_ms ASC, a.completed_at ASC
             ) AS best
      FROM community_attempts a
      JOIN community_profiles p ON p.user_id = a.user_id
      WHERE a.challenge_date = ? AND a.item_id = ? AND a.item_revision = ? AND a.stage = ? AND a.mode = ?
        AND a.ranking_eligible = 1 AND p.is_public = 1 AND p.show_on_leaderboards = 1
    )
    SELECT displayName, 1 AS completions, averageAccuracyBps, totalDurationMs, highestStage, wpmBps
    FROM candidates
    WHERE best = 1
    ORDER BY wpmBps DESC, averageAccuracyBps DESC, totalDurationMs ASC
    LIMIT ?
  `).bind(date, challenge.itemId, challenge.itemRevision, challenge.stage, challenge.mode, limit).all<Record<string, unknown>>();
  const entries = rankDailyRows(rows.results as never);
  return json(request, { date, challenge, entries }, 200, "public, max-age=30");
}

async function publicProfile(request: Request, env: Env, rawHandle: string) {
  let handle: string;
  try {
    handle = validateHandle(decodeURIComponent(rawHandle));
  } catch {
    return errorResponse(request, 404, "PROFILE_NOT_FOUND", "That public profile is unavailable.");
  }
  const profile = await env.DB.prepare(`
    SELECT handle, display_name AS displayName, bio,
           (SELECT COUNT(*) FROM community_attempts a
            WHERE a.user_id = p.user_id AND a.ranking_eligible = 1 AND p.share_activity = 1) AS completedAttempts,
           (SELECT MAX(a.stage) FROM community_attempts a
            WHERE a.user_id = p.user_id AND a.ranking_eligible = 1 AND p.share_activity = 1) AS highestStage
    FROM community_profiles p
    WHERE handle = ? AND is_public = 1
  `).bind(handle).first<Record<string, unknown>>();
  if (!profile) return errorResponse(request, 404, "PROFILE_NOT_FOUND", "That public profile is unavailable.");
  return json(request, {
    profile: {
      handle: profile.handle,
      displayName: profile.displayName || "Swift learner",
      bio: profile.bio,
      stats: {
        completedAttempts: Number(profile.completedAttempts ?? 0),
        highestStage: Number(profile.highestStage ?? 0),
      },
    },
  }, 200, "public, max-age=30");
}

async function api(request: Request, env: Env, url: URL) {
  const origin = request.headers.get("Origin");
  if (!isSameOrigin(request.url, origin)) return errorResponse(request, 403, "CROSS_ORIGIN_DENIED", "Cross-origin API access is not allowed.");
  if (request.method === "OPTIONS") {
    const headers = responseHeaders(request);
    headers.set("Access-Control-Allow-Methods", "GET, PATCH, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "600");
    return new Response(null, { status: 204, headers });
  }

  const path = url.pathname.slice(API_PREFIX.length);
  if (path === "/capabilities" && request.method === "GET") return capabilities(request);
  if (path === "/session" && request.method === "GET") return session(request, env);
  if (path === "/profile" && request.method === "PATCH") return updateProfile(request, env);
  if ((path === "/attempts/batch" || path === "/attempts") && request.method === "POST") return uploadAttempts(request, env);
  if (path === "/community/recent" && request.method === "GET") return recentCommunity(request, env, url);
  if (path === "/leaderboards/daily" && request.method === "GET") return dailyLeaderboard(request, env, url);
  const itemMatch = path.match(/^\/leaderboards\/items\/(.+)$/);
  if (itemMatch && request.method === "GET") return itemLeaderboard(request, env, url, itemMatch[1]);
  const profileMatch = path.match(/^\/profiles\/([^/]+)$/);
  if (profileMatch && request.method === "GET") return publicProfile(request, env, profileMatch[1]);
  return errorResponse(request, 404, "API_NOT_FOUND", "No API route matches this request.");
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith(`${API_PREFIX}/`) || url.pathname === API_PREFIX) {
      try {
        return await api(request, env, url);
      } catch (error) {
        console.error("Swift Ghost API failure", error instanceof Error ? error.message : error);
        return errorResponse(request, 500, "INTERNAL_ERROR", "The community service is temporarily unavailable.");
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
