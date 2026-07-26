export type Difficulty = "Easy" | "Medium";

export type Pattern =
  | "Arrays & Hashing"
  | "Two Pointers"
  | "Sliding Window"
  | "Stack"
  | "Binary Search"
  | "Linked List"
  | "Trees"
  | "Intervals"
  | "Graphs"
  | "Backtracking"
  | "Dynamic Programming"
  | "Greedy";

export type Problem = {
  id: number;
  title: string;
  slug: string;
  difficulty: Difficulty;
  pattern: Pattern;
  summary: string;
  cue: string;
  invariant: string;
  complexity: string;
  swiftNote: string;
  estimatedMinutes: number;
  code: string;
  isCustom?: boolean;
  sourceUrl?: string;
};

export const PATTERN_ORDER: Pattern[] = [
  "Arrays & Hashing",
  "Two Pointers",
  "Sliding Window",
  "Stack",
  "Binary Search",
  "Linked List",
  "Trees",
  "Intervals",
  "Graphs",
  "Backtracking",
  "Greedy",
  "Dynamic Programming",
];

export const PROBLEMS: Problem[] = [
  {
    id: 1,
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "Easy",
    pattern: "Arrays & Hashing",
    summary: "Return the two indices whose values add to a target.",
    cue: "You need to find a complement while scanning once.",
    invariant: "The dictionary contains only values from indices before the current index.",
    complexity: "O(n) time · O(n) space",
    swiftNote: "Use Dictionary subscript lookup with optional binding.",
    estimatedMinutes: 4,
    code: `class Solution {
    func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
        var indexByValue: [Int: Int] = [:]

        for (index, value) in nums.enumerated() {
            if let partnerIndex = indexByValue[target - value] {
                return [partnerIndex, index]
            }
            indexByValue[value] = index
        }

        return []
    }
}`,
  },
  {
    id: 217,
    title: "Contains Duplicate",
    slug: "contains-duplicate",
    difficulty: "Easy",
    pattern: "Arrays & Hashing",
    summary: "Determine whether any value appears more than once.",
    cue: "You only need to know whether a value has appeared before.",
    invariant: "The set contains every value already processed.",
    complexity: "O(n) time · O(n) space",
    swiftNote: "Set.insert returns an inserted flag and the member after insertion.",
    estimatedMinutes: 3,
    code: `class Solution {
    func containsDuplicate(_ nums: [Int]) -> Bool {
        var seen: Set<Int> = []

        for value in nums {
            if !seen.insert(value).inserted {
                return true
            }
        }

        return false
    }
}`,
  },
  {
    id: 242,
    title: "Valid Anagram",
    slug: "valid-anagram",
    difficulty: "Easy",
    pattern: "Arrays & Hashing",
    summary: "Check whether two strings contain identical character counts.",
    cue: "Order is irrelevant, but multiplicity matters.",
    invariant: "Each count equals occurrences in the first string minus occurrences consumed by the second.",
    complexity: "O(n) time · O(k) space",
    swiftNote: "Character is Hashable and works directly as a dictionary key.",
    estimatedMinutes: 4,
    code: `class Solution {
    func isAnagram(_ s: String, _ t: String) -> Bool {
        guard s.count == t.count else {
            return false
        }

        var counts: [Character: Int] = [:]
        for character in s {
            counts[character, default: 0] += 1
        }

        for character in t {
            guard let count = counts[character], count > 0 else {
                return false
            }
            counts[character] = count - 1
        }

        return true
    }
}`,
  },
  {
    id: 49,
    title: "Group Anagrams",
    slug: "group-anagrams",
    difficulty: "Medium",
    pattern: "Arrays & Hashing",
    summary: "Group words that share the same multiset of characters.",
    cue: "Equivalent words need a stable shared key.",
    invariant: "Every word stored under a key has exactly the characters represented by that key.",
    complexity: "O(n · k log k) time · O(nk) space",
    swiftNote: "String(word.sorted()) creates a simple Hashable canonical key.",
    estimatedMinutes: 7,
    code: `class Solution {
    func groupAnagrams(_ strs: [String]) -> [[String]] {
        var groups: [String: [String]] = [:]

        for word in strs {
            let key = String(word.sorted())
            groups[key, default: []].append(word)
        }

        return Array(groups.values)
    }
}`,
  },
  {
    id: 238,
    title: "Product of Array Except Self",
    slug: "product-of-array-except-self",
    difficulty: "Medium",
    pattern: "Arrays & Hashing",
    summary: "Build each position’s product without using its own value or division.",
    cue: "Each answer is a left product multiplied by a right product.",
    invariant: "Before the reverse pass reaches i, output[i] stores the product strictly left of i.",
    complexity: "O(n) time · O(1) extra space",
    swiftNote: "Initialize a mutable output array with Array(repeating:count:).",
    estimatedMinutes: 8,
    code: `class Solution {
    func productExceptSelf(_ nums: [Int]) -> [Int] {
        var output = Array(repeating: 1, count: nums.count)
        var prefix = 1

        for index in nums.indices {
            output[index] = prefix
            prefix *= nums[index]
        }

        var suffix = 1
        for index in nums.indices.reversed() {
            output[index] *= suffix
            suffix *= nums[index]
        }

        return output
    }
}`,
  },
  {
    id: 125,
    title: "Valid Palindrome",
    slug: "valid-palindrome",
    difficulty: "Easy",
    pattern: "Two Pointers",
    summary: "Decide whether normalized text reads the same in both directions.",
    cue: "Matching positions approach each other from opposite ends.",
    invariant: "Everything outside the active pointer range has already matched.",
    complexity: "O(n) time · O(n) space",
    swiftNote: "Converting String to [Character] makes integer indexing explicit.",
    estimatedMinutes: 5,
    code: `class Solution {
    func isPalindrome(_ s: String) -> Bool {
        let characters = Array(s.lowercased()).filter {
            $0.isLetter || $0.isNumber
        }

        var left = 0
        var right = characters.count - 1

        while left < right {
            if characters[left] != characters[right] {
                return false
            }
            left += 1
            right -= 1
        }

        return true
    }
}`,
  },
  {
    id: 167,
    title: "Two Sum II",
    slug: "two-sum-ii-input-array-is-sorted",
    difficulty: "Medium",
    pattern: "Two Pointers",
    summary: "Find a target pair in a sorted array using constant extra space.",
    cue: "Sorted order tells you which pointer can improve the sum.",
    invariant: "No discarded index can participate in a valid remaining pair.",
    complexity: "O(n) time · O(1) space",
    swiftNote: "The requested answer uses one-based indices.",
    estimatedMinutes: 5,
    code: `class Solution {
    func twoSum(_ numbers: [Int], _ target: Int) -> [Int] {
        var left = 0
        var right = numbers.count - 1

        while left < right {
            let sum = numbers[left] + numbers[right]
            if sum == target {
                return [left + 1, right + 1]
            } else if sum < target {
                left += 1
            } else {
                right -= 1
            }
        }

        return []
    }
}`,
  },
  {
    id: 15,
    title: "3Sum",
    slug: "3sum",
    difficulty: "Medium",
    pattern: "Two Pointers",
    summary: "Return unique triples whose values sum to zero.",
    cue: "Sorting converts each fixed first value into a two-pointer search.",
    invariant: "Duplicate first and pointer values are skipped, so every emitted triple is unique.",
    complexity: "O(n²) time · O(n) output space",
    swiftNote: "Use indices rather than repeated Array slicing to avoid copies.",
    estimatedMinutes: 12,
    code: `class Solution {
    func threeSum(_ nums: [Int]) -> [[Int]] {
        let sorted = nums.sorted()
        var result: [[Int]] = []

        for index in sorted.indices {
            if index > 0, sorted[index] == sorted[index - 1] {
                continue
            }

            var left = index + 1
            var right = sorted.count - 1

            while left < right {
                let sum = sorted[index] + sorted[left] + sorted[right]
                if sum < 0 {
                    left += 1
                } else if sum > 0 {
                    right -= 1
                } else {
                    result.append([sorted[index], sorted[left], sorted[right]])
                    repeat { left += 1 } while left < right && sorted[left] == sorted[left - 1]
                    repeat { right -= 1 } while left < right && sorted[right] == sorted[right + 1]
                }
            }
        }

        return result
    }
}`,
  },
  {
    id: 11,
    title: "Container With Most Water",
    slug: "container-with-most-water",
    difficulty: "Medium",
    pattern: "Two Pointers",
    summary: "Choose two vertical lines that hold the greatest area.",
    cue: "Width shrinks every step, so only replacing the shorter wall can help.",
    invariant: "After moving the shorter side, no discarded pair could beat the best using that side.",
    complexity: "O(n) time · O(1) space",
    swiftNote: "min and max keep the area update compact and readable.",
    estimatedMinutes: 7,
    code: `class Solution {
    func maxArea(_ height: [Int]) -> Int {
        var left = 0
        var right = height.count - 1
        var best = 0

        while left < right {
            let width = right - left
            best = max(best, width * min(height[left], height[right]))

            if height[left] < height[right] {
                left += 1
            } else {
                right -= 1
            }
        }

        return best
    }
}`,
  },
  {
    id: 121,
    title: "Best Time to Buy and Sell Stock",
    slug: "best-time-to-buy-and-sell-stock",
    difficulty: "Easy",
    pattern: "Sliding Window",
    summary: "Find the best profit from one buy followed by one sale.",
    cue: "Every selling day only needs the cheapest earlier buying day.",
    invariant: "minimumPrice is the lowest price strictly before or at the current day.",
    complexity: "O(n) time · O(1) space",
    swiftNote: "Initialize from the first element after guarding empty input.",
    estimatedMinutes: 4,
    code: `class Solution {
    func maxProfit(_ prices: [Int]) -> Int {
        guard var minimumPrice = prices.first else {
            return 0
        }

        var bestProfit = 0
        for price in prices {
            minimumPrice = min(minimumPrice, price)
            bestProfit = max(bestProfit, price - minimumPrice)
        }

        return bestProfit
    }
}`,
  },
  {
    id: 3,
    title: "Longest Substring Without Repeating Characters",
    slug: "longest-substring-without-repeating-characters",
    difficulty: "Medium",
    pattern: "Sliding Window",
    summary: "Find the longest contiguous run with no repeated character.",
    cue: "A duplicate only matters if its previous position is inside the current window.",
    invariant: "The active window contains no duplicate characters.",
    complexity: "O(n) time · O(n) space",
    swiftNote: "Array(s) avoids expensive String.Index movement in interview code.",
    estimatedMinutes: 8,
    code: `class Solution {
    func lengthOfLongestSubstring(_ s: String) -> Int {
        let characters = Array(s)
        var lastIndex: [Character: Int] = [:]
        var left = 0
        var best = 0

        for (right, character) in characters.enumerated() {
            if let previous = lastIndex[character], previous >= left {
                left = previous + 1
            }
            lastIndex[character] = right
            best = max(best, right - left + 1)
        }

        return best
    }
}`,
  },
  {
    id: 424,
    title: "Longest Repeating Character Replacement",
    slug: "longest-repeating-character-replacement",
    difficulty: "Medium",
    pattern: "Sliding Window",
    summary: "Find the longest window that can become one repeated character using at most k replacements.",
    cue: "Window size minus its most frequent character is the replacement cost.",
    invariant: "After shrinking, the active window needs at most k replacements under the tracked maximum frequency.",
    complexity: "O(n) time · O(k) space",
    swiftNote: "Track a historical maxFrequency; it never needs to decrease for this objective.",
    estimatedMinutes: 10,
    code: `class Solution {
    func characterReplacement(_ s: String, _ k: Int) -> Int {
        let characters = Array(s)
        var counts: [Character: Int] = [:]
        var left = 0
        var maxFrequency = 0
        var best = 0

        for right in characters.indices {
            let character = characters[right]
            counts[character, default: 0] += 1
            maxFrequency = max(maxFrequency, counts[character]!)

            while right - left + 1 - maxFrequency > k {
                counts[characters[left], default: 0] -= 1
                left += 1
            }

            best = max(best, right - left + 1)
        }

        return best
    }
}`,
  },
  {
    id: 20,
    title: "Valid Parentheses",
    slug: "valid-parentheses",
    difficulty: "Easy",
    pattern: "Stack",
    summary: "Check that every closing delimiter matches the most recent unclosed opener.",
    cue: "Nested structure requires last-in, first-out matching.",
    invariant: "The stack contains exactly the unmatched opening delimiters in order.",
    complexity: "O(n) time · O(n) space",
    swiftNote: "popLast safely returns an optional and avoids removeLast crashes.",
    estimatedMinutes: 5,
    code: `class Solution {
    func isValid(_ s: String) -> Bool {
        let openingForClosing: [Character: Character] = [
            ")": "(", "]": "[", "}": "{"
        ]
        var stack: [Character] = []

        for character in s {
            if let expected = openingForClosing[character] {
                guard stack.popLast() == expected else {
                    return false
                }
            } else {
                stack.append(character)
            }
        }

        return stack.isEmpty
    }
}`,
  },
  {
    id: 739,
    title: "Daily Temperatures",
    slug: "daily-temperatures",
    difficulty: "Medium",
    pattern: "Stack",
    summary: "For each day, count how long until a warmer temperature appears.",
    cue: "Unresolved days should be ordered so a warmer value can resolve several at once.",
    invariant: "Indices in the stack have temperatures in non-increasing order.",
    complexity: "O(n) time · O(n) space",
    swiftNote: "Store indices in the stack so you can compute distances and access values.",
    estimatedMinutes: 8,
    code: `class Solution {
    func dailyTemperatures(_ temperatures: [Int]) -> [Int] {
        var answer = Array(repeating: 0, count: temperatures.count)
        var stack: [Int] = []

        for index in temperatures.indices {
            while let previous = stack.last,
                  temperatures[previous] < temperatures[index] {
                stack.removeLast()
                answer[previous] = index - previous
            }
            stack.append(index)
        }

        return answer
    }
}`,
  },
  {
    id: 704,
    title: "Binary Search",
    slug: "binary-search",
    difficulty: "Easy",
    pattern: "Binary Search",
    summary: "Find a target in a sorted array or return -1.",
    cue: "A comparison can eliminate half of the remaining candidates.",
    invariant: "If the target exists, it remains inside the inclusive [left, right] range.",
    complexity: "O(log n) time · O(1) space",
    swiftNote: "An empty array naturally produces right = -1 and skips the loop.",
    estimatedMinutes: 5,
    code: `class Solution {
    func search(_ nums: [Int], _ target: Int) -> Int {
        var left = 0
        var right = nums.count - 1

        while left <= right {
            let middle = left + (right - left) / 2
            if nums[middle] == target {
                return middle
            } else if nums[middle] < target {
                left = middle + 1
            } else {
                right = middle - 1
            }
        }

        return -1
    }
}`,
  },
  {
    id: 33,
    title: "Search in Rotated Sorted Array",
    slug: "search-in-rotated-sorted-array",
    difficulty: "Medium",
    pattern: "Binary Search",
    summary: "Locate a target in a sorted array rotated at an unknown pivot.",
    cue: "At least one half around the midpoint is still normally sorted.",
    invariant: "Each comparison preserves the only half that can still contain the target.",
    complexity: "O(log n) time · O(1) space",
    swiftNote: "Use closed-range comparisons rather than constructing Range values.",
    estimatedMinutes: 10,
    code: `class Solution {
    func search(_ nums: [Int], _ target: Int) -> Int {
        var left = 0
        var right = nums.count - 1

        while left <= right {
            let middle = left + (right - left) / 2
            if nums[middle] == target {
                return middle
            }

            if nums[left] <= nums[middle] {
                if nums[left] <= target && target < nums[middle] {
                    right = middle - 1
                } else {
                    left = middle + 1
                }
            } else if nums[middle] < target && target <= nums[right] {
                left = middle + 1
            } else {
                right = middle - 1
            }
        }

        return -1
    }
}`,
  },
  {
    id: 153,
    title: "Find Minimum in Rotated Sorted Array",
    slug: "find-minimum-in-rotated-sorted-array",
    difficulty: "Medium",
    pattern: "Binary Search",
    summary: "Find the smallest value in a rotated array of unique values.",
    cue: "The right endpoint reveals which side contains the rotation boundary.",
    invariant: "The minimum always remains inside the inclusive search range.",
    complexity: "O(log n) time · O(1) space",
    swiftNote: "This problem guarantees a non-empty array.",
    estimatedMinutes: 7,
    code: `class Solution {
    func findMin(_ nums: [Int]) -> Int {
        var left = 0
        var right = nums.count - 1

        while left < right {
            let middle = left + (right - left) / 2
            if nums[middle] > nums[right] {
                left = middle + 1
            } else {
                right = middle
            }
        }

        return nums[left]
    }
}`,
  },
  {
    id: 206,
    title: "Reverse Linked List",
    slug: "reverse-linked-list",
    difficulty: "Easy",
    pattern: "Linked List",
    summary: "Reverse a singly linked list in place.",
    cue: "Save the forward link before redirecting it.",
    invariant: "previous is the fully reversed prefix and current starts the untouched suffix.",
    complexity: "O(n) time · O(1) space",
    swiftNote: "ListNode is supplied by LeetCode; its next property is mutable.",
    estimatedMinutes: 5,
    code: `class Solution {
    func reverseList(_ head: ListNode?) -> ListNode? {
        var previous: ListNode?
        var current = head

        while let node = current {
            let next = node.next
            node.next = previous
            previous = node
            current = next
        }

        return previous
    }
}`,
  },
  {
    id: 21,
    title: "Merge Two Sorted Lists",
    slug: "merge-two-sorted-lists",
    difficulty: "Easy",
    pattern: "Linked List",
    summary: "Merge two ordered linked lists into one ordered chain.",
    cue: "The smaller current node must be the next output node.",
    invariant: "Everything before tail is the complete sorted merge of consumed nodes.",
    complexity: "O(n + m) time · O(1) space",
    swiftNote: "A dummy node removes special handling for the first appended node.",
    estimatedMinutes: 7,
    code: `class Solution {
    func mergeTwoLists(_ list1: ListNode?, _ list2: ListNode?) -> ListNode? {
        let dummy = ListNode(0)
        var tail = dummy
        var left = list1
        var right = list2

        while let leftNode = left, let rightNode = right {
            if leftNode.val <= rightNode.val {
                tail.next = leftNode
                left = leftNode.next
            } else {
                tail.next = rightNode
                right = rightNode.next
            }
            tail = tail.next!
        }

        tail.next = left ?? right
        return dummy.next
    }
}`,
  },
  {
    id: 141,
    title: "Linked List Cycle",
    slug: "linked-list-cycle",
    difficulty: "Easy",
    pattern: "Linked List",
    summary: "Determine whether following next pointers eventually repeats a node.",
    cue: "Two walkers with different speeds meet exactly when a cycle exists.",
    invariant: "If a cycle exists, the faster pointer gains one node per step inside it.",
    complexity: "O(n) time · O(1) space",
    swiftNote: "Use identity comparison (===) for ListNode references.",
    estimatedMinutes: 6,
    code: `class Solution {
    func hasCycle(_ head: ListNode?) -> Bool {
        var slow = head
        var fast = head

        while let next = fast?.next {
            slow = slow?.next
            fast = next.next
            if slow === fast {
                return true
            }
        }

        return false
    }
}`,
  },
  {
    id: 104,
    title: "Maximum Depth of Binary Tree",
    slug: "maximum-depth-of-binary-tree",
    difficulty: "Easy",
    pattern: "Trees",
    summary: "Return the number of nodes along the longest root-to-leaf path.",
    cue: "A tree answer can be composed from answers for its children.",
    invariant: "Each call returns the correct maximum depth of exactly its subtree.",
    complexity: "O(n) time · O(h) space",
    swiftNote: "Optional chaining keeps the base case explicit and safe.",
    estimatedMinutes: 4,
    code: `class Solution {
    func maxDepth(_ root: TreeNode?) -> Int {
        guard let root else {
            return 0
        }

        let leftDepth = maxDepth(root.left)
        let rightDepth = maxDepth(root.right)
        return 1 + max(leftDepth, rightDepth)
    }
}`,
  },
  {
    id: 226,
    title: "Invert Binary Tree",
    slug: "invert-binary-tree",
    difficulty: "Easy",
    pattern: "Trees",
    summary: "Mirror a binary tree by swapping every node’s children.",
    cue: "The same local swap must be applied recursively to both subtrees.",
    invariant: "After each call returns, that entire subtree is inverted.",
    complexity: "O(n) time · O(h) space",
    swiftNote: "Tuple assignment can swap two optional child references.",
    estimatedMinutes: 4,
    code: `class Solution {
    func invertTree(_ root: TreeNode?) -> TreeNode? {
        guard let root else {
            return nil
        }

        let left = invertTree(root.left)
        let right = invertTree(root.right)
        root.left = right
        root.right = left
        return root
    }
}`,
  },
  {
    id: 102,
    title: "Binary Tree Level Order Traversal",
    slug: "binary-tree-level-order-traversal",
    difficulty: "Medium",
    pattern: "Trees",
    summary: "Return the tree values grouped by depth.",
    cue: "A queue boundary can separate one level from the next.",
    invariant: "At the start of each outer loop, levelEnd marks exactly the nodes in the current level.",
    complexity: "O(n) time · O(n) space",
    swiftNote: "Use a head index instead of Array.removeFirst(), which is linear.",
    estimatedMinutes: 8,
    code: `class Solution {
    func levelOrder(_ root: TreeNode?) -> [[Int]] {
        guard let root else {
            return []
        }

        var result: [[Int]] = []
        var queue: [TreeNode] = [root]
        var head = 0

        while head < queue.count {
            let levelEnd = queue.count
            var level: [Int] = []

            while head < levelEnd {
                let node = queue[head]
                head += 1
                level.append(node.val)
                if let left = node.left { queue.append(left) }
                if let right = node.right { queue.append(right) }
            }

            result.append(level)
        }

        return result
    }
}`,
  },
  {
    id: 98,
    title: "Validate Binary Search Tree",
    slug: "validate-binary-search-tree",
    difficulty: "Medium",
    pattern: "Trees",
    summary: "Check that every tree node obeys the global BST ordering rule.",
    cue: "A node inherits bounds from every ancestor, not only its parent.",
    invariant: "Each recursive call validates that all values in its subtree stay strictly within its bounds.",
    complexity: "O(n) time · O(h) space",
    swiftNote: "Optional Int bounds avoid artificial sentinel values and overflow concerns.",
    estimatedMinutes: 8,
    code: `class Solution {
    func isValidBST(_ root: TreeNode?) -> Bool {
        func validate(_ node: TreeNode?, _ low: Int?, _ high: Int?) -> Bool {
            guard let node else {
                return true
            }
            if let low, node.val <= low { return false }
            if let high, node.val >= high { return false }

            return validate(node.left, low, node.val) &&
                   validate(node.right, node.val, high)
        }

        return validate(root, nil, nil)
    }
}`,
  },
  {
    id: 56,
    title: "Merge Intervals",
    slug: "merge-intervals",
    difficulty: "Medium",
    pattern: "Intervals",
    summary: "Combine every overlapping range.",
    cue: "Sorting by start makes only the most recent merged interval relevant.",
    invariant: "merged is sorted, non-overlapping, and covers every processed interval.",
    complexity: "O(n log n) time · O(n) space",
    swiftNote: "Mutate the nested end value through an integer index, not result.last.",
    estimatedMinutes: 8,
    code: `class Solution {
    func merge(_ intervals: [[Int]]) -> [[Int]] {
        guard !intervals.isEmpty else {
            return []
        }

        let sorted = intervals.sorted { $0[0] < $1[0] }
        var merged = [sorted[0]]

        for interval in sorted.dropFirst() {
            let last = merged.count - 1
            if interval[0] <= merged[last][1] {
                merged[last][1] = max(merged[last][1], interval[1])
            } else {
                merged.append(interval)
            }
        }

        return merged
    }
}`,
  },
  {
    id: 200,
    title: "Number of Islands",
    slug: "number-of-islands",
    difficulty: "Medium",
    pattern: "Graphs",
    summary: "Count connected components of land in a rectangular grid.",
    cue: "Each unseen land cell begins exactly one new component traversal.",
    invariant: "Every land cell marked water has already been assigned to one counted island.",
    complexity: "O(rows · columns) time · O(rows · columns) space",
    swiftNote: "Copy the immutable input into var cells before marking visited positions.",
    estimatedMinutes: 10,
    code: `class Solution {
    func numIslands(_ grid: [[Character]]) -> Int {
        guard let columns = grid.first?.count else {
            return 0
        }

        let rows = grid.count
        let directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        var cells = grid
        var islands = 0

        for row in 0..<rows {
            for column in 0..<columns where cells[row][column] == "1" {
                islands += 1
                cells[row][column] = "0"
                var stack = [(row, column)]

                while let (currentRow, currentColumn) = stack.popLast() {
                    for (rowOffset, columnOffset) in directions {
                        let nextRow = currentRow + rowOffset
                        let nextColumn = currentColumn + columnOffset
                        guard nextRow >= 0, nextRow < rows,
                              nextColumn >= 0, nextColumn < columns,
                              cells[nextRow][nextColumn] == "1" else { continue }
                        cells[nextRow][nextColumn] = "0"
                        stack.append((nextRow, nextColumn))
                    }
                }
            }
        }

        return islands
    }
}`,
  },
  {
    id: 207,
    title: "Course Schedule",
    slug: "course-schedule",
    difficulty: "Medium",
    pattern: "Graphs",
    summary: "Decide whether all courses can be completed under prerequisite constraints.",
    cue: "A valid ordering exists exactly when the directed graph has no cycle.",
    invariant: "The queue contains courses whose remaining prerequisite count is zero.",
    complexity: "O(V + E) time · O(V + E) space",
    swiftNote: "A head index turns an Array into an efficient FIFO queue for interview use.",
    estimatedMinutes: 12,
    code: `class Solution {
    func canFinish(_ numCourses: Int, _ prerequisites: [[Int]]) -> Bool {
        var graph = Array(repeating: [Int](), count: numCourses)
        var indegree = Array(repeating: 0, count: numCourses)

        for edge in prerequisites {
            graph[edge[1]].append(edge[0])
            indegree[edge[0]] += 1
        }

        var queue = indegree.indices.filter { indegree[$0] == 0 }
        var head = 0
        var completed = 0

        while head < queue.count {
            let course = queue[head]
            head += 1
            completed += 1

            for next in graph[course] {
                indegree[next] -= 1
                if indegree[next] == 0 { queue.append(next) }
            }
        }

        return completed == numCourses
    }
}`,
  },
  {
    id: 78,
    title: "Subsets",
    slug: "subsets",
    difficulty: "Medium",
    pattern: "Backtracking",
    summary: "Generate every subset of a list of unique values.",
    cue: "For each value, every existing subset has one version without it and one with it.",
    invariant: "After processing i values, result contains every subset of exactly those i values.",
    complexity: "O(n · 2ⁿ) time · O(n · 2ⁿ) space",
    swiftNote: "Iterating over a fixed count avoids reading subsets appended in the same pass.",
    estimatedMinutes: 7,
    code: `class Solution {
    func subsets(_ nums: [Int]) -> [[Int]] {
        var result: [[Int]] = [[]]

        for value in nums {
            let existingCount = result.count
            for index in 0..<existingCount {
                result.append(result[index] + [value])
            }
        }

        return result
    }
}`,
  },
  {
    id: 53,
    title: "Maximum Subarray",
    slug: "maximum-subarray",
    difficulty: "Medium",
    pattern: "Greedy",
    summary: "Find the contiguous subarray with the largest sum.",
    cue: "A negative running prefix can only hurt any future subarray.",
    invariant: "current is the best sum of a subarray ending exactly at the current value.",
    complexity: "O(n) time · O(1) space",
    swiftNote: "Start from nums[0] because the answer must include at least one value.",
    estimatedMinutes: 6,
    code: `class Solution {
    func maxSubArray(_ nums: [Int]) -> Int {
        var current = nums[0]
        var best = nums[0]

        for value in nums.dropFirst() {
            current = max(value, current + value)
            best = max(best, current)
        }

        return best
    }
}`,
  },
  {
    id: 55,
    title: "Jump Game",
    slug: "jump-game",
    difficulty: "Medium",
    pattern: "Greedy",
    summary: "Determine whether forward jumps can reach the final index.",
    cue: "Only the farthest reachable boundary matters.",
    invariant: "Every index at or before farthestReach is reachable from the start.",
    complexity: "O(n) time · O(1) space",
    swiftNote: "Break immediately when the scan reaches an unreachable index.",
    estimatedMinutes: 6,
    code: `class Solution {
    func canJump(_ nums: [Int]) -> Bool {
        var farthestReach = 0

        for index in nums.indices {
            if index > farthestReach {
                return false
            }
            farthestReach = max(farthestReach, index + nums[index])
        }

        return true
    }
}`,
  },
  {
    id: 70,
    title: "Climbing Stairs",
    slug: "climbing-stairs",
    difficulty: "Easy",
    pattern: "Dynamic Programming",
    summary: "Count the ways to reach step n using jumps of one or two.",
    cue: "The final move came from exactly one of the previous two steps.",
    invariant: "previousTwo and previousOne hold the answers for the two most recent step counts.",
    complexity: "O(n) time · O(1) space",
    swiftNote: "Use a closed range only after handling n <= 2.",
    estimatedMinutes: 5,
    code: `class Solution {
    func climbStairs(_ n: Int) -> Int {
        if n <= 2 {
            return n
        }

        var previousTwo = 1
        var previousOne = 2

        for _ in 3...n {
            let current = previousOne + previousTwo
            previousTwo = previousOne
            previousOne = current
        }

        return previousOne
    }
}`,
  },
  {
    id: 198,
    title: "House Robber",
    slug: "house-robber",
    difficulty: "Medium",
    pattern: "Dynamic Programming",
    summary: "Maximize non-adjacent values selected from a row.",
    cue: "At each house, choose between skipping it and taking it after the best two houses back.",
    invariant: "previousOne is the best total for the processed prefix.",
    complexity: "O(n) time · O(1) space",
    swiftNote: "Two scalar states replace a full dynamic-programming array.",
    estimatedMinutes: 7,
    code: `class Solution {
    func rob(_ nums: [Int]) -> Int {
        var previousTwo = 0
        var previousOne = 0

        for value in nums {
            let current = max(previousOne, previousTwo + value)
            previousTwo = previousOne
            previousOne = current
        }

        return previousOne
    }
}`,
  },
  {
    id: 322,
    title: "Coin Change",
    slug: "coin-change",
    difficulty: "Medium",
    pattern: "Dynamic Programming",
    summary: "Find the fewest coins needed to form an amount.",
    cue: "Every reachable amount extends a smaller reachable amount by one coin.",
    invariant: "After computing value, dp[value] is the fewest coins for that exact amount.",
    complexity: "O(amount · coins) time · O(amount) space",
    swiftNote: "amount + 1 is a safe unreachable sentinel because no valid answer needs that many coins.",
    estimatedMinutes: 10,
    code: `class Solution {
    func coinChange(_ coins: [Int], _ amount: Int) -> Int {
        var dp = Array(repeating: amount + 1, count: amount + 1)
        dp[0] = 0

        if amount > 0 {
            for value in 1...amount {
                for coin in coins where coin <= value {
                    dp[value] = min(dp[value], dp[value - coin] + 1)
                }
            }
        }

        return dp[amount] == amount + 1 ? -1 : dp[amount]
    }
}`,
  },
  {
    id: 128,
    title: "Longest Consecutive Sequence",
    slug: "longest-consecutive-sequence",
    difficulty: "Medium",
    pattern: "Arrays & Hashing",
    summary: "Find the longest run of consecutive values regardless of input order.",
    cue: "Only values with no predecessor can begin a new sequence.",
    invariant: "Every counted run begins at its unique smallest value.",
    complexity: "O(n) expected time · O(n) space",
    swiftNote: "Build Set(nums), then extend only from values whose predecessor is absent.",
    estimatedMinutes: 7,
    code: `class Solution {
    func longestConsecutive(_ nums: [Int]) -> Int {
        let values = Set(nums)
        var best = 0

        for value in values where !values.contains(value - 1) {
            var current = value
            var length = 1

            while values.contains(current + 1) {
                current += 1
                length += 1
            }

            best = max(best, length)
        }

        return best
    }
}`,
  },
  {
    id: 560,
    title: "Subarray Sum Equals K",
    slug: "subarray-sum-equals-k",
    difficulty: "Medium",
    pattern: "Arrays & Hashing",
    summary: "Count contiguous subarrays whose values sum to a target.",
    cue: "A subarray sums to k when two prefix sums differ by k.",
    invariant: "The dictionary counts prefix sums ending before the current position.",
    complexity: "O(n) time · O(n) space",
    swiftNote: "Seed prefixCounts with [0: 1] so subarrays starting at index zero are counted.",
    estimatedMinutes: 8,
    code: `class Solution {
    func subarraySum(_ nums: [Int], _ k: Int) -> Int {
        var prefixCounts = [0: 1]
        var prefix = 0
        var result = 0

        for value in nums {
            prefix += value
            result += prefixCounts[prefix - k, default: 0]
            prefixCounts[prefix, default: 0] += 1
        }

        return result
    }
}`,
  },
  {
    id: 567,
    title: "Permutation in String",
    slug: "permutation-in-string",
    difficulty: "Medium",
    pattern: "Sliding Window",
    summary: "Determine whether any fixed-length window is a permutation of another string.",
    cue: "A permutation preserves frequencies, and its window length is known.",
    invariant: "missing is the number of pattern characters not satisfied by the active window.",
    complexity: "O(n + m) time · O(1) space",
    swiftNote: "The lowercase-English constraint makes UTF-8 byte indexing with 26 counters safe.",
    estimatedMinutes: 8,
    code: `class Solution {
    func checkInclusion(_ s1: String, _ s2: String) -> Bool {
        let pattern = Array(s1.utf8)
        let text = Array(s2.utf8)

        if pattern.isEmpty {
            return true
        }
        guard pattern.count <= text.count else {
            return false
        }

        var balance = Array(repeating: 0, count: 26)
        for byte in pattern {
            balance[Int(byte) - 97] += 1
        }

        var missing = pattern.count

        for right in text.indices {
            let entering = Int(text[right]) - 97
            if balance[entering] > 0 {
                missing -= 1
            }
            balance[entering] -= 1

            if right >= pattern.count {
                let leaving = Int(text[right - pattern.count]) - 97
                if balance[leaving] >= 0 {
                    missing += 1
                }
                balance[leaving] += 1
            }

            if missing == 0 {
                return true
            }
        }

        return false
    }
}`,
  },
  {
    id: 150,
    title: "Evaluate Reverse Polish Notation",
    slug: "evaluate-reverse-polish-notation",
    difficulty: "Medium",
    pattern: "Stack",
    summary: "Evaluate an arithmetic expression written in postfix order.",
    cue: "Each operator consumes the two most recent completed operands.",
    invariant: "The stack contains values of completed subexpressions in encounter order.",
    complexity: "O(n) time · O(n) space",
    swiftNote: "Pop the right operand before the left; Swift integer division truncates toward zero.",
    estimatedMinutes: 6,
    code: `class Solution {
    func evalRPN(_ tokens: [String]) -> Int {
        var stack: [Int] = []

        for token in tokens {
            if let value = Int(token) {
                stack.append(value)
                continue
            }

            let right = stack.removeLast()
            let left = stack.removeLast()

            switch token {
            case "+":
                stack.append(left + right)
            case "-":
                stack.append(left - right)
            case "*":
                stack.append(left * right)
            default:
                stack.append(left / right)
            }
        }

        return stack.last!
    }
}`,
  },
  {
    id: 155,
    title: "Min Stack",
    slug: "min-stack",
    difficulty: "Medium",
    pattern: "Stack",
    summary: "Implement a stack that also returns its current minimum in constant time.",
    cue: "Each depth can remember the minimum that existed when it was created.",
    invariant: "minimums[i] is the minimum of values[0...i].",
    complexity: "O(1) per operation · O(n) space",
    swiftNote: "LeetCode expects a top-level MinStack class rather than class Solution.",
    estimatedMinutes: 6,
    code: `class MinStack {
    private var values: [Int] = []
    private var minimums: [Int] = []

    init() {}

    func push(_ val: Int) {
        values.append(val)
        minimums.append(min(val, minimums.last ?? val))
    }

    func pop() {
        values.removeLast()
        minimums.removeLast()
    }

    func top() -> Int {
        values.last!
    }

    func getMin() -> Int {
        minimums.last!
    }
}`,
  },
  {
    id: 875,
    title: "Koko Eating Bananas",
    slug: "koko-eating-bananas",
    difficulty: "Medium",
    pattern: "Binary Search",
    summary: "Find the smallest integer eating speed that finishes every pile on time.",
    cue: "If one speed is feasible, every faster speed is also feasible.",
    invariant: "The minimum feasible speed always remains inside [left, right].",
    complexity: "O(n log maximumPile) time · O(1) space",
    swiftNote: "Compute ceiling division as (pile + speed - 1) / speed.",
    estimatedMinutes: 8,
    code: `class Solution {
    func minEatingSpeed(_ piles: [Int], _ h: Int) -> Int {
        var left = 1
        var right = piles.max()!

        while left < right {
            let speed = left + (right - left) / 2
            var hours = 0

            for pile in piles {
                hours += (pile + speed - 1) / speed
            }

            if hours <= h {
                right = speed
            } else {
                left = speed + 1
            }
        }

        return left
    }
}`,
  },
  {
    id: 19,
    title: "Remove Nth Node From End of List",
    slug: "remove-nth-node-from-end-of-list",
    difficulty: "Medium",
    pattern: "Linked List",
    summary: "Remove a node identified by its distance from the list's end.",
    cue: "A fixed gap lets one pointer locate the predecessor when the other reaches the end.",
    invariant: "The fast pointer remains n nodes ahead of the slow pointer.",
    complexity: "O(n) time · O(1) space",
    swiftNote: "A dummy ListNode handles removing the original head without a separate branch.",
    estimatedMinutes: 8,
    code: `class Solution {
    func removeNthFromEnd(_ head: ListNode?, _ n: Int) -> ListNode? {
        let dummy = ListNode(0)
        dummy.next = head
        var fast: ListNode? = dummy
        var slow: ListNode? = dummy

        for _ in 0..<n {
            fast = fast?.next
        }

        while fast?.next != nil {
            fast = fast?.next
            slow = slow?.next
        }

        slow?.next = slow?.next?.next
        return dummy.next
    }
}`,
  },
  {
    id: 230,
    title: "Kth Smallest Element in a BST",
    slug: "kth-smallest-element-in-a-bst",
    difficulty: "Medium",
    pattern: "Trees",
    summary: "Return the kth value encountered in a binary search tree's sorted order.",
    cue: "An in-order traversal of a BST visits values from smallest to largest.",
    invariant: "The stack holds ancestors whose value and right subtree remain unvisited.",
    complexity: "O(h + k) time · O(h) space",
    swiftNote: "Use an explicit [TreeNode] stack; TreeNode is supplied by LeetCode.",
    estimatedMinutes: 7,
    code: `class Solution {
    func kthSmallest(_ root: TreeNode?, _ k: Int) -> Int {
        var stack: [TreeNode] = []
        var current = root
        var remaining = k

        while current != nil || !stack.isEmpty {
            while let node = current {
                stack.append(node)
                current = node.left
            }

            let node = stack.removeLast()
            remaining -= 1
            if remaining == 0 {
                return node.val
            }
            current = node.right
        }

        return -1
    }
}`,
  },
  {
    id: 57,
    title: "Insert Interval",
    slug: "insert-interval",
    difficulty: "Medium",
    pattern: "Intervals",
    summary: "Insert one range into sorted disjoint ranges and merge any overlaps.",
    cue: "Intervals separate into those before, overlapping, and after the new range.",
    invariant: "result is sorted and disjoint, while merged covers every overlap seen so far.",
    complexity: "O(n) time · O(n) space",
    swiftNote: "Copy newInterval into a var before widening its endpoints.",
    estimatedMinutes: 8,
    code: `class Solution {
    func insert(_ intervals: [[Int]], _ newInterval: [Int]) -> [[Int]] {
        var result: [[Int]] = []
        var merged = newInterval
        var index = 0

        while index < intervals.count && intervals[index][1] < merged[0] {
            result.append(intervals[index])
            index += 1
        }

        while index < intervals.count && intervals[index][0] <= merged[1] {
            merged[0] = min(merged[0], intervals[index][0])
            merged[1] = max(merged[1], intervals[index][1])
            index += 1
        }

        result.append(merged)
        result.append(contentsOf: intervals[index...])
        return result
    }
}`,
  },
  {
    id: 435,
    title: "Non-overlapping Intervals",
    slug: "non-overlapping-intervals",
    difficulty: "Medium",
    pattern: "Intervals",
    summary: "Find the fewest ranges to remove so the remainder do not overlap.",
    cue: "Keeping the interval that ends earliest leaves the most room for later choices.",
    invariant: "lastEnd is the smallest possible end among equally large valid kept sets.",
    complexity: "O(n log n) time · O(n) space",
    swiftNote: "Swift sorted() returns a new array; touching endpoints are not overlapping.",
    estimatedMinutes: 7,
    code: `class Solution {
    func eraseOverlapIntervals(_ intervals: [[Int]]) -> Int {
        guard !intervals.isEmpty else {
            return 0
        }

        let sorted = intervals.sorted { $0[1] < $1[1] }
        var removals = 0
        var lastEnd = sorted[0][1]

        for interval in sorted.dropFirst() {
            if interval[0] < lastEnd {
                removals += 1
            } else {
                lastEnd = interval[1]
            }
        }

        return removals
    }
}`,
  },
  {
    id: 133,
    title: "Clone Graph",
    slug: "clone-graph",
    difficulty: "Medium",
    pattern: "Graphs",
    summary: "Create a deep copy of every node and edge reachable from a starting node.",
    cue: "Cycles require recording a copy before recursively cloning neighbors.",
    invariant: "Each original object identity maps to exactly one cloned node.",
    complexity: "O(V + E) time · O(V) space",
    swiftNote: "Node is not Hashable; key the clone dictionary by ObjectIdentifier.",
    estimatedMinutes: 10,
    code: `class Solution {
    func cloneGraph(_ node: Node?) -> Node? {
        var cloneByIdentity: [ObjectIdentifier: Node] = [:]

        func clone(_ original: Node) -> Node {
            let identity = ObjectIdentifier(original)
            if let existing = cloneByIdentity[identity] {
                return existing
            }

            let copy = Node(original.val)
            cloneByIdentity[identity] = copy
            copy.neighbors = original.neighbors.map { neighbor -> Node? in
                guard let neighbor else {
                    return nil
                }
                return clone(neighbor)
            }
            return copy
        }

        guard let node else {
            return nil
        }
        return clone(node)
    }
}`,
  },
  {
    id: 994,
    title: "Rotting Oranges",
    slug: "rotting-oranges",
    difficulty: "Medium",
    pattern: "Graphs",
    summary: "Find how many simultaneous spreading steps are needed to reach every fresh cell.",
    cue: "All initially active sources must enter the same first BFS layer.",
    invariant: "Each completed queue layer represents exactly one elapsed minute.",
    complexity: "O(rows · columns) time · O(rows · columns) space",
    swiftNote: "Copy the grid into var state and use a queue head index instead of removeFirst().",
    estimatedMinutes: 10,
    code: `class Solution {
    func orangesRotting(_ grid: [[Int]]) -> Int {
        guard let columns = grid.first?.count, columns > 0 else {
            return 0
        }

        let rows = grid.count
        var state = grid
        var queue: [(Int, Int)] = []
        var fresh = 0

        for row in 0..<rows {
            for column in 0..<columns {
                if state[row][column] == 2 {
                    queue.append((row, column))
                } else if state[row][column] == 1 {
                    fresh += 1
                }
            }
        }

        let directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        var head = 0
        var minutes = 0

        while fresh > 0 && head < queue.count {
            let levelEnd = queue.count
            minutes += 1

            while head < levelEnd {
                let (row, column) = queue[head]
                head += 1

                for (rowOffset, columnOffset) in directions {
                    let nextRow = row + rowOffset
                    let nextColumn = column + columnOffset

                    guard nextRow >= 0, nextRow < rows,
                          nextColumn >= 0, nextColumn < columns,
                          state[nextRow][nextColumn] == 1 else {
                        continue
                    }

                    state[nextRow][nextColumn] = 2
                    fresh -= 1
                    queue.append((nextRow, nextColumn))
                }
            }
        }

        return fresh == 0 ? minutes : -1
    }
}`,
  },
  {
    id: 39,
    title: "Combination Sum",
    slug: "combination-sum",
    difficulty: "Medium",
    pattern: "Backtracking",
    summary: "Generate combinations of reusable values that total a target.",
    cue: "Reuse keeps the recursive start index unchanged after choosing a value.",
    invariant: "path sums to target minus remaining and never decreases in candidate order.",
    complexity: "Output-sensitive time · O(target / minimumCandidate) stack space",
    swiftNote: "Sort candidates so a value greater than remaining can stop the loop.",
    estimatedMinutes: 10,
    code: `class Solution {
    func combinationSum(_ candidates: [Int], _ target: Int) -> [[Int]] {
        let values = candidates.sorted()
        var result: [[Int]] = []
        var path: [Int] = []

        func backtrack(_ start: Int, _ remaining: Int) {
            if remaining == 0 {
                result.append(path)
                return
            }

            for index in start..<values.count {
                let value = values[index]
                if value > remaining {
                    break
                }

                path.append(value)
                backtrack(index, remaining - value)
                path.removeLast()
            }
        }

        backtrack(0, target)
        return result
    }
}`,
  },
  {
    id: 46,
    title: "Permutations",
    slug: "permutations",
    difficulty: "Medium",
    pattern: "Backtracking",
    summary: "Generate every ordering of a list of unique values.",
    cue: "At each position, choose one remaining value and restore the choice afterward.",
    invariant: "Indices before the recursion position form a fixed permutation prefix.",
    complexity: "O(n · n!) time · O(n) stack space excluding output",
    swiftNote: "In-place swapAt avoids a separate used set and must be undone after recursion.",
    estimatedMinutes: 8,
    code: `class Solution {
    func permute(_ nums: [Int]) -> [[Int]] {
        var values = nums
        var result: [[Int]] = []

        func backtrack(_ position: Int) {
            if position == values.count {
                result.append(values)
                return
            }

            for index in position..<values.count {
                values.swapAt(position, index)
                backtrack(position + 1)
                values.swapAt(position, index)
            }
        }

        backtrack(0)
        return result
    }
}`,
  },
  {
    id: 763,
    title: "Partition Labels",
    slug: "partition-labels",
    difficulty: "Medium",
    pattern: "Greedy",
    summary: "Split a string into the most segments that keep each character in one segment.",
    cue: "A segment cannot close before the last occurrence of every character it contains.",
    invariant: "end is the farthest final occurrence required by the active segment.",
    complexity: "O(n) time · O(k) space",
    swiftNote: "Convert to [Character] once so stored integer positions remain cheap to revisit.",
    estimatedMinutes: 7,
    code: `class Solution {
    func partitionLabels(_ s: String) -> [Int] {
        let characters = Array(s)
        var lastIndex: [Character: Int] = [:]

        for (index, character) in characters.enumerated() {
            lastIndex[character] = index
        }

        var result: [Int] = []
        var start = 0
        var end = 0

        for index in characters.indices {
            end = max(end, lastIndex[characters[index]]!)

            if index == end {
                result.append(end - start + 1)
                start = index + 1
            }
        }

        return result
    }
}`,
  },
  {
    id: 139,
    title: "Word Break",
    slug: "word-break",
    difficulty: "Medium",
    pattern: "Dynamic Programming",
    summary: "Determine whether a string can be divided entirely into dictionary words.",
    cue: "A prefix is reachable when a shorter reachable prefix can append one word.",
    invariant: "dp[i] is true exactly when characters before i form a valid segmentation.",
    complexity: "O(n · words · maxWordLength) time · O(n + dictionary) space",
    swiftNote: "Convert both the source and words to Character arrays to avoid invalid integer String indexing.",
    estimatedMinutes: 10,
    code: `class Solution {
    func wordBreak(_ s: String, _ wordDict: [String]) -> Bool {
        let characters = Array(s)
        let words = wordDict.map { Array($0) }
        var dp = Array(repeating: false, count: characters.count + 1)
        dp[0] = true

        for start in 0...characters.count where dp[start] {
            for word in words {
                let end = start + word.count

                if end <= characters.count &&
                   Array(characters[start..<end]) == word {
                    dp[end] = true
                }
            }
        }

        return dp[characters.count]
    }
}`,
  },
  {
    id: 300,
    title: "Longest Increasing Subsequence",
    slug: "longest-increasing-subsequence",
    difficulty: "Medium",
    pattern: "Dynamic Programming",
    summary: "Find the maximum length of a strictly increasing subsequence.",
    cue: "For each possible length, retain the smallest tail value seen so far.",
    invariant: "tails[i] is the smallest ending value for an increasing subsequence of length i + 1.",
    complexity: "O(n log n) time · O(n) space",
    swiftNote: "Implement lower-bound manually; replacing a tail changes possibilities, not the current length.",
    estimatedMinutes: 10,
    code: `class Solution {
    func lengthOfLIS(_ nums: [Int]) -> Int {
        var tails: [Int] = []

        for value in nums {
            var left = 0
            var right = tails.count

            while left < right {
                let middle = left + (right - left) / 2
                if tails[middle] < value {
                    left = middle + 1
                } else {
                    right = middle
                }
            }

            if left == tails.count {
                tails.append(value)
            } else {
                tails[left] = value
            }
        }

        return tails.count
    }
}`,
  },
];

export const problemUrl = (problem: Problem) =>
  problem.isCustom ? problem.sourceUrl ?? null : `https://leetcode.com/problems/${problem.slug}/`;

export const problemLineCount = (problem: Problem) => problem.code.split("\n").length;
