import type { PracticeItem, ItemId } from "./items";
import type { AttemptRecord, SessionHistoryRecord } from "./product";
import type { LearningEvent } from "./learning-state.mjs";
import type { InterviewStudioHistoryRecord, InterviewStudioFormat, InterviewStudioMode } from "./interview-studio.mjs";
import type { DailyPlan } from "./planner.mjs";
import type { SessionQueueEntry } from "./sessions.mjs";
import type { TypingProgressionWorkspace } from "./typing-progression.mjs";

export type StudyPlanPace = 15 | 30 | 45;
export type StudyModule = { id: string; title: string; outcome: string; itemIds: ItemId[]; patterns: string[]; simulation?: boolean };
export type StudyCollection = {
  id: string; revision: number; source: "builtin" | "custom"; title: string;
  description: string; outcome: string; itemIds: ItemId[]; modules: StudyModule[];
  createdAt: string; updatedAt: string;
};
export type StudyCapstone = { format: InterviewStudioFormat; mode: InterviewStudioMode; selfAssessed?: boolean };
export type StudyPlan = {
  id: string; revision: number; templateId?: string; title: string; description: string;
  outcome: string; collectionIds: string[]; collectionSnapshot: StudyCollection;
  status: "active" | "paused" | "curriculum-complete" | "archived";
  paceMinutes: StudyPlanPace; blocksPerWeek: number; sessionIds: string[];
  studioSessionIds: string[]; capstone?: StudyCapstone; createdAt: string;
  updatedAt: string; completedAt?: string;
};
export type StudyTombstone = { entity: "collection" | "plan"; id: string; deletedAt: string };
export type StudyWorkspace = { version: 1; revision: number; updatedAt: string; activePlanId: string | null; collections: StudyCollection[]; plans: StudyPlan[]; tombstones: StudyTombstone[] };
export type StudyEvidence = { items: PracticeItem[]; attempts?: AttemptRecord[]; learningEvents?: LearningEvent[]; typingProgress?: TypingProgressionWorkspace; interviewStudioHistory?: InterviewStudioHistoryRecord[]; sessionHistory?: SessionHistoryRecord[]; now?: string | Date | number };
export type StudyPlanTemplate = { id: string; title: string; description: string; outcome: string; recommended?: boolean; estimatedBlocks: number; defaultPace: StudyPlanPace; lanes: string[]; modules: ReadonlyArray<Record<string, unknown>>; selector?: Record<string, unknown>; capstone?: StudyCapstone };

export const STUDY_PLAN_LIMITS: Readonly<{ maxCollections: number; maxPlans: number; maxItemsPerCollection: number; maxTombstones: number; maxName: number; maxDescription: number; maxSessionLinks: number }>;
export const STUDY_PLAN_TEMPLATES: readonly StudyPlanTemplate[];
export function createStudyWorkspace(now?: string | Date | number): StudyWorkspace;
export function normalizeStudyWorkspace(value: unknown, options?: { validItemIds?: Iterable<string>; revisions?: ReadonlyMap<string, number>; now?: string | Date | number }): StudyWorkspace;
export function mergeStudyWorkspaces(local: unknown, remote: unknown, options?: { now?: string | Date | number }): StudyWorkspace;
export function linkStudyPlanSession(workspace: StudyWorkspace, planId: string, sessionId: string, kind?: "focus" | "studio", options?: { now?: string | Date | number }): StudyWorkspace;
export function createStudyCollection(workspace: StudyWorkspace, input: { title: string; description?: string; outcome?: string; itemIds: ItemId[]; modules?: StudyModule[]; source?: "builtin" | "custom" }, options?: { id?: string; now?: string | Date | number }): StudyWorkspace;
export function appendStudyCollectionItems(workspace: StudyWorkspace, collectionId: string, requestedItemIds: readonly ItemId[], options?: { now?: string | Date | number }): StudyWorkspace;
export function updateStudyCollection(workspace: StudyWorkspace, collectionId: string, patch: Partial<Pick<StudyCollection, "title" | "description" | "outcome" | "itemIds" | "modules">>, options?: { now?: string | Date | number }): StudyWorkspace;
export function deleteStudyCollection(workspace: StudyWorkspace, collectionId: string, options?: { now?: string | Date | number }): StudyWorkspace;
export function createStudyPlan(workspace: StudyWorkspace, input: { collectionId: string; title?: string; description?: string; paceMinutes?: StudyPlanPace; blocksPerWeek?: number; status?: "active" | "paused" }, options?: { id?: string; now?: string | Date | number }): StudyWorkspace;
export function updateStudyPlan(workspace: StudyWorkspace, planId: string, patch: Partial<Pick<StudyPlan, "title" | "description" | "paceMinutes" | "blocksPerWeek" | "sessionIds" | "studioSessionIds" | "status" | "completedAt">>, options?: { now?: string | Date | number }): StudyWorkspace;
export function activateStudyPlan(workspace: StudyWorkspace, planId: string, options?: { now?: string | Date | number }): StudyWorkspace;
export function pauseStudyPlan(workspace: StudyWorkspace, planId: string, options?: { now?: string | Date | number }): StudyWorkspace;
export function deleteStudyPlan(workspace: StudyWorkspace, planId: string, options?: { now?: string | Date | number }): StudyWorkspace;
export function instantiateStudyPlanTemplate(workspace: StudyWorkspace, templateId: string, items: PracticeItem[], options?: { planId?: string; collectionId?: string; paceMinutes?: StudyPlanPace; blocksPerWeek?: number; now?: string | Date | number }): StudyWorkspace;
export function deriveStudyCollectionProgress(collection: StudyCollection, evidence: StudyEvidence): { totalItems: number; completedItems: number; evidence: { independent: number; assisted: number; due: number; retained: number; outdated: number }; statuses: Array<Record<string, unknown>> };
export function deriveStudyPlanProgress(plan: StudyPlan, workspace: StudyWorkspace, evidence: StudyEvidence): { completedItems: number; totalItems: number; evidence: { independent: number; assisted: number; due: number; retained: number; outdated: number }; currentModule: StudyModule; modules: Array<StudyModule & { total: number; completed: number; evidenceMet: boolean }>; whyNext: string; capstoneReady: boolean; curriculumComplete: boolean };
export function buildNextFocusBlock(plan: StudyPlan, workspace: StudyWorkspace, evidence: StudyEvidence, options?: { now?: string | Date | number; budgetMinutes?: number; maxItems?: number }): { queue: SessionQueueEntry[]; entries: SessionQueueEntry[]; dailyPlan: DailyPlan; estimatedMinutes: number; deferredDueCount: number; rationale: string };
