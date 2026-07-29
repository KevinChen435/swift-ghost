import {
  CONTRACT_VERSION,
  type ComparisonMode,
  type SubmissionRequest,
  type TestCase,
} from "./types";

const encoder = new TextEncoder();
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_SOURCE_BYTES = 48_000;
const MAX_TESTS = 64;
const MAX_TEST_VALUE_BYTES = 32_000;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, maxBytes: number, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    throw new ValidationError(`${label} must be ${allowEmpty ? "a string" : "a non-empty string"}`);
  }
  if (encoder.encode(value).byteLength > maxBytes) {
    throw new ValidationError(`${label} exceeds ${maxBytes} UTF-8 bytes`);
  }
  return value;
}

function parseTest(value: unknown, index: number): TestCase {
  const input = record(value, `tests[${index}]`);
  const id = string(input.id, `tests[${index}].id`, 160);
  if (!ID_PATTERN.test(id)) throw new ValidationError(`tests[${index}].id has invalid characters`);
  return {
    id,
    input: string(input.input, `tests[${index}].input`, MAX_TEST_VALUE_BYTES, true),
    expectedOutput: string(
      input.expectedOutput,
      `tests[${index}].expectedOutput`,
      MAX_TEST_VALUE_BYTES,
      true,
    ),
  };
}

export function validateCallbackUrl(value: unknown, allowedOriginsCsv: string): string {
  const raw = string(value, "callbackUrl", 2_048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError("callbackUrl is not a URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new ValidationError("callbackUrl must be HTTPS without credentials or a fragment");
  }
  const allowed = new Set(
    allowedOriginsCsv
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  if (!allowed.has(url.origin)) throw new ValidationError("callbackUrl origin is not allowed");
  return url.toString();
}

export function parseSubmission(value: unknown, allowedOriginsCsv: string): SubmissionRequest {
  const input = record(value, "request");
  if (input.version !== CONTRACT_VERSION) {
    throw new ValidationError(`version must be ${CONTRACT_VERSION}`);
  }
  const submissionId = string(input.submissionId, "submissionId", 160);
  if (!ID_PATTERN.test(submissionId)) throw new ValidationError("submissionId has invalid characters");
  if (input.language !== "python3") throw new ValidationError("language must be python3");
  const comparison: ComparisonMode = input.comparison === undefined ? "exact" : input.comparison as ComparisonMode;
  if (comparison !== "exact" && comparison !== "trim-final-newline") {
    throw new ValidationError("comparison is unsupported");
  }
  if (!Array.isArray(input.tests) || input.tests.length < 1 || input.tests.length > MAX_TESTS) {
    throw new ValidationError(`tests must contain 1..${MAX_TESTS} cases`);
  }
  const tests = input.tests.map(parseTest);
  if (new Set(tests.map((test) => test.id)).size !== tests.length) {
    throw new ValidationError("test ids must be unique");
  }
  return {
    version: CONTRACT_VERSION,
    submissionId,
    language: "python3",
    source: string(input.source, "source", MAX_SOURCE_BYTES),
    comparison,
    tests,
    callbackUrl: validateCallbackUrl(input.callbackUrl, allowedOriginsCsv),
  };
}

export function parsePositiveInt(raw: string | undefined, fallback: number, low: number, high: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < low || parsed > high) return fallback;
  return parsed;
}

export function secretIsStrong(value: string | undefined): value is string {
  return typeof value === "string" && encoder.encode(value).byteLength >= 32;
}
