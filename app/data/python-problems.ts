import type { Difficulty, Pattern } from "./problems";

export type PythonVerificationCodec =
  "json" | "linkedList" | "cyclicLinkedList" | "binaryTree";

export type PythonVerificationComparator =
  "deepEqual" | "unordered" | "unorderedNested" | "validTopologicalOrder";

export type PythonVerificationEntrypoint =
  | { kind: "function"; name: string }
  | { kind: "method"; className: "Solution"; name: string };

export type PythonVerificationCase = {
  name: string;
  args: unknown[];
  argCodecs?: readonly PythonVerificationCodec[];
  expected: unknown;
  outputCodec?: PythonVerificationCodec;
  comparator?: PythonVerificationComparator;
};

export type PythonVerification = {
  revision: 1;
  entrypoint: PythonVerificationEntrypoint;
  cases: readonly PythonVerificationCase[];
};

export type PythonProblem = {
  id: number;
  title: string;
  slug: string;
  difficulty: Difficulty;
  pattern: Pattern;
  summary: string;
  cue: string;
  invariant: string;
  complexity: string;
  languageNote: string;
  estimatedMinutes: number;
  code: string;
  sourceUrl?: string;
  tags: string[];
  recallChecks: readonly [string, string, string];
  verification: PythonVerification;
};

/**
 * A Python-first reactivation curriculum for an experienced but rusty engineer.
 *
 * IDs 10001-10008 are original fluency drills. The remaining IDs match the
 * corresponding public LeetCode problem so attempts remain stable across tracks.
 */
