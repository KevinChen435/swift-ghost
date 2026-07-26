export type ProfilePrivacy = {
  handle: string;
  displayName: string | null;
  bio: string | null;
  timezone: string | null;
  isPublic: boolean;
  shareActivity: boolean;
  showOnLeaderboards: boolean;
};
export type ValidatedAttempt = {
  clientAttemptId: string;
  itemId: string;
  itemRevision: number;
  itemTitle: string;
  track: "interview" | "ios";
  stage: number;
  mode: "strict" | "free";
  accuracyBps: number;
  wpmBps: number;
  durationMs: number;
  typedChars: number;
  peeks: number;
  completedAt: number;
  completedDay: string;
  challengeDate: string | null;
  feedEligible: boolean;
  rankingEligible: boolean;
};
export function normalizeProfilePatch(input: unknown, current: ProfilePrivacy): ProfilePrivacy;
export function validateAttemptUpload(raw: unknown, now?: number):
  | { ok: true; value: ValidatedAttempt }
  | { ok: false; error: string };
export function rankItemRows(rows: Array<{ displayName: string | null; itemRevision: number; stage: number; accuracyBps: number; wpmBps: number; durationMs: number; completedAt: number }>): Array<Record<string, unknown>>;
export function rankDailyRows(rows: Array<{ displayName: string | null; completions: number; averageAccuracyBps: number; wpmBps: number; totalDurationMs: number; highestStage: number }>): Array<Record<string, unknown>>;
export function redactCommunityRow(row: { displayName: string | null; itemId: string; itemRevision: number; itemTitle: string; track: string; stage: number; accuracyBps: number; wpmBps: number; durationMs: number; completedAt: number }): Record<string, unknown>;
export function isSameOrigin(requestUrl: string, origin: string | null): boolean;
export function validateHandle(value: unknown): string;
export function deterministicChallenge(date: string, items: Array<{ itemId: string; itemRevision: number; itemTitle: string; track: "interview" | "ios" }>): { date: string; itemId: string; itemRevision: number; itemTitle: string; track: "interview" | "ios"; stage: 1; mode: "strict" };
