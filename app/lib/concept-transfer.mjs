const EPOCH = "1970-01-01T00:00:00.000Z";
const DAY_MS = 86_400_000;

export const CONCEPT_TRANSFER_WORKSPACE_VERSION = 1;
export const CONCEPT_TRANSFER_INTERVAL_DAYS = Object.freeze([1, 3, 7, 14, 30]);
export const CONCEPT_TRANSFER_GRADES = Object.freeze([
  "again",
  "hard",
  "good",
  "easy",
]);
export const CONCEPT_TRANSFER_LIMITS = Object.freeze({
  attempts: 240,
  drafts: 8,
  idChars: 160,
  predictionChars: 2_000,
  predictionLines: 32,
  reconstructionChars: 8_000,
  reconstructionLines: 120,
  tradeoffChars: 2_000,
  tradeoffLines: 32,
  teachBackChars: 2_000,
  teachBackLines: 32,
  criteria: 5,
});

const LANES = new Set(["swift", "ios"]);
function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function boundedInt(value, fallback, minimum, maximum) {
  const number = Math.round(Number(value));
  return Number.isFinite(number)
    ? Math.max(minimum, Math.min(maximum, number))
    : fallback;
}

function cleanId(value) {
  if (typeof value !== "string") return "";
  const text = Array.from(value.trim())
    .slice(0, CONCEPT_TRANSFER_LIMITS.idChars)
    .join("");
  return /^[A-Za-z0-9](?:[A-Za-z0-9._:-]*[A-Za-z0-9])?$/.test(text)
    ? text
    : "";
}

export function normalizeConceptTransferText(value, options = {}) {
  const maxChars = boundedInt(options.maxChars, 2_000, 1, 20_000);
  const maxLines = boundedInt(options.maxLines, 32, 1, 240);
  if (typeof value !== "string") return "";
  const safe = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .split("\n")
    .slice(0, maxLines)
    .join("\n")
    .trim();
  return Array.from(safe).slice(0, maxChars).join("");
}

function cleanIso(value, fallback = EPOCH) {
  const milliseconds =
    value instanceof Date ? value.getTime() : Date.parse(String(value ?? ""));
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : fallback;
}

function optionalIso(value) {
  const cleaned = cleanIso(value, "");
  return cleaned || undefined;
}

function activityAt(value) {
  return (
    optionalIso(value?.finishedAt) ??
    optionalIso(value?.updatedAt) ??
    optionalIso(value?.committedAt) ??
    optionalIso(value?.startedAt) ??
    EPOCH
  );
}

function variantRegistry(variants) {
  const registry = new Map();
  for (const variant of Array.isArray(variants) ? variants : []) {
    const id = cleanId(variant?.id);
    const revision = boundedInt(variant?.revision, 0, 1, 1_000_000);
    if (
      id &&
      revision &&
      LANES.has(variant?.lane) &&
      typeof variant?.family === "string" &&
      variant.family.trim()
    ) {
      registry.set(id, variant);
    }
  }
  return registry;
}

function attemptDraftFields(raw) {
  return {
    prediction: normalizeConceptTransferText(raw?.prediction, {
      maxChars: CONCEPT_TRANSFER_LIMITS.predictionChars,
      maxLines: CONCEPT_TRANSFER_LIMITS.predictionLines,
    }),
    reconstruction: normalizeConceptTransferText(raw?.reconstruction, {
      maxChars: CONCEPT_TRANSFER_LIMITS.reconstructionChars,
      maxLines: CONCEPT_TRANSFER_LIMITS.reconstructionLines,
    }),
    tradeoff: normalizeConceptTransferText(raw?.tradeoff, {
      maxChars: CONCEPT_TRANSFER_LIMITS.tradeoffChars,
      maxLines: CONCEPT_TRANSFER_LIMITS.tradeoffLines,
    }),
  };
}

