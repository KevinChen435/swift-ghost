import assert from "node:assert/strict";
import test from "node:test";
import { parseExecution, parseSubmission, ValidationError } from "../src/schema";

function valid() {
  return {
    version: "judge.submission.v1",
    submissionId: "submission-123",
    language: "python3",
    runtime: "python-3.13-linux",
    contentRevision: 1,
    judgeRevision: 1,
    contractDigest: "a".repeat(64),
    source: "print(input())",
    tests: [{ id: "case-1", input: "hello\n", expectedOutput: "hello\n" }],
    callbackUrl: "https://app.example.com/internal/judge-result",
  };
}

test("normalizes a valid submission and defaults to exact comparison", () => {
  const result = parseSubmission(valid(), "https://app.example.com");
  assert.equal(result.comparison, "exact");
  assert.equal(result.tests.length, 1);
  assert.equal(result.tests[0]?.visibility, "hidden");
});

test("accepts explicit sample visibility and rejects unknown visibility", () => {
  const sample = parseSubmission({
    ...valid(),
    tests: [{ id: "sample-1", input: "hello\n", expectedOutput: "hello\n", visibility: "sample" }],
  }, "https://app.example.com");
  assert.equal(sample.tests[0]?.visibility, "sample");
  assert.throws(() => parseSubmission({
    ...valid(),
    tests: [{ id: "sample-1", input: "hello\n", expectedOutput: "hello\n", visibility: "public" }],
  }, "https://app.example.com"), ValidationError);
});

test("accepts the pinned Swift runtime and rejects unbound language metadata", () => {
  const swift = parseSubmission(
    {
      ...valid(),
      language: "swift6",
      runtime: "swift-6.3.3-linux",
      source: "print(readLine() ?? \"\")",
    },
    "https://app.example.com",
  );
  assert.equal(swift.language, "swift6");
  assert.throws(() =>
    parseSubmission({ ...valid(), language: "swift5" }, "https://app.example.com"),
  );
  assert.throws(() =>
    parseSubmission({ ...valid(), contractDigest: "not-a-digest" }, "https://app.example.com"),
  );
  assert.throws(() =>
    parseSubmission({ ...valid(), runtime: "swift-6.3.3-linux" }, "https://app.example.com"),
  );
});

test("rejects callback SSRF origins and non-HTTPS URLs", () => {
  assert.throws(
    () => parseSubmission({ ...valid(), callbackUrl: "https://metadata.invalid/result" }, "https://app.example.com"),
    ValidationError,
  );
  assert.throws(
    () => parseSubmission({ ...valid(), callbackUrl: "http://app.example.com/result" }, "https://app.example.com"),
    ValidationError,
  );
});

test("rejects oversized source and duplicate test ids", () => {
  assert.throws(() => parseSubmission({ ...valid(), source: "x".repeat(48_001) }, "https://app.example.com"));
  const duplicate = valid();
  duplicate.tests.push({ ...duplicate.tests[0]! });
  assert.throws(() => parseSubmission(duplicate, "https://app.example.com"));
});

function execution() {
  return {
    version: "judge.execution.v1",
    executionId: "execution-123",
    source: "import Foundation\n@main struct Main {}",
    cases: [
      { id: "case-1", input: "{\"args\":[1]}\n" },
      { id: "case-2", input: "{\"args\":[2]}\n" },
    ],
    callbackUrl: "https://app.example.com/internal/judge-result",
  };
}

test("parses the strict execution-only request and keeps only id/input cases", () => {
  const result = parseExecution(execution(), "https://app.example.com");
  assert.equal(result.version, "judge.execution.v1");
  assert.equal(result.executionId, "execution-123");
  assert.deepEqual(result.cases, [
    { id: "case-1", input: "{\"args\":[1]}\n" },
    { id: "case-2", input: "{\"args\":[2]}\n" },
  ]);
});

test("rejects judge metadata, expected values, and client runtime/entrypoint fields", () => {
  for (const field of [
    "expectedOutput",
    "entrypoint",
    "runtime",
    "contentRevision",
    "judgeRevision",
    "contractDigest",
    "comparison",
    "language",
  ]) {
    assert.throws(
      () => parseExecution({ ...execution(), [field]: field === "contentRevision" ? 1 : "client-controlled" }, "https://app.example.com"),
      ValidationError,
      field,
    );
  }
  assert.throws(
    () => parseExecution({
      ...execution(),
      cases: [{ id: "case-1", input: "", expectedOutput: "secret" }],
    }, "https://app.example.com"),
    ValidationError,
  );
  assert.throws(
    () => parseExecution({
      ...execution(),
      cases: [{ id: "case-1", input: "", runtime: "swift-5" }],
    }, "https://app.example.com"),
    ValidationError,
  );
});

test("bounds execution cases and rejects duplicate ids", () => {
  assert.throws(() => parseExecution({ ...execution(), cases: [] }, "https://app.example.com"));
  assert.throws(() => parseExecution({
    ...execution(),
    cases: Array.from({ length: 17 }, (_, index) => ({ id: `case-${index}`, input: "" })),
  }, "https://app.example.com"));
  assert.throws(() => parseExecution({
    ...execution(),
    cases: [{ id: "same", input: "" }, { id: "same", input: "" }],
  }, "https://app.example.com"));
});
