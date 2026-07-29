import type { AttemptRecord } from "./product";
import type { RetrievalGrade } from "./learning-state.mjs";
import type { PatternLesson } from "../data/pattern-lessons";
import type { PracticeItem } from "./items";

export type PatternReview = {
  lessonId: string;
  lessonRevision: number;
  checkId: string;
  response: string;
  committedAt: string;
  revealedAt?: string;
  grade?: RetrievalGrade;
  updatedAt: string;
};

export type PatternLearningWorkspace = {
  version: 1;
  revision: number;
  updatedAt: string;
  reviews: PatternReview[];
};

export type PatternEvidence = {
  committedChecks: number;
  revealedChecks: number;
  strongChecks: number;
  worked: boolean;
  guided: boolean;
  independent: boolean;
  transfer: boolean;
};

export const PATTERN_LEARNING_VERSION: 1;
export const PATTERN_RESPONSE_LIMIT: number;
export const PATTERN_REVIEW_LIMIT: number;
export const PATTERN_GRADES: RetrievalGrade[];
export function createPatternLearningWorkspace(now?: string): PatternLearningWorkspace;
export function normalizePatternLearningWorkspace(
  value: unknown,
  options?: { lessons?: readonly PatternLesson[]; now?: string },
): PatternLearningWorkspace;
export function commitPatternResponse(
  workspace: PatternLearningWorkspace,
  lesson: PatternLesson,
  checkId: string,
  response: string,
  options?: { now?: string },
): PatternLearningWorkspace;
export function revealPatternAnswer(
  workspace: PatternLearningWorkspace,
  lesson: PatternLesson,
  checkId: string,
  options?: { now?: string },
): PatternLearningWorkspace;
export function gradePatternCheck(
  workspace: PatternLearningWorkspace,
  lesson: PatternLesson,
  checkId: string,
  grade: RetrievalGrade,
  options?: { now?: string },
): PatternLearningWorkspace;
export function derivePatternEvidence(
  lesson: PatternLesson,
  workspace: PatternLearningWorkspace,
  attempts?: AttemptRecord[],
  items?: PracticeItem[],
): PatternEvidence;
export function countStrongPatternChecks(
  lessons: readonly PatternLesson[],
  workspace: PatternLearningWorkspace,
): number;
export function selectNextPatternLesson(
  lessons: readonly PatternLesson[],
  workspace: PatternLearningWorkspace,
  attempts?: AttemptRecord[],
  items?: PracticeItem[],
): PatternLesson | null;
