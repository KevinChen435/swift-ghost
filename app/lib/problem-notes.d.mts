import type { ItemId } from "./items";

export type ProblemNote = {
  itemId: ItemId;
  itemRevision: number;
  approach: string;
  pitfalls: string;
  complexity: string;
  updatedAt: string;
};

export type ProblemNotes = Partial<Record<ItemId, ProblemNote>>;

export const PROBLEM_NOTE_LIMITS: {
  readonly maxNotes: number;
  readonly maxApproachLength: number;
  readonly maxPitfallsLength: number;
  readonly maxComplexityLength: number;
  readonly maxTotalBytes: number;
};

export function normalizeProblemNotes(
  value: unknown,
  options?: { validItemIds?: Set<ItemId>; now?: string },
): ProblemNotes;
export function saveProblemNote(
  notes: ProblemNotes,
  input: Omit<ProblemNote, "updatedAt">,
  options?: { validItemIds?: Set<ItemId>; now?: string },
): ProblemNotes;
export function deleteProblemNote(
  notes: ProblemNotes,
  itemId: ItemId,
  options?: { validItemIds?: Set<ItemId>; now?: string },
): ProblemNotes;
