export type TransferVariantStatus =
  | "unseen"
  | "opened"
  | "attempted"
  | "assisted"
  | "proven"
  | "due";

export type TransferEvidenceCoverage = "complete" | "partial";

export type TransferExposure = {
  variantId: string;
  variantRevision: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  maxHintLevel: 0 | 1 | 2 | 3;
  firstHintedAt: string | null;
  lastHintedAt: string | null;
  referenceRevealedAt: string | null;
};

export type TransferWorkspace = {
  version: 1;
  revision: number;
  updatedAt: string;
  coverage: TransferEvidenceCoverage;
  exposures: TransferExposure[];
};

export type TransferVariantLike = {
  variantId?: string;
  itemId?: string;
  id?: string | number;
  variantRevision?: number;
  contentRevision?: number;
  itemRevision?: number;
  revision?: number;
  eligible?: boolean;
  active?: boolean;
  available?: boolean;
  archivedAt?: unknown;
  status?: string;
  [key: string]: unknown;
};

export type TransferAttemptLike = {
  id?: string;
  attemptId?: string;
  variantId?: string;
  itemId?: string;
  variantRevision?: number;
  itemRevision?: number;
  contentRevision?: number;
  practiceKind?: string;
  outcome?: string;
  qualification?: string;
  assistanceUsed?: boolean;
  peeks?: number;
  maxHintLevel?: number;
  hintLevel?: number;
  referenceRevealedAt?: string;
  answerUnlockedAt?: string;
  completedAt?: string;
  submittedAt?: string;
  updatedAt?: string;
  verification?: { passed?: number; total?: number; [key: string]: unknown };
  [key: string]: unknown;
};

export type TransferSubmissionLike = {
  id?: string;
  submissionId?: string;
  attemptId?: string;
  variantId?: string;
  itemId?: string;
  variantRevision?: number;
  itemRevision?: number;
  contentRevision?: number;
  status?: string;
  verdict?: string;
  assistanceUsed?: boolean;
  peeks?: number;
  maxHintLevel?: number;
  hintLevel?: number;
  referenceRevealedAt?: string;
  answerUnlockedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  updatedAt?: string;
  passed?: number;
  total?: number;
  [key: string]: unknown;
};

export type TransferProgressInput<
  TVariant extends TransferVariantLike = TransferVariantLike,
> = {
  variants?: ReadonlyArray<TVariant>;
  workspace?: unknown;
  attempts?: ReadonlyArray<TransferAttemptLike>;
  submissions?: ReadonlyArray<TransferSubmissionLike>;
  now?: string | Date | number;
  eligibleVariantIds?: Iterable<string>;
};

export type TransferVariantProgress = {
  variantId: string;
  variantRevision: number;
  eligible: boolean;
  status: TransferVariantStatus;
  isUnseen: boolean;
  isOpened: boolean;
  isAttempted: boolean;
  isAssisted: boolean;
  isProven: boolean;
  isDue: boolean;
  exposureUnknown: boolean;
  evidenceCoverage: TransferEvidenceCoverage;
  exposure: TransferExposure | null;
  attemptCount: number;
  submissionCount: number;
  failedSubmissionCount: number;
  independentSolveCount: number;
  spacedSolveCount: number;
  firstProvenAt: string | null;
  lastProvenAt: string | null;
  dueAt: string | null;
  lastActivityAt: string | null;
};

export const TRANSFER_REVIEW_INTERVAL_DAYS: readonly [1, 3, 7, 14, 30];
export const TRANSFER_WORKSPACE_LIMITS: Readonly<{
  maxExposures: number;
  maxIdLength: number;
  maxOpenCount: number;
  maxRevision: number;
  maxEvidenceCount: number;
}>;

export function createTransferWorkspace(
  now?: string | Date | number,
): TransferWorkspace;

export function normalizeTransferWorkspace(
  value: unknown,
  options?: { now?: string | Date | number },
): TransferWorkspace;

export function recordTransferOpened(
  workspace: unknown,
  variantId: string,
  options?: { now?: string | Date | number; variantRevision?: number },
): TransferWorkspace;

export function recordTransferHint(
  workspace: unknown,
  variantId: string,
  hintLevel: number,
  options?: {
    now?: string | Date | number;
    variantRevision?: number;
    referenceRevealed?: boolean;
    referenceRevealedAt?: string | Date | number;
  },
): TransferWorkspace;

export function deriveTransferProgress(
  input?: TransferProgressInput,
): TransferVariantProgress[];

export function selectNextTransferVariant<
  TVariant extends TransferVariantLike = TransferVariantLike,
>(input?: TransferProgressInput<TVariant>): TVariant | null;
