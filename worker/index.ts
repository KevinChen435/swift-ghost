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
import { normalizeProgressSnapshot } from "../app/lib/progress-sync.mjs";
import {
  TRUSTED_CODE_LAB_PROGRAM,
  TRUSTED_ASSIGNMENT_TTL_MS,
  MAX_TRUSTED_CALLBACK_BYTES,
  TRUSTED_RETENTION_MS,
  cleanTrustedId,
  cleanTrustedSource,
  normalizeTrustedGatewayResult,
  normalizeTrustedGatewayExampleResult,
  normalizeTrustedPublicCaseResults,
  privateJudgeSpec,
  publicExampleJudgeSpec,
  customJudgeSpec,
  normalizeTrustedCustomCases,
  normalizeTrustedCustomCaseResults,
  trustedGatewayExecution,
  publicTrustedChallenge,
  trustedChallengeForKey,
  trustedChallengeForSequence,
  trustedGatewaySubmission,
  trustedJudgeContractDigest,
  trustedProgramForId,
  trustedProgramForLanguage,
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
type ProgressSnapshotRow = {
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
  submission_client_id?: string | null;
  submission_status?: "pending" | "settled" | null;
  submission_verdict?: TrustedSubmissionVerdict | null;
  submission_result_json?: string | null;
  submission_submitted_at?: number | null;
  submission_settled_at?: number | null;
};
type TrustedSubmissionVerdict =
  | "accepted"
  | "wrong-answer"
  | "compile-error"
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
type TrustedExampleRunRow = {
  id: string;
  assignment_id: string;
  user_id: string;
  client_run_id: string;
  request_hash: string;
  source_hash: string;
  status: "pending" | "settled";
  verdict: TrustedSubmissionVerdict | null;
  result_json: string | null;
  settlement_hash: string | null;
  requested_at: number;
  enqueued_at: number | null;
  settled_at: number | null;
};
type TrustedCustomRunRow = {
  id: string;
  assignment_id: string;
  user_id: string;
  client_run_id: string;
  request_hash: string;
  source_hash: string;
  contract_digest: string;
  case_ids_json: string;
  case_names_json: string;
  status: "pending" | "settled";
  verdict: TrustedSubmissionVerdict | null;
  result_json: string | null;
  settlement_hash: string | null;
  requested_at: number;
  enqueued_at: number | null;
  settled_at: number | null;
};

const API_PREFIX = "/api/v1";
const TRUSTED_JUDGE_CALLBACK_PATH = "/api/internal/judge-results";
const MAX_BATCH = 100;
const MAX_BODY_BYTES = 512_000;
const MAX_STUDY_WORKSPACE_BYTES = 256 * 1024;
const MAX_PROGRESS_SYNC_BYTES = 256 * 1024;
const TRUSTED_ENQUEUED_TIMEOUT_MS = 30 * 60 * 1000;
const TRUSTED_DELIVERY_TIMEOUT_MS = 60 * 60 * 1000;
const TRUSTED_EXAMPLE_MAX_PENDING_PER_USER = 3;
const TRUSTED_CUSTOM_MAX_PENDING_PER_USER = 3;
const TRUSTED_CUSTOM_MAX_CASES = 12;
const TRUSTED_CUSTOM_CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/;

function cleanTrustedCustomCaseId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return TRUSTED_CUSTOM_CASE_ID.test(normalized) ? normalized : null;
}
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

function normalizeIncomingProgressSnapshot(
  value: unknown,
  revision: number,
  now: number,
) {
  if (!isRecord(value) || jsonBytes(value) > MAX_PROGRESS_SYNC_BYTES)
    throw new Error("INVALID_PROGRESS_SNAPSHOT");
  const updatedAt = new Date(now).toISOString();
  const snapshot = normalizeProgressSnapshot(
    { ...value, version: 1, revision, updatedAt },
    { now: updatedAt, validItemIds: [...ITEM_CATALOG.keys()] },
  );
  if (
    !snapshot ||
    snapshot.version !== 1 ||
    snapshot.revision !== revision ||
    snapshot.updatedAt !== updatedAt
  )
    throw new Error("INVALID_PROGRESS_SNAPSHOT");
  const payloadJson = JSON.stringify(snapshot);
  if (new TextEncoder().encode(payloadJson).byteLength > MAX_PROGRESS_SYNC_BYTES)
    throw new Error("INVALID_PROGRESS_SNAPSHOT");
  return { snapshot, payloadJson };
}

async function getProgressSnapshotRow(db: D1Database, userId: string) {
  return db
    .prepare(
      `
    SELECT revision, payload_json, updated_at
    FROM progress_snapshots
    WHERE user_id = ?
  `,
    )
    .bind(userId)
    .first<ProgressSnapshotRow>();
}

function progressSnapshotFromRow(row: ProgressSnapshotRow) {
  if (
    !Number.isInteger(row.revision) ||
    row.revision < 1 ||
    typeof row.payload_json !== "string" ||
    new TextEncoder().encode(row.payload_json).byteLength > MAX_PROGRESS_SYNC_BYTES
  )
    throw new Error("INVALID_PROGRESS_SNAPSHOT_ROW");
  const parsed = JSON.parse(row.payload_json) as unknown;
  const expectedUpdatedAt = new Date(row.updated_at).toISOString();
  const snapshot = normalizeProgressSnapshot(parsed, {
    now: expectedUpdatedAt,
    validItemIds: [...ITEM_CATALOG.keys()],
  });
  if (
    !snapshot ||
    snapshot.version !== 1 ||
    snapshot.revision !== row.revision ||
    snapshot.updatedAt !== expectedUpdatedAt
  )
    throw new Error("INVALID_PROGRESS_SNAPSHOT_ROW");
  return snapshot;
}

function progressRevisionConflict(
  request: Request,
  row: ProgressSnapshotRow | null,
) {
  const snapshot = row ? progressSnapshotFromRow(row) : null;
  return json(
    request,
    {
      error: {
        code: "PROGRESS_REVISION_CONFLICT",
        message: "Your private progress changed on another device.",
      },
      current: { revision: row?.revision ?? 0, snapshot },
    },
    409,
  );
}

async function getProgressSnapshot(request: Request, env: Env) {
  const user = await authenticatedUser(request);
  if (!user)
    return errorResponse(
      request,
      401,
      "AUTH_REQUIRED",
      "Sign in to sync private learning progress.",
    );
  if (!env.DB)
    return errorResponse(
      request,
      503,
      "PROGRESS_SYNC_UNAVAILABLE",
      "Private progress sync is temporarily unavailable.",
    );
  const row = await getProgressSnapshotRow(env.DB, user.userId);
  return json(request, { snapshot: row ? progressSnapshotFromRow(row) : null });
}

