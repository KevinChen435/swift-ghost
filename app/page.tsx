"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Problem = {
  id: number;
  title: string;
  difficulty: "Easy" | "Medium";
  pattern: string;
  summary: string;
  insight: string;
  complexity: string;
  url: string;
  code: string;
};

type Progress = Record<
  number,
  {
    highestStage: number;
    attempts: number;
    bestAccuracy: number;
    bestWpm: number;
  }
>;

const STAGES = [
  { name: "Full ghost", note: "Type with the complete answer visible." },
  { name: "Missing expressions", note: "The structure stays; key decisions disappear." },
  { name: "Missing lines", note: "Recover whole implementation steps." },
  { name: "Skeleton only", note: "Keep only signatures and braces." },
  { name: "Blank editor", note: "Generate the solution from memory." },
];

const PROBLEMS: Problem[] = [
  {
    id: 1,
    title: "Two Sum",
    difficulty: "Easy",
    pattern: "Hash map",
    summary: "Return the two indices whose values add to a target.",
    insight: "Store earlier values by index; each new value asks whether its complement has already appeared.",
    complexity: "O(n) time · O(n) space",
    url: "https://leetcode.com/problems/two-sum/",
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
    id: 125,
    title: "Valid Palindrome",
    difficulty: "Easy",
    pattern: "Two pointers",
    summary: "Decide whether normalized text reads the same in both directions.",
    insight: "Normalize once, then compare the outer characters while moving inward.",
    complexity: "O(n) time · O(n) space",
    url: "https://leetcode.com/problems/valid-palindrome/",
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
    id: 3,
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    pattern: "Sliding window",
    summary: "Find the longest contiguous run with no repeated character.",
    insight: "Move the left edge beyond a duplicate’s last position, but never move it backward.",
    complexity: "O(n) time · O(n) space",
    url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
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
    id: 20,
    title: "Valid Parentheses",
    difficulty: "Easy",
    pattern: "Stack",
    summary: "Check that every closing delimiter matches the most recent unclosed opener.",
    insight: "A stack preserves the exact nesting order that valid delimiters require.",
    complexity: "O(n) time · O(n) space",
    url: "https://leetcode.com/problems/valid-parentheses/",
    code: `class Solution {
    func isValid(_ s: String) -> Bool {
        let openingForClosing: [Character: Character] = [
            ")": "(",
            "]": "[",
            "}": "{"
        ]
        var stack: [Character] = []

        for character in s {
            if let expectedOpening = openingForClosing[character] {
                guard let actualOpening = stack.popLast(),
                      actualOpening == expectedOpening else {
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
    id: 704,
    title: "Binary Search",
    difficulty: "Easy",
    pattern: "Binary search",
    summary: "Find a target in a sorted array or return -1.",
    insight: "Maintain an inclusive candidate range and discard the impossible half after every comparison.",
    complexity: "O(log n) time · O(1) space",
    url: "https://leetcode.com/problems/binary-search/",
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
    id: 56,
    title: "Merge Intervals",
    difficulty: "Medium",
    pattern: "Intervals",
    summary: "Combine every overlapping range.",
    insight: "Sorting by start time makes it sufficient to compare each interval with only the last merged interval.",
    complexity: "O(n log n) time · O(n) space",
    url: "https://leetcode.com/problems/merge-intervals/",
    code: `class Solution {
    func merge(_ intervals: [[Int]]) -> [[Int]] {
        guard !intervals.isEmpty else {
            return []
        }

        let sorted = intervals.sorted { $0[0] < $1[0] }
        var merged = [sorted[0]]

        for interval in sorted.dropFirst() {
            let lastIndex = merged.count - 1

            if interval[0] <= merged[lastIndex][1] {
                merged[lastIndex][1] = max(merged[lastIndex][1], interval[1])
            } else {
                merged.append(interval)
            }
        }

        return merged
    }
}`,
  },
  {
    id: 206,
    title: "Reverse Linked List",
    difficulty: "Easy",
    pattern: "Pointers",
    summary: "Reverse a singly linked list in place.",
    insight: "Save the next node before redirecting the current node toward its predecessor.",
    complexity: "O(n) time · O(1) space",
    url: "https://leetcode.com/problems/reverse-linked-list/",
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
    id: 102,
    title: "Binary Tree Level Order Traversal",
    difficulty: "Medium",
    pattern: "Tree BFS",
    summary: "Return the tree values grouped by depth.",
    insight: "A queue-length boundary separates one level from the next without sentinel nodes.",
    complexity: "O(n) time · O(n) space",
    url: "https://leetcode.com/problems/binary-tree-level-order-traversal/",
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

                if let left = node.left {
                    queue.append(left)
                }
                if let right = node.right {
                    queue.append(right)
                }
            }

            result.append(level)
        }

        return result
    }
}`,
  },
  {
    id: 200,
    title: "Number of Islands",
    difficulty: "Medium",
    pattern: "Grid DFS",
    summary: "Count connected components of land in a rectangular grid.",
    insight: "Every unseen land cell starts one island; mark the entire component before continuing the scan.",
    complexity: "O(rows × columns) time · O(rows × columns) space",
    url: "https://leetcode.com/problems/number-of-islands/",
    code: `class Solution {
    func numIslands(_ grid: [[Character]]) -> Int {
        guard let columnCount = grid.first?.count else {
            return 0
        }

        let rowCount = grid.count
        let directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        var cells = grid
        var islandCount = 0

        for row in 0..<rowCount {
            for column in 0..<columnCount {
                guard cells[row][column] == "1" else {
                    continue
                }

                islandCount += 1
                cells[row][column] = "0"
                var stack = [(row, column)]

                while let (currentRow, currentColumn) = stack.popLast() {
                    for (rowOffset, columnOffset) in directions {
                        let nextRow = currentRow + rowOffset
                        let nextColumn = currentColumn + columnOffset

                        guard nextRow >= 0, nextRow < rowCount,
                              nextColumn >= 0, nextColumn < columnCount,
                              cells[nextRow][nextColumn] == "1" else {
                            continue
                        }

                        cells[nextRow][nextColumn] = "0"
                        stack.append((nextRow, nextColumn))
                    }
                }
            }
        }

        return islandCount
    }
}`,
  },
];

