const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_WEEKS = 12;
const MAX_WINDOW_WEEKS = 52;
const MAX_INPUT_RECORDS = 5_000;
const MAX_DAILY_MINUTES = 24 * 60;
const MAX_DAILY_COUNT = 999;

function isRecord(value) {
  return Boolean(value) && typeof value === "object";
}

function finiteNumber(value, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function validDateTime(value) {
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isDateKey(value) {
  const timestamp =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? Date.parse(`${value}T00:00:00.000Z`)
      : NaN;
  return (
    Number.isFinite(timestamp) && dateKeyFromTimestamp(timestamp) === value
  );
}

function dateKeyFromTimestamp(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function dateParts(timestamp, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(timestamp));
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    const key = `${values.year}-${values.month}-${values.day}`;
    return isDateKey(key) ? key : null;
  } catch {
    return null;
  }
}

function dateKeyFor(value, timeZone) {
  if (isDateKey(value)) return value;
  const timestamp = validDateTime(value);
  return timestamp === null ? null : dateParts(timestamp, timeZone);
}

function normalizedTimeZone(value) {
  if (typeof value !== "string" || !value.trim()) return "UTC";
  try {
    // Constructing the formatter is the portable way to validate an IANA
    // zone in browsers that do not expose a separate timezone validator.
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

function dateValue(dateKey) {
  return Date.parse(`${dateKey}T00:00:00.000Z`);
}

function shiftDate(dateKey, days) {
  return dateKeyFromTimestamp(dateValue(dateKey) + days * DAY_MS);
}

function dayOfWeek(dateKey) {
  return new Date(dateValue(dateKey)).getUTCDay();
}

function localeWeekStart(locale) {
  if (!locale) return 0;
  try {
    const localeObject = new Intl.Locale(locale);
    const weekInfo =
      localeObject.weekInfo ??
      (typeof localeObject.getWeekInfo === "function"
        ? localeObject.getWeekInfo()
        : null);
    const firstDay = Number(weekInfo?.firstDay);
    if (firstDay >= 1 && firstDay <= 7) return firstDay === 7 ? 0 : firstDay;
  } catch {
    // Invalid or unsupported locales use the GitHub-style Sunday fallback.
  }
  return 0;
}

function normalizedWeekStart(value, locale) {
  if (Number.isInteger(value) && value >= 0 && value <= 6) return value;
  return localeWeekStart(locale);
}

function normalizedWeeks(value) {
  const weeks = Math.round(finiteNumber(value, DEFAULT_WINDOW_WEEKS));
  return clamp(weeks, 1, MAX_WINDOW_WEEKS);
}

function durationMinutes(value) {
  const milliseconds = clamp(finiteNumber(value), 0, MAX_DAILY_MINUTES * 60_000);
  return Math.round(milliseconds / 60_000);
}

function sessionMinutes(record) {
  if (!isRecord(record)) return 0;
  const laneMinutes = isRecord(record.laneMinutes)
    ? Object.values(record.laneMinutes).reduce(
        (sum, value) => sum + clamp(finiteNumber(value), 0, MAX_DAILY_MINUTES),
        0,
      )
    : 0;
  const fallback = clamp(
    finiteNumber(record.durationMinutes),
    0,
    MAX_DAILY_MINUTES,
  );
  return Math.round(clamp(laneMinutes || fallback, 0, MAX_DAILY_MINUTES));
}

function emptyDay(date, todayDate) {
  return {
    date,
    minutes: 0,
    attemptMinutes: 0,
    sessionMinutes: 0,
    count: 0,
    attempts: 0,
    sessions: 0,
    level: 0,
    isToday: date === todayDate,
    isFuture: date > todayDate,
  };
}

function normalizedActivityRecords(input, todayDate, timeZone) {
  const attempts = [];
  const seenAttemptIds = new Set();
  for (const record of (Array.isArray(input.attempts) ? input.attempts : []).slice(
    0,
    MAX_INPUT_RECORDS,
  )) {
    if (!isRecord(record)) continue;
    const date = dateKeyFor(record.completedAt, timeZone);
    if (!date || date > todayDate) continue;
    if (typeof record.id === "string" && record.id) {
      if (seenAttemptIds.has(record.id)) continue;
      seenAttemptIds.add(record.id);
    }
    attempts.push({
      id: typeof record.id === "string" ? record.id : undefined,
      sessionId:
        typeof record.sessionId === "string" && record.sessionId
          ? record.sessionId
          : undefined,
      date,
      minutes: durationMinutes(record.durationMs),
    });
  }

  const attemptIds = new Set(attempts.map((attempt) => attempt.id).filter(Boolean));
  const attemptSessionIds = new Set(
    attempts.map((attempt) => attempt.sessionId).filter(Boolean),
  );
  const sessions = [];
  const seenSessionIds = new Set();
  for (const record of (
    Array.isArray(input.sessionHistory) ? input.sessionHistory : []
  ).slice(0, MAX_INPUT_RECORDS)) {
    if (!isRecord(record)) continue;
    const date =
      dateKeyFor(record.completedAt, timeZone) ??
      dateKeyFor(record.startedAt, timeZone);
    if (!date || date > todayDate) continue;
    const id = typeof record.id === "string" && record.id ? record.id : undefined;
    if (id) {
      if (seenSessionIds.has(id)) continue;
      seenSessionIds.add(id);
    }
    const linkedByEntry = Array.isArray(record.entries) && record.entries.some(
      (entry) => isRecord(entry) && typeof entry.attemptId === "string" && attemptIds.has(entry.attemptId),
    );
    const linked = Boolean((id && attemptSessionIds.has(id)) || linkedByEntry);
    sessions.push({
      id,
      date,
      minutes: linked ? 0 : sessionMinutes(record),
    });
  }
  return { attempts, sessions };
}

function applyRecord(daysByDate, record, kind) {
  const day = daysByDate.get(record.date);
  if (!day) return;
  if (kind === "attempt") {
    day.attempts = Math.min(MAX_DAILY_COUNT, day.attempts + 1);
    day.attemptMinutes = clamp(
      day.attemptMinutes + record.minutes,
      0,
      MAX_DAILY_MINUTES,
    );
  } else {
    day.sessions = Math.min(MAX_DAILY_COUNT, day.sessions + 1);
    day.sessionMinutes = clamp(
      day.sessionMinutes + record.minutes,
      0,
      MAX_DAILY_MINUTES,
    );
  }
}

function setIntensity(days) {
  const maximum = Math.max(...days.map((day) => day.minutes), 0);
  for (const day of days) {
    day.level = day.minutes <= 0 || maximum <= 0
      ? 0
      : Math.min(4, Math.max(1, Math.ceil((day.minutes / maximum) * 4)));
  }
  return maximum;
}

function formatSummary({ totals, startDate, endDate }) {
  const minutes = totals.minutes;
  const minuteLabel = `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const dayLabel = `${totals.activeDays} active day${totals.activeDays === 1 ? "" : "s"}`;
  const attemptLabel = `${totals.attempts} attempt${totals.attempts === 1 ? "" : "s"}`;
  return `${minuteLabel} across ${dayLabel} and ${attemptLabel} from ${startDate} through ${endDate}; local activity only.`;
}

/**
 * Builds a bounded GitHub-style activity calendar from local practice records.
 * The calendar contains complete locale-aligned weeks so every column has the
 * same seven rows. It intentionally reports activity only; it does not infer
 * mastery, ranking, readiness, or any other outcome.
 */
export function buildPracticeActivityCalendar(input = {}) {
  const nowTime = validDateTime(input.now ?? Date.now()) ?? Date.now();
  const timeZone = normalizedTimeZone(input.timeZone);
  const todayDate = dateParts(nowTime, timeZone) ?? dateKeyFromTimestamp(nowTime);
  const weeks = normalizedWeeks(input.weeks);
  const weekStartsOn = normalizedWeekStart(input.weekStartsOn, input.locale);
  const offset = (dayOfWeek(todayDate) - weekStartsOn + 7) % 7;
  const currentWeekStart = shiftDate(todayDate, -offset);
  const startDate = shiftDate(currentWeekStart, -(weeks - 1) * 7);
  const endDate = shiftDate(startDate, weeks * 7 - 1);
  const days = [];
  const daysByDate = new Map();
  for (let index = 0; index < weeks * 7; index += 1) {
    const date = shiftDate(startDate, index);
    const day = emptyDay(date, todayDate);
    days.push(day);
    daysByDate.set(date, day);
  }

  const records = normalizedActivityRecords(input, todayDate, timeZone);
  for (const record of records.attempts) applyRecord(daysByDate, record, "attempt");
  for (const record of records.sessions) applyRecord(daysByDate, record, "session");
  for (const day of days) {
    day.minutes = clamp(
      day.attemptMinutes + day.sessionMinutes,
      0,
      MAX_DAILY_MINUTES,
    );
    day.count = Math.min(MAX_DAILY_COUNT, day.attempts + day.sessions);
  }
  const maxMinutes = setIntensity(days);
  const activeDays = days.filter((day) => day.minutes > 0).length;
  const totals = {
    minutes: days.reduce((sum, day) => sum + day.minutes, 0),
    attemptMinutes: days.reduce((sum, day) => sum + day.attemptMinutes, 0),
    sessionMinutes: days.reduce((sum, day) => sum + day.sessionMinutes, 0),
    attempts: days.reduce((sum, day) => sum + day.attempts, 0),
    sessions: days.reduce((sum, day) => sum + day.sessions, 0),
    activeDays,
  };
  const weekRecords = [];
  for (let index = 0; index < weeks; index += 1) {
    const weekStart = shiftDate(startDate, index * 7);
    weekRecords.push({
      startDate: weekStart,
      endDate: shiftDate(weekStart, 6),
      days: days.slice(index * 7, index * 7 + 7),
    });
  }
  const accessibleSummary = formatSummary({
    totals,
    startDate,
    endDate,
  });
  const byDate = Object.fromEntries(days.map((day) => [day.date, day]));
  return {
    windowWeeks: weeks,
    weekStartsOn,
    todayDate,
    startDate,
    endDate,
    days,
    byDate,
    weeks: weekRecords,
    maxMinutes,
    totals,
    accessibleSummary,
  };
}

// Keep the shorter name available for consumers that call the feature a
// generic activity calendar while retaining the product-specific primary API.
export const buildActivityCalendar = buildPracticeActivityCalendar;
