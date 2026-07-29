import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Fluency Clinic exposes a routed, keyboard-oriented, evidence-honest workspace", async () => {
  const component = await read("../app/components/FluencyClinic.tsx");

  assert.match(component, /aria-labelledby="fluency-clinic-title"/);
  assert.match(component, /aria-label="Fluency Clinic cases"/);
  assert.match(component, /aria-label="Clinic evidence path"/);
  assert.match(component, /role="status"/);
  assert.match(component, /detailHeadingRef\.current\?\.focus\(\)/);
  assert.match(component, /<h3 ref=\{headingRef\} tabIndex=\{-1\}>/);
  assert.match(component, /Private to this device/);
  assert.match(component, /Never upgrades mastery or independent-solve claims/);
  assert.match(component, /Guided exposure, never mastery evidence/);
  assert.match(component, /cannot count as cold-transfer proof or independent mastery/);
});

test("Clinic steps require full reconstruction and delayed recall after guided line repair", async () => {
  const component = await read("../app/components/FluencyClinic.tsx");

  assert.match(component, /visible:\s*\{[\s\S]*label: "Visible"/);
  assert.match(component, /faded:\s*\{[\s\S]*label: "Faded"/);
  assert.match(component, /blank:\s*\{[\s\S]*label: "Blank"/);
  assert.match(component, /\{PASS_COPY\[kind\]\.label\} repair/);
  assert.match(component, /Full stage-5 reconstruction/);
  assert.match(component, /Delayed blank line recheck/);
  assert.match(component, /three micro-repairs were guided/i);
  assert.match(component, /Repeating now would measure short-term echo, not retrieval/);
  assert.match(component, /WPM change/);
  assert.match(component, /Evidence audit trail/);
});

test("Records, Today, and weak-line analytics all route into the durable Clinic", async () => {
  const [app, coach, analytics] = await Promise.all([
    read("../app/components/SwiftGhostApp.tsx"),
    read("../app/components/DailyCoach.tsx"),
    read("../app/components/LearningAnalytics.tsx"),
  ]);

  assert.match(app, /if \(section === "fluency"\)/);
  assert.match(app, /<RecordsSectionSwitch section="fluency"/);
  assert.match(app, /<FluencyClinic[\s\S]*routedCaseId=\{fluencyClinicRouteId\}/);
  assert.match(app, /onOpenReconstruction=\{onOpenFluencyReconstruction\}/);
  assert.match(app, /onOpenTransfer=\{onOpenFluencyTransfer\}/);
  assert.match(coach, /Priority before new work/);
  assert.match(coach, /Open priority Clinic case/);
  assert.match(coach, /This measures implementation fluency, not problem mastery/);
  assert.match(analytics, /onOpenFluencyClinic\(item, weakLine\)/);
  assert.doesNotMatch(analytics, /function LineRepairDialog/);
});

test("Clinic styling covers desktop, mobile, safe areas, focus, and forced colors", async () => {
  const styles = await read("../app/globals.css");

  assert.match(styles, /\.fluency-workspace\s*\{[\s\S]*grid-template-columns:/);
  assert.match(styles, /@media \(max-width: 800px\)[\s\S]*\.fluency-workspace\.has-selection \.fluency-queue\s*\{\s*display: none;/);
  assert.match(styles, /\.fluency-mobile-back\s*\{[\s\S]*min-height: 44px;/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /button:focus-visible/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*\.fluency-clinic-hero/);
  assert.match(styles, /\.fluency-queue > button\.active\s*\{\s*outline: 3px solid Highlight;/);
});
