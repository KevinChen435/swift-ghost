import type { BoundaryDrillSuiteDescriptor } from "../lib/boundary-suites.mjs";

/**
 * A deliberately small, reviewed catalog. Case ids are generated from the
 * built-in Python curriculum and revisions keep a stale pack from silently
 * running against changed problem content.
 */
export const BOUNDARY_DRILL_SUITES = Object.freeze([
  {
    itemId: "python:10001",
    contentRevision: 1,
    verificationRevision: 2,
    packs: [
      {
        id: "normalization-boundaries",
        title: "Normalization boundaries",
        purpose: "Separate filtering from counting before choosing a winner.",
        kind: "empty-and-tie",
        rationale:
          "Empty normalized values and deterministic ties expose solutions that count too early or rely on dictionary iteration order.",
        caseIds: [
          "10001:returns-none-when-no-normalized-word-remains",
          "10001:breaks-a-frequency-tie-alphabetically",
        ],
      },
    ],
  },
  {
    itemId: "python:10002",
    contentRevision: 1,
    verificationRevision: 2,
    packs: [
      {
        id: "cardinality-boundaries",
        title: "Cardinality boundaries",
        purpose: "Verify output order when the input contributes zero or one distinct value.",
        kind: "empty-and-duplicates",
        rationale:
          "These cases catch set-only solutions that discard order and loops that assume at least one emitted value.",
        caseIds: [
          "10002:handles-an-empty-input",
          "10002:keeps-one-copy-when-every-value-is-equal",
        ],
      },
    ],
  },
  {
    itemId: "python:1",
    contentRevision: 2,
    verificationRevision: 2,
    packs: [
      {
        id: "distinct-index-boundaries",
        title: "Distinct-index boundaries",
        purpose: "Check complement lookup timing and repeated values.",
        kind: "duplicates-and-signs",
        rationale:
          "A valid duplicate pair must use two positions, while a zero target with opposite signs checks complement arithmetic without special cases.",
        caseIds: [
          "1:uses-distinct-indices-for-duplicate-values",
          "1:finds-a-zero-target-using-opposite-signs",
        ],
      },
    ],
  },
  {
    itemId: "python:49",
    contentRevision: 2,
    verificationRevision: 2,
    packs: [
      {
        id: "empty-and-duplicate-words",
        title: "Empty and duplicate words",
        purpose: "Protect multiplicity while grouping degenerate strings.",
        kind: "empty-and-duplicates",
        rationale:
          "The empty string needs a valid signature, and duplicate occurrences must remain present rather than collapsing into a set.",
        caseIds: [
          "49:groups-an-empty-word",
          "49:preserves-duplicate-words-inside-an-anagram-group",
        ],
      },
    ],
  },
  {
    itemId: "python:238",
    contentRevision: 1,
    verificationRevision: 2,
    packs: [
      {
        id: "zero-boundaries",
        title: "Zero boundaries",
        purpose: "Distinguish one zero from multiple zeros without division.",
        kind: "zero-multiplicity",
        rationale:
          "One zero leaves exactly one nonzero product; two zeros force every output to zero. Prefix/suffix accumulation handles both naturally.",
        caseIds: [
          "238:handles-one-zero",
          "238:handles-two-zeros",
        ],
      },
    ],
  },
  {
    itemId: "python:125",
    contentRevision: 2,
    verificationRevision: 2,
    packs: [
      {
        id: "normalized-text-boundaries",
        title: "Normalized text boundaries",
        purpose: "Verify the definition of significant characters at both extremes.",
        kind: "empty-normalization-and-digits",
        rationale:
          "Punctuation-only input normalizes to empty, while digits remain significant; both reveal overly broad character filtering.",
        caseIds: [
          "125:treats-punctuation-only-text-as-a-palindrome",
          "125:compares-digits-as-significant-characters",
        ],
      },
    ],
  },
  {
    itemId: "python:3",
    contentRevision: 1,
    verificationRevision: 2,
    packs: [
      {
        id: "window-reset-boundaries",
        title: "Window reset boundaries",
        purpose: "Check empty input and repeated characters behind the current window.",
        kind: "empty-and-stale-repeat",
        rationale:
          "The left edge must never move backward when a repeated character lies outside the active window, and empty input must yield zero.",
        caseIds: [
          "3:does-not-move-the-left-edge-backward",
          "3:handles-an-empty-string",
        ],
      },
    ],
  },
] satisfies readonly BoundaryDrillSuiteDescriptor[]);

