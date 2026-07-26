export const LINE_RANGE_OPTIONS = Object.freeze([
  { value: "all", label: "Any length" },
  { value: "up-to-15", label: "Up to 15 lines" },
  { value: "16-25", label: "16–25 lines" },
  { value: "26-40", label: "26–40 lines" },
  { value: "41-plus", label: "41+ lines" },
]);

export const TIME_RANGE_OPTIONS = Object.freeze([
  { value: "all", label: "Any duration" },
  { value: "up-to-5", label: "Up to 5 min" },
  { value: "6-10", label: "6–10 min" },
  { value: "11-15", label: "11–15 min" },
  { value: "16-plus", label: "16+ min" },
]);

export function matchesLineRange(lineCount, range) {
  if (!Number.isFinite(lineCount) || lineCount < 0) return false;
  if (range === "all") return true;
  if (range === "up-to-15") return lineCount <= 15;
  if (range === "16-25") return lineCount >= 16 && lineCount <= 25;
  if (range === "26-40") return lineCount >= 26 && lineCount <= 40;
  if (range === "41-plus") return lineCount >= 41;
  return false;
}

export function matchesTimeRange(minutes, range) {
  if (!Number.isFinite(minutes) || minutes < 0) return false;
  if (range === "all") return true;
  if (range === "up-to-5") return minutes <= 5;
  if (range === "6-10") return minutes >= 6 && minutes <= 10;
  if (range === "11-15") return minutes >= 11 && minutes <= 15;
  if (range === "16-plus") return minutes >= 16;
  return false;
}

export function matchesCatalogRanges(item, lineRange, timeRange) {
  return (
    matchesLineRange(item?.lineCount, lineRange) &&
    matchesTimeRange(item?.estimatedMinutes, timeRange)
  );
}
