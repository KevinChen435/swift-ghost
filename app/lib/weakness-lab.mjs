const DAY_MS = 86_400_000;

export const WEAKNESS_TAGS = [
  "syntax-fluency",
  "missed-cue",
  "wrong-invariant",
  "data-structure",
  "complexity",
  "boundary",
  "implementation",
  "verification",
  "communication",
  "overfit",
  "api",
];

export const WEAKNESS_FILTERS = [
  "priority",
  "due",
  "stabilizing",
  "resolved",
  "all",
];

export const WEAKNESS_LANES = ["all", "python", "swift", "ios"];

export const WEAKNESS_META = {
  "syntax-fluency": {
    label: "Syntax fluency",
    short: "Syntax",
    prompt: "Rebuild the implementation from a blank editor without restoring prior source.",
  },
  "missed-cue": {
    label: "Pattern recognition",
    short: "Cue",
    prompt: "State the cue that selects the approach before opening code or notes.",
  },
  "wrong-invariant": {
    label: "Invariant selection",
    short: "Invariant",
    prompt: "Commit the condition that must remain true before implementing it.",
  },
  "data-structure": {
    label: "Data-structure choice",
    short: "Structure",
    prompt: "Explain why the chosen structure supports every required operation.",
  },
  complexity: {
    label: "Complexity analysis",
    short: "Complexity",
    prompt: "Derive time and space bounds from the operations, not from memory.",
  },
  boundary: {
    label: "Boundary cases",
    short: "Boundaries",
    prompt: "Write the smallest counterexample and a concrete test plan before coding.",
  },
  implementation: {
    label: "Implementation plan",
    short: "Implementation",
    prompt: "Break the invariant into ordered implementation steps before typing.",
  },
  verification: {
    label: "Verification discipline",
    short: "Verification",
    prompt: "Trace a normal case and a failing edge case before submitting.",
  },
  communication: {
    label: "Interview communication",
    short: "Communication",
    prompt: "Rehearse clarification, approach, verification, complexity, and closing aloud.",
  },
  overfit: {
    label: "Transfer beyond the example",
    short: "Transfer",
    prompt: "Solve a sibling problem with changed constraints and no reference reveal.",
  },
  api: {
    label: "Language and API recall",
    short: "API",
    prompt: "Name the exact language semantics or API contract before reconstructing it.",
  },
};

const FRICTION_TO_WEAKNESS = {
  recognition: "missed-cue",
  invariant: "wrong-invariant",
  implementation: "implementation",
  syntax: "syntax-fluency",
  complexity: "complexity",
  api: "api",
};

const REVIEW_TO_WEAKNESS = {
  recognition: "missed-cue",
  invariant: "wrong-invariant",
  "implementation-plan": "implementation",
  "edge-case": "boundary",
  "python-syntax": "syntax-fluency",
  "swift-syntax-api": "api",
  complexity: "complexity",
};

