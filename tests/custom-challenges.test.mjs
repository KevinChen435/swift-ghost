import assert from "node:assert/strict";
import test from "node:test";

import {
  CUSTOM_CHALLENGE_LIMITS,
  customChallengeInputFromBundle,
  deriveCustomChallengeRevisions,
  normalizeCustomChallenge,
  normalizeCustomReferenceCode,
} from "../app/lib/custom-challenges.ts";

function challengeInput(overrides = {}) {
  return {
    statement:
      "Return a new list containing the input values in reverse order without mutating the input.",
    entrypoint: { kind: "function", name: "reverse_values" },
    parameters: [
      {
        name: "values",
        type: "list[int]",
        description: "Values in their original order.",
        codec: "json",
      },
    ],
    returns: "list[int] — the values in reverse order.",
    constraints: [
      "values may be empty.",
      "Every value is an integer.",
      "Do not mutate values.",
    ],
    notes: ["Return a list rather than an iterator."],
    exampleExplanation: "Reversing [1, 2, 3] produces [3, 2, 1].",
    starterCode:
      'def reverse_values(values: list[int]) -> list[int]:\n    raise NotImplementedError("Implement reverse_values")',
    cases: [
      {
        id: "sample-basic",
        name: "reverses a populated list",
        visibility: "sample",
        args: [[1, 2, 3]],
        expected: [3, 2, 1],
        outputCodec: "json",
        comparator: "deepEqual",
      },
      {
        id: "hidden-empty",
        name: "handles an empty list",
        visibility: "hidden",
        args: [[]],
        expected: [],
        outputCodec: "json",
        comparator: "deepEqual",
      },
    ],
    ...overrides,
  };
}

test("custom challenge normalization produces a canonical local judge bundle", () => {
  const bundle = normalizeCustomChallenge(challengeInput(), {
    stableId: "custom:reverse",
    title: "Reverse values",
    revision: 7,
  });
  assert.equal(bundle.challenge.id, "custom:reverse");
  assert.equal(bundle.challenge.entrypoint, "reverse_values(values)");
  assert.equal(bundle.verification.revision, 7);
  assert.deepEqual(bundle.verification.entrypoint, {
    kind: "function",
    name: "reverse_values",
  });
  assert.deepEqual(bundle.verification.cases.map((value) => value.visibility), [
    "sample",
    "hidden",
  ]);
  assert.deepEqual(bundle.verification.cases[0].argCodecs, ["json"]);
  assert.equal(bundle.starterCode.includes("NotImplementedError"), true);

  const restored = customChallengeInputFromBundle(bundle);
  assert.deepEqual(
    normalizeCustomChallenge(restored, {
      stableId: "custom:reverse",
      title: "Reverse values",
      revision: 7,
    }),
    bundle,
  );
});

test("method entrypoints and structured codecs remain closed data", () => {
  const input = challengeInput({
    entrypoint: { kind: "method", className: "Solution", name: "invert" },
    parameters: [
      {
        name: "root",
        type: "TreeNode | None",
        description: "Root of a binary tree.",
        codec: "binaryTree",
      },
    ],
    starterCode:
      "class Solution:\n    def invert(self, root):\n        raise NotImplementedError('Implement invert')",
    cases: [
      {
        name: "visible tree",
        visibility: "sample",
        args: [[2, 1, 3]],
        expected: [2, 3, 1],
        outputCodec: "binaryTree",
        comparator: "deepEqual",
      },
      {
        name: "hidden empty tree",
        visibility: "hidden",
        args: [null],
        expected: null,
        outputCodec: "binaryTree",
        comparator: "deepEqual",
      },
    ],
  });
  const bundle = normalizeCustomChallenge(input, {
    stableId: "custom:tree",
    title: "Invert tree",
  });
  assert.equal(bundle.challenge.entrypoint, "Solution.invert(root)");
  assert.deepEqual(bundle.verification.cases[0].argCodecs, ["binaryTree"]);
});

