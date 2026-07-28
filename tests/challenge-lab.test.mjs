import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ADVANCED_PYTHON_PROBLEMS } from "../app/data/advanced-python-problems.ts";
import { PYTHON_CHALLENGES } from "../app/data/python-challenges.ts";
import { PYTHON_PROBLEMS } from "../app/data/python-problems.ts";
import {
  challengeSpecForItem,
  challengeVerificationForPurpose,
  customCaseVerification,
  isRecordableChallengeResult,
  visibleChallengeVerification,
} from "../app/lib/challenge-lab.mjs";
import { buildPythonHarness } from "../app/lib/python-runner.mjs";

const verification = {
  revision: 4,
  entrypoint: { kind: "function", name: "solve" },
  cases: [
    {
      id: "sample-one",
      visibility: "sample",
      name: "sample one",
      args: [[1, 2]],
      expected: 3,
    },
    {
      id: "sample-two",
      visibility: "sample",
      name: "sample two",
      args: [[-1, 1]],
      expected: 0,
    },
    {
      id: "hidden-boundary",
      visibility: "hidden",
      name: "hidden boundary",
      args: [[]],
      expected: 0,
    },
  ],
};

test("all 48 Python exercises have authored self-contained challenge metadata", () => {
  const challenges = Object.values(PYTHON_CHALLENGES);
  assert.equal(challenges.length, 48);
  assert.equal(new Set(challenges.map((challenge) => challenge.id)).size, 48);
  for (const challenge of challenges) {
    assert.ok(challenge.statement.length >= 40, challenge.title);
    assert.ok(challenge.entrypoint.includes("("), challenge.title);
    assert.ok(challenge.parameters.length >= 1, challenge.title);
    assert.ok(challenge.returns.length >= 12, challenge.title);
    assert.ok(challenge.constraints.length >= 3, challenge.title);
  }
});

test("the shipped catalog maps to 96 samples and 108 hidden checks", () => {
  const catalog = [...PYTHON_PROBLEMS, ...ADVANCED_PYTHON_PROBLEMS];
  let sampleCount = 0;
  let hiddenCount = 0;
  assert.equal(catalog.length, 48);
  for (const problem of catalog) {
    const challenge = PYTHON_CHALLENGES[problem.id];
    assert.ok(challenge, problem.slug);
    assert.equal(
      challenge.entrypoint.includes(`${problem.verification.entrypoint.name}(`),
      true,
      problem.slug,
    );
    const mappedCases = problem.verification.cases.map((testCase, index) => ({
      ...testCase,
      visibility:
        index < Math.min(2, problem.verification.cases.length - 1)
          ? "sample"
          : "hidden",
    }));
    sampleCount += mappedCases.filter(
      (testCase) => testCase.visibility === "sample",
    ).length;
    hiddenCount += mappedCases.filter(
      (testCase) => testCase.visibility === "hidden",
    ).length;
  }
  assert.equal(sampleCount, 96);
  assert.equal(hiddenCount, 108);
});

test("the mapped judge has a new revision and name-stable case identities", async () => {
  const itemsSource = await readFile(
    new URL("../app/lib/items.ts", import.meta.url),
    "utf8",
  );
  assert.match(itemsSource, /const PYTHON_JUDGE_REVISION = 2/);
  assert.match(itemsSource, /id: pythonCaseId\(problem\.id, testCase\.name, index\)/);
  for (const problem of [...PYTHON_PROBLEMS, ...ADVANCED_PYTHON_PROBLEMS]) {
    const names = problem.verification.cases.map((testCase) =>
      testCase.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
    assert.equal(new Set(names).size, names.length, problem.slug);
  }
});

test("challenge specs use authored copy and explicit sample visibility", () => {
  const item = {
    id: 1,
    summary: "Fallback summary",
    complexity: "O(n)",
    verification,
    challenge: {
      statement: "Author an answer for every valid array without mutating it.",
      entrypoint: "solve(values)",
      parameters: [
        { name: "values", type: "list[int]", description: "Input values." },
      ],
      returns: "int — the requested aggregate.",
      constraints: ["values may be empty.", "values contain integers.", "Do not mutate values."],
    },
  };
  const challenge = challengeSpecForItem(item);
  assert.equal(challenge.statement, item.challenge.statement);
  assert.equal(challenge.examples.length, 2);
  assert.equal(challenge.hiddenCaseCount, 1);
  assert.deepEqual(
    visibleChallengeVerification(verification).cases.map((testCase) => testCase.id),
    ["sample-one", "sample-two"],
  );
});

test("custom execution accepts one or many JSON argument sets without expected values", () => {
  const single = customCaseVerification(verification, '{"args": [[3, 4]]}');
  assert.equal(single.revision, 4);
  assert.deepEqual(single.cases[0].args, [[3, 4]]);
  assert.equal("expected" in single.cases[0], false);

  const multiple = customCaseVerification(
    verification,
    '{"cases":[{"name":"empty","args":[[]]},{"name":"mixed","args":[[-2,2]]}]}',
  );
  assert.equal(multiple.cases.length, 2);
  assert.equal(multiple.cases[1].name, "mixed");
  assert.throws(
    () => customCaseVerification(verification, '{"args": []}'),
    /expected 1 argument/,
  );
});

test("observation harnesses execute without assertion comparators", () => {
  const execution = customCaseVerification(verification, '{"args": [[5]]}');
  const harness = buildPythonHarness({
    source: "def solve(values):\n    return sum(values)",
    verification: execution,
    executionMode: "run",
  });
  assert.match(harness, /_SPEC\.get\("mode"\) == "run"/);
  assert.match(harness, /passed = True/);
  assert.doesNotMatch(harness, /expected\\":null/);
});

test("example runs cannot record a solve while accepted submissions can", () => {
  const accepted = {
    kind: "verification",
    ok: true,
    cases: [{ passed: true }, { passed: true }],
  };
  assert.equal(
    challengeVerificationForPurpose(verification, "examples").cases.length,
    2,
  );
  assert.equal(
    challengeVerificationForPurpose(verification, "submit").cases.length,
    3,
  );
  assert.equal(isRecordableChallengeResult(accepted, "examples"), false);
  assert.equal(isRecordableChallengeResult(accepted, "full"), false);
  assert.equal(isRecordableChallengeResult(accepted, "full", true), true);
  assert.equal(isRecordableChallengeResult(accepted, "submit"), true);
  assert.equal(
    isRecordableChallengeResult(
      { ...accepted, cases: [{ passed: true }, { passed: false }] },
      "submit",
    ),
    false,
  );
});
