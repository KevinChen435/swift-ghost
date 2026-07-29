import { applyDebriefToReviewState } from "./learning-state.mjs";
import { supportsConceptPractice } from "./concept-practice.mjs";
import {
  deriveTypingProgression,
  rebuildTypingProgression,
} from "./typing-progression.mjs";

const DAY_MS = 86_400_000;
const REVIEW_DAYS = [1, 3, 7, 14, 30];
const PLANNER_LANES = ["review", "interview", "python", "ios"];

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
  if (activityKind === "concept") {
    return Boolean(
      attempt.practiceKind === "concept" &&
        (attempt.conceptGrade === "good" || attempt.conceptGrade === "easy"),
    );
  }
  if (attempt.practiceKind !== "typing") return false;
  return (
    Number(attempt.stage) === 5 &&
    attempt.qualification === "independent" &&
    Number(attempt.accuracy ?? 0) >= 95
  );
}

function cleanGuidedTyping(attempt) {
  return Boolean(
    attempt &&
      attempt.practiceKind === "typing" &&
      attempt.outcome === "completed" &&
      Number(attempt.stage) >= 1 &&
      Number(attempt.stage) <= 4 &&
      Number(attempt.peeks ?? 0) === 0 &&
      Number(attempt.accuracy ?? 0) >= 95,
  );
}

function modeAttempts(attempts, item, activityKind) {
  return attempts
    .filter((attempt) => validAttempt(attempt, item))
    .filter((attempt) => {
      if (activityKind === "solve") return attempt.practiceKind === "solving";
      if (activityKind === "concept") return attempt.practiceKind === "concept";
      return attempt.practiceKind === "typing";
    })
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
}

