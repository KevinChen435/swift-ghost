import {
  ASSESSMENT_BANK_REVISION,
  CROSS_LANE_REENTRY_BLUEPRINT,
  assessmentBankEntry,
  isAssessmentResponseMode,
  selectAssessmentForm,
} from "./assessment-bank.mjs";

const ISO_EPOCH = "1970-01-01T00:00:00.000Z";
const MAX_RUNS = 50;
const MAX_TEXT = 480;

export const ASSESSMENT_RUBRIC_DIMENSIONS = Object.freeze([
  Object.freeze({ id: "recognition", label: "Recognition", description: "Identified the useful constraints and a viable approach family." }),
  Object.freeze({ id: "reasoning", label: "Reasoning", description: "Explained an invariant or correctness argument and weighed alternatives." }),
  Object.freeze({ id: "implementation", label: "Implementation", description: "Translated the approach into coherent code or a concrete design." }),
  Object.freeze({ id: "verification", label: "Verification", description: "Checked representative and boundary cases and found defects." }),
  Object.freeze({ id: "communication", label: "Communication", description: "Kept the interviewer oriented through the work." }),
]);

export const ASSESSMENT_BLOCKERS = Object.freeze([
  Object.freeze({ id: "syntax-fluency", label: "Syntax fluency" }),
  Object.freeze({ id: "missed-cue", label: "Missed selection cue" }),
  Object.freeze({ id: "wrong-invariant", label: "Unstable invariant" }),
  Object.freeze({ id: "data-structure", label: "Data-structure choice" }),
  Object.freeze({ id: "complexity", label: "Complexity analysis" }),
  Object.freeze({ id: "boundary", label: "Boundary cases" }),
  Object.freeze({ id: "implementation", label: "Implementation defect" }),
  Object.freeze({ id: "verification", label: "Verification gap" }),
  Object.freeze({ id: "communication", label: "Communication gap" }),
  Object.freeze({ id: "overfit", label: "Answer recognition without transfer" }),
]);

const PYTHON_PROBES = [
  {
    id: "python:10001",
    itemId: "python:10001",
    lane: "python-fluency",
    title: "Frequency Map Warm-up",
    focus: "Collections and control-flow fluency",
    estimatedMinutes: 6,
  },
  {
    id: "python:1",
    itemId: "python:1",
    lane: "algorithmic",
    title: "Two Sum",
    focus: "Arrays and hashing",
    estimatedMinutes: 10,
  },
  {
    id: "python:125",
    itemId: "python:125",
    lane: "algorithmic",
    title: "Valid Palindrome",
    focus: "Two pointers",
    estimatedMinutes: 10,
  },
  {
    id: "python:20",
    itemId: "python:20",
    lane: "algorithmic",
    title: "Valid Parentheses",
    focus: "Stack reasoning",
    estimatedMinutes: 10,
  },
  {
    id: "python:104",
    itemId: "python:104",
    lane: "algorithmic",
    title: "Maximum Depth of Binary Tree",
    focus: "Tree traversal",
    estimatedMinutes: 12,
  },
  {
    id: "python:200",
    itemId: "python:200",
    lane: "algorithmic",
    title: "Number of Islands",
    focus: "Graph traversal",
    estimatedMinutes: 15,
  },
];

const IOS_PROBES = [
  {
    id: "ios:value-reference-snapshots",
    itemId: "ios:value-reference-snapshots",
    lane: "ios-self-assessed",
    title: "Copy a Value, Share a Reference",
    focus: "Value and reference semantics",
    estimatedMinutes: 8,
  },
  {
    id: "ios:weak-stored-closure",
    itemId: "ios:weak-stored-closure",
    lane: "ios-self-assessed",
    title: "Break a Stored-Closure Retain Cycle",
    focus: "ARC and closure capture",
    estimatedMinutes: 10,
  },
  {
    id: "ios:cancellable-search",
    itemId: "ios:cancellable-search",
    lane: "ios-self-assessed",
    title: "Cancel Stale Search Work",
    focus: "Structured concurrency and cancellation",
    estimatedMinutes: 12,
  },
];

function freezeProgram(program) {
  return Object.freeze({
    ...program,
    probes: Object.freeze(program.probes.map((probe) => Object.freeze({ ...probe }))),
  });
}

export const ASSESSMENT_PROGRAMS = Object.freeze([
  freezeProgram({
    id: "python-reentry",
    title: "Python re-entry diagnostic",
    shortTitle: "Python re-entry",
    track: "python",
    evidenceLabel: "Observed practice evidence",
    description: "Six short probes separate keyboard fluency from algorithmic reasoning and verification.",
    disclaimer: "This is a local learning diagnostic, not a certification or prediction of interview readiness.",
    probes: PYTHON_PROBES,
  }),
  freezeProgram({
    id: "ios-pulse",
    title: "Swift & iOS fundamentals pulse",
    shortTitle: "iOS pulse",
    track: "ios",
    evidenceLabel: "Self-assessed evidence",
    description: "Three focused probes refresh Swift semantics, memory ownership, and cancellation reasoning.",
    disclaimer: "iOS results are self-assessed practice evidence, not validated certification.",
    probes: IOS_PROBES,
  }),
  freezeProgram({
    id: "cross-lane-reentry",
    title: "Cross-lane re-entry assessment",
    shortTitle: "Cross-lane re-entry",
    track: "cross-lane",
    evidenceLabel: "Local practice evidence by response mode",
    description: "A frozen six-checkpoint form samples Python fluency, algorithmic state, Swift reconstruction, and iOS engineering boundaries.",
    disclaimer: "This device-local learning assessment is not proctored, sealed, certified, or a prediction of interview readiness.",
    probes: [],
    blueprintId: CROSS_LANE_REENTRY_BLUEPRINT.id,
    blueprintRevision: CROSS_LANE_REENTRY_BLUEPRINT.revision,
    formSize: CROSS_LANE_REENTRY_BLUEPRINT.formSize,
    candidateCount: CROSS_LANE_REENTRY_BLUEPRINT.candidateCount,
    sections: CROSS_LANE_REENTRY_BLUEPRINT.sections,
  }),
]);

