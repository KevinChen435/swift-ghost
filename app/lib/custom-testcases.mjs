const CODECS = new Set([
  "json",
  "linkedList",
  "cyclicLinkedList",
  "binaryTree",
]);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CASE_ID = /^case-([1-9][0-9]*)$/;

export const CUSTOM_TESTCASE_LIMITS = Object.freeze({
  minCases: 1,
  maxCases: 12,
  maxArguments: 12,
  maxVisibleSamples: 12,
  maxItemIdBytes: 200,
  maxParameterNameBytes: 80,
  maxCaseNameBytes: 120,
  maxFieldBytes: 12_000,
  maxRawBytes: 24_000,
  maxItemBytes: 48_000,
  maxJsonDepth: 50,
  maxJsonNodes: 5_000,
});

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertBoundedString(value, label, maxBytes, { empty = false } = {}) {
  if (typeof value !== "string" || (!empty && value.length === 0))
    throw new Error(`${label} must be ${empty ? "a" : "a non-empty"} string`);
  if (byteLength(value) > maxBytes)
    throw new Error(`${label} exceeds ${maxBytes} UTF-8 bytes`);
  return value;
}

function positiveRevision(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > 1_000_000)
    throw new Error(`${label} must be an integer from 1 to 1000000`);
  return value;
}

function codec(value, label) {
  if (!CODECS.has(value)) throw new Error(`${label} uses an unsupported codec`);
  return value;
}

function inspectJson(value, label) {
  const work = [{ value, depth: 0 }];
  let nodes = 0;
  while (work.length) {
    const current = work.pop();
    nodes += 1;
    if (nodes > CUSTOM_TESTCASE_LIMITS.maxJsonNodes)
      throw new Error(`${label} contains too many JSON values`);
    if (current.depth > CUSTOM_TESTCASE_LIMITS.maxJsonDepth)
      throw new Error(`${label} is nested too deeply`);
    const item = current.value;
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "boolean"
    )
      continue;
    if (typeof item === "number") {
      if (!Number.isFinite(item))
        throw new Error(`${label} contains a non-finite number`);
      continue;
    }
    if (!object(item) && !Array.isArray(item))
      throw new Error(`${label} must contain only JSON values`);
    const prototype = Object.getPrototypeOf(item);
    if (
      prototype !== Array.prototype &&
      prototype !== Object.prototype &&
      prototype !== null
    )
      throw new Error(`${label} must contain only plain JSON values`);
    const children = Array.isArray(item)
      ? item
      : Object.keys(item).map((key) => item[key]);
    for (const child of children)
      work.push({ value: child, depth: current.depth + 1 });
  }
}

function canonicalizeJson(value, label) {
  inspectJson(value, label);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value))
    return value.map((child) => canonicalizeJson(child, label));
  const normalized = {};
  for (const key of Object.keys(value).sort())
    normalized[key] = canonicalizeJson(value[key], label);
  return normalized;
}

function jsonText(value, label) {
  const text = JSON.stringify(canonicalizeJson(value, label));
  if (text === undefined) throw new Error(`${label} is not JSON-serializable`);
  if (byteLength(text) > CUSTOM_TESTCASE_LIMITS.maxFieldBytes)
    throw new Error(
      `${label} exceeds ${CUSTOM_TESTCASE_LIMITS.maxFieldBytes} UTF-8 bytes`,
    );
  return text;
}

function defaultTextForCodec(value) {
  return value === "cyclicLinkedList" ? '{"pos":-1,"values":[]}' : "[]";
}

function parameterName(raw, index) {
  const candidate = typeof raw === "string" ? raw : raw?.name;
  const name = candidate === undefined ? `arg${index + 1}` : candidate;
  assertBoundedString(
    name,
    `parameter ${index + 1} name`,
    CUSTOM_TESTCASE_LIMITS.maxParameterNameBytes,
  );
  return name;
}

/**
 * Derive the complete client-visible testcase schema. Only explicitly public
 * parameter metadata, codecs, visible arguments, and revisions are copied.
 * Extra properties on any input object are deliberately ignored.
 */
