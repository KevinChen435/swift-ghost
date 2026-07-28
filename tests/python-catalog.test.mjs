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
  assert.equal((source.match(/^    starterCode: `/gm) ?? []).length, 36);
  assert.equal((source.match(/^    code: `/gm) ?? []).length, 36);
  assert.equal((source.match(/^    verification: \{/gm) ?? []).length, 36);
  assert.equal((source.match(/^          name:/gm) ?? []).length, 144);

  const starters = [
    ...source.matchAll(/^    starterCode: `([\s\S]*?)`,$/gm),
  ].map((match) => match[1]);
  const solutions = [...source.matchAll(/^    code: `([\s\S]*?)`,$/gm)].map(
    (match) => match[1],
  );
  const entrypointKinds = [
    ...source.matchAll(/^        kind: "(function|method)",$/gm),
  ].map((match) => match[1]);
  const entrypointNames = [
    ...source.matchAll(/^        name: "([^"]+)",$/gm),
  ].map((match) => match[1]);

  assert.equal(starters.length, 36);
  assert.equal(solutions.length, 36);
  assert.equal(entrypointKinds.length, 36);
  assert.equal(entrypointNames.length, 36);

  starters.forEach((starter, index) => {
    assert.match(starter, new RegExp(`\\bdef ${entrypointNames[index]}\\(`));
    assert.equal(
      starter.includes("pass") || starter.includes("NotImplementedError"),
      true,
    );
    assert.equal(starter.includes("return "), false);
    assert.notEqual(starter, solutions[index]);

    if (entrypointKinds[index] === "method") {
      assert.match(starter, /^class Solution:/m);
    }

    const requiredImports = solutions[index]
      .split(/\r?\n/)
      .filter((line) => /^(?:from |import )/.test(line));
    for (const requiredImport of requiredImports) {
      assert.equal(starter.split(/\r?\n/).includes(requiredImport), true);
    }
  });

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
  assert.equal((advanced.match(/^    starterCode: `/gm) ?? []).length, 12);
  assert.equal((advanced.match(/^    code: `/gm) ?? []).length, 12);
  assert.equal((advanced.match(/^    verification: \{/gm) ?? []).length, 12);
  assert.equal((advanced.match(/^          name:/gm) ?? []).length, 60);

  const advancedStarters = [
    ...advanced.matchAll(/^    starterCode: `([\s\S]*?)`,$/gm),
  ].map((match) => match[1]);
  const advancedSolutions = [
    ...advanced.matchAll(/^    code: `([\s\S]*?)`,$/gm),
  ].map((match) => match[1]);
  const advancedEntrypoints = [
    ...advanced.matchAll(/entrypoint:\s*\{[\s\S]*?name: "([^"]+)"[\s\S]*?\},/g),
  ].map((match) => match[1]);
  assert.equal(advancedStarters.length, 12);
  assert.equal(advancedSolutions.length, 12);
  assert.equal(advancedEntrypoints.length, 12);
  advancedStarters.forEach((starter, index) => {
    assert.match(
      starter,
      new RegExp(`\\bdef ${advancedEntrypoints[index]}\\(`),
    );
    assert.equal(
      starter.includes("pass") || starter.includes("NotImplementedError"),
      true,
    );
    assert.notEqual(starter, advancedSolutions[index]);
  });

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
