import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("catalog exposes the sealed Swift solve lane without hidden cases", async () => {
  const [items, challenges, statement] = await Promise.all([
    readFile(new URL("../app/lib/items.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/swift-challenges.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ChallengeStatement.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(items, /export const SWIFT_SOLVE_ITEMS: PracticeItem\[\] = SWIFT_CHALLENGES\.map/);
  assert.match(items, /solveCapability: "server"/);
  assert.match(items, /trustedChallengeKey: challenge\.key/);
  assert.match(items, /`swift:\$\{challenge\.key\}`/);
  assert.match(items, /item\.language === "swift" && Boolean\(item\.trustedChallengeKey\)/);
  assert.equal((challenges.match(/key: "swift-[a-z-]+"/g) ?? []).length, 18);
  assert.doesNotMatch(challenges, /hiddenCases/);
  assert.match(statement, /getSwiftChallenge/);
  assert.match(statement, /Private sealed judge/);
});

test("public Swift projections stay aligned with the worker-owned sealed bank", async () => {
  const [{ SWIFT_CHALLENGES }, worker] = await Promise.all([
    import("../app/data/swift-challenges.ts"),
    import("../worker/trusted-assessments.mjs"),
  ]);
  const publicKeys = SWIFT_CHALLENGES.map((challenge) => challenge.key);
  const workerKeys = publicKeys.map((key) => worker.trustedChallengeForKey(key)?.key);
  assert.deepEqual(workerKeys, publicKeys);
  for (const challenge of SWIFT_CHALLENGES) {
    const trusted = worker.trustedChallengeForKey(challenge.key);
    assert.ok(trusted, challenge.key);
    assert.equal(trusted.samples.length, 2, challenge.key);
    assert.ok(trusted.hiddenCases.length >= 4, challenge.key);
    assert.equal(trusted.entrypoint.name, challenge.entrypoint.name, challenge.key);
    assert.equal(trusted.entrypoint.returns, challenge.entrypoint.returns, challenge.key);
    const projection = worker.publicTrustedChallenge(trusted);
    assert.equal(Object.hasOwn(projection, "hiddenCases"), false);
    assert.deepEqual(projection.samples, challenge.samples, challenge.key);
  }
});
