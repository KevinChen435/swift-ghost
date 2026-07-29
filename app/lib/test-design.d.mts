import type { RetrievalGrade } from "./learning-state.mjs";
import type { ItemId, PracticeItem } from "./items";
import type {
  TestDesignProbe,
  TestDesignSource,
  TestPurpose,
} from "../data/test-design-probes";
export type OracleStatus = "confirmed" | "contradicted" | "unverified";
export type TestDesignInput = {
  purpose: TestPurpose | "";
  assumption: string;
  input: string;
  expected: string;
  defectCaught: string;
  assisted: boolean;
};
export type TestDesignAttempt = Omit<TestDesignInput, "purpose"> & {
  purpose: TestPurpose;
  id: string;
  sprintId: string;
  source: TestDesignSource;
  probeId: string;
  probeRevision: number;
  itemId: ItemId;
  itemRevision: number;
  skillId: string;
  wasDue: boolean;
  purposeMatch: boolean;
  oracleStatus: OracleStatus;
  committedAt: string;
  revealedAt?: string;
  grade?: RetrievalGrade;
  completedAt?: string;
  dueAt?: string;
  levelAfter?: number;
  lapseCount?: number;
  updatedAt: string;
};
export type TestDesignDraft = TestDesignInput & {
  sprintId: string;
  probeId: string;
  probeRevision: number;
  updatedAt: string;
};
export type TestDesignSprint = {
  id: string;
  source: TestDesignSource;
  entries: { probeId: string; probeRevision: number }[];
  cursor: number;
  status: "active" | "completed";
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
};
export type TestDesignWorkspace = {
  version: 1;
  revision: number;
  updatedAt: string;
  attempts: TestDesignAttempt[];
  drafts: TestDesignDraft[];
  activeSprint?: TestDesignSprint;
};
export const TEST_DESIGN_VERSION: 1;
export const TEST_DESIGN_ATTEMPT_LIMIT: number;
export const TEST_DESIGN_DRAFT_LIMIT: number;
export const TEST_DESIGN_SPRINT_LIMIT: number;
export const TEST_DESIGN_INTERVAL_DAYS: number[];
export const TEST_DESIGN_GRADES: RetrievalGrade[];
export const TEST_DESIGN_PURPOSES: TestPurpose[];
export const TEST_DESIGN_SOURCES: TestDesignSource[];
export function canonicalTestValue(value: string): string | undefined;
export function createTestDesignWorkspace(now?: string): TestDesignWorkspace;
export function normalizeTestDesignWorkspace(
  value: unknown,
  options?: {
    probes?: readonly TestDesignProbe[];
    items?: readonly PracticeItem[];
    now?: string;
  },
): TestDesignWorkspace;
export function deriveTestDesignState(
  skillId: string,
  workspace: TestDesignWorkspace,
  probes: readonly TestDesignProbe[],
  options?: { now?: string },
): {
  skillId: string;
  level: number;
  lapseCount: number;
  dueAt?: string;
  due: boolean;
  isNew: boolean;
  retained: boolean;
  retainedProbeCount: number;
  completedAttempts: number;
  lastAttemptAt?: string;
};
export function deriveTestDesignOverview(
  probes: readonly TestDesignProbe[],
  workspace: TestDesignWorkspace,
  options?: { now?: string },
): {
  newCount: number;
  dueCount: number;
  readyCount: number;
  retainedCount: number;
  totalSkills: number;
  states: ReturnType<typeof deriveTestDesignState>[];
};
export function selectTestDesignProbes(
  probes: readonly TestDesignProbe[],
  workspace: TestDesignWorkspace,
  options?: { now?: string; count?: number },
): TestDesignProbe[];
export function startTestDesignSprint(
  workspace: TestDesignWorkspace,
  probes: readonly TestDesignProbe[],
  items: readonly PracticeItem[],
  options: {
    id: string;
    now?: string;
    count?: number;
    source?: TestDesignSource;
  },
): TestDesignWorkspace;
export function saveTestDesignDraft(
  workspace: TestDesignWorkspace,
  probe: TestDesignProbe,
  input: TestDesignInput,
  options: {
    probes: readonly TestDesignProbe[];
    items: readonly PracticeItem[];
    now?: string;
  },
): TestDesignWorkspace;
export function commitTestDesignAttempt(
  workspace: TestDesignWorkspace,
  probe: TestDesignProbe,
  input: TestDesignInput,
  options: {
    id: string;
    probes: readonly TestDesignProbe[];
    items: readonly PracticeItem[];
    now?: string;
  },
): TestDesignWorkspace;
export function revealTestDesignAttempt(
  workspace: TestDesignWorkspace,
  attemptId: string,
  options: {
    probes: readonly TestDesignProbe[];
    items: readonly PracticeItem[];
    now?: string;
  },
): TestDesignWorkspace;
export function gradeTestDesignAttempt(
  workspace: TestDesignWorkspace,
  attemptId: string,
  grade: RetrievalGrade,
  options: {
    probes: readonly TestDesignProbe[];
    items: readonly PracticeItem[];
    now?: string;
  },
): TestDesignWorkspace;