function dedupedStrings(values, limit, allowed) {
  const result = [];
  const seen = new Set();
  for (const raw of Array.isArray(values) ? values : []) {
    const value = normalizeConceptTransferText(raw, {
      maxChars: 600,
      maxLines: 4,
    });
    if (!value || seen.has(value) || (allowed && !allowed.has(value))) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeAttempt(raw, registry) {
  if (!isRecord(raw)) return undefined;
  const id = cleanId(raw.id ?? raw.attemptId);
  const variantId = cleanId(raw.variantId);
  const variantRevision = boundedInt(raw.variantRevision, 0, 1, 1_000_000);
  const variant = registry.get(variantId);
  const current = Boolean(variant && Number(variant.revision) === variantRevision);
  const finishedAt = optionalIso(raw.finishedAt ?? raw.completedAt);
  if (!id || !variantId || !variantRevision || (!current && !finishedAt)) {
    return undefined;
  }
  const lane = current ? variant.lane : LANES.has(raw.lane) ? raw.lane : undefined;
  const family = current
    ? variant.family
    : normalizeConceptTransferText(raw.family, { maxChars: 120, maxLines: 1 });
  if (!lane || !family) return undefined;

  const startedAt = cleanIso(raw.startedAt, EPOCH);
  const committedAt = optionalIso(raw.committedAt);
  const grade = committedAt && CONCEPT_TRANSFER_GRADES.includes(
    String(raw.grade ?? "").toLowerCase(),
  )
    ? String(raw.grade).toLowerCase()
    : undefined;
  const maxHintLevel = boundedInt(raw.maxHintLevel, 0, 0, 3);
  const hintRevealedAt = (Array.isArray(raw.hintRevealedAt)
    ? raw.hintRevealedAt
    : [])
    .flatMap((value) => {
      const timestamp = optionalIso(value);
      return timestamp ? [timestamp] : [];
    })
    .sort()
    .slice(0, maxHintLevel);
  const clinicTargeted = raw.clinicTargeted === true;
  const assisted = Boolean(
    raw.assisted || clinicTargeted || maxHintLevel > 0 || hintRevealedAt.length
  );
  const allowedCriteria = current
    ? new Set(variant.review?.criteria ?? [])
    : undefined;
  const criteria = dedupedStrings(
    raw.criteria,
    CONCEPT_TRANSFER_LIMITS.criteria,
    allowedCriteria,
  );
  const criteriaRecordedAt = committedAt
    ? optionalIso(raw.criteriaRecordedAt)
    : undefined;
  const validCriteriaRecordedAt = criteria.length > 0
    ? criteriaRecordedAt
    : undefined;
  const teachBack = committedAt
    ? normalizeConceptTransferText(raw.teachBack, {
        maxChars: CONCEPT_TRANSFER_LIMITS.teachBackChars,
        maxLines: CONCEPT_TRANSFER_LIMITS.teachBackLines,
      })
    : "";
  const teachBackRecordedAt = teachBack
    ? optionalIso(raw.teachBackRecordedAt)
    : undefined;
  const qualification = committedAt && grade
    ? assisted
      ? "assisted"
      : grade === "good" || grade === "easy"
        ? "cold-self-assessed"
        : "reference-reconstruction"
    : undefined;
  const completed = Boolean(
    finishedAt &&
      committedAt &&
      grade &&
      validCriteriaRecordedAt &&
      teachBack &&
      teachBackRecordedAt &&
      qualification,
  );
  if (!current && !completed) return undefined;

  const attempt = {
    id,
    variantId,
    variantRevision,
    lane,
    family,
    startedAt,
    wasDue: Boolean(raw.wasDue),
    maxHintLevel,
    hintRevealedAt,
    assisted,
    ...(clinicTargeted ? { clinicTargeted: true } : {}),
    ...(committedAt
      ? {
          ...attemptDraftFields(raw),
          committedAt,
          referenceRevealedAt: optionalIso(raw.referenceRevealedAt) ?? committedAt,
        }
      : {}),
    ...(grade ? { grade, selfGradedAt: optionalIso(raw.selfGradedAt) ?? committedAt } : {}),
    ...(validCriteriaRecordedAt
      ? { criteria, criteriaRecordedAt: validCriteriaRecordedAt }
      : {}),
    ...(teachBack ? { teachBack, teachBackRecordedAt } : {}),
    ...(completed
      ? {
          finishedAt,
          dueAt: addDays(finishedAt, CONCEPT_TRANSFER_INTERVAL_DAYS[0]),
          levelAfter: 0,
          lapseCount: 0,
          qualification,
        }
      : {}),
    updatedAt: cleanIso(raw.updatedAt, finishedAt ?? committedAt ?? startedAt),
    ...(raw.retired === true || !current ? { retired: true } : {}),
  };
  return attempt;
}

function rebuildNormalizedSchedules(attempts) {
  const completed = attempts
    .filter((attempt) => attempt.finishedAt)
    .sort(
      (left, right) =>
        left.finishedAt.localeCompare(right.finishedAt) ||
        left.id.localeCompare(right.id),
    );
  const previousByVariant = new Map();
  const rebuiltById = new Map();
  for (const attempt of completed) {
    const key = `${attempt.variantId}\u0000${attempt.variantRevision}`;
    const prior = previousByVariant.get(key);
    let levelAfter = 0;
    let lapseCount = prior?.lapseCount ?? 0;
    let dueAt = addDays(
      attempt.finishedAt,
      CONCEPT_TRANSFER_INTERVAL_DAYS[0],
    );
    if (prior && attempt.qualification === "cold-self-assessed") {
      if (Date.parse(attempt.finishedAt) >= Date.parse(prior.dueAt)) {
        levelAfter = Math.min(
          prior.levelAfter + 1,
          CONCEPT_TRANSFER_INTERVAL_DAYS.length - 1,
        );
        dueAt = addDays(
          attempt.finishedAt,
          CONCEPT_TRANSFER_INTERVAL_DAYS[levelAfter],
        );
      } else {
        levelAfter = prior.levelAfter;
        dueAt = prior.dueAt;
      }
    } else if (prior) {
      lapseCount = Math.min(1_000_000, lapseCount + 1);
    }
    const rebuilt = {
      ...attempt,
      wasDue: Boolean(
        prior && Date.parse(attempt.startedAt) >= Date.parse(prior.dueAt),
      ),
      levelAfter,
      lapseCount,
      dueAt,
    };
    rebuiltById.set(rebuilt.id, rebuilt);
    previousByVariant.set(key, rebuilt);
  }
  return attempts.map((attempt) => rebuiltById.get(attempt.id) ?? attempt);
}

function normalizeDraft(raw, attempts, registry, now) {
  if (!isRecord(raw)) return undefined;
  const attemptId = cleanId(raw.attemptId ?? raw.id);
  const attempt = attempts.get(attemptId);
  if (!attempt || attempt.committedAt || attempt.retired) return undefined;
  const variant = registry.get(attempt.variantId);
  if (!variant || Number(variant.revision) !== attempt.variantRevision) return undefined;
  const maxHintLevel = Math.max(
    attempt.maxHintLevel,
    boundedInt(raw.maxHintLevel, 0, 0, 3),
  );
  const hintRevealedAt = [
    ...attempt.hintRevealedAt,
    ...(Array.isArray(raw.hintRevealedAt) ? raw.hintRevealedAt : []),
  ]
    .flatMap((value) => {
      const timestamp = optionalIso(value);
      return timestamp ? [timestamp] : [];
    })
    .sort()
    .filter((value, index, values) => index === 0 || value !== values[index - 1])
    .slice(0, maxHintLevel);
  return {
    attemptId,
    variantId: attempt.variantId,
    variantRevision: attempt.variantRevision,
    ...attemptDraftFields(raw),
    maxHintLevel,
    hintRevealedAt,
    assisted: Boolean(raw.assisted || attempt.assisted || maxHintLevel > 0),
    ...(attempt.clinicTargeted === true ? { clinicTargeted: true } : {}),
    updatedAt: cleanIso(raw.updatedAt, now),
  };
}

export function createConceptTransferWorkspace(now = EPOCH) {
  return {
    version: CONCEPT_TRANSFER_WORKSPACE_VERSION,
    revision: 0,
    updatedAt: cleanIso(now, EPOCH),
    attempts: [],
    drafts: [],
  };
}

export const CURRENT_CONCEPT_TRANSFER_WORKSPACE = Object.freeze(
  createConceptTransferWorkspace(EPOCH),
);

export function normalizeConceptTransferWorkspace(value, options = {}) {
  const now = cleanIso(options.now, EPOCH);
  if (!isRecord(value) || Number(value.version) !== CONCEPT_TRANSFER_WORKSPACE_VERSION) {
    return createConceptTransferWorkspace(now);
  }
  const registry = variantRegistry(options.variants);
  const byId = new Map();
  for (const raw of Array.isArray(value.attempts) ? value.attempts : []) {
    const attempt = normalizeAttempt(raw, registry);
    if (!attempt) continue;
    const prior = byId.get(attempt.id);
    if (!prior || activityAt(prior) <= activityAt(attempt)) byId.set(attempt.id, attempt);
  }
  const rebuiltAttempts = rebuildNormalizedSchedules([...byId.values()]
    .sort((left, right) => activityAt(left).localeCompare(activityAt(right)) || left.id.localeCompare(right.id))
    .slice(-CONCEPT_TRANSFER_LIMITS.attempts)
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt) || left.id.localeCompare(right.id)));
  const activeCandidates = rebuiltAttempts
    .filter((attempt) => !attempt.finishedAt && !attempt.retired)
    .sort((left, right) => activityAt(right).localeCompare(activityAt(left)) || left.id.localeCompare(right.id));
  const requestedActive = cleanId(value.activeAttemptId);
  const activeAttemptId = activeCandidates.some((attempt) => attempt.id === requestedActive)
    ? requestedActive
    : activeCandidates[0]?.id;
  // A workspace has exactly one live reconstruction. Malformed imports may
  // contain several unfinished attempts; retiring every non-selected attempt
  // prevents an older draft from becoming active after the selected one ends.
  const attempts = rebuiltAttempts.map((attempt) =>
    !attempt.finishedAt && !attempt.retired && attempt.id !== activeAttemptId
      ? { ...attempt, retired: true }
      : attempt,
  );
  const attemptMap = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const draftsByAttempt = new Map();
  for (const raw of Array.isArray(value.drafts) ? value.drafts : []) {
    const draft = normalizeDraft(raw, attemptMap, registry, now);
    if (!draft) continue;
    const prior = draftsByAttempt.get(draft.attemptId);
    if (!prior || prior.updatedAt <= draft.updatedAt) draftsByAttempt.set(draft.attemptId, draft);
  }
  const activeAttempt = attemptMap.get(activeAttemptId);
  if (
    activeAttempt &&
    !activeAttempt.committedAt &&
    !draftsByAttempt.has(activeAttempt.id)
  ) {
    // Recover an editable shell when a partial import or interrupted write kept
    // the live attempt but lost its draft. Hint provenance remains permanent.
    draftsByAttempt.set(activeAttempt.id, {
      attemptId: activeAttempt.id,
      variantId: activeAttempt.variantId,
      variantRevision: activeAttempt.variantRevision,
      prediction: "",
      reconstruction: "",
      tradeoff: "",
      maxHintLevel: activeAttempt.maxHintLevel,
      hintRevealedAt: [...activeAttempt.hintRevealedAt],
      assisted: Boolean(activeAttempt.assisted || activeAttempt.maxHintLevel > 0),
      ...(activeAttempt.clinicTargeted === true ? { clinicTargeted: true } : {}),
      updatedAt: activeAttempt.updatedAt,
    });
  }
  const drafts = [...draftsByAttempt.values()]
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.attemptId.localeCompare(right.attemptId))
    .slice(-CONCEPT_TRANSFER_LIMITS.drafts);
  return {
    version: CONCEPT_TRANSFER_WORKSPACE_VERSION,
    revision: boundedInt(value.revision, 0, 0, 1_000_000),
    updatedAt: cleanIso(value.updatedAt, now),
    attempts,
    drafts,
    ...(activeAttemptId ? { activeAttemptId } : {}),
  };
}

