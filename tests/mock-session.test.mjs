import assert from "node:assert/strict";
import test from "node:test";

import {
  MOCK_CHECKPOINT_KINDS,
  MOCK_MISTAKE_TAGS,
  MOCK_NOTEBOOK_FIELDS,
  MOCK_REFLECTION_FIELDS,
  MOCK_RUBRIC_DIMENSIONS,
  MOCK_SESSION_LIMITS,
  createMockDebrief,
  createMockNotebook,
  createMockProblemWorkspace,
  isMockDebriefComplete,
  mockDebriefScore,
  mockNotebookBytes,
  normalizeMockCheckpoints,
  normalizeMockDebrief,
  normalizeMockNotebook,
  normalizeMockProblemWorkspace,
  normalizeMockProblemWorkspaces,
  recordFirstMockCheckpoint,
  recordMockCheckpoint,
  updateMockDebrief,
  updateMockNotebook,
  updateMockWorkspaceNotebook,
  updateMockWorkspaceSource,
} from "../app/lib/mock-session.mjs";

const bytes = (value) => new TextEncoder().encode(value).byteLength;

function workspace(overrides = {}) {
  return createMockProblemWorkspace({
    itemId: "python:two-sum",
    itemRevision: 4,
    source: "def two_sum(nums, target):\n    pass\n",
    ...overrides,
  });
}

test("declares only the neutral notebook, checkpoint, rubric, and reflection allowlists", () => {
  assert.deepEqual(MOCK_NOTEBOOK_FIELDS, [
    "clarifications",
    "approach",
    "invariant",
    "complexity",
    "edgeCases",
    "finalExplanation",
  ]);
  assert.deepEqual(MOCK_CHECKPOINT_KINDS, [
    "promptAcknowledged",
    "approachReady",
    "codingStarted",
    "firstTest",
    "codeCompleted",
    "explanationReady",
  ]);
  assert.deepEqual(MOCK_RUBRIC_DIMENSIONS, [
    "recognition",
    "reasoning",
    "implementation",
    "verification",
    "communication",
  ]);
  assert.deepEqual(MOCK_REFLECTION_FIELDS, [
    "algorithmic",
    "languageFluency",
    "communication",
    "nextStep",
  ]);
  assert.equal(new Set(MOCK_MISTAKE_TAGS).size, MOCK_MISTAKE_TAGS.length);
  assert.equal(Object.isFrozen(MOCK_NOTEBOOK_FIELDS), true);
});

test("notebooks have an exact empty shape and strip unknown or non-authored values", () => {
  const notebook = normalizeMockNotebook({
    clarifications: "Is input sorted?",
    approach: "Use a map.",
    invariant: 42,
    hiddenExpected: "secret answer",
    patternHint: "hashing",
  });
  assert.deepEqual(Object.keys(notebook), MOCK_NOTEBOOK_FIELDS);
  assert.deepEqual(notebook, {
    clarifications: "Is input sorted?",
    approach: "Use a map.",
    invariant: "",
    complexity: "",
    edgeCases: "",
    finalExplanation: "",
  });
  const document = JSON.stringify(notebook);
  assert.equal(document.includes("secret answer"), false);
  assert.equal(document.includes("patternHint"), false);
  assert.deepEqual(createMockNotebook(), normalizeMockNotebook(null));
});

test("strict notebook writes enforce 2 KB fields and the 8 KB aggregate immutably", () => {
  const initial = createMockNotebook({ approach: "one pass" });
  const snapshot = structuredClone(initial);
  const updated = updateMockNotebook(initial, "invariant", "seen values are indexed");
  assert.deepEqual(initial, snapshot);
  assert.equal(updated.invariant, "seen values are indexed");
  assert.notEqual(updated, initial);

  assert.throws(
    () =>
      updateMockNotebook(
        initial,
        "approach",
        "x".repeat(MOCK_SESSION_LIMITS.maxNotebookFieldBytes + 1),
      ),
    /UTF-8 bytes/,
  );
  assert.throws(
    () => updateMockNotebook(initial, "privateHint", "no"),
    /unsupported/,
  );

  const full = Object.fromEntries(
    MOCK_NOTEBOOK_FIELDS.map((field) => [
      field,
      "x".repeat(MOCK_SESSION_LIMITS.maxNotebookFieldBytes),
    ]),
  );
  assert.throws(() => createMockNotebook(full), /aggregate UTF-8 bytes/);
});

