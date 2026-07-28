import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionQueue,
  resolveSessionCurrentIndex,
} from "../app/lib/sessions.mjs";

const items = [
  { itemId: "builtin:1", pattern: "Arrays & Hashing", difficulty: "Easy", source: "builtin", track: "interview", language: "swift" },
  { itemId: "builtin:2", pattern: "Two Pointers", difficulty: "Medium", source: "builtin", track: "interview", language: "swift" },
  { itemId: "ios:1", pattern: "Concurrency", difficulty: "Medium", source: "builtin", track: "ios", language: "swift" },
  { itemId: "custom:one", pattern: "Arrays & Hashing", difficulty: "Easy", source: "custom", track: "interview", language: "swift" },
  { itemId: "transfer:sealed", pattern: "Graphs", difficulty: "Medium", source: "builtin", track: "interview", language: "python", transfer: { id: "sealed" } },
];

const signals = {
  "builtin:1": { due: true, favorite: false, completions: 2, recommendedStage: 3 },
  "builtin:2": { due: false, favorite: true, completions: 0, recommendedStage: 1 },
  "custom:one": { due: false, favorite: true, completions: 1, recommendedStage: 4 },
  "ios:1": { due: false, favorite: false, completions: 0, recommendedStage: 2 },
  "transfer:sealed": { due: true, favorite: true, completions: 0, recommendedStage: 5 },
};

test("mixed sessions put due work before new and practiced work", () => {
  const queue = buildSessionQueue(items, signals, { count: 4, source: "mixed", track: "all", language: "all", pattern: "All", difficulty: "All", stageMode: "recommended" }, () => 0.5);
  assert.deepEqual(queue.map((entry) => entry.itemId), ["builtin:1", "builtin:2", "ios:1", "custom:one"]);
  assert.deepEqual(queue.map((entry) => entry.stage), [3, 1, 2, 4]);
});

test("generic session sources never surface sealed transfer variants", () => {
  for (const source of ["mixed", "new", "due", "favorites"]) {
    const queue = buildSessionQueue(
      items,
      signals,
      {
        count: 20,
        source,
        track: "all",
        language: "all",
        pattern: "All",
        difficulty: "All",
        stageMode: "recommended",
      },
      () => 0.2,
    );
    assert.equal(
      queue.some((entry) => entry.itemId === "transfer:sealed"),
      false,
      `${source} leaked a transfer variant`,
    );
  }
});

test("filters and recall mode create a bounded blank-editor queue", () => {
  const queue = buildSessionQueue(items, signals, { count: 20, source: "favorites", track: "all", language: "all", pattern: "Arrays & Hashing", difficulty: "Easy", stageMode: "recall" }, () => 0.1);
  assert.deepEqual(queue, [{ itemId: "custom:one", itemRevision: 1, stage: 5, status: "pending" }]);
});

test("due sessions do not silently fall back to unrelated items", () => {
  const queue = buildSessionQueue(items, signals, { count: 5, source: "due", track: "all", language: "all", pattern: "Two Pointers", difficulty: "All", stageMode: "recommended" });
  assert.deepEqual(queue, []);
});

test("track filters combine cleanly with session sources", () => {
  const ios = buildSessionQueue(items, signals, { count: 5, source: "new", track: "ios", language: "swift", pattern: "All", difficulty: "All", stageMode: "recommended" }, () => 0.2);
  const interview = buildSessionQueue(items, signals, { count: 5, source: "mixed", track: "interview", language: "all", pattern: "All", difficulty: "All", stageMode: "recommended" }, () => 0.2);
  assert.deepEqual(ios.map((entry) => entry.itemId), ["ios:1"]);
  assert.equal(interview.some((entry) => entry.itemId === "ios:1"), false);
  const iosCustom = buildSessionQueue(items, signals, { count: 5, source: "custom", track: "ios", language: "swift", pattern: "All", difficulty: "All", stageMode: "recommended" }, () => 0.2);
  assert.deepEqual(iosCustom, []);
});

test("language filters keep corresponding Python and Swift problems independent", () => {
  const variants = [
    { itemId: "builtin:1", pattern: "Arrays & Hashing", difficulty: "Easy", source: "builtin", track: "interview", language: "swift" },
    { itemId: "python:1", pattern: "Arrays & Hashing", difficulty: "Easy", source: "builtin", track: "interview", language: "python" },
  ];
  const variantSignals = { "builtin:1": { recommendedStage: 3 }, "python:1": { recommendedStage: 1 } };
  const python = buildSessionQueue(variants, variantSignals, { count: 5, source: "mixed", track: "interview", language: "python", pattern: "All", difficulty: "All", stageMode: "recommended" }, () => 0.2);
  assert.deepEqual(python.map((entry) => entry.itemId), ["python:1"]);
});

test("session migration keeps the current pending task after invalid entries are removed", () => {
  const compacted = [
    { rawIndex: 1, status: "pending" },
    { rawIndex: 2, status: "pending" },
  ];
  assert.equal(resolveSessionCurrentIndex(compacted, 1), 0);
  assert.equal(resolveSessionCurrentIndex(compacted, 2), 1);
});

test("authored iOS items enter sessions as concept recall", () => {
  const ios = {
    itemId: "ios:ownership",
    contentRevision: 2,
    track: "ios",
    language: "swift",
    source: "builtin",
    pattern: "Memory Management",
    difficulty: "Easy",
    recallChecks: ["one", "two", "three"],
    conceptAnswers: ["a", "b", "c"],
  };
  const [entry] = buildSessionQueue(
    [ios],
    { [ios.itemId]: { itemRevision: 2, recommendedStage: 5 } },
    { count: 1, source: "mixed", track: "ios", language: "swift", pattern: "All", difficulty: "All", stageMode: "recommended" },
    () => 0,
  );
  assert.equal(entry.practiceKind, "concept");
});
