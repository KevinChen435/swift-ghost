const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export const MOCK_NOTEBOOK_FIELDS = Object.freeze([
  "clarifications",
  "approach",
  "invariant",
  "complexity",
  "edgeCases",
  "finalExplanation",
]);

export const MOCK_CHECKPOINT_KINDS = Object.freeze([
  "promptAcknowledged",
  "approachReady",
  "codingStarted",
  "firstTest",
  "codeCompleted",
  "explanationReady",
]);

export const MOCK_RUBRIC_DIMENSIONS = Object.freeze([
  "recognition",
  "reasoning",
  "implementation",
  "verification",
  "communication",
]);

export const MOCK_MISTAKE_TAGS = Object.freeze([
  "syntax-fluency",
  "missed-cue",
  "wrong-invariant",
  "data-structure",
  "complexity",
  "boundary",
  "implementation",
  "verification",
  "communication",
  "overfit",
]);

export const MOCK_REFLECTION_FIELDS = Object.freeze([
  "algorithmic",
  "languageFluency",
  "communication",
  "nextStep",
]);

export const MOCK_SESSION_LIMITS = Object.freeze({
  maxItemIdBytes: 200,
  maxItemRevision: 1_000_000,
  maxNotebookFieldBytes: 2_048,
  maxNotebookBytes: 8_192,
  maxSourceBytes: 48 * 1_024,
  maxReflectionFieldBytes: 2_048,
  maxDebriefTextBytes: 8_192,
  maxCheckpointElapsedMs: 180 * 60 * 1_000,
});

const NOTEBOOK_FIELD_SET = new Set(MOCK_NOTEBOOK_FIELDS);
const CHECKPOINT_KIND_SET = new Set(MOCK_CHECKPOINT_KINDS);
const RUBRIC_DIMENSION_SET = new Set(MOCK_RUBRIC_DIMENSIONS);
const MISTAKE_TAG_SET = new Set(MOCK_MISTAKE_TAGS);
const REFLECTION_FIELD_SET = new Set(MOCK_REFLECTION_FIELDS);

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Return well-formed Unicode so later UTF-8 serialization is stable. */
function wellFormedText(value) {
  return decoder.decode(encoder.encode(value));
}

function byteLength(value) {
  return encoder.encode(value).byteLength;
}

function boundedText(value, label, maxBytes) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const text = wellFormedText(value);
  if (byteLength(text) > maxBytes)
    throw new Error(`${label} exceeds ${maxBytes} UTF-8 bytes`);
  return text;
}

/** Truncate only at Unicode code-point boundaries. */
function truncateText(value, maxBytes) {
  if (typeof value !== "string" || maxBytes <= 0) return "";
  const text = wellFormedText(value);
  if (byteLength(text) <= maxBytes) return text;
  let result = "";
  let used = 0;
  for (const character of text) {
    const bytes = byteLength(character);
    if (used + bytes > maxBytes) break;
    result += character;
    used += bytes;
  }
  return result;
}

function positiveRevision(value) {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MOCK_SESSION_LIMITS.maxItemRevision
  )
    throw new Error(
      `itemRevision must be an integer from 1 to ${MOCK_SESSION_LIMITS.maxItemRevision}`,
    );
  return value;
}

function checkpointLimit(value) {
  if (value === undefined) return MOCK_SESSION_LIMITS.maxCheckpointElapsedMs;
  if (!Number.isFinite(value) || value < 0)
    throw new Error("maxElapsedMs must be a non-negative finite number");
  return Math.min(
    MOCK_SESSION_LIMITS.maxCheckpointElapsedMs,
    Math.round(value),
  );
}

export function mockNotebookBytes(notebook) {
  return MOCK_NOTEBOOK_FIELDS.reduce(
    (total, field) =>
      total + byteLength(typeof notebook?.[field] === "string" ? notebook[field] : ""),
    0,
  );
}

