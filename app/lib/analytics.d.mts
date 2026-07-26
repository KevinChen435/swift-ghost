import type { CodeLanguage, ItemId } from "./items";

export type TimelineSample = { atMs: number; wpm: number; progress: number };
export type LineErrorMap = Record<string, number>;
export type WeakLine = {
  key: string;
  itemId: ItemId | string;
  title: string;
  language: CodeLanguage;
  line: number;
  errorCount: number;
  attemptCount: number;
  lastSeenAtMs: number;
};
export type AttemptTimelineSummary = {
  sampleCount: number;
  durationMs: number;
  averageWpm: number;
  startWpm: number;
  endWpm: number;
  peakWpm: number;
  peakAtMs: number | null;
  slowestWpm: number;
  slowestAtMs: number | null;
  paceChangeWpm: number;
  paceTrend: "faster" | "slower" | "steady";
};
export type RepairLineExcerpt = {
  lineNumber: number;
  lineText: string;
  startLine: number;
  endLine: number;
  context: Array<{ lineNumber: number; text: string; isTarget: boolean }>;
};

export const ANALYTICS_LIMITS: Readonly<{
  timelineSamples: number;
  lineErrors: number;
  attempts: number;
  weakLines: number;
}>;
export function normalizeTimelineSamples(
  input: unknown,
  options?: { maxSamples?: number },
): TimelineSample[];
export function normalizeLineErrors(
  input: unknown,
  options?: { maxLines?: number; maxErrorsPerLine?: number },
): LineErrorMap;
export function aggregateWeakLines(
  input: unknown,
  options?: { limit?: number },
): WeakLine[];
export function selectRepairDrillTarget(input: unknown): WeakLine | null;
export function repairLineExcerpt(
  code: unknown,
  lineNumber: unknown,
  contextLines?: number,
): RepairLineExcerpt | null;
export function summarizeAttemptTimeline(
  input: unknown,
): AttemptTimelineSummary;
