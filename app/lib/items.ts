import { PROBLEMS, type Pattern, type Problem } from "../data/problems";
import { FUNDAMENTALS } from "../data/fundamentals";
import { PYTHON_PROBLEMS } from "../data/python-problems";
import { ADVANCED_PYTHON_PROBLEMS } from "../data/advanced-python-problems";
import {
  getPythonChallenge,
  type PythonChallengeMetadata,
} from "../data/python-challenges";
import type { PythonVerification } from "./python-runner.mjs";

export type PracticeTrack = "interview" | "ios";
export type CodeLanguage = "swift" | "python";
export type ItemId =
  | `builtin:${number}`
  | `python:${number}`
  | `ios:${string}`
  | `custom:${string}`;

export type PracticeItem = Omit<Problem, "swiftNote"> & {
  itemId: ItemId;
  track: PracticeTrack;
  language: CodeLanguage;
  languageNote: string;
  source: "builtin" | "custom";
  tags: string[];
  contentRevision: number;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string;
  masks?: Partial<Record<2 | 3 | 4, string>>;
  recallChecks?: readonly [string, string, string];
  conceptAnswers?: readonly [string, string, string];
  verification?: PythonVerification;
  starterCode?: string;
  challenge?: PythonChallengeMetadata;
};

export const INTERVIEW_ITEMS: PracticeItem[] = PROBLEMS.map(
  ({ swiftNote, ...problem }) => ({
    ...problem,
    languageNote: swiftNote,
    itemId: `builtin:${problem.id}` as ItemId,
    track: "interview",
    language: "swift",
    source: "builtin",
    tags: [problem.pattern],
    contentRevision: 1,
  }),
);

const PYTHON_JUDGE_REVISION = 2;

function pythonCaseId(problemId: number, name: string, index: number) {
  const stableName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${problemId}:${stableName || index + 1}`;
}

export const PYTHON_ITEMS: PracticeItem[] = [
  ...PYTHON_PROBLEMS,
  ...ADVANCED_PYTHON_PROBLEMS,
].map((problem) => ({
  ...problem,
  challenge: getPythonChallenge(problem.id),
  verification: {
    ...problem.verification,
    revision: PYTHON_JUDGE_REVISION,
    cases: problem.verification.cases.map((testCase, index) => ({
      ...testCase,
      id: pythonCaseId(problem.id, testCase.name, index),
      visibility: index < Math.min(2, problem.verification.cases.length - 1)
        ? "sample" as const
        : "hidden" as const,
    })),
  },
  itemId: `python:${problem.id}` as ItemId,
  track: "interview",
  language: "python",
  source: "builtin",
  contentRevision: 1,
}));

export const IOS_ITEMS: PracticeItem[] = FUNDAMENTALS.map(
  ({ swiftNote, ...fundamental }, index) => ({
    ...fundamental,
    id: 10001 + index,
    itemId: fundamental.id as ItemId,
    pattern: fundamental.pattern as Pattern,
    language: "swift",
    languageNote: swiftNote,
    source: "builtin",
    contentRevision: 2,
  }),
);

export const BUILTIN_ITEMS: PracticeItem[] = [
  ...PYTHON_ITEMS,
  ...INTERVIEW_ITEMS,
  ...IOS_ITEMS,
];

export function itemIdFor(problem: Pick<PracticeItem, "itemId">) {
  return problem.itemId;
}

export function itemDisplayId(item: PracticeItem) {
  if (item.source === "custom") return "Custom";
  if (item.language === "python")
    return item.id >= 10000
      ? `Py Lab ${String(item.id - 10000).padStart(2, "0")}`
      : `Py #${item.id}`;
  return item.track === "ios"
    ? `iOS ${String(IOS_ITEMS.findIndex((candidate) => candidate.itemId === item.itemId) + 1).padStart(2, "0")}`
    : `#${item.id}`;
}

export function makeCustomItem(input: {
  title: string;
  track: PracticeTrack;
  language: CodeLanguage;
  pattern: Pattern;
  difficulty: "Easy" | "Medium" | "Hard";
  code: string;
  cue: string;
  invariant: string;
  complexity: string;
  languageNote: string;
  tags?: string[];
  sourceUrl?: string;
}): PracticeItem {
  const token =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  const title = input.title.trim();
  return {
    itemId: `custom:${token}`,
    track: input.track,
    language: input.track === "ios" ? "swift" : input.language,
    source: "custom",
    id: 0,
    title,
    slug: `custom-${token}`,
    difficulty: input.difficulty,
    pattern: input.pattern,
    summary: `A device-local ${input.track === "ios" || input.language === "swift" ? "Swift" : "Python"} snippet for deliberate recall practice.`,
    cue:
      input.cue.trim() ||
      "State what this code is trying to preserve before typing.",
    invariant:
      input.invariant.trim() ||
      "Describe the condition that must stay true throughout the implementation.",
    complexity: input.complexity.trim() || "Add your own complexity check.",
    languageNote:
      input.languageNote.trim() ||
      `Notice the ${input.track === "ios" || input.language === "swift" ? "Swift" : "Python"} syntax and APIs you want to recall reliably.`,
    estimatedMinutes: Math.max(
      2,
      Math.min(30, Math.ceil(input.code.split("\n").length / 3)),
    ),
    code: input.code.replace(/\r\n?/g, "\n").trimEnd(),
    isCustom: true,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    tags: [
      ...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
    ].slice(0, 8),
    contentRevision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateCustomItem(
  item: PracticeItem,
  input: Parameters<typeof makeCustomItem>[0],
): PracticeItem {
  const title = input.title.trim();
  const code = input.code.replace(/\r\n?/g, "\n").trimEnd();
  return {
    ...item,
    title,
    track: input.track,
    language: input.track === "ios" ? "swift" : input.language,
    difficulty: input.difficulty,
    pattern: input.pattern,
    cue:
      input.cue.trim() ||
      "State what this code is trying to preserve before typing.",
    invariant:
      input.invariant.trim() ||
      "Describe the condition that must stay true throughout the implementation.",
    complexity: input.complexity.trim() || "Add your own complexity check.",
    languageNote:
      input.languageNote.trim() ||
      `Notice the ${input.track === "ios" || input.language === "swift" ? "Swift" : "Python"} syntax and APIs you want to recall reliably.`,
    estimatedMinutes: Math.max(
      2,
      Math.min(30, Math.ceil(input.code.split("\n").length / 3)),
    ),
    code,
    sourceUrl:
      input.sourceUrl === undefined
        ? item.sourceUrl
        : input.sourceUrl.trim() || undefined,
    tags:
      input.tags === undefined
        ? item.tags
        : [
            ...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)),
          ].slice(0, 8),
    contentRevision:
      code === item.code ? item.contentRevision : item.contentRevision + 1,
    updatedAt: new Date().toISOString(),
  };
}
