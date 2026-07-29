import type { ItemId } from "../lib/items";
import type { Pattern } from "./problems";

export type PatternLessonStep =
  | "recognize"
  | "reason"
  | "trace"
  | "template"
  | "practice";

export type PatternLesson = {
  id: `pattern:${string}`;
  slug: string;
  revision: number;
  order: number;
  pattern: Pattern;
  title: string;
  summary: string;
  selection: {
    useWhen: string[];
    rejectWhen: string[];
    confusableWith: { pattern: string; distinction: string }[];
  };
  invariant: string;
  reasoning: string[];
  complexity: { operation: string; time: string; space: string }[];
  trace: {
    title: string;
    input: string;
    steps: string[];
    takeaway: string;
  };
  templates: { python: string; swift: string };
  pitfalls: string[];
  checks: { id: string; prompt: string; answer: string }[];
  practice: {
    workedItemId: ItemId;
    guidedItemId: ItemId;
    coldItemId: ItemId;
    swiftItemId: ItemId;
    transferItemId?: ItemId;
  };
};

export const PATTERN_LESSON_STEPS: readonly PatternLessonStep[] = [
  "recognize",
  "reason",
  "trace",
  "template",
  "practice",
];

export const PATTERN_LESSONS: readonly PatternLesson[] = [
  {
    id: "pattern:arrays-hashing",
    slug: "arrays-hashing",
    revision: 1,
    order: 1,
    pattern: "Arrays & Hashing",
    title: "Arrays & Hashing",
    summary: "Trade repeated scans for remembered facts: membership, counts, groups, and prefix state.",
    selection: {
      useWhen: [
        "You need fast membership, frequency, grouping, or complement lookup.",
        "The answer for the current position depends on information seen earlier.",
        "A prefix total or canonical key can turn a range or grouping question into lookup.",
      ],
      rejectWhen: [
        "The input is already sorted and two monotonic pointers are sufficient.",
        "The problem requires preserving only a small rolling window rather than all prior state.",
      ],
      confusableWith: [
        { pattern: "Two Pointers", distinction: "Hashing spends space to avoid sorted or monotonic movement." },
        { pattern: "Sliding Window", distinction: "A window maintains one contiguous region; a map can summarize noncontiguous history." },
      ],
    },
    invariant: "Before processing index i, the table exactly summarizes the portion of the input that the algorithm promises has already been processed.",
    reasoning: [
      "Name the fact you repeatedly wish you could answer in O(1).",
      "Choose the smallest key that represents equivalence: value, frequency signature, or prefix total.",
      "Decide whether to query before inserting; that order often prevents using the same element twice.",
    ],
    complexity: [
      { operation: "Single pass with lookup", time: "O(n) expected", space: "O(n)" },
      { operation: "Sorting alternative", time: "O(n log n)", space: "O(1) to O(n)" },
    ],
    trace: {
      title: "Complement lookup",
      input: "nums = [4, 7, 1, 9], target = 10",
      steps: [
        "At 4, need 6; 6 is absent, then remember 4.",
        "At 7, need 3; 3 is absent, then remember 7.",
        "At 1, need 9; 9 is absent, then remember 1.",
        "At 9, need 1; 1 is already remembered, so the pair is determined.",
      ],
      takeaway: "Query-before-insert keeps the table equal to earlier indices only.",
    },
    templates: {
      python: "def solve(values):\n    seen = {}\n    for index, value in enumerate(values):\n        key = ...\n        if key in seen:\n            return ...\n        seen[value] = index\n    return ...",
      swift: "func solve(_ values: [Int]) -> Result {\n    var seen: [Int: Int] = [:]\n    for (index, value) in values.enumerated() {\n        let key = /* derive lookup key */\n        if let prior = seen[key] {\n            return /* build result */\n        }\n        seen[value] = index\n    }\n    return /* empty result */\n}",
    },
    pitfalls: ["Mutating a dictionary while iterating over that dictionary.", "Using a mutable object as a conceptual key.", "Checking after insertion when the same index must not be reused."],
    checks: [
      { id: "table-meaning", prompt: "What sentence should you be able to say about the table before each iteration?", answer: "It exactly summarizes the already-processed prefix and contains no future or current element unless the contract explicitly allows it." },
      { id: "query-order", prompt: "Why does query-before-insert matter in complement problems?", answer: "It prevents the current element from matching itself and makes every match point to an earlier index." },
      { id: "canonical-key", prompt: "When grouping values, what makes a good dictionary key?", answer: "A stable, hashable representation that is identical exactly when two values belong to the same group." },
    ],
    practice: { workedItemId: "python:1", guidedItemId: "python:49", coldItemId: "python:238", swiftItemId: "builtin:1", transferItemId: "transfer:20001" },
  },
  {
    id: "pattern:two-pointers",
    slug: "two-pointers",
    revision: 1,
    order: 2,
    pattern: "Two Pointers",
    title: "Two Pointers",
    summary: "Move two boundaries through ordered structure while proving that every discarded region is impossible.",
    selection: {
      useWhen: ["The data is sorted or can be scanned from both ends.", "A pair, palindrome, partition, or in-place compaction has monotonic movement.", "Moving one boundary gives a predictable increase or decrease in the objective."],
      rejectWhen: ["The next move cannot be chosen from local order information.", "You need arbitrary membership from the full history and cannot sort."],
      confusableWith: [
        { pattern: "Sliding Window", distinction: "Two pointers may move independently and need not describe a valid contiguous window." },
        { pattern: "Binary Search", distinction: "Two pointers enumerate a frontier; binary search discards half of a monotonic answer space." },
      ],
    },
    invariant: "Everything strictly outside the pointers has been conclusively handled, and no discarded position can participate in a better valid answer.",
    reasoning: ["State what left and right mean, not just where they are.", "Tie each pointer move to an impossibility proof.", "Stop only when the remaining search region is empty or the pointers cross."],
    complexity: [{ operation: "Monotonic scan", time: "O(n)", space: "O(1)" }],
    trace: {
      title: "Sorted pair frontier",
      input: "values = [1, 3, 4, 8, 10], target = 11",
      steps: ["1 + 10 = 11, so the pair is found immediately.", "If the sum were too small, every pair using the current left value and a smaller right value would also be too small.", "If the sum were too large, every pair using the current right value and a larger left value would also be too large."],
      takeaway: "The comparison is valuable only because sorted order justifies discarding a whole family of pairs.",
    },
    templates: {
      python: "left, right = 0, len(values) - 1\nwhile left < right:\n    state = ...\n    if state == goal:\n        return ...\n    if state < goal:\n        left += 1\n    else:\n        right -= 1",
      swift: "var left = 0\nvar right = values.count - 1\nwhile left < right {\n    let state = /* compare frontier */\n    if state == goal { return /* result */ }\n    if state < goal { left += 1 } else { right -= 1 }\n}",
    },
    pitfalls: ["Moving both pointers without a proof.", "Using value equality when index identity matters.", "Forgetting Swift String indices are not integer offsets."],
    checks: [
      { id: "discard-proof", prompt: "What must justify every pointer move?", answer: "A proof that all candidates skipped by that move cannot satisfy or improve the answer." },
      { id: "sorted-role", prompt: "Why is sorted order often essential?", answer: "It makes the effect of moving a boundary monotonic, so one comparison rules out many candidates." },
      { id: "window-difference", prompt: "How is this different from sliding window?", answer: "Two pointers can represent a search frontier or pair; a sliding window maintains one contiguous region with a validity rule." },
    ],
    practice: { workedItemId: "python:125", guidedItemId: "python:15", coldItemId: "python:15", swiftItemId: "builtin:167", transferItemId: "transfer:20002" },
  },
  {
    id: "pattern:sliding-window",
    slug: "sliding-window",
    revision: 1,
    order: 3,
    pattern: "Sliding Window",
    title: "Sliding Window",
    summary: "Maintain exactly one contiguous candidate region and repair it incrementally instead of rescanning.",
    selection: {
      useWhen: ["The answer concerns a contiguous subarray or substring.", "Adding on the right and removing on the left can update validity cheaply.", "A longest, shortest, or count objective changes monotonically as a window expands or contracts."],
      rejectWhen: ["The chosen elements may be noncontiguous.", "Removing the leftmost element cannot restore validity or cannot be updated incrementally."],
      confusableWith: [
        { pattern: "Two Pointers", distinction: "A window owns every element between left and right and maintains aggregate state for that region." },
        { pattern: "Prefix Sum", distinction: "Prefix sums answer fixed ranges; a window actively searches ranges under a monotonic rule." },
      ],
    },
    invariant: "After the shrink loop, the state exactly describes values[left...right] and that window satisfies the declared validity rule.",
    reasoning: ["Write the validity predicate before the loop.", "Add the right value exactly once.", "Shrink in a while loop until validity is restored, then measure the window."],
    complexity: [{ operation: "Expand and shrink", time: "O(n)", space: "O(k)" }],
    trace: {
      title: "Distinct-character window",
      input: "text = abca",
      steps: ["Expand through a, b, c; the valid window has length 3.", "Adding the final a violates uniqueness.", "Remove from the left until the old a leaves; the state now describes bca.", "Measure only after validity is restored."],
      takeaway: "Each element enters once and leaves at most once, so nested loops still total O(n).",
    },
    templates: {
      python: "left = 0\nstate = {}\nfor right, value in enumerate(values):\n    add(value, state)\n    while not valid(state):\n        remove(values[left], state)\n        left += 1\n    answer = improve(answer, left, right)",
      swift: "var left = 0\nvar state: [Element: Int] = [:]\nfor right in values.indices {\n    // add values[right]\n    while !isValid(state) {\n        // remove values[left]\n        left += 1\n    }\n    // update answer from left...right\n}",
    },
    pitfalls: ["Using if instead of while for repair.", "Updating the answer while the window is invalid.", "Leaving zero-count keys that change a distinct-count predicate."],
    checks: [
      { id: "state-scope", prompt: "What must the frequency state describe after shrinking?", answer: "Exactly the current contiguous window from left through right, with no removed or future values." },
      { id: "linear-proof", prompt: "Why is the common nested-loop implementation O(n)?", answer: "Right advances n times and left also advances at most n times; no element is added or removed more than once." },
      { id: "measure-time", prompt: "When should a longest-valid-window answer be updated?", answer: "After the repair loop, when the invariant guarantees that the current window is valid." },
    ],
    practice: { workedItemId: "python:3", guidedItemId: "python:76", coldItemId: "python:76", swiftItemId: "builtin:3", transferItemId: "transfer:20003" },
  },
  {
    id: "pattern:stack",
    slug: "stack",
    revision: 1,
    order: 4,
    pattern: "Stack",
    title: "Stack",
    summary: "Keep unresolved work in last-in, first-out order; use monotonic stacks when later values resolve earlier ones.",
    selection: {
      useWhen: ["Nested structure must close in reverse order.", "The most recent unresolved candidate is always resolved first.", "You need next greater, next smaller, or a monotonic frontier."],
      rejectWhen: ["Work must be processed in arrival order; use a queue.", "Every prior element needs arbitrary lookup rather than top-only access."],
      confusableWith: [
        { pattern: "Recursion", distinction: "Both use LIFO state, but an explicit stack gives direct control and avoids call-stack depth." },
        { pattern: "Heap", distinction: "A heap resolves by priority; a stack resolves by recency." },
      ],
    },
    invariant: "The stack contains exactly the unresolved candidates, in the order required for the next legal resolution.",
    reasoning: ["Define what one stack entry stores: value, index, or partial frame.", "Pop only when the current input proves the top is resolved.", "If indices matter later, store indices rather than duplicate values."],
    complexity: [{ operation: "Push/pop scan", time: "O(n)", space: "O(n)" }],
    trace: {
      title: "Monotonic temperatures",
      input: "[73, 71, 74]",
      steps: ["Store index 0 for 73 as unresolved.", "71 cannot resolve 73, so store index 1 above it.", "74 resolves 71, then 73; pop each and compute distance from its stored index.", "Store 74 if later input might resolve it."],
      takeaway: "Each index is pushed once and popped once, which is the monotonic-stack O(n) proof.",
    },
    templates: {
      python: "stack = []\nfor index, value in enumerate(values):\n    while stack and resolves(value, stack[-1]):\n        prior = stack.pop()\n        # TODO: record how the current value resolves prior\n    stack.append(index)",
      swift: "var stack: [Int] = []\nfor (index, value) in values.enumerated() {\n    while let prior = stack.last, resolves(value, prior) {\n        stack.removeLast()\n        // TODO: record how the current value resolves prior\n    }\n    stack.append(index)\n}",
    },
    pitfalls: ["Comparing against the wrong stack field.", "Using removeFirst in Swift and accidentally making operations O(n).", "Forgetting unresolved entries may legitimately remain at the end."],
    checks: [
      { id: "entry-meaning", prompt: "What should every stack entry represent?", answer: "A still-unresolved candidate or frame whose resolution order is last-in, first-out." },
      { id: "monotonic-proof", prompt: "Why is a monotonic stack scan linear?", answer: "Every input is pushed once and can be popped at most once." },
      { id: "index-choice", prompt: "When should the stack store indices instead of values?", answer: "When the answer needs positions, distances, or access to more than the value itself." },
    ],
    practice: { workedItemId: "python:20", guidedItemId: "python:739", coldItemId: "python:739", swiftItemId: "builtin:739", transferItemId: "transfer:20004" },
  },
  {
    id: "pattern:binary-search",
    slug: "binary-search",
    revision: 1,
    order: 5,
    pattern: "Binary Search",
    title: "Binary Search",
    summary: "Search a monotonic boundary, not merely an array: identify the first true or last false answer.",
    selection: {
      useWhen: ["A sorted domain supports half-discarding.", "A feasibility predicate changes from false to true exactly once.", "You are minimizing a capacity or maximizing a threshold over an ordered answer space."],
      rejectWhen: ["The predicate is not monotonic.", "You cannot evaluate one candidate more cheaply than enumerating all answers."],
      confusableWith: [
        { pattern: "Two Pointers", distinction: "Binary search jumps across an ordered domain; two pointers traverse a frontier." },
        { pattern: "Greedy", distinction: "A greedy feasibility check can live inside binary search, but the outer proof is monotonic boundary search." },
      ],
    },
    invariant: "The unknown boundary remains inside the closed search interval; everything removed from the interval has a proven predicate value.",
    reasoning: ["Write the monotonic predicate in plain English.", "Choose whether you want first true, last true, first false, or exact match.", "Use one interval convention consistently and prove progress on every branch."],
    complexity: [{ operation: "Boundary search", time: "O(log R × check)", space: "O(1) plus check" }],
    trace: {
      title: "Minimum feasible capacity",
      input: "capacities 1...10; feasibility becomes true at 6",
      steps: ["Check 5: false, so every capacity at most 5 is impossible.", "Search 6...10; check 8: true, so the first true is at most 8.", "Search 6...8; check 7: true, then check 6: true.", "The interval converges to the first feasible capacity, 6."],
      takeaway: "The predicate—not the numeric value itself—provides the sorted structure.",
    },
    templates: {
      python: "low, high = minimum, maximum\nwhile low < high:\n    mid = low + (high - low) // 2\n    # TODO: use the monotonic predicate to retain the boundary\nreturn low",
      swift: "var low = minimum\nvar high = maximum\nwhile low < high {\n    let mid = low + (high - low) / 2\n    // TODO: use the monotonic predicate to retain the boundary\n}\nreturn low",
    },
    pitfalls: ["Mixing closed and half-open interval updates.", "Using a nonmonotonic feasibility check.", "Returning the last midpoint instead of the converged boundary."],
    checks: [
      { id: "predicate", prompt: "What must be monotonic in binary search on the answer?", answer: "A boolean feasibility predicate over an ordered candidate domain must switch value at most once." },
      { id: "interval", prompt: "What does the active interval promise?", answer: "It still contains the desired boundary; every removed candidate has been proven to be on the wrong side." },
      { id: "progress", prompt: "Why use low = mid + 1 on the false branch for first-true search?", answer: "Mid is proven false, so keeping it would not preserve a possible answer and could prevent the interval from shrinking." },
    ],
    practice: { workedItemId: "python:704", guidedItemId: "python:875", coldItemId: "python:875", swiftItemId: "builtin:875", transferItemId: "transfer:20005" },
  },
  {
    id: "pattern:linked-list",
    slug: "linked-list",
    revision: 1,
    order: 6,
    pattern: "Linked List",
    title: "Linked List",
    summary: "Rewire identity-based nodes without losing the unprocessed suffix; use slow/fast pointers for relative position.",
    selection: {
      useWhen: ["The structure exposes next references rather than random access.", "The task changes links in place.", "Cycle, midpoint, or kth-from-end relationships benefit from different pointer speeds."],
      rejectWhen: ["You rely on frequent indexed access.", "Copying values is acceptable and node identity is irrelevant."],
      confusableWith: [{ pattern: "Two Pointers", distinction: "Linked-list pointers move through references and must preserve reachability, not array indices." }],
    },
    invariant: "The processed prefix has the intended links, the current pointer starts the untouched suffix, and a saved next pointer keeps that suffix reachable.",
    reasoning: ["Draw node identities and arrows, not just values.", "Save next before mutating current.next.", "For sentinels, define whether the dummy belongs to the returned structure or only simplifies edge cases."],
    complexity: [{ operation: "Single traversal", time: "O(n)", space: "O(1)" }],
    trace: {
      title: "Reverse three nodes",
      input: "A → B → C → nil",
      steps: ["Save B, redirect A.next to nil, then advance to B.", "Save C, redirect B.next to A, then advance to C.", "Save nil, redirect C.next to B; C is the new head."],
      takeaway: "Save, rewire, advance—in that order—preserves the suffix.",
    },
    templates: {
      python: "previous = None\ncurrent = head\nwhile current:\n    next_node = current.next\n    # TODO: reverse this edge before advancing both references\nreturn previous",
      swift: "var previous: ListNode? = nil\nvar current = head\nwhile let node = current {\n    let next = node.next\n    // TODO: reverse this edge before advancing both references\n}\nreturn previous",
    },
    pitfalls: ["Overwriting next before saving it.", "Comparing node values when identity determines a cycle.", "Force-unwrapping a missing next node in Swift."],
    checks: [
      { id: "rewire-order", prompt: "Why must next be saved before changing current.next?", answer: "Changing current.next otherwise destroys the only reference to the untouched suffix." },
      { id: "identity", prompt: "When do node identities matter more than values?", answer: "Cycle detection, intersection, and any problem where equal values can belong to different nodes." },
      { id: "dummy", prompt: "What edge case does a dummy node usually remove?", answer: "Special handling when an insertion, removal, or merge changes the real head." },
    ],
    practice: { workedItemId: "python:206", guidedItemId: "python:21", coldItemId: "python:141", swiftItemId: "builtin:206" },
  },
  {
    id: "pattern:trees",
    slug: "trees",
    revision: 1,
    order: 7,
    pattern: "Trees",
    title: "Trees",
    summary: "Choose what each subtree returns, or what each queue level represents, then preserve that contract recursively or iteratively.",
    selection: {
      useWhen: ["The input is hierarchical and subproblems are rooted at children.", "A result can be composed from left and right subtree summaries.", "Level order or shortest unweighted depth calls for breadth-first traversal."],
      rejectWhen: ["Edges form a general graph and parent/visited handling is missing.", "The desired state spans arbitrary ancestors and cannot be summarized locally."],
      confusableWith: [
        { pattern: "Graphs", distinction: "Trees have a unique parent path; general graphs require visited or state-color handling." },
        { pattern: "Dynamic Programming", distinction: "Tree recursion becomes tree DP when each node returns a multi-choice optimization state." },
      ],
    },
    invariant: "Every completed subtree call returns exactly the quantity its parent expects; every queued BFS node belongs to the frontier whose depth is currently known.",
    reasoning: ["Write the base-case return before the recursive case.", "Name the meaning of the return value for one node.", "Use BFS when level boundaries or minimum unweighted depth are the natural unit."],
    complexity: [{ operation: "Full traversal", time: "O(n)", space: "O(h) DFS or O(w) BFS" }],
    trace: {
      title: "Depth return contract",
      input: "root with a leaf left child and a two-level right chain",
      steps: ["A missing child returns depth 0.", "Each leaf returns 1 + max(0, 0) = 1.", "The right internal node returns 2.", "The root returns 1 + max(1, 2) = 3."],
      takeaway: "The code becomes mechanical once one call's return meaning is precise.",
    },
    templates: {
      python: "def dfs(node):\n    if node is None:\n        return base\n    left = dfs(node.left)\n    right = dfs(node.right)\n    return combine(node, left, right)",
      swift: "func dfs(_ node: TreeNode?) -> Summary {\n    guard let node else { return base }\n    let left = dfs(node.left)\n    let right = dfs(node.right)\n    return combine(node, left, right)\n}",
    },
    pitfalls: ["A recursive helper with an undefined return contract.", "Using global mutable state when a returned summary is enough.", "Treating an arbitrary binary tree as a BST."],
    checks: [
      { id: "return-contract", prompt: "What should you define before writing a recursive tree helper?", answer: "Exactly what one call returns for the subtree rooted at its argument, including the empty-tree value." },
      { id: "bfs-choice", prompt: "When is BFS usually more natural than DFS?", answer: "When the answer is organized by levels or asks for minimum depth in an unweighted structure." },
      { id: "space", prompt: "What controls DFS auxiliary space on a tree?", answer: "Tree height, because that bounds the number of active recursive frames or explicit stack entries." },
    ],
    practice: { workedItemId: "python:104", guidedItemId: "python:102", coldItemId: "python:98", swiftItemId: "builtin:104", transferItemId: "transfer:20006" },
  },
  {
    id: "pattern:intervals",
    slug: "intervals",
    revision: 1,
    order: 8,
    pattern: "Intervals",
    title: "Intervals",
    summary: "Sort by the boundary that makes future overlap decisions local, then maintain one merged or selected frontier.",
    selection: {
      useWhen: ["Ranges overlap, merge, cover, or compete for space.", "Sorting by start or end turns a global relation into a local frontier decision.", "The answer depends on keeping a maximal non-overlapping set or combining connected ranges."],
      rejectWhen: ["The domain is tiny enough for a direct occupancy structure.", "Intervals arrive online and require a dynamic ordered data structure."],
      confusableWith: [{ pattern: "Greedy", distinction: "Intervals often use greedy reasoning, but the key representation is an ordered boundary frontier." }],
    },
    invariant: "The output before the current frontier is finalized, sorted, and non-overlapping; only the last frontier interval can still merge with the next input.",
    reasoning: ["Choose and state endpoint semantics: closed, open, or half-open.", "Sort by the boundary that makes the next decision local.", "Compare only with the active frontier; finalize it when overlap is impossible."],
    complexity: [{ operation: "Sort and sweep", time: "O(n log n)", space: "O(n) output" }],
    trace: {
      title: "Merge frontier",
      input: "[[1,3], [2,6], [8,10]]",
      steps: ["Start frontier [1,3].", "[2,6] overlaps because 2 ≤ 3; extend frontier to [1,6].", "[8,10] starts after 6; finalize [1,6] and begin [8,10]."],
      takeaway: "After sorting, only the most recent merged interval can overlap the next one.",
    },
    templates: {
      python: "intervals.sort(key=lambda pair: pair[0])\nmerged = []\nfor start, end in intervals:\n    # TODO: append a disjoint interval or extend the active frontier",
      swift: "let ordered = intervals.sorted { $0[0] < $1[0] }\nvar merged: [[Int]] = []\nfor interval in ordered {\n    // TODO: append a disjoint interval or extend the active frontier\n}",
    },
    pitfalls: ["Leaving endpoint inclusivity implicit.", "Comparing every pair after sorting.", "Mutating a Swift value-copy without writing the updated interval back."],
    checks: [
      { id: "sort-key", prompt: "Why sort intervals before merging?", answer: "It guarantees that once a range no longer overlaps the active frontier, no later range can overlap that finalized frontier from the left." },
      { id: "frontier", prompt: "Which output interval can still change during a merge sweep?", answer: "Only the last active frontier interval; earlier output intervals are finalized." },
      { id: "endpoints", prompt: "Why must endpoint semantics be explicit?", answer: "Whether touching ranges overlap changes the comparison and therefore the result." },
    ],
    practice: { workedItemId: "python:56", guidedItemId: "python:57", coldItemId: "python:57", swiftItemId: "builtin:435" },
  },
  {
    id: "pattern:graphs",
    slug: "graphs",
    revision: 1,
    order: 9,
    pattern: "Graphs",
    title: "Graphs",
    summary: "Model states and transitions, then pair the traversal with the right visited, color, distance, or indegree invariant.",
    selection: {
      useWhen: ["Entities are connected by arbitrary relationships.", "You need reachability, components, ordering, or shortest paths.", "The problem can be reframed as states connected by legal transitions."],
      rejectWhen: ["The structure is a tree and unique-parent traversal is enough.", "Edges encode a dense numeric recurrence better handled by DP."],
      confusableWith: [
        { pattern: "Trees", distinction: "Graphs may cycle or have multiple parents, so visited state is part of correctness." },
        { pattern: "Backtracking", distinction: "Graph traversal marks global reachability; backtracking explores decision paths and deliberately undoes path-local choices." },
      ],
    },
    invariant: "Every discovered node has a recorded traversal state, and every frontier entry represents a path whose distance or dependency status is already justified.",
    reasoning: ["Define nodes and edges before choosing an algorithm.", "Choose BFS for unweighted shortest hops, DFS for reachability/components, topological order for dependencies, and Dijkstra for nonnegative weighted paths.", "Mark visited when enqueuing when duplicate queue entries would be harmful."],
    complexity: [{ operation: "Adjacency traversal", time: "O(V + E)", space: "O(V + E)" }],
    trace: {
      title: "BFS hop layers",
      input: "A connects to B,C; B connects to D; C connects to D",
      steps: ["Queue A at distance 0 and mark it discovered.", "Discover B and C at distance 1; mark them before enqueueing.", "From B, discover D at distance 2.", "From C, D is already discovered, so it is not enqueued again."],
      takeaway: "The first discovery in BFS is the shortest unweighted path because the queue processes nondecreasing distance layers.",
    },
    templates: {
      python: "queue = deque([start])\nseen = {start}\nwhile queue:\n    node = queue.popleft()\n    for neighbor in graph[node]:\n        # TODO: discover each unseen neighbor exactly once",
      swift: "var queue = [start]\nvar head = 0\nvar seen: Set<Node> = [start]\nwhile head < queue.count {\n    let node = queue[head]\n    head += 1\n    // TODO: discover each unseen neighbor exactly once\n}",
    },
    pitfalls: ["Marking visited only after dequeue and creating duplicates.", "Using BFS for weighted shortest paths.", "Forgetting a recursion-depth risk on large graphs."],
    checks: [
      { id: "model", prompt: "What should be named before selecting BFS or DFS?", answer: "The graph's nodes, edges, and the exact question—reachability, shortest path, ordering, components, or something else." },
      { id: "bfs-shortest", prompt: "Why does BFS find shortest unweighted paths?", answer: "Its queue processes nodes in nondecreasing hop count, so the first discovery of a node uses the fewest edges." },
      { id: "visited-time", prompt: "Why often mark a node when enqueueing?", answer: "It prevents multiple parents from enqueueing the same node before its first dequeue." },
    ],
    practice: { workedItemId: "python:200", guidedItemId: "python:207", coldItemId: "python:207", swiftItemId: "builtin:200", transferItemId: "transfer:20007" },
  },
  {
    id: "pattern:backtracking",
    slug: "backtracking",
    revision: 1,
    order: 10,
    pattern: "Backtracking",
    title: "Backtracking",
    summary: "Explore a decision tree with explicit choose → explore → unchoose symmetry and prune only with a proof.",
    selection: {
      useWhen: ["You must enumerate combinations, permutations, assignments, or paths.", "Each partial choice changes the legal next choices.", "Constraints allow early pruning of an exponential decision tree."],
      rejectWhen: ["Only an optimal value is needed and subproblems repeat heavily; DP may avoid enumeration.", "A greedy local choice has a proven exchange argument."],
      confusableWith: [
        { pattern: "Dynamic Programming", distinction: "Backtracking enumerates decision paths; DP merges repeated states and usually returns a value/count." },
        { pattern: "Graph DFS", distinction: "Backtracking's visited/choice state is often path-local and must be undone." },
      ],
    },
    invariant: "At helper entry, the path contains exactly the choices for the current decision prefix; helper exit restores caller-owned mutable state.",
    reasoning: ["Define one decision level and its candidate set.", "Record the base case before generating children.", "Pair every mutation with an undo on every control-flow path."],
    complexity: [{ operation: "Decision-tree exploration", time: "Exponential, problem-dependent", space: "O(depth) plus output" }],
    trace: {
      title: "Combination choices",
      input: "candidates = [2,3], target = 5",
      steps: ["Choose 2; remaining target is 3.", "Choose 2 again; remaining 1 cannot be completed, so undo.", "Choose 3; remaining 0 records [2,3].", "Undo 3, undo 2, then explore branches beginning with 3."],
      takeaway: "Undo returns the path to the exact state expected by the next sibling branch.",
    },
    templates: {
      python: "def search(start, path, state):\n    if complete(state):\n        answers.append(path.copy())\n        return\n    for index in candidates(start, state):\n        # TODO: choose, explore, then undo the choice",
      swift: "func search(_ start: Int, _ state: State) {\n    if isComplete(state) {\n        answers.append(path)\n        return\n    }\n    for index in candidates(start, state) {\n        // TODO: choose, explore, then undo the choice\n    }\n}",
    },
    pitfalls: ["Appending the same mutable path object without copying in Python.", "Forgetting to undo after a recursive call.", "Pruning a branch without proving no completion is possible."],
    checks: [
      { id: "entry-state", prompt: "What should be true about path at helper entry?", answer: "It contains exactly the choices made along the current root-to-helper decision prefix." },
      { id: "undo", prompt: "Why is unchoose required?", answer: "Sibling branches share the same mutable path, so each branch must restore the state it received." },
      { id: "pruning", prompt: "When is pruning correct during backtracking?", answer: "Only when the current partial state proves that no descendant can become a valid or better solution." },
    ],
    practice: { workedItemId: "python:39", guidedItemId: "python:79", coldItemId: "python:79", swiftItemId: "builtin:78" },
  },
  {
    id: "pattern:greedy",
    slug: "greedy",
    revision: 1,
    order: 11,
    pattern: "Greedy",
    title: "Greedy",
    summary: "Commit to a locally best choice only when an exchange, frontier, or dominance proof makes reconsideration unnecessary.",
    selection: {
      useWhen: ["One choice dominates alternatives without harming future feasibility.", "An exchange argument can transform an optimal solution to use the greedy choice.", "Maintaining the best reachable frontier is sufficient."],
      rejectWhen: ["A local choice changes future options in ways not summarized by one frontier.", "You cannot prove the greedy choice belongs to some optimal solution."],
      confusableWith: [
        { pattern: "Dynamic Programming", distinction: "Greedy keeps one justified frontier; DP keeps multiple competing states because local commitment is unsafe." },
        { pattern: "Binary Search", distinction: "Greedy may implement feasibility, while binary search locates a monotonic threshold." },
      ],
    },
    invariant: "The maintained frontier is at least as good as every alternative reachable from decisions already processed.",
    reasoning: ["State the greedy choice in one sentence.", "Prove dominance or give an exchange argument before coding.", "Track the minimal state that certifies future reachability or optimality."],
    complexity: [{ operation: "Single frontier pass", time: "O(n)", space: "O(1)" }],
    trace: {
      title: "Reachable frontier",
      input: "jumps = [2, 3, 1, 1, 4]",
      steps: ["At index 0, the farthest reachable index becomes 2.", "Index 1 is reachable; its jump extends the frontier to 4.", "The frontier already reaches the last index, so later local paths do not need separate exploration."],
      takeaway: "The frontier dominates every individual path ending within it.",
    },
    templates: {
      python: "frontier = initial\nfor index, value in enumerate(values):\n    if index > frontier:\n        return failure\n    frontier = max(frontier, extend(index, value))\n    if done(frontier):\n        return success",
      swift: "var frontier = initial\nfor (index, value) in values.enumerated() {\n    guard index <= frontier else { return failure }\n    frontier = max(frontier, extend(index, value))\n    if isDone(frontier) { return success }\n}",
    },
    pitfalls: ["Calling an intuition greedy without a proof.", "Tracking one concrete path when only the dominating frontier matters.", "Using greedy on coin systems or scheduling variants where the exchange property does not hold."],
    checks: [
      { id: "proof", prompt: "What separates a greedy algorithm from a hopeful heuristic?", answer: "A dominance or exchange proof that the local choice can belong to an optimal solution without harming the remainder." },
      { id: "frontier", prompt: "What does a reachable frontier summarize?", answer: "All paths already explored are dominated by the farthest position they collectively make reachable." },
      { id: "dp-switch", prompt: "When should you suspect DP instead?", answer: "When multiple partial choices remain genuinely incomparable and future value depends on which one was chosen." },
    ],
    practice: { workedItemId: "python:55", guidedItemId: "python:55", coldItemId: "python:55", swiftItemId: "builtin:763" },
  },
  {
    id: "pattern:dynamic-programming",
    slug: "dynamic-programming",
    revision: 1,
    order: 12,
    pattern: "Dynamic Programming",
    title: "Dynamic Programming",
    summary: "Define a state that contains exactly the future-relevant information, then derive it from smaller states in a valid order.",
    selection: {
      useWhen: ["The problem has overlapping subproblems.", "The answer is an optimum, count, or feasibility result over choices.", "A small state captures everything the future needs from a prefix, suffix, grid cell, or pair of indices."],
      rejectWhen: ["A local choice safely dominates all others; greedy is simpler.", "Subproblems do not repeat and a direct traversal is enough."],
      confusableWith: [
        { pattern: "Backtracking", distinction: "DP merges equivalent decision prefixes into one state instead of enumerating them repeatedly." },
        { pattern: "Greedy", distinction: "DP retains competing states when no single local frontier dominates." },
      ],
    },
    invariant: "Before computing a state, every dependency named by its recurrence is already correct; the state stores exactly the promised subproblem answer.",
    reasoning: ["Write dp[...] means ... in a full sentence.", "Derive the recurrence by naming the last choice or first unresolved choice.", "Choose an iteration order that computes dependencies first, then verify base cases against the state meaning."],
    complexity: [{ operation: "State table", time: "states × transitions", space: "states, often compressible" }],
    trace: {
      title: "One-dimensional choice DP",
      input: "values = [2, 7, 9] with adjacent choices forbidden",
      steps: ["At the first value, best is 2.", "At 7, compare skipping it (2) with taking it plus the empty-prefix base (7); best is 7.", "At 9, compare skipping it (7) with taking it plus the best two positions back (9 + 2 = 11).", "The final prefix state is 11."],
      takeaway: "The recurrence follows directly from the last decision: skip current or take current and combine with a compatible prefix.",
    },
    templates: {
      python: "previous_two = base0\nprevious_one = base1\nfor value in values:\n    current = combine(previous_one, previous_two, value)\n    previous_two, previous_one = previous_one, current\nreturn previous_one",
      swift: "var previousTwo = base0\nvar previousOne = base1\nfor value in values {\n    let current = combine(previousOne, previousTwo, value)\n    previousTwo = previousOne\n    previousOne = current\n}\nreturn previousOne",
    },
    pitfalls: ["Writing a recurrence before defining the state.", "Iterating in an order that reads current-row values too early.", "Compressing space before the full dependency structure is correct."],
    checks: [
      { id: "state-sentence", prompt: "What is the first artifact to write for a DP solution?", answer: "A precise sentence defining what each state key means and which portion of the input it covers." },
      { id: "recurrence", prompt: "How do you usually derive the recurrence?", answer: "Partition valid solutions by a decisive choice, then express each partition using smaller already-defined states." },
      { id: "order", prompt: "What determines table iteration order?", answer: "The dependency graph: every state must be computed only after all states referenced by its recurrence." },
    ],
    practice: { workedItemId: "python:70", guidedItemId: "python:198", coldItemId: "python:198", swiftItemId: "builtin:322" },
  },
] as const;

export const PATTERN_LESSON_BY_SLUG = new Map(
  PATTERN_LESSONS.map((lesson) => [lesson.slug, lesson]),
);

export const PATTERN_LESSON_BY_ID = new Map(
  PATTERN_LESSONS.map((lesson) => [lesson.id, lesson]),
);
