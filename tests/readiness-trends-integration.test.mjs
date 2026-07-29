import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Records exposes a first-class longitudinal readiness route", async () => {
  const [app, routes, component] = await Promise.all([
    readFile(
      new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/lib/routes.mjs", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/ReadinessTrends.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(routes, /"overview",\s*"activity",\s*"trends",\s*"transfer",\s*"submissions",\s*"closures",\s*"fluency",\s*"reviews"/s);
  assert.match(app, /section === "trends"/);
  assert.match(app, /<ReadinessTrends/);
  assert.match(app, /recordsSection: "trends"/);
  assert.match(component, /buildReadinessTimeline/);
  assert.match(component, /Read the evidence over time/);
  assert.match(component, /does not combine them into an invented/);
});

test("trend evidence is visible and accessible without hover or color alone", async () => {
  const [component, styles] = await Promise.all([
    readFile(
      new URL("../app/components/ReadinessTrends.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /role="list"/);
  assert.match(component, /role="progressbar"/);
  assert.match(component, /<table className="readiness-comparison-table">/);
  assert.match(component, /<caption>/);
  assert.match(component, /Exact attempt, solve, and retrieval/);
  assert.doesNotMatch(component, /title=\{/);
  assert.match(styles, /\.readiness-activity-scroll/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /\.records-section-switch\s*\{\s*flex-wrap: wrap/s);
});
