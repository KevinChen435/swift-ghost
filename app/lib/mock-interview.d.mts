import type { AttemptRecord, PracticeItem, TrainingSession } from "./product";

export type MockInterviewPresetId = "screen" | "standard" | "stretch";
export type MockInterviewProblemCount = 1 | 2;
export type MockInterviewPreset = {
  id: MockInterviewPresetId;
  label: string;
  durationMinutes: number;
  difficulties: readonly Array<"Easy" | "Medium" | "Hard">;
  note: string;
};

export const MOCK_INTERVIEW_PRESETS: readonly MockInterviewPreset[];
export const MOCK_INTERVIEW_PROBLEM_COUNTS: readonly MockInterviewProblemCount[];
export function mockInterviewPreset(presetId: string): MockInterviewPreset;
export function selectMockInterviewItems(
  items: PracticeItem[],
  attempts: AttemptRecord[],
  presetId: string,
  problemCount: MockInterviewProblemCount,
): PracticeItem[];
export function selectMockInterviewItem(
  items: PracticeItem[],
  attempts: AttemptRecord[],
  presetId: string,
): PracticeItem | null;
export function mockInterviewEndsAt(
  startedAt: string,
  durationMinutes: number,
): string | null;
export function mockInterviewRemainingMs(
  session: TrainingSession | null | undefined,
  now?: number,
): number | null;
export function formatMockClock(remainingMs: number): string;
