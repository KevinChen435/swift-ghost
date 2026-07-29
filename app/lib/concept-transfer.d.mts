import type {
  ConceptTransferLane,
  ConceptTransferVariant,
} from "../data/concept-transfer-variants";

export type ConceptTransferGrade = "again" | "hard" | "good" | "easy";
export type ConceptTransferQualification =
  | "cold-self-assessed"
  | "assisted"
  | "reference-reconstruction";

export type ConceptTransferAttempt = {
  id: string;
  variantId: string;
  variantRevision: number;
  lane: ConceptTransferLane;
  family: string;
  startedAt: string;
  wasDue: boolean;
  maxHintLevel: number;
  hintRevealedAt: string[];
  assisted: boolean;
  prediction?: string;
  reconstruction?: string;
  tradeoff?: string;
  committedAt?: string;
  referenceRevealedAt?: string;
  grade?: ConceptTransferGrade;
  selfGradedAt?: string;
  criteria?: string[];
  criteriaRecordedAt?: string;
  teachBack?: string;
  teachBackRecordedAt?: string;
  qualification?: ConceptTransferQualification;
  levelAfter?: number;
  lapseCount?: number;
  dueAt?: string;
  finishedAt?: string;
  updatedAt: string;
  retired?: true;
};

export type ConceptTransferDraft = {
  attemptId: string;
  variantId: string;
  variantRevision: number;
  prediction: string;
  reconstruction: string;
  tradeoff: string;
  maxHintLevel: number;
  hintRevealedAt: string[];
  assisted: boolean;
  updatedAt: string;
};

export type ConceptTransferWorkspace = {
  version: 1;
  revision: number;
  updatedAt: string;
  attempts: ConceptTransferAttempt[];
  drafts: ConceptTransferDraft[];
  activeAttemptId?: string;
};

export type ConceptTransferVariantState = {
  variantId: string;
  variantRevision: number;
  lane: ConceptTransferLane;
  family: string;
  isNew: boolean;
  due: boolean;
  dueAt?: string;
  level: number;
  lapseCount: number;
  completedAttempts: number;
  lastAttemptAt?: string;
  lastQualification?: ConceptTransferQualification;
};

export type ConceptTransferNeutralProjection = {
  id: string;
  revision: number;
  lane: ConceptTransferLane;
  neutralLabel: string;
  scenario: string;
  constraints: string[];
  estimatedMinutes: number;
  predictionPrompt: string;
  reconstructionPrompt: string;
  tradeoffPrompt: string;
  hints: string[];
  revealed: false;
};

export type ConceptTransferRevealedProjection =
  Omit<ConceptTransferNeutralProjection, "revealed"> & {
    revealed: true;
    revealedTitle: string;
    family: string;
    sourceItemIds: string[];
    referenceSnippet: string;
    review: {
      patternLabel: string;
      invariant: string;
      criteria: string[];
      contrast: string;
      teachBack: string;
    };
  };

export type ConceptTransferMutationOptions = {
  variants: readonly ConceptTransferVariant[];
  now?: string | Date | number;
};

export const CONCEPT_TRANSFER_WORKSPACE_VERSION: 1;
export const CONCEPT_TRANSFER_INTERVAL_DAYS: readonly [1, 3, 7, 14, 30];
export const CONCEPT_TRANSFER_GRADES: readonly ConceptTransferGrade[];
export const CONCEPT_TRANSFER_LIMITS: Readonly<{
  attempts: number;
  drafts: number;
  idChars: number;
  predictionChars: number;
  predictionLines: number;
  reconstructionChars: number;
  reconstructionLines: number;
  tradeoffChars: number;
  tradeoffLines: number;
  teachBackChars: number;
  teachBackLines: number;
  criteria: number;
}>;
export const CURRENT_CONCEPT_TRANSFER_WORKSPACE: Readonly<ConceptTransferWorkspace>;

