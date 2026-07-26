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
  const page = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  const catalog = await readFile(
    new URL("../app/data/problems.ts", import.meta.url),
    "utf8",
  );
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );
  const community = await readFile(
    new URL("../app/components/CommunityPanel.tsx", import.meta.url),
    "utf8",
  );
  const worker = await readFile(
    new URL("../worker/index.ts", import.meta.url),
    "utf8",
  );

  for (const stage of [
    "Full ghost",
    "Missing expressions",
    "Missing lines",
    "Skeleton only",
    "Blank editor",
  ]) {
    assert.match(product, new RegExp(stage));
  }

  assert.match(product, /swift-ghost-state-v9/);
  assert.match(product, /swift-ghost-state-v8/);
  assert.match(product, /swift-ghost-state-v7/);
  assert.match(product, /swift-ghost-state-v6/);
  assert.match(product, /swift-ghost-state-v5/);
  assert.match(product, /swift-ghost-state-v4/);
  assert.match(product, /swift-ghost-state-v3/);
  assert.match(product, /swift-ghost-state-v2/);
  assert.match(product, /if \(!hasSupportedStateVersion\(parsed\)\) continue;/);
  assert.match(product, /localDayKey\(date\)}-catalog-v2/);
  assert.match(product, /replace\(\/\\r\\n\?\/g, "\\n"\)/);
  assert.match(product, /correctKeystrokes/);
  assert.match(product, /keyErrors: Record<string, number>/);
  assert.match(product, /keyErrors: normalizeKeyErrors\(rawDraft\.keyErrors\)/);
  assert.match(worker, /isCurrentDailyChallenge\(existing, CHALLENGE_ITEMS\)/);
  assert.match(worker, /UPDATE daily_challenges/);
  assert.match(product, /outcome: "completed" \| "abandoned"/);
  assert.match(product, /PracticeKind = "typing" \| "solving"/);
  assert.match(product, /attempt\.practiceKind === "typing"/);
  assert.match(product, /attempt\.practiceKind === "solving"/);
  assert.match(
    product,
    /attempt\.verification\.passed === attempt\.verification\.total/,
  );
  assert.match(
    catalog,
    /`https:\/\/leetcode\.com\/problems\/\$\{problem\.slug\}\/`/,
  );
  assert.equal((catalog.match(/^    id:/gm) ?? []).length, 50);
  const fundamentals = await readFile(
    new URL("../app/data/fundamentals.ts", import.meta.url),
    "utf8",
  );
  const python = await readFile(
    new URL("../app/data/python-problems.ts", import.meta.url),
    "utf8",
  );
  assert.equal((fundamentals.match(/^    id: "ios:/gm) ?? []).length, 16);
  assert.equal(
    (
      fundamentals.match(
        /^    sourceUrl: "https:\/\/(?:developer\.apple\.com|docs\.swift\.org)/gm,
      ) ?? []
    ).length,
    16,
  );
  assert.equal(
    (fundamentals.match(/^    recallChecks: \[/gm) ?? []).length,
    16,
  );
  assert.equal((python.match(/^    id:/gm) ?? []).length, 36);
  assert.equal((python.match(/^    languageNote:/gm) ?? []).length, 36);
  assert.equal((python.match(/^    recallChecks: \[/gm) ?? []).length, 36);
  assert.match(page, /Python reactivation/);
  assert.match(page, /solution\.py/);
  assert.match(page, /Three learning lanes/);
  assert.match(page, /iOS reactivation/);
  assert.match(page, /Key friction/);
  assert.match(page, /Strict correction/);
  assert.match(page, /Spaced review/);
  assert.match(page, /Pattern mastery/);
  assert.match(page, /Personal bests/);
  assert.match(community, /Community beta/);
  assert.match(community, /itemRevision:/);
  assert.match(community, /stage: boardStage/);
  assert.match(community, /Exact item · revision · stage/);
  assert.match(community, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(page, /Fixed stage 1/);
  assert.match(page, /cloudClient\.dailyLeaderboard/);
  assert.match(page, /dailyAvailable/);
  assert.match(
    worker,
    /item\.track === "interview" && item\.difficulty !== "Hard"/,
  );
  assert.match(
    page,
    /item\.track === "interview" && item\.difficulty !== "Hard"/,
  );
  assert.match(
    product,
    /Try the next older backup when a newer write was interrupted/,
  );
  assert.match(page, /Run the solution against real checks/);
  assert.match(page, /Write any passing Python solution/);
  assert.match(page, /Record verified solve/);
  assert.match(page, /attempt\.practiceKind === "typing"/);
  assert.match(page, /Exact item/);
  assert.match(page, /Retry same/);
  assert.match(page, /Full analysis/);
  assert.match(page, /Estimated time/);
  assert.match(page, /mobile-practice-controls/);
  assert.match(page, /coercePracticeKind/);
  assert.match(page, /practiceEpoch/);
  assert.match(page, /setPracticeKind\("typing"\)/);
  assert.match(page, /LearningAnalytics/);
  assert.match(page, /onToggleUploads/);
  assert.match(page, /CustomSnippetDialog/);
  assert.match(page, /SessionsView/);
  assert.match(page, /updateCustomItem/);
  assert.match(page, /sessionNext/);
  assert.match(
    page,
    /restoredPracticeKind === "solving" \? 5 : restored\.lastStage/,
  );
  assert.match(page, /edit\.insertedCount > 0/);
  assert.match(layout, /"og-v7\.png"/);
});
