const PACK_KIND = "swift-ghost.swift-case-pack.v1";
const MAX_CASES = 6;
const MAX_PACK_BYTES = 24_000;
const MAX_CASE_NAME = 120;
const MAX_STRING_VALUE = 4_000;
const MAX_ARRAY_VALUES = 256;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function cleanString(value, limit, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, limit);
}

function integerRevision(value) {
  return Number.isInteger(value) && value >= 1 && value <= 1_000_000
    ? value
    : null;
}

function challengeContract(challenge) {
  if (!isRecord(challenge) || challenge.language !== "swift") return null;
  const key = cleanString(challenge.key, 96);
  const title = cleanString(challenge.title, 120);
  const runtime = cleanString(challenge.runtime, 80);
  const contentRevision = integerRevision(challenge.contentRevision);
  const judgeRevision = integerRevision(challenge.judgeRevision);
  const entrypoint = isRecord(challenge.entrypoint) ? challenge.entrypoint : null;
  const parameters = Array.isArray(entrypoint?.parameters)
    ? entrypoint.parameters.flatMap((parameter) => {
        const name = cleanString(parameter?.name, 64);
        const type = cleanString(parameter?.type, 32);
        return name && type ? [{ name, type }] : [];
      })
    : [];
  const name = cleanString(entrypoint?.name, 96);
  const returns = cleanString(entrypoint?.returns, 32);
  if (
    !key ||
    !title ||
    !runtime ||
    !contentRevision ||
    !judgeRevision ||
    entrypoint?.kind !== "function" ||
    !name ||
    parameters.length === 0
  ) {
    return null;
  }
  return {
    key,
    title,
    runtime,
    contentRevision,
    judgeRevision,
    entrypoint: {
      kind: "function",
      name,
      parameters,
      ...(returns ? { returns } : {}),
    },
  };
}

export function swiftCaseValueMatches(value, type) {
  if (type.endsWith("?"))
    return value === null || swiftCaseValueMatches(value, type.slice(0, -1));
  if (type === "Int") return typeof value === "number" && Number.isSafeInteger(value);
  if (type === "Bool") return typeof value === "boolean";
  if (type === "String")
    return typeof value === "string" && value.length <= MAX_STRING_VALUE;
  if (type === "[Int]")
    return Array.isArray(value) &&
      value.length <= MAX_ARRAY_VALUES &&
      value.every((entry) => swiftCaseValueMatches(entry, "Int"));
  if (type === "[String]")
    return Array.isArray(value) &&
      value.length <= MAX_ARRAY_VALUES &&
      value.every((entry) => swiftCaseValueMatches(entry, "String"));
  if (type === "[[Int]]")
    return Array.isArray(value) &&
      value.length <= MAX_ARRAY_VALUES &&
      value.every((entry) => swiftCaseValueMatches(entry, "[Int]"));
  return false;
}

export function parseSwiftCasePackArgs(raw, parameters) {
  if (typeof raw !== "string" || byteLength(raw) > MAX_PACK_BYTES)
    throw new Error("Swift case input is too large.");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Use valid JSON for each Swift argument.");
  }
  const args = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.args)
      ? parsed.args
      : null;
  if (!Array.isArray(args) || args.length !== parameters.length)
    throw new Error(`This function expects ${parameters.length} argument${parameters.length === 1 ? "" : "s"}.`);
  args.forEach((value, index) => {
    if (!swiftCaseValueMatches(value, parameters[index].type))
      throw new Error(`${parameters[index].name} must be a ${parameters[index].type} value.`);
  });
  return args;
}

function normalizePackCase(candidate, index, parameters) {
  if (!isRecord(candidate) || Object.hasOwn(candidate, "expected") || Object.hasOwn(candidate, "hidden"))
    throw new Error("Case packs contain inputs only.");
  const name = cleanString(candidate.name, MAX_CASE_NAME) || `Case ${index + 1}`;
  const args = Array.isArray(candidate.args) ? candidate.args : null;
  if (!args || args.length !== parameters.length)
    throw new Error(`${name} does not match the Swift function signature.`);
  args.forEach((value, parameterIndex) => {
    const parameter = parameters[parameterIndex];
    if (!swiftCaseValueMatches(value, parameter.type))
      throw new Error(`${name}: ${parameter.name} must be a ${parameter.type} value.`);
  });
  return { name, args };
}

export function buildSwiftCasePack({ challenge, cases } = {}) {
  const contract = challengeContract(challenge);
  if (!contract) throw new Error("A current Swift challenge is required.");
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > MAX_CASES)
    throw new Error(`A Swift case pack supports 1-${MAX_CASES} cases.`);
  const normalizedCases = cases.map((testCase, index) =>
    normalizePackCase(testCase, index, contract.entrypoint.parameters),
  );
  const pack = {
    kind: PACK_KIND,
    challengeKey: contract.key,
    title: contract.title,
    runtime: contract.runtime,
    contentRevision: contract.contentRevision,
    judgeRevision: contract.judgeRevision,
    entrypoint: contract.entrypoint,
    cases: normalizedCases,
  };
  const text = JSON.stringify(pack, null, 2);
  if (byteLength(text) > MAX_PACK_BYTES)
    throw new Error("Swift case pack is too large.");
  return pack;
}

export function encodeSwiftCasePack(input) {
  return JSON.stringify(buildSwiftCasePack(input), null, 2);
}

export function importSwiftCasePack(text, challenge) {
  if (typeof text !== "string" || byteLength(text) > MAX_PACK_BYTES)
    throw new Error("Swift case pack is too large.");
  const contract = challengeContract(challenge);
  if (!contract) throw new Error("A current Swift challenge is required.");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Paste a valid Swift Ghost case pack.");
  }
  if (!isRecord(parsed) || parsed.kind !== PACK_KIND)
    throw new Error("Paste a Swift Ghost case pack.");
  if (
    parsed.challengeKey !== contract.key ||
    parsed.contentRevision !== contract.contentRevision ||
    parsed.judgeRevision !== contract.judgeRevision ||
    !isRecord(parsed.entrypoint) ||
    parsed.entrypoint.name !== contract.entrypoint.name
  ) {
    throw new Error("This case pack belongs to a different Swift challenge revision.");
  }
  if (!Array.isArray(parsed.cases) || parsed.cases.length < 1 || parsed.cases.length > MAX_CASES)
    throw new Error(`A Swift case pack supports 1-${MAX_CASES} cases.`);
  return parsed.cases.map((testCase, index) =>
    normalizePackCase(testCase, index, contract.entrypoint.parameters),
  );
}

export const SWIFT_CASE_PACK_LIMITS = Object.freeze({
  maxCases: MAX_CASES,
  maxBytes: MAX_PACK_BYTES,
});
