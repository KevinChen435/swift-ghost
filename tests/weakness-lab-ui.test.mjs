import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const app = await readFile(new URL("app/components/SwiftGhostApp.tsx", root), "utf8");
const component = await readFile(new URL("app/components/WeaknessLab.tsx", root), "utf8");
const css = await readFile(new URL("app/globals.css", root), "utf8");

test("Weakness Lab is a first-class routed product destination", () => {
  assert.match(app, /id: "improve", label: "Improve"/);
  assert.match(app, /view === "improve"[\s\S]*<WeaknessLab/);
  assert.match(app, /function updateWeaknessRoute/);
  assert.match(app, /weaknessFilter: input\.filter/);
  assert.match(app, /weaknessLane: input\.lane/);
  assert.match(app, /weaknessCaseId: input\.caseId/);
});

test("the Today dashboard surfaces the highest-priority remediation case", () => {
  assert.match(app, /weaknessCase=\{weaknessModel\.nextCase\}/);
  assert.match(app, /Weakness Lab · highest priority/);
  assert.match(app, /Open repair plan/);
});

test("targeted remediation reuses the canonical session pipeline", () => {
  assert.match(app, /function startWeaknessCase\(value: WeaknessCase\)/);
  assert.match(app, /startSession\([\s\S]*Weakness Lab/);
  assert.match(app, /practiceKind: entry\.practiceKind/);
  assert.match(app, /rationale: entry\.rationale/);
  assert.match(app, /const sourcePracticeKind = coercePracticeKind/);
  assert.match(app, /sourceAttempt\?\.practiceKind/);
});

test("the remediation surface explains evidence and avoids false mastery claims", () => {
  assert.match(component, /One typo never becomes a diagnosis/);
  assert.match(component, /not a score,[\s\S]*certification,[\s\S]*hiring signal/);
  assert.match(component, /A case resolves only after delayed independent evidence plus a distinct transfer proof/);
  assert.match(component, /Hints, reference reveals, restored source, and self-ratings do not count/);
  assert.match(component, /aria-labelledby="weakness-case-title"/);
  assert.match(component, /role="tablist"/);
});

test("Weakness Lab has desktop, mobile, focus, reduced-layout, and forced-color styling", () => {
  assert.match(
    css,
    /\.weakness-lab-page\s*\{[\s\S]*min-width:\s*0;[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(css, /\.weakness-workspace\s*\{[\s\S]*grid-template-columns/);
  assert.match(
    css,
    /\.weakness-filter-tabs,[\s\S]*\.weakness-lane-filter\s*\{[\s\S]*min-width:\s*0;[\s\S]*max-width:\s*100%;[\s\S]*overflow-x:\s*auto;/,
  );
  assert.match(
    css,
    /@media \(max-width: 720px\)[\s\S]*\.main-nav\s*\{[\s\S]*min-width:\s*0;[\s\S]*max-width:\s*calc\(100vw - 20px\);[\s\S]*overflow:\s*hidden;[\s\S]*\.main-nav button\s*\{[\s\S]*min-width:\s*0;[\s\S]*overflow:\s*hidden;/,
  );
  assert.match(css, /\.weakness-case-detail:focus-visible/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.weakness-detail-header/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*\.weakness-case-detail/);
});
