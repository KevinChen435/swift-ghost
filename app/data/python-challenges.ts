export type PythonChallengeParameter = {
  name: string;
  type: string;
  description: string;
};

export type PythonChallengeMetadata = {
  id: number | string;
  title: string;
  statement: string;
  entrypoint: string;
  parameters: readonly PythonChallengeParameter[];
  returns: string;
  notes?: readonly string[];
  constraints: readonly [string, ...string[]];
  exampleExplanation?: string;
};

/**
 * Original, self-contained task copy for every item in the Python curriculum.
 * Numeric keys intentionally match the stable curriculum/problem IDs.
 */
export const PYTHON_CHALLENGES = {
  10001: {
    id: 10001,
    title: "Frequency Map Warm-up",
    statement:
      "Normalize each word by trimming surrounding whitespace and converting it to lowercase. Ignore words that become empty, count the rest, and report the most frequent normalized word. Break frequency ties by choosing the alphabetically smaller word.",
    entrypoint: "most_common_word(words)",
    parameters: [
      { name: "words", type: "list[str]", description: "Raw words to normalize and count." },
    ],
    returns:
      "tuple[str, int] | None — the chosen normalized word and its count, or None when no nonempty word remains.",
    constraints: [
      "words may be empty.",
      "Every element of words is a string.",
      "Only surrounding whitespace is removed; internal characters are preserved.",
      "The alphabetical tie break uses Python string ordering after lowercasing.",
    ],
    exampleExplanation:
      "For [' Pear ', 'apple', 'PEAR'], the normalized counts are pear: 2 and apple: 1, so return ('pear', 2).",
  },
  10002: {
    id: 10002,
    title: "Stable Deduplication",
    statement:
      "Remove repeated integers while preserving the order in which distinct values first appear.",
    entrypoint: "unique_in_order(values)",
    parameters: [
      { name: "values", type: "list[int]", description: "Integers in their original order." },
    ],
    returns: "list[int] — one copy of each value, ordered by first occurrence.",
    constraints: [
      "values may be empty.",
      "Integers may be negative, zero, or positive.",
      "Do not sort the result.",
      "Do not mutate the input list.",
    ],
    exampleExplanation: "[3, 1, 3, 2, 1] becomes [3, 1, 2].",
  },
  10003: {
    id: 10003,
    title: "Enumerate, Zip, and Unpack",
    statement:
      "Compare two sequences position by position. For every position whose strings differ, record the index, the expected value, and the actual value. Reject inputs with different lengths.",
    entrypoint: "indexed_mismatches(expected, actual)",
    parameters: [
      { name: "expected", type: "list[str]", description: "Reference sequence." },
      { name: "actual", type: "list[str]", description: "Observed sequence." },
    ],
    returns:
      "list[tuple[int, str, str]] — mismatches in increasing index order, each shaped as (index, expected_value, actual_value).",
    notes: ["Raise ValueError when the input lengths differ."],
    constraints: [
      "Both inputs may be empty.",
      "Indices are zero-based.",
      "String comparison is case-sensitive.",
      "Equal positions must not appear in the output.",
    ],
    exampleExplanation:
      "Comparing ['a', 'b', 'c'] with ['a', 'x', 'z'] yields [(1, 'b', 'x'), (2, 'c', 'z')].",
  },
  10004: {
    id: 10004,
    title: "Sort with a Composite Key",
    statement:
      "Rank player records by score from highest to lowest. Players with the same score are ordered by name alphabetically without regard to case. Return a new list.",
    entrypoint: "rank_players(players)",
    parameters: [
      { name: "players", type: "list[tuple[str, int]]", description: "(name, score) records." },
    ],
    returns: "list[tuple[str, int]] — the ranked records.",
    constraints: [
      "players may be empty.",
      "Names are nonempty strings.",
      "Scores are integers.",
      "The input list must not be mutated.",
      "Names that normalize to the same lowercase text retain their input order.",
    ],
    exampleExplanation:
      "[('zoe', 8), ('Amy', 10), ('ben', 10)] ranks Amy, then ben, then zoe.",
  },
  10005: {
    id: 10005,
    title: "Queue with Deque",
    statement:
      "Starting at one named node, traverse a directed adjacency-list graph in breadth-first order. Visit each reachable node once, processing neighbors in the order stored in their lists.",
    entrypoint: "breadth_first_order(graph, start)",
    parameters: [
      { name: "graph", type: "dict[str, list[str]]", description: "Outgoing neighbors for known nodes." },
      { name: "start", type: "str", description: "Node where traversal begins." },
    ],
    returns: "list[str] — reachable nodes in breadth-first visitation order.",
    constraints: [
      "Node names are strings.",
      "The graph may contain cycles or repeated neighbor references.",
      "A referenced node may be absent as a key; treat it as having no outgoing edges.",
      "The start node is always included, even when it is isolated.",
    ],
    exampleExplanation:
      "With a -> [b, c], b -> [d], and c -> [d], traversal from a is [a, b, c, d].",
  },
  10006: {
    id: 10006,
    title: "Heap Tuple Ordering",
    statement:
      "Select up to limit tasks from a task list. Lower numeric priority runs first; equal priorities are ordered by lower submission sequence, then alphabetically by task name when both keys tie. Return only the selected task names.",
    entrypoint: "next_tasks(tasks, limit)",
    parameters: [
      { name: "tasks", type: "list[tuple[int, int, str]]", description: "(priority, sequence, name) records." },
      { name: "limit", type: "int", description: "Maximum number of task names to return." },
    ],
    returns: "list[str] — selected names in execution order.",
    constraints: [
      "0 <= limit.",
      "Sequence numbers may repeat; a tied priority and sequence is ordered by task name.",
      "Priorities and sequence numbers are integers.",
      "Return every task when limit exceeds the task count.",
      "Do not mutate tasks.",
    ],
    exampleExplanation:
      "Tasks (2, 0, 'later'), (1, 5, 'b'), and (1, 2, 'a') are returned as ['a', 'b', 'later'].",
  },
  10007: {
    id: 10007,
    title: "Comprehensions and Generators",
    statement:
      "From a list of strings, keep values that represent base-10 integers from 0 through 100 inclusive. Preserve their order, convert them to integers, and also compute the sum of their squares.",
    entrypoint: "normalized_scores(raw_scores)",
    parameters: [
      { name: "raw_scores", type: "list[str]", description: "Candidate score strings." },
    ],
    returns:
      "tuple[list[int], int] — the accepted integer scores and their squared total.",
    constraints: [
      "raw_scores may be empty.",
      "Surrounding whitespace may be present.",
      "Negative values, values above 100, empty strings, and nonnumeric text are ignored.",
      "Accepted scores remain in input order and may repeat.",
    ],
    exampleExplanation:
      "[' 10', '-1', '101', 'x', '20'] produces ([10, 20], 500).",
  },
  10008: {
    id: 10008,
    title: "Counter and Defaultdict",
    statement:
      "Summarize a stream of (owner, event kind) pairs in one pass. Group each owner's event kinds in arrival order and separately count how often every kind occurs.",
    entrypoint: "summarize_events(events)",
    parameters: [
      { name: "events", type: "list[tuple[str, str]]", description: "Owner/kind event records." },
    ],
    returns:
      "tuple[dict[str, list[str]], Counter[str]] — per-owner ordered event kinds and global kind frequencies.",
    constraints: [
      "events may be empty.",
      "Owners and kinds are strings.",
      "Owners appear in the mapping only if they have an event.",
      "Repeated events are retained in owner lists and counted each time.",
    ],
    exampleExplanation:
      "Events (ana, open), (bo, open), (ana, close) group ana as [open, close] and count open twice, close once.",
  },
  1: {
    id: 1,
    title: "Two Sum",
    statement:
      "Find two distinct positions in an integer array whose values add to target. Return their indices, or an empty list when no pair exists.",
    entrypoint: "Solution.twoSum(nums, target)",
    parameters: [
      { name: "nums", type: "list[int]", description: "Values to search." },
      { name: "target", type: "int", description: "Required pair sum." },
    ],
    returns: "list[int] — the two zero-based indices.",
    constraints: [
      "2 <= len(nums).",
      "Zero or one valid pair exists.",
      "The same array position cannot be used twice.",
      "Values and target may be negative, zero, or positive.",
    ],
    exampleExplanation: "For nums = [2, 7, 11] and target = 9, return [0, 1].",
  },
  49: {
    id: 49,
    title: "Group Anagrams",
    statement:
      "Partition the input strings so that two strings share a group exactly when one is a rearrangement of the other's characters.",
    entrypoint: "Solution.groupAnagrams(strs)",
    parameters: [
      { name: "strs", type: "list[str]", description: "Strings to partition." },
    ],
    returns: "list[list[str]] — all anagram groups; group order does not matter.",
    constraints: [
      "strs may be empty.",
      "Strings contain lowercase English letters.",
      "Empty strings are valid and are anagrams of one another.",
      "Each input occurrence must appear exactly once in the output.",
      "Ordering within and between groups is not significant.",
    ],
    exampleExplanation:
      "['eat', 'tea', 'tan', 'ate'] forms one group containing eat, tea, ate and another containing tan.",
  },
  238: {
    id: 238,
    title: "Product of Array Except Self",
    statement:
      "Build an output array where position i contains the product of every input value except nums[i]. Do not use division.",
    entrypoint: "Solution.productExceptSelf(nums)",
    parameters: [
      { name: "nums", type: "list[int]", description: "Factors in index order." },
    ],
    returns: "list[int] — products corresponding to each input position.",
    constraints: [
      "2 <= len(nums).",
      "nums may contain negative values and zeros.",
      "Every prefix or suffix product fits in the supported integer range.",
      "Division is not allowed.",
      "The intended solution uses linear time and constant auxiliary space apart from the output.",
    ],
    exampleExplanation: "[1, 2, 3, 4] produces [24, 12, 8, 6].",
  },
  125: {
    id: 125,
    title: "Valid Palindrome",
    statement:
      "Decide whether a string reads the same forward and backward after ignoring every non-alphanumeric character and ignoring letter case.",
    entrypoint: "Solution.isPalindrome(s)",
    parameters: [
      { name: "s", type: "str", description: "Text to inspect." },
    ],
    returns: "bool — True when the normalized text is a palindrome.",
    constraints: [
      "s may be empty.",
      "Letters and digits are significant; punctuation and whitespace are ignored.",
      "Letter comparison is case-insensitive.",
      "A normalized string of length zero or one is a palindrome.",
    ],
    exampleExplanation:
      "'A man, a plan, a canal: Panama' normalizes to a palindrome, so return True.",
  },
  15: {
    id: 15,
    title: "3Sum",
    statement:
      "Find every distinct triplet of values in nums whose sum is zero. A triplet must use three different positions, and duplicate value combinations must appear only once.",
    entrypoint: "Solution.threeSum(nums)",
    parameters: [
      { name: "nums", type: "list[int]", description: "Values from which triplets are chosen." },
    ],
    returns: "list[list[int]] — all unique zero-sum triplets in any order.",
    constraints: [
      "nums may contain duplicate and negative values.",
      "A result triplet uses three distinct indices.",
      "Triplets with the same three values count as one result.",
      "Output order is not significant.",
      "An input shorter than three has no result.",
    ],
    exampleExplanation:
      "[-1, 0, 1, 2, -1, -4] has the unique value triplets [-1, -1, 2] and [-1, 0, 1].",
  },
  3: {
    id: 3,
    title: "Longest Substring Without Repeating Characters",
    statement:
      "Return the length of the longest contiguous part of s that contains no repeated character.",
    entrypoint: "Solution.lengthOfLongestSubstring(s)",
    parameters: [
      { name: "s", type: "str", description: "String to scan." },
    ],
    returns: "int — maximum length of a repetition-free substring.",
    constraints: [
      "s may be empty.",
      "Characters are compared exactly and case-sensitively.",
      "The chosen characters must be contiguous.",
      "Only the length is returned, not the substring.",
    ],
    exampleExplanation: "For 'abcabcbb', the longest valid length is 3, achieved by 'abc'.",
  },
  76: {
    id: 76,
    title: "Minimum Window Substring",
    statement:
      "Find the shortest contiguous substring of s that contains every character required by t, including repeated occurrences. Return an empty string if no such window exists.",
    entrypoint: "Solution.minWindow(s, t)",
    parameters: [
      { name: "s", type: "str", description: "Text in which to find a window." },
      { name: "t", type: "str", description: "Required character multiset." },
    ],
    returns: "str — the unique shortest covering window, or an empty string if impossible.",
    constraints: [
      "Characters are case-sensitive.",
      "A required character must occur at least as many times in the window as in t.",
      "When a valid shortest window exists, it is unique.",
      "If t is empty or longer than s, return an empty string.",
    ],
    exampleExplanation:
      "In s = 'ADOBECODEBANC' with t = 'ABC', 'BANC' is the shortest covering substring.",
  },
  20: {
    id: 20,
    title: "Valid Parentheses",
    statement:
      "Determine whether a bracket string is properly balanced: every closing bracket must match the most recent unmatched opening bracket, and no opening bracket may remain at the end.",
    entrypoint: "Solution.isValid(s)",
    parameters: [
      { name: "s", type: "str", description: "Sequence of bracket characters." },
    ],
    returns: "bool — True only for a fully matched and correctly nested sequence.",
    constraints: [
      "s contains only (), [], and {} bracket characters.",
      "The empty string is valid.",
      "Matching pairs must use the same bracket type.",
      "A closing bracket cannot appear before its matching opener.",
    ],
    exampleExplanation: "'([]{})' is valid, while '([)]' is not because the nesting order crosses.",
  },
  739: {
    id: 739,
    title: "Daily Temperatures",
    statement:
      "For each daily temperature, report how many later days must pass before a strictly warmer temperature occurs. Use zero when no warmer future day exists.",
    entrypoint: "Solution.dailyTemperatures(temperatures)",
    parameters: [
      { name: "temperatures", type: "list[int]", description: "Temperatures in chronological order." },
    ],
    returns: "list[int] — waiting days for every input position.",
    constraints: [
      "temperatures contains at least one value.",
      "Equal temperatures are not warmer.",
      "The output length must equal the input length.",
      "A position with no later warmer value receives 0.",
      "The intended solution runs in linear time.",
    ],
    exampleExplanation:
      "For [73, 74, 75, 71, 69, 72, 76, 73], the waits are [1, 1, 4, 2, 1, 1, 0, 0].",
  },
  704: {
    id: 704,
    title: "Binary Search",
    statement:
      "Locate target in an ascending array of distinct integers. Return its index, or -1 when it is absent.",
    entrypoint: "Solution.search(nums, target)",
    parameters: [
      { name: "nums", type: "list[int]", description: "Strictly increasing values." },
      { name: "target", type: "int", description: "Value to locate." },
    ],
    returns: "int — target's zero-based index, or -1.",
    constraints: [
      "nums is sorted in strictly increasing order.",
      "nums may be empty.",
      "target may lie inside or outside the array's value range.",
      "The solution must run in O(log n) time.",
    ],
    exampleExplanation: "Searching [-1, 0, 3, 5, 9, 12] for 9 returns index 4.",
  },
  875: {
    id: 875,
    title: "Koko Eating Bananas",
    statement:
      "Choose the smallest positive integer eating speed that finishes all banana piles within h hours. During one hour, at most one pile is worked on, and up to speed bananas are removed from it.",
    entrypoint: "Solution.minEatingSpeed(piles, h)",
    parameters: [
      { name: "piles", type: "list[int]", description: "Positive pile sizes." },
      { name: "h", type: "int", description: "Total available hours." },
    ],
    returns: "int — the minimum feasible bananas-per-hour speed.",
    constraints: [
      "piles contains at least one positive integer.",
      "h >= len(piles), so finishing is possible.",
      "A partially eaten pile still consumes the whole hour.",
      "Unused capacity in an hour cannot be transferred to another pile.",
      "The answer lies from 1 through max(piles).",
    ],
    exampleExplanation:
      "For piles [3, 6, 7, 11] and h = 8, speed 4 finishes in 8 hours and no smaller speed does.",
  },
  206: {
    id: 206,
    title: "Reverse Linked List",
    statement:
      "Reverse every next pointer in a singly linked list and return the node that becomes the new head.",
    entrypoint: "Solution.reverseList(head)",
    parameters: [
      { name: "head", type: "ListNode | None", description: "Head of an acyclic singly linked list." },
    ],
    returns: "ListNode | None — the reversed list's head.",
    notes: ["ListNode provides val and next fields; reuse the existing nodes."],
    constraints: [
      "The list may be empty.",
      "The input list contains no cycle.",
      "Node values need not be unique.",
      "All original nodes must appear exactly once in the reversed chain.",
      "Do not allocate replacement nodes.",
    ],
    exampleExplanation: "1 -> 2 -> 3 becomes 3 -> 2 -> 1.",
  },
  21: {
    id: 21,
    title: "Merge Two Sorted Lists",
    statement:
      "Merge two nondecreasing singly linked lists into one nondecreasing chain by relinking their existing nodes.",
    entrypoint: "Solution.mergeTwoLists(list1, list2)",
    parameters: [
      { name: "list1", type: "ListNode | None", description: "Head of the first sorted list." },
      { name: "list2", type: "ListNode | None", description: "Head of the second sorted list." },
    ],
    returns: "ListNode | None — head of the merged sorted list.",
    notes: ["ListNode provides val and next fields."],
    constraints: [
      "Either list may be empty.",
      "Both inputs are sorted in nondecreasing order.",
      "Input lists are acyclic and do not share nodes.",
      "Values may repeat.",
      "Reuse input nodes rather than constructing a full replacement list.",
    ],
    exampleExplanation: "Merging 1 -> 2 -> 4 and 1 -> 3 -> 4 yields 1 -> 1 -> 2 -> 3 -> 4 -> 4.",
  },
  141: {
    id: 141,
    title: "Linked List Cycle",
    statement:
      "Determine whether repeatedly following next pointers from head ever revisits a node.",
    entrypoint: "Solution.hasCycle(head)",
    parameters: [
      { name: "head", type: "ListNode | None", description: "Head of a singly linked structure." },
    ],
    returns: "bool — True if the reachable chain contains a cycle.",
    notes: ["The test harness may connect the tail to an earlier node; that connection index is not passed to the method."],
    constraints: [
      "The structure may be empty.",
      "Node identity, not repeated values, determines whether a cycle exists.",
      "A tail may point to any earlier node, including the head.",
      "Do not modify node links.",
      "Use constant auxiliary space.",
    ],
    exampleExplanation: "If the tail points back to the second node, traversal repeats nodes and the answer is True.",
  },
  104: {
    id: 104,
    title: "Maximum Depth of Binary Tree",
    statement:
      "Compute the number of nodes on the longest path from a binary tree's root down to any leaf.",
    entrypoint: "Solution.maxDepth(root)",
    parameters: [
      { name: "root", type: "TreeNode | None", description: "Root of a binary tree." },
    ],
    returns: "int — maximum root-to-leaf depth; 0 for an empty tree.",
    notes: ["TreeNode provides val, left, and right fields."],
    constraints: [
      "The tree may be empty.",
      "A leaf has depth 1.",
      "The structure is a valid acyclic binary tree.",
      "Node values do not affect depth.",
    ],
    exampleExplanation: "A root with a child and grandchild along one branch has maximum depth 3.",
  },
  98: {
    id: 98,
    title: "Validate Binary Search Tree",
    statement:
      "Decide whether a binary tree obeys the strict search-tree rule: every value in a node's left subtree is smaller, and every value in its right subtree is larger.",
    entrypoint: "Solution.isValidBST(root)",
    parameters: [
      { name: "root", type: "TreeNode | None", description: "Root of the candidate tree." },
    ],
    returns: "bool — True only when the entire tree satisfies strict BST ordering.",
    notes: ["TreeNode provides val, left, and right fields."],
    constraints: [
      "The tree may be empty.",
      "Ordering restrictions come from every ancestor, not only a node's parent.",
      "Duplicate values make the tree invalid.",
      "Node values are integers.",
      "The structure is acyclic.",
    ],
    exampleExplanation: "A value 3 anywhere in the right subtree of a root valued 5 violates the root's lower bound.",
  },
  102: {
    id: 102,
    title: "Binary Tree Level Order Traversal",
    statement:
      "Collect a binary tree's values level by level from top to bottom, preserving left-to-right order within each depth.",
    entrypoint: "Solution.levelOrder(root)",
    parameters: [
      { name: "root", type: "TreeNode | None", description: "Root of a binary tree." },
    ],
    returns: "list[list[int]] — one list of values for each depth.",
    notes: ["TreeNode provides val, left, and right fields."],
    constraints: [
      "An empty tree returns an empty list.",
      "The root is the first level.",
      "Children are visited left before right.",
      "The structure is a valid acyclic binary tree.",
    ],
    exampleExplanation: "A root 3 with children 9 and 20 produces initial levels [[3], [9, 20]].",
  },
  215: {
    id: 215,
    title: "Kth Largest Element in an Array",
    statement:
      "Return the value that would occupy position k when the array is ordered from largest to smallest. Count duplicate occurrences as separate positions.",
    entrypoint: "Solution.findKthLargest(nums, k)",
    parameters: [
      { name: "nums", type: "list[int]", description: "Unordered values." },
      { name: "k", type: "int", description: "One-based rank from the largest value." },
    ],
    returns: "int — the kth-largest array element.",
    constraints: [
      "nums contains at least one integer.",
      "1 <= k <= len(nums).",
      "Duplicate values count independently toward k.",
      "Values may be negative.",
      "The result is an element value, not an index.",
    ],
    exampleExplanation: "In [3, 2, 1, 5, 6, 4], the second-largest value is 5.",
  },
  347: {
    id: 347,
    title: "Top K Frequent Elements",
    statement:
      "Return the k distinct integer values that occur most often in nums.",
    entrypoint: "Solution.topKFrequent(nums, k)",
    parameters: [
      { name: "nums", type: "list[int]", description: "Values whose frequencies are counted." },
      { name: "k", type: "int", description: "Number of distinct values to return." },
    ],
    returns: "list[int] — the k most frequent distinct values in any order.",
    constraints: [
      "nums contains at least one integer.",
      "1 <= k <= the number of distinct values.",
      "The set of correct answers is unique.",
      "Output order is not significant.",
      "Values may be negative.",
    ],
    exampleExplanation: "For [1, 1, 1, 2, 2, 3] and k = 2, return 1 and 2 in either order.",
  },
  56: {
    id: 56,
    title: "Merge Intervals",
    statement:
      "Combine all overlapping closed intervals and return the disjoint intervals that cover the same points.",
    entrypoint: "Solution.merge(intervals)",
    parameters: [
      { name: "intervals", type: "list[list[int]]", description: "Closed intervals shaped as [start, end]." },
    ],
    returns: "list[list[int]] — merged, nonoverlapping intervals ordered by start.",
    constraints: [
      "Each interval has exactly two integers with start <= end.",
      "Intervals may arrive in any order.",
      "Closed intervals that touch at an endpoint overlap and must merge.",
      "The input may contain duplicate intervals.",
      "The output must be sorted by start.",
    ],
    exampleExplanation: "[1, 3] and [2, 6] overlap, so they combine into [1, 6].",
  },
  57: {
    id: 57,
    title: "Insert Interval",
    statement:
      "Insert one closed interval into an already sorted, nonoverlapping interval list. Merge every overlap and return the resulting sorted list.",
    entrypoint: "Solution.insert(intervals, newInterval)",
    parameters: [
      { name: "intervals", type: "list[list[int]]", description: "Existing disjoint intervals sorted by start." },
      { name: "newInterval", type: "list[int]", description: "Closed interval [start, end] to add." },
    ],
    returns: "list[list[int]] — sorted, nonoverlapping intervals after insertion.",
    constraints: [
      "Every interval has start <= end.",
      "intervals is initially sorted by start and pairwise nonoverlapping.",
      "intervals may be empty.",
      "Endpoint contact counts as overlap.",
      "newInterval may belong before, within, or after all existing intervals.",
    ],
    exampleExplanation: "Inserting [2, 5] into [[1, 3], [6, 9]] produces [[1, 5], [6, 9]].",
  },
  200: {
    id: 200,
    title: "Number of Islands",
    statement:
      "Count connected land regions in a rectangular grid. A land cell contains '1', water contains '0', and connection is only through shared sides.",
    entrypoint: "Solution.numIslands(grid)",
    parameters: [
      { name: "grid", type: "list[list[str]]", description: "Rectangular map of '1' and '0' cells." },
    ],
    returns: "int — number of four-directionally connected land components.",
    constraints: [
      "grid may be empty or contain an empty first row; either case has zero islands.",
      "When cells are present, every row has the same length.",
      "Cells contain only '0' or '1'.",
      "Diagonal contact does not connect land.",
      "Each land cell belongs to exactly one counted island.",
    ],
    exampleExplanation: "Two land clusters separated by a full row or column of water count as two islands.",
  },
  207: {
    id: 207,
    title: "Course Schedule",
    statement:
      "Determine whether all numbered courses can be completed given prerequisite pairs. A pair [course, prerequisite] means prerequisite must be taken before course.",
    entrypoint: "Solution.canFinish(numCourses, prerequisites)",
    parameters: [
      { name: "numCourses", type: "int", description: "Number of courses labeled 0 through numCourses - 1." },
      { name: "prerequisites", type: "list[list[int]]", description: "Directed dependency pairs [course, prerequisite]." },
    ],
    returns: "bool — True when the dependency graph has no directed cycle.",
    constraints: [
      "numCourses is positive.",
      "Every course identifier is between 0 and numCourses - 1.",
      "prerequisites may be empty.",
      "All courses are completable exactly when a topological ordering exists.",
      "A cycle of any length makes the answer False.",
    ],
    exampleExplanation: "Dependencies [1, 0] and [0, 1] form a cycle, so the two courses cannot both be finished.",
  },
  39: {
    id: 39,
    title: "Combination Sum",
    statement:
      "Find all distinct combinations of candidate values that add exactly to target. A candidate may be selected any number of times; combinations that differ only in ordering are the same.",
    entrypoint: "Solution.combinationSum(candidates, target)",
    parameters: [
      { name: "candidates", type: "list[int]", description: "Distinct positive values available for selection." },
      { name: "target", type: "int", description: "Positive sum to reach." },
    ],
    returns: "list[list[int]] — all unique combinations in any order.",
    constraints: [
      "candidates contains distinct positive integers.",
      "target is positive.",
      "Each candidate may be reused without limit.",
      "A combination's element order is not significant.",
      "The total number of valid combinations is finite.",
    ],
    exampleExplanation: "For candidates [2, 3, 6, 7] and target 7, valid combinations are [2, 2, 3] and [7].",
  },
  79: {
    id: 79,
    title: "Word Search",
    statement:
      "Decide whether word can be formed by walking through horizontally or vertically adjacent board cells. Each board cell can be used at most once in the same path.",
    entrypoint: "Solution.exist(board, word)",
    parameters: [
      { name: "board", type: "list[list[str]]", description: "Rectangular character grid." },
      { name: "word", type: "str", description: "Sequence to trace." },
    ],
    returns: "bool — True when at least one valid path spells word.",
    constraints: [
      "board has at least one row and one column.",
      "Every row has the same length and every cell holds one character.",
      "Movement is up, down, left, or right; diagonals are excluded.",
      "A cell cannot be reused within one candidate path.",
      "Different search paths may reuse the same board cells.",
    ],
    exampleExplanation: "A word may turn corners, but it cannot jump over cells or revisit an earlier cell in its path.",
  },
  55: {
    id: 55,
    title: "Jump Game",
    statement:
      "Starting at index 0, each value gives the maximum number of positions you may jump forward from there. Determine whether the last index is reachable.",
    entrypoint: "Solution.canJump(nums)",
    parameters: [
      { name: "nums", type: "list[int]", description: "Maximum forward jump lengths." },
    ],
    returns: "bool — True when some sequence of legal jumps reaches the final index.",
    constraints: [
      "nums contains at least one nonnegative integer.",
      "A jump may be any distance from 1 through the current maximum.",
      "Movement is only forward.",
      "A one-element array is already at the destination.",
      "Landing beyond the last index is not required; reaching it is enough.",
    ],
    exampleExplanation: "[2, 3, 1, 1, 4] is reachable by jumping from index 0 to 1 and then to the end.",
  },
  70: {
    id: 70,
    title: "Climbing Stairs",
    statement:
      "Count the distinct sequences of 1-step and 2-step moves that land exactly on stair n from stair 0.",
    entrypoint: "Solution.climbStairs(n)",
    parameters: [
      { name: "n", type: "int", description: "Positive destination stair." },
    ],
    returns: "int — number of distinct step sequences.",
    constraints: [
      "n >= 1.",
      "Every move advances exactly 1 or 2 stairs.",
      "Order distinguishes sequences; 1 then 2 differs from 2 then 1.",
      "A sequence must land exactly on n.",
    ],
    exampleExplanation: "For n = 3, the sequences are 1+1+1, 1+2, and 2+1, so return 3.",
  },
  198: {
    id: 198,
    title: "House Robber",
    statement:
      "Choose houses along one street to maximize the stolen amount, with the rule that two adjacent houses cannot both be chosen.",
    entrypoint: "Solution.rob(nums)",
    parameters: [
      { name: "nums", type: "list[int]", description: "Nonnegative money available at each house in street order." },
    ],
    returns: "int — maximum total from a nonadjacent subset.",
    constraints: [
      "nums may be empty.",
      "Every amount is nonnegative.",
      "The first and last houses are not adjacent; the street is not circular.",
      "Choosing no house is allowed conceptually, though nonnegative inputs never make it worse.",
      "Only the maximum amount is returned.",
    ],
    exampleExplanation: "For [2, 7, 9, 3, 1], choosing 2, 9, and 1 yields the maximum total 12.",
  },
  208: {
    id: 208,
    title: "Implement Trie (Prefix Tree)",
    statement:
      "Implement a Trie that stores words and supports insertion, exact-word lookup, and prefix lookup. Also complete exercise_trie: insert every supplied word, then return exact-search results and prefix-search results in the same order as their query lists.",
    entrypoint: "exercise_trie(words, searches, prefixes)",
    parameters: [
      { name: "words", type: "list[str]", description: "Words inserted into a new Trie." },
      { name: "searches", type: "list[str]", description: "Exact-word queries." },
      { name: "prefixes", type: "list[str]", description: "Prefix queries." },
    ],
    returns:
      "tuple[list[bool], list[bool]] — exact-search answers followed by prefix-search answers.",
    notes: [
      "Trie.insert(word) stores word; Trie.search(word) requires a complete inserted word; Trie.startsWith(prefix) only requires an inserted word to begin with prefix.",
    ],
    constraints: [
      "Inputs contain lowercase English words and queries.",
      "The three input lists may be empty.",
      "Inserting the same word repeatedly does not change lookup results.",
      "A path existing in the trie does not by itself make that path a stored word.",
      "Return one boolean per query without reordering queries.",
    ],
    exampleExplanation:
      "After inserting 'apple', search('apple') is True, search('app') is False, and startsWith('app') is True.",
  },
  212: {
    id: 212,
    title: "Word Search II",
    statement:
      "Find every dictionary word that can be traced in a character board by moving through shared sides. A board cell may be used at most once per word path.",
    entrypoint: "Solution.findWords(board, words)",
    parameters: [
      { name: "board", type: "list[list[str]]", description: "Rectangular lowercase-letter grid." },
      { name: "words", type: "list[str]", description: "Distinct dictionary words to find." },
    ],
    returns: "list[str] — each dictionary word present on the board, once, in any order.",
    constraints: [
      "board has at least one row and one column and is rectangular.",
      "Board cells and words use lowercase English letters.",
      "Movement is horizontal or vertical, never diagonal.",
      "A cell cannot be reused within one word path.",
      "A found word appears only once in the output even if multiple paths spell it.",
    ],
    exampleExplanation:
      "Searching all words through one shared prefix tree allows a board path to stop as soon as no dictionary word has that prefix.",
  },
  684: {
    id: 684,
    title: "Redundant Connection",
    statement:
      "An undirected graph began as a tree on nodes 1 through n, then one extra edge was added. Return the added-cycle edge that occurs last in the given edge order when more than one cycle edge could be removed.",
    entrypoint: "Solution.findRedundantConnection(edges)",
    parameters: [
      { name: "edges", type: "list[list[int]]", description: "Undirected edges [u, v] in input order." },
    ],
    returns: "list[int] — the redundant edge [u, v].",
    constraints: [
      "len(edges) = n for nodes labeled 1 through n.",
      "Before one extra edge was added, the graph was a connected tree.",
      "No edge is repeated and no edge joins a node to itself.",
      "Edges are undirected.",
      "If several removals restore a tree, return the candidate appearing last in edges.",
    ],
    exampleExplanation: "In edges [1, 2], [1, 3], [2, 3], the final edge closes the cycle and is returned.",
  },
  1579: {
    id: 1579,
    title: "Remove Max Number of Edges to Keep Graph Fully Traversable",
    statement:
      "Nodes 1 through n are connected by typed undirected edges. Type 1 is usable only by Alice, type 2 only by Bob, and type 3 by both. Remove as many edges as possible while keeping every node reachable from every other node for each person. Return -1 if that is impossible.",
    entrypoint: "Solution.maxNumEdgesToRemove(n, edges)",
    parameters: [
      { name: "n", type: "int", description: "Number of nodes labeled 1 through n." },
      { name: "edges", type: "list[list[int]]", description: "Edges [type, u, v]." },
    ],
    returns: "int — maximum removable edge count, or -1 if Alice or Bob cannot fully traverse the graph.",
    constraints: [
      "n >= 1.",
      "Each edge type is 1, 2, or 3 and endpoints are valid node labels.",
      "Edges are undirected and parallel edges may exist.",
      "Both Alice and Bob must individually be able to reach every node.",
      "A shared type-3 edge can contribute connectivity to both people.",
    ],
    exampleExplanation:
      "Using useful shared edges first can connect both travelers with one edge; later edges joining already connected components are removable.",
  },
  743: {
    id: 743,
    title: "Network Delay Time",
    statement:
      "A signal starts at node k in a directed weighted network. Compute the earliest time by which every node has received it, assuming an edge's weight is its travel time. Return -1 if any node is unreachable.",
    entrypoint: "Solution.networkDelayTime(times, n, k)",
    parameters: [
      { name: "times", type: "list[list[int]]", description: "Directed edges [source, destination, travel_time]." },
      { name: "n", type: "int", description: "Number of nodes labeled 1 through n." },
      { name: "k", type: "int", description: "Signal's starting node." },
    ],
    returns: "int — maximum shortest-path time from k, or -1 when some node cannot receive the signal.",
    constraints: [
      "n >= 1 and 1 <= k <= n.",
      "All edge travel times are positive integers.",
      "All edge endpoints are valid node labels.",
      "The graph is directed.",
      "The signal may follow any number of edges and may branch along different routes.",
    ],
    exampleExplanation:
      "If shortest arrival times are 0, 1, 1, and 2, every node has received the signal at time 2.",
  },
  332: {
    id: 332,
    title: "Reconstruct Itinerary",
    statement:
      "Arrange all directed airline tickets into one itinerary beginning at JFK. Every ticket must be used exactly once. If several complete itineraries exist, return the lexicographically smallest airport sequence.",
    entrypoint: "Solution.findItinerary(tickets)",
    parameters: [
      { name: "tickets", type: "list[list[str]]", description: "Directed tickets [origin, destination]." },
    ],
    returns: "list[str] — itinerary of len(tickets) + 1 airport codes.",
    constraints: [
      "At least one valid itinerary beginning at JFK exists.",
      "Airport codes are strings compared with ordinary lexicographic ordering.",
      "Tickets are distinct resources even when two have identical endpoints.",
      "Every ticket must be consumed exactly once.",
      "Choose the lexicographically smallest complete itinerary, not merely the smallest next hop that reaches a dead end.",
    ],
    exampleExplanation:
      "Tickets JFK -> NRT, NRT -> JFK, and JFK -> KUL require the route JFK, NRT, JFK, KUL despite KUL sorting earlier than NRT.",
  },
  778: {
    id: 778,
    title: "Swim in Rising Water",
    statement:
      "Water level equals elapsed time. You may enter a grid cell only once the water reaches that cell's elevation, moving through shared sides from the top-left cell. Return the earliest time the bottom-right cell can be reached.",
    entrypoint: "Solution.swimInWater(grid)",
    parameters: [
      { name: "grid", type: "list[list[int]]", description: "Square elevation grid." },
    ],
    returns: "int — minimum possible maximum elevation along a start-to-finish path.",
    constraints: [
      "grid is a nonempty n by n square.",
      "Elevations are distinct nonnegative integers.",
      "Movement is up, down, left, or right.",
      "Waiting is allowed, so path cost is its highest elevation rather than the sum of elevations.",
      "The starting and ending cells are included in the path cost.",
    ],
    exampleExplanation: "In [[0, 2], [1, 3]], every route reaches elevation 3, so the earliest arrival time is 3.",
  },
  371: {
    id: 371,
    title: "Sum of Two Integers",
    statement:
      "Compute the sum of two signed integers without using Python's addition or subtraction operators.",
    entrypoint: "Solution.getSum(a, b)",
    parameters: [
      { name: "a", type: "int", description: "First signed integer." },
      { name: "b", type: "int", description: "Second signed integer." },
    ],
    returns: "int — the mathematical sum a + b.",
    constraints: [
      "Inputs and their result fit in a signed 32-bit integer.",
      "The + and - operators may not be used to perform the addition.",
      "Negative values must follow 32-bit two's-complement behavior during bit operations.",
      "Python's unbounded integers require explicit fixed-width masking.",
    ],
    exampleExplanation: "XOR forms carry-free sum bits while shifted AND forms carry bits; repeat until no carry remains.",
  },
  201: {
    id: 201,
    title: "Bitwise AND of Numbers Range",
    statement:
      "Compute the bitwise AND of every integer in the inclusive range from left through right without enumerating the whole range.",
    entrypoint: "Solution.rangeBitwiseAnd(left, right)",
    parameters: [
      { name: "left", type: "int", description: "Inclusive lower endpoint." },
      { name: "right", type: "int", description: "Inclusive upper endpoint." },
    ],
    returns: "int — left & (left + 1) & ... & right.",
    constraints: [
      "0 <= left <= right.",
      "Endpoints are nonnegative integers.",
      "The inclusive range may be too large to iterate.",
      "A bit survives only if it stays set in every number in the range.",
    ],
    exampleExplanation: "For [5, 7], binary 101 & 110 & 111 equals 100, so return 4.",
  },
  1143: {
    id: 1143,
    title: "Longest Common Subsequence",
    statement:
      "Return the maximum length of a character sequence obtainable from both input strings by deleting zero or more characters without changing the order of those kept.",
    entrypoint: "Solution.longestCommonSubsequence(text1, text2)",
    parameters: [
      { name: "text1", type: "str", description: "First source string." },
      { name: "text2", type: "str", description: "Second source string." },
    ],
    returns: "int — length of the longest common subsequence.",
    constraints: [
      "Inputs contain lowercase English letters.",
      "A subsequence preserves order but need not be contiguous.",
      "Characters may repeat and each occurrence can be matched at most once.",
      "Only the maximum length is returned.",
      "If the strings share no character, return 0.",
    ],
    exampleExplanation: "For 'abcde' and 'ace', keeping a, c, e in each string gives length 3.",
  },
  72: {
    id: 72,
    title: "Edit Distance",
    statement:
      "Find the fewest single-character edits needed to transform word1 into word2. One edit may insert a character, delete a character, or replace a character.",
    entrypoint: "Solution.minDistance(word1, word2)",
    parameters: [
      { name: "word1", type: "str", description: "Starting string." },
      { name: "word2", type: "str", description: "Target string." },
    ],
    returns: "int — minimum number of allowed edits.",
    constraints: [
      "Either string may be empty.",
      "Each insertion, deletion, or replacement costs exactly one.",
      "Matching characters require no edit.",
      "Characters are compared case-sensitively.",
      "Edits may be applied at any current string position.",
    ],
    exampleExplanation: "Transforming 'horse' to 'ros' takes at least three edits: replace h, delete r, and delete e.",
  },
  115: {
    id: 115,
    title: "Distinct Subsequences",
    statement:
      "Count how many different choices of source indices spell target in order. Characters may be deleted from source but the remaining order cannot change.",
    entrypoint: "Solution.numDistinct(source, target)",
    parameters: [
      { name: "source", type: "str", description: "String from which positions are selected." },
      { name: "target", type: "str", description: "Sequence that selected characters must spell." },
    ],
    returns: "int — number of distinct index selections forming target.",
    constraints: [
      "source and target contain English letters.",
      "Different index selections count separately even if the selected character values look identical.",
      "Selected indices must be strictly increasing.",
      "There is exactly one way to form an empty target.",
      "If target is longer than source, return 0.",
    ],
    exampleExplanation: "'rabbbit' contains three different index selections that spell 'rabbit'.",
  },
} as const satisfies Record<number, PythonChallengeMetadata>;

export type PythonChallengeId = keyof typeof PYTHON_CHALLENGES;

export function getPythonChallenge(id: number): PythonChallengeMetadata | undefined {
  return PYTHON_CHALLENGES[id as PythonChallengeId];
}