function completedForVariant(workspace, variant) {
  return workspace.attempts
    .filter(
      (attempt) =>
        !attempt.retired &&
        attempt.variantId === variant.id &&
        attempt.variantRevision === variant.revision &&
        attempt.finishedAt,
    )
    .sort((left, right) => left.finishedAt.localeCompare(right.finishedAt));
}

export function deriveConceptTransferVariantState(variant, workspace, options = {}) {
  const normalized = normalizeConceptTransferWorkspace(workspace, {
    variants: options.variants ?? [variant],
    now: options.now,
  });
  const completed = completedForVariant(normalized, variant);
  const latest = completed.at(-1);
  const now = cleanIso(options.now, EPOCH);
  return {
    variantId: variant.id,
    variantRevision: variant.revision,
    lane: variant.lane,
    family: variant.family,
    isNew: !latest,
    due: Boolean(latest && Date.parse(latest.dueAt) <= Date.parse(now)),
    dueAt: latest?.dueAt,
    level: latest?.levelAfter ?? 0,
    lapseCount: latest?.lapseCount ?? 0,
    completedAttempts: completed.length,
    lastAttemptAt: latest?.finishedAt,
    lastQualification: latest?.qualification,
  };
}

function latestFor(workspace, predicate) {
  return workspace.attempts
    .filter((attempt) => !attempt.retired && predicate(attempt))
    .reduce((latest, attempt) => {
      const timestamp = activityAt(attempt);
      return !latest || latest < timestamp ? timestamp : latest;
    }, undefined);
}

