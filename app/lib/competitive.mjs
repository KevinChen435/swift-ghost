const MIN_SOURCE_CHARACTERS = 20;
const MAX_SOURCE_CHARACTERS = 100_000;
const MIN_DURATION_MS = 1_000;
const MAX_DURATION_MS = 4 * 60 * 60 * 1_000;
const MAX_TRUSTED_WPM = 300;
const DEFAULT_CONTEXT_SIZE = 5;
const MAX_CONTEXT_SIZE = 9;

const BUILTIN_ITEM_ID = /^(?:builtin:\d+|python:\d+|ios:[a-z0-9][a-z0-9-]*)$/i;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function revisionOf(item) {
  const revision =
    item?.contentRevision ?? item?.itemRevision ?? item?.revision;
  return Number.isInteger(revision) ? revision : null;
}

function sourceOf(item) {
  const source = item?.code ?? item?.sourceCode ?? item?.text;
  return typeof source === "string" ? source : null;
}

function completedAtMs(value) {
  if (finiteNumber(value)) return value;
  if (typeof value !== "string") return Number.NaN;
  return Date.parse(value);
}

function completedAtIso(value) {
  const timestamp = completedAtMs(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function contextSize(value) {
  if (!Number.isFinite(value)) return DEFAULT_CONTEXT_SIZE;
  return Math.max(1, Math.min(MAX_CONTEXT_SIZE, Math.trunc(value)));
}

/**
 * Computes the ranking WPM from canonical source length and elapsed time.
 * The learner-supplied WPM and keystroke totals are intentionally ignored.
 */
export function computeTrustedWpm(sourceLength, durationMs) {
  if (
    !Number.isInteger(sourceLength) ||
    sourceLength < 1 ||
    !Number.isInteger(durationMs) ||
    durationMs < 1
  ) {
    return null;
  }
  return Math.round((sourceLength / 5 / (durationMs / 60_000)) * 100) / 100;
}

function ineligible(reason, sourceLength = null) {
  return {
    eligible: false,
    reason,
    activity: null,
    sourceLength,
    trustedWpm: null,
  };
}

/**
 * Applies the same learning and integrity boundaries used by public rankings.
 * A valid stage represents either guided typing (1-4) or blank-editor recall (5).
 */
export function assessCommunityComparability(attempt, item) {
  if (!isRecord(attempt) || !isRecord(item)) return ineligible("missing-data");
  if (
    item.source !== "builtin" ||
    !BUILTIN_ITEM_ID.test(String(item.itemId ?? ""))
  ) {
    return ineligible("not-built-in");
  }
  if (attempt.itemId !== item.itemId) return ineligible("different-item");

  const currentRevision = revisionOf(item);
  if (
    currentRevision === null ||
    !Number.isInteger(attempt.itemRevision) ||
    attempt.itemRevision !== currentRevision
  ) {
    return ineligible("stale-revision");
  }
  if (attempt.outcome !== "completed" && attempt.completed !== true) {
    return ineligible("incomplete");
  }
  if (attempt.mode !== "strict") return ineligible("not-strict");
  if (
    !Number.isInteger(attempt.stage) ||
    attempt.stage < 1 ||
    attempt.stage > 5
  ) {
    return ineligible("not-typing-or-recall");
  }
  const declaredActivity = attempt.activity ?? attempt.practiceKind;
  if (
    declaredActivity !== undefined &&
    declaredActivity !== "typing" &&
    declaredActivity !== "recall"
  ) {
    return ineligible("not-typing-or-recall");
  }
  if (!Number.isInteger(attempt.peeks) || attempt.peeks !== 0) {
    return ineligible("assisted");
  }
  if (
    !finiteNumber(attempt.accuracy) ||
    attempt.accuracy < 95 ||
    attempt.accuracy > 100
  ) {
    return ineligible("low-accuracy");
  }

  const source = sourceOf(item);
  const sourceLength = source === null ? null : source.length;
  if (
    sourceLength === null ||
    sourceLength < MIN_SOURCE_CHARACTERS ||
    sourceLength > MAX_SOURCE_CHARACTERS
  ) {
    return ineligible("implausible-characters", sourceLength);
  }
  if (
    !Number.isInteger(attempt.durationMs) ||
    attempt.durationMs < MIN_DURATION_MS ||
    attempt.durationMs > MAX_DURATION_MS
  ) {
    return ineligible("implausible-duration", sourceLength);
  }
  const trustedWpm = computeTrustedWpm(sourceLength, attempt.durationMs);
  if (trustedWpm === null || trustedWpm > MAX_TRUSTED_WPM) {
    return ineligible("implausible-speed", sourceLength);
  }
  if (!Number.isFinite(completedAtMs(attempt.completedAt))) {
    return ineligible("invalid-completed-at", sourceLength);
  }

  return {
    eligible: true,
    reason: null,
    activity: attempt.stage === 5 ? "recall" : "typing",
    sourceLength,
    trustedWpm,
  };
}

function comparisonValue(entry) {
  const timestamp = completedAtMs(entry?.completedAt);
  if (
    !isRecord(entry) ||
    !finiteNumber(entry.wpm) ||
    !finiteNumber(entry.accuracy) ||
    !Number.isInteger(entry.durationMs) ||
    !Number.isFinite(timestamp)
  ) {
    return null;
  }
  return {
    wpm: entry.wpm,
    accuracy: entry.accuracy,
    durationMs: entry.durationMs,
    completedAtMs: timestamp,
  };
}

/** Sort order shared with the server: speed, accuracy, duration, then time. */
export function compareLeaderboardEntries(left, right) {
  const a = comparisonValue(left);
  const b = comparisonValue(right);
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return (
    b.wpm - a.wpm ||
    b.accuracy - a.accuracy ||
    a.durationMs - b.durationMs ||
    a.completedAtMs - b.completedAtMs
  );
}

export function orderLeaderboardEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => comparisonValue(entry) !== null)
    .sort(
      (left, right) =>
        compareLeaderboardEntries(left.entry, right.entry) ||
        left.index - right.index,
    )
    .map(({ entry }) => entry);
}

