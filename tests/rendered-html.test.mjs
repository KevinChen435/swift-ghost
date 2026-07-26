import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Swift Ghost practice shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Swift Ghost/);
  assert.match(html, /Type it\./);
  assert.match(html, /Fade it\./);
  assert.match(html, /Daily Type/);
  assert.match(html, /Build recall, one clean pass at a time/);
  assert.match(html, /Add snippet/);
  assert.match(html, /Sessions/);
  assert.match(html, /Records/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships the full five-stage practice model and original problem links", async () => {
  const page = await readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8");
  const product = await readFile(new URL("../app/lib/product.ts", import.meta.url), "utf8");
  const catalog = await readFile(new URL("../app/data/problems.ts", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const community = await readFile(new URL("../app/components/CommunityPanel.tsx", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

  for (const stage of [
    "Full ghost",
    "Missing expressions",
    "Missing lines",
    "Skeleton only",
    "Blank editor",
  ]) {
    assert.match(product, new RegExp(stage));
  }

  assert.match(product, /swift-ghost-state-v6/);
  assert.match(product, /swift-ghost-state-v5/);
  assert.match(product, /swift-ghost-state-v4/);
  assert.match(product, /swift-ghost-state-v3/);
  assert.match(product, /swift-ghost-state-v2/);
  assert.match(product, /localDayKey\(date\)}-catalog-v2/);
  assert.match(product, /replace\(\/\\r\\n\?\/g, "\\n"\)/);
  assert.match(product, /correctKeystrokes/);
  assert.match(product, /keyErrors: Record<string, number>/);
  assert.match(product, /keyErrors: normalizeKeyErrors\(rawDraft\.keyErrors\)/);
  assert.match(product, /outcome: "completed" \| "abandoned"/);
  assert.match(catalog, /`https:\/\/leetcode\.com\/problems\/\$\{problem\.slug\}\/`/);
  assert.equal((catalog.match(/^    id:/gm) ?? []).length, 50);
  const fundamentals = await readFile(new URL("../app/data/fundamentals.ts", import.meta.url), "utf8");
  assert.equal((fundamentals.match(/^    id: "ios:/gm) ?? []).length, 16);
  assert.equal((fundamentals.match(/^    sourceUrl: "https:\/\/(?:developer\.apple\.com|docs\.swift\.org)/gm) ?? []).length, 16);
  assert.equal((fundamentals.match(/^    recallChecks: \[/gm) ?? []).length, 16);
  assert.match(page, /iOS reactivation/);
  assert.match(page, /Key friction/);
  assert.match(page, /Strict correction/);
  assert.match(page, /Spaced review/);
  assert.match(page, /Pattern mastery/);
  assert.match(page, /Personal bests/);
  assert.match(community, /Community beta/);
  assert.match(community, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(page, /Fixed stage 1/);
  assert.match(page, /cloudClient\.dailyLeaderboard/);
  assert.match(page, /dailyAvailable/);
  assert.match(worker, /filter\(\(item\) => item\.track === "interview"\)/);
  assert.match(page, /onToggleUploads/);
  assert.match(page, /CustomSnippetDialog/);
  assert.match(page, /SessionsView/);
  assert.match(page, /updateCustomItem/);
  assert.match(page, /sessionNext/);
  assert.match(page, /setStage\(restored\.lastStage\)/);
  assert.match(page, /edit\.insertedCount > 0/);
  assert.match(layout, /"og\.png"/);
});