function stableDueSort(left, right) {
  return (
    (left.state.dueAt ?? EPOCH).localeCompare(right.state.dueAt ?? EPOCH) ||
    (left.state.lastAttemptAt ?? EPOCH).localeCompare(right.state.lastAttemptAt ?? EPOCH) ||
    left.variant.id.localeCompare(right.variant.id)
  );
}

export function selectConceptTransferVariant(variants, workspace, options = {}) {
  const registry = variantRegistry(variants);
  const normalized = normalizeConceptTransferWorkspace(workspace, {
    variants,
    now: options.now,
  });
  const activeDraft = normalized.drafts.find(
    (draft) => draft.attemptId === normalized.activeAttemptId,
  );
  if (activeDraft) return registry.get(activeDraft.variantId);

  const lane = LANES.has(options.lane) ? options.lane : undefined;
  const candidates = [...registry.values()].filter(
    (variant) => !lane || variant.lane === lane,
  );
  if (!candidates.length) return undefined;
  const withState = candidates.map((variant) => ({
    variant,
    state: deriveConceptTransferVariantState(variant, normalized, {
      variants,
      now: options.now,
    }),
  }));
  const latestAttempt = normalized.attempts
    .filter((attempt) => !attempt.retired && (!lane || attempt.lane === lane))
    .sort((left, right) => activityAt(right).localeCompare(activityAt(left)) || left.id.localeCompare(right.id))[0];
  const activeFamily =
    normalizeConceptTransferText(options.activeFamily, { maxChars: 120, maxLines: 1 }) ||
    latestAttempt?.family;
  const dueActiveFamily = withState
    .filter(({ variant, state }) => state.due && variant.family === activeFamily)
    .sort(stableDueSort);
  if (dueActiveFamily.length) return dueActiveFamily[0].variant;

  const familyCounts = new Map();
  for (const variant of candidates) {
    familyCounts.set(variant.family, (familyCounts.get(variant.family) ?? 0) + 1);
  }
  const unseenSingleton = withState
    .filter(
      ({ variant, state }) => state.isNew && familyCounts.get(variant.family) === 1,
    )
    .sort((left, right) => left.variant.id.localeCompare(right.variant.id));
  if (unseenSingleton.length) return unseenSingleton[0].variant;

  const otherDue = withState.filter(({ state }) => state.due).sort(stableDueSort);
  if (otherDue.length) return otherDue[0].variant;

  return withState
    .map(({ variant, state }) => ({
      variant,
      state,
      laneAt: latestFor(normalized, (attempt) => attempt.lane === variant.lane),
      familyAt: latestFor(
        normalized,
        (attempt) => attempt.lane === variant.lane && attempt.family === variant.family,
      ),
    }))
    .sort(
      (left, right) =>
        (left.laneAt ?? EPOCH).localeCompare(right.laneAt ?? EPOCH) ||
        (left.familyAt ?? EPOCH).localeCompare(right.familyAt ?? EPOCH) ||
        (left.state.lastAttemptAt ?? EPOCH).localeCompare(right.state.lastAttemptAt ?? EPOCH) ||
        left.variant.id.localeCompare(right.variant.id),
    )[0]?.variant;
}

