import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeSwiftCasePack,
  importSwiftCasePack,
  parseSwiftCasePackArgs,
  swiftCaseValueMatches,
} from "../app/lib/swift-case-packs.mjs";

const challenge = Object.freeze({
  key: "swift-two-sum",
  language: "swift",
  runtime: "swift-6.3.3-linux",
  contentRevision: 3,
  judgeRevision: 5,
  title: "Two Sum in Swift",
  entrypoint: {
    kind: "function",
    name: "twoSum",
    parameters: [
      { name: "nums", type: "[Int]" },
      { name: "target", type: "Int" },
    ],
    returns: "[Int]",
  },
});

test("Swift case packs export only revision-bound public inputs", () => {
  const text = encodeSwiftCasePack({
    challenge,
    cases: [
      { name: "duplicate pair", args: [[3, 3], 6] },
      { name: "late complement", args: [[2, 7, 11, 15], 9] },
    ],
  });
  const raw = JSON.parse(text);
  assert.equal(raw.kind, "swift-ghost.swift-case-pack.v1");
  assert.equal(raw.challengeKey, challenge.key);
  assert.equal(raw.contentRevision, challenge.contentRevision);
  assert.equal(raw.judgeRevision, challenge.judgeRevision);
  assert.deepEqual(raw.cases.map((entry) => entry.args), [
    [[3, 3], 6],
    [[2, 7, 11, 15], 9],
  ]);
  assert.equal(text.includes("expected"), false);
  assert.equal(text.includes("source"), false);
  assert.equal(text.includes("hidden"), false);
});

test("Swift case pack import requires the same challenge revision", () => {
  const text = encodeSwiftCasePack({
    challenge,
    cases: [{ name: "simple", args: [[1, 2], 3] }],
  });
  assert.deepEqual(importSwiftCasePack(text, challenge), [
    { name: "simple", args: [[1, 2], 3] },
  ]);
  assert.throws(
    () =>
      importSwiftCasePack(text, {
        ...challenge,
        judgeRevision: challenge.judgeRevision + 1,
      }),
    /different Swift challenge revision/,
  );
});

test("Swift case packs reject expected values and invalid argument types", () => {
  const withExpected = {
    kind: "swift-ghost.swift-case-pack.v1",
    challengeKey: challenge.key,
    contentRevision: challenge.contentRevision,
    judgeRevision: challenge.judgeRevision,
    entrypoint: challenge.entrypoint,
    cases: [{ name: "leaky", args: [[1, 2], 3], expected: [0, 1] }],
  };
  assert.throws(
    () => importSwiftCasePack(JSON.stringify(withExpected), challenge),
    /inputs only/,
  );
  assert.throws(
    () =>
      encodeSwiftCasePack({
        challenge,
        cases: [{ name: "wrong target", args: [[1, 2], "3"] }],
      }),
    /target must be a Int value/,
  );
});

test("Swift case pack argument parsing matches supported Swift types", () => {
  assert.equal(swiftCaseValueMatches([["not int"]], "[[Int]]"), false);
  assert.equal(swiftCaseValueMatches([[1], [2, 3]], "[[Int]]"), true);
  assert.deepEqual(
    parseSwiftCasePackArgs('{"args":[["a","b"],"needle"]}', [
      { name: "haystack", type: "[String]" },
      { name: "needle", type: "String" },
    ]),
    [["a", "b"], "needle"],
  );
  assert.throws(
    () =>
      parseSwiftCasePackArgs("[[1,2]]", [
        { name: "nums", type: "[Int]" },
        { name: "target", type: "Int" },
      ]),
    /expects 2 arguments/,
  );
});