const PROGRAM_BY_ID = new Map(ASSESSMENT_PROGRAMS.map((program) => [program.id, program]));
const DIMENSION_IDS = ASSESSMENT_RUBRIC_DIMENSIONS.map(({ id }) => id);
const BLOCKER_IDS = new Set(ASSESSMENT_BLOCKERS.map(({ id }) => id));

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanText(value, limit = MAX_TEXT, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit) || fallback;
}

function cleanId(value, fallback = "") {
  const id = cleanText(value, 160);
  return /^[\w:.-]+$/.test(id) ? id : fallback;
}

function iso(value, fallback = ISO_EPOCH) {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function boundedInt(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.round(number)))
    : fallback;
}

function responseModeForLegacyProbe(probe) {
  return probe.lane === "ios-self-assessed" ? "concept-recall" : "local-verified-solve";
}

function formEntryCurrent(entry) {
  if (!entry || entry.formKind === "legacy-fixed") return Boolean(entry.currentEvidenceEligible);
  const current = assessmentBankEntry(entry.bankEntryId);
  if (!current) return false;
  return Number(entry.bankRevision) === current.revision &&
    entry.sectionId === current.sectionId &&
    entry.itemId === current.itemId &&
    Number(entry.itemRevision) === current.itemRevision &&
    Number(entry.judgeRevision ?? 0) === Number(current.judgeRevision ?? 0) &&
    entry.lane === current.lane &&
    entry.skillId === current.skillId &&
    entry.responseMode === current.responseMode &&
    Number(entry.stage) === current.stage &&
    Number(entry.conceptCheckIndex ?? 0) === Number(current.conceptCheckIndex ?? 0);
}

function normalizeFormEntry(value, options = {}) {
  if (!isRecord(value)) return null;
  const entryId = cleanId(value.entryId ?? value.probeId ?? value.id);
  const bankEntryId = cleanId(value.bankEntryId);
  const sectionId = cleanId(value.sectionId);
  const itemId = cleanId(value.itemId);
  const skillId = cleanId(value.skillId);
  const lanes = ["python", "swift", "ios", "python-fluency", "algorithmic", "ios-self-assessed"];
  const responseMode = isAssessmentResponseMode(value.responseMode)
    ? value.responseMode
    : options.legacy
      ? responseModeForLegacyProbe(value)
      : null;
  if (!entryId || !bankEntryId || !sectionId || !itemId || !skillId || !lanes.includes(value.lane) || !responseMode) return null;
  const normalized = {
    entryId,
    bankEntryId,
    bankRevision: boundedInt(value.bankRevision, options.legacy ? 0 : 1, 0, 1_000_000),
    sectionId,
    itemId,
    itemRevision: boundedInt(value.itemRevision, 1, 1, 1_000_000),
    ...(Number.isFinite(Number(value.judgeRevision))
      ? { judgeRevision: boundedInt(value.judgeRevision, 1, 1, 1_000_000) }
      : {}),
    lane: value.lane,
    skillId,
    skillLabelSnapshot: cleanText(value.skillLabelSnapshot ?? value.skillLabel, 120, skillId),
    titleSnapshot: cleanText(value.titleSnapshot ?? value.title, 160, itemId),
    focusSnapshot: cleanText(value.focusSnapshot ?? value.focus, 240),
    responseMode,
    estimatedMinutes: boundedInt(value.estimatedMinutes, 10, 1, 240),
    ...(Number.isFinite(Number(value.stage)) ? { stage: boundedInt(value.stage, 5, 0, 5) } : {}),
    ...(Number.isFinite(Number(value.conceptCheckIndex))
      ? { conceptCheckIndex: boundedInt(value.conceptCheckIndex, 1, 0, 1_000) }
      : {}),
    formKind: options.legacy ? "legacy-fixed" : "bank",
  };
  normalized.currentEvidenceEligible = options.legacy
    ? Boolean(value.currentEvidenceEligible ?? true)
    : formEntryCurrent(normalized);
  return normalized;
}

function bankFormEntry(entry) {
  return normalizeFormEntry({
    entryId: entry.id,
    bankEntryId: entry.id,
    bankRevision: entry.revision,
    sectionId: entry.sectionId,
    itemId: entry.itemId,
    itemRevision: entry.itemRevision,
    judgeRevision: entry.judgeRevision,
    lane: entry.lane,
    skillId: entry.skillId,
    skillLabelSnapshot: entry.skillLabel,
    titleSnapshot: entry.title,
    focusSnapshot: entry.focus,
    responseMode: entry.responseMode,
    estimatedMinutes: entry.estimatedMinutes,
    stage: entry.stage,
    conceptCheckIndex: entry.conceptCheckIndex,
  });
}

function priorAssessmentEvidence(workspace) {
  return (Array.isArray(workspace?.runs) ? workspace.runs : []).flatMap((run) =>
    (Array.isArray(run?.results) ? run.results : []).map((result) => ({
      ...result,
      exposedAt: run.completedAt ?? run.updatedAt ?? run.startedAt,
    })),
  );
}

