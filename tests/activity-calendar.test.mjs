import assert from "node:assert/strict";
import test from "node:test";
import { buildPracticeActivityCalendar } from "../app/lib/activity-calendar.mjs";

const now = "2026-08-12T18:00:00.000Z";

function attempt(overrides = {}) {
  return {
    id: "attempt-1",
    completedAt: "2026-08-10T12:00:00.000Z",
    durationMs: 25 * 60_000,
    outcome: "completed",
    ...overrides,
  };
}

function session(overrides = {}) {
  return {
    id: "session-1",
    startedAt: "2026-08-10T10:00:00.000Z",
    completedAt: "2026-08-10T11:00:00.000Z",
    laneMinutes: { review: 10, interview: 20, python: 5, ios: 0 },
    ...overrides,
  };
}

test("builds a fixed 12-week matrix aligned to the requested locale", () => {
  const sunday = buildPracticeActivityCalendar({
    now,
    locale: "en-US",
    attempts: [],
  });
  const monday = buildPracticeActivityCalendar({
    now,
    locale: "en-GB",
    attempts: [],
  });

  assert.equal(sunday.windowWeeks, 12);
  assert.equal(sunday.weeks.length, 12);
  assert.equal(sunday.days.length, 84);
  assert.equal(sunday.weeks[0].days.length, 7);
  assert.equal(sunday.weekStartsOn, 0);
  assert.equal(monday.weekStartsOn, 1);
  assert.equal(sunday.startDate, "2026-05-24");
  assert.equal(sunday.endDate, "2026-08-15");
  assert.equal(monday.startDate, "2026-05-25");
  assert.equal(monday.endDate, "2026-08-16");
  assert.equal(sunday.todayDate, "2026-08-12");
  assert.equal(sunday.weeks.at(-1).days.at(-1).isToday, false);
  assert.equal(sunday.weeks.at(-1).days[3].isToday, true);
  assert.equal(sunday.byDate["2026-08-12"].date, "2026-08-12");
});

test("keeps date keys timezone-safe and records activity without mutating inputs", () => {
  const attempts = [
    attempt({ id: "late-utc", completedAt: "2026-08-11T23:30:00.000Z", durationMs: 60_000 }),
    attempt({ id: "next-local-day", completedAt: "2026-08-12T00:30:00.000Z", durationMs: 120_000 }),
    attempt({ id: "future", completedAt: "2026-08-13T08:00:00.000Z", durationMs: 30_000 }),
    attempt({ id: "invalid", completedAt: "not-a-date", durationMs: 30_000 }),
  ];
  const before = structuredClone(attempts);
  const calendar = buildPracticeActivityCalendar({
    now,
    timeZone: "America/Los_Angeles",
    attempts,
  });

  assert.equal(calendar.todayDate, "2026-08-12");
  assert.equal(calendar.totals.attempts, 2);
  assert.equal(calendar.totals.minutes, 3);
  assert.equal(calendar.days.find((day) => day.date === "2026-08-11").minutes, 3);
  assert.equal(calendar.byDate["2026-08-11"].attempts, 2);
  assert.deepEqual(attempts, before);
});

test("normalizes malformed durations and caps one day's activity", () => {
  const calendar = buildPracticeActivityCalendar({
    now,
    attempts: [
      attempt({ id: "negative", durationMs: -500 }),
      attempt({ id: "nan", durationMs: Number.NaN }),
      attempt({ id: "huge", durationMs: Number.MAX_SAFE_INTEGER }),
      attempt({ id: "more", durationMs: 10 * 60_000 }),
    ],
  });
  const day = calendar.days.find((candidate) => candidate.date === "2026-08-10");

  assert.equal(day.minutes, 1_440);
  assert.equal(day.attemptMinutes, 1_440);
  assert.equal(day.attempts, 4);
  assert.equal(day.level, 4);
  assert.equal(calendar.maxMinutes, 1_440);
});

test("uses unlinked session history as local activity and avoids double-counting linked plans", () => {
  const calendar = buildPracticeActivityCalendar({
    now,
    attempts: [
      attempt({ id: "linked-attempt", sessionId: "linked-session", durationMs: 12 * 60_000 }),
    ],
    sessionHistory: [
      session({ id: "linked-session", laneMinutes: { review: 90 } }),
      session({ id: "standalone-session", laneMinutes: { ios: 18 } }),
      session({ id: "fallback-session", laneMinutes: {}, durationMinutes: 7 }),
      session({ id: "duplicate", laneMinutes: { python: 2 } }),
      session({ id: "duplicate", laneMinutes: { python: 100 } }),
    ],
  });
  const day = calendar.days.find((candidate) => candidate.date === "2026-08-10");

  assert.equal(calendar.totals.attempts, 1);
  assert.equal(calendar.totals.sessions, 4);
  assert.equal(day.attemptMinutes, 12);
  assert.equal(day.sessionMinutes, 27);
  assert.equal(day.minutes, 39);
  assert.equal(day.count, 5);
  assert.equal(calendar.totals.sessionMinutes, 27);
});

test("derives stable intensity levels and an honest accessible summary", () => {
  const calendar = buildPracticeActivityCalendar({
    now,
    weeks: 0,
    attempts: [
      attempt({ id: "one", completedAt: "2026-08-10T12:00:00.000Z", durationMs: 10 * 60_000 }),
      attempt({ id: "two", completedAt: "2026-08-11T12:00:00.000Z", durationMs: 20 * 60_000 }),
      attempt({ id: "three", completedAt: "2026-08-12T12:00:00.000Z", durationMs: 30 * 60_000 }),
    ],
  });
  const levels = new Map(calendar.days.filter((day) => day.minutes).map((day) => [day.minutes, day.level]));

  assert.equal(calendar.windowWeeks, 1);
  assert.equal(levels.get(10), 2);
  assert.equal(levels.get(20), 3);
  assert.equal(levels.get(30), 4);
  assert.match(calendar.accessibleSummary, /60 minutes/);
  assert.match(calendar.accessibleSummary, /3 active days/);
  assert.match(calendar.accessibleSummary, /local activity only/);
  assert.equal(calendar.days.filter((day) => day.isFuture).length, 3);
  assert.equal(calendar.days.filter((day) => day.level === 0).length, 4);
});
