export const VIRTUAL_ROUND_VERSION = 1;
export const VIRTUAL_ROUND_POINTS_PER_PROBLEM = 100;
export const VIRTUAL_ROUND_WRONG_PENALTY_MS = 5 * 60_000;

export const VIRTUAL_ROUND_PRESETS = Object.freeze([
  Object.freeze({
    id: "sprint",
    title: "Sprint Round",
    description: "Two focused problems for a compact strategy and pacing rehearsal.",
    durationMinutes: 45,
    problemCount: 2,
  }),
  Object.freeze({
    id: "standard",
    title: "Standard Round",
    description: "Three problems with enough room to switch, triage, and return.",
    durationMinutes: 75,
    problemCount: 3,
  }),
  Object.freeze({
    id: "endurance",
    title: "Endurance Round",
    description: "Four problems for sustained attention and deliberate time allocation.",
    durationMinutes: 105,
    problemCount: 4,
  }),
]);

export const VIRTUAL_ROUND_LIMITS = Object.freeze({
  maxHistory: 12,
  maxProblems: 4,
  maxSubmissionsPerProblem: 64,
  maxSourceBytes: 24_000,
  maxIdBytes: 120,
  maxTitleBytes: 240,
  maxPatternBytes: 120,
  maxDifficultyBytes: 40,
});

