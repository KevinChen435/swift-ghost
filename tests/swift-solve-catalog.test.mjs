import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("catalog exposes the sealed Swift solve lane without hidden cases", async () => {
  const [items, challenges] = await Promise.all([
    readFile(new URL("../app/lib/items.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/swift-challenges.ts", import.meta.url), "utf8"),
  ]);
  assert.match(items, /export const SWIFT_SOLVE_ITEMS: PracticeItem\[\] = SWIFT_CHALLENGES\.map/);
  assert.match(items, /solveCapability: "server"/);
  assert.match(items, /trustedChallengeKey: challenge\.key/);
  assert.match(items, /`swift:\$\{challenge\.key\}`/);
  assert.match(items, /item\.language === "swift" && Boolean\(item\.trustedChallengeKey\)/);
  assert.equal((challenges.match(/key: "swift-[a-z-]+"/g) ?? []).length, 8);
  assert.doesNotMatch(challenges, /hiddenCases/);
});