function legacyFixedForm(program, rawRun = {}) {
  const rawByProbe = new Map((Array.isArray(rawRun.results) ? rawRun.results : []).map((result) => [
    cleanId(result?.probeId ?? result?.itemId),
    result,
  ]));
  return program.probes.map((probe, index) => {
    const raw = rawByProbe.get(probe.id);
    const attempt = raw?.objectiveAttempt ?? raw?.attempt;
    const responseMode = responseModeForLegacyProbe(probe);
    const expectedRevision = probe.lane === "ios-self-assessed" ? 2 : 1;
    const itemRevision = boundedInt(attempt?.itemRevision, expectedRevision, 1, 1_000_000);
    const expectedJudge = responseMode === "local-verified-solve" ? 2 : undefined;
    const judgeRevision = attempt?.verification?.revision ?? expectedJudge;
    return normalizeFormEntry({
      entryId: probe.id,
      bankEntryId: `legacy:${program.id}:${probe.id}`,
      bankRevision: 0,
      sectionId: `legacy-${index + 1}`,
      itemId: probe.itemId,
      itemRevision,
      judgeRevision,
      lane: probe.lane,
      skillId: cleanId(probe.focus.toLowerCase().replace(/[^a-z0-9]+/g, "-"), `legacy-${index + 1}`),
      skillLabelSnapshot: probe.focus,
      titleSnapshot: probe.title,
      focusSnapshot: probe.focus,
      responseMode,
      estimatedMinutes: probe.estimatedMinutes,
      currentEvidenceEligible: itemRevision === expectedRevision &&
        Number(judgeRevision ?? 0) === Number(expectedJudge ?? 0),
    }, { legacy: true });
  });
}

