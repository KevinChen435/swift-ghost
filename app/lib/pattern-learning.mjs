export const PATTERN_LEARNING_VERSION = 2;
export const PATTERN_RESPONSE_LIMIT = 1_000;
export const PATTERN_REVIEW_LIMIT = 36;
export const PATTERN_GRADES = ["again", "hard", "good", "easy"];
export const PATTERN_DECISION_LIMIT = 180;
export const PATTERN_DECISION_SPRINT_LIMIT = 6;
export const PATTERN_DECISION_INTERVAL_DAYS = [1, 3, 7, 14, 30];
export const PATTERN_DECISION_SOURCES = [
  "academy",
  "today",
  "plan",
  "assessment",
  "weakness",
];

const EPOCH = "1970-01-01T00:00:00.000Z";
const DAY_MS = 86_400_000;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanIso(value, fallback = EPOCH) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : fallback;
}

function cleanText(value, limit = PATTERN_RESPONSE_LIMIT) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, limit).join("");
}

function cleanId(value, limit = 160) {
  const normalized = cleanText(value, limit);
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9._:-]{0,158}[a-zA-Z0-9])?$/.test(
    normalized,
  )
    ? normalized
    : "";
}

function boundedInteger(value, fallback, min, max) {
  const number = Math.round(Number(value));
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, number))
    : fallback;
}

function lessonRegistry(lessons) {
  return new Map(
    (Array.isArray(lessons) ? lessons : []).map((lesson) => [
      lesson.id,
      {
        revision: lesson.revision,
        checkIds: new Set(lesson.checks.map((check) => check.id)),
      },
    ]),
  );
}

function probeRegistry(probes) {
  return new Map(
    (Array.isArray(probes) ? probes : []).map((probe) => [
      probe.id,
      {
        probe,
        revision: probe.revision,
        lessonId: probe.lessonId,
        candidateLessonIds: new Set(probe.candidateLessonIds),
      },
    ]),
  );
}

export function createPatternLearningWorkspace(now = EPOCH) {
  return {
    version: PATTERN_LEARNING_VERSION,
    revision: 0,
    updatedAt: cleanIso(now),
    reviews: [],
    decisionAttempts: [],
  };
}