async function putProgressSnapshot(request: Request, env: Env) {
  const user = await authenticatedUser(request);
  if (!user)
    return errorResponse(
      request,
      401,
      "AUTH_REQUIRED",
      "Sign in to sync private learning progress.",
    );
  if (!env.DB)
    return errorResponse(
      request,
      503,
      "PROGRESS_SYNC_UNAVAILABLE",
      "Private progress sync is temporarily unavailable.",
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
      "Send a bounded private progress snapshot.",
    );
  }
  if (!isRecord(body))
    return errorResponse(
      request,
      400,
      "INVALID_PROGRESS_SNAPSHOT",
      "Send a bounded private progress snapshot.",
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
  const expectedRevision = baseRevision as number;
  let encoded;
  const now = Date.now();
  try {
    encoded = normalizeIncomingProgressSnapshot(
      body.snapshot,
      expectedRevision + 1,
      now,
    );
  } catch {
    return errorResponse(
      request,
      400,
      "INVALID_PROGRESS_SNAPSHOT",
      `The normalized progress snapshot must be at most ${MAX_PROGRESS_SYNC_BYTES} bytes.`,
    );
  }
  await ensurePrivateProfile(env.DB, user, now);
  if (expectedRevision === 0) {
    const inserted = await env.DB.prepare(
      `
      INSERT INTO progress_snapshots (user_id, revision, payload_json, updated_at)
      SELECT ?, 1, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM progress_snapshots WHERE user_id = ?)
    `,
    )
      .bind(user.userId, encoded.payloadJson, now, user.userId)
      .run();
    if (Number(inserted.meta.changes) === 0) {
      const current = await getProgressSnapshotRow(env.DB, user.userId);
      return progressRevisionConflict(request, current);
    }
    return json(request, { snapshot: encoded.snapshot });
  }
  const updated = await env.DB.prepare(
    `
    UPDATE progress_snapshots
    SET revision = revision + 1, payload_json = ?, updated_at = ?
    WHERE user_id = ? AND revision = ?
  `,
  )
    .bind(encoded.payloadJson, now, user.userId, expectedRevision)
    .run();
  if (Number(updated.meta.changes) === 0) {
    const current = await getProgressSnapshotRow(env.DB, user.userId);
    return progressRevisionConflict(request, current);
  }
  return json(request, { snapshot: encoded.snapshot });
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
  const verdict = "submission_verdict" in row
    ? row.submission_verdict
    : "verdict" in row
      ? row.verdict
      : null;
  const resultJson = "submission_result_json" in row
    ? row.submission_result_json
    : "result_json" in row
      ? row.result_json
      : null;
  const submittedAt = "submission_submitted_at" in row
    ? row.submission_submitted_at
    : "submitted_at" in row
      ? row.submitted_at
      : null;
  const settledAt = "submission_settled_at" in row
    ? row.submission_settled_at
      : "settled_at" in row
        ? row.settled_at
        : null;
  const clientSubmissionId = "client_submission_id" in row
    ? row.client_submission_id
    : "submission_client_id" in row
      ? row.submission_client_id
      : null;
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
    ...(clientSubmissionId ? { clientSubmissionId } : {}),
    status,
    verdict: status === "settled" ? verdict : null,
    submittedAt: new Date(Number(submittedAt)).toISOString(),
    settledAt: settledAt ? new Date(Number(settledAt)).toISOString() : null,
    result,
  };
}

function trustedExampleAuthority(language: "python" | "swift") {
  return language === "swift"
    ? "server-isolated-swift"
    : "server-isolated-python";
}

function trustedExampleContract(
  challenge: ReturnType<typeof trustedChallengeForKey>,
) {
  if (
    !challenge ||
    (challenge.language !== "python" && challenge.language !== "swift")
  )
    return null;
  const judgeSpec = publicExampleJudgeSpec(challenge);
  if (
    !judgeSpec ||
    judgeSpec.language !== challenge.language ||
    typeof judgeSpec.runtime !== "string" ||
    !Array.isArray(judgeSpec.cases) ||
    judgeSpec.cases.length < 1
  )
    return null;
  return {
    challenge,
    judgeSpec,
    authority: trustedExampleAuthority(judgeSpec.language),
  };
}

function trustedExampleRunProjection(
  row: TrustedExampleRunRow,
  challenge?: ReturnType<typeof trustedChallengeForKey>,
) {
  let result: Record<string, unknown> | null = null;
  if (row.status === "settled") {
    if (!row.verdict || !row.result_json || !row.settled_at)
      throw new Error("INVALID_TRUSTED_EXAMPLE_RUN_ROW");
    const contract = trustedExampleContract(challenge ?? null);
    if (!contract) throw new Error("INVALID_TRUSTED_EXAMPLE_RUN_ROW");
    const parsed = JSON.parse(row.result_json) as unknown;
    if (!isRecord(parsed)) throw new Error("INVALID_TRUSTED_EXAMPLE_RUN_ROW");
    const publicCaseIds = contract.judgeSpec.cases.map((testCase) => testCase.id);
    const publicCaseResults = normalizeTrustedPublicCaseResults(parsed, publicCaseIds);
    if (publicCaseResults === null)
      throw new Error("INVALID_TRUSTED_EXAMPLE_RUN_ROW");
    const passed = typeof parsed.passed === "number" && Number.isInteger(parsed.passed)
      ? parsed.passed
      : null;
    const total = Number.isInteger(parsed.total) &&
        parsed.total === contract.judgeSpec.cases.length
      ? parsed.total
      : null;
    // These values are checked against the frozen server contract, then the
    // projection emits the contract values rather than trusting persisted
    // callback metadata. This keeps Python and Swift example runs equally
    // bound to the challenge selected by the assignment.
    const authority = parsed.authority === contract.authority
      ? contract.authority
      : null;
    const language = parsed.language === contract.judgeSpec.language
      ? contract.judgeSpec.language
      : null;
    const runtime = parsed.runtime === contract.judgeSpec.runtime
      ? contract.judgeSpec.runtime
      : null;
    const contentRevision = parsed.contentRevision === contract.judgeSpec.contentRevision
      ? contract.judgeSpec.contentRevision
      : null;
    const judgeRevision = parsed.judgeRevision === contract.judgeSpec.judgeRevision
      ? contract.judgeSpec.judgeRevision
      : null;
    const contractDigest = typeof parsed.contractDigest === "string"
      ? parsed.contractDigest
      : null;
    const rawFailedCaseIndex = parsed.failedCaseIndex;
    const failedCaseIndex = rawFailedCaseIndex === undefined
      ? null
      : typeof rawFailedCaseIndex === "number" &&
          Number.isInteger(rawFailedCaseIndex) &&
          rawFailedCaseIndex >= 0 &&
          rawFailedCaseIndex < contract.judgeSpec.cases.length
        ? rawFailedCaseIndex
        : null;
    const diagnostic = typeof parsed.diagnostic === "string"
      ? parsed.diagnostic.slice(0, 2_000)
      : null;
    if (
      passed === null ||
      total === null ||
      authority === null ||
      language === null ||
      runtime === null ||
      contentRevision === null ||
      judgeRevision === null ||
      contractDigest === null
    )
      throw new Error("INVALID_TRUSTED_EXAMPLE_RUN_ROW");
    result = {
      passed,
      total,
      authority,
      language,
      runtime,
      contentRevision,
      judgeRevision,
      contractDigest,
      ...(diagnostic ? { diagnostic } : {}),
      ...(failedCaseIndex !== null ? { failedCaseIndex } : {}),
      ...(failedCaseIndex !== null && contract.judgeSpec.cases[failedCaseIndex]
        ? { failedCaseId: contract.judgeSpec.cases[failedCaseIndex].id }
        : {}),
      ...(publicCaseResults === undefined ? {} : { publicCaseResults }),
    };
  }
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    clientRunId: row.client_run_id,
    status: row.status,
    verdict: row.status === "settled" ? row.verdict : null,
    requestedAt: new Date(row.requested_at).toISOString(),
    settledAt: row.settled_at ? new Date(row.settled_at).toISOString() : null,
    result,
  };
}

function trustedCustomCaseIds(row: TrustedCustomRunRow) {
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.case_ids_json);
  } catch {
    return null;
  }
  if (
    !Array.isArray(decoded) ||
    decoded.length < 1 ||
    decoded.length > TRUSTED_CUSTOM_MAX_CASES ||
    decoded.some((id) => !cleanTrustedCustomCaseId(id)) ||
    new Set(decoded).size !== decoded.length
  )
    return null;
  return decoded as string[];
}

function trustedCustomCaseNames(row: TrustedCustomRunRow, count: number) {
  let decoded: unknown;
  try {
    decoded = JSON.parse(row.case_names_json);
  } catch {
    return null;
  }
  if (!Array.isArray(decoded) || decoded.length !== count ||
      decoded.some((name) => typeof name !== "string" || name.length < 1 || name.length > 120))
    return null;
  return decoded as string[];
}

