export const RUN_MANIFEST_VERSION = 1;

export const RUN_MANIFEST_MODES = Object.freeze(["practice", "timed"]);
export const RUN_MANIFEST_DURATIONS = Object.freeze([30, 45, 60, 75, 90, 105]);
export const RUN_MANIFEST_STATUSES = Object.freeze([
  "draft",
  "active",
  "completed",
  "ended",
  "archived",
]);
export const RUN_MANIFEST_SOURCES = Object.freeze([
  "catalog",
  "collection",
  "study-plan",
]);
export const RUN_MANIFEST_LIMITS = Object.freeze({
  minEntries: 2,
  maxEntries: 12,
  maxManifests: 100,
  maxIdBytes: 160,
  maxTitleBytes: 500,
  maxLaneBytes: 80,
  maxDifficultyBytes: 40,
  maxRevision: 1_000_000,
  maxEstimatedMinutes: 240,
});

const EXECUTION_KINDS = Object.freeze(["session", "virtual-round"]);
const FINISHED_STATUSES = new Set(["completed", "ended"]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function truncateUtf8(value, maxBytes) {
  let result = "";
  let used = 0;
  for (const character of String(value ?? "")) {
    const size = byteLength(character);
    if (used + size > maxBytes) break;
    result += character;
    used += size;
  }
  return result;
}

function boundedString(value, maxBytes) {
  return truncateUtf8(typeof value === "string" ? value : "", maxBytes).trim();
}

function boundedId(value) {
  const id = boundedString(value, RUN_MANIFEST_LIMITS.maxIdBytes);
  return id && !/[\u0000-\u001f\u007f]/u.test(id) ? id : null;
}

function positiveInteger(value, max = RUN_MANIFEST_LIMITS.maxRevision) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= max ? number : null;
}

