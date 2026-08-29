const DAY_MS = 86_400_000;

export const ATTEMPT_CLOSURE_VERSION = 1;
export const ATTEMPT_CLOSURE_LIMITS = Object.freeze({
  maxClosures: 300,
  maxIdChars: 220,
  maxTextChars: 2_000,
  maxTags: 6,
  maxRevision: 1_000_000,
});
export const ATTEMPT_CLOSURE_GRADES = Object.freeze([
  "again",
  "hard",
  "good",
  "easy",
]);
export const ATTEMPT_CLOSURE_MISTAKE_TAGS = Object.freeze([
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
]);
export const ATTEMPT_CLOSURE_STATUSES = Object.freeze([
  "open",
  "due",
  "resolved",
  "retired",
]);

const FAILED_SUBMISSION_OUTCOMES = Object.freeze([
  "wrong-answer",
  "compile-error",
  "runtime-error",
  "time-limit",
  "invalid-entrypoint",
  "judge-error",
]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value, limit = ATTEMPT_CLOSURE_LIMITS.maxTextChars) {
  return typeof value === "string"
    ? Array.from(value.trim()).slice(0, limit).join("")
    : "";
}

function cleanId(value) {
  return cleanText(value, ATTEMPT_CLOSURE_LIMITS.maxIdChars);
}

function cleanIso(value, fallback) {
  const parsed = value instanceof Date
    ? value.getTime()
    : typeof value === "number"
      ? value
      : Date.parse(typeof value === "string" ? value : "");
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return fallback;
}

function cleanRevision(value, fallback = 0) {
  const number = Math.round(Number(value));
  return Number.isFinite(number)
    ? Math.max(1, Math.min(ATTEMPT_CLOSURE_LIMITS.maxRevision, number))
    : fallback;
}

function cleanWorkspaceRevision(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number)
    ? Math.max(0, Math.min(ATTEMPT_CLOSURE_LIMITS.maxRevision, number))
    : 0;
}

function laneFor(item, fallback) {
  if (item?.conceptLane === "swift" || item?.conceptLane === "ios")
    return item.conceptLane;
  if (item?.track === "ios" || fallback === "ios") return "ios";
  if (item?.language === "swift" || fallback === "swift") return "swift";
  return "python";
}

function titleFor(item, fallback) {
  return cleanText(item?.title, 500) || cleanText(fallback, 500) || "Practice item";
}

function assistanceForAttempt(attempt) {
  return attempt?.peeks > 0 ||
    ["assisted", "guided", "syntax"].includes(attempt?.qualification)
    ? "used"
    : attempt?.qualification === "solved" ||
        attempt?.qualification === "independent"
      ? "none-recorded"
      : "unknown";
}

function anchorKey(kind, id) {
  return `${kind}:${id}`;
}

function closureId(anchor) {
  return `closure:${anchorKey(anchor.kind, anchor.id)}`;
}

function receiptTime(receipt) {
  return cleanIso(receipt?.settledAt) ?? cleanIso(receipt?.requestedAt);
}

function attemptTime(attempt) {
  return cleanIso(attempt?.completedAt) ?? cleanIso(attempt?.startedAt);
}

function currentItemRegistry(items) {
  return new Map(
    (Array.isArray(items) ? items : []).flatMap((item) => {
      const itemId = cleanId(item?.itemId);
      const revision = cleanRevision(item?.contentRevision);
      return itemId && revision ? [[itemId, item]] : [];
    }),
  );
}

function receiptList(options) {
  if (Array.isArray(options.submissionReceipts)) return options.submissionReceipts;
  if (Array.isArray(options.receipts)) return options.receipts;
  if (Array.isArray(options.submissionLog?.receipts))
    return options.submissionLog.receipts;
  return [];
}

