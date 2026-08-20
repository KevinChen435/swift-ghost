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
  swiftChallenge({
    language: "swift",
    key: "swift-contains-duplicate",
    runtime: "swift-6.3.3-linux",
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
    tags: ["swift", "hash-set", "arrays"],
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
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-longest-consecutive",
    runtime: "swift-6.3.3-linux",
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
    tags: ["swift", "hash-set", "arrays"],
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
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-subarray-sum-count",
    runtime: "swift-6.3.3-linux",
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
    tags: ["swift", "prefix-sum", "hash-map"],
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
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-three-sum",
    runtime: "swift-6.3.3-linux",
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
    tags: ["swift", "two-pointers", "sorting"],
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
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-valid-palindrome",
    runtime: "swift-6.3.3-linux",
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
    tags: ["swift", "two-pointers", "string"],
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
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-daily-temperatures",
    runtime: "swift-6.3.3-linux",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Daily Temperatures in Swift",
    difficulty: "Medium",
    estimatedMinutes: 18,
    summary: "Use a monotonic stack to find each next warmer day.",
    prompt:
      "Implement dailyTemperatures(_ temperatures: [Int]) -> [Int]. For each day, return how many days must pass before a strictly warmer temperature occurs, or 0 if none occurs.",
    constraints: [
      "0 <= temperatures.count <= 100,000",
      "30 <= temperatures[i] <= 100",
      "The output has the same length as the input.",
      "Aim for O(n) time.",
    ],
    tags: ["swift", "stack", "monotonic-stack"],
    starterCode:
      "import Foundation\n\nfunc dailyTemperatures(_ temperatures: [Int]) -> [Int] {\n    // Keep unresolved indices in decreasing temperature order.\n    return []\n}",
    entrypoint: {
      kind: "function",
      name: "dailyTemperatures",
      parameters: [{ name: "temperatures", type: "[Int]" }],
      returns: "[Int]",
    },
    samples: [
      { id: "sample-1", name: "mixed forecast", args: [[73, 74, 75, 71, 69, 72, 76, 73]], expected: [1, 1, 4, 2, 1, 1, 0, 0] },
      { id: "sample-2", name: "no warmer day", args: [[80, 79, 78]], expected: [0, 0, 0] },
    ],
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-search-rotated",
    runtime: "swift-6.3.3-linux",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Search Rotated Array in Swift",
    difficulty: "Medium",
    estimatedMinutes: 18,
    summary: "Binary-search a sorted array after one rotation.",
    prompt:
      "Implement searchRotated(_ nums: [Int], _ target: Int) -> Int. nums contains unique values from an ascending array rotated at an unknown pivot. Return the target index or -1 when absent.",
    constraints: [
      "0 <= nums.count <= 100,000",
      "nums contains unique integers.",
      "The original array was strictly increasing.",
      "Aim for O(log n) time.",
    ],
    tags: ["swift", "binary-search", "arrays"],
    starterCode:
      "import Foundation\n\nfunc searchRotated(_ nums: [Int], _ target: Int) -> Int {\n    // Identify which half remains sorted at each step.\n    return -1\n}",
    entrypoint: {
      kind: "function",
      name: "searchRotated",
      parameters: [
        { name: "nums", type: "[Int]" },
        { name: "target", type: "Int" },
      ],
      returns: "Int",
    },
    samples: [
      { id: "sample-1", name: "target after pivot", args: [[4, 5, 6, 7, 0, 1, 2], 0], expected: 4 },
      { id: "sample-2", name: "target absent", args: [[4, 5, 6, 7, 0, 1, 2], 3], expected: -1 },
    ],
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-koko-bananas",
    runtime: "swift-6.3.3-linux",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Koko Eating Bananas in Swift",
    difficulty: "Medium",
    estimatedMinutes: 20,
    summary: "Binary-search the smallest speed that meets a deadline.",
    prompt:
      "Implement minEatingSpeed(_ piles: [Int], _ hours: Int) -> Int. At speed k, one pile takes ceil(pile / k) hours. Return the smallest positive integer k that finishes every pile within hours.",
    constraints: [
      "1 <= piles.count <= 100,000",
      "1 <= piles[i] <= 1,000,000,000",
      "piles.count <= hours <= 1,000,000,000",
      "Aim for O(n log max(piles)) time.",
    ],
    tags: ["swift", "binary-search", "search-space"],
    starterCode:
      "import Foundation\n\nfunc minEatingSpeed(_ piles: [Int], _ hours: Int) -> Int {\n    // Search the smallest speed whose required hours fit the limit.\n    return 0\n}",
    entrypoint: {
      kind: "function",
      name: "minEatingSpeed",
      parameters: [
        { name: "piles", type: "[Int]" },
        { name: "hours", type: "Int" },
      ],
      returns: "Int",
    },
    samples: [
      { id: "sample-1", name: "three piles", args: [[3, 6, 7, 11], 8], expected: 4 },
      { id: "sample-2", name: "one hour per pile", args: [[30, 11, 23, 4, 20], 5], expected: 30 },
    ],
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-erase-overlap-intervals",
    runtime: "swift-6.3.3-linux",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Erase Overlapping Intervals in Swift",
    difficulty: "Medium",
    estimatedMinutes: 16,
    summary: "Keep the largest compatible set of non-overlapping intervals.",
    prompt:
      "Implement eraseOverlapIntervals(_ intervals: [[Int]]) -> Int. Each interval is [start, end] with start < end. Return the minimum number of intervals to remove so the remaining intervals do not overlap. Touching endpoints are allowed.",
    constraints: [
      "0 <= intervals.count <= 100,000",
      "Every interval contains exactly two integers with start < end.",
      "-1,000,000 <= start < end <= 1,000,000",
      "Aim for O(n log n) time.",
    ],
    tags: ["swift", "intervals", "greedy"],
    starterCode:
      "import Foundation\n\nfunc eraseOverlapIntervals(_ intervals: [[Int]]) -> Int {\n    // Keep the interval with the earliest finishing boundary.\n    return 0\n}",
    entrypoint: {
      kind: "function",
      name: "eraseOverlapIntervals",
      parameters: [{ name: "intervals", type: "[[Int]]" }],
      returns: "Int",
    },
    samples: [
      { id: "sample-1", name: "remove one overlap", args: [[[1, 2], [2, 3], [3, 4], [1, 3]]], expected: 1 },
      { id: "sample-2", name: "keep disjoint intervals", args: [[[1, 2], [2, 3]]], expected: 0 },
    ],
  }),
  swiftChallenge({
    language: "swift",
    key: "swift-minimum-size-window",
    runtime: "swift-6.3.3-linux",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Minimum Size Window in Swift",
    difficulty: "Medium",
    estimatedMinutes: 16,
    summary: "Shrink a positive sliding window to its shortest valid length.",
    prompt:
      "Implement minSubarrayLength(_ target: Int, _ nums: [Int]) -> Int. nums contains positive integers. Return the minimum length of a contiguous subarray whose sum is at least target, or 0 if no such subarray exists.",
    constraints: [
      "1 <= target <= 1,000,000,000",
      "0 <= nums.count <= 100,000",
      "1 <= nums[i] <= 100,000",
      "Aim for O(n) time.",
    ],
    tags: ["swift", "sliding-window", "positive-array"],
    starterCode:
      "import Foundation\n\nfunc minSubarrayLength(_ target: Int, _ nums: [Int]) -> Int {\n    // Expand until valid, then shrink from the left.\n    return 0\n}",
    entrypoint: {
      kind: "function",
      name: "minSubarrayLength",
      parameters: [
        { name: "target", type: "Int" },
        { name: "nums", type: "[Int]" },
      ],
      returns: "Int",
    },
    samples: [
      { id: "sample-1", name: "short middle window", args: [7, [2, 3, 1, 2, 4, 3]], expected: 2 },
      { id: "sample-2", name: "no valid window", args: [11, [1, 1, 1, 1]], expected: 0 },
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
