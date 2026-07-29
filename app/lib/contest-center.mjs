import { deriveVirtualRoundReport } from "./virtual-rounds.mjs";

export const CONTEST_CENTER_SECTIONS = Object.freeze([
  "overview",
  "live",
  "history",
  "standings",
  "review",
]);

const PRESET_ORDER = new Map([
  ["sprint", 0],
  ["standard", 1],
  ["endurance", 2],
]);

export function normalizeContestCenterSection(value) {
  return CONTEST_CENTER_SECTIONS.includes(value) ? value : "overview";
}

function reportRows(history) {
  return (Array.isArray(history) ? history : []).flatMap((run) => {
    const report = deriveVirtualRoundReport(run);
    if (!report) return [];
    return [{
      id: report.id,
      presetId: report.presetId,
      title: report.title,
      completedAt: report.completedAt,
      score: report.score,
      maxScore: report.maxScore,
      scorePercent: report.maxScore > 0
        ? Math.round((report.score / report.maxScore) * 100)
        : 0,
      acceptedCount: report.acceptedCount,
      problemCount: report.problemCount,
      elapsedMs: report.elapsedMs,
      penaltyMs: report.penaltyMs,
      archived: report.status === "archived",
      problems: report.problems,
    }];
  });
}

function comparePerformance(left, right) {
  return (
    right.score - left.score ||
    right.acceptedCount - left.acceptedCount ||
    left.penaltyMs - right.penaltyMs ||
    left.elapsedMs - right.elapsedMs ||
    right.completedAt.localeCompare(left.completedAt) ||
    left.id.localeCompare(right.id)
  );
}

function sameRank(left, right) {
  return (
    left.score === right.score &&
    left.acceptedCount === right.acceptedCount &&
    left.penaltyMs === right.penaltyMs &&
    left.elapsedMs === right.elapsedMs
  );
}

/**
 * Ranks only this learner's retained rounds. Ranks restart for each preset so
 * different duration/problem-count formats are never placed on one ladder.
 */
export function buildPersonalStandings(history, options = {}) {
  const requestedPreset = String(options.presetId ?? "all");
  const rows = reportRows(history).filter(
    (row) => requestedPreset === "all" || row.presetId === requestedPreset,
  );
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.presetId) ?? [];
    group.push(row);
    groups.set(row.presetId, group);
  }
  return [...groups.entries()]
    .sort(
      ([left], [right]) =>
        (PRESET_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
          (PRESET_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER),
    )
    .flatMap(([presetId, group]) => {
      const ordered = [...group].sort(comparePerformance);
      let rank = 0;
      return ordered.map((row, index) => {
        if (index === 0 || !sameRank(row, ordered[index - 1])) rank = index + 1;
        return { ...row, rank, cohortSize: ordered.length, presetId };
      });
    });
}

export function buildContestSummary(history) {
  const rows = reportRows(history).sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt) || left.id.localeCompare(right.id),
  );
  const totalScore = rows.reduce((sum, row) => sum + row.scorePercent, 0);
  const totalAccepted = rows.reduce((sum, row) => sum + row.acceptedCount, 0);
  const totalProblems = rows.reduce((sum, row) => sum + row.problemCount, 0);
  const bestScorePercent = rows.reduce(
    (best, row) => Math.max(best, row.scorePercent),
    0,
  );
  const presetStats = new Map();
  for (const row of rows) {
    const current = presetStats.get(row.presetId) ?? {
      presetId: row.presetId,
      title: row.title,
      rounds: 0,
      scorePercentTotal: 0,
    };
    current.rounds += 1;
    current.scorePercentTotal += row.scorePercent;
    presetStats.set(row.presetId, current);
  }
  const presetPerformance = [...presetStats.values()]
    .map((entry) => ({
      ...entry,
      averageScorePercent: Math.round(entry.scorePercentTotal / entry.rounds),
    }))
    .sort(
      (left, right) =>
        right.averageScorePercent - left.averageScorePercent ||
        right.rounds - left.rounds ||
        (PRESET_ORDER.get(left.presetId) ?? Number.MAX_SAFE_INTEGER) -
          (PRESET_ORDER.get(right.presetId) ?? Number.MAX_SAFE_INTEGER),
    );

  const patterns = new Map();
  for (const row of rows) {
    for (const problem of row.problems) {
      const current = patterns.get(problem.pattern) ?? {
        pattern: problem.pattern,
        problems: 0,
        accepted: 0,
        score: 0,
        maxScore: 0,
      };
      current.problems += 1;
      current.accepted += problem.status === "accepted" ? 1 : 0;
      current.score += problem.score;
      current.maxScore += problem.maxScore;
      patterns.set(problem.pattern, current);
    }
  }
  const patternPerformance = [...patterns.values()]
    .map((entry) => ({
      ...entry,
      scorePercent: entry.maxScore > 0
        ? Math.round((entry.score / entry.maxScore) * 100)
        : 0,
    }))
    .sort(
      (left, right) =>
        left.scorePercent - right.scorePercent ||
        right.problems - left.problems ||
        left.pattern.localeCompare(right.pattern),
    );

  return {
    totalRounds: rows.length,
    averageScorePercent: rows.length ? Math.round(totalScore / rows.length) : 0,
    bestScorePercent,
    totalAccepted,
    totalProblems,
    latestRoundId: rows[0]?.id,
    latestScorePercent: rows[0]?.scorePercent ?? 0,
    strongestPreset: presetPerformance[0] ?? null,
    presetPerformance,
    patternPerformance,
  };
}

export function selectContestReport(history, requestedId) {
  const rows = reportRows(history).sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt) || left.id.localeCompare(right.id),
  );
  return rows.find((row) => row.id === requestedId) ?? rows[0] ?? null;
}