export function projectConceptTransferVariant(variant, session = {}) {
  const committed = Boolean(session?.committedAt);
  const maxHintLevel = boundedInt(session?.maxHintLevel, 0, 0, 3);
  const neutral = {
    id: variant.id,
    revision: variant.revision,
    lane: variant.lane,
    neutralLabel: variant.neutralLabel,
    scenario: variant.scenario,
    constraints: [...variant.constraints],
    estimatedMinutes: variant.estimatedMinutes,
    predictionPrompt: variant.predictionPrompt,
    reconstructionPrompt: variant.reconstructionPrompt,
    tradeoffPrompt: variant.tradeoffPrompt,
    hints: variant.hints.slice(0, maxHintLevel),
    revealed: committed,
  };
  if (!committed) return neutral;
  return {
    ...neutral,
    revealedTitle: variant.revealedTitle,
    family: variant.family,
    sourceItemIds: [...variant.sourceItemIds],
    referenceSnippet: variant.referenceSnippet,
    hints: [...variant.hints],
    review: {
      ...variant.review,
      criteria: [...variant.review.criteria],
    },
  };
}

function nextWorkspace(workspace, now, changes) {
  return {
    ...workspace,
    ...changes,
    revision: Math.min(1_000_000, workspace.revision + 1),
    updatedAt: now,
  };
}

export function resumeConceptTransferAttempt(workspace, variants, options = {}) {
  const normalized = normalizeConceptTransferWorkspace(workspace, {
    variants,
    now: options.now,
  });
  const attempt = normalized.attempts.find(
    (entry) => entry.id === normalized.activeAttemptId,
  );
  const draft = normalized.drafts.find(
    (entry) => entry.attemptId === normalized.activeAttemptId,
  );
  const variant = attempt
    ? variantRegistry(variants).get(attempt.variantId)
    : undefined;
  return attempt && variant
    ? {
        workspace: normalized,
        attempt,
        ...(draft ? { draft } : {}),
        variant,
        projection: projectConceptTransferVariant(variant, draft ?? attempt),
      }
    : undefined;
}