function evidenceRegistry(options, itemsById) {
  const anchors = new Map();
  const attempts = Array.isArray(options.attempts) ? options.attempts : [];
  const receipts = receiptList(options);
  const receiptsById = new Map(
    receipts.flatMap((receipt) => {
      const id = cleanId(receipt?.id);
      return id ? [[id, receipt]] : [];
    }),
  );

  for (const receipt of receipts) {
    const id = cleanId(receipt?.id);
    const itemId = cleanId(receipt?.itemId);
    const itemRevision = cleanRevision(receipt?.itemRevision);
    const occurredAt = receiptTime(receipt);
    if (
      !id ||
      !itemId ||
      !itemRevision ||
      !occurredAt ||
      receipt?.lifecycle !== "settled" ||
      !FAILED_SUBMISSION_OUTCOMES.includes(receipt?.status)
    )
      continue;
    const item = itemsById.get(itemId);
    const linkedAttempt = attempts.find(
      (attempt) =>
        attempt?.submissionId === id &&
        attempt?.itemId === itemId &&
        Number(attempt?.itemRevision) === itemRevision,
    );
    const anchor = Object.freeze({
      kind: "submission",
      id,
      itemId,
      itemRevision,
      lane: laneFor(item, receipt?.language === "swift" ? "swift" : "python"),
      outcome: receipt.status,
      occurredAt,
      assistance: ["used", "none-recorded", "unknown"].includes(receipt.assistance)
        ? receipt.assistance
        : "unknown",
      submissionId: id,
      ...(linkedAttempt?.id ? { attemptId: cleanId(linkedAttempt.id) } : {}),
    });
    anchors.set(anchorKey(anchor.kind, anchor.id), anchor);
  }

  for (const attempt of attempts) {
    const id = cleanId(attempt?.id);
    const itemId = cleanId(attempt?.itemId);
    const itemRevision = cleanRevision(attempt?.itemRevision);
    const occurredAt = attemptTime(attempt);
    if (
      !id ||
      !itemId ||
      !itemRevision ||
      !occurredAt ||
      attempt?.practiceKind !== "solving" ||
      attempt?.outcome !== "abandoned"
    )
      continue;
    const item = itemsById.get(itemId);
    const submissionId = cleanId(attempt?.submissionId);
    const linkedReceipt = submissionId ? receiptsById.get(submissionId) : undefined;
    const exactReceipt =
      linkedReceipt?.lifecycle === "settled" &&
      linkedReceipt.itemId === itemId &&
      Number(linkedReceipt.itemRevision) === itemRevision
        ? linkedReceipt
        : undefined;
    const anchor = Object.freeze({
      kind: "attempt",
      id,
      itemId,
      itemRevision,
      lane: laneFor(item, attempt?.language === "swift" ? "swift" : "python"),
      outcome: "abandoned",
      occurredAt,
      assistance: assistanceForAttempt(attempt),
      attemptId: id,
      ...(exactReceipt ? { submissionId } : {}),
    });
    anchors.set(anchorKey(anchor.kind, anchor.id), anchor);
  }

  return { anchors, attempts, receipts, receiptsById };
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  const tags = [];
  for (const tag of ATTEMPT_CLOSURE_MISTAKE_TAGS) {
    if (value.includes(tag)) tags.push(tag);
    if (tags.length >= ATTEMPT_CLOSURE_LIMITS.maxTags) break;
  }
  return tags;
}

function meaningful(value) {
  const text = cleanText(value);
  return text.length >= 8 && /[a-z0-9]/i.test(text);
}

function completeFields(record) {
  return record.mistakeTags.length > 0 &&
    ATTEMPT_CLOSURE_GRADES.includes(record.grade) &&
    meaningful(record.firstWrongDecision) &&
    meaningful(record.verificationNotes) &&
    meaningful(record.teachBack);
}

function rawAnchor(raw) {
  const value = isRecord(raw?.anchor) ? raw.anchor : raw;
  const kind = value?.kind === "submission" || value?.anchorKind === "submission"
    ? "submission"
    : value?.kind === "attempt" || value?.anchorKind === "attempt"
      ? "attempt"
      : undefined;
  const id = cleanId(value?.id ?? value?.anchorId);
  const itemId = cleanId(value?.itemId);
  const itemRevision = cleanRevision(value?.itemRevision);
  const occurredAt = cleanIso(value?.occurredAt);
  const lane = ["python", "swift", "ios"].includes(value?.lane)
    ? value.lane
    : undefined;
  const outcome = kind === "attempt"
    ? value?.outcome === "abandoned" ? "abandoned" : undefined
    : FAILED_SUBMISSION_OUTCOMES.includes(value?.outcome)
      ? value.outcome
      : undefined;
  const assistance = ["used", "none-recorded", "unknown"].includes(value?.assistance)
    ? value.assistance
    : "unknown";
  if (!kind || !id || !itemId || !itemRevision || !occurredAt || !lane || !outcome)
    return undefined;
  return Object.freeze({
    kind,
    id,
    itemId,
    itemRevision,
    lane,
    outcome,
    occurredAt,
    assistance,
    ...(kind === "attempt"
      ? { attemptId: id }
      : { submissionId: id }),
    ...(kind === "attempt" && cleanId(value?.submissionId)
      ? { submissionId: cleanId(value.submissionId) }
      : {}),
    ...(kind === "submission" && cleanId(value?.attemptId)
      ? { attemptId: cleanId(value.attemptId) }
      : {}),
  });
}

