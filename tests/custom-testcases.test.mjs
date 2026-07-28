import assert from "node:assert/strict";
import test from "node:test";

import {
  CUSTOM_TESTCASE_LIMITS,
  addCustomTestcase,
  buildCustomTestcaseExecution,
  createCustomTestcaseCollection,
  deleteCustomTestcase,
  deriveCustomTestcaseSchema,
  duplicateCustomTestcase,
  migrateLegacyCustomTestcases,
  normalizeCustomTestcaseCollection,
  parseCustomTestcaseField,
  selectCustomTestcase,
  updateCustomTestcase,
  updateCustomTestcaseField,
} from "../app/lib/custom-testcases.mjs";

function schema(overrides = {}) {
  return deriveCustomTestcaseSchema({
    itemId: "linked-cycle",
    itemRevision: 4,
    judgeRevision: 7,
    parameters: [{ name: "values" }, { name: "target" }],
    argCodecs: ["linkedList", "json"],
    visibleSampleArgs: [[[1, 2, 3], 2]],
    ...overrides,
  });
}

test("derives a deterministic public-only schema from visible inputs", () => {
  const secretSample = {
    id: "hidden-judge-id",
    visibility: "hidden",
    expected: 99,
    comparator: "unordered",
    name: "values",
  };
  const first = deriveCustomTestcaseSchema({
    itemId: "two-sum",
    itemRevision: 2,
    judgeRevision: 9,
    parameters: [secretSample, { name: "target", expected: "secret" }],
    argCodecs: ["json", "json"],
    visibleSampleArgs: [[[{ b: 2, a: 1 }], 3]],
    expected: "must not copy",
    comparator: "must not copy",
    visibility: "must not copy",
    hiddenIds: ["h1"],
  });
  const second = deriveCustomTestcaseSchema({
    itemId: "two-sum",
    itemRevision: 2,
    judgeRevision: 9,
    parameters: [{ name: "values" }, { name: "target" }],
    argCodecs: ["json", "json"],
    visibleSampleArgs: [[[{ a: 1, b: 2 }], 3]],
  });

  assert.deepEqual(first, second);
  assert.equal(first.starterCases[0].fields[0].text, '[{"a":1,"b":2}]');
  const document = JSON.stringify(first);
  for (const secret of [
    "hidden-judge-id",
    "expected",
    "comparator",
    "visibility",
    "hiddenIds",
    "secret",
  ])
    assert.equal(document.includes(secret), false, secret);
  assert.deepEqual(Object.keys(first), [
    "version",
    "itemId",
    "itemRevision",
    "judgeRevision",
    "parameters",
    "starterCases",
  ]);
});

test("creates stable structured cases and safe codec-shaped blank fields", () => {
  const emptySchema = deriveCustomTestcaseSchema({
    itemId: "empty",
    itemRevision: 1,
    judgeRevision: 1,
    parameters: ["head", "root", "cycle", "value"],
    argCodecs: ["linkedList", "binaryTree", "cyclicLinkedList", "json"],
    visibleSampleArgs: [],
  });
  const collection = createCustomTestcaseCollection(emptySchema);
  assert.deepEqual(collection.cases, [
    {
      id: "case-1",
      name: "Case 1",
      mode: "structured",
      fields: [
        { parameterId: "arg-1", text: "[]" },
        { parameterId: "arg-2", text: "[]" },
        { parameterId: "arg-3", text: '{"pos":-1,"values":[]}' },
        { parameterId: "arg-4", text: "[]" },
      ],
    },
  ]);
  assert.equal(collection.selectedCaseId, "case-1");
  assert.equal(collection.nextOrdinal, 2);
});