function validIso(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function requiredNow(value) {
  const now = validIso(value);
  if (!now) throw new Error("A valid manifest time is required");
  return now;
}

function atOrAfter(value, minimum) {
  return Date.parse(value) >= Date.parse(minimum);
}

function registryValues(registry) {
  if (registry instanceof Map) return [...registry.values()];
  if (Array.isArray(registry)) return registry;
  return [];
}

function registryMap(registry) {
  const byId = new Map();
  for (const item of registryValues(registry)) {
    if (!isRecord(item)) continue;
    const itemId = boundedId(item.itemId);
    if (itemId && !byId.has(itemId)) byId.set(itemId, item);
  }
  return byId;
}

function isEligibleRegistryItem(item) {
  return Boolean(
    isRecord(item) &&
      boundedId(item.itemId) &&
      item.source === "builtin" &&
      !item.transfer &&
      !item.archivedAt &&
      positiveInteger(item.contentRevision),
  );
}

function laneFor(item) {
  const explicit = boundedString(item.lane, RUN_MANIFEST_LIMITS.maxLaneBytes);
  if (explicit) return explicit;
  if (item.track === "ios") return "ios";
  if (item.language === "python") return "python";
  return "swift";
}

function judgeRevisionFor(item) {
  if (Number.isInteger(item?.trustedJudgeRevision) && item.trustedJudgeRevision >= 1) {
    return item.trustedJudgeRevision;
  }
  if (!isRecord(item?.verification)) return null;
  return item.verification.revision === undefined
    ? 1
    : positiveInteger(item.verification.revision);
}

function normalizeExecution(value) {
  if (!isRecord(value) || !EXECUTION_KINDS.includes(value.kind)) return null;
  const id = boundedId(value.id);
  return id ? { kind: value.kind, id } : null;
}

function expectedExecutionKind(mode) {
  return mode === "timed" ? "virtual-round" : "session";
}

function executionMatchesMode(execution, mode) {
  return !execution || execution.kind === expectedExecutionKind(mode);
}

function normalizeModeDuration(mode, durationMinutes) {
  if (mode === "practice") return { mode, durationMinutes: null };
  if (mode === "timed" && RUN_MANIFEST_DURATIONS.includes(Number(durationMinutes))) {
    return { mode, durationMinutes: Number(durationMinutes) };
  }
  return null;
}

function isEntryCurrent(entry, item) {
  if (!isEligibleRegistryItem(item)) return false;
  if (Number(item.contentRevision) !== entry.contentRevision) return false;
  const currentJudgeRevision = judgeRevisionFor(item);
  return entry.judgeRevision === undefined
    ? currentJudgeRevision === null
    : currentJudgeRevision === entry.judgeRevision;
}

function snapshotRegistryItem(item, order) {
  if (!isEligibleRegistryItem(item)) return null;
  const title = boundedString(item.title, RUN_MANIFEST_LIMITS.maxTitleBytes);
  const lane = laneFor(item);
  const difficulty = boundedString(
    item.difficulty,
    RUN_MANIFEST_LIMITS.maxDifficultyBytes,
  );
  const estimatedMinutes = positiveInteger(
    item.estimatedMinutes,
    RUN_MANIFEST_LIMITS.maxEstimatedMinutes,
  );
  if (!title || !lane || !difficulty || !estimatedMinutes) return null;
  const judgeRevision = judgeRevisionFor(item);
  return {
    itemId: boundedId(item.itemId),
    contentRevision: Number(item.contentRevision),
    ...(judgeRevision === null ? {} : { judgeRevision }),
    title,
    lane,
    difficulty,
    estimatedMinutes,
    order,
    currentEvidenceEligible: true,
  };
}

function normalizeEntry(value, order, registry) {
  if (!isRecord(value)) return null;
  const itemId = boundedId(value.itemId);
  const contentRevision = positiveInteger(value.contentRevision ?? value.itemRevision);
  const rawJudgeRevision = value.judgeRevision ?? value.verificationRevision;
  const judgeRevision = rawJudgeRevision === undefined || rawJudgeRevision === null
    ? null
    : positiveInteger(rawJudgeRevision);
  const title = boundedString(value.title, RUN_MANIFEST_LIMITS.maxTitleBytes);
  const lane = boundedString(value.lane, RUN_MANIFEST_LIMITS.maxLaneBytes);
  const difficulty = boundedString(
    value.difficulty,
    RUN_MANIFEST_LIMITS.maxDifficultyBytes,
  );
  const estimatedMinutes = positiveInteger(
    value.estimatedMinutes,
    RUN_MANIFEST_LIMITS.maxEstimatedMinutes,
  );
  if (
    !itemId ||
    !contentRevision ||
    (rawJudgeRevision !== undefined && rawJudgeRevision !== null && !judgeRevision) ||
    !title ||
    !lane ||
    !difficulty ||
    !estimatedMinutes
  ) return null;
  const entry = {
    itemId,
    contentRevision,
    ...(judgeRevision === null ? {} : { judgeRevision }),
    title,
    lane,
    difficulty,
    estimatedMinutes,
    order,
  };
  return {
    ...entry,
    currentEvidenceEligible: registry
      ? isEntryCurrent(entry, registry.get(itemId))
      : Boolean(value.currentEvidenceEligible),
  };
}

function normalizeManifest(value, registry) {
  if (!isRecord(value)) return null;
  const id = boundedId(value.id);
  const title = boundedString(value.title, RUN_MANIFEST_LIMITS.maxTitleBytes);
  const source = RUN_MANIFEST_SOURCES.includes(value.source) ? value.source : null;
  const modeDuration = normalizeModeDuration(value.mode, value.durationMinutes);
  const execution = value.execution === null || value.execution === undefined
    ? null
    : normalizeExecution(value.execution);
  const createdAt = validIso(value.createdAt);
  const status = RUN_MANIFEST_STATUSES.includes(value.status) ? value.status : null;
  if (
    !id ||
    !title ||
    !source ||
    !modeDuration ||
    !createdAt ||
    !status ||
    (value.execution !== null && value.execution !== undefined && !execution) ||
    !executionMatchesMode(execution, modeDuration.mode)
  ) return null;
  const rawEntries = Array.isArray(value.entries) ? value.entries : [];
  if (rawEntries.length > RUN_MANIFEST_LIMITS.maxEntries) return null;
  const entries = rawEntries.map((entry, index) =>
    normalizeEntry(entry, index, registry),
  );
  if (
    entries.length < RUN_MANIFEST_LIMITS.minEntries ||
    entries.some((entry) => !entry) ||
    new Set(entries.map((entry) => entry.itemId)).size !== entries.length
  ) return null;

  const base = {
    version: RUN_MANIFEST_VERSION,
    id,
    title,
    source,
    mode: modeDuration.mode,
    durationMinutes: modeDuration.durationMinutes,
    status,
    execution,
    createdAt,
    entries,
  };
  if (status === "draft") return base;

  const startedAt = validIso(value.startedAt);
  if (!execution || !startedAt || !atOrAfter(startedAt, createdAt)) return null;
  if (status === "active") return { ...base, startedAt };

  if (status === "completed" || status === "ended") {
    const finishedAt = validIso(value.finishedAt);
    return finishedAt && atOrAfter(finishedAt, startedAt)
      ? { ...base, startedAt, finishedAt }
      : null;
  }

  const archivedFrom = FINISHED_STATUSES.has(value.archivedFrom)
    ? value.archivedFrom
    : null;
  const finishedAt = validIso(value.finishedAt);
  const archivedAt = validIso(value.archivedAt);
  if (
    !archivedFrom ||
    !finishedAt ||
    !archivedAt ||
    !atOrAfter(finishedAt, startedAt) ||
    !atOrAfter(archivedAt, finishedAt)
  ) return null;
  return { ...base, startedAt, finishedAt, archivedFrom, archivedAt };
}

function replaceManifest(workspace, id, updater) {
  let found = false;
  const manifests = workspace.manifests.map((manifest) => {
    if (manifest.id !== id) return manifest;
    found = true;
    return updater(manifest);
  });
  if (!found) throw new Error("Run manifest not found");
  return { version: RUN_MANIFEST_VERSION, manifests };
}

function sameExecution(left, right) {
  return Boolean(left && right && left.kind === right.kind && left.id === right.id);
}

function linkedEvidence(record, execution) {
  if (!isRecord(record) || !execution) return false;
  const context = isRecord(record.context) ? record.context : null;
  return execution.kind === "session"
    ? record.sessionId === execution.id || context?.sessionId === execution.id
    : record.virtualRoundId === execution.id || context?.virtualRoundId === execution.id;
}

function evidenceRevision(record) {
  return positiveInteger(record.itemRevision ?? record.contentRevision);
}

function evidenceJudgeRevision(record) {
  return positiveInteger(record.judgeRevision ?? record.verificationRevision ?? record.judge?.revision);
}

function submissionState(record) {
  if (record?.lifecycle === "pending" || record?.status === "pending") return "pending";
  if (record?.lifecycle === "settled" || typeof record?.status === "string") {
    const passed = Number(record.passed);
    const total = Number(record.total);
    return record.status === "accepted" &&
        Number.isInteger(passed) &&
        Number.isInteger(total) &&
        total > 0 &&
        passed === total
      ? "accepted"
      : "settled";
  }
  return null;
}

export function createRunManifestWorkspace() {
  return { version: RUN_MANIFEST_VERSION, manifests: [] };
}

export function normalizeRunManifestWorkspace(value, options = {}) {
  if (!isRecord(value)) return createRunManifestWorkspace();
  const registry = options.registry === undefined ? null : registryMap(options.registry);
  const fallbackNow = validIso(options.now) ?? new Date(0).toISOString();
  const seenIds = new Set();
  let activeSeen = false;
  const manifests = [];
  for (const candidate of (Array.isArray(value.manifests) ? value.manifests : []).slice(
    -RUN_MANIFEST_LIMITS.maxManifests * 2,
  )) {
    let manifest = normalizeManifest(candidate, registry);
    if (!manifest || seenIds.has(manifest.id)) continue;
    seenIds.add(manifest.id);
    if (manifest.status === "active") {
      if (activeSeen) {
        const finishedAt = atOrAfter(fallbackNow, manifest.startedAt)
          ? fallbackNow
          : manifest.startedAt;
        manifest = {
          ...manifest,
          status: "ended",
          finishedAt,
        };
      } else {
        activeSeen = true;
      }
    }
    manifests.push(manifest);
  }
  return {
    version: RUN_MANIFEST_VERSION,
    manifests: manifests.slice(-RUN_MANIFEST_LIMITS.maxManifests),
  };
}

export function createRunManifest(workspace, input, registry, options = {}) {
  const current = normalizeRunManifestWorkspace(workspace, { registry });
  const id = boundedId(options.id ?? input?.id);
  const now = requiredNow(options.now ?? input?.createdAt);
  const title = boundedString(input?.title, RUN_MANIFEST_LIMITS.maxTitleBytes);
  const source = RUN_MANIFEST_SOURCES.includes(input?.source) ? input.source : null;
  const modeDuration = normalizeModeDuration(input?.mode, input?.durationMinutes);
  const execution = input?.execution === undefined || input?.execution === null
    ? null
    : normalizeExecution(input.execution);
  if (!id || !title || !source || !modeDuration)
    throw new Error("Manifest identity, title, source, and mode are required");
  if (current.manifests.some((manifest) => manifest.id === id))
    throw new Error("Run manifest ID already exists");
  if (input?.execution !== undefined && input?.execution !== null && !execution)
    throw new Error("A valid execution link is required");
  if (!executionMatchesMode(execution, modeDuration.mode))
    throw new Error(`${modeDuration.mode} manifests require a ${expectedExecutionKind(modeDuration.mode)} execution`);

  const itemIds = Array.isArray(input?.itemIds) ? input.itemIds : [];
  if (
    itemIds.length < RUN_MANIFEST_LIMITS.minEntries ||
    itemIds.length > RUN_MANIFEST_LIMITS.maxEntries
  ) throw new Error("Run manifests require between 2 and 12 entries");
  const normalizedIds = itemIds.map(boundedId);
  if (normalizedIds.some((itemId) => !itemId) || new Set(normalizedIds).size !== normalizedIds.length)
    throw new Error("Run manifest selections must be valid and distinct");

  const byId = registryMap(registry);
  const entries = normalizedIds.map((itemId, index) => snapshotRegistryItem(byId.get(itemId), index));
  if (entries.some((entry) => !entry))
    throw new Error("Run manifests may only select current built-in non-transfer catalog items");

  const manifest = {
    version: RUN_MANIFEST_VERSION,
    id,
    title,
    source,
    mode: modeDuration.mode,
    durationMinutes: modeDuration.durationMinutes,
    status: "draft",
    execution,
    createdAt: now,
    entries,
  };
  return {
    version: RUN_MANIFEST_VERSION,
    manifests: [...current.manifests, manifest].slice(-RUN_MANIFEST_LIMITS.maxManifests),
  };
}

export function startRunManifest(workspace, manifestId, options = {}) {
  const now = requiredNow(options.now);
  if (workspace?.manifests?.some((manifest) => manifest.status === "active"))
    throw new Error("A run manifest is already active");
  return replaceManifest(workspace, manifestId, (manifest) => {
    if (manifest.status !== "draft") throw new Error("Only a draft manifest can start");
    if (!atOrAfter(now, manifest.createdAt))
      throw new Error("Manifest start time cannot predate creation");
    const requestedExecution = options.execution === undefined
      ? manifest.execution
      : normalizeExecution(options.execution);
    if (!requestedExecution) throw new Error("A valid execution link is required to start");
    if (manifest.execution && !sameExecution(manifest.execution, requestedExecution))
      throw new Error("A manifest execution link is immutable");
    if (!executionMatchesMode(requestedExecution, manifest.mode))
      throw new Error(`${manifest.mode} manifests require a ${expectedExecutionKind(manifest.mode)} execution`);
    return {
      ...manifest,
      status: "active",
      execution: { ...requestedExecution },
      startedAt: now,
    };
  });
}

export function resumeRunManifest(workspace, manifestId) {
  const manifest = workspace?.manifests?.find((candidate) => candidate.id === manifestId);
  if (!manifest) throw new Error("Run manifest not found");
  if (manifest.status !== "active" || !manifest.execution)
    throw new Error("Only an active manifest can resume");
  return {
    ...manifest,
    execution: { ...manifest.execution },
    entries: manifest.entries.map((entry) => ({ ...entry })),
  };
}

export function finishRunManifest(workspace, manifestId, outcome, options = {}) {
  if (!FINISHED_STATUSES.has(outcome))
    throw new Error("Manifest outcome must be completed or ended");
  const now = requiredNow(options.now);
  return replaceManifest(workspace, manifestId, (manifest) => {
    if (manifest.status !== "active") throw new Error("Only an active manifest can finish");
    if (!atOrAfter(now, manifest.startedAt))
      throw new Error("Manifest finish time cannot predate its start");
    return { ...manifest, status: outcome, finishedAt: now };
  });
}

export function archiveRunManifest(workspace, manifestId, options = {}) {
  const now = requiredNow(options.now);
  return replaceManifest(workspace, manifestId, (manifest) => {
    if (!FINISHED_STATUSES.has(manifest.status))
      throw new Error("Only a completed or ended manifest can be archived");
    if (!atOrAfter(now, manifest.finishedAt))
      throw new Error("Manifest archive time cannot predate its finish");
    return {
      ...manifest,
      status: "archived",
      archivedFrom: manifest.status,
      archivedAt: now,
    };
  });
}

export function deriveRunManifestReport(manifest, evidence = {}, registry) {
  if (!isRecord(manifest) || !Array.isArray(manifest.entries)) return null;
  const byId = registry === undefined ? null : registryMap(registry);
  const attempts = Array.isArray(evidence.attempts) ? evidence.attempts : [];
  const submissions = Array.isArray(evidence.submissions)
    ? evidence.submissions
    : Array.isArray(evidence.receipts)
      ? evidence.receipts
      : [];
  const entries = manifest.entries.map((snapshot, index) => {
    const entry = normalizeEntry(snapshot, index, byId);
    if (!entry) return null;
    const entryAttempts = attempts.filter((attempt) =>
      linkedEvidence(attempt, manifest.execution) &&
      attempt.itemId === entry.itemId &&
      evidenceRevision(attempt) === entry.contentRevision,
    );
    const entrySubmissions = submissions.filter((submission) =>
      linkedEvidence(submission, manifest.execution) &&
      submission.itemId === entry.itemId &&
      evidenceRevision(submission) === entry.contentRevision,
    );
    const pending = entrySubmissions.some((submission) => submissionState(submission) === "pending");
    const accepted = entrySubmissions.some((submission) => submissionState(submission) === "accepted");
    const acceptedCurrent = accepted && entry.currentEvidenceEligible && entrySubmissions.some((submission) =>
      submissionState(submission) === "accepted" &&
      (entry.judgeRevision === undefined || evidenceJudgeRevision(submission) === entry.judgeRevision),
    );
    const attempted = entryAttempts.length > 0 || entrySubmissions.length > 0;
    const status = acceptedCurrent
      ? "accepted-current"
      : accepted
        ? "accepted-stale"
        : pending
          ? "pending"
          : attempted
            ? "attempted"
            : "not-started";
    return {
      ...entry,
      status,
      attempted,
      pending,
      accepted,
      acceptedCurrent,
      attemptCount: entryAttempts.length,
      submissionCount: entrySubmissions.length,
    };
  });
  if (entries.some((entry) => !entry)) return null;
  return {
    manifestId: manifest.id,
    status: manifest.status,
    execution: manifest.execution ? { ...manifest.execution } : null,
    scope: "activity-progress-only",
    claimsMastery: false,
    entryCount: entries.length,
    attemptedCount: entries.filter((entry) => entry.attempted).length,
    pendingCount: entries.filter((entry) => entry.pending).length,
    acceptedCount: entries.filter((entry) => entry.accepted).length,
    currentAcceptedCount: entries.filter((entry) => entry.acceptedCurrent).length,
    entries,
  };
}
