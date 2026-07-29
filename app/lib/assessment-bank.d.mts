export type AssessmentResponseMode = "local-verified-solve" | "swift-reconstruction" | "concept-recall";
export type AssessmentBankLane = "python" | "swift" | "ios";
export type AssessmentBankEntry = Readonly<{
  id: `assessment-bank:${string}`;
  revision: number;
  sectionId: string;
  itemId: string;
  itemRevision: number;
  judgeRevision?: number;
  lane: AssessmentBankLane;
  skillId: string;
  skillLabel: string;
  title: string;
  focus: string;
  difficulty: "Easy" | "Medium" | "Hard";
  responseMode: AssessmentResponseMode;
  estimatedMinutes: number;
  stage: 5;
  conceptCheckIndex?: 1;
}>;
export type AssessmentBlueprintSection = Readonly<{
  id: string;
  order: number;
  lane: AssessmentBankLane;
  title: string;
  count: 1;
  candidateCount: number;
  candidateIds: readonly string[];
  estimatedMinutes: Readonly<{ minimum: number; maximum: number }>;
}>;
export type AssessmentBlueprint = Readonly<{
  id: "cross-lane-reentry";
  revision: number;
  title: string;
  formSize: 6;
  candidateCount: 24;
  sections: readonly AssessmentBlueprintSection[];
}>;

export const ASSESSMENT_BANK_REVISION: number;
export const CROSS_LANE_BLUEPRINT_ID: "cross-lane-reentry";
export const ASSESSMENT_BANK_ENTRIES: readonly AssessmentBankEntry[];
export const CROSS_LANE_REENTRY_BLUEPRINT: AssessmentBlueprint;
export const ASSESSMENT_BLUEPRINTS: readonly AssessmentBlueprint[];
export function assessmentBankEntry(entryId: string): AssessmentBankEntry | null;
export function assessmentBlueprint(blueprintId: string): AssessmentBlueprint | null;
export function selectAssessmentForm(options?: { blueprintId?: string; seed?: string; history?: unknown; evidence?: unknown }): AssessmentBankEntry[];
export function isAssessmentResponseMode(value: unknown): value is AssessmentResponseMode;