test("CRUD is immutable, keeps stable IDs, and advances selection predictably", () => {
  const publicSchema = schema();
  const initial = createCustomTestcaseCollection(publicSchema);
  const snapshot = structuredClone(initial);
  const added = addCustomTestcase(initial, publicSchema, {
    name: "Edge case",
    afterCaseId: "case-1",
  });
  const edited = updateCustomTestcaseField(
    added,
    publicSchema,
    "case-2",
    "arg-2",
    "42",
  );
  const duplicated = duplicateCustomTestcase(edited, "case-2");
  const selected = selectCustomTestcase(duplicated, "case-1");
  const removed = deleteCustomTestcase(selected, "case-1");

  assert.deepEqual(initial, snapshot);
  assert.deepEqual(added.cases.map(({ id }) => id), ["case-1", "case-2"]);
  assert.equal(edited.cases[1].fields[1].text, "42");
  assert.equal(added.cases[1].fields[1].text, "[]");
  assert.equal(duplicated.cases[2].id, "case-3");
  assert.equal(duplicated.cases[2].name, "Edge case copy");
  assert.notEqual(duplicated.cases[2].fields, edited.cases[1].fields);
  assert.equal(removed.selectedCaseId, "case-2");
  assert.deepEqual(removed.cases.map(({ id }) => id), ["case-2", "case-3"]);

  const addedAgain = addCustomTestcase(removed, publicSchema);
  assert.equal(addedAgain.selectedCaseId, "case-4");
  assert.throws(() => selectCustomTestcase(initial, "case-999"), /unknown/);
  assert.throws(() => deleteCustomTestcase(initial, "case-1"), /at least one/);
});

test("supports lossless structured/raw mode transitions", () => {
  const publicSchema = schema();
  const initial = createCustomTestcaseCollection(publicSchema);
  const raw = '{"args":[[8,9],9]}';
  const rawCollection = updateCustomTestcase(
    initial,
    publicSchema,
    "case-1",
    { mode: "raw", raw, name: "Scratch" },
  );
  assert.deepEqual(rawCollection.cases[0], {
    id: "case-1",
    name: "Scratch",
    mode: "raw",
    raw,
  });
  const structured = updateCustomTestcase(
    rawCollection,
    publicSchema,
    "case-1",
    { mode: "structured" },
  );
  assert.equal(structured.cases[0].id, "case-1");
  assert.deepEqual(
    structured.cases[0].fields.map(({ text }) => text),
    ["[]", "[]"],
  );
  assert.throws(
    () =>
      updateCustomTestcaseField(
        rawCollection,
        publicSchema,
        "case-1",
        "arg-1",
        "[]",
      ),
    /does not have structured fields/,
  );
});

test("enforces case, UTF-8 name, field, raw, and aggregate item bounds without truncation", () => {
  const publicSchema = schema();
  let collection = createCustomTestcaseCollection(publicSchema);
  for (let index = 2; index <= CUSTOM_TESTCASE_LIMITS.maxCases; index += 1)
    collection = addCustomTestcase(collection, publicSchema);
  assert.equal(collection.cases.length, 12);
  assert.throws(() => addCustomTestcase(collection, publicSchema), /at most 12/);

  const emoji = "😀";
  const tooLongName = emoji.repeat(
    Math.floor(CUSTOM_TESTCASE_LIMITS.maxCaseNameBytes / 4) + 1,
  );
  assert.throws(
    () =>
      updateCustomTestcase(collection, publicSchema, "case-1", {
        name: tooLongName,
      }),
    /UTF-8 bytes/,
  );
  assert.equal(collection.cases[0].name, "Case 1");

  const tooLargeField = "x".repeat(CUSTOM_TESTCASE_LIMITS.maxFieldBytes + 1);
  assert.throws(
    () =>
      updateCustomTestcaseField(
        collection,
        publicSchema,
        "case-1",
        "arg-1",
        tooLargeField,
      ),
    /UTF-8 bytes/,
  );
  const tooLargeRaw = "x".repeat(CUSTOM_TESTCASE_LIMITS.maxRawBytes + 1);
  assert.throws(
    () =>
      updateCustomTestcase(collection, publicSchema, "case-1", {
        mode: "raw",
        raw: tooLargeRaw,
      }),
    /UTF-8 bytes/,
  );

  let aggregate = createCustomTestcaseCollection(publicSchema);
  const nearField = JSON.stringify("x".repeat(11_000));
  aggregate = updateCustomTestcaseField(
    aggregate,
    publicSchema,
    "case-1",
    "arg-1",
    nearField,
  );
  aggregate = updateCustomTestcaseField(
    aggregate,
    publicSchema,
    "case-1",
    "arg-2",
    nearField,
  );
  aggregate = duplicateCustomTestcase(aggregate, "case-1");
  assert.throws(
    () => duplicateCustomTestcase(aggregate, "case-2"),
    /item exceeds/,
  );

  assert.throws(
    () =>
      deriveCustomTestcaseSchema({
        itemId: "oversized-schema",
        itemRevision: 1,
        judgeRevision: 1,
        parameters: ["value"],
        argCodecs: ["json"],
        visibleSampleArgs: Array.from({ length: 12 }, () => [
          "x".repeat(5_000),
        ]),
      }),
    /item exceeds/,
  );
});