test("notebook normalization truncates multibyte text on safe boundaries and aggregate order", () => {
  const emoji = "😀";
  const normalized = normalizeMockNotebook({
    clarifications: emoji.repeat(700),
    approach: emoji.repeat(700),
    invariant: emoji.repeat(700),
    complexity: emoji.repeat(700),
    edgeCases: emoji.repeat(700),
    finalExplanation: emoji.repeat(700),
  });
  for (const field of MOCK_NOTEBOOK_FIELDS) {
    assert.ok(bytes(normalized[field]) <= MOCK_SESSION_LIMITS.maxNotebookFieldBytes);
    assert.equal(normalized[field].includes("�"), false);
  }
  assert.ok(mockNotebookBytes(normalized) <= MOCK_SESSION_LIMITS.maxNotebookBytes);
  assert.equal(bytes(normalized.clarifications), 2_048);
  assert.equal(bytes(normalized.complexity), 2_048);
  assert.equal(normalized.edgeCases, "");
  assert.equal(normalized.finalExplanation, "");
  assert.deepEqual(normalizeMockNotebook(normalized), normalized);
});

test("problem workspaces bound source, preserve identity, strip unknown keys, and update immutably", () => {
  const original = workspace({
    notebook: { approach: "Draft" },
    expected: "hidden output",
    judgeCases: ["hidden"],
  });
  const sourceUpdated = updateMockWorkspaceSource(original, "print('current')");
  const notesUpdated = updateMockWorkspaceNotebook(
    sourceUpdated,
    "edgeCases",
    "empty and duplicate values",
  );
  assert.equal(original.source.startsWith("def two_sum"), true);
  assert.equal(sourceUpdated.source, "print('current')");
  assert.equal(notesUpdated.notebook.edgeCases, "empty and duplicate values");
  assert.notEqual(notesUpdated.notebook, original.notebook);
  assert.deepEqual(Object.keys(original), [
    "version",
    "itemId",
    "itemRevision",
    "source",
    "notebook",
    "checkpoints",
  ]);
  assert.equal(JSON.stringify(original).includes("hidden output"), false);

  const tooLarge = "😀".repeat(
    Math.floor(MOCK_SESSION_LIMITS.maxSourceBytes / 4) + 1,
  );
  assert.throws(
    () => updateMockWorkspaceSource(original, tooLarge),
    /UTF-8 bytes/,
  );
  const normalized = normalizeMockProblemWorkspace({
    ...original,
    source: tooLarge,
    hiddenExpected: "never copy",
  });
  assert.equal(bytes(normalized.source), MOCK_SESSION_LIMITS.maxSourceBytes);
  assert.equal(normalized.source.includes("�"), false);
  assert.equal(JSON.stringify(normalized).includes("never copy"), false);
});

test("archived workspace lists require an exact distinct one-or-two problem payload", () => {
  const first = workspace();
  const second = workspace({ itemId: "python:max-depth", itemRevision: 2 });
  assert.deepEqual(
    normalizeMockProblemWorkspaces([first, second], {
      problemCount: 2,
      validItemIds: [first.itemId, second.itemId],
    }).map(({ itemId }) => itemId),
    [first.itemId, second.itemId],
  );
  assert.deepEqual(
    normalizeMockProblemWorkspaces([first], { problemCount: 2 }),
    [],
  );
  assert.deepEqual(
    normalizeMockProblemWorkspaces([first, first], { problemCount: 2 }),
    [],
  );
  assert.deepEqual(
    normalizeMockProblemWorkspaces([first, second], {
      problemCount: 2,
      validItemIds: [first.itemId],
    }),
    [],
  );
  assert.deepEqual(
    normalizeMockProblemWorkspaces([], { problemCount: 1 }),
    [],
  );
});

