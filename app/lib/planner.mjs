const DAY_MS = 86_400_000;
const REVIEW_DAYS = [1, 3, 7, 14, 30];

function clamp(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

function asDate(value, fallback = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value ?? fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validAttempt(attempt, item) {
  return (
    attempt &&
    attempt.itemId === item.itemId &&
    Number(attempt.itemRevision ?? 1) === Number(item.contentRevision ?? 1) &&
    !Number.isNaN(Date.parse(attempt.completedAt ?? ""))
  );
}

function successful(attempt, activityKind) {
  if (attempt.outcome !== "completed" || Number(attempt.peeks ?? 0) > 0)
    return false;
  if (activityKind === "solve") {
    return Boolean(
      attempt.practiceKind === "solving" &&
        attempt.verification &&
        Number(attempt.verification.total) > 0 &&
        Number(attempt.verification.passed) ===
          Number(attempt.verification.total),
    );
  }
  if (attempt.practiceKind === "solving") return false;
  if (Number(attempt.accuracy ?? 0) < 95) return false;
  return activityKind !== "concept" || Number(attempt.stage ?? 0) >= 4;
}

function modeAttempts(attempts, item, activityKind) {
  return attempts
    .filter((attempt) => validAttempt(attempt, item))
    .filter((attempt) =>
      activityKind === "solve"
        ? attempt.practiceKind === "solving"
        : attempt.practiceKind !== "solving",
    )
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
}

function learningState(attempts, item, activityKind, now) {
  const relevant = modeAttempts(attempts, item, activityKind);
  let level = 0;
  let dueAt = null;
  let lapses = 0;
  let successes = 0;
  for (const attempt of relevant) {
    if (successful(attempt, activityKind)) {
      successes += 1;
      const interval = REVIEW_DAYS[Math.min(level, REVIEW_DAYS.length - 1)];
      level = Math.min(REVIEW_DAYS.length, level + 1);
      dueAt = new Date(Date.parse(attempt.completedAt) + interval * DAY_MS);
    } else {
      lapses += 1;
      level = Math.max(0, level - 1);
      dueAt = new Date(Date.parse(attempt.completedAt) + DAY_MS);
    }
  }
  const due = Boolean(dueAt && dueAt.getTime() <= now.getTime());
  const overdueDays = due
    ? Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / DAY_MS))
    : 0;
  return {
    relevant,
    level,
    dueAt,
    due,
    overdueDays,
    lapses,
    successes,
    last: relevant.at(-1) ?? null,
  };
}

function activityFor(item) {
  if (item.track === "ios") return "concept";
  if (item.language === "python" && item.pattern === "Python Fluency")
    return "syntax";
  if (item.language === "python" && item.verification) return "solve";
  return "syntax";
}

function laneFor(item, state) {
  if (state.due) return "review";
  if (item.track === "ios") return "ios";
  if (item.language === "python" && item.pattern === "Python Fluency")
    return "python";
  return "interview";
}

function estimateMinutes(item, activityKind) {
  if (activityKind === "solve")
    return Math.round(clamp(item.estimatedMinutes, 8, 7, 12));
  if (activityKind === "concept") return 5;
  return Math.round(clamp(item.estimatedMinutes, 4, 3, 6));
}

function recommendedStage(state, activityKind) {
  if (activityKind === "solve") return 5;
  if (activityKind === "concept") return state.successes ? 5 : 4;
  const highest = state.relevant
    .filter((attempt) => successful(attempt, activityKind))
    .reduce((value, attempt) => Math.max(value, Number(attempt.stage ?? 0)), 0);
  return Math.max(1, Math.min(5, highest + 1));
}

function taskRationale(item, state, activityKind, favorite) {
  if (state.due) {
    const late = state.overdueDays
      ? ` and is ${state.overdueDays} day${state.overdueDays === 1 ? "" : "s"} overdue`
      : "";
    return `${activityKind === "solve" ? "Independent solve" : "Recall"} evidence is due${late}.`;
  }
  if (state.last && !successful(state.last, activityKind))
    return "The most recent attempt was incomplete or assisted, so this skill needs a clean retrieval.";
  if (activityKind === "solve" && state.successes === 0)
    return "No independent passing solve is recorded for this pattern yet.";
  if (item.pattern === "Python Fluency")
    return "A short syntax warm-up reduces friction before full interview problems.";
  if (activityKind === "concept")
    return "A small iOS maintenance block keeps platform fundamentals available without displacing Python prep.";
  if (favorite) return "A saved item is ready for another deliberate recall pass.";
  return "Selected to broaden current-revision interview evidence.";
}

