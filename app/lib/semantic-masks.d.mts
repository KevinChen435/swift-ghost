export type SemanticMaskStage = 2 | 3 | 4;
export type SemanticMasks = Partial<Record<SemanticMaskStage, string>>;

export const SEMANTIC_MASK_LIMITS: Readonly<{
  maxCharacters: number;
  maxBytes: number;
}>;

export function normalizeSemanticMask(value: unknown, code: unknown): string | null;
export function normalizeSemanticMasks(value: unknown, code: unknown): SemanticMasks | undefined;
export function generateSemanticMasks(code: string, language?: "swift" | "python"): SemanticMasks | undefined;
export function semanticMasksEqual(left: unknown, right: unknown, code?: unknown): boolean;