test("checkpoint normalization uses only six keys and retains a real zero", () => {
  const normalized = normalizeMockCheckpoints(
    {
      promptAcknowledged: 0,
      approachReady: 1_500,
      codingStarted: -1,
      firstTest: 20_001,
      codeCompleted: 4.5,
      verification: 2,
      hiddenJudgeStarted: 10,
    },
    20_000,
  );
  assert.deepEqual(normalized, {
    promptAcknowledged: 0,
    approachReady: 1_500,
  });
  assert.equal(Object.hasOwn(normalized, "promptAcknowledged"), true);
});

test("checkpoint recording is first-write-wins, clamps new events, and never mutates input", () => {
  const initial = { promptAcknowledged: 0, codingStarted: 400 };
  const snapshot = structuredClone(initial);
  const zeroPreserved = recordFirstMockCheckpoint(
    initial,
    "promptAcknowledged",
    999,
    5_000,
  );
  const codingPreserved = recordFirstMockCheckpoint(
    zeroPreserved,
    "codingStarted",
    800,
    5_000,
  );
  const clampedLow = recordFirstMockCheckpoint(
    codingPreserved,
    "firstTest",
    -50,
    5_000,
  );
  const clampedHigh = recordFirstMockCheckpoint(
    clampedLow,
    "codeCompleted",
    99_999,
    5_000,
  );
  assert.deepEqual(initial, snapshot);
  assert.equal(zeroPreserved.promptAcknowledged, 0);
  assert.equal(codingPreserved.codingStarted, 400);
  assert.equal(clampedLow.firstTest, 0);
  assert.equal(clampedHigh.codeCompleted, 5_000);
  assert.throws(
    () => recordFirstMockCheckpoint(initial, "verification", 1, 5_000),
    /unsupported/,
  );
  assert.throws(
    () => recordFirstMockCheckpoint(initial, "firstTest", Number.NaN, 5_000),
    /finite/,
  );
});

test("workspace checkpoint helper retains first values across normalized updates", () => {
  const initial = workspace();
  const started = recordMockCheckpoint(initial, "codingStarted", 0, 45 * 60_000);
  const repeated = recordMockCheckpoint(
    started,
    "codingStarted",
    5_000,
    45 * 60_000,
  );
  const tested = recordMockCheckpoint(
    repeated,
    "firstTest",
    7_500,
    45 * 60_000,
  );
  assert.deepEqual(initial.checkpoints, {});
  assert.deepEqual(tested.checkpoints, { codingStarted: 0, firstTest: 7_500 });
});

test("debrief normalization preserves missing versus zero and strips untrusted data", () => {
  const normalized = normalizeMockDebrief({
    scores: {
      recognition: 0,
      reasoning: 2,
      implementation: 3,
      verification: null,
      communication: 1,
      secretDimension: 2,
    },
    mistakeTags: [
      "boundary",
      "unknown-tag",
      "boundary",
      "syntax-fluency",
    ],
    algorithmic: "I changed approaches too late.",
    languageFluency: 44,
    communication: "I paused without orienting the interviewer.",
    nextStep: "Trace before submitting.",
    completedAt: "2026-07-28T12:00:00-07:00",
    expected: "hidden answer",
    coaching: "use a hash map",
  });
  assert.deepEqual(normalized.scores, {
    recognition: 0,
    reasoning: 2,
    implementation: null,
    verification: null,
    communication: 1,
  });
  assert.deepEqual(normalized.mistakeTags, ["syntax-fluency", "boundary"]);
  assert.equal(normalized.languageFluency, "");
  assert.equal(normalized.completedAt, "2026-07-28T19:00:00.000Z");
  assert.deepEqual(Object.keys(normalized), [
    "version",
    "scores",
    "mistakeTags",
    ...MOCK_REFLECTION_FIELDS,
    "completedAt",
  ]);
  const document = JSON.stringify(normalized);
  assert.equal(document.includes("hidden answer"), false);
  assert.equal(document.includes("use a hash map"), false);
  assert.deepEqual(normalizeMockDebrief(normalized), normalized);
});