export function startConceptTransferAttempt(workspace, variants, options = {}) {
  const normalized = normalizeConceptTransferWorkspace(workspace, {
    variants,
    now: options.now,
  });
  if (resumeConceptTransferAttempt(normalized, variants, options)) return normalized;
  const id = cleanId(options.id);
  if (!id || normalized.attempts.some((attempt) => attempt.id === id)) return normalized;
  const registry = variantRegistry(variants);
  const requested = cleanId(options.variantId);
  const variant = requested
    ? registry.get(requested)
    : selectConceptTransferVariant(variants, normalized, options);
  if (!variant || (LANES.has(options.lane) && variant.lane !== options.lane)) return normalized;
  const now = cleanIso(options.now, EPOCH);
  const state = deriveConceptTransferVariantState(variant, normalized, {
    variants,
    now,
  });
  const clinicTargeted = options.clinicTargeted === true;
  const targetedAssistance = options.assisted === true || clinicTargeted;
  const attempt = {
    id,
    variantId: variant.id,
    variantRevision: variant.revision,
    lane: variant.lane,
    family: variant.family,
    startedAt: now,
    wasDue: !state.isNew && state.due,
    maxHintLevel: 0,
    hintRevealedAt: [],
    assisted: targetedAssistance,
    ...(clinicTargeted ? { clinicTargeted: true } : {}),
    updatedAt: now,
  };
  const draft = {
    attemptId: id,
    variantId: variant.id,
    variantRevision: variant.revision,
    prediction: "",
    reconstruction: "",
    tradeoff: "",
    maxHintLevel: 0,
    hintRevealedAt: [],
    assisted: targetedAssistance,
    ...(clinicTargeted ? { clinicTargeted: true } : {}),
    updatedAt: now,
  };
  return nextWorkspace(normalized, now, {
    attempts: [...normalized.attempts, attempt].slice(-CONCEPT_TRANSFER_LIMITS.attempts),
    drafts: [...normalized.drafts, draft].slice(-CONCEPT_TRANSFER_LIMITS.drafts),
    activeAttemptId: id,
  });
}

export function updateConceptTransferDraft(workspace, attemptId, patch, options = {}) {
  const normalized = normalizeConceptTransferWorkspace(workspace, options);
  const id = cleanId(attemptId);
  const draft = normalized.drafts.find((entry) => entry.attemptId === id);
  if (!draft || id !== normalized.activeAttemptId) return normalized;
  const now = cleanIso(options.now, normalized.updatedAt);
  const fields = attemptDraftFields({
    prediction: Object.hasOwn(patch ?? {}, "prediction") ? patch.prediction : draft.prediction,
    reconstruction: Object.hasOwn(patch ?? {}, "reconstruction")
      ? patch.reconstruction
      : draft.reconstruction,
    tradeoff: Object.hasOwn(patch ?? {}, "tradeoff") ? patch.tradeoff : draft.tradeoff,
  });
  const updated = { ...draft, ...fields, updatedAt: now };
  return nextWorkspace(normalized, now, {
    drafts: normalized.drafts.map((entry) =>
      entry.attemptId === id ? updated : entry,
    ),
  });
}

export function revealConceptTransferHint(workspace, attemptId, options = {}) {
  const normalized = normalizeConceptTransferWorkspace(workspace, options);
  const id = cleanId(attemptId);
  const draft = normalized.drafts.find((entry) => entry.attemptId === id);
  const attempt = normalized.attempts.find((entry) => entry.id === id);
  if (!draft || !attempt || id !== normalized.activeAttemptId || draft.maxHintLevel >= 3) {
    return normalized;
  }
  const now = cleanIso(options.now, normalized.updatedAt);
  const nextLevel = draft.maxHintLevel + 1;
  const timestamps = [...draft.hintRevealedAt, now].slice(0, nextLevel);
  return nextWorkspace(normalized, now, {
    drafts: normalized.drafts.map((entry) =>
      entry.attemptId === id
        ? {
            ...entry,
            maxHintLevel: nextLevel,
            hintRevealedAt: timestamps,
            assisted: true,
            updatedAt: now,
          }
        : entry,
    ),
    attempts: normalized.attempts.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            maxHintLevel: Math.max(entry.maxHintLevel, nextLevel),
            hintRevealedAt: timestamps,
            assisted: true,
            updatedAt: now,
          }
        : entry,
    ),
  });
}