function trustedCustomRunProjection(
  row: TrustedCustomRunRow,
  challenge?: ReturnType<typeof trustedChallengeForKey>,
) {
  let result: Record<string, unknown> | null = null;
  const caseIds = trustedCustomCaseIds(row);
  const caseNames = caseIds ? trustedCustomCaseNames(row, caseIds.length) : null;
  if (!caseIds || !caseNames || !challenge || challenge.language !== "swift")
    throw new Error("INVALID_TRUSTED_CUSTOM_RUN_ROW");
  if (row.status === "settled") {
    if (!row.verdict || !row.result_json || !row.settled_at)
      throw new Error("INVALID_TRUSTED_CUSTOM_RUN_ROW");
    const parsed = JSON.parse(row.result_json) as unknown;
    if (!isRecord(parsed)) throw new Error("INVALID_TRUSTED_CUSTOM_RUN_ROW");
    const publicCaseResults = normalizeTrustedCustomCaseResults(parsed, caseIds);
    if (!publicCaseResults) throw new Error("INVALID_TRUSTED_CUSTOM_RUN_ROW");
    const passed = typeof parsed.passed === "number" && Number.isInteger(parsed.passed)
      ? parsed.passed
      : null;
    const total = Number.isInteger(parsed.total) && parsed.total === caseIds.length
      ? parsed.total
      : null;
    const authority = parsed.authority === "server-isolated-swift"
      ? "server-isolated-swift"
      : null;
    const language = parsed.language === "swift" ? "swift" : null;
    const runtime = parsed.runtime === challenge.runtime ? challenge.runtime : null;
    const contentRevision = parsed.contentRevision === challenge.contentRevision
      ? challenge.contentRevision
      : null;
    const judgeRevision = parsed.judgeRevision === challenge.judgeRevision
      ? challenge.judgeRevision
      : null;
    const contractDigest = parsed.contractDigest === row.contract_digest
      ? row.contract_digest
      : null;
    const rawFailedCaseIndex = parsed.failedCaseIndex;
    const failedCaseIndex = rawFailedCaseIndex === undefined
      ? null
      : typeof rawFailedCaseIndex === "number" &&
          Number.isInteger(rawFailedCaseIndex) &&
          rawFailedCaseIndex >= 0 &&
          rawFailedCaseIndex < caseIds.length
        ? rawFailedCaseIndex
        : null;
    const diagnostic = typeof parsed.diagnostic === "string"
      ? parsed.diagnostic.slice(0, 2_000)
      : null;
    if (
      passed === null || passed < 0 || passed > caseIds.length || total === null ||
      authority === null || language === null || runtime === null ||
      contentRevision === null || judgeRevision === null || contractDigest === null
    )
      throw new Error("INVALID_TRUSTED_CUSTOM_RUN_ROW");
    result = {
      passed,
      total,
      authority,
      language,
      runtime,
      contentRevision,
      judgeRevision,
      contractDigest,
      ...(diagnostic ? { diagnostic } : {}),
      ...(failedCaseIndex !== null ? { failedCaseIndex, failedCaseId: caseIds[failedCaseIndex] } : {}),
      cases: publicCaseResults.map((entry, index) => ({
        ...entry,
        name: caseNames[index],
      })),
    };
  }
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    clientRunId: row.client_run_id,
    status: row.status,
    verdict: row.status === "settled" ? row.verdict : null,
    requestedAt: new Date(row.requested_at).toISOString(),
    settledAt: row.settled_at ? new Date(row.settled_at).toISOString() : null,
    result,
  };
}

