import type { CodeLanguage, PracticeItem } from "./items";
import type { View } from "./product";
import type { PracticeKind } from "./product";

export type CommunityTab = "recent" | "records" | "daily" | "profile";
export type AppRoute = {
  view: View;
  language?: CodeLanguage;
  track?: "interview" | "ios";
  item?: string;
  stage?: number;
  practiceKind?: PracticeKind;
  communityTab?: CommunityTab;
  profile?: string;
};

export const ROUTE_VIEWS: View[];
export const COMMUNITY_TABS: CommunityTab[];
export const ROUTE_LANGUAGES: CodeLanguage[];
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
