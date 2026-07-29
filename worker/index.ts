/** Cloudflare Worker entry point for Swift Ghost's UI and privacy-safe community API. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { BUILTIN_ITEMS } from "../app/lib/items";
import {
  deterministicChallenge,
  isCurrentDailyChallenge,
  isSameOrigin,
  normalizeProfilePatch,
  rankDailyRows,
  rankItemRows,
  redactCommunityRow,
  validateAttemptUpload,
  validateHandle,
} from "../app/lib/community-core.mjs";
import { normalizeStudyWorkspace } from "../app/lib/study-plans.mjs";
import {
  TRUSTED_ASSESSMENT_PROGRAM,
  TRUSTED_ASSIGNMENT_TTL_MS,
  MAX_TRUSTED_CALLBACK_BYTES,
  TRUSTED_RETENTION_MS,
  cleanTrustedId,
  cleanTrustedSource,
  normalizeTrustedGatewayResult,
  privateJudgeSpec,
  publicTrustedChallenge,
  trustedChallengeForKey,
  trustedChallengeForSequence,
  trustedGatewaySubmission,
} from "./trusted-assessments.mjs";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  TRUSTED_JUDGE_URL?: string;
  TRUSTED_JUDGE_TOKEN?: string;
  TRUSTED_JUDGE_CALLBACK_SECRET?: string;
  TRUSTED_JUDGE_CALLBACK_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function hasCommunityDatabase(env: Env) {
  return Boolean(env.DB);
}

type AuthenticatedUser = {
  email: string;
  fullName: string | null;
  userId: string;
  defaultHandle: string;
};
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
type StudyWorkspaceRow = {
  revision: number;
  payload_json: string;
  updated_at: number;
};
type TrustedAssignmentRow = {
  id: string;
  client_request_id: string;
  request_hash: string;
  program_id: string;
  program_revision: number;
  challenge_key: string;
  content_revision: number;
  judge_revision: number;
  public_payload_json: string;
  status: "active" | "accepted" | "expired";
  assigned_at: number;
  expires_at: number;
  purge_after: number;
  judge_payload_json?: string;
  submission_id?: string | null;
  submission_status?: "pending" | "settled" | null;
  submission_verdict?: TrustedSubmissionVerdict | null;
  submission_result_json?: string | null;
  submission_submitted_at?: number | null;
  submission_settled_at?: number | null;
};
type TrustedSubmissionVerdict =
  | "accepted"
  | "wrong-answer"
  | "runtime-error"
  | "time-limit"
  | "judge-error";
type TrustedSubmissionRow = {
  id: string;
  assignment_id: string;
  client_submission_id: string;
  request_hash: string;
  source_hash: string;
  status: "pending" | "settled";
  verdict: TrustedSubmissionVerdict | null;
  result_json: string | null;
  settlement_hash: string | null;
  submitted_at: number;
  enqueued_at: number | null;
  settled_at: number | null;
};

const API_PREFIX = "/api/v1";
const TRUSTED_JUDGE_CALLBACK_PATH = "/api/internal/judge-results";
const MAX_BATCH = 100;
const MAX_BODY_BYTES = 512_000;
const MAX_STUDY_WORKSPACE_BYTES = 256 * 1024;
const TRUSTED_ENQUEUED_TIMEOUT_MS = 30 * 60 * 1000;
const TRUSTED_DELIVERY_TIMEOUT_MS = 60 * 60 * 1000;
const ITEM_CATALOG = new Map(BUILTIN_ITEMS.map((item) => [item.itemId, item]));
const CHALLENGE_ITEMS = BUILTIN_ITEMS.filter(
  (item) => item.track === "interview" && item.difficulty !== "Hard",
).map((item) => ({
  itemId: item.itemId,
  itemRevision: item.contentRevision,
  itemTitle: item.title,
  track: item.track,
}));

function hasTrustedCallback(env: Env) {
  if (!env.DB) return false;
  const callbackSecret = env.TRUSTED_JUDGE_CALLBACK_SECRET?.trim();
  const callbackUrl = env.TRUSTED_JUDGE_CALLBACK_URL?.trim();
  if (
    !callbackSecret ||
    !callbackUrl ||
    new TextEncoder().encode(callbackSecret).byteLength < 32
  )
    return false;
  try {
    const parsedCallback = new URL(callbackUrl);
    return (
      parsedCallback.protocol === "https:" &&
      !parsedCallback.username &&
      !parsedCallback.password &&
      !parsedCallback.hash &&
      !parsedCallback.search &&
      parsedCallback.pathname === TRUSTED_JUDGE_CALLBACK_PATH
    );
  } catch {
    return false;
  }
}

function hasTrustedJudge(env: Env) {
  if (!hasTrustedCallback(env)) return false;
  const url = env.TRUSTED_JUDGE_URL?.trim();
  const token = env.TRUSTED_JUDGE_TOKEN?.trim();
  if (
    !url ||
    !token ||
    new TextEncoder().encode(token).byteLength < 32
  )
    return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}

function responseHeaders(request: Request, cacheControl = "no-store") {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  });
  const origin = request.headers.get("Origin");
  if (origin && isSameOrigin(request.url, origin))
    headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function json(
  request: Request,
  body: unknown,
  status = 200,
  cacheControl?: string,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request, cacheControl),
  });
}

function errorResponse(
  request: Request,
  status: number,
  code: string,
  message: string,
) {
  return json(request, { error: { code, message } }, status);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexBytes(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/../g) ?? [], (pair) =>
    Number.parseInt(pair, 16)
  );
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1)
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return mismatch === 0;
}

async function trustedCallbackSignature(
  secret: string,
  timestamp: string,
  body: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${body}`),
    ),
  );
}

async function authenticTrustedCallback(
  request: Request,
  body: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
) {
  const timestamp = request.headers.get("x-judge-timestamp");
  const signature = request.headers.get("x-judge-signature");
  if (!timestamp || !signature?.startsWith("sha256=")) return false;
  const numericTimestamp = Number(timestamp);
  if (
    !Number.isSafeInteger(numericTimestamp) ||
    Math.abs(nowSeconds - numericTimestamp) > 300
  )
    return false;
  const provided = hexBytes(signature.slice(7));
  if (!provided) return false;
  const expected = await trustedCallbackSignature(secret, timestamp, body);
  return constantTimeEqual(provided, expected);
}

function optionalFullName(request: Request) {
  if (
    request.headers.get("oai-authenticated-user-full-name-encoding") !==
    "percent-encoded-utf-8"
  )
    return null;
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  if (!encoded) return null;
  try {
    const decoded = decodeURIComponent(encoded).trim().replace(/\s+/g, " ");
    return decoded ? decoded.slice(0, 48) : null;
  } catch {
    return null;
  }
}

async function authenticatedUser(
  request: Request,
): Promise<AuthenticatedUser | null> {
  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return null;
  const digest = await sha256(email);
  return {
    email,
    fullName: optionalFullName(request),
    userId: digest,
    defaultHandle: `swift-${digest.slice(0, 18)}`,
  };
}

async function readJson(request: Request) {
  const contentType = request.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") throw new Error("CONTENT_TYPE");
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES)
    throw new Error("BODY_SIZE");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

async function getProfile(db: D1Database, userId: string) {
  return db
    .prepare(
      `
    SELECT user_id, handle, display_name, bio, timezone, is_public, share_activity,
           show_on_leaderboards, updated_at
    FROM community_profiles
    WHERE user_id = ?
  `,
    )
    .bind(userId)
    .first<ProfileRow>();
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

async function ensurePrivateProfile(
  db: D1Database,
  user: AuthenticatedUser,
  now: number,
) {
  await db
    .prepare(
      `
    INSERT OR IGNORE INTO community_profiles
      (user_id, email, handle, display_name, bio, timezone, is_public, share_activity,
       show_on_leaderboards, created_at, updated_at)
    VALUES (?, ?, ?, ?, NULL, NULL, 0, 0, 0, ?, ?)
  `,
    )
    .bind(user.userId, user.email, user.defaultHandle, user.fullName, now, now)
    .run();
  const row = await getProfile(db, user.userId);
  if (!row) throw new Error("PROFILE_CREATE_FAILED");
  return row;
}

function jsonBytes(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeIncomingStudyWorkspace(
  value: unknown,
  revision: number,
  now: number,
) {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    jsonBytes(value) > MAX_STUDY_WORKSPACE_BYTES
  )
    throw new Error("INVALID_STUDY_WORKSPACE");
  const updatedAt = new Date(now).toISOString();
  const workspace = normalizeStudyWorkspace(
    { ...value, version: 1, revision, updatedAt },
    { now: updatedAt },
  );
  const payloadJson = JSON.stringify(workspace);
  if (
    workspace.version !== 1 ||
    workspace.revision !== revision ||
    workspace.updatedAt !== updatedAt ||
    new TextEncoder().encode(payloadJson).byteLength >
      MAX_STUDY_WORKSPACE_BYTES
  )
    throw new Error("INVALID_STUDY_WORKSPACE");
  return { workspace, payloadJson };
}

async function getStudyWorkspaceRow(db: D1Database, userId: string) {
  return db
    .prepare(
      `
    SELECT revision, payload_json, updated_at
    FROM study_workspaces
    WHERE user_id = ?
  `,
    )
    .bind(userId)
    .first<StudyWorkspaceRow>();
}

function workspaceFromRow(row: StudyWorkspaceRow) {
  if (
    !Number.isInteger(row.revision) ||
    row.revision < 1 ||
    typeof row.payload_json !== "string" ||
    new TextEncoder().encode(row.payload_json).byteLength >
      MAX_STUDY_WORKSPACE_BYTES
  )
    throw new Error("INVALID_STUDY_WORKSPACE_ROW");
  const parsed = JSON.parse(row.payload_json) as unknown;
  const expectedUpdatedAt = new Date(row.updated_at).toISOString();
  const workspace = normalizeStudyWorkspace(parsed, { now: expectedUpdatedAt });
  if (
    workspace.version !== 1 ||
    workspace.revision !== row.revision ||
    workspace.updatedAt !== expectedUpdatedAt
  )
    throw new Error("INVALID_STUDY_WORKSPACE_ROW");
  return workspace;
}

function revisionConflict(
  request: Request,
  row: StudyWorkspaceRow | null,
) {
  const workspace = row ? workspaceFromRow(row) : null;
  return json(
    request,
    {
      error: {
        code: "REVISION_CONFLICT",
        message: "The study workspace changed on another device.",
      },
      current: { revision: row?.revision ?? 0, workspace },
    },
    409,
  );
}

async function getStudyWorkspace(request: Request, env: Env) {
  const user = await authenticatedUser(request);
  if (!user)
    return errorResponse(
      request,
      401,
      "AUTH_REQUIRED",
      "Sign in to sync a study workspace.",
    );
  if (!env.DB)
    return errorResponse(
      request,
      503,
      "STUDY_SYNC_UNAVAILABLE",
      "Study workspace sync is temporarily unavailable.",
    );
  // Deliberately read-only: a signed-in GET never creates a profile row.
  const row = await getStudyWorkspaceRow(env.DB, user.userId);
  return json(request, { workspace: row ? workspaceFromRow(row) : null });
}

async function putStudyWorkspace(request: Request, env: Env) {
  const user = await authenticatedUser(request);
  if (!user)
    return errorResponse(
      request,
      401,
      "AUTH_REQUIRED",
      "Sign in to sync a study workspace.",
    );
  if (!env.DB)
    return errorResponse(
      request,
      503,
      "STUDY_SYNC_UNAVAILABLE",
      "Study workspace sync is temporarily unavailable.",
    );
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_JSON";
    return errorResponse(
      request,
      code === "CONTENT_TYPE" ? 415 : 400,
      code,
      "Send a bounded JSON study workspace.",
    );
  }
  if (!isRecord(body))
    return errorResponse(
      request,
      400,
      "INVALID_STUDY_WORKSPACE",
      "Send a bounded JSON study workspace.",
    );
  const baseRevision = body.baseRevision;
  if (
    !Number.isInteger(baseRevision) ||
    (baseRevision as number) < 0 ||
    (baseRevision as number) > 2_147_483_646
  )
    return errorResponse(
      request,
      400,
      "INVALID_BASE_REVISION",
      "baseRevision must be a non-negative integer.",
    );

  const now = Date.now();
  const expectedRevision = baseRevision as number;
  const nextRevision = expectedRevision + 1;
  let encoded;
  try {
    encoded = normalizeIncomingStudyWorkspace(
      body.workspace,
      nextRevision,
      now,
    );
  } catch {
    return errorResponse(
      request,
      400,
      "INVALID_STUDY_WORKSPACE",
      `The normalized workspace must be at most ${MAX_STUDY_WORKSPACE_BYTES} bytes.`,
    );
  }
  await ensurePrivateProfile(env.DB, user, now);

  if (expectedRevision === 0) {
    const inserted = await env.DB.prepare(
      `
      INSERT INTO study_workspaces (user_id, revision, payload_json, updated_at)
      SELECT ?, 1, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM study_workspaces WHERE user_id = ?)
    `,
    )
      .bind(user.userId, encoded.payloadJson, now, user.userId)
      .run();
    if (Number(inserted.meta.changes) === 0) {
      const current = await getStudyWorkspaceRow(env.DB, user.userId);
      return revisionConflict(request, current);
    }
    return json(request, { workspace: encoded.workspace });
  }

  const updated = await env.DB.prepare(
    `
    UPDATE study_workspaces
    SET revision = revision + 1, payload_json = ?, updated_at = ?
    WHERE user_id = ? AND revision = ?
  `,
  )
    .bind(encoded.payloadJson, now, user.userId, expectedRevision)
    .run();
  if (Number(updated.meta.changes) === 0) {
    const current = await getStudyWorkspaceRow(env.DB, user.userId);
    return revisionConflict(request, current);
  }
  return json(request, { workspace: encoded.workspace });
}

function limitFrom(url: URL, fallback = 25, maximum = 50) {
  const value = Number(url.searchParams.get("limit") ?? fallback);
  return Number.isInteger(value)
    ? Math.max(1, Math.min(maximum, value))
    : fallback;
}

function dateParameter(raw: string | null, fallback: string) {
  const value = raw ?? fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    return null;
  return value;
}

async function getDailyChallenge(
  db: D1Database,
  date: string,
  persist = false,
) {
  const existing = await db
    .prepare(
      `
    SELECT date, item_id AS itemId, item_revision AS itemRevision, item_title AS itemTitle,
           track, stage, mode
    FROM daily_challenges
    WHERE date = ?
  `,
    )
    .bind(date)
    .first<{
      date: string;
      itemId: string;
      itemRevision: number;
      itemTitle: string;
      track: "interview" | "ios";
      stage: number;
      mode: "strict";
    }>();
  const planned = deterministicChallenge(date, CHALLENGE_ITEMS);
  if (existing && isCurrentDailyChallenge(existing, CHALLENGE_ITEMS))
    return existing;
  if (!persist) return planned;

  if (existing) {
    await db
      .prepare(
        `
      UPDATE daily_challenges
      SET item_id = ?, item_revision = ?, item_title = ?, track = ?, stage = ?, mode = ?, created_at = ?
      WHERE date = ?
    `,
      )
      .bind(
        planned.itemId,
        planned.itemRevision,
        planned.itemTitle,
        planned.track,
        planned.stage,
        planned.mode,
        Date.now(),
        planned.date,
      )
      .run();
  } else {
    await db
      .prepare(
        `
    INSERT OR IGNORE INTO daily_challenges
      (date, item_id, item_revision, item_title, track, stage, mode, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
      )
      .bind(
        planned.date,
        planned.itemId,
        planned.itemRevision,
        planned.itemTitle,
        planned.track,
        planned.stage,
        planned.mode,
        Date.now(),
      )
      .run();
  }
  return db
    .prepare(
      `
    SELECT date, item_id AS itemId, item_revision AS itemRevision, item_title AS itemTitle,
           track, stage, mode
    FROM daily_challenges
    WHERE date = ?
  `,
    )
    .bind(date)
    .first<{
      date: string;
      itemId: string;
      itemRevision: number;
      itemTitle: string;
      track: "interview" | "ios";
      stage: number;
      mode: "strict";
    }>();
}

function trustedSubmissionProjection(row: TrustedSubmissionRow | TrustedAssignmentRow) {
  const id = "submission_id" in row ? row.submission_id : row.id;
  const status = "submission_status" in row ? row.submission_status : row.status;
  if (!id || !status) return null;
  const verdict = "submission_verdict" in row ? row.submission_verdict : row.verdict;
  const resultJson = "submission_result_json" in row
    ? row.submission_result_json
    : row.result_json;
  const submittedAt = "submission_submitted_at" in row
    ? row.submission_submitted_at
    : row.submitted_at;
  const settledAt = "submission_settled_at" in row
    ? row.submission_settled_at
    : row.settled_at;
  let result: Record<string, unknown> | null = null;
  if (status === "settled") {
    if (!verdict || !resultJson || !settledAt)
      throw new Error("INVALID_TRUSTED_SUBMISSION_ROW");
    const parsed = JSON.parse(resultJson) as unknown;
    if (!isRecord(parsed)) throw new Error("INVALID_TRUSTED_SUBMISSION_ROW");
    result = parsed;
  }
  return {
    id,
    status,
    verdict: status === "settled" ? verdict : null,
    submittedAt: new Date(Number(submittedAt)).toISOString(),
    settledAt: settledAt ? new Date(Number(settledAt)).toISOString() : null,
    result,
  };
}

function trustedAssignmentProjection(row: TrustedAssignmentRow, now = Date.now()) {
  const publicPayload = JSON.parse(row.public_payload_json) as unknown;
  if (!isRecord(publicPayload)) throw new Error("INVALID_TRUSTED_ASSIGNMENT_ROW");
  if (
    publicPayload.key !== row.challenge_key ||
    publicPayload.contentRevision !== row.content_revision ||
    publicPayload.judgeRevision !== row.judge_revision
  )
    throw new Error("INVALID_TRUSTED_ASSIGNMENT_ROW");
  return {
    id: row.id,
    program: {
      id: row.program_id,
      revision: row.program_revision,
      title: TRUSTED_ASSESSMENT_PROGRAM.title,
      evidenceLabel: TRUSTED_ASSESSMENT_PROGRAM.evidenceLabel,
    },
    challenge: publicPayload,
    status:
      row.status === "active" && now >= row.expires_at
        ? "expired"
        : row.status,
    assignedAt: new Date(row.assigned_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    latestSubmission: trustedSubmissionProjection(row),
  };
}

async function trustedAssignmentByClientRequest(
  db: D1Database,
  userId: string,
  clientRequestId: string,
) {
  return db.prepare(`
    SELECT a.*,
           s.id AS submission_id, s.status AS submission_status,
           s.verdict AS submission_verdict, s.result_json AS submission_result_json,
           s.submitted_at AS submission_submitted_at,
           s.settled_at AS submission_settled_at
    FROM trusted_assignments a
    LEFT JOIN trusted_submissions s ON s.id = (
      SELECT latest.id FROM trusted_submissions latest
      WHERE latest.assignment_id = a.id AND latest.user_id = a.user_id
      ORDER BY latest.submitted_at DESC, latest.id DESC LIMIT 1
    )
    WHERE a.user_id = ? AND a.client_request_id = ?
  `).bind(userId, clientRequestId).first<TrustedAssignmentRow>();
}

async function trustedSubmissionByClientId(
  db: D1Database,
  userId: string,
  clientSubmissionId: string,
) {
  return db.prepare(`
    SELECT id, assignment_id, client_submission_id, request_hash, source_hash,
           status, verdict, result_json, settlement_hash, submitted_at,
           enqueued_at, settled_at
    FROM trusted_submissions
    WHERE user_id = ? AND client_submission_id = ?
  `).bind(userId, clientSubmissionId).first<TrustedSubmissionRow>();
}

async function listTrustedAssignments(request: Request, env: Env, url: URL) {
  const user = await authenticatedUser(request);
  if (!user)
    return errorResponse(
      request,
      401,
      "AUTH_REQUIRED",
      "Sign in to view verified checkpoints.",
    );
  if (!env.DB)
    return errorResponse(
      request,
      503,
      "TRUSTED_ASSESSMENTS_UNAVAILABLE",
      "Verified checkpoints are temporarily unavailable.",
    );
  if (hasTrustedCallback(env))
    await maintainTrustedSubmissions(env.DB);
  const limit = limitFrom(url, 20, 50);
  const rows = await env.DB.prepare(`
    SELECT a.*,
           s.id AS submission_id, s.status AS submission_status,
           s.verdict AS submission_verdict, s.result_json AS submission_result_json,
           s.submitted_at AS submission_submitted_at,
           s.settled_at AS submission_settled_at
    FROM trusted_assignments a
    LEFT JOIN trusted_submissions s ON s.id = (
      SELECT latest.id FROM trusted_submissions latest
      WHERE latest.assignment_id = a.id AND latest.user_id = a.user_id
      ORDER BY latest.submitted_at DESC, latest.id DESC LIMIT 1
    )
    WHERE a.user_id = ?
    ORDER BY a.assigned_at DESC, a.id DESC
    LIMIT ?
  `).bind(user.userId, limit).all<TrustedAssignmentRow>();
  return json(request, {
    program: TRUSTED_ASSESSMENT_PROGRAM,
    entries: rows.results.map((row) => trustedAssignmentProjection(row)),
  });
}

async function issueTrustedAssignment(request: Request, env: Env) {
  const user = await authenticatedUser(request);
  if (!user)
    return errorResponse(
      request,
      401,
      "AUTH_REQUIRED",
      "Sign in to start a verified checkpoint.",
    );
  if (!hasTrustedJudge(env) || !env.DB)
    return errorResponse(
      request,
      503,
      "TRUSTED_ASSESSMENTS_UNAVAILABLE",
      "The isolated judge is not connected.",
    );
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_JSON";
    return errorResponse(
      request,
      code === "CONTENT_TYPE" ? 415 : 400,
      code,
      "Send a bounded JSON request.",
    );
  }
  const clientRequestId = isRecord(body)
    ? cleanTrustedId(body.clientRequestId)
    : null;
  if (!clientRequestId)
    return errorResponse(
      request,
      400,
      "INVALID_REQUEST_ID",
      "Provide a stable client request ID.",
    );
  const requestHash = await sha256(JSON.stringify({
    clientRequestId,
    programId: TRUSTED_ASSESSMENT_PROGRAM.id,
    programRevision: TRUSTED_ASSESSMENT_PROGRAM.revision,
  }));
  const existing = await trustedAssignmentByClientRequest(
    env.DB,
    user.userId,
    clientRequestId,
  );
  if (existing) {
    if (existing.request_hash !== requestHash)
      return errorResponse(
        request,
        409,
        "IDEMPOTENCY_CONFLICT",
        "That request ID belongs to different assignment input.",
      );
    return json(request, { assignment: trustedAssignmentProjection(existing) });
  }

  const now = Date.now();
  await ensurePrivateProfile(env.DB, user, now);
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM trusted_assignments WHERE user_id = ?",
  ).bind(user.userId).first<{ count: number }>();
  const challenge = trustedChallengeForSequence(Number(count?.count ?? 0));
  const publicPayloadJson = JSON.stringify(publicTrustedChallenge(challenge));
  const judgePayloadJson = JSON.stringify(privateJudgeSpec(challenge));
  const assignmentId = `trusted-${crypto.randomUUID().replace(/-/g, "")}`;
  const expiresAt = now + TRUSTED_ASSIGNMENT_TTL_MS;
  const purgeAfter = now + TRUSTED_RETENTION_MS;
  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO trusted_assignments
          (id, user_id, client_request_id, request_hash, program_id,
           program_revision, challenge_key, content_revision, judge_revision,
           public_payload_json, status, assigned_at, expires_at, purge_after)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `).bind(
        assignmentId,
        user.userId,
        clientRequestId,
        requestHash,
        TRUSTED_ASSESSMENT_PROGRAM.id,
        TRUSTED_ASSESSMENT_PROGRAM.revision,
        challenge.key,
        challenge.contentRevision,
        challenge.judgeRevision,
        publicPayloadJson,
        now,
        expiresAt,
        purgeAfter,
      ),
      env.DB.prepare(`
        INSERT INTO trusted_assignment_secrets
          (assignment_id, user_id, judge_payload_json, purge_after)
        VALUES (?, ?, ?, ?)
      `).bind(assignmentId, user.userId, judgePayloadJson, purgeAfter),
    ]);
  } catch (error) {
    const raced = await trustedAssignmentByClientRequest(
      env.DB,
      user.userId,
      clientRequestId,
    );
    if (raced && raced.request_hash === requestHash)
      return json(request, { assignment: trustedAssignmentProjection(raced) });
    throw error;
  }
  const created = await trustedAssignmentByClientRequest(
    env.DB,
    user.userId,
    clientRequestId,
  );
  if (!created) throw new Error("TRUSTED_ASSIGNMENT_CREATE_FAILED");
  return json(
    request,
    { assignment: trustedAssignmentProjection(created) },
    201,
  );
}

async function enqueueTrustedJudge(
  env: Env,
  submissionId: string,
  source: string,
  judgeSpec: unknown,
) {
  if (!hasTrustedJudge(env)) return null;
  let payload: ReturnType<typeof trustedGatewaySubmission>;
  try {
    payload = trustedGatewaySubmission({
      submissionId,
      source,
      judgeSpec: judgeSpec as ReturnType<typeof privateJudgeSpec>,
      callbackUrl: env.TRUSTED_JUDGE_CALLBACK_URL!,
    });
  } catch {
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(env.TRUSTED_JUDGE_URL!, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${env.TRUSTED_JUDGE_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    if (response.status !== 202) return null;
    const text = await response.text();
    if (!text || new TextEncoder().encode(text).byteLength > 1_024) return null;
    const decoded = JSON.parse(text) as unknown;
    return isRecord(decoded) &&
      decoded.submissionId === submissionId &&
      decoded.status === "queued";
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function retryPendingTrustedSubmission(
  env: Env,
  submission: TrustedSubmissionRow,
  userId: string,
) {
  if (!env.DB) return false;
  if (submission.enqueued_at !== null) return true;
  const payload = await env.DB.prepare(`
    SELECT p.source_text, secrets.judge_payload_json
    FROM trusted_submission_payloads p
    JOIN trusted_submissions s
      ON s.id = p.submission_id AND s.user_id = p.user_id
    JOIN trusted_assignments a
      ON a.id = s.assignment_id AND a.user_id = s.user_id
    JOIN trusted_assignment_secrets secrets
      ON secrets.assignment_id = a.id AND secrets.user_id = a.user_id
    WHERE p.submission_id = ? AND p.user_id = ? AND s.status = 'pending'
  `).bind(submission.id, userId).first<{
    source_text: string;
    judge_payload_json: string;
  }>();
  if (!payload) return true;
  let judgeSpec: unknown;
  try {
    judgeSpec = JSON.parse(payload.judge_payload_json);
  } catch {
    return false;
  }
  const queued = await enqueueTrustedJudge(
    env,
    submission.id,
    payload.source_text,
    judgeSpec,
  );
  if (!queued) return false;
  const enqueuedAt = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE trusted_submissions
      SET enqueued_at = ?
      WHERE id = ? AND user_id = ? AND status = 'pending'
        AND enqueued_at IS NULL
    `).bind(enqueuedAt, submission.id, userId),
    env.DB.prepare(
      "DELETE FROM trusted_submission_payloads WHERE submission_id = ? AND user_id = ?",
    ).bind(submission.id, userId),
  ]);
  return true;
}

async function maintainTrustedSubmissions(
  db: D1Database | undefined,
  now = Date.now(),
) {
  if (!db) return;
  try {
    const stale = await db.prepare(`
      SELECT s.id, s.submitted_at, s.enqueued_at,
             a.content_revision, a.judge_revision,
             secrets.judge_payload_json
      FROM trusted_submissions s
      JOIN trusted_assignments a
        ON a.id = s.assignment_id AND a.user_id = s.user_id
      JOIN trusted_assignment_secrets secrets
        ON secrets.assignment_id = a.id AND secrets.user_id = a.user_id
      WHERE s.status = 'pending'
        AND (
          (s.enqueued_at IS NOT NULL AND s.enqueued_at <= ?)
          OR
          (s.enqueued_at IS NULL AND s.submitted_at <= ?)
        )
      ORDER BY s.submitted_at ASC, s.id ASC
      LIMIT 25
    `).bind(
      now - TRUSTED_ENQUEUED_TIMEOUT_MS,
      now - TRUSTED_DELIVERY_TIMEOUT_MS,
    ).all<{
      id: string;
      submitted_at: number;
      enqueued_at: number | null;
      content_revision: number;
      judge_revision: number;
      judge_payload_json: string;
    }>();
    for (const row of stale.results) {
      let judgeSpec: unknown;
      try {
        judgeSpec = JSON.parse(row.judge_payload_json);
      } catch {
        console.error("Invalid judge payload while expiring trusted submission", {
          submissionId: row.id,
        });
        continue;
      }
      if (!isRecord(judgeSpec) || !Array.isArray(judgeSpec.cases))
        continue;
      const settlementHash = await sha256(JSON.stringify({
        version: 1,
        kind: "trusted-judge-timeout",
        submissionId: row.id,
        submittedAt: row.submitted_at,
        enqueuedAt: row.enqueued_at,
      }));
      const resultJson = JSON.stringify({
        passed: 0,
        total: judgeSpec.cases.length,
        authority: "server-isolated-python",
        contentRevision: row.content_revision,
        judgeRevision: row.judge_revision,
        infrastructureFailure: true,
      });
      const stalePredicate = row.enqueued_at === null
        ? "enqueued_at IS NULL AND submitted_at <= ?"
        : "enqueued_at = ? AND enqueued_at <= ?";
      const staleArgs = row.enqueued_at === null
        ? [now - TRUSTED_DELIVERY_TIMEOUT_MS]
        : [row.enqueued_at, now - TRUSTED_ENQUEUED_TIMEOUT_MS];
      const settlement = await db.prepare(`
        UPDATE trusted_submissions
        SET status = 'settled', verdict = 'judge-error', result_json = ?,
            settlement_hash = ?, settled_at = ?
        WHERE id = ? AND status = 'pending' AND ${stalePredicate}
      `).bind(
        resultJson,
        settlementHash,
        now,
        row.id,
        ...staleArgs,
      ).run();
      if ((settlement.meta?.changes ?? 0) > 0) {
        await db.prepare(
          "DELETE FROM trusted_submission_payloads WHERE submission_id = ?",
        ).bind(row.id).run();
      }
    }
    await db.prepare(
      "DELETE FROM trusted_submission_payloads WHERE purge_after <= ?",
    ).bind(now).run();
  } catch (error) {
    console.error(
      "Trusted source payload cleanup failed",
      error instanceof Error ? error.message : error,
    );
  }
}

async function submitTrustedAssignment(
  request: Request,
  env: Env,
  rawAssignmentId: string,
) {
  const user = await authenticatedUser(request);
  if (!user)
    return errorResponse(
      request,
      401,
      "AUTH_REQUIRED",
      "Sign in to submit a verified checkpoint.",
    );
  if (!hasTrustedJudge(env) || !env.DB)
    return errorResponse(
      request,
      503,
      "TRUSTED_ASSESSMENTS_UNAVAILABLE",
      "The isolated judge is not connected.",
    );
  const assignmentId = cleanTrustedId(rawAssignmentId, 96);
  if (!assignmentId)
    return errorResponse(
      request,
      404,
      "ASSIGNMENT_NOT_FOUND",
      "That verified assignment is unavailable.",
    );
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_JSON";
    return errorResponse(
      request,
      code === "CONTENT_TYPE" ? 415 : 400,
      code,
      "Send bounded Python source and a stable submission ID.",
    );
  }
  const clientSubmissionId = isRecord(body)
    ? cleanTrustedId(body.clientSubmissionId)
    : null;
  const source = isRecord(body) ? cleanTrustedSource(body.source) : null;
  if (!clientSubmissionId || !source)
    return errorResponse(
      request,
      400,
      "INVALID_SUBMISSION",
      "Send bounded Python source and a stable submission ID.",
    );
  const sourceHash = await sha256(source);
  const requestHash = await sha256(JSON.stringify({ assignmentId, sourceHash }));
  const replay = await trustedSubmissionByClientId(
    env.DB,
    user.userId,
    clientSubmissionId,
  );
  if (replay) {
    if (
      replay.assignment_id !== assignmentId ||
      replay.request_hash !== requestHash
    )
      return errorResponse(
        request,
        409,
        "IDEMPOTENCY_CONFLICT",
        "That submission ID belongs to different source or assignment input.",
      );
    if (replay.status === "pending") {
      const queued = await retryPendingTrustedSubmission(
        env,
        replay,
        user.userId,
      );
      if (!queued)
        return errorResponse(
          request,
          503,
          "JUDGE_ENQUEUE_UNAVAILABLE",
          "The pending receipt is safe, but the isolated judge could not be reached. Retry with the same source.",
        );
    }
    return json(
      request,
      { submission: trustedSubmissionProjection(replay) },
      replay.status === "pending" ? 202 : 200,
    );
  }

  const assignment = await env.DB.prepare(`
    SELECT a.*, secrets.judge_payload_json
    FROM trusted_assignments a
    JOIN trusted_assignment_secrets secrets
      ON secrets.assignment_id = a.id AND secrets.user_id = a.user_id
    WHERE a.id = ? AND a.user_id = ?
  `).bind(assignmentId, user.userId).first<TrustedAssignmentRow>();
  if (!assignment)
    return errorResponse(
      request,
      404,
      "ASSIGNMENT_NOT_FOUND",
      "That verified assignment is unavailable.",
    );
  const now = Date.now();
  if (now >= assignment.expires_at)
    return errorResponse(
      request,
      409,
      "ASSIGNMENT_EXPIRED",
      "That verified assignment has expired.",
    );
  if (assignment.status !== "active")
    return errorResponse(
      request,
      409,
      "ASSIGNMENT_CLOSED",
      "That verified assignment is already closed.",
    );
  const currentChallenge = trustedChallengeForKey(assignment.challenge_key);
  if (
    !currentChallenge ||
    currentChallenge.contentRevision !== assignment.content_revision ||
    currentChallenge.judgeRevision !== assignment.judge_revision
  )
    return errorResponse(
      request,
      409,
      "ASSIGNMENT_STALE",
      "This assignment no longer matches the current judge revision.",
    );
  let judgeSpec: unknown;
  try {
    judgeSpec = JSON.parse(assignment.judge_payload_json ?? "");
  } catch {
    throw new Error("INVALID_TRUSTED_ASSIGNMENT_SECRET");
  }
  if (!isRecord(judgeSpec) || !Array.isArray(judgeSpec.cases))
    throw new Error("INVALID_TRUSTED_ASSIGNMENT_SECRET");

  const submissionId = `verified-${crypto.randomUUID().replace(/-/g, "")}`;
  const purgeAfter = now + TRUSTED_RETENTION_MS;
  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO trusted_submissions
          (id, assignment_id, user_id, client_submission_id, request_hash,
           source_hash, status, verdict, result_json, submitted_at, settled_at,
           purge_after)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, NULL, ?)
      `).bind(
        submissionId,
        assignmentId,
        user.userId,
        clientSubmissionId,
        requestHash,
        sourceHash,
        now,
        purgeAfter,
      ),
      env.DB.prepare(`
        INSERT INTO trusted_submission_payloads
          (submission_id, user_id, source_text, purge_after)
        VALUES (?, ?, ?, ?)
      `).bind(
        submissionId,
        user.userId,
        source,
        now + 60 * 60 * 1000,
      ),
    ]);
  } catch (error) {
    const raced = await trustedSubmissionByClientId(
      env.DB,
      user.userId,
      clientSubmissionId,
    );
    if (
      raced &&
      raced.assignment_id === assignmentId &&
      raced.request_hash === requestHash
    )
      return json(
        request,
        { submission: trustedSubmissionProjection(raced) },
        raced.status === "pending" ? 202 : 200,
      );
    throw error;
  }

  const queued = await enqueueTrustedJudge(
    env,
    submissionId,
    source,
    judgeSpec,
  );
  if (!queued)
    return errorResponse(
      request,
      503,
      "JUDGE_ENQUEUE_UNAVAILABLE",
      "The pending receipt is safe, but the isolated judge could not be reached. Retry with the same source.",
    );
  const enqueuedAt = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE trusted_submissions
      SET enqueued_at = ?
      WHERE id = ? AND user_id = ? AND status = 'pending'
        AND enqueued_at IS NULL
    `).bind(enqueuedAt, submissionId, user.userId),
    env.DB.prepare(
      "DELETE FROM trusted_submission_payloads WHERE submission_id = ? AND user_id = ?",
    ).bind(submissionId, user.userId),
  ]);
  const pending = await trustedSubmissionByClientId(
    env.DB,
    user.userId,
    clientSubmissionId,
  );
  if (!pending) throw new Error("TRUSTED_SUBMISSION_CREATE_FAILED");
  return json(
    request,
    { submission: trustedSubmissionProjection(pending) },
    202,
  );
}

async function settleTrustedJudgeResult(request: Request, env: Env) {
  if (!hasTrustedCallback(env) || !env.DB)
    return errorResponse(
      request,
      503,
      "TRUSTED_JUDGE_UNAVAILABLE",
      "The trusted judge callback is not configured.",
    );
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json")
    return errorResponse(
      request,
      415,
      "INVALID_CONTENT_TYPE",
      "The judge callback must be JSON.",
    );
  const body = await request.text();
  if (
    !body ||
    new TextEncoder().encode(body).byteLength > MAX_TRUSTED_CALLBACK_BYTES
  )
    return errorResponse(
      request,
      413,
      "INVALID_CALLBACK_SIZE",
      "The judge callback body is outside its protocol bound.",
    );
  const authenticated = await authenticTrustedCallback(
    request,
    body,
    env.TRUSTED_JUDGE_CALLBACK_SECRET!,
  );
  if (!authenticated)
    return errorResponse(
      request,
      401,
      "INVALID_JUDGE_SIGNATURE",
      "The judge callback signature is invalid or stale.",
    );
  let decoded: unknown;
  try {
    decoded = JSON.parse(body) as unknown;
  } catch {
    return errorResponse(
      request,
      400,
      "INVALID_JUDGE_RESULT",
      "The signed callback is not valid JSON.",
    );
  }
  const submissionId = isRecord(decoded)
    ? cleanTrustedId(decoded.submissionId, 160)
    : null;
  if (!submissionId)
    return errorResponse(
      request,
      400,
      "INVALID_JUDGE_RESULT",
      "The signed callback has an invalid submission ID.",
    );
  if (
    request.headers.get("idempotency-key") !==
    `judge-result:${submissionId}`
  )
    return errorResponse(
      request,
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "The judge callback idempotency key is invalid.",
    );
  const row = await env.DB.prepare(`
    SELECT s.id, s.assignment_id, s.user_id, s.status, s.settlement_hash,
           a.content_revision, a.judge_revision, secrets.judge_payload_json
    FROM trusted_submissions s
    JOIN trusted_assignments a
      ON a.id = s.assignment_id AND a.user_id = s.user_id
    JOIN trusted_assignment_secrets secrets
      ON secrets.assignment_id = a.id AND secrets.user_id = a.user_id
    WHERE s.id = ?
  `).bind(submissionId).first<{
    id: string;
    assignment_id: string;
    user_id: string;
    status: "pending" | "settled";
    settlement_hash: string | null;
    content_revision: number;
    judge_revision: number;
    judge_payload_json: string;
  }>();
  if (!row)
    return errorResponse(
      request,
      404,
      "SUBMISSION_NOT_FOUND",
      "That pending trusted submission does not exist.",
    );
  let judgeSpec: unknown;
  try {
    judgeSpec = JSON.parse(row.judge_payload_json);
  } catch {
    throw new Error("INVALID_TRUSTED_ASSIGNMENT_SECRET");
  }
  if (!isRecord(judgeSpec) || !Array.isArray(judgeSpec.cases))
    throw new Error("INVALID_TRUSTED_ASSIGNMENT_SECRET");
  const result = normalizeTrustedGatewayResult(
    decoded,
    submissionId,
    judgeSpec.cases.length,
  );
  if (!result)
    return errorResponse(
      request,
      400,
      "INVALID_JUDGE_RESULT",
      "The signed callback does not match the frozen judge contract.",
    );
  const settlementHash = await sha256(body);
  if (row.status === "settled") {
    if (row.settlement_hash === settlementHash)
      return new Response(null, {
        status: 204,
        headers: responseHeaders(request),
      });
    console.error("Contradictory trusted judge callback", {
      submissionId,
      storedHash: row.settlement_hash,
      receivedHash: settlementHash,
    });
    return errorResponse(
      request,
      409,
      "CONTRADICTORY_JUDGE_RESULT",
      "A different result already settled this submission.",
    );
  }
  const settledAt = Date.now();
  const resultJson = JSON.stringify({
    passed: result.passed,
    total: result.total,
    authority: "server-isolated-python",
    contentRevision: row.content_revision,
    judgeRevision: row.judge_revision,
  });
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE trusted_submissions
      SET status = 'settled', verdict = ?, result_json = ?,
          settlement_hash = ?, settled_at = ?
      WHERE id = ? AND status = 'pending'
    `).bind(
      result.verdict,
      resultJson,
      settlementHash,
      settledAt,
      submissionId,
    ),
    env.DB.prepare(
      "DELETE FROM trusted_submission_payloads WHERE submission_id = ?",
    ).bind(submissionId),
    ...(result.verdict === "accepted"
      ? [
          env.DB.prepare(`
            UPDATE trusted_assignments
            SET status = 'accepted'
            WHERE id = ? AND user_id = ? AND status = 'active'
              AND EXISTS (
                SELECT 1
                FROM trusted_submissions settled
                WHERE settled.id = ? AND settled.user_id = ?
                  AND settled.assignment_id = trusted_assignments.id
                  AND settled.status = 'settled'
                  AND settled.verdict = 'accepted'
                  AND settled.settlement_hash = ?
              )
          `).bind(
            row.assignment_id,
            row.user_id,
            submissionId,
            row.user_id,
            settlementHash,
          ),
        ]
      : []),
  ]);
  const settled = await env.DB.prepare(`
    SELECT status, settlement_hash
    FROM trusted_submissions
    WHERE id = ?
  `).bind(submissionId).first<{
    status: "pending" | "settled";
    settlement_hash: string | null;
  }>();
  if (settled?.status === "settled" && settled.settlement_hash === settlementHash)
    return new Response(null, {
      status: 204,
      headers: responseHeaders(request),
    });
  console.error("Trusted judge settlement lost a contradictory race", {
    submissionId,
    receivedHash: settlementHash,
  });
  return errorResponse(
    request,
    409,
    "CONTRADICTORY_JUDGE_RESULT",
    "A different result already settled this submission.",
  );
}

async function capabilities(request: Request, env: Env) {
  if (hasTrustedCallback(env))
    await maintainTrustedSubmissions(env.DB);
  const authenticated = Boolean(await authenticatedUser(request));
  return json(
    request,
    {
      apiVersion: "v1",
      cloudSync: hasCommunityDatabase(env),
      studySync: hasCommunityDatabase(env),
      community: hasCommunityDatabase(env),
      leaderboards: hasCommunityDatabase(env),
      trustedAssessments: hasTrustedJudge(env),
      auth: authenticated ? "session" : "anonymous",
      maxAttemptBatch: MAX_BATCH,
      privacy: {
        profileDefault: "private",
        activityDefault: "off",
        leaderboardsDefault: "off",
      },
    },
    200,
    "private, max-age=30",
  );
}

async function session(request: Request, env: Env) {
  const user = await authenticatedUser(request);
  if (!user || !env.DB)
    return json(request, { authenticated: false, user: null, profile: null });
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
  if (!env.DB)
    return errorResponse(
      request,
      503,
      "COMMUNITY_UNAVAILABLE",
      "The community service is temporarily unavailable.",
    );
  const user = await authenticatedUser(request);
  if (!user)
    return errorResponse(
      request,
      401,
      "AUTH_REQUIRED",
      "Sign in to update a profile.",
    );
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_JSON";
    return errorResponse(
      request,
      code === "CONTENT_TYPE" ? 415 : 400,
      code,
      "Send a bounded JSON profile object.",
    );
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
    return errorResponse(
      request,
      400,
      "INVALID_PROFILE",
      error instanceof Error ? error.message : "Invalid profile.",
    );
  }

  const collision = await env.DB.prepare(
    `
    SELECT 1 AS found FROM community_profiles WHERE handle = ? AND user_id <> ? LIMIT 1
  `,
  )
    .bind(next.handle, user.userId)
    .first<{ found: number }>();
  if (collision)
    return errorResponse(
      request,
      409,
      "HANDLE_TAKEN",
      "That public handle is already in use.",
    );

  try {
    await env.DB.prepare(
      `
      UPDATE community_profiles
      SET handle = ?, display_name = ?, bio = ?, timezone = ?, is_public = ?, share_activity = ?,
          show_on_leaderboards = ?, updated_at = ?
      WHERE user_id = ?
    `,
    )
      .bind(
        next.handle,
        next.displayName,
        next.bio,
        next.timezone,
        next.isPublic ? 1 : 0,
        next.shareActivity ? 1 : 0,
        next.showOnLeaderboards ? 1 : 0,
        now,
        user.userId,
      )
      .run();
  } catch (error) {
    if (error instanceof Error && /unique|handle/i.test(error.message)) {
      return errorResponse(
        request,
        409,
        "HANDLE_TAKEN",
        "That public handle is already in use.",
      );
    }
    throw error;
  }
  const updated = await getProfile(env.DB, user.userId);
  return json(request, { profile: privateProfile(updated, user) });
}

async function uploadAttempts(request: Request, env: Env) {
  if (!env.DB)
    return errorResponse(
      request,
      503,
      "COMMUNITY_UNAVAILABLE",
      "The community service is temporarily unavailable.",
    );
  const user = await authenticatedUser(request);
  if (!user)
    return errorResponse(
      request,
      401,
      "AUTH_REQUIRED",
      "Sign in to sync completed attempts.",
    );
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_JSON";
    return errorResponse(
      request,
      code === "CONTENT_TYPE" ? 415 : 400,
      code,
      "Send a bounded JSON attempt batch.",
    );
  }
  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as { attempts?: unknown }).attempts)
  ) {
    return errorResponse(
      request,
      400,
      "INVALID_BATCH",
      "attempts must be an array.",
    );
  }
  const attempts = (body as { attempts: unknown[] }).attempts;
  if (attempts.length < 1 || attempts.length > MAX_BATCH) {
    return errorResponse(
      request,
      400,
      "INVALID_BATCH_SIZE",
      `Send between 1 and ${MAX_BATCH} attempts.`,
    );
  }

  const now = Date.now();
  await ensurePrivateProfile(env.DB, user, now);
  const accepted: string[] = [];
  const duplicates: string[] = [];
  const rejected: Array<{ id: string; code: string; message: string }> = [];

  for (const raw of attempts) {
    const fallbackId =
      raw &&
      typeof raw === "object" &&
      typeof (raw as { id?: unknown }).id === "string"
        ? (raw as { id: string }).id.slice(0, 96)
        : "unknown";
    const parsed = validateAttemptUpload(raw, now);
    if (!parsed.ok) {
      rejected.push({
        id: fallbackId,
        code: "INVALID_ATTEMPT",
        message: parsed.error,
      });
      continue;
    }
    const value = parsed.value;
    const canonical = ITEM_CATALOG.get(value.itemId as never);
    if (!canonical || canonical.contentRevision !== value.itemRevision) {
      rejected.push({
        id: value.clientAttemptId,
        code: "STALE_OR_UNKNOWN_ITEM",
        message: "The item or revision is not current.",
      });
      continue;
    }
    if (
      canonical.track !== value.track ||
      canonical.title !== value.itemTitle
    ) {
      rejected.push({
        id: value.clientAttemptId,
        code: "ITEM_METADATA_MISMATCH",
        message: "The item metadata does not match the catalog.",
      });
      continue;
    }

    if (value.challengeDate) {
      const challenge = await getDailyChallenge(
        env.DB,
        value.challengeDate,
        true,
      );
      const matches =
        challenge &&
        challenge.itemId === value.itemId &&
        challenge.itemRevision === value.itemRevision &&
        challenge.stage === value.stage &&
        challenge.mode === value.mode;
      if (!matches) {
        rejected.push({
          id: value.clientAttemptId,
          code: "CHALLENGE_MISMATCH",
          message: "This attempt does not match that day's challenge.",
        });
        continue;
      }
    }

    const id = await sha256(`${user.userId}\n${value.clientAttemptId}`);
    const result = await env.DB.prepare(
      `
      INSERT OR IGNORE INTO community_attempts
        (id, user_id, client_attempt_id, item_id, item_revision, item_title, track, stage, mode,
         accuracy_bps, wpm_bps, duration_ms, typed_chars, peeks, completed_at, completed_day,
         challenge_date, feed_eligible, ranking_eligible, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
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
      )
      .run();
    if (Number(result.meta.changes) > 0) accepted.push(value.clientAttemptId);
    else duplicates.push(value.clientAttemptId);
  }

  return json(request, {
    accepted,
    duplicates,
    rejected,
    serverTime: new Date(now).toISOString(),
  });
}

async function recentCommunity(request: Request, env: Env, url: URL) {
  if (!env.DB)
    return errorResponse(
      request,
      503,
      "COMMUNITY_UNAVAILABLE",
      "The community service is temporarily unavailable.",
    );
  const limit = limitFrom(url);
  const rows = await env.DB.prepare(
    `
    SELECT p.display_name AS displayName, a.item_id AS itemId, a.item_revision AS itemRevision,
           a.item_title AS itemTitle, a.track, a.stage, a.accuracy_bps AS accuracyBps,
           a.wpm_bps AS wpmBps, a.duration_ms AS durationMs, a.completed_at AS completedAt
    FROM community_attempts a
    JOIN community_profiles p ON p.user_id = a.user_id
    WHERE a.feed_eligible = 1 AND p.is_public = 1 AND p.share_activity = 1
    ORDER BY a.completed_at DESC
    LIMIT ?
  `,
  )
    .bind(limit)
    .all<Record<string, unknown>>();
  return json(
    request,
    { entries: rows.results.map((row) => redactCommunityRow(row as never)) },
    200,
    "public, max-age=15",
  );
}

async function itemLeaderboard(
  request: Request,
  env: Env,
  url: URL,
  encodedItemId: string,
) {
  if (!env.DB)
    return errorResponse(
      request,
      503,
      "COMMUNITY_UNAVAILABLE",
      "The community service is temporarily unavailable.",
    );
  let itemId: string;
  try {
    itemId = decodeURIComponent(encodedItemId);
  } catch {
    return errorResponse(
      request,
      400,
      "INVALID_ITEM",
      "The item id is malformed.",
    );
  }
  const item = ITEM_CATALOG.get(itemId as never);
  if (!item)
    return errorResponse(
      request,
      404,
      "ITEM_NOT_FOUND",
      "That built-in item does not exist.",
    );
  const revision = Number(
    url.searchParams.get("itemRevision") ?? item.contentRevision,
  );
  const stage = Number(url.searchParams.get("stage") ?? 1);
  const mode = url.searchParams.get("mode") ?? "strict";
  if (
    !Number.isInteger(revision) ||
    revision !== item.contentRevision ||
    !Number.isInteger(stage) ||
    stage < 1 ||
    stage > 5 ||
    mode !== "strict"
  ) {
    return errorResponse(
      request,
      400,
      "INVALID_RANKING_GROUP",
      "Use the current revision, stage 1–5, and strict mode.",
    );
  }
  const limit = limitFrom(url);
  const rows = await env.DB.prepare(
    `
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
  `,
  )
    .bind(itemId, revision, stage, mode, limit)
    .all<Record<string, unknown>>();
  return json(
    request,
    {
      itemId,
      itemRevision: revision,
      stage,
      mode,
      entries: rankItemRows(rows.results as never),
    },
    200,
    "public, max-age=30",
  );
}

async function dailyLeaderboard(request: Request, env: Env, url: URL) {
  if (!env.DB)
    return errorResponse(
      request,
      503,
      "COMMUNITY_UNAVAILABLE",
      "The community service is temporarily unavailable.",
    );
  const today = new Date().toISOString().slice(0, 10);
  const date = dateParameter(url.searchParams.get("date"), today);
  if (!date)
    return errorResponse(
      request,
      400,
      "INVALID_DATE",
      "Use a real YYYY-MM-DD UTC date.",
    );
  const challenge = await getDailyChallenge(env.DB, date);
  if (!challenge)
    return errorResponse(
      request,
      500,
      "CHALLENGE_UNAVAILABLE",
      "The daily challenge is unavailable.",
    );
  const limit = limitFrom(url);
  const rows = await env.DB.prepare(
    `
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
  `,
  )
    .bind(
      date,
      challenge.itemId,
      challenge.itemRevision,
      challenge.stage,
      challenge.mode,
      limit,
    )
    .all<Record<string, unknown>>();
  const entries = rankDailyRows(rows.results as never);
  return json(request, { date, challenge, entries }, 200, "public, max-age=30");
}

async function publicProfile(request: Request, env: Env, rawHandle: string) {
  if (!env.DB)
    return errorResponse(
      request,
      503,
      "COMMUNITY_UNAVAILABLE",
      "The community service is temporarily unavailable.",
    );
  let handle: string;
  try {
    handle = validateHandle(decodeURIComponent(rawHandle));
  } catch {
    return errorResponse(
      request,
      404,
      "PROFILE_NOT_FOUND",
      "That public profile is unavailable.",
    );
  }
  const profile = await env.DB.prepare(
    `
    SELECT handle, display_name AS displayName, bio,
           (SELECT COUNT(*) FROM community_attempts a
            WHERE a.user_id = p.user_id AND a.ranking_eligible = 1 AND p.share_activity = 1) AS completedAttempts,
           (SELECT MAX(a.stage) FROM community_attempts a
            WHERE a.user_id = p.user_id AND a.ranking_eligible = 1 AND p.share_activity = 1) AS highestStage
    FROM community_profiles p
    WHERE handle = ? AND is_public = 1
  `,
  )
    .bind(handle)
    .first<Record<string, unknown>>();
  if (!profile)
    return errorResponse(
      request,
      404,
      "PROFILE_NOT_FOUND",
      "That public profile is unavailable.",
    );
  return json(
    request,
    {
      profile: {
        handle: profile.handle,
        displayName: profile.displayName || "Swift learner",
        bio: profile.bio,
        stats: {
          completedAttempts: Number(profile.completedAttempts ?? 0),
          highestStage: Number(profile.highestStage ?? 0),
        },
      },
    },
    200,
    "public, max-age=30",
  );
}

async function api(request: Request, env: Env, url: URL) {
  const origin = request.headers.get("Origin");
  if (!isSameOrigin(request.url, origin))
    return errorResponse(
      request,
      403,
      "CROSS_ORIGIN_DENIED",
      "Cross-origin API access is not allowed.",
    );
  if (request.method === "OPTIONS") {
    const headers = responseHeaders(request);
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, PUT, PATCH, POST, OPTIONS",
    );
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "600");
    return new Response(null, { status: 204, headers });
  }

  const path = url.pathname.slice(API_PREFIX.length);
  if (path === "/capabilities" && request.method === "GET")
    return capabilities(request, env);
  if (path === "/session" && request.method === "GET")
    return session(request, env);
  if (path === "/study/workspace" && request.method === "GET")
    return getStudyWorkspace(request, env);
  if (path === "/study/workspace" && request.method === "PUT")
    return putStudyWorkspace(request, env);
  if (path === "/trusted/assignments" && request.method === "GET")
    return listTrustedAssignments(request, env, url);
  if (path === "/trusted/assignments" && request.method === "POST")
    return issueTrustedAssignment(request, env);
  const trustedSubmissionMatch = path.match(
    /^\/trusted\/assignments\/([^/]+)\/submissions$/,
  );
  if (trustedSubmissionMatch && request.method === "POST")
    return submitTrustedAssignment(
      request,
      env,
      trustedSubmissionMatch[1],
    );
  if (path === "/profile" && request.method === "PATCH")
    return updateProfile(request, env);
  if (
    (path === "/attempts/batch" || path === "/attempts") &&
    request.method === "POST"
  )
    return uploadAttempts(request, env);
  if (path === "/community/recent" && request.method === "GET")
    return recentCommunity(request, env, url);
  if (path === "/leaderboards/daily" && request.method === "GET")
    return dailyLeaderboard(request, env, url);
  const itemMatch = path.match(/^\/leaderboards\/items\/(.+)$/);
  if (itemMatch && request.method === "GET")
    return itemLeaderboard(request, env, url, itemMatch[1]);
  const profileMatch = path.match(/^\/profiles\/([^/]+)$/);
  if (profileMatch && request.method === "GET")
    return publicProfile(request, env, profileMatch[1]);
  return errorResponse(
    request,
    404,
    "API_NOT_FOUND",
    "No API route matches this request.",
  );
}

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    // The local Vinext production preview does not provide Worker bindings.
    // Treat that environment like the offline/static edition instead of
    // turning harmless capability checks into repeated 500 responses.
    const runtimeEnv = env ?? ({} as Env);
    if (
      url.pathname === TRUSTED_JUDGE_CALLBACK_PATH &&
      request.method === "POST"
    ) {
      try {
        return await settleTrustedJudgeResult(request, runtimeEnv);
      } catch (error) {
        console.error(
          "Swift Ghost trusted judge callback failure",
          error instanceof Error ? error.message : error,
        );
        return errorResponse(
          request,
          500,
          "JUDGE_CALLBACK_FAILED",
          "The trusted judge result could not be settled.",
        );
      }
    }
    if (
      url.pathname.startsWith(`${API_PREFIX}/`) ||
      url.pathname === API_PREFIX
    ) {
      try {
        return await api(request, runtimeEnv, url);
      } catch (error) {
        console.error(
          "Swift Ghost API failure",
          error instanceof Error ? error.message : error,
        );
        return errorResponse(
          request,
          500,
          "INTERNAL_ERROR",
          "The community service is temporarily unavailable.",
        );
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
