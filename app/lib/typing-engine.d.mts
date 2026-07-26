export type EditAnalysis = {
  prefix: number;
  removed: string;
  inserted: string;
  deletedCount: number;
  insertedCount: number;
  correctInserted: number;
  incorrectInserted: number;
};

export function analyzeEdit(previous: string, proposed: string, target: string): EditAnalysis;
export function correctPositionCount(value: string, target: string): number;