export function deriveCustomTestcaseSchema(input) {
  if (!object(input)) throw new Error("schema input must be an object");
  const itemId = assertBoundedString(
    input.itemId,
    "itemId",
    CUSTOM_TESTCASE_LIMITS.maxItemIdBytes,
  );
  const itemRevision = positiveRevision(input.itemRevision, "itemRevision");
  const judgeRevision = positiveRevision(input.judgeRevision, "judgeRevision");
  if (!Array.isArray(input.parameters) || !Array.isArray(input.argCodecs))
    throw new Error("parameters and argCodecs must be arrays");
  if (
    input.parameters.length === 0 ||
    input.parameters.length > CUSTOM_TESTCASE_LIMITS.maxArguments ||
    input.parameters.length !== input.argCodecs.length
  )
    throw new Error(
      `schema must define 1-${CUSTOM_TESTCASE_LIMITS.maxArguments} matching parameters and codecs`,
    );
  const parameters = input.parameters.map((raw, index) => ({
    id: `arg-${index + 1}`,
    name: parameterName(raw, index),
    codec: codec(input.argCodecs[index], `parameter ${index + 1}`),
  }));
  const samples = input.visibleSampleArgs ?? [];
  if (
    !Array.isArray(samples) ||
    samples.length > CUSTOM_TESTCASE_LIMITS.maxVisibleSamples
  )
    throw new Error(
      `visibleSampleArgs must contain at most ${CUSTOM_TESTCASE_LIMITS.maxVisibleSamples} samples`,
    );
  const starterCases = samples.map((args, caseIndex) => {
    if (!Array.isArray(args) || args.length !== parameters.length)
      throw new Error(
        `visible sample ${caseIndex + 1} must contain ${parameters.length} arguments`,
      );
    return {
      name: `Case ${caseIndex + 1}`,
      fields: parameters.map((parameter, argumentIndex) => ({
        parameterId: parameter.id,
        text: jsonText(
          args[argumentIndex],
          `visible sample ${caseIndex + 1} argument ${argumentIndex + 1}`,
        ),
      })),
    };
  });
  if (starterCases.length === 0) {
    starterCases.push({
      name: "Case 1",
      fields: parameters.map((parameter) => ({
        parameterId: parameter.id,
        text: defaultTextForCodec(parameter.codec),
      })),
    });
  }
  return assertItemLimit({
    version: 1,
    itemId,
    itemRevision,
    judgeRevision,
    parameters,
    starterCases,
  });
}

function structuredCase(id, name, fields) {
  return { id, name, mode: "structured", fields };
}

function rawCase(id, name, raw) {
  return { id, name, mode: "raw", raw };
}

function assertCaseName(name, label = "case name") {
  return assertBoundedString(
    name,
    label,
    CUSTOM_TESTCASE_LIMITS.maxCaseNameBytes,
  );
}

function assertItemLimit(collection) {
  const bytes = byteLength(JSON.stringify(collection));
  if (bytes > CUSTOM_TESTCASE_LIMITS.maxItemBytes)
    throw new Error(
      `custom testcase item exceeds ${CUSTOM_TESTCASE_LIMITS.maxItemBytes} UTF-8 bytes`,
    );
  return collection;
}

function canonicalFields(schema, fields, label) {
  if (!Array.isArray(fields) || fields.length !== schema.parameters.length)
    throw new Error(`${label} fields must match the public parameter schema`);
  const byId = new Map();
  for (const field of fields) {
    if (!object(field) || typeof field.parameterId !== "string")
      throw new Error(`${label} contains an invalid field`);
    if (byId.has(field.parameterId))
      throw new Error(`${label} contains a duplicate field`);
    byId.set(field.parameterId, field.text);
  }
  return schema.parameters.map((parameter) => ({
    parameterId: parameter.id,
    text: assertBoundedString(
      byId.get(parameter.id),
      `${label} ${parameter.name}`,
      CUSTOM_TESTCASE_LIMITS.maxFieldBytes,
      { empty: true },
    ),
  }));
}

function validateSchema(schema) {
  if (!object(schema) || schema.version !== 1)
    throw new Error("a version 1 public testcase schema is required");
  // Re-derivation strips any untrusted or future private properties.
  return deriveCustomTestcaseSchema({
    itemId: schema.itemId,
    itemRevision: schema.itemRevision,
    judgeRevision: schema.judgeRevision,
    parameters: schema.parameters,
    argCodecs: Array.isArray(schema.parameters)
      ? schema.parameters.map((parameter) => parameter?.codec)
      : [],
    visibleSampleArgs: [],
  });
}

