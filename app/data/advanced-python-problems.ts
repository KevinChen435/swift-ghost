import type { PythonProblem } from "./python-problems";

/**
 * Advanced Python interview breadth for learners who can already implement the
 * core array, tree, graph, and one-dimensional DP patterns from memory.
 *
 * IDs match their public LeetCode problem numbers so attempts and deep links
 * remain stable when this catalog is merged with the core Python curriculum.
 */
export const ADVANCED_PYTHON_PROBLEMS: PythonProblem[] = [
  {
    id: 208,
    title: "Implement Trie (Prefix Tree)",
    slug: "implement-trie-prefix-tree",
    difficulty: "Medium",
    pattern: "Tries",
    summary:
      "Build a prefix tree that supports insertion, exact lookup, and prefix lookup.",
    cue: "Each character chooses one child; keep end-of-word state separate from the path itself.",
    invariant:
      "After consuming a prefix, node is the unique trie node representing exactly that prefix.",
    complexity: "O(L) time per operation · O(total inserted characters) space",
    languageNote:
      "A nested node class and dict[str, TrieNode] keep child lookup explicit without a fixed alphabet array.",
    estimatedMinutes: 12,
    starterCode: `class TrieNode:
    def __init__(self):
        self.children: dict[str, TrieNode] = {}
        self.is_word = False


class Trie:
    def __init__(self):
        pass

    def insert(self, word: str) -> None:
        pass

    def search(self, word: str) -> bool:
        pass

    def startsWith(self, prefix: str) -> bool:
        pass


def exercise_trie(
    words: list[str], searches: list[str], prefixes: list[str]
) -> tuple[list[bool], list[bool]]:
    pass`,
    code: `class TrieNode:
    def __init__(self):
        self.children: dict[str, TrieNode] = {}
        self.is_word = False


class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str) -> None:
        node = self.root
        for character in word:
            node = node.children.setdefault(character, TrieNode())
        node.is_word = True

    def _find(self, text: str) -> TrieNode | None:
        node = self.root
        for character in text:
            if character not in node.children:
                return None
            node = node.children[character]
        return node

    def search(self, word: str) -> bool:
        node = self._find(word)
        return node is not None and node.is_word

    def startsWith(self, prefix: str) -> bool:
        return self._find(prefix) is not None


def exercise_trie(
    words: list[str], searches: list[str], prefixes: list[str]
) -> tuple[list[bool], list[bool]]:
    trie = Trie()
    for word in words:
        trie.insert(word)
    return (
        [trie.search(word) for word in searches],
        [trie.startsWith(prefix) for prefix in prefixes],
    )`,
    sourceUrl: "https://leetcode.com/problems/implement-trie-prefix-tree/",
    tags: ["trie", "prefix-tree", "design", "dictionary"],
    recallChecks: [
      "Why is reaching a node insufficient to prove that the whole word was inserted?",
      "What does the current node represent after each loop iteration?",
      "How would a fixed 26-child array change the space and lookup tradeoffs?",
    ],
    verification: {
      revision: 1,
      entrypoint: { kind: "function", name: "exercise_trie" },
      cases: [
        {
          name: "distinguishes a word from its prefix",
          args: [["apple"], ["apple", "app"], ["app"]],
          expected: [[true, false], [true]],
          comparator: "deepEqual",
        },
        {
          name: "recognizes a prefix after it becomes a word",
          args: [
            ["apple", "app"],
            ["app", "apple"],
            ["ap", "apple"],
          ],
          expected: [
            [true, true],
            [true, true],
          ],
          comparator: "deepEqual",
        },
        {
          name: "rejects paths that were never inserted",
          args: [
            ["cat", "car"],
            ["cap", ""],
            ["can", "do"],
          ],
          expected: [
            [false, false],
            [false, false],
          ],
          comparator: "deepEqual",
        },
        {
          name: "handles duplicate inserts and single-character branches",
          args: [
            ["a", "a", "ab", "b"],
            ["a", "ab", "b", "ba"],
            ["a", "ab", "b", "c"],
          ],
          expected: [
            [true, true, true, false],
            [true, true, true, false],
          ],
          comparator: "deepEqual",
        },
        {
          name: "keeps sibling prefixes independent",
          args: [
            ["team", "tear", "ten"],
            ["tea", "team", "tear", "ten", "te"],
            ["tea", "teal", "ten", "toast"],
          ],
          expected: [
            [false, true, true, true, false],
            [true, false, true, false],
          ],
          comparator: "deepEqual",
        },
      ],
    },
  },
  {
    id: 212,
    title: "Word Search II",
    slug: "word-search-ii",
    difficulty: "Hard",
    pattern: "Tries",
    summary:
      "Find every dictionary word that can be formed by adjacent cells without reusing a cell.",
    cue: "Search all words together: a trie lets DFS abandon a board path as soon as no word shares its prefix.",
    invariant:
      "At DFS entry, node represents the letters already chosen and every marked cell belongs to that simple path.",
    complexity:
      "O(mn · 4^L) worst-case time · O(total word characters + L) space",
    languageNote:
      "Removing a found terminal word prevents duplicates, and pruning empty child dictionaries shrinks later searches.",
    estimatedMinutes: 28,
    starterCode: `class TrieNode:
    def __init__(self):
        self.children: dict[str, TrieNode] = {}
        self.word: str | None = None


class Solution:
    def findWords(self, board: list[list[str]], words: list[str]) -> list[str]:
        pass`,
    code: `class TrieNode:
    def __init__(self):
        self.children: dict[str, TrieNode] = {}
        self.word: str | None = None


class Solution:
    def findWords(self, board: list[list[str]], words: list[str]) -> list[str]:
        root = TrieNode()
        for word in words:
            node = root
            for character in word:
                node = node.children.setdefault(character, TrieNode())
            node.word = word

        rows = len(board)
        columns = len(board[0])
        found: list[str] = []

        def search(row: int, column: int, parent: TrieNode) -> None:
            character = board[row][column]
            node = parent.children.get(character)
            if node is None:
                return

            if node.word is not None:
                found.append(node.word)
                node.word = None

            board[row][column] = "#"
            for next_row, next_column in (
                (row + 1, column),
                (row - 1, column),
                (row, column + 1),
                (row, column - 1),
            ):
                if (
                    0 <= next_row < rows
                    and 0 <= next_column < columns
                    and board[next_row][next_column] != "#"
                ):
                    search(next_row, next_column, node)
            board[row][column] = character

            if not node.children and node.word is None:
                parent.children.pop(character)

        for row in range(rows):
            for column in range(columns):
                search(row, column, root)

        return sorted(found)`,
    sourceUrl: "https://leetcode.com/problems/word-search-ii/",
    tags: ["trie", "backtracking", "grid", "prefix-pruning"],
    recallChecks: [
      "Why is one board DFS over a trie better than running Word Search once per word?",
      "Why clear node.word immediately after emitting it?",
      "Which two restoration or pruning operations happen as a DFS frame unwinds?",
    ],
    verification: {
      revision: 1,
      entrypoint: { kind: "method", className: "Solution", name: "findWords" },
      cases: [
        {
          name: "finds multiple shared-prefix words",
          args: [
            [
              ["o", "a", "a", "n"],
              ["e", "t", "a", "e"],
              ["i", "h", "k", "r"],
              ["i", "f", "l", "v"],
            ],
            ["oath", "pea", "eat", "rain"],
          ],
          expected: ["eat", "oath"],
          comparator: "deepEqual",
        },
        {
          name: "does not reuse a board cell",
          args: [
            [
              ["a", "b"],
              ["c", "d"],
            ],
            ["abcb", "abd", "acdb"],
          ],
          expected: ["abd", "acdb"],
          comparator: "deepEqual",
        },
        {
          name: "deduplicates a word found by multiple paths",
          args: [
            [
              ["a", "a"],
              ["a", "a"],
            ],
            ["a", "aa", "aaa", "aaaa", "aaaaa"],
          ],
          expected: ["a", "aa", "aaa", "aaaa"],
          comparator: "deepEqual",
        },
        {
          name: "handles a single-cell board",
          args: [[["z"]], ["z", "zz"]],
          expected: ["z"],
          comparator: "deepEqual",
        },
        {
          name: "finds words in both directions on one row",
          args: [
            [["a", "b", "c", "d"]],
            ["a", "ab", "abc", "abcd", "ac", "dcba", "bb"],
          ],
          expected: ["a", "ab", "abc", "abcd", "dcba"],
          comparator: "unordered",
        },
      ],
    },
  },
  {
    id: 684,
    title: "Redundant Connection",
    slug: "redundant-connection",
    difficulty: "Medium",
    pattern: "Union-Find",
    summary:
      "Find the edge that creates a cycle when added to an otherwise tree-shaped undirected graph.",
    cue: "An edge is redundant exactly when its endpoints already have the same representative.",
    invariant:
      "Before processing an edge, each disjoint-set root represents one connected component formed by earlier edges.",
    complexity: "O(n α(n)) time · O(n) space",
    languageNote:
      "An iterative find with path halving avoids recursion overhead while still flattening parent chains.",
    estimatedMinutes: 12,
    starterCode: `class Solution:
    def findRedundantConnection(self, edges: list[list[int]]) -> list[int]:
        pass`,
    code: `class Solution:
    def findRedundantConnection(self, edges: list[list[int]]) -> list[int]:
        parent = list(range(len(edges) + 1))
        size = [1] * (len(edges) + 1)

        def find(node: int) -> int:
            while node != parent[node]:
                parent[node] = parent[parent[node]]
                node = parent[node]
            return node

        for first, second in edges:
            root_first = find(first)
            root_second = find(second)
            if root_first == root_second:
                return [first, second]

            if size[root_first] < size[root_second]:
                root_first, root_second = root_second, root_first
            parent[root_second] = root_first
            size[root_first] += size[root_second]

        return []`,
    sourceUrl: "https://leetcode.com/problems/redundant-connection/",
    tags: ["union-find", "disjoint-set", "cycle-detection", "graph"],
    recallChecks: [
      "What fact about the representatives proves that an edge closes a cycle?",
      "How do path compression and union by size affect the amortized cost?",
      "Why can the parent array be sized from the number of edges here?",
    ],
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "findRedundantConnection",
      },
      cases: [
        {
          name: "triangle cycle",
          args: [
            [
              [1, 2],
              [1, 3],
              [2, 3],
            ],
          ],
          expected: [2, 3],
          comparator: "deepEqual",
        },
        {
          name: "later edge joins already connected endpoints",
          args: [
            [
              [1, 2],
              [2, 3],
              [3, 4],
              [1, 4],
              [1, 5],
            ],
          ],
          expected: [1, 4],
          comparator: "deepEqual",
        },
        {
          name: "cycle that does not include node one",
          args: [
            [
              [2, 3],
              [1, 2],
              [1, 4],
              [4, 5],
              [3, 5],
            ],
          ],
          expected: [3, 5],
          comparator: "deepEqual",
        },
        {
          name: "closes a cycle across the highest-labeled node",
          args: [
            [
              [1, 2],
              [2, 3],
              [3, 4],
              [4, 5],
              [5, 1],
            ],
          ],
          expected: [5, 1],
          comparator: "deepEqual",
        },
        {
          name: "detects the redundant edge before later tree growth",
          args: [
            [
              [1, 2],
              [2, 3],
              [1, 3],
              [3, 4],
            ],
          ],
          expected: [1, 3],
          comparator: "deepEqual",
        },
      ],
    },
  },
  {
    id: 1579,
    title: "Remove Max Number of Edges to Keep Graph Fully Traversable",
    slug: "remove-max-number-of-edges-to-keep-graph-fully-traversable",
    difficulty: "Hard",
    pattern: "Union-Find",
    summary:
      "Remove as many typed edges as possible while Alice and Bob can each still traverse the whole graph.",
    cue: "Shared edges are the most valuable, so union them before either traveler consumes exclusive edges.",
    invariant:
      "Each DSU's component count equals the number of connected regions available to that traveler after processed usable edges.",
    complexity: "O(E α(n)) time · O(n) space",
    languageNote:
      "A compact DSU class can return a boolean from union, which makes counting necessary versus redundant edges direct.",
    estimatedMinutes: 25,
    starterCode: `class DSU:
    def __init__(self, size: int):
        pass

    def find(self, node: int) -> int:
        pass

    def union(self, first: int, second: int) -> bool:
        pass


class Solution:
    def maxNumEdgesToRemove(self, n: int, edges: list[list[int]]) -> int:
        pass`,
    code: `class DSU:
    def __init__(self, size: int):
        self.parent = list(range(size + 1))
        self.rank = [0] * (size + 1)
        self.components = size

    def find(self, node: int) -> int:
        if node != self.parent[node]:
            self.parent[node] = self.find(self.parent[node])
        return self.parent[node]

    def union(self, first: int, second: int) -> bool:
        root_first = self.find(first)
        root_second = self.find(second)
        if root_first == root_second:
            return False

        if self.rank[root_first] < self.rank[root_second]:
            root_first, root_second = root_second, root_first
        self.parent[root_second] = root_first
        if self.rank[root_first] == self.rank[root_second]:
            self.rank[root_first] += 1
        self.components -= 1
        return True


class Solution:
    def maxNumEdgesToRemove(self, n: int, edges: list[list[int]]) -> int:
        alice = DSU(n)
        bob = DSU(n)
        used = 0

        for edge_type, first, second in edges:
            if edge_type == 3:
                merged = alice.union(first, second)
                bob.union(first, second)
                used += int(merged)

        for edge_type, first, second in edges:
            if edge_type == 1:
                used += int(alice.union(first, second))
            elif edge_type == 2:
                used += int(bob.union(first, second))

        if alice.components != 1 or bob.components != 1:
            return -1
        return len(edges) - used`,
    sourceUrl:
      "https://leetcode.com/problems/remove-max-number-of-edges-to-keep-graph-fully-traversable/",
    tags: ["union-find", "greedy", "connectivity", "shared-edges"],
    recallChecks: [
      "Why must type-three edges be processed before type-one and type-two edges?",
      "Why is a failed union exactly an edge that can be removed?",
      "What final condition proves both travelers can reach every node?",
    ],
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "maxNumEdgesToRemove",
      },
      cases: [
        {
          name: "removes two redundant edges",
          args: [
            4,
            [
              [3, 1, 2],
              [3, 2, 3],
              [1, 1, 3],
              [1, 2, 4],
              [1, 1, 2],
              [2, 3, 4],
            ],
          ],
          expected: 2,
          comparator: "deepEqual",
        },
        {
          name: "keeps every required edge",
          args: [
            4,
            [
              [3, 1, 2],
              [3, 2, 3],
              [1, 1, 4],
              [2, 1, 4],
            ],
          ],
          expected: 0,
          comparator: "deepEqual",
        },
        {
          name: "reports impossible connectivity",
          args: [
            4,
            [
              [3, 2, 3],
              [1, 1, 2],
              [2, 3, 4],
            ],
          ],
          expected: -1,
          comparator: "deepEqual",
        },
        {
          name: "removes both exclusive duplicates on two nodes",
          args: [
            2,
            [
              [3, 1, 2],
              [1, 1, 2],
              [2, 1, 2],
            ],
          ],
          expected: 2,
          comparator: "deepEqual",
        },
        {
          name: "removes shared-cycle and exclusive redundancies",
          args: [
            3,
            [
              [3, 1, 2],
              [3, 2, 3],
              [3, 1, 3],
              [1, 1, 3],
              [2, 1, 3],
            ],
          ],
          expected: 3,
          comparator: "deepEqual",
        },
      ],
    },
  },
  {
    id: 743,
    title: "Network Delay Time",
    slug: "network-delay-time",
    difficulty: "Medium",
    pattern: "Graphs",
    summary:
      "Compute when every node receives a signal sent through nonnegative directed edges.",
    cue: "The answer is the largest finalized shortest-path distance from the source.",
    invariant:
      "When a node is accepted from the min-heap at its recorded distance, that distance is its shortest possible arrival time.",
    complexity: "O((V + E) log V) time · O(V + E) space",
    languageNote:
      "heapq stores (distance, node) tuples; skip stale entries instead of trying to decrease a key in place.",
    estimatedMinutes: 15,
    starterCode: `import heapq


class Solution:
    def networkDelayTime(self, times: list[list[int]], n: int, k: int) -> int:
        pass`,
    code: `import heapq


class Solution:
    def networkDelayTime(self, times: list[list[int]], n: int, k: int) -> int:
        graph: list[list[tuple[int, int]]] = [[] for _ in range(n + 1)]
        for source, destination, weight in times:
            graph[source].append((weight, destination))

        distances = [float("inf")] * (n + 1)
        distances[k] = 0
        heap = [(0, k)]

        while heap:
            distance, node = heapq.heappop(heap)
            if distance != distances[node]:
                continue

            for weight, neighbor in graph[node]:
                candidate = distance + weight
                if candidate < distances[neighbor]:
                    distances[neighbor] = candidate
                    heapq.heappush(heap, (candidate, neighbor))

        delay = max(distances[1:])
        return -1 if delay == float("inf") else int(delay)`,
    sourceUrl: "https://leetcode.com/problems/network-delay-time/",
    tags: ["dijkstra", "shortest-path", "heap", "directed-graph"],
    recallChecks: [
      "Why can a stale heap entry be ignored safely?",
      "Why is the maximum shortest distance the network delay?",
      "Which assumption about edge weights makes Dijkstra valid?",
    ],
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "networkDelayTime",
      },
      cases: [
        {
          name: "signal fans out after an intermediate node",
          args: [
            [
              [2, 1, 1],
              [2, 3, 1],
              [3, 4, 1],
            ],
            4,
            2,
          ],
          expected: 2,
          comparator: "deepEqual",
        },
        {
          name: "single reachable edge",
          args: [[[1, 2, 1]], 2, 1],
          expected: 1,
          comparator: "deepEqual",
        },
        {
          name: "unreachable node",
          args: [[[1, 2, 1]], 2, 2],
          expected: -1,
          comparator: "deepEqual",
        },
        {
          name: "single-node network needs no time",
          args: [[], 1, 1],
          expected: 0,
          comparator: "deepEqual",
        },
        {
          name: "ignores stale longer paths",
          args: [
            [
              [1, 2, 10],
              [1, 3, 1],
              [3, 2, 1],
              [2, 4, 1],
              [3, 4, 100],
            ],
            4,
            1,
          ],
          expected: 3,
          comparator: "deepEqual",
        },
      ],
    },
  },
  {
    id: 332,
    title: "Reconstruct Itinerary",
    slug: "reconstruct-itinerary",
    difficulty: "Hard",
    pattern: "Graphs",
    summary:
      "Use every directed ticket exactly once and return the lexicographically smallest valid itinerary from JFK.",
    cue: "Consume edges during DFS and append airports only when they have no unused outgoing ticket left.",
    invariant:
      "When an airport is appended, every ticket reachable through its chosen outgoing edges has already been placed later in reverse order.",
    complexity: "O(E log E) time · O(E) space",
    languageNote:
      "Reverse-sort each adjacency list once, then pop its smallest destination from the end in O(1).",
    estimatedMinutes: 22,
    starterCode: `class Solution:
    def findItinerary(self, tickets: list[list[str]]) -> list[str]:
        pass`,
    code: `class Solution:
    def findItinerary(self, tickets: list[list[str]]) -> list[str]:
        graph: dict[str, list[str]] = {}
        for source, destination in sorted(tickets, reverse=True):
            graph.setdefault(source, []).append(destination)

        route: list[str] = []

        def visit(airport: str) -> None:
            destinations = graph.get(airport, [])
            while destinations:
                visit(destinations.pop())
            route.append(airport)

        visit("JFK")
        return route[::-1]`,
    sourceUrl: "https://leetcode.com/problems/reconstruct-itinerary/",
    tags: ["eulerian-path", "dfs", "hierholzer", "lexicographic-order"],
    recallChecks: [
      "Why is an airport appended after exhausting its outgoing tickets?",
      "Why does greedy forward traversal without postorder backtracking fail?",
      "How does reverse sorting make pop choose the smallest destination?",
    ],
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "findItinerary",
      },
      cases: [
        {
          name: "simple chain",
          args: [
            [
              ["MUC", "LHR"],
              ["JFK", "MUC"],
              ["SFO", "SJC"],
              ["LHR", "SFO"],
            ],
          ],
          expected: ["JFK", "MUC", "LHR", "SFO", "SJC"],
          comparator: "deepEqual",
        },
        {
          name: "chooses the lexical Eulerian route",
          args: [
            [
              ["JFK", "SFO"],
              ["JFK", "ATL"],
              ["SFO", "ATL"],
              ["ATL", "JFK"],
              ["ATL", "SFO"],
            ],
          ],
          expected: ["JFK", "ATL", "JFK", "SFO", "ATL", "SFO"],
          comparator: "deepEqual",
        },
        {
          name: "backtracks from an early lexical dead end",
          args: [
            [
              ["JFK", "KUL"],
              ["JFK", "NRT"],
              ["NRT", "JFK"],
            ],
          ],
          expected: ["JFK", "NRT", "JFK", "KUL"],
          comparator: "deepEqual",
        },
        {
          name: "uses duplicate tickets as distinct edges",
          args: [
            [
              ["JFK", "ATL"],
              ["JFK", "ATL"],
              ["ATL", "JFK"],
            ],
          ],
          expected: ["JFK", "ATL", "JFK", "ATL"],
          comparator: "deepEqual",
        },
        {
          name: "handles a single ticket",
          args: [[["JFK", "SFO"]]],
          expected: ["JFK", "SFO"],
          comparator: "deepEqual",
        },
      ],
    },
  },
  {
    id: 778,
    title: "Swim in Rising Water",
    slug: "swim-in-rising-water",
    difficulty: "Hard",
    pattern: "Graphs",
    summary:
      "Find the minimum water level at which a path exists from the top-left to the bottom-right cell.",
    cue: "Treat a path's cost as its maximum elevation and run Dijkstra under that minimax cost.",
    invariant:
      "When a cell leaves the min-heap for the first time, its time is the smallest possible maximum elevation over all paths to it.",
    complexity: "O(n² log n) time · O(n²) space",
    languageNote:
      "Store (time, row, column) tuples in heapq and mark a cell seen when enqueued because no later candidate can improve its minimax entry cost.",
    estimatedMinutes: 20,
    starterCode: `import heapq


class Solution:
    def swimInWater(self, grid: list[list[int]]) -> int:
        pass`,
    code: `import heapq


class Solution:
    def swimInWater(self, grid: list[list[int]]) -> int:
        size = len(grid)
        heap = [(grid[0][0], 0, 0)]
        seen = {(0, 0)}

        while heap:
            time, row, column = heapq.heappop(heap)
            if row == size - 1 and column == size - 1:
                return time

            for next_row, next_column in (
                (row + 1, column),
                (row - 1, column),
                (row, column + 1),
                (row, column - 1),
            ):
                if (
                    0 <= next_row < size
                    and 0 <= next_column < size
                    and (next_row, next_column) not in seen
                ):
                    seen.add((next_row, next_column))
                    next_time = max(time, grid[next_row][next_column])
                    heapq.heappush(heap, (next_time, next_row, next_column))

        raise ValueError("destination is unreachable")`,
    sourceUrl: "https://leetcode.com/problems/swim-in-rising-water/",
    tags: ["dijkstra", "minimax-path", "heap", "grid"],
    recallChecks: [
      "What quantity replaces additive distance in this Dijkstra variant?",
      "Why is returning on heap removal valid but returning on discovery is not?",
      "How could binary search plus reachability solve the same problem?",
    ],
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "swimInWater",
      },
      cases: [
        {
          name: "two-by-two detour",
          args: [
            [
              [0, 2],
              [1, 3],
            ],
          ],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          name: "spiral barrier",
          args: [
            [
              [0, 1, 2, 3, 4],
              [24, 23, 22, 21, 5],
              [12, 13, 14, 15, 16],
              [11, 17, 18, 19, 20],
              [10, 9, 8, 7, 6],
            ],
          ],
          expected: 16,
          comparator: "deepEqual",
        },
        {
          name: "single cell",
          args: [[[7]]],
          expected: 7,
          comparator: "deepEqual",
        },
        {
          name: "follows a low winding route around high cells",
          args: [
            [
              [0, 8, 7],
              [1, 2, 6],
              [4, 3, 5],
            ],
          ],
          expected: 5,
          comparator: "deepEqual",
        },
        {
          name: "accounts for a high starting elevation",
          args: [
            [
              [3, 2],
              [0, 1],
            ],
          ],
          expected: 3,
          comparator: "deepEqual",
        },
      ],
    },
  },
  {
    id: 371,
    title: "Sum of Two Integers",
    slug: "sum-of-two-integers",
    difficulty: "Medium",
    pattern: "Bit Manipulation",
    summary:
      "Add two signed integers without using the addition or subtraction operators.",
    cue: "XOR adds bits without carry; shifted AND computes exactly the next carry bits.",
    invariant:
      "Within 32 bits, a plus b equals the current carry-free sum plus the pending carry.",
    complexity: "O(1) time for 32-bit integers · O(1) space",
    languageNote:
      "Python integers do not overflow, so mask every round to emulate fixed-width two's-complement arithmetic.",
    estimatedMinutes: 14,
    starterCode: `class Solution:
    def getSum(self, a: int, b: int) -> int:
        pass`,
    code: `class Solution:
    def getSum(self, a: int, b: int) -> int:
        mask = 0xFFFFFFFF
        sign_bit = 0x80000000
        a &= mask
        b &= mask

        while b:
            carry = ((a & b) << 1) & mask
            a = (a ^ b) & mask
            b = carry

        return a if a < sign_bit else ~(a ^ mask)`,
    sourceUrl: "https://leetcode.com/problems/sum-of-two-integers/",
    tags: ["bit-manipulation", "two-complement", "xor", "carry"],
    recallChecks: [
      "Which operation produces the sum bits before carrying?",
      "Why must Python mask both the intermediate sum and carry?",
      "How does the final expression convert a 32-bit negative value back to a Python integer?",
    ],
    verification: {
      revision: 1,
      entrypoint: { kind: "method", className: "Solution", name: "getSum" },
      cases: [
        {
          name: "two positive integers",
          args: [1, 2],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          name: "mixed signs",
          args: [-7, 3],
          expected: -4,
          comparator: "deepEqual",
        },
        {
          name: "two negative integers",
          args: [-12, -8],
          expected: -20,
          comparator: "deepEqual",
        },
        {
          name: "cancels opposite boundary values",
          args: [-1000, 1000],
          expected: 0,
          comparator: "deepEqual",
        },
        {
          name: "propagates carry across many bits",
          args: [511, 1],
          expected: 512,
          comparator: "deepEqual",
        },
      ],
    },
  },
  {
    id: 201,
    title: "Bitwise AND of Numbers Range",
    slug: "bitwise-and-of-numbers-range",
    difficulty: "Medium",
    pattern: "Bit Manipulation",
    summary: "Compute the bitwise AND of every integer in an inclusive range.",
    cue: "Only the common high-order prefix of the two endpoints can survive across the entire range.",
    invariant:
      "After each joint right shift, the discarded suffix contains a bit position that changes somewhere in the range and therefore ANDs to zero.",
    complexity: "O(log right) time · O(1) space",
    languageNote:
      "Right shifting both nonnegative endpoints exposes their common binary prefix without constructing any intermediate range.",
    estimatedMinutes: 10,
    starterCode: `class Solution:
    def rangeBitwiseAnd(self, left: int, right: int) -> int:
        pass`,
    code: `class Solution:
    def rangeBitwiseAnd(self, left: int, right: int) -> int:
        shifts = 0
        while left != right:
            left >>= 1
            right >>= 1
            shifts += 1
        return left << shifts`,
    sourceUrl: "https://leetcode.com/problems/bitwise-and-of-numbers-range/",
    tags: ["bit-manipulation", "common-prefix", "binary", "range"],
    recallChecks: [
      "Why must every bit below the endpoints' common prefix become zero?",
      "What does shifts count?",
      "Which alternative solution repeatedly clears the least-significant set bit of right?",
    ],
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "rangeBitwiseAnd",
      },
      cases: [
        {
          name: "small range",
          args: [5, 7],
          expected: 4,
          comparator: "deepEqual",
        },
        {
          name: "range beginning at zero",
          args: [0, 0],
          expected: 0,
          comparator: "deepEqual",
        },
        {
          name: "large common prefix",
          args: [26, 30],
          expected: 24,
          comparator: "deepEqual",
        },
        {
          name: "preserves an equal nonzero endpoint",
          args: [42, 42],
          expected: 42,
          comparator: "deepEqual",
        },
        {
          name: "crosses a power-of-two boundary",
          args: [7, 8],
          expected: 0,
          comparator: "deepEqual",
        },
      ],
    },
  },
  {
    id: 1143,
    title: "Longest Common Subsequence",
    slug: "longest-common-subsequence",
    difficulty: "Medium",
    pattern: "Dynamic Programming",
    summary:
      "Find the maximum length of a sequence that appears in order in both strings.",
    cue: "For each suffix pair, matching first characters advance both strings; otherwise discard one first character and keep the better option.",
    invariant:
      "Before processing row i, next_row[j] stores the optimal answer for text1[i + 1:] and text2[j:].",
    complexity: "O(mn) time · O(n) space",
    languageNote:
      "Two Python lists are enough because each DP row depends only on the row below and the cell to its right.",
    estimatedMinutes: 14,
    starterCode: `class Solution:
    def longestCommonSubsequence(self, text1: str, text2: str) -> int:
        pass`,
    code: `class Solution:
    def longestCommonSubsequence(self, text1: str, text2: str) -> int:
        if len(text2) > len(text1):
            text1, text2 = text2, text1

        next_row = [0] * (len(text2) + 1)
        for index1 in range(len(text1) - 1, -1, -1):
            current_row = [0] * (len(text2) + 1)
            for index2 in range(len(text2) - 1, -1, -1):
                if text1[index1] == text2[index2]:
                    current_row[index2] = 1 + next_row[index2 + 1]
                else:
                    current_row[index2] = max(
                        next_row[index2], current_row[index2 + 1]
                    )
            next_row = current_row

        return next_row[0]`,
    sourceUrl: "https://leetcode.com/problems/longest-common-subsequence/",
    tags: ["dynamic-programming", "subsequence", "rolling-array", "strings"],
    recallChecks: [
      "What subproblem does current_row[index2] represent?",
      "Why do mismatched characters create two choices rather than an automatic double advance?",
      "Why must index2 be filled from right to left?",
    ],
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "longestCommonSubsequence",
      },
      cases: [
        {
          name: "subsequence with gaps",
          args: ["abcde", "ace"],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          name: "identical strings",
          args: ["abc", "abc"],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          name: "disjoint strings",
          args: ["abc", "def"],
          expected: 0,
          comparator: "deepEqual",
        },
        {
          name: "caps repeated matches by the shorter string",
          args: ["aaaaaa", "aaa"],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          name: "chooses between crossed character orders",
          args: ["abc", "bac"],
          expected: 2,
          comparator: "deepEqual",
        },
      ],
    },
  },
  {
    id: 72,
    title: "Edit Distance",
    slug: "edit-distance",
    difficulty: "Medium",
    pattern: "Dynamic Programming",
    summary:
      "Find the minimum insertions, deletions, and replacements needed to transform one word into another.",
    cue: "When characters differ, pay one operation and choose the best of insert, delete, or replace.",
    invariant:
      "Before processing row i, next_row[j] is the edit distance from word1[i + 1:] to word2[j:].",
    complexity: "O(mn) time · O(n) space",
    languageNote:
      "Initialize the suffix base row with range(len(word2) + 1, 0, -1) semantics explicitly; readable loops are safer than clever slicing here.",
    estimatedMinutes: 18,
    starterCode: `class Solution:
    def minDistance(self, word1: str, word2: str) -> int:
        pass`,
    code: `class Solution:
    def minDistance(self, word1: str, word2: str) -> int:
        next_row = [len(word2) - index for index in range(len(word2) + 1)]

        for index1 in range(len(word1) - 1, -1, -1):
            current_row = [0] * (len(word2) + 1)
            current_row[len(word2)] = len(word1) - index1

            for index2 in range(len(word2) - 1, -1, -1):
                if word1[index1] == word2[index2]:
                    current_row[index2] = next_row[index2 + 1]
                else:
                    insert = current_row[index2 + 1]
                    delete = next_row[index2]
                    replace = next_row[index2 + 1]
                    current_row[index2] = 1 + min(insert, delete, replace)

            next_row = current_row

        return next_row[0]`,
    sourceUrl: "https://leetcode.com/problems/edit-distance/",
    tags: ["dynamic-programming", "edit-distance", "strings", "rolling-array"],
    recallChecks: [
      "Which neighboring DP cell corresponds to inserting into word1?",
      "Why does a character match add no operation?",
      "What do the last row and last column mean?",
    ],
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "minDistance",
      },
      cases: [
        {
          name: "mixed replacement and deletion",
          args: ["horse", "ros"],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          name: "longer transformation",
          args: ["intention", "execution"],
          expected: 5,
          comparator: "deepEqual",
        },
        {
          name: "empty source",
          args: ["", "abc"],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          name: "empty destination",
          args: ["abc", ""],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          name: "treats transposition as two edits",
          args: ["ab", "ba"],
          expected: 2,
          comparator: "deepEqual",
        },
      ],
    },
  },
  {
    id: 115,
    title: "Distinct Subsequences",
    slug: "distinct-subsequences",
    difficulty: "Hard",
    pattern: "Dynamic Programming",
    summary:
      "Count how many distinct index selections from a source string form a target string.",
    cue: "A matching source character can either be used for the current target character or skipped.",
    invariant:
      "Before each source character is processed, ways[j] counts target[:j] subsequences formed from the already processed source prefix.",
    complexity: "O(mn) time · O(n) space",
    languageNote:
      "Update the one-dimensional DP array backward so the current source character cannot contribute more than once.",
    estimatedMinutes: 18,
    starterCode: `class Solution:
    def numDistinct(self, source: str, target: str) -> int:
        pass`,
    code: `class Solution:
    def numDistinct(self, source: str, target: str) -> int:
        ways = [0] * (len(target) + 1)
        ways[0] = 1

        for character in source:
            for length in range(len(target), 0, -1):
                if character == target[length - 1]:
                    ways[length] += ways[length - 1]

        return ways[len(target)]`,
    sourceUrl: "https://leetcode.com/problems/distinct-subsequences/",
    tags: ["dynamic-programming", "subsequence", "counting", "rolling-array"],
    recallChecks: [
      "Why is there exactly one way to form an empty target?",
      "Why must the target-length loop move backward?",
      "What two choices are counted when the characters match?",
    ],
    verification: {
      revision: 1,
      entrypoint: {
        kind: "method",
        className: "Solution",
        name: "numDistinct",
      },
      cases: [
        {
          name: "three rabbit subsequences",
          args: ["rabbbit", "rabbit"],
          expected: 3,
          comparator: "deepEqual",
        },
        {
          name: "five bag subsequences",
          args: ["babgbag", "bag"],
          expected: 5,
          comparator: "deepEqual",
        },
        {
          name: "empty target",
          args: ["abc", ""],
          expected: 1,
          comparator: "deepEqual",
        },
        {
          name: "returns zero when target is longer",
          args: ["abc", "abcd"],
          expected: 0,
          comparator: "deepEqual",
        },
        {
          name: "counts repeated-character combinations",
          args: ["aaaaa", "aaa"],
          expected: 10,
          comparator: "deepEqual",
        },
      ],
    },
  },
];