export function normalizePatternLearningWorkspace(value, options = {}) {
  const lessons = lessonRegistry(options.lessons);
  const probes = probeRegistry(options.probes);
  if (!isRecord(value) || ![1, PATTERN_LEARNING_VERSION].includes(value.version))
    return createPatternLearningWorkspace(options.now);
  const deduped = new Map();
  for (const raw of Array.isArray(value.reviews) ? value.reviews : []) {
    if (!isRecord(raw)) continue;
    const lesson = lessons.get(raw.lessonId);
    if (!lesson || typeof raw.checkId !== "string") continue;
    const lessonRevision = Number(raw.lessonRevision);
    if (
      !Number.isInteger(lessonRevision) ||
      lessonRevision !== lesson.revision ||
      !lesson.checkIds.has(raw.checkId)
    )
      continue;
    const response = cleanText(raw.response);
    if (!response) continue;
    const committedAt = cleanIso(raw.committedAt);
    const updatedAt = cleanIso(raw.updatedAt, committedAt);
    const revealedAt = raw.revealedAt
      ? cleanIso(raw.revealedAt, updatedAt)
      : undefined;
    const grade =
      revealedAt && PATTERN_GRADES.includes(raw.grade) ? raw.grade : undefined;
    const review = {
      lessonId: raw.lessonId,
      lessonRevision,
      checkId: raw.checkId,
      response,
      committedAt,
      ...(revealedAt ? { revealedAt } : {}),
      ...(grade ? { grade } : {}),
      updatedAt,
    };
    const key = `${review.lessonId}:${review.lessonRevision}:${review.checkId}`;
    const prior = deduped.get(key);
    if (!prior || prior.updatedAt <= review.updatedAt) deduped.set(key, review);
  }
  const reviews = [...deduped.values()]
    .sort((a, b) =>
      a.updatedAt.localeCompare(b.updatedAt) ||
      a.lessonId.localeCompare(b.lessonId) ||
      a.checkId.localeCompare(b.checkId),
    )
    .slice(-PATTERN_REVIEW_LIMIT);
  const decisionById = new Map();
  if (value.version === PATTERN_LEARNING_VERSION) {
    for (const raw of Array.isArray(value.decisionAttempts)
      ? value.decisionAttempts
      : []) {
      if (!isRecord(raw)) continue;
      const id = cleanId(raw.id);
      const sprintId = cleanId(raw.sprintId);
      const probeEntry = probes.get(raw.probeId);
      const lessonEntry = lessons.get(raw.lessonId);
      const selectedLessonId = cleanText(raw.selectedLessonId, 80);
      const source = PATTERN_DECISION_SOURCES.includes(raw.source)
        ? raw.source
        : "academy";
      if (
        !id ||
        !sprintId ||
        !probeEntry ||
        !lessonEntry ||
        probeEntry.lessonId !== raw.lessonId ||
        probeEntry.revision !== Number(raw.probeRevision) ||
        lessonEntry.revision !== Number(raw.lessonRevision) ||
        !probeEntry.candidateLessonIds.has(selectedLessonId)
      )
        continue;
      const cue = cleanText(raw.cue, 600);
      const invariant = cleanText(raw.invariant, 800);
      const whyNot = cleanText(raw.whyNot, 800);
      if (!cue || !invariant || !whyNot) continue;
      const committedAt = cleanIso(raw.committedAt);
      const revealedAt = raw.revealedAt
        ? cleanIso(raw.revealedAt, committedAt)
        : undefined;
      const grade =
        revealedAt && PATTERN_GRADES.includes(raw.grade) ? raw.grade : undefined;
      const completedAt = grade
        ? cleanIso(raw.completedAt, revealedAt)
        : undefined;
      const dueAt = completedAt ? cleanIso(raw.dueAt, completedAt) : undefined;
      const attempt = {
        id,
        sprintId,
        source,
        probeId: probeEntry.probe.id,
        probeRevision: probeEntry.revision,
        lessonId: raw.lessonId,
        lessonRevision: lessonEntry.revision,
        selectedLessonId,
        cue,
        invariant,
        whyNot,
        assisted: Boolean(raw.assisted),
        wasDue: Boolean(raw.wasDue),
        match: selectedLessonId === raw.lessonId,
        committedAt,
        ...(revealedAt ? { revealedAt } : {}),
        ...(grade ? { grade } : {}),
        ...(completedAt
          ? {
              completedAt,
              dueAt,
              levelAfter: boundedInteger(
                raw.levelAfter,
                0,
                0,
                PATTERN_DECISION_INTERVAL_DAYS.length,
              ),
              lapseCount: boundedInteger(raw.lapseCount, 0, 0, 1_000_000),
            }
          : {}),
        updatedAt: cleanIso(raw.updatedAt, completedAt ?? revealedAt ?? committedAt),
      };
      const prior = decisionById.get(id);
      if (!prior || prior.updatedAt <= attempt.updatedAt)
        decisionById.set(id, attempt);
    }
  }
  const decisionAttempts = [...decisionById.values()]
    .sort(
      (a, b) =>
        a.committedAt.localeCompare(b.committedAt) || a.id.localeCompare(b.id),
    )
    .slice(-PATTERN_DECISION_LIMIT);
  let activeSprint;
  if (value.version === PATTERN_LEARNING_VERSION && isRecord(value.activeSprint)) {
    const raw = value.activeSprint;
    const id = cleanId(raw.id);
    const source = PATTERN_DECISION_SOURCES.includes(raw.source)
      ? raw.source
      : "academy";
    const seen = new Set();
    const rawEntries = Array.isArray(raw.entries) ? raw.entries : [];
    const entries = rawEntries.flatMap(
      (entry) => {
        if (!isRecord(entry) || seen.has(entry.probeId)) return [];
        const probeEntry = probes.get(entry.probeId);
        if (
          !probeEntry ||
          probeEntry.revision !== Number(entry.probeRevision) ||
          !lessons.has(probeEntry.probe.lessonId)
        )
          return [];
        seen.add(entry.probeId);
        return [
          { probeId: probeEntry.probe.id, probeRevision: probeEntry.revision },
        ];
      },
    ).slice(0, PATTERN_DECISION_SPRINT_LIMIT);
    const completeEntrySet =
      rawEntries.length > 0 &&
      rawEntries.length <= PATTERN_DECISION_SPRINT_LIMIT &&
      entries.length === rawEntries.length;
    if (id && completeEntrySet) {
      const cursor = boundedInteger(raw.cursor, 0, 0, entries.length);
      const completed = raw.status === "completed" || cursor >= entries.length;
      activeSprint = {
        id,
        source,
        entries,
        cursor: completed ? entries.length : cursor,
        status: completed ? "completed" : "active",
        startedAt: cleanIso(raw.startedAt, options.now),
        ...(completed
          ? { completedAt: cleanIso(raw.completedAt, raw.updatedAt) }
          : {}),
        updatedAt: cleanIso(raw.updatedAt, options.now),
      };
    }
  }
  return {
    version: PATTERN_LEARNING_VERSION,
    revision: Math.max(0, Math.min(1_000_000, Math.round(Number(value.revision) || 0))),
    updatedAt: cleanIso(value.updatedAt, options.now),
    reviews,
    decisionAttempts,
    ...(activeSprint ? { activeSprint } : {}),
  };
}