function communityRow(entry) {
  return {
    kind: "community",
    displayName:
      typeof entry.user?.displayName === "string" &&
      entry.user.displayName.trim()
        ? entry.user.displayName.trim()
        : typeof entry.displayName === "string" && entry.displayName.trim()
          ? entry.displayName.trim()
          : "Community learner",
    wpm: entry.wpm,
    accuracy: entry.accuracy,
    durationMs: entry.durationMs,
    completedAt: completedAtIso(entry.completedAt),
  };
}

function attemptRow(attempt, assessment) {
  return {
    kind: "attempt",
    activity: assessment.activity,
    wpm: assessment.trustedWpm,
    accuracy: attempt.accuracy,
    durationMs: attempt.durationMs,
    completedAt: completedAtIso(attempt.completedAt),
  };
}

function matchesRankingGroup(entry, attempt, item) {
  const revision = revisionOf(item);
  return entry.stage === attempt.stage && entry.itemRevision === revision;
}

/**
 * Builds a small post-attempt comparison against a fetched leaderboard window.
 * It reports only visible-window relationships; it never labels the attempt with
 * an account rank because the client cannot account-deduplicate or see all rows.
 */
export function buildLeaderboardPreview({
  attempt,
  item,
  entries,
  contextSize: requestedContextSize,
} = {}) {
  const assessment = assessCommunityComparability(attempt, item);
  if (!assessment.eligible) {
    return {
      kind: "ineligible",
      assessment,
      candidate: null,
      visibleCount: 0,
      context: [],
    };
  }

  const size = contextSize(requestedContextSize);
  const candidate = attemptRow(attempt, assessment);
  const comparableEntries = orderLeaderboardEntries(
    Array.isArray(entries)
      ? entries.filter((entry) => matchesRankingGroup(entry, attempt, item))
      : [],
  );
  const visible = comparableEntries.map(communityRow);
  if (visible.length === 0) {
    return {
      kind: "empty",
      assessment,
      candidate,
      visibleCount: 0,
      context: [candidate],
    };
  }

  const insertionIndex = comparableEntries.findIndex(
    (entry) => compareLeaderboardEntries(candidate, entry) < 0,
  );
  if (insertionIndex === -1) {
    const preceding = size > 1 ? visible.slice(-(size - 1)) : [];
    return {
      kind: "cutoff",
      assessment,
      candidate,
      visibleCount: visible.length,
      cutoff: visible.at(-1),
      context: [...preceding, candidate],
    };
  }

  const combined = [...visible];
  combined.splice(insertionIndex, 0, candidate);
  const before = Math.floor((size - 1) / 2);
  const maximumStart = Math.max(0, combined.length - size);
  const start = Math.min(Math.max(0, insertionIndex - before), maximumStart);
  return {
    kind: "top-window",
    assessment,
    candidate,
    visibleCount: visible.length,
    aheadOfVisible: insertionIndex,
    behindVisible: visible.length - insertionIndex,
    context: combined.slice(start, start + size),
  };
}
