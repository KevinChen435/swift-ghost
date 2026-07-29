import type { ItemId } from "../lib/items";
import type { PatternLesson } from "./pattern-lessons";

export type PatternDecisionSource =
  | "academy"
  | "today"
  | "plan"
  | "assessment"
  | "weakness";

export type PatternDecisionProbe = {
  id: `decision:${string}`;
  revision: number;
  clusterId: "linear-containers";
  lessonId: PatternLesson["id"];
  candidateLessonIds: PatternLesson["id"][];
  prompt: string;
  constraint: string;
  hint: string;
  authoredCue: string;
  authoredInvariant: string;
  confusableLessonId: PatternLesson["id"];
  whyConfusableLoses: string;
  solveItemId: ItemId;
};

const LINEAR_CONTAINER_CANDIDATES: PatternLesson["id"][] = [
  "pattern:arrays-hashing",
  "pattern:two-pointers",
  "pattern:sliding-window",
];

export const PATTERN_DECISION_PROBES: readonly PatternDecisionProbe[] = [
  {
    id: "decision:unsorted-complement",
    revision: 1,
    clusterId: "linear-containers",
    lessonId: "pattern:arrays-hashing",
    candidateLessonIds: LINEAR_CONTAINER_CANDIDATES,
    prompt:
      "An unsorted list of transaction amounts contains exactly one pair whose sum equals a target. Return the original indices of that pair.",
    constraint:
      "You may scan once, but sorting would destroy the index relationship you must return.",
    hint:
      "Ask what fact about earlier values would let the current value finish the answer immediately.",
    authoredCue:
      "The input is unsorted, original indices matter, and each current value asks whether its complement appeared earlier.",
    authoredInvariant:
      "Before index i is processed, the lookup table maps every earlier value to an earlier index and contains no current or future value.",
    confusableLessonId: "pattern:two-pointers",
    whyConfusableLoses:
      "Opposing pointers need sorted order to justify movement; sorting would require extra bookkeeping to recover the original indices.",
    solveItemId: "python:1",
  },
  {
    id: "decision:signature-groups",
    revision: 1,
    clusterId: "linear-containers",
    lessonId: "pattern:arrays-hashing",
    candidateLessonIds: LINEAR_CONTAINER_CANDIDATES,
    prompt:
      "Group a list of lowercase labels so that two labels share a bucket exactly when they contain the same letters with the same multiplicities.",
    constraint:
      "Groups may contain labels from distant positions; output order inside a group is not important.",
    hint:
      "Look for a stable representation that is identical for every member of one equivalence class.",
    authoredCue:
      "This is noncontiguous grouping by an equivalence key, not a search over one interval.",
    authoredInvariant:
      "After processing a prefix, each canonical signature maps to exactly the labels from that prefix with that signature.",
    confusableLessonId: "pattern:sliding-window",
    whyConfusableLoses:
      "A sliding window maintains one contiguous region, while these groups may combine labels from anywhere in the input.",
    solveItemId: "python:49",
  },
  {
    id: "decision:sorted-pair-frontier",
    revision: 1,
    clusterId: "linear-containers",
    lessonId: "pattern:two-pointers",
    candidateLessonIds: LINEAR_CONTAINER_CANDIDATES,
    prompt:
      "A sorted array of distinct positive scores contains two values whose sum is a target. Return their one-based positions using constant extra space.",
    constraint:
      "The array is already sorted and the expected solution must use O(1) auxiliary memory.",
    hint:
      "Ask whether one comparison can rule out every pair that uses an entire boundary value.",
    authoredCue:
      "Sorted order makes the pair sum move predictably when either boundary moves, and the space constraint rules out a table.",
    authoredInvariant:
      "No discarded index outside left...right can participate in a valid pair; the remaining pair frontier is complete.",
    confusableLessonId: "pattern:arrays-hashing",
    whyConfusableLoses:
      "A lookup table would work but spend O(n) space, ignoring the sorted order and the explicit constant-space requirement.",
    solveItemId: "python:15",
  },
  {
    id: "decision:one-deletion-palindrome",
    revision: 1,
    clusterId: "linear-containers",
    lessonId: "pattern:two-pointers",
    candidateLessonIds: LINEAR_CONTAINER_CANDIDATES,
    prompt:
      "Determine whether a string can become a palindrome after deleting at most one character.",
    constraint:
      "You only need a boolean answer and should avoid building every possible edited string.",
    hint:
      "Start at the only two positions whose equality is relevant to the outside-in proof.",
    authoredCue:
      "Palindrome structure is symmetric, so matching ends can be discarded monotonically until the first mismatch creates two bounded branches.",
    authoredInvariant:
      "All characters outside the two boundaries already match; the remaining substring has the full deletion budget until the first mismatch.",
    confusableLessonId: "pattern:sliding-window",
    whyConfusableLoses:
      "There is no incrementally repaired contiguous validity condition or longest/shortest interval objective.",
    solveItemId: "python:125",
  },
  {
    id: "decision:distinct-service-window",
    revision: 1,
    clusterId: "linear-containers",
    lessonId: "pattern:sliding-window",
    candidateLessonIds: LINEAR_CONTAINER_CANDIDATES,
    prompt:
      "Find the longest contiguous span of service names in a request log that contains no repeated service.",
    constraint:
      "The answer must be one contiguous span, and a new request extends only the right edge.",
    hint:
      "Name the exact region whose membership counts must stay valid after every right-edge addition.",
    authoredCue:
      "The objective is a longest contiguous region whose duplicate-free validity can be repaired by removing from the left.",
    authoredInvariant:
      "After shrinking, the frequency state describes exactly log[left...right] and every service in that window appears once.",
    confusableLessonId: "pattern:arrays-hashing",
    whyConfusableLoses:
      "A set is useful state, but hashing alone does not describe the two moving boundaries or prove which contiguous region is currently valid.",
    solveItemId: "python:3",
  },
  {
    id: "decision:minimum-positive-span",
    revision: 1,
    clusterId: "linear-containers",
    lessonId: "pattern:sliding-window",
    candidateLessonIds: LINEAR_CONTAINER_CANDIDATES,
    prompt:
      "Given positive readings, return the minimum length of a contiguous span whose sum is at least a threshold, or zero if none exists.",
    constraint:
      "Every reading is positive, so removing the leftmost reading can only decrease the current sum.",
    hint:
      "Use the positivity constraint to decide when expanding and shrinking are each safe.",
    authoredCue:
      "Positive values make window validity monotonic: expand until valid, then shrink while validity survives to minimize the span.",
    authoredInvariant:
      "The running sum equals exactly the current contiguous window, and every recorded answer was measured while that sum met the threshold.",
    confusableLessonId: "pattern:two-pointers",
    whyConfusableLoses:
      "The boundaries do move monotonically, but they jointly own an aggregate over every value between them; that maintained region is the essential idea.",
    solveItemId: "python:76",
  },
];
