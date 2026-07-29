import type { PythonChallengeMetadata } from "../data/python-challenges";
import { parser as pythonParser } from "@lezer/python";
import type {
  PythonCodec,
  PythonComparator,
  PythonEntrypoint,
  PythonVerification,
  PythonVerificationCase,
} from "./python-runner.mjs";

export const CUSTOM_CHALLENGE_LIMITS = Object.freeze({
  statementCharacters: 6_000,
  parameters: 8,
  cases: 16,
  caseNameCharacters: 80,
  constraintCharacters: 240,
  constraints: 12,
  notes: 8,
  starterCodeCharacters: 20_000,
  referenceCodeBytes: 48_000,
  specificationBytes: 56_000,
  jsonDepth: 50,
  jsonNodes: 5_000,
});

export type CustomChallengeParameterInput = {
  name: string;
  type: string;
  description: string;
  codec: PythonCodec;
};

export type CustomChallengeCaseInput = {
  id?: string;
  name: string;
  visibility: "sample" | "hidden";
  args: readonly unknown[];
  expected: unknown;
  outputCodec?: PythonCodec;
  comparator?: PythonComparator;
};

export type CustomChallengeInput = {
  statement: string;
  entrypoint: PythonEntrypoint;
  parameters: readonly CustomChallengeParameterInput[];
  returns: string;
  constraints: readonly string[];
  notes?: readonly string[];
  exampleExplanation?: string;
  starterCode: string;
  cases: readonly CustomChallengeCaseInput[];
};

export type CustomChallengeBundle = {
  challenge: PythonChallengeMetadata;
  verification: PythonVerification;
  starterCode: string;
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CODECS = new Set<PythonCodec>([
  "json",
  "linkedList",
  "cyclicLinkedList",
  "binaryTree",
]);
const COMPARATORS = new Set<PythonComparator>([
  "deepEqual",
  "unordered",
  "unorderedNested",
  "validTopologicalOrder",
]);

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function normalizedText(
  value: unknown,
  label: string,
  maximum: number,
  required = true,
) {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) throw new Error(`${label} is required`);
  if (text.length > maximum)
    throw new Error(`${label} must be ${maximum} characters or fewer`);
  return text;
}

function cloneJson(value: unknown, label: string): unknown {
  let nodes = 0;
  function assertJson(
    candidate: unknown,
    depth = 0,
    seen = new Set<object>(),
  ) {
    nodes += 1;
    if (nodes > CUSTOM_CHALLENGE_LIMITS.jsonNodes)
      throw new Error(`${label} contains too many values`);
    if (depth > CUSTOM_CHALLENGE_LIMITS.jsonDepth)
      throw new Error(`${label} is nested too deeply`);
    if (
      candidate === null ||
      typeof candidate === "string" ||
      typeof candidate === "boolean"
    )
      return;
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate))
        throw new Error(`${label} contains a non-finite number`);
      return;
    }
    if (typeof candidate !== "object" || seen.has(candidate))
      throw new Error(`${label} must contain only JSON values`);
    const prototype = Object.getPrototypeOf(candidate);
    if (
      prototype !== Array.prototype &&
      prototype !== Object.prototype &&
      prototype !== null
    )
      throw new Error(`${label} must contain only JSON values`);
    seen.add(candidate);
    for (const child of Array.isArray(candidate)
      ? candidate
      : Object.values(candidate))
      assertJson(child, depth + 1, seen);
    seen.delete(candidate);
  }
  assertJson(value);
  const document = JSON.stringify(value);
  if (document === undefined)
    throw new Error(`${label} must be JSON-serializable`);
  return JSON.parse(document) as unknown;
}

function normalizeEntrypoint(value: PythonEntrypoint): PythonEntrypoint {
  if (!value || !IDENTIFIER.test(value.name))
    throw new Error("Function name must be a valid Python identifier");
  if (value.kind === "method") {
    if (!IDENTIFIER.test(value.className))
      throw new Error("Class name must be a valid Python identifier");
    return { kind: "method", className: value.className, name: value.name };
  }
  if (value.kind !== "function")
    throw new Error("Entrypoint must be a function or class method");
  return { kind: "function", name: value.name };
}

