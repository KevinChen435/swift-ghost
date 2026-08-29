export type OnboardingFocus = "python" | "ios" | "both";
export type OnboardingDailyMinutes = 15 | 30 | 45;
export type OnboardingStatus =
  | "not-started"
  | "skipped"
  | "started"
  | "completed";

export type OnboardingState = {
  status: OnboardingStatus;
  focus: OnboardingFocus;
  dailyMinutes: OnboardingDailyMinutes;
};

export type OnboardingTrainingProfile = {
  preferredLanguage: "python" | "swift";
  dailyGoalMinutes: OnboardingDailyMinutes;
  pythonShare: number;
  reviewShare: number;
  iosShare: number;
};

export type DailyCoachProfile = Omit<OnboardingTrainingProfile, "dailyGoalMinutes"> & {
  dailyGoalMinutes: number;
  focus: OnboardingFocus;
};

export type DailyCoachPreferences = {
  focus: OnboardingFocus;
  profile: DailyCoachProfile;
  budgetMinutes: OnboardingDailyMinutes;
};

export type StarterSessionIntent = {
  name: string;
  count: number;
  source: "mixed";
  track: "all" | "interview" | "ios";
  language: "all" | "python" | "swift";
  pattern: "All";
  difficulty: "All";
  stageMode: "recommended";
  practiceMode: "smart";
  focus: OnboardingFocus;
  dailyMinutes: OnboardingDailyMinutes;
  profile: OnboardingTrainingProfile;
};

export type OnboardingVisibilityInput = {
  onboarding?: Partial<OnboardingState> | null;
  settings?: { onboarding?: Partial<OnboardingState> | null } | null;
  attempts?: readonly unknown[];
  hasAttempts?: boolean;
  activeSession?: unknown;
  interviewStudioActive?: boolean;
  interviewStudio?: { active?: unknown } | null;
  draft?: unknown;
  ready?: boolean;
  hasDeepLink?: boolean;
  deepLink?: boolean;
  deepLinkedItemId?: string | null;
  requestedItemId?: string | null;
  practiceItemId?: string | null;
  isReturningUser?: boolean;
};

export const ONBOARDING_FOCUSES: readonly OnboardingFocus[];
export const ONBOARDING_DAILY_PACES: readonly OnboardingDailyMinutes[];
export const DAILY_COACH_BUDGETS: readonly OnboardingDailyMinutes[];
export const ONBOARDING_STATUSES: readonly OnboardingStatus[];
export const DEFAULT_ONBOARDING_STATE: Readonly<OnboardingState>;
export function normalizeOnboardingState(
  value?: unknown,
): OnboardingState;
export function shouldShowOnboarding(
  input?: OnboardingVisibilityInput,
  options?: OnboardingVisibilityInput,
): boolean;
export function nearestDailyCoachBudget(
  minutes: number,
  fallback?: number,
): OnboardingDailyMinutes;
export function buildDailyCoachProfile(
  input?: Partial<OnboardingState> & {
    dailyGoalMinutes?: number;
    onboarding?: Partial<OnboardingState> | null;
  },
): DailyCoachProfile;
export function resolveDailyCoachPreferences(
  input?: Partial<OnboardingState> & {
    dailyGoalMinutes?: number;
    onboarding?: Partial<OnboardingState> | null;
  },
): DailyCoachPreferences;
export function buildStarterSessionIntent(
  input?: Partial<OnboardingState> | OnboardingVisibilityInput,
): StarterSessionIntent;
export const createStarterSessionIntent: typeof buildStarterSessionIntent;
export const starterSessionIntent: typeof buildStarterSessionIntent;
