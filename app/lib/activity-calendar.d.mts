import type { AttemptRecord, SessionHistoryRecord } from "./product";

export type PracticeActivityCalendarDay = {
  date: string;
  minutes: number;
  attemptMinutes: number;
  sessionMinutes: number;
  count: number;
  attempts: number;
  sessions: number;
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
};

export type PracticeActivityCalendarWeek = {
  startDate: string;
  endDate: string;
  days: PracticeActivityCalendarDay[];
};

export type PracticeActivityCalendarTotals = {
  minutes: number;
  attemptMinutes: number;
  sessionMinutes: number;
  attempts: number;
  sessions: number;
  activeDays: number;
};

export type PracticeActivityCalendar = {
  windowWeeks: number;
  weekStartsOn: number;
  todayDate: string;
  startDate: string;
  endDate: string;
  days: PracticeActivityCalendarDay[];
  byDate: Record<string, PracticeActivityCalendarDay>;
  weeks: PracticeActivityCalendarWeek[];
  maxMinutes: number;
  totals: PracticeActivityCalendarTotals;
  accessibleSummary: string;
};

export type PracticeActivityCalendarInput = {
  attempts?: readonly AttemptRecord[];
  sessionHistory?: readonly SessionHistoryRecord[];
  now?: Date | string | number;
  locale?: string;
  timeZone?: string;
  weeks?: number;
  weekStartsOn?: number;
};

export function buildPracticeActivityCalendar(
  input?: PracticeActivityCalendarInput,
): PracticeActivityCalendar;

export const buildActivityCalendar: typeof buildPracticeActivityCalendar;