function entityId(prefix, requested) {
  const supplied = cleanId(requested);
  if (supplied) return supplied;
  const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${token}`;
}

function immutableMutation(workspace, mutate, now) {
  const normalized = normalizeAssessmentWorkspace(workspace, { now });
  const draft = structuredClone(normalized);
  const changed = mutate(draft);
  if (!changed) return normalized;
  draft.revision = normalized.revision + 1;
  draft.updatedAt = iso(now, normalized.updatedAt);
  return normalizeAssessmentWorkspace(draft, { now: draft.updatedAt });
}

function normalizeVerification(value) {
  if (!isRecord(value)) return undefined;
  const total = boundedInt(value.total, 0, 0, 10_000);
  const passed = boundedInt(value.passed, 0, 0, total);
  if (total < 1) return undefined;
  return {
    passed,
    total,
    ...(Number.isFinite(Number(value.revision))
      ? { revision: boundedInt(value.revision, 1, 1, 1_000_000) }
      : {}),
  };
}

function normalizeRefresher(value, probe, now) {
  if (!isRecord(value)) return undefined;
  const kinds = probe.responseMode === "concept-recall" || probe.lane === "ios-self-assessed" || probe.lane === "ios"
    ? ["concept-review", "known-answer"]
    : ["typing", "known-answer"];
  const kind = kinds.includes(value.kind) ? value.kind : kinds[0];
  const usedAt = iso(value.usedAt ?? value.completedAt, now);
  return {
    kind,
    stage: boundedInt(value.stage, kind === "typing" ? 1 : 0, 0, 4),
    usedAt,
    attemptId: cleanId(value.attemptId) || undefined,
  };
}

function normalizeObjectiveAttempt(value, probe, now) {
  if (!isRecord(value)) return undefined;
  const attemptId = cleanId(value.attemptId ?? value.id);
  const practiceKinds = ["typing", "solving", "concept"];
  const practiceKind = practiceKinds.includes(value.practiceKind)
    ? value.practiceKind
    : probe.responseMode === "concept-recall" || probe.lane === "ios-self-assessed" || probe.lane === "ios"
      ? "concept"
      : "solving";
  const qualifications = ["syntax", "guided", "independent", "solved", "assisted", "incomplete"];
  const outcome = value.outcome === "completed" ? "completed" : "abandoned";
  const conceptGrades = ["again", "hard", "good", "easy"];
  const verification = normalizeVerification(value.verification);
  const responseMode = isAssessmentResponseMode(value.responseMode) ? value.responseMode : probe.responseMode;
  const stage = Number.isFinite(Number(value.stage)) ? boundedInt(value.stage, 0, 0, 5) : undefined;
  const conceptCheckIndex = Number.isFinite(Number(value.conceptCheckIndex))
    ? boundedInt(value.conceptCheckIndex, 0, 0, 1_000)
    : undefined;
  const accepted = responseMode === "local-verified-solve"
    ? outcome === "completed" &&
      practiceKind === "solving" &&
      value.qualification === "solved" &&
      boundedInt(value.peeks, 0, 0, 10_000) === 0 &&
      verification?.total > 0 &&
      verification.passed === verification.total &&
      Number(verification.revision) === Number(probe.judgeRevision)
    : responseMode === "swift-reconstruction"
      ? outcome === "completed" && practiceKind === "typing" && stage === probe.stage
      : responseMode === "concept-recall"
        ? outcome === "completed" && practiceKind === "concept" && stage === probe.stage &&
          conceptCheckIndex === probe.conceptCheckIndex
        : undefined;
  return {
    attemptId: attemptId || undefined,
    itemId: probe.itemId,
    itemRevision: boundedInt(value.itemRevision, 1, 1, 1_000_000),
    practiceKind,
    outcome,
    qualification: qualifications.includes(value.qualification)
      ? value.qualification
      : outcome === "completed"
        ? "assisted"
        : "incomplete",
    peeks: boundedInt(value.peeks, 0, 0, 10_000),
    durationMs: boundedInt(value.durationMs, 0, 0, 86_400_000),
    completedAt: iso(value.completedAt ?? value.recordedAt, now),
    verification,
    conceptGrade: conceptGrades.includes(value.conceptGrade) ? value.conceptGrade : undefined,
    sessionId: cleanId(value.sessionId) || undefined,
    ...(responseMode ? { responseMode } : {}),
    ...(stage !== undefined ? { stage } : {}),
    ...(conceptCheckIndex !== undefined ? { conceptCheckIndex } : {}),
    ...(typeof accepted === "boolean" ? { accepted } : {}),
  };
}

function emptyRubric() {
  return Object.fromEntries(DIMENSION_IDS.map((id) => [id, 0]));
}

function normalizeDebrief(value, now) {
  if (!isRecord(value)) return undefined;
  const rawRubric = isRecord(value.rubric) ? value.rubric : value;
  const rubric = Object.fromEntries(
    DIMENSION_IDS.map((id) => [id, boundedInt(rawRubric[id], 0, 0, 2)]),
  );
  const blockers = Array.isArray(value.blockers)
    ? [...new Set(value.blockers.map((entry) => cleanId(entry)).filter((id) => BLOCKER_IDS.has(id)))]
    : [];
  return {
    rubric,
    blockers,
    note: cleanText(value.note ?? value.mostImportantGap, MAX_TEXT),
    recordedAt: iso(value.recordedAt ?? value.completedAt, now),
  };
}

function probeFor(value, fallbackProgramId) {
  if (isRecord(value) && value.itemId) {
    const itemId = cleanId(value.itemId);
    for (const program of ASSESSMENT_PROGRAMS) {
      const probe = program.probes.find((entry) => entry.itemId === itemId);
      if (probe) return probe;
    }
  }
  const id = cleanId(isRecord(value) ? value.probeId ?? value.id : value);
  const program = assessmentProgram(fallbackProgramId);
  return program?.probes.find((probe) => probe.id === id) ??
    ASSESSMENT_PROGRAMS.flatMap(({ probes }) => probes).find((probe) => probe.id === id) ??
    null;
}

function attemptMatchesFrozenContract(value, probe, { legacy = false } = {}) {
  if (!isRecord(value)) return false;
  if (legacy) return !value.itemId || cleanId(value.itemId) === probe.itemId;
  if (cleanId(value.itemId) !== probe.itemId) return false;
  if (Number(value.itemRevision) !== Number(probe.itemRevision)) return false;
  if (value.responseMode !== probe.responseMode) return false;
  if (Number(value.stage) !== Number(probe.stage)) return false;
  if (probe.conceptCheckIndex !== undefined &&
      Number(value.conceptCheckIndex) !== Number(probe.conceptCheckIndex)) return false;
  if (probe.judgeRevision !== undefined &&
      Number(value.verification?.revision) !== Number(probe.judgeRevision)) return false;
  return true;
}

export function assessmentProgram(programId) {
  return PROGRAM_BY_ID.get(cleanId(programId)) ?? null;
}

export function normalizeAssessmentProbeResult(value, probeInput, options = {}) {
  const now = iso(options.now, ISO_EPOCH);
  const probe = isRecord(probeInput) && probeInput.itemId
    ? probeInput
    : probeFor(probeInput ?? value, options.programId);
  if (!probe) return null;
  const legacy = options.legacy ?? !probe.bankEntryId;
  const raw = isRecord(value) ? value : {};
  const refresher = normalizeRefresher(raw.refresher, probe, now);
  const rawAttempt = raw.objectiveAttempt ?? raw.attempt;
  const objectiveAttempt = rawAttempt && attemptMatchesFrozenContract(rawAttempt, probe, { legacy })
    ? normalizeObjectiveAttempt(rawAttempt, probe, now)
    : undefined;
  const debrief = objectiveAttempt ? normalizeDebrief(raw.debrief, now) : undefined;
  const status = debrief
    ? "debriefed"
    : objectiveAttempt
      ? "attempted"
      : refresher
        ? "refreshed"
        : "pending";
  return {
    probeId: probe.id,
    itemId: probe.itemId,
    lane: probe.lane,
    itemRevision: probe.itemRevision ?? objectiveAttempt?.itemRevision ?? 1,
    judgeRevision: probe.judgeRevision,
    responseMode: probe.responseMode ?? responseModeForLegacyProbe(probe),
    currentEvidenceEligible: probe.currentEvidenceEligible !== false,
    status,
    refresher,
    objectiveAttempt,
    debrief,
  };
}

export function normalizeAssessmentRun(value, options = {}) {
  if (!isRecord(value)) return null;
  const program = assessmentProgram(value.programId ?? options.programId);
  const id = cleanId(value.id);
  if (!program || !id) return null;
  const now = iso(options.now, ISO_EPOCH);
  const isBankForm = program.id === "cross-lane-reentry";
  let form;
  if (isBankForm) {
    const rawForm = Array.isArray(value.form) ? value.form : [];
    form = rawForm.map((entry) => normalizeFormEntry(entry)).filter(Boolean);
    if (form.length !== CROSS_LANE_REENTRY_BLUEPRINT.formSize ||
        new Set(form.map(({ entryId }) => entryId)).size !== form.length ||
        new Set(form.map(({ sectionId }) => sectionId)).size !== CROSS_LANE_REENTRY_BLUEPRINT.formSize) return null;
  } else {
    const migrated = Array.isArray(value.form)
      ? value.form.map((entry) => normalizeFormEntry(entry, { legacy: true })).filter(Boolean)
      : [];
    form = migrated.length === program.probes.length ? migrated : legacyFixedForm(program, value);
  }
  const rawResults = new Map();
  for (const raw of Array.isArray(value.results) ? value.results : []) {
    const probeId = cleanId(raw?.probeId ?? raw?.entryId ?? raw?.itemId);
    const probe = form.find((entry) => entry.entryId === probeId || entry.itemId === cleanId(raw?.itemId));
    if (!probe) continue;
    rawResults.set(probe.entryId, raw);
  }
  const results = form.map((entry) =>
    normalizeAssessmentProbeResult(rawResults.get(entry.entryId), {
      ...entry,
      id: entry.entryId,
      title: entry.titleSnapshot,
      focus: entry.focusSnapshot,
    }, { now, programId: program.id, legacy: !isBankForm }),
  );
  const statuses = ["active", "paused", "completed", "archived"];
  const requestedStatus = statuses.includes(value.status) ? value.status : "paused";
  const startedAt = iso(value.startedAt, now);
  const updatedAt = iso(value.updatedAt, startedAt);
  const completedAt = value.completedAt ? iso(value.completedAt, updatedAt) : undefined;
  const archivedAt = value.archivedAt ? iso(value.archivedAt, updatedAt) : undefined;
  const firstIncomplete = results.findIndex((result) => result.status !== "debriefed");
  const fallbackIndex = firstIncomplete < 0 ? Math.max(0, results.length - 1) : firstIncomplete;
  return {
    id,
    programId: program.id,
    blueprintId: cleanId(value.blueprintId, isBankForm ? CROSS_LANE_REENTRY_BLUEPRINT.id : `legacy:${program.id}`),
    blueprintRevision: boundedInt(value.blueprintRevision, isBankForm ? CROSS_LANE_REENTRY_BLUEPRINT.revision : 1, 0, 1_000_000),
    selectionSeed: cleanText(value.selectionSeed, 160, id),
    formKind: isBankForm ? "bank" : "legacy-fixed",
    formRevision: boundedInt(value.formRevision, isBankForm ? ASSESSMENT_BANK_REVISION : 1, 0, 1_000_000),
    form,
    status: requestedStatus,
    outcome: value.outcome === "completed" || value.outcome === "ended" ? value.outcome : undefined,
    startedAt,
    updatedAt,
    completedAt,
    archivedAt,
    currentProbeIndex: boundedInt(value.currentProbeIndex, fallbackIndex, 0, Math.max(0, results.length - 1)),
    results,
  };
}

export function createAssessmentWorkspace(now = ISO_EPOCH) {
  const updatedAt = iso(now, ISO_EPOCH);
  return {
    version: 2,
    revision: 0,
    updatedAt,
    activeRunId: null,
    runs: [],
  };
}

export function normalizeAssessmentWorkspace(value, options = {}) {
  const now = iso(options.now, ISO_EPOCH);
  if (!isRecord(value)) return createAssessmentWorkspace(now);
  const byId = new Map();
  for (const raw of Array.isArray(value.runs) ? value.runs : []) {
    const run = normalizeAssessmentRun(raw, { now });
    if (!run) continue;
    const previous = byId.get(run.id);
    if (!previous || Date.parse(previous.updatedAt) <= Date.parse(run.updatedAt)) byId.set(run.id, run);
  }
  let runs = [...byId.values()]
    .sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt) || left.id.localeCompare(right.id))
    .slice(-MAX_RUNS);
  const requestedActiveId = cleanId(value.activeRunId);
  const active = runs.find((run) => run.id === requestedActiveId && run.status === "active") ??
    [...runs].reverse().find((run) => run.status === "active") ??
    null;
  runs = runs.map((run) => ({
    ...run,
    status: run.id === active?.id ? "active" : run.status === "active" ? "paused" : run.status,
  }));
  return {
    version: 2,
    revision: boundedInt(value.revision, 0, 0, 2_147_483_647),
    updatedAt: iso(value.updatedAt, now),
    activeRunId: active?.id ?? null,
    runs,
  };
}

export function currentAssessmentProbe(run) {
  const normalized = normalizeAssessmentRun(run);
  if (!normalized) return null;
  const entry = normalized.form[normalized.currentProbeIndex];
  if (!entry) return null;
  return Object.freeze({
    id: entry.entryId,
    itemId: entry.itemId,
    lane: entry.lane,
    title: entry.titleSnapshot,
    focus: entry.focusSnapshot,
    estimatedMinutes: entry.estimatedMinutes,
    itemRevision: entry.itemRevision,
    judgeRevision: entry.judgeRevision,
    responseMode: entry.responseMode,
    stage: entry.stage,
    conceptCheckIndex: entry.conceptCheckIndex,
    currentEvidenceEligible: entry.currentEvidenceEligible,
    sectionId: entry.sectionId,
    skillId: entry.skillId,
    skillLabel: entry.skillLabelSnapshot,
  });
}

export function startAssessment(workspace, programId, options = {}) {
  const program = assessmentProgram(programId);
  if (!program) return normalizeAssessmentWorkspace(workspace, options);
  const now = iso(options.now, ISO_EPOCH);
  return immutableMutation(workspace, (draft) => {
    if (draft.runs.length >= MAX_RUNS) return false;
    const id = entityId("assessment", options.id);
    if (draft.runs.some((run) => run.id === id)) return false;
    for (const run of draft.runs) {
      if (run.status === "active") run.status = "paused";
    }
    const selectionSeed = cleanText(options.selectionSeed, 160, id);
    const form = program.id === "cross-lane-reentry"
      ? selectAssessmentForm({
          seed: selectionSeed,
          history: [draft, options.history],
          evidence: [priorAssessmentEvidence(draft), options.evidence],
        }).map(bankFormEntry)
      : legacyFixedForm(program);
    draft.runs.push({
      id,
      programId: program.id,
      blueprintId: program.id === "cross-lane-reentry" ? CROSS_LANE_REENTRY_BLUEPRINT.id : `legacy:${program.id}`,
      blueprintRevision: program.id === "cross-lane-reentry" ? CROSS_LANE_REENTRY_BLUEPRINT.revision : 1,
      selectionSeed,
      formKind: program.id === "cross-lane-reentry" ? "bank" : "legacy-fixed",
      formRevision: program.id === "cross-lane-reentry" ? ASSESSMENT_BANK_REVISION : 1,
      form,
      status: "active",
      startedAt: now,
      updatedAt: now,
      currentProbeIndex: 0,
      results: form.map((entry) =>
        normalizeAssessmentProbeResult(undefined, {
          ...entry,
          id: entry.entryId,
          title: entry.titleSnapshot,
          focus: entry.focusSnapshot,
        }, { now, programId: program.id, legacy: program.id !== "cross-lane-reentry" }),
      ),
    });
    draft.activeRunId = id;
    return true;
  }, now);
}

export function resumeAssessment(workspace, runId, options = {}) {
  const id = cleanId(runId);
  const now = iso(options.now, ISO_EPOCH);
  return immutableMutation(workspace, (draft) => {
    const run = draft.runs.find((candidate) => candidate.id === id);
    if (!run || run.status === "completed" || run.status === "archived") return false;
    if (draft.activeRunId === id && run.status === "active") return false;
    for (const candidate of draft.runs) {
      if (candidate.status === "active") candidate.status = "paused";
    }
    run.status = "active";
    run.updatedAt = now;
    const firstIncomplete = run.results.findIndex((result) => result.status !== "debriefed");
    if (firstIncomplete >= 0) run.currentProbeIndex = firstIncomplete;
    draft.activeRunId = id;
    return true;
  }, now);
}

function mutateActiveResult(workspace, runId, probeId, options, mutate) {
  const id = cleanId(runId);
  const requestedProbeId = cleanId(probeId);
  const now = iso(options.now, ISO_EPOCH);
  return immutableMutation(workspace, (draft) => {
    const run = draft.runs.find((candidate) => candidate.id === id);
    if (!run || run.status !== "active" || draft.activeRunId !== id) return false;
    const result = run.results.find((candidate) => candidate.probeId === requestedProbeId);
    if (!result || !mutate(result, run, now)) return false;
    run.updatedAt = now;
    return true;
  }, now);
}

function frozenProbeForRun(run, probeId) {
  const entry = run.form?.find(({ entryId }) => entryId === probeId);
  return entry ? {
    ...entry,
    id: entry.entryId,
    title: entry.titleSnapshot,
    focus: entry.focusSnapshot,
  } : null;
}

export function recordAssessmentRefresher(workspace, runId, probeId, input = {}, options = {}) {
  return mutateActiveResult(workspace, runId, probeId, options, (result, run, now) => {
    if (result.objectiveAttempt || result.debrief) return false;
    const probe = frozenProbeForRun(run, result.probeId);
    if (!probe) return false;
    result.refresher = normalizeRefresher({ ...input, usedAt: input.usedAt ?? now }, probe, now);
    result.status = "refreshed";
    run.currentProbeIndex = run.form.findIndex(({ entryId }) => entryId === probe.id);
    return true;
  });
}

export function recordAssessmentObjectiveAttempt(workspace, runId, probeId, attempt, options = {}) {
  return mutateActiveResult(workspace, runId, probeId, options, (result, run, now) => {
    if (!isRecord(attempt) || result.objectiveAttempt || result.debrief) return false;
    const probe = frozenProbeForRun(run, result.probeId);
    if (!probe) return false;
    if (!attemptMatchesFrozenContract(attempt, probe, { legacy: run.formKind === "legacy-fixed" })) return false;
    result.objectiveAttempt = normalizeObjectiveAttempt(
      { ...attempt, completedAt: attempt.completedAt ?? now },
      probe,
      now,
    );
    result.status = "attempted";
    run.currentProbeIndex = run.form.findIndex(({ entryId }) => entryId === probe.id);
    return true;
  });
}

export function recordAssessmentDebrief(workspace, runId, probeId, input, options = {}) {
  return mutateActiveResult(workspace, runId, probeId, options, (result, run, now) => {
    if (!result.objectiveAttempt || !isRecord(input)) return false;
    result.debrief = normalizeDebrief({ ...input, recordedAt: input.recordedAt ?? now }, now);
    result.status = "debriefed";
    const nextIncomplete = run.results.findIndex((candidate) => candidate.status !== "debriefed");
    run.currentProbeIndex = nextIncomplete < 0 ? run.results.length - 1 : nextIncomplete;
    return true;
  });
}

export function finishAssessment(workspace, runId, options = {}) {
  const id = cleanId(runId);
  const now = iso(options.now, ISO_EPOCH);
  return immutableMutation(workspace, (draft) => {
    const run = draft.runs.find((candidate) => candidate.id === id);
    if (!run || run.status === "completed" || run.status === "archived") return false;
    const complete = run.results.every((result) => result.status === "debriefed");
    run.status = "completed";
    run.outcome = complete && options.outcome !== "ended" ? "completed" : "ended";
    run.completedAt = now;
    run.updatedAt = now;
    if (draft.activeRunId === id) draft.activeRunId = null;
    return true;
  }, now);
}

export function archiveAssessment(workspace, runId, options = {}) {
  const id = cleanId(runId);
  const now = iso(options.now, ISO_EPOCH);
  return immutableMutation(workspace, (draft) => {
    const run = draft.runs.find((candidate) => candidate.id === id);
    if (!run || run.status === "archived") return false;
    run.status = "archived";
    run.archivedAt = now;
    run.updatedAt = now;
    if (draft.activeRunId === id) draft.activeRunId = null;
    return true;
  }, now);
}

function rubricTotal(debrief) {
  return debrief
    ? DIMENSION_IDS.reduce((total, id) => total + debrief.rubric[id], 0)
    : null;
}

function evidenceLevel(result) {
  const attempt = result.objectiveAttempt;
  if (!attempt) return "not-observed";
  if (result.lane === "ios-self-assessed") return "self-assessed";
  if (["python", "swift", "ios"].includes(result.lane)) {
    if (result.currentEvidenceEligible === false) return "incomplete";
    if (result.responseMode === "concept-recall") {
      if (!attempt.accepted) return "incomplete";
      return result.refresher || attempt.peeks > 0 ? "assisted" : "self-assessed";
    }
    if (result.responseMode === "swift-reconstruction") {
      if (!attempt.accepted) return "incomplete";
      return result.refresher || attempt.peeks > 0 ? "assisted" : "reconstruction";
    }
    if (result.responseMode === "local-verified-solve") {
      if (result.refresher) return "assisted";
      return attempt.accepted ? "independent" : attempt.outcome === "completed" ? "assisted" : "incomplete";
    }
  }
  if (attempt.outcome !== "completed") return "incomplete";
  if (result.refresher) return "assisted";
  const verificationPassed = attempt.verification &&
    attempt.verification.total > 0 &&
    attempt.verification.passed === attempt.verification.total;
  if (
    attempt.practiceKind === "solving" &&
    attempt.qualification === "solved" &&
    attempt.peeks === 0 &&
    verificationPassed
  ) return "independent";
  return "assisted";
}

function laneSummary(results, lane) {
  const members = results.filter((result) => result.lane === lane);
  const observed = members.filter((result) => result.objectiveAttempt);
  const totals = observed.map((result) => rubricTotal(result.debrief)).filter((score) => score !== null);
  return {
    evidenceKind: lane === "ios-self-assessed" || lane === "ios"
      ? "self-assessed"
      : lane === "swift"
        ? "reconstruction"
        : "observed",
    totalProbes: members.length,
    attempted: observed.length,
    debriefed: members.filter((result) => result.debrief).length,
    independent: members.filter((result) => evidenceLevel(result) === "independent").length,
    assisted: members.filter((result) => evidenceLevel(result) === "assisted").length,
    selfAssessed: members.filter((result) => evidenceLevel(result) === "self-assessed").length,
    reconstruction: members.filter((result) => evidenceLevel(result) === "reconstruction").length,
    incomplete: members.filter((result) => ["not-observed", "incomplete"].includes(evidenceLevel(result))).length,
    rubricAverage: totals.length
      ? Number((totals.reduce((sum, score) => sum + score, 0) / totals.length).toFixed(1))
      : null,
  };
}

function orderedBlockers(results) {
  const counts = new Map();
  for (const result of results) {
    for (const blocker of result.debrief?.blockers ?? []) {
      counts.set(blocker, (counts.get(blocker) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      label: ASSESSMENT_BLOCKERS.find((blocker) => blocker.id === id)?.label ?? id,
      count,
    }))
    .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id));
}

function recommendationCandidates(run, program, results, blockers) {
  const candidates = [];
  const unfinished = results.find((result) => result.status !== "debriefed");
  if (unfinished) {
    const probe = frozenProbeForRun(run, unfinished.probeId);
    candidates.push({
      id: `resume:${unfinished.probeId}`,
      itemId: unfinished.itemId,
      lane: unfinished.lane,
      title: `Resume with ${probe?.title ?? "the next probe"}`,
      reason: "Finish the next short probe before expanding the diagnostic.",
    });
  }

  const weak = [...results]
    .filter((result) => result.objectiveAttempt)
    .sort((left, right) =>
      (rubricTotal(left.debrief) ?? -1) - (rubricTotal(right.debrief) ?? -1) ||
      left.probeId.localeCompare(right.probeId),
    );
  for (const result of weak) {
    const probe = frozenProbeForRun(run, result.probeId);
    const level = evidenceLevel(result);
    candidates.push({
      id: `repeat:${result.probeId}`,
      itemId: result.itemId,
      lane: result.lane,
      title: level === "self-assessed"
        ? `Reconstruct ${probe?.focus ?? probe?.title} cold`
        : `Repeat ${probe?.focus ?? probe?.title} from a blank editor`,
      reason: result.refresher
        ? "The refresher made this exposure assisted; use a delayed cold attempt for stronger evidence."
        : result.debrief?.note || "Use a close analogue and explain the invariant before implementation.",
    });
  }

  if (blockers[0]) {
    candidates.push({
      id: `blocker:${blockers[0].id}`,
      lane: program.track === "ios" ? "ios-self-assessed" : "algorithmic",
      title: `Target ${blockers[0].label.toLowerCase()}`,
      reason: `This blocker appeared in ${blockers[0].count} debrief${blockers[0].count === 1 ? "" : "s"}; rehearse the missing decision explicitly.`,
    });
  }

  if (program.track === "python") {
    candidates.push(
      {
        id: "python:fluency-retrieval",
        itemId: "python:10001",
        lane: "python-fluency",
        title: "Retrieve the Python moves after a delay",
        reason: "Rebuild the dictionary loop without the known answer; typing exposure alone is not solve evidence.",
      },
      {
        id: "python:verification-rehearsal",
        lane: "algorithmic",
        title: "Run a verification rehearsal",
        reason: "For one solved problem, state the invariant, trace a boundary case, and verify complexity aloud.",
      },
      {
        id: "python:hidden-transfer",
        lane: "algorithmic",
        title: "Try a hidden-pattern analogue",
        reason: "Transfer the selection cue to a nearby problem without seeing the pattern label.",
      },
    );
  } else if (program.track === "ios") {
    candidates.push(
      {
        id: "ios:teach-back",
        lane: "ios-self-assessed",
        title: "Give a two-minute Swift teach-back",
        reason: "Explain one ownership or concurrency tradeoff, then answer a counterexample without notes.",
      },
      {
        id: "ios:current-source",
        lane: "ios-self-assessed",
        title: "Confirm evolving APIs in current Apple documentation",
        reason: "Concurrency and framework details change; keep the conceptual evidence separate from source verification.",
      },
      {
        id: "ios:design-variant",
        lane: "ios-self-assessed",
        title: "Apply the concept to a small design variant",
        reason: "A fresh scenario provides better evidence than recognizing the saved example.",
      },
    );
  } else {
    candidates.push(
      {
        id: "cross-lane:python-retrieval",
        lane: "python",
        title: "Repeat the weakest Python checkpoint cold",
        reason: "Use a different same-family item after a delay; this local result is practice evidence, not a proctored score.",
      },
      {
        id: "cross-lane:swift-reconstruction",
        lane: "swift",
        title: "Reconstruct the Swift checkpoint from a blank editor",
        reason: "Stage-five reconstruction shows typing and recall, not an independently judged algorithmic solve.",
      },
      {
        id: "cross-lane:ios-scenario",
        lane: "ios",
        title: "Apply the iOS boundary to a fresh scenario",
        reason: "Concept recall is self-assessed; a novel scenario is the next useful check.",
      },
    );
  }
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  }).slice(0, 3);
}

function resolveRun(value, runId) {
  if (isRecord(value) && Array.isArray(value.runs)) {
    const workspace = normalizeAssessmentWorkspace(value);
    const id = cleanId(runId) || workspace.activeRunId;
    return workspace.runs.find((run) => run.id === id) ?? null;
  }
  return normalizeAssessmentRun(value);
}

function trustLabel(result) {
  if (result.currentEvidenceEligible === false) return "Historical form · not current-revision evidence";
  if (result.responseMode === "local-verified-solve") return "Local objective checks · not proctored or certified";
  if (result.responseMode === "swift-reconstruction") return "Stage-five reconstruction evidence · not an objective solve";
  return "Self-assessed concept recall · not independently validated";
}

export function deriveAssessmentReport(value, runId) {
  const run = resolveRun(value, runId);
  if (!run) return null;
  const program = assessmentProgram(run.programId);
  if (!program) return null;
  const probes = run.results.map((result) => {
    const probe = frozenProbeForRun(run, result.probeId);
    return {
      probeId: result.probeId,
      itemId: result.itemId,
      title: probe?.title ?? result.itemId,
      focus: probe?.focus ?? "",
      lane: result.lane,
      status: result.status,
      evidenceLevel: evidenceLevel(result),
      usedRefresher: Boolean(result.refresher),
      rubric: result.debrief?.rubric ?? emptyRubric(),
      rubricTotal: rubricTotal(result.debrief),
      blockers: result.debrief?.blockers ?? [],
      note: result.debrief?.note ?? "",
      objectiveAttempt: result.objectiveAttempt,
      responseMode: result.responseMode,
      itemRevision: result.itemRevision,
      judgeRevision: result.judgeRevision,
      currentEvidenceEligible: result.currentEvidenceEligible,
      trustLabel: trustLabel(result),
    };
  });
  const blockers = orderedBlockers(run.results);
  return {
    runId: run.id,
    programId: program.id,
    title: program.title,
    track: program.track,
    evidenceLabel: program.evidenceLabel,
    disclaimer: program.disclaimer,
    status: run.status,
    outcome: run.outcome,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    completion: {
      attempted: run.results.filter((result) => result.objectiveAttempt).length,
      debriefed: run.results.filter((result) => result.debrief).length,
      total: run.results.length,
    },
    lanes: {
      pythonFluency: laneSummary(run.results, "python-fluency"),
      algorithmic: laneSummary(run.results, "algorithmic"),
      ios: laneSummary(run.results, "ios-self-assessed"),
      python: laneSummary(run.results, "python"),
      swift: laneSummary(run.results, "swift"),
      crossLaneIos: laneSummary(run.results, "ios"),
    },
    sections: run.form.map((entry, index) => {
      const result = run.results[index];
      return {
        sectionId: entry.sectionId,
        skillId: entry.skillId,
        skillLabel: entry.skillLabelSnapshot,
        lane: entry.lane,
        responseMode: entry.responseMode,
        itemId: entry.itemId,
        title: entry.titleSnapshot,
        status: result.status,
        evidenceLevel: evidenceLevel(result),
        trustLabel: trustLabel(result),
        currentEvidenceEligible: result.currentEvidenceEligible,
      };
    }),
    probes,
    blockers,
    recommendations: recommendationCandidates(run, program, run.results, blockers),
  };
}

export function buildAssessmentStudyPlanSeed(value, options = {}) {
  const report = value?.probes && value?.recommendations
    ? value
    : deriveAssessmentReport(value, options.runId);
  if (!report) return null;
  if (!report.completion || report.completion.debriefed < 1) return null;
  const program = assessmentProgram(report.programId);
  if (!program) return null;
  const ranked = [...report.probes].sort((left, right) => {
    const leftRank = left.status !== "debriefed" ? -2 : left.usedRefresher ? -1 : left.rubricTotal ?? -1;
    const rightRank = right.status !== "debriefed" ? -2 : right.usedRefresher ? -1 : right.rubricTotal ?? -1;
    return leftRank - rightRank || left.probeId.localeCompare(right.probeId);
  });
  const itemIds = [...new Set(ranked.map(({ itemId }) => itemId))];
  const title = cleanText(options.title, 80, `${program.shortTitle} follow-up`);
  const description = `Follow up on ${program.shortTitle.toLowerCase()} evidence with delayed retrieval and close variants.`;
  const modules = program.track === "python"
    ? [
        {
          id: "python-fluency",
          title: "Python fluency retrieval",
          outcome: "Produce interview-relevant Python without answer exposure.",
          itemIds: itemIds.filter((itemId) => itemId === "python:10001"),
          patterns: ["Python Fluency"],
        },
        {
          id: "algorithmic-transfer",
          title: "Algorithmic transfer",
          outcome: "Select, implement, explain, and verify solutions from a blank editor.",
          itemIds: itemIds.filter((itemId) => itemId !== "python:10001"),
          patterns: [],
        },
      ]
    : program.track === "ios" ? [
        {
          id: "ios-reconstruction",
          title: "Swift & iOS reconstruction",
          outcome: "Explain and apply the concepts to fresh scenarios without notes.",
          itemIds,
          patterns: [],
        },
      ] : [
        {
          id: "python-reentry",
          title: "Python cold retrieval",
          outcome: "Produce and locally verify Python without answer exposure.",
          itemIds: ranked.filter(({ lane }) => lane === "python").map(({ itemId }) => itemId),
          patterns: ["Python Fluency", "Core Patterns"],
        },
        {
          id: "swift-reconstruction",
          title: "Swift reconstruction",
          outcome: "Reconstruct stage-five Swift solutions from a blank editor.",
          itemIds: ranked.filter(({ lane }) => lane === "swift").map(({ itemId }) => itemId),
          patterns: [],
        },
        {
          id: "ios-boundaries",
          title: "iOS boundary scenarios",
          outcome: "Apply Swift and iOS concepts to fresh design variants.",
          itemIds: ranked.filter(({ lane }) => lane === "ios").map(({ itemId }) => itemId),
          patterns: [],
        },
      ];
  return {
    sourceAssessmentRunId: report.runId,
    rationale: report.recommendations.map(({ title: recommendation }) => recommendation).join(" · "),
    collection: {
      title,
      description,
      outcome: program.track === "python"
        ? "Stronger independent Python fluency and algorithmic evidence"
        : program.track === "ios"
          ? "Clearer self-assessed Swift and iOS explanations"
          : "Stronger local Python evidence with clearer Swift and iOS reconstruction",
      source: "custom",
      itemIds,
      modules,
    },
    plan: {
      title,
      description,
      paceMinutes: program.track === "ios" ? 15 : 30,
      blocksPerWeek: 3,
      status: "active",
    },
  };
}
