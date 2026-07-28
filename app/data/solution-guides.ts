export type SolutionGuideSchemaVersion = 1;

export type SolutionGuideItemId = `python:${number}` | `transfer:${number}`;

export type SolutionGuideDerivedSource =
  | "item-metadata"
  | "reference-implementation"
  | "local-verification-cases";

export type SolutionGuideProvenance = Readonly<{
  origin: "project-authored";
  derivedFrom: readonly SolutionGuideDerivedSource[];
  reviewedAt: "2026-07-28";
}>;

type TwoToSix<T> =
  | readonly [T, T]
  | readonly [T, T, T]
  | readonly [T, T, T, T]
  | readonly [T, T, T, T, T]
  | readonly [T, T, T, T, T, T];

type TwoToFive<T> =
  | readonly [T, T]
  | readonly [T, T, T]
  | readonly [T, T, T, T]
  | readonly [T, T, T, T, T];

type ZeroToThree<T> =
  | readonly []
  | readonly [T]
  | readonly [T, T]
  | readonly [T, T, T];

type OneToFour<T> =
  | readonly [T]
  | readonly [T, T]
  | readonly [T, T, T]
  | readonly [T, T, T, T];

export type SolutionGuideApproach = Readonly<{
  summary: string;
  steps: TwoToSix<string>;
  correctness: string;
}>;

export type SolutionGuideEdgeCase = Readonly<{
  description: string;
  caseIds?: readonly string[];
}>;

export type SolutionGuideAlternative = Readonly<{
  name: string;
  tradeoff: string;
}>;

export type SolutionGuideV1 = Readonly<{
  schemaVersion: SolutionGuideSchemaVersion;
  itemId: SolutionGuideItemId;
  itemRevision: number;
  provenance: SolutionGuideProvenance;
  approach: SolutionGuideApproach;
  complexityRationale: string;
  edgeCases: TwoToFive<SolutionGuideEdgeCase>;
  alternatives: ZeroToThree<SolutionGuideAlternative>;
  pitfalls: OneToFour<string>;
}>;

type GuideBody = Omit<
  SolutionGuideV1,
  "schemaVersion" | "itemId" | "itemRevision" | "provenance"
>;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

const PROVENANCE: SolutionGuideProvenance = deepFreeze({
  origin: "project-authored",
  derivedFrom: [
    "item-metadata",
    "reference-implementation",
    "local-verification-cases",
  ] as const,
  reviewedAt: "2026-07-28",
});

function guide(itemId: SolutionGuideItemId, body: GuideBody): SolutionGuideV1 {
  return deepFreeze({
    schemaVersion: 1,
    itemId,
    itemRevision: 1,
    provenance: PROVENANCE,
    ...body,
  });
}

