export type LineRange = "all" | "up-to-15" | "16-25" | "26-40" | "41-plus";
export type TimeRange = "all" | "up-to-5" | "6-10" | "11-15" | "16-plus";
export const LINE_RANGE_OPTIONS: ReadonlyArray<{
  value: LineRange;
  label: string;
}>;
export const TIME_RANGE_OPTIONS: ReadonlyArray<{
  value: TimeRange;
  label: string;
}>;
export function matchesLineRange(lineCount: number, range: LineRange): boolean;
export function matchesTimeRange(minutes: number, range: TimeRange): boolean;
export function matchesCatalogRanges(
  item: { lineCount: number; estimatedMinutes: number },
  lineRange: LineRange,
  timeRange: TimeRange,
): boolean;
