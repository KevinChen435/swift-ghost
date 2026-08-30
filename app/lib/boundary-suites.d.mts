import type { PracticeItem } from "./items";
import type {
  PythonVerification,
  PythonVerificationCase,
} from "./python-runner.mjs";

export type BoundaryDrillPackDescriptor = {
  id: string;
  title: string;
  purpose: string;
  kind: string;
  rationale: string;
  caseIds: readonly string[];
};

export type BoundaryDrillSuiteDescriptor = {
  itemId: string;
  contentRevision: number;
  verificationRevision: number;
  packs: readonly BoundaryDrillPackDescriptor[];
};

export type ResolvedBoundaryDrillPack = BoundaryDrillPackDescriptor & {
  cases: readonly PythonVerificationCase[];
};

export type ResolvedBoundaryDrillSuite = {
  itemId: string;
  contentRevision: number;
  verificationRevision: number;
  packs: readonly ResolvedBoundaryDrillPack[];
};

export function validateBoundaryDrillRegistry<T extends readonly BoundaryDrillSuiteDescriptor[]>(
  registry: T,
): T;
export function resolveBoundaryDrillSuite(
  item: PracticeItem,
  registry: readonly BoundaryDrillSuiteDescriptor[],
): ResolvedBoundaryDrillSuite | null;
export function buildBoundaryDrillVerification(
  item: PracticeItem,
  suite: ResolvedBoundaryDrillSuite,
  packId: string,
  caseId?: string,
): {
  pack: ResolvedBoundaryDrillPack;
  caseIds: string[];
  expectedValues: unknown[];
  verification: PythonVerification;
};
export const BOUNDARY_DRILL_LIMITS: Readonly<{
  maxSuites: number;
  maxPacksPerSuite: number;
  maxCasesPerPack: number;
}>;
