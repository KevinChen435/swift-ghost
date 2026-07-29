import type { AttemptRecord } from "./product";
import type { PracticeItem } from "./items";
import type { ConceptTransferVariant } from "../data/concept-transfer-variants";

export type FluencyClinicPassKind = "visible" | "faded" | "blank" | "recheck";
export type FluencyClinicStatus =
  | "repairing"
  | "reconstruction-ready"
  | "recheck-waiting"
  | "recheck-due"
  | "transfer-ready"
  | "stabilized"
  | "transfer-observed"
  | "retired";

export type FluencyClinicPass = {
  id: string;
  kind: FluencyClinicPassKind;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  corrections: number;
  characters: number;
  assistance: "guided-line-repair";
};

export type FluencyClinicCase = {
  id: string;
  itemId: string;
  itemRevision: number;
  titleSnapshot: string;
  language: "python" | "swift";
  line: number;
  targetLineSnapshot: string;
  contextSnapshot: Array<{ lineNumber: number; text: string; isTarget: boolean }>;
  sourceAttemptIds: string[];
  errorCount: number;
  attemptCount: number;
  detectedAt: string;
  lastErrorAt: string;
  createdAt: string;
  updatedAt: string;
  passes: FluencyClinicPass[];
};

export type FluencyClinicWorkspace = {
  version: 1;
  revision: number;
  updatedAt: string;
  cases: FluencyClinicCase[];
};

export type FluencyClinicRecord = FluencyClinicCase & {
  status: FluencyClinicStatus;
  nextPass: FluencyClinicPassKind | null;
  reconstructionAttempt: AttemptRecord | null;
  reconstructionAttemptId: string | null;
  recheckDueAt: string | null;
  transferVariant: PracticeItem | ConceptTransferVariant | null;
  transferVariantId: string | null;
  transferKind: "python-transfer" | "concept-transfer";
  transferProgress: {
    targetedTransferObserved?: boolean;
    targetedTransferObservedAt?: string | null;
  } | null;
  comparison: {
    baseline: AttemptRecord | null;
    reconstruction: AttemptRecord | null;
    delta: null | {
      wpm: number;
      accuracy: number;
      corrections: number;
      durationMs: number;
    };
  };
  evidenceClaim: "implementation-fluency" | "repair-in-progress";
  claimsMastery: false;
  claimsIndependentSolve: false;
  scope: "private-local-implementation-fluency-evidence";
};

export const FLUENCY_CLINIC_VERSION: 1;
export const FLUENCY_CLINIC_RECHECK_DELAY_MS: number;
export const FLUENCY_CLINIC_PASS_ORDER: readonly FluencyClinicPassKind[];
export const FLUENCY_CLINIC_LIMITS: Readonly<{
  maxCases: number;
  maxSourceAttemptIds: number;
  maxSnapshotCharacters: number;
  maxContextLines: number;
  maxRevision: number;
}>;
export function fluencyClinicCaseId(
  itemId: string,
  itemRevision: number,
  line: number,
): string;
export function createFluencyClinicWorkspace(
  now?: string | Date | number,
): FluencyClinicWorkspace;
export function normalizeFluencyClinicWorkspace(
  value: unknown,
  options?: { now?: string | Date | number },
): FluencyClinicWorkspace;
export function reconcileFluencyClinicWorkspace(
  value: unknown,
  options?: {
    now?: string | Date | number;
    items?: readonly PracticeItem[];
    attempts?: readonly AttemptRecord[];
  },
): FluencyClinicWorkspace;
export function enqueueFluencyClinicCase(
  workspace: unknown,
  input: {
    item: PracticeItem;
    weakLine: {
      line: number;
      errorCount?: number;
      attemptCount?: number;
      lastSeenAtMs?: number;
    };
  },
  options?: { now?: string | Date | number },
): FluencyClinicWorkspace;
export function nextFluencyClinicPass(
  record: FluencyClinicCase,
): "visible" | "faded" | "blank" | null;
export function recordFluencyClinicPass(
  workspace: unknown,
  caseId: string,
  input: {
    kind: FluencyClinicPassKind;
    startedAt?: string | Date | number;
    durationMs?: number;
    corrections?: number;
  },
  options?: {
    now?: string | Date | number;
    expectedRevision?: number;
    attempts?: readonly AttemptRecord[];
  },
): FluencyClinicWorkspace;
export function deriveFluencyClinicModel(
  workspace: unknown,
  options?: {
    now?: string | Date | number;
    items?: readonly PracticeItem[];
    attempts?: readonly AttemptRecord[];
    transferVariants?: readonly unknown[];
    transferProgress?: readonly unknown[];
    selectedId?: string;
  },
): FluencyClinicModel;

export type FluencyClinicModel = {
  generatedAt: string;
  scope: "private-local-implementation-fluency-evidence";
  records: FluencyClinicRecord[];
  cases: FluencyClinicRecord[];
  selected: FluencyClinicRecord | null;
  next: FluencyClinicRecord | null;
  summary: {
    total: number;
    active: number;
    due: number;
    repairing: number;
    reconstructionReady: number;
    transferReady: number;
    stabilized: number;
    retired: number;
  };
};
