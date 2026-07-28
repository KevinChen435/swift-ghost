export const INTERVIEW_STUDIO_FORMATS = ["python-coding", "ios-technical"];
export const INTERVIEW_STUDIO_MODES = ["mock", "coach"];
export const INTERVIEW_PHASES = [
  "introduction",
  "clarification",
  "approach",
  "implementation",
  "testing",
  "complexity",
  "follow-up",
  "closing",
  "completed",
];
export const INTERVIEW_ACTIVE_PHASES = INTERVIEW_PHASES.slice(0, -1);
export const INTERVIEW_TRANSCRIPT_ROLES = [
  "interviewer",
  "candidate",
  "system",
];
export const INTERVIEW_TRANSCRIPT_KINDS = [
  "prompt",
  "candidate-response",
  "phase-transition",
  "runner-evidence",
  "coach-hint",
  "session-ended",
];
export const INTERVIEW_RUNNER_EVENT_STATUSES = ["passed", "failed", "error"];
export const INTERVIEW_STUDIO_OUTCOMES = ["completed", "ended", "expired"];

export const INTERVIEW_STUDIO_LIMITS = Object.freeze({
  maxHistoryRecords: 25,
  maxHistoryBytes: 1_500_000,
  maxTranscriptEntries: 160,
  maxTranscriptBytes: 192_000,
  maxTranscriptEntryBytes: 10_000,
  maxRunnerEvents: 80,
  maxRunnerSourceBytes: 64_000,
  maxRunnerSourcesBytes: 256_000,
  maxScriptBytes: 64_000,
  maxResponseBytes: 8_000,
  maxPromptBytes: 8_000,
  maxHintBytes: 2_000,
  maxCriteriaBytes: 2_000,
  maxCriteriaCount: 24,
  maxHintsPerPhase: 4,
  maxItemIdBytes: 200,
  maxIdBytes: 120,
  maxItemRevision: 1_000_000,
});

const FORMAT_SET = new Set(INTERVIEW_STUDIO_FORMATS);
const MODE_SET = new Set(INTERVIEW_STUDIO_MODES);
const PHASE_SET = new Set(INTERVIEW_PHASES);
const ACTIVE_PHASE_SET = new Set(INTERVIEW_ACTIVE_PHASES);
const STATUS_SET = new Set(INTERVIEW_RUNNER_EVENT_STATUSES);
const OUTCOME_SET = new Set(INTERVIEW_STUDIO_OUTCOMES);
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: false });

const KIND_ROLES = Object.freeze({
  prompt: "interviewer",
  "candidate-response": "candidate",
  "phase-transition": "system",
  "runner-evidence": "system",
  "coach-hint": "interviewer",
  "session-ended": "system",
});

function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function byteLength(value) {
  return encoder.encode(value).byteLength;
}

function truncateUtf8(value, maxBytes) {
  if (maxBytes <= 0 || !value) return "";
  const bytes = encoder.encode(value);
  if (bytes.byteLength <= maxBytes) return value;
  return decoder.decode(bytes.slice(0, maxBytes));
}

function boundedText(value, label, maxBytes, options = {}) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = options.trim ? value.trim() : value;
  if (options.required && normalized.length === 0)
    throw new Error(`${label} must not be empty`);
  if (byteLength(normalized) > maxBytes)
    throw new Error(`${label} exceeds ${maxBytes} UTF-8 bytes`);
  return normalized;
}

function normalizedText(value, maxBytes, options = {}) {
  if (typeof value !== "string") return "";
  const normalized = options.trim ? value.trim() : value;
  return truncateUtf8(normalized, maxBytes);
}

function canonicalTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new Error(`${label} must be a valid timestamp`);
  return new Date(value).toISOString();
}

function maybeTimestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function positiveRevision(value) {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > INTERVIEW_STUDIO_LIMITS.maxItemRevision
  )
    throw new Error(
      `itemRevision must be an integer from 1 to ${INTERVIEW_STUDIO_LIMITS.maxItemRevision}`,
    );
  return value;
}

function assertAllowed(value, allowed, label) {
  if (!allowed.has(value)) throw new Error(`unsupported ${label}: ${String(value)}`);
  return value;
}

