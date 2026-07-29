const DAY_MS = 86_400_000;

export const REVIEW_INTERVAL_DAYS = Object.freeze([1, 3, 7, 14, 30]);

function timestamp(value) {
  const parsed =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function sameRevision(value, expected) {
  return Number(value ?? 1) === Number(expected ?? 1);
}

function matchesActivity(attempt, activityKind) {
  return activityKind === "solve"
    ? attempt?.practiceKind === "solving"
    : attempt?.practiceKind === "concept";
}

function cleanIndependentAttempt(attempt, activityKind) {
  if (
    attempt?.outcome !== "completed" ||
    Number(attempt.peeks ?? 0) > 0
  )
    return false;
  if (activityKind === "solve") {
    if (
      attempt.qualification !== undefined &&
      attempt.qualification !== "solved" &&
      attempt.qualification !== "independent"
    )
      return false;
    const total = Number(attempt.verification?.total);
    return (
      Number.isFinite(total) &&
      total > 0 &&
      Number(attempt.verification?.passed) === total
    );
  }
  if (
    attempt.qualification !== undefined &&
    attempt.qualification !== "independent"
  )
    return false;
  return attempt.conceptGrade === "good" || attempt.conceptGrade === "easy";
}

function intervalDays(level) {
  return REVIEW_INTERVAL_DAYS[
    Math.min(REVIEW_INTERVAL_DAYS.length - 1, Math.max(0, level - 1))
  ];
}

function eventForAttempt(events, attempt, options) {
  return events
    .filter(
      (event) =>
        event?.attemptId === attempt.id &&
        event.itemId === options.itemId &&
        sameRevision(event.itemRevision, options.itemRevision) &&
        event.activityKind === options.activityKind &&
        timestamp(event.createdAt) !== null &&
        timestamp(event.createdAt) >= timestamp(attempt.completedAt),
    )
    .sort(
      (left, right) =>
        timestamp(left.createdAt) - timestamp(right.createdAt) ||
        String(left.id ?? "").localeCompare(String(right.id ?? "")),
    )
    .at(-1);
}

/**
 * Derives solve/concept review state without rewarding massed retries.
 * Syntax review deliberately remains owned by typing-progression.mjs.
 */
export function deriveReviewProgression(attempts, options = {}) {
  const activityKind = options.activityKind;
  if (activityKind !== "solve" && activityKind !== "concept") {
    throw new TypeError('activityKind must be "solve" or "concept"');
  }
  const events = Array.isArray(options.events) ? options.events : [];
  const relevant = (Array.isArray(attempts) ? attempts : [])
    .map((attempt, index) => ({ attempt, index, at: timestamp(attempt?.completedAt) }))
    .filter(
      ({ attempt, at }) =>
        attempt &&
        at !== null &&
        attempt.itemId === options.itemId &&
        sameRevision(attempt.itemRevision, options.itemRevision) &&
        matchesActivity(attempt, activityKind),
    )
    .sort(
      (left, right) =>
        left.at - right.at ||
        String(left.attempt.id ?? "").localeCompare(
          String(right.attempt.id ?? ""),
        ) ||
        left.index - right.index,
    );

  let level = 0;
  let dueAt = null;
  let lapses = 0;
  let successes = 0;
  let acquired = false;
  let acquisitionAttemptId = null;
  let lastReviewAttemptId = null;
  const evidenceAttemptIds = [];
  const lapseAttemptIds = [];
  let lastDebrief = null;

  for (const { attempt, at } of relevant) {
    const event = eventForAttempt(events, attempt, options);
    if (
      event &&
      timestamp(event.createdAt) >= timestamp(lastDebrief?.createdAt)
    )
      lastDebrief = event;
    const grade = event?.grade;
    const clean = cleanIndependentAttempt(attempt, activityKind);

    if (!clean) {
      level = 0;
      dueAt = (timestamp(event?.createdAt) ?? at) + DAY_MS;
      lapses += 1;
      lapseAttemptIds.push(attempt.id);
      continue;
    }

    if (!acquired) {
      if (grade === "again") {
        level = 0;
        dueAt = (timestamp(event.createdAt) ?? at) + DAY_MS;
        lapses += 1;
        lapseAttemptIds.push(attempt.id);
        continue;
      }
      acquired = true;
      level = 1;
      successes += 1;
      acquisitionAttemptId = attempt.id;
      evidenceAttemptIds.push(attempt.id);
      dueAt = at + DAY_MS;
      continue;
    }

    // A clean retry before the gate is still useful practice, but it cannot
    // lengthen the interval or repair a lapse early.
    if (dueAt !== null && at < dueAt) continue;

    const anchor = timestamp(event?.createdAt) ?? at;
    if (grade === "again") {
      level = 0;
      dueAt = anchor + DAY_MS;
      lapses += 1;
      lapseAttemptIds.push(attempt.id);
      continue;
    } else if (grade === "hard") {
      level = Math.max(1, level);
    } else {
      // A lapse resets cadence: the first clean due retrieval restores the
      // one-day interval even when the learner grades it Easy.
      level =
        level === 0
          ? 1
          : Math.min(
              REVIEW_INTERVAL_DAYS.length,
              level + (grade === "easy" ? 2 : 1),
            );
    }
    dueAt = anchor + intervalDays(level) * DAY_MS;
    successes += 1;
    lastReviewAttemptId = attempt.id;
    evidenceAttemptIds.push(attempt.id);
  }

  const now = timestamp(options.now);
  const due = dueAt !== null && now !== null && dueAt <= now;
  return {
    level,
    dueAt: dueAt === null ? null : new Date(dueAt).toISOString(),
    due,
    overdueDays:
      due && now !== null ? Math.max(0, Math.floor((now - dueAt) / DAY_MS)) : 0,
    lapses,
    successes,
    last: relevant.at(-1)?.attempt ?? null,
    lastDebrief,
    acquisitionAttemptId,
    lastReviewAttemptId,
    evidenceAttemptIds,
    lapseAttemptIds,
  };
}
