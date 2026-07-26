import { PROBLEMS, type Pattern, type Problem } from "../data/problems";
import { FUNDAMENTALS } from "../data/fundamentals";

export type PracticeTrack = "interview" | "ios";
export type ItemId = `builtin:${number}` | `ios:${string}` | `custom:${string}`;

export type PracticeItem = Problem & {
  itemId: ItemId;
  track: PracticeTrack;
  source: "builtin" | "custom";
  tags: string[];
  contentRevision: number;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string;
  masks?: Partial<Record<2 | 3 | 4, string>>;
  recallChecks?: readonly [string, string, string];
};

export const INTERVIEW_ITEMS: PracticeItem[] = PROBLEMS.map((problem) => ({
  ...problem,
  itemId: `builtin:${problem.id}` as ItemId,
  track: "interview",
  source: "builtin",
  tags: [problem.pattern],
  contentRevision: 1,
}));

export const IOS_ITEMS: PracticeItem[] = FUNDAMENTALS.map((fundamental, index) => ({
  ...fundamental,
  id: 10001 + index,
  itemId: fundamental.id as ItemId,
  pattern: fundamental.pattern as Pattern,
  source: "builtin",
  contentRevision: 1,
}));

export const BUILTIN_ITEMS: PracticeItem[] = [...INTERVIEW_ITEMS, ...IOS_ITEMS];

export function itemIdFor(problem: Pick<PracticeItem, "itemId">) {
  return problem.itemId;
}

export function itemDisplayId(item: PracticeItem) {
  if (item.source === "custom") return "Custom";
  return item.track === "ios" ? `iOS ${String(IOS_ITEMS.findIndex((candidate) => candidate.itemId === item.itemId) + 1).padStart(2, "0")}` : `#${item.id}`;
}

export function makeCustomItem(input: {
  title: string;
  track: PracticeTrack;
  pattern: Pattern;
  difficulty: "Easy" | "Medium";
  code: string;
  cue: string;
  invariant: string;
  complexity: string;
  swiftNote: string;
  tags?: string[];
  sourceUrl?: string;
}): PracticeItem {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  const title = input.title.trim();
  return {
    itemId: `custom:${token}`,
    track: input.track,
    source: "custom",
    id: 0,
    title,
    slug: `custom-${token}`,
    difficulty: input.difficulty,
    pattern: input.pattern,
    summary: "A device-local Swift snippet for deliberate recall practice.",
    cue: input.cue.trim() || "State what this code is trying to preserve before typing.",
    invariant: input.invariant.trim() || "Describe the condition that must stay true throughout the implementation.",
    complexity: input.complexity.trim() || "Add your own complexity check.",
    swiftNote: input.swiftNote.trim() || "Notice the Swift syntax and APIs you want to recall reliably.",
    estimatedMinutes: Math.max(2, Math.min(30, Math.ceil(input.code.split("\n").length / 3))),
    code: input.code.replace(/\r\n?/g, "\n").trimEnd(),
    isCustom: true,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    tags: [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))].slice(0, 8),
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
    difficulty: input.difficulty,
    pattern: input.pattern,
    cue: input.cue.trim() || "State what this code is trying to preserve before typing.",
    invariant: input.invariant.trim() || "Describe the condition that must stay true throughout the implementation.",
    complexity: input.complexity.trim() || "Add your own complexity check.",
    swiftNote: input.swiftNote.trim() || "Notice the Swift syntax and APIs you want to recall reliably.",
    estimatedMinutes: Math.max(2, Math.min(30, Math.ceil(input.code.split("\n").length / 3))),
    code,
    sourceUrl: input.sourceUrl === undefined ? item.sourceUrl : input.sourceUrl.trim() || undefined,
    tags: input.tags === undefined ? item.tags : [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 8),
    contentRevision: code === item.code ? item.contentRevision : item.contentRevision + 1,
    updatedAt: new Date().toISOString(),
  };
}