const SUBMISSION_VERDICTS = Object.freeze([
  "accepted",
  "wrong-answer",
  "runtime-error",
  "time-limit",
  "invalid-entrypoint",
  "judge-error",
]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function finiteInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function iso(value, fallback) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function truncateUtf8(value, maxBytes) {
  let result = "";
  let used = 0;
  for (const character of String(value ?? "")) {
    const size = byteLength(character);
    if (used + size > maxBytes) break;
    result += character;
    used += size;
  }
  return result;
}

function boundedString(value, maxBytes, fallback = "") {
  return truncateUtf8(typeof value === "string" ? value : fallback, maxBytes);
}

function boundedId(value) {
  const id = boundedString(value, VIRTUAL_ROUND_LIMITS.maxIdBytes).trim();
  return id && !/[\u0000-\u001f\u007f]/u.test(id) ? id : null;
}

function presetById(id) {
  return VIRTUAL_ROUND_PRESETS.find((preset) => preset.id === id) ?? null;
}

function difficultyRank(value) {
  return value === "Easy" ? 0 : value === "Medium" ? 1 : value === "Hard" ? 2 : 3;
}

function targetDifficulties(count) {
  if (count === 2) return ["Easy", "Medium"];
  if (count === 3) return ["Easy", "Medium", "Hard"];
  return ["Easy", "Medium", "Medium", "Hard"];
}

export function selectVirtualRoundItems(candidates, problemCount) {
  const count = Number(problemCount);
  if (!Number.isInteger(count) || count < 1 || count > VIRTUAL_ROUND_LIMITS.maxProblems)
    return [];
  const normalized = (Array.isArray(candidates) ? candidates : [])
    .flatMap((candidate) => {
      if (!isRecord(candidate)) return [];
      const itemId = boundedId(candidate.itemId);
      const pattern = boundedString(candidate.pattern, VIRTUAL_ROUND_LIMITS.maxPatternBytes).trim();
      const difficulty = boundedString(candidate.difficulty, VIRTUAL_ROUND_LIMITS.maxDifficultyBytes).trim();
      if (!itemId || !pattern || !difficulty) return [];
      return [{
        ...candidate,
        itemId,
        pattern,
        difficulty,
        independentSolves: finiteInteger(candidate.independentSolves, 0, 0, 1_000_000),
        roundAppearances: finiteInteger(candidate.roundAppearances, 0, 0, 1_000_000),
        lastAttemptAt:
          typeof candidate.lastAttemptAt === "string" && !Number.isNaN(Date.parse(candidate.lastAttemptAt))
            ? new Date(candidate.lastAttemptAt).toISOString()
            : undefined,
      }];
    })
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
  if (normalized.length < count) return [];

  const selected = [];
  const usedIds = new Set();
  const patternCounts = new Map();
  for (const target of targetDifficulties(count)) {
    const available = normalized.filter((candidate) => !usedIds.has(candidate.itemId));
    const exact = available.filter((candidate) => candidate.difficulty === target);
    const pool = exact.length ? exact : available;
    pool.sort((left, right) =>
      (patternCounts.get(left.pattern) ?? 0) - (patternCounts.get(right.pattern) ?? 0) ||
      left.independentSolves + left.roundAppearances -
        (right.independentSolves + right.roundAppearances) ||
      left.roundAppearances - right.roundAppearances ||
      (left.lastAttemptAt ?? "").localeCompare(right.lastAttemptAt ?? "") ||
      difficultyRank(left.difficulty) - difficultyRank(right.difficulty) ||
      left.itemId.localeCompare(right.itemId),
    );
    const chosen = pool[0];
    if (!chosen) break;
    selected.push(chosen);
    usedIds.add(chosen.itemId);
    patternCounts.set(chosen.pattern, (patternCounts.get(chosen.pattern) ?? 0) + 1);
  }
  return selected;
}

export function createVirtualRoundWorkspace() {
  return { version: VIRTUAL_ROUND_VERSION, active: null, history: [] };
}

function normalizeProblemSnapshot(value, fallbackNow) {
  if (!isRecord(value)) return null;
  const id = boundedId(value.id ?? value.itemId);
  const itemId = boundedId(value.itemId);
  const title = boundedString(value.title, VIRTUAL_ROUND_LIMITS.maxTitleBytes).trim();
  const pattern = boundedString(value.pattern, VIRTUAL_ROUND_LIMITS.maxPatternBytes).trim();
  const difficulty = boundedString(value.difficulty, VIRTUAL_ROUND_LIMITS.maxDifficultyBytes).trim();
  if (!id || !itemId || !title || !pattern || !difficulty) return null;
  const source = boundedString(value.source, VIRTUAL_ROUND_LIMITS.maxSourceBytes);
  const starterSource = boundedString(value.starterSource, VIRTUAL_ROUND_LIMITS.maxSourceBytes);
  const openedAt = value.openedAt ? iso(value.openedAt, undefined) : undefined;
  const submissions = (Array.isArray(value.submissions) ? value.submissions : [])
    .slice(-VIRTUAL_ROUND_LIMITS.maxSubmissionsPerProblem)
    .flatMap((submission) => {
      const normalized = normalizeSubmission(submission, fallbackNow);
      return normalized ? [normalized] : [];
    });
  return {
    id,
    itemId,
    itemRevision: finiteInteger(value.itemRevision, 1, 1, 1_000_000),
    verificationRevision: finiteInteger(value.verificationRevision, 1, 1, 1_000_000),
    title,
    pattern,
    difficulty,
    starterSource,
    source,
    openedAt,
    flagged: Boolean(value.flagged),
    submissions,
  };
}

function normalizeSubmission(value, fallbackNow) {
  if (!isRecord(value)) return null;
  const id = boundedId(value.id);
  if (!id) return null;
  const requestedAt = iso(value.requestedAt, fallbackNow);
  const rawStatus = value.status === "pending"
    ? "pending"
    : SUBMISSION_VERDICTS.includes(value.status)
      ? value.status
      : null;
  if (!rawStatus) return null;
  const total = finiteInteger(value.total, 0, 0, 100);
  const passed = finiteInteger(value.passed, 0, 0, total);
  const status =
    rawStatus === "accepted" && !(total > 0 && passed === total)
      ? "judge-error"
      : rawStatus;
  const rawJudgedAt = status === "pending" ? undefined : iso(value.judgedAt, requestedAt);
  const judgedAt =
    rawJudgedAt && Date.parse(rawJudgedAt) < Date.parse(requestedAt)
      ? requestedAt
      : rawJudgedAt;
  return {
    id,
    requestedAt,
    judgedAt,
    status,
    durationMs: finiteInteger(value.durationMs, 0, 0, 86_400_000),
    passed,
    total,
  };
}

function normalizeRun(value, fallbackNow, history = false) {
  if (!isRecord(value)) return null;
  const id = boundedId(value.id);
  const preset = presetById(value.presetId);
  if (!id || !preset) return null;
  const startedAt = iso(value.startedAt, fallbackNow);
  const expectedEndsAt = new Date(Date.parse(startedAt) + preset.durationMinutes * 60_000).toISOString();
  const endsAt = expectedEndsAt;
  const problems = (Array.isArray(value.problems) ? value.problems : [])
    .slice(0, preset.problemCount)
    .flatMap((problem) => {
      const normalized = normalizeProblemSnapshot(problem, startedAt);
      return normalized ? [normalized] : [];
    });
  if (problems.length !== preset.problemCount || new Set(problems.map((problem) => problem.itemId)).size !== problems.length)
    return null;
  for (const problem of problems) {
    if (problem.openedAt) {
      problem.openedAt = new Date(
        Math.min(
          Date.parse(endsAt),
          Math.max(Date.parse(startedAt), Date.parse(problem.openedAt)),
        ),
      ).toISOString();
    }
    problem.submissions = problem.submissions.map((submission) => {
      const requestedAt = new Date(
        Math.min(
          Date.parse(endsAt),
          Math.max(Date.parse(startedAt), Date.parse(submission.requestedAt)),
        ),
      ).toISOString();
      return {
        ...submission,
        requestedAt,
        judgedAt:
          submission.judgedAt &&
          Date.parse(submission.judgedAt) < Date.parse(requestedAt)
            ? requestedAt
            : submission.judgedAt,
      };
    });
  }
  const currentProblemId = boundedId(value.currentProblemId);
  const current = problems.some((problem) => problem.itemId === currentProblemId)
    ? currentProblemId
    : problems[0].itemId;
  const historyStatus = value.status === "archived" ? "archived" : "finished";
  const liveStatus = value.status === "finalizing" ? "finalizing" : "active";
  const status = history ? historyStatus : liveStatus;
  const finishedAt = history ? iso(value.finishedAt, endsAt) : undefined;
  const outcome = value.outcome === "expired" ? "expired" : "submitted";
  return {
    version: VIRTUAL_ROUND_VERSION,
    id,
    presetId: preset.id,
    title: boundedString(value.title, VIRTUAL_ROUND_LIMITS.maxTitleBytes, preset.title).trim() || preset.title,
    status,
    startedAt,
    endsAt,
    currentProblemId: current,
    problems,
    finishRequestedAt: status === "finalizing" ? iso(value.finishRequestedAt, endsAt) : undefined,
    finishOutcome: status === "finalizing" && value.finishOutcome === "expired" ? "expired" : status === "finalizing" ? "submitted" : undefined,
    finishedAt,
    outcome: history ? outcome : undefined,
  };
}

function hasPending(run) {
  return run.problems.some((problem) => problem.submissions.some((submission) => submission.status === "pending"));
}

function interruptPending(run, now) {
  return {
    ...run,
    problems: run.problems.map((problem) => ({
      ...problem,
      submissions: problem.submissions.map((submission) =>
        submission.status === "pending"
          ? { ...submission, status: "judge-error", judgedAt: now, durationMs: 0, passed: 0, total: 0 }
          : submission,
      ),
    })),
  };
}

function appendHistory(workspace, run) {
  return {
    version: VIRTUAL_ROUND_VERSION,
    active: null,
    history: [...workspace.history.filter((entry) => entry.id !== run.id), run]
      .slice(-VIRTUAL_ROUND_LIMITS.maxHistory),
  };
}

function finalizeRun(workspace, run, options) {
  const finishedAt = iso(options.now, run.endsAt);
  const finished = {
    ...run,
    status: "finished",
    finishedAt,
    outcome: options.outcome === "expired" ? "expired" : "submitted",
    finishRequestedAt: undefined,
    finishOutcome: undefined,
  };
  return appendHistory(workspace, finished);
}

export function normalizeVirtualRoundWorkspace(value, options = {}) {
  const now = iso(options.now, new Date(0).toISOString());
  if (!isRecord(value)) return createVirtualRoundWorkspace();
  const history = (Array.isArray(value.history) ? value.history : [])
    .slice(-VIRTUAL_ROUND_LIMITS.maxHistory * 2)
    .flatMap((run) => {
      const normalized = normalizeRun(run, now, true);
      return normalized ? [normalized] : [];
    })
    .slice(-VIRTUAL_ROUND_LIMITS.maxHistory);
  let active = normalizeRun(value.active, now, false);
  let workspace = { version: VIRTUAL_ROUND_VERSION, active, history };
  if (!active) return workspace;

  const validItemIds = options.validItemIds instanceof Set ? options.validItemIds : null;
  const revisions = options.revisions instanceof Map ? options.revisions : null;
  const verificationRevisions =
    options.verificationRevisions instanceof Map
      ? options.verificationRevisions
      : null;
  const activeItemsValid = active.problems.every((problem) =>
    (!validItemIds || validItemIds.has(problem.itemId)) &&
    (!revisions || revisions.get(problem.itemId) === problem.itemRevision) &&
    (!verificationRevisions ||
      verificationRevisions.get(problem.itemId) === problem.verificationRevision),
  );
  if (!activeItemsValid) {
    active = interruptPending(active, now);
    return finalizeRun({ ...workspace, active }, active, { now, outcome: "expired" });
  }

  if (hasPending(active)) active = interruptPending(active, now);
  workspace = { ...workspace, active };
  if (active.status === "finalizing" || Date.parse(now) >= Date.parse(active.endsAt)) {
    return finalizeRun(workspace, active, {
      now,
      outcome: active.finishOutcome ?? "expired",
    });
  }
  return workspace;
}

function mutateActive(workspace, roundId, updater) {
  if (!workspace?.active || workspace.active.id !== roundId) return workspace;
  return { ...workspace, active: updater(workspace.active) };
}

export function startVirtualRound(workspace, presetId, problemSnapshots, options) {
  if (workspace?.active) throw new Error("A virtual round is already active");
  const preset = presetById(presetId);
  if (!preset) throw new Error("Unknown virtual round preset");
  const id = boundedId(options?.id);
  const now = iso(options?.now, null);
  if (!id || !now) throw new Error("A valid round ID and start time are required");
  if (!Array.isArray(problemSnapshots) || problemSnapshots.length !== preset.problemCount)
    throw new Error(`${preset.title} requires exactly ${preset.problemCount} problems`);
  const problems = problemSnapshots.map((problem) => normalizeProblemSnapshot({
    ...problem,
    id: problem.itemId,
    source: problem.source ?? problem.starterSource ?? "",
    starterSource: problem.starterSource ?? problem.source ?? "",
    openedAt: undefined,
    flagged: false,
    submissions: [],
  }, now));
  if (problems.some((problem) => !problem) || new Set(problems.map((problem) => problem.itemId)).size !== problems.length)
    throw new Error("Virtual round problem snapshots must be valid and distinct");
  problems[0] = { ...problems[0], openedAt: now };
  const run = {
    version: VIRTUAL_ROUND_VERSION,
    id,
    presetId: preset.id,
    title: preset.title,
    status: "active",
    startedAt: now,
    endsAt: new Date(Date.parse(now) + preset.durationMinutes * 60_000).toISOString(),
    currentProblemId: problems[0].itemId,
    problems,
    finishRequestedAt: undefined,
    finishOutcome: undefined,
    finishedAt: undefined,
    outcome: undefined,
  };
  return { version: VIRTUAL_ROUND_VERSION, active: run, history: workspace?.history?.slice(-VIRTUAL_ROUND_LIMITS.maxHistory) ?? [] };
}

export function openVirtualRoundProblem(workspace, roundId, itemId, options) {
  const now = iso(options?.now, new Date().toISOString());
  return mutateActive(workspace, roundId, (run) => {
    if (run.status !== "active" || Date.parse(now) > Date.parse(run.endsAt)) return run;
    if (!run.problems.some((problem) => problem.itemId === itemId)) return run;
    return {
      ...run,
      currentProblemId: itemId,
      problems: run.problems.map((problem) =>
        problem.itemId === itemId && !problem.openedAt ? { ...problem, openedAt: now } : problem,
      ),
    };
  });
}

export function updateVirtualRoundSource(workspace, roundId, itemId, source) {
  if (byteLength(String(source ?? "")) > VIRTUAL_ROUND_LIMITS.maxSourceBytes)
    throw new Error("Virtual round source exceeds the local size limit");
  return mutateActive(workspace, roundId, (run) => {
    if (run.status !== "active") return run;
    return {
      ...run,
      problems: run.problems.map((problem) =>
        problem.itemId === itemId ? { ...problem, source: String(source ?? "") } : problem,
      ),
    };
  });
}

export function toggleVirtualRoundFlag(workspace, roundId, itemId) {
  return mutateActive(workspace, roundId, (run) =>
    run.status !== "active"
      ? run
      : {
          ...run,
          problems: run.problems.map((problem) =>
            problem.itemId === itemId ? { ...problem, flagged: !problem.flagged } : problem,
          ),
        },
  );
}

export function requestVirtualRoundSubmission(workspace, roundId, itemId, input) {
  const requestedAt = iso(input?.requestedAt, null);
  const submissionId = boundedId(input?.id);
  if (!workspace?.active || workspace.active.id !== roundId) throw new Error("Virtual round is not active");
  if (workspace.active.status !== "active") throw new Error("Virtual round is finalizing");
  if (!requestedAt || !submissionId) throw new Error("A valid submission ID and request time are required");
  if (Date.parse(requestedAt) < Date.parse(workspace.active.startedAt)) throw new Error("Virtual round submission predates the round");
  if (Date.parse(requestedAt) > Date.parse(workspace.active.endsAt)) throw new Error("Virtual round deadline passed");
  if (hasPending(workspace.active)) throw new Error("A virtual round submission is already judging");
  if (!workspace.active.problems.some((problem) => problem.itemId === itemId))
    throw new Error("Virtual round problem is unavailable");
  if (workspace.active.problems.some((problem) => problem.submissions.some((submission) => submission.id === submissionId)))
    throw new Error("Virtual round submission ID already exists");
  return mutateActive(workspace, roundId, (run) => ({
    ...run,
    problems: run.problems.map((problem) => {
      if (problem.itemId !== itemId) return problem;
      const submissions = [...problem.submissions, {
        id: submissionId,
        requestedAt,
        judgedAt: undefined,
        status: "pending",
        durationMs: 0,
        passed: 0,
        total: 0,
      }].slice(-VIRTUAL_ROUND_LIMITS.maxSubmissionsPerProblem);
      return { ...problem, source: boundedString(input?.source, VIRTUAL_ROUND_LIMITS.maxSourceBytes), submissions };
    }),
  }));
}

export function settleVirtualRoundSubmission(workspace, roundId, submissionId, input) {
  const rawJudgedAt = iso(input?.judgedAt, new Date().toISOString());
  const requestedSubmission = workspace?.active?.problems
    .flatMap((problem) => problem.submissions)
    .find((submission) => submission.id === submissionId && submission.status === "pending");
  const judgedAt =
    requestedSubmission && Date.parse(rawJudgedAt) < Date.parse(requestedSubmission.requestedAt)
      ? requestedSubmission.requestedAt
      : rawJudgedAt;
  const rawVerdict = SUBMISSION_VERDICTS.includes(input?.status) ? input.status : "judge-error";
  const total = finiteInteger(input?.total, 0, 0, 100);
  const passed = finiteInteger(input?.passed, 0, 0, total);
  const verdict =
    rawVerdict === "accepted" && !(total > 0 && passed === total)
      ? "judge-error"
      : rawVerdict;
  let found = false;
  let next = mutateActive(workspace, roundId, (run) => ({
    ...run,
    problems: run.problems.map((problem) => ({
      ...problem,
      submissions: problem.submissions.map((submission) => {
        if (submission.id !== submissionId || submission.status !== "pending") return submission;
        found = true;
        return {
          ...submission,
          judgedAt,
          status: verdict,
          durationMs: finiteInteger(input?.durationMs, 0, 0, 86_400_000),
          passed,
          total,
        };
      }),
    })),
  }));
  if (!found || !next.active) return workspace;
  if (next.active.status === "finalizing" && !hasPending(next.active)) {
    next = finalizeRun(next, next.active, {
      now: judgedAt,
      outcome: next.active.finishOutcome ?? "submitted",
    });
  }
  return next;
}

export function finishVirtualRound(workspace, roundId, options) {
  if (!workspace?.active || workspace.active.id !== roundId) return workspace;
  if (workspace.active.status === "finalizing") return workspace;
  const now = iso(options?.now, new Date().toISOString());
  const outcome = options?.outcome === "expired" ? "expired" : "submitted";
  if (hasPending(workspace.active)) {
    return {
      ...workspace,
      active: {
        ...workspace.active,
        status: "finalizing",
        finishRequestedAt: now,
        finishOutcome: outcome,
      },
    };
  }
  return finalizeRun(workspace, workspace.active, { now, outcome });
}

export function expireVirtualRound(workspace, options) {
  const active = workspace?.active;
  if (!active) return workspace;
  const now = iso(options?.now, new Date().toISOString());
  if (Date.parse(now) < Date.parse(active.endsAt)) return workspace;
  return finishVirtualRound(workspace, active.id, { now, outcome: "expired" });
}

export function archiveVirtualRound(workspace, roundId) {
  return {
    ...workspace,
    history: workspace.history.map((run) =>
      run.id === roundId ? { ...run, status: "archived" } : run,
    ),
  };
}

export function virtualRoundRemainingMs(run, now) {
  if (!run || (run.status !== "active" && run.status !== "finalizing")) return 0;
  const at = typeof now === "number" ? now : Date.parse(now);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Date.parse(run.endsAt) - at);
}