function strictScriptSnapshot(input) {
  if (!object(input)) throw new Error("interview script must be an object");
  const promptsInput = object(input.prompts) ? input.prompts : null;
  if (!promptsInput) throw new Error("interview script prompts must be an object");
  const hintsInput = input.hints === undefined ? {} : input.hints;
  if (!object(hintsInput)) throw new Error("interview script hints must be an object");

  const prompts = {};
  const hints = {};
  for (const phase of INTERVIEW_ACTIVE_PHASES) {
    prompts[phase] = boundedText(
      promptsInput[phase],
      `interview ${phase} prompt`,
      INTERVIEW_STUDIO_LIMITS.maxPromptBytes,
      { required: true, trim: true },
    );
    const authoredHints = hintsInput[phase];
    if (authoredHints === undefined) continue;
    if (!Array.isArray(authoredHints))
      throw new Error(`interview ${phase} hints must be an array`);
    if (authoredHints.length > INTERVIEW_STUDIO_LIMITS.maxHintsPerPhase)
      throw new Error(
        `interview ${phase} hints may contain at most ${INTERVIEW_STUDIO_LIMITS.maxHintsPerPhase} entries`,
      );
    const normalizedHints = authoredHints.map((hint, index) =>
      boundedText(
        hint,
        `interview ${phase} hint ${index + 1}`,
        INTERVIEW_STUDIO_LIMITS.maxHintBytes,
        { required: true, trim: true },
      ),
    );
    if (normalizedHints.length) hints[phase] = normalizedHints;
  }

  if (!Array.isArray(input.referenceCriteria))
    throw new Error("interview referenceCriteria must be an array");
  if (
    input.referenceCriteria.length < 1 ||
    input.referenceCriteria.length > INTERVIEW_STUDIO_LIMITS.maxCriteriaCount
  )
    throw new Error(
      `interview referenceCriteria must contain 1 to ${INTERVIEW_STUDIO_LIMITS.maxCriteriaCount} entries`,
    );
  const script = {
    version: 1,
    title: boundedText(input.title, "interview script title", 500, {
      required: true,
      trim: true,
    }),
    summary: boundedText(input.summary, "interview script summary", 4_000, {
      required: true,
      trim: true,
    }),
    scenario: boundedText(input.scenario, "interview script scenario", 8_000, {
      required: true,
      trim: true,
    }),
    prompts,
    hints,
    referenceCriteria: input.referenceCriteria.map((criterion, index) =>
      boundedText(
        criterion,
        `interview reference criterion ${index + 1}`,
        INTERVIEW_STUDIO_LIMITS.maxCriteriaBytes,
        { required: true, trim: true },
      ),
    ),
  };
  if (byteLength(JSON.stringify(script)) > INTERVIEW_STUDIO_LIMITS.maxScriptBytes)
    throw new Error(
      `interview script exceeds ${INTERVIEW_STUDIO_LIMITS.maxScriptBytes} UTF-8 bytes`,
    );
  return script;
}

function normalizeScriptSnapshot(raw) {
  if (!object(raw) || !object(raw.prompts)) return null;
  const prompts = {};
  const hints = {};
  for (const phase of INTERVIEW_ACTIVE_PHASES) {
    const prompt = normalizedText(
      raw.prompts[phase],
      INTERVIEW_STUDIO_LIMITS.maxPromptBytes,
      { trim: true },
    );
    if (!prompt) return null;
    prompts[phase] = prompt;
    const rawHints = object(raw.hints) && Array.isArray(raw.hints[phase])
      ? raw.hints[phase]
      : [];
    const authoredHints = rawHints
      .slice(0, INTERVIEW_STUDIO_LIMITS.maxHintsPerPhase)
      .flatMap((value) => {
        const hint = normalizedText(
          value,
          INTERVIEW_STUDIO_LIMITS.maxHintBytes,
          { trim: true },
        );
        return hint ? [hint] : [];
      });
    if (authoredHints.length) hints[phase] = authoredHints;
  }
  const referenceCriteria = Array.isArray(raw.referenceCriteria)
    ? raw.referenceCriteria
        .slice(0, INTERVIEW_STUDIO_LIMITS.maxCriteriaCount)
        .flatMap((value) => {
          const criterion = normalizedText(
            value,
            INTERVIEW_STUDIO_LIMITS.maxCriteriaBytes,
            { trim: true },
          );
          return criterion ? [criterion] : [];
        })
    : [];
  const title = normalizedText(raw.title, 500, { trim: true });
  const summary = normalizedText(raw.summary, 4_000, { trim: true });
  const scenario = normalizedText(raw.scenario, 8_000, { trim: true });
  if (!title || !summary || !scenario || !referenceCriteria.length) return null;
  const script = {
    version: 1,
    title,
    summary,
    scenario,
    prompts,
    hints,
    referenceCriteria,
  };
  if (byteLength(JSON.stringify(script)) > INTERVIEW_STUDIO_LIMITS.maxScriptBytes)
    return null;
  return script;
}

