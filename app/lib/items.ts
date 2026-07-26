import { PROBLEMS, type Pattern, type Problem } from "../data/problems";

export type ItemId = `builtin:${number}` | `custom:${string}`;

export type PracticeItem = Problem & {
  itemId: ItemId;
  source: "builtin" | "custom";
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string;
  masks?: Partial<Record<2 | 3 | 4, string>>;
};

export const BUILTIN_ITEMS: PracticeItem[] = PROBLEMS.map((problem) => ({
  ...problem,
  itemId: `builtin:${problem.id}` as ItemId,
  source: "builtin",
  tags: [problem.pattern],
}));

export function itemIdFor(problem: Pick<PracticeItem, "itemId">) {
  return problem.itemId;
}

export function itemDisplayId(item: PracticeItem) {
  return item.source === "builtin" ? `#${item.id}` : "Custom";
}

export function makeCustomItem(input: {
  title: string;
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
    code: input.code.replace(/\r\n/g, "\n").trimEnd(),
    isCustom: true,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    tags: [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))].slice(0, 8),
    createdAt: now,
    updatedAt: now,
  };
}
