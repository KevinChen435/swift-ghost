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
  assert.match(html, /Two Sum/);
  assert.match(html, /Progress stays on this device/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships the full five-stage practice model and original problem links", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  for (const stage of [
    "Full ghost",
    "Missing expressions",
    "Missing lines",
    "Skeleton only",
    "Blank editor",
  ]) {
    assert.match(page, new RegExp(stage));
  }

  assert.match(page, /swift-ghost-progress/);
  assert.match(page, /https:\/\/leetcode\.com\/problems\/two-sum\//);
  assert.match(page, /Correct mistakes/);
  assert.match(layout, /\/og\.png/);
});