test("parses every supported codec and rejects invalid shapes", () => {
  assert.deepEqual(parseCustomTestcaseField('{"z":1,"a":2}', "json"), {
    a: 2,
    z: 1,
  });
  assert.deepEqual(parseCustomTestcaseField("[1,2]", "linkedList"), [1, 2]);
  assert.deepEqual(parseCustomTestcaseField("[1,null,2]", "binaryTree"), [
    1,
    null,
    2,
  ]);
  assert.deepEqual(
    parseCustomTestcaseField(
      '{"ignored":"private","pos":1,"values":[3,4]}',
      "cyclicLinkedList",
    ),
    { values: [3, 4], pos: 1 },
  );
  assert.throws(() => parseCustomTestcaseField("{", "json"), /valid JSON/);
  assert.throws(
    () => parseCustomTestcaseField("{}", "linkedList"),
    /JSON array/,
  );
  assert.throws(
    () => parseCustomTestcaseField("{}", "binaryTree"),
    /level-order/,
  );
  assert.throws(
    () =>
      parseCustomTestcaseField(
        '{"values":[1,2],"pos":2}',
        "cyclicLinkedList",
      ),
    /valid node index/,
  );
  assert.throws(
    () => parseCustomTestcaseField("[]", "yaml"),
    /unsupported codec/,
  );
});

test("builds Python execution only from caller-supplied current judge settings", () => {
  const publicSchema = schema();
  let collection = createCustomTestcaseCollection(publicSchema);
  collection = addCustomTestcase(collection, publicSchema, { name: "Second" });
  collection = updateCustomTestcaseField(
    collection,
    publicSchema,
    "case-2",
    "arg-1",
    "[8,9]",
  );
  collection = updateCustomTestcaseField(
    collection,
    publicSchema,
    "case-2",
    "arg-2",
    "9",
  );
  collection.cases[0].expected = "injected";
  collection.cases[0].comparator = "injected";
  collection.cases[0].visibility = "hidden";

  const execution = buildCustomTestcaseExecution(collection, publicSchema, {
    revision: 88,
    entrypoint: {
      kind: "method",
      className: "CurrentSolution",
      name: "currentMethod",
      hiddenName: "doNotCopy",
    },
    argCodecs: ["linkedList", "json"],
    outputCodec: "binaryTree",
    caseIds: ["case-2", "case-1"],
    expected: "doNotCopy",
    comparator: "doNotCopy",
  });

  assert.equal(execution.revision, 88);
  assert.deepEqual(execution.entrypoint, {
    kind: "method",
    className: "CurrentSolution",
    name: "currentMethod",
  });
  assert.deepEqual(execution.cases.map(({ name }) => name), ["Case 1", "Second"]);
  assert.deepEqual(execution.cases[1].args, [[8, 9], 9]);
  assert.deepEqual(execution.cases[1].argCodecs, ["linkedList", "json"]);
  assert.equal(execution.cases[1].outputCodec, "binaryTree");
  const document = JSON.stringify(execution);
  for (const secret of [
    "expected",
    "comparator",
    "visibility",
    "injected",
    "hiddenName",
    "doNotCopy",
  ])
    assert.equal(document.includes(secret), false, secret);

  const selected = buildCustomTestcaseExecution(collection, publicSchema, {
    revision: 89,
    entrypoint: { kind: "function", name: "solve" },
    argCodecs: ["linkedList", "json"],
    outputCodec: "json",
  });
  assert.deepEqual(selected.cases.map(({ name }) => name), ["Second"]);
  assert.throws(
    () =>
      buildCustomTestcaseExecution(collection, publicSchema, {
        revision: 1,
        entrypoint: { kind: "function", name: "solve();steal" },
        argCodecs: ["linkedList", "json"],
      }),
    /Python identifier/,
  );
});

