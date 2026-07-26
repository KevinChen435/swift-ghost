import assert from "node:assert/strict";
import test from "node:test";
import {
  LINE_RANGE_OPTIONS,
  TIME_RANGE_OPTIONS,
  matchesCatalogRanges,
  matchesLineRange,
  matchesTimeRange,
} from "../app/lib/catalog-filters.mjs";

test("line ranges include exact boundaries without overlap", () => {
  assert.equal(matchesLineRange(15, "up-to-15"), true);
  assert.equal(matchesLineRange(16, "up-to-15"), false);
  assert.equal(matchesLineRange(16, "16-25"), true);
  assert.equal(matchesLineRange(25, "16-25"), true);
  assert.equal(matchesLineRange(26, "26-40"), true);
  assert.equal(matchesLineRange(40, "26-40"), true);
  assert.equal(matchesLineRange(41, "41-plus"), true);
});

test("duration ranges include exact boundaries without overlap", () => {
  assert.equal(matchesTimeRange(5, "up-to-5"), true);
  assert.equal(matchesTimeRange(6, "6-10"), true);
  assert.equal(matchesTimeRange(10, "6-10"), true);
  assert.equal(matchesTimeRange(11, "11-15"), true);
  assert.equal(matchesTimeRange(15, "11-15"), true);
  assert.equal(matchesTimeRange(16, "16-plus"), true);
});

test("catalog ranges combine line and time filters", () => {
  const item = { lineCount: 24, estimatedMinutes: 9 };
  assert.equal(matchesCatalogRanges(item, "16-25", "6-10"), true);
  assert.equal(matchesCatalogRanges(item, "up-to-15", "6-10"), false);
  assert.equal(matchesCatalogRanges(item, "16-25", "11-15"), false);
});

test("all ranges admit valid catalog values and reject invalid numbers", () => {
  assert.equal(
    matchesCatalogRanges({ lineCount: 0, estimatedMinutes: 0 }, "all", "all"),
    true,
  );
  assert.equal(matchesLineRange(Number.NaN, "all"), false);
  assert.equal(matchesTimeRange(-1, "all"), false);
});

test("filter option values are unique and complete", () => {
  assert.equal(
    new Set(LINE_RANGE_OPTIONS.map((option) => option.value)).size,
    5,
  );
  assert.equal(
    new Set(TIME_RANGE_OPTIONS.map((option) => option.value)).size,
    5,
  );
  assert.equal(LINE_RANGE_OPTIONS[0].value, "all");
  assert.equal(TIME_RANGE_OPTIONS[0].value, "all");
});
