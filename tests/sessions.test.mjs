import test from "node:test";
import assert from "node:assert/strict";
import { buildSessionQueue } from "../app/lib/sessions.mjs";

const items = [
  { itemId: "builtin:1", pattern: "Arrays & Hashing", difficulty: "Easy", source: "builtin" },
  { itemId: "builtin:2", pattern: "Two Pointers", difficulty: "Medium", source: "builtin" },
  { itemId: "custom:one", pattern: "Arrays & Hashing", difficulty: "Easy", source: "custom" },
];

const signals = {
  "builtin:1": { due: true, favorite: false, completions: 2, recommendedStage: 3 },
  "builtin:2": { due: false, favorite: true, completions: 0, recommendedStage: 1 },
  "custom:one": { due: false, favorite: true, completions: 1, recommendedStage: 4 },
};

test("mixed sessions put due work before new and practiced work", () => {
  const queue = buildSessionQueue(items, signals, { count: 3, source: "mixed", pattern: "All", difficulty: "All", stageMode: "recommended" }, () => 0.5);
  assert.deepEqual(queue.map((entry) => entry.itemId), ["builtin:1", "builtin:2", "custom:one"]);
  assert.deepEqual(queue.map((entry) => entry.stage), [3, 1, 4]);
});

test("filters and recall mode create a bounded blank-editor queue", () => {
  const queue = buildSessionQueue(items, signals, { count: 20, source: "favorites", pattern: "Arrays & Hashing", difficulty: "Easy", stageMode: "recall" }, () => 0.1);
  assert.deepEqual(queue, [{ itemId: "custom:one", itemRevision: 1, stage: 5, status: "pending" }]);
});

test("due sessions do not silently fall back to unrelated items", () => {
  const queue = buildSessionQueue(items, signals, { count: 5, source: "due", pattern: "Two Pointers", difficulty: "All", stageMode: "recommended" });
  assert.deepEqual(queue, []);
});