export function normalizeConceptTransferText(
  value: unknown,
  options?: { maxChars?: number; maxLines?: number },
): string;
export function createConceptTransferWorkspace(
  now?: string | Date | number,
): ConceptTransferWorkspace;
export function normalizeConceptTransferWorkspace(
  value: unknown,
  options?: {
    variants?: readonly ConceptTransferVariant[];
    now?: string | Date | number;
  },
): ConceptTransferWorkspace;
export function deriveConceptTransferVariantState(
  variant: ConceptTransferVariant,
  workspace: ConceptTransferWorkspace,
  options?: {
    variants?: readonly ConceptTransferVariant[];
    now?: string | Date | number;
  },
): ConceptTransferVariantState;
export function selectConceptTransferVariant(
  variants: readonly ConceptTransferVariant[],
  workspace: ConceptTransferWorkspace,
  options?: {
    now?: string | Date | number;
    lane?: ConceptTransferLane;
    activeFamily?: string;
  },
): ConceptTransferVariant | undefined;
export function projectConceptTransferVariant(
  variant: ConceptTransferVariant,
  session?: Partial<ConceptTransferAttempt & ConceptTransferDraft>,
): ConceptTransferNeutralProjection | ConceptTransferRevealedProjection;
export function resumeConceptTransferAttempt(
  workspace: ConceptTransferWorkspace,
  variants: readonly ConceptTransferVariant[],
  options?: { now?: string | Date | number },
):
  | {
      workspace: ConceptTransferWorkspace;
      attempt: ConceptTransferAttempt;
      draft?: ConceptTransferDraft;
      variant: ConceptTransferVariant;
      projection: ConceptTransferNeutralProjection | ConceptTransferRevealedProjection;
    }
  | undefined;
export function startConceptTransferAttempt(
  workspace: ConceptTransferWorkspace,
  variants: readonly ConceptTransferVariant[],
  options: {
    id: string;
    variantId?: string;
    now?: string | Date | number;
    lane?: ConceptTransferLane;
    activeFamily?: string;
  },
): ConceptTransferWorkspace;
export function updateConceptTransferDraft(
  workspace: ConceptTransferWorkspace,
  attemptId: string,
  patch: Partial<
    Pick<ConceptTransferDraft, "prediction" | "reconstruction" | "tradeoff">
  >,
  options: ConceptTransferMutationOptions,
): ConceptTransferWorkspace;
export function revealConceptTransferHint(
  workspace: ConceptTransferWorkspace,
  attemptId: string,
  options: ConceptTransferMutationOptions,
): ConceptTransferWorkspace;
export function commitConceptTransferAttempt(
  workspace: ConceptTransferWorkspace,
  attemptId: string,
  options: ConceptTransferMutationOptions,
): ConceptTransferWorkspace;
export function selfGradeConceptTransferAttempt(
  workspace: ConceptTransferWorkspace,
  attemptId: string,
  grade: ConceptTransferGrade | Capitalize<ConceptTransferGrade>,
  options: ConceptTransferMutationOptions,
): ConceptTransferWorkspace;
export function recordConceptTransferCriteria(
  workspace: ConceptTransferWorkspace,
  attemptId: string,
  criteria: readonly (string | number)[],
  options: ConceptTransferMutationOptions,
): ConceptTransferWorkspace;
export function recordConceptTransferTeachBack(
  workspace: ConceptTransferWorkspace,
  attemptId: string,
  teachBack: string,
  options: ConceptTransferMutationOptions,
): ConceptTransferWorkspace;
export function finishConceptTransferAttempt(
  workspace: ConceptTransferWorkspace,
  attemptId: string,
  options: ConceptTransferMutationOptions,
): ConceptTransferWorkspace;
export function summarizeConceptTransferWorkspace(
  workspace: ConceptTransferWorkspace,
  variants: readonly ConceptTransferVariant[],
  options?: { now?: string | Date | number; lane?: ConceptTransferLane },
): {
  version: 1;
  activeAttemptId?: string;
  variantCount: number;
  newCount: number;
  dueCount: number;
  completedAttemptCount: number;
  assistedAttemptCount: number;
  referenceReconstructionCount: number;
  coldSelfAssessedCount: number;
  retiredAttemptCount: number;
  states: ConceptTransferVariantState[];
};

export const startConceptTransfer: typeof startConceptTransferAttempt;
export const resumeConceptTransfer: typeof resumeConceptTransferAttempt;
export const commitConceptTransfer: typeof commitConceptTransferAttempt;
export const selfGradeConceptTransfer: typeof selfGradeConceptTransferAttempt;
export const finishConceptTransfer: typeof finishConceptTransferAttempt;