/** Create an exact, public notebook shape and reject oversized authored text. */
export function createMockNotebook(input = {}) {
  if (!object(input)) throw new Error("mock notebook must be an object");
  const notebook = {};
  for (const field of MOCK_NOTEBOOK_FIELDS)
    notebook[field] = boundedText(
      input[field] ?? "",
      `mock notebook ${field}`,
      MOCK_SESSION_LIMITS.maxNotebookFieldBytes,
    );
  if (mockNotebookBytes(notebook) > MOCK_SESSION_LIMITS.maxNotebookBytes)
    throw new Error(
      `mock notebook exceeds ${MOCK_SESSION_LIMITS.maxNotebookBytes} aggregate UTF-8 bytes`,
    );
  return notebook;
}

/**
 * Normalize imported/persisted notes deterministically. Unknown keys and
 * non-string values are removed; text is Unicode-safe and fits both bounds.
 */
export function normalizeMockNotebook(raw) {
  const source = object(raw) ? raw : {};
  const notebook = {};
  let remaining = MOCK_SESSION_LIMITS.maxNotebookBytes;
  for (const field of MOCK_NOTEBOOK_FIELDS) {
    const text = truncateText(
      typeof source[field] === "string" ? source[field] : "",
      Math.min(MOCK_SESSION_LIMITS.maxNotebookFieldBytes, remaining),
    );
    notebook[field] = text;
    remaining -= byteLength(text);
  }
  return notebook;
}

export function updateMockNotebook(notebookInput, field, value) {
  if (!NOTEBOOK_FIELD_SET.has(field))
    throw new Error(`unsupported mock notebook field: ${String(field)}`);
  const notebook = normalizeMockNotebook(notebookInput);
  const text = boundedText(
    value,
    `mock notebook ${field}`,
    MOCK_SESSION_LIMITS.maxNotebookFieldBytes,
  );
  const updated = { ...notebook, [field]: text };
  if (mockNotebookBytes(updated) > MOCK_SESSION_LIMITS.maxNotebookBytes)
    throw new Error(
      `mock notebook exceeds ${MOCK_SESSION_LIMITS.maxNotebookBytes} aggregate UTF-8 bytes`,
    );
  return updated;
}

/** Invalid imported timestamps are omitted rather than fabricated or clamped. */
export function normalizeMockCheckpoints(raw, maxElapsedMs) {
  const limit = checkpointLimit(maxElapsedMs);
  const source = object(raw) ? raw : {};
  const checkpoints = {};
  for (const kind of MOCK_CHECKPOINT_KINDS) {
    const value = source[kind];
    if (Number.isInteger(value) && value >= 0 && value <= limit)
      checkpoints[kind] = value;
  }
  return checkpoints;
}

/** Record once. An existing value of zero is deliberately treated as present. */
export function recordFirstMockCheckpoint(
  checkpointsInput,
  kind,
  elapsedMs,
  maxElapsedMs,
) {
  if (!CHECKPOINT_KIND_SET.has(kind))
    throw new Error(`unsupported mock checkpoint: ${String(kind)}`);
  const limit = checkpointLimit(maxElapsedMs);
  const checkpoints = normalizeMockCheckpoints(checkpointsInput, limit);
  if (own(checkpoints, kind)) return checkpoints;
  if (!Number.isFinite(elapsedMs))
    throw new Error("checkpoint elapsedMs must be a finite number");
  return {
    ...checkpoints,
    [kind]: Math.max(0, Math.min(limit, Math.round(elapsedMs))),
  };
}

export function createMockProblemWorkspace(input, options = {}) {
  if (!object(input)) throw new Error("mock problem workspace must be an object");
  const itemId = boundedText(
    input.itemId,
    "mock workspace itemId",
    MOCK_SESSION_LIMITS.maxItemIdBytes,
  );
  if (itemId.length === 0) throw new Error("mock workspace itemId must not be empty");
  const source = boundedText(
    input.source ?? "",
    "mock workspace source",
    MOCK_SESSION_LIMITS.maxSourceBytes,
  );
  return {
    version: 1,
    itemId,
    itemRevision: positiveRevision(input.itemRevision),
    source,
    notebook: createMockNotebook(input.notebook ?? {}),
    checkpoints: normalizeMockCheckpoints(
      input.checkpoints,
      options.maxElapsedMs,
    ),
  };
}

