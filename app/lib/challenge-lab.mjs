const MAX_CUSTOM_CASE_BYTES = 12_000;
const MAX_CUSTOM_ARGUMENTS = 24;
const MAX_CUSTOM_CASES = 12;

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function cloneJson(value, label) {
  let document;
  try {
    document = JSON.stringify(value);
  } catch {
    throw new Error(`${label} must be valid JSON data`);
  }
  if (document === undefined) throw new Error(`${label} must be valid JSON data`);
  return JSON.parse(document);
}

export function challengeEntrypointLabel(verification) {
  const entrypoint = verification?.entrypoint;
  if (!entrypoint) return "the requested Python callable";
  return entrypoint.kind === "method"
    ? `${entrypoint.className}.${entrypoint.name}(...)`
    : `${entrypoint.name}(...)`;
}

export function challengeVisibleCaseCount(verification) {
  const cases = Array.isArray(verification?.cases) ? verification.cases : [];
  const explicit = cases.filter((testCase) => testCase.visibility === "sample");
  if (explicit.length > 0) return explicit.length;
  const total = cases.length;
  if (total <= 1) return total;
  return Math.min(2, total - 1);
}

export function challengeSpecForItem(item) {
  if (!item?.verification) return null;
  const visibleCount = challengeVisibleCaseCount(item.verification);
  const explicitExamples = item.verification.cases.filter(
    (testCase) => testCase.visibility === "sample",
  );
  const visibleCases = explicitExamples.length
    ? explicitExamples
    : item.verification.cases.slice(0, visibleCount);
  const examples = visibleCases.map((testCase, index) => ({
    name: testCase.name,
    args: cloneJson(testCase.args, "example arguments"),
    expected: cloneJson(testCase.expected, "example output"),
    explanation:
      index === 0 ? item.challenge?.exampleExplanation : undefined,
  }));
  const codecs = new Set(
    item.verification.cases.flatMap((testCase) => [
      ...(testCase.argCodecs ?? testCase.args.map(() => "json")),
      testCase.outputCodec ?? "json",
    ]),
  );
  const shapeNotes = [];
  if (codecs.has("linkedList"))
    shapeNotes.push("Linked lists use arrays of node values in the testcase panel.");
  if (codecs.has("cyclicLinkedList"))
    shapeNotes.push(
      'Cyclic lists use {"values": [...], "pos": index}, where -1 means no cycle.',
    );
  if (codecs.has("binaryTree"))
    shapeNotes.push("Binary trees use level-order arrays with null for missing children.");

  return {
    statement:
      item.challenge?.statement ??
      `Implement ${challengeEntrypointLabel(item.verification)}. ${item.summary} Return the requested result for every valid input; do not print the answer as a substitute for returning it.`,
    entrypoint:
      item.challenge?.entrypoint ?? challengeEntrypointLabel(item.verification),
    parameters: item.challenge?.parameters ?? [],
    returns: item.challenge?.returns ?? "Return the requested JSON-compatible result.",
    notes: item.challenge?.notes ?? [],
    examples,
    constraints: [
      ...(item.challenge?.constraints ?? [
        `Keep the implementation within the provided ${challengeEntrypointLabel(item.verification)} contract.`,
        "Inputs and outputs must be JSON-compatible after the documented structure conversion.",
      ]),
      "The browser runner allows four seconds per execution and starts each run in a fresh Python process.",
      ...shapeNotes,
    ],
    visibleCaseCount: visibleCount,
    hiddenCaseCount: item.verification.cases.filter(
      (testCase) => testCase.visibility === "hidden",
    ).length || Math.max(0, item.verification.cases.length - visibleCount),
  };
}

export function visibleChallengeVerification(verification) {
  if (!verification) throw new Error("verification is required");
  const count = challengeVisibleCaseCount(verification);
  if (count === 0) throw new Error("at least one example case is required");
  const explicit = verification.cases.filter(
    (testCase) => testCase.visibility === "sample",
  );
  return {
    ...verification,
    cases: explicit.length ? explicit : verification.cases.slice(0, count),
  };
}

