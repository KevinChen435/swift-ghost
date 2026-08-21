const MAX_CLIENT_ID = 128;
export const MAX_TRUSTED_SOURCE_BYTES = 40_000;
export const MAX_TRUSTED_CALLBACK_BYTES = 16_384;
export const TRUSTED_ASSIGNMENT_TTL_MS = 2 * 60 * 60 * 1000;
export const TRUSTED_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export const TRUSTED_ASSESSMENT_PROGRAM = Object.freeze({
  id: "python-verified-baseline",
  revision: 1,
  title: "Verified Python checkpoint",
  shortTitle: "Verified checkpoint",
  description:
    "A server-selected Python problem judged against a sealed test suite in an isolated runtime.",
  evidenceLabel: "Server-verified code evidence",
  language: "python",
});

export const TRUSTED_SWIFT_PROGRAM = Object.freeze({
  id: "swift-verified-baseline",
  revision: 1,
  title: "Verified Swift checkpoint",
  shortTitle: "Swift checkpoint",
  description:
    "A server-selected portable Swift problem compiled on Linux and judged against a sealed test suite.",
  evidenceLabel: "Server-verified Swift code evidence",
  language: "swift",
});

export const TRUSTED_CODE_LAB_PROGRAM = Object.freeze({
  id: "verified-code-lab",
  revision: 2,
  title: "Verified Code Lab",
  description:
    "Server-owned Python and portable Swift checkpoints with sealed tests and immutable receipts.",
  evidenceLabel: "Server-verified code evidence",
  language: "mixed",
});

const PROGRAMS = Object.freeze([
  TRUSTED_ASSESSMENT_PROGRAM,
  TRUSTED_SWIFT_PROGRAM,
]);
const PROGRAM_BY_ID = new Map(PROGRAMS.map((program) => [program.id, program]));

export function trustedProgramForId(id) {
  return PROGRAM_BY_ID.get(String(id ?? "")) ?? null;
}

export function trustedProgramForLanguage(language) {
  return language === "swift"
    ? TRUSTED_SWIFT_PROGRAM
    : language === "python"
      ? TRUSTED_ASSESSMENT_PROGRAM
      : null;
}

function freezeChallenge(challenge) {
  const language = challenge.language === "swift" ? "swift" : "python";
  return Object.freeze({
    ...challenge,
    language,
    programId:
      language === "swift"
        ? TRUSTED_SWIFT_PROGRAM.id
        : TRUSTED_ASSESSMENT_PROGRAM.id,
    runtime:
      language === "swift"
        ? "swift-6.3.3-linux"
        : "python-3.13-linux",
    tags: Object.freeze([...challenge.tags]),
    constraints: Object.freeze([...challenge.constraints]),
    entrypoint: Object.freeze({
      ...challenge.entrypoint,
      ...(Array.isArray(challenge.entrypoint.parameters)
        ? {
            parameters: Object.freeze(
              challenge.entrypoint.parameters.map((parameter) =>
                Object.freeze({ ...parameter })
              ),
            ),
          }
        : {}),
    }),
    samples: Object.freeze(
      challenge.samples.map((testCase) => Object.freeze({ ...testCase })),
    ),
    hiddenCases: Object.freeze(
      challenge.hiddenCases.map((testCase) => Object.freeze({ ...testCase })),
    ),
  });
}

/**
 * This bank is imported only by the Worker bundle. Never import it from app/**.
 * The public projection below deliberately omits hiddenCases and expected
 * values outside the authored samples.
 */
const PYTHON_CHALLENGES = Object.freeze([
  freezeChallenge({
    key: "stable-window",
    contentRevision: 1,
    judgeRevision: 2,
    title: "Longest Stable Window",
    difficulty: "Medium",
    estimatedMinutes: 18,
    summary:
      "Find the longest contiguous window whose largest and smallest values stay within a limit.",
    prompt:
      "Implement longest_stable_window(nums, max_gap). Return the maximum length of a contiguous subarray where max(window) - min(window) <= max_gap. Return 0 for an empty input.",
    constraints: [
      "0 <= len(nums) <= 20,000",
      "-1,000,000 <= nums[i] <= 1,000,000",
      "0 <= max_gap <= 2,000,000",
      "Aim for O(n) time.",
    ],
    tags: ["sliding-window", "monotonic-deque"],
    starterCode:
      "def longest_stable_window(nums: list[int], max_gap: int) -> int:\n    # Return the longest valid contiguous window.\n    raise NotImplementedError",
    entrypoint: { kind: "function", name: "longest_stable_window" },
    samples: [
      {
        id: "sample-1",
        name: "window contracts after a spike",
        args: [[8, 2, 4, 7], 4],
        expected: 2,
      },
      {
        id: "sample-2",
        name: "entire repeated range remains stable",
        args: [[10, 1, 2, 4, 7, 2], 5],
        expected: 4,
      },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [[], 3], expected: 0 },
      { id: "hidden-single", name: "single value", args: [[-8], 0], expected: 1 },
      { id: "hidden-zero-gap", name: "zero gap", args: [[4, 4, 5, 4, 4], 0], expected: 2 },
      { id: "hidden-negative", name: "negative values", args: [[-5, -2, -4, -3, 10], 3], expected: 4 },
      { id: "hidden-contract", name: "repeated contractions", args: [[1, 5, 6, 7, 8, 10, 6, 5, 6], 4], expected: 5 },
    ],
  }),
  freezeChallenge({
    key: "first-complete-group",
    contentRevision: 1,
    judgeRevision: 2,
    title: "First Complete Group",
    difficulty: "Easy",
    estimatedMinutes: 12,
    summary:
      "Find the first event index at which every required label has appeared.",
    prompt:
      "Implement first_complete_group(events, required). Return the smallest zero-based event index where every distinct label in required has appeared at least once. Return -1 if completion never occurs. An empty required list is complete before processing events, so return -1.",
    constraints: [
      "0 <= len(events) <= 100,000",
      "0 <= len(required) <= 10,000",
      "Labels are case-sensitive strings.",
      "Duplicate values in required count once.",
    ],
    tags: ["hash-set", "streaming"],
    starterCode:
      "def first_complete_group(events: list[str], required: list[str]) -> int:\n    # Return the first completion index, or -1.\n    raise NotImplementedError",
    entrypoint: { kind: "function", name: "first_complete_group" },
    samples: [
      {
        id: "sample-1",
        name: "completes after all labels arrive",
        args: [["build", "test", "build", "ship"], ["build", "ship"]],
        expected: 3,
      },
      {
        id: "sample-2",
        name: "missing requirement",
        args: [["a", "b", "a"], ["a", "c"]],
        expected: -1,
      },
    ],
    hiddenCases: [
      { id: "hidden-empty-required", name: "empty requirement", args: [["a"], []], expected: -1 },
      { id: "hidden-empty-events", name: "empty event stream", args: [[], ["a"]], expected: -1 },
      { id: "hidden-first", name: "first event completes", args: [["ready", "later"], ["ready"]], expected: 0 },
      { id: "hidden-duplicates", name: "duplicate requirements", args: [["a", "b"], ["a", "a", "b"]], expected: 1 },
      { id: "hidden-case-sensitive", name: "case sensitivity", args: [["A", "a"], ["a"]], expected: 1 },
    ],
  }),
  freezeChallenge({
    key: "merge-busy-intervals",
    contentRevision: 1,
    judgeRevision: 2,
    title: "Merge Busy Intervals",
    difficulty: "Medium",
    estimatedMinutes: 16,
    summary:
      "Normalize overlapping or touching busy intervals into a compact schedule.",
    prompt:
      "Implement merge_busy_intervals(intervals). Each interval is [start, end] with start <= end. Return sorted, non-overlapping intervals. Overlapping or touching intervals must merge, so [1, 3] and [3, 5] become [1, 5]. Do not mutate the input.",
    constraints: [
      "0 <= len(intervals) <= 50,000",
      "-1,000,000 <= start <= end <= 1,000,000",
      "The input order is arbitrary.",
      "Aim for O(n log n) time.",
    ],
    tags: ["sorting", "intervals"],
    starterCode:
      "def merge_busy_intervals(intervals: list[list[int]]) -> list[list[int]]:\n    # Merge overlaps and touching boundaries.\n    raise NotImplementedError",
    entrypoint: { kind: "function", name: "merge_busy_intervals" },
    samples: [
      {
        id: "sample-1",
        name: "overlaps and touching boundaries",
        args: [[[1, 3], [2, 4], [7, 9], [9, 10]]],
        expected: [[1, 4], [7, 10]],
      },
      {
        id: "sample-2",
        name: "unsorted contained intervals",
        args: [[[8, 12], [2, 6], [3, 4]]],
        expected: [[2, 6], [8, 12]],
      },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty schedule", args: [[]], expected: [] },
      { id: "hidden-point", name: "touching point intervals", args: [[[2, 2], [2, 4], [4, 4]]], expected: [[2, 4]] },
      { id: "hidden-negative", name: "negative boundaries", args: [[[-8, -3], [-5, 0], [2, 3]]], expected: [[-8, 0], [2, 3]] },
      { id: "hidden-chain", name: "long touching chain", args: [[[5, 6], [1, 2], [2, 3], [3, 5]]], expected: [[1, 6]] },
      { id: "hidden-no-mutate", name: "already disjoint", args: [[[1, 1], [3, 4], [9, 12]]], expected: [[1, 1], [3, 4], [9, 12]] },
    ],
  }),
]);

