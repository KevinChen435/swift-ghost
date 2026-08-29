import assert from "node:assert/strict";
import test from "node:test";
import { searchLauncherItems } from "../app/lib/launcher-search.mjs";

const item = (overrides = {}) => ({
  itemId: "python:1",
  slug: "two-sum",
  title: "Two Sum",
  pattern: "Arrays & Hashing",
  tags: ["hash map", "lookup"],
  summary: "Find a pair with the target sum.",
  cue: "Track complements as you scan.",
  invariant: "Every seen value has a remembered index.",
  ...overrides,
});

test("launcher search ranks exact identifiers and title prefixes first", () => {
  const matches = searchLauncherItems([
    item({ itemId: "python:20", slug: "binary-search", title: "Binary Search" }),
    item({ itemId: "python:1", slug: "two-sum", title: "Two Sum" }),
    item({ itemId: "python:2", slug: "two-sum-ii", title: "Two Sum II" }),
  ], "two-sum");
  assert.deepEqual(matches.map((match) => match.item.itemId), ["python:1", "python:2"]);
  assert.ok(matches[0].score > matches[1].score);
});

test("launcher search matches patterns, tags, and multi-token queries", () => {
  const matches = searchLauncherItems([
    item({ itemId: "swift:window", title: "Stable Window", pattern: "Sliding Window", tags: ["two pointers"] }),
    item({ itemId: "python:graph", title: "Graph Walk", pattern: "Graph Traversal", tags: ["bfs"] }),
  ], "sliding window");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].item.itemId, "swift:window");
});

test("launcher search excludes archived items and respects a bounded limit", () => {
  const items = Array.from({ length: 12 }, (_, index) => item({
    itemId: `python:${index + 1}`,
    title: `Hash Map Drill ${index + 1}`,
    tags: ["hash"],
    archivedAt: index === 0 ? "2026-01-01T00:00:00.000Z" : undefined,
  }));
  const matches = searchLauncherItems(items, "hash", { limit: 4 });
  assert.equal(matches.length, 4);
  assert.ok(matches.every((match) => !match.item.archivedAt));
});

test("empty or incomplete queries return no problem rows", () => {
  const values = searchLauncherItems([item()], "");
  assert.deepEqual(values, []);
  assert.deepEqual(searchLauncherItems([item()], "nonexistent"), []);
});