export function commitConceptTransferAttempt(workspace, attemptId, options = {}) {
  const normalized = normalizeConceptTransferWorkspace(workspace, options);
  const id = cleanId(attemptId);
  const draft = normalized.drafts.find((entry) => entry.attemptId === id);
  const attempt = normalized.attempts.find((entry) => entry.id === id);
  if (
    !draft ||
    !attempt ||
    id !== normalized.activeAttemptId ||
    !draft.prediction ||
    !draft.reconstruction ||
    !draft.tradeoff
  ) {
    return normalized;
  }
  const now = cleanIso(options.now, normalized.updatedAt);
  const committed = {
    ...attempt,
    prediction: draft.prediction,
    reconstruction: draft.reconstruction,
    tradeoff: draft.tradeoff,
    maxHintLevel: Math.max(attempt.maxHintLevel, draft.maxHintLevel),
    hintRevealedAt: [...draft.hintRevealedAt],
    assisted: Boolean(attempt.assisted || draft.assisted || draft.maxHintLevel > 0),
    committedAt: now,
    referenceRevealedAt: now,
    updatedAt: now,
  };
  return nextWorkspace(normalized, now, {
    attempts: normalized.attempts.map((entry) => (entry.id === id ? committed : entry)),
    drafts: normalized.drafts.filter((entry) => entry.attemptId !== id),
  });
}

export function selfGradeConceptTransferAttempt(
  workspace,
  attemptId,
  grade,
  options = {},
) {
  const normalized = normalizeConceptTransferWorkspace(workspace, options);
  const id = cleanId(attemptId);
  const normalizedGrade = String(grade ?? "").toLowerCase();
  const attempt = normalized.attempts.find((entry) => entry.id === id);
  if (
    !attempt?.committedAt ||
    attempt.finishedAt ||
    !CONCEPT_TRANSFER_GRADES.includes(normalizedGrade)
  ) {
    return normalized;
  }
  const now = cleanIso(options.now, normalized.updatedAt);
  return nextWorkspace(normalized, now, {
    attempts: normalized.attempts.map((entry) =>
      entry.id === id
        ? { ...entry, grade: normalizedGrade, selfGradedAt: now, updatedAt: now }
        : entry,
    ),
  });
}

export function recordConceptTransferCriteria(
  workspace,
  attemptId,
  criteria,
  options = {},
) {
  const normalized = normalizeConceptTransferWorkspace(workspace, options);
  const id = cleanId(attemptId);
  const attempt = normalized.attempts.find((entry) => entry.id === id);
  const variant = variantRegistry(options.variants).get(attempt?.variantId);
  if (!attempt?.committedAt || attempt.finishedAt || !variant) return normalized;
  const authored = variant.review.criteria;
  const submitted = Array.isArray(criteria) ? criteria : [];
  const selected = [];
  for (const value of submitted) {
    const criterion = Number.isInteger(value) ? authored[value] : value;
    if (authored.includes(criterion) && !selected.includes(criterion)) selected.push(criterion);
    if (selected.length >= CONCEPT_TRANSFER_LIMITS.criteria) break;
  }
  const now = cleanIso(options.now, normalized.updatedAt);
  return nextWorkspace(normalized, now, {
    attempts: normalized.attempts.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            criteria: selected,
            criteriaRecordedAt: selected.length ? now : undefined,
            updatedAt: now,
          }
        : entry,
    ),
  });
}

export function recordConceptTransferTeachBack(
  workspace,
  attemptId,
  teachBack,
  options = {},
) {
  const normalized = normalizeConceptTransferWorkspace(workspace, options);
  const id = cleanId(attemptId);
  const attempt = normalized.attempts.find((entry) => entry.id === id);
  const response = normalizeConceptTransferText(teachBack, {
    maxChars: CONCEPT_TRANSFER_LIMITS.teachBackChars,
    maxLines: CONCEPT_TRANSFER_LIMITS.teachBackLines,
  });
  if (!attempt?.committedAt || attempt.finishedAt) return normalized;
  const now = cleanIso(options.now, normalized.updatedAt);
  return nextWorkspace(normalized, now, {
    attempts: normalized.attempts.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            teachBack: response,
            teachBackRecordedAt: response ? now : undefined,
            updatedAt: now,
          }
        : entry,
    ),
  });
}

function addDays(iso, days) {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}

