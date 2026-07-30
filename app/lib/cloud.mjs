import { normalizeStudyWorkspace } from "./study-plans.mjs";

const API_ROOT = "/api/v1";
const MAX_RESPONSE_CHARACTERS = 512_000;
const MAX_ATTEMPT_BATCH = 100;
const MAX_LIST_ENTRIES = 100;
const MAX_STUDY_WORKSPACE_BYTES = 256 * 1024;
const MAX_TRUSTED_SOURCE_BYTES = 40_000;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function finiteNumber(value, fallback, min, max, integer = false) {
  const number =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const bounded = Math.min(max, Math.max(min, number));
  return integer ? Math.round(bounded) : bounded;
}

function cleanString(value, maxLength, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function optionalString(value, maxLength) {
  const cleaned = cleanString(value, maxLength);
  return cleaned || undefined;
}

function isoDateTime(value) {
  const cleaned = cleanString(value, 40);
  if (!cleaned || Number.isNaN(Date.parse(cleaned))) return undefined;
  return new Date(cleaned).toISOString();
}

function dayKey(value) {
  const cleaned = cleanString(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return undefined;
  const date = new Date(`${cleaned}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === cleaned
    ? cleaned
    : undefined;
}

function itemId(value) {
  const cleaned = cleanString(value, 96);
  return /^(?:builtin:\d{1,8}|python:\d{1,8}|ios:[a-z0-9][a-z0-9-]{0,79})$/i.test(
    cleaned,
  )
    ? cleaned
    : undefined;
}

function handle(value) {
  const cleaned = cleanString(value, 24).toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/.test(cleaned) &&
    !cleaned.includes("--")
    ? cleaned
    : undefined;
}

function id(value, maxLength = 128) {
  const cleaned = cleanString(value, maxLength);
  return /^[\w:.-]+$/.test(cleaned) ? cleaned : undefined;
}

function unwrapData(payload) {
  return isRecord(payload) && Object.hasOwn(payload, "data")
    ? payload.data
    : payload;
}

function unavailable(reason, status, retryAfterSeconds) {
  return {
    available: false,
    reason,
    ...(typeof status === "number" ? { status } : {}),
    ...(typeof retryAfterSeconds === "number" ? { retryAfterSeconds } : {}),
  };
}

function responseFailure(response, notFoundReason) {
  const retryAfter = Number(response.headers?.get?.("retry-after"));
  if (response.status === 401 || response.status === 403)
    return unavailable("unauthorized", response.status);
  if (response.status === 404 && notFoundReason)
    return unavailable(notFoundReason, response.status);
  if (
    response.status === 404 ||
    response.status === 405 ||
    response.status === 501
  )
    return unavailable("unsupported", response.status);
  if (response.status === 408 || response.status === 429) {
    return unavailable(
      "rate-limited",
      response.status,
      Number.isFinite(retryAfter)
        ? Math.min(86_400, Math.max(0, retryAfter))
        : undefined,
    );
  }
  return unavailable(
    response.status >= 500 ? "server-error" : "request-failed",
    response.status,
  );
}

function normalizeRoot(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return API_ROOT;
  const root = value.replace(/\/+$/, "");
  return root || API_ROOT;
}

function isStaticGitHubPages(location) {
  const hostname = cleanString(location?.hostname, 253).toLowerCase();
  return hostname === "github.io" || hostname.endsWith(".github.io");
}

async function readJson(response) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RESPONSE_CHARACTERS
  )
    return undefined;
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (
    contentType &&
    !/\b(?:application|text)\/[^;]*(?:json|problem\+json)\b/i.test(contentType)
  )
    return undefined;
  const text = await response.text();
  if (!text || text.length > MAX_RESPONSE_CHARACTERS) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function normalizePublicUser(value) {
  if (!isRecord(value)) return null;
  const rawDisplayName = cleanString(value.displayName ?? value.name, 50);
  return rawDisplayName ? { displayName: rawDisplayName } : null;
}

function normalizeSessionUser(value) {
  if (!isRecord(value)) return null;
  const displayName = cleanString(value.displayName ?? value.name, 50);
  const email = cleanString(value.email, 254).toLowerCase();
  const userId = id(value.id, 96);
  if (!displayName && !email && !userId) return null;
  return {
    ...(userId ? { id: userId } : {}),
    displayName: displayName || "Swift learner",
    ...(email ? { email } : {}),
  };
}

function normalizeProfile(value) {
  const raw =
    isRecord(value) && isRecord(value.profile) ? value.profile : value;
  if (!isRecord(raw)) return null;
  const normalizedHandle = handle(raw.handle);
  if (!normalizedHandle) return null;
  const displayName = optionalString(raw.displayName ?? raw.name, 48);
  const bio = optionalString(raw.bio, 160);
  const timezone = optionalString(raw.timezone, 64);
  const createdAt = isoDateTime(raw.createdAt);
  const updatedAt = isoDateTime(raw.updatedAt);
  return {
    handle: normalizedHandle,
    displayName: displayName ?? null,
    bio: bio ?? null,
    timezone: timezone ?? null,
    isPublic: raw.isPublic === true,
    shareActivity: raw.shareActivity === true,
    showOnLeaderboards: raw.showOnLeaderboards === true,
    shareCommunity: raw.shareCommunity === true,
    persisted: raw.persisted === true,
    ...(createdAt ? { createdAt } : {}),
    updatedAt: updatedAt ?? null,
  };
}

function normalizePublicProfile(value) {
  const raw =
    isRecord(value) && isRecord(value.profile) ? value.profile : value;
  if (!isRecord(raw)) return undefined;
  const normalizedHandle = handle(raw.handle);
  if (!normalizedHandle) return undefined;
  const displayName = optionalString(raw.displayName, 48);
  const bio = optionalString(raw.bio, 160);
  const createdAt = isoDateTime(raw.createdAt);
  const stats = isRecord(raw.stats)
    ? {
        completedAttempts: finiteNumber(
          raw.stats.completedAttempts,
          0,
          0,
          1_000_000,
          true,
        ),
        highestStage: finiteNumber(raw.stats.highestStage, 0, 0, 5, true),
      }
    : { completedAttempts: 0, highestStage: 0 };
  return {
    handle: normalizedHandle,
    displayName: displayName ?? null,
    bio: bio ?? null,
    stats,
    ...(createdAt ? { createdAt } : {}),
  };
}

function normalizeCapabilities(value) {
  if (!isRecord(value)) return undefined;
  const apiVersion = cleanString(value.apiVersion ?? value.version, 16, "v1");
  const authValues = new Set(["none", "anonymous", "session"]);
  const auth = authValues.has(value.auth) ? value.auth : "none";
  const privacy = isRecord(value.privacy)
    ? {
        profileDefault:
          value.privacy.profileDefault === "private" ? "private" : "private",
        activityDefault:
          value.privacy.activityDefault === "off" ? "off" : "off",
        leaderboardsDefault:
          value.privacy.leaderboardsDefault === "off" ? "off" : "off",
      }
    : {
        profileDefault: "private",
        activityDefault: "off",
        leaderboardsDefault: "off",
      };
  return {
    apiVersion,
    cloudSync: value.cloudSync === true,
    studySync: value.studySync === true,
    community: value.community === true,
    leaderboards: value.leaderboards === true,
    trustedAssessments: value.trustedAssessments === true,
    auth,
    maxAttemptBatch: finiteNumber(
      value.maxAttemptBatch,
      MAX_ATTEMPT_BATCH,
      1,
      MAX_ATTEMPT_BATCH,
      true,
    ),
    privacy,
  };
}

function jsonByteLength(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function normalizeStudySnapshot(value) {
  const raw = isRecord(value) && Object.hasOwn(value, "workspace")
    ? value.workspace
    : value;
  if (raw === null) return null;
  if (!isRecord(raw) || raw.version !== 1) return undefined;
  const revision = raw.revision;
  const updatedAt = isoDateTime(raw.updatedAt);
  if (
    !Number.isInteger(revision) ||
    revision < 1 ||
    revision > 2_147_483_647 ||
    !updatedAt ||
    jsonByteLength(raw) > MAX_STUDY_WORKSPACE_BYTES
  )
    return undefined;
  try {
    const workspace = normalizeStudyWorkspace(raw, { now: updatedAt });
    if (
      workspace.revision !== revision ||
      workspace.updatedAt !== updatedAt ||
      jsonByteLength(workspace) > MAX_STUDY_WORKSPACE_BYTES
    )
      return undefined;
    return workspace;
  } catch {
    return undefined;
  }
}

function sanitizeStudyWorkspace(value) {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    jsonByteLength(value) > MAX_STUDY_WORKSPACE_BYTES
  )
    return undefined;
  try {
    const workspace = normalizeStudyWorkspace(value, {
      now: isoDateTime(value.updatedAt) ?? new Date(0).toISOString(),
    });
    return jsonByteLength(workspace) <= MAX_STUDY_WORKSPACE_BYTES
      ? workspace
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeStudyConflict(value) {
  const raw = unwrapData(value);
  if (!isRecord(raw) || !isRecord(raw.error)) return undefined;
  if (raw.error.code !== "REVISION_CONFLICT" || !isRecord(raw.current))
    return undefined;
  const revision = raw.current.revision;
  if (
    !Number.isInteger(revision) ||
    revision < 0 ||
    revision > 2_147_483_647
  )
    return undefined;
  const workspace = normalizeStudySnapshot(raw.current.workspace);
  if (workspace === undefined || (workspace === null && revision !== 0))
    return undefined;
  if (workspace && workspace.revision !== revision) return undefined;
  return { revision, workspace };
}

function normalizeTrustedCase(value) {
  if (!isRecord(value)) return undefined;
  const caseId = id(value.id, 96);
  const name = cleanString(value.name, 120);
  if (!caseId || !name || !Array.isArray(value.args) || !Object.hasOwn(value, "expected"))
    return undefined;
  return {
    id: caseId,
    name,
    args: value.args,
    expected: value.expected,
  };
}

function normalizeTrustedChallenge(value) {
  if (!isRecord(value)) return undefined;
  const key = id(value.key, 96);
  const title = cleanString(value.title, 120);
  const summary = cleanString(value.summary, 600);
  const prompt = cleanString(value.prompt, 4_000);
  const starterCode = typeof value.starterCode === "string"
    ? value.starterCode.replace(/\r\n?/g, "\n").slice(0, 16_000)
    : "";
  const language = value.language === "swift"
    ? "swift"
    : value.language === "python"
      ? "python"
      : null;
  const runtime = cleanString(value.runtime, 80);
  const contentRevision = finiteNumber(value.contentRevision, 0, 0, 1_000_000, true);
  const judgeRevision = finiteNumber(value.judgeRevision, 0, 0, 1_000_000, true);
  const parameters = isRecord(value.entrypoint) && Array.isArray(value.entrypoint.parameters)
    ? value.entrypoint.parameters.flatMap((parameter) =>
        isRecord(parameter) && id(parameter.name, 64) && cleanString(parameter.type, 32)
          ? [{ name: id(parameter.name, 64), type: cleanString(parameter.type, 32) }]
          : []
      ).slice(0, 8)
    : [];
  const entrypoint = isRecord(value.entrypoint) && value.entrypoint.kind === "function"
    ? {
        kind: "function",
        name: id(value.entrypoint.name, 96),
        ...(parameters.length ? { parameters } : {}),
        ...(cleanString(value.entrypoint.returns, 32)
          ? { returns: cleanString(value.entrypoint.returns, 32) }
          : {}),
      }
    : null;
  const samples = Array.isArray(value.samples)
    ? value.samples.flatMap((entry) => {
        const normalized = normalizeTrustedCase(entry);
        return normalized ? [normalized] : [];
      }).slice(0, 8)
    : [];
  if (
    !key ||
    !title ||
    !summary ||
    !prompt ||
    !starterCode ||
    !language ||
    !runtime ||
    contentRevision < 1 ||
    judgeRevision < 1 ||
    !entrypoint?.name ||
    samples.length < 1
  )
    return undefined;
  return {
    key,
    language,
    runtime,
    contentRevision,
    judgeRevision,
    title,
    difficulty: value.difficulty === "Easy" ? "Easy" : "Medium",
    estimatedMinutes: finiteNumber(value.estimatedMinutes, 15, 5, 60, true),
    summary,
    prompt,
    constraints: Array.isArray(value.constraints)
      ? value.constraints.map((entry) => cleanString(entry, 300)).filter(Boolean).slice(0, 12)
      : [],
    tags: Array.isArray(value.tags)
      ? value.tags.map((entry) => cleanString(entry, 40)).filter(Boolean).slice(0, 12)
      : [],
    starterCode,
    entrypoint,
    samples,
  };
}

function normalizeTrustedSubmission(value, challenge) {
  const raw = isRecord(value) && isRecord(value.submission)
    ? value.submission
    : value;
  if (!isRecord(raw)) return undefined;
  const submissionId = id(raw.id, 96);
  const submittedAt = isoDateTime(raw.submittedAt);
  if (!submissionId || !submittedAt) return undefined;
  const status = raw.status === "pending" ? "pending" : raw.status === "settled" ? "settled" : null;
  if (!status) return undefined;
  if (status === "pending") {
    return {
      id: submissionId,
      status,
      verdict: null,
      submittedAt,
      settledAt: null,
      result: null,
    };
  }
  const verdicts = new Set([
    "accepted",
    "wrong-answer",
    "compile-error",
    "runtime-error",
    "time-limit",
    "judge-error",
  ]);
  const settledAt = isoDateTime(raw.settledAt);
  if (!verdicts.has(raw.verdict) || !settledAt || !isRecord(raw.result))
    return undefined;
  const total = finiteNumber(raw.result.total, 0, 0, 1_000, true);
  const passed = finiteNumber(raw.result.passed, 0, 0, total, true);
  const authority = raw.result.authority === "server-isolated-python"
    ? "server-isolated-python"
    : raw.result.authority === "server-isolated-swift"
      ? "server-isolated-swift"
      : undefined;
  const language = raw.result.language === "swift"
    ? "swift"
    : raw.result.language === "python"
      ? "python"
      : raw.result.authority === "server-isolated-python"
        ? "python"
        : undefined;
  const runtime = cleanString(raw.result.runtime, 80)
    || (language === "python" ? "python-3.13-linux" : "");
  const contractDigest = typeof raw.result.contractDigest === "string" && /^[a-f0-9]{64}$/.test(raw.result.contractDigest)
    ? raw.result.contractDigest
    : undefined;
  if (
    total < 1 ||
    !authority ||
    !language ||
    !runtime ||
    (language === "swift") !== (authority === "server-isolated-swift")
  ) return undefined;
  return {
    id: submissionId,
    status,
    verdict: raw.verdict,
    submittedAt,
    settledAt,
    result: {
      passed,
      total,
      authority,
      language,
      runtime,
      ...(contractDigest ? { contractDigest } : {}),
      contentRevision: finiteNumber(
        raw.result.contentRevision,
        challenge?.contentRevision ?? 1,
        1,
        1_000_000,
        true,
      ),
      judgeRevision: finiteNumber(
        raw.result.judgeRevision,
        challenge?.judgeRevision ?? 1,
        1,
        1_000_000,
        true,
      ),
    },
  };
}

function normalizeTrustedAssignment(value) {
  const raw = isRecord(value) && isRecord(value.assignment)
    ? value.assignment
    : value;
  if (!isRecord(raw)) return undefined;
  const assignmentId = id(raw.id, 96);
  const assignedAt = isoDateTime(raw.assignedAt);
  const expiresAt = isoDateTime(raw.expiresAt);
  const challenge = normalizeTrustedChallenge(raw.challenge);
  const statuses = new Set(["active", "accepted", "expired"]);
  const program = isRecord(raw.program) ? raw.program : {};
  const programId = id(program.id, 96);
  const programLanguage = program.language === "swift"
    ? "swift"
    : program.language === "python"
      ? "python"
      : null;
  if (
    !assignmentId ||
    !assignedAt ||
    !expiresAt ||
    !challenge ||
    !statuses.has(raw.status) ||
    !programId ||
    !programLanguage ||
    programLanguage !== challenge.language ||
    Date.parse(expiresAt) <= Date.parse(assignedAt)
  )
    return undefined;
  const latestSubmission = raw.latestSubmission === null || raw.latestSubmission === undefined
    ? null
    : normalizeTrustedSubmission(raw.latestSubmission, challenge);
  if (raw.latestSubmission && !latestSubmission) return undefined;
  if (
    latestSubmission?.status === "settled" &&
    latestSubmission.result?.language !== challenge.language
  ) return undefined;
  return {
    id: assignmentId,
    program: {
      id: programId,
      revision: finiteNumber(program.revision, 1, 1, 1_000_000, true),
      title: cleanString(program.title, 120, "Verified Python checkpoint"),
      evidenceLabel: cleanString(program.evidenceLabel, 120, "Server-verified code evidence"),
      language: programLanguage,
    },
    challenge,
    status: raw.status,
    assignedAt,
    expiresAt,
    latestSubmission,
  };
}

function normalizeTrustedAssignmentList(value) {
  if (!isRecord(value) || !Array.isArray(value.entries)) return undefined;
  const entries = value.entries.flatMap((entry) => {
    const assignment = normalizeTrustedAssignment(entry);
    return assignment ? [assignment] : [];
  }).slice(0, 50);
  const program = isRecord(value.program)
    ? {
        id: id(value.program.id, 96),
        revision: finiteNumber(value.program.revision, 1, 1, 1_000_000, true),
        title: cleanString(value.program.title, 120),
        description: cleanString(value.program.description, 600),
        evidenceLabel: cleanString(value.program.evidenceLabel, 120),
        language: value.program.language === "mixed" ? "mixed" : undefined,
      }
    : null;
  if (!program?.id || !program.title || program.language !== "mixed") return undefined;
  return { program, entries };
}

function trustedClientId(value) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (cleaned.length > 128) return undefined;
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(cleaned)
    ? cleaned
    : undefined;
}

function trustedSource(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\r\n?/g, "\n");
  const bytes = new TextEncoder().encode(normalized).byteLength;
  return bytes >= 1 && bytes <= MAX_TRUSTED_SOURCE_BYTES
    ? normalized
    : undefined;
}

function normalizeSession(value) {
  if (!isRecord(value)) return undefined;
  const user = normalizeSessionUser(value.user);
  const profile = normalizeProfile(value.profile);
  if (value.authenticated === true && !user?.id)
    return { authenticated: false, user: null, profile: null };
  return {
    authenticated: value.authenticated === true,
    user,
    profile,
  };
}

function sanitizeProfilePatch(value) {
  if (!isRecord(value)) return undefined;
  const patch = {};
  if (typeof value.handle === "string") {
    const normalizedHandle = handle(value.handle);
    if (normalizedHandle) patch.handle = normalizedHandle;
  }
  if (typeof value.displayName === "string")
    patch.displayName = cleanString(value.displayName, 48) || null;
  if (typeof value.bio === "string")
    patch.bio = cleanString(value.bio, 160) || null;
  if (typeof value.isPublic === "boolean") patch.isPublic = value.isPublic;
  if (typeof value.shareActivity === "boolean")
    patch.shareActivity = value.shareActivity;
  if (typeof value.showOnLeaderboards === "boolean")
    patch.showOnLeaderboards = value.showOnLeaderboards;
  if (typeof value.shareCommunity === "boolean")
    patch.shareCommunity = value.shareCommunity;
  if (typeof value.timezone === "string") {
    const timezone = cleanString(value.timezone, 64);
    if (timezone) patch.timezone = timezone;
  }
  return Object.keys(patch).length ? patch : undefined;
}

function sanitizeAttempt(value) {
  if (!isRecord(value)) return undefined;
  const attemptId = id(value.id);
  const normalizedItemId = itemId(value.itemId);
  const startedAt = isoDateTime(value.startedAt);
  const completedAt = isoDateTime(value.completedAt);
  if (!attemptId || !normalizedItemId || !startedAt || !completedAt)
    return undefined;
  if (value.mode !== "strict" && value.mode !== "free") return undefined;
  if (value.outcome !== undefined && value.outcome !== "completed")
    return undefined;
  if (
    !Number.isInteger(value.itemRevision) ||
    value.itemRevision < 1 ||
    value.itemRevision > 1_000_000
  )
    return undefined;
  if (!Number.isInteger(value.stage) || value.stage < 1 || value.stage > 5)
    return undefined;
  if (
    !Number.isInteger(value.durationMs) ||
    value.durationMs < 250 ||
    value.durationMs > 14_400_000
  )
    return undefined;
  const typedChars = value.typedChars ?? value.totalKeystrokes;
  if (!Number.isInteger(typedChars) || typedChars < 1 || typedChars > 100_000)
    return undefined;
  if (
    typeof value.accuracy !== "number" ||
    !Number.isFinite(value.accuracy) ||
    value.accuracy < 0 ||
    value.accuracy > 100
  )
    return undefined;
  const peeks = value.peeks ?? 0;
  if (!Number.isInteger(peeks) || peeks < 0 || peeks > 100_000)
    return undefined;
  const track =
    value.track === "ios" || value.track === "interview"
      ? value.track
      : normalizedItemId.startsWith("ios:")
        ? "ios"
        : "interview";
  const itemTitle =
    cleanString(
      value.itemTitle ?? value.title ?? value.titleSnapshot,
      120,
      normalizedItemId,
    ) || normalizedItemId;
  const normalized = {
    id: attemptId,
    itemId: normalizedItemId,
    itemRevision: value.itemRevision,
    stage: value.stage,
    mode: value.mode,
    track,
    itemTitle,
    startedAt,
    completedAt,
    durationMs: value.durationMs,
    typedChars,
    correctKeystrokes: finiteNumber(
      value.correctKeystrokes,
      typedChars,
      0,
      typedChars,
      true,
    ),
    peeks,
    accuracy: value.accuracy,
    outcome: "completed",
  };
  const challengeDate = dayKey(value.challengeDate);
  const sessionId = id(value.sessionId);
  return {
    ...normalized,
    ...(challengeDate ? { challengeDate } : {}),
    ...(sessionId ? { sessionId } : {}),
  };
}

function sanitizeAttemptBatch(values, maximum = MAX_ATTEMPT_BATCH) {
  if (!Array.isArray(values)) return [];
  const unique = new Map();
  for (const value of values) {
    const attempt = sanitizeAttempt(value);
    if (attempt && !unique.has(attempt.id)) unique.set(attempt.id, attempt);
    if (unique.size >= Math.min(MAX_ATTEMPT_BATCH, Math.max(1, maximum))) break;
  }
  return [...unique.values()];
}

function normalizeBatchReceipt(value) {
  if (!isRecord(value)) return undefined;
  const accepted = Array.isArray(value.accepted)
    ? value.accepted
        .map((entry) => id(entry))
        .filter(Boolean)
        .slice(0, MAX_ATTEMPT_BATCH)
    : [];
  const duplicates = Array.isArray(value.duplicates)
    ? value.duplicates
        .map((entry) => id(entry))
        .filter(Boolean)
        .slice(0, MAX_ATTEMPT_BATCH)
    : [];
  const rejected = Array.isArray(value.rejected)
    ? value.rejected
        .flatMap((entry) => {
          if (!isRecord(entry)) return [];
          const rejectedId = id(entry.id);
          const code = cleanString(entry.code, 50);
          if (!rejectedId || !code) return [];
          const message = optionalString(entry.message, 200);
          return [{ id: rejectedId, code, ...(message ? { message } : {}) }];
        })
        .slice(0, MAX_ATTEMPT_BATCH)
    : [];
  const serverTime = isoDateTime(value.serverTime);
  return {
    accepted,
    duplicates,
    rejected,
    ...(serverTime ? { serverTime } : {}),
  };
}

function normalizeCommunityEntry(value) {
  if (!isRecord(value)) return undefined;
  const normalizedItemId = itemId(value.itemId);
  const completedAt = isoDateTime(value.completedAt);
  const user = normalizePublicUser(value.user ?? value);
  if (!normalizedItemId || !completedAt || !user) return undefined;
  const itemTitle = optionalString(value.itemTitle, 100);
  if (!itemTitle) return undefined;
  return {
    user,
    itemId: normalizedItemId,
    itemRevision: finiteNumber(value.itemRevision, 1, 1, 1_000_000, true),
    track: value.track === "ios" ? "ios" : "interview",
    ...(itemTitle ? { itemTitle } : {}),
    stage: finiteNumber(value.stage, 1, 1, 5, true),
    wpm: finiteNumber(value.wpm, 0, 0, 1_000),
    accuracy: finiteNumber(value.accuracy, 0, 0, 100),
    durationMs: finiteNumber(value.durationMs, 0, 0, 14_400_000, true),
    completedAt,
  };
}

function normalizeItemLeaderboardEntry(value, fallbackRank) {
  if (!isRecord(value)) return undefined;
  const user = normalizePublicUser(value.user ?? value);
  const completedAt = isoDateTime(value.completedAt);
  if (!user || !completedAt) return undefined;
  const normalizedItemRevision =
    typeof value.itemRevision === "number"
      ? finiteNumber(value.itemRevision, 1, 1, 1_000_000, true)
      : undefined;
  return {
    rank: finiteNumber(value.rank, fallbackRank, 1, 1_000_000, true),
    user,
    wpm: finiteNumber(value.wpm, 0, 0, 1_000),
    accuracy: finiteNumber(value.accuracy, 0, 0, 100),
    stage: finiteNumber(value.stage, 1, 1, 5, true),
    durationMs: finiteNumber(value.durationMs, 0, 0, 14_400_000, true),
    completedAt,
    ...(normalizedItemRevision !== undefined
      ? { itemRevision: normalizedItemRevision }
      : {}),
  };
}

function normalizeDailyLeaderboardEntry(value, fallbackRank) {
  if (!isRecord(value)) return undefined;
  const user = normalizePublicUser(value.user ?? value);
  if (!user) return undefined;
  return {
    rank: finiteNumber(value.rank, fallbackRank, 1, 1_000_000, true),
    user,
    score: finiteNumber(value.score, 0, 0, 1_000_000),
    completions: finiteNumber(
      value.completions ?? value.completed ?? value.attempts,
      0,
      0,
      10_000,
      true,
    ),
    averageAccuracy: finiteNumber(
      value.averageAccuracy ?? value.accuracy,
      0,
      0,
      100,
    ),
    accuracy: finiteNumber(value.accuracy ?? value.averageAccuracy, 0, 0, 100),
    totalDurationMs: finiteNumber(
      value.totalDurationMs,
      0,
      0,
      86_400_000,
      true,
    ),
    highestStage: finiteNumber(value.highestStage, 1, 1, 5, true),
    wpm: finiteNumber(value.wpm, 0, 0, 1_000),
    completed: finiteNumber(value.completed, 0, 0, 10_000, true),
    minutes: finiteNumber(value.minutes, 0, 0, 1_440),
  };
}

function normalizeDailyChallenge(value, fallbackDate) {
  if (!isRecord(value)) return undefined;
  const date = dayKey(value.date) ?? fallbackDate;
  const normalizedItemId = itemId(value.itemId);
  const itemTitle = cleanString(value.itemTitle ?? value.title, 120);
  if (
    !date ||
    !normalizedItemId ||
    !itemTitle ||
    value.stage !== 1 ||
    value.mode !== "strict"
  )
    return undefined;
  return {
    date,
    itemId: normalizedItemId,
    itemRevision: finiteNumber(value.itemRevision, 1, 1, 1_000_000, true),
    itemTitle,
    track: value.track === "ios" ? "ios" : "interview",
    stage: 1,
    mode: "strict",
  };
}

function normalizeList(value, entryNormalizer, limit) {
  if (!isRecord(value) || !Array.isArray(value.entries)) return undefined;
  const entries = value.entries
    .flatMap((entry, index) => {
      const normalized = entryNormalizer(entry, index + 1);
      return normalized ? [normalized] : [];
    })
    .slice(0, Math.min(limit, MAX_LIST_ENTRIES));
  const nextCursor = optionalString(value.nextCursor, 200);
  return { entries, ...(nextCursor ? { nextCursor } : {}) };
}

function listLimit(value, fallback, max = MAX_LIST_ENTRIES) {
  return finiteNumber(value, fallback, 1, max, true);
}

/**
 * Creates a quiet, same-origin API client. Static GitHub Pages builds are
 * intentionally disabled; all other unavailable transports resolve to a
 * discriminated result instead of logging or rejecting.
 */
export function createCloudClient(options = {}) {
  const root = normalizeRoot(options.apiRoot);
  const runtimeLocation = options.location ?? globalThis.location;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const disabled =
    options.disabled === true || isStaticGitHubPages(runtimeLocation);

  async function request(path, init, normalize) {
    if (disabled) return unavailable("disabled");
    if (typeof fetchImpl !== "function") return unavailable("unsupported");
    try {
      const response = await fetchImpl(`${root}${path}`, {
        method: init.method ?? "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          accept: "application/json",
          ...(init.body === undefined
            ? {}
            : { "content-type": "application/json" }),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        ...(init.signal ? { signal: init.signal } : {}),
      });
      if (!response.ok) {
        if (response.status === 409 && init.normalizeConflict) {
          const payload = await readJson(response);
          const conflict = init.normalizeConflict(payload);
          if (conflict !== undefined)
            return {
              available: false,
              reason: "revision-conflict",
              status: response.status,
              conflict,
            };
        }
        return responseFailure(response, init.notFoundReason);
      }
      const payload = await readJson(response);
      if (payload === undefined)
        return unavailable("invalid-response", response.status);
      const data = normalize(unwrapData(payload));
      return data === undefined
        ? unavailable("invalid-response", response.status)
        : { available: true, data, status: response.status };
    } catch (error) {
      if (
        init.signal?.aborted ||
        (error && typeof error === "object" && error.name === "AbortError")
      )
        return unavailable("aborted");
      return unavailable("offline");
    }
  }

  return {
    capabilities({ signal } = {}) {
      return request("/capabilities", { signal }, normalizeCapabilities);
    },
    session({ signal } = {}) {
      return request("/session", { signal }, normalizeSession);
    },
    getStudyWorkspace({ signal } = {}) {
      return request("/study/workspace", { signal }, (value) => {
        const workspace = normalizeStudySnapshot(value);
        return workspace === undefined ? undefined : workspace;
      });
    },
    putStudyWorkspace(workspaceInput, { baseRevision, signal } = {}) {
      const workspace = sanitizeStudyWorkspace(workspaceInput);
      if (
        !workspace ||
        !Number.isInteger(baseRevision) ||
        baseRevision < 0 ||
        baseRevision > 2_147_483_646
      )
        return Promise.resolve(unavailable("invalid-request"));
      return request(
        "/study/workspace",
        {
          method: "PUT",
          body: { baseRevision, workspace },
          signal,
          normalizeConflict: normalizeStudyConflict,
        },
        (value) => {
          const snapshot = normalizeStudySnapshot(value);
          return snapshot === undefined || snapshot === null
            ? undefined
            : snapshot;
        },
      );
    },
    trustedAssignments({ limit = 20, signal } = {}) {
      const boundedLimit = listLimit(limit, 20, 50);
      return request(
        `/trusted/assignments?limit=${boundedLimit}`,
        { signal },
        normalizeTrustedAssignmentList,
      );
    },
    issueTrustedAssignment(clientRequestIdInput, { signal, language = "python" } = {}) {
      const clientRequestId = trustedClientId(clientRequestIdInput);
      return clientRequestId && (language === "python" || language === "swift")
        ? request(
            "/trusted/assignments",
            { method: "POST", body: { clientRequestId, language }, signal },
            normalizeTrustedAssignment,
          )
        : Promise.resolve(unavailable("invalid-request"));
    },
    submitTrustedAssignment(
      assignmentIdInput,
      submissionInput,
      { signal } = {},
    ) {
      const assignmentId = trustedClientId(assignmentIdInput);
      const clientSubmissionId = trustedClientId(submissionInput?.clientSubmissionId);
      const source = trustedSource(submissionInput?.source);
      return assignmentId && clientSubmissionId && source
        ? request(
            `/trusted/assignments/${encodeURIComponent(assignmentId)}/submissions`,
            {
              method: "POST",
              body: { clientSubmissionId, source },
              signal,
            },
            normalizeTrustedSubmission,
          )
        : Promise.resolve(unavailable("invalid-request"));
    },
    patchProfile(patch, { signal } = {}) {
      const body = sanitizeProfilePatch(patch);
      return body
        ? request(
            "/profile",
            { method: "PATCH", body, signal },
            (value) => normalizeProfile(value) ?? undefined,
          )
        : Promise.resolve(unavailable("invalid-request"));
    },
    publicProfile(requestedHandle, { signal } = {}) {
      const normalizedHandle = handle(requestedHandle);
      if (!normalizedHandle)
        return Promise.resolve(unavailable("invalid-request"));
      return request(
        `/profiles/${encodeURIComponent(normalizedHandle)}`,
        { signal, notFoundReason: "not-public" },
        normalizePublicProfile,
      );
    },
    postAttemptBatch(attempts, { signal, maximum } = {}) {
      const body = sanitizeAttemptBatch(
        attempts,
        finiteNumber(maximum, MAX_ATTEMPT_BATCH, 1, MAX_ATTEMPT_BATCH, true),
      );
      return body.length
        ? request(
            "/attempts/batch",
            { method: "POST", body: { attempts: body }, signal },
            normalizeBatchReceipt,
          )
        : Promise.resolve(unavailable("invalid-request"));
    },
    communityRecent({ limit = 20, cursor, signal } = {}) {
      const boundedLimit = listLimit(limit, 20, 50);
      const search = new URLSearchParams({ limit: String(boundedLimit) });
      const boundedCursor = optionalString(cursor, 200);
      if (boundedCursor) search.set("cursor", boundedCursor);
      return request(`/community/recent?${search}`, { signal }, (value) =>
        normalizeList(value, normalizeCommunityEntry, boundedLimit),
      );
    },
    itemLeaderboard(
      requestedItemId,
      { limit = 25, cursor, itemRevision, stage, signal } = {},
    ) {
      const normalizedItemId = itemId(requestedItemId);
      if (!normalizedItemId)
        return Promise.resolve(unavailable("invalid-request"));
      const requestedRevision =
        itemRevision === undefined
          ? undefined
          : finiteNumber(itemRevision, 0, 1, 1_000_000, true);
      const requestedStage =
        stage === undefined ? undefined : finiteNumber(stage, 0, 1, 5, true);
      if (
        (itemRevision !== undefined && requestedRevision !== itemRevision) ||
        (stage !== undefined && requestedStage !== stage)
      )
        return Promise.resolve(unavailable("invalid-request"));
      const boundedLimit = listLimit(limit, 25);
      const search = new URLSearchParams({ limit: String(boundedLimit) });
      if (requestedRevision !== undefined)
        search.set("itemRevision", String(requestedRevision));
      if (requestedStage !== undefined)
        search.set("stage", String(requestedStage));
      search.set("mode", "strict");
      const boundedCursor = optionalString(cursor, 200);
      if (boundedCursor) search.set("cursor", boundedCursor);
      return request(
        `/leaderboards/items/${encodeURIComponent(normalizedItemId)}?${search}`,
        { signal },
        (value) => {
          if (
            (requestedRevision !== undefined || requestedStage !== undefined) &&
            (itemId(value.itemId) !== normalizedItemId ||
              (requestedRevision !== undefined &&
                value.itemRevision !== requestedRevision) ||
              (requestedStage !== undefined && value.stage !== requestedStage))
          )
            return undefined;
          const list = normalizeList(
            value,
            normalizeItemLeaderboardEntry,
            boundedLimit,
          );
          if (!list) return undefined;
          const responseItemId = itemId(value.itemId) ?? normalizedItemId;
          const responseRevision = finiteNumber(
            value.itemRevision,
            1,
            1,
            1_000_000,
            true,
          );
          const responseStage = finiteNumber(value.stage, 1, 1, 5, true);
          if (
            responseItemId !== normalizedItemId ||
            (requestedRevision !== undefined &&
              responseRevision !== requestedRevision) ||
            (requestedStage !== undefined && responseStage !== requestedStage)
          )
            return undefined;
          const entries = list.entries.filter(
            (entry) =>
              (requestedRevision === undefined ||
                entry.itemRevision === requestedRevision) &&
              (requestedStage === undefined || entry.stage === requestedStage),
          );
          return {
            itemId: responseItemId,
            itemRevision: responseRevision,
            stage: responseStage,
            mode: "strict",
            ...list,
            entries,
          };
        },
      );
    },
    dailyLeaderboard(requestedDate, { limit = 25, cursor, signal } = {}) {
      const date = dayKey(requestedDate);
      if (!date) return Promise.resolve(unavailable("invalid-request"));
      const boundedLimit = listLimit(limit, 25);
      const search = new URLSearchParams({ date, limit: String(boundedLimit) });
      const boundedCursor = optionalString(cursor, 200);
      if (boundedCursor) search.set("cursor", boundedCursor);
      return request(`/leaderboards/daily?${search}`, { signal }, (value) => {
        const list = normalizeList(
          value,
          normalizeDailyLeaderboardEntry,
          boundedLimit,
        );
        if (!list) return undefined;
        const responseDate = dayKey(value.date) ?? date;
        const challenge = normalizeDailyChallenge(
          value.challenge,
          responseDate,
        );
        return challenge
          ? { date: responseDate, challenge, ...list }
          : undefined;
      });
    },
  };
}

export const CLOUD_LIMITS = Object.freeze({
  maxAttemptBatch: MAX_ATTEMPT_BATCH,
  maxListEntries: MAX_LIST_ENTRIES,
  maxStudyWorkspaceBytes: MAX_STUDY_WORKSPACE_BYTES,
});