function validDate(value, fallback = 0) {
  const parsed = Date.parse(typeof value === "string" ? value : "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value, fallback = "", limit = 180) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, limit)
    : fallback;
}

function slug(value) {
  return cleanText(value, "general", 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "general";
}

function weakness(value) {
  return WEAKNESS_TAGS.includes(value) ? value : null;
}

function laneFor(item, fallback = "python") {
  if (item?.track === "ios" || fallback === "ios") return "ios";
  if (item?.language === "swift" || fallback === "swift") return "swift";
  return "python";
}

function topicFor(item, fallback = "General interview execution") {
  return cleanText(item?.pattern, cleanText(fallback, "General interview execution", 120), 120);
}

function itemIdOf(value) {
  return cleanText(value?.itemId, "", 180);
}

function pushEvidence(target, raw, itemById) {
  const tag = weakness(raw.weakness);
  const at = validDate(raw.occurredAt);
  if (!tag || !at) return;
  const itemId = cleanText(raw.itemId, "", 180);
  const item = itemById.get(itemId);
  const lane = laneFor(item, raw.lane);
  const topicKey = topicFor(item, raw.topicKey);
  const id = cleanText(raw.id, "", 220);
  if (!id) return;
  target.push({
    id,
    kind: raw.kind,
    weakness: tag,
    lane,
    topicKey,
    itemId: itemId || undefined,
    itemRevision: Number.isFinite(Number(raw.itemRevision))
      ? Math.max(1, Math.round(Number(raw.itemRevision)))
      : undefined,
    occurredAt: new Date(at).toISOString(),
    weight: Math.max(1, Math.min(4, Math.round(Number(raw.weight) || 1))),
    label: cleanText(raw.label, WEAKNESS_META[tag].label, 160),
    summary: cleanText(raw.summary, WEAKNESS_META[tag].prompt, 360),
    sourceId: cleanText(raw.sourceId, "", 180) || undefined,
  });
}

function collectEvidence(input, itemById) {
  const evidence = [];
  for (const event of Array.isArray(input.learningEvents) ? input.learningEvents : []) {
    const tag = FRICTION_TO_WEAKNESS[event?.friction];
    if (!tag || !["again", "hard", "good"].includes(event?.grade)) continue;
    const item = itemById.get(itemIdOf(event));
    pushEvidence(evidence, {
      id: `learning:${event.id || event.attemptId}`,
      kind: "learning-event",
      weakness: tag,
      itemId: event.itemId,
      itemRevision: event.itemRevision,
      occurredAt: event.createdAt,
      weight: event.grade === "again" ? 3 : event.grade === "hard" ? 2 : 1,
      label: `${WEAKNESS_META[tag].label} reflection`,
      summary: `${event.grade === "again" ? "Retrieval failed" : event.grade === "hard" ? "Retrieval felt hard" : "Retrieval succeeded with friction"} in ${item?.title ?? "a practice item"}.`,
      sourceId: event.attemptId,
    }, itemById);
  }

  for (const review of Array.isArray(input.solutionReviews) ? input.solutionReviews : []) {
    const tag = REVIEW_TO_WEAKNESS[review?.mistakeCategory];
    if (!tag || review?.status !== "completed") continue;
    const item = itemById.get(itemIdOf(review));
    pushEvidence(evidence, {
      id: `review:${review.id}`,
      kind: "solution-review",
      weakness: tag,
      itemId: review.itemId,
      itemRevision: review.itemRevision,
      occurredAt: review.completedAt ?? review.updatedAt,
      weight: review.grade === "again" ? 4 : review.grade === "hard" ? 3 : 2,
      label: "Post-solve review",
      summary: `${WEAKNESS_META[tag].label} was recorded after reviewing ${item?.title ?? review.titleSnapshot ?? "an accepted solve"}.`,
      sourceId: review.attemptId,
    }, itemById);
  }

  for (const report of Array.isArray(input.assessmentReports) ? input.assessmentReports : []) {
    for (const probe of Array.isArray(report?.probes) ? report.probes : []) {
      for (const blocker of Array.isArray(probe?.blockers) ? probe.blockers : []) {
        if (!weakness(blocker)) continue;
        pushEvidence(evidence, {
          id: `assessment:${report.runId}:${probe.probeId}:${blocker}`,
          kind: "assessment",
          weakness: blocker,
          itemId: probe.itemId,
          occurredAt:
            probe.objectiveAttempt?.completedAt ??
            report.completedAt ??
            report.startedAt,
          weight: probe.rubricTotal !== null && Number(probe.rubricTotal) <= 4 ? 4 : 3,
          label: `${report.title} checkpoint`,
          summary: `${WEAKNESS_META[blocker].label} was selected in the ${probe.title} debrief.`,
          sourceId: report.runId,
          lane: report.track === "ios" ? "ios" : "python",
          topicKey: probe.focus,
        }, itemById);
      }
    }
  }

  for (const session of Array.isArray(input.sessionHistory) ? input.sessionHistory : []) {
    if (session?.kind !== "mock" || !session?.debrief?.completedAt) continue;
    const itemId = itemIdOf(session?.problems?.[0] ?? session?.entries?.[0]);
    for (const tag of Array.isArray(session.debrief.mistakeTags) ? session.debrief.mistakeTags : []) {
      if (!weakness(tag)) continue;
      pushEvidence(evidence, {
        id: `mock:${session.id}:${tag}`,
        kind: "mock-debrief",
        weakness: tag,
        itemId,
        occurredAt: session.debrief.completedAt,
        weight: 4,
        label: "Mock-interview debrief",
        summary: `${WEAKNESS_META[tag].label} was tagged after ${session.name || "a timed mock"}.`,
        sourceId: session.id,
        lane: "python",
        topicKey: "Interview execution",
      }, itemById);
    }
  }

  for (const record of Array.isArray(input.transferRecords) ? input.transferRecords : []) {
    if (record?.status !== "assisted") continue;
    pushEvidence(evidence, {
      id: `transfer:${record.variantId}:assisted:${record.lastActivityAt}`,
      kind: "transfer",
      weakness: "overfit",
      itemId: record.variantId,
      itemRevision: record.currentRevision,
      occurredAt: record.lastActivityAt,
      weight: 4,
      label: "Transfer reconstruction",
      summary: `${record.title || "A transfer variant"} required help, so recognition has not yet transferred independently.`,
      sourceId: record.variantId,
      lane: "python",
      topicKey: record.pattern,
    }, itemById);
  }

  const decisionProbes = new Map(
    (Array.isArray(input.patternDecisionProbes) ? input.patternDecisionProbes : [])
      .map((probe) => [probe?.id, probe])
      .filter(([id]) => Boolean(id)),
  );
  const decisionLessons = new Map(
    (Array.isArray(input.patternLessons) ? input.patternLessons : [])
      .map((lesson) => [lesson?.id, lesson])
      .filter(([id]) => Boolean(id)),
  );
  const missesByLesson = new Map();
  for (const attempt of Array.isArray(input.patternDecisionAttempts)
    ? input.patternDecisionAttempts
    : []) {
    const probe = decisionProbes.get(attempt?.probeId);
    const lesson = decisionLessons.get(attempt?.lessonId);
    if (
      !attempt?.completedAt ||
      attempt.match !== false ||
      !probe ||
      !lesson ||
      Number(attempt.probeRevision) !== Number(probe.revision) ||
      Number(attempt.lessonRevision) !== Number(lesson.revision) ||
      probe.lessonId !== lesson.id
    )
      continue;
    const entries = missesByLesson.get(lesson.id) ?? [];
    entries.push({ attempt, probe, lesson });
    missesByLesson.set(lesson.id, entries);
  }
  for (const misses of missesByLesson.values()) {
    const distinct = new Map();
    for (const miss of misses.sort((a, b) =>
      a.attempt.completedAt.localeCompare(b.attempt.completedAt),
    ))
      distinct.set(miss.probe.id, miss);
    if (distinct.size < 2) continue;
    for (const { attempt, probe, lesson } of distinct.values()) {
      pushEvidence(evidence, {
        id: `pattern-decision:${attempt.id}`,
        kind: "pattern-decision",
        weakness: "missed-cue",
        itemId: probe.solveItemId,
        occurredAt: attempt.completedAt,
        weight: 3,
        label: "Mixed pattern decision",
        summary: `The authored pattern choice for an unlabeled ${lesson.title} prompt did not match the committed selection. Free-text reasoning was not auto-scored.`,
        sourceId: attempt.id,
        lane: "python",
        topicKey: lesson.pattern,
      }, itemById);
    }
  }

  const byId = new Map();
  for (const entry of evidence) byId.set(entry.id, entry);
  return [...byId.values()]
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .slice(-500);
}

function strongAttempt(attempt, item, receiptById) {
  if (!attempt || attempt.outcome !== "completed" || Number(attempt.peeks) > 0) return false;
  if (Number(attempt.itemRevision) !== Number(item?.contentRevision ?? attempt.itemRevision)) return false;
  if (attempt.practiceKind === "solving") {
    const receipt = receiptById.get(attempt.submissionId);
    const currentJudgeRevision = Math.max(
      1,
      Math.round(Number(item?.verification?.revision) || 1),
    );
    return attempt.qualification === "solved" &&
      Number(attempt.verification?.total) > 0 &&
      Number(attempt.verification?.passed) === Number(attempt.verification?.total) &&
      Number(attempt.verification?.revision) === currentJudgeRevision &&
      receipt?.lifecycle === "settled" &&
      receipt.status === "accepted" &&
      receipt.assistance === "none-recorded" &&
      receipt.itemId === attempt.itemId &&
      Number(receipt.itemRevision) === Number(attempt.itemRevision) &&
      Number(receipt.judge?.revision) === currentJudgeRevision &&
      Number(receipt.total) > 0 &&
      Number(receipt.passed) === Number(receipt.total);
  }
  if (attempt.practiceKind === "concept") {
    return ["good", "easy"].includes(attempt.conceptGrade) &&
      attempt.qualification !== "assisted";
  }
  return attempt.stage === 5 && attempt.qualification === "independent";
}

function successesForCase(caseEvidence, input, itemById, lane, topicKey) {
  const lastEvidenceAt = Math.max(...caseEvidence.map((entry) => validDate(entry.occurredAt)));
  const receiptById = new Map(
    (Array.isArray(input.submissionReceipts) ? input.submissionReceipts : [])
      .map((receipt) => [receipt?.id, receipt])
      .filter(([id]) => Boolean(id)),
  );
  const successes = [];
  for (const attempt of Array.isArray(input.attempts) ? input.attempts : []) {
    const at = validDate(attempt?.completedAt);
    const item = itemById.get(itemIdOf(attempt));
    if (
      at <= lastEvidenceAt ||
      !item ||
      laneFor(item) !== lane ||
      topicFor(item) !== topicKey ||
      !strongAttempt(attempt, item, receiptById)
    ) continue;
    successes.push({
      id: `attempt:${attempt.id}`,
      itemId: attempt.itemId,
      at: new Date(at).toISOString(),
      transfer: Boolean(item.transfer),
    });
  }
  for (const record of Array.isArray(input.transferRecords) ? input.transferRecords : []) {
    const at = validDate(record?.lastActivityAt);
    if (
      at <= lastEvidenceAt ||
      lane !== "python" ||
      cleanText(record?.pattern, "") !== topicKey ||
      record?.status !== "proven"
    ) continue;
    successes.push({
      id: `transfer-proof:${record.variantId}:${record.lastActivityAt}`,
      itemId: record.variantId,
      at: new Date(at).toISOString(),
      transfer: true,
    });
  }
  const unique = new Map(successes.map((entry) => [entry.id, entry]));
  return [...unique.values()].sort((left, right) => left.at.localeCompare(right.at));
}

function practiceKindFor(tag, item) {
  if (item?.track === "ios") return "concept";
  if (
    item?.language === "python" &&
    item?.verification &&
    [
      "wrong-invariant",
      "data-structure",
      "complexity",
      "boundary",
      "implementation",
      "verification",
      "overfit",
    ].includes(tag)
  ) return "solving";
  return "typing";
}

function buildQueue(tag, lane, topicKey, caseEvidence, input, itemById) {
  const signals = input.itemSignals && typeof input.itemSignals === "object"
    ? input.itemSignals
    : {};
  const evidenceItemIds = [...new Set(caseEvidence.map((entry) => entry.itemId).filter(Boolean))];
  const candidates = [...itemById.values()]
    .filter((item) =>
      !item?.transfer &&
      !item?.archivedAt &&
      laneFor(item) === lane &&
      topicFor(item) === topicKey,
    )
    .map((item) => {
      const signal = signals[item.itemId] ?? {};
      const evidenceIndex = evidenceItemIds.indexOf(item.itemId);
      return {
        item,
        score:
          (evidenceIndex >= 0 ? 0 : 100) +
          (signal.due ? 0 : 20) +
          (signal.owned ? 20 : 0) +
          Number(signal.completions || 0) * 2 +
          (evidenceIndex >= 0 ? evidenceIndex : 0),
      };
    })
    .sort((left, right) => left.score - right.score || String(left.item.itemId).localeCompare(String(right.item.itemId)))
    .slice(0, 3);

  return candidates.map(({ item }, index) => {
    const signal = signals[item.itemId] ?? {};
    const practiceKind = practiceKindFor(tag, item);
    const stage = practiceKind === "solving" || practiceKind === "concept"
      ? 5
      : Math.max(3, Math.min(5, Math.round(Number(signal.recommendedStage) || 3)));
    return {
      itemId: item.itemId,
      itemRevision: Math.max(1, Math.round(Number(item.contentRevision) || 1)),
      title: item.title,
      pattern: item.pattern,
      stage,
      practiceKind,
      estimatedMinutes: Math.max(3, Math.min(20, Math.round(Number(item.estimatedMinutes) || 8))),
      rationale: index === 0
        ? `Repair the exact ${WEAKNESS_META[tag].short.toLowerCase()} failure without restoring prior source.`
        : index === 1
          ? "Rebuild the same decision on a sibling problem."
          : "Finish with a second context to test transfer.",
      lane: item.track === "ios" ? "ios" : item.language === "python" ? "python" : "interview",
    };
  });
}

function casePriority(value, nowMs) {
  const dueMs = validDate(value.dueAt, nowMs);
  const urgency = value.status === "due" ? 80 : value.status === "open" ? 45 : value.status === "stabilizing" ? 25 : 0;
  const overdueDays = value.status === "due" ? Math.min(30, Math.max(0, Math.floor((nowMs - dueMs) / DAY_MS))) : 0;
  const laneBias = value.lane === "python" ? 8 : value.lane === "ios" ? 4 : 2;
  return value.evidenceWeight * 12 + value.recurrence * 9 + value.sourceKinds.length * 7 + urgency + overdueDays + laneBias - value.successes.length * 12;
}

export function buildWeaknessLab(input = {}) {
  const nowMs = validDate(input.now, Date.now());
  const items = Array.isArray(input.items) ? input.items : [];
  const itemById = new Map(items.map((item) => [item?.itemId, item]).filter(([id]) => Boolean(id)));
  const evidence = collectEvidence(input, itemById);
  const grouped = new Map();
  for (const entry of evidence) {
    const key = `${entry.lane}:${slug(entry.topicKey)}:${entry.weakness}`;
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }

  const cases = [];
  for (const [id, entries] of grouped) {
    const latest = entries.at(-1);
    const successes = successesForCase(entries, input, itemById, latest.lane, latest.topicKey);
    const firstSuccessAt = validDate(successes[0]?.at);
    const lastSuccessAt = validDate(successes.at(-1)?.at);
    const hasDelayedPair = successes.length >= 2 && lastSuccessAt - firstSuccessAt >= DAY_MS;
    const hasTransfer = successes.some((entry) => entry.transfer);
    const resolved = hasDelayedPair && hasTransfer;
    const dueAtMs = successes.length
      ? lastSuccessAt + (successes.length >= 2 ? 7 : 3) * DAY_MS
      : validDate(latest.occurredAt) + DAY_MS;
    const status = resolved
      ? "resolved"
      : successes.length
        ? "stabilizing"
        : dueAtMs <= nowMs
          ? "due"
          : "open";
    const sourceKinds = [...new Set(entries.map((entry) => entry.kind))];
    const evidenceWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    const queue = buildQueue(latest.weakness, latest.lane, latest.topicKey, entries, input, itemById);
    const value = {
      id,
      lane: latest.lane,
      topicKey: latest.topicKey,
      weakness: latest.weakness,
      title: `${latest.topicKey} · ${WEAKNESS_META[latest.weakness].label}`,
      status,
      recurrence: entries.length,
      evidenceWeight,
      sourceKinds,
      evidence: entries.slice().sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
      successes,
      dueAt: new Date(dueAtMs).toISOString(),
      lastEvidenceAt: latest.occurredAt,
      prompt: WEAKNESS_META[latest.weakness].prompt,
      queue,
      transferRequired: !hasTransfer,
      priority: 0,
    };
    value.priority = casePriority(value, nowMs);
    cases.push(value);
  }

  cases.sort((left, right) =>
    right.priority - left.priority ||
    right.lastEvidenceAt.localeCompare(left.lastEvidenceAt) ||
    left.id.localeCompare(right.id),
  );
  const counts = Object.fromEntries(["due", "open", "stabilizing", "resolved"].map((status) => [status, cases.filter((entry) => entry.status === status).length]));
  const tagCounts = WEAKNESS_TAGS.map((tag) => ({
    id: tag,
    label: WEAKNESS_META[tag].label,
    count: cases.filter((entry) => entry.weakness === tag && entry.status !== "resolved").length,
  })).filter((entry) => entry.count).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const laneCounts = Object.fromEntries(["python", "swift", "ios"].map((lane) => [lane, cases.filter((entry) => entry.lane === lane && entry.status !== "resolved").length]));
  return {
    generatedAt: new Date(nowMs).toISOString(),
    scope: "private-local-learning-evidence",
    cases,
    nextCase: cases.find((entry) => entry.status === "due") ?? cases.find((entry) => entry.status === "open") ?? cases.find((entry) => entry.status === "stabilizing") ?? null,
    summary: {
      total: cases.length,
      active: cases.filter((entry) => entry.status !== "resolved").length,
      ...counts,
      laneCounts,
      tagCounts,
    },
  };
}

export function filterWeaknessCases(cases, options = {}) {
  const filter = WEAKNESS_FILTERS.includes(options.filter) ? options.filter : "priority";
  const lane = WEAKNESS_LANES.includes(options.lane) ? options.lane : "all";
  return (Array.isArray(cases) ? cases : []).filter((entry) => {
    if (lane !== "all" && entry.lane !== lane) return false;
    if (filter === "all" || filter === "priority") return filter === "all" || entry.status !== "resolved";
    return entry.status === filter;
  });
}
