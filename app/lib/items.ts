import { PROBLEMS, type Pattern, type Problem } from "../data/problems";
import { FUNDAMENTALS } from "../data/fundamentals";
import { PYTHON_PROBLEMS } from "../data/python-problems";
import { ADVANCED_PYTHON_PROBLEMS } from "../data/advanced-python-problems";
import { TRANSFER_PROBLEMS } from "../data/transfer-problems";
import {
  getPythonChallenge,
  type PythonChallengeMetadata,
} from "../data/python-challenges";
import type { PythonVerification } from "./python-runner.mjs";
import {
  deriveCustomChallengeRevisions,
  normalizeCustomReferenceCode,
  normalizeCustomChallenge,
  type CustomChallengeBundle,
  type CustomChallengeInput,
} from "./custom-challenges";

export type PracticeTrack = "interview" | "ios";
export type CodeLanguage = "swift" | "python";
export type ItemId =
  | `builtin:${number}`
  | `python:${number}`
  | `transfer:${number}`
  | `ios:${string}`
  | `custom:${string}`;

export type TransferMetadata = {
  id: string;
  family: string;
  sourceItemIds: readonly ItemId[];
  postAttemptPatternLabel: Pattern;
  contrastExplanation: string;
  teachBackQuestion: string;
};

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
  transfer?: TransferMetadata;
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

export const TRANSFER_ITEMS: PracticeItem[] = TRANSFER_PROBLEMS.map(
  (problem) => ({
    ...problem,
    verification: {
      ...problem.verification,
      revision: PYTHON_JUDGE_REVISION,
    },
    itemId: `transfer:${problem.id}` as ItemId,
    track: "interview",
    language: "python",
    source: "builtin",
    contentRevision: 1,
    transfer: {
      ...problem.transfer,
      sourceItemIds: problem.transfer.sourceItemIds as readonly ItemId[],
    },
  }),
);

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
  ...TRANSFER_ITEMS,
];

export function itemIdFor(problem: Pick<PracticeItem, "itemId">) {
  return problem.itemId;
}

export function itemDisplayId(item: PracticeItem) {
  if (item.source === "custom") return "Custom";
  if (item.transfer) {
    const index = TRANSFER_ITEMS.findIndex(
      (candidate) => candidate.itemId === item.itemId,
    );
    return `Transfer ${String(index + 1).padStart(2, "0")}`;
  }
  if (item.language === "python")
    return item.id >= 10000
      ? `Py Lab ${String(item.id - 10000).padStart(2, "0")}`
      : `Py #${item.id}`;
  return item.track === "ios"
    ? `iOS ${String(IOS_ITEMS.findIndex((candidate) => candidate.itemId === item.itemId) + 1).padStart(2, "0")}`
    : `#${item.id}`;
}

export type CustomItemInput = {
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
  challenge?: CustomChallengeInput | null;
};

function bundleForItem(item: PracticeItem): CustomChallengeBundle | null {
  return item.challenge && item.verification && item.starterCode
    ? {
        challenge: item.challenge,
        verification: item.verification,
        starterCode: item.starterCode,
      }
    : null;
}

export function makeCustomItem(input: CustomItemInput): PracticeItem {
  const token =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  const title = input.title.trim();
  const itemId = `custom:${token}` as ItemId;
  if (input.challenge && (input.track !== "interview" || input.language !== "python"))
    throw new Error("Runnable challenges require the Python interview track");
  const code = input.challenge
    ? normalizeCustomReferenceCode(input.code)
    : input.code.replace(/\r\n?/g, "\n").trimEnd();
  const challengeBundle = input.challenge
    ? normalizeCustomChallenge(input.challenge, {
        stableId: itemId,
        title,
        revision: 1,
      })
    : null;
  return {
    itemId,
    track: input.track,
    language: input.track === "ios" ? "swift" : input.language,
    source: "custom",
    id: 0,
    title,
    slug: `custom-${token}`,
    difficulty: input.difficulty,
    pattern: input.pattern,
    summary: input.challenge
      ? "A device-local Python coding challenge with visible examples and a private submission suite."
      : `A device-local ${input.track === "ios" || input.language === "swift" ? "Swift" : "Python"} snippet for deliberate recall practice.`,
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
    isCustom: true,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    tags: [
      ...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
    ].slice(0, 8),
    contentRevision: 1,
    createdAt: now,
    updatedAt: now,
    ...(challengeBundle ?? {}),
  };
}

export function updateCustomItem(
  item: PracticeItem,
  input: CustomItemInput,
): PracticeItem {
  const title = input.title.trim();
  if (input.challenge && (input.track !== "interview" || input.language !== "python"))
    throw new Error("Runnable challenges require the Python interview track");
  const code = input.challenge
    ? normalizeCustomReferenceCode(input.code)
    : input.code.replace(/\r\n?/g, "\n").trimEnd();
  const currentBundle = bundleForItem(item);
  const requestedBundle = input.challenge
    ? normalizeCustomChallenge(input.challenge, {
        stableId: item.itemId,
        title,
        revision: item.verification?.revision ?? 1,
      })
    : null;
  const revisions = deriveCustomChallengeRevisions({
    current: currentBundle,
    requested: requestedBundle,
    contentRevision: item.contentRevision,
    judgeRevision: item.verification?.revision ?? 0,
    referenceChanged: code !== item.code,
  });
  const nextBundle =
    requestedBundle && revisions.judgeChanged
      ? {
          ...requestedBundle,
          verification: {
            ...requestedBundle.verification,
            revision: revisions.judgeRevision,
          },
        }
      : requestedBundle;
  return {
    ...item,
    title,
    track: input.track,
    language: input.track === "ios" ? "swift" : input.language,
    difficulty: input.difficulty,
    pattern: input.pattern,
    summary: nextBundle
      ? "A device-local Python coding challenge with visible examples and a private submission suite."
      : `A device-local ${input.track === "ios" || input.language === "swift" ? "Swift" : "Python"} snippet for deliberate recall practice.`,
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
    contentRevision: revisions.contentRevision,
    updatedAt: new Date().toISOString(),
    challenge: nextBundle?.challenge,
    verification: nextBundle?.verification,
    starterCode: nextBundle?.starterCode,
  };
}