function trustedAssignmentProjection(row: TrustedAssignmentRow, now = Date.now()) {
  const publicPayload = JSON.parse(row.public_payload_json) as unknown;
  const program = trustedProgramForId(row.program_id);
  if (!isRecord(publicPayload)) throw new Error("INVALID_TRUSTED_ASSIGNMENT_ROW");
  if (
    !program ||
    row.program_revision !== program.revision ||
    publicPayload.key !== row.challenge_key ||
    (publicPayload.language ?? "python") !== program.language ||
    publicPayload.contentRevision !== row.content_revision ||
    publicPayload.judgeRevision !== row.judge_revision
  )
    throw new Error("INVALID_TRUSTED_ASSIGNMENT_ROW");
  return {
    id: row.id,
    program: {
      id: row.program_id,
      revision: row.program_revision,
      title: program.title,
      evidenceLabel: program.evidenceLabel,
      language: program.language,
    },
    challenge: {
      ...publicPayload,
      language: publicPayload.language ?? program.language,
      runtime:
        publicPayload.runtime ??
        (program.language === "swift"
          ? "swift-6.3.3-linux"
          : "python-3.13-linux"),
    },
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
           s.id AS submission_id, s.client_submission_id AS submission_client_id,
           s.status AS submission_status,
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

async function trustedExampleRunByClientId(
  db: D1Database,
  userId: string,
  clientRunId: string,
) {
  return db.prepare(`
    SELECT id, assignment_id, user_id, client_run_id, request_hash, source_hash,
           status, verdict, result_json, settlement_hash, requested_at,
           enqueued_at, settled_at
    FROM trusted_example_runs
    WHERE user_id = ? AND client_run_id = ?
  `).bind(userId, clientRunId).first<TrustedExampleRunRow>();
}

async function trustedCustomRunByClientId(
  db: D1Database,
  userId: string,
  clientRunId: string,
) {
  return db.prepare(`
    SELECT id, assignment_id, user_id, client_run_id, request_hash, source_hash,
           contract_digest, case_ids_json, status, verdict, result_json,
           case_names_json,
           settlement_hash, requested_at, enqueued_at, settled_at
    FROM trusted_custom_runs
    WHERE user_id = ? AND client_run_id = ?
  `).bind(userId, clientRunId).first<TrustedCustomRunRow>();
}

async function retryPendingTrustedExampleRun(
  env: Env,
  run: TrustedExampleRunRow,
  userId: string,
) {
  if (!env.DB) return false;
  if (run.enqueued_at !== null) return true;
  const payload = await env.DB.prepare(`
    SELECT p.source_text, a.challenge_key, a.content_revision, a.judge_revision
    FROM trusted_example_run_payloads p
    JOIN trusted_example_runs r
      ON r.id = p.run_id AND r.user_id = p.user_id
    JOIN trusted_assignments a
      ON a.id = r.assignment_id AND a.user_id = r.user_id
    WHERE p.run_id = ? AND p.user_id = ? AND r.status = 'pending'
  `).bind(run.id, userId).first<{
    source_text: string;
    challenge_key: string;
    content_revision: number;
    judge_revision: number;
  }>();
  if (!payload) return true;
  const challenge = trustedChallengeForKey(payload.challenge_key);
  if (!challenge) return false;
  const contract = trustedExampleContract(challenge);
  if (
    !contract ||
    contract.challenge.contentRevision !== payload.content_revision ||
    contract.challenge.judgeRevision !== payload.judge_revision
  )
    return false;
  const queued = await enqueueTrustedJudge(
    env,
    run.id,
    payload.source_text,
    contract.judgeSpec,
  );
  if (!queued) return false;
  const enqueuedAt = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE trusted_example_runs
      SET enqueued_at = ?
      WHERE id = ? AND user_id = ? AND status = 'pending'
        AND enqueued_at IS NULL
    `).bind(enqueuedAt, run.id, userId),
    env.DB.prepare(
      "DELETE FROM trusted_example_run_payloads WHERE run_id = ? AND user_id = ?",
    ).bind(run.id, userId),
  ]);
  return true;
}

async function retryPendingTrustedCustomRun(
  env: Env,
  run: TrustedCustomRunRow,
  userId: string,
) {
  if (!env.DB) return false;
  if (run.enqueued_at !== null) return true;
  const payload = await env.DB.prepare(`
    SELECT p.source_text, p.args_json, a.challenge_key,
           a.content_revision, a.judge_revision
    FROM trusted_custom_run_payloads p
    JOIN trusted_custom_runs r
      ON r.id = p.run_id AND r.user_id = p.user_id
    JOIN trusted_assignments a
      ON a.id = r.assignment_id AND a.user_id = r.user_id
    WHERE p.run_id = ? AND p.user_id = ? AND r.status = 'pending'
  `).bind(run.id, userId).first<{
    source_text: string;
    args_json: string;
    challenge_key: string;
    content_revision: number;
    judge_revision: number;
  }>();
  if (!payload) return true;
  const challenge = trustedChallengeForKey(payload.challenge_key);
  if (!challenge) return false;
  let customCases: ReturnType<typeof normalizeTrustedCustomCases>;
  try {
    customCases = normalizeTrustedCustomCases(challenge, JSON.parse(payload.args_json));
  } catch {
    return false;
  }
  if (
    !customCases ||
    challenge?.contentRevision !== payload.content_revision ||
    challenge?.judgeRevision !== payload.judge_revision ||
    JSON.stringify(customCases.map((entry) => entry.id)) !== run.case_ids_json
  )
    return false;
  const judgeSpec = customJudgeSpec(challenge, customCases);
  if (!judgeSpec) return false;
  const contractDigest = await trustedJudgeContractDigest(judgeSpec);
  if (contractDigest !== run.contract_digest) return false;
  let execution;
  try {
    execution = await trustedGatewayExecution({
      executionId: run.id,
      source: payload.source_text,
      judgeSpec,
      callbackUrl: env.TRUSTED_JUDGE_CALLBACK_URL!,
    });
  } catch {
    return false;
  }
  const queued = await enqueueTrustedExecution(env, execution);
  if (!queued) return false;
  const enqueuedAt = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE trusted_custom_runs
      SET enqueued_at = ?
      WHERE id = ? AND user_id = ? AND status = 'pending'
        AND enqueued_at IS NULL
    `).bind(enqueuedAt, run.id, userId),
    env.DB.prepare(
      "DELETE FROM trusted_custom_run_payloads WHERE run_id = ? AND user_id = ?",
    ).bind(run.id, userId),
  ]);
  return true;
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
  const rawChallengeKey = url.searchParams.get("challengeKey");
  const challengeKey = rawChallengeKey === null
    ? null
    : cleanTrustedId(rawChallengeKey);
  if (rawChallengeKey !== null && !challengeKey)
    return errorResponse(
      request,
      400,
      "INVALID_CHALLENGE_KEY",
      "Provide an allowlisted challenge key.",
    );
  const rows = await env.DB.prepare(`
    SELECT a.*,
           s.id AS submission_id, s.client_submission_id AS submission_client_id,
           s.status AS submission_status,
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
      ${challengeKey ? "AND a.challenge_key = ?" : ""}
    ORDER BY a.assigned_at DESC, a.id DESC
    LIMIT ?
  `)
    .bind(...(challengeKey ? [user.userId, challengeKey, limit] : [user.userId, limit]))
    .all<TrustedAssignmentRow>();
  return json(request, {
    program: TRUSTED_CODE_LAB_PROGRAM,
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
  const language = isRecord(body) && body.language === "swift"
    ? "swift"
    : isRecord(body) && (body.language === undefined || body.language === "python")
      ? "python"
      : null;
  const program = trustedProgramForLanguage(language);
  if (!clientRequestId || !program)
    return errorResponse(
      request,
      400,
      "INVALID_REQUEST_ID",
      "Provide a stable client request ID.",
    );
  const hasChallengeKey = isRecord(body) && Object.hasOwn(body, "challengeKey");
  const challengeKey = hasChallengeKey
    ? cleanTrustedId(isRecord(body) ? body.challengeKey : undefined)
    : null;
  if (hasChallengeKey && !challengeKey)
    return errorResponse(
      request,
      400,
      "INVALID_CHALLENGE_KEY",
      "Provide an allowlisted challenge for the selected language.",
    );
  const requestedChallenge = challengeKey
    ? trustedChallengeForKey(challengeKey)
    : null;
  if (
    challengeKey &&
    (!requestedChallenge ||
      requestedChallenge.programId !== program.id ||
      requestedChallenge.language !== program.language)
  )
    return errorResponse(
      request,
      400,
      "INVALID_CHALLENGE_KEY",
      "Provide an allowlisted challenge for the selected language.",
    );
  const requestHash = await sha256(JSON.stringify({
    clientRequestId,
    programId: program.id,
    programRevision: program.revision,
    ...(challengeKey ? { challengeKey } : {}),
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
  let challenge = requestedChallenge;
  if (!challenge) {
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM trusted_assignments WHERE user_id = ? AND program_id = ?",
    ).bind(user.userId, program.id).first<{ count: number }>();
    challenge = trustedChallengeForSequence(
      Number(count?.count ?? 0),
      program.language,
    );
  }
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
        program.id,
        program.revision,
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
  preparedPayload?: Awaited<ReturnType<typeof trustedGatewaySubmission>>,
) {
  if (!hasTrustedJudge(env)) return null;
  let payload = preparedPayload;
  if (!payload) {
    try {
      payload = await trustedGatewaySubmission({
        submissionId,
        source,
        judgeSpec: judgeSpec as ReturnType<typeof privateJudgeSpec>,
        callbackUrl: env.TRUSTED_JUDGE_CALLBACK_URL!,
      });
    } catch {
      return null;
    }
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
      const timeoutContractDigest = await trustedJudgeContractDigest(
        judgeSpec as ReturnType<typeof privateJudgeSpec>,
      );
      const resultJson = JSON.stringify({
        passed: 0,
        total: judgeSpec.cases.length,
        authority:
          judgeSpec.language === "swift"
            ? "server-isolated-swift"
            : "server-isolated-python",
        language: judgeSpec.language === "swift" ? "swift" : "python",
        runtime:
          typeof judgeSpec.runtime === "string"
            ? judgeSpec.runtime
            : "python-3.13-linux",
        contractDigest: timeoutContractDigest,
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
    const staleExamples = await db.prepare(`
      SELECT r.id, r.requested_at, r.enqueued_at,
             a.challenge_key, a.content_revision, a.judge_revision
      FROM trusted_example_runs r
      JOIN trusted_assignments a
        ON a.id = r.assignment_id AND a.user_id = r.user_id
      WHERE r.status = 'pending'
        AND (
          (r.enqueued_at IS NOT NULL AND r.enqueued_at <= ?)
          OR
          (r.enqueued_at IS NULL AND r.requested_at <= ?)
        )
      ORDER BY r.requested_at ASC, r.id ASC
      LIMIT 25
    `).bind(
      now - TRUSTED_ENQUEUED_TIMEOUT_MS,
      now - TRUSTED_DELIVERY_TIMEOUT_MS,
    ).all<{
      id: string;
      requested_at: number;
      enqueued_at: number | null;
      challenge_key: string;
      content_revision: number;
      judge_revision: number;
    }>();
    for (const row of staleExamples.results) {
      const challenge = trustedChallengeForKey(row.challenge_key);
      const contract = trustedExampleContract(challenge);
      if (
        !contract ||
        contract.challenge.contentRevision !== row.content_revision ||
        contract.challenge.judgeRevision !== row.judge_revision
      ) {
        await db.batch([
          db.prepare(
            "DELETE FROM trusted_example_run_payloads WHERE run_id = ?",
          ).bind(row.id),
          db.prepare(
            "DELETE FROM trusted_example_runs WHERE id = ? AND status = 'pending'",
          ).bind(row.id),
        ]);
        continue;
      }
      const { judgeSpec, authority } = contract;
      const settlementHash = await sha256(JSON.stringify({
        version: 1,
        kind: "trusted-example-timeout",
        runId: row.id,
        requestedAt: row.requested_at,
        enqueuedAt: row.enqueued_at,
      }));
      const resultJson = JSON.stringify({
        passed: 0,
        total: judgeSpec.cases.length,
        authority,
        language: judgeSpec.language,
        runtime: judgeSpec.runtime,
        contractDigest: await trustedJudgeContractDigest(judgeSpec),
        contentRevision: row.content_revision,
        judgeRevision: row.judge_revision,
        infrastructureFailure: true,
      });
      const stalePredicate = row.enqueued_at === null
        ? "enqueued_at IS NULL AND requested_at <= ?"
        : "enqueued_at = ? AND enqueued_at <= ?";
      const staleArgs = row.enqueued_at === null
        ? [now - TRUSTED_DELIVERY_TIMEOUT_MS]
        : [row.enqueued_at, now - TRUSTED_ENQUEUED_TIMEOUT_MS];
      const settlement = await db.prepare(`
        UPDATE trusted_example_runs
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
          "DELETE FROM trusted_example_run_payloads WHERE run_id = ?",
        ).bind(row.id).run();
      }
    }
    const staleCustomRuns = await db.prepare(`
      SELECT r.id, r.requested_at, r.enqueued_at, r.contract_digest,
             r.case_ids_json, a.challenge_key, a.content_revision,
             a.judge_revision
      FROM trusted_custom_runs r
      JOIN trusted_assignments a
        ON a.id = r.assignment_id AND a.user_id = r.user_id
      WHERE r.status = 'pending'
        AND (
          (r.enqueued_at IS NOT NULL AND r.enqueued_at <= ?)
          OR
          (r.enqueued_at IS NULL AND r.requested_at <= ?)
        )
      ORDER BY r.requested_at ASC, r.id ASC
      LIMIT 25
    `).bind(
      now - TRUSTED_ENQUEUED_TIMEOUT_MS,
      now - TRUSTED_DELIVERY_TIMEOUT_MS,
    ).all<{
      id: string;
      requested_at: number;
      enqueued_at: number | null;
      contract_digest: string;
      case_ids_json: string;
      challenge_key: string;
      content_revision: number;
      judge_revision: number;
    }>();
    for (const row of staleCustomRuns.results) {
      const challenge = trustedChallengeForKey(row.challenge_key);
      const caseIds = (() => {
        try {
          const decoded = JSON.parse(row.case_ids_json) as unknown;
          return Array.isArray(decoded) && decoded.length >= 1 &&
              decoded.length <= TRUSTED_CUSTOM_MAX_CASES &&
              decoded.every((id) => cleanTrustedCustomCaseId(id))
            ? decoded as string[]
            : null;
        } catch {
          return null;
        }
      })();
      if (
        !challenge || challenge.language !== "swift" || !caseIds ||
        challenge.contentRevision !== row.content_revision ||
        challenge.judgeRevision !== row.judge_revision
      ) {
        await db.batch([
          db.prepare("DELETE FROM trusted_custom_run_payloads WHERE run_id = ?").bind(row.id),
          db.prepare("DELETE FROM trusted_custom_runs WHERE id = ? AND status = 'pending'").bind(row.id),
        ]);
        continue;
      }
      const settlementHash = await sha256(JSON.stringify({
        version: 1,
        kind: "trusted-custom-timeout",
        runId: row.id,
        requestedAt: row.requested_at,
        enqueuedAt: row.enqueued_at,
      }));
      const resultJson = JSON.stringify({
        passed: 0,
        total: caseIds.length,
        authority: "server-isolated-swift",
        language: "swift",
        runtime: challenge.runtime,
        contractDigest: row.contract_digest,
        contentRevision: row.content_revision,
        judgeRevision: row.judge_revision,
        infrastructureFailure: true,
        cases: caseIds.map((id) => ({
          id,
          status: "judge-error",
          diagnostic: "The isolated execution did not settle before its timeout.",
        })),
      });
      const stalePredicate = row.enqueued_at === null
        ? "enqueued_at IS NULL AND requested_at <= ?"
        : "enqueued_at = ? AND enqueued_at <= ?";
      const staleArgs = row.enqueued_at === null
        ? [now - TRUSTED_DELIVERY_TIMEOUT_MS]
        : [row.enqueued_at, now - TRUSTED_ENQUEUED_TIMEOUT_MS];
      const settlement = await db.prepare(`
        UPDATE trusted_custom_runs
        SET status = 'settled', verdict = 'judge-error', result_json = ?,
            settlement_hash = ?, settled_at = ?
        WHERE id = ? AND status = 'pending' AND ${stalePredicate}
      `).bind(resultJson, settlementHash, now, row.id, ...staleArgs).run();
      if ((settlement.meta?.changes ?? 0) > 0) {
        await db.prepare(
          "DELETE FROM trusted_custom_run_payloads WHERE run_id = ?",
        ).bind(row.id).run();
      }
    }
    await db.prepare(
      "DELETE FROM trusted_submission_payloads WHERE purge_after <= ?",
    ).bind(now).run();
    await db.prepare(
      "DELETE FROM trusted_example_run_payloads WHERE purge_after <= ?",
    ).bind(now).run();
    await db.prepare(
      "DELETE FROM trusted_custom_run_payloads WHERE purge_after <= ?",
    ).bind(now).run();
    await db.prepare(
      "DELETE FROM trusted_example_runs WHERE purge_after <= ? AND status = 'settled'",
    ).bind(now).run();
    await db.prepare(
      "DELETE FROM trusted_custom_runs WHERE purge_after <= ? AND status = 'settled'",
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
      "Send bounded source and a stable submission ID.",
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
      "Send bounded source and a stable submission ID.",
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
    currentChallenge.programId !== assignment.program_id ||
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

  let preparedGatewayPayload: Awaited<ReturnType<typeof trustedGatewaySubmission>>;
  try {
    preparedGatewayPayload = await trustedGatewaySubmission({
      submissionId: `preflight-${crypto.randomUUID().replace(/-/g, "")}`,
      source,
      judgeSpec: judgeSpec as ReturnType<typeof privateJudgeSpec>,
      callbackUrl: env.TRUSTED_JUDGE_CALLBACK_URL!,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_TRUSTED_SUBMISSION";
    const sizeFailure = new Set([
      "TRUSTED_GATEWAY_SOURCE_TOO_LARGE",
      "TRUSTED_GATEWAY_CASE_TOO_LARGE",
      "TRUSTED_GATEWAY_REQUEST_TOO_LARGE",
    ]).has(code);
    return errorResponse(
      request,
      sizeFailure ? 413 : 422,
      sizeFailure ? "SUBMISSION_TOO_LARGE" : "INVALID_TRUSTED_SUBMISSION",
      sizeFailure
        ? "This source is too large for the isolated judge envelope. Shorten it and submit again."
        : "This source does not fit the frozen verified checkpoint contract.",
    );
  }

  const submissionId = `verified-${crypto.randomUUID().replace(/-/g, "")}`;
  preparedGatewayPayload = { ...preparedGatewayPayload, submissionId };
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
    preparedGatewayPayload,
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

async function enqueueTrustedExecution(
  env: Env,
  execution: Awaited<ReturnType<typeof trustedGatewayExecution>>,
) {
  if (!hasTrustedJudge(env)) return null;
  let executionUrl: string;
  try {
    const parsed = new URL(env.TRUSTED_JUDGE_URL!);
    parsed.pathname = parsed.pathname.endsWith("/v1/submissions")
      ? parsed.pathname.slice(0, -"/v1/submissions".length) + "/v1/executions"
      : parsed.pathname.replace(/\/$/, "") + "/v1/executions";
    parsed.search = "";
    executionUrl = parsed.toString();
  } catch {
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(executionUrl, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${env.TRUSTED_JUDGE_TOKEN}`,
      },
      body: JSON.stringify(execution),
    });
    if (response.status !== 202) return null;
    const text = await response.text();
    if (!text || new TextEncoder().encode(text).byteLength > 1_024) return null;
    const decoded = JSON.parse(text) as unknown;
    return isRecord(decoded) &&
      decoded.executionId === execution.executionId &&
      decoded.status === "queued";
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function runTrustedAssignmentExamples(
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
      "Sign in to run verified examples.",
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
      "Send bounded source and a stable example run ID.",
    );
  }
  const clientRunId = isRecord(body) ? cleanTrustedId(body.clientRunId) : null;
  const source = isRecord(body) ? cleanTrustedSource(body.source) : null;
  if (!clientRunId || !source)
    return errorResponse(
      request,
      400,
      "INVALID_EXAMPLE_RUN",
      "Send bounded source and a stable example run ID.",
    );
  const sourceHash = await sha256(source);
  const requestHash = await sha256(JSON.stringify({
    kind: "trusted-example-run",
    assignmentId,
    sourceHash,
  }));
  const replay = await trustedExampleRunByClientId(
    env.DB,
    user.userId,
    clientRunId,
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
        "That example run ID belongs to different source or assignment input.",
      );
    if (replay.status === "pending") {
      const queued = await retryPendingTrustedExampleRun(
        env,
        replay,
        user.userId,
      );
      if (!queued)
        return errorResponse(
          request,
          503,
          "JUDGE_ENQUEUE_UNAVAILABLE",
          "The example run is saved, but the isolated judge could not be reached. Retry with the same source.",
        );
    }
    const challenge = trustedChallengeForKey(
      (await env.DB.prepare(
        "SELECT challenge_key FROM trusted_assignments WHERE id = ? AND user_id = ?",
      ).bind(replay.assignment_id, user.userId).first<{ challenge_key: string }>())
        ?.challenge_key,
    );
    return json(
      request,
      { exampleRun: trustedExampleRunProjection(replay, challenge) },
      replay.status === "pending" ? 202 : 200,
    );
  }

  const now = Date.now();
  const recentExample = await env.DB.prepare(`
    SELECT id
    FROM trusted_example_runs
    WHERE user_id = ? AND requested_at > ?
    ORDER BY requested_at DESC
    LIMIT 1
  `).bind(user.userId, now - 2_000).first<{ id: string }>();
  if (recentExample)
    return errorResponse(
      request,
      429,
      "EXAMPLE_RUN_RATE_LIMITED",
      "Wait a moment before starting another example run.",
    );
  const pendingExampleCount = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM trusted_example_runs
    WHERE user_id = ? AND status = 'pending'
  `).bind(user.userId).first<{ count: number }>();
  if ((pendingExampleCount?.count ?? 0) >= TRUSTED_EXAMPLE_MAX_PENDING_PER_USER)
    return errorResponse(
      request,
      429,
      "EXAMPLE_RUN_LIMIT_REACHED",
      "Finish or wait for an earlier example run before starting another.",
    );

  const assignment = await env.DB.prepare(`
    SELECT *
    FROM trusted_assignments
    WHERE id = ? AND user_id = ?
  `).bind(assignmentId, user.userId).first<TrustedAssignmentRow>();
  if (!assignment)
    return errorResponse(
      request,
      404,
      "ASSIGNMENT_NOT_FOUND",
      "That verified assignment is unavailable.",
    );
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
  const challenge = trustedChallengeForKey(assignment.challenge_key);
  const contract = trustedExampleContract(challenge);
  if (
    !contract ||
    contract.challenge.programId !== assignment.program_id ||
    contract.challenge.contentRevision !== assignment.content_revision ||
    contract.challenge.judgeRevision !== assignment.judge_revision
  )
    return errorResponse(
      request,
      409,
      "ASSIGNMENT_STALE",
      "This assignment no longer matches the current example contract.",
    );
  const { judgeSpec } = contract;
  let preparedGatewayPayload: Awaited<ReturnType<typeof trustedGatewaySubmission>>;
  try {
    preparedGatewayPayload = await trustedGatewaySubmission({
      submissionId: `example-${crypto.randomUUID().replace(/-/g, "")}`,
      source,
      judgeSpec,
      callbackUrl: env.TRUSTED_JUDGE_CALLBACK_URL!,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_TRUSTED_SUBMISSION";
    const sizeFailure = new Set([
      "TRUSTED_GATEWAY_SOURCE_TOO_LARGE",
      "TRUSTED_GATEWAY_CASE_TOO_LARGE",
      "TRUSTED_GATEWAY_REQUEST_TOO_LARGE",
    ]).has(code);
    return errorResponse(
      request,
      sizeFailure ? 413 : 422,
      sizeFailure ? "SUBMISSION_TOO_LARGE" : "INVALID_TRUSTED_SUBMISSION",
      sizeFailure
        ? "This source is too large for the isolated judge envelope. Shorten it and run examples again."
        : "This source does not fit the example contract.",
    );
  }

  const runId = preparedGatewayPayload.submissionId;
  const purgeAfter = now + TRUSTED_RETENTION_MS;
  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO trusted_example_runs
          (id, assignment_id, user_id, client_run_id, request_hash,
           source_hash, status, verdict, result_json, requested_at,
           settled_at, purge_after)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, NULL, ?)
      `).bind(
        runId,
        assignmentId,
        user.userId,
        clientRunId,
        requestHash,
        sourceHash,
        now,
        purgeAfter,
      ),
      env.DB.prepare(`
        INSERT INTO trusted_example_run_payloads
          (run_id, user_id, source_text, purge_after)
        VALUES (?, ?, ?, ?)
      `).bind(
        runId,
        user.userId,
        source,
        now + 60 * 60 * 1000,
      ),
    ]);
  } catch (error) {
    const raced = await trustedExampleRunByClientId(
      env.DB,
      user.userId,
      clientRunId,
    );
    if (
      raced &&
      raced.assignment_id === assignmentId &&
      raced.request_hash === requestHash
    )
      return json(
        request,
        { exampleRun: trustedExampleRunProjection(raced, challenge) },
        raced.status === "pending" ? 202 : 200,
      );
    throw error;
  }

  const queued = await enqueueTrustedJudge(
    env,
    runId,
    source,
    judgeSpec,
    preparedGatewayPayload,
  );
  if (!queued)
    return errorResponse(
      request,
      503,
      "JUDGE_ENQUEUE_UNAVAILABLE",
      "The example run is saved, but the isolated judge could not be reached. Retry with the same source.",
    );
  const enqueuedAt = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE trusted_example_runs
      SET enqueued_at = ?
      WHERE id = ? AND user_id = ? AND status = 'pending'
        AND enqueued_at IS NULL
    `).bind(enqueuedAt, runId, user.userId),
    env.DB.prepare(
      "DELETE FROM trusted_example_run_payloads WHERE run_id = ? AND user_id = ?",
    ).bind(runId, user.userId),
  ]);
  const pending = await trustedExampleRunByClientId(
    env.DB,
    user.userId,
    clientRunId,
  );
  if (!pending) throw new Error("TRUSTED_EXAMPLE_RUN_CREATE_FAILED");
  return json(
    request,
    { exampleRun: trustedExampleRunProjection(pending, challenge) },
    202,
  );
}

/**
 * Execute one or more learner-supplied Swift input cases without expected
 * values. The gateway's run-only contract returns bounded observed output;
 * this receipt is intentionally separate from both samples and verified
 * submissions and can never accept/close the assignment.
 */
async function runTrustedAssignmentCustomCases(
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
      "Sign in to run private custom cases.",
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
      "Send bounded source, arguments, and a stable custom run ID.",
    );
  }
  const clientRunId = isRecord(body) ? cleanTrustedId(body.clientRunId) : null;
  const source = isRecord(body) ? cleanTrustedSource(body.source) : null;
  if (!clientRunId || !source)
    return errorResponse(
      request,
      400,
      "INVALID_CUSTOM_RUN",
      "Send bounded source, arguments, and a stable custom run ID.",
    );

  const assignment = await env.DB.prepare(`
    SELECT *
    FROM trusted_assignments
    WHERE id = ? AND user_id = ?
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
  const challenge = trustedChallengeForKey(assignment.challenge_key);
  if (
    !challenge ||
    challenge.language !== "swift" ||
    challenge.programId !== assignment.program_id ||
    challenge.contentRevision !== assignment.content_revision ||
    challenge.judgeRevision !== assignment.judge_revision
  )
    return errorResponse(
      request,
      409,
      "ASSIGNMENT_STALE",
      "This assignment no longer matches the current Swift judge contract.",
    );

  const rawCases = isRecord(body)
    ? Array.isArray(body.cases)
      ? body.cases
      : body.args !== undefined
        ? [{ id: "custom-1", name: "Custom case 1", args: body.args }]
        : null
    : null;
  let customCases: ReturnType<typeof normalizeTrustedCustomCases>;
  try {
    customCases = normalizeTrustedCustomCases(challenge, rawCases);
  } catch {
    customCases = null;
  }
  if (!customCases)
    return errorResponse(
      request,
      400,
      "INVALID_CUSTOM_INPUT",
      "Custom cases must contain 1–12 argument arrays matching the Swift function signature.",
    );
  const caseIds = customCases.map((testCase) => testCase.id);
  const caseIdsJson = JSON.stringify(caseIds);
  const sourceHash = await sha256(source);
  const requestHash = await sha256(JSON.stringify({
    kind: "trusted-custom-run-v1",
    assignmentId,
    sourceHash,
    cases: customCases,
  }));
  const replay = await trustedCustomRunByClientId(
    env.DB,
    user.userId,
    clientRunId,
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
        "That custom run ID belongs to different source or input.",
      );
    if (replay.status === "pending") {
      const queued = await retryPendingTrustedCustomRun(
        env,
        replay,
        user.userId,
      );
      if (!queued)
        return errorResponse(
          request,
          503,
          "JUDGE_ENQUEUE_UNAVAILABLE",
          "The custom run is saved, but the isolated judge could not be reached. Retry with the same source and input.",
        );
    }
    return json(
      request,
      { customRun: trustedCustomRunProjection(replay, challenge) },
      replay.status === "pending" ? 202 : 200,
    );
  }

  const recentCustom = await env.DB.prepare(`
    SELECT id
    FROM trusted_custom_runs
    WHERE user_id = ? AND requested_at > ?
    ORDER BY requested_at DESC
    LIMIT 1
  `).bind(user.userId, now - 2_000).first<{ id: string }>();
  if (recentCustom)
    return errorResponse(
      request,
      429,
      "CUSTOM_RUN_RATE_LIMITED",
      "Wait a moment before starting another custom run.",
    );
  const pendingCustomCount = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM trusted_custom_runs
    WHERE user_id = ? AND status = 'pending'
  `).bind(user.userId).first<{ count: number }>();
  if ((pendingCustomCount?.count ?? 0) >= TRUSTED_CUSTOM_MAX_PENDING_PER_USER)
    return errorResponse(
      request,
      429,
      "CUSTOM_RUN_LIMIT_REACHED",
      "Finish or wait for an earlier custom run before starting another.",
    );

  const judgeSpec = customJudgeSpec(challenge, customCases);
  if (!judgeSpec)
    return errorResponse(
      request,
      409,
      "CUSTOM_RUN_UNSUPPORTED",
      "This assignment does not support isolated Swift custom cases.",
    );
  let preparedGatewayPayload: Awaited<ReturnType<typeof trustedGatewayExecution>>;
  try {
    preparedGatewayPayload = await trustedGatewayExecution({
      executionId: `custom-${crypto.randomUUID().replace(/-/g, "")}`,
      source,
      judgeSpec,
      callbackUrl: env.TRUSTED_JUDGE_CALLBACK_URL!,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_TRUSTED_SUBMISSION";
    const sizeFailure = new Set([
      "TRUSTED_GATEWAY_SOURCE_TOO_LARGE",
      "TRUSTED_GATEWAY_CASE_TOO_LARGE",
      "TRUSTED_GATEWAY_REQUEST_TOO_LARGE",
    ]).has(code);
    return errorResponse(
      request,
      sizeFailure ? 413 : 422,
      sizeFailure ? "CUSTOM_INPUT_TOO_LARGE" : "INVALID_CUSTOM_INPUT",
      sizeFailure
        ? "This source or custom input is too large for the isolated judge envelope. Shorten it and run again."
        : "This source or custom input does not fit the Swift function contract.",
    );
  }
  const runId = preparedGatewayPayload.executionId;
  const contractDigest = await trustedJudgeContractDigest(judgeSpec);
  const purgeAfter = now + TRUSTED_RETENTION_MS;
  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO trusted_custom_runs
          (id, assignment_id, user_id, client_run_id, request_hash,
           source_hash, contract_digest, case_ids_json, status, verdict,
           case_names_json, result_json, requested_at, settled_at, purge_after)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, NULL, ?, NULL, ?)
      `).bind(
        runId,
        assignmentId,
        user.userId,
        clientRunId,
        requestHash,
        sourceHash,
        contractDigest,
        caseIdsJson,
        JSON.stringify(customCases.map((testCase) => testCase.name)),
        now,
        purgeAfter,
      ),
      env.DB.prepare(`
        INSERT INTO trusted_custom_run_payloads
          (run_id, user_id, source_text, args_json, purge_after)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        runId,
        user.userId,
        source,
        JSON.stringify(customCases),
        now + 60 * 60 * 1000,
      ),
    ]);
  } catch (error) {
    const raced = await trustedCustomRunByClientId(
      env.DB,
      user.userId,
      clientRunId,
    );
    if (
      raced &&
      raced.assignment_id === assignmentId &&
      raced.request_hash === requestHash
    )
      return json(
        request,
        { customRun: trustedCustomRunProjection(raced, challenge) },
        raced.status === "pending" ? 202 : 200,
      );
    throw error;
  }
  const queued = await enqueueTrustedExecution(env, preparedGatewayPayload);
  if (!queued)
    return errorResponse(
      request,
      503,
      "JUDGE_ENQUEUE_UNAVAILABLE",
      "The custom run is saved, but the isolated judge could not be reached. Retry with the same source and input.",
    );
  const enqueuedAt = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE trusted_custom_runs
      SET enqueued_at = ?
      WHERE id = ? AND user_id = ? AND status = 'pending'
        AND enqueued_at IS NULL
    `).bind(enqueuedAt, runId, user.userId),
    env.DB.prepare(
      "DELETE FROM trusted_custom_run_payloads WHERE run_id = ? AND user_id = ?",
    ).bind(runId, user.userId),
  ]);
  const pending = await trustedCustomRunByClientId(
    env.DB,
    user.userId,
    clientRunId,
  );
  if (!pending) throw new Error("TRUSTED_CUSTOM_RUN_CREATE_FAILED");
  return json(
    request,
    { customRun: trustedCustomRunProjection(pending, challenge) },
    202,
  );
}