function isCurrentAnchor(anchor, itemsById) {
  const item = itemsById.get(anchor.itemId);
  return Boolean(item && Number(item.contentRevision) === anchor.itemRevision);
}

function normalizeStoredClosure(raw, context) {
  if (!isRecord(raw)) return undefined;
  const candidate = rawAnchor(raw);
  if (!candidate) return undefined;
  const live = context.anchors.get(anchorKey(candidate.kind, candidate.id));
  const state = raw.state === "completed" || raw.status === "completed"
    ? "completed"
    : "draft";
  if (!live && state === "draft") return undefined;
  const anchor = live ?? candidate;
  const createdAt = cleanIso(raw.createdAt, anchor.occurredAt);
  const updatedAt = cleanIso(raw.updatedAt, createdAt);
  if (!createdAt || !updatedAt) return undefined;
  const record = {
    id: closureId(anchor),
    state,
    anchor,
    titleSnapshot: titleFor(context.itemsById.get(anchor.itemId), raw.titleSnapshot),
    createdAt,
    updatedAt,
    mistakeTags: normalizeTags(raw.mistakeTags),
    firstWrongDecision: cleanText(raw.firstWrongDecision),
    verificationNotes: cleanText(raw.verificationNotes),
    teachBack: cleanText(raw.teachBack),
    ...(ATTEMPT_CLOSURE_GRADES.includes(raw.grade) ? { grade: raw.grade } : {}),
  };
  if (state === "draft") {
    if (!isCurrentAnchor(anchor, context.itemsById)) return undefined;
    return record;
  }
  const completedAt = cleanIso(raw.completedAt);
  if (!completedAt || !completeFields(record)) return undefined;
  return {
    ...record,
    completedAt,
    retryDueAt: new Date(Date.parse(completedAt) + DAY_MS).toISOString(),
    retired:
      !live ||
      !isCurrentAnchor(anchor, context.itemsById) ||
      raw.retired === true,
  };
}

function draftFor(anchor, itemsById, now) {
  return {
    id: closureId(anchor),
    state: "draft",
    anchor,
    titleSnapshot: titleFor(itemsById.get(anchor.itemId)),
    createdAt: now,
    updatedAt: now,
    mistakeTags: [],
    firstWrongDecision: "",
    verificationNotes: "",
    teachBack: "",
  };
}

function compareClosures(left, right) {
  return Date.parse(left.anchor.occurredAt) - Date.parse(right.anchor.occurredAt) ||
    left.id.localeCompare(right.id);
}

export function createAttemptClosureWorkspace(now = new Date()) {
  return {
    version: ATTEMPT_CLOSURE_VERSION,
    revision: 0,
    updatedAt: cleanIso(now, new Date().toISOString()),
    closures: [],
  };
}

export function normalizeAttemptClosureWorkspace(value, options = {}) {
  const now = cleanIso(options.now, new Date().toISOString());
  const itemsById = currentItemRegistry(options.items);
  const evidence = evidenceRegistry(options, itemsById);
  const context = { ...evidence, itemsById };
  const source = isRecord(value) && value.version === ATTEMPT_CLOSURE_VERSION
    ? value
    : createAttemptClosureWorkspace(now);
  const byAnchor = new Map();
  const rawClosures = Array.isArray(source.closures)
    ? source.closures
    : Array.isArray(source.records)
      ? source.records
      : [];
  for (const raw of rawClosures) {
    const closure = normalizeStoredClosure(raw, context);
    if (!closure) continue;
    const key = anchorKey(closure.anchor.kind, closure.anchor.id);
    const existing = byAnchor.get(key);
    if (
      !existing ||
      (closure.state === "completed" && existing.state !== "completed") ||
      (closure.state === existing.state &&
        Date.parse(closure.updatedAt) >= Date.parse(existing.updatedAt))
    )
      byAnchor.set(key, closure);
  }
  for (const [key, anchor] of evidence.anchors) {
    if (!byAnchor.has(key) && isCurrentAnchor(anchor, itemsById))
      byAnchor.set(key, draftFor(anchor, itemsById, now));
  }
  const closures = [...byAnchor.values()]
    .sort(compareClosures)
    .slice(-ATTEMPT_CLOSURE_LIMITS.maxClosures);
  return {
    version: ATTEMPT_CLOSURE_VERSION,
    revision: cleanWorkspaceRevision(source.revision),
    updatedAt: cleanIso(source.updatedAt, now),
    closures,
  };
}

