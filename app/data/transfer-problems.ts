import type { PythonProblem } from "./python-problems";

export type TransferSourceItemId = `python:${number}`;

export type TransferChallengeMetadata = {
  id: number;
  title: string;
  statement: string;
  entrypoint: string;
  parameters: ReadonlyArray<{
    name: string;
    type: string;
    description: string;
  }>;
  returns: string;
  notes?: readonly string[];
  constraints: readonly [string, string, string, ...string[]];
  exampleExplanation?: string;
};

export type TransferMetadata = {
  /** Stable content-family key; safe to persist in learning history. */
  family: string;
  /** Stable variant key; distinct from the numeric practice-item ID. */
  id: string;
  sourceItemIds: readonly TransferSourceItemId[];
  postAttemptPatternLabel: PythonProblem["pattern"];
  contrastExplanation: string;
  teachBackQuestion: string;
};

export type TransferProblem = PythonProblem & {
  challenge: TransferChallengeMetadata;
  transfer: TransferMetadata;
};

/**
 * Original cold-transfer variants. Each summary and inline challenge avoid
 * naming an algorithm family. Cues, invariants, tags, reference code, and
 * transfer comparisons are debrief material and must remain locked until the
 * attempt ends.
 */
export const TRANSFER_PROBLEMS: readonly TransferProblem[] = [
  {
    id: 20001,
    title: "Longest Target-Sum Segment",
    slug: "longest-target-sum-segment",
    difficulty: "Medium",
    pattern: "Arrays & Hashing",
    summary:
      "Return the inclusive bounds of the longest contiguous segment whose values total a requested target.",
    cue: "Ask what earlier running total would make the current total differ by exactly target.",
    invariant:
      "firstIndex stores the earliest index at which each running total occurred, so every candidate ending now is as long as possible for that total.",
    complexity: "O(n) expected time · O(n) space",
    languageNote:
      "dict.setdefault preserves the earliest index for a running total without a separate membership branch.",
    estimatedMinutes: 14,
    starterCode: `def longest_target_segment(nums: list[int], target: int) -> list[int]:
    raise NotImplementedError("Implement longest_target_segment")`,
    code: `def longest_target_segment(nums: list[int], target: int) -> list[int]:
    first_index = {0: -1}
    running_total = 0
    best_start = -1
    best_end = -1
    best_length = 0

    for end, value in enumerate(nums):
        running_total += value
        needed = running_total - target
        if needed in first_index:
            start = first_index[needed] + 1
            length = end - first_index[needed]
            if length > best_length or (
                length == best_length and (best_start == -1 or start < best_start)
            ):
                best_start = start
                best_end = end
                best_length = length
        first_index.setdefault(running_total, end)

    return [best_start, best_end]`,
    tags: ["prefix-sum", "dictionary", "contiguous-range", "tie-breaking"],
    recallChecks: [
      "Why must the dictionary retain the earliest index for each running total?",
      "What earlier total is needed when the current running total is known?",
      "How does the initial total of zero at index -1 handle a segment beginning at index zero?",
    ],
    verification: {
      revision: 1,
      entrypoint: { kind: "function", name: "longest_target_segment" },
      cases: [
        {
          id: "20001:longest-overlapping-choice",
          visibility: "sample",
          name: "chooses the longest among overlapping choices",
          args: [[2, -1, 2, 1, -2, 3], 3],
          expected: [1, 5],
          comparator: "deepEqual",
        },
        {
          id: "20001:earliest-equal-length",
          visibility: "sample",
          name: "breaks an equal-length tie by earliest start",
          args: [[1, 2, 1, 2], 3],
          expected: [0, 1],
          comparator: "deepEqual",
        },
        {
          id: "20001:empty-input",
          visibility: "hidden",
          name: "returns missing bounds for an empty input",
          args: [[], 0],
          expected: [-1, -1],
          comparator: "deepEqual",
        },
        {
          id: "20001:repeated-running-total",
          visibility: "hidden",
          name: "keeps the earliest repeated running total",
          args: [[0, 0, 0], 0],
          expected: [0, 2],
          comparator: "deepEqual",
        },
        {
          id: "20001:negative-values",
          visibility: "hidden",
          name: "handles negative values and tied candidates",
          args: [[5, -2, -3, 5], 0],
          expected: [0, 2],
          comparator: "deepEqual",
        },
      ],
    },
    challenge: {
      id: 20001,
      title: "Longest Target-Sum Segment",
      statement:
        "Given an integer list nums and an integer target, find a longest nonempty contiguous segment whose values sum to target. Return its inclusive zero-based bounds [start, end]. If several longest segments exist, return the one with the smallest start index. If no segment qualifies, return [-1, -1].",
      entrypoint: "longest_target_segment(nums, target)",
      parameters: [
        { name: "nums", type: "list[int]", description: "Values in their original order." },
        { name: "target", type: "int", description: "Required segment total." },
      ],
      returns: "list[int] — inclusive [start, end] bounds, or [-1, -1].",
      notes: ["The selected segment must be contiguous and nonempty."],
      constraints: [
        "0 <= len(nums) <= 200,000.",
        "Values and target may be negative, zero, or positive.",
        "Return the longest qualifying segment, then break ties by smaller start index.",
        "Do not mutate nums.",
      ],
      exampleExplanation:
        "For [2, -1, 2, 1, -2, 3] and target 3, indices 1 through 5 sum to 3 and form the longest qualifying segment.",
    },
    transfer: {
      family: "prefix-balance-lookup",
      id: "transfer-20001",
      sourceItemIds: ["python:1", "python:238"],
      postAttemptPatternLabel: "Arrays & Hashing",
      contrastExplanation:
        "Unlike Two Sum, the lookup key represents a prior running total rather than one prior value; retaining its earliest index optimizes segment length instead of merely proving a pair exists.",
      teachBackQuestion:
        "Why does storing only the earliest index for each running total preserve every candidate needed for the longest answer?",
    },
  },
  {
    id: 20002,
    title: "Best Pair Within Budget",
    slug: "best-pair-within-budget",
    difficulty: "Medium",
    pattern: "Two Pointers",
    summary:
      "Choose two values from a sorted price list whose total is as large as possible without exceeding a budget.",
    cue: "Use the sorted order to decide which endpoint can be discarded after comparing one pair.",
    invariant:
      "Before each comparison, every discarded endpoint has already been paired with the only remaining endpoint that could improve on its rejected or accepted total.",
    complexity: "O(n) time · O(1) auxiliary space",
    languageNote:
      "A two-element Python list is a clear return value; update it only on a strictly better total to preserve the smaller first value on ties.",
    estimatedMinutes: 10,
    starterCode: `def best_pair_under_budget(costs: list[int], budget: int) -> list[int]:
    raise NotImplementedError("Implement best_pair_under_budget")`,
    code: `def best_pair_under_budget(costs: list[int], budget: int) -> list[int]:
    left = 0
    right = len(costs) - 1
    best: list[int] = []
    best_total: int | None = None

    while left < right:
        total = costs[left] + costs[right]
        if total <= budget:
            if best_total is None or total > best_total:
                best = [costs[left], costs[right]]
                best_total = total
            left += 1
        else:
            right -= 1

    return best`,
    tags: ["sorted-array", "pair-selection", "two-indices", "optimization"],
    recallChecks: [
      "Why can the right value be discarded when the current sum is over budget?",
      "Why can the left value be discarded after evaluating a feasible pair?",
      "How does updating only on a larger total enforce the required tie break?",
    ],
    verification: {
      revision: 1,
      entrypoint: { kind: "function", name: "best_pair_under_budget" },
      cases: [
        {
          id: "20002:tie-by-first-value",
          visibility: "sample",
          name: "breaks a best-total tie by smaller first value",
          args: [[1, 3, 4, 7, 9], 10],
          expected: [1, 9],
          comparator: "deepEqual",
        },
        {
          id: "20002:skips-over-budget-values",
          visibility: "sample",
          name: "skips values that force the total over budget",
          args: [[2, 5, 8, 11], 10],
          expected: [2, 8],
          comparator: "deepEqual",
        },
        {
          id: "20002:no-feasible-pair",
          visibility: "hidden",
          name: "returns empty when no pair is affordable",
          args: [[6, 7], 5],
          expected: [],
          comparator: "deepEqual",
        },
        {
          id: "20002:duplicate-values",
          visibility: "hidden",
          name: "handles duplicate values at both ends",
          args: [[1, 1, 4, 4], 5],
          expected: [1, 4],
          comparator: "deepEqual",
        },
        {
          id: "20002:negative-values",
          visibility: "hidden",
          name: "uses the same ordering logic with negative values",
          args: [[-5, -2, 3, 9], 4],
          expected: [-5, 9],
          comparator: "deepEqual",
        },
      ],
    },
    challenge: {
      id: 20002,
      title: "Best Pair Within Budget",
      statement:
        "Given costs sorted in nondecreasing order and an integer budget, choose values from two distinct positions whose sum is at most budget and as large as possible. Return the chosen values in nondecreasing order. When different value pairs have the same best sum, return the lexicographically smaller pair. Return [] when no pair is feasible.",
      entrypoint: "best_pair_under_budget(costs, budget)",
      parameters: [
        { name: "costs", type: "list[int]", description: "Prices sorted in nondecreasing order." },
        { name: "budget", type: "int", description: "Maximum allowed pair total." },
      ],
      returns: "list[int] — the selected value pair, or [] when none qualifies.",
      constraints: [
        "0 <= len(costs) <= 200,000.",
        "costs is sorted in nondecreasing order and may contain duplicates.",
        "A valid pair uses two distinct positions.",
        "Values and budget may be negative, zero, or positive.",
      ],
      exampleExplanation:
        "With [1, 3, 4, 7, 9] and budget 10, both [1, 9] and [3, 7] total 10; [1, 9] is lexicographically smaller.",
    },
    transfer: {
      family: "ordered-endpoint-elimination",
      id: "transfer-20002",
      sourceItemIds: ["python:125", "python:15"],
      postAttemptPatternLabel: "Two Pointers",
      contrastExplanation:
        "The source exercises use endpoints for equality checks or fixed-sum enumeration; this variant keeps the same elimination logic but optimizes the best feasible total and adds a deterministic tie break.",
      teachBackQuestion:
        "After a feasible endpoint pair is examined, why can no later pairing with that left value produce a better answer?",
    },
  },
  {
    id: 20003,
    title: "Longest Limited-Variety Run",
    slug: "longest-limited-variety-run",
    difficulty: "Medium",
    pattern: "Sliding Window",
    summary:
      "Find the earliest longest contiguous run containing no more than a given number of distinct event labels.",
    cue: "Expand one boundary for new events and move the other only when the current run violates the limit.",
    invariant:
      "After shrinking, counts describes exactly the current valid run and contains at most limit distinct labels.",
    complexity: "O(n) expected time · O(k) space",
    languageNote:
      "Delete a dictionary key when its count reaches zero so len(counts) remains the distinct-label count.",
    estimatedMinutes: 12,
    starterCode: `def longest_limited_run(events: list[str], limit: int) -> list[int]:
    raise NotImplementedError("Implement longest_limited_run")`,
    code: `def longest_limited_run(events: list[str], limit: int) -> list[int]:
    if limit <= 0 or not events:
        return [-1, -1]

    counts: dict[str, int] = {}
    left = 0
    best_start = 0
    best_end = 0

    for right, event in enumerate(events):
        counts[event] = counts.get(event, 0) + 1
        while len(counts) > limit:
            outgoing = events[left]
            counts[outgoing] -= 1
            if counts[outgoing] == 0:
                del counts[outgoing]
            left += 1

        if right - left > best_end - best_start:
            best_start = left
            best_end = right

    return [best_start, best_end]`,
    tags: ["contiguous-range", "frequency-map", "distinct-values", "tie-breaking"],
    recallChecks: [
      "What exact condition makes the current run invalid?",
      "Why does each event leave the run at most once?",
      "Why is a strict length improvement enough to preserve the earliest tied run?",
    ],
    verification: {
      revision: 1,
      entrypoint: { kind: "function", name: "longest_limited_run" },
      cases: [
        {
          id: "20003:separated-best-runs",
          visibility: "sample",
          name: "keeps the earliest of separated best runs",
          args: [["a", "b", "a", "c", "b", "b"], 2],
          expected: [0, 2],
          comparator: "deepEqual",
        },
        {
          id: "20003:single-label-limit",
          visibility: "sample",
          name: "finds a repeated run with a single-label limit",
          args: [["x", "x", "y", "z"], 1],
          expected: [0, 1],
          comparator: "deepEqual",
        },
        {
          id: "20003:empty-input",
          visibility: "hidden",
          name: "returns missing bounds for no events",
          args: [[], 2],
          expected: [-1, -1],
          comparator: "deepEqual",
        },
        {
          id: "20003:limit-exceeds-variety",
          visibility: "hidden",
          name: "keeps the whole run when the limit exceeds its variety",
          args: [["a", "b", "c"], 5],
          expected: [0, 2],
          comparator: "deepEqual",
        },
        {
          id: "20003:late-equal-length-run",
          visibility: "hidden",
          name: "does not replace an earlier equal-length run",
          args: [["a", "b", "a", "b", "c", "b", "b"], 2],
          expected: [0, 3],
          comparator: "deepEqual",
        },
      ],
    },
    challenge: {
      id: 20003,
      title: "Longest Limited-Variety Run",
      statement:
        "Given event labels in chronological order and a positive integer limit, return the inclusive bounds of a longest contiguous run containing at most limit distinct labels. Break length ties by the smaller start index. Return [-1, -1] when events is empty or limit is not positive.",
      entrypoint: "longest_limited_run(events, limit)",
      parameters: [
        { name: "events", type: "list[str]", description: "Event labels in chronological order." },
        { name: "limit", type: "int", description: "Maximum distinct labels in the chosen run." },
      ],
      returns: "list[int] — inclusive [start, end] bounds, or [-1, -1].",
      constraints: [
        "0 <= len(events) <= 200,000.",
        "Every event label is a nonempty string.",
        "limit is an integer and may be nonpositive.",
        "The chosen run must be contiguous and is nonempty when returned.",
      ],
      exampleExplanation:
        "For [a, b, a, c, b, b] with limit 2, [a, b, a] and [c, b, b] are both longest; return bounds [0, 2].",
    },
    transfer: {
      family: "bounded-variety-range",
      id: "transfer-20003",
      sourceItemIds: ["python:3", "python:76"],
      postAttemptPatternLabel: "Sliding Window",
      contrastExplanation:
        "This variant tracks a bound on distinct keys rather than banning repeats or satisfying a required multiset; the range becomes valid again only after excess keys are fully removed.",
      teachBackQuestion:
        "Why can the left boundary move only forward without missing a longer valid run?",
    },
  },
  {
    id: 20004,
    title: "Cascading Run Collapse",
    slug: "cascading-run-collapse",
    difficulty: "Medium",
    pattern: "Stack",
    summary:
      "Repeatedly remove adjacent runs of a fixed size until no further removal is possible.",
    cue: "Keep the current surviving runs compressed so a removal can expose and merge neighboring runs.",
    invariant:
      "The stored run pairs encode exactly the fully processed prefix after every completed removal caused by that prefix.",
    complexity: "O(n) time · O(n) space",
    languageNote:
      "A list of (character, count) tuples works as a stack; replace the final tuple when its count changes.",
    estimatedMinutes: 12,
    starterCode: `def collapse_runs(text: str, size: int) -> str:
    raise NotImplementedError("Implement collapse_runs")`,
    code: `def collapse_runs(text: str, size: int) -> str:
    runs: list[tuple[str, int]] = []

    for character in text:
        if runs and runs[-1][0] == character:
            count = runs[-1][1] + 1
            runs[-1] = (character, count)
        else:
            runs.append((character, 1))

        if runs[-1][1] == size:
            runs.pop()

    return "".join(character * count for character, count in runs)`,
    tags: ["stack", "run-length", "cascading-removal", "string"],
    recallChecks: [
      "Why does storing only the surviving processed prefix support cascades?",
      "At what count should a run be removed?",
      "Why is every input character pushed and removed at most once?",
    ],
    verification: {
      revision: 1,
      entrypoint: { kind: "function", name: "collapse_runs" },
      cases: [
        {
          id: "20004:several-independent-runs",
          visibility: "sample",
          name: "removes several qualifying runs",
          args: ["qrrrssstttqu", 3],
          expected: "qqu",
          comparator: "deepEqual",
        },
        {
          id: "20004:cascade-across-removals",
          visibility: "sample",
          name: "cascades across newly adjacent runs",
          args: ["kllmmllk", 2],
          expected: "",
          comparator: "deepEqual",
        },
        {
          id: "20004:empty-text",
          visibility: "hidden",
          name: "handles empty text",
          args: ["", 4],
          expected: "",
          comparator: "deepEqual",
        },
        {
          id: "20004:no-removal",
          visibility: "hidden",
          name: "preserves text without a qualifying run",
          args: ["abcd", 2],
          expected: "abcd",
          comparator: "deepEqual",
        },
        {
          id: "20004:remainder-after-removal",
          visibility: "hidden",
          name: "keeps a remainder smaller than the removal size",
          args: ["xxxxx", 3],
          expected: "xx",
          comparator: "deepEqual",
        },
      ],
    },
    challenge: {
      id: 20004,
      title: "Cascading Run Collapse",
      statement:
        "Given a string text and an integer size, repeatedly remove any size adjacent equal characters. A removal may make characters on its two sides adjacent and trigger later removals. Return the unique final string after all possible removals.",
      entrypoint: "collapse_runs(text, size)",
      parameters: [
        { name: "text", type: "str", description: "Characters to process in order." },
        { name: "size", type: "int", description: "Number of equal adjacent characters removed together." },
      ],
      returns: "str — the text remaining after all cascading removals.",
      constraints: [
        "0 <= len(text) <= 200,000.",
        "2 <= size <= 100,000.",
        "text may contain any case-sensitive characters.",
        "A run longer than size may leave a remainder after one or more removals.",
      ],
      exampleExplanation:
        "For kllmmllk with size 2, removing ll, then mm, then the newly adjacent ll, and finally kk leaves the empty string.",
    },
    transfer: {
      family: "compressed-unresolved-history",
      id: "transfer-20004",
      sourceItemIds: ["python:20", "python:739"],
      postAttemptPatternLabel: "Stack",
      contrastExplanation:
        "Instead of storing unmatched brackets or unresolved indices, each entry compresses a surviving character run; popping a completed run exposes exactly the prior state needed for cascading behavior.",
      teachBackQuestion:
        "What does one stack entry represent, and why is the state below it exactly what a cascade needs?",
    },
  },
  {
    id: 20005,
    title: "Minimum Ordered Batch Capacity",
    slug: "minimum-ordered-batch-capacity",
    difficulty: "Medium",
    pattern: "Binary Search",
    summary:
      "Find the smallest capacity that partitions ordered positive weights into at most a fixed number of contiguous batches.",
    cue: "For a proposed capacity, greedily count how many batches the preserved order forces.",
    invariant:
      "All capacities below left are infeasible and all capacities above right are feasible; each check preserves this boundary.",
    complexity: "O(n log S) time · O(1) space, where S is sum(weights)",
    languageNote:
      "Use integer // for the midpoint and a small nested helper to keep the monotone feasibility test readable.",
    estimatedMinutes: 15,
    starterCode: `def minimum_batch_capacity(weights: list[int], days: int) -> int:
    raise NotImplementedError("Implement minimum_batch_capacity")`,
    code: `def minimum_batch_capacity(weights: list[int], days: int) -> int:
    def feasible(capacity: int) -> bool:
        used_days = 1
        current = 0
        for weight in weights:
            if current + weight > capacity:
                used_days += 1
                current = 0
            current += weight
        return used_days <= days

    left = max(weights)
    right = sum(weights)
    while left < right:
        middle = left + (right - left) // 2
        if feasible(middle):
            right = middle
        else:
            left = middle + 1
    return left`,
    tags: ["monotone-feasibility", "answer-space", "greedy-check", "partition"],
    recallChecks: [
      "Why is max(weights) the smallest possible search bound?",
      "What makes feasibility monotone as capacity increases?",
      "Why should a feasible midpoint remain in the search interval?",
    ],
    verification: {
      revision: 1,
      entrypoint: { kind: "function", name: "minimum_batch_capacity" },
      cases: [
        {
          id: "20005:three-batches",
          visibility: "sample",
          name: "finds a tight capacity across three batches",
          args: [[4, 2, 7, 3, 5], 3],
          expected: 8,
          comparator: "deepEqual",
        },
        {
          id: "20005:one-item-each-day",
          visibility: "sample",
          name: "uses the heaviest item when every item may stand alone",
          args: [[9, 1, 1], 3],
          expected: 9,
          comparator: "deepEqual",
        },
        {
          id: "20005:single-batch",
          visibility: "hidden",
          name: "requires the total capacity for one batch",
          args: [[2, 2, 2, 2], 1],
          expected: 8,
          comparator: "deepEqual",
        },
        {
          id: "20005:maximum-days",
          visibility: "hidden",
          name: "returns the maximum item for the maximum day count",
          args: [[5, 1, 4, 2], 4],
          expected: 5,
          comparator: "deepEqual",
        },
        {
          id: "20005:order-forces-boundary",
          visibility: "hidden",
          name: "respects the original order when forming batches",
          args: [[6, 2, 3, 7, 1, 4], 2],
          expected: 12,
          comparator: "deepEqual",
        },
      ],
    },
    challenge: {
      id: 20005,
      title: "Minimum Ordered Batch Capacity",
      statement:
        "Positive item weights must be processed in their given order over at most days batches. Each item belongs to exactly one batch, every batch contains a contiguous slice of the list, and a batch's total weight cannot exceed one shared capacity. Return the smallest integer capacity that makes such a schedule possible.",
      entrypoint: "minimum_batch_capacity(weights, days)",
      parameters: [
        { name: "weights", type: "list[int]", description: "Positive item weights in required processing order." },
        { name: "days", type: "int", description: "Maximum number of contiguous batches." },
      ],
      returns: "int — the minimum feasible per-batch capacity.",
      constraints: [
        "1 <= len(weights) <= 100,000.",
        "Every weight is a positive integer.",
        "1 <= days <= len(weights).",
        "Items cannot be reordered or split between batches.",
      ],
      exampleExplanation:
        "For [4, 2, 7, 3, 5] over 3 days, capacity 8 permits [4, 2], [7], [3, 5], while capacity 7 needs four batches.",
    },
    transfer: {
      family: "minimum-feasible-threshold",
      id: "transfer-20005",
      sourceItemIds: ["python:704", "python:875"],
      postAttemptPatternLabel: "Binary Search",
      contrastExplanation:
        "Like a minimum-rate problem, the answer is not an input index: a greedy simulation supplies a monotone yes/no boundary over candidate capacities.",
      teachBackQuestion:
        "If one capacity is feasible, why must every larger capacity also be feasible even though the greedy batch boundaries may change?",
    },
  },
  {
    id: 20006,
    title: "Peak-Sum Tree Level",
    slug: "peak-sum-tree-level",
    difficulty: "Medium",
    pattern: "Trees",
    summary:
      "Return the shallowest zero-based tree depth whose node values have the largest level total.",
    cue: "Process nodes one depth at a time so each total is complete before it is compared.",
    invariant:
      "At the start of each outer iteration, the queue contains exactly all nodes at the current depth in left-to-right order.",
    complexity: "O(n) time · O(w) space",
    languageNote:
      "Capture len(queue) before the inner loop; deque.popleft then consumes exactly one complete level in O(1) per node.",
    estimatedMinutes: 10,
    starterCode: `from collections import deque


class Solution:
    def peakLevel(self, root: "TreeNode | None") -> int:
        raise NotImplementedError("Implement peakLevel")`,
    code: `from collections import deque


class Solution:
    def peakLevel(self, root: "TreeNode | None") -> int:
        if root is None:
            return -1

        queue = deque([root])
        depth = 0
        best_depth = 0
        best_sum: int | None = None

        while queue:
            level_sum = 0
            for _ in range(len(queue)):
                node = queue.popleft()
                level_sum += node.val
                if node.left is not None:
                    queue.append(node.left)
                if node.right is not None:
                    queue.append(node.right)

            if best_sum is None or level_sum > best_sum:
                best_sum = level_sum
                best_depth = depth
            depth += 1

        return best_depth`,
    tags: ["binary-tree", "bfs", "level-order", "deque", "aggregation"],
    recallChecks: [
      "Why must the level size be captured before children are enqueued?",
      "Why should a tied sum not replace the stored best depth?",
      "What does w represent in the auxiliary-space bound?",
    ],
    verification: {
      revision: 1,
      entrypoint: { kind: "method", className: "Solution", name: "peakLevel" },
      cases: [
        {
          id: "20006:deepest-level-wins",
          visibility: "sample",
          name: "finds a larger total on the deepest level",
          args: [[5, 2, 3, 4, 1, -1, 2]],
          argCodecs: ["binaryTree"],
          expected: 2,
          comparator: "deepEqual",
        },
        {
          id: "20006:root-level-wins",
          visibility: "sample",
          name: "keeps the root when descendants total less",
          args: [[10, -2, -3]],
          argCodecs: ["binaryTree"],
          expected: 0,
          comparator: "deepEqual",
        },
        {
          id: "20006:empty-tree",
          visibility: "hidden",
          name: "returns negative one for an empty tree",
          args: [[]],
          argCodecs: ["binaryTree"],
          expected: -1,
          comparator: "deepEqual",
        },
        {
          id: "20006:skewed-tree",
          visibility: "hidden",
          name: "counts depth through a skewed tree",
          args: [[1, 2, null, 3, null, 4]],
          argCodecs: ["binaryTree"],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          id: "20006:shallow-tie",
          visibility: "hidden",
          name: "breaks a level-sum tie toward the root",
          args: [[-5, -2, -3]],
          argCodecs: ["binaryTree"],
          expected: 0,
          comparator: "deepEqual",
        },
      ],
    },
    challenge: {
      id: 20006,
      title: "Peak-Sum Tree Level",
      statement:
        "For each depth of a binary tree, add the values of all nodes at that depth. Return the zero-based depth with the largest total. If several depths tie, return the shallowest one. Return -1 for an empty tree.",
      entrypoint: "Solution.peakLevel(root)",
      parameters: [
        { name: "root", type: "TreeNode | None", description: "Root of a finite binary tree." },
      ],
      returns: "int — the shallowest depth with the largest level sum, or -1.",
      notes: ["TreeNode provides val, left, and right fields."],
      constraints: [
        "The tree contains from 0 through 100,000 nodes.",
        "Node values may be negative, zero, or positive.",
        "Depth zero contains only the root.",
        "The tree is acyclic.",
      ],
      exampleExplanation:
        "In [5, 2, 3, 4, 1, -1, 2], the level totals are 5, 5, and 6, so return depth 2.",
    },
    transfer: {
      family: "level-synchronous-tree-traversal",
      id: "transfer-20006",
      sourceItemIds: ["python:102", "python:104"],
      postAttemptPatternLabel: "Trees",
      contrastExplanation:
        "The traversal boundary from level-order grouping is reused, but values are reduced into one score per depth and negative totals make a zero-initialized maximum unsafe.",
      teachBackQuestion:
        "What queue condition proves that one computed sum contains every node at a depth and no node from the next depth?",
    },
  },
  {
    id: 20007,
    title: "Minimum Relay Hops",
    slug: "minimum-relay-hops",
    difficulty: "Medium",
    pattern: "Graphs",
    summary:
      "Return the fewest undirected links needed to connect two named relay stations.",
    cue: "Explore all stations one hop away before any station two hops away.",
    invariant:
      "Every queued station has its shortest distance assigned, and queued distances never decrease from front to back.",
    complexity: "O(V + E) expected time · O(V + E) space",
    languageNote:
      "defaultdict(list) builds the adjacency list cleanly, while deque supports constant-time removal from the front.",
    estimatedMinutes: 12,
    starterCode: `from collections import defaultdict, deque


def minimum_relay_hops(
    links: list[list[str]], start: str, target: str
) -> int:
    raise NotImplementedError("Implement minimum_relay_hops")`,
    code: `from collections import defaultdict, deque


def minimum_relay_hops(
    links: list[list[str]], start: str, target: str
) -> int:
    if start == target:
        return 0

    graph: dict[str, list[str]] = defaultdict(list)
    for first, second in links:
        graph[first].append(second)
        graph[second].append(first)

    queue = deque([(start, 0)])
    seen = {start}
    while queue:
        station, distance = queue.popleft()
        for neighbor in graph[station]:
            if neighbor == target:
                return distance + 1
            if neighbor not in seen:
                seen.add(neighbor)
                queue.append((neighbor, distance + 1))

    return -1`,
    tags: ["graph", "bfs", "shortest-path", "deque", "adjacency-list"],
    recallChecks: [
      "Why is the first discovery of a station guaranteed to use the fewest links?",
      "Why mark a station seen when it is enqueued?",
      "How do duplicate links affect correctness and complexity?",
    ],
    verification: {
      revision: 1,
      entrypoint: { kind: "function", name: "minimum_relay_hops" },
      cases: [
        {
          id: "20007:two-equal-routes",
          visibility: "sample",
          name: "finds a shortest route among equal alternatives",
          args: [
            [["A", "B"], ["B", "C"], ["A", "D"], ["D", "C"], ["C", "E"]],
            "A",
            "E",
          ],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          id: "20007:direct-link",
          visibility: "sample",
          name: "returns one for a direct link",
          args: [[['north', 'south'], ['south', 'east']], 'north', 'south'],
          expected: 1,
          comparator: "deepEqual",
        },
        {
          id: "20007:same-station",
          visibility: "hidden",
          name: "returns zero when both endpoints are the same",
          args: [[], "solo", "solo"],
          expected: 0,
          comparator: "deepEqual",
        },
        {
          id: "20007:disconnected-components",
          visibility: "hidden",
          name: "returns negative one across disconnected components",
          args: [[["a", "b"], ["c", "d"]], "a", "d"],
          expected: -1,
          comparator: "deepEqual",
        },
        {
          id: "20007:cycle-and-duplicate",
          visibility: "hidden",
          name: "terminates through cycles and duplicate links",
          args: [
            [["a", "b"], ["b", "c"], ["c", "a"], ["b", "c"], ["c", "d"]],
            "a",
            "d",
          ],
          expected: 2,
          comparator: "deepEqual",
        },
      ],
    },
    challenge: {
      id: 20007,
      title: "Minimum Relay Hops",
      statement:
        "Each link joins two relay stations in both directions. Given all links plus start and target station names, return the minimum number of links required to travel from start to target. Return -1 when target is unreachable. Traveling from a station to itself uses zero links, even if that station does not appear in links.",
      entrypoint: "minimum_relay_hops(links, start, target)",
      parameters: [
        { name: "links", type: "list[list[str]]", description: "Undirected station pairs." },
        { name: "start", type: "str", description: "Starting station name." },
        { name: "target", type: "str", description: "Destination station name." },
      ],
      returns: "int — minimum link count, or -1 when unreachable.",
      constraints: [
        "0 <= len(links) <= 200,000.",
        "Each link contains exactly two nonempty station names.",
        "Links may repeat and the network may contain cycles or self-links.",
        "Every link has equal traversal cost in both directions.",
      ],
      exampleExplanation:
        "If A connects to B and D, both B and D connect onward to C, and C connects to E, reaching E from A requires 3 links.",
    },
    transfer: {
      family: "unweighted-reachability-distance",
      id: "transfer-20007",
      sourceItemIds: ["python:200", "python:207"],
      postAttemptPatternLabel: "Graphs",
      contrastExplanation:
        "The graph must be built from edge pairs, and unlike reachability counting or dependency ordering, discovery order directly proves a shortest unweighted distance.",
      teachBackQuestion:
        "Why is it safe to return as soon as the target is first discovered rather than after every route has been explored?",
    },
  },
  {
    id: 20008,
    title: "Merge Ranked Streams",
    slug: "merge-ranked-streams",
    difficulty: "Medium",
    pattern: "Heaps & Priority Queues",
    summary:
      "Return up to a requested number of values from several individually sorted streams in global sorted order.",
    cue: "Only the first unconsumed value from each stream can be the next global value.",
    invariant:
      "The priority queue contains exactly the smallest unconsumed value from every nonexhausted stream.",
    complexity: "O(k + r log k) time · O(k + r) space, where r is the output size",
    languageNote:
      "Heap tuples (value, stream_index, offset) provide deterministic ordering without copying entire stream suffixes.",
    estimatedMinutes: 13,
    starterCode: `import heapq


def merge_ranked_streams(streams: list[list[int]], limit: int) -> list[int]:
    raise NotImplementedError("Implement merge_ranked_streams")`,
    code: `import heapq


def merge_ranked_streams(streams: list[list[int]], limit: int) -> list[int]:
    heap = [
        (stream[0], stream_index, 0)
        for stream_index, stream in enumerate(streams)
        if stream
    ]
    heapq.heapify(heap)

    result: list[int] = []
    while heap and len(result) < limit:
        value, stream_index, offset = heapq.heappop(heap)
        result.append(value)
        next_offset = offset + 1
        if next_offset < len(streams[stream_index]):
            heapq.heappush(
                heap,
                (streams[stream_index][next_offset], stream_index, next_offset),
            )

    return result`,
    tags: ["heapq", "k-way-merge", "sorted-input", "stream"],
    recallChecks: [
      "Why is one candidate per nonempty stream sufficient?",
      "What role do the stream index and offset play in each heap tuple?",
      "How does the output limit change the runtime when the inputs are large?",
    ],
    verification: {
      revision: 1,
      entrypoint: { kind: "function", name: "merge_ranked_streams" },
      cases: [
        {
          id: "20008:interleaved-streams",
          visibility: "sample",
          name: "merges interleaved streams up to the limit",
          args: [[[1, 4, 9], [2, 2, 8], [3, 7]], 6],
          expected: [1, 2, 2, 3, 4, 7],
          comparator: "deepEqual",
        },
        {
          id: "20008:empty-inner-stream",
          visibility: "sample",
          name: "skips empty streams and stops at exhaustion",
          args: [[[], [5], [1, 6]], 5],
          expected: [1, 5, 6],
          comparator: "deepEqual",
        },
        {
          id: "20008:no-streams",
          visibility: "hidden",
          name: "handles no streams",
          args: [[], 4],
          expected: [],
          comparator: "deepEqual",
        },
        {
          id: "20008:zero-limit",
          visibility: "hidden",
          name: "returns no values for a zero limit",
          args: [[[1, 2], [3]], 0],
          expected: [],
          comparator: "deepEqual",
        },
        {
          id: "20008:negative-and-duplicate-values",
          visibility: "hidden",
          name: "retains duplicates and negative values",
          args: [[[-3, 10], [-2, -2, 8], [0]], 10],
          expected: [-3, -2, -2, 0, 8, 10],
          comparator: "deepEqual",
        },
      ],
    },
    challenge: {
      id: 20008,
      title: "Merge Ranked Streams",
      statement:
        "Each inner list in streams is sorted in nondecreasing order. Return the first limit values that would appear if all streams were merged into one nondecreasing sequence. Preserve duplicate occurrences. If fewer than limit values exist, return all of them; if limit is zero, return [].",
      entrypoint: "merge_ranked_streams(streams, limit)",
      parameters: [
        { name: "streams", type: "list[list[int]]", description: "Individually sorted integer streams." },
        { name: "limit", type: "int", description: "Maximum number of merged values to return." },
      ],
      returns: "list[int] — up to limit globally smallest values in nondecreasing order.",
      constraints: [
        "0 <= len(streams) <= 100,000.",
        "Every inner stream is sorted in nondecreasing order and may be empty.",
        "0 <= limit <= 1,000,000.",
        "Duplicate and negative values must be preserved.",
      ],
      exampleExplanation:
        "Merging [1, 4, 9], [2, 2, 8], and [3, 7] begins 1, 2, 2, 3, 4, 7, so those six values are returned for limit 6.",
    },
    transfer: {
      family: "frontier-priority-merge",
      id: "transfer-20008",
      sourceItemIds: ["python:215", "python:347"],
      postAttemptPatternLabel: "Heaps & Priority Queues",
      contrastExplanation:
        "Rather than retaining a fixed top-k subset from an unsorted collection, the priority queue represents a moving frontier across sorted sources and advances only the source whose candidate was consumed.",
      teachBackQuestion:
        "Why can a value behind another unconsumed value in the same stream never be the next global output?",
    },
  },
];