async function settleTrustedExampleRunResult(
  request: Request,
  env: Env,
  decoded: unknown,
  runId: string,
  body: string,
) {
  if (!env.DB) throw new Error("TRUSTED_DB_REQUIRED");
  const row = await env.DB.prepare(`
    SELECT r.id, r.assignment_id, r.user_id, r.status, r.settlement_hash,
           a.challenge_key, a.content_revision, a.judge_revision
    FROM trusted_example_runs r
    JOIN trusted_assignments a
      ON a.id = r.assignment_id AND a.user_id = r.user_id
    WHERE r.id = ?
  `).bind(runId).first<{
    id: string;
    assignment_id: string;
    user_id: string;
    status: "pending" | "settled";
    settlement_hash: string | null;
    challenge_key: string;
    content_revision: number;
    judge_revision: number;
  }>();
  if (!row) return null;
  const challenge = trustedChallengeForKey(row.challenge_key);
  const contract = trustedExampleContract(challenge);
  if (
    !contract ||
    contract.challenge.contentRevision !== row.content_revision ||
    contract.challenge.judgeRevision !== row.judge_revision
  )
    throw new Error("INVALID_TRUSTED_EXAMPLE_RUN_ROW");
  const { judgeSpec, authority } = contract;
  const contractDigest = await trustedJudgeContractDigest(judgeSpec);
  const result = normalizeTrustedGatewayExampleResult(
    decoded,
    runId,
    {
      total: judgeSpec.cases.length,
      language: judgeSpec.language,
      runtime: judgeSpec.runtime,
      contentRevision: row.content_revision,
      judgeRevision: row.judge_revision,
      contractDigest,
      publicCaseIds: judgeSpec.cases.map((testCase) => testCase.id),
    },
  );
  if (!result)
    return errorResponse(
      request,
      400,
      "INVALID_JUDGE_RESULT",
      "The signed callback does not match the example contract.",
    );
  const settlementHash = await sha256(body);
  if (row.status === "settled") {
    if (row.settlement_hash === settlementHash)
      return new Response(null, {
        status: 204,
        headers: responseHeaders(request),
      });
    console.error("Contradictory trusted example callback", {
      runId,
      storedHash: row.settlement_hash,
      receivedHash: settlementHash,
    });
    return errorResponse(
      request,
      409,
      "CONTRADICTORY_JUDGE_RESULT",
      "A different result already settled this example run.",
    );
  }
  const settledAt = Date.now();
  const resultJson = JSON.stringify({
    passed: result.passed,
    total: result.total,
    authority,
    language: judgeSpec.language,
    runtime: judgeSpec.runtime,
    contentRevision: result.contentRevision,
    judgeRevision: result.judgeRevision,
    contractDigest: result.contractDigest,
    ...(result.diagnostic ? { diagnostic: result.diagnostic } : {}),
    ...(typeof result.failedCaseIndex === "number"
      ? { failedCaseIndex: result.failedCaseIndex }
      : {}),
    ...(result.publicCaseResults
      ? { publicCaseResults: result.publicCaseResults }
      : {}),
  });
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE trusted_example_runs
      SET status = 'settled', verdict = ?, result_json = ?,
          settlement_hash = ?, settled_at = ?
      WHERE id = ? AND status = 'pending'
    `).bind(
      result.verdict,
      resultJson,
      settlementHash,
      settledAt,
      runId,
    ),
    env.DB.prepare(
      "DELETE FROM trusted_example_run_payloads WHERE run_id = ?",
    ).bind(runId),
  ]);
  const settled = await env.DB.prepare(`
    SELECT status, settlement_hash
    FROM trusted_example_runs
    WHERE id = ?
  `).bind(runId).first<{
    status: "pending" | "settled";
    settlement_hash: string | null;
  }>();
  if (settled?.status === "settled" && settled.settlement_hash === settlementHash)
    return new Response(null, {
      status: 204,
      headers: responseHeaders(request),
    });
  console.error("Trusted example settlement lost a contradictory race", {
    runId,
    receivedHash: settlementHash,
  });
  return errorResponse(
    request,
    409,
    "CONTRADICTORY_JUDGE_RESULT",
    "A different result already settled this example run.",
  );
}

async function settleTrustedCustomRunResult(
  request: Request,
  env: Env,
  decoded: unknown,
  runId: string,
  body: string,
) {
  if (!env.DB) throw new Error("TRUSTED_DB_REQUIRED");
  const row = await env.DB.prepare(`
    SELECT r.id, r.assignment_id, r.user_id, r.status, r.settlement_hash,
           r.contract_digest, r.case_ids_json,
           a.challenge_key, a.content_revision, a.judge_revision
    FROM trusted_custom_runs r
    JOIN trusted_assignments a
      ON a.id = r.assignment_id AND a.user_id = r.user_id
    WHERE r.id = ?
  `).bind(runId).first<{
    id: string;
    assignment_id: string;
    user_id: string;
    status: "pending" | "settled";
    settlement_hash: string | null;
    contract_digest: string;
    case_ids_json: string;
    challenge_key: string;
    content_revision: number;
    judge_revision: number;
  }>();
  if (!row) return null;
  const challenge = trustedChallengeForKey(row.challenge_key);
  const caseIds = (() => {
    try {
      const value = JSON.parse(row.case_ids_json) as unknown;
      return Array.isArray(value) && value.length >= 1 && value.length <= TRUSTED_CUSTOM_MAX_CASES &&
          value.every((id) => cleanTrustedCustomCaseId(id))
        ? value as string[]
        : null;
    } catch {
      return null;
    }
  })();
  if (
    !challenge || challenge.language !== "swift" || !caseIds ||
    challenge.contentRevision !== row.content_revision ||
    challenge.judgeRevision !== row.judge_revision
  )
    throw new Error("INVALID_TRUSTED_CUSTOM_RUN_ROW");
  const normalizedCases = normalizeTrustedCustomCaseResults(decoded, caseIds);
  if (!normalizedCases)
    return errorResponse(
      request,
      400,
      "INVALID_JUDGE_RESULT",
      "The signed execution callback does not match the custom input contract.",
    );
  const callback = isRecord(decoded) ? decoded : null;
  if (
    !callback ||
    callback.version !== "judge.execution.result.v1" ||
    callback.executionId !== runId ||
    callback.language !== "swift6" ||
    callback.runtime !== challenge.runtime ||
    callback.total !== caseIds.length ||
    callback.executed !== normalizedCases.filter((entry) => entry.passed).length
  )
    return errorResponse(
      request,
      400,
      "INVALID_JUDGE_RESULT",
      "The signed execution callback does not match the custom input contract.",
    );
  const passed = normalizedCases.filter((entry) => entry.passed).length;
  const verdict = passed === caseIds.length
    ? "accepted"
    : normalizedCases.some((entry) => entry.status === "compile-error")
      ? "compile-error"
      : normalizedCases.some((entry) => entry.status === "time-limit")
        ? "time-limit"
        : normalizedCases.some((entry) => entry.status === "runtime-error")
          ? "runtime-error"
          : "judge-error";
  const topDiagnostic = typeof callback.diagnostic === "string"
    ? callback.diagnostic.slice(0, 2_000)
    : null;
  const resultJson = JSON.stringify({
    passed,
    total: caseIds.length,
    authority: "server-isolated-swift",
    language: "swift",
    runtime: challenge.runtime,
    contentRevision: row.content_revision,
    judgeRevision: row.judge_revision,
    contractDigest: row.contract_digest,
    ...(topDiagnostic ? { diagnostic: topDiagnostic } : {}),
    cases: normalizedCases.map((entry) => ({ ...entry })),
  });
  const settlementHash = await sha256(body);
  if (row.status === "settled") {
    if (row.settlement_hash === settlementHash)
      return new Response(null, { status: 204, headers: responseHeaders(request) });
    console.error("Contradictory trusted custom callback", {
      runId,
      storedHash: row.settlement_hash,
      receivedHash: settlementHash,
    });
    return errorResponse(
      request,
      409,
      "CONTRADICTORY_JUDGE_RESULT",
      "A different result already settled this custom run.",
    );
  }
  const settledAt = Date.now();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE trusted_custom_runs
      SET status = 'settled', verdict = ?, result_json = ?,
          settlement_hash = ?, settled_at = ?
      WHERE id = ? AND status = 'pending'
    `).bind(verdict, resultJson, settlementHash, settledAt, runId),
    env.DB.prepare(
      "DELETE FROM trusted_custom_run_payloads WHERE run_id = ?",
    ).bind(runId),
  ]);
  const settled = await env.DB.prepare(`
    SELECT status, settlement_hash
    FROM trusted_custom_runs
    WHERE id = ?
  `).bind(runId).first<{
    status: "pending" | "settled";
    settlement_hash: string | null;
  }>();
  if (settled?.status === "settled" && settled.settlement_hash === settlementHash)
    return new Response(null, { status: 204, headers: responseHeaders(request) });
  return errorResponse(
    request,
    409,
    "CONTRADICTORY_JUDGE_RESULT",
    "A different result already settled this custom run.",
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
  if (isRecord(decoded) && decoded.version === "judge.execution.result.v1") {
    const executionId = cleanTrustedId(decoded.executionId, 160);
    if (!executionId)
      return errorResponse(
        request,
        400,
        "INVALID_JUDGE_RESULT",
        "The signed execution callback has an invalid execution ID.",
      );
    if (
      request.headers.get("idempotency-key") !==
      `judge-execution-result:${executionId}`
    )
      return errorResponse(
        request,
        400,
        "INVALID_IDEMPOTENCY_KEY",
        "The execution callback idempotency key is invalid.",
      );
    const customSettlement = await settleTrustedCustomRunResult(
      request,
      env,
      decoded,
      executionId,
      body,
    );
    if (customSettlement) return customSettlement;
    return errorResponse(
      request,
      404,
      "CUSTOM_RUN_NOT_FOUND",
      "That pending custom execution does not exist.",
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
  if (!row) {
    const exampleSettlement = await settleTrustedExampleRunResult(
      request,
      env,
      decoded,
      submissionId,
      body,
    );
    if (exampleSettlement) return exampleSettlement;
    return errorResponse(
      request,
      404,
      "SUBMISSION_NOT_FOUND",
      "That pending trusted submission does not exist.",
    );
  }
  let judgeSpec: unknown;
  try {
    judgeSpec = JSON.parse(row.judge_payload_json);
  } catch {
    throw new Error("INVALID_TRUSTED_ASSIGNMENT_SECRET");
  }
  if (!isRecord(judgeSpec) || !Array.isArray(judgeSpec.cases))
    throw new Error("INVALID_TRUSTED_ASSIGNMENT_SECRET");
  if (
    (judgeSpec.language !== "python" && judgeSpec.language !== "swift") ||
    typeof judgeSpec.runtime !== "string" ||
    judgeSpec.contentRevision !== row.content_revision ||
    judgeSpec.judgeRevision !== row.judge_revision
  )
    throw new Error("INVALID_TRUSTED_ASSIGNMENT_SECRET");
  const contractDigest = await trustedJudgeContractDigest(
    judgeSpec as ReturnType<typeof privateJudgeSpec>,
  );
  const result = normalizeTrustedGatewayResult(
    decoded,
    submissionId,
    {
      total: judgeSpec.cases.length,
      language: judgeSpec.language,
      runtime: judgeSpec.runtime,
      contentRevision: row.content_revision,
      judgeRevision: row.judge_revision,
      contractDigest,
    },
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
    authority:
      result.language === "swift"
        ? "server-isolated-swift"
        : "server-isolated-python",
    language: result.language,
    runtime: result.runtime,
    contentRevision: result.contentRevision,
    judgeRevision: result.judgeRevision,
    contractDigest: result.contractDigest,
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
      progressSync: hasCommunityDatabase(env),
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
  if (path === "/progress/snapshot" && request.method === "GET")
    return getProgressSnapshot(request, env);
  if (path === "/progress/snapshot" && request.method === "PUT")
    return putProgressSnapshot(request, env);
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
  const trustedExampleRunMatch = path.match(
    /^\/trusted\/assignments\/([^/]+)\/example-runs$/,
  );
  if (trustedExampleRunMatch && request.method === "POST")
    return runTrustedAssignmentExamples(
      request,
      env,
      trustedExampleRunMatch[1],
    );
  const trustedCustomRunMatch = path.match(
    /^\/trusted\/assignments\/([^/]+)\/custom-runs$/,
  );
  if (trustedCustomRunMatch && request.method === "POST")
    return runTrustedAssignmentCustomCases(
      request,
      env,
      trustedCustomRunMatch[1],
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
            runtimeEnv.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await runtimeEnv.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    return handler.fetch(request, runtimeEnv, ctx);
  },
};

export default worker;
