import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

let bundledProductRuntime;

async function productRuntime() {
  if (!bundledProductRuntime) {
    bundledProductRuntime = build({
      entryPoints: [
        fileURLToPath(new URL("../app/lib/product.ts", import.meta.url)),
      ],
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      write: false,
      logLevel: "silent",
    }).then(({ outputFiles }) =>
      import(
        `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
      ),
    );
  }
  return bundledProductRuntime;
}

function typingAttempt(id, completedAt, lineErrors) {
  return {
    id,
    itemId: "python:1",
    itemRevision: 2,
    titleSnapshot: "Two Sum",
    language: "python",
    stage: 3,
    practiceKind: "typing",
    mode: "strict",
    startedAt: new Date(Date.parse(completedAt) - 60_000).toISOString(),
    completedAt,
    durationMs: 60_000,
    totalKeystrokes: 100,
    correctKeystrokes: 96,
    rejectedKeystrokes: 4,
    corrections: 4,
    peeks: 0,
    keyErrors: {},
    lineErrors,
    timeline: [],
    rawWpm: 20,
    wpm: 20,
    accuracy: 96,
    consistency: 100,
    outcome: "completed",
    qualification: "guided",
  };
}

function rawState(version, attempts, additions = {}) {
  return {
    version,
    attempts,
    settings: {},
    customItems: [],
    sessionHistory: [],
    ...additions,
  };
}

test("v34 migration derives a v35 Clinic case from repeated current-revision line errors", async () => {
  const { normalizeState } = await productRuntime();
  const normalized = normalizeState(
    rawState(34, [
      typingAttempt("clinic-a", "2026-07-28T12:00:00.000Z", { 7: 1 }),
      typingAttempt("clinic-b", "2026-07-29T12:00:00.000Z", { 7: 2 }),
    ]),
  );

  assert.equal(normalized.version, 35);
  assert.equal(normalized.fluencyClinic.version, 1);
  assert.equal(normalized.fluencyClinic.cases.length, 1);
  assert.equal(normalized.fluencyClinic.cases[0].id, "python:1:r2:line7");
  assert.deepEqual(normalized.fluencyClinic.cases[0].sourceAttemptIds, [
    "clinic-a",
    "clinic-b",
  ]);
});

test("v35 normalization preserves guided repair evidence", async () => {
  const { normalizeState } = await productRuntime();
  const source = typingAttempt(
    "clinic-source",
    "2026-07-29T12:00:00.000Z",
    { 7: 3 },
  );
  const normalized = normalizeState(
    rawState(35, [source], {
      fluencyClinic: {
        version: 1,
        revision: 1,
        updatedAt: "2026-07-29T12:01:00.000Z",
        cases: [
          {
            id: "forged-but-valid",
            itemId: "python:1",
            itemRevision: 2,
            titleSnapshot: "Two Sum",
            language: "python",
            line: 7,
            targetLineSnapshot: "            if complement in index_by_value:",
            contextSnapshot: [],
            sourceAttemptIds: [source.id],
            errorCount: 3,
            attemptCount: 1,
            detectedAt: source.completedAt,
            lastErrorAt: source.completedAt,
            createdAt: "2026-07-29T12:01:00.000Z",
            updatedAt: "2026-07-29T12:02:00.000Z",
            passes: [
              {
                id: "pass-visible",
                kind: "visible",
                startedAt: "2026-07-29T12:02:00.000Z",
                completedAt: "2026-07-29T12:03:00.000Z",
                durationMs: 60_000,
                corrections: 1,
                characters: 44,
              },
            ],
          },
        ],
      },
    }),
  );

  assert.equal(normalized.fluencyClinic.cases.length, 1);
  assert.equal(normalized.fluencyClinic.cases[0].id, "python:1:r2:line7");
  assert.equal(normalized.fluencyClinic.cases[0].passes[0].kind, "visible");
  assert.equal(
    normalized.fluencyClinic.cases[0].passes[0].assistance,
    "guided-line-repair",
  );
});

test("archived custom snippets do not auto-enroll new Clinic cases", async () => {
  const { normalizeState } = await productRuntime();
  const customItem = {
    itemId: "custom:archived-clinic",
    id: "custom:archived-clinic",
    slug: "archived-clinic",
    source: "custom",
    track: "interview",
    language: "python",
    contentRevision: 1,
    title: "Archived helper",
    difficulty: "Easy",
    pattern: "Python Fluency",
    code: "def helper(value):\n    return value",
    cue: "Return the value.",
    invariant: "Identity.",
    complexity: "O(1)",
    languageNote: "Simple return.",
    estimatedMinutes: 2,
    archivedAt: "2026-07-29T12:00:00.000Z",
  };
  const base = typingAttempt(
    "custom-errors",
    "2026-07-29T12:00:00.000Z",
    { 2: 4 },
  );
  const normalized = normalizeState(
    rawState(
      34,
      [
        {
          ...base,
          itemId: customItem.itemId,
          titleSnapshot: customItem.title,
        },
      ],
      { customItems: [customItem] },
    ),
  );
  assert.equal(normalized.fluencyClinic.cases.length, 0);
});