function entryId(sessionId, transcriptLength) {
  return `${sessionId}:transcript:${transcriptLength + 1}`;
}

function runnerId(sessionId, eventLength) {
  return `${sessionId}:runner:${eventLength + 1}`;
}

function authoredEntry(session, input) {
  return {
    id: entryId(session.id, session.transcript.length),
    at: input.at,
    phase: input.phase,
    role: KIND_ROLES[input.kind],
    kind: input.kind,
    text: input.text,
  };
}

function transcriptBytes(transcript) {
  return byteLength(JSON.stringify(transcript));
}

function runnerSummary(event) {
  return event.passed === undefined
    ? `Runner ${event.status}.`
    : `Runner ${event.status}: ${event.passed}/${event.total} checks passed.`;
}

function endedSummary(outcome) {
  return outcome === "completed"
    ? "Interview completed."
    : outcome === "expired"
      ? "Interview time expired."
      : "Interview ended early.";
}

function appendTranscript(session, entries) {
  const transcript = [...session.transcript, ...entries];
  if (transcript.length > INTERVIEW_STUDIO_LIMITS.maxTranscriptEntries)
    throw new Error("interview transcript is full");
  if (transcriptBytes(transcript) > INTERVIEW_STUDIO_LIMITS.maxTranscriptBytes)
    throw new Error("interview transcript byte budget is full");
  return transcript;
}

function operationTimestamp(session, value) {
  const at = canonicalTimestamp(value, "interview event timestamp");
  if (Date.parse(at) < Date.parse(session.updatedAt))
    throw new Error("interview event timestamp cannot precede the prior event");
  return at;
}

function normalizeTranscript(
  raw,
  startedAt,
  completedAt,
  script,
  mode,
  runnerEvents,
  outcome,
) {
  if (!Array.isArray(raw)) return [];
  const min = Date.parse(startedAt);
  const max = completedAt ? Date.parse(completedAt) : Number.POSITIVE_INFINITY;
  let previous = min;
  const usedHints = Object.fromEntries(
    INTERVIEW_ACTIVE_PHASES.map((phase) => [phase, 0]),
  );
  let runnerIndex = 0;
  const entries = raw.flatMap((value) => {
    if (!object(value)) return [];
    const kind = INTERVIEW_TRANSCRIPT_KINDS.includes(value.kind)
      ? value.kind
      : null;
    const phase = PHASE_SET.has(value.phase) ? value.phase : null;
    const at = maybeTimestamp(value.at);
    const id = normalizedText(value.id, INTERVIEW_STUDIO_LIMITS.maxIdBytes, {
      trim: true,
    });
    const textLimit =
      kind === "candidate-response"
        ? INTERVIEW_STUDIO_LIMITS.maxResponseBytes
        : kind === "prompt"
          ? INTERVIEW_STUDIO_LIMITS.maxPromptBytes
          : kind === "coach-hint"
            ? INTERVIEW_STUDIO_LIMITS.maxHintBytes
            : 2_000;
    const text = normalizedText(value.text, textLimit);
    if (
      !kind ||
      !phase ||
      !at ||
      !id ||
      !text ||
      value.role !== KIND_ROLES[kind] ||
      Date.parse(at) < previous ||
      Date.parse(at) < min ||
      Date.parse(at) > max
    )
      return [];
    if (kind === "prompt" && (!ACTIVE_PHASE_SET.has(phase) || text !== script.prompts[phase]))
      return [];
    if (kind === "candidate-response" && !ACTIVE_PHASE_SET.has(phase)) return [];
    if (kind === "coach-hint") {
      if (mode !== "coach" || !ACTIVE_PHASE_SET.has(phase)) return [];
      const hintIndex = usedHints[phase];
      if (text !== (script.hints[phase] ?? [])[hintIndex]) return [];
      usedHints[phase] += 1;
    }
    if (
      kind === "phase-transition" &&
      (!ACTIVE_PHASE_SET.has(phase) ||
        phase === "introduction" ||
        text !== `Moved to ${phase}.`)
    )
      return [];
    if (kind === "runner-evidence") {
      const event = runnerEvents[runnerIndex];
      if (
        !event ||
        event.phase !== phase ||
        event.at !== at ||
        text !== runnerSummary(event)
      )
        return [];
      runnerIndex += 1;
    }
    if (
      kind === "session-ended" &&
      (phase !== "completed" || !outcome || text !== endedSummary(outcome))
    )
      return [];
    previous = Date.parse(at);
    return [{ id, at, phase, role: KIND_ROLES[kind], kind, text }];
  });

  const newest = entries.slice(-INTERVIEW_STUDIO_LIMITS.maxTranscriptEntries);
  const retained = [];
  let used = 2;
  for (let index = newest.length - 1; index >= 0; index -= 1) {
    const entryBytes = byteLength(JSON.stringify(newest[index])) + 1;
    if (used + entryBytes > INTERVIEW_STUDIO_LIMITS.maxTranscriptBytes) continue;
    retained.unshift(newest[index]);
    used += entryBytes;
  }
  return retained;
}

