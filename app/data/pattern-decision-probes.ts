import type { ItemId } from "../lib/items";
import type { PatternLesson } from "./pattern-lessons";

export type PatternDecisionSource =
  | "academy"
  | "today"
  | "plan"
  | "assessment"
  | "weakness";

export type PatternDecisionClusterId =
  | "arrays-two-pointers-sliding-window"
  | "stack-binary-search-linked-list"
  | "trees-graphs-backtracking"
  | "intervals-greedy-dynamic-programming";

export type PatternDecisionProbe = {
  id: `decision:${string}`;
  revision: number;
  clusterId: PatternDecisionClusterId;
  lessonId: PatternLesson["id"];
  candidateLessonIds: PatternLesson["id"][];
  prompt: string;
  constraint: string;
  hint: string;
  authoredCue: string;
  authoredInvariant: string;
  confusableLessonId: PatternLesson["id"];
  whyConfusableLoses: string;
  authoredComplexity: string;
  expectedComplexity: string;
  solveItemId: ItemId;
};

const LINEAR_CANDIDATES: PatternLesson["id"][] = [
  "pattern:arrays-hashing",
  "pattern:two-pointers",
  "pattern:sliding-window",
];

const ORDERED_STATE_CANDIDATES: PatternLesson["id"][] = [
  "pattern:stack",
  "pattern:binary-search",
  "pattern:linked-list",
];

const TRAVERSAL_CANDIDATES: PatternLesson["id"][] = [
  "pattern:trees",
  "pattern:graphs",
  "pattern:backtracking",
];

const OPTIMIZATION_CANDIDATES: PatternLesson["id"][] = [
  "pattern:intervals",
  "pattern:greedy",
  "pattern:dynamic-programming",
];

const PATTERN_DECISION_PROBE_BANK: readonly Omit<
  PatternDecisionProbe,
  "authoredComplexity"
