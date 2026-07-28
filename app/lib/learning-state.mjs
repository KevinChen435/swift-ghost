export const RETRIEVAL_GRADES = ["again", "hard", "good", "easy"];
export const FRICTION_CATEGORIES = [
  "none",
  "recognition",
  "invariant",
  "implementation",
  "syntax",
  "complexity",
  "api",
];
export const ACTIVITY_KINDS = ["syntax", "solve", "concept"];
const DAY_MS = 86_400_000;
const REVIEW_DAYS = [1, 3, 7, 14, 30];

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

function cleanText(value, limit) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, limit)
    : undefined;
}

export function activityKindFor(value = {}) {
  if (value.activityKind === "concept" || value.track === "ios")
    return "concept";
  if (value.activityKind === "solve" || value.practiceKind === "solving")
    return "solve";
  return "syntax";
}

export function normalizeLearningEvents(value, options = {}) {
  if (!Array.isArray(value)) return [];
  const validItemIds = options.validItemIds;
  const normalized = value.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const id = cleanText(raw.id, 120);
    const attemptId = cleanText(raw.attemptId, 120);
    const itemId = cleanText(raw.itemId, 160);
    const linkedAttempt = attemptId
      ? options.attemptsById?.get?.(attemptId)
      : undefined;
    if (
      !id ||
      !attemptId ||
      !itemId ||
      (validItemIds instanceof Set && !validItemIds.has(raw.itemId)) ||
      !RETRIEVAL_GRADES.includes(raw.grade) ||
      !FRICTION_CATEGORIES.includes(raw.friction) ||
      !ACTIVITY_KINDS.includes(raw.activityKind) ||
      (raw.practiceKind !== "typing" && raw.practiceKind !== "solving") ||
      (raw.activityKind === "solve" && raw.practiceKind !== "solving") ||
      (raw.activityKind !== "solve" && raw.practiceKind !== "typing") ||
      (options.attemptsById instanceof Map && !linkedAttempt) ||
      (linkedAttempt &&
        (linkedAttempt.itemId !== itemId ||
          Number(linkedAttempt.itemRevision) !== Number(raw.itemRevision) ||
          linkedAttempt.practiceKind !== raw.practiceKind)) ||
      typeof raw.createdAt !== "string" ||
      Number.isNaN(Date.parse(raw.createdAt))
    )
      return [];
    const promptSnapshot = cleanText(raw.promptSnapshot, 500);
    const response = cleanText(raw.response, 1000);
    return [
      {
        id,
        attemptId,
        itemId,
        itemRevision: Math.round(
          boundedNumber(raw.itemRevision, 1, 1, 1_000_000),
        ),
        practiceKind: raw.practiceKind,
        activityKind: raw.activityKind,
        grade: raw.grade,
        friction: raw.friction,
        confidence: Math.round(
          boundedNumber(raw.confidence, 3, 1, 5),
        ),
        createdAt: raw.createdAt,
        ...(promptSnapshot ? { promptSnapshot } : {}),
        ...(response ? { response } : {}),
      },
    ];
  });
  const byAttempt = new Map();
  for (const event of normalized) byAttempt.set(event.attemptId, event);
  return [...byAttempt.values()]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .slice(-1000);
}

export function upsertLearningEvent(events, event) {
  const existing = Array.isArray(events) ? events : [];
  return normalizeLearningEvents([
    ...existing.filter(
      (candidate) => candidate?.attemptId !== event?.attemptId,
    ),
    event,
  ]);
}

export function applyDebriefToReviewState(state = {}, event) {
  const rawDueAt =
    state.dueAt instanceof Date
      ? state.dueAt.getTime()
      : Date.parse(state.dueAt ?? "");
  const dueAt = Number.isFinite(rawDueAt) ? new Date(rawDueAt) : null;
  const level = Math.max(
    0,
    Math.min(REVIEW_DAYS.length, Math.round(Number(state.level) || 0)),
  );
  const lapses = Math.max(0, Math.round(Number(state.lapses) || 0));
  const eventAt = Date.parse(event?.createdAt ?? "");
  const lastAttemptAt = Number(state.lastAttemptAt) || 0;
  if (
    !RETRIEVAL_GRADES.includes(event?.grade) ||
    !Number.isFinite(eventAt) ||
    eventAt < lastAttemptAt
  )
    return { level, dueAt, lapses };

  if (event.grade === "again") {
    return {
      level: Math.max(0, level - 1),
      dueAt: new Date(eventAt + DAY_MS),
      lapses: lapses + 1,
    };
  }
  if (event.grade === "hard") {
    const hardDue = new Date(eventAt + 3 * DAY_MS);
    return {
      level,
      dueAt: !dueAt || hardDue.getTime() < dueAt.getTime() ? hardDue : dueAt,
      lapses,
    };
  }
  if (event.grade === "easy") {
    const interval = REVIEW_DAYS[Math.min(level + 1, REVIEW_DAYS.length - 1)];
    const easyDue = new Date(eventAt + interval * DAY_MS);
    return {
      level,
      dueAt: !dueAt || easyDue.getTime() > dueAt.getTime() ? easyDue : dueAt,
      lapses,
    };
  }
  return { level, dueAt, lapses };
}
