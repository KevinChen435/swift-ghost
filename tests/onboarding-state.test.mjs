import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ONBOARDING_STATE,
  ONBOARDING_DAILY_PACES,
  ONBOARDING_FOCUSES,
  buildStarterSessionIntent,
  normalizeOnboardingState,
  shouldShowOnboarding,
} from "../app/lib/onboarding.mjs";

test("onboarding choices are bounded and have a low-friction default", () => {
  assert.deepEqual(ONBOARDING_FOCUSES, ["python", "ios", "both"]);
  assert.deepEqual(ONBOARDING_DAILY_PACES, [15, 30, 45]);
  assert.deepEqual(normalizeOnboardingState(null), DEFAULT_ONBOARDING_STATE);
  assert.deepEqual(
    normalizeOnboardingState({ focus: "swift", dailyMinutes: 999, status: "wat" }),
    DEFAULT_ONBOARDING_STATE,
  );
  assert.deepEqual(
    normalizeOnboardingState({ focus: "ios", paceMinutes: 30, status: "skipped" }),
    { status: "skipped", focus: "ios", dailyMinutes: 30 },
  );
  assert.deepEqual(
    normalizeOnboardingState({ settings: { onboarding: { focus: "python" } } }),
    { status: "not-started", focus: "python", dailyMinutes: 15 },
  );
});

test("visibility waits for readiness and avoids interrupting real work", () => {
  assert.equal(shouldShowOnboarding({}), true);
  assert.equal(shouldShowOnboarding({ ready: false }), false);
  assert.equal(shouldShowOnboarding({ attempts: [{ id: "a" }] }), false);
  assert.equal(shouldShowOnboarding({ activeSession: { id: "session" } }), false);
  assert.equal(shouldShowOnboarding({ draft: { itemId: "python:1" } }), false);
  assert.equal(shouldShowOnboarding({ hasDeepLink: true }), false);
  assert.equal(shouldShowOnboarding({ interviewStudio: { active: { id: "mock" } } }), false);
  assert.equal(
    shouldShowOnboarding({ settings: { onboarding: { status: "skipped" } } }),
    false,
  );
  assert.equal(shouldShowOnboarding({ onboarding: { status: "completed" } }), false);
});

test("starter intent maps focus and pace onto current session concepts", () => {
  const python = buildStarterSessionIntent({ focus: "python", dailyMinutes: 15 });
  assert.deepEqual(
    {
      track: python.track,
      language: python.language,
      count: python.count,
      practiceMode: python.practiceMode,
      dailyMinutes: python.dailyMinutes,
    },
    {
      track: "interview",
      language: "python",
      count: 2,
      practiceMode: "smart",
      dailyMinutes: 15,
    },
  );
  assert.equal(python.profile.preferredLanguage, "python");
  assert.equal(python.profile.iosShare, 0);

  const ios = buildStarterSessionIntent({ focus: "ios", dailyMinutes: 45 });
  assert.equal(ios.track, "ios");
  assert.equal(ios.language, "swift");
  assert.equal(ios.count, 4);
  assert.equal(ios.profile.preferredLanguage, "swift");

  const both = buildStarterSessionIntent({ focus: "both", dailyMinutes: 30 });
  assert.equal(both.track, "all");
  assert.equal(both.language, "all");
  assert.equal(both.count, 3);
  assert.equal(both.profile.dailyGoalMinutes, 30);
});