function mutateReview(workspace, lesson, checkId, now, update) {
  const normalized =
    isRecord(workspace) && [1, PATTERN_LEARNING_VERSION].includes(workspace.version)
      ? {
          version: PATTERN_LEARNING_VERSION,
          revision: Math.max(
            0,
            Math.min(1_000_000, Math.round(Number(workspace.revision) || 0)),
          ),
          updatedAt: cleanIso(workspace.updatedAt, now),
          reviews: (Array.isArray(workspace.reviews) ? workspace.reviews : [])
            .filter(isRecord)
            .slice(-PATTERN_REVIEW_LIMIT),
          decisionAttempts:
            workspace.version === PATTERN_LEARNING_VERSION &&
            Array.isArray(workspace.decisionAttempts)
              ? workspace.decisionAttempts.filter(isRecord).slice(-PATTERN_DECISION_LIMIT)
              : [],
          ...(workspace.version === PATTERN_LEARNING_VERSION &&
          isRecord(workspace.activeSprint)
            ? { activeSprint: workspace.activeSprint }
            : {}),
        }
      : createPatternLearningWorkspace(now);
  const check = lesson?.checks?.find((candidate) => candidate.id === checkId);
  if (!check) return workspace;
  const key = `${lesson.id}:${lesson.revision}:${checkId}`;
  const reviews = normalized.reviews.filter(
    (review) =>
      `${review.lessonId}:${review.lessonRevision}:${review.checkId}` !== key,
  );
  const existing = normalized.reviews.find(
    (review) =>
      review.lessonId === lesson.id &&
      review.lessonRevision === lesson.revision &&
      review.checkId === checkId,
  );
  const next = update(existing, cleanIso(now));
  if (!next) return workspace;
  return {
    ...normalized,
    revision: normalized.revision + 1,
    updatedAt: cleanIso(now),
    reviews: [...reviews, next].slice(-PATTERN_REVIEW_LIMIT),
  };
}

export function commitPatternResponse(workspace, lesson, checkId, response, options = {}) {
  const cleaned = cleanText(response);
  if (!cleaned) return workspace;
  return mutateReview(workspace, lesson, checkId, options.now, (_existing, now) => ({
    lessonId: lesson.id,
    lessonRevision: lesson.revision,
    checkId,
    response: cleaned,
    committedAt: now,
    updatedAt: now,
  }));
}

export function revealPatternAnswer(workspace, lesson, checkId, options = {}) {
  return mutateReview(workspace, lesson, checkId, options.now, (existing, now) =>
    existing
      ? { ...existing, revealedAt: existing.revealedAt ?? now, updatedAt: now }
      : null,
  );
}

export function gradePatternCheck(workspace, lesson, checkId, grade, options = {}) {
  if (!PATTERN_GRADES.includes(grade)) return workspace;
  return mutateReview(workspace, lesson, checkId, options.now, (existing, now) =>
    existing?.revealedAt
      ? { ...existing, grade, updatedAt: now }
      : null,
  );
}