function modeEvents(events, item, activityKind) {
  return events
    .filter(
      (event) =>
        event &&
        event.itemId === item.itemId &&
        Number(event.itemRevision ?? 1) ===
          Number(item.contentRevision ?? 1) &&
        event.activityKind === activityKind &&
        !Number.isNaN(Date.parse(event.createdAt ?? "")),
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function learningState(
  attempts,
  events,
  item,
  activityKind,
  now,
  typingProgress,
) {
  const relevant = modeAttempts(attempts, item, activityKind);
  const relevantEvents = modeEvents(events, item, activityKind);
  if (activityKind === "syntax") {
    const progression = deriveTypingProgression(
      typingProgress,
      item.itemId,
      item.contentRevision ?? 1,
      now.toISOString(),
    );
    return {
      relevant,
      level: progression.recallLevel,
      dueAt: progression.dueAt ? new Date(progression.dueAt) : null,
      due: progression.due,
      overdueDays:
        progression.due && progression.dueAt
          ? Math.max(
              0,
              Math.floor(
                (now.getTime() - Date.parse(progression.dueAt)) / DAY_MS,
              ),
            )
          : 0,
      lapses: progression.lapses,
      successes: progression.owned ? Math.max(1, progression.recallLevel) : 0,
      last: relevant.at(-1) ?? null,
      lastDebrief: relevantEvents.at(-1) ?? null,
      typingProgression: progression,
    };
  }
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
  const lastDebrief = relevantEvents.at(-1) ?? null;
  const lastAttemptAt = relevant.at(-1)
    ? Date.parse(relevant.at(-1).completedAt)
    : 0;
  ({ level, dueAt, lapses } = applyDebriefToReviewState(
    { level, dueAt, lapses, lastAttemptAt },
    lastDebrief,
  ));
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
    lastDebrief,
  };
}

function activityFor(item) {
  if (supportsConceptPractice(item)) return "concept";
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
  return state.typingProgression?.nextStage ?? 1;
}

function taskRationale(item, state, activityKind, favorite) {
  if (state.due) {
    const late = state.overdueDays
      ? ` and is ${state.overdueDays} day${state.overdueDays === 1 ? "" : "s"} overdue`
      : "";
    return `${activityKind === "solve" ? "Independent solve" : "Recall"} evidence is due${late}.`;
  }
  if (state.lastDebrief?.grade === "again")
    return `You marked the last retrieval Again because of ${state.lastDebrief.friction}, so this returns quickly.`;
  if (state.lastDebrief?.grade === "hard")
    return `The last retrieval felt hard (${state.lastDebrief.friction}); reinforce it before the trace fades.`;
  if (activityKind === "syntax" && state.typingProgression?.diagnosticOnly)
    return "The blank-editor pass was diagnostic. Rebuild the worked and faded steps before another ownership attempt.";
  if (activityKind === "syntax" && cleanGuidedTyping(state.last))
    return `Stage ${state.last.stage} was a clean learning step. Continue to Stage ${state.typingProgression?.nextStage ?? Math.min(5, Number(state.last.stage) + 1)} without treating guided work as mastery.`;
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

function candidateFor(item, attempts, events, favorites, now, typingProgress) {
  const activityKind = activityFor(item);
  const state = learningState(
    attempts,
    events,
    item,
    activityKind,
    now,
    typingProgress,
  );
  const favorite = favorites.has(item.itemId);
  const lane = laneFor(item, state);
  let score = 0;
  if (state.due) score += 1_000 + state.overdueDays * 12;
  if (!state.relevant.length) score += 180;
  const guidedProgress =
    activityKind === "syntax" && cleanGuidedTyping(state.last);
  if (state.typingProgression?.diagnosticOnly) score += 260;
  else if (guidedProgress) score += 120;
  else if (state.last && !successful(state.last, activityKind)) score += 260;
  score += state.lapses * 30;
  if (activityKind === "solve") score += state.successes ? 55 : 150;
  if (item.pattern === "Python Fluency") score += 85;
  if (activityKind === "concept") score += 35;
  if (state.lastDebrief?.grade === "again") score += 320;
  if (state.lastDebrief?.grade === "hard") score += 120;
  if (
    state.lastDebrief?.friction === "syntax" &&
    activityKind === "syntax"
  )
    score += 70;
  if (
    ["recognition", "invariant", "implementation"].includes(
      state.lastDebrief?.friction,
    ) &&
    activityKind === "solve"
  )
    score += 90;
  if (favorite) score += 20;
  if (item.difficulty === "Hard" && state.successes === 0) score -= 90;
  const estimatedMinutes = estimateMinutes(item, activityKind);
  return {
    itemId: item.itemId,
    itemRevision: Math.max(1, Math.round(Number(item.contentRevision) || 1)),
    stage: recommendedStage(state, activityKind),
    status: "pending",
    practiceKind:
      activityKind === "solve"
        ? "solving"
        : activityKind === "concept"
          ? "concept"
          : "typing",
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
  const events = [
    ...(Array.isArray(input?.learningEvents) ? input.learningEvents : []),
    ...(Array.isArray(input?.reviews) ? input.reviews : []),
  ];
  return { items, attempts, events, typingProgress: input?.typingProgress };
}

function addTask(selected, candidate, budgetMinutes, maxItems) {
  if (!candidate || selected.length >= maxItems) return false;
  if (selected.some((task) => task.itemId === candidate.itemId)) return false;
  const used = selected.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  if (used + candidate.estimatedMinutes > budgetMinutes) return false;
  selected.push(candidate);
  return true;
}

function requestedShares(profile) {
  const raw = {
    python: Number(profile?.pythonShare),
    review: Number(profile?.reviewShare),
    ios: Number(profile?.iosShare),
  };
  const supplied = Object.values(raw).some(Number.isFinite);
  if (!supplied) return null;
  const shares = Object.fromEntries(
    Object.entries(raw).map(([lane, value]) => [
      lane,
      Number.isFinite(value) ? Math.max(0, value) : 0,
    ]),
  );
  const total = shares.python + shares.review + shares.ios;
  if (!(total > 0)) return null;
  return {
    python: shares.python / total,
    review: shares.review / total,
    ios: shares.ios / total,
  };
}

function emptyLaneMinutes() {
  return { review: 0, interview: 0, python: 0, ios: 0 };
}

function recentLaneTotals(value) {
  const totals = emptyLaneMinutes();
  const records = Array.isArray(value) ? value : value ? [value] : [];
  for (const record of records) {
    const source = record?.laneMinutes ?? record;
    if (!source || typeof source !== "object") continue;
    for (const lane of PLANNER_LANES) {
      const minutes = Number(source[lane]);
      if (Number.isFinite(minutes) && minutes > 0)
        totals[lane] += Math.min(minutes, 1_000_000);
    }
  }
  return totals;
}

function allocationLane(candidate) {
  if (candidate.lane === "review") return "review";
  if (candidate.lane === "ios") return "ios";
  // pythonShare is the whole coding-interview track: fluency warm-ups plus
  // full interview solves. The public laneMinutes split remains unchanged.
  return "python";
}

function allocationTotals(recent, selected) {
  const totals = {
    python: recent.python + recent.interview,
    review: recent.review,
    ios: recent.ios,
  };
  for (const candidate of selected)
    totals[allocationLane(candidate)] += candidate.estimatedMinutes;
  return totals;
}

function selectByRollingAllocation(
  selected,
  candidates,
  shares,
  recent,
  budgetMinutes,
  maxItems,
) {
  while (selected.length < maxItems) {
    const used = selected.reduce(
      (sum, candidate) => sum + candidate.estimatedMinutes,
      0,
    );
    const fitting = candidates.filter(
      (candidate) =>
        !candidate.due &&
        !selected.some((task) => task.itemId === candidate.itemId) &&
        used + candidate.estimatedMinutes <= budgetMinutes,
    );
    if (!fitting.length) break;

    const availableLanes = new Set(fitting.map(allocationLane));
    const availableShare = [...availableLanes].reduce(
      (sum, lane) => sum + shares[lane],
      0,
    );
    const totals = allocationTotals(recent, selected);
    const historyTotal = [...availableLanes].reduce(
      (sum, lane) => sum + totals[lane],
      0,
    );

    fitting.sort((a, b) => {
      if (availableShare > 0) {
        const aLane = allocationLane(a);
        const bLane = allocationLane(b);
        const aTarget = shares[aLane] / availableShare;
        const bTarget = shares[bLane] / availableShare;
        const aLag = aTarget * historyTotal - totals[aLane];
        const bLag = bTarget * historyTotal - totals[bLane];
        if (Math.abs(bLag - aLag) > 1e-9) return bLag - aLag;
        if (Math.abs(bTarget - aTarget) > 1e-9) return bTarget - aTarget;
      }
      return (
        b.score - a.score ||
        String(a.itemId).localeCompare(String(b.itemId)) ||
        a.activityKind.localeCompare(b.activityKind)
      );
    });
    if (!addTask(selected, fitting[0], budgetMinutes, maxItems)) break;
  }
}

export function buildDailyPlan(input = {}, options = {}) {
  const { items, attempts, events, typingProgress } = normalizeInputs(input);
  const now = asDate(options.now ?? input.now);
  const effectiveTypingProgress =
    typingProgress ??
    rebuildTypingProgression(attempts, {
      now: now.toISOString(),
      validItemIds: items.map((item) => item.itemId),
      revisions: new Map(
        items.map((item) => [item.itemId, item.contentRevision ?? 1]),
      ),
    });
  const profile = input.profile ?? input.trainingProfile ?? {};
  const shares = requestedShares(profile);
  const recent = recentLaneTotals(
    options.recentLaneMinutes ?? input.recentLaneMinutes,
  );
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
    .map((item) =>
      candidateFor(
        item,
        attempts,
        events,
        favorites,
        now,
        effectiveTypingProgress,
      ),
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(a.itemId).localeCompare(String(b.itemId)) ||
        a.activityKind.localeCompare(b.activityKind),
    );

  const selected = [];
  const due = candidates.filter((candidate) => candidate.due);
  if (shares) {
    for (const candidate of due)
      addTask(selected, candidate, budgetMinutes, maxItems);
    if (due.length && !selected.length) {
      selected.push({
        ...due[0],
        estimatedMinutes: Math.min(budgetMinutes, due[0].estimatedMinutes),
      });
    }
    selectByRollingAllocation(
      selected,
      candidates,
      shares,
      recent,
      budgetMinutes,
      maxItems,
    );
  } else {
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
  }

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
    lane: task.lane,
  }));
  const estimatedMinutes = entries.reduce(
    (sum, task) => sum + task.estimatedMinutes,
    0,
  );
  const laneMinutes = emptyLaneMinutes();
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
