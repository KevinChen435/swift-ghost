export type SubmissionDiffRow = Readonly<{
  type: "context" | "remove" | "add";
  text: string;
  submittedLine: number | null;
  currentLine: number | null;
}> | Readonly<{
  type: "omitted";
  text: string;
  submittedLine: null;
  currentLine: null;
  omitted: number;
  reason: "context" | "render-cap";
}>;

export type SubmissionDiff = Readonly<{
  rows: SubmissionDiffRow[];
  summary: Readonly<{ added: number; removed: number; unchanged: number }>;
  finalNewline: Readonly<{
    submitted: boolean;
    current: boolean;
    changed: boolean;
  }>;
  identical: boolean;
  algorithm: "lcs" | "fallback";
  lcsCells: number;
  truncated: boolean;
}>;

export function buildSubmissionDiff(
  submittedSource: string,
  currentSource: string,
): SubmissionDiff;

export const SUBMISSION_DIFF_LIMITS: Readonly<{
  maxLcsCells: 100000;
  maxRenderRows: 600;
  contextLines: 3;
}>;