function blankNonWhitespace(value: string) {
  return value.replace(/\S/g, " ");
}

function maskCode(code: string, stage: number) {
  if (stage === 0) return code;
  if (stage === 4) return code.replace(/[^\n]/g, " ");

  return code
    .split("\n")
    .map((line, index) => {
      const trimmed = line.trim();
      const structural =
        trimmed === "" ||
        trimmed === "}" ||
        trimmed === "{" ||
        trimmed.startsWith("class ") ||
        trimmed.startsWith("func ");

      if (stage === 3) {
        return structural ? line : blankNonWhitespace(line);
      }

      if (stage === 2) {
        const keep =
          structural ||
          trimmed.startsWith("var ") ||
          trimmed.startsWith("let ") ||
          index % 4 === 0;
        return keep ? line : blankNonWhitespace(line);
      }

      const decisionLine =
        /\b(if|else if|guard|while|for|return)\b/.test(trimmed) ||
        trimmed.includes(" = ");
      if (!decisionLine) return line;

      const keywordMatch = line.match(/^(\s*(?:if|else if|guard|while|for|return|let|var)\b)/);
      if (keywordMatch) {
        return keywordMatch[1] + blankNonWhitespace(line.slice(keywordMatch[1].length));
      }

      const equalsIndex = line.indexOf(" = ");
      return equalsIndex >= 0
        ? line.slice(0, equalsIndex + 3) + blankNonWhitespace(line.slice(equalsIndex + 3))
        : blankNonWhitespace(line);
    })
    .join("\n");
}

function calculateAccuracy(typed: string, target: string) {
  if (!typed.length) return 100;
  let correct = 0;
  for (let index = 0; index < typed.length; index += 1) {
    if (typed[index] === target[index]) correct += 1;
  }
  return Math.round((correct / typed.length) * 100);
}