function stableCaseId(
  stableId: string,
  name: string,
  index: number,
  requested?: string,
) {
  const safeRequested =
    typeof requested === "string"
      ? requested.trim().replace(/[^A-Za-z0-9:_-]/g, "-").slice(0, 120)
      : "";
  if (safeRequested) return safeRequested;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${stableId}:${slug || `case-${index + 1}`}`;
}

function entrypointLabel(entrypoint: PythonEntrypoint, parameters: string[]) {
  const callable =
    entrypoint.kind === "method"
      ? `${entrypoint.className}.${entrypoint.name}`
      : entrypoint.name;
  return `${callable}(${parameters.join(", ")})`;
}

function signatureParameterCount(signature: string) {
  const parameters: string[] = [];
  let current = "";
  let depth = 0;
  for (const character of signature) {
    if (character === "(" || character === "[" || character === "{") depth += 1;
    if (character === ")" || character === "]" || character === "}") depth -= 1;
    if (character === "," && depth === 0) {
      parameters.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) parameters.push(current.trim());
  if (parameters.some((parameter) => parameter === "*" || parameter === "/"))
    throw new Error("Starter callable cannot use positional separators");
  if (parameters.some((parameter) => /^\*\*/.test(parameter) || /^\*(?!$)/.test(parameter)))
    throw new Error("Starter callable cannot use variadic parameters");
  return parameters;
}

function validateStarterCallable(
  starterCode: string,
  entrypoint: PythonEntrypoint,
  expectedParameters: number,
) {
  const syntaxCursor = pythonParser.parse(starterCode).cursor();
  do {
    if (syntaxCursor.type.isError)
      throw new Error("Starter code must contain valid Python syntax");
  } while (syntaxCursor.next());
  const escapedName = entrypoint.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lines = starterCode.split("\n");
  let signature: string | undefined;
  if (entrypoint.kind === "function") {
    const match = lines
      .map((line) => line.match(new RegExp(`^def\\s+${escapedName}\\s*\\((.*)\\)\\s*(?:->[^:]+)?\\s*:`)))
      .find(Boolean);
    signature = match?.[1];
  } else {
    const escapedClass = entrypoint.className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const classIndex = lines.findIndex((line) =>
      new RegExp(`^class\\s+${escapedClass}(?:\\s|\\(|:)`).test(line),
    );
    if (classIndex < 0)
      throw new Error(`Starter code must define class ${entrypoint.className}`);
    const classBody: string[] = [];
    for (let index = classIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() && !/^\s/.test(line)) break;
      classBody.push(line);
    }
    const indentationWidth = (line: string) => {
      const indentation = line.match(/^[ \\t]*/)?.[0] ?? "";
      return indentation.replace(/\t/g, "    ").length;
    };
    const directIndent = Math.min(
      ...classBody
        .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
        .map(indentationWidth),
    );
    for (const line of classBody) {
      if (indentationWidth(line) !== directIndent) continue;
      const match = line.match(
        new RegExp(`^[ \\t]+def\\s+${escapedName}\\s*\\((.*)\\)\\s*(?:->[^:]+)?\\s*:`),
      );
      if (match) {
        signature = match[1];
        break;
      }
    }
  }
  if (signature === undefined)
    throw new Error(`Starter code must define ${entrypoint.name}(...) at the callable scope`);
  const parameters = signatureParameterCount(signature);
  if (entrypoint.kind === "method") {
    if (!parameters[0] || !/^(?:self|cls)(?:\s*[:=]|$)/.test(parameters[0]))
      throw new Error(`Starter method ${entrypoint.name}(...) must begin with self or cls`);
    parameters.shift();
  }
  if (parameters.length !== expectedParameters)
    throw new Error(
      `Starter callable ${entrypoint.name}(...) must accept exactly ${expectedParameters} challenge argument${expectedParameters === 1 ? "" : "s"}`,
    );
}

export function normalizeCustomChallenge(
  input: CustomChallengeInput,
  options: {
    stableId: string;
    title: string;
    revision?: number;
  },
): CustomChallengeBundle {
  if (!input || typeof input !== "object")
    throw new Error("Challenge definition is required");
  const entrypoint = normalizeEntrypoint(input.entrypoint);
  if (
    !Array.isArray(input.parameters) ||
    input.parameters.length < 1 ||
    input.parameters.length > CUSTOM_CHALLENGE_LIMITS.parameters
  )
    throw new Error(
      `Use 1-${CUSTOM_CHALLENGE_LIMITS.parameters} parameters`,
    );
  const seenNames = new Set<string>();
  const parameters = input.parameters.map((parameter, index) => {
    const name = normalizedText(
      parameter?.name,
      `Parameter ${index + 1} name`,
      40,
    );
    if (!IDENTIFIER.test(name))
      throw new Error(`Parameter ${index + 1} must use a Python identifier`);
    if (seenNames.has(name))
      throw new Error(`Parameter name ${name} is duplicated`);
    seenNames.add(name);
    if (!CODECS.has(parameter.codec))
      throw new Error(`Parameter ${index + 1} uses an unsupported input shape`);
    const codec = parameter.codec;
    return {
      name,
      type: normalizedText(
        parameter.type,
        `Parameter ${index + 1} type`,
        80,
      ),
      description: normalizedText(
        parameter.description,
        `Parameter ${index + 1} description`,
        240,
      ),
      codec,
    };
  });
  if (
    !Array.isArray(input.cases) ||
    input.cases.length < 2 ||
    input.cases.length > CUSTOM_CHALLENGE_LIMITS.cases
  )
    throw new Error(
      `Create 2-${CUSTOM_CHALLENGE_LIMITS.cases} judge cases`,
    );
  if (!input.cases.some((testCase) => testCase.visibility === "sample"))
    throw new Error("Add at least one visible sample case");
  if (!input.cases.some((testCase) => testCase.visibility === "hidden"))
    throw new Error("Add at least one hidden judge case");

  const ids = new Set<string>();
  const cases: PythonVerificationCase[] = input.cases.map((testCase, index) => {
    const name = normalizedText(
      testCase?.name,
      `Case ${index + 1} name`,
      CUSTOM_CHALLENGE_LIMITS.caseNameCharacters,
    );
    if (!Array.isArray(testCase.args))
      throw new Error(`Case ${index + 1} arguments must be a JSON array`);
    if (
      testCase.visibility !== "sample" &&
      testCase.visibility !== "hidden"
    )
      throw new Error(`Case ${index + 1} visibility is invalid`);
    if (testCase.args.length !== parameters.length)
      throw new Error(
        `Case ${index + 1} needs ${parameters.length} argument${parameters.length === 1 ? "" : "s"}`,
      );
    const id = stableCaseId(options.stableId, name, index, testCase.id);
    if (ids.has(id)) throw new Error(`Case ${index + 1} has a duplicate id`);
    ids.add(id);
    const outputCodec = testCase.outputCodec ?? "json";
    const comparator = testCase.comparator ?? "deepEqual";
    if (!CODECS.has(outputCodec))
      throw new Error(`Case ${index + 1} uses an unsupported output shape`);
    if (!COMPARATORS.has(comparator))
      throw new Error(`Case ${index + 1} uses an unsupported comparison`);
    return {
      id,
      name,
      visibility:
        testCase.visibility === "hidden" ? "hidden" : "sample",
      args: cloneJson(testCase.args, `Case ${index + 1} arguments`) as readonly unknown[],
      argCodecs: parameters.map((parameter) => parameter.codec),
      expected: cloneJson(
        testCase.expected,
        `Case ${index + 1} expected output`,
      ),
      outputCodec,
      comparator,
    };
  });

  if (
    !Array.isArray(input.constraints) ||
    input.constraints.length > CUSTOM_CHALLENGE_LIMITS.constraints
  )
    throw new Error(
      `Use at most ${CUSTOM_CHALLENGE_LIMITS.constraints} constraints`,
    );
  const constraints = (Array.isArray(input.constraints)
    ? input.constraints
    : []
  )
    .map((value, index) =>
      normalizedText(
        value,
        `Constraint ${index + 1}`,
        CUSTOM_CHALLENGE_LIMITS.constraintCharacters,
        false,
      ),
    )
    .filter(Boolean);
  if (constraints.length === 0)
    throw new Error("Add at least one input or behavior constraint");
  if (
    input.notes !== undefined &&
    (!Array.isArray(input.notes) ||
      input.notes.length > CUSTOM_CHALLENGE_LIMITS.notes)
  )
    throw new Error(`Use at most ${CUSTOM_CHALLENGE_LIMITS.notes} notes`);
  const notes = (Array.isArray(input.notes) ? input.notes : [])
    .map((value, index) =>
      normalizedText(value, `Note ${index + 1}`, 240, false),
    )
    .filter(Boolean);
  const starterCode =
    typeof input.starterCode === "string"
      ? input.starterCode.replace(/\r\n?/g, "\n").trimEnd()
      : "";
  if (starterCode.length < 10)
    throw new Error("Starter code must contain a callable skeleton");
  if (starterCode.length > CUSTOM_CHALLENGE_LIMITS.starterCodeCharacters)
    throw new Error(
      `Starter code must be ${CUSTOM_CHALLENGE_LIMITS.starterCodeCharacters} characters or fewer`,
    );
  validateStarterCallable(starterCode, entrypoint, parameters.length);
  const title = normalizedText(options.title, "Challenge title", 80);
  const challenge: PythonChallengeMetadata = {
    id: options.stableId,
    title,
    statement: normalizedText(
      input.statement,
      "Problem statement",
      CUSTOM_CHALLENGE_LIMITS.statementCharacters,
    ),
    entrypoint: entrypointLabel(
      entrypoint,
      parameters.map((parameter) => parameter.name),
    ),
    parameters: parameters.map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
      description: parameter.description,
    })),
    returns: normalizedText(input.returns, "Return contract", 500),
    constraints: constraints as [string, ...string[]],
    notes,
    exampleExplanation: normalizedText(
      input.exampleExplanation,
      "Example explanation",
      1_000,
      false,
    ) || undefined,
  };
  const verification: PythonVerification = {
    revision:
      Number.isInteger(options.revision) && Number(options.revision) > 0
        ? Math.min(1_000_000, Number(options.revision))
        : 1,
    entrypoint,
    cases,
  };
  const bytes = byteLength(
    JSON.stringify({ challenge, verification, starterCode }),
  );
  if (bytes > CUSTOM_CHALLENGE_LIMITS.specificationBytes)
    throw new Error(
      `Challenge definition exceeds ${CUSTOM_CHALLENGE_LIMITS.specificationBytes} bytes`,
    );
  return { challenge, verification, starterCode };
}

export function customChallengeInputFromBundle(
  bundle: Pick<CustomChallengeBundle, "challenge" | "verification" | "starterCode">,
): CustomChallengeInput {
  const firstCase = bundle.verification.cases[0];
  const argCodecs = firstCase?.argCodecs ??
    bundle.challenge.parameters.map(() => "json" as const);
  return {
    statement: bundle.challenge.statement,
    entrypoint: bundle.verification.entrypoint,
    parameters: bundle.challenge.parameters.map((parameter, index) => ({
      ...parameter,
      codec: argCodecs[index] ?? "json",
    })),
    returns: bundle.challenge.returns,
    constraints: [...bundle.challenge.constraints],
    notes: [...(bundle.challenge.notes ?? [])],
    exampleExplanation: bundle.challenge.exampleExplanation,
    starterCode: bundle.starterCode,
    cases: bundle.verification.cases.map((testCase) => ({
      id: testCase.id,
      name: testCase.name,
      visibility:
        testCase.visibility === "hidden" ? "hidden" : "sample",
      args: cloneJson(testCase.args, `${testCase.name} arguments`) as readonly unknown[],
      expected: cloneJson(testCase.expected, `${testCase.name} expected output`),
      outputCodec: testCase.outputCodec ?? "json",
      comparator: testCase.comparator ?? "deepEqual",
    })),
  };
}

export function customChallengeSemanticDocument(
  bundle: CustomChallengeBundle | null,
) {
  if (!bundle) return "";
  return JSON.stringify({
    challenge: { ...bundle.challenge, id: "custom:item", title: "" },
    verification: { ...bundle.verification, revision: 1 },
    starterCode: bundle.starterCode,
  });
}

export function customChallengeJudgeDocument(
  bundle: CustomChallengeBundle | null,
) {
  if (!bundle) return "";
  return JSON.stringify({ ...bundle.verification, revision: 1 });
}

export function deriveCustomChallengeRevisions(options: {
  current: CustomChallengeBundle | null;
  requested: CustomChallengeBundle | null;
  contentRevision: number;
  judgeRevision: number;
  referenceChanged?: boolean;
}) {
  const challengeChanged =
    customChallengeSemanticDocument(options.current) !==
    customChallengeSemanticDocument(options.requested);
  const judgeChanged =
    customChallengeJudgeDocument(options.current) !==
    customChallengeJudgeDocument(options.requested);
  const contentChanged = Boolean(options.referenceChanged || challengeChanged);
  return {
    challengeChanged,
    judgeChanged,
    contentChanged,
    contentRevision: contentChanged
      ? Math.min(1_000_000, options.contentRevision + 1)
      : options.contentRevision,
    judgeRevision:
      options.requested && judgeChanged
        ? Math.min(1_000_000, options.judgeRevision + 1)
        : options.judgeRevision,
  };
}

export function normalizeCustomReferenceCode(value: unknown) {
  const code =
    typeof value === "string"
      ? value.replace(/\r\n?/g, "\n").trimEnd()
      : "";
  if (code.length < 10) throw new Error("Reference solution is too short");
  if (code.length > 20_000)
    throw new Error("Reference solution must be 20000 characters or fewer");
  if (byteLength(code) > CUSTOM_CHALLENGE_LIMITS.referenceCodeBytes)
    throw new Error(
      `Reference solution exceeds ${CUSTOM_CHALLENGE_LIMITS.referenceCodeBytes} UTF-8 bytes`,
    );
  return code;
}
