export const MOCK_INTERVIEW_PRESETS = Object.freeze([
  Object.freeze({
    id: "screen",
    label: "Phone screen",
    durationMinutes: 30,
    difficulties: Object.freeze(["Easy"]),
    note: "A focused easy interview set with executable checks.",
  }),
  Object.freeze({
    id: "standard",
    label: "Coding interview",
    durationMinutes: 45,
    difficulties: Object.freeze(["Medium"]),
    note: "Realistic medium problems with no answer access.",
  }),
  Object.freeze({
    id: "stretch",
    label: "Stretch interview",
    durationMinutes: 60,
    difficulties: Object.freeze(["Medium", "Hard"]),
    note: "Longer, higher-variance work under interview rules.",
  }),
]);

export const MOCK_INTERVIEW_PROBLEM_COUNTS = Object.freeze([1, 2]);

export function mockInterviewPreset(presetId) {
  return (
    MOCK_INTERVIEW_PRESETS.find((preset) => preset.id === presetId) ??
    MOCK_INTERVIEW_PRESETS[1]
  );
}

function completedAtMs(attempt) {
  const parsed = Date.parse(attempt?.completedAt ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function currentAttemptsFor(item, attempts) {
  return (Array.isArray(attempts) ? attempts : []).filter(
    (attempt) =>
      attempt?.itemId === item.itemId &&
      attempt?.itemRevision === item.contentRevision,
  );
}

function rankedMockInterviewItems(items, attempts, presetId) {
  const preset = mockInterviewPreset(presetId);
  return (Array.isArray(items) ? items : [])
    .filter(
      (item) =>
        item?.source === "builtin" &&
        item?.track === "interview" &&
        item?.language === "python" &&
        item?.pattern !== "Python Fluency" &&
        item?.verification &&
        preset.difficulties.includes(item.difficulty),
    )
    .map((item) => {
      const evidence = currentAttemptsFor(item, attempts);
      const independentSolves = evidence.filter(
        (attempt) =>
          attempt.outcome === "completed" &&
          attempt.practiceKind === "solving" &&
          attempt.qualification === "solved",
      ).length;
      const solveAttempts = evidence.filter(
        (attempt) => attempt.practiceKind === "solving",
      ).length;
      const mostRecent = evidence.reduce(
        (latest, attempt) => Math.max(latest, completedAtMs(attempt)),
        0,
      );
      return { item, independentSolves, solveAttempts, mostRecent };
    })
    .sort(
      (left, right) =>
        left.independentSolves - right.independentSolves ||
        left.solveAttempts - right.solveAttempts ||
        left.mostRecent - right.mostRecent ||
        left.item.itemId.localeCompare(right.item.itemId),
    )
    .map((candidate) => candidate.item);
}

export function selectMockInterviewItems(
  items,
  attempts,
  presetId,
  problemCount,
) {
  if (!MOCK_INTERVIEW_PROBLEM_COUNTS.includes(problemCount)) return [];

  const selected = [];
  const selectedItemIds = new Set();
  for (const item of rankedMockInterviewItems(items, attempts, presetId)) {
    if (selectedItemIds.has(item.itemId)) continue;
    selectedItemIds.add(item.itemId);
    selected.push(item);
    if (selected.length === problemCount) return selected;
  }
  return [];
}

export function selectMockInterviewItem(items, attempts, presetId) {
  return selectMockInterviewItems(items, attempts, presetId, 1)[0] ?? null;
}

export function mockInterviewEndsAt(startedAt, durationMinutes) {
  const started = Date.parse(startedAt ?? "");
  const minutes = Math.max(1, Math.min(180, Math.round(Number(durationMinutes))));
  if (!Number.isFinite(started)) return null;
  return new Date(started + minutes * 60_000).toISOString();
}

export function mockInterviewRemainingMs(session, now = Date.now()) {
  if (session?.kind !== "mock") return null;
  const end = Date.parse(session.expiresAt ?? "");
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, end - Number(now || 0));
}

export function formatMockClock(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