export function challengeVerificationForPurpose(verification, purpose) {
  if (!["examples", "submit", "full"].includes(purpose))
    throw new Error("unsupported verification purpose");
  return purpose === "examples"
    ? visibleChallengeVerification(verification)
    : verification;
}

export function isRecordableChallengeResult(
  result,
  purpose,
  isMock = false,
) {
  const recordablePurpose =
    purpose === "submit" || (isMock && purpose === "full");
  return Boolean(
    recordablePurpose &&
      result?.kind === "verification" &&
      result.ok === true &&
      Array.isArray(result.cases) &&
      result.cases.length > 0 &&
      result.cases.every((testCase) => testCase?.passed === true),
  );
}

export function classifySubmissionResult(result) {
  if (result?.ok === true) return "accepted";
  if (result?.setupError) return "invalid-entrypoint";
  if (
    result?.cases?.some((testCase) =>
      /time(?:d)? out|time limit/i.test(String(testCase?.error ?? "")),
    )
  )
    return "time-limit";
  if (result?.cases?.some((testCase) => Boolean(testCase?.error)))
    return "runtime-error";
  return "wrong-answer";
}

export function defaultCustomCaseInput(verification) {
  const first = verification?.cases?.[0];
  return JSON.stringify({ args: first?.args ?? [] }, null, 2);
}

export function customCaseVerification(verification, input) {
  if (!verification?.entrypoint || !Array.isArray(verification.cases))
    throw new Error("This exercise does not support custom testcases");
  if (typeof input !== "string" || !input.trim())
    throw new Error("Enter testcase arguments as JSON");
  if (byteLength(input) > MAX_CUSTOM_CASE_BYTES)
    throw new Error(`Custom testcase exceeds ${MAX_CUSTOM_CASE_BYTES} bytes`);

  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('Use JSON such as {"args": [[2, 7, 11, 15], 9]}');
  }
  const template = verification.cases[0];
  const argCodecs = template?.argCodecs ?? template?.args?.map(() => "json") ?? [];
  const rawCases = Array.isArray(parsed?.cases)
    ? parsed.cases
    : [{ name: "custom testcase", args: Array.isArray(parsed) ? parsed : parsed?.args }];
  if (rawCases.length === 0 || rawCases.length > MAX_CUSTOM_CASES)
    throw new Error(`Custom input must contain 1-${MAX_CUSTOM_CASES} cases`);

  const cases = rawCases.map((rawCase, index) => {
    const args = rawCase?.args;
    if (!Array.isArray(args))
      throw new Error(`Custom case ${index + 1} must include an args array`);
    if (args.length > MAX_CUSTOM_ARGUMENTS)
      throw new Error(`Custom case ${index + 1} has too many arguments`);
    if (args.length !== argCodecs.length)
      throw new Error(
        `Custom case ${index + 1}: expected ${argCodecs.length} argument${argCodecs.length === 1 ? "" : "s"}, received ${args.length}`,
      );
    const requestedName =
      typeof rawCase.name === "string" ? rawCase.name.trim().slice(0, 80) : "";
    return {
      name: requestedName || `custom testcase ${index + 1}`,
      args: cloneJson(args, `custom case ${index + 1} arguments`),
      argCodecs: [...argCodecs],
      outputCodec: template?.outputCodec ?? "json",
    };
  });

  return {
    revision: verification.revision,
    entrypoint: verification.entrypoint,
    cases,
  };
}

export const CHALLENGE_LAB_LIMITS = Object.freeze({
  maxCustomCaseBytes: MAX_CUSTOM_CASE_BYTES,
  maxCustomArguments: MAX_CUSTOM_ARGUMENTS,
  maxCustomCases: MAX_CUSTOM_CASES,
});