function normalizeRunnerEvents(raw, startedAt, completedAt) {
  if (!Array.isArray(raw)) return [];
  const min = Date.parse(startedAt);
  const max = completedAt ? Date.parse(completedAt) : Number.POSITIVE_INFINITY;
  let sourceBytes = 0;
  return raw
    .slice(-INTERVIEW_STUDIO_LIMITS.maxRunnerEvents)
    .flatMap((value) => {
      if (!object(value) || !STATUS_SET.has(value.status)) return [];
      const id = normalizedText(value.id, INTERVIEW_STUDIO_LIMITS.maxIdBytes, {
        trim: true,
      });
      const at = maybeTimestamp(value.at);
      const phase = PHASE_SET.has(value.phase) ? value.phase : null;
      if (
        !id ||
        !at ||
        !phase ||
        Date.parse(at) < min ||
        Date.parse(at) > max
      )
        return [];
      const total = Number.isInteger(value.total)
        ? Math.max(0, Math.min(1_000, value.total))
        : undefined;
      const passed =
        total !== undefined && Number.isInteger(value.passed)
          ? Math.max(0, Math.min(total, value.passed))
          : undefined;
      let source = normalizedText(
        value.source,
        INTERVIEW_STUDIO_LIMITS.maxRunnerSourceBytes,
      );
      const bytes = byteLength(source);
      if (sourceBytes + bytes > INTERVIEW_STUDIO_LIMITS.maxRunnerSourcesBytes)
        source = "";
      else sourceBytes += bytes;
      return [
        {
          id,
          at,
          phase,
          status: value.status,
          ...(passed !== undefined && total !== undefined ? { passed, total } : {}),
          ...(source ? { source } : {}),
        },
      ];
    });
}

function revisionFor(revisions, itemId) {
  if (revisions instanceof Map) return revisions.get(itemId);
  if (object(revisions)) return revisions[itemId];
  return undefined;
}

function referenceIsValid(itemId, itemRevision, options) {
  if (options?.validItemIds) {
    const validIds = new Set(options.validItemIds);
    if (!validIds.has(itemId)) return false;
  }
  if (options?.revisions) {
    const expected = revisionFor(options.revisions, itemId);
    if (!Number.isInteger(expected) || expected !== itemRevision) return false;
  }
  return true;
}

