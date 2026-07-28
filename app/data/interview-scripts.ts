import type { PracticeItem } from "../lib/items";

export type InterviewScriptSnapshot = {
  version: 1;
  title: string;
  summary: string;
  scenario: string;
  prompts: Record<
    | "introduction"
    | "clarification"
    | "approach"
    | "implementation"
    | "testing"
    | "complexity"
    | "follow-up"
    | "closing",
    string
  >;
  hints: Partial<
    Record<
      | "clarification"
      | "approach"
      | "implementation"
      | "testing"
      | "complexity"
      | "follow-up"
      | "closing",
      string[]
    >
  >;
  referenceCriteria: string[];
};

type PythonPatternPack = {
  approach: string;
  test: string;
  followUp: string;
};

const DEFAULT_PYTHON_PACK: PythonPatternPack = {
  approach:
    "Talk through the state you need to preserve, the operations it must support, and why that representation fits the constraints.",
  test: "Choose a smallest valid input, a boundary input, and a case that would expose an incorrect state transition.",
  followUp:
    "If the input arrived incrementally instead of all at once, what would you keep between updates and what would change?",
};

const PYTHON_PATTERN_PACKS: Record<string, PythonPatternPack> = {
  "Arrays & Hashing": {
    approach:
      "What information can you remember from the prefix so the current value can be resolved without rescanning it?",
    test: "Include duplicates, a match near the end, and a case where insertion order changes correctness.",
    followUp:
      "How would your design change if memory were tightly bounded or the input were a stream?",
  },
  "Two Pointers": {
    approach:
      "Define what each pointer means and the observation that lets one pointer move without losing a valid answer.",
    test: "Trace crossed pointers, repeated values, and the smallest input on which both pointers can move.",
    followUp:
      "What breaks if the ordering property disappears, and what preprocessing or alternative structure would restore it?",
  },
  "Sliding Window": {
    approach:
      "State exactly when the window is valid, what enters or leaves its summary, and why the left edge never needs to move backward.",
    test: "Trace a window that repeatedly expands and shrinks, plus an input with no valid non-empty answer.",
    followUp:
      "How would you adapt the window if the validity rule changed from at most k to exactly k?",
  },
  Stack: {
    approach:
      "Which unresolved work must be revisited in last-in-first-out order, and what invariant does each stack entry represent?",
    test: "Use a deeply nested case, an immediate mismatch, and leftover unresolved work at the end.",
    followUp:
      "Could you return a useful error location or partial result without changing the asymptotic cost?",
  },
  "Binary Search": {
    approach:
      "Define the searchable monotonic predicate and whether each boundary is known-good, known-bad, or still possible.",
    test: "Trace a one-element range, a missing answer at each boundary, and termination when the bounds become adjacent.",
    followUp:
      "How would you return the first valid position rather than merely proving that one exists?",
  },
  "Linked List": {
    approach:
      "Name every pointer whose original successor must be saved before mutation and what portion of the list is already valid.",
    test: "Trace an empty list, one node, two nodes, and a mutation at the head or tail.",
    followUp:
      "How would the ownership story change for a persistent or shared list where nodes cannot be mutated in place?",
  },
  Trees: {
    approach:
      "What does one recursive call or queue entry promise, and what result must be combined when control returns?",
    test: "Include an empty tree, a single node, a skewed tree, and a property that fails below the root.",
    followUp:
      "When would you replace recursion with an explicit stack or queue, and what state would each entry carry?",
  },
  "Heaps & Priority Queues": {
    approach:
      "Which candidates are eligible now, what priority chooses the next one, and why can discarded candidates never become useful later?",
    test: "Include equal priorities, fewer than k elements, and a late element that displaces the current boundary.",
    followUp:
      "How would the design change if priorities could be updated after insertion?",
  },
  Tries: {
    approach:
      "What does each path prefix represent, and which terminal or count metadata distinguishes a complete answer from a shared prefix?",
    test: "Use one word that is a prefix of another, repeated inserts, and a query that diverges at the final character.",
    followUp:
      "What memory tradeoff would you make for a large alphabet or a mostly sparse prefix set?",
  },
  "Union-Find": {
    approach:
      "Define the component representative, the effect of find, and the invariant preserved by every union.",
    test: "Trace repeated unions, a cycle-closing edge, and two components that remain disconnected.",
    followUp:
      "What extra information could be stored per component without breaking path compression or union by rank?",
  },
  "Bit Manipulation": {
    approach:
      "Identify the per-bit algebraic property that cancels, isolates, or counts the information you need.",
    test: "Include zero, repeated values, the highest relevant bit, and negative inputs if the contract allows them.",
    followUp:
      "How would fixed-width signed representation affect the same argument in a language without Python's unbounded integers?",
  },
  Intervals: {
    approach:
      "State the sort order and the exact condition under which the current interval can be finalized rather than extended.",
    test: "Use touching endpoints, complete containment, identical intervals, and an interval that starts a new group.",
    followUp:
      "How would you support online additions when sorting the entire input again is too expensive?",
  },
  Graphs: {
    approach:
      "Define a node's discovered and processed states, and explain when an edge is safe to traverse or should be ignored.",
    test: "Include a disconnected component, a cycle, a self-loop, and the smallest graph allowed by the contract.",
    followUp:
      "What changes if edges are weighted, directed, or arrive after traversal has started?",
  },
  Backtracking: {
    approach:
      "What choice is being made at each level, what state is shared, and exactly how is that state restored before the next choice?",
    test: "Trace a branch that succeeds, one that prunes early, and an input with no complete construction.",
    followUp:
      "Which repeated subproblem could be memoized, and what would the cache key need to include?",
  },
  Greedy: {
    approach:
      "State the locally optimal choice and give an exchange or dominance argument for why postponing it cannot improve the result.",
    test: "Try to construct a counterexample with ties, a late attractive choice, and the smallest non-trivial input.",
    followUp:
      "Which change to the objective or constraints would invalidate the greedy-choice argument?",
  },
  "Dynamic Programming": {
    approach:
      "Define one state in a complete sentence, list the choices that reach it, and name the evaluation order that makes dependencies available.",
    test: "Trace the base case, the first non-base state, and an input where two different transitions compete.",
    followUp:
      "Which dimensions of the table are truly needed at once, and can space be compressed without losing reconstruction?",
  },
};

