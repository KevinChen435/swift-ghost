import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
  generateSemanticMasks,
  normalizeSemanticMask,
  normalizeSemanticMasks,
  SEMANTIC_MASK_LIMITS,
} from "../app/lib/semantic-masks.mjs";

const execFileAsync = promisify(execFile);

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

test("Swift/iOS custom items persist masks, revise content, and sanitize imports", async () => {
  const itemsUrl = new URL("../app/lib/items.ts", import.meta.url).href;
  const productUrl = new URL("../app/lib/product.ts", import.meta.url).href;
  const masksUrl = new URL("../app/lib/semantic-masks.mjs", import.meta.url).href;
  const script = `
    import assert from "node:assert/strict";
    import { makeCustomItem, updateCustomItem } from ${JSON.stringify(itemsUrl)};
    import { EMPTY_STATE, normalizeState } from ${JSON.stringify(productUrl)};
    import { generateSemanticMasks } from ${JSON.stringify(masksUrl)};
    const source = ${JSON.stringify(SOURCE)};
    const masks = generateSemanticMasks(source, "swift");
    const input = (overrides = {}) => ({
      title: "Local Swift drill", track: "ios", language: "swift",
      pattern: "Swift Semantics", difficulty: "Easy", code: source,
      cue: "Preserve the value while changing only the copy.",
      invariant: "The original value remains unchanged.", complexity: "O(n) time.",
      languageNote: "Arrays use copy-on-write storage.", ...overrides,
    });
    const item = makeCustomItem(input({ masks }));
    assert.deepEqual(item.masks, masks);
    assert.equal(item.solveCapability, undefined);
    const updated = updateCustomItem(item, input({ masks: { 2: masks[2] } }));
    assert.deepEqual(updated.masks, { 2: masks[2] });
    assert.equal(updated.contentRevision, item.contentRevision + 1);
    const unchanged = updateCustomItem(updated, input({ masks: { 2: masks[2] } }));
    assert.equal(unchanged.contentRevision, updated.contentRevision);
    const python = makeCustomItem(input({
      title: "Local Python drill", track: "interview", language: "python",
      pattern: "Two Pointers", code: "def example(values):\\n    return values", masks,
    }));
    assert.equal(python.masks, undefined);
    const itemId = "custom:imported-swift";
    const restored = normalizeState({
      ...EMPTY_STATE,
      customItems: [{ itemId, source: "custom", track: "ios", language: "swift",
        title: "Imported Swift", code: source, pattern: "Swift Semantics",
        difficulty: "Easy", masks: { 2: masks[2], 3: "not the same shape" } }],
      lastItemId: itemId,
    });
    assert.equal(restored.customItems.length, 1);
    assert.deepEqual(restored.customItems[0].masks, { 2: masks[2] });
  `;
  await execFileAsync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
    cwd: new URL("..", import.meta.url),
  });
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

test("built-in curriculum items ship authored semantic masks across Python, Swift, and iOS", async () => {
  const items = await readFile(
    new URL("../app/lib/items.ts", import.meta.url),
    "utf8",
  );
  const targetIds = [
    "python:1",
    "python:49",
    "python:125",
    "builtin:1",
    "builtin:49",
    "ios:value-reference-snapshots",
    "ios:copy-on-write-draft",
  ];

  for (const itemId of targetIds) {
    assert.match(items, new RegExp(`"${itemId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.match(items, /AUTHORED_SEMANTIC_MASK_PLANS/);
  assert.match(items, /generateSemanticMasks\(code, language\)/);
  assert.match(items, /maskByPreservedLines\(code, preservedLines\)/);
  assert.match(items, /masks: authoredSemanticMasksForItem/);
  assert.match(items, /normalizeSemanticMasks\(masks, code\)/);
  assert.match(items, /problem\.code,\s*"python"/);
  assert.match(items, /problem\.code,\s*"swift"/);
  assert.match(items, /fundamental\.code,\s*"swift"/);
});