/** Normalize a valid workspace while stripping every unknown persisted key. */
export function normalizeMockProblemWorkspace(raw, options = {}) {
  if (!object(raw)) throw new Error("mock problem workspace must be an object");
  const itemId = boundedText(
    raw.itemId,
    "mock workspace itemId",
    MOCK_SESSION_LIMITS.maxItemIdBytes,
  );
  if (itemId.length === 0) throw new Error("mock workspace itemId must not be empty");
  return {
    version: 1,
    itemId,
    itemRevision: positiveRevision(raw.itemRevision),
    source: truncateText(
      typeof raw.source === "string" ? raw.source : "",
      MOCK_SESSION_LIMITS.maxSourceBytes,
    ),
    notebook: normalizeMockNotebook(raw.notebook),
    checkpoints: normalizeMockCheckpoints(
      raw.checkpoints,
      options.maxElapsedMs,
    ),
  };
}

/**
 * Normalize archived mock evidence only when it is complete and distinct.
 * An empty list remains a valid legacy summary; partial/corrupt detail fails
 * closed to an empty list rather than presenting a misleading debrief.
 */
export function normalizeMockProblemWorkspaces(raw, options = {}) {
  const problemCount = options.problemCount;
  if (problemCount !== 1 && problemCount !== 2) return [];
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (raw.length !== problemCount) return [];
  const allowed = Array.isArray(options.validItemIds)
    ? new Set(options.validItemIds.filter((itemId) => typeof itemId === "string"))
    : null;
  try {
    const workspaces = raw.map((workspace) =>
      normalizeMockProblemWorkspace(workspace, {
        maxElapsedMs: options.maxElapsedMs,
      }),
    );
    if (
      new Set(workspaces.map((workspace) => workspace.itemId)).size !==
      workspaces.length
    )
      return [];
    if (allowed && workspaces.some((workspace) => !allowed.has(workspace.itemId)))
      return [];
    return workspaces;
  } catch {
    return [];
  }
}

export function updateMockWorkspaceNotebook(
  workspaceInput,
  field,
  value,
  options = {},
) {
  const workspace = normalizeMockProblemWorkspace(workspaceInput, options);
  return {
    ...workspace,
    notebook: updateMockNotebook(workspace.notebook, field, value),
  };
}

export function updateMockWorkspaceSource(workspaceInput, source, options = {}) {
  const workspace = normalizeMockProblemWorkspace(workspaceInput, options);
  return {
    ...workspace,
    source: boundedText(
      source,
      "mock workspace source",
      MOCK_SESSION_LIMITS.maxSourceBytes,
    ),
  };
}

export function recordMockCheckpoint(
  workspaceInput,
  kind,
  elapsedMs,
  maxElapsedMs,
) {
  const workspace = normalizeMockProblemWorkspace(workspaceInput, {
    maxElapsedMs,
  });
  return {
    ...workspace,
    checkpoints: recordFirstMockCheckpoint(
      workspace.checkpoints,
      kind,
      elapsedMs,
      maxElapsedMs,
    ),
  };
}

function emptyScores() {
  return Object.fromEntries(MOCK_RUBRIC_DIMENSIONS.map((dimension) => [dimension, null]));
}

function normalizeScores(raw) {
  const source = object(raw) ? raw : {};
  const scores = emptyScores();
  for (const dimension of MOCK_RUBRIC_DIMENSIONS) {
    const value = source[dimension];
    if (value === 0 || value === 1 || value === 2) scores[dimension] = value;
  }
  return scores;
}

function normalizeMistakeTags(raw) {
  const selected = new Set(
    Array.isArray(raw)
      ? raw.filter((tag) => typeof tag === "string" && MISTAKE_TAG_SET.has(tag))
      : [],
  );
  return MOCK_MISTAKE_TAGS.filter((tag) => selected.has(tag));
}

