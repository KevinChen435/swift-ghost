// First-run choices stay deliberately small.  The UI can explain the choices,
// while this module keeps the persisted shape and the session hand-off stable.

export const ONBOARDING_FOCUSES = Object.freeze(["python", "ios", "both"]);
export const ONBOARDING_DAILY_PACES = Object.freeze([15, 30, 45]);
export const DAILY_COACH_BUDGETS = Object.freeze([15, 30, 45]);
export const ONBOARDING_STATUSES = Object.freeze([
  "not-started",
  "skipped",
  "started",
  "completed",
]);

export const DEFAULT_ONBOARDING_STATE = Object.freeze({
  status: "not-started",
  focus: "both",
  dailyMinutes: 15,
});

const FOCUS_CONFIG = Object.freeze({
  python: Object.freeze({
    name: "Python interview warm-up",
    track: "interview",
    language: "python",
    preferredLanguage: "python",
    pythonShare: 0.8,
    reviewShare: 0.2,
    iosShare: 0,
  }),
  ios: Object.freeze({
    name: "Swift & iOS foundations",
    track: "ios",
    language: "swift",
    preferredLanguage: "swift",
    pythonShare: 0,
    reviewShare: 0.2,
    iosShare: 0.8,
  }),
  both: Object.freeze({
    name: "Python + iOS reactivation",
    track: "all",
    language: "all",
    preferredLanguage: "python",
    pythonShare: 0.5,
    reviewShare: 0.1,
    iosShare: 0.4,
  }),
});

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validFocus(value, fallback = DEFAULT_ONBOARDING_STATE.focus) {
  return ONBOARDING_FOCUSES.includes(value) ? value : fallback;
}

function validDailyMinutes(value, fallback = DEFAULT_ONBOARDING_STATE.dailyMinutes) {
  const number = Number(value);
  return ONBOARDING_DAILY_PACES.includes(number) ? number : fallback;
}

function validStatus(value, fallback = DEFAULT_ONBOARDING_STATE.status) {
  return ONBOARDING_STATUSES.includes(value) ? value : fallback;
}

function onboardingValue(value) {
  if (!isRecord(value)) return {};
  if (isRecord(value.onboarding)) return value.onboarding;
  if (isRecord(value.settings?.onboarding)) return value.settings.onboarding;
  return value;
}

/**
 * Normalize the small, optional onboarding record stored alongside settings.
 * Unknown fields are intentionally discarded so this remains safe to persist
 * in older state versions and resilient to hand-edited local storage.
 */
export function normalizeOnboardingState(value) {
  const raw = onboardingValue(value);
  return {
    status: validStatus(raw.status),
    focus: validFocus(raw.focus),
    dailyMinutes: validDailyMinutes(
      raw.dailyMinutes ?? raw.paceMinutes ?? raw.dailyGoalMinutes,
    ),
  };
}

function hasActiveInterviewStudio(value) {
  if (value?.interviewStudioActive === true) return true;
  if (value?.interviewStudio?.active) return true;
  return Boolean(value?.interviewStudio?.active?.id);
}

function hasExplicitDeepLink(value) {
  return Boolean(
    value?.hasDeepLink === true ||
      value?.deepLink === true ||
      value?.deepLinkedItemId ||
      value?.requestedItemId ||
      value?.practiceItemId,
  );
}

/**
 * Decide whether it is safe and useful to show first-run onboarding.
 * Accepts either a guard object or the app state itself.  Existing learners
 * with attempts, a saved draft, an active session, or a deep link bypass it.
 */
export function shouldShowOnboarding(input = {}, options = {}) {
  const value = isRecord(input) ? { ...input, ...options } : options;
  const onboarding = normalizeOnboardingState(value);
  const attempts = Array.isArray(value.attempts) ? value.attempts : [];
  const hasAttempts = value.hasAttempts === true || attempts.length > 0;
  const activeSession = Boolean(value.activeSession);
  const hasDraft = Boolean(value.draft);
  const ready = value.ready !== false;
  const returningUser = value.isReturningUser === true;

  return Boolean(
    ready &&
      onboarding.status === "not-started" &&
      !hasAttempts &&
      !activeSession &&
      !hasActiveInterviewStudio(value) &&
      !hasDraft &&
      !hasExplicitDeepLink(value) &&
      !returningUser,
  );
}

function countForPace(dailyMinutes) {
  if (dailyMinutes >= 45) return 4;
  if (dailyMinutes >= 30) return 3;
  return 2;
}

/**
 * Map the settings goal onto the three deliberate Daily Coach blocks. The
 * goal can be any 5-minute increment in Settings, so nearest matching keeps
 * the coach useful without silently inventing a fourth plan shape.
 */
export function nearestDailyCoachBudget(minutes, fallback = 15) {
  const value = Number(minutes);
  const safeFallback = DAILY_COACH_BUDGETS.includes(Number(fallback))
    ? Number(fallback)
    : DAILY_COACH_BUDGETS[0];
  if (!Number.isFinite(value)) return safeFallback;
  return DAILY_COACH_BUDGETS.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best,
  );
}

/**
 * Convert the persisted re-entry focus into the planner profile used by the
 * Daily Coach. `dailyGoalMinutes` intentionally comes from Settings when it
 * is supplied: onboarding chooses a starting pace, while Settings remains
 * the ongoing source of truth for the daily goal.
 */
export function buildDailyCoachProfile(value = {}) {
  const state = normalizeOnboardingState(value);
  const config = FOCUS_CONFIG[state.focus];
  const requestedGoal = Number(value?.dailyGoalMinutes);
  const dailyGoalMinutes = Number.isFinite(requestedGoal)
    ? Math.min(120, Math.max(5, Math.round(requestedGoal)))
    : state.dailyMinutes;
  return {
    preferredLanguage: config.preferredLanguage,
    dailyGoalMinutes,
    pythonShare: config.pythonShare,
    reviewShare: config.reviewShare,
    iosShare: config.iosShare,
    focus: state.focus,
  };
}

/**
 * Return the complete coach preference hand-off for UI and planner callers.
 * Keeping this pure makes preference changes easy to test without mounting
 * the app shell.
 */
export function resolveDailyCoachPreferences(value = {}) {
  const profile = buildDailyCoachProfile(value);
  return {
    focus: profile.focus,
    profile,
    budgetMinutes: nearestDailyCoachBudget(profile.dailyGoalMinutes),
  };
}

/**
 * Build the existing startSession-compatible options for the first guided
 * block.  `profile` is included for the planner and settings hand-off; the
 * top-level fields can be passed directly to startSession.
 */
export function buildStarterSessionIntent(input = {}) {
  const state = normalizeOnboardingState(input);
  const config = FOCUS_CONFIG[state.focus];
  const profile = {
    preferredLanguage: config.preferredLanguage,
    dailyGoalMinutes: state.dailyMinutes,
    pythonShare: config.pythonShare,
    reviewShare: config.reviewShare,
    iosShare: config.iosShare,
  };
  return {
    name: `${config.name} · ${state.dailyMinutes} min`,
    count: countForPace(state.dailyMinutes),
    source: "mixed",
    track: config.track,
    language: config.language,
    pattern: "All",
    difficulty: "All",
    stageMode: "recommended",
    practiceMode: "smart",
    focus: state.focus,
    dailyMinutes: state.dailyMinutes,
    profile,
  };
}

// Friendly aliases make the contract discoverable without duplicating logic.
export const createStarterSessionIntent = buildStarterSessionIntent;
export const starterSessionIntent = buildStarterSessionIntent;
