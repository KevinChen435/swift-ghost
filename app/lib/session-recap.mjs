import { supportsConceptPractice } from "./concept-practice.mjs";
import {
  deriveTypingProgression,
  rebuildTypingProgression,
} from "./typing-progression.mjs";

export const SESSION_REPLAY_MODES = ["all", "weak"];

// Replay must preserve the same execution boundary as the session builder:
// only trusted Swift contracts can be reopened as an independent solve. In
// particular, a Python verification payload is not evidence that a Swift item
// is runnable, and server-backed Swift items intentionally do not carry one.
function isServerRunnableSwift(item) {
  return Boolean(
    item?.solveCapability === "server" &&
      item?.language === "swift" &&
      typeof item?.trustedChallengeKey === "string" &&
      item.trustedChallengeKey.length > 0,
  );
}

function canReplayAsSolving(item) {
  return (
    isServerRunnableSwift(item) ||
    (item?.language === "python" && Boolean(item?.verification))
  );
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

export function normalizeSessionHistoryEntries(value) {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
      const itemId =
        typeof raw.itemId === "string" && /^[\w:.-]{1,180}$/.test(raw.itemId)
          ? raw.itemId
          : undefined;
      if (!itemId) return [];
      const status = ["pending", "completed", "skipped"].includes(raw.status)
        ? raw.status
        : "pending";
      const practiceKind = ["typing", "solving", "concept"].includes(
        raw.practiceKind,
      )
        ? raw.practiceKind
        : "typing";
      const attemptId =
        typeof raw.attemptId === "string" &&
        /^[\w:.-]{1,160}$/.test(raw.attemptId)
          ? raw.attemptId
          : undefined;
      const rationale =
        typeof raw.rationale === "string" && raw.rationale.trim()
          ? raw.rationale.trim().slice(0, 240)
          : undefined;
      const lane = ["review", "interview", "python", "ios"].includes(raw.lane)
        ? raw.lane
        : undefined;
      const estimatedMinutes = Math.round(
        boundedNumber(raw.estimatedMinutes, 0, 0, 180),
      );
      return [
        {
          itemId,
          itemRevision: Math.round(
            boundedNumber(raw.itemRevision, 1, 1, 1_000_000),
          ),
          stage:
            practiceKind === "solving"
              ? 5
              : Math.round(boundedNumber(raw.stage, 1, 1, 5)),
          status,
          practiceKind,
          ...(attemptId ? { attemptId } : {}),
          ...(estimatedMinutes ? { estimatedMinutes } : {}),
          ...(rationale ? { rationale } : {}),
          ...(lane ? { lane } : {}),
        },
      ];
    })
    .slice(0, 20);
}

function isStrongAttempt(attempt, typingProgression) {
  if (!attempt || attempt.outcome !== "completed" || attempt.peeks > 0)
    return false;
  if (attempt.practiceKind === "solving")
    return Boolean(
      attempt.verification &&
        attempt.verification.total > 0 &&
        attempt.verification.passed === attempt.verification.total,
    );
  if (attempt.practiceKind === "concept")
    return attempt.conceptGrade === "good" || attempt.conceptGrade === "easy";
  const cleanRecall = (
    attempt.stage === 5 &&
    attempt.qualification === "independent" &&
    attempt.accuracy >= 95
  );
  if (!cleanRecall || !typingProgression) return cleanRecall;
  return (
    typingProgression.owned &&
    typingProgression.attemptIds.includes(attempt.id) &&
    !typingProgression.bypassAttemptIds.includes(attempt.id)
  );
}

function compatibleAttempt(record, entry, attemptsById) {
  if (!entry.attemptId) return undefined;
  const attempt = attemptsById.get(entry.attemptId);
  if (
    !attempt ||
    attempt.sessionId !== record.id ||
    attempt.itemId !== entry.itemId ||
    Number(attempt.itemRevision) !== Number(entry.itemRevision)
  )
    return undefined;
  const expectedKind = entry.practiceKind ?? "typing";
  return attempt.practiceKind === expectedKind ? attempt : undefined;
}

function entryEvidence(entry, attempt, diagnosticBypass = false) {
  if (entry.status === "skipped")
    return attempt && attempt.outcome !== "completed"
      ? "Skipped after starting · ended before completion"
      : "Skipped";
  if (attempt && attempt.outcome !== "completed")
    return "Ended before completion";
  if (entry.status === "pending") return "Not reached";
  if (!attempt) return "Attempt detail unavailable";
  if (attempt.practiceKind === "solving") {
    const passed = attempt.verification?.passed ?? 0;
    const total = attempt.verification?.total ?? 0;
    return total > 0 ? `${passed}/${total} checks` : "No accepted judge evidence";
  }
  if (attempt.practiceKind === "concept") {
    const grade = attempt.conceptGrade ?? "ungraded";
    return `${grade} self-grade${attempt.peeks ? " · revealed" : " · answer first"}`;
  }
  return `${diagnosticBypass ? "Diagnostic only · " : ""}${attempt.wpm} WPM · ${attempt.accuracy}% accuracy${attempt.peeks ? " · peeked" : ""}`;
}