function normalizeCompletedAt(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function createMockDebrief(input = {}) {
  if (!object(input)) throw new Error("mock debrief must be an object");
  const scores = normalizeScores(input.scores);
  const debrief = {
    version: 1,
    scores,
    mistakeTags: normalizeMistakeTags(input.mistakeTags),
    algorithmic: "",
    languageFluency: "",
    communication: "",
    nextStep: "",
    completedAt: normalizeCompletedAt(input.completedAt),
  };
  for (const field of MOCK_REFLECTION_FIELDS)
    debrief[field] = boundedText(
      input[field] ?? "",
      `mock debrief ${field}`,
      MOCK_SESSION_LIMITS.maxReflectionFieldBytes,
    );
  const textBytes = MOCK_REFLECTION_FIELDS.reduce(
    (total, field) => total + byteLength(debrief[field]),
    0,
  );
  if (textBytes > MOCK_SESSION_LIMITS.maxDebriefTextBytes)
    throw new Error(
      `mock debrief exceeds ${MOCK_SESSION_LIMITS.maxDebriefTextBytes} aggregate UTF-8 bytes`,
    );
  return debrief;
}

/** Normalize an editable, potentially incomplete post-mock debrief. */
export function normalizeMockDebrief(raw) {
  const source = object(raw) ? raw : {};
  const debrief = {
    version: 1,
    scores: normalizeScores(source.scores),
    mistakeTags: normalizeMistakeTags(source.mistakeTags),
    algorithmic: "",
    languageFluency: "",
    communication: "",
    nextStep: "",
    completedAt: normalizeCompletedAt(source.completedAt),
  };
  let remaining = MOCK_SESSION_LIMITS.maxDebriefTextBytes;
  for (const field of MOCK_REFLECTION_FIELDS) {
    const text = truncateText(
      typeof source[field] === "string" ? source[field] : "",
      Math.min(MOCK_SESSION_LIMITS.maxReflectionFieldBytes, remaining),
    );
    debrief[field] = text;
    remaining -= byteLength(text);
  }
  return debrief;
}

export function updateMockDebrief(debriefInput, patch) {
  if (!object(patch)) throw new Error("mock debrief patch must be an object");
  const current = normalizeMockDebrief(debriefInput);
  const candidate = {
    ...current,
    scores: { ...current.scores },
  };

  if (patch.scores !== undefined) {
    if (!object(patch.scores)) throw new Error("mock rubric scores must be an object");
    for (const [dimension, score] of Object.entries(patch.scores)) {
      if (!RUBRIC_DIMENSION_SET.has(dimension))
        throw new Error(`unsupported mock rubric dimension: ${dimension}`);
      if (score !== null && score !== 0 && score !== 1 && score !== 2)
        throw new Error(`mock rubric ${dimension} must be 0, 1, 2, or null`);
      candidate.scores[dimension] = score;
    }
  }
  if (patch.mistakeTags !== undefined) {
    if (!Array.isArray(patch.mistakeTags))
      throw new Error("mock mistakeTags must be an array");
    const unsupported = patch.mistakeTags.find(
      (tag) => typeof tag !== "string" || !MISTAKE_TAG_SET.has(tag),
    );
    if (unsupported !== undefined)
      throw new Error(`unsupported mock mistake tag: ${String(unsupported)}`);
    candidate.mistakeTags = normalizeMistakeTags(patch.mistakeTags);
  }
  for (const [field, value] of Object.entries(patch)) {
    if (REFLECTION_FIELD_SET.has(field))
      candidate[field] = boundedText(
        value,
        `mock debrief ${field}`,
        MOCK_SESSION_LIMITS.maxReflectionFieldBytes,
      );
  }
  if (own(patch, "completedAt")) {
    if (
      patch.completedAt !== null &&
      (typeof patch.completedAt !== "string" ||
        normalizeCompletedAt(patch.completedAt) === null)
    )
      throw new Error("mock debrief completedAt must be a valid ISO timestamp or null");
    candidate.completedAt = normalizeCompletedAt(patch.completedAt);
  }
  return createMockDebrief(candidate);
}

export function mockDebriefScore(debriefInput) {
  const debrief = normalizeMockDebrief(debriefInput);
  let total = 0;
  let scoredDimensions = 0;
  for (const dimension of MOCK_RUBRIC_DIMENSIONS) {
    const score = debrief.scores[dimension];
    if (score !== null) {
      scoredDimensions += 1;
      total += score;
    }
  }
  return {
    total,
    scoredDimensions,
    possible: MOCK_RUBRIC_DIMENSIONS.length * 2,
    complete: scoredDimensions === MOCK_RUBRIC_DIMENSIONS.length,
  };
}

export function isMockDebriefComplete(debriefInput) {
  return mockDebriefScore(debriefInput).complete;
}