function clean(value: string, fallback: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

export function pythonInterviewScript(
  item: PracticeItem,
): InterviewScriptSnapshot {
  const pack = PYTHON_PATTERN_PACKS[item.pattern] ?? DEFAULT_PYTHON_PACK;
  return {
    version: 1,
    title: `${item.title} coding interview`,
    summary: clean(
      item.summary,
      "Solve the coding problem using the provided Python workspace.",
    ),
    scenario: clean(
      item.summary,
      "Solve the coding problem using the provided Python workspace.",
    ),
    prompts: {
      introduction: `Welcome. We will work through ${item.title}. Treat this as a live interview: ask questions, explain decisions, run tests, and close with a concise summary.`,
      clarification:
        "Before proposing an algorithm, write the clarifying questions you would ask about inputs, outputs, constraints, and edge cases. Commit the questions you would actually say aloud.",
      approach: pack.approach,
      implementation:
        "Implement your approach in Python. Keep the interviewer oriented at major decisions; you do not need to narrate every keystroke.",
      testing: `${pack.test} Run the available checks and explain what any failure tells you before editing.`,
      complexity:
        "State time and auxiliary-space complexity in terms of the relevant input dimensions. Explain the operation that dominates each bound.",
      "follow-up": pack.followUp,
      closing:
        "Give a 60-second final explanation: approach, invariant, correctness intuition, complexity, and the most important edge case you verified.",
    },
    hints: {
      clarification: [
        "Separate contract questions from algorithm questions.",
        "Ask what the smallest and largest valid inputs are and whether duplicates or ordering matter.",
      ],
      approach: [
        pack.approach,
        clean(item.cue, "Identify the property that removes repeated work."),
        clean(item.invariant, "State what must remain true after each step."),
      ],
      implementation: [
        "Write the function boundary first, then the state named in your invariant.",
        "Translate one invariant-preserving step before handling the loop or recursion around it.",
      ],
      testing: [
        pack.test,
        "If a check fails, compare the first point where the invariant stops being true rather than guessing at the final output.",
      ],
      complexity: [
        "Count how many times each input element can enter the dominant operation.",
        clean(item.complexity, "Separate the runtime and auxiliary-space arguments."),
      ],
      "follow-up": [
        "Restate which assumption the variant changes before editing the original design.",
        "Reuse the original invariant only if it is still true under the new contract.",
      ],
      closing: [
        "Use this order: approach, invariant, verification, complexity.",
      ],
    },
    referenceCriteria: [
      `Selection cue: ${clean(item.cue, "Use the input property to avoid repeated work.")}`,
      `Invariant: ${clean(item.invariant, "The maintained state remains valid after each step.")}`,
      `Expected complexity: ${clean(item.complexity, "State time and auxiliary space.")}`,
      "Verification should include a representative case and at least one boundary or adversarial case.",
      "A passing local judge is execution evidence; the written explanation remains learner-authored and is not semantically graded.",
    ],
  };
}

export function iosTechnicalScreenScript(
  item: PracticeItem,
): InterviewScriptSnapshot {
  const prompt = (item as PracticeItem & { prompt?: string }).prompt ?? "";
  const checks = item.recallChecks ?? [
    "Predict the behavior before proposing a change.",
    "Reconstruct the important boundary from memory.",
    "Explain the design tradeoff.",
  ];
  const answers = item.conceptAnswers ?? [
    item.cue,
    item.invariant,
    item.languageNote,
  ];
  return {
    version: 1,
    title: `${item.title} technical screen`,
    summary: clean(item.summary, item.title),
    scenario: `${clean(item.summary, item.title)} ${clean(prompt, "Explain how you would reason about this Swift or iOS scenario.")}`,
    prompts: {
      introduction: `Welcome. This is a Swift/iOS technical screen about ${item.title}. No Swift code is executed here; commit the answer you would give aloud, then compare it with authored criteria after the screen.`,
      clarification:
        "What product, lifecycle, ownership, concurrency, or failure assumptions would you clarify before choosing a design?",
      approach: checks[0],
      implementation: checks[1],
      testing:
        "Describe one focused unit or integration test, one failure path, and the observation that would prove the boundary works.",
      complexity:
        "Explain the primary performance, memory, lifecycle, or maintainability cost in this design. Name the condition under which it becomes important.",
      "follow-up": checks[2],
      closing:
        "Give a concise recommendation, its key invariant, one rejected alternative, and the highest-risk edge case you would verify next.",
    },
    hints: {
      clarification: [
        `Consider the boundary suggested by: ${clean(item.cue, "the data and ownership contract")}`,
      ],
      approach: [
        clean(item.cue, "Name the framework or language behavior involved."),
        clean(item.invariant, "State the behavior that must remain true."),
      ],
      implementation: [
        "Name the concrete type, owner, executor, or lifecycle boundary before writing details.",
        clean(item.languageNote, "Tie the recommendation to Swift or Apple-platform semantics."),
      ],
      testing: [
        "Test the observable contract at the boundary, not the private implementation detail.",
        "Include cancellation, teardown, invalid data, or repeated delivery when that failure mode applies.",
      ],
      complexity: [
        clean(item.complexity, "Discuss both runtime work and retained state."),
      ],
      "follow-up": [
        "Compare the alternative using ownership, correctness, testability, and operational cost.",
      ],
      closing: [
        "Use this order: recommendation, invariant, tradeoff, verification.",
      ],
    },
    referenceCriteria: [
      ...answers.map((answer, index) => `Criterion ${index + 1}: ${clean(answer, "Explain the relevant contract.")}`),
      `Invariant: ${clean(item.invariant, "State what must remain true.")}`,
      `Swift/iOS note: ${clean(item.languageNote, "Tie the answer to platform semantics.")}`,
      "The response is stored as learner-authored evidence and is never semantically scored or converted into a pass/fail assessment.",
    ],
  };
}
