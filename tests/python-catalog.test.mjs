import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Python curriculum has stable unique identities and complete learning metadata", async () => {
  const source = await readFile(new URL("../app/data/python-problems.ts", import.meta.url), "utf8");
  const ids = [...source.matchAll(/^    id: (\d+),$/gm)].map((match) => Number(match[1]));
  const slugs = [...source.matchAll(/^    slug: "([^"]+)",$/gm)].map((match) => match[1]);
  assert.equal(ids.length, 36);
  assert.equal(new Set(ids).size, 36);
  assert.equal(new Set(slugs).size, 36);
  assert.equal(ids.filter((id) => id >= 10001 && id <= 10008).length, 8);
  assert.equal((source.match(/^    sourceUrl: "https:\/\/leetcode\.com\/problems\//gm) ?? []).length, 28);
  assert.equal((source.match(/^    languageNote:/gm) ?? []).length, 36);
  assert.equal((source.match(/^    recallChecks: \[/gm) ?? []).length, 36);
  assert.equal((source.match(/^    code: `/gm) ?? []).length, 36);

  for (const pattern of [
    "Python Fluency", "Arrays & Hashing", "Two Pointers", "Sliding Window", "Stack", "Binary Search",
    "Linked List", "Trees", "Heaps & Priority Queues", "Intervals", "Graphs", "Backtracking", "Greedy", "Dynamic Programming",
  ]) assert.match(source, new RegExp(`pattern: "${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
});
