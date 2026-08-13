/**
 * Public contract metadata for the trusted Swift challenge bank.
 *
 * This module intentionally contains only the prompt, starter, and visible
 * examples. The worker owns the sealed cases and the private judge payload;
 * keeping this projection in the app bundle prevents hidden expectations from
 * becoming client-readable.
 */

export type SwiftChallengeParameter = {
  name: string;
  type: string;
};

export type SwiftChallengeEntrypoint = {
  kind: "function";
  name: string;
  parameters: readonly SwiftChallengeParameter[];
  returns: string;
};

export type SwiftChallengeSample = {
  id: string;
  name: string;
  args: readonly unknown[];
  expected: unknown;
};

export type SwiftChallengeMetadata = {
  key: `swift-${string}`;
  language: "swift";
  runtime: "swift-6.3.3-linux";
  contentRevision: number;
  judgeRevision: number;
  title: string;
  difficulty: "Easy" | "Medium";
  estimatedMinutes: number;
  summary: string;
  prompt: string;
  constraints: readonly [string, ...string[]];
  tags: readonly string[];
  starterCode: string;
  entrypoint: SwiftChallengeEntrypoint;
  samples: readonly [SwiftChallengeSample, SwiftChallengeSample];
};

const swiftChallenge = (
  challenge: SwiftChallengeMetadata,
): SwiftChallengeMetadata => challenge;

export const SWIFT_CHALLENGES = [
  swiftChallenge({
    language: "swift",
    key: "swift-two-sum",
    runtime: "swift-6.3.3-linux",
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
      {
        id: "sample-1",
        name: "pair at the front",
        args: [[2, 7, 11, 15], 9],
        expected: [0, 1],
      },
      {
        id: "sample-2",
        name: "pair crosses the middle",
        args: [[3, 2, 4], 6],
        expected: [1, 2],
      },
    ],
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-valid-parentheses",
    runtime: "swift-6.3.3-linux",
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
      {
        id: "sample-1",
        name: "nested pairs",
        args: ["([]{})"],
        expected: true,
      },
      {
        id: "sample-2",
        name: "crossed pair",
        args: ["([)]"],
        expected: false,
      },
    ],
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-stable-window",
    runtime: "swift-6.3.3-linux",
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
      {
        id: "sample-1",
        name: "contracts after a spike",
        args: [[8, 2, 4, 7], 4],
        expected: 2,
      },
      {
        id: "sample-2",
        name: "repeated stable range",
        args: [[10, 1, 2, 4, 7, 2], 5],
        expected: 4,
      },
    ],
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-merge-intervals",
    runtime: "swift-6.3.3-linux",
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
      {
        id: "sample-1",
        name: "overlap and touch",
        args: [[[1, 3], [2, 4], [7, 9], [9, 10]]],
        expected: [[1, 4], [7, 10]],
      },
      {
        id: "sample-2",
        name: "unsorted containment",
        args: [[[8, 12], [2, 6], [3, 4]]],
        expected: [[2, 6], [8, 12]],
      },
    ],
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-first-complete-group",
    runtime: "swift-6.3.3-linux",
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
      {
        id: "sample-1",
        name: "completes after all labels",
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
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-binary-search",
    runtime: "swift-6.3.3-linux",
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
      {
        id: "sample-1",
        name: "target present",
        args: [[-1, 0, 3, 5, 9, 12], 9],
        expected: 4,
      },
      {
        id: "sample-2",
        name: "target absent",
        args: [[-1, 0, 3, 5, 9, 12], 2],
        expected: -1,
      },
    ],
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-max-profit",
    runtime: "swift-6.3.3-linux",
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
      {
        id: "sample-1",
        name: "profitable trade",
        args: [[7, 1, 5, 3, 6, 4]],
        expected: 5,
      },
      {
        id: "sample-2",
        name: "falling prices",
        args: [[7, 6, 4, 3, 1]],
        expected: 0,
      },
    ],
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-product-except-self",
    runtime: "swift-6.3.3-linux",
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
      {
        id: "sample-1",
        name: "positive values",
        args: [[1, 2, 3, 4]],
        expected: [24, 12, 8, 6],
      },
      {
        id: "sample-2",
        name: "one zero",
        args: [[-1, 1, 0, -3, 3]],
        expected: [0, 0, 9, 0, 0],
      },
    ],
  }),
] as const;

export type SwiftChallengeKey = (typeof SWIFT_CHALLENGES)[number]["key"];

const BY_KEY = new Map<string, SwiftChallengeMetadata>(
  SWIFT_CHALLENGES.map((challenge) => [challenge.key, challenge]),
);

export function getSwiftChallenge(
  key: string | undefined,
): SwiftChallengeMetadata | undefined {
  return key ? BY_KEY.get(key) : undefined;
}
