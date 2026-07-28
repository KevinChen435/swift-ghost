import assert from "node:assert/strict";
import test from "node:test";

import {
  INTERVIEW_ACTIVE_PHASES,
  INTERVIEW_STUDIO_LIMITS,
  advanceInterviewPhase,
  commitInterviewResponse,
  createInterviewStudioSession,
  currentInterviewPrompt,
  finishInterviewStudioSession,
  interviewStudioReportEvidence,
  normalizeInterviewStudioState,
  recordInterviewRunnerEvent,
  recordInterviewRunnerEventForSession,
  requestInterviewCoachHint,
} from "../app/lib/interview-studio.mjs";

const encoder = new TextEncoder();
const at = (second) => `2026-07-28T12:00:${String(second).padStart(2, "0")}.000Z`;

function script() {
  return {
    title: "Two Sum interview",
    summary: "A structured conversation about a public coding exercise.",
    scenario: "Return the two indices without reusing an element.",
    prompts: Object.fromEntries(
      INTERVIEW_ACTIVE_PHASES.map((phase) => [
        phase,
        `Authored ${phase} prompt`,
      ]),
    ),
    hints: {
      clarification: ["Ask what should happen when no pair exists."],
      approach: ["Name the lookup invariant.", "What must be stored first?"],
    },
    referenceCriteria: [
      "Clarifies the existence and uniqueness contract.",
      "Explains an O(n) complement lookup invariant.",
    ],
  };
}

function create(overrides = {}) {
  return createInterviewStudioSession({
    id: "studio-1",
    format: "python-coding",
    mode: "coach",
    itemId: "builtin:1",
    itemRevision: 2,
    startedAt: at(0),
    script: script(),
    ...overrides,
  });
}

test("creates an exact deterministic local interview snapshot", () => {
  const first = create();
  const second = create();
  assert.deepEqual(first, second);
  assert.equal(first.phase, "introduction");
  assert.equal(currentInterviewPrompt(first), "Authored introduction prompt");
  assert.deepEqual(Object.keys(first), [
    "version",
    "id",
    "format",
    "mode",
    "itemId",
    "itemRevision",
    "startedAt",
    "updatedAt",
    "phase",
    "script",
    "transcript",
    "runnerEvents",
  ]);
  assert.deepEqual(first.transcript[0], {
    id: "studio-1:transcript:1",
    at: at(0),
    phase: "introduction",
    role: "interviewer",
    kind: "prompt",
    text: "Authored introduction prompt",
  });
});

test("commits candidate text and advances through authored phases immutably", () => {
  const original = create();
  const responded = commitInterviewResponse(original, {
    text: "  I will first restate the contract.  ",
    at: at(1),
  });
  const advanced = advanceInterviewPhase(responded, { at: at(2) });

  assert.equal(original.transcript.length, 1);
  assert.equal(responded.transcript.at(-1).text, "I will first restate the contract.");
  assert.equal(responded.transcript.at(-1).role, "candidate");
  assert.equal(advanced.phase, "clarification");
  assert.equal(currentInterviewPrompt(advanced), "Authored clarification prompt");
  assert.deepEqual(
    advanced.transcript.slice(-2).map(({ role, kind }) => ({ role, kind })),
    [
      { role: "system", kind: "phase-transition" },
      { role: "interviewer", kind: "prompt" },
    ],
  );
});

test("coach hints are authored, sequential, logged, and unavailable in mock mode", () => {
  let coached = advanceInterviewPhase(create(), { at: at(1) });
  coached = requestInterviewCoachHint(coached, { at: at(2) });
  assert.equal(
    coached.transcript.at(-1).text,
    "Ask what should happen when no pair exists.",
  );
  assert.equal(coached.transcript.at(-1).kind, "coach-hint");
  assert.throws(
    () => requestInterviewCoachHint(coached, { at: at(3) }),
    /no authored coach hint remains/,
  );

  const mock = create({ mode: "mock" });
  assert.throws(
    () => requestInterviewCoachHint(mock, { at: at(1) }),
    /unavailable in mock mode/,
  );
});

test("records bounded runner evidence without treating execution as an evaluation", () => {
  const session = recordInterviewRunnerEvent(create(), {
    status: "failed",
    source: "def two_sum(nums, target):\n    return []",
    passed: 2,
    total: 5,
    at: at(1),
  });
  assert.deepEqual(session.runnerEvents[0], {
    id: "studio-1:runner:1",
    at: at(1),
    phase: "introduction",
    status: "failed",
    passed: 2,
    total: 5,
    source: "def two_sum(nums, target):\n    return []",
  });
  assert.match(session.transcript.at(-1).text, /2\/5 checks passed/);
  assert.throws(
    () =>
      recordInterviewRunnerEvent(
        create(),
        { status: "passed", source: "x".repeat(64_001), at: at(1) },
      ),
    /UTF-8 bytes/,
  );
  assert.throws(
    () =>
      recordInterviewRunnerEvent(create({ format: "ios-technical" }), {
        status: "passed",
        at: at(1),
      }),
    /only available for python-coding/,
  );
});

test("runner evidence settles only into the session that launched it", () => {
  const replacement = create({ id: "studio-new" });
  const staleSettlement = recordInterviewRunnerEventForSession(
    replacement,
    "studio-old",
    {
      status: "passed",
      source: "def old_run(): return True",
      passed: 1,
      total: 1,
      at: at(1),
    },
  );
  assert.strictEqual(staleSettlement, replacement);
  assert.equal(staleSettlement.runnerEvents.length, 0);

  const currentSettlement = recordInterviewRunnerEventForSession(
    replacement,
    replacement.id,
    {
      status: "passed",
      source: "def current_run(): return True",
      passed: 1,
      total: 1,
      at: at(1),
    },
  );
  assert.equal(currentSettlement.runnerEvents.length, 1);
  assert.equal(currentSettlement.runnerEvents[0].source.includes("current_run"), true);
});