const SWIFT_CHALLENGES = Object.freeze([
  freezeChallenge({
    language: "swift",
    key: "swift-two-sum",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Two Sum in Swift",
    difficulty: "Easy",
    estimatedMinutes: 12,
    summary: "Return the two increasing indices whose values add to a target.",
    prompt:
      "Implement twoSum(_ nums: [Int], _ target: Int) -> [Int]. Exactly one solution exists. Return the two zero-based indices in increasing order and do not reuse an element.",
    constraints: [
      "2 <= nums.count <= 20,000",
      "-1,000,000 <= nums[i], target <= 1,000,000",
      "Exactly one valid pair exists.",
      "Aim for O(n) time.",
    ],
    tags: ["swift", "hash-map"],
    starterCode:
      "import Foundation\n\nfunc twoSum(_ nums: [Int], _ target: Int) -> [Int] {\n    // Return the two matching indices in increasing order.\n    return []\n}",
    entrypoint: {
      kind: "function",
      name: "twoSum",
      parameters: [
        { name: "nums", type: "[Int]" },
        { name: "target", type: "Int" },
      ],
      returns: "[Int]",
    },
    samples: [
      { id: "sample-1", name: "pair at the front", args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { id: "sample-2", name: "pair crosses the middle", args: [[3, 2, 4], 6], expected: [1, 2] },
    ],
    hiddenCases: [
      { id: "hidden-duplicate", name: "duplicate values", args: [[3, 3], 6], expected: [0, 1] },
      { id: "hidden-negative", name: "negative complement", args: [[-8, 12, 3, 5], -3], expected: [0, 3] },
      { id: "hidden-late", name: "late pair", args: [[1, 6, 8, 10, 14], 24], expected: [3, 4] },
      { id: "hidden-zero", name: "zero target", args: [[-4, 7, 4, 9], 0], expected: [0, 2] },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-valid-parentheses",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Valid Parentheses in Swift",
    difficulty: "Easy",
    estimatedMinutes: 10,
    summary: "Validate nested bracket pairs with a stack.",
    prompt:
      "Implement isValidParentheses(_ text: String) -> Bool. The input contains only (), [], and {}. Return true when every opener is closed by the correct type in the correct order.",
    constraints: [
      "0 <= text.count <= 100,000",
      "text contains only bracket characters.",
      "An empty string is valid.",
      "Aim for O(n) time and O(n) space.",
    ],
    tags: ["swift", "stack", "string"],
    starterCode:
      "import Foundation\n\nfunc isValidParentheses(_ text: String) -> Bool {\n    // Track unmatched opening brackets.\n    return false\n}",
    entrypoint: {
      kind: "function",
      name: "isValidParentheses",
      parameters: [{ name: "text", type: "String" }],
      returns: "Bool",
    },
    samples: [
      { id: "sample-1", name: "nested pairs", args: ["([]{})"], expected: true },
      { id: "sample-2", name: "crossed pair", args: ["([)]"], expected: false },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [""], expected: true },
      { id: "hidden-opener", name: "unclosed opener", args: ["((("], expected: false },
      { id: "hidden-closer", name: "early closer", args: ["]"], expected: false },
      { id: "hidden-sequence", name: "adjacent groups", args: ["{}[]()"], expected: true },
      { id: "hidden-deep", name: "deep nesting", args: ["{{[[(())]]}}"], expected: true },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-stable-window",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Longest Stable Window in Swift",
    difficulty: "Medium",
    estimatedMinutes: 20,
    summary: "Maintain a valid window while tracking both extremes.",
    prompt:
      "Implement longestStableWindow(_ nums: [Int], _ maxGap: Int) -> Int. Return the maximum length of a contiguous subarray where max(window) - min(window) <= maxGap. Return 0 for an empty input.",
    constraints: [
      "0 <= nums.count <= 20,000",
      "-1,000,000 <= nums[i] <= 1,000,000",
      "0 <= maxGap <= 2,000,000",
      "Aim for O(n) time.",
    ],
    tags: ["swift", "sliding-window", "deque"],
    starterCode:
      "import Foundation\n\nfunc longestStableWindow(_ nums: [Int], _ maxGap: Int) -> Int {\n    // Maintain the current window's minimum and maximum.\n    return 0\n}",
    entrypoint: {
      kind: "function",
      name: "longestStableWindow",
      parameters: [
        { name: "nums", type: "[Int]" },
        { name: "maxGap", type: "Int" },
      ],
      returns: "Int",
    },
    samples: [
      { id: "sample-1", name: "contracts after a spike", args: [[8, 2, 4, 7], 4], expected: 2 },
      { id: "sample-2", name: "repeated stable range", args: [[10, 1, 2, 4, 7, 2], 5], expected: 4 },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [[], 3], expected: 0 },
      { id: "hidden-single", name: "single value", args: [[-8], 0], expected: 1 },
      { id: "hidden-zero-gap", name: "zero gap", args: [[4, 4, 5, 4, 4], 0], expected: 2 },
      { id: "hidden-negative", name: "negative values", args: [[-5, -2, -4, -3, 10], 3], expected: 4 },
      { id: "hidden-contract", name: "repeated contractions", args: [[1, 5, 6, 7, 8, 10, 6, 5, 6], 4], expected: 5 },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-merge-intervals",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Merge Busy Intervals in Swift",
    difficulty: "Medium",
    estimatedMinutes: 16,
    summary: "Sort and merge overlapping or touching intervals.",
    prompt:
      "Implement mergeBusyIntervals(_ intervals: [[Int]]) -> [[Int]]. Each interval is [start, end]. Return sorted non-overlapping intervals, merging touching boundaries. Do not mutate the input.",
    constraints: [
      "0 <= intervals.count <= 50,000",
      "Every interval contains exactly two integers.",
      "-1,000,000 <= start <= end <= 1,000,000",
      "Aim for O(n log n) time.",
    ],
    tags: ["swift", "sorting", "intervals"],
    starterCode:
      "import Foundation\n\nfunc mergeBusyIntervals(_ intervals: [[Int]]) -> [[Int]] {\n    // Sort a copy, then merge overlaps and touching boundaries.\n    return []\n}",
    entrypoint: {
      kind: "function",
      name: "mergeBusyIntervals",
      parameters: [{ name: "intervals", type: "[[Int]]" }],
      returns: "[[Int]]",
    },
    samples: [
      { id: "sample-1", name: "overlap and touch", args: [[[1, 3], [2, 4], [7, 9], [9, 10]]], expected: [[1, 4], [7, 10]] },
      { id: "sample-2", name: "unsorted containment", args: [[[8, 12], [2, 6], [3, 4]]], expected: [[2, 6], [8, 12]] },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty schedule", args: [[]], expected: [] },
      { id: "hidden-point", name: "point intervals", args: [[[2, 2], [2, 4], [4, 4]]], expected: [[2, 4]] },
      { id: "hidden-negative", name: "negative boundaries", args: [[[-8, -3], [-5, 0], [2, 3]]], expected: [[-8, 0], [2, 3]] },
      { id: "hidden-chain", name: "touching chain", args: [[[5, 6], [1, 2], [2, 3], [3, 5]]], expected: [[1, 6]] },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-first-complete-group",
    contentRevision: 1,
    judgeRevision: 1,
    title: "First Complete Group in Swift",
    difficulty: "Easy",
    estimatedMinutes: 12,
    summary: "Find the first event where every required label has appeared.",
    prompt:
      "Implement firstCompleteGroup(_ events: [String], _ required: [String]) -> Int. Return the smallest zero-based event index where every distinct required label has appeared. Return -1 if it never occurs or required is empty.",
    constraints: [
      "0 <= events.count <= 100,000",
      "0 <= required.count <= 10,000",
      "Labels are case-sensitive.",
      "Duplicate required labels count once.",
    ],
    tags: ["swift", "set", "streaming"],
    starterCode:
      "import Foundation\n\nfunc firstCompleteGroup(_ events: [String], _ required: [String]) -> Int {\n    // Return the first completion index, or -1.\n    return -1\n}",
    entrypoint: {
      kind: "function",
      name: "firstCompleteGroup",
      parameters: [
        { name: "events", type: "[String]" },
        { name: "required", type: "[String]" },
      ],
      returns: "Int",
    },
    samples: [
      { id: "sample-1", name: "completes after all labels", args: [["build", "test", "build", "ship"], ["build", "ship"]], expected: 3 },
      { id: "sample-2", name: "missing requirement", args: [["a", "b", "a"], ["a", "c"]], expected: -1 },
    ],
    hiddenCases: [
      { id: "hidden-empty-required", name: "empty requirement", args: [["a"], []], expected: -1 },
      { id: "hidden-empty-events", name: "empty events", args: [[], ["a"]], expected: -1 },
      { id: "hidden-first", name: "first event completes", args: [["ready", "later"], ["ready"]], expected: 0 },
      { id: "hidden-duplicates", name: "duplicate requirements", args: [["a", "b"], ["a", "a", "b"]], expected: 1 },
      { id: "hidden-unicode", name: "Unicode labels", args: [["準備", "出荷"], ["出荷"]], expected: 1 },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-binary-search",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Binary Search in Swift",
    difficulty: "Easy",
    estimatedMinutes: 10,
    summary: "Return a target index from a sorted unique array.",
    prompt:
      "Implement binarySearch(_ nums: [Int], _ target: Int) -> Int. nums is sorted in ascending order with unique values. Return the target index, or -1 when absent.",
    constraints: [
      "0 <= nums.count <= 100,000",
      "nums is strictly increasing.",
      "-1,000,000 <= nums[i], target <= 1,000,000",
      "Use O(log n) time.",
    ],
    tags: ["swift", "binary-search"],
    starterCode:
      "import Foundation\n\nfunc binarySearch(_ nums: [Int], _ target: Int) -> Int {\n    // Maintain an inclusive or half-open search interval.\n    return -1\n}",
    entrypoint: {
      kind: "function",
      name: "binarySearch",
      parameters: [
        { name: "nums", type: "[Int]" },
        { name: "target", type: "Int" },
      ],
      returns: "Int",
    },
    samples: [
      { id: "sample-1", name: "target present", args: [[-1, 0, 3, 5, 9, 12], 9], expected: 4 },
      { id: "sample-2", name: "target absent", args: [[-1, 0, 3, 5, 9, 12], 2], expected: -1 },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [[], 4], expected: -1 },
      { id: "hidden-first", name: "first element", args: [[2, 5, 8], 2], expected: 0 },
      { id: "hidden-last", name: "last element", args: [[2, 5, 8], 8], expected: 2 },
      { id: "hidden-between", name: "between values", args: [[-10, -3, 7, 11], 0], expected: -1 },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-max-profit",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Best Single Trade in Swift",
    difficulty: "Easy",
    estimatedMinutes: 10,
    summary: "Track the best profit from one buy followed by one sell.",
    prompt:
      "Implement maxSingleTradeProfit(_ prices: [Int]) -> Int. Choose at most one buy and one later sell. Return the maximum non-negative profit.",
    constraints: [
      "0 <= prices.count <= 100,000",
      "0 <= prices[i] <= 1,000,000",
      "The buy must occur before the sell.",
      "Aim for O(n) time and O(1) extra space.",
    ],
    tags: ["swift", "array", "running-minimum"],
    starterCode:
      "import Foundation\n\nfunc maxSingleTradeProfit(_ prices: [Int]) -> Int {\n    // Track the cheapest earlier price.\n    return 0\n}",
    entrypoint: {
      kind: "function",
      name: "maxSingleTradeProfit",
      parameters: [{ name: "prices", type: "[Int]" }],
      returns: "Int",
    },
    samples: [
      { id: "sample-1", name: "profitable trade", args: [[7, 1, 5, 3, 6, 4]], expected: 5 },
      { id: "sample-2", name: "falling prices", args: [[7, 6, 4, 3, 1]], expected: 0 },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [[]], expected: 0 },
      { id: "hidden-single", name: "single price", args: [[5]], expected: 0 },
      { id: "hidden-late-low", name: "late low cannot buy backward", args: [[5, 9, 1]], expected: 4 },
      { id: "hidden-flat", name: "flat prices", args: [[4, 4, 4]], expected: 0 },
      { id: "hidden-wide", name: "wide swing", args: [[10, 2, 3, 20, 1, 30]], expected: 29 },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-product-except-self",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Product Except Self in Swift",
    difficulty: "Medium",
    estimatedMinutes: 16,
    summary: "Build prefix and suffix products without division.",
    prompt:
      "Implement productExceptSelf(_ nums: [Int]) -> [Int]. Return an array where result[i] is the product of every value except nums[i]. Do not use division.",
    constraints: [
      "2 <= nums.count <= 20,000",
      "-12 <= nums[i] <= 12",
      "Every result fits in a signed 64-bit integer and in this judge's Int.",
      "Use O(n) time; output storage does not count as extra space.",
    ],
    tags: ["swift", "prefix", "array"],
    starterCode:
      "import Foundation\n\nfunc productExceptSelf(_ nums: [Int]) -> [Int] {\n    // Combine prefix and suffix products without division.\n    return []\n}",
    entrypoint: {
      kind: "function",
      name: "productExceptSelf",
      parameters: [{ name: "nums", type: "[Int]" }],
      returns: "[Int]",
    },
    samples: [
      { id: "sample-1", name: "positive values", args: [[1, 2, 3, 4]], expected: [24, 12, 8, 6] },
      { id: "sample-2", name: "one zero", args: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0] },
    ],
    hiddenCases: [
      { id: "hidden-two", name: "two values", args: [[5, 8]], expected: [8, 5] },
      { id: "hidden-two-zero", name: "two zeros", args: [[0, 2, 0, 4]], expected: [0, 0, 0, 0] },
      { id: "hidden-negative", name: "negative parity", args: [[-1, -2, -3]], expected: [6, 3, 2] },
      { id: "hidden-ones", name: "identity values", args: [[1, 1, 1, 1]], expected: [1, 1, 1, 1] },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-contains-duplicate",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Contains Duplicate in Swift",
    difficulty: "Easy",
    estimatedMinutes: 10,
    summary: "Detect whether any value appears more than once.",
    prompt:
      "Implement containsDuplicate(_ nums: [Int]) -> Bool. Return true when at least one value occurs two or more times, otherwise return false.",
    constraints: [
      "0 <= nums.count <= 100,000",
      "-1,000,000 <= nums[i] <= 1,000,000",
      "Return false for an empty or one-element input.",
      "Aim for O(n) time.",
    ],
    tags: ["hash-set", "arrays"],
    starterCode:
      "import Foundation\n\nfunc containsDuplicate(_ nums: [Int]) -> Bool {\n    // Track values seen so far.\n    return false\n}",
    entrypoint: {
      kind: "function",
      name: "containsDuplicate",
      parameters: [{ name: "nums", type: "[Int]" }],
      returns: "Bool",
    },
    samples: [
      { id: "sample-1", name: "repeated value", args: [[1, 2, 3, 1]], expected: true },
      { id: "sample-2", name: "all distinct", args: [[1, 2, 3, 4]], expected: false },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [[]], expected: false },
      { id: "hidden-single", name: "single value", args: [[7]], expected: false },
      { id: "hidden-negative", name: "negative duplicate", args: [[-2, 4, -2]], expected: true },
      { id: "hidden-many", name: "late duplicate", args: [[1, 2, 3, 4, 5, 6, 5]], expected: true },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-longest-consecutive",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Longest Consecutive Sequence in Swift",
    difficulty: "Medium",
    estimatedMinutes: 18,
    summary: "Find the longest run of consecutive integers in any order.",
    prompt:
      "Implement longestConsecutive(_ nums: [Int]) -> Int. Return the length of the longest sequence of consecutive integers. Values may appear in any order and duplicates do not extend a sequence.",
    constraints: [
      "0 <= nums.count <= 100,000",
      "-1,000,000,000 <= nums[i] <= 1,000,000,000",
      "A duplicate value counts once.",
      "Aim for O(n) average time.",
    ],
    tags: ["hash-set", "arrays"],
    starterCode:
      "import Foundation\n\nfunc longestConsecutive(_ nums: [Int]) -> Int {\n    // Start counting only at the beginning of a run.\n    return 0\n}",
    entrypoint: {
      kind: "function",
      name: "longestConsecutive",
      parameters: [{ name: "nums", type: "[Int]" }],
      returns: "Int",
    },
    samples: [
      { id: "sample-1", name: "unordered run", args: [[100, 4, 200, 1, 3, 2]], expected: 4 },
      { id: "sample-2", name: "duplicate values", args: [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], expected: 9 },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [[]], expected: 0 },
      { id: "hidden-single", name: "single value", args: [[9]], expected: 1 },
      { id: "hidden-negative", name: "negative run", args: [[-3, -1, -2, 8]], expected: 3 },
      { id: "hidden-duplicate", name: "only duplicates", args: [[4, 4, 4]], expected: 1 },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-subarray-sum-count",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Subarray Sum Count in Swift",
    difficulty: "Medium",
    estimatedMinutes: 18,
    summary: "Count contiguous subarrays whose values add to a target.",
    prompt:
      "Implement subarraySumCount(_ nums: [Int], _ target: Int) -> Int. Return the number of non-empty contiguous subarrays whose sum equals target. Values may be negative, zero, or positive.",
    constraints: [
      "0 <= nums.count <= 20,000",
      "-1,000,000 <= nums[i], target <= 1,000,000",
      "The answer fits in a signed 64-bit integer and this judge's Int.",
      "Aim for O(n) time.",
    ],
    tags: ["prefix-sum", "hash-map"],
    starterCode:
      "import Foundation\n\nfunc subarraySumCount(_ nums: [Int], _ target: Int) -> Int {\n    // Count equal prefix-sum differences.\n    return 0\n}",
    entrypoint: {
      kind: "function",
      name: "subarraySumCount",
      parameters: [
        { name: "nums", type: "[Int]" },
        { name: "target", type: "Int" },
      ],
      returns: "Int",
    },
    samples: [
      { id: "sample-1", name: "two matching ranges", args: [[1, 1, 1], 2], expected: 2 },
      { id: "sample-2", name: "negative values", args: [[1, -1, 0], 0], expected: 3 },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [[], 0], expected: 0 },
      { id: "hidden-zeroes", name: "three zeroes", args: [[0, 0, 0], 0], expected: 6 },
      { id: "hidden-negative", name: "negative target", args: [[-1, -1, 1], -2], expected: 1 },
      { id: "hidden-single", name: "single match", args: [[5], 5], expected: 1 },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-three-sum",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Three Sum in Swift",
    difficulty: "Medium",
    estimatedMinutes: 24,
    summary: "Return unique triplets that add to zero with sorted two pointers.",
    prompt:
      "Implement threeSum(_ nums: [Int]) -> [[Int]]. Return every unique triplet [a, b, c] whose values sum to zero. Each triplet must be non-decreasing, and return the triplets in lexicographic order. Do not reuse an index.",
    constraints: [
      "0 <= nums.count <= 300",
      "-100,000 <= nums[i] <= 100,000",
      "Do not return duplicate triplets.",
      "Aim for O(n²) time after sorting.",
    ],
    tags: ["two-pointers", "sorting"],
    starterCode:
      "import Foundation\n\nfunc threeSum(_ nums: [Int]) -> [[Int]] {\n    // Sort a copy, then sweep the remaining pair with two pointers.\n    return []\n}",
    entrypoint: {
      kind: "function",
      name: "threeSum",
      parameters: [{ name: "nums", type: "[Int]" }],
      returns: "[[Int]]",
    },
    samples: [
      { id: "sample-1", name: "two unique triplets", args: [[-1, 0, 1, 2, -1, -4]], expected: [[-1, -1, 2], [-1, 0, 1]] },
      { id: "sample-2", name: "no zero sum", args: [[0, 1, 1]], expected: [] },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [[]], expected: [] },
      { id: "hidden-zeroes", name: "three zeroes", args: [[0, 0, 0, 0]], expected: [[0, 0, 0]] },
      { id: "hidden-negative", name: "negative triplet", args: [[-2, 0, 1, 1, 2]], expected: [[-2, 0, 2], [-2, 1, 1]] },
      { id: "hidden-positive", name: "all positive", args: [[1, 2, 3]], expected: [] },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-valid-palindrome",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Valid Palindrome in Swift",
    difficulty: "Easy",
    estimatedMinutes: 12,
    summary: "Compare alphanumeric characters from both ends of a string.",
    prompt:
      "Implement isValidPalindrome(_ text: String) -> Bool. Ignore ASCII punctuation and spaces, compare ASCII letters case-insensitively, and return whether the remaining sequence reads the same forward and backward.",
    constraints: [
      "0 <= text.count <= 100,000",
      "text contains printable ASCII characters.",
      "Only ASCII letters and digits participate in the comparison.",
      "Aim for O(n) time and O(1) extra space apart from String indexing.",
    ],
    tags: ["two-pointers", "string"],
    starterCode:
      "import Foundation\n\nfunc isValidPalindrome(_ text: String) -> Bool {\n    // Compare the next alphanumeric character from each side.\n    return false\n}",
    entrypoint: {
      kind: "function",
      name: "isValidPalindrome",
      parameters: [{ name: "text", type: "String" }],
      returns: "Bool",
    },
    samples: [
      { id: "sample-1", name: "punctuation ignored", args: ["A man, a plan, a canal: Panama"], expected: true },
      { id: "sample-2", name: "mismatched ends", args: ["race a car"], expected: false },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty text", args: [""], expected: true },
      { id: "hidden-digits", name: "digits", args: ["0P"], expected: false },
      { id: "hidden-punctuation", name: "punctuation only", args: [",.!"], expected: true },
      { id: "hidden-case", name: "mixed case", args: ["Aa"], expected: true },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-daily-temperatures",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Daily Temperatures in Swift",
    difficulty: "Medium",
    estimatedMinutes: 18,
    summary: "Use a monotonic stack to find each next warmer day.",
    prompt: "Implement dailyTemperatures(_ temperatures: [Int]) -> [Int]. For each day, return how many days must pass before a strictly warmer temperature occurs, or 0 if none occurs.",
    constraints: ["0 <= temperatures.count <= 100,000", "30 <= temperatures[i] <= 100", "The output has the same length as the input.", "Aim for O(n) time."],
    tags: ["stack", "monotonic-stack"],
    starterCode: "import Foundation\n\nfunc dailyTemperatures(_ temperatures: [Int]) -> [Int] {\n    // Keep unresolved indices in decreasing temperature order.\n    return []\n}",
    entrypoint: { kind: "function", name: "dailyTemperatures", parameters: [{ name: "temperatures", type: "[Int]" }], returns: "[Int]" },
    samples: [
      { id: "sample-1", name: "mixed forecast", args: [[73, 74, 75, 71, 69, 72, 76, 73]], expected: [1, 1, 4, 2, 1, 1, 0, 0] },
      { id: "sample-2", name: "no warmer day", args: [[80, 79, 78]], expected: [0, 0, 0] },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [[]], expected: [] },
      { id: "hidden-flat", name: "flat temperatures", args: [[70, 70, 70]], expected: [0, 0, 0] },
      { id: "hidden-late", name: "late warmer day", args: [[70, 69, 68, 71]], expected: [3, 2, 1, 0] },
      { id: "hidden-wave", name: "repeated waves", args: [[73, 72, 75, 74, 76]], expected: [2, 1, 2, 1, 0] },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-search-rotated",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Search Rotated Array in Swift",
    difficulty: "Medium",
    estimatedMinutes: 18,
    summary: "Binary-search a sorted array after one rotation.",
    prompt: "Implement searchRotated(_ nums: [Int], _ target: Int) -> Int. nums contains unique values from an ascending array rotated at an unknown pivot. Return the target index or -1 when absent.",
    constraints: ["0 <= nums.count <= 100,000", "nums contains unique integers.", "The original array was strictly increasing.", "Aim for O(log n) time."],
    tags: ["binary-search", "arrays"],
    starterCode: "import Foundation\n\nfunc searchRotated(_ nums: [Int], _ target: Int) -> Int {\n    // Identify which half remains sorted at each step.\n    return -1\n}",
    entrypoint: { kind: "function", name: "searchRotated", parameters: [{ name: "nums", type: "[Int]" }, { name: "target", type: "Int" }], returns: "Int" },
    samples: [
      { id: "sample-1", name: "target after pivot", args: [[4, 5, 6, 7, 0, 1, 2], 0], expected: 4 },
      { id: "sample-2", name: "target absent", args: [[4, 5, 6, 7, 0, 1, 2], 3], expected: -1 },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [[], 1], expected: -1 },
      { id: "hidden-single", name: "single hit", args: [[5], 5], expected: 0 },
      { id: "hidden-no-rotation", name: "unrotated array", args: [[1, 2, 3, 4], 3], expected: 2 },
      { id: "hidden-first", name: "pivot first", args: [[6, 1, 2, 3, 4, 5], 6], expected: 0 },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-koko-bananas",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Koko Eating Bananas in Swift",
    difficulty: "Medium",
    estimatedMinutes: 20,
    summary: "Binary-search the smallest speed that meets a deadline.",
    prompt: "Implement minEatingSpeed(_ piles: [Int], _ hours: Int) -> Int. At speed k, one pile takes ceil(pile / k) hours. Return the smallest positive integer k that finishes every pile within hours.",
    constraints: ["1 <= piles.count <= 100,000", "1 <= piles[i] <= 1,000,000,000", "piles.count <= hours <= 1,000,000,000", "Aim for O(n log max(piles)) time."],
    tags: ["binary-search", "search-space"],
    starterCode: "import Foundation\n\nfunc minEatingSpeed(_ piles: [Int], _ hours: Int) -> Int {\n    // Search the smallest speed whose required hours fit the limit.\n    return 0\n}",
    entrypoint: { kind: "function", name: "minEatingSpeed", parameters: [{ name: "piles", type: "[Int]" }, { name: "hours", type: "Int" }], returns: "Int" },
    samples: [
      { id: "sample-1", name: "three piles", args: [[3, 6, 7, 11], 8], expected: 4 },
      { id: "sample-2", name: "one hour per pile", args: [[30, 11, 23, 4, 20], 5], expected: 30 },
    ],
    hiddenCases: [
      { id: "hidden-one", name: "single pile", args: [[9], 3], expected: 3 },
      { id: "hidden-exact", name: "exact deadline", args: [[5, 5, 5], 3], expected: 5 },
      { id: "hidden-slack", name: "extra hours", args: [[1, 1, 1, 1], 8], expected: 1 },
      { id: "hidden-large", name: "largest pile bound", args: [[10, 1, 1], 3], expected: 10 },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-erase-overlap-intervals",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Erase Overlapping Intervals in Swift",
    difficulty: "Medium",
    estimatedMinutes: 16,
    summary: "Keep the largest compatible set of non-overlapping intervals.",
    prompt: "Implement eraseOverlapIntervals(_ intervals: [[Int]]) -> Int. Each interval is [start, end] with start < end. Return the minimum number of intervals to remove so the remaining intervals do not overlap. Touching endpoints are allowed.",
    constraints: ["0 <= intervals.count <= 100,000", "Every interval contains exactly two integers with start < end.", "-1,000,000 <= start < end <= 1,000,000", "Aim for O(n log n) time."],
    tags: ["intervals", "greedy"],
    starterCode: "import Foundation\n\nfunc eraseOverlapIntervals(_ intervals: [[Int]]) -> Int {\n    // Keep the interval with the earliest finishing boundary.\n    return 0\n}",
    entrypoint: { kind: "function", name: "eraseOverlapIntervals", parameters: [{ name: "intervals", type: "[[Int]]" }], returns: "Int" },
    samples: [
      { id: "sample-1", name: "remove one overlap", args: [[[1, 2], [2, 3], [3, 4], [1, 3]]], expected: 1 },
      { id: "sample-2", name: "keep disjoint intervals", args: [[[1, 2], [2, 3]]], expected: 0 },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty schedule", args: [[]], expected: 0 },
      { id: "hidden-chain", name: "overlap chain", args: [[[1, 4], [2, 3], [3, 5]]], expected: 1 },
      { id: "hidden-contained", name: "contained intervals", args: [[[1, 10], [2, 3], [4, 5]]], expected: 1 },
      { id: "hidden-touch", name: "touching boundaries", args: [[[1, 2], [2, 4], [4, 5]]], expected: 0 },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-minimum-size-window",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Minimum Size Window in Swift",
    difficulty: "Medium",
    estimatedMinutes: 16,
    summary: "Shrink a positive sliding window to its shortest valid length.",
    prompt: "Implement minSubarrayLength(_ target: Int, _ nums: [Int]) -> Int. nums contains positive integers. Return the minimum length of a contiguous subarray whose sum is at least target, or 0 if no such subarray exists.",
    constraints: ["1 <= target <= 1,000,000,000", "0 <= nums.count <= 100,000", "1 <= nums[i] <= 100,000", "Aim for O(n) time."],
    tags: ["sliding-window", "positive-array"],
    starterCode: "import Foundation\n\nfunc minSubarrayLength(_ target: Int, _ nums: [Int]) -> Int {\n    // Expand until valid, then shrink from the left.\n    return 0\n}",
    entrypoint: { kind: "function", name: "minSubarrayLength", parameters: [{ name: "target", type: "Int" }, { name: "nums", type: "[Int]" }], returns: "Int" },
    samples: [
      { id: "sample-1", name: "short middle window", args: [7, [2, 3, 1, 2, 4, 3]], expected: 2 },
      { id: "sample-2", name: "no valid window", args: [11, [1, 1, 1, 1]], expected: 0 },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [5, []], expected: 0 },
      { id: "hidden-single", name: "single value", args: [7, [7]], expected: 1 },
      { id: "hidden-exact", name: "exact sum", args: [5, [2, 3]], expected: 2 },
      { id: "hidden-one", name: "single element wins", args: [4, [1, 4, 4]], expected: 1 },
    ],
  }),
  freezeChallenge({
    language: "swift",
    key: "swift-independent-array-copies",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Independent Array Copies in Swift",
    difficulty: "Easy",
    estimatedMinutes: 8,
    summary: "Create two independent value-semantic copies before mutating them.",
    prompt: "Implement makeIndependentCopies(_ values: [Int], _ first: Int, _ second: Int) -> [[Int]]. Start two mutable copies from values, append first to one and second to the other, and return [firstCopy, secondCopy]. The original values must remain unchanged.",
    constraints: [
      "0 <= values.count <= 100,000",
      "The two returned arrays preserve the original order before their appended value.",
      "Do not mutate the input array through an alias.",
      "Aim for O(n) total additional work.",
    ],
    tags: ["value-semantics", "copy-on-write"],
    starterCode: "import Foundation\n\nfunc makeIndependentCopies(_ values: [Int], _ first: Int, _ second: Int) -> [[Int]] {\n    // Copy the value, then mutate each copy independently.\n    return []\n}",
    entrypoint: { kind: "function", name: "makeIndependentCopies", parameters: [
      { name: "values", type: "[Int]" },
      { name: "first", type: "Int" },
      { name: "second", type: "Int" },
    ], returns: "[[Int]]" },
    samples: [
      { id: "sample-1", name: "two different appends", args: [[1, 2], 3, 4], expected: [[1, 2, 3], [1, 2, 4]] },
      { id: "sample-2", name: "empty source", args: [[], -1, 5], expected: [[-1], [5]] },
    ],
    hiddenCases: [
      { id: "hidden-single", name: "single source value", args: [[9], 0, 0], expected: [[9, 0], [9, 0]] },
      { id: "hidden-negative", name: "negative values", args: [[-3, 2], -8, 11], expected: [[-3, 2, -8], [-3, 2, 11]] },
      { id: "hidden-duplicates", name: "duplicate appends", args: [[4, 4], 4, 4], expected: [[4, 4, 4], [4, 4, 4]] },
      { id: "hidden-order", name: "preserve original order", args: [[5, 1, 9], 2, 8], expected: [[5, 1, 9, 2], [5, 1, 9, 8]] },
    ],
  }),
]);

const CHALLENGES = Object.freeze([
  ...PYTHON_CHALLENGES,
  ...SWIFT_CHALLENGES,
]);

const CHALLENGE_BY_KEY = new Map(CHALLENGES.map((entry) => [entry.key, entry]));

export function trustedChallengeForKey(key) {
  return CHALLENGE_BY_KEY.get(String(key ?? "")) ?? null;
}

export function trustedChallengeForSequence(sequence, language = "python") {
  const index = Number.isInteger(sequence) && sequence >= 0 ? sequence : 0;
  const bank = language === "swift" ? SWIFT_CHALLENGES : PYTHON_CHALLENGES;
  return bank[index % bank.length];
}

export function publicTrustedChallenge(challenge) {
  if (!challenge) return null;
  return {
    key: challenge.key,
    language: challenge.language,
    runtime: challenge.runtime,
    contentRevision: challenge.contentRevision,
    judgeRevision: challenge.judgeRevision,
    title: challenge.title,
    difficulty: challenge.difficulty,
    estimatedMinutes: challenge.estimatedMinutes,
    summary: challenge.summary,
    prompt: challenge.prompt,
    constraints: [...challenge.constraints],
    tags: [...challenge.tags],
    starterCode: challenge.starterCode,
    entrypoint: {
      ...challenge.entrypoint,
      ...(Array.isArray(challenge.entrypoint.parameters)
        ? { parameters: challenge.entrypoint.parameters.map((entry) => ({ ...entry })) }
        : {}),
    },
    samples: challenge.samples.map((testCase) => ({
      id: testCase.id,
      name: testCase.name,
      args: structuredClone(testCase.args),
      expected: structuredClone(testCase.expected),
    })),
  };
}

export function privateJudgeSpec(challenge) {
  if (!challenge) return null;
  return {
    protocolVersion: 1,
    language: challenge.language,
    runtime: challenge.runtime,
    contentRevision: challenge.contentRevision,
    judgeRevision: challenge.judgeRevision,
    entrypoint: {
      ...challenge.entrypoint,
      ...(Array.isArray(challenge.entrypoint.parameters)
        ? { parameters: challenge.entrypoint.parameters.map((entry) => ({ ...entry })) }
        : {}),
    },
    cases: [...challenge.samples, ...challenge.hiddenCases].map((testCase) => ({
      id: testCase.id,
      visibility: testCase.id.startsWith("sample-") ? "sample" : "hidden",
      name: testCase.name,
      args: structuredClone(testCase.args),
      expected: structuredClone(testCase.expected),
      comparator: "deepEqual",
    })),
  };
}

export function publicExampleJudgeSpec(challenge) {
  if (!challenge) return null;
  return {
    protocolVersion: 1,
    language: challenge.language,
    runtime: challenge.runtime,
    contentRevision: challenge.contentRevision,
    judgeRevision: challenge.judgeRevision,
    entrypoint: {
      ...challenge.entrypoint,
      ...(Array.isArray(challenge.entrypoint.parameters)
        ? { parameters: challenge.entrypoint.parameters.map((entry) => ({ ...entry })) }
        : {}),
    },
    cases: challenge.samples.map((testCase) => ({
      id: testCase.id,
      visibility: "sample",
      name: testCase.name,
      args: structuredClone(testCase.args),
      expected: structuredClone(testCase.expected),
      comparator: "deepEqual",
    })),
  };
}

export function cleanTrustedId(value, limit = MAX_CLIENT_ID) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length > limit) return null;
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(normalized)
    ? normalized
    : null;
}

export function cleanTrustedSource(value) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n?/g, "\n");
  const bytes = new TextEncoder().encode(normalized).byteLength;
  if (bytes < 1 || bytes > MAX_TRUSTED_SOURCE_BYTES) return null;
  return normalized;
}

function canonicalJson(value) {
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new Error("UNSUPPORTED_TRUSTED_CASE_VALUE");
  return serialized;
}

function pythonCallableHarness(source, entrypointName) {
  const embeddedSource = JSON.stringify(source);
  const embeddedEntrypoint = JSON.stringify(entrypointName);
  return [
    "import json as __swift_ghost_json",
    "import sys as __swift_ghost_sys",
    "import io as __swift_ghost_io",
    `__swift_ghost_source = ${embeddedSource}`,
    "__swift_ghost_scope = {'__name__': '__swift_ghost_submission__'}",
    "__swift_ghost_saved_stdio = (__swift_ghost_sys.stdin, __swift_ghost_sys.stdout, __swift_ghost_sys.stderr)",
    "try:",
    "    __swift_ghost_sys.stdin = __swift_ghost_io.StringIO('')",
    "    __swift_ghost_sys.stdout = __swift_ghost_io.StringIO()",
    "    __swift_ghost_sys.stderr = __swift_ghost_io.StringIO()",
    "    exec(compile(__swift_ghost_source, '<submission>', 'exec'), __swift_ghost_scope, __swift_ghost_scope)",
    "except SystemExit as __swift_ghost_exit:",
    "    raise RuntimeError('submission exited before its required entrypoint was called') from __swift_ghost_exit",
    "finally:",
    "    (__swift_ghost_sys.stdin, __swift_ghost_sys.stdout, __swift_ghost_sys.stderr) = __swift_ghost_saved_stdio",
    "__swift_ghost_payload = __swift_ghost_json.loads(__swift_ghost_sys.stdin.read())",
    `__swift_ghost_entrypoint = __swift_ghost_scope.get(${embeddedEntrypoint})`,
    "if not callable(__swift_ghost_entrypoint):",
    "    raise TypeError('required entrypoint is not callable')",
    "__swift_ghost_result = __swift_ghost_entrypoint(*__swift_ghost_payload['args'])",
    "__swift_ghost_sys.stdout.write(__swift_ghost_json.dumps(",
    "    __swift_ghost_result, ensure_ascii=False, sort_keys=True, separators=(',', ':')",
    "))",
    "__swift_ghost_sys.stdout.write('\\n')",
    "",
  ].join("\n");
}

const SWIFT_TYPES = new Set([
  "Int",
  "Bool",
  "String",
  "[Int]",
  "[String]",
  "[[Int]]",
]);

function validSwiftEntrypoint(entrypoint) {
  return (
    entrypoint &&
    typeof entrypoint === "object" &&
    !Array.isArray(entrypoint) &&
    entrypoint.kind === "function" &&
    /^[A-Za-z_][A-Za-z0-9_]{0,95}$/.test(entrypoint.name) &&
    Array.isArray(entrypoint.parameters) &&
    entrypoint.parameters.length >= 1 &&
    entrypoint.parameters.length <= 8 &&
    entrypoint.parameters.every(
      (parameter) =>
        parameter &&
        typeof parameter === "object" &&
        !Array.isArray(parameter) &&
        /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(parameter.name) &&
        SWIFT_TYPES.has(parameter.type),
    ) &&
    SWIFT_TYPES.has(entrypoint.returns)
  );
}

function swiftCallableHarness(source, entrypoint) {
  if (!validSwiftEntrypoint(entrypoint))
    throw new Error("INVALID_TRUSTED_JUDGE_SPEC");
  const declarations = entrypoint.parameters.map(
    (parameter, index) => "    let arg" + index + ": " + parameter.type,
  );
  const decodes = entrypoint.parameters.map(
    (parameter, index) =>
      "        self.arg" + index + " = try args.decode(" + parameter.type + ".self)",
  );
  const call = entrypoint.parameters
    .map((_, index) => "__swiftGhostInput.arg" + index)
    .join(", ");
  return [
    source,
    "",
    "private struct __SwiftGhostInput: Decodable {",
    ...declarations,
    "    private enum CodingKeys: String, CodingKey { case args }",
    "    init(from decoder: Decoder) throws {",
    "        let root = try decoder.container(keyedBy: CodingKeys.self)",
    "        var args = try root.nestedUnkeyedContainer(forKey: .args)",
    ...decodes,
    "        if !args.isAtEnd {",
    "            throw DecodingError.dataCorruptedError(in: args, debugDescription: \"Unexpected extra argument\")",
    "        }",
    "    }",
    "}",
    "",
    "@main",
    "private struct __SwiftGhostMain {",
    "    static func main() throws {",
    "        let __swiftGhostData = FileHandle.standardInput.readDataToEndOfFile()",
    "        let __swiftGhostInput = try JSONDecoder().decode(__SwiftGhostInput.self, from: __swiftGhostData)",
    "        let __swiftGhostResult: " + entrypoint.returns + " = " + entrypoint.name + "(" + call + ")",
    "        let __swiftGhostEncoder = JSONEncoder()",
    "        __swiftGhostEncoder.outputFormatting = [.sortedKeys]",
    "        let __swiftGhostOutput = try __swiftGhostEncoder.encode(__swiftGhostResult)",
    "        FileHandle.standardOutput.write(__swiftGhostOutput)",
    "        FileHandle.standardOutput.write(Data([0x0A]))",
    "    }",
    "}",
    "",
  ].join("\n");
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (entry) =>
    entry.toString(16).padStart(2, "0")
  ).join("");
}

export async function trustedJudgeContractDigest(judgeSpec) {
  return sha256Hex(canonicalJson(judgeSpec));
}

export async function trustedGatewaySubmission({
  submissionId,
  source,
  judgeSpec,
  callbackUrl,
}) {
  if (
    !cleanTrustedId(submissionId, 160) ||
    cleanTrustedSource(source) !== source ||
    typeof callbackUrl !== "string"
  )
    throw new Error("INVALID_TRUSTED_GATEWAY_INPUT");
  let parsedCallback;
  try {
    parsedCallback = new URL(callbackUrl);
  } catch {
    throw new Error("INVALID_TRUSTED_GATEWAY_INPUT");
  }
  if (
    parsedCallback.protocol !== "https:" ||
    parsedCallback.username ||
    parsedCallback.password ||
    parsedCallback.hash
  )
    throw new Error("INVALID_TRUSTED_GATEWAY_INPUT");
  if (
    !judgeSpec ||
    typeof judgeSpec !== "object" ||
    Array.isArray(judgeSpec) ||
    judgeSpec.protocolVersion !== 1 ||
    (judgeSpec.language !== "python" && judgeSpec.language !== "swift") ||
    typeof judgeSpec.runtime !== "string" ||
    judgeSpec.runtime.length < 1 ||
    judgeSpec.runtime.length > 80 ||
    !Number.isInteger(judgeSpec.contentRevision) ||
    judgeSpec.contentRevision < 1 ||
    !Number.isInteger(judgeSpec.judgeRevision) ||
    judgeSpec.judgeRevision < 1 ||
    !judgeSpec.entrypoint ||
    judgeSpec.entrypoint.kind !== "function" ||
    !/^[A-Za-z_][A-Za-z0-9_]{0,95}$/.test(judgeSpec.entrypoint.name) ||
    !Array.isArray(judgeSpec.cases) ||
    judgeSpec.cases.length < 1 ||
    judgeSpec.cases.length > 64
  )
    throw new Error("INVALID_TRUSTED_JUDGE_SPEC");
  const expectedRuntime = judgeSpec.language === "swift"
    ? "swift-6.3.3-linux"
    : "python-3.13-linux";
  if (judgeSpec.runtime !== expectedRuntime)
    throw new Error("INVALID_TRUSTED_JUDGE_SPEC");
  if (judgeSpec.language === "swift" && !validSwiftEntrypoint(judgeSpec.entrypoint))
    throw new Error("INVALID_TRUSTED_JUDGE_SPEC");
  const wrappedSource = judgeSpec.language === "swift"
    ? swiftCallableHarness(source, judgeSpec.entrypoint)
    : pythonCallableHarness(source, judgeSpec.entrypoint.name);
  if (new TextEncoder().encode(wrappedSource).byteLength > 48_000)
    throw new Error("TRUSTED_GATEWAY_SOURCE_TOO_LARGE");
  const contractDigest = await trustedJudgeContractDigest(judgeSpec);
  const gatewayRequest = {
    version: "judge.submission.v1",
    submissionId,
    language: judgeSpec.language === "swift" ? "swift6" : "python3",
    runtime: judgeSpec.runtime,
    contentRevision: judgeSpec.contentRevision,
    judgeRevision: judgeSpec.judgeRevision,
    contractDigest,
    source: wrappedSource,
    comparison: "exact",
    tests: judgeSpec.cases.map((testCase) => {
      if (
        !testCase ||
        typeof testCase !== "object" ||
        Array.isArray(testCase) ||
        !cleanTrustedId(testCase.id, 160) ||
        !Array.isArray(testCase.args) ||
        testCase.comparator !== "deepEqual"
      )
        throw new Error("INVALID_TRUSTED_JUDGE_SPEC");
      const input = `${canonicalJson({ args: testCase.args })}\n`;
      const expectedOutput = `${canonicalJson(testCase.expected)}\n`;
      if (
        new TextEncoder().encode(input).byteLength > 32_000 ||
        new TextEncoder().encode(expectedOutput).byteLength > 32_000
      )
        throw new Error("TRUSTED_GATEWAY_CASE_TOO_LARGE");
      return {
        id: testCase.id,
        input,
        expectedOutput,
        // The gateway uses this explicit marker to decide whether it may
        // return bounded observed output. Omitted/unknown visibility fails
        // closed as hidden at ingress.
        visibility: testCase.visibility === "sample" ? "sample" : "hidden",
      };
    }),
    callbackUrl: parsedCallback.toString(),
  };
  if (
    new TextEncoder().encode(JSON.stringify(gatewayRequest)).byteLength >
    120_000
  )
    throw new Error("TRUSTED_GATEWAY_REQUEST_TOO_LARGE");
  return gatewayRequest;
}

export async function trustedGatewayExampleRun({
  submissionId,
  source,
  judgeSpec,
}) {
  const gatewayRequest = await trustedGatewaySubmission({
    submissionId,
    source,
    judgeSpec,
    callbackUrl: "https://swift-ghost.invalid/example-callback",
  });
  const { callbackUrl, ...sampleRequest } = gatewayRequest;
  void callbackUrl;
  return sampleRequest;
}

export function normalizeTrustedGatewayResult(
  value,
  submissionId,
  expected,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const verdicts = new Set([
    "accepted",
    "wrong-answer",
    "compile-error",
    "runtime-error",
    "time-limit",
    "judge-error",
  ]);
  const verdict = verdicts.has(value.verdict) ? value.verdict : null;
  const total = Number(value.total);
  const passed = Number(value.passed);
  const failedCaseIndex = value.failedCaseIndex === undefined
    ? null
    : Number(value.failedCaseIndex);
  const expectedLanguage = expected.language === "swift" ? "swift6" : "python3";
  if (
    value.version !== "judge.result.v1" ||
    value.submissionId !== submissionId ||
    !verdict ||
    !Number.isInteger(total) ||
    total !== expected.total ||
    value.language !== expectedLanguage ||
    value.runtime !== expected.runtime ||
    value.contentRevision !== expected.contentRevision ||
    value.judgeRevision !== expected.judgeRevision ||
    value.contractDigest !== expected.contractDigest ||
    !Number.isInteger(passed) ||
    passed < 0 ||
    passed > total ||
    (verdict === "accepted" && passed !== total) ||
    (verdict === "wrong-answer" && passed >= total) ||
    (failedCaseIndex !== null &&
      (!Number.isInteger(failedCaseIndex) ||
        failedCaseIndex < 0 ||
        failedCaseIndex >= total)) ||
    (verdict === "accepted" && failedCaseIndex !== null)
  )
    return null;
  return {
    verdict,
    passed,
    total,
    language: expected.language,
    runtime: expected.runtime,
    contentRevision: expected.contentRevision,
    judgeRevision: expected.judgeRevision,
    contractDigest: expected.contractDigest,
  };
}

export function normalizeTrustedGatewayExampleResult(
  value,
  submissionId,
  expected,
) {
  const result = normalizeTrustedGatewayResult(value, submissionId, expected);
  if (!result) return null;
  const failedCaseIndex = value.failedCaseIndex === undefined
    ? null
    : Number(value.failedCaseIndex);
  const diagnostic = typeof value.diagnostic === "string"
    ? value.diagnostic
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .trim()
        .slice(0, 2_000)
    : "";
  const publicCaseResults = normalizeTrustedPublicCaseResults(
    value,
    expected.publicCaseIds,
  );
  if (expected.publicCaseIds && publicCaseResults === null) return null;
  return {
    ...result,
    ...(failedCaseIndex === null ? {} : { failedCaseIndex }),
    ...(diagnostic ? { diagnostic } : {}),
    ...(publicCaseResults === undefined ? {} : { publicCaseResults }),
  };
}

const PUBLIC_CASE_RESULT_KEYS = ["caseResults", "publicCaseResults", "cases", "results"];
const PUBLIC_CASE_STATUSES = new Set([
  "passed",
  "failed",
  "wrong-answer",
  "compile-error",
  "runtime-error",
  "time-limit",
  "judge-error",
  "not-run",
]);
// The gateway permits a larger per-case envelope, but the settled D1 row is
// capped at 8 KiB. Keep the persisted projection smaller so two public Swift
// samples plus verdict metadata always fit that schema bound.
const MAX_PUBLIC_CASE_OUTPUT_BYTES = 2_048;

function cleanPublicCaseText(value, limit = MAX_PUBLIC_CASE_OUTPUT_BYTES) {
  if (typeof value !== "string") return undefined;
  const clean = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  const bytes = new TextEncoder().encode(clean);
  if (bytes.byteLength <= limit) return clean;
  const codePoints = Array.from(clean);
  let low = 0;
  let high = codePoints.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = codePoints.slice(0, middle).join("");
    if (new TextEncoder().encode(candidate).byteLength <= limit) low = middle;
    else high = middle - 1;
  }
  return codePoints.slice(0, low).join("");
}

