import assert from "node:assert/strict";
import test from "node:test";
import { parseSubmission, ValidationError } from "../src/schema";

function valid() {
  return {
    version: "judge.submission.v1",
    submissionId: "submission-123",
    language: "python3",
    source: "print(input())",
    tests: [{ id: "case-1", input: "hello\n", expectedOutput: "hello\n" }],
    callbackUrl: "https://app.example.com/internal/judge-result",
  };
}

test("normalizes a valid submission and defaults to exact comparison", () => {
  const result = parseSubmission(valid(), "https://app.example.com");
  assert.equal(result.comparison, "exact");
  assert.equal(result.tests.length, 1);
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