>[] = [
  {
    id: "decision:unsorted-complement",
    revision: 1,
    clusterId: "arrays-two-pointers-sliding-window",
    lessonId: "pattern:arrays-hashing",
    candidateLessonIds: LINEAR_CANDIDATES,
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
    expectedComplexity:
      "One expected O(n) pass with O(n) auxiliary space for the value-to-index lookup table.",
    solveItemId: "python:1",
  },
  {
    id: "decision:signature-groups",
    revision: 1,
    clusterId: "arrays-two-pointers-sliding-window",
    lessonId: "pattern:arrays-hashing",
    candidateLessonIds: LINEAR_CANDIDATES,
    prompt:
      "Group lowercase product codes so that two codes share a bucket exactly when they contain the same letters with the same multiplicities.",
    constraint:
      "Codes belonging together may occur at distant positions, and order inside each output group is irrelevant.",
    hint:
      "Look for a stable representation that is identical for every member of one equivalence class.",
    authoredCue:
      "This is noncontiguous grouping by an equivalence key, so each complete code should produce one canonical dictionary key.",
    authoredInvariant:
      "After processing a prefix, each canonical signature maps to exactly the codes in that prefix having that signature.",
    confusableLessonId: "pattern:sliding-window",
    whyConfusableLoses:
      "A sliding window maintains one contiguous region, while these groups combine complete codes from anywhere in the input.",
    expectedComplexity:
      "O(C) time for C total characters with fixed alphabet counts, plus O(C) space for keys and grouped output.",
    solveItemId: "python:49",
  },
  {
    id: "decision:zero-sum-triplets",
    revision: 1,
    clusterId: "arrays-two-pointers-sliding-window",
    lessonId: "pattern:two-pointers",
    candidateLessonIds: LINEAR_CANDIDATES,
    prompt:
      "Return every unique triplet of account adjustments whose values sum to zero, even when the input contains duplicate values.",
    constraint:
      "Duplicate triplets must be suppressed, and returning original indices is not required.",
    hint:
      "After ordering the values and fixing one position, ask how two boundaries can move without skipping a possible pair.",
    authoredCue:
      "Sorting is allowed, uniqueness matters, and fixing one value leaves an ordered two-value frontier with monotonic sum changes.",
    authoredInvariant:
      "For the fixed index, everything outside the left-right frontier has been ruled out or emitted, and duplicate boundary values are skipped deliberately.",
    confusableLessonId: "pattern:arrays-hashing",
    whyConfusableLoses:
      "Hashing can find complements but makes systematic duplicate suppression and the ordered frontier proof less direct.",
    expectedComplexity:
      "O(n^2) time after sorting; O(1) scan space excluding output, subject to the language sort implementation.",
    solveItemId: "python:15",
  },
  {
    id: "decision:normalized-palindrome",
    revision: 1,
    clusterId: "arrays-two-pointers-sliding-window",
    lessonId: "pattern:two-pointers",
    candidateLessonIds: LINEAR_CANDIDATES,
    prompt:
      "Decide whether a phrase is a palindrome after ignoring punctuation, spaces, and letter case, without constructing every possible comparison.",
    constraint:
      "Only alphanumeric characters participate, and the answer is a boolean rather than a transformed string.",
    hint:
      "The next meaningful comparison always comes from the two outermost unclassified characters.",
    authoredCue:
      "Palindrome validity is symmetric, so two boundaries can skip irrelevant characters and compare the remaining phrase outside-in.",
    authoredInvariant:
      "All meaningful characters strictly outside the boundaries have matched; neither boundary passes an unchecked meaningful character.",
    confusableLessonId: "pattern:sliding-window",
    whyConfusableLoses:
      "There is no contiguous-region objective or validity state to repair by shrinking one side of a window.",
    expectedComplexity:
      "O(n) time because each boundary moves inward at most n positions, with O(1) auxiliary space.",
    solveItemId: "python:125",
  },
  {
    id: "decision:distinct-service-window",
    revision: 1,
    clusterId: "arrays-two-pointers-sliding-window",
    lessonId: "pattern:sliding-window",
    candidateLessonIds: LINEAR_CANDIDATES,
    prompt:
      "Find the longest contiguous span of service names in a request log that contains no repeated service name.",
    constraint:
      "The answer must be one contiguous span, and each newly read request extends only the right edge.",
    hint:
      "Name the exact region whose membership state must stay valid after every right-edge addition.",
    authoredCue:
      "The objective is a longest contiguous region whose duplicate-free validity can be repaired by removing from the left.",
    authoredInvariant:
      "After shrinking, the frequency state describes exactly log[left...right] and every service in that window appears once.",
    confusableLessonId: "pattern:arrays-hashing",
    whyConfusableLoses:
      "A set is useful state, but hashing alone does not describe the two moving boundaries or prove which contiguous region is valid.",
    expectedComplexity:
      "O(n) time because each entry enters and leaves at most once, with O(k) space for k distinct services.",
    solveItemId: "python:3",
  },
  {
    id: "decision:minimum-covering-log",
    revision: 1,
    clusterId: "arrays-two-pointers-sliding-window",
    lessonId: "pattern:sliding-window",
    candidateLessonIds: LINEAR_CANDIDATES,
    prompt:
      "Find the shortest contiguous log excerpt containing every required event code with at least its required multiplicity.",
    constraint:
      "Extra event codes are allowed inside the excerpt, but every required occurrence must be covered.",
    hint:
      "Track when the current region covers all required counts, then ask which left-edge entries can be removed safely.",
    authoredCue:
      "This is a minimum contiguous covering region whose validity can be updated incrementally as either boundary moves.",
    authoredInvariant:
      "The frequency state describes exactly the current excerpt, and the formed counter says exactly how many required categories meet their target count.",
    confusableLessonId: "pattern:arrays-hashing",
    whyConfusableLoses:
      "Counts are necessary, but a global frequency table cannot identify or minimize the one contiguous covering excerpt.",
    expectedComplexity:
      "O(n + m) time for log and requirement lengths, with O(k) space for tracked event categories.",
    solveItemId: "python:76",
  },
  {
    id: "decision:nested-delimiters",
    revision: 1,
    clusterId: "stack-binary-search-linked-list",
    lessonId: "pattern:stack",
    candidateLessonIds: ORDERED_STATE_CANDIDATES,
    prompt:
      "Validate whether a configuration string's parentheses, brackets, and braces are balanced and closed in the legal nesting order.",
    constraint:
      "A closer must match the most recently opened delimiter that has not already been closed.",
    hint:
      "Which unresolved opener must every new closer inspect first?",
    authoredCue:
      "Nested structure resolves in reverse opening order, so only the most recent unresolved opener can match the next closer.",
    authoredInvariant:
      "The stack contains exactly the unmatched openers from the processed prefix in their nesting order.",
    confusableLessonId: "pattern:linked-list",
    whyConfusableLoses:
      "References and pointer rewiring are absent; the decisive property is last-opened, first-closed resolution.",
    expectedComplexity:
      "O(n) time for one scan and O(n) worst-case space when every character is an opener.",
    solveItemId: "python:20",
  },
  {
    id: "decision:warmer-reading-waits",
    revision: 1,
    clusterId: "stack-binary-search-linked-list",
    lessonId: "pattern:stack",
    candidateLessonIds: ORDERED_STATE_CANDIDATES,
    prompt:
      "For each daily temperature reading, return how many days pass before a strictly warmer reading, or zero if none arrives.",
    constraint:
      "Future readings resolve prior days, and the result needs the distance between their positions.",
    hint:
      "Keep only prior days that the current reading has not yet resolved, in an order that exposes every newly resolvable day.",
    authoredCue:
      "Each warmer value can resolve a suffix of unresolved colder days, and the most recent unresolved day is checked first.",
    authoredInvariant:
      "Stack indices are unresolved days with nonincreasing temperatures; each popped day is first resolved by the current warmer reading.",
    confusableLessonId: "pattern:binary-search",
    whyConfusableLoses:
      "The data is processed chronologically and has no fixed monotonic domain whose half can be discarded by one predicate check.",
    expectedComplexity:
      "O(n) total time because every index is pushed and popped at most once, with O(n) space.",
    solveItemId: "python:739",
  },
  {
    id: "decision:exact-catalog-id",
    revision: 1,
    clusterId: "stack-binary-search-linked-list",
    lessonId: "pattern:binary-search",
    candidateLessonIds: ORDERED_STATE_CANDIDATES,
    prompt:
      "A catalog stores unique numeric identifiers in increasing order. Return the index of a requested identifier, or -1 when absent.",
    constraint:
      "The catalog is already sorted, and the requested running time is logarithmic.",
    hint:
      "After comparing the middle identifier, state why one entire half cannot contain the target.",
    authoredCue:
      "Sorted order plus an exact lookup permits each comparison to discard half of the remaining candidate indices.",
    authoredInvariant:
      "If the target exists, its index remains inside the active search interval; every discarded index has a proven value on the wrong side.",
    confusableLessonId: "pattern:linked-list",
    whyConfusableLoses:
      "Binary search depends on random access to a midpoint, which a linked traversal cannot provide efficiently.",
    expectedComplexity:
      "O(log n) time through repeated half-discarding and O(1) auxiliary space for an iterative search.",
    solveItemId: "python:704",
  },
  {
    id: "decision:minimum-processing-rate",
    revision: 1,
    clusterId: "stack-binary-search-linked-list",
    lessonId: "pattern:binary-search",
    candidateLessonIds: ORDERED_STATE_CANDIDATES,
    prompt:
      "Choose the smallest integer processing rate that finishes several indivisible work piles within a fixed number of hours.",
    constraint:
      "For any proposed rate you can compute required hours, and every faster rate also succeeds once one rate succeeds.",
    hint:
      "Search for the first true value of the monotonic predicate 'this rate finishes on time.'",
    authoredCue:
      "The answer lies in an ordered numeric domain and feasibility changes monotonically from false to true exactly once.",
    authoredInvariant:
      "The active rate interval still contains the minimum feasible rate; rates discarded below are infeasible and those discarded above are unnecessary.",
    confusableLessonId: "pattern:stack",
    whyConfusableLoses:
      "There is no last-in, first-out unresolved order; the central operation is a monotonic feasibility check over candidate rates.",
    expectedComplexity:
      "O(n log M) time for n piles and maximum pile M, with O(1) auxiliary space.",
    solveItemId: "python:875",
  },
  {
    id: "decision:reverse-node-chain",
    revision: 1,
    clusterId: "stack-binary-search-linked-list",
    lessonId: "pattern:linked-list",
    candidateLessonIds: ORDERED_STATE_CANDIDATES,
    prompt:
      "Reverse a singly linked chain in place and return the node that becomes its new head without copying node values into an array.",
    constraint:
      "Once a next reference is overwritten, the unprocessed suffix must still remain reachable.",
    hint:
      "Before redirecting the current node, identify the one reference that must be saved.",
    authoredCue:
      "The task is identity-preserving pointer rewiring, so each mutation must retain a path to the untouched suffix.",
    authoredInvariant:
      "The previous pointer heads the correctly reversed prefix, current heads the untouched suffix, and a saved next reference preserves reachability.",
    confusableLessonId: "pattern:stack",
    whyConfusableLoses:
      "A stack could reverse encounter order with O(n) memory, but it ignores the explicit in-place link-rewiring requirement.",
    expectedComplexity:
      "O(n) time for one traversal and O(1) auxiliary space using three node references.",
    solveItemId: "python:206",
  },
  {
    id: "decision:cycle-in-reference-chain",
    revision: 1,
    clusterId: "stack-binary-search-linked-list",
    lessonId: "pattern:linked-list",
    candidateLessonIds: ORDERED_STATE_CANDIDATES,
    prompt:
      "Determine whether following next references from the head of a singly linked structure eventually revisits a node.",
    constraint:
      "Use constant auxiliary space; node values may repeat and therefore cannot identify node identity.",
    hint:
      "Ask what happens to two references moving at different speeds if the path enters a finite cycle.",
    authoredCue:
      "The structure is traversed by identity-based references, and a slow-fast speed relationship detects repeated reachability without stored history.",
    authoredInvariant:
      "Both references follow valid next edges; if no reference reaches nil inside a cycle, the faster reference must eventually meet the slower one.",
    confusableLessonId: "pattern:binary-search",
    whyConfusableLoses:
      "There is no ordered index domain or monotonic predicate, and linked nodes do not support midpoint random access.",
    expectedComplexity:
      "O(n) time before termination or meeting and O(1) auxiliary space for the two references.",
    solveItemId: "python:141",
  },
  {
    id: "decision:hierarchy-depth",
    revision: 1,
    clusterId: "trees-graphs-backtracking",
    lessonId: "pattern:trees",
    candidateLessonIds: TRAVERSAL_CANDIDATES,
    prompt:
      "Return the maximum number of nodes on a root-to-leaf path in a binary reporting hierarchy, with an empty hierarchy having depth zero.",
    constraint:
      "Each node has at most a left and right child, and child subtrees do not reconnect elsewhere.",
    hint:
      "Define exactly what one recursive call should return for the subtree rooted at its argument.",
    authoredCue:
      "A child-rooted hierarchy is an independent subproblem whose depth summaries combine locally at the parent.",
    authoredInvariant:
      "Every completed call returns the exact maximum depth of its subtree, with a missing child returning the declared base depth zero.",
    confusableLessonId: "pattern:graphs",
    whyConfusableLoses:
      "A generic graph traversal works but adds visited-state machinery that the unique-parent tree structure does not require.",
    expectedComplexity:
      "O(n) time to visit every node once and O(h) call-stack space for tree height h.",
    solveItemId: "python:104",
  },
  {
    id: "decision:ordered-tree-validation",
    revision: 1,
    clusterId: "trees-graphs-backtracking",
    lessonId: "pattern:trees",
    candidateLessonIds: TRAVERSAL_CANDIDATES,
    prompt:
      "Validate that every node in a binary search tree candidate obeys all ordering restrictions inherited from its ancestors.",
    constraint:
      "Checking only a node against its immediate parent is insufficient; duplicate keys are invalid.",
    hint:
      "Carry the full legal value interval implied by the path from the root.",
    authoredCue:
      "The hierarchical path contributes ancestor bounds, and each subtree receives a tighter local contract from its parent.",
    authoredInvariant:
      "At helper entry, every valid value in the subtree must lie strictly inside the carried lower and upper bounds.",
    confusableLessonId: "pattern:backtracking",
    whyConfusableLoses:
      "There is no choice tree to enumerate or mutable path decision to undo; both child subtrees must simply satisfy inherited contracts.",
    expectedComplexity:
      "O(n) time to inspect every node and O(h) recursion space for tree height h.",
    solveItemId: "python:98",
  },
  {
    id: "decision:island-components",
    revision: 1,
    clusterId: "trees-graphs-backtracking",
    lessonId: "pattern:graphs",
    candidateLessonIds: TRAVERSAL_CANDIDATES,
    prompt:
      "Count connected land components in a rectangular grid where land cells connect only through shared horizontal or vertical edges.",
    constraint:
      "A component may contain cycles through adjacent cells, and each land cell must contribute to exactly one count.",
    hint:
      "Treat each land cell as a state connected to legal neighboring states, then mark a whole component when first discovered.",
    authoredCue:
      "The grid defines an arbitrary adjacency graph, and the answer counts reachability components rather than root-to-child summaries.",
    authoredInvariant:
      "Every marked cell belongs to a component whose traversal started already, and each new traversal begins at an unmarked land cell.",
    confusableLessonId: "pattern:trees",
    whyConfusableLoses:
      "Grid neighbors can lead back to prior cells and have multiple incoming paths, so tree traversal without visited state can repeat forever.",
    expectedComplexity:
      "O(rows * columns) time and O(rows * columns) worst-case traversal or visited space.",
    solveItemId: "python:200",
  },
  {
    id: "decision:dependency-cycle",
    revision: 1,
    clusterId: "trees-graphs-backtracking",
    lessonId: "pattern:graphs",
    candidateLessonIds: TRAVERSAL_CANDIDATES,
    prompt:
      "Given directed prerequisite pairs, decide whether every course can be completed or whether a dependency cycle makes completion impossible.",
    constraint:
      "A course may have several prerequisites and may also be prerequisite for several later courses.",
    hint:
      "Model courses as nodes and prerequisites as directed edges; then maintain either indegrees or traversal colors.",
    authoredCue:
      "This is a directed dependency graph whose feasibility is exactly the absence of a directed cycle.",
    authoredInvariant:
      "In an indegree solution, the queue contains exactly currently prerequisite-free courses; processing one removes each outgoing dependency once.",
    confusableLessonId: "pattern:backtracking",
    whyConfusableLoses:
      "Enumerating course orders repeats equivalent dependency states; the question only needs graph cycle detection or topological processing.",
    expectedComplexity:
      "O(V + E) time and O(V + E) space for adjacency plus traversal or indegree state.",
    solveItemId: "python:207",
  },
  {
    id: "decision:reusable-sum-choices",
    revision: 1,
    clusterId: "trees-graphs-backtracking",
    lessonId: "pattern:backtracking",
    candidateLessonIds: TRAVERSAL_CANDIDATES,
    prompt:
      "Enumerate every unique combination of distinct positive candidate values that reaches a target when each candidate may be reused.",
    constraint:
      "Combination order does not matter, but each complete combination must be returned explicitly.",
    hint:
      "Define one decision level, restrict later choices to a nondecreasing candidate position, and undo after exploring.",
    authoredCue:
      "The required output is a set of explicit choice paths, and each partial sum changes which branches remain feasible.",
    authoredInvariant:
      "At helper entry, the path is one nondecreasing choice prefix whose sum plus the remaining target equals the original target.",
    confusableLessonId: "pattern:graphs",
    whyConfusableLoses:
      "Global visited marking would incorrectly merge different choice paths; candidates are deliberately reusable in separate branches.",
    expectedComplexity:
      "Exponential search-tree time, with O(target / minimumCandidate) path depth plus the required output.",
    solveItemId: "python:39",
  },
  {
    id: "decision:word-path-grid",
    revision: 1,
    clusterId: "trees-graphs-backtracking",
    lessonId: "pattern:backtracking",
    candidateLessonIds: TRAVERSAL_CANDIDATES,
    prompt:
      "Decide whether a word can be traced through adjacent grid cells without using the same cell twice within one candidate path.",
    constraint:
      "Cells connect horizontally or vertically, and a cell used by one failed path must remain available to a different path.",
    hint:
      "Mark a choice only for the current path, explore its legal neighbors, then restore that choice before trying a sibling.",
    authoredCue:
      "The search enumerates path-local choices, and visited state must be undone because failed paths do not globally consume cells.",
    authoredInvariant:
      "At helper entry, the marked cells are exactly the current word-prefix path and the next index names the character still needed.",
    confusableLessonId: "pattern:graphs",
    whyConfusableLoses:
      "A graph traversal's permanent visited set would suppress cells needed by later candidate paths after the current path backtracks.",
    expectedComplexity:
      "O(rows * columns * 4^L) worst-case time for word length L, with O(L) path stack space.",
    solveItemId: "python:79",
  },
  {
    id: "decision:merge-bookings",
    revision: 1,
    clusterId: "intervals-greedy-dynamic-programming",
    lessonId: "pattern:intervals",
    candidateLessonIds: OPTIMIZATION_CANDIDATES,
    prompt:
      "Combine all overlapping closed booking ranges and return a sorted list of disjoint ranges covering the same times.",
    constraint:
      "Input ranges may arrive unsorted, and touching endpoints count as overlap under the closed-range contract.",
    hint:
      "Sort by one boundary so that only the current merged frontier can still overlap the next range.",
    authoredCue:
      "Sorting interval starts turns global overlap into a local comparison against one active merged frontier.",
    authoredInvariant:
      "All emitted ranges are finalized, sorted, and disjoint; only the last frontier range may still extend when the next interval arrives.",
    confusableLessonId: "pattern:greedy",
    whyConfusableLoses:
      "The sweep has a greedy flavor, but the decisive representation and correctness contract are ordered interval boundaries and one merge frontier.",
    expectedComplexity:
      "O(n log n) time for sorting followed by O(n) sweeping, with O(n) output space.",
    solveItemId: "python:56",
  },
  {
    id: "decision:insert-booking",
    revision: 1,
    clusterId: "intervals-greedy-dynamic-programming",
    lessonId: "pattern:intervals",
    candidateLessonIds: OPTIMIZATION_CANDIDATES,
    prompt:
      "Insert one new closed booking range into an already sorted, non-overlapping schedule and merge every range it overlaps.",
    constraint:
      "The original schedule is sorted and disjoint, so resorting the entire result is unnecessary.",
    hint:
      "Partition the scan into ranges strictly before, overlapping the active insertion, and strictly after it.",
    authoredCue:
      "Existing interval order lets one linear sweep identify a before region, one merged frontier, and an after region.",
    authoredInvariant:
      "Output before the active insertion is finalized and disjoint; the insertion frontier covers exactly all overlaps consumed so far.",
    confusableLessonId: "pattern:dynamic-programming",
    whyConfusableLoses:
      "No overlapping subproblem or competing prefix state exists; each ordered range is classified once against the insertion frontier.",
    expectedComplexity:
      "O(n) time for one ordered sweep and O(n) space for the returned schedule.",
    solveItemId: "python:57",
  },
  {
    id: "decision:reachable-jump-frontier",
    revision: 1,
    clusterId: "intervals-greedy-dynamic-programming",
    lessonId: "pattern:greedy",
    candidateLessonIds: OPTIMIZATION_CANDIDATES,
    prompt:
      "Each array position gives a maximum forward jump length. Decide whether some sequence of jumps can reach the final position.",
    constraint:
      "Only feasibility matters, and every position at or before the farthest reachable frontier is already reachable by some path.",
    hint:
      "Ask whether one farthest-reachable boundary dominates every concrete path processed so far.",
    authoredCue:
      "A single farthest reachable frontier summarizes all earlier paths, and extending it is a locally safe dominance update.",
    authoredInvariant:
      "Before processing index i, every index at most the frontier is reachable and no processed jump reaches beyond that frontier.",
    confusableLessonId: "pattern:dynamic-programming",
    whyConfusableLoses:
      "A boolean state per index is possible but redundant because the single farthest frontier dominates every reachable-prefix state.",
    expectedComplexity:
      "O(n) time for one frontier scan and O(1) auxiliary space.",
    solveItemId: "python:55",
  },
  {
    id: "decision:energy-corridor-frontier",
    revision: 1,
    clusterId: "intervals-greedy-dynamic-programming",
    lessonId: "pattern:greedy",
    candidateLessonIds: OPTIMIZATION_CANDIDATES,
    prompt:
      "Check whether a robot can cross a corridor when each reachable station advertises the farthest number of stations it can advance.",
    constraint:
      "If the scan reaches a station beyond the best frontier, no alternate earlier route can cross that gap.",
    hint:
      "Keep the strongest boundary achieved by any reachable station rather than remembering each route separately.",
    authoredCue:
      "All routes within the reachable prefix are dominated by their maximum extension, so one frontier is sufficient.",
    authoredInvariant:
      "The frontier is the farthest station reachable using only processed reachable stations; scanning never advances beyond it without proof.",
    confusableLessonId: "pattern:intervals",
    whyConfusableLoses:
      "Although the reachable prefix resembles a range, there is no collection of intervals to sort, merge, or emit.",
    expectedComplexity:
      "O(n) time in the worst case and O(1) auxiliary space for the dominating frontier.",
    solveItemId: "python:55",
  },
  {
    id: "decision:stair-route-count",
    revision: 1,
    clusterId: "intervals-greedy-dynamic-programming",
    lessonId: "pattern:dynamic-programming",
    candidateLessonIds: OPTIMIZATION_CANDIDATES,
    prompt:
      "Count how many distinct step sequences reach the top of an n-step staircase when each move climbs one or two steps.",
    constraint:
      "Only the count is needed; different choice orders are distinct routes, and many prefixes lead to the same remaining height.",
    hint:
      "Define the number of routes to one height in terms of the two smaller heights that can enter it.",
    authoredCue:
      "The count has overlapping subproblems, and the last move partitions every route into two smaller already-defined states.",
    authoredInvariant:
      "Before computing height i, the stored prior states equal the exact route counts for heights i-2 and i-1.",
    confusableLessonId: "pattern:greedy",
    whyConfusableLoses:
      "Choosing one locally preferable step discards other routes, while the requested answer must count every valid sequence.",
    expectedComplexity:
      "O(n) time and O(1) auxiliary space after compressing the two-state recurrence.",
    solveItemId: "python:70",
  },
  {
    id: "decision:nonadjacent-vaults",
    revision: 1,
    clusterId: "intervals-greedy-dynamic-programming",
    lessonId: "pattern:dynamic-programming",
    candidateLessonIds: OPTIMIZATION_CANDIDATES,
    prompt:
      "Maximize collected value from a row of vaults when opening one vault prevents opening either adjacent vault.",
    constraint:
      "A locally largest vault can block a better combination, and only the maximum value rather than the chosen indices is required.",
    hint:
      "For each prefix, compare skipping its final vault with taking it plus the best compatible earlier prefix.",
    authoredCue:
      "Take-or-skip choices create overlapping optimal-prefix subproblems, and neither choice safely dominates in every input.",
    authoredInvariant:
      "The rolling states hold the optimum for the two preceding prefixes before the current prefix is computed from skip versus take.",
    confusableLessonId: "pattern:greedy",
    whyConfusableLoses:
      "Selecting the largest visible value has no exchange proof because it can eliminate two neighbors whose combined value is larger.",
    expectedComplexity:
      "O(n) time and O(1) auxiliary space using the two previous prefix optima.",
    solveItemId: "python:198",
  },
];

export const PATTERN_DECISION_PROBES: readonly PatternDecisionProbe[] =
  PATTERN_DECISION_PROBE_BANK.map((probe) => ({
    ...probe,
    authoredComplexity: probe.expectedComplexity,
  }));
