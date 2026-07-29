import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

let bundledProductRuntime;

async function productRuntime() {
  if (!bundledProductRuntime) {
    bundledProductRuntime = build({
      entryPoints: [
        fileURLToPath(new URL("../app/lib/product.ts", import.meta.url)),
      ],
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      write: false,
      logLevel: "silent",
    }).then(({ outputFiles }) =>
      import(
        `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
      ),
    );
  }
  return bundledProductRuntime;
}

function rawState(version, runManifests) {
  return {
    version,
    attempts: [],
    settings: {},
    customItems: [],
    sessionHistory: [],
    ...(runManifests ? { runManifests } : {}),
  };
}

function manifest(status = "completed") {
  const base = {
    version: 1,
    id: "challenge-set-state-test",
    title: "Challenge Set · 2 problems",
    source: "catalog",
    mode: "practice",
    durationMinutes: null,
    status,
    execution: { kind: "session", id: "challenge-set-state-test" },
    createdAt: "2026-07-29T12:00:00.000Z",
    startedAt: "2026-07-29T12:00:01.000Z",
    entries: [
      {
        itemId: "python:1",
        contentRevision: 1,
        title: "Two Sum",
        lane: "python",
        difficulty: "Easy",
        estimatedMinutes: 10,
        order: 0,
        currentEvidenceEligible: true,
      },
      {
        itemId: "python:2",
        contentRevision: 1,
        title: "Valid Parentheses",
        lane: "python",
        difficulty: "Easy",
        estimatedMinutes: 10,
        order: 1,
        currentEvidenceEligible: true,
      },
    ],
  };
  return status === "active"
    ? base
    : { ...base, finishedAt: "2026-07-29T12:20:00.000Z" };
}

test("v33 migration creates an empty v34 Challenge Set workspace", async () => {
  const { normalizeState } = await productRuntime();
  const normalized = normalizeState(rawState(33));
  assert.equal(normalized.version, 34);
  assert.deepEqual(normalized.runManifests, { version: 1, manifests: [] });
});

test("v34 normalization preserves immutable finished Challenge Set history", async () => {
  const { normalizeState } = await productRuntime();
  const normalized = normalizeState(
    rawState(34, { version: 1, manifests: [manifest()] }),
  );
  assert.equal(normalized.runManifests.manifests.length, 1);
  assert.equal(normalized.runManifests.manifests[0].status, "completed");
  assert.deepEqual(
    normalized.runManifests.manifests[0].entries.map((entry) => entry.itemId),
    ["python:1", "python:2"],
  );
});

test("normalization ends an active manifest whose execution no longer survives", async () => {
  const { normalizeState } = await productRuntime();
  const normalized = normalizeState(
    rawState(34, { version: 1, manifests: [manifest("active")] }),
  );
  assert.equal(normalized.runManifests.manifests[0].status, "ended");
  assert.ok(normalized.runManifests.manifests[0].finishedAt);
});