export function reconcileAttemptClosureWorkspace(value, options = {}) {
  const after = normalizeAttemptClosureWorkspace(value, options);
  const before = isRecord(value) && value.version === ATTEMPT_CLOSURE_VERSION &&
      Array.isArray(value.closures)
    ? value.closures
    : [];
  const changed = JSON.stringify(before) !== JSON.stringify(after.closures);
  if (!changed) return after;
  const now = cleanIso(options.now, new Date().toISOString());
  return {
    ...after,
    revision: Math.min(ATTEMPT_CLOSURE_LIMITS.maxRevision, after.revision + 1),
    updatedAt: now,
  };
}

function assertExpectedRevision(workspace, options) {
  if (
    options.expectedRevision !== undefined &&
    Number(options.expectedRevision) !== Number(workspace.revision)
  )
    throw new Error("Attempt closure workspace revision conflict");
}

function assertExpectedRecordTimestamp(record, options) {
  if (
    options.expectedUpdatedAt !== undefined &&
    cleanIso(options.expectedUpdatedAt) !== cleanIso(record?.updatedAt)
  )
    throw new Error("Attempt closure record changed before this edit was saved");
}

export function updateAttemptClosureDraft(workspace, id, patch = {}, options = {}) {
  if (!isRecord(workspace) || workspace.version !== ATTEMPT_CLOSURE_VERSION)
    throw new Error("A valid attempt closure workspace is required");
  assertExpectedRevision(workspace, options);
  const recordId = cleanId(id);
  const index = workspace.closures.findIndex((closure) => closure.id === recordId);
  if (index < 0) throw new Error("Attempt closure was not found");
  const current = workspace.closures[index];
  assertExpectedRecordTimestamp(current, options);
  if (current.state !== "draft") throw new Error("Completed attempt closures are immutable");
  const now = cleanIso(options.now, new Date().toISOString());
  const next = {
    ...current,
    mistakeTags: patch.mistakeTags === undefined
      ? current.mistakeTags
      : normalizeTags(patch.mistakeTags),
    firstWrongDecision: patch.firstWrongDecision === undefined
      ? current.firstWrongDecision
      : cleanText(patch.firstWrongDecision),
    verificationNotes: patch.verificationNotes === undefined
      ? current.verificationNotes
      : cleanText(patch.verificationNotes),
    teachBack: patch.teachBack === undefined
      ? current.teachBack
      : cleanText(patch.teachBack),
    ...(patch.grade === undefined
      ? current.grade ? { grade: current.grade } : {}
      : ATTEMPT_CLOSURE_GRADES.includes(patch.grade)
        ? { grade: patch.grade }
        : {}),
    updatedAt: now,
  };
  if (patch.grade !== undefined && !ATTEMPT_CLOSURE_GRADES.includes(patch.grade))
    delete next.grade;
  const closures = workspace.closures.slice();
  closures[index] = next;
  return {
    ...workspace,
    revision: Math.min(ATTEMPT_CLOSURE_LIMITS.maxRevision, workspace.revision + 1),
    updatedAt: now,
    closures,
  };
}

export function attemptClosureCompletionIssues(record) {
  if (!record || record.state !== "draft") return ["not-an-open-draft"];
  const issues = [];
  if (!record.mistakeTags?.length) issues.push("mistake-tag-required");
  if (!meaningful(record.firstWrongDecision)) issues.push("first-wrong-decision-required");
  if (!meaningful(record.verificationNotes)) issues.push("verification-notes-required");
  if (!meaningful(record.teachBack)) issues.push("teach-back-required");
  if (!ATTEMPT_CLOSURE_GRADES.includes(record.grade)) issues.push("grade-required");
  return issues;
}

