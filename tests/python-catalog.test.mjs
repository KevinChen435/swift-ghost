import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Python curriculum has stable unique identities and complete learning metadata", async () => {
  const source = await readFile(
    new URL("../app/data/python-problems.ts", import.meta.url),
    "utf8",
  );
  const advanced = await readFile(
    new URL("../app/data/advanced-python-problems.ts", import.meta.url),
    "utf8",
  );
  const ids = [...source.matchAll(/^    id: (\d+),$/gm)].map((match) =>
    Number(match[1]),
  );
  const slugs = [...source.matchAll(/^    slug: "([^"]+)",$/gm)].map(
    (match) => match[1],
  );
  assert.equal(ids.length, 36);
  assert.equal(new Set(ids).size, 36);
  assert.equal(new Set(slugs).size, 36);
  assert.equal(ids.filter((id) => id >= 10001 && id <= 10008).length, 8);
  assert.equal(
    (
      source.match(
        /^\s*sourceUrl:\s*(?:\r?\n\s*)?"https:\/\/leetcode\.com\/problems\//gm,
      ) ?? []
    ).length,
    28,
  );
  assert.equal((source.match(/^    languageNote:/gm) ?? []).length, 36);
  assert.equal((source.match(/^    recallChecks: \[/gm) ?? []).length, 36);
  assert.equal((source.match(/^    code: `/gm) ?? []).length, 36);
  assert.equal((source.match(/^    verification: \{/gm) ?? []).length, 36);
  assert.equal((source.match(/^          name:/gm) ?? []).length, 108);

  const advancedIds = [...advanced.matchAll(/^    id: (\d+),$/gm)].map(
    (match) => Number(match[1]),
  );
  assert.equal(advancedIds.length, 12);
  assert.equal(new Set(advancedIds).size, 12);
  assert.equal(
    advancedIds.some((id) => ids.includes(id)),
    false,
  );
  assert.equal((advanced.match(/^    difficulty: "Hard",$/gm) ?? []).length, 5);
  assert.equal((advanced.match(/^    verification: \{/gm) ?? []).length, 12);
  assert.equal((advanced.match(/^          name:/gm) ?? []).length, 36);

  for (const pattern of [
    "Python Fluency",
    "Arrays & Hashing",
    "Two Pointers",
    "Sliding Window",
    "Stack",
    "Binary Search",
    "Linked List",
    "Trees",
    "Heaps & Priority Queues",
    "Intervals",
    "Graphs",
    "Backtracking",
    "Greedy",
    "Dynamic Programming",
  ])
    assert.match(
      source,
      new RegExp(
        `pattern: "${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
      ),
    );

  for (const pattern of ["Tries", "Union-Find", "Bit Manipulation"]) {
    assert.match(advanced, new RegExp(`pattern: "${pattern}"`));
  }
});