function normalizeSession(raw, options = {}) {
  if (!object(raw)) return null;
  const id = normalizedText(raw.id, INTERVIEW_STUDIO_LIMITS.maxIdBytes, {
    trim: true,
  });
  const itemId = normalizedText(
    raw.itemId,
    INTERVIEW_STUDIO_LIMITS.maxItemIdBytes,
    { trim: true },
  );
  const startedAt = maybeTimestamp(raw.startedAt);
  const updatedAt = maybeTimestamp(raw.updatedAt);
  const completedAt = raw.completedAt === undefined
    ? undefined
    : maybeTimestamp(raw.completedAt);
  const format = FORMAT_SET.has(raw.format) ? raw.format : null;
  const mode = MODE_SET.has(raw.mode) ? raw.mode : null;
  const phase = PHASE_SET.has(raw.phase) ? raw.phase : null;
  const script = normalizeScriptSnapshot(raw.script);
  let itemRevision;
  try {
    itemRevision = positiveRevision(raw.itemRevision);
  } catch {
    return null;
  }
  if (
    !id ||
    !itemId ||
    !startedAt ||
    !updatedAt ||
    !format ||
    !mode ||
    !phase ||
    !script ||
    Date.parse(updatedAt) < Date.parse(startedAt) ||
    !referenceIsValid(itemId, itemRevision, options)
  )
    return null;

  const completed = phase === "completed";
  const outcome = OUTCOME_SET.has(raw.outcome) ? raw.outcome : undefined;
  if (
    completed !== Boolean(completedAt && outcome) ||
    (completedAt && Date.parse(completedAt) < Date.parse(startedAt)) ||
    (completedAt && Date.parse(updatedAt) !== Date.parse(completedAt))
  )
    return null;

  const runnerEvents = normalizeRunnerEvents(raw.runnerEvents, startedAt, completedAt);
  const transcript = normalizeTranscript(
    raw.transcript,
    startedAt,
    completedAt,
    script,
    mode,
    runnerEvents,
    outcome,
  );
  const canonicalTranscript = transcript.map((entry, index) => ({
    ...entry,
    id: `${id}:transcript:${index + 1}`,
  }));
  const canonicalRunnerEvents = runnerEvents.map((event, index) => ({
    ...event,
    id: `${id}:runner:${index + 1}`,
  }));
  return {
    version: 1,
    id,
    format,
    mode,
    itemId,
    itemRevision,
    startedAt,
    updatedAt,
    phase,
    script,
    transcript: canonicalTranscript,
    runnerEvents: canonicalRunnerEvents,
    ...(completed ? { completedAt, outcome } : {}),
  };
}

function activeSession(session) {
  const normalized = normalizeSession(session);
  if (!normalized || normalized.phase === "completed")
    throw new Error("interview session is not active");
  return normalized;
}

export function createInterviewStudioSession(input) {
  if (!object(input)) throw new Error("interview session input must be an object");
  const id = boundedText(
    input.id,
    "interview session id",
    INTERVIEW_STUDIO_LIMITS.maxIdBytes,
    { required: true, trim: true },
  );
  const itemId = boundedText(
    input.itemId,
    "interview itemId",
    INTERVIEW_STUDIO_LIMITS.maxItemIdBytes,
    { required: true, trim: true },
  );
  const format = assertAllowed(input.format, FORMAT_SET, "interview format");
  const mode = assertAllowed(input.mode, MODE_SET, "interview mode");
  const itemRevision = positiveRevision(input.itemRevision);
  const startedAt = canonicalTimestamp(input.startedAt, "interview startedAt");
  const script = strictScriptSnapshot(input.script);
  const seed = {
    version: 1,
    id,
    format,
    mode,
    itemId,
    itemRevision,
    startedAt,
    updatedAt: startedAt,
    phase: "introduction",
    script,
    transcript: [],
    runnerEvents: [],
  };
  return {
    ...seed,
    transcript: [
      authoredEntry(seed, {
        at: startedAt,
        phase: "introduction",
        kind: "prompt",
        text: script.prompts.introduction,
      }),
    ],
  };
}

export function currentInterviewPrompt(session) {
  const normalized = normalizeSession(session);
  if (!normalized || normalized.phase === "completed") return null;
  return normalized.script.prompts[normalized.phase] ?? null;
}

export function commitInterviewResponse(sessionInput, input) {
  if (!object(input)) throw new Error("interview response input must be an object");
  const session = activeSession(sessionInput);
  const at = operationTimestamp(session, input.at);
  const text = boundedText(
    input.text,
    "candidate response",
    INTERVIEW_STUDIO_LIMITS.maxResponseBytes,
    { required: true, trim: true },
  );
  const entry = authoredEntry(session, {
    at,
    phase: session.phase,
    kind: "candidate-response",
    text,
  });
  return {
    ...session,
    updatedAt: at,
    transcript: appendTranscript(session, [entry]),
  };
}

