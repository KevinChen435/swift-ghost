import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const component = await readFile(
  new URL("../app/components/ReentryOnboarding.tsx", import.meta.url),
  "utf8",
);
const app = await readFile(
  new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
  "utf8",
);

test("re-entry setup presents bounded focus and pace choices", () => {
  assert.match(component, /Start here · re-entry setup/);
  assert.match(component, /ONBOARDING_FOCUSES\.map/);
  assert.match(component, /ONBOARDING_DAILY_PACES\.map/);
  assert.match(component, /role="radiogroup"/);
  assert.match(component, /I’ll explore first/);
  assert.match(component, /Start my \{selection\.dailyMinutes\}-minute session/);
  assert.doesNotMatch(component, /answer|solution/i);
});

test("Today mounts onboarding only through the guarded app callbacks", () => {
  assert.match(app, /const showOnboarding = useMemo/);
  assert.match(app, /shouldShowOnboarding\(\{/);
  assert.match(app, /<ReentryOnboarding/);
  assert.match(app, /onStartOnboarding=\{startOnboarding\}/);
  assert.match(app, /onSkipOnboarding=\{skipOnboarding\}/);
  assert.match(app, /buildOnboardingStarterEntries/);
  assert.match(app, /First re-entry rep · current evidence sets the order/);
  assert.match(app, /candidate\.language === "swift" && canSolveItem/);
  assert.match(app, /onboarding: \{\s+\.\.\.current\.settings\.onboarding/);
});