test("raw cases must become valid codec-shaped arguments before execution", () => {
  const publicSchema = schema();
  const initial = createCustomTestcaseCollection(publicSchema);
  const malformed = updateCustomTestcase(
    initial,
    publicSchema,
    "case-1",
    { mode: "raw", raw: "unfinished [" },
  );
  const options = {
    revision: 1,
    entrypoint: { kind: "function", name: "solve" },
    argCodecs: ["linkedList", "json"],
    outputCodec: "json",
  };
  assert.throws(
    () => buildCustomTestcaseExecution(malformed, publicSchema, options),
    /valid JSON before it can run/,
  );
  const valid = updateCustomTestcase(malformed, publicSchema, "case-1", {
    raw: '{"args":[[4,5],5],"expected":"ignore me"}',
  });
  assert.deepEqual(
    buildCustomTestcaseExecution(valid, publicSchema, options).cases[0].args,
    [[4, 5], 5],
  );
});

test("migrates legacy args/cases JSON and preserves malformed content exactly as raw", () => {
  const publicSchema = schema();
  const one = migrateLegacyCustomTestcases(
    publicSchema,
    '{"args":[[2,3],3],"expected":"do not migrate"}',
  );
  assert.equal(one.cases[0].mode, "structured");
  assert.deepEqual(one.cases[0].fields.map(({ text }) => text), ["[2,3]", "3"]);
  assert.equal(JSON.stringify(one).includes("expected"), false);

  const many = migrateLegacyCustomTestcases(
    publicSchema,
    '{"cases":[{"name":"One","args":[[1],1]},{"name":"Two","args":[[2],2]}]}',
  );
  assert.deepEqual(many.cases.map(({ id, name }) => ({ id, name })), [
    { id: "case-1", name: "One" },
    { id: "case-2", name: "Two" },
  ]);

  for (const malformed of [
    '{"args":[',
    '{"wrong":"shape"}',
    '{"cases":[{"args":[[1]]}]}',
    JSON.stringify({
      name: "not used",
      cases: [
        {
          name: "😀".repeat(
            Math.floor(CUSTOM_TESTCASE_LIMITS.maxCaseNameBytes / 4) + 1,
          ),
          args: [[1], 1],
        },
      ],
    }),
  ]) {
    const migrated = migrateLegacyCustomTestcases(publicSchema, malformed);
    assert.deepEqual(migrated.cases[0], {
      id: "case-1",
      name: "Case 1",
      mode: "raw",
      raw: malformed,
    });
  }
});

test("normalization is deterministic, canonical, and strips unknown persisted data", () => {
  const publicSchema = schema();
  const raw = {
    version: 999,
    itemId: "attacker-item",
    itemRevision: 999,
    judgeRevision: 999,
    expected: "secret",
    cases: [
      {
        id: "bad-id",
        name: "First",
        mode: "structured",
        expected: "secret",
        fields: [
          { parameterId: "arg-2", text: "2", expected: "secret" },
          { parameterId: "arg-1", text: "[1,2]", visibility: "hidden" },
        ],
      },
      {
        id: "case-1",
        name: "Second",
        mode: "raw",
        raw: '{"args":[[3],3]}',
        comparator: "secret",
      },
    ],
    selectedCaseId: "missing",
    nextOrdinal: 9999,
  };
  const normalized = normalizeCustomTestcaseCollection(publicSchema, raw);
  const again = normalizeCustomTestcaseCollection(publicSchema, normalized);
  assert.deepEqual(normalized, again);
  assert.deepEqual(normalized.cases.map(({ id }) => id), ["case-1", "case-2"]);
  assert.equal(normalized.selectedCaseId, "case-1");
  assert.equal(normalized.itemId, "linked-cycle");
  assert.equal(normalized.itemRevision, 4);
  assert.equal(normalized.judgeRevision, 7);
  const document = JSON.stringify(normalized);
  for (const secret of ["expected", "visibility", "comparator", "secret"])
    assert.equal(document.includes(secret), false, secret);
});