export function finishConceptTransferAttempt(workspace, attemptId, options = {}) {
  const normalized = normalizeConceptTransferWorkspace(workspace, options);
  const id = cleanId(attemptId);
  const attempt = normalized.attempts.find((entry) => entry.id === id);
  if (
    !attempt?.committedAt ||
    attempt.finishedAt ||
    !attempt.grade ||
    !attempt.criteriaRecordedAt ||
    !attempt.criteria?.length ||
    !attempt.teachBack
  ) {
    return normalized;
  }
  const now = cleanIso(options.now, normalized.updatedAt);
  const prior = normalized.attempts
    .filter(
      (entry) =>
        entry.id !== id &&
        !entry.retired &&
        entry.variantId === attempt.variantId &&
        entry.variantRevision === attempt.variantRevision &&
        entry.finishedAt,
    )
    .sort((left, right) => left.finishedAt.localeCompare(right.finishedAt))
    .at(-1);
  const strongGrade = attempt.grade === "good" || attempt.grade === "easy";
  const qualification = attempt.assisted
    ? "assisted"
    : strongGrade
      ? "cold-self-assessed"
      : "reference-reconstruction";
  let levelAfter = 0;
  let lapseCount = prior?.lapseCount ?? 0;
  let dueAt = addDays(now, CONCEPT_TRANSFER_INTERVAL_DAYS[0]);
  if (prior && qualification === "cold-self-assessed") {
    if (Date.parse(now) >= Date.parse(prior.dueAt)) {
      levelAfter = Math.min(
        (prior.levelAfter ?? 0) + 1,
        CONCEPT_TRANSFER_INTERVAL_DAYS.length - 1,
      );
      dueAt = addDays(now, CONCEPT_TRANSFER_INTERVAL_DAYS[levelAfter]);
    } else {
      levelAfter = prior.levelAfter ?? 0;
      dueAt = prior.dueAt;
    }
  } else if (prior) {
    lapseCount = Math.min(1_000_000, lapseCount + 1);
  }
  const finished = {
    ...attempt,
    qualification,
    levelAfter,
    lapseCount,
    dueAt,
    finishedAt: now,
    updatedAt: now,
  };
  const changes = {
    attempts: normalized.attempts.map((entry) => (entry.id === id ? finished : entry)),
  };
  if (normalized.activeAttemptId === id) changes.activeAttemptId = undefined;
  return nextWorkspace(normalized, now, changes);
}

export function summarizeConceptTransferWorkspace(
  workspace,
  variants,
  options = {},
) {
  const normalized = normalizeConceptTransferWorkspace(workspace, {
    variants,
    now: options.now,
  });
  const eligible = [...variantRegistry(variants).values()].filter(
    (variant) => !LANES.has(options.lane) || variant.lane === options.lane,
  );
  const states = eligible.map((variant) =>
    deriveConceptTransferVariantState(variant, normalized, {
      variants,
      now: options.now,
    }),
  );
  const eligibleIds = new Set(eligible.map((variant) => variant.id));
  const completed = normalized.attempts.filter(
    (attempt) =>
      !attempt.retired && attempt.finishedAt && eligibleIds.has(attempt.variantId),
  );
  const activeAttempt = normalized.attempts.find(
    (attempt) => attempt.id === normalized.activeAttemptId,
  );
  return {
    version: CONCEPT_TRANSFER_WORKSPACE_VERSION,
    activeAttemptId:
      activeAttempt && eligibleIds.has(activeAttempt.variantId)
        ? normalized.activeAttemptId
        : undefined,
    variantCount: states.length,
    newCount: states.filter((state) => state.isNew).length,
    dueCount: states.filter((state) => state.due).length,
    completedAttemptCount: completed.length,
    assistedAttemptCount: completed.filter(
      (attempt) => attempt.qualification === "assisted",
    ).length,
    referenceReconstructionCount: completed.filter(
      (attempt) => attempt.qualification === "reference-reconstruction",
    ).length,
    coldSelfAssessedCount: completed.filter(
      (attempt) => attempt.qualification === "cold-self-assessed",
    ).length,
    retiredAttemptCount: normalized.attempts.filter(
      (attempt) => attempt.retired && eligibleIds.has(attempt.variantId),
    ).length,
    states,
  };
}

// Short aliases keep integration call sites readable without changing the
// descriptive exports used by tests and persisted-state migrations.
export const startConceptTransfer = startConceptTransferAttempt;
export const resumeConceptTransfer = resumeConceptTransferAttempt;
export const commitConceptTransfer = commitConceptTransferAttempt;
export const selfGradeConceptTransfer = selfGradeConceptTransferAttempt;
export const finishConceptTransfer = finishConceptTransferAttempt;