export function createCustomTestcaseCollection(schemaInput) {
  const schema = validateSchema(schemaInput);
  const sourceStarters = schemaInput.starterCases;
  if (
    !Array.isArray(sourceStarters) ||
    sourceStarters.length < CUSTOM_TESTCASE_LIMITS.minCases ||
    sourceStarters.length > CUSTOM_TESTCASE_LIMITS.maxCases
  )
    throw new Error("schema contains an invalid starter case collection");
  const cases = sourceStarters.map((starter, index) =>
    structuredCase(
      `case-${index + 1}`,
      assertCaseName(starter?.name, `starter case ${index + 1} name`),
      canonicalFields(schema, starter?.fields, `starter case ${index + 1}`),
    ),
  );
  return assertItemLimit({
    version: 1,
    itemId: schema.itemId,
    itemRevision: schema.itemRevision,
    judgeRevision: schema.judgeRevision,
    cases,
    selectedCaseId: cases[0].id,
    nextOrdinal: cases.length + 1,
  });
}

function caseIndex(collection, caseId) {
  const index = collection.cases.findIndex((testCase) => testCase.id === caseId);
  if (index < 0) throw new Error(`unknown custom testcase: ${caseId}`);
  return index;
}

function canonicalCollectionCase(schema, candidate, index, used, nextRef) {
  let id = typeof candidate?.id === "string" ? candidate.id : "";
  const match = CASE_ID.exec(id);
  if (!match || used.has(id)) {
    while (used.has(`case-${nextRef.value}`)) nextRef.value += 1;
    id = `case-${nextRef.value}`;
    nextRef.value += 1;
  } else {
    nextRef.value = Math.max(nextRef.value, Number(match[1]) + 1);
  }
  used.add(id);
  const name = assertCaseName(candidate?.name, `case ${index + 1} name`);
  if (candidate?.mode === "raw") {
    const raw = assertBoundedString(
      candidate.raw,
      `case ${index + 1} raw input`,
      CUSTOM_TESTCASE_LIMITS.maxRawBytes,
      { empty: true },
    );
    return rawCase(id, name, raw);
  }
  if (candidate?.mode !== "structured")
    throw new Error(`case ${index + 1} has an invalid mode`);
  return structuredCase(
    id,
    name,
    canonicalFields(schema, candidate.fields, `case ${index + 1}`),
  );
}

/** Normalize persisted data deterministically while stripping unknown fields. */
export function normalizeCustomTestcaseCollection(schemaInput, raw) {
  const schema = validateSchema(schemaInput);
  if (!object(raw) || !Array.isArray(raw.cases))
    throw new Error("custom testcase collection must contain cases");
  if (
    raw.cases.length < CUSTOM_TESTCASE_LIMITS.minCases ||
    raw.cases.length > CUSTOM_TESTCASE_LIMITS.maxCases
  )
    throw new Error(
      `custom testcase collection must contain ${CUSTOM_TESTCASE_LIMITS.minCases}-${CUSTOM_TESTCASE_LIMITS.maxCases} cases`,
    );
  const used = new Set();
  const nextRef = { value: 1 };
  const cases = raw.cases.map((candidate, index) =>
    canonicalCollectionCase(schema, candidate, index, used, nextRef),
  );
  const selectedCaseId = cases.some(
    (testCase) => testCase.id === raw.selectedCaseId,
  )
    ? raw.selectedCaseId
    : cases[0].id;
  return assertItemLimit({
    version: 1,
    itemId: schema.itemId,
    itemRevision: schema.itemRevision,
    judgeRevision: schema.judgeRevision,
    cases,
    selectedCaseId,
    nextOrdinal: nextRef.value,
  });
}

function normalizeLiveCollection(collection) {
  if (!object(collection) || !Array.isArray(collection.cases))
    throw new Error("custom testcase collection is invalid");
  return collection;
}

function nextId(collection) {
  const used = new Set(collection.cases.map((testCase) => testCase.id));
  let ordinal = Number.isInteger(collection.nextOrdinal)
    ? collection.nextOrdinal
    : 1;
  while (used.has(`case-${ordinal}`)) ordinal += 1;
  return { id: `case-${ordinal}`, nextOrdinal: ordinal + 1 };
}