function mutablePatternWorkspace(workspace, now = EPOCH) {
  if (!isRecord(workspace) || ![1, PATTERN_LEARNING_VERSION].includes(workspace.version))
    return createPatternLearningWorkspace(now);
  return {
    version: PATTERN_LEARNING_VERSION,
    revision: boundedInteger(workspace.revision, 0, 0, 1_000_000),
    updatedAt: cleanIso(workspace.updatedAt, now),
    reviews: (Array.isArray(workspace.reviews) ? workspace.reviews : [])
      .filter(isRecord)
      .slice(-PATTERN_REVIEW_LIMIT),
    decisionAttempts:
      workspace.version === PATTERN_LEARNING_VERSION &&
      Array.isArray(workspace.decisionAttempts)
        ? workspace.decisionAttempts.filter(isRecord).slice(-PATTERN_DECISION_LIMIT)
        : [],
    ...(workspace.version === PATTERN_LEARNING_VERSION &&
    isRecord(workspace.activeSprint)
      ? { activeSprint: workspace.activeSprint }
      : {}),
  };
}

function currentDecisionAttempts(lesson, workspace, probes = []) {
  const revisions = new Map(
    (Array.isArray(probes) ? probes : []).map((probe) => [probe.id, probe.revision]),
  );
  return (Array.isArray(workspace?.decisionAttempts)
    ? workspace.decisionAttempts
    : []
  )
    .filter(
      (attempt) =>
        attempt.lessonId === lesson.id &&
        attempt.lessonRevision === lesson.revision &&
        (!revisions.size || revisions.get(attempt.probeId) === attempt.probeRevision),
    )
    .sort(
      (a, b) =>
        a.committedAt.localeCompare(b.committedAt) || a.id.localeCompare(b.id),
    );
}

function latestCompletedDecision(lesson, workspace, probes = [], excludedId) {
  const completed = currentDecisionAttempts(lesson, workspace, probes).filter(
    (attempt) => attempt.completedAt && attempt.id !== excludedId,
  );
  return completed.at(-1);
}

export function derivePatternDecisionState(
  lesson,
  workspace,
  probes = [],
  options = {},
) {
  const now = Date.parse(cleanIso(options.now, EPOCH));
  const attempts = currentDecisionAttempts(lesson, workspace, probes);
  const completed = attempts.filter((attempt) => attempt.completedAt);
  const latest = completed.at(-1);
  const dueAt = latest?.dueAt ? cleanIso(latest.dueAt) : undefined;
  const due = !latest || Date.parse(dueAt) <= now;
  const retainedProbeIds = new Set(
    completed
      .filter(
        (attempt) =>
          attempt.wasDue &&
          attempt.match &&
          !attempt.assisted &&
          (attempt.grade === "good" || attempt.grade === "easy"),
      )
      .map((attempt) => attempt.probeId),
  );
  return {
    lessonId: lesson.id,
    level: latest?.levelAfter ?? 0,
    lapseCount: latest?.lapseCount ?? 0,
    dueAt,
    due,
    isNew: completed.length === 0,
    retained: retainedProbeIds.size >= 2,
    retainedProbeCount: retainedProbeIds.size,
    completedAttempts: completed.length,
    lastAttemptAt: latest?.completedAt,
  };
}

export function derivePatternDecisionOverview(
  lessons,
  probes,
  workspace,
  options = {},
) {
  const eligibleLessons = (Array.isArray(lessons) ? lessons : []).filter((lesson) =>
    (Array.isArray(probes) ? probes : []).some((probe) => probe.lessonId === lesson.id),
  );
  const states = eligibleLessons.map((lesson) =>
    derivePatternDecisionState(lesson, workspace, probes, options),
  );
  return {
    newCount: states.filter((state) => state.isNew).length,
    dueCount: states.filter((state) => !state.isNew && state.due).length,
    readyCount: states.filter((state) => state.due).length,
    retainedCount: states.filter((state) => state.retained).length,
    totalPatterns: states.length,
    states,
  };
}