/**
 * Keep only sample-level execution facts from the gateway. The gateway may
 * use `caseResults`, `cases`, or `results` depending on its result adapter;
 * the Worker emits one stable, sample-only shape. Expected output, inputs,
 * and any hidden case are deliberately never copied into this projection.
 *
 * `undefined` means the older aggregate-only gateway result did not include
 * per-case data. `null` means a supplied per-case payload failed validation.
 */
export function normalizeTrustedPublicCaseResults(value, publicCaseIds) {
  if (!Array.isArray(publicCaseIds)) return undefined;
  if (
    publicCaseIds.length < 1 ||
    publicCaseIds.length > 64 ||
    publicCaseIds.some((id) => !cleanTrustedId(id, 160))
  )
    return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  let rawResults;
  for (const key of PUBLIC_CASE_RESULT_KEYS) {
    if (Object.hasOwn(value, key)) {
      rawResults = value[key];
      break;
    }
  }
  // Keep compatibility with callbacks produced before per-case reporting.
  if (rawResults === undefined) return undefined;
  if (!Array.isArray(rawResults) || rawResults.length !== publicCaseIds.length)
    return null;

  const normalized = [];
  for (let index = 0; index < rawResults.length; index += 1) {
    const raw = rawResults[index];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const expectedId = publicCaseIds[index];
    const id = cleanTrustedId(raw.id ?? raw.caseId, 160);
    // Require the gateway to return the exact public case set, in order. A
    // hidden id or an omitted sample therefore fails closed instead of being
    // accidentally persisted and rendered to the learner.
    if (id !== expectedId) return null;
    if (
      raw.visibility !== undefined &&
      raw.visibility !== "sample" &&
      raw.visibility !== "public"
    )
      return null;
    const status = typeof raw.status === "string" && PUBLIC_CASE_STATUSES.has(raw.status)
      ? raw.status
      : undefined;
    if (raw.status !== undefined && !status) return null;
    const normalizedStatus = status ?? (typeof raw.passed === "boolean"
      ? raw.passed ? "passed" : "failed"
      : undefined);
    if (!normalizedStatus) return null;
    const actualOutput = cleanPublicCaseText(
      raw.actualOutput ?? raw.actual ?? raw.output,
    );
    const diagnostic = cleanPublicCaseText(raw.diagnostic, 2_000);
    const entry = {
      id,
      status: normalizedStatus,
      ...(actualOutput ? { actualOutput } : {}),
      ...(diagnostic ? { diagnostic } : {}),
    };
    normalized.push(entry);
  }
  return normalized;
}

export function normalizeTrustedJudgeResult(value, expectedTotal) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const verdicts = new Set([
    "accepted",
    "wrong-answer",
    "compile-error",
    "runtime-error",
    "time-limit",
    "judge-error",
  ]);
  const verdict = verdicts.has(value.verdict) ? value.verdict : null;
  const total = Number(value.total);
  const passed = Number(value.passed);
  const durationMs = Number(value.durationMs);
  if (
    !verdict ||
    !Number.isInteger(total) ||
    total !== expectedTotal ||
    !Number.isInteger(passed) ||
    passed < 0 ||
    passed > total ||
    !Number.isInteger(durationMs) ||
    durationMs < 0 ||
    durationMs > 120_000 ||
    (verdict === "accepted" && passed !== total)
  )
    return null;
  return {
    verdict,
    passed,
    total,
    durationMs,
    runtime: typeof value.runtime === "string"
      ? value.runtime.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80)
      : "isolated-python",
  };
}

export const TRUSTED_CHALLENGE_COUNT = PYTHON_CHALLENGES.length;
export const TRUSTED_SWIFT_CHALLENGE_COUNT = SWIFT_CHALLENGES.length;