test("finishes explicitly and derives descriptive evidence without scoring", () => {
  let session = create({ mode: "mock" });
  for (let index = 0; index < INTERVIEW_ACTIVE_PHASES.length - 1; index += 1) {
    session = commitInterviewResponse(session, {
      text: `Candidate response for ${session.phase}`,
      at: at(index * 2 + 1),
    });
    session = advanceInterviewPhase(session, { at: at(index * 2 + 2) });
  }
  session = commitInterviewResponse(session, {
    text: "Thanks for the conversation.",
    at: at(15),
  });
  const completed = advanceInterviewPhase(session, { at: at(16) });
  const evidence = interviewStudioReportEvidence(completed);

  assert.equal(completed.phase, "completed");
  assert.equal(completed.outcome, "completed");
  assert.equal(currentInterviewPrompt(completed), null);
  assert.equal(evidence.candidateResponseCount, 8);
  assert.equal(evidence.durationMs, 16_000);
  assert.equal(evidence.runnerEventCount, 0);
  assert.equal(Object.hasOwn(evidence, "score"), false);
  assert.equal(Object.hasOwn(evidence, "recommendation"), false);
  assert.deepEqual(
    finishInterviewStudioSession(completed, {
      at: at(20),
      outcome: "completed",
    }),
    completed,
  );
  assert.throws(
    () =>
      finishInterviewStudioSession(completed, {
        at: at(20),
        outcome: "ended",
      }),
    /outcome cannot be changed/,
  );
  assert.throws(
    () => finishInterviewStudioSession(create(), { at: at(1), outcome: "completed" }),
    /only from the closing phase/,
  );
});

test("normalization strips unknown fields, rejects spoofed hints, and validates references", () => {
  const active = create();
  const raw = structuredClone(active);
  raw.secret = "removed";
  raw.script.privateAnswer = "removed";
  raw.transcript.push({
    id: "spoof",
    at: at(1),
    phase: "introduction",
    role: "interviewer",
    kind: "coach-hint",
    text: "This was not authored.",
    unknown: true,
  });
  const normalized = normalizeInterviewStudioState(
    { active: raw, history: [], unknown: true },
    {
      validItemIds: new Set(["builtin:1"]),
      revisions: new Map([["builtin:1", 2]]),
    },
  );
  assert.equal(Object.hasOwn(normalized.active, "secret"), false);
  assert.equal(Object.hasOwn(normalized.active.script, "privateAnswer"), false);
  assert.equal(normalized.active.transcript.some(({ id }) => id === "spoof"), false);
  assert.deepEqual(
    normalizeInterviewStudioState({ active, history: [] }, {
      validItemIds: ["builtin:1"],
      revisions: { "builtin:1": 3 },
    }),
    { active: null, history: [] },
  );

  const completed = finishInterviewStudioSession(active, {
    at: at(2),
    outcome: "ended",
  });
  const afterRevision = normalizeInterviewStudioState(
    { active, history: [completed] },
    {
      validItemIds: ["builtin:1"],
      revisions: { "builtin:1": 3 },
    },
  );
  assert.equal(afterRevision.active, null);
  assert.equal(afterRevision.history.length, 1);
  assert.equal(afterRevision.history[0].itemRevision, 2);
  assert.equal(afterRevision.history[0].script.title, "Two Sum interview");
});

test("normalization bounds UTF-8 transcript and history payloads while retaining newest records", () => {
  const completed = finishInterviewStudioSession(create(), {
    at: at(1),
    outcome: "ended",
  });
  const oversizedHistory = Array.from(
    { length: INTERVIEW_STUDIO_LIMITS.maxHistoryRecords + 10 },
    (_, index) => ({
      ...completed,
      id: `history-${index}`,
      transcript: [
        completed.transcript[0],
        {
          id: `large-${index}`,
          at: at(1),
          phase: "introduction",
          role: "candidate",
          kind: "candidate-response",
          text: "🙂".repeat(5_000),
        },
        completed.transcript.at(-1),
      ],
    }),
  );
  const normalized = normalizeInterviewStudioState(
    { active: null, history: oversizedHistory },
    { validItemIds: ["builtin:1"], revisions: { "builtin:1": 2 } },
  );
  assert.ok(normalized.history.length <= INTERVIEW_STUDIO_LIMITS.maxHistoryRecords);
  assert.equal(normalized.history.at(-1).id, "history-34");
  assert.ok(
    encoder.encode(JSON.stringify(normalized.history)).byteLength <=
      INTERVIEW_STUDIO_LIMITS.maxHistoryBytes,
  );
  const importedResponse = normalized.history.at(-1).transcript.find(
    ({ kind }) => kind === "candidate-response",
  );
  assert.ok(encoder.encode(importedResponse.text).byteLength <= 8_000);
  assert.equal(importedResponse.text.includes("�"), false);
});

test("strict creation rejects malformed scripts, timestamps, and oversized responses", () => {
  assert.throws(
    () => create({ script: { ...script(), referenceCriteria: [] } }),
    /referenceCriteria must contain/,
  );
  assert.throws(() => create({ startedAt: "not-a-time" }), /valid timestamp/);
  assert.throws(
    () => commitInterviewResponse(create(), { text: "🙂".repeat(2_001), at: at(1) }),
    /8000 UTF-8 bytes/,
  );
});