test("debrief edits are bounded and immutable with allowlisted scores and tags", () => {
  const initial = createMockDebrief();
  const scoredZero = updateMockDebrief(initial, {
    scores: { recognition: 0 },
    mistakeTags: ["verification", "boundary"],
    algorithmic: "State the invariant first.",
  });
  assert.equal(initial.scores.recognition, null);
  assert.equal(scoredZero.scores.recognition, 0);
  assert.deepEqual(scoredZero.mistakeTags, ["boundary", "verification"]);
  assert.throws(
    () => updateMockDebrief(scoredZero, { scores: { recognition: 4 } }),
    /must be 0, 1, 2, or null/,
  );
  assert.throws(
    () => updateMockDebrief(scoredZero, { scores: { hiddenJudge: 2 } }),
    /unsupported mock rubric dimension/,
  );
  assert.throws(
    () => updateMockDebrief(scoredZero, { mistakeTags: ["secret-solution"] }),
    /unsupported mock mistake tag/,
  );
  assert.throws(
    () =>
      updateMockDebrief(scoredZero, {
        nextStep: "😀".repeat(
          Math.floor(MOCK_SESSION_LIMITS.maxReflectionFieldBytes / 4) + 1,
        ),
      }),
    /UTF-8 bytes/,
  );
  assert.throws(
    () => updateMockDebrief(scoredZero, { completedAt: "not-a-date" }),
    /valid ISO timestamp/,
  );
});

test("rubric totals distinguish unscored from zero and never trust imported totals", () => {
  let debrief = normalizeMockDebrief({
    total: 10,
    scores: { recognition: 0 },
  });
  assert.deepEqual(mockDebriefScore(debrief), {
    total: 0,
    scoredDimensions: 1,
    possible: 10,
    complete: false,
  });
  assert.equal(isMockDebriefComplete(debrief), false);

  debrief = updateMockDebrief(debrief, {
    scores: {
      reasoning: 1,
      implementation: 2,
      verification: 0,
      communication: 2,
    },
  });
  assert.deepEqual(mockDebriefScore(debrief), {
    total: 5,
    scoredDimensions: 5,
    possible: 10,
    complete: true,
  });
  assert.equal(isMockDebriefComplete(debrief), true);
});

test("normalizers are deterministic and do not mutate adversarial inputs", () => {
  const raw = {
    version: 999,
    itemId: "python:valid",
    itemRevision: 2,
    source: "print('mine')",
    notebook: {
      finalExplanation: "finish",
      approach: "start",
      expected: "private",
    },
    checkpoints: {
      explanationReady: 10,
      promptAcknowledged: 0,
      hiddenCase: 1,
    },
    expected: "private",
  };
  const snapshot = structuredClone(raw);
  const first = normalizeMockProblemWorkspace(raw, { maxElapsedMs: 20 });
  const second = normalizeMockProblemWorkspace(raw, { maxElapsedMs: 20 });
  assert.deepEqual(raw, snapshot);
  assert.deepEqual(first, second);
  assert.deepEqual(normalizeMockProblemWorkspace(first, { maxElapsedMs: 20 }), first);
  const document = JSON.stringify(first);
  assert.equal(document.includes("private"), false);
  assert.equal(document.includes("hiddenCase"), false);
  assert.deepEqual(Object.keys(first.notebook), MOCK_NOTEBOOK_FIELDS);
  assert.deepEqual(Object.keys(first.checkpoints), [
    "promptAcknowledged",
    "explanationReady",
  ]);
});
