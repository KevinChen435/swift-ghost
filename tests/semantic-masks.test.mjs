import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  generateSemanticMasks,
  normalizeSemanticMask,
  normalizeSemanticMasks,
  SEMANTIC_MASK_LIMITS,
} from "../app/lib/semantic-masks.mjs";

const SOURCE =
  "func stableEvenFilter(_ values: [Int]) -> [Int] {\n" +
  "    var result: [Int] = []\n" +
  "    for value in values {\n" +
  "        if value % 2 == 0 { result.append(value) }\n" +
  "    }\n" +
  "    return result\n" +
  "}";

test("generated semantic masks round-trip with exact source geometry", () => {
  const generated = generateSemanticMasks(SOURCE, "swift");
  assert.deepEqual(Object.keys(generated).sort(), ["2", "3", "4"]);
  for (const stage of [2, 3, 4]) {
    const mask = generated[stage];
    assert.equal(mask.length, SOURCE.length);
    assert.deepEqual(
      [...mask].flatMap((value, index) => (value === "\n" ? [index] : [])),
      [...SOURCE].flatMap((value, index) => (value === "\n" ? [index] : [])),
    );
    assert.deepEqual(normalizeSemanticMask(mask, SOURCE), mask);
  }
  assert.deepEqual(normalizeSemanticMasks(generated, SOURCE), generated);
});

test("semantic mask normalization bounds text and canonicalizes line endings", () => {
  const oneLine = "func example() {}";
  const crlf = "func example() {}";
  assert.equal(
    normalizeSemanticMask(crlf.replace(" ", "\r\n"), oneLine),
    null,
  );
  const multiline = "func example() {\n    return 1\n}";
  const normalized = normalizeSemanticMask(
    "func example() {\r\n    return 1\r\n}",
    multiline,
  );
  assert.equal(normalized, multiline);
  const oversized = "a".repeat(SEMANTIC_MASK_LIMITS.maxCharacters + 1);
  assert.equal(normalizeSemanticMask(oversized, oversized), null);
});

test("malformed imports keep only valid stage masks", () => {
  const generated = generateSemanticMasks(SOURCE, "swift");
  const imported = normalizeSemanticMasks(
    {
      2: generated[2],
      3: "wrong shape",
      4: 42,
      5: generated[4],
      secret: "not imported",
    },
    SOURCE,
  );
  assert.deepEqual(imported, { 2: generated[2] });
});

test("the studio exposes bounded, local-only semantic mask authoring", async () => {
  const studio = await readFile(
    new URL("../app/components/CustomChallengeDialog.tsx", import.meta.url),
    "utf8",
  );
  const items = await readFile(
    new URL("../app/lib/items.ts", import.meta.url),
    "utf8",
  );
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  for (const text of [studio, items, product]) assert.match(text, /semantic/i);
  assert.match(studio, /Generate defaults/);
  assert.match(studio, /Clear masks/);
  assert.match(studio, /character positions and line breaks/);
  assert.match(studio, /never uploaded, judged, or stored as evidence/);
  assert.match(studio, /maxLength=\{20_000\}/);
  assert.match(items, /masksChanged/);
  assert.match(items, /referenceChanged: code !== item\.code \|\| masksChanged/);
  assert.match(items, /masks: masksAllowed \? masks : undefined/);
  assert.match(product, /normalizeSemanticMasks\(item\.masks, normalizedCode\)/);
  assert.match(product, /normalizedLanguage === "swift" && !challengeBundle/);
  assert.doesNotMatch(product, /cloud.*masks/i);
});