export function deriveVirtualRoundProblemScore(problem) {
  const settled = problem.submissions.filter((submission) => submission.status !== "pending");
  const accepted = settled.some((submission) =>
    submission.status === "accepted" && submission.total > 0 && submission.passed === submission.total,
  );
  if (accepted) return VIRTUAL_ROUND_POINTS_PER_PROBLEM;
  return settled.reduce((best, submission) => {
    if (submission.total < 1) return best;
    return Math.max(best, Math.floor(VIRTUAL_ROUND_POINTS_PER_PROBLEM * submission.passed / submission.total));
  }, 0);
}

export function virtualRoundProblemStatus(problem, finished = false) {
  const score = deriveVirtualRoundProblemScore(problem);
  if (score === VIRTUAL_ROUND_POINTS_PER_PROBLEM) return "accepted";
  if (score > 0) return "partial";
  if (problem.submissions.length > 0) return "attempted";
  if (problem.openedAt) return finished ? "skipped" : "opened";
  return finished ? "skipped" : "unopened";
}

export function deriveVirtualRoundScore(run) {
  const scores = run.problems.map(deriveVirtualRoundProblemScore);
  return {
    score: scores.reduce((sum, score) => sum + score, 0),
    maxScore: run.problems.length * VIRTUAL_ROUND_POINTS_PER_PROBLEM,
    acceptedCount: scores.filter((score) => score === VIRTUAL_ROUND_POINTS_PER_PROBLEM).length,
  };
}