export function advanceInterviewPhase(sessionInput, input) {
  if (!object(input)) throw new Error("interview phase input must be an object");
  const session = activeSession(sessionInput);
  const at = operationTimestamp(session, input.at);
  const index = INTERVIEW_ACTIVE_PHASES.indexOf(session.phase);
  if (index === INTERVIEW_ACTIVE_PHASES.length - 1)
    return finishInterviewStudioSession(session, { at, outcome: "completed" });
  const nextPhase = INTERVIEW_ACTIVE_PHASES[index + 1];
  const transition = authoredEntry(session, {
    at,
    phase: nextPhase,
    kind: "phase-transition",
    text: `Moved to ${nextPhase}.`,
  });
  const promptSession = {
    ...session,
    transcript: [...session.transcript, transition],
  };
  const prompt = authoredEntry(promptSession, {
    at,
    phase: nextPhase,
    kind: "prompt",
    text: session.script.prompts[nextPhase],
  });
  return {
    ...session,
    updatedAt: at,
    phase: nextPhase,
    transcript: appendTranscript(session, [transition, prompt]),
  };
}

export function recordInterviewRunnerEvent(sessionInput, input) {
  if (!object(input)) throw new Error("runner evidence input must be an object");
  const session = activeSession(sessionInput);
  if (session.format !== "python-coding")
    throw new Error("runner evidence is only available for python-coding interviews");
  const status = assertAllowed(input.status, STATUS_SET, "runner status");
  const at = operationTimestamp(session, input.at);
  const source = input.source === undefined
    ? undefined
    : boundedText(
        input.source,
        "runner source snapshot",
        INTERVIEW_STUDIO_LIMITS.maxRunnerSourceBytes,
      );
  let passed;
  let total;
  if (input.passed !== undefined || input.total !== undefined) {
    if (
      !Number.isInteger(input.total) ||
      input.total < 0 ||
      input.total > 1_000 ||
      !Number.isInteger(input.passed) ||
      input.passed < 0 ||
      input.passed > input.total
    )
      throw new Error("runner passed/total must be coherent integers from 0 to 1000");
    passed = input.passed;
    total = input.total;
  }
  if (session.runnerEvents.length >= INTERVIEW_STUDIO_LIMITS.maxRunnerEvents)
    throw new Error("interview runner evidence is full");
  const existingSourceBytes = session.runnerEvents.reduce(
    (sum, event) => sum + byteLength(event.source ?? ""),
    0,
  );
  if (
    source &&
    existingSourceBytes + byteLength(source) >
      INTERVIEW_STUDIO_LIMITS.maxRunnerSourcesBytes
  )
    throw new Error("interview runner source byte budget is full");
  const event = {
    id: runnerId(session.id, session.runnerEvents.length),
    at,
    phase: session.phase,
    status,
    ...(passed !== undefined && total !== undefined ? { passed, total } : {}),
    ...(source ? { source } : {}),
  };
  const summary = runnerSummary(event);
  const transcriptEntry = authoredEntry(session, {
    at,
    phase: session.phase,
    kind: "runner-evidence",
    text: summary,
  });
  return {
    ...session,
    updatedAt: at,
    runnerEvents: [...session.runnerEvents, event],
    transcript: appendTranscript(session, [transcriptEntry]),
  };
}

export function recordInterviewRunnerEventForSession(
  sessionInput,
  expectedSessionId,
  input,
) {
  if (
    !object(sessionInput) ||
    typeof expectedSessionId !== "string" ||
    sessionInput.id !== expectedSessionId
  ) {
    return sessionInput;
  }
  return recordInterviewRunnerEvent(sessionInput, input);
}

export function requestInterviewCoachHint(sessionInput, input) {
  if (!object(input)) throw new Error("coach hint input must be an object");
  const session = activeSession(sessionInput);
  if (session.mode !== "coach")
    throw new Error("coach hints are unavailable in mock mode");
  const at = operationTimestamp(session, input.at);
  const authoredHints = session.script.hints[session.phase] ?? [];
  const used = session.transcript.filter(
    (entry) => entry.phase === session.phase && entry.kind === "coach-hint",
  ).length;
  const hint = authoredHints[used];
  if (!hint) throw new Error("no authored coach hint remains for this phase");
  const entry = authoredEntry(session, {
    at,
    phase: session.phase,
    kind: "coach-hint",
    text: hint,
  });
  return {
    ...session,
    updatedAt: at,
    transcript: appendTranscript(session, [entry]),
  };
}