export default function Home() {
  const [problemIndex, setProblemIndex] = useState(0);
  const [stage, setStage] = useState(0);
  const [typed, setTyped] = useState("");
  const [strict, setStrict] = useState(true);
  const [peek, setPeek] = useState(false);
  const [errors, setErrors] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<Progress>({});
  const [celebrate, setCelebrate] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const problem = PROBLEMS[problemIndex];
  const completed = typed === problem.code;
  const accuracy = calculateAccuracy(typed, problem.code);
  const wpm = elapsed > 0 ? Math.round(typed.length / 5 / (elapsed / 60)) : 0;
  const visibleGhost = useMemo(
    () => maskCode(problem.code, peek ? 0 : stage),
    [problem.code, peek, stage],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem("swift-ghost-progress");
        if (saved) {
          setProgress(JSON.parse(saved));
        }
      } catch {
        try {
          localStorage.removeItem("swift-ghost-progress");
        } catch {
          // Browser storage can be unavailable; in-memory practice still works.
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!startedAt || completed) return;
    const timer = window.setInterval(
      () => setElapsed((Date.now() - startedAt) / 1000),
      500,
    );
    return () => window.clearInterval(timer);
  }, [startedAt, completed]);

  function resetAttempt(nextStage = stage) {
    setStage(nextStage);
    setTyped("");
    setErrors(0);
    setStartedAt(null);
    setElapsed(0);
    setCelebrate(false);
    setPeek(false);
    window.setTimeout(() => editorRef.current?.focus(), 0);
  }

  function selectProblem(index: number) {
    setProblemIndex(index);
    resetAttempt(0);
  }

  function handleInput(value: string) {
    if (!startedAt && value.length) setStartedAt(Date.now());
    if (strict && !problem.code.startsWith(value)) {
      setErrors((count) => count + 1);
      return;
    }
    setTyped(value);
    if (value === problem.code) {
      setCelebrate(true);
      const finalElapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0;
      const finalAccuracy = calculateAccuracy(value, problem.code);
      const finalWpm =
        finalElapsed > 0 ? Math.round(value.length / 5 / (finalElapsed / 60)) : 0;
      setElapsed(finalElapsed);

      setProgress((current) => {
        const nextProgress: Progress = {
          ...current,
          [problem.id]: {
            highestStage: Math.max(current[problem.id]?.highestStage ?? 0, stage),
            attempts: (current[problem.id]?.attempts ?? 0) + 1,
            bestAccuracy: Math.max(
              current[problem.id]?.bestAccuracy ?? 0,
              finalAccuracy,
            ),
            bestWpm: Math.max(current[problem.id]?.bestWpm ?? 0, finalWpm),
          },
        };
        try {
          localStorage.setItem("swift-ghost-progress", JSON.stringify(nextProgress));
        } catch {
          // Keep progress for this session when persistence is blocked or full.
        }
        return nextProgress;
      });
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Tab") {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const next = typed.slice(0, start) + "    " + typed.slice(target.selectionEnd);
      handleInput(next);
      window.setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  }

  function advanceStage() {
    if (stage < STAGES.length - 1) resetAttempt(stage + 1);
  }

  const progressPercent = Math.min(100, Math.round((typed.length / problem.code.length) * 100));

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#practice" aria-label="Swift Ghost home">
          <span className="brandMark" aria-hidden="true">S</span>
          <span>Swift Ghost</span>
        </a>
        <div className="privacyNote">
          <span className="privacyDot" aria-hidden="true" />
          Progress stays on this device
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div>
          <p className="eyebrow">Interview fluency for rusty iOS engineers</p>
          <h1 id="hero-title">Type it. <em>Fade it.</em> Own it.</h1>
          <p className="heroCopy">
            Rebuild Swift muscle memory on known interview patterns. Start with
            the full solution in grey, then remove support until you can write
            it cold.
          </p>
        </div>
        <div className="methodCard">
          <span className="methodLabel">The five-pass method</span>
          <ol>
            {STAGES.map((item, index) => (
              <li key={item.name}>
                <span>{index + 1}</span>
                {item.name}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="practiceShell" id="practice">
        <aside className="problemRail" aria-label="Problem list">
          <div className="railHeader">
            <span>Core patterns</span>
            <strong>{PROBLEMS.length}</strong>
          </div>
          <div className="problemList">
            {PROBLEMS.map((item, index) => {
              const itemProgress = progress[item.id];
              return (
                <button
                  className={index === problemIndex ? "problemItem active" : "problemItem"}
                  aria-current={index === problemIndex ? "true" : undefined}
                  key={item.id}
                  onClick={() => selectProblem(index)}
                  type="button"
                >
                  <span className="problemNumber">
                    {itemProgress ? `L${itemProgress.highestStage + 1}` : String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.pattern}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="workspace">
          <div className="problemHeader">
            <div>
              <div className="problemMeta">
                <span>LC {problem.id}</span>
                <span className={`difficulty ${problem.difficulty.toLowerCase()}`}>
                  {problem.difficulty}
                </span>
                <span>{problem.pattern}</span>
              </div>
              <h2>{problem.title}</h2>
              <p>{problem.summary}</p>
            </div>
            <a href={problem.url} target="_blank" rel="noreferrer" className="sourceLink">
              Open problem <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div className="insightBar">
            <span>Invariant</span>
            <p>{problem.insight}</p>
            <strong>{problem.complexity}</strong>
          </div>

          <div className="stagePicker" aria-label="Guidance level">
            {STAGES.map((item, index) => (
              <button
                type="button"
                key={item.name}
                className={stage === index ? "stage active" : "stage"}
                aria-label={`Stage ${index + 1}: ${item.name}`}
                aria-pressed={stage === index}
                onClick={() => resetAttempt(index)}
              >
                <span>{index + 1}</span>
                <small>{item.name}</small>
              </button>
            ))}
          </div>

          <div className="editorCard">
            <div className="editorToolbar">
              <div className="windowDots" aria-hidden="true">
                <i /><i /><i />
              </div>
              <span>Solution.swift</span>
              <div className="toolbarActions">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={strict}
                    onChange={(event) => setStrict(event.target.checked)}
                  />
                  <span>Correct mistakes</span>
                </label>
                <button
                  type="button"
                  className={peek ? "peek active" : "peek"}
                  onClick={() => setPeek((value) => !value)}
                >
                  {peek ? "Hide answer" : "Peek answer"}
                </button>
              </div>
            </div>

            <div className="editorWrap">
              <pre className="ghostCode" aria-hidden="true">{visibleGhost}</pre>
              <textarea
                ref={editorRef}
                value={typed}
                onChange={(event) => handleInput(event.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={(event) => {
                  event.preventDefault();
                  setErrors((count) => count + 1);
                }}
                onScroll={(event) => {
                  const ghost = event.currentTarget.previousElementSibling as HTMLElement | null;
                  if (ghost) {
                    ghost.scrollTop = event.currentTarget.scrollTop;
                    ghost.scrollLeft = event.currentTarget.scrollLeft;
                  }
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label={`Type the Swift solution for ${problem.title}`}
              />
            </div>

            <div className="editorFooter">
              <div className="stat">
                <span>Progress</span>
                <strong>{progressPercent}%</strong>
              </div>
              <div className="progressTrack" aria-hidden="true">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="stat">
                <span>Accuracy</span>
                <strong>{accuracy}%</strong>
              </div>
              <div className="stat">
                <span>WPM</span>
                <strong>{wpm}</strong>
              </div>
              <div className="stat">
                <span>Corrections</span>
                <strong>{errors}</strong>
              </div>
            </div>
          </div>

          {celebrate && (
            <div className="completion show" role="status">
              <div>
                <span aria-hidden="true">✓</span>
                <p>
                  <strong>Pass complete.</strong>
                  {stage < 4
                    ? " Now remove one layer of support."
                    : " You generated this one cold."}
                </p>
              </div>
              {stage < 4 ? (
                <button type="button" onClick={advanceStage}>Start next fade →</button>
              ) : (
                <button
                  type="button"
                  onClick={() => selectProblem((problemIndex + 1) % PROBLEMS.length)}
                >
                  Next problem →
                </button>
              )}
            </div>
          )}

          <div className="sessionActions">
            <p>
              <strong>Stage {stage + 1}: {STAGES[stage].name}.</strong>{" "}
              {STAGES[stage].note}
            </p>
            <button type="button" onClick={() => resetAttempt()}>Reset attempt</button>
          </div>
        </div>
      </section>

      <footer>
        <p>
          Built for deliberate practice. Problem names link to LeetCode; summaries
          and Swift solutions here are original educational material.
        </p>
        <a href="https://github.com/KevinChen435/swift-ghost" target="_blank" rel="noreferrer">
          Source on GitHub ↗
        </a>
      </footer>
    </main>
  );
}