export function deriveVirtualRoundReport(run) {
  if (!run || (run.status !== "finished" && run.status !== "archived")) return null;
  const aggregate = deriveVirtualRoundScore(run);
  let penaltyMs = 0;
  const problems = run.problems.map((problem, index) => {
    const submissions = problem.submissions.filter((submission) => submission.status !== "pending");
    const firstAcceptedIndex = submissions.findIndex((submission) =>
      submission.status === "accepted" && submission.total > 0 && submission.passed === submission.total,
    );
    if (firstAcceptedIndex >= 0) {
      const accepted = submissions[firstAcceptedIndex];
      const elapsed = Math.max(0, Date.parse(accepted.requestedAt) - Date.parse(run.startedAt));
      const earlierWrong = submissions.slice(0, firstAcceptedIndex).filter((submission) => submission.status !== "accepted").length;
      penaltyMs += elapsed + earlierWrong * VIRTUAL_ROUND_WRONG_PENALTY_MS;
    }
    return {
      id: problem.itemId,
      index,
      itemRevision: problem.itemRevision,
      verificationRevision: problem.verificationRevision,
      title: problem.title,
      pattern: problem.pattern,
      difficulty: problem.difficulty,
      status: virtualRoundProblemStatus(problem, true),
      score: deriveVirtualRoundProblemScore(problem),
      maxScore: VIRTUAL_ROUND_POINTS_PER_PROBLEM,
      submissionCount: submissions.length,
      flagged: problem.flagged,
      submissions: submissions.map((submission) => ({
        ...submission,
        elapsedMs: Math.max(0, Date.parse(submission.requestedAt) - Date.parse(run.startedAt)),
        score:
          submission.total > 0
            ? Math.floor(VIRTUAL_ROUND_POINTS_PER_PROBLEM * submission.passed / submission.total)
            : 0,
      })),
    };
  });
  const finishMs = Math.min(Date.parse(run.finishedAt), Date.parse(run.endsAt));
  return {
    id: run.id,
    presetId: run.presetId,
    title: run.title,
    status: run.status,
    outcome: run.outcome,
    startedAt: run.startedAt,
    completedAt: run.finishedAt,
    elapsedMs: Math.max(0, finishMs - Date.parse(run.startedAt)),
    penaltyMs,
    ...aggregate,
    problemCount: run.problems.length,
    problems,
  };
}
