import type { PracticeItem } from "./items";

export type LauncherSearchMatch = {
  item: PracticeItem;
  score: number;
};

export function searchLauncherItems(
  items: readonly PracticeItem[],
  query: string,
  options?: { limit?: number },
): LauncherSearchMatch[];

export const LAUNCHER_ITEM_LIMIT: number;
