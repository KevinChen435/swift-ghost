import type { CodeLanguage, PracticeItem } from "./items";
import type { View } from "./product";
import type { PracticeKind } from "./product";
import type { CatalogQuery } from "./catalog-discovery.mjs";
import type { SubmissionWorkLogQuery } from "./submission-work-log.mjs";
import type { WeaknessFilter, WeaknessLane } from "./weakness-lab.mjs";
import type { PatternLessonStep } from "../data/pattern-lessons";

export type CommunityTab = "recent" | "records" | "daily" | "profile";
export type LearnReviewMode = "mixed" | "tests";
export type RecordsSection =
  | "overview"
  | "trends"
  | "transfer"
  | "submissions"
  | "reviews";
export type ContestSection =
  | "overview"
  | "live"
  | "history"
  | "standings"
  | "review";
export type AppRoute = {
  view: View;
  language?: CodeLanguage;
  track?: "interview" | "ios";
  item?: string;
  stage?: number;
  practiceKind?: PracticeKind;
  communityTab?: CommunityTab;
  profile?: string;
  assessment?: string;
  contestSection?: ContestSection;
  contestRoundId?: string;
  catalog?: CatalogQuery;
  recordsSection?: RecordsSection;
  submissions?: SubmissionWorkLogQuery;
  reviewAttemptId?: string;
  transferVariantId?: string;
  transferAttemptId?: string;
  sessionId?: string;
  weaknessFilter?: WeaknessFilter;
  weaknessLane?: WeaknessLane;
  weaknessCaseId?: string;
  patternId?: string;
  lessonStep?: PatternLessonStep;
  learnReview?: LearnReviewMode;
  patternSprintId?: string;
  testDesignSprintId?: string;
};

export const ROUTE_VIEWS: View[];
export const COMMUNITY_TABS: CommunityTab[];
export const RECORDS_SECTIONS: RecordsSection[];
export const CONTEST_SECTIONS: ContestSection[];
export const ROUTE_LANGUAGES: CodeLanguage[];
export const LEARN_STEPS: PatternLessonStep[];
export const LEARN_REVIEW_MODES: LearnReviewMode[];
export function parseRoute(input: string | URL | URLSearchParams): AppRoute;
export function itemRouteToken(item: PracticeItem): string;
export function resolveRouteItem(
  items: PracticeItem[],
  route: AppRoute,
): PracticeItem | null;
export function routeForItem(
  item: PracticeItem,
  stage?: number,
  practiceKind?: PracticeKind,
): AppRoute;
export function serializeRoute(route: AppRoute, currentHref?: string): string;