export function completeAttemptClosure(workspace, id, options = {}) {
  if (!isRecord(workspace) || workspace.version !== ATTEMPT_CLOSURE_VERSION)
    throw new Error("A valid attempt closure workspace is required");
  assertExpectedRevision(workspace, options);
  const index = workspace.closures.findIndex((closure) => closure.id === cleanId(id));
  if (index < 0) throw new Error("Attempt closure was not found");
  const current = workspace.closures[index];
  assertExpectedRecordTimestamp(current, options);
  const issues = attemptClosureCompletionIssues(current);
  if (issues.length)
    throw new Error(`Attempt closure is incomplete: ${issues.join(", ")}`);
  const completedAt = cleanIso(options.now, new Date().toISOString());
  const next = {
    ...current,
    state: "completed",
    updatedAt: completedAt,
    completedAt,
    retryDueAt: new Date(Date.parse(completedAt) + DAY_MS).toISOString(),
    retired: false,
  };
  const closures = workspace.closures.slice();
  closures[index] = next;
  return {
    ...workspace,
    revision: Math.min(ATTEMPT_CLOSURE_LIMITS.maxRevision, workspace.revision + 1),
    updatedAt: completedAt,
    closures,
  };
}

function acceptedProofs(options, itemsById) {
  const receipts = receiptList(options);
  const receiptsById = new Map(receipts.map((receipt) => [receipt?.id, receipt]));
  return (Array.isArray(options.attempts) ? options.attempts : []).flatMap((attempt) => {
    const item = itemsById.get(attempt?.itemId);
    const receipt = receiptsById.get(attempt?.submissionId);
    const attemptId = cleanId(attempt?.id);
    const submissionId = cleanId(attempt?.submissionId);
    const itemRevision = cleanRevision(attempt?.itemRevision);
    const startedAt = cleanIso(attempt?.startedAt);
    const completedAt = attemptTime(attempt);
    const requestedAt = cleanIso(receipt?.requestedAt);
    const settledAt = receiptTime(receipt);
    const currentJudgeRevision = cleanRevision(item?.verification?.revision);
    const attemptJudgeRevision = cleanRevision(attempt?.verification?.revision);
    const receiptJudgeRevision = cleanRevision(receipt?.judge?.revision);
    const exactJudge = attemptJudgeRevision > 0 &&
      attemptJudgeRevision === receiptJudgeRevision &&
      (!currentJudgeRevision || attemptJudgeRevision === currentJudgeRevision);
    if (
      !item ||
      !attemptId ||
      !submissionId ||
      cleanId(receipt?.id) !== submissionId ||
      Number(item.contentRevision) !== itemRevision ||
      attempt?.practiceKind !== "solving" ||
      attempt?.outcome !== "completed" ||
      !["solved", "independent"].includes(attempt?.qualification) ||
      Number(attempt?.peeks) !== 0 ||
      !attempt?.verification ||
      Number(attempt.verification.total) < 1 ||
      Number(attempt.verification.passed) !== Number(attempt.verification.total) ||
      !receipt ||
      receipt.lifecycle !== "settled" ||
      receipt.status !== "accepted" ||
      receipt.assistance !== "none-recorded" ||
      receipt.itemId !== attempt.itemId ||
      receipt.language !== attempt.language ||
      Number(receipt.itemRevision) !== itemRevision ||
      Number(receipt.total) < 1 ||
      Number(receipt.passed) !== Number(receipt.total) ||
      !exactJudge ||
      !startedAt ||
      !completedAt ||
      !requestedAt ||
      !settledAt
    )
      return [];
    return [{
      attemptId,
      submissionId,
      itemId: attempt.itemId,
      itemRevision,
      startedAt,
      completedAt,
      requestedAt,
      settledAt,
    }];
  });
}