export function buildSessionRecap(
  record,
  attempts = [],
  items = [],
  typingProgress,
) {
  const snapshotEntries = Array.isArray(record?.entries) ? record.entries : [];
  const effectiveTypingProgress = typingProgress ?? rebuildTypingProgression(
    attempts,
    {
      revisions: new Map(
        items
          .filter(
            (item) =>
              item &&
              typeof item.itemId === "string" &&
              Number.isInteger(Number(item.contentRevision)),
          )
          .map((item) => [item.itemId, Number(item.contentRevision)]),
      ),
    },
  );
  const attemptsById = new Map(
    attempts
      .filter((attempt) => attempt && typeof attempt.id === "string")
      .map((attempt) => [attempt.id, attempt]),
  );
  const itemsById = new Map(
    items
      .filter((item) => item && typeof item.itemId === "string")
      .map((item) => [item.itemId, item]),
  );
  const entries = snapshotEntries.map((entry, index) => {
    const item = itemsById.get(entry.itemId);
    const attempt = compatibleAttempt(record, entry, attemptsById);
    const typingProgression =
      attempt?.practiceKind === "typing"
        ? deriveTypingProgression(
            effectiveTypingProgress,
            entry.itemId,
            entry.itemRevision,
            attempt.completedAt,
          )
        : undefined;
    const diagnosticBypass = Boolean(
      attempt && typingProgression?.bypassAttemptIds.includes(attempt.id),
    );
    const strong = isStrongAttempt(attempt, typingProgression);
    const available = Boolean(item && !item.transfer);
    const superseded = Boolean(
      item && Number(item.contentRevision) !== Number(entry.itemRevision),
    );
    return {
      ...entry,
      index,
      item,
      attempt,
      title: attempt?.titleSnapshot ?? item?.title ?? "Unavailable item",
      available,
      superseded,
      strong,
      diagnosticBypass,
      needsRetry: entry.status !== "completed" || !strong,
      evidence: entryEvidence(entry, attempt, diagnosticBypass),
    };
  });
  const linkedAttempts = entries
    .map((entry) => entry.attempt)
    .filter(Boolean);
  const typingAttempts = linkedAttempts.filter(
    (attempt) => attempt.practiceKind === "typing" && attempt.outcome === "completed",
  );
  const solveAttempts = linkedAttempts.filter(
    (attempt) => attempt.practiceKind === "solving" && attempt.outcome === "completed",
  );
  const conceptAttempts = linkedAttempts.filter(
    (attempt) => attempt.practiceKind === "concept" && attempt.outcome === "completed",
  );
  const elapsedMs = Math.max(
    0,
    Date.parse(record?.completedAt ?? "") - Date.parse(record?.startedAt ?? ""),
  );
  return {
    record,
    hasEntryDetail: entries.length > 0,
    entries,
    elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : 0,
    strongCount: entries.filter((entry) => entry.strong).length,
    weakCount: entries.filter((entry) => entry.needsRetry).length,
    availableCount: entries.filter((entry) => entry.available).length,
    weakAvailableCount: entries.filter(
      (entry) => entry.needsRetry && entry.available,
    ).length,
    typing: {
      count: typingAttempts.length,
      averageWpm: typingAttempts.length
        ? Math.round(
            typingAttempts.reduce((sum, attempt) => sum + attempt.wpm, 0) /
              typingAttempts.length,
          )
        : 0,
      averageAccuracy: typingAttempts.length
        ? Math.round(
            typingAttempts.reduce((sum, attempt) => sum + attempt.accuracy, 0) /
              typingAttempts.length,
          )
        : 0,
    },
    solving: {
      count: solveAttempts.length,
      accepted: solveAttempts.filter(isStrongAttempt).length,
    },
    concept: {
      count: conceptAttempts.length,
      strong: conceptAttempts.filter(isStrongAttempt).length,
    },
  };
}

export function buildSessionReplayQueue(
  record,
  attempts = [],
  items = [],
  mode = "all",
  typingProgress,
) {
  const selectedMode = SESSION_REPLAY_MODES.includes(mode) ? mode : "all";
  const recap = buildSessionRecap(record, attempts, items, typingProgress);
  return recap.entries
    .filter(
      (entry) =>
        entry.available && (selectedMode !== "weak" || entry.needsRetry),
    )
    .slice(0, 20)
    .map((entry) => {
      const item = entry.item;
      const practiceKind =
        entry.practiceKind === "solving" && canReplayAsSolving(item)
          ? "solving"
          : entry.practiceKind === "concept" && supportsConceptPractice(item)
            ? "concept"
            : "typing";
      return {
        itemId: item.itemId,
        itemRevision: item.contentRevision,
        stage:
          practiceKind === "solving"
            ? 5
            : Math.max(1, Math.min(5, Math.round(Number(entry.stage) || 1))),
        status: "pending",
        practiceKind,
        ...(entry.estimatedMinutes
          ? { estimatedMinutes: entry.estimatedMinutes }
          : {}),
        ...(entry.rationale ? { rationale: entry.rationale } : {}),
        ...(entry.lane ? { lane: entry.lane } : {}),
      };
    });
}
