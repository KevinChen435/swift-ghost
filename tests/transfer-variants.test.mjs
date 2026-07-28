import assert from "node:assert/strict";
import test from "node:test";

import { ADVANCED_PYTHON_PROBLEMS } from "../app/data/advanced-python-problems.ts";
import { PYTHON_PROBLEMS } from "../app/data/python-problems.ts";
import { TRANSFER_PROBLEMS } from "../app/data/transfer-problems.ts";

const PYTHON_SOURCE_IDS = new Set(
  [...PYTHON_PROBLEMS, ...ADVANCED_PYTHON_PROBLEMS].map(
    (problem) => `python:${problem.id}`,
  ),
);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expectedChallengeEntrypoint(problem) {
  const entrypoint = problem.verification.entrypoint;
  const callable =
    entrypoint.kind === "method"
      ? `${entrypoint.className}.${entrypoint.name}`
      : entrypoint.name;
  const parameters = problem.challenge.parameters
    .map((parameter) => parameter.name)
    .join(", ");
  return `${callable}(${parameters})`;
}

test("the transfer bank has stable unique identities and valid source lineage", () => {
  assert.equal(TRANSFER_PROBLEMS.length, 8);

  const numericIds = TRANSFER_PROBLEMS.map((problem) => problem.id);
  const transferIds = TRANSFER_PROBLEMS.map(
    (problem) => problem.transfer.id,
  );

  assert.equal(new Set(numericIds).size, TRANSFER_PROBLEMS.length);
  assert.equal(new Set(transferIds).size, TRANSFER_PROBLEMS.length);

  for (const problem of TRANSFER_PROBLEMS) {
    assert.equal(Number.isSafeInteger(problem.id), true, problem.slug);
    assert.equal(problem.id > 0, true, problem.slug);
    assert.equal(problem.transfer.id, `transfer-${problem.id}`, problem.slug);
    assert.match(problem.transfer.family, /^[a-z0-9]+(?:-[a-z0-9]+)+$/, problem.slug);

    assert.equal(problem.transfer.sourceItemIds.length >= 1, true, problem.slug);
    assert.equal(
      new Set(problem.transfer.sourceItemIds).size,
      problem.transfer.sourceItemIds.length,
      problem.slug,
    );
    for (const sourceItemId of problem.transfer.sourceItemIds) {
      assert.match(sourceItemId, /^python:\d+$/, problem.slug);
      assert.equal(
        PYTHON_SOURCE_IDS.has(sourceItemId),
        true,
        `${problem.slug}: ${sourceItemId}`,
      );
    }
  }
});

test("every transfer variant has an explicit sample and hidden-case contract", () => {
  const globalCaseIds = new Set();

  for (const problem of TRANSFER_PROBLEMS) {
    const sampleCases = problem.verification.cases.filter(
      (testCase) => testCase.visibility === "sample",
    );
    const hiddenCases = problem.verification.cases.filter(
      (testCase) => testCase.visibility === "hidden",
    );

    assert.equal(problem.verification.revision, 1, problem.slug);
    assert.equal(sampleCases.length >= 2, true, problem.slug);
    assert.equal(hiddenCases.length >= 3, true, problem.slug);
    assert.equal(
      sampleCases.length + hiddenCases.length,
      problem.verification.cases.length,
      `${problem.slug}: every case must declare visibility`,
    );

    for (const testCase of problem.verification.cases) {
      assert.match(testCase.id ?? "", new RegExp(`^${problem.id}:`), problem.slug);
      assert.equal(globalCaseIds.has(testCase.id), false, testCase.id);
      globalCaseIds.add(testCase.id);
      assert.equal(testCase.args.length, problem.challenge.parameters.length, testCase.id);
      assert.equal(testCase.name.trim().length > 0, true, testCase.id);
    }
  }
});

test("challenge callables, starter boundaries, and post-attempt debriefs stay aligned", () => {
  for (const problem of TRANSFER_PROBLEMS) {
    const { entrypoint } = problem.verification;
    const declaration = new RegExp(`\\bdef ${escapeRegExp(entrypoint.name)}\\(`);

    assert.equal(problem.challenge.id, problem.id, problem.slug);
    assert.equal(problem.challenge.title, problem.title, problem.slug);
    assert.equal(
      problem.challenge.entrypoint,
      expectedChallengeEntrypoint(problem),
      problem.slug,
    );
    assert.match(problem.starterCode, declaration, problem.slug);
    assert.match(problem.code, declaration, problem.slug);
    if (entrypoint.kind === "method") {
      assert.match(problem.starterCode, /^class Solution:/m, problem.slug);
      assert.match(problem.code, /^class Solution:/m, problem.slug);
    }

    assert.notEqual(problem.starterCode.trim(), problem.code.trim(), problem.slug);
    assert.match(problem.starterCode, /NotImplementedError|\bpass\b/, problem.slug);
    assert.doesNotMatch(problem.code, /NotImplementedError/, problem.slug);

    assert.equal(
      problem.transfer.postAttemptPatternLabel,
      problem.pattern,
      problem.slug,
    );
    assert.equal(
      problem.transfer.contrastExplanation.trim().length >= 40,
      true,
      problem.slug,
    );
    assert.equal(
      problem.transfer.teachBackQuestion.trim().length >= 20,
      true,
      problem.slug,
    );
    assert.match(problem.transfer.teachBackQuestion.trim(), /\?$/, problem.slug);
  }
});
