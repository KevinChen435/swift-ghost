export const ANALYTICS_LIMITS = Object.freeze({
  timelineSamples: 240,
  lineErrors: 500,
  attempts: 1000,
  weakLines: 12,
});

const MAX_AT_MS = 86_400_000;
const MAX_WPM = 500;
const MAX_LINE_NUMBER = 10_000;
const MAX_ERRORS_PER_LINE = 1_000_000;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boundedInteger(value, minimum, maximum) {
  const parsed = finiteNumber(value);
  return parsed === null
    ? null
    : Math.max(minimum, Math.min(maximum, Math.round(parsed)));
}

function integerInRange(value, minimum, maximum) {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  const rounded = Math.round(parsed);
  return rounded >= minimum && rounded <= maximum ? rounded : null;
}

function boundedDecimal(value, minimum, maximum) {
  const parsed = finiteNumber(value);
  return parsed === null
    ? null
    : Math.max(minimum, Math.min(maximum, Math.round(parsed * 10) / 10));
}

function optionLimit(value, fallback, maximum) {
  return boundedInteger(value, 1, maximum) ?? fallback;
}

function evenlySample(values, limit) {
  if (values.length <= limit) return values;
  if (limit === 1) return [values.at(-1)];
  return Array.from(
    { length: limit },
    (_, index) =>
      values[Math.round((index * (values.length - 1)) / (limit - 1))],
  );
}

/**
 * Normalize chart samples into chronological, finite, JSON-safe values.
 * Duplicate timestamps keep the most recently supplied sample, and oversized
 * timelines are evenly downsampled so the beginning and end remain visible.
 */
export function normalizeTimelineSamples(input, options = {}) {
  if (!Array.isArray(input)) return [];
  const maxSamples = optionLimit(
    options?.maxSamples,
    ANALYTICS_LIMITS.timelineSamples,
    2_000,
  );
  const samples = [];

  input.forEach((raw, inputIndex) => {
    if (!isRecord(raw)) return;
    const atMs = boundedInteger(raw.atMs, 0, MAX_AT_MS);
    const wpm = boundedDecimal(raw.wpm, 0, MAX_WPM);
    const progress = boundedDecimal(raw.progress, 0, 100);
    if (atMs === null || wpm === null || progress === null) return;
    samples.push({ atMs, wpm, progress, inputIndex });
  });

  samples.sort(
    (left, right) =>
      left.atMs - right.atMs || left.inputIndex - right.inputIndex,
  );
  const unique = [];
  for (const sample of samples) {
    const normalized = {
      atMs: sample.atMs,
      wpm: sample.wpm,
      progress: sample.progress,
    };
    if (unique.at(-1)?.atMs === sample.atMs)
      unique[unique.length - 1] = normalized;
    else unique.push(normalized);
  }
  return evenlySample(unique, maxSamples);
}

function lineErrorEntries(input) {
  if (input instanceof Map) return [...input.entries()];
  if (Array.isArray(input)) {
    return input.flatMap((value, index) => {
      if (isRecord(value))
        return [
          [
            value.line ?? value.lineNumber,
            value.count ?? value.errors ?? value.errorCount,
          ],
        ];
      return [[index + 1, value]];
    });
  }
  return isRecord(input) ? Object.entries(input) : [];
}

/** Normalize a line-number-to-error-count map and discard empty signals. */
export function normalizeLineErrors(input, options = {}) {
  const maxLines = optionLimit(
    options?.maxLines,
    ANALYTICS_LIMITS.lineErrors,
    2_000,
  );
  const maxErrorsPerLine = optionLimit(
    options?.maxErrorsPerLine,
    MAX_ERRORS_PER_LINE,
    MAX_ERRORS_PER_LINE,
  );
  const totals = new Map();

  for (const [rawLine, rawCount] of lineErrorEntries(input)) {
    const line = integerInRange(rawLine, 1, MAX_LINE_NUMBER);
    const count = boundedInteger(rawCount, 0, maxErrorsPerLine);
    if (line === null || count === null || count === 0) continue;
    totals.set(
      line,
      Math.min(maxErrorsPerLine, (totals.get(line) ?? 0) + count),
    );
  }

  const strongest = [...totals.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, maxLines)
    .sort((left, right) => left[0] - right[0]);
  return Object.fromEntries(
    strongest.map(([line, count]) => [String(line), count]),
  );
}

function cleanText(value, fallback) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : fallback;
}