export const SOLUTION_GUIDES: readonly SolutionGuideV1[] = Object.freeze([
  guide("python:10001", {
    approach: {
      summary: "Normalize each word, count nonempty results, then select the strongest count with an alphabetical tie break.",
      steps: [
        "Strip surrounding whitespace and lowercase each input word.",
        "Ignore normalized empty strings and increment every remaining word in a frequency map.",
        "If the map is nonempty, choose the pair minimizing negative frequency followed by the word itself.",
      ],
      correctness: "The map records exactly one increment for every retained normalized word. Minimizing (-frequency, word) therefore chooses a maximum frequency first and the alphabetically earliest word among ties.",
    },
    complexityRationale: "One pass performs expected constant-time map updates, then one pass over k distinct words selects the result: O(n) expected time and O(k) space.",
    edgeCases: [
      { description: "No word remains after normalization." },
      { description: "Several normalized words share the highest frequency." },
      { description: "Different casing and surrounding spaces normalize to one key." },
    ],
    alternatives: [
      { name: "Counter", tradeoff: "Counter shortens counting code, but the deterministic tie-break selection is still required." },
    ],
    pitfalls: ["Counting empty normalized strings.", "Using max on (frequency, word), which favors the alphabetically later tied word."],
  }),
  guide("python:10002", {
    approach: {
      summary: "Pair a membership set with an output list so duplicate checks are fast while first-seen order remains explicit.",
      steps: [
        "Initialize an empty seen set and result list.",
        "Scan values in input order and skip a value already in seen.",
        "For a new value, add it to seen and append it to the result.",
      ],
      correctness: "A value is appended exactly on its first encounter because later encounters find it in seen. Since scanning is left to right, the output contains every distinct value in first-occurrence order.",
    },
    complexityRationale: "Each value has one expected O(1) set lookup and at most one insertion, for O(n) expected time and O(k) storage for k distinct values.",
    edgeCases: [
      { description: "The input list is empty." },
      { description: "Every input value is the same." },
      { description: "Zero and negative values repeat in an interleaved order." },
    ],
    alternatives: [
      { name: "Dictionary keys", tradeoff: "An insertion-ordered dictionary can preserve first occurrences, but the set-plus-list version states both responsibilities directly." },
    ],
    pitfalls: ["Converting through a set and losing stable order.", "Appending before checking membership."],
  }),
  guide("python:10003", {
    approach: {
      summary: "Validate equal lengths, then enumerate paired elements and record only positions whose values differ.",
      steps: [
        "Reject inputs with different lengths before pairing them.",
        "Zip corresponding values and enumerate the paired stream.",
        "Append the index, expected value, and actual value whenever the pair differs.",
      ],
      correctness: "Equal lengths make zip cover every valid position exactly once. The conditional appends precisely the positions with unequal values, and enumeration supplies their original indices.",
    },
    complexityRationale: "The paired scan visits n positions once, so time is O(n); aside from the returned m mismatches, auxiliary work is constant.",
    edgeCases: [
      { description: "Both sequences are empty." },
      { description: "The sequences have unequal lengths and must be rejected rather than silently truncated." },
      { description: "Mismatches occur at the first or last position." },
    ],
    alternatives: [],
    pitfalls: ["Relying on zip without first checking lengths.", "Reporting one-based indices when the contract uses Python indices."],
  }),
  guide("python:10004", {
    approach: {
      summary: "Return a new list sorted by a composite key that encodes descending score and case-insensitive ascending name.",
      steps: [
        "Build a key from the negated score and lowercased name.",
        "Call sorted so the original player list is not mutated.",
      ],
      correctness: "Tuple comparison orders the negated score first, which is equivalent to descending original score. Equal scores then compare normalized names ascending, and stable sorting preserves input order when both key parts tie.",
    },
    complexityRationale: "Sorting n records costs O(n log n) time and the returned sorted list requires O(n) space.",
    edgeCases: [
      { description: "The player list is empty." },
      { description: "Multiple players have the same score." },
      { description: "Names differ only by casing, producing identical normalized keys." },
    ],
    alternatives: [],
    pitfalls: ["Forgetting to negate scores.", "Using list.sort and mutating the caller's list."],
  }),
  guide("python:10005", {
    approach: {
      summary: "Run breadth-first traversal with a deque and mark nodes when they are discovered.",
      steps: [
        "Put the start node in a deque and in the seen set.",
        "Repeatedly remove the oldest queued node and append it to the order.",
        "Enqueue each unseen neighbor in listed order, marking it seen immediately.",
      ],
      correctness: "FIFO processing visits all nodes at smaller distance before nodes at larger distance. Immediate marking prevents duplicate enqueues, so each reachable node appears once and discovery order is preserved within a level.",
    },
    complexityRationale: "Each reachable vertex is queued once and each outgoing adjacency is examined once, giving O(V + E) time and O(V) traversal state.",
    edgeCases: [
      { description: "The start node is absent from the graph and acts as an isolated node." },
      { description: "The graph contains a cycle or self-loop." },
      { description: "Different branches point to the same neighbor." },
    ],
    alternatives: [
      { name: "Depth-first traversal", tradeoff: "DFS reaches the same component but does not provide breadth-first order." },
    ],
    pitfalls: ["Marking nodes only after dequeue and allowing duplicate queue entries.", "Using list.pop(0), which shifts the list."],
  }),
  guide("python:10006", {
    approach: {
      summary: "Heapify comparison tuples, then pop at most the requested number of task names.",
      steps: [
        "Copy tasks into tuples ordered as priority, sequence, and name, then heapify them.",
        "Repeat up to the smaller of the limit and heap size.",
        "Pop the minimum tuple and append only its task name to the result.",
      ],
      correctness: "The heap root is always the lexicographically smallest remaining comparison tuple, so each pop emits the next task by priority and then sequence. The bounded loop returns exactly the available requested prefix.",
    },
    complexityRationale: "Heapify is O(n), and up to k pops cost O(log n) each, for O(n + k log n) time and O(n) copied heap space.",
    edgeCases: [
      { description: "The limit is zero." },
      { description: "The limit exceeds the number of tasks." },
      { description: "Priority and sequence tie, leaving the task name as the next tuple field." },
    ],
    alternatives: [
      { name: "Full sorting", tradeoff: "Sorting is simple but costs O(n log n) even when only a small prefix is requested." },
    ],
    pitfalls: ["Placing a non-orderable payload before a tie-break field.", "Popping more times than the heap contains."],
  }),
  guide("python:10007", {
    approach: {
      summary: "Filter and convert valid score strings into a reusable list, then sum their squares through a generator.",
      steps: [
        "Retain strings whose stripped form is integer-like and whose integer value lies in the inclusive score range.",
        "Convert retained strings to integers in their original order.",
        "Compute the squared total with a generator over the normalized list.",
      ],
      correctness: "The comprehension admits exactly the syntactically valid in-range inputs and preserves their order. The generator contributes one square for every normalized score, so its sum is the required total.",
    },
    complexityRationale: "The input and normalized values are each traversed once, for O(n) time; the normalized result itself requires O(n) space while the generator adds no second list.",
    edgeCases: [
      { description: "No raw score qualifies." },
      { description: "Scores equal either inclusive boundary." },
      { description: "Valid scores include whitespace or leading zeroes." },
    ],
    alternatives: [
      { name: "Explicit loop", tradeoff: "A loop can parse each string once and may be clearer if validation becomes more complex." },
    ],
    pitfalls: ["Accepting negative strings despite the nonnegative range.", "Building another list solely to pass it to sum."],
  }),
  guide("python:10008", {
    approach: {
      summary: "Accumulate owner-to-kind lists and per-kind totals together during one pass over events.",
      steps: [
        "Create a defaultdict of lists for owners and a Counter for event kinds.",
        "For each owner-kind pair, append the kind to that owner's list and increment the kind count.",
        "Convert the defaultdict to an ordinary dictionary for the returned structure.",
      ],
      correctness: "Each event performs one append under its owner and one increment under its kind. Thus both returned summaries contain exactly one contribution for every processed event.",
    },
    complexityRationale: "The event pass is O(n) expected time, and the grouped lists plus counts store O(n) total event information.",
    edgeCases: [
      { description: "There are no events." },
      { description: "One owner has several event kinds." },
      { description: "The same kind occurs under multiple owners." },
    ],
    alternatives: [
      { name: "Plain dictionaries", tradeoff: "They avoid specialized collections but require explicit missing-key initialization." },
    ],
    pitfalls: ["Sharing one list across owners.", "Counting owners when the frequency contract is about event kinds."],
  }),
  guide("python:1", {
    approach: {
      summary: "Scan once while mapping each value to its earliest index, returning when the needed complement has already appeared.",
      steps: [
        "Initialize an empty value-to-index map.",
        "For each number, compute the target minus that number and check the map.",
        "Return the stored complement index and current index when found; otherwise store the current value if it is new.",
      ],
      correctness: "Before each position, the map represents earlier values. A map hit therefore gives two distinct indices whose values sum to the target; if a solution pair exists, its later index will discover the earlier one.",
    },
    complexityRationale: "The array is scanned once with expected O(1) dictionary operations, for O(n) expected time and O(n) space.",
    edgeCases: [
      { description: "The solution uses two equal values at different indices." },
      { description: "Negative values or a negative target are present." },
      { description: "A duplicate value appears after an earlier usable index." },
    ],
    alternatives: [
      { name: "Brute-force pairs", tradeoff: "It uses constant extra space but examines O(n²) pairs." },
    ],
    pitfalls: ["Storing the current number before checking and pairing an index with itself.", "Overwriting an earlier duplicate before it can be used."],
  }),
  guide("python:49", {
    approach: {
      summary: "Group words by an immutable 26-count signature that is identical exactly for lowercase anagrams.",
      steps: [
        "For each word, count each lowercase letter in a fixed-size array.",
        "Convert the count array to a tuple so it can be a dictionary key.",
        "Append the original word to the list stored under that signature.",
        "Return all grouped lists.",
      ],
      correctness: "Two lowercase words share a signature exactly when every letter multiplicity matches, which is precisely the anagram relation. Appending under that key places every word in one and only one correct group.",
    },
    complexityRationale: "Counting all characters across n words of maximum length k costs O(nk) time; signatures and grouped output occupy O(nk) total space.",
    edgeCases: [
      { description: "Several copies of the same word occur." },
      { description: "The empty string forms a valid all-zero signature group." },
      { description: "Single-character words belong to groups determined by that character." },
    ],
    alternatives: [
      { name: "Sorted-character key", tradeoff: "It is more general but costs O(k log k) per word instead of linear character counting." },
    ],
    pitfalls: ["Using a mutable list as a dictionary key.", "Dropping repeated input words from their group."],
  }),
  guide("python:238", {
    approach: {
      summary: "Write prefix products into the answer, then multiply them by a running suffix product from right to left.",
      steps: [
        "Initialize the output with multiplicative identities and a prefix product of one.",
        "Scan left to right: store the product before each index, then include the current value in the prefix.",
        "Scan right to left: multiply each stored prefix by the product after that index, then extend the suffix.",
      ],
      correctness: "After the first pass, output[i] is the product strictly left of i. During the reverse pass it is multiplied by the product strictly right of i, yielding exactly the product of every other position.",
    },
    complexityRationale: "Two linear scans cost O(n) time. Excluding the required output array, only the prefix and suffix scalars use O(1) auxiliary space.",
    edgeCases: [
      { description: "The array contains one zero." },
      { description: "The array contains multiple zeroes." },
      { description: "Negative values change product signs." },
    ],
    alternatives: [
      { name: "Separate prefix and suffix arrays", tradeoff: "It is easy to visualize but uses O(n) additional space." },
    ],
    pitfalls: ["Including nums[i] in its own prefix or suffix.", "Using division, which violates the intended method and mishandles zeroes."],
  }),
  guide("python:125", {
    approach: {
      summary: "Move two indices inward, skipping non-alphanumeric characters and comparing retained characters case-insensitively.",
      steps: [
        "Start one pointer at each end of the string.",
        "Advance either pointer past characters excluded from comparison.",
        "Compare the retained characters after lowercasing; fail on a mismatch.",
        "Move both pointers inward after a match until they cross.",
      ],
      correctness: "At each comparison the pointers identify the outermost unverified retained characters. Matching them reduces the remaining candidate palindrome; a mismatch disproves it, and crossing means every required mirrored pair matched.",
    },
    complexityRationale: "Each pointer moves monotonically across at most n characters, so time is O(n) and auxiliary space is O(1).",
    edgeCases: [
      { description: "The string contains only ignored characters." },
      { description: "Letter casing differs across a mirrored pair." },
      { description: "A single retained character remains in the center." },
    ],
    alternatives: [
      { name: "Build a normalized string", tradeoff: "It is concise but allocates O(n) additional space." },
    ],
    pitfalls: ["Comparing punctuation instead of skipping it.", "Moving pointers after a skip and then comparing without rechecking bounds."],
  }),
  guide("python:15", {
    approach: {
      summary: "Sort the numbers, fix each distinct first value, and find complementary pairs with inward-moving endpoints.",
      steps: [
        "Sort the array and iterate possible first indices, skipping duplicate first values.",
        "For each first value, place left and right pointers around the remaining suffix.",
        "Move left rightward when the sum is too small and right leftward when it is too large.",
        "On zero, record the triple, move both endpoints, and skip repeated endpoint values.",
      ],
      correctness: "For a fixed first value, sorted order makes endpoint movement discard only sums that cannot reach zero with that endpoint. Every viable pair is therefore considered, while duplicate skipping emits each value triple once.",
    },
    complexityRationale: "Sorting costs O(n log n), and the two-pointer scan is O(n) for each of O(n) anchors, yielding O(n²) time; sorting accounts for O(n) implementation-dependent space.",
    edgeCases: [
      { description: "Fewer than three numbers are provided." },
      { description: "Many duplicate values could produce the same triple." },
      { description: "All values have one sign, so no triple can reach zero." },
    ],
    alternatives: [
      { name: "Per-anchor hash set", tradeoff: "It also reaches O(n²) expected time but needs extra per-anchor state and duplicate control." },
    ],
    pitfalls: ["Skipping duplicate anchors or endpoints at the wrong time.", "Returning duplicate triples."],
  }),
  guide("python:3", {
    approach: {
      summary: "Maintain a duplicate-free window and jump its left edge beyond an in-window previous occurrence.",
      steps: [
        "Track the left boundary, the best length, and each character's most recent index.",
        "When a character's previous index is at or beyond left, move left to one position after it.",
        "Record the current index as the newest occurrence and update the window length.",
      ],
      correctness: "After the boundary update, the current window contains no repeated character: the only new possible repetition is removed by jumping past its previous copy. Every maximal valid window ending at each right index is measured, so the maximum is found.",
    },
    complexityRationale: "The right index scans once and the left boundary only increases, giving O(n) time and O(k) space for observed characters.",
    edgeCases: [
      { description: "The string is empty." },
      { description: "Every character is identical." },
      { description: "A repeated character last appeared before the current window and must not move left backward." },
    ],
    alternatives: [
      { name: "Window set", tradeoff: "Removing from the left one character at a time is still linear but may perform more steps than last-index jumps." },
    ],
    pitfalls: ["Moving left backward for an old occurrence.", "Updating the last index before using its previous value."],
  }),
  guide("python:76", {
    approach: {
      summary: "Expand a counted window until it covers every required character, then shrink it to find the shortest valid range.",
      steps: [
        "Count target requirements and initialize window counts, satisfied-kind count, and best range.",
        "Extend the right boundary, increasing satisfied kinds when a requirement is met exactly.",
        "While every required kind is satisfied, record a shorter range and remove the left character.",
        "If removal drops a required count below its target, decrement satisfied kinds and resume expansion.",
      ],
      correctness: "The satisfied-kind count equals the number of requirements currently met. Shrinking while all are met examines the shortest valid window for each right boundary; all possible right boundaries are processed, so the best recorded window is globally minimum.",
    },
    complexityRationale: "Each source character enters and leaves the window at most once, and target counting is linear, for O(|s| + |t|) time and O(k) character-map space.",
    edgeCases: [
      { description: "The target is empty." },
      { description: "The source cannot cover all target multiplicities." },
      { description: "The target requires repeated copies of one character." },
    ],
    alternatives: [],
    pitfalls: ["Tracking total matching characters inconsistently with distinct requirements.", "Shrinking after the window has already become invalid."],
  }),
  guide("python:20", {
    approach: {
      summary: "Use a stack of opening delimiters and require each closer to match the most recent unmatched opener.",
      steps: [
        "Map every closing delimiter to its required opening delimiter.",
        "Push opening delimiters as they are scanned.",
        "For a closer, reject an empty stack or a different top; otherwise pop the match.",
        "Accept only if the stack is empty after the full scan.",
      ],
      correctness: "The stack contains unmatched openings in nesting order. A valid closer must match its top, so every accepted pop closes the correct innermost pair; an empty final stack means no opening remains unmatched.",
    },
    complexityRationale: "Each character is pushed or popped at most once, for O(n) time and O(n) worst-case stack space.",
    edgeCases: [
      { description: "The string is empty." },
      { description: "A closing delimiter appears before any opener." },
      { description: "All pairs use correct counts but incorrect nesting." },
    ],
    alternatives: [],
    pitfalls: ["Matching only delimiter counts and ignoring order.", "Forgetting to reject leftover openings."],
  }),
  guide("python:739", {
    approach: {
      summary: "Keep unresolved day indices in a decreasing-temperature stack and resolve them when a warmer day arrives.",
      steps: [
        "Initialize zero waits and an empty stack of indices.",
        "For each day, pop while its temperature is warmer than the temperature at the stack top.",
        "For every popped day, store the current-index distance as its wait.",
        "Push the current index for a possible future resolution.",
      ],
      correctness: "Stack temperatures are nonincreasing. The first later day that pops an index is warmer, and every intervening day failed the pop condition, so the stored distance is exactly the earliest warmer wait; unpopped days correctly retain no wait.",
    },
    complexityRationale: "Every index is pushed once and popped at most once, giving O(n) time and O(n) stack space.",
    edgeCases: [
      { description: "Temperatures are strictly decreasing." },
      { description: "Equal temperatures do not count as warmer." },
      { description: "One warm day resolves several earlier days." },
    ],
    alternatives: [
      { name: "Forward scan from each day", tradeoff: "It is direct but can take O(n²) time." },
    ],
    pitfalls: ["Using a non-strict comparison and treating equal as warmer.", "Storing temperatures rather than indices and losing distances."],
  }),
  guide("python:704", {
    approach: {
      summary: "Maintain an inclusive candidate interval and discard the half that cannot contain the target after each midpoint comparison.",
      steps: [
        "Set left and right to the first and last array indices.",
        "While left does not exceed right, compute the midpoint.",
        "Return it on equality; otherwise move left above a too-small midpoint or right below a too-large midpoint.",
        "Return the not-found marker once the candidate interval is empty.",
      ],
      correctness: "The invariant is that any target occurrence remains inside [left, right]. Sorted order proves the discarded half cannot contain the target, and equality returns a valid index; an empty interval proves absence.",
    },
    complexityRationale: "Each comparison halves the candidate interval, so time is O(log n), and only index variables use O(1) space.",
    edgeCases: [
      { description: "The array is empty." },
      { description: "The target is at either boundary." },
      { description: "The target falls between present sorted values." },
    ],
    alternatives: [
      { name: "Linear scan", tradeoff: "It works without sorted input but costs O(n) time." },
    ],
    pitfalls: ["Mixing inclusive and half-open boundary updates.", "Failing to move past the midpoint and looping forever."],
  }),
  guide("python:875", {
    approach: {
      summary: "Binary-search the smallest eating speed whose rounded-up per-pile hours fit the deadline.",
      steps: [
        "Search speeds from one through the largest pile.",
        "For a midpoint speed, sum each pile's ceiling-divided eating hours.",
        "If the total fits, retain the midpoint as a candidate and search lower speeds.",
        "Otherwise search only higher speeds and return the lowest feasible boundary.",
      ],
      correctness: "Required hours never increase when speed increases, so feasibility is monotonic. The binary search discards only speeds known to be infeasible or speeds above an already feasible candidate, leaving the smallest feasible speed at convergence.",
    },
    complexityRationale: "Each of O(log m) speed checks scans n piles, for O(n log m) time and O(1) auxiliary space.",
    edgeCases: [
      { description: "There is only one pile." },
      { description: "The hour budget allows exactly one hour per pile." },
      { description: "A pile size is not divisible by the tested speed." },
    ],
    alternatives: [
      { name: "Try every speed", tradeoff: "It preserves correctness but can require O(nm) time." },
    ],
    pitfalls: ["Using floor division instead of ceiling division.", "Returning an arbitrary feasible speed rather than the minimum."],
  }),
  guide("python:206", {
    approach: {
      summary: "Walk the list once, redirecting each next pointer toward the already reversed prefix.",
      steps: [
        "Initialize previous to null and current to the head.",
        "Save current.next before changing it.",
        "Point current.next to previous, then advance previous and current using the saved suffix.",
        "Return previous when current reaches null.",
      ],
      correctness: "Before each iteration, previous heads the correctly reversed processed prefix and current heads the untouched suffix. Redirecting current preserves that invariant for one more node; when the suffix is empty, previous heads the reversal of the entire list.",
    },
    complexityRationale: "Every node is processed once in O(n) time, and three pointer variables use O(1) extra space.",
    edgeCases: [
      { description: "The head is null." },
      { description: "The list has one node." },
      { description: "The list has several nodes whose original tail must become the head." },
    ],
    alternatives: [
      { name: "Recursive reversal", tradeoff: "It is compact but consumes O(n) call-stack space." },
    ],
    pitfalls: ["Overwriting next before saving the unreversed suffix.", "Returning current after it has advanced to null."],
  }),
  guide("python:21", {
    approach: {
      summary: "Build the merged chain behind a dummy node by repeatedly splicing the smaller current node.",
      steps: [
        "Create a dummy head and a tail pointer.",
        "While both lists remain, attach the node with the smaller current value and advance that list.",
        "Advance the merged tail after every attachment.",
        "Attach the entire remaining suffix and return dummy.next.",
      ],
      correctness: "The tail chain is sorted and contains exactly the consumed nodes. Choosing the smaller head is the smallest remaining value, preserving order; after either list ends, its counterpart is already sorted and can be appended whole.",
    },
    complexityRationale: "At most n + m nodes are examined or attached, giving O(n + m) time and O(1) new pointer storage.",
    edgeCases: [
      { description: "Either input list is null." },
      { description: "Values tie at the two current nodes." },
      { description: "One list is exhausted much earlier than the other." },
    ],
    alternatives: [
      { name: "Recursive merge", tradeoff: "It mirrors the recurrence but uses O(n + m) call-stack space in the worst case." },
    ],
    pitfalls: ["Returning the dummy node itself.", "Forgetting to append the remaining suffix."],
  }),
  guide("python:141", {
    approach: {
      summary: "Advance a slow pointer one link and a fast pointer two links; they meet exactly when traversal cycles.",
      steps: [
        "Initialize both pointers at the head.",
        "While the fast pointer and its next link exist, advance slow once and fast twice.",
        "Return true if the pointers become identical; otherwise return false when fast reaches the end.",
      ],
      correctness: "In an acyclic list, fast eventually reaches null. In a cyclic list, once both pointers are inside the cycle, fast gains one position per iteration modulo the cycle length and must meet slow.",
    },
    complexityRationale: "The pointers traverse O(n) links before termination or meeting and use O(1) extra space.",
    edgeCases: [
      { description: "The list is empty or has one non-cycling node." },
      { description: "A node points to itself." },
      { description: "The cycle begins after a non-cyclic prefix." },
    ],
    alternatives: [
      { name: "Visited-node set", tradeoff: "It is straightforward but consumes O(n) additional space." },
    ],
    pitfalls: ["Dereferencing fast.next without checking fast.", "Comparing node values instead of node identity."],
  }),
  guide("python:104", {
    approach: {
      summary: "Use an explicit depth-first stack of node-depth pairs and retain the largest depth encountered.",
      steps: [
        "Return the empty-tree depth when the root is null.",
        "Push the root with depth one.",
        "Pop a pair, update the maximum, and push each child with depth plus one.",
        "Return the maximum after the stack empties.",
      ],
      correctness: "Every reachable node is pushed with its root-to-node path length. Taking the maximum of those exact depths therefore yields the longest root-to-leaf node count.",
    },
    complexityRationale: "Each of n nodes is pushed and popped once, for O(n) time. The explicit DFS stack holds O(h) nodes along tree height in the intended traversal.",
    edgeCases: [
      { description: "The tree is empty." },
      { description: "The tree consists only of the root." },
      { description: "The tree is highly skewed." },
    ],
    alternatives: [
      { name: "Recursive depth", tradeoff: "It is concise but uses recursion depth proportional to tree height." },
      { name: "Level-order traversal", tradeoff: "It counts levels directly but may hold an entire wide level." },
    ],
    pitfalls: ["Starting root depth at zero when depth counts nodes.", "Ignoring one child branch."],
  }),
  guide("python:98", {
    approach: {
      summary: "Validate every node against strict bounds inherited from all of its ancestors.",
      steps: [
        "Start the root with unbounded lower and upper limits.",
        "Reject any node whose value is not strictly inside its limits.",
        "Validate the left subtree with the node value as its new upper bound.",
        "Validate the right subtree with the node value as its new lower bound.",
      ],
      correctness: "Inherited bounds encode every ancestor constraint, not just the parent relation. A node passes exactly when it can belong at that position, and both recursively valid subtrees establish the BST property for the whole tree.",
    },
    complexityRationale: "Each node is checked once in O(n) time, and recursion stores O(h) frames for tree height.",
    edgeCases: [
      { description: "The tree is empty." },
      { description: "A descendant violates an ancestor bound while satisfying its parent relation." },
      { description: "A duplicate equals a bound and must be rejected." },
    ],
    alternatives: [
      { name: "In-order traversal", tradeoff: "Checking for a strictly increasing sequence is equally valid but manages previous-state explicitly." },
    ],
    pitfalls: ["Checking only immediate children.", "Using inclusive bounds and accepting duplicates."],
  }),
  guide("python:102", {
    approach: {
      summary: "Process a FIFO queue in fixed-size batches, one batch per tree depth.",
      steps: [
        "Return an empty result for a null root; otherwise enqueue the root.",
        "Capture the current queue length before processing a level.",
        "Dequeue exactly that many nodes, recording values and enqueuing their children.",
        "Append the completed level and repeat.",
      ],
      correctness: "At the start of each outer iteration, the queue contains exactly one depth. Consuming its fixed original length records that level, while enqueued children form exactly the next depth for the following iteration.",
    },
    complexityRationale: "Every node is enqueued and dequeued once, for O(n) time; the queue holds at most the tree width w, so auxiliary space is O(w).",
    edgeCases: [
      { description: "The root is null." },
      { description: "The tree has one node." },
      { description: "The final level is sparse." },
    ],
    alternatives: [
      { name: "DFS with depth-indexed lists", tradeoff: "It can build the same grouping but uses recursive height state instead of a queue." },
    ],
    pitfalls: ["Letting newly enqueued children extend the current level loop.", "Appending one list per node instead of per depth."],
  }),
  guide("python:215", {
    approach: {
      summary: "Maintain a min-heap of the k largest values seen, with its root representing the current kth largest.",
      steps: [
        "Initialize an empty min-heap.",
        "Push every number into the heap.",
        "Whenever the heap exceeds k elements, remove its smallest value.",
        "Return the heap root after the scan.",
      ],
      correctness: "After each input prefix, the heap contains that prefix's largest min(k, prefix length) values. Removing the smallest whenever size exceeds k preserves exactly the top k, whose smallest member is the kth largest overall.",
    },
    complexityRationale: "Each of n values performs a heap operation bounded by k elements, for O(n log k) time and O(k) space.",
    edgeCases: [
      { description: "k is one, asking for the maximum." },
      { description: "k equals the array length, asking for the minimum." },
      { description: "Duplicate values occupy multiple ranking positions." },
    ],
    alternatives: [
      { name: "Sort all values", tradeoff: "Sorting is simpler but costs O(n log n) time and stores the full order." },
    ],
    pitfalls: ["Using a max-heap and returning the wrong rank.", "Deduplicating values even though duplicates count."],
  }),
  guide("python:347", {
    approach: {
      summary: "Count every value, then keep only the k strongest frequency-value pairs in a min-heap.",
      steps: [
        "Build a frequency counter for the input values.",
        "Push each frequency-value pair into a min-heap.",
        "When heap size exceeds k, pop its weakest pair.",
        "Return the values retained in the heap.",
      ],
      correctness: "After every distinct value is considered, the heap retains the k largest comparison pairs seen so far. Since the problem's frequency boundary is unambiguous, those retained values are exactly the k most frequent elements.",
    },
    complexityRationale: "Counting n values is O(n); processing u distinct values in a k-sized heap costs O(u log k), with O(u + k) stored state.",
    edgeCases: [
      { description: "k equals the number of distinct values." },
      { description: "One value dominates the frequency counts." },
      { description: "Input values include negatives." },
    ],
    alternatives: [
      { name: "Frequency buckets", tradeoff: "Buckets can achieve O(n) time but allocate a count-indexed collection." },
    ],
    pitfalls: ["Heapifying raw values instead of frequency pairs.", "Returning frequencies rather than their values."],
  }),
  guide("python:56", {
    approach: {
      summary: "Sort intervals by start and merge each interval only against the last completed range.",
      steps: [
        "Return early for no intervals, otherwise sort by starting endpoint.",
        "Seed the merged list with a copy of the first interval.",
        "If the next start is within the last merged end, extend that end to the larger endpoint.",
        "Otherwise append a new disjoint interval.",
      ],
      correctness: "Sorted starts ensure an incoming interval cannot overlap any merged interval except the last one. Extending the last end takes the exact union on overlap; appending otherwise preserves sorted, disjoint coverage.",
    },
    complexityRationale: "Sorting dominates at O(n log n), followed by a linear merge; the returned merged intervals require O(n) space in the worst case.",
    edgeCases: [
      { description: "The interval list is empty." },
      { description: "Intervals touch at an endpoint and count as overlapping." },
      { description: "One interval fully contains another." },
    ],
    alternatives: [],
    pitfalls: ["Failing to sort before merging.", "Appending references and unintentionally mutating caller-owned interval objects."],
  }),
  guide("python:57", {
    approach: {
      summary: "Exploit sorted disjoint input with three phases: copy intervals before the new one, coalesce overlaps, then copy the remainder.",
      steps: [
        "Append every interval ending before the new interval starts.",
        "While intervals overlap the evolving new interval, replace its bounds with their union.",
        "Append the fully merged new interval.",
        "Append all intervals beginning after it.",
      ],
      correctness: "Phase one contains only disjoint earlier ranges. Phase two absorbs every and only overlapping range into one exact union; sorted order then guarantees all remaining intervals are disjoint and later, so the final sequence is sorted and complete.",
    },
    complexityRationale: "Each existing interval is examined once, for O(n) time. The required result uses O(n) space.",
    edgeCases: [
      { description: "The existing list is empty." },
      { description: "The new interval belongs before or after every existing interval." },
      { description: "The new interval bridges several consecutive intervals." },
    ],
    alternatives: [
      { name: "Append then run general merge", tradeoff: "It reuses Merge Intervals but adds an O(n log n) sort that the ordered input makes unnecessary." },
    ],
    pitfalls: ["Using strict overlap tests that mishandle touching endpoints.", "Appending the new interval more than once."],
  }),
  guide("python:200", {
    approach: {
      summary: "Treat every unseen land cell as a new component and flood-fill it so it cannot be counted again.",
      steps: [
        "Scan every grid position.",
        "When land is found, increment the island count and seed a traversal worklist.",
        "Mark each discovered land cell as visited and add its valid orthogonal land neighbors.",
        "Continue scanning after the whole component is exhausted.",
      ],
      correctness: "A traversal begins exactly once per connected land component: it marks all cells reachable within that component, and no water or separate component is marked. Consequently later scanning counts each island once.",
    },
    complexityRationale: "Each grid cell is scanned and each land cell is processed at most once, for O(rows · columns) time and the same worst-case worklist space.",
    edgeCases: [
      { description: "The grid contains no land." },
      { description: "All cells form one island." },
      { description: "Land touches only diagonally and remains in separate components." },
    ],
    alternatives: [
      { name: "Recursive DFS", tradeoff: "It is concise but risks deep recursion on a large component." },
    ],
    pitfalls: ["Counting diagonal adjacency.", "Marking visited only when removing from the worklist and adding duplicates."],
  }),
  guide("python:207", {
    approach: {
      summary: "Use Kahn's topological process: repeatedly take zero-prerequisite courses and remove their outgoing requirements.",
      steps: [
        "Build adjacency lists and indegree counts from prerequisite pairs.",
        "Queue every course whose indegree is zero.",
        "Remove queued courses, count them, and decrement each dependent course's indegree.",
        "Queue dependents that reach zero and finally compare the processed count with the course count.",
      ],
      correctness: "Only courses with no remaining prerequisites enter the order. Removing one models completing it; an acyclic graph eventually exposes all vertices, while a cycle keeps every member at positive indegree and makes the processed count smaller.",
    },
    complexityRationale: "Building and consuming the graph touches every vertex and edge a constant number of times, for O(V + E) time and space.",
    edgeCases: [
      { description: "There are no prerequisite pairs." },
      { description: "A direct or longer prerequisite cycle exists." },
      { description: "Several independent prerequisite chains coexist." },
    ],
    alternatives: [
      { name: "DFS color states", tradeoff: "Detecting a back edge is also O(V + E) but uses recursion or an explicit traversal-state stack." },
    ],
    pitfalls: ["Reversing prerequisite edge direction while updating indegrees.", "Checking whether the queue is empty instead of whether all courses were processed."],
  }),
  guide("python:39", {
    approach: {
      summary: "Backtrack through sorted candidates in nondecreasing index order, reusing a chosen value while a positive remainder remains.",
      steps: [
        "Sort candidates and start with an empty path.",
        "From the current start index, try each candidate not exceeding the remaining target.",
        "Append a choice and recurse from the same index so it may be reused.",
        "Record a copy when the remainder reaches zero, and pop each choice during backtracking.",
      ],
      correctness: "Nondecreasing candidate indices give every multiset combination one canonical order. Reusing the same index covers arbitrary allowed repetitions, advancing the loop covers all possible next values, and sorted pruning discards only values already too large.",
    },
    complexityRationale: "The search is output-sensitive and exponential because many partial combinations may be explored. A path contains at most target / min(candidate) choices, which bounds recursion space apart from output.",
    edgeCases: [
      { description: "One candidate alone reaches the target." },
      { description: "A candidate must be reused several times." },
      { description: "No candidate combination reaches the target." },
    ],
    alternatives: [
      { name: "Fresh path per call", tradeoff: "Passing path + [choice] avoids explicit popping but allocates more intermediate lists." },
    ],
    pitfalls: ["Recursing from the next index and accidentally forbidding reuse.", "Appending the mutable path without copying it.", "Using sorted early stopping before sorting."],
  }),
  guide("python:79", {
    approach: {
      summary: "Try each cell as a start and backtrack through orthogonal neighbors while marking the current path in place.",
      steps: [
        "Start a search from every board cell at word position zero.",
        "Reject out-of-bounds cells or a character mismatch; succeed after matching all characters.",
        "Temporarily mark a matched cell so the current path cannot reuse it.",
        "Explore its four neighbors for the next character, then restore the cell before returning.",
      ],
      correctness: "Marked cells are exactly the current path, so every explored route obeys the no-reuse rule. The recursion considers every legal orthogonal continuation from every start, and restoration keeps branches independent; therefore it succeeds exactly for an existing word path.",
    },
    complexityRationale: "There are rows · columns starts and at most about three onward choices per matched position, giving O(rows · columns · 3^L) time and O(L) recursion space.",
    edgeCases: [
      { description: "A one-character word matches a single cell." },
      { description: "A tempting path would need to reuse a cell." },
      { description: "The word must be traced in reverse grid direction." },
    ],
    alternatives: [
      { name: "Visited set", tradeoff: "It avoids modifying the board but adds per-path membership state." },
    ],
    pitfalls: ["Forgetting to restore a marked cell.", "Allowing diagonal movement.", "Reading a cell before checking its bounds."],
  }),
  guide("python:55", {
    approach: {
      summary: "Summarize all reachable jump paths with the farthest index any processed reachable position can attain.",
      steps: [
        "Initialize the farthest reachable index to the starting position.",
        "Scan indices from left to right and fail if an index lies beyond farthest.",
        "Extend farthest with the current index plus its jump length.",
        "Succeed once farthest reaches the final index or the scan completes.",
      ],
      correctness: "Farthest is the maximum endpoint offered by every processed reachable index. If the next index exceeds it, no earlier path crosses that gap; if it reaches the last index, one processed jump path reaches the goal.",
    },
    complexityRationale: "A single scan performs constant work per index, for O(n) time and O(1) state.",
    edgeCases: [
      { description: "A one-position array is already at the goal." },
      { description: "A zero creates an uncrossable gap." },
      { description: "Trailing zeroes are still reachable through an earlier long jump." },
    ],
    alternatives: [],
    pitfalls: ["Greedily committing to one exact jump rather than tracking reach.", "Extending reach from an index that is itself unreachable."],
  }),
  guide("python:70", {
    approach: {
      summary: "Evaluate the one-step/two-step recurrence with two rolling counts.",
      steps: [
        "Represent the counts for steps zero and one with the initial rolling pair.",
        "For each later step, add the preceding two counts.",
        "Shift the pair so it again represents the latest two steps.",
        "Return the count associated with step n.",
      ],
      correctness: "Every route to step i ends uniquely with a move from i - 1 or i - 2, so their counts add. The rolling pair starts with correct base cases and preserves this recurrence, proving the returned value by induction.",
    },
    complexityRationale: "The loop performs O(n) constant-time additions and retains only two counts, so auxiliary space is O(1).",
    edgeCases: [
      { description: "n is the smallest allowed stair count." },
      { description: "The answer uses both one-step and two-step endings." },
      { description: "A larger n exercises repeated rolling updates." },
    ],
    alternatives: [
      { name: "DP array", tradeoff: "It stores every intermediate count and therefore uses O(n) space for the same recurrence." },
    ],
    pitfalls: ["Using an incorrect count for step zero.", "Overwriting one old count before computing their sum."],
  }),
  guide("python:198", {
    approach: {
      summary: "For each house, retain only the optimal totals for the preceding prefix and the prefix two houses back.",
      steps: [
        "Initialize the two prior best totals to zero.",
        "For each value, compare skipping it with taking it plus the two-back total.",
        "Shift the rolling pair using the newly chosen optimum.",
        "Return the best total for the complete prefix.",
      ],
      correctness: "An optimal selection either excludes the current house, keeping the previous optimum, or includes it, forcing the adjacent house out and adding to the two-back optimum. These cases are exhaustive, so their maximum preserves optimality at every prefix.",
    },
    complexityRationale: "Each house produces one constant-time update, giving O(n) time and O(1) extra space.",
    edgeCases: [
      { description: "There are no houses." },
      { description: "The locally largest adjacent value is not part of the global optimum." },
      { description: "The best selection includes both boundary houses." },
    ],
    alternatives: [
      { name: "DP array", tradeoff: "A full prefix table makes states visible but uses O(n) rather than constant space." },
    ],
    pitfalls: ["Adding the current value to the immediately previous optimum.", "Updating rolling variables in an order that loses the two-back value."],
  }),
  guide("python:208", {
    approach: {
      summary: "Represent inserted text as character paths from a root, with a separate terminal flag for complete words.",
      steps: [
        "Create a root whose children map characters to trie nodes.",
        "On insertion, follow or create one child for every character and mark the final node as a word.",
        "For lookup, follow the requested path and fail when a child is missing.",
        "Exact search also requires the final node's word flag; prefix search only requires the path.",
      ],
      correctness: "After consuming each character, the current node represents exactly that prefix. Thus path existence characterizes stored prefixes, while the terminal flag distinguishes prefixes that were actually inserted as complete words.",
    },
    complexityRationale: "Each operation performs one expected dictionary lookup per character, for O(L) time. Space is bounded by the total number of distinct inserted-prefix characters.",
    edgeCases: [
      { description: "A path exists only as a prefix, not as a complete inserted word." },
      { description: "The same word is inserted more than once." },
      { description: "Several words branch after a shared prefix." },
    ],
    alternatives: [
      { name: "Fixed child arrays", tradeoff: "They provide direct alphabet indexing but reserve every child slot at every node." },
    ],
    pitfalls: ["Treating every reachable node as a complete word.", "Sharing one children map across node instances."],
  }),
  guide("python:212", {
    approach: {
      summary: "Search all dictionary words together by combining trie-prefix pruning with board backtracking.",
      steps: [
        "Insert each candidate word into a trie and store the word at its terminal node.",
        "Start DFS from every board cell and stop when its character has no child in the current trie node.",
        "Emit and clear a terminal word, then mark the current cell and explore four neighbors.",
        "Restore the cell and prune a trie branch only after it contains neither a word nor children.",
      ],
      correctness: "Every DFS state pairs a trie prefix with a non-repeating board path spelling it, so terminals are valid findings. Every legal path sharing a dictionary prefix is explored; clearing terminals prevents duplicates, and only exhausted branches are pruned.",
    },
    complexityRationale: "Trie construction is proportional to total word characters. The stated worst-case board search is O(rows · columns · 4^L), with O(L) traversal stack plus trie storage.",
    edgeCases: [
      { description: "One word can be spelled along multiple board paths but must appear once." },
      { description: "A candidate would require reusing a cell." },
      { description: "Words share long prefixes before branching." },
    ],
    alternatives: [
      { name: "Search each word separately", tradeoff: "It is simpler but repeats work for shared prefixes." },
    ],
    pitfalls: ["Failing to restore cells.", "Clearing or pruning a trie node before all descendant words are handled.", "Emitting the same terminal repeatedly."],
  }),
  guide("python:684", {
    approach: {
      summary: "Use disjoint-set connectivity in edge order; the edge whose endpoints already share a root closes the cycle.",
      steps: [
        "Initialize each labeled node as its own component.",
        "Find both endpoint roots with path compression.",
        "Return the current edge if the roots already match.",
        "Otherwise union the smaller component beneath the larger one.",
      ],
      correctness: "Before an edge, DSU roots exactly represent connectivity through earlier edges. Equal roots mean an existing path already joins the endpoints, so this edge creates the cycle; different roots mean union safely extends the forest.",
    },
    complexityRationale: "Path compression and union by size make the complete edge processing O(n α(n)) time, with O(n) parent and size arrays.",
    edgeCases: [
      { description: "The extra edge completes a three-node cycle." },
      { description: "The cycle does not include the smallest-labeled node." },
      { description: "The cycle-closing edge appears late after other tree growth." },
    ],
    alternatives: [
      { name: "Repeated graph search", tradeoff: "Searching for an existing path before every insertion is correct but recomputes connectivity." },
    ],
    pitfalls: ["Comparing immediate parents instead of roots.", "Allocating arrays without space for one-based labels."],
  }),
  guide("python:1579", {
    approach: {
      summary: "Build Alice's and Bob's connectivity with shared edges first, then add exclusive edges and count only unions that contribute.",
      steps: [
        "Initialize a separate DSU for each traveler.",
        "Process type-three edges first in both DSUs, counting a retained shared edge once when it contributes.",
        "Process Alice-only and Bob-only edges in their respective DSUs, counting successful unions.",
        "If either traveler remains disconnected, return failure; otherwise subtract retained edges from the total.",
      ],
      correctness: "Failed unions are redundant because their endpoints are already connected. Shared-first processing extracts every connection that one retained edge can supply to both travelers before exclusive edges are considered; final single components prove the retained set suffices for each.",
    },
    complexityRationale: "Every edge performs at most two amortized near-constant DSU operations, for O(E α(n)) time and O(n) total DSU space.",
    edgeCases: [
      { description: "One traveler cannot become fully connected." },
      { description: "A useful shared edge makes later exclusive edges redundant." },
      { description: "Shared edges themselves contain a cycle." },
    ],
    alternatives: [
      { name: "Clone a shared forest", tradeoff: "Build one shared DSU then copy its state for the exclusive passes; the greedy principle is unchanged." },
    ],
    pitfalls: ["Processing exclusive edges before shared edges.", "Counting one retained shared edge twice.", "Checking connectivity for only one traveler."],
  }),
  guide("python:743", {
    approach: {
      summary: "Run Dijkstra from the signal source, then take the largest finalized shortest arrival time.",
      steps: [
        "Build directed weighted adjacency lists and initialize only the source distance to zero.",
        "Pop the smallest distance-node pair from a min-heap and ignore stale entries.",
        "Relax each outgoing edge, recording and pushing any shorter arrival.",
        "Return failure if a real node stays unreachable; otherwise return the maximum recorded distance.",
      ],
      correctness: "Positive weights make a current-distance heap pop the shortest possible arrival for that node. Relaxation considers every extension of those shortest routes, so all reachable distances become optimal; their maximum is when the last node receives the signal.",
    },
    complexityRationale: "Graph construction plus heap relaxation costs O((V + E) log V) time, while adjacency, distances, and queued candidates occupy O(V + E) space.",
    edgeCases: [
      { description: "The source is the only node." },
      { description: "At least one node is unreachable." },
      { description: "A later-discovered route makes an older heap entry stale." },
    ],
    alternatives: [],
    pitfalls: ["Using unweighted BFS on weighted edges.", "Including the unused zero index when checking distances.", "Summing shortest distances instead of taking their maximum."],
  }),
  guide("python:332", {
    approach: {
      summary: "Construct the ticket-using Eulerian route with lexical edge consumption and postorder insertion.",
      steps: [
        "Reverse-sort tickets into per-origin destination lists.",
        "Starting at JFK, repeatedly pop the smallest available destination and recurse.",
        "Append an airport only after all of its outgoing tickets have been consumed.",
        "Reverse the postorder sequence to obtain the itinerary.",
      ],
      correctness: "Every ticket is removed and used exactly once. Postorder appends dead ends after their reachable edges, correctly splicing cycles into one Eulerian path; lexical edge order produces the smallest valid itinerary under the guaranteed existence contract.",
    },
    complexityRationale: "Sorting E tickets costs O(E log E), traversal removes each once, and adjacency, recursion, and route storage use O(E) space.",
    edgeCases: [
      { description: "The lexically smallest immediate destination would be a premature dead end." },
      { description: "Duplicate endpoint tickets remain distinct resources." },
      { description: "The itinerary contains a cycle returning to an earlier airport." },
    ],
    alternatives: [
      { name: "Per-origin min-heaps", tradeoff: "They also supply lexical edges, replacing reverse-sort-and-pop with heap operations." },
    ],
    pitfalls: ["Appending on entry instead of postorder.", "Using a set and losing duplicate tickets.", "Greedily walking without Eulerian backtracking."],
  }),
  guide("python:778", {
    approach: {
      summary: "Use minimax Dijkstra, where entering a cell changes path cost to the larger of the current cost and that cell's elevation.",
      steps: [
        "Seed a min-heap with the start cell and its elevation.",
        "Pop the reachable cell with the smallest path maximum.",
        "Return that cost when the destination is popped.",
        "For each unseen orthogonal neighbor, push the maximum of current cost and neighbor elevation.",
      ],
      correctness: "Heap order selects the path with least maximum elevation. When a cell is popped, no remaining route can offer it a smaller maximum; therefore the destination's popped cost is the minimum water level supporting a complete path.",
    },
    complexityRationale: "At most n² cells are queued and heap operations cost O(log n²), giving O(n² log n) time and O(n²) space.",
    edgeCases: [
      { description: "The grid has one cell." },
      { description: "The starting cell itself sets a high lower bound." },
      { description: "A longer geometric route avoids a higher elevation." },
    ],
    alternatives: [
      { name: "Level binary search", tradeoff: "Binary-search water level and run reachability at each candidate threshold." },
    ],
    pitfalls: ["Adding elevations rather than taking their maximum.", "Starting path cost below the start elevation.", "Returning when the destination is merely discovered."],
  }),
  guide("python:371", {
    approach: {
      summary: "Emulate fixed-width addition using XOR for carry-free bits and shifted AND for carries.",
      steps: [
        "Mask both inputs into unsigned 32-bit representations.",
        "While carry bits remain, compute the shifted masked carry from AND.",
        "Replace the partial sum with masked XOR and continue with the carry.",
        "Interpret the final bit pattern as a signed two's-complement integer.",
      ],
      correctness: "XOR gives the bit sum excluding carries, while shifted AND gives exactly the carry destinations, preserving the represented total each round. Carries eventually vanish within 32 bits, and signed conversion interprets the resulting pattern correctly.",
    },
    complexityRationale: "At most 32 fixed-width carry rounds occur, so both time and auxiliary space are O(1).",
    edgeCases: [
      { description: "Both inputs are negative." },
      { description: "Equal-magnitude opposite signs cancel." },
      { description: "A carry propagates across several consecutive set bits." },
    ],
    alternatives: [],
    pitfalls: ["Omitting masks with Python's unbounded signed integers.", "Overwriting operands before calculating carry.", "Returning an unsigned interpretation of a negative pattern."],
  }),
  guide("python:201", {
    approach: {
      summary: "Remove the changing low-order suffix until the range endpoints share only their common binary prefix.",
      steps: [
        "Initialize a shift count to zero.",
        "While the endpoints differ, right-shift both and increment the count.",
        "Treat their equal value as the common high-order prefix.",
        "Shift that prefix back left, filling the varying suffix with zeroes.",
      ],
      correctness: "Every bit below the common prefix changes somewhere in the inclusive range and must be zero in the total AND. Common-prefix bits never change across the range and survive, so restoring exactly that prefix yields the result.",
    },
    complexityRationale: "At most the bit length of right shifts are needed, for O(log right) time and O(1) space.",
    edgeCases: [
      { description: "The endpoints are equal." },
      { description: "The range begins at zero." },
      { description: "The range crosses a power-of-two boundary and loses its former high bits." },
    ],
    alternatives: [
      { name: "Clear rightmost set bits", tradeoff: "Repeatedly clearing right's lowest set bit until it no longer exceeds left reaches the same prefix." },
    ],
    pitfalls: ["Enumerating the whole range.", "Forgetting to shift the shared prefix back.", "Applying this nonnegative-endpoint reasoning to negative ranges."],
  }),
  guide("python:1143", {
    approach: {
      summary: "Compute longest common subsequence lengths for suffix pairs with two rolling rows.",
      steps: [
        "Use the shorter string for the row dimension and initialize the exhausted-suffix row to zeroes.",
        "Process both strings from right to left.",
        "On equal characters, store one plus the diagonal suffix result.",
        "Otherwise store the better result from discarding either leading character, then promote the row.",
      ],
      correctness: "Matching leaders can extend an optimal subsequence of both remaining suffixes. When leaders differ, any common subsequence omits at least one, so the maximum of the two one-sided suffix states is optimal; reverse fill order makes every dependency available.",
    },
    complexityRationale: "All m·n suffix pairs are evaluated in O(mn) time, and two rows over the shorter string use O(min(m, n)) space.",
    edgeCases: [
      { description: "The strings are identical." },
      { description: "They share no character." },
      { description: "Repeated characters create several possible alignments." },
    ],
    alternatives: [
      { name: "Full DP table", tradeoff: "It exposes every state and supports reconstruction, but uses O(mn) space." },
    ],
    pitfalls: ["Solving common substring instead of subsequence.", "Filling a rolling row in a direction that overwrites dependencies."],
  }),
  guide("python:72", {
    approach: {
      summary: "Use suffix dynamic programming: matching leaders advance free, while a mismatch pays for the best insert, delete, or replace continuation.",
      steps: [
        "Initialize the exhausted-source row with the insertions needed for each target suffix.",
        "Process source positions from right to left, setting the exhausted-target column to required deletions.",
        "Copy the diagonal result when current characters match.",
        "Otherwise store one plus the minimum of insertion, deletion, and replacement neighbor states.",
      ],
      correctness: "The base states exactly measure conversion to or from an empty suffix. A mismatch's first edit must be one of the three allowed operations, so minimizing their complete subproblems is optimal; a match needs no edit and reduces to both tails.",
    },
    complexityRationale: "Every source-target suffix pair is evaluated once for O(mn) time, while two target-length rows require O(n) space.",
    edgeCases: [
      { description: "Either input string is empty." },
      { description: "The strings are already identical." },
      { description: "The optimum mixes insertion, deletion, and replacement decisions." },
    ],
    alternatives: [
      { name: "Full DP table", tradeoff: "It is easier to inspect and can reconstruct edits, but uses O(mn) space." },
    ],
    pitfalls: ["Charging an edit for matching characters.", "Confusing insertion and deletion neighbor states.", "Treating transposition as an allowed one-step edit."],
  }),
  guide("python:115", {
    approach: {
      summary: "Count target-prefix constructions while scanning source characters, updating target lengths backward so one source position is used at most once.",
      steps: [
        "Initialize one way to build the empty target and zero ways for nonempty prefixes.",
        "Process source characters from left to right.",
        "Iterate target lengths backward.",
        "When characters match, add the shorter-prefix count into the current target-prefix count.",
      ],
      correctness: "Existing counts represent skipping the new source character. A match additionally extends every prior construction of the shorter target prefix; backward iteration reads those counts before this source character changes them, preventing reuse.",
    },
    complexityRationale: "Every source character considers every target position, for O(mn) time and O(n) target-row space.",
    edgeCases: [
      { description: "The target is empty and has one index selection." },
      { description: "The target is longer than the source." },
      { description: "Repeated source characters create many distinct index selections." },
    ],
    alternatives: [
      { name: "Two-dimensional DP", tradeoff: "It states the same skip-or-use recurrence explicitly but uses O(mn) space." },
    ],
    pitfalls: ["Updating target positions forward and reusing a source character.", "Replacing the old skip count instead of adding the use count.", "Counting distinct strings rather than distinct index selections."],
  }),
  guide("transfer:20001", {
    approach: {
      summary: "Use earliest prefix-sum positions to find the longest segment whose total equals the target.",
      steps: [
        "Store prefix total zero at the virtual index before the array.",
        "Scan while updating the running total and look up running total minus target.",
        "Evaluate the inclusive segment after that earlier prefix when it exists.",
        "Replace the best only for greater length or the required earlier-start tie break.",
        "Record each running total only at its first occurrence.",
      ],
      correctness: "A segment ending at the current index has target sum exactly when the preceding prefix is current total minus target. Its earliest occurrence maximizes that ending segment; checking every end and applying the tie rule produces the global answer.",
    },
    complexityRationale: "One expected O(1) lookup and first-insertion per value gives O(n) expected time and O(n) prefix-map space.",
    edgeCases: [
      { description: "The input is empty or no nonempty target-sum segment exists." },
      { description: "Target zero creates repeated running totals." },
      { description: "Negative values invalidate a sliding-window assumption but not prefix sums." },
      { description: "Equal-length candidates require the earlier start." },
    ],
    alternatives: [
      { name: "Enumerate segments", tradeoff: "Accumulating every start-end pair is correct but costs O(n²) time." },
    ],
    pitfalls: ["Overwriting the earliest prefix index.", "Omitting the prefix at virtual index -1.", "Accepting an empty segment for target zero."],
  }),
  guide("transfer:20002", {
    approach: {
      summary: "Sweep endpoints inward on the sorted costs, retaining the strongest feasible distinct-position pair.",
      steps: [
        "Start one pointer at each end with no best pair.",
        "If the endpoint sum exceeds the budget, move the right pointer left.",
        "Otherwise update only when its total strictly improves the best, then move left rightward.",
        "Return the retained pair after the pointers meet.",
      ],
      correctness: "An over-budget right endpoint cannot pair feasibly with any remaining larger left choice, while a feasible pair uses the largest partner available for that left endpoint. Thus every endpoint is safely exhausted, and strict updates preserve the earlier lexicographic pair on equal totals.",
    },
    complexityRationale: "Each pointer moves at most n positions, so time is O(n) with O(1) auxiliary state.",
    edgeCases: [
      { description: "No distinct-position pair fits the budget." },
      { description: "Costs contain duplicate values." },
      { description: "Negative costs or a negative budget are present." },
      { description: "Several pairs share the best feasible total." },
    ],
    alternatives: [
      { name: "All pairs", tradeoff: "It needs no sorted-order reasoning but costs O(n²) time." },
    ],
    pitfalls: ["Allowing both pointers to select the same position.", "Moving left when over budget.", "Replacing the first pair on an equal total."],
  }),
  guide("transfer:20003", {
    approach: {
      summary: "Maintain a counted sliding window and shrink only until its distinct event labels fit the limit.",
      steps: [
        "Reject an empty input or nonpositive limit with the no-run result.",
        "Extend right and increment that event's frequency.",
        "While distinct labels exceed the limit, decrement from left and delete zero-count keys.",
        "Compare the restored valid window with the best, updating only on a strict length gain.",
      ],
      correctness: "After shrinking, the map exactly describes a valid window, and any earlier left boundary would remain invalid. It is therefore the longest valid window ending at this right boundary; checking all right boundaries finds the global maximum and strict updates preserve the earliest tie.",
    },
    complexityRationale: "Each event enters and leaves once, giving O(n) expected time; the frequency map uses O(k) space for allowed varieties after restoration.",
    edgeCases: [
      { description: "Events are empty or the limit is nonpositive." },
      { description: "The limit exceeds the total number of distinct labels." },
      { description: "Removing the leftmost copy reduces one count to zero." },
      { description: "A later run ties the earliest best length." },
    ],
    alternatives: [
      { name: "Try every start", tradeoff: "Extending each start until invalid is simpler but can take O(n²) time." },
    ],
    pitfalls: ["Leaving zero-count keys in the map.", "Shrinking only once when several removals are required.", "Replacing the earlier best on a tie."],
  }),
  guide("transfer:20004", {
    approach: {
      summary: "Compress surviving character runs on a stack and remove a run immediately when it reaches the collapse size.",
      steps: [
        "For each character, extend the matching top run or push a new run of one.",
        "Pop the top as soon as its count reaches the removal size.",
        "Continue scanning so characters after a removal can join an exposed earlier run.",
        "Expand the surviving run-count pairs into the result string.",
      ],
      correctness: "After each character, the stack encodes the fully collapsed processed prefix. Extending, pushing, or removing its final run maintains that representation; a pop exposes exactly the suffix needed for a later cascade.",
    },
    complexityRationale: "Each input character is incorporated and removed at most once, and reconstruction is linear, for O(n) time and O(n) stack/output space.",
    edgeCases: [
      { description: "The text is empty." },
      { description: "No run reaches the removal size." },
      { description: "A removal exposes matching runs that later merge." },
      { description: "A long run produces repeated exact-size collapses while scanning." },
    ],
    alternatives: [
      { name: "Repeated full scans", tradeoff: "Deleting qualifying runs until stable is direct but can take O(n²) time." },
    ],
    pitfalls: ["Waiting until a run ends before applying removal.", "Failing to reconstruct each survivor count.", "Missing merges with an exposed earlier run."],
  }),
  guide("transfer:20005", {
    approach: {
      summary: "Binary-search the smallest capacity whose greedy ordered packing uses no more than the allowed days.",
      steps: [
        "Search capacities from the heaviest item through the total weight.",
        "For a candidate, greedily fill each ordered batch until the next item would overflow it.",
        "If the resulting batch count fits the days, retain the candidate and search lower.",
        "Otherwise discard it and all smaller capacities, then return the converged boundary.",
      ],
      correctness: "Greedily filling each batch cannot use more batches than closing it earlier. Capacity feasibility is monotone, and the initial bounds are necessary and sufficient, so lower-bound binary search converges to the minimum feasible capacity.",
    },
    complexityRationale: "Each candidate check scans n weights and O(log S) candidates are tested, for O(n log S) time and O(1) space where S is total weight.",
    edgeCases: [
      { description: "All items must fit in one day." },
      { description: "The schedule allows one item per day." },
      { description: "One item determines the minimum capacity lower bound." },
    ],
    alternatives: [
      { name: "Linear capacity search", tradeoff: "It uses the same feasibility check but may test every capacity in a wide range." },
    ],
    pitfalls: ["Reordering weights.", "Searching below the maximum single weight.", "Treating an exact capacity fill as overflow."],
  }),
  guide("transfer:20006", {
    approach: {
      summary: "Sum one BFS level at a time and keep the shallowest depth whose sum is greatest.",
      steps: [
        "Return the empty-tree marker for a null root and otherwise queue the root.",
        "Capture the queue length and consume exactly that many nodes for one level sum.",
        "Enqueue their children for the next level.",
        "Update the best depth only when the sum is strictly greater.",
      ],
      correctness: "Each captured batch is exactly one depth, so every level sum is complete and evaluated once. Strict improvement records the first, hence shallowest, depth among equal maximum sums.",
    },
    complexityRationale: "Every node is queued once for O(n) time, and the queue holds at most the maximum tree width w for O(w) space.",
    edgeCases: [
      { description: "The tree is empty." },
      { description: "All level sums are negative." },
      { description: "Two depths tie for the maximum sum." },
      { description: "The tree is skewed to one side." },
    ],
    alternatives: [
      { name: "Depth-first accumulation", tradeoff: "DFS can build one sum per depth, but retains totals for all levels before selecting." },
    ],
    pitfalls: ["Initializing the best sum to zero.", "Including newly queued children in the current level.", "Updating on greater-than-or-equal and losing the shallowest tie."],
  }),
  guide("transfer:20007", {
    approach: {
      summary: "Build an undirected graph and use BFS so the target's first discovery has the fewest relay links.",
      steps: [
        "Return zero immediately when start and target are the same station.",
        "Add both directions of every link to adjacency lists.",
        "Queue the start at distance zero and mark it seen.",
        "Explore neighbors in FIFO order, returning on target discovery and enqueueing unseen stations one hop farther.",
        "Return failure if the queue empties first.",
      ],
      correctness: "BFS processes stations by nondecreasing hop distance, so first discovery assigns every station its shortest distance. Undirected adjacency represents every allowed relay traversal, making the target's first discovery globally minimum.",
    },
    complexityRationale: "Graph construction and traversal touch each vertex and edge a constant number of times, for O(V + E) expected time and O(V + E) stored graph and traversal state.",
    edgeCases: [
      { description: "Start and target are identical even when absent from links." },
      { description: "The target is directly linked." },
      { description: "The endpoints are in disconnected components." },
      { description: "Cycles, duplicate links, or self-links are present." },
    ],
    alternatives: [
      { name: "Exhaustive DFS", tradeoff: "It can enumerate routes but its first route is not guaranteed shortest." },
    ],
    pitfalls: ["Adding only one direction of each link.", "Marking seen after dequeue and allowing duplicates.", "Forgetting the identical-endpoint shortcut."],
  }),
  guide("transfer:20008", {
    approach: {
      summary: "Heapify one frontier value per sorted stream and advance only the stream that supplies the next output.",
      steps: [
        "Push the first value, stream index, and offset for every nonempty stream.",
        "While the heap is nonempty and the result is below the limit, pop its smallest frontier.",
        "Append that value and push the following value from the same stream if one exists.",
        "Return the ordered prefix when either stopping condition is reached.",
      ],
      correctness: "Every value behind a stream frontier is at least that frontier, so the heap minimum is the next global value. Replacing only the consumed stream's frontier restores the same invariant, yielding the exact merged prefix including duplicates.",
    },
    complexityRationale: "Heap construction is O(k), and r outputs each cost O(log k), for O(k + r log k) time and O(k + r) heap-plus-output space.",
    edgeCases: [
      { description: "There are no streams or every inner stream is empty." },
      { description: "The limit is zero." },
      { description: "The limit exceeds the combined number of values." },
      { description: "Equal values occur in different streams." },
    ],
    alternatives: [
      { name: "Flatten and sort", tradeoff: "It processes all values even when only a short prefix is requested." },
      { name: "Scan all frontiers", tradeoff: "It avoids a heap but costs O(k) for each emitted value." },
    ],
    pitfalls: ["Reading index zero from an empty stream.", "Dropping duplicate values.", "Ignoring the limit or heap-empty stopping condition."],
  }),
]);

const SOLUTION_GUIDES_BY_KEY: ReadonlyMap<string, SolutionGuideV1> = new Map(
  SOLUTION_GUIDES.map((entry) => [
    `${entry.itemId}@${entry.itemRevision}`,
    entry,
  ]),
);

export function getSolutionGuide(
  itemId: SolutionGuideItemId | string,
  itemRevision: number | undefined,
): SolutionGuideV1 | null {
  if (itemRevision === undefined) return null;
  return SOLUTION_GUIDES_BY_KEY.get(`${itemId}@${itemRevision}`) ?? null;
}