function modelRecord(record, nowMs, itemsById, proofs) {
  const item = itemsById.get(record.anchor.itemId);
  const current = Boolean(item && Number(item.contentRevision) === record.anchor.itemRevision);
  const retryDueAt = record.state === "completed"
    ? record.retryDueAt ?? new Date(Date.parse(record.completedAt) + DAY_MS).toISOString()
    : undefined;
  const resolutionGate = Date.parse(
    retryDueAt ?? record.completedAt ?? record.anchor.occurredAt,
  );
  const proof = current && record.state === "completed"
    ? proofs
        .filter(
          (candidate) =>
            candidate.itemId === record.anchor.itemId &&
            candidate.itemRevision === record.anchor.itemRevision &&
            Date.parse(candidate.startedAt) >= resolutionGate &&
            Date.parse(candidate.completedAt) >= resolutionGate &&
            Date.parse(candidate.requestedAt) >= resolutionGate &&
            Date.parse(candidate.settledAt) >= resolutionGate,
        )
        .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt))[0]
    : undefined;
  const status = record.retired || !current
    ? "retired"
    : proof
      ? "resolved"
      : retryDueAt && nowMs >= Date.parse(retryDueAt)
        ? "due"
        : "open";
  return {
    ...record,
    status,
    retryDueAt,
    currentRevision: current,
    learningClaim: "remediation-only",
    claimsIndependentSolve: false,
    claimsMastery: false,
    anchorAttemptId: record.anchor.attemptId,
    anchorSubmissionId: record.anchor.submissionId,
    ...(proof
      ? {
          resolution: proof,
          resolutionAttemptId: proof.attemptId,
          resolutionSubmissionId: proof.submissionId,
          resolvedAt: proof.settledAt,
        }
      : {}),
  };
}

export function summarizeAttemptClosures(records) {
  const summary = {
    total: 0,
    active: 0,
    open: 0,
    due: 0,
    resolved: 0,
    retired: 0,
    drafts: 0,
    completed: 0,
    laneCounts: { python: 0, swift: 0, ios: 0 },
    tagCounts: ATTEMPT_CLOSURE_MISTAKE_TAGS.map((tag) => ({ tag, count: 0 })),
  };
  for (const record of Array.isArray(records) ? records : []) {
    summary.total += 1;
    if (["open", "due"].includes(record.status)) summary.active += 1;
    if (Object.hasOwn(summary, record.status)) summary[record.status] += 1;
    if (record.state === "draft") summary.drafts += 1;
    if (record.state === "completed") summary.completed += 1;
    if (Object.hasOwn(summary.laneCounts, record.anchor?.lane))
      summary.laneCounts[record.anchor.lane] += 1;
    for (const tag of record.mistakeTags ?? []) {
      const entry = summary.tagCounts.find((candidate) => candidate.tag === tag);
      if (entry) entry.count += 1;
    }
  }
  return summary;
}

export function selectAttemptClosures(records, options = {}) {
  const statuses = Array.isArray(options.status)
    ? options.status
    : options.status ? [options.status] : [];
  const tags = Array.isArray(options.mistakeTags) ? options.mistakeTags : [];
  const selected = (Array.isArray(records) ? records : []).filter((record) =>
    (!statuses.length || statuses.includes(record.status)) &&
    (!options.lane || options.lane === "all" || record.anchor?.lane === options.lane) &&
    (!options.itemId || record.anchor?.itemId === options.itemId) &&
    (!tags.length || tags.some((tag) => record.mistakeTags?.includes(tag))),
  );
  return selected.sort((left, right) => {
    const priority = { due: 0, open: 1, resolved: 2, retired: 3 };
    return (priority[left.status] ?? 4) - (priority[right.status] ?? 4) ||
      Date.parse(right.anchor.occurredAt) - Date.parse(left.anchor.occurredAt) ||
      left.id.localeCompare(right.id);
  });
}

export function selectAttemptClosureById(records, id) {
  return (Array.isArray(records) ? records : []).find(
    (record) => record.id === cleanId(id),
  ) ?? null;
}

export function deriveAttemptClosureModel(workspace, options = {}) {
  const normalized = normalizeAttemptClosureWorkspace(workspace, options);
  const now = cleanIso(options.now, new Date().toISOString());
  const itemsById = currentItemRegistry(options.items);
  const proofs = acceptedProofs(options, itemsById);
  const records = normalized.closures.map((record) =>
    modelRecord(record, Date.parse(now), itemsById, proofs),
  );
  const ordered = selectAttemptClosures(records);
  return {
    generatedAt: now,
    scope: "private-local-remediation-evidence",
    records: ordered,
    closures: ordered,
    selected: options.selectedId
      ? selectAttemptClosureById(ordered, options.selectedId)
      : null,
    next: ordered.find((record) => record.status === "due") ??
      ordered.find((record) => record.status === "open") ?? null,
    today: ordered.filter((record) => record.status === "due"),
    weakness: ordered.filter(
      (record) => record.status !== "retired" && record.mistakeTags.length,
    ),
    summary: summarizeAttemptClosures(ordered),
  };
}