export function selectPatternDecisionProbes(
  lessons,
  probes,
  workspace,
  options = {},
) {
  const count = boundedInteger(options.count, 3, 1, PATTERN_DECISION_SPRINT_LIMIT);
  const attempts = Array.isArray(workspace?.decisionAttempts)
    ? workspace.decisionAttempts
    : [];
  const rankedLessons = (Array.isArray(lessons) ? lessons : [])
    .filter((lesson) =>
      (Array.isArray(probes) ? probes : []).some((probe) => probe.lessonId === lesson.id),
    )
    .map((lesson) => ({
      lesson,
      state: derivePatternDecisionState(lesson, workspace, probes, options),
    }))
    .sort(
      (a, b) =>
        Number(b.state.due) - Number(a.state.due) ||
        (a.state.dueAt ?? EPOCH).localeCompare(b.state.dueAt ?? EPOCH) ||
        a.lesson.order - b.lesson.order,
    );
  return rankedLessons.slice(0, count).flatMap(({ lesson }) => {
    const candidates = (Array.isArray(probes) ? probes : []).filter(
      (probe) => probe.lessonId === lesson.id,
    );
    const lessonAttempts = attempts
      .filter(
        (attempt) =>
          attempt.lessonId === lesson.id &&
          attempt.lessonRevision === lesson.revision,
      )
      .sort((a, b) => a.committedAt.localeCompare(b.committedAt));
    const lastProbeId = lessonAttempts.at(-1)?.probeId;
    const counts = new Map(
      candidates.map((probe) => [
        probe.id,
        lessonAttempts.filter(
          (attempt) =>
            attempt.probeId === probe.id && attempt.probeRevision === probe.revision,
        ).length,
      ]),
    );
    candidates.sort(
      (a, b) =>
        Number(a.id === lastProbeId) - Number(b.id === lastProbeId) ||
        (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) ||
        a.id.localeCompare(b.id),
    );
    return candidates.slice(0, 1);
  });
}

export function startPatternDecisionSprint(
  workspace,
  lessons,
  probes,
  options = {},
) {
  const normalized = mutablePatternWorkspace(workspace, options.now);
  if (normalized.activeSprint?.status === "active") return workspace;
  const id = cleanId(options.id);
  if (!id) return workspace;
  const selected = selectPatternDecisionProbes(lessons, probes, normalized, options);
  if (!selected.length) return workspace;
  const now = cleanIso(options.now);
  const source = PATTERN_DECISION_SOURCES.includes(options.source)
    ? options.source
    : "academy";
  return {
    ...normalized,
    revision: normalized.revision + 1,
    updatedAt: now,
    activeSprint: {
      id,
      source,
      entries: selected.map((probe) => ({
        probeId: probe.id,
        probeRevision: probe.revision,
      })),
      cursor: 0,
      status: "active",
      startedAt: now,
      updatedAt: now,
    },
  };
}

function currentSprintProbe(workspace) {
  const sprint = workspace?.activeSprint;
  if (!sprint || sprint.status !== "active") return null;
  return sprint.entries?.[sprint.cursor] ?? null;
}

export function commitPatternDecision(
  workspace,
  probe,
  lesson,
  input,
  options = {},
) {
  const normalized = mutablePatternWorkspace(workspace, options.now);
  const current = currentSprintProbe(normalized);
  const id = cleanId(options.id);
  const selectedLessonId = cleanText(input?.selectedLessonId, 80);
  const cue = cleanText(input?.cue, 600);
  const invariant = cleanText(input?.invariant, 800);
  const whyNot = cleanText(input?.whyNot, 800);
  if (
    !id ||
    !current ||
    current.probeId !== probe?.id ||
    current.probeRevision !== probe?.revision ||
    probe.lessonId !== lesson?.id ||
    !probe.candidateLessonIds.includes(selectedLessonId) ||
    !cue ||
    !invariant ||
    !whyNot ||
    normalized.decisionAttempts.some(
      (attempt) =>
        attempt.sprintId === normalized.activeSprint.id &&
        attempt.probeId === probe.id &&
        !attempt.completedAt,
    )
  )
    return workspace;
  const now = cleanIso(options.now);
  const latest = latestCompletedDecision(lesson, normalized, options.probes ?? []);
  const wasDue = !latest || Date.parse(latest.dueAt ?? EPOCH) <= Date.parse(now);
  const attempt = {
    id,
    sprintId: normalized.activeSprint.id,
    source: normalized.activeSprint.source,
    probeId: probe.id,
    probeRevision: probe.revision,
    lessonId: lesson.id,
    lessonRevision: lesson.revision,
    selectedLessonId,
    cue,
    invariant,
    whyNot,
    assisted: Boolean(input?.assisted),
    wasDue,
    match: selectedLessonId === lesson.id,
    committedAt: now,
    updatedAt: now,
  };
  return {
    ...normalized,
    revision: normalized.revision + 1,
    updatedAt: now,
    decisionAttempts: [...normalized.decisionAttempts, attempt].slice(
      -PATTERN_DECISION_LIMIT,
    ),
  };
}

