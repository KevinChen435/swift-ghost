import test from "node:test";
import assert from "node:assert/strict";
import { buildSessionQueue } from "../app/lib/sessions.mjs";

const items = [
  { itemId: "builtin:1", pattern: "Arrays & Hashing", difficulty: "Easy", source: "builtin", track: "interview" },
  { itemId: "builtin:2", pattern: "Two Pointers", difficulty: "Medium", source: "builtin", track: "interview" },
  { itemId: "ios:1", pattern: "Concurrency", difficulty: "Medium", source: "builtin", track: "ios" },
  { itemId: "custom:one", pattern: "Arrays & Hashing", difficulty: "Easy", source: "custom", track: "interview" },
];

const signals = {
  "builtin:1": { due: true, favorite: false, completions: 2, recommendedStage: 3 },
  "builtin:2": { due: false, favorite: true, completions: 0, recommendedStage: 1 },
  "custom:one": { due: false, favorite: true, completions: 1, recommendedStage: 4 },
  "ios:1": { due: false, favorite: false, completions: 0, recommendedStage: 2 },
};

test("mixed sessions put due work before new and practiced work", () => {
  const queue = buildSessionQueue(items, signals, { count: 4, source: "mixed", track: "all", pattern: "All", difficulty: "All", stageMode: "recommended" }, () => 0.5);
  assert.deepEqual(queue.map((entry) => entry.itemId), ["builtin:1", "builtin:2", "ios:1", "custom:one"]);
  assert.deepEqual(queue.map((entry) => entry.stage), [3, 1, 2, 4]);
});

test("filters and recall mode create a bounded blank-editor queue", () => {
  const queue = buildSessionQueue(items, signals, { count: 20, source: "favorites", track: "all", pattern: "Arrays & Hashing", difficulty: "Easy", stageMode: "recall" }, () => 0.1);
  assert.deepEqual(queue, [{ itemId: "custom:one", itemRevision: 1, stage: 5, status: "pending" }]);
});

test("due sessions do not silently fall back to unrelated items", () => {
  const queue = buildSessionQueue(items, signals, { count: 5, source: "due", track: "all", pattern: "Two Pointers", difficulty: "All", stageMode: "recommended" });
  assert.deepEqual(queue, []);
});

test("track filters combine cleanly with session sources", () => {
  const ios = buildSessionQueue(items, signals, { count: 5, source: "new", track: "ios", pattern: "All", difficulty: "All", stageMode: "recommended" }, () => 0.2);
  const interview = buildSessionQueue(items, signals, { count: 5, source: "mixed", track: "interview", pattern: "All", difficulty: "All", stageMode: "recommended" }, () => 0.2);
  assert.deepEqual(ios.map((entry) => entry.itemId), ["ios:1"]);
  assert.equal(interview.some((entry) => entry.itemId === "ios:1"), false);
  const iosCustom = buildSessionQueue(items, signals, { count: 5, source: "custom", track: "ios", pattern: "All", difficulty: "All", stageMode: "recommended" }, () => 0.2);
  assert.deepEqual(iosCustom, []);
});
