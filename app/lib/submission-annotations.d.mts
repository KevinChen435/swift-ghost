export type SubmissionAnnotationTag =
  | "off-by-one"
  | "syntax"
  | "edge-case"
  | "complexity"
  | "review"
  | "clean";

export type SubmissionAnnotation = {
  note: string;
  tags: SubmissionAnnotationTag[];
  updatedAt: string;
};

export type SubmissionAnnotations = Record<string, SubmissionAnnotation>;

export type SubmissionIdCollection =
  | ReadonlySet<string>
  | readonly string[];

export type SubmissionAnnotationPatch = {
  note?: string;
  tags?: readonly SubmissionAnnotationTag[];
};

export const SUBMISSION_ANNOTATION_TAGS: readonly SubmissionAnnotationTag[];

export function normalizeSubmissionAnnotations(
  value: unknown,
  validSubmissionIds: SubmissionIdCollection,
): SubmissionAnnotations;

export function updateSubmissionAnnotation(
  current: unknown,
  submissionId: string,
  patch: SubmissionAnnotationPatch,
  options: {
    validSubmissionIds: SubmissionIdCollection;
    now: string | number | Date;
  },
): SubmissionAnnotations;

export function pruneSubmissionAnnotations(
  current: unknown,
  validSubmissionIds: SubmissionIdCollection,
): SubmissionAnnotations;