export function revealPatternDecision(workspace, attemptId, options = {}) {
  const normalized = mutablePatternWorkspace(workspace, options.now);
  const current = currentSprintProbe(normalized);
  const index = normalized.decisionAttempts.findIndex(
    (attempt) => attempt.id === attemptId,
  );
  const existing = normalized.decisionAttempts[index];
  if (
    !existing ||
    existing.revealedAt ||
    existing.completedAt ||
    !current ||
    existing.sprintId !== normalized.activeSprint.id ||
    existing.probeId !== current.probeId
  )
    return workspace;
  const now = cleanIso(options.now);
  const decisionAttempts = [...normalized.decisionAttempts];
  decisionAttempts[index] = { ...existing, revealedAt: now, updatedAt: now };
  return {
    ...normalized,
    revision: normalized.revision + 1,
    updatedAt: now,
    decisionAttempts,
  };
}

export function gradePatternDecision(workspace, attemptId, grade, options = {}) {
  if (!PATTERN_GRADES.includes(grade)) return workspace;
  const normalized = mutablePatternWorkspace(workspace, options.now);
  const current = currentSprintProbe(normalized);
  const index = normalized.decisionAttempts.findIndex(
    (attempt) => attempt.id === attemptId,
  );
  const existing = normalized.decisionAttempts[index];
  if (
    !existing?.revealedAt ||
    existing.completedAt ||
    !current ||
    existing.sprintId !== normalized.activeSprint.id ||
    existing.probeId !== current.probeId
  )
    return workspace;
  const now = cleanIso(options.now);
  const lesson = (Array.isArray(options.lessons) ? options.lessons : []).find(
    (candidate) =>
      candidate.id === existing.lessonId &&
      candidate.revision === existing.lessonRevision,
  );
  if (!lesson) return workspace;
  const prior = latestCompletedDecision(
    lesson,
    normalized,
    options.probes ?? [],
    existing.id,
  );
  const priorLevel = prior?.levelAfter ?? 0;
  const priorLapses = prior?.lapseCount ?? 0;
  const strong = grade === "good" || grade === "easy";
  const advances = existing.wasDue && existing.match && !existing.assisted && strong;
  const earlyStrong = !existing.wasDue && existing.match && !existing.assisted && strong;
  let levelAfter = priorLevel;
  let lapseCount = priorLapses;
  let dueAt;
  if (advances) {
    const interval = PATTERN_DECISION_INTERVAL_DAYS[
      Math.min(priorLevel, PATTERN_DECISION_INTERVAL_DAYS.length - 1)
    ];
    levelAfter = Math.min(
      PATTERN_DECISION_INTERVAL_DAYS.length,
      priorLevel + 1,
    );
    dueAt = new Date(Date.parse(now) + interval * DAY_MS).toISOString();
  } else if (earlyStrong && prior?.dueAt) {
    dueAt = cleanIso(prior.dueAt, now);
  } else {
    levelAfter = Math.max(0, priorLevel - 1);
    if (!existing.match || grade === "again") lapseCount += 1;
    dueAt = new Date(Date.parse(now) + DAY_MS).toISOString();
  }
  const decisionAttempts = [...normalized.decisionAttempts];
  decisionAttempts[index] = {
    ...existing,
    grade,
    completedAt: now,
    dueAt,
    levelAfter,
    lapseCount,
    updatedAt: now,
  };
  const nextCursor = normalized.activeSprint.cursor + 1;
  const completed = nextCursor >= normalized.activeSprint.entries.length;
  return {
    ...normalized,
    revision: normalized.revision + 1,
    updatedAt: now,
    decisionAttempts,
    activeSprint: {
      ...normalized.activeSprint,
      cursor: completed ? normalized.activeSprint.entries.length : nextCursor,
      status: completed ? "completed" : "active",
      ...(completed ? { completedAt: now } : {}),
      updatedAt: now,
    },
  };
}

