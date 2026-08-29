"use client";

import { useId, useMemo } from "react";
import {
  buildPracticeActivityCalendar,
  type PracticeActivityCalendar as PracticeActivityCalendarModel,
} from "../lib/activity-calendar.mjs";
import type { AttemptRecord, SessionHistoryRecord } from "../lib/product";

export type PracticeActivityCalendarProps = {
  attempts: readonly AttemptRecord[];
  sessionHistory?: readonly SessionHistoryRecord[];
  now?: Date | string | number;
  locale?: string;
  timeZone?: string;
  weeks?: number;
  weekStartsOn?: number;
};

const INTENSITY_LABELS = [
  "No activity",
  "Light",
  "Steady",
  "Focused",
  "Deep",
] as const;

function formatMinutes(minutes: number) {
  return `${minutes} min`;
}

function safeFormatter(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    return new Intl.DateTimeFormat("en-US", options);
  }
}

function formatDateRange(model: PracticeActivityCalendarModel, locale?: string) {
  const formatter = safeFormatter(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${model.startDate}T00:00:00.000Z`))} – ${formatter.format(
    new Date(`${model.endDate}T00:00:00.000Z`),
  )}`;
}

function formatDay(date: string, locale?: string) {
  const formatter = safeFormatter(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return formatter.format(new Date(`${date}T00:00:00.000Z`));
}

function weekdayLabels(
  model: PracticeActivityCalendarModel,
  locale?: string,
) {
  const formatter = safeFormatter(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(
      `2024-01-${String(7 + ((model.weekStartsOn + index) % 7)).padStart(2, "0")}T00:00:00.000Z`,
    );
    return formatter.format(date);
  });
}

function dayLabel(
  day: PracticeActivityCalendarModel["days"][number],
  locale?: string,
) {
  const activity = day.count
    ? `${day.count} ${day.count === 1 ? "activity" : "activities"}, ${formatMinutes(day.minutes)}`
    : "No activity";
  const status = day.isFuture ? " · Future date" : "";
  return `${formatDay(day.date, locale)} · ${activity} · ${INTENSITY_LABELS[day.level]}${status}`;
}

function CalendarLegend() {
  return (
    <div className="practice-activity-calendar-legend" aria-label="Activity intensity legend">
      <span>Less</span>
      {INTENSITY_LABELS.map((label, level) => (
        <span
          className="practice-activity-calendar-legend-swatch"
          data-level={level}
          key={label}
          title={label}
          aria-label={label}
        />
      ))}
      <span>More</span>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="practice-activity-calendar-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PracticeActivityCalendar({
  attempts,
  sessionHistory = [],
  now,
  locale,
  timeZone,
  weeks,
  weekStartsOn,
}: PracticeActivityCalendarProps) {
  const model = useMemo(
    () =>
      buildPracticeActivityCalendar({
        attempts,
        sessionHistory,
        now,
        locale,
        timeZone,
        weeks,
        weekStartsOn,
      }),
    [attempts, sessionHistory, now, locale, timeZone, weeks, weekStartsOn],
  );
  const generatedId = useId().replace(/:/g, "");
  const titleId = `${generatedId}-title`;
  const summaryId = `${generatedId}-summary`;
  const labels = useMemo(() => weekdayLabels(model, locale), [model, locale]);
  const dateRange = formatDateRange(model, locale);
  const empty = model.totals.activeDays === 0;

  return (
    <section
      className="practice-activity-calendar"
      aria-labelledby={titleId}
      aria-describedby={summaryId}
    >
      <header className="practice-activity-calendar-header">
        <div>
          <span className="eyebrow">Local activity</span>
          <h2 id={titleId}>Practice footprint</h2>
          <p>
            A quiet record of time you spent practicing. It is not a mastery,
            ranking, or interview-outcome score.
          </p>
        </div>
        <dl className="practice-activity-calendar-stats">
          <SummaryStat label="Practice time" value={formatMinutes(model.totals.minutes)} />
          <SummaryStat label="Active days" value={model.totals.activeDays} />
          <SummaryStat label="Attempts" value={model.totals.attempts} />
          {model.totals.sessions > 0 ? (
            <SummaryStat label="Sessions" value={model.totals.sessions} />
          ) : null}
        </dl>
      </header>

      <p id={summaryId} className="practice-activity-calendar-summary">
        {model.accessibleSummary}
      </p>

      <div className="practice-activity-calendar-toolbar">
        <span>{dateRange}</span>
        <CalendarLegend />
      </div>

      {empty ? (
        <p className="practice-activity-calendar-empty">
          No local practice activity is recorded in this window yet. Start a
          practice session and this calendar will fill in from saved attempts.
        </p>
      ) : null}

      <div
        className="practice-activity-calendar-scroll"
        tabIndex={0}
        aria-label={`Practice activity calendar for ${dateRange}`}
      >
        <div
          className="practice-activity-calendar-grid"
          role="grid"
          aria-rowcount={7}
          aria-colcount={model.windowWeeks}
          aria-label={model.accessibleSummary}
        >
          <div className="practice-activity-calendar-weekdays" role="row">
            {labels.map((label) => (
              <span role="columnheader" key={label}>
                {label}
              </span>
            ))}
          </div>
          <div
            className="practice-activity-calendar-weeks"
            style={{
              gridTemplateColumns: `repeat(${model.windowWeeks}, minmax(15px, 1fr))`,
            }}
          >
            {model.weeks.map((week) => (
              <div
                className="practice-activity-calendar-week"
                role="row"
                key={week.startDate}
                aria-label={`Week of ${formatDay(week.startDate, locale)}`}
              >
                {week.days.map((day) => (
                  <div
                    className="practice-activity-calendar-day"
                    data-level={day.level}
                    data-today={day.isToday ? "true" : undefined}
                    data-future={day.isFuture ? "true" : undefined}
                    role="gridcell"
                    aria-label={dayLabel(day, locale)}
                    aria-current={day.isToday ? "date" : undefined}
                    tabIndex={0}
                    key={day.date}
                  >
                    <span aria-hidden="true" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default PracticeActivityCalendar;