function defaultFields(schema) {
  return schema.parameters.map((parameter) => ({
    parameterId: parameter.id,
    text: defaultTextForCodec(parameter.codec),
  }));
}

export function addCustomTestcase(collectionInput, schemaInput, options = {}) {
  const collection = normalizeLiveCollection(collectionInput);
  const schema = validateSchema(schemaInput);
  if (collection.cases.length >= CUSTOM_TESTCASE_LIMITS.maxCases)
    throw new Error(`a testcase collection supports at most 12 cases`);
  const generated = nextId(collection);
  const name =
    options.name === undefined
      ? `Case ${generated.id.slice(5)}`
      : assertCaseName(options.name);
  const created = structuredCase(generated.id, name, defaultFields(schema));
  const after = options.afterCaseId;
  const insertion = after === undefined ? collection.cases.length : caseIndex(collection, after) + 1;
  const cases = [
    ...collection.cases.slice(0, insertion),
    created,
    ...collection.cases.slice(insertion),
  ];
  return assertItemLimit({
    ...collection,
    cases,
    selectedCaseId: created.id,
    nextOrdinal: generated.nextOrdinal,
  });
}

export function duplicateCustomTestcase(collectionInput, caseId) {
  const collection = normalizeLiveCollection(collectionInput);
  if (collection.cases.length >= CUSTOM_TESTCASE_LIMITS.maxCases)
    throw new Error(`a testcase collection supports at most 12 cases`);
  const index = caseIndex(collection, caseId);
  const source = collection.cases[index];
  const generated = nextId(collection);
  const suffix = " copy";
  const name = `${source.name}${suffix}`;
  assertCaseName(name);
  const copy =
    source.mode === "raw"
      ? rawCase(generated.id, name, source.raw)
      : structuredCase(
          generated.id,
          name,
          source.fields.map((field) => ({ ...field })),
        );
  const cases = [
    ...collection.cases.slice(0, index + 1),
    copy,
    ...collection.cases.slice(index + 1),
  ];
  return assertItemLimit({
    ...collection,
    cases,
    selectedCaseId: copy.id,
    nextOrdinal: generated.nextOrdinal,
  });
}

export function updateCustomTestcase(collectionInput, schemaInput, caseId, patch) {
  const collection = normalizeLiveCollection(collectionInput);
  const schema = validateSchema(schemaInput);
  const index = caseIndex(collection, caseId);
  const current = collection.cases[index];
  if (!object(patch)) throw new Error("testcase patch must be an object");
  const name =
    patch.name === undefined ? current.name : assertCaseName(patch.name);
  const mode = patch.mode ?? current.mode;
  let replacement;
  if (mode === "raw") {
    const raw =
      patch.raw ?? (current.mode === "raw" ? current.raw : "");
    replacement = rawCase(
      current.id,
      name,
      assertBoundedString(
        raw,
        "raw testcase input",
        CUSTOM_TESTCASE_LIMITS.maxRawBytes,
        { empty: true },
      ),
    );
  } else if (mode === "structured") {
    const fields =
      patch.fields ??
      (current.mode === "structured" ? current.fields : defaultFields(schema));
    replacement = structuredCase(
      current.id,
      name,
      canonicalFields(schema, fields, "testcase"),
    );
  } else {
    throw new Error("testcase mode must be structured or raw");
  }
  const cases = collection.cases.map((testCase, itemIndex) =>
    itemIndex === index ? replacement : testCase,
  );
  return assertItemLimit({ ...collection, cases });
}

export function updateCustomTestcaseField(
  collectionInput,
  schemaInput,
  caseId,
  parameterId,
  text,
) {
  const collection = normalizeLiveCollection(collectionInput);
  const schema = validateSchema(schemaInput);
  const index = caseIndex(collection, caseId);
  const current = collection.cases[index];
  if (current.mode !== "structured")
    throw new Error("raw testcase input does not have structured fields");
  if (!schema.parameters.some((parameter) => parameter.id === parameterId))
    throw new Error(`unknown testcase parameter: ${parameterId}`);
  assertBoundedString(
    text,
    "testcase field",
    CUSTOM_TESTCASE_LIMITS.maxFieldBytes,
    { empty: true },
  );
  const fields = current.fields.map((field) =>
    field.parameterId === parameterId ? { ...field, text } : field,
  );
  const cases = collection.cases.map((testCase, itemIndex) =>
    itemIndex === index ? { ...current, fields } : testCase,
  );
  return assertItemLimit({ ...collection, cases });
}

