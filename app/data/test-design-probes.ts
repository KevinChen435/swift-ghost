import type { ItemId } from "../lib/items";

export type TestPurpose =
  "baseline" | "boundary" | "adversarial" | "regression";
export type TestDesignSource = "academy" | "today" | "assessment" | "weakness";

export type AuthoredTestCase = {
  id: string;
  purpose: TestPurpose;
  input: string;
  expected: string;
  rationale: string;
  defectCaught: string;
  comparator?: "unorderedNested";
};

export type TestDesignProbe = {
  id: `test-design:${string}`;
  revision: number;
  itemId: ItemId;
  itemRevision: number;
  skillId:
    "collection-contracts" | "normalization-contracts" | "window-contracts";
  skillLabel: string;
  title: string;
  prompt: string;
  constraint: string;
  primaryPurpose: TestPurpose;
  hint: string;
  referenceCases: AuthoredTestCase[];
};

export const TEST_DESIGN_PROBES: readonly TestDesignProbe[] = [
  {
    id: "test-design:two-sum-distinct-index",
    revision: 1,
    itemId: "python:1",
    itemRevision: 1,
    skillId: "collection-contracts",
    skillLabel: "Collection output contracts",
    title: "Two Sum",
    prompt:
      "Design one small test that exposes an implementation which inserts the current value before checking its complement.",
    constraint:
      "The answer is a pair of original indices, and one array position cannot be reused.",
    primaryPurpose: "adversarial",
    hint: "A single value equal to half the target can tempt a buggy table lookup to reuse its own index.",
    referenceCases: [
      {
        id: "single-no-reuse",
        purpose: "adversarial",
        input: "[[4], 8]",
        expected: "[]",
        rationale: "The smallest input that can expose self-reuse.",
        defectCaught:
          "Inserting before lookup can return the same index twice.",
      },
      {
        id: "duplicate-pair",
        purpose: "regression",
        input: "[[4, 4], 8]",
        expected: "[0, 1]",
        rationale:
          "Confirms equal values at distinct indices still form a valid pair.",
        defectCaught:
          "Rejecting all equal-value complements would miss the real answer.",
      },
    ],
  },
  {
    id: "test-design:three-sum-dedup",
    revision: 1,
    itemId: "python:15",
    itemRevision: 1,
    skillId: "collection-contracts",
    skillLabel: "Collection output contracts",
    title: "3Sum",
    prompt:
      "Design one small test that distinguishes unique value triples from duplicate emissions.",
    constraint:
      "The output contains each zero-sum value triple once; index combinations are not separate answers.",
    primaryPurpose: "regression",
    hint: "Use repeated copies of values that make exactly one value triple.",
    referenceCases: [
      {
        id: "many-zeroes",
        purpose: "regression",
        input: "[[0, 0, 0, 0, 0]]",
        expected: "[[0, 0, 0]]",
        rationale:
          "One extra zero is enough to create duplicate index combinations.",
        defectCaught:
          "Failing to skip duplicates can emit the same triple more than once.",
        comparator: "unorderedNested",
      },
      {
        id: "short-input",
        purpose: "boundary",
        input: "[[0, 0]]",
        expected: "[]",
        rationale: "A triple cannot exist below length three.",
        defectCaught:
          "Loose pointer bounds can read invalid positions or invent a result.",
      },
    ],
  },
  {
    id: "test-design:anagram-multiplicity",
    revision: 1,
    itemId: "python:49",
    itemRevision: 1,
    skillId: "normalization-contracts",
    skillLabel: "Normalization contracts",
    title: "Group Anagrams",
    prompt:
      "Design one test that proves an anagram key must preserve character multiplicity, not only membership.",
    constraint:
      "Two words belong together only when every lowercase letter has the same count.",
    primaryPurpose: "adversarial",
    hint: "Choose two words with the same set of letters but different counts.",
    referenceCases: [
      {
        id: "same-set-different-count",
        purpose: "adversarial",
        input: '[["abb", "ab"]]',
        expected: '[["abb"], ["ab"]]',
        rationale:
          "The words share a character set but not a frequency signature.",
        defectCaught:
          "Using a set or unique letters as the key merges non-anagrams.",
        comparator: "unorderedNested",
      },
      {
        id: "empty-and-nonempty",
        purpose: "boundary",
        input: '[["", "a"]]',
        expected: '[[""], ["a"]]',
        rationale: "Makes the empty signature explicit.",
        defectCaught: "Skipping empty strings loses a valid group.",
        comparator: "unorderedNested",
      },
    ],
  },
  {
    id: "test-design:palindrome-normalization",
    revision: 1,
    itemId: "python:125",
    itemRevision: 1,
    skillId: "normalization-contracts",
    skillLabel: "Normalization contracts",
    title: "Valid Palindrome",
    prompt:
      "Design one test that forces the comparison to honor both normalization rules: ignore punctuation and ignore case.",
    constraint:
      "ASCII letters and digits are significant; other characters are skipped.",
    primaryPurpose: "baseline",
    hint: "A two-letter palindrome separated by punctuation can exercise both rules at once.",
    referenceCases: [
      {
        id: "case-and-punctuation",
        purpose: "baseline",
        input: '["A, a"]',
        expected: "true",
        rationale: "A compact example exercises skipping and lowercasing.",
        defectCaught:
          "Comparing raw characters rejects a normalized palindrome.",
      },
      {
        id: "digits-significant",
        purpose: "adversarial",
        input: '["1a2"]',
        expected: "false",
        rationale: "Digits must remain in the normalized sequence.",
        defectCaught:
          "A letters-only filter can incorrectly discard a real mismatch.",
      },
    ],
  },
  {
    id: "test-design:longest-window-left",
    revision: 1,
    itemId: "python:3",
    itemRevision: 1,
    skillId: "window-contracts",
    skillLabel: "Window boundary contracts",
    title: "Longest Unique Substring",
    prompt:
      "Design one regression test for an implementation that moves the left boundary backward when it sees an old repeat.",
    constraint:
      "Only repeats whose prior index is inside the current window may move the left boundary.",
    primaryPurpose: "regression",
    hint: "Create a repeat, move past it, then repeat a character whose old position is already outside the window.",
    referenceCases: [
      {
        id: "stale-repeat",
        purpose: "regression",
        input: '["abbac"]',
        expected: "3",
        rationale:
          "The second a is stale, and the trailing c makes a backward left-edge move visibly overcount.",
        defectCaught:
          "Assigning left directly to last_seen + 1 can move it backward and overcount.",
      },
      {
        id: "empty",
        purpose: "boundary",
        input: '[""]',
        expected: "0",
        rationale: "Defines the neutral result for no window.",
        defectCaught:
          "Initializing the best length to one fails on empty input.",
      },
    ],
  },
  {
    id: "test-design:min-window-multiplicity",
    revision: 1,
    itemId: "python:76",
    itemRevision: 1,
    skillId: "window-contracts",
    skillLabel: "Window boundary contracts",
    title: "Minimum Window Substring",
    prompt:
      "Design one adversarial test that proves the target is a multiset, not a set of required characters.",
    constraint:
      "The returned substring must cover every target character with its full multiplicity.",
    primaryPurpose: "adversarial",
    hint: "Require the same character twice while the source offers tempting one-copy windows.",
    referenceCases: [
      {
        id: "repeated-requirement",
        purpose: "adversarial",
        input: '["ABAAC", "AAC"]',
        expected: '"AAC"',
        rationale:
          "A set-based check would accept windows containing only one A.",
        defectCaught:
          "Tracking only distinct required characters returns an invalid shorter window.",
      },
      {
        id: "target-longer",
        purpose: "boundary",
        input: '["ab", "aab"]',
        expected: '""',
        rationale: "The source cannot satisfy the target multiplicity.",
        defectCaught:
          "Missing impossibility handling can return a partial or stale window.",
      },
    ],
  },
];
