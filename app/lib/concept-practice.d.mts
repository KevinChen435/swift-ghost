export function supportsConceptPractice(item: unknown): boolean;
export function selectConceptCheckIndex(
  attempts: unknown,
  itemId: string,
  itemRevision: number,
): 0 | 1 | 2;
export function isConceptGrade(value: unknown): boolean;
export function conceptQualification(input?: {
  grade?: unknown;
  peeks?: number;
}): "independent" | "assisted";
export function cleanConceptResponse(value: unknown, limit?: number): string;