export function deleteCustomTestcase(collectionInput, caseId) {
  const collection = normalizeLiveCollection(collectionInput);
  if (collection.cases.length <= CUSTOM_TESTCASE_LIMITS.minCases)
    throw new Error("at least one custom testcase is required");
  const index = caseIndex(collection, caseId);
  const cases = collection.cases.filter((_, itemIndex) => itemIndex !== index);
  const selectedCaseId =
    collection.selectedCaseId === caseId
      ? cases[Math.min(index, cases.length - 1)].id
      : collection.selectedCaseId;
  return assertItemLimit({ ...collection, cases, selectedCaseId });
}

export function selectCustomTestcase(collectionInput, caseId) {
  const collection = normalizeLiveCollection(collectionInput);
  caseIndex(collection, caseId);
  return assertItemLimit({ ...collection, selectedCaseId: caseId });
}

export function parseCustomTestcaseField(text, codecInput) {
  assertBoundedString(
    text,
    "testcase field",
    CUSTOM_TESTCASE_LIMITS.maxFieldBytes,
    { empty: true },
  );
  const selectedCodec = codec(codecInput, "testcase field");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("testcase field must be valid JSON");
  }
  inspectJson(value, "testcase field");
  if (
    (selectedCodec === "linkedList" || selectedCodec === "binaryTree") &&
    !Array.isArray(value)
  )
    throw new Error(
      selectedCodec === "linkedList"
        ? "linkedList input must be a JSON array"
        : "binaryTree input must be a level-order JSON array",
    );
  if (selectedCodec === "cyclicLinkedList") {
    if (!object(value) || !Array.isArray(value.values))
      throw new Error(
        "cyclicLinkedList input must be a JSON object with values and pos",
      );
    if (
      !Number.isInteger(value.pos) ||
      value.pos < -1 ||
      value.pos >= value.values.length
    )
      throw new Error("cyclicLinkedList pos must be -1 or a valid node index");
    return {
      values: canonicalizeJson(value.values, "cyclicLinkedList values"),
      pos: value.pos,
    };
  }
  return canonicalizeJson(value, "testcase field");
}

function normalizeEntrypoint(raw) {
  if (!object(raw) || (raw.kind !== "function" && raw.kind !== "method"))
    throw new Error("entrypoint.kind must be function or method");
  if (typeof raw.name !== "string" || !IDENTIFIER.test(raw.name))
    throw new Error("entrypoint.name must be a Python identifier");
  if (raw.kind === "method") {
    if (typeof raw.className !== "string" || !IDENTIFIER.test(raw.className))
      throw new Error("entrypoint.className must be a Python identifier");
    return { kind: "method", className: raw.className, name: raw.name };
  }
  return { kind: "function", name: raw.name };
}

function argsFromRaw(raw, codecs) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("raw testcase input must be valid JSON before it can run");
  }
  const args = Array.isArray(parsed) ? parsed : parsed?.args;
  if (!Array.isArray(args) || args.length !== codecs.length)
    throw new Error(`raw testcase input must contain ${codecs.length} arguments`);
  return args.map((value, index) =>
    parseCustomTestcaseField(jsonText(value, `raw argument ${index + 1}`), codecs[index]),
  );
}

function executionCase(testCase, schema, codecs, outputCodec) {
  let args;
  if (testCase.mode === "raw") {
    args = argsFromRaw(testCase.raw, codecs);
  } else {
    args = schema.parameters.map((parameter, index) => {
      const field = testCase.fields.find(
        (candidate) => candidate.parameterId === parameter.id,
      );
      if (!field) throw new Error(`testcase is missing ${parameter.name}`);
      return parseCustomTestcaseField(field.text, codecs[index]);
    });
  }
  return {
    name: testCase.name,
    args,
    argCodecs: [...codecs],
    outputCodec,
  };
}