function completedAttempt(attempt) {
  return attempt?.outcome === "completed";
}

function verifiedIndependent(attempt) {
  return Boolean(
    completedAttempt(attempt) &&
      attempt.practiceKind === "solving" &&
      attempt.peeks === 0 &&
      attempt.verification?.total > 0 &&
      attempt.verification.passed === attempt.verification.total &&
      (attempt.qualification === "solved" || attempt.qualification === "independent"),
  );
}

export function derivePatternEvidence(
  lesson,
  workspace,
  attempts = [],
  items = [],
) {
  const currentReviews = (workspace?.reviews ?? []).filter(
    (review) =>
      review.lessonId === lesson.id &&
      review.lessonRevision === lesson.revision,
  );
  const currentRevisions = new Map(
    (Array.isArray(items) ? items : []).map((item) => [
      item.itemId,
      item.contentRevision,
    ]),
  );
  const enforceCurrentRevision = currentRevisions.size > 0;
  const lessonAttempts = (Array.isArray(attempts) ? attempts : []).filter(
    (attempt) => {
      const belongsToLesson = [
        lesson.practice.workedItemId,
        lesson.practice.guidedItemId,
        lesson.practice.coldItemId,
        lesson.practice.transferItemId,
      ].includes(attempt.itemId);
      return (
        belongsToLesson &&
        (!enforceCurrentRevision ||
          currentRevisions.get(attempt.itemId) === attempt.itemRevision)
      );
    },
  );
  const worked = lessonAttempts.some(
    (attempt) =>
      attempt.itemId === lesson.practice.workedItemId &&
      attempt.practiceKind === "typing" &&
      attempt.stage === 1 &&
      completedAttempt(attempt),
  );
  const guided = lessonAttempts.some(
    (attempt) =>
      attempt.itemId === lesson.practice.guidedItemId &&
      attempt.practiceKind === "typing" &&
      attempt.stage === 3 &&
      completedAttempt(attempt),
  );
  const independent = lessonAttempts.some(
    (attempt) =>
      attempt.itemId === lesson.practice.coldItemId && verifiedIndependent(attempt),
  );
  const transfer = lesson.practice.transferItemId
    ? lessonAttempts.some(
        (attempt) =>
          attempt.itemId === lesson.practice.transferItemId &&
          verifiedIndependent(attempt),
      )
    : false;
  return {
    committedChecks: currentReviews.length,
    revealedChecks: currentReviews.filter((review) => review.revealedAt).length,
    strongChecks: currentReviews.filter((review) =>
      review.grade === "good" || review.grade === "easy",
    ).length,
    worked,
    guided,
    independent,
    transfer,
  };
}

export function countStrongPatternChecks(lessons, workspace) {
  return (Array.isArray(lessons) ? lessons : []).reduce(
    (total, lesson) =>
      total + derivePatternEvidence(lesson, workspace).strongChecks,
    0,
  );
}

export function selectNextPatternLesson(
  lessons,
  workspace,
  attempts = [],
  items = [],
) {
  const ranked = (Array.isArray(lessons) ? lessons : []).map((lesson) => {
    const evidence = derivePatternEvidence(lesson, workspace, attempts, items);
    const priority =
      evidence.committedChecks === 0
        ? 0
        : evidence.strongChecks < lesson.checks.length
          ? 1
          : !evidence.worked
            ? 2
            : !evidence.guided
              ? 3
              : !evidence.independent
                ? 4
                : lesson.practice.transferItemId && !evidence.transfer
                  ? 5
                  : 6;
    return { lesson, priority };
  });
  ranked.sort(
    (a, b) => a.priority - b.priority || a.lesson.order - b.lesson.order,
  );
  return ranked[0]?.lesson ?? null;
}