function timestampOf(attempt) {
  const raw = attempt.completedAt ?? attempt.at;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return 0;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Combine per-attempt line errors into stable repair candidates. Repeated
 * trouble is represented by attemptCount instead of being flattened away.
 */
export function aggregateWeakLines(input, options = {}) {
  if (!Array.isArray(input)) return [];
  const limit = optionLimit(options?.limit, ANALYTICS_LIMITS.weakLines, 100);
  const attempts = input.slice(-ANALYTICS_LIMITS.attempts);
  const totals = new Map();

  for (const attempt of attempts) {
    if (!isRecord(attempt)) continue;
    const itemId = cleanText(attempt.itemId, "");
    if (!itemId) continue;
    const title = cleanText(attempt.titleSnapshot ?? attempt.title, itemId);
    const language = attempt.language === "python" ? "python" : "swift";
    const lineErrors = normalizeLineErrors(
      attempt.lineErrors ?? attempt.errorsByLine,
    );
    const seenAtMs = timestampOf(attempt);

    for (const [rawLine, errorCount] of Object.entries(lineErrors)) {
      const line = Number(rawLine);
      const key = `${language}\u0000${itemId}\u0000${line}`;
      const current = totals.get(key);
      if (!current) {
        totals.set(key, {
          key: `${language}:${itemId}:${line}`,
          itemId,
          title,
          language,
          line,
          errorCount,
          attemptCount: 1,
          lastSeenAtMs: seenAtMs,
        });
        continue;
      }
      current.errorCount = Math.min(
        MAX_ERRORS_PER_LINE,
        current.errorCount + errorCount,
      );
      current.attemptCount = Math.min(
        ANALYTICS_LIMITS.attempts,
        current.attemptCount + 1,
      );
      if (seenAtMs >= current.lastSeenAtMs) {
        current.lastSeenAtMs = seenAtMs;
        current.title = title;
      }
    }
  }

  return [...totals.values()]
    .sort(
      (left, right) =>
        right.attemptCount - left.attemptCount ||
        right.errorCount - left.errorCount ||
        right.lastSeenAtMs - left.lastSeenAtMs ||
        left.itemId.localeCompare(right.itemId) ||
        left.line - right.line,
    )
    .slice(0, limit);
}

/** Select the most useful next line: recurrence first, then total errors. */
export function selectRepairDrillTarget(input) {
  if (!Array.isArray(input)) return null;
  const candidates = input.filter(
    (candidate) =>
      isRecord(candidate) &&
      typeof candidate.itemId === "string" &&
      candidate.itemId.trim() &&
      integerInRange(candidate.line, 1, MAX_LINE_NUMBER) !== null &&
      boundedInteger(candidate.errorCount, 1, MAX_ERRORS_PER_LINE) !== null,
  );
  if (!candidates.length) return null;

  return candidates.slice().sort((left, right) => {
    const leftAttempts =
      boundedInteger(left.attemptCount, 1, ANALYTICS_LIMITS.attempts) ?? 1;
    const rightAttempts =
      boundedInteger(right.attemptCount, 1, ANALYTICS_LIMITS.attempts) ?? 1;
    const leftErrors =
      boundedInteger(left.errorCount, 1, MAX_ERRORS_PER_LINE) ?? 1;
    const rightErrors =
      boundedInteger(right.errorCount, 1, MAX_ERRORS_PER_LINE) ?? 1;
    return (
      rightAttempts - leftAttempts ||
      rightErrors - leftErrors ||
      (boundedInteger(right.lastSeenAtMs, 0, Number.MAX_SAFE_INTEGER) ?? 0) -
        (boundedInteger(left.lastSeenAtMs, 0, Number.MAX_SAFE_INTEGER) ?? 0) ||
      String(left.itemId).localeCompare(String(right.itemId)) ||
      Number(left.line) - Number(right.line)
    );
  })[0];
}

/**
 * Build a compact, numbered code excerpt for a weak-line repair drill.
 * Requested lines clamp to the available solution and context is capped at
 * five lines on either side so a drill cannot quietly become answer review.
 */
export function repairLineExcerpt(code, lineNumber, contextLines = 1) {
  if (typeof code !== "string") return null;
  const lines = code
    .split("\n")
    .slice(0, MAX_LINE_NUMBER)
    .map((line) => line.replace(/\r$/, "").slice(0, 1_000));
  const requested = boundedInteger(lineNumber, 1, MAX_LINE_NUMBER) ?? 1;
  const target = Math.max(1, Math.min(lines.length, requested));
  const radius = boundedInteger(contextLines, 0, 5) ?? 1;
  const startLine = Math.max(1, target - radius);
  const endLine = Math.min(lines.length, target + radius);
  const context = lines.slice(startLine - 1, endLine).map((text, index) => ({
    lineNumber: startLine + index,
    text,
    isTarget: startLine + index === target,
  }));
  return {
    lineNumber: target,
    lineText: lines[target - 1],
    startLine,
    endLine,
    context,
  };
}

/** Summarize a pacing trace without requiring a minimum attempt duration. */
export function summarizeAttemptTimeline(input) {
  const samples = normalizeTimelineSamples(input);
  if (!samples.length) {
    return {
      sampleCount: 0,
      durationMs: 0,
      averageWpm: 0,
      startWpm: 0,
      endWpm: 0,
      peakWpm: 0,
      peakAtMs: null,
      slowestWpm: 0,
      slowestAtMs: null,
      paceChangeWpm: 0,
      paceTrend: "steady",
    };
  }

  let peak = samples[0];
  let slowest = samples[0];
  let totalWpm = 0;
  for (const sample of samples) {
    totalWpm += sample.wpm;
    if (sample.wpm > peak.wpm) peak = sample;
    if (sample.wpm < slowest.wpm) slowest = sample;
  }
  const startWpm = samples[0].wpm;
  const endWpm = samples.at(-1).wpm;
  const paceChangeWpm = Math.round((endWpm - startWpm) * 10) / 10;
  return {
    sampleCount: samples.length,
    durationMs: samples.at(-1).atMs - samples[0].atMs,
    averageWpm: Math.round((totalWpm / samples.length) * 10) / 10,
    startWpm,
    endWpm,
    peakWpm: peak.wpm,
    peakAtMs: peak.atMs,
    slowestWpm: slowest.wpm,
    slowestAtMs: slowest.atMs,
    paceChangeWpm,
    paceTrend:
      paceChangeWpm > 1 ? "faster" : paceChangeWpm < -1 ? "slower" : "steady",
  };
}