test("challenge authoring fails closed on identifiers, enums, visibility, and arity", () => {
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({ entrypoint: { kind: "function", name: "bad-name" } }),
        { stableId: "custom:x", title: "Bad" },
      ),
    /Python identifier/,
  );
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({
          parameters: [
            {
              name: "values",
              type: "list[int]",
              description: "Values.",
              codec: "executable-python",
            },
          ],
        }),
        { stableId: "custom:x", title: "Bad" },
      ),
    /unsupported input shape/,
  );
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({
          cases: challengeInput().cases.map((value) => ({
            ...value,
            visibility: "sample",
          })),
        }),
        { stableId: "custom:x", title: "Bad" },
      ),
    /hidden judge case/,
  );
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({
          cases: challengeInput().cases.map((value) => ({ ...value, args: [] })),
        }),
        { stableId: "custom:x", title: "Bad" },
      ),
    /needs 1 argument/,
  );
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({
          cases: challengeInput().cases.map((value, index) => ({
            ...value,
            comparator: index === 0 ? "python-expression" : "deepEqual",
          })),
        }),
        { stableId: "custom:x", title: "Bad" },
      ),
    /unsupported comparison/,
  );
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({
          starterCode: "def another_name(values):\n    raise NotImplementedError",
        }),
        { stableId: "custom:x", title: "Bad" },
      ),
    /must define reverse_values/,
  );
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({
          starterCode: "def reverse_values(first, second):\n    raise NotImplementedError",
        }),
        { stableId: "custom:x", title: "Bad arity" },
      ),
    /must accept exactly 1 challenge argument/,
  );
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({
          entrypoint: { kind: "method", className: "Solution", name: "reverse_values" },
          starterCode:
            "class Solution:\n    pass\n\ndef reverse_values(values):\n    raise NotImplementedError",
        }),
        { stableId: "custom:x", title: "Bad method scope" },
      ),
    /at the callable scope/,
  );
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({
          entrypoint: { kind: "method", className: "Solution", name: "reverse_values" },
          starterCode:
            "class Solution:\n    def helper(self):\n        def reverse_values(self, values):\n            raise NotImplementedError",
        }),
        { stableId: "custom:x", title: "Nested method" },
      ),
    /at the callable scope/,
  );
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({
          starterCode: "def reverse_values(values):\n    if",
        }),
        { stableId: "custom:x", title: "Invalid Python" },
      ),
    /valid Python syntax/,
  );
});

test("challenge inputs enforce count, JSON depth, and UTF-8 source boundaries", () => {
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({ parameters: [] }),
        { stableId: "custom:x", title: "No args" },
      ),
    /Use 1-8 parameters/,
  );
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({
          constraints: Array.from(
            { length: CUSTOM_CHALLENGE_LIMITS.constraints + 1 },
            (_, index) => `Constraint ${index}`,
          ),
        }),
        { stableId: "custom:x", title: "Too many" },
      ),
    /at most 12 constraints/,
  );
  let nested = null;
  for (let index = 0; index < CUSTOM_CHALLENGE_LIMITS.jsonDepth + 2; index += 1)
    nested = [nested];
  assert.throws(
    () =>
      normalizeCustomChallenge(
        challengeInput({
          cases: challengeInput().cases.map((value) => ({
            ...value,
            expected: nested,
          })),
        }),
        { stableId: "custom:x", title: "Deep" },
      ),
    /nested too deeply/,
  );
  assert.throws(
    () => normalizeCustomReferenceCode("def solve():\n    return '" + "界".repeat(17_000) + "'"),
    /UTF-8 bytes/,
  );
});

test("custom challenge revisions separate metadata, content, judge, and reference changes", () => {
  const created = normalizeCustomChallenge(challengeInput(), {
    stableId: "custom:reverse",
    title: "Reverse values",
    revision: 1,
  });
  const renamed = normalizeCustomChallenge(challengeInput(), {
    stableId: "custom:reverse",
    title: "Reverse a list",
    revision: 1,
  });
  const renameTransition = deriveCustomChallengeRevisions({
    current: created,
    requested: renamed,
    contentRevision: 1,
    judgeRevision: 1,
  });
  assert.equal(renameTransition.contentRevision, 1);
  assert.equal(renameTransition.judgeRevision, 1);

  const promptChanged = normalizeCustomChallenge(
    challengeInput({
      statement:
        "Return a fresh list with all values in reverse order; the original input must remain untouched.",
    }),
    { stableId: "custom:reverse", title: "Reverse a list", revision: 1 },
  );
  const promptTransition = deriveCustomChallengeRevisions({
    current: renamed,
    requested: promptChanged,
    contentRevision: 1,
    judgeRevision: 1,
  });
  assert.equal(promptTransition.contentRevision, 2);
  assert.equal(promptTransition.judgeRevision, 1);

  const judgeChangedInput = challengeInput({
    statement:
      "Return a fresh list with all values in reverse order; the original input must remain untouched.",
    cases: challengeInput().cases.map((value, index) =>
      index === 1 ? { ...value, args: [[9]], expected: [9] } : value,
    ),
  });
  const judgeChanged = normalizeCustomChallenge(judgeChangedInput, {
    stableId: "custom:reverse",
    title: "Reverse a list",
    revision: 1,
  });
  const judgeTransition = deriveCustomChallengeRevisions({
    current: promptChanged,
    requested: judgeChanged,
    contentRevision: 2,
    judgeRevision: 1,
  });
  assert.equal(judgeTransition.contentRevision, 3);
  assert.equal(judgeTransition.judgeRevision, 2);

  const referenceTransition = deriveCustomChallengeRevisions({
    current: judgeChanged,
    requested: judgeChanged,
    contentRevision: 3,
    judgeRevision: 2,
    referenceChanged: true,
  });
  assert.equal(referenceTransition.contentRevision, 4);
  assert.equal(referenceTransition.judgeRevision, 2);
});
