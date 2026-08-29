import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [component, app, styles] = await Promise.all([
  readFile(new URL("../app/components/PracticeActivityCalendar.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("Records surfaces an honest, keyboard-accessible local activity calendar", () => {
  assert.match(app, /<PracticeActivityCalendar/);
  assert.match(app, /attempts=\{state\.attempts\}/);
  assert.match(app, /sessionHistory=\{state\.sessionHistory\}/);
  assert.match(component, /Practice footprint/);
  assert.match(component, /not a mastery,[\s\S]*ranking,[\s\S]*interview-outcome score/);
  assert.match(component, /role="grid"/);
  assert.match(component, /role="gridcell"/);
  assert.match(component, /tabIndex=\{0\}/);
  assert.match(component, /aria-label=\{dayLabel\(day, locale\)\}/);
});

test("activity calendar styling remains bounded on small screens and forced colors", () => {
  assert.match(styles, /\.practice-activity-calendar\s*\{/);
  assert.match(styles, /\.practice-activity-calendar-scroll\s*\{/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /\.practice-activity-calendar-day:focus-visible/);
  assert.match(styles, /@media \(forced-colors: active\)/);
});