function candidateFor(item, attempts, favorites, now) {
  const activityKind = activityFor(item);
  const state = learningState(attempts, item, activityKind, now);
  const favorite = favorites.has(item.itemId);
  const lane = laneFor(item, state);
  let score = 0;
  if (state.due) score += 1_000 + state.overdueDays * 12;
  if (!state.relevant.length) score += 180;
  if (state.last && !successful(state.last, activityKind)) score += 260;
  score += state.lapses * 30;
  if (activityKind === "solve") score += state.successes ? 55 : 150;
  if (item.pattern === "Python Fluency") score += 85;
  if (activityKind === "concept") score += 35;
  if (favorite) score += 20;
  if (item.difficulty === "Hard" && state.successes === 0) score -= 90;
  const estimatedMinutes = estimateMinutes(item, activityKind);
  return {
    itemId: item.itemId,
    itemRevision: Math.max(1, Math.round(Number(item.contentRevision) || 1)),
    stage: recommendedStage(state, activityKind),
    status: "pending",
    practiceKind: activityKind === "solve" ? "solving" : "typing",
    activityKind,
    estimatedMinutes,
    rationale: taskRationale(item, state, activityKind, favorite).slice(0, 240),
    score,
    lane,
    track: item.track,
    language: item.language,
    pattern: item.pattern,
    due: state.due,
  };
}

function normalizeInputs(input) {
  const items = Array.isArray(input?.items)
    ? input.items.filter(
        (item) =>
          item &&
          typeof item.itemId === "string" &&
          (item.language === "python" || item.language === "swift") &&
          (item.track === "interview" || item.track === "ios"),
      )
    : [];
  const attempts = [
    ...(Array.isArray(input?.attempts) ? input.attempts : []),
    ...(Array.isArray(input?.solves) ? input.solves : []),
  ];
  return { items, attempts };
}

function addTask(selected, candidate, budgetMinutes, maxItems) {
  if (!candidate || selected.length >= maxItems) return false;
  if (selected.some((task) => task.itemId === candidate.itemId)) return false;
  const used = selected.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  if (used + candidate.estimatedMinutes > budgetMinutes) return false;
  selected.push(candidate);
  return true;
}

export function buildDailyPlan(input = {}, options = {}) {
  const { items, attempts } = normalizeInputs(input);
  const now = asDate(options.now ?? input.now);
  const profile = input.profile ?? input.trainingProfile ?? {};
  const budgetMinutes = Math.round(
    clamp(
      options.budgetMinutes ?? input.budgetMinutes,
      profile.dailyGoalMinutes ?? 30,
      5,
      120,
    ),
  );
  const maxItems = Math.round(
    clamp(options.maxItems ?? input.maxItems, 20, 1, 20),
  );
  const favorites = new Set(
    Array.isArray(input.favorites) ? input.favorites : [],
  );
  const candidates = items
    .map((item) => candidateFor(item, attempts, favorites, now))
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(a.itemId).localeCompare(String(b.itemId)) ||
        a.activityKind.localeCompare(b.activityKind),
    );

  const selected = [];
  const due = candidates.filter((candidate) => candidate.due);
  addTask(selected, due[0], budgetMinutes, maxItems);

  const pythonWarmup = candidates.find(
    (candidate) =>
      candidate.language === "python" &&
      candidate.pattern === "Python Fluency" &&
      !candidate.due,
  );
  addTask(selected, pythonWarmup, budgetMinutes, maxItems);

  const pythonSolve = candidates.find(
    (candidate) =>
      candidate.practiceKind === "solving" &&
      !selected.some((task) => task.itemId === candidate.itemId),
  );
  addTask(selected, pythonSolve, budgetMinutes, maxItems);

  if (budgetMinutes >= 30) {
    const ios = candidates.find(
      (candidate) =>
        candidate.track === "ios" &&
        !selected.some((task) => task.itemId === candidate.itemId),
    );
    addTask(selected, ios, budgetMinutes, maxItems);
  }

  for (const candidate of candidates)
    addTask(selected, candidate, budgetMinutes, maxItems);

  if (!selected.length && candidates.length) {
    const smallest = candidates
      .slice()
      .sort(
        (a, b) =>
          a.estimatedMinutes - b.estimatedMinutes || b.score - a.score,
      )[0];
    selected.push({
      ...smallest,
      estimatedMinutes: Math.min(budgetMinutes, smallest.estimatedMinutes),
    });
  }

  const entries = selected.map((task) => ({
    itemId: task.itemId,
    itemRevision: task.itemRevision,
    stage: task.stage,
    status: task.status,
    practiceKind: task.practiceKind,
    activityKind: task.activityKind,
    estimatedMinutes: task.estimatedMinutes,
    rationale: task.rationale,
    score: task.score,
    track: task.track,
    language: task.language,
  }));
  const estimatedMinutes = entries.reduce(
    (sum, task) => sum + task.estimatedMinutes,
    0,
  );
  const laneMinutes = { review: 0, interview: 0, python: 0, ios: 0 };
  for (const selectedTask of selected)
    laneMinutes[selectedTask.lane] += selectedTask.estimatedMinutes;
  const selectedDue = selected.filter((task) => task.due).length;
  return {
    date: dayKey(now),
    budgetMinutes,
    estimatedMinutes,
    tasks: entries,
    entries,
    laneMinutes,
    deferredDueCount: Math.max(0, due.length - selectedDue),
  };
}
