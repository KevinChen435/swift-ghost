import type { PracticeItem } from "./items";
import type { SubmissionRecord } from "./product";

export type SubmissionWorkLogStatus = SubmissionRecord["status"] | "compile-error" | "pending";
export type SubmissionWorkLogOrigin = SubmissionRecord["origin"] | "transfer" | "assessment" | "studio";
export type SubmissionWorkLogLanguage = PracticeItem["language"];
export type SubmissionWorkLogRevision = "all" | "current" | "older";
export type SubmissionWorkLogRevisionState = Exclude<SubmissionWorkLogRevision, "all"> | "unavailable";
export type SubmissionWorkLogRange = "all" | "7d" | "30d";
export type SubmissionWorkLogSort = "newest" | "oldest" | "problem" | "verdict";
export type SubmissionWorkLogPageSize = 25 | 50;
export type SubmissionWorkLogNow = string | number | Date;

export type SubmissionWorkLogQuery = {
  text: string;
  statuses: readonly SubmissionWorkLogStatus[];
  origins: readonly SubmissionWorkLogOrigin[];
  languages: readonly SubmissionWorkLogLanguage[];
  revision: SubmissionWorkLogRevision;
  range: SubmissionWorkLogRange;
  sort: SubmissionWorkLogSort;
  page: number;
  pageSize: SubmissionWorkLogPageSize;
  selectedId?: string;
  compareId?: string;
};

export type SubmissionWorkLogEntry =
  | (SubmissionRecord & {
      requestedAt?: string;
      lifecycle?: string;
      context?: { kind?: SubmissionWorkLogOrigin };
      titleSnapshot?: string;
      language?: SubmissionWorkLogLanguage;
    })
  | (Omit<Partial<SubmissionRecord>, "id" | "itemId" | "status"> & {
      id: string;
      itemId: SubmissionRecord["itemId"];
      requestedAt: string;
      lifecycle?: string;
      context?: { kind?: SubmissionWorkLogOrigin };
      status?: SubmissionWorkLogStatus;
      titleSnapshot?: string;
      language?: SubmissionWorkLogLanguage;
    });

export type SubmissionWorkLogRow = {
  submission: SubmissionWorkLogEntry;
  item: PracticeItem | null;
  title: string;
  language: SubmissionWorkLogLanguage;
  status: SubmissionWorkLogStatus;
  origin: string;
  revision: SubmissionWorkLogRevisionState;
};

export type SubmissionWorkLogCounts = {
  all: number;
  accepted: number;
  nonAccepted: number;
  uniqueProblems: number;
};

export type SubmissionWorkLogResult = {
  query: SubmissionWorkLogQuery;
  rows: SubmissionWorkLogRow[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
  counts: SubmissionWorkLogCounts;
};

export const SUBMISSION_WORK_LOG_STATUSES: readonly SubmissionWorkLogStatus[];
export const SUBMISSION_WORK_LOG_ORIGINS: readonly SubmissionWorkLogOrigin[];
export const SUBMISSION_WORK_LOG_LANGUAGES: readonly SubmissionWorkLogLanguage[];
export const SUBMISSION_WORK_LOG_REVISIONS: readonly SubmissionWorkLogRevision[];
export const SUBMISSION_WORK_LOG_RANGES: readonly SubmissionWorkLogRange[];
export const SUBMISSION_WORK_LOG_SORTS: readonly SubmissionWorkLogSort[];
export const SUBMISSION_WORK_LOG_PAGE_SIZES: readonly SubmissionWorkLogPageSize[];
export const DEFAULT_SUBMISSION_WORK_LOG_QUERY: Readonly<SubmissionWorkLogQuery>;

export function normalizeSubmissionWorkLogQuery(raw: unknown): SubmissionWorkLogQuery;
export function deriveSubmissionWorkLog(input?: {
  submissions?: readonly SubmissionWorkLogEntry[];
  items?: readonly PracticeItem[];
  query?: unknown;
  now?: SubmissionWorkLogNow;
}): SubmissionWorkLogResult;