export const PYTHON_PROBLEMS: PythonProblem[] = [
  {
    id: 10001,
    title: "Frequency Map Warm-up",
    slug: "python-frequency-map-warm-up",
    difficulty: "Easy",
    pattern: "Python Fluency",
    summary:
      "Count normalized words and return the most common word with a deterministic tie break.",
    cue: "Translate each input once, then update one dictionary entry.",
    invariant:
      "After processing index i, counts stores the exact frequency of every normalized word through i.",
    complexity: "O(n) expected time · O(k) space",
    languageNote:
      "dict.get(key, 0) is the compact interview-safe way to increment a possibly missing key.",
    estimatedMinutes: 4,
    code: `def most_common_word(words: list[str]) -> tuple[str, int] | None:
    counts: dict[str, int] = {}

    for word in words:
        normalized = word.strip().lower()
        if normalized:
            counts[normalized] = counts.get(normalized, 0) + 1

    if not counts:
        return None

    word, frequency = min(counts.items(), key=lambda item: (-item[1], item[0]))
    return word, frequency`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "function",
        name: "most_common_word",
      },
      cases: [
        {
          name: "normalizes words and chooses the highest frequency",
          args: [[" Pear ", "apple", "PEAR"]],
          expected: ["pear", 2],
          comparator: "deepEqual",
        },
        {
          name: "breaks a frequency tie alphabetically",
          args: [["zeta", "alpha", "ZETA", "ALPHA"]],
          expected: ["alpha", 2],
          comparator: "deepEqual",
        },
        {
          name: "returns none when no normalized word remains",
          args: [["", "   "]],
          expected: null,
          comparator: "deepEqual",
        },
      ],
    },
    tags: ["dict", "counting", "normalization", "tuple"],
    recallChecks: [
      "Why is dict.get preferable to a membership branch for this counting loop?",
      "What does the key (-frequency, word) do to ties?",
      "What should the function return when every input normalizes to an empty string?",
    ],
  },
  {
    id: 10002,
    title: "Stable Deduplication",
    slug: "python-stable-deduplication",
    difficulty: "Easy",
    pattern: "Python Fluency",
    summary:
      "Remove duplicates while preserving the first occurrence of each value.",
    cue: "Use a set for membership and a list for output order.",
    invariant: "seen contains exactly the values already emitted to result.",
    complexity: "O(n) expected time · O(k) space",
    languageNote:
      "A set gives expected O(1) membership, while list order stays under your control.",
    estimatedMinutes: 3,
    code: `def unique_in_order(values: list[int]) -> list[int]:
    seen: set[int] = set()
    result: list[int] = []

    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)

    return result`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "function",
        name: "unique_in_order",
      },
      cases: [
        {
          name: "preserves the first occurrence order",
          args: [[3, 1, 3, 2, 1, 2]],
          expected: [3, 1, 2],
          comparator: "deepEqual",
        },
        {
          name: "handles an empty input",
          args: [[]],
          expected: [],
          comparator: "deepEqual",
        },
        {
          name: "keeps one copy when every value is equal",
          args: [[5, 5, 5]],
          expected: [5],
          comparator: "deepEqual",
        },
      ],
    },
    tags: ["set", "list", "membership", "order"],
    recallChecks: [
      "Why would list(set(values)) violate the contract?",
      "At what moment should a value be added to seen?",
      "What assumption makes set lookup expected O(1)?",
    ],
  },
  {
    id: 10003,
    title: "Enumerate, Zip, and Unpack",
    slug: "python-enumerate-zip-unpack",
    difficulty: "Easy",
    pattern: "Python Fluency",
    summary: "Report indexed mismatches between two equally sized sequences.",
    cue: "Zip the sequences, then enumerate the paired stream.",
    invariant:
      "Every emitted tuple describes one previously visited position whose values differ.",
    complexity: "O(n) time · O(m) output space",
    languageNote:
      "enumerate(zip(left, right)) replaces manual index bookkeeping and unpacks cleanly in the loop target.",
    estimatedMinutes: 3,
    code: `def indexed_mismatches(
    expected: list[str], actual: list[str]
) -> list[tuple[int, str, str]]:
    if len(expected) != len(actual):
        raise ValueError("sequences must have equal length")

    mismatches: list[tuple[int, str, str]] = []
    for index, (wanted, received) in enumerate(zip(expected, actual)):
        if wanted != received:
            mismatches.append((index, wanted, received))

    return mismatches`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "function",
        name: "indexed_mismatches",
      },
      cases: [
        {
          name: "reports indexed mismatches",
          args: [
            ["a", "b", "c"],
            ["a", "x", "z"],
          ],
          expected: [
            [1, "b", "x"],
            [2, "c", "z"],
          ],
          comparator: "deepEqual",
        },
        {
          name: "returns none for equal sequences",
          args: [["same"], ["same"]],
          expected: [],
          comparator: "deepEqual",
        },
        {
          name: "handles equal empty sequences",
          args: [[], []],
          expected: [],
          comparator: "deepEqual",
        },
      ],
    },
    tags: ["enumerate", "zip", "unpacking", "validation"],
    recallChecks: [
      "Why validate the lengths before calling zip?",
      "What shape does each item produced by enumerate(zip(...)) have?",
      "How would you start indexing at one without arithmetic inside the loop?",
    ],
  },
  {
    id: 10004,
    title: "Sort with a Composite Key",
    slug: "python-composite-sort-key",
    difficulty: "Easy",
    pattern: "Python Fluency",
    summary:
      "Rank records by descending score, then ascending name, without mutating the input.",
    cue: "Represent every tie-break rule in one tuple key.",
    invariant:
      "The returned records are ordered by (-score, normalized name), while the input list is unchanged.",
    complexity: "O(n log n) time · O(n) space",
    languageNote:
      "sorted returns a new list; negate numeric fields that must sort in descending order.",
    estimatedMinutes: 4,
    code: `def rank_players(players: list[tuple[str, int]]) -> list[tuple[str, int]]:
    return sorted(
        players,
        key=lambda player: (-player[1], player[0].casefold()),
    )`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "function",
        name: "rank_players",
      },
      cases: [
        {
          name: "orders score descending then name ascending",
          args: [
            [
              ["zoe", 8],
              ["Amy", 10],
              ["ben", 10],
            ],
          ],
          expected: [
            ["Amy", 10],
            ["ben", 10],
            ["zoe", 8],
          ],
          comparator: "deepEqual",
        },
        {
          name: "preserves an already ranked input",
          args: [
            [
              ["a", 4],
              ["b", 3],
            ],
          ],
          expected: [
            ["a", 4],
            ["b", 3],
          ],
          comparator: "deepEqual",
        },
        {
          name: "handles no players",
          args: [[]],
          expected: [],
          comparator: "deepEqual",
        },
      ],
    },
    tags: ["sorted", "lambda", "tuple-key", "immutability"],
    recallChecks: [
      "Why is the score negated in the key?",
      "When would list.sort be the wrong choice here?",
      "How does tuple comparison implement the tie break?",
    ],
  },
  {
    id: 10005,
    title: "Queue with Deque",
    slug: "python-deque-queue",
    difficulty: "Easy",
    pattern: "Python Fluency",
    summary:
      "Traverse a small dependency graph in breadth-first order from one starting node.",
    cue: "Append new work on the right and consume old work from the left.",
    invariant:
      "The deque contains discovered but unprocessed nodes in discovery order.",
    complexity: "O(V + E) time · O(V) space",
    languageNote:
      "collections.deque.popleft is O(1); list.pop(0) shifts the remaining list.",
    estimatedMinutes: 5,
    code: `from collections import deque


def breadth_first_order(graph: dict[str, list[str]], start: str) -> list[str]:
    queue = deque([start])
    seen = {start}
    order: list[str] = []

    while queue:
        node = queue.popleft()
        order.append(node)

        for neighbor in graph.get(node, []):
            if neighbor not in seen:
                seen.add(neighbor)
                queue.append(neighbor)

    return order`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "function",
        name: "breadth_first_order",
      },
      cases: [
        {
          name: "visits a branching graph breadth first",
          args: [
            {
              a: ["b", "c"],
              b: ["d"],
              c: ["d"],
            },
            "a",
          ],
          expected: ["a", "b", "c", "d"],
          comparator: "deepEqual",
        },
        {
          name: "does not revisit a cycle",
          args: [
            {
              a: ["b"],
              b: ["a"],
            },
            "a",
          ],
          expected: ["a", "b"],
          comparator: "deepEqual",
        },
        {
          name: "includes an isolated start node",
          args: [{}, "solo"],
          expected: ["solo"],
          comparator: "deepEqual",
        },
      ],
    },
    tags: ["deque", "queue", "bfs", "collections"],
    recallChecks: [
      "Why is a node marked seen when enqueued rather than when dequeued?",
      "Which deque operations make a FIFO queue?",
      "Why is list.pop(0) a poor substitute?",
    ],
  },
  {
    id: 10006,
    title: "Heap Tuple Ordering",
    slug: "python-heap-tuple-ordering",
    difficulty: "Easy",
    pattern: "Python Fluency",
    summary:
      "Return the next tasks ordered by priority, then submission sequence.",
    cue: "Put every comparison field before the payload in a heap tuple.",
    invariant:
      "The heap root is the remaining task with the smallest (priority, sequence) pair.",
    complexity: "O(n + k log n) time · O(n) space",
    languageNote:
      "heapq is a min-heap; a sequence field prevents Python from comparing arbitrary payloads when priorities tie.",
    estimatedMinutes: 5,
    code: `import heapq


def next_tasks(tasks: list[tuple[int, int, str]], limit: int) -> list[str]:
    heap = [(priority, sequence, name) for priority, sequence, name in tasks]
    heapq.heapify(heap)

    result: list[str] = []
    for _ in range(min(limit, len(heap))):
        _, _, name = heapq.heappop(heap)
        result.append(name)

    return result`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "function",
        name: "next_tasks",
      },
      cases: [
        {
          name: "uses priority then sequence ordering",
          args: [
            [
              [2, 0, "later"],
              [1, 5, "first-b"],
              [1, 2, "first-a"],
            ],
            3,
          ],
          expected: ["first-a", "first-b", "later"],
          comparator: "deepEqual",
        },
        {
          name: "caps output when limit exceeds task count",
          args: [[[3, 0, "only"]], 5],
          expected: ["only"],
          comparator: "deepEqual",
        },
        {
          name: "returns no tasks when the limit is zero",
          args: [[[1, 0, "held"]], 0],
          expected: [],
          comparator: "deepEqual",
        },
      ],
    },
    tags: ["heapq", "tuple", "priority-queue", "heapify"],
    recallChecks: [
      "Which tuple field is compared first by heapq?",
      "Why include a unique sequence before a non-orderable payload?",
      "What is the complexity of heapify compared with n separate pushes?",
    ],
  },
  {
    id: 10007,
    title: "Comprehensions and Generators",
    slug: "python-comprehensions-generators",
    difficulty: "Easy",
    pattern: "Python Fluency",
    summary:
      "Normalize valid scores and compute their squared total without building an unnecessary second list.",
    cue: "Use a comprehension for reusable data and a generator for one-pass aggregation.",
    invariant:
      "normalized contains only in-range integer scores, in original order.",
    complexity: "O(n) time · O(n) space for normalized values",
    languageNote:
      "sum(expression for item in items) consumes a generator lazily; square brackets would allocate another list.",
    estimatedMinutes: 4,
    code: `def normalized_scores(raw_scores: list[str]) -> tuple[list[int], int]:
    normalized = [
        int(score)
        for score in raw_scores
        if score.strip().lstrip("-").isdigit()
        and 0 <= int(score) <= 100
    ]
    squared_total = sum(score * score for score in normalized)
    return normalized, squared_total`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "function",
        name: "normalized_scores",
      },
      cases: [
        {
          name: "filters invalid and out-of-range scores",
          args: [[" 10", "-1", "101", "x", "20"]],
          expected: [[10, 20], 500],
          comparator: "deepEqual",
        },
        {
          name: "accepts both inclusive boundaries",
          args: [["0", "100"]],
          expected: [[0, 100], 10000],
          comparator: "deepEqual",
        },
        {
          name: "returns empty values and zero total when none qualify",
          args: [["", "-5", "word"]],
          expected: [[], 0],
          comparator: "deepEqual",
        },
      ],
    },
    tags: ["list-comprehension", "generator", "sum", "filtering"],
    recallChecks: [
      "Why use a generator expression inside sum?",
      "Which part of the comprehension filters inputs?",
      "What tradeoff comes from calling int(score) more than once?",
    ],
  },
  {
    id: 10008,
    title: "Counter and Defaultdict",
    slug: "python-counter-defaultdict",
    difficulty: "Easy",
    pattern: "Python Fluency",
    summary: "Group events by owner and count event kinds in a single pass.",
    cue: "Use defaultdict for collection-valued keys and Counter for frequencies.",
    invariant:
      "After each event, both structures exactly summarize the processed prefix.",
    complexity: "O(n) expected time · O(n) space",
    languageNote:
      "defaultdict(list) creates a fresh list per missing key; Counter communicates frequency intent directly.",
    estimatedMinutes: 5,
    code: `from collections import Counter, defaultdict


def summarize_events(
    events: list[tuple[str, str]],
) -> tuple[dict[str, list[str]], Counter[str]]:
    events_by_owner: defaultdict[str, list[str]] = defaultdict(list)
    kind_counts: Counter[str] = Counter()

    for owner, kind in events:
        events_by_owner[owner].append(kind)
        kind_counts[kind] += 1

    return dict(events_by_owner), kind_counts`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "function",
        name: "summarize_events",
      },
      cases: [
        {
          name: "groups owners and counts event kinds",
          args: [
            [
              ["ana", "open"],
              ["bo", "open"],
              ["ana", "close"],
            ],
          ],
          expected: [
            {
              ana: ["open", "close"],
              bo: ["open"],
            },
            {
              open: 2,
              close: 1,
            },
          ],
          comparator: "deepEqual",
        },
        {
          name: "keeps owner event order",
          args: [
            [
              ["ana", "close"],
              ["ana", "open"],
            ],
          ],
          expected: [
            {
              ana: ["close", "open"],
            },
            {
              close: 1,
              open: 1,
            },
          ],
          comparator: "deepEqual",
        },
        {
          name: "returns two empty summaries",
          args: [[]],
          expected: [{}, {}],
          comparator: "deepEqual",
        },
      ],
    },
    tags: ["Counter", "defaultdict", "collections", "grouping"],
    recallChecks: [
      "Why does defaultdict(list) not share one list across keys?",
      "What does Counter return for a missing key?",
      "Why convert the defaultdict to dict at the boundary?",
    ],
  },
  {
    id: 1,
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "Easy",
    pattern: "Arrays & Hashing",
    summary: "Return two indices whose values add to a target.",
    cue: "While scanning, ask whether the current value's complement appeared earlier.",
    invariant:
      "index_by_value contains only values from indices strictly before the current index.",
    complexity: "O(n) expected time · O(n) space",
    languageNote:
      "Use `if complement in dictionary` when index zero is a valid stored answer; truthiness would be incorrect.",
    estimatedMinutes: 5,
    code: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        index_by_value: dict[int, int] = {}

        for index, value in enumerate(nums):
            complement = target - value
            if complement in index_by_value:
                return [index_by_value[complement], index]
            index_by_value[value] = index

        return []`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "twoSum",
      },
      cases: [
        {
          name: "finds the classic complement pair",
          args: [[2, 7, 11, 15], 9],
          expected: [0, 1],
          comparator: "deepEqual",
        },
        {
          name: "uses distinct indices for duplicate values",
          args: [[3, 3], 6],
          expected: [0, 1],
          comparator: "deepEqual",
        },
        {
          name: "returns empty when there is no pair",
          args: [[1, 2, 3], 10],
          expected: [],
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/two-sum/",
    tags: ["dictionary", "complement", "one-pass"],
    recallChecks: [
      "Why must lookup happen before inserting the current index?",
      "What exactly is stored in the dictionary?",
      "Which invariant proves the same element cannot be used twice?",
    ],
  },
  {
    id: 49,
    title: "Group Anagrams",
    slug: "group-anagrams",
    difficulty: "Medium",
    pattern: "Arrays & Hashing",
    summary:
      "Group words that contain the same characters with the same multiplicities.",
    cue: "Turn each word into an immutable canonical frequency signature.",
    invariant:
      "Every word under a signature has exactly the 26 counts represented by that signature.",
    complexity: "O(nk) time · O(nk) space",
    languageNote:
      "A tuple is hashable and can serve as a dictionary key; a list cannot.",
    estimatedMinutes: 9,
    code: `from collections import defaultdict


class Solution:
    def groupAnagrams(self, strs: list[str]) -> list[list[str]]:
        groups: defaultdict[tuple[int, ...], list[str]] = defaultdict(list)

        for word in strs:
            counts = [0] * 26
            for character in word:
                counts[ord(character) - ord("a")] += 1
            groups[tuple(counts)].append(word)

        return list(groups.values())`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "groupAnagrams",
      },
      cases: [
        {
          name: "groups several anagram families",
          args: [["eat", "tea", "tan", "ate", "nat", "bat"]],
          expected: [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]],
          comparator: "unorderedNested",
        },
        {
          name: "groups an empty word",
          args: [[""]],
          expected: [[""]],
          comparator: "unorderedNested",
        },
        {
          name: "handles no words",
          args: [[]],
          expected: [],
          comparator: "unorderedNested",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/group-anagrams/",
    tags: ["frequency-signature", "defaultdict", "tuple"],
    recallChecks: [
      "Why must the count list become a tuple?",
      "What constraint makes a 26-slot signature valid?",
      "How would sorting each word change the time complexity?",
    ],
  },
  {
    id: 238,
    title: "Product of Array Except Self",
    slug: "product-of-array-except-self",
    difficulty: "Medium",
    pattern: "Arrays & Hashing",
    summary: "Build the product of all other positions without division.",
    cue: "Each answer is its left product multiplied by its right product.",
    invariant:
      "Before the reverse pass reaches i, answer[i] equals the product strictly left of i.",
    complexity: "O(n) time · O(1) auxiliary space excluding output",
    languageNote:
      "range(len(nums) - 1, -1, -1) is the standard explicit reverse-index loop.",
    estimatedMinutes: 9,
    code: `class Solution:
    def productExceptSelf(self, nums: list[int]) -> list[int]:
        answer = [1] * len(nums)
        prefix = 1

        for index, value in enumerate(nums):
            answer[index] = prefix
            prefix *= value

        suffix = 1
        for index in range(len(nums) - 1, -1, -1):
            answer[index] *= suffix
            suffix *= nums[index]

        return answer`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "productExceptSelf",
      },
      cases: [
        {
          name: "combines prefix and suffix products",
          args: [[1, 2, 3, 4]],
          expected: [24, 12, 8, 6],
          comparator: "deepEqual",
        },
        {
          name: "handles one zero",
          args: [[-1, 1, 0, -3, 3]],
          expected: [0, 0, 9, 0, 0],
          comparator: "deepEqual",
        },
        {
          name: "handles two zeros",
          args: [[0, 4, 0]],
          expected: [0, 0, 0],
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/product-of-array-except-self/",
    tags: ["prefix-product", "suffix-product", "array"],
    recallChecks: [
      "What does answer[i] hold after the forward pass?",
      "Why does this handle zeros without a special case?",
      "Which storage is excluded from the auxiliary-space claim?",
    ],
  },
  {
    id: 125,
    title: "Valid Palindrome",
    slug: "valid-palindrome",
    difficulty: "Easy",
    pattern: "Two Pointers",
    summary:
      "Decide whether text reads the same forward and backward after ignoring punctuation and case.",
    cue: "Advance inward from both ends, skipping characters outside the comparison alphabet.",
    invariant:
      "Every relevant character outside [left, right] has already matched its mirror.",
    complexity: "O(n) time · O(1) auxiliary space",
    languageNote:
      "str.isalnum and str.lower keep the pointer solution readable without allocating a normalized copy.",
    estimatedMinutes: 6,
    code: `class Solution:
    def isPalindrome(self, s: str) -> bool:
        left = 0
        right = len(s) - 1

        while left < right:
            while left < right and not s[left].isalnum():
                left += 1
            while left < right and not s[right].isalnum():
                right -= 1

            if s[left].lower() != s[right].lower():
                return False

            left += 1
            right -= 1

        return True`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "isPalindrome",
      },
      cases: [
        {
          name: "ignores punctuation and case",
          args: ["A man, a plan, a canal: Panama"],
          expected: true,
          comparator: "deepEqual",
        },
        {
          name: "rejects a real mismatch",
          args: ["race a car"],
          expected: false,
          comparator: "deepEqual",
        },
        {
          name: "treats punctuation-only text as a palindrome",
          args: ["., "],
          expected: true,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/valid-palindrome/",
    tags: ["two-pointers", "string", "normalization"],
    recallChecks: [
      "Why do both skip loops retain the left < right guard?",
      "What is already proven outside the active pointer range?",
      "How would pre-filtering the string change space usage?",
    ],
  },
  {
    id: 15,
    title: "3Sum",
    slug: "3sum",
    difficulty: "Medium",
    pattern: "Two Pointers",
    summary: "Return every unique triple whose values sum to zero.",
    cue: "Sort once, fix one value, then solve a two-sum search in the remaining suffix.",
    invariant:
      "Duplicate fixed and pointer values are skipped, so each emitted value triple is unique.",
    complexity: "O(n²) time · O(n) sorting space excluding output",
    languageNote:
      "Python's in-place list.sort is concise here because the input need not be preserved by the judge.",
    estimatedMinutes: 13,
    code: `class Solution:
    def threeSum(self, nums: list[int]) -> list[list[int]]:
        nums.sort()
        result: list[list[int]] = []

        for index, first in enumerate(nums):
            if first > 0:
                break
            if index > 0 and first == nums[index - 1]:
                continue

            left = index + 1
            right = len(nums) - 1

            while left < right:
                total = first + nums[left] + nums[right]
                if total < 0:
                    left += 1
                elif total > 0:
                    right -= 1
                else:
                    result.append([first, nums[left], nums[right]])
                    left += 1
                    right -= 1
                    while left < right and nums[left] == nums[left - 1]:
                        left += 1
                    while left < right and nums[right] == nums[right + 1]:
                        right -= 1

        return result`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "threeSum",
      },
      cases: [
        {
          name: "finds all unique zero-sum triples",
          args: [[-1, 0, 1, 2, -1, -4]],
          expected: [
            [-1, -1, 2],
            [-1, 0, 1],
          ],
          comparator: "unorderedNested",
        },
        {
          name: "deduplicates an all-zero triple",
          args: [[0, 0, 0, 0]],
          expected: [[0, 0, 0]],
          comparator: "unorderedNested",
        },
        {
          name: "returns none when all values are positive",
          args: [[1, 2, 3]],
          expected: [],
          comparator: "unorderedNested",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/3sum/",
    tags: ["sorting", "two-pointers", "deduplication"],
    recallChecks: [
      "Where must duplicates be skipped to guarantee unique triples?",
      "Why can the outer loop stop when first is positive?",
      "What sorted-order fact tells you which pointer to move?",
    ],
  },
  {
    id: 3,
    title: "Longest Substring Without Repeating Characters",
    slug: "longest-substring-without-repeating-characters",
    difficulty: "Medium",
    pattern: "Sliding Window",
    summary:
      "Find the maximum length of a contiguous substring with distinct characters.",
    cue: "A repeated character matters only when its last position is inside the current window.",
    invariant:
      "The window from left through right has no duplicate characters.",
    complexity: "O(n) time · O(k) space",
    languageNote:
      "max(left, last_seen[character] + 1) prevents the left boundary from moving backward.",
    estimatedMinutes: 8,
    code: `class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        last_seen: dict[str, int] = {}
        left = 0
        best = 0

        for right, character in enumerate(s):
            if character in last_seen:
                left = max(left, last_seen[character] + 1)
            last_seen[character] = right
            best = max(best, right - left + 1)

        return best`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "lengthOfLongestSubstring",
      },
      cases: [
        {
          name: "finds the best window amid repeats",
          args: ["abcabcbb"],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          name: "does not move the left edge backward",
          args: ["abba"],
          expected: 2,
          comparator: "deepEqual",
        },
        {
          name: "handles an empty string",
          args: [""],
          expected: 0,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl:
      "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
    tags: ["sliding-window", "last-index", "string"],
    recallChecks: [
      "Why must left never move backward?",
      "What does last_seen store: counts or positions?",
      "When is the window length measured?",
    ],
  },
  {
    id: 76,
    title: "Minimum Window Substring",
    slug: "minimum-window-substring",
    difficulty: "Medium",
    pattern: "Sliding Window",
    summary:
      "Find the shortest substring containing every required character with multiplicity.",
    cue: "Expand until all requirements are satisfied, then shrink while they remain satisfied.",
    invariant:
      "formed counts how many required character kinds currently meet their exact needed frequency.",
    complexity: "O(|s| + |t|) time · O(k) space",
    languageNote:
      "Counter captures multiplicity; defaultdict-free window updates stay explicit during shrink and expand.",
    estimatedMinutes: 15,
    code: `from collections import Counter


class Solution:
    def minWindow(self, s: str, t: str) -> str:
        if not t or len(t) > len(s):
            return ""

        need = Counter(t)
        window: dict[str, int] = {}
        required = len(need)
        formed = 0
        left = 0
        best_length = float("inf")
        best_start = 0

        for right, character in enumerate(s):
            window[character] = window.get(character, 0) + 1
            if character in need and window[character] == need[character]:
                formed += 1

            while formed == required:
                length = right - left + 1
                if length < best_length:
                    best_length = length
                    best_start = left

                leaving = s[left]
                window[leaving] -= 1
                if leaving in need and window[leaving] < need[leaving]:
                    formed -= 1
                left += 1

        if best_length == float("inf"):
            return ""
        return s[best_start : best_start + int(best_length)]`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "minWindow",
      },
      cases: [
        {
          name: "finds the minimum multiplicity-aware window",
          args: ["ADOBECODEBANC", "ABC"],
          expected: "BANC",
          comparator: "deepEqual",
        },
        {
          name: "supports repeated required characters",
          args: ["aa", "aa"],
          expected: "aa",
          comparator: "deepEqual",
        },
        {
          name: "returns empty when the requirement is impossible",
          args: ["a", "aa"],
          expected: "",
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/minimum-window-substring/",
    tags: ["sliding-window", "Counter", "minimum-window"],
    recallChecks: [
      "What exactly does formed count?",
      "Why update the best answer before removing the left character?",
      "Which comparison causes a requirement to become unsatisfied?",
    ],
  },
  {
    id: 20,
    title: "Valid Parentheses",
    slug: "valid-parentheses",
    difficulty: "Easy",
    pattern: "Stack",
    summary:
      "Check that every closer matches the most recent unmatched opener.",
    cue: "Nested delimiters require last-in, first-out matching.",
    invariant:
      "The stack contains exactly the unmatched opening delimiters in encounter order.",
    complexity: "O(n) time · O(n) space",
    languageNote:
      "list.append and list.pop provide an efficient stack at the right end of a Python list.",
    estimatedMinutes: 5,
    code: `class Solution:
    def isValid(self, s: str) -> bool:
        opener_for = {")": "(", "]": "[", "}": "{"}
        stack: list[str] = []

        for character in s:
            if character in opener_for:
                if not stack or stack.pop() != opener_for[character]:
                    return False
            else:
                stack.append(character)

        return not stack`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "isValid",
      },
      cases: [
        {
          name: "accepts nested and adjacent pairs",
          args: ["([]){}"],
          expected: true,
          comparator: "deepEqual",
        },
        {
          name: "rejects mismatched nesting",
          args: ["([)]"],
          expected: false,
          comparator: "deepEqual",
        },
        {
          name: "rejects an unmatched opener",
          args: ["("],
          expected: false,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/valid-parentheses/",
    tags: ["stack", "matching", "string"],
    recallChecks: [
      "Why must emptiness be checked before pop?",
      "What remains on the stack after a valid prefix?",
      "Why does the final answer require an empty stack?",
    ],
  },
  {
    id: 739,
    title: "Daily Temperatures",
    slug: "daily-temperatures",
    difficulty: "Medium",
    pattern: "Stack",
    summary: "For each day, count the wait until a warmer temperature.",
    cue: "Keep unresolved indices in decreasing temperature order.",
    invariant:
      "Temperatures at stack indices are non-increasing from bottom to top.",
    complexity: "O(n) time · O(n) space",
    languageNote:
      "Store indices rather than temperatures so one stack value supports both comparison and distance.",
    estimatedMinutes: 8,
    code: `class Solution:
    def dailyTemperatures(self, temperatures: list[int]) -> list[int]:
        answer = [0] * len(temperatures)
        stack: list[int] = []

        for index, temperature in enumerate(temperatures):
            while stack and temperatures[stack[-1]] < temperature:
                previous = stack.pop()
                answer[previous] = index - previous
            stack.append(index)

        return answer`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "dailyTemperatures",
      },
      cases: [
        {
          name: "resolves multiple pending temperatures",
          args: [[73, 74, 75, 71, 69, 72, 76, 73]],
          expected: [1, 1, 4, 2, 1, 1, 0, 0],
          comparator: "deepEqual",
        },
        {
          name: "leaves a decreasing sequence unresolved",
          args: [[90, 80, 70]],
          expected: [0, 0, 0],
          comparator: "deepEqual",
        },
        {
          name: "handles one day",
          args: [[70]],
          expected: [0],
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/daily-temperatures/",
    tags: ["monotonic-stack", "indices", "next-greater"],
    recallChecks: [
      "Why does each index enter and leave the stack at most once?",
      "What order do stack temperatures maintain?",
      "Why are unresolved answers correctly left as zero?",
    ],
  },
  {
    id: 704,
    title: "Binary Search",
    slug: "binary-search",
    difficulty: "Easy",
    pattern: "Binary Search",
    summary: "Return the index of a target in a sorted array, or -1.",
    cue: "One comparison discards half of the remaining inclusive search range.",
    invariant: "If the target exists, it remains within indices [left, right].",
    complexity: "O(log n) time · O(1) space",
    languageNote:
      "Use // for integer midpoint arithmetic; / produces a float in Python.",
    estimatedMinutes: 5,
    code: `class Solution:
    def search(self, nums: list[int], target: int) -> int:
        left = 0
        right = len(nums) - 1

        while left <= right:
            middle = left + (right - left) // 2
            if nums[middle] == target:
                return middle
            if nums[middle] < target:
                left = middle + 1
            else:
                right = middle - 1

        return -1`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "search",
      },
      cases: [
        {
          name: "finds an interior target",
          args: [[-1, 0, 3, 5, 9, 12], 9],
          expected: 4,
          comparator: "deepEqual",
        },
        {
          name: "returns minus one for a missing target",
          args: [[-1, 0, 3, 5, 9, 12], 2],
          expected: -1,
          comparator: "deepEqual",
        },
        {
          name: "returns minus one for an empty array",
          args: [[], 5],
          expected: -1,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/binary-search/",
    tags: ["binary-search", "inclusive-bounds", "sorted-array"],
    recallChecks: [
      "What search interval convention does this loop use?",
      "Why is the loop condition left <= right?",
      "Which operator produces an integer midpoint?",
    ],
  },
  {
    id: 875,
    title: "Koko Eating Bananas",
    slug: "koko-eating-bananas",
    difficulty: "Medium",
    pattern: "Binary Search",
    summary:
      "Find the smallest integer speed that finishes all piles within the hour limit.",
    cue: "Feasibility is monotonic: every speed above a feasible speed is also feasible.",
    invariant:
      "The minimum feasible speed remains inside the closed range [left, right].",
    complexity: "O(n log m) time · O(1) space, where m is the largest pile",
    languageNote:
      "(pile + speed - 1) // speed computes positive ceiling division without floating point.",
    estimatedMinutes: 10,
    code: `class Solution:
    def minEatingSpeed(self, piles: list[int], h: int) -> int:
        left = 1
        right = max(piles)

        while left < right:
            speed = left + (right - left) // 2
            hours = sum((pile + speed - 1) // speed for pile in piles)

            if hours <= h:
                right = speed
            else:
                left = speed + 1

        return left`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "minEatingSpeed",
      },
      cases: [
        {
          name: "finds the minimum feasible speed",
          args: [[3, 6, 7, 11], 8],
          expected: 4,
          comparator: "deepEqual",
        },
        {
          name: "handles one pile with spare hours",
          args: [[30], 5],
          expected: 6,
          comparator: "deepEqual",
        },
        {
          name: "requires the maximum pile speed at a tight deadline",
          args: [[30, 11, 23, 4, 20], 5],
          expected: 30,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/koko-eating-bananas/",
    tags: ["binary-search-on-answer", "monotonicity", "ceiling-division"],
    recallChecks: [
      "What boolean predicate is monotonic?",
      "Why set right = speed rather than speed - 1 when feasible?",
      "How is ceiling division computed using integers?",
    ],
  },
  {
    id: 206,
    title: "Reverse Linked List",
    slug: "reverse-linked-list",
    difficulty: "Easy",
    pattern: "Linked List",
    summary: "Reverse every pointer in a singly linked list.",
    cue: "Save the unreversed suffix before redirecting the current node.",
    invariant:
      "previous heads the fully reversed processed prefix; current heads the untouched suffix.",
    complexity: "O(n) time · O(1) space",
    languageNote:
      "Python tuple assignment can express the pointer rotation, but explicit steps make the mutation order easier to explain.",
    estimatedMinutes: 6,
    code: `class Solution:
    def reverseList(self, head: "ListNode | None") -> "ListNode | None":
        previous = None
        current = head

        while current is not None:
            following = current.next
            current.next = previous
            previous = current
            current = following

        return previous`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "reverseList",
      },
      cases: [
        {
          name: "reverses every link",
          args: [[1, 2, 3, 4, 5]],
          expected: [5, 4, 3, 2, 1],
          argCodecs: ["linkedList"],
          outputCodec: "linkedList",
          comparator: "deepEqual",
        },
        {
          name: "keeps a single node unchanged",
          args: [[1]],
          expected: [1],
          argCodecs: ["linkedList"],
          outputCodec: "linkedList",
          comparator: "deepEqual",
        },
        {
          name: "keeps an empty list empty",
          args: [[]],
          expected: [],
          argCodecs: ["linkedList"],
          outputCodec: "linkedList",
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/reverse-linked-list/",
    tags: ["linked-list", "pointer-reversal", "iteration"],
    recallChecks: [
      "Which pointer must be saved before mutation?",
      "What do previous and current each represent between iterations?",
      "Why is previous the new head when current becomes None?",
    ],
  },
  {
    id: 21,
    title: "Merge Two Sorted Lists",
    slug: "merge-two-sorted-lists",
    difficulty: "Easy",
    pattern: "Linked List",
    summary: "Splice two sorted linked lists into one sorted list.",
    cue: "A dummy head removes the special case for the first appended node.",
    invariant:
      "tail ends a sorted merged prefix containing every consumed node.",
    complexity: "O(n + m) time · O(1) space",
    languageNote:
      "Reusing existing nodes avoids allocations; only the sentinel node is new.",
    estimatedMinutes: 6,
    code: `class Solution:
    def mergeTwoLists(
        self, list1: "ListNode | None", list2: "ListNode | None"
    ) -> "ListNode | None":
        dummy = ListNode()
        tail = dummy

        while list1 is not None and list2 is not None:
            if list1.val <= list2.val:
                tail.next = list1
                list1 = list1.next
            else:
                tail.next = list2
                list2 = list2.next
            tail = tail.next

        tail.next = list1 if list1 is not None else list2
        return dummy.next`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "mergeTwoLists",
      },
      cases: [
        {
          name: "merges interleaved lists",
          args: [
            [1, 2, 4],
            [1, 3, 4],
          ],
          expected: [1, 1, 2, 3, 4, 4],
          argCodecs: ["linkedList", "linkedList"],
          outputCodec: "linkedList",
          comparator: "deepEqual",
        },
        {
          name: "returns the nonempty list when one is empty",
          args: [[], [0]],
          expected: [0],
          argCodecs: ["linkedList", "linkedList"],
          outputCodec: "linkedList",
          comparator: "deepEqual",
        },
        {
          name: "merges two empty lists",
          args: [[], []],
          expected: [],
          argCodecs: ["linkedList", "linkedList"],
          outputCodec: "linkedList",
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/merge-two-sorted-lists/",
    tags: ["linked-list", "dummy-node", "merge"],
    recallChecks: [
      "What special case does the dummy node eliminate?",
      "Why can the remaining suffix be attached in one step?",
      "What does tail guarantee after each iteration?",
    ],
  },
  {
    id: 141,
    title: "Linked List Cycle",
    slug: "linked-list-cycle",
    difficulty: "Easy",
    pattern: "Linked List",
    summary: "Detect whether following next pointers can revisit a node.",
    cue: "A fast pointer eventually laps a slow pointer exactly when a cycle exists.",
    invariant:
      "Before they meet, slow advances one edge and fast advances two edges per round.",
    complexity: "O(n) time · O(1) space",
    languageNote:
      "Use `is` for node identity; equal values do not imply the same linked-list node.",
    estimatedMinutes: 6,
    code: `class Solution:
    def hasCycle(self, head: "ListNode | None") -> bool:
        slow = head
        fast = head

        while fast is not None and fast.next is not None:
            slow = slow.next
            fast = fast.next.next
            if slow is fast:
                return True

        return False`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "hasCycle",
      },
      cases: [
        {
          name: "detects a cycle entering in the middle",
          args: [
            {
              values: [3, 2, 0, -4],
              pos: 1,
            },
          ],
          expected: true,
          argCodecs: ["cyclicLinkedList"],
          comparator: "deepEqual",
        },
        {
          name: "detects a self cycle",
          args: [
            {
              values: [1],
              pos: 0,
            },
          ],
          expected: true,
          argCodecs: ["cyclicLinkedList"],
          comparator: "deepEqual",
        },
        {
          name: "rejects an acyclic list",
          args: [
            {
              values: [1, 2],
              pos: -1,
            },
          ],
          expected: false,
          argCodecs: ["cyclicLinkedList"],
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/linked-list-cycle/",
    tags: ["linked-list", "fast-slow-pointers", "cycle"],
    recallChecks: [
      "Why compare nodes with `is` rather than their values?",
      "Which fast-pointer conditions prevent a None dereference?",
      "Why must the pointers meet if a cycle exists?",
    ],
  },
  {
    id: 104,
    title: "Maximum Depth of Binary Tree",
    slug: "maximum-depth-of-binary-tree",
    difficulty: "Easy",
    pattern: "Trees",
    summary: "Return the number of nodes on the longest root-to-leaf path.",
    cue: "Carry each node's depth beside it in an explicit DFS stack.",
    invariant:
      "Every stack pair contains a discovered node and its exact root-to-node depth.",
    complexity: "O(n) time · O(h) stack space",
    languageNote:
      "An explicit list stack keeps the DFS safe even when a valid skewed tree exceeds Python's recursion limit.",
    estimatedMinutes: 5,
    code: `class Solution:
    def maxDepth(self, root: "TreeNode | None") -> int:
        if root is None:
            return 0

        maximum = 0
        stack = [(root, 1)]

        while stack:
            node, depth = stack.pop()
            maximum = max(maximum, depth)

            if node.left is not None:
                stack.append((node.left, depth + 1))
            if node.right is not None:
                stack.append((node.right, depth + 1))

        return maximum`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "maxDepth",
      },
      cases: [
        {
          name: "finds depth across an uneven tree",
          args: [[3, 9, 20, null, null, 15, 7]],
          expected: 3,
          argCodecs: ["binaryTree"],
          comparator: "deepEqual",
        },
        {
          name: "returns one for a root-only tree",
          args: [[1]],
          expected: 1,
          argCodecs: ["binaryTree"],
          comparator: "deepEqual",
        },
        {
          name: "returns zero for an empty tree",
          args: [[]],
          expected: 0,
          argCodecs: ["binaryTree"],
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/maximum-depth-of-binary-tree/",
    tags: ["tree", "dfs", "explicit-stack"],
    recallChecks: [
      "What depth should an empty subtree return?",
      "What does the depth stored beside each node mean?",
      "Why does an explicit stack avoid Python's recursion ceiling?",
    ],
  },
  {
    id: 98,
    title: "Validate Binary Search Tree",
    slug: "validate-binary-search-tree",
    difficulty: "Medium",
    pattern: "Trees",
    summary:
      "Check that every node obeys all ancestor bounds of a binary search tree.",
    cue: "Carry an open lower and upper bound into each subtree.",
    invariant:
      "Every stack entry carries all ancestor bounds that its node must satisfy.",
    complexity: "O(n) time · O(h) stack space",
    languageNote:
      "An explicit stack avoids recursion-depth failures; float infinities make the initial open bounds concise.",
    estimatedMinutes: 9,
    code: `class Solution:
    def isValidBST(self, root: "TreeNode | None") -> bool:
        stack = [(root, float("-inf"), float("inf"))]

        while stack:
            node, lower, upper = stack.pop()
            if node is None:
                continue
            if not lower < node.val < upper:
                return False

            stack.append((node.left, lower, node.val))
            stack.append((node.right, node.val, upper))

        return True`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "isValidBST",
      },
      cases: [
        {
          name: "accepts a valid BST",
          args: [[2, 1, 3]],
          expected: true,
          argCodecs: ["binaryTree"],
          comparator: "deepEqual",
        },
        {
          name: "rejects an ancestor-bound violation",
          args: [[5, 1, 4, null, null, 3, 6]],
          expected: false,
          argCodecs: ["binaryTree"],
          comparator: "deepEqual",
        },
        {
          name: "rejects duplicate values",
          args: [[2, 2, 3]],
          expected: false,
          argCodecs: ["binaryTree"],
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/validate-binary-search-tree/",
    tags: ["tree", "bst", "bounds", "dfs"],
    recallChecks: [
      "Why is checking only each parent and child insufficient?",
      "Which bound changes when recursing left?",
      "Why are the inequalities strict?",
    ],
  },
  {
    id: 102,
    title: "Binary Tree Level Order Traversal",
    slug: "binary-tree-level-order-traversal",
    difficulty: "Medium",
    pattern: "Trees",
    summary: "Return tree values grouped by their distance from the root.",
    cue: "Capture the queue length before consuming one complete BFS level.",
    invariant:
      "At the start of an outer iteration, the queue contains exactly one tree level.",
    complexity: "O(n) time · O(w) space",
    languageNote:
      "deque.popleft keeps breadth-first traversal linear; a list queue with pop(0) would not.",
    estimatedMinutes: 7,
    code: `from collections import deque


class Solution:
    def levelOrder(self, root: "TreeNode | None") -> list[list[int]]:
        if root is None:
            return []

        queue = deque([root])
        levels: list[list[int]] = []

        while queue:
            level: list[int] = []
            for _ in range(len(queue)):
                node = queue.popleft()
                level.append(node.val)
                if node.left is not None:
                    queue.append(node.left)
                if node.right is not None:
                    queue.append(node.right)
            levels.append(level)

        return levels`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "levelOrder",
      },
      cases: [
        {
          name: "groups values by level",
          args: [[3, 9, 20, null, null, 15, 7]],
          expected: [[3], [9, 20], [15, 7]],
          argCodecs: ["binaryTree"],
          comparator: "deepEqual",
        },
        {
          name: "handles a single root",
          args: [[1]],
          expected: [[1]],
          argCodecs: ["binaryTree"],
          comparator: "deepEqual",
        },
        {
          name: "returns no levels for an empty tree",
          args: [[]],
          expected: [],
          argCodecs: ["binaryTree"],
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl:
      "https://leetcode.com/problems/binary-tree-level-order-traversal/",
    tags: ["tree", "bfs", "deque", "level-order"],
    recallChecks: [
      "Why must len(queue) be captured by range before the level loop grows the queue?",
      "What does the queue contain at each outer-loop boundary?",
      "What does w mean in the space complexity?",
    ],
  },
  {
    id: 215,
    title: "Kth Largest Element in an Array",
    slug: "kth-largest-element-in-an-array",
    difficulty: "Medium",
    pattern: "Heaps & Priority Queues",
    summary: "Return the kth largest value while retaining only k candidates.",
    cue: "Maintain a min-heap whose root is the weakest member of the current top k.",
    invariant:
      "After each value, the heap contains the largest min(k, processed count) values seen so far.",
    complexity: "O(n log k) time · O(k) space",
    languageNote:
      "heapq.heapreplace removes the root and pushes the stronger candidate in one guarded operation.",
    estimatedMinutes: 8,
    code: `import heapq


class Solution:
    def findKthLargest(self, nums: list[int], k: int) -> int:
        heap: list[int] = []

        for value in nums:
            if len(heap) < k:
                heapq.heappush(heap, value)
            elif value > heap[0]:
                heapq.heapreplace(heap, value)

        return heap[0]`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "findKthLargest",
      },
      cases: [
        {
          name: "finds the second-largest value",
          args: [[3, 2, 1, 5, 6, 4], 2],
          expected: 5,
          comparator: "deepEqual",
        },
        {
          name: "handles duplicate candidates",
          args: [[3, 2, 3, 1, 2, 4, 5, 5, 6], 4],
          expected: 4,
          comparator: "deepEqual",
        },
        {
          name: "returns the only value",
          args: [[7], 1],
          expected: 7,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/kth-largest-element-in-an-array/",
    tags: ["heapq", "top-k", "bounded-heap"],
    recallChecks: [
      "Why is the heap root the kth largest after all inputs?",
      "Why use a min-heap for a largest-k problem?",
      "When can an incoming value be ignored?",
    ],
  },
  {
    id: 347,
    title: "Top K Frequent Elements",
    slug: "top-k-frequent-elements",
    difficulty: "Medium",
    pattern: "Heaps & Priority Queues",
    summary: "Return the k values with the greatest occurrence counts.",
    cue: "Count first, then retain a heap of the k strongest (frequency, value) pairs.",
    invariant:
      "The heap contains the k highest-frequency candidates among values processed so far when its size reaches k.",
    complexity: "O(n + u log k) time · O(u + k) space",
    languageNote:
      "Counter.items supplies (value, frequency), so construct heap tuples in comparison-first order.",
    estimatedMinutes: 8,
    code: `from collections import Counter
import heapq


class Solution:
    def topKFrequent(self, nums: list[int], k: int) -> list[int]:
        counts = Counter(nums)
        heap: list[tuple[int, int]] = []

        for value, frequency in counts.items():
            heapq.heappush(heap, (frequency, value))
            if len(heap) > k:
                heapq.heappop(heap)

        return [value for _, value in heap]`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "topKFrequent",
      },
      cases: [
        {
          name: "returns the two most frequent values",
          args: [[1, 1, 1, 2, 2, 3], 2],
          expected: [1, 2],
          comparator: "unordered",
        },
        {
          name: "handles a single unique value",
          args: [[1], 1],
          expected: [1],
          comparator: "unordered",
        },
        {
          name: "returns every unique value when k reaches cardinality",
          args: [[4, 4, 5, 6], 3],
          expected: [4, 5, 6],
          comparator: "unordered",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/top-k-frequent-elements/",
    tags: ["Counter", "heapq", "top-k", "frequency"],
    recallChecks: [
      "Why does the heap never need more than k entries?",
      "Which tuple field controls heap ordering?",
      "What does u represent in the complexity?",
    ],
  },
  {
    id: 56,
    title: "Merge Intervals",
    slug: "merge-intervals",
    difficulty: "Medium",
    pattern: "Intervals",
    summary: "Combine every overlapping range into disjoint sorted ranges.",
    cue: "After sorting by start, only the last merged interval can overlap the next interval.",
    invariant:
      "merged is sorted and disjoint, and covers every interval processed so far.",
    complexity: "O(n log n) time · O(n) output space",
    languageNote:
      "Sorting lists of two integers uses lexicographic order, which naturally sorts by start then end.",
    estimatedMinutes: 8,
    code: `class Solution:
    def merge(self, intervals: list[list[int]]) -> list[list[int]]:
        intervals.sort()
        merged: list[list[int]] = []

        for start, end in intervals:
            if not merged or start > merged[-1][1]:
                merged.append([start, end])
            else:
                merged[-1][1] = max(merged[-1][1], end)

        return merged`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "merge",
      },
      cases: [
        {
          name: "merges overlapping intervals",
          args: [
            [
              [1, 3],
              [2, 6],
              [8, 10],
              [15, 18],
            ],
          ],
          expected: [
            [1, 6],
            [8, 10],
            [15, 18],
          ],
          comparator: "deepEqual",
        },
        {
          name: "merges intervals that touch at an endpoint",
          args: [
            [
              [1, 4],
              [4, 5],
            ],
          ],
          expected: [[1, 5]],
          comparator: "deepEqual",
        },
        {
          name: "handles an empty interval list",
          args: [[]],
          expected: [],
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/merge-intervals/",
    tags: ["intervals", "sorting", "merge"],
    recallChecks: [
      "Why can only the last output interval overlap the next input?",
      "Which comparison treats touching endpoints as overlapping?",
      "What invariant does merged maintain?",
    ],
  },
  {
    id: 57,
    title: "Insert Interval",
    slug: "insert-interval",
    difficulty: "Medium",
    pattern: "Intervals",
    summary:
      "Insert one range into sorted disjoint ranges and merge its overlaps.",
    cue: "Process intervals in three phases: before, overlapping, and after.",
    invariant:
      "Before the final append phase, result is sorted and merged covers every overlap encountered.",
    complexity: "O(n) time · O(n) output space",
    languageNote:
      "Tuple unpacking keeps the mutable merged start/end separate from the input list.",
    estimatedMinutes: 9,
    code: `class Solution:
    def insert(
        self, intervals: list[list[int]], newInterval: list[int]
    ) -> list[list[int]]:
        result: list[list[int]] = []
        start, end = newInterval
        index = 0

        while index < len(intervals) and intervals[index][1] < start:
            result.append(intervals[index])
            index += 1

        while index < len(intervals) and intervals[index][0] <= end:
            start = min(start, intervals[index][0])
            end = max(end, intervals[index][1])
            index += 1

        result.append([start, end])
        result.extend(intervals[index:])
        return result`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "insert",
      },
      cases: [
        {
          name: "merges an inserted overlapping interval",
          args: [
            [
              [1, 3],
              [6, 9],
            ],
            [2, 5],
          ],
          expected: [
            [1, 5],
            [6, 9],
          ],
          comparator: "deepEqual",
        },
        {
          name: "bridges several existing intervals",
          args: [
            [
              [1, 2],
              [3, 5],
              [6, 7],
              [8, 10],
              [12, 16],
            ],
            [4, 8],
          ],
          expected: [
            [1, 2],
            [3, 10],
            [12, 16],
          ],
          comparator: "deepEqual",
        },
        {
          name: "inserts into an empty list",
          args: [[], [5, 7]],
          expected: [[5, 7]],
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/insert-interval/",
    tags: ["intervals", "three-phase-scan", "merge"],
    recallChecks: [
      "Which inequalities distinguish before from overlapping?",
      "Why are later intervals safe to append unchanged?",
      "What range does (start, end) represent during the overlap phase?",
    ],
  },
  {
    id: 200,
    title: "Number of Islands",
    slug: "number-of-islands",
    difficulty: "Medium",
    pattern: "Graphs",
    summary: "Count connected components of land in a rectangular grid.",
    cue: "Each unseen land cell starts one traversal that marks its entire component.",
    invariant:
      "Every land cell changed to water belongs to exactly one already-counted island.",
    complexity:
      "O(rows · columns) time · O(rows · columns) worst-case worklist space",
    languageNote:
      "Mutating the grid serves as the visited set, while an explicit list stack avoids Python recursion-depth failures.",
    estimatedMinutes: 9,
    code: `class Solution:
    def numIslands(self, grid: list[list[str]]) -> int:
        if not grid or not grid[0]:
            return 0

        rows = len(grid)
        columns = len(grid[0])

        def flood(start_row: int, start_column: int) -> None:
            stack = [(start_row, start_column)]
            grid[start_row][start_column] = "0"

            while stack:
                row, column = stack.pop()
                for row_offset, column_offset in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    next_row = row + row_offset
                    next_column = column + column_offset

                    if (
                        0 <= next_row < rows
                        and 0 <= next_column < columns
                        and grid[next_row][next_column] == "1"
                    ):
                        grid[next_row][next_column] = "0"
                        stack.append((next_row, next_column))

        islands = 0
        for row in range(rows):
            for column in range(columns):
                if grid[row][column] == "1":
                    islands += 1
                    flood(row, column)

        return islands`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "numIslands",
      },
      cases: [
        {
          name: "counts multiple disconnected islands",
          args: [
            [
              ["1", "1", "0", "0", "0"],
              ["1", "1", "0", "0", "0"],
              ["0", "0", "1", "0", "0"],
              ["0", "0", "0", "1", "1"],
            ],
          ],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          name: "counts one connected island",
          args: [
            [
              ["1", "1"],
              ["1", "1"],
            ],
          ],
          expected: 1,
          comparator: "deepEqual",
        },
        {
          name: "returns zero for an empty grid",
          args: [[]],
          expected: 0,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/number-of-islands/",
    tags: ["graph", "grid", "dfs", "connected-components"],
    recallChecks: [
      "Why increment the count before flooding?",
      "How does mutating the grid replace a visited set?",
      "Why mark a neighbor before pushing it onto the stack?",
    ],
  },
  {
    id: 207,
    title: "Course Schedule",
    slug: "course-schedule",
    difficulty: "Medium",
    pattern: "Graphs",
    summary:
      "Determine whether all courses can be completed under prerequisite edges.",
    cue: "Repeatedly remove zero-indegree nodes; a cycle leaves some nodes unremoved.",
    invariant:
      "indegree[c] equals the number of c's prerequisites not yet processed.",
    complexity: "O(V + E) time · O(V + E) space",
    languageNote:
      "deque implements Kahn's algorithm cleanly, and list-of-lists is enough for integer-labeled vertices.",
    estimatedMinutes: 11,
    code: `from collections import deque


class Solution:
    def canFinish(self, numCourses: int, prerequisites: list[list[int]]) -> bool:
        graph = [[] for _ in range(numCourses)]
        indegree = [0] * numCourses

        for course, prerequisite in prerequisites:
            graph[prerequisite].append(course)
            indegree[course] += 1

        queue = deque(
            course for course, degree in enumerate(indegree) if degree == 0
        )
        completed = 0

        while queue:
            prerequisite = queue.popleft()
            completed += 1

            for course in graph[prerequisite]:
                indegree[course] -= 1
                if indegree[course] == 0:
                    queue.append(course)

        return completed == numCourses`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "canFinish",
      },
      cases: [
        {
          name: "accepts an acyclic prerequisite chain",
          args: [2, [[1, 0]]],
          expected: true,
          comparator: "deepEqual",
        },
        {
          name: "rejects a two-course cycle",
          args: [
            2,
            [
              [1, 0],
              [0, 1],
            ],
          ],
          expected: false,
          comparator: "deepEqual",
        },
        {
          name: "accepts courses with no prerequisites",
          args: [3, []],
          expected: true,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/course-schedule/",
    tags: ["graph", "topological-sort", "indegree", "bfs"],
    recallChecks: [
      "What direction does each adjacency edge point?",
      "What does an indegree of zero mean during the algorithm?",
      "Why does completed < numCourses imply a cycle?",
    ],
  },
  {
    id: 39,
    title: "Combination Sum",
    slug: "combination-sum",
    difficulty: "Medium",
    pattern: "Backtracking",
    summary:
      "Generate combinations of reusable candidates that total a target.",
    cue: "After choosing a reusable value, recurse from the same candidate index.",
    invariant:
      "path is nondecreasing by candidate index and sums to target minus remaining.",
    complexity:
      "Output-sensitive exponential time · O(target / min(candidate)) stack space",
    languageNote:
      "Append before recursion and pop afterward to reuse one mutable path safely.",
    estimatedMinutes: 10,
    code: `class Solution:
    def combinationSum(self, candidates: list[int], target: int) -> list[list[int]]:
        candidates.sort()
        result: list[list[int]] = []
        path: list[int] = []

        def backtrack(start: int, remaining: int) -> None:
            if remaining == 0:
                result.append(path.copy())
                return

            for index in range(start, len(candidates)):
                value = candidates[index]
                if value > remaining:
                    break

                path.append(value)
                backtrack(index, remaining - value)
                path.pop()

        backtrack(0, target)
        return result`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "combinationSum",
      },
      cases: [
        {
          name: "finds reusable candidate combinations",
          args: [[2, 3, 6, 7], 7],
          expected: [[2, 2, 3], [7]],
          comparator: "unorderedNested",
        },
        {
          name: "finds several combination lengths",
          args: [[2, 3, 5], 8],
          expected: [
            [2, 2, 2, 2],
            [2, 3, 3],
            [3, 5],
          ],
          comparator: "unorderedNested",
        },
        {
          name: "returns none when the target is unreachable",
          args: [[4, 6], 5],
          expected: [],
          comparator: "unorderedNested",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/combination-sum/",
    tags: ["backtracking", "choose-explore-unchoose", "combinations"],
    recallChecks: [
      "Why recurse with index instead of index + 1?",
      "Why must path be copied when recording an answer?",
      "What benefit does sorting candidates provide?",
    ],
  },
  {
    id: 79,
    title: "Word Search",
    slug: "word-search",
    difficulty: "Medium",
    pattern: "Backtracking",
    summary:
      "Determine whether adjacent grid cells can spell a word without reusing a cell.",
    cue: "Temporarily mark one cell, explore four choices, then restore it.",
    invariant:
      "Cells marked during a call are exactly the current word-prefix path and cannot be reused.",
    complexity: "O(rows · columns · 3^L) time · O(L) stack space",
    languageNote:
      "In-place marking avoids allocating a visited set for every starting position, but restoration is mandatory.",
    estimatedMinutes: 12,
    code: `class Solution:
    def exist(self, board: list[list[str]], word: str) -> bool:
        rows = len(board)
        columns = len(board[0])

        def search(row: int, column: int, index: int) -> bool:
            if index == len(word):
                return True
            if (
                row < 0
                or row >= rows
                or column < 0
                or column >= columns
                or board[row][column] != word[index]
            ):
                return False

            character = board[row][column]
            board[row][column] = "#"
            found = (
                search(row + 1, column, index + 1)
                or search(row - 1, column, index + 1)
                or search(row, column + 1, index + 1)
                or search(row, column - 1, index + 1)
            )
            board[row][column] = character
            return found

        for row in range(rows):
            for column in range(columns):
                if search(row, column, 0):
                    return True

        return False`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "exist",
      },
      cases: [
        {
          name: "finds a word along adjacent cells",
          args: [
            [
              ["A", "B", "C", "E"],
              ["S", "F", "C", "S"],
              ["A", "D", "E", "E"],
            ],
            "ABCCED",
          ],
          expected: true,
          comparator: "deepEqual",
        },
        {
          name: "rejects a path that would reuse one cell",
          args: [
            [
              ["A", "B", "C", "E"],
              ["S", "F", "C", "S"],
              ["A", "D", "E", "E"],
            ],
            "ABCB",
          ],
          expected: false,
          comparator: "deepEqual",
        },
        {
          name: "handles a matching single cell",
          args: [[["A"]], "A"],
          expected: true,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/word-search/",
    tags: ["backtracking", "grid", "in-place-marking"],
    recallChecks: [
      "Why must the cell be restored even after a successful recursive branch?",
      "What does index represent at function entry?",
      "Why is the branching factor closer to three after the first step?",
    ],
  },
  {
    id: 55,
    title: "Jump Game",
    slug: "jump-game",
    difficulty: "Medium",
    pattern: "Greedy",
    summary: "Decide whether forward jumps can reach the final array index.",
    cue: "Track the farthest reachable index rather than committing to a particular path.",
    invariant:
      "farthest is the maximum index reachable using positions through the current index.",
    complexity: "O(n) time · O(1) space",
    languageNote:
      "enumerate exposes both the position and jump capacity without manual indexing.",
    estimatedMinutes: 7,
    code: `class Solution:
    def canJump(self, nums: list[int]) -> bool:
        farthest = 0

        for index, jump in enumerate(nums):
            if index > farthest:
                return False
            farthest = max(farthest, index + jump)
            if farthest >= len(nums) - 1:
                return True

        return True`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "canJump",
      },
      cases: [
        {
          name: "reaches the end across several jumps",
          args: [[2, 3, 1, 1, 4]],
          expected: true,
          comparator: "deepEqual",
        },
        {
          name: "detects an unreachable suffix",
          args: [[3, 2, 1, 0, 4]],
          expected: false,
          comparator: "deepEqual",
        },
        {
          name: "accepts a single-position array",
          args: [[0]],
          expected: true,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/jump-game/",
    tags: ["greedy", "reachability", "farthest-boundary"],
    recallChecks: [
      "What does farthest summarize?",
      "Why is index > farthest definitive failure?",
      "Why does this not need to remember a concrete jump path?",
    ],
  },
  {
    id: 70,
    title: "Climbing Stairs",
    slug: "climbing-stairs",
    difficulty: "Easy",
    pattern: "Dynamic Programming",
    summary: "Count ways to reach the top using one-step or two-step moves.",
    cue: "Every route to step i arrives from step i - 1 or i - 2.",
    invariant:
      "previous_two and previous_one store the ways to reach the two preceding step counts.",
    complexity: "O(n) time · O(1) space",
    languageNote:
      "Parallel assignment updates the rolling DP state without a temporary variable.",
    estimatedMinutes: 5,
    code: `class Solution:
    def climbStairs(self, n: int) -> int:
        previous_two = 1
        previous_one = 1

        for _ in range(2, n + 1):
            previous_two, previous_one = (
                previous_one,
                previous_two + previous_one,
            )

        return previous_one`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "climbStairs",
      },
      cases: [
        {
          name: "counts one-step input",
          args: [1],
          expected: 1,
          comparator: "deepEqual",
        },
        {
          name: "counts two-step input",
          args: [2],
          expected: 2,
          comparator: "deepEqual",
        },
        {
          name: "counts a larger recurrence",
          args: [5],
          expected: 8,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/climbing-stairs/",
    tags: ["dynamic-programming", "rolling-state", "fibonacci"],
    recallChecks: [
      "Why is there one way to reach step zero?",
      "What do the two state variables mean before each update?",
      "How does parallel assignment avoid overwriting needed state?",
    ],
  },
  {
    id: 198,
    title: "House Robber",
    slug: "house-robber",
    difficulty: "Medium",
    pattern: "Dynamic Programming",
    summary: "Maximize non-adjacent values selected from a line of houses.",
    cue: "At each house, compare skipping it with taking it after the best two houses back.",
    invariant:
      "previous_one is the best total for the processed prefix; previous_two is the best total before its final house.",
    complexity: "O(n) time · O(1) space",
    languageNote:
      "Tuple assignment makes the two-state recurrence compact while evaluating the right side from old values.",
    estimatedMinutes: 7,
    code: `class Solution:
    def rob(self, nums: list[int]) -> int:
        previous_two = 0
        previous_one = 0

        for money in nums:
            previous_two, previous_one = (
                previous_one,
                max(previous_one, previous_two + money),
            )

        return previous_one`,
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "rob",
      },
      cases: [
        {
          name: "chooses the best nonadjacent houses",
          args: [[1, 2, 3, 1]],
          expected: 4,
          comparator: "deepEqual",
        },
        {
          name: "handles competing interior choices",
          args: [[2, 7, 9, 3, 1]],
          expected: 12,
          comparator: "deepEqual",
        },
        {
          name: "returns zero for no houses",
          args: [[]],
          expected: 0,
          comparator: "deepEqual",
        },
      ],
    },
    sourceUrl: "https://leetcode.com/problems/house-robber/",
    tags: ["dynamic-programming", "include-exclude", "rolling-state"],
    recallChecks: [
      "Which two choices form the recurrence?",
      "Why is previous_two safe to combine with the current house?",
      "What does previous_one mean after the final iteration?",
    ],
  },
];