export function finishInterviewStudioSession(sessionInput, input) {
  if (!object(input)) throw new Error("finish interview input must be an object");
  const outcome = assertAllowed(input.outcome, OUTCOME_SET, "interview outcome");
  const normalized = normalizeSession(sessionInput);
  if (normalized?.phase === "completed") {
    if (normalized.outcome !== outcome)
      throw new Error("completed interview outcome cannot be changed");
    return normalized;
  }
  const session = activeSession(sessionInput);
  if (outcome === "completed" && session.phase !== "closing")
    throw new Error("an interview can be completed only from the closing phase");
  const at = operationTimestamp(session, input.at);
  const entry = authoredEntry(session, {
    at,
    phase: "completed",
    kind: "session-ended",
    text: endedSummary(outcome),
  });
  return {
    ...session,
    updatedAt: at,
    phase: "completed",
    transcript: appendTranscript(session, [entry]),
    completedAt: at,
    outcome,
  };
}

export function interviewStudioReportEvidence(sessionInput) {
  const session = normalizeSession(sessionInput);
  if (!session) throw new Error("interview session is invalid");
  const candidateEntries = session.transcript.filter(
    (entry) => entry.kind === "candidate-response",
  );
  const respondedPhases = new Set(candidateEntries.map((entry) => entry.phase));
  const phasesWithCandidateResponse = INTERVIEW_PHASES.filter((phase) =>
    respondedPhases.has(phase),
  );
  const runnerStatusCounts = { passed: 0, failed: 0, error: 0 };
  for (const event of session.runnerEvents) runnerStatusCounts[event.status] += 1;
  const endedAt = session.completedAt ?? session.updatedAt;
  return {
    sessionId: session.id,
    format: session.format,
    mode: session.mode,
    itemId: session.itemId,
    itemRevision: session.itemRevision,
    startedAt: session.startedAt,
    ...(session.completedAt ? { completedAt: session.completedAt } : {}),
    ...(session.outcome ? { outcome: session.outcome } : {}),
    durationMs: Math.max(0, Date.parse(endedAt) - Date.parse(session.startedAt)),
    candidateResponseCount: candidateEntries.length,
    phasesWithCandidateResponse,
    hintCount: session.transcript.filter((entry) => entry.kind === "coach-hint")
      .length,
    runnerEventCount: session.runnerEvents.length,
    runnerStatusCounts,
  };
}

export const deriveInterviewStudioReportEvidence = interviewStudioReportEvidence;

export function normalizeInterviewStudioState(raw, options = {}) {
  const source = object(raw) ? raw : {};
  const activeCandidate = normalizeSession(source.active, options);
  let active = activeCandidate?.phase === "completed" ? null : activeCandidate;
  const candidates = Array.isArray(source.history)
    ? source.history.slice(-INTERVIEW_STUDIO_LIMITS.maxHistoryRecords)
    : [];
  const normalizedHistory = candidates.flatMap((candidate) => {
    // Completed reports are self-contained snapshots. Keep them replayable when
    // a catalog item is later revised or removed; only the active session must
    // still match the current catalog contract.
    const session = normalizeSession(candidate);
    return session?.phase === "completed" ? [session] : [];
  });
  const newestById = new Map();
  for (const record of normalizedHistory) newestById.set(record.id, record);
  const deduplicatedHistory = normalizedHistory.filter(
    (record) => newestById.get(record.id) === record,
  );
  const history = [];
  let used = 2;
  for (let index = deduplicatedHistory.length - 1; index >= 0; index -= 1) {
    const record = deduplicatedHistory[index];
    const bytes = byteLength(JSON.stringify(record)) + 1;
    if (used + bytes > INTERVIEW_STUDIO_LIMITS.maxHistoryBytes) continue;
    history.unshift(record);
    used += bytes;
  }
  if (active && history.some((record) => record.id === active.id)) active = null;
  return { active, history };
}