/** Build an execution spec without consulting any stored judge details. */
export function buildCustomTestcaseExecution(
  collectionInput,
  schemaInput,
  options,
) {
  const collection = normalizeLiveCollection(collectionInput);
  const schema = validateSchema(schemaInput);
  if (!object(options)) throw new Error("execution options are required");
  const entrypoint = normalizeEntrypoint(options.entrypoint);
  if (
    !Array.isArray(options.argCodecs) ||
    options.argCodecs.length !== schema.parameters.length
  )
    throw new Error("current argCodecs must match the public parameter schema");
  const argCodecs = options.argCodecs.map((value, index) =>
    codec(value, `argument ${index + 1}`),
  );
  const outputCodec = codec(options.outputCodec ?? "json", "output");
  const revision = positiveRevision(options.revision, "revision");
  let ids;
  if (options.caseIds === "all") {
    ids = collection.cases.map((testCase) => testCase.id);
  } else if (options.caseIds === undefined || options.caseIds === "selected") {
    ids = [collection.selectedCaseId];
  } else if (Array.isArray(options.caseIds)) {
    const requested = new Set(options.caseIds);
    if (requested.size === 0)
      throw new Error("at least one testcase must be selected");
    for (const id of requested) caseIndex(collection, id);
    ids = collection.cases
      .filter((testCase) => requested.has(testCase.id))
      .map((testCase) => testCase.id);
  } else {
    throw new Error("caseIds must be selected, all, or an array of case IDs");
  }
  const chosen = ids.map((id) => collection.cases[caseIndex(collection, id)]);
  const execution = {
    revision,
    entrypoint,
    cases: chosen.map((testCase) =>
      executionCase(testCase, schema, argCodecs, outputCodec),
    ),
  };
  if (byteLength(JSON.stringify(execution)) > CUSTOM_TESTCASE_LIMITS.maxItemBytes)
    throw new Error("custom testcase execution exceeds the safe byte limit");
  return execution;
}

function legacyCases(parsed) {
  if (object(parsed) && Array.isArray(parsed.cases)) return parsed.cases;
  if (object(parsed) && Array.isArray(parsed.args)) return [parsed];
  return null;
}

/**
 * Convert the old {args} / {cases} JSON editor format. If it cannot be safely
 * interpreted, retain the exact input in raw mode so the user's work is not lost.
 */
export function migrateLegacyCustomTestcases(schemaInput, legacyInput) {
  const schema = validateSchema(schemaInput);
  assertBoundedString(
    legacyInput,
    "legacy custom testcase input",
    CUSTOM_TESTCASE_LIMITS.maxRawBytes,
    { empty: true },
  );
  const preserveRaw = () =>
    assertItemLimit({
      version: 1,
      itemId: schema.itemId,
      itemRevision: schema.itemRevision,
      judgeRevision: schema.judgeRevision,
      cases: [rawCase("case-1", "Case 1", legacyInput)],
      selectedCaseId: "case-1",
      nextOrdinal: 2,
    });
  let parsed;
  try {
    parsed = JSON.parse(legacyInput);
  } catch {
    return preserveRaw();
  }
  const candidates = legacyCases(parsed);
  const valid =
    candidates &&
    candidates.length >= CUSTOM_TESTCASE_LIMITS.minCases &&
    candidates.length <= CUSTOM_TESTCASE_LIMITS.maxCases &&
    candidates.every(
      (candidate) =>
        object(candidate) &&
        Array.isArray(candidate.args) &&
        candidate.args.length === schema.parameters.length,
    );
  if (!valid) return preserveRaw();
  try {
    const cases = candidates.map((candidate, index) =>
      structuredCase(
        `case-${index + 1}`,
        candidate.name === undefined
          ? `Case ${index + 1}`
          : assertCaseName(candidate.name, `legacy case ${index + 1} name`),
        schema.parameters.map((parameter, argumentIndex) => ({
          parameterId: parameter.id,
          text: jsonText(
            candidate.args[argumentIndex],
            `legacy case ${index + 1} argument ${argumentIndex + 1}`,
          ),
        })),
      ),
    );
    return assertItemLimit({
      version: 1,
      itemId: schema.itemId,
      itemRevision: schema.itemRevision,
      judgeRevision: schema.judgeRevision,
      cases,
      selectedCaseId: cases[0].id,
      nextOrdinal: cases.length + 1,
    });
  } catch {
    return preserveRaw();
  }
}
