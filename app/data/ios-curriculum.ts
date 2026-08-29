import type { ItemId } from "../lib/items";

/**
 * The ordered, deliberately finite curriculum for a Swift and iOS
 * reactivation pass.  The curriculum points at catalog item IDs instead of
 * copying their prompts or answers, so content and evidence continue to have
 * one source of truth in the existing item bank.
 */

export type IOSReactivationPhaseId =
  | "swift-foundations"
  | "swift-algorithms"
  | "ownership-concurrency"
  | "ui-composition"
  | "production-quality";

export type IOSReactivationModule = {
  id: `ios-reactivation:${string}`;
  title: string;
  eyebrow: string;
  summary: string;
  outcome: string;
  itemIds: readonly ItemId[];
  focus: readonly string[];
  estimatedMinutes: number;
};

export type IOSReactivationPhase = {
  id: IOSReactivationPhaseId;
  number: 1 | 2 | 3 | 4 | 5;
  title: string;
  subtitle: string;
  description: string;
  outcome: string;
  estimatedMinutes: number;
  modules: readonly IOSReactivationModule[];
};

export type IOSReactivationTrack = {
  id: "swift-ios-reactivation";
  title: string;
  description: string;
  promise: string;
  phases: readonly IOSReactivationPhase[];
};

const item = (value: string) => value as ItemId;

export const IOS_REACTIVATION_PHASES: readonly IOSReactivationPhase[] = [
  {
    id: "swift-foundations",
    number: 1,
    title: "Swift foundations",
    subtitle: "Make the language feel familiar again",
    description:
      "Start with the semantics that make Swift code predictable: values, references, optionals, protocols, and small collection transforms.",
    outcome:
      "You can explain the ownership and type boundary before writing a line.",
    estimatedMinutes: 35,
    modules: [
      {
        id: "ios-reactivation:swift-semantics",
        eyebrow: "Language reset",
        title: "Values, optionals, and protocols",
        summary:
          "Rebuild the mental model behind value copies, throwing boundaries, and associated types.",
        outcome: "Choose the right Swift representation and state its tradeoff.",
        itemIds: [
          item("ios:value-reference-snapshots"),
          item("ios:copy-on-write-draft"),
          item("ios:optional-throwing-boundary"),
          item("ios:generic-associated-id"),
        ],
        focus: ["struct vs class", "copy-on-write", "guard / throws", "associatedtype"],
        estimatedMinutes: 20,
      },
      {
        id: "ios-reactivation:swift-warmup",
        eyebrow: "Small executable reps",
        title: "Warm up the Swift judge",
        summary:
          "Use two short functions to get back into Swift collection and stack syntax before the larger algorithms.",
        outcome: "Type a complete function with confidence in the collection APIs.",
        itemIds: [
          item("swift:swift-independent-array-copies"),
          item("swift:swift-optional-port-boundary"),
        ],
        focus: ["Array value semantics", "optional validation", "function signatures"],
        estimatedMinutes: 15,
      },
    ],
  },
  {
    id: "swift-algorithms",
    number: 2,
    title: "Swift algorithms",
    subtitle: "Translate interview patterns into Swift",
    description:
      "Keep the algorithmic idea constant while rebuilding the Swift mechanics: dictionaries, sorted boundaries, stacks, deques, and prefix state.",
    outcome:
      "You can express a familiar invariant cleanly in Swift and verify it against examples.",
    estimatedMinutes: 110,
    modules: [
      {
        id: "ios-reactivation:swift-core-patterns",
        eyebrow: "Pattern translation",
        title: "Core interview patterns",
        summary:
          "Move from one-pass lookup to windows, intervals, binary search, and greedy state.",
        outcome: "Name the invariant, then choose the Swift container that preserves it.",
        itemIds: [
          item("swift:swift-two-sum"),
          item("swift:swift-valid-parentheses"),
          item("swift:swift-stable-window"),
          item("swift:swift-merge-intervals"),
          item("swift:swift-first-complete-group"),
          item("swift:swift-binary-search"),
          item("swift:swift-max-profit"),
        ],
        focus: ["Dictionary lookup", "stack discipline", "window bounds", "sort and merge", "binary-search boundaries"],
        estimatedMinutes: 55,
      },
      {
        id: "ios-reactivation:swift-array-depth",
        eyebrow: "Second-pass breadth",
        title: "Array, prefix, and two-pointer depth",
        summary:
          "Finish the high-yield Swift set while paying attention to mutation, overflow, duplicate handling, and index boundaries.",
        outcome: "Recognize the right pattern without relying on a remembered answer shape.",
        itemIds: [
          item("swift:swift-product-except-self"),
          item("swift:swift-contains-duplicate"),
          item("swift:swift-longest-consecutive"),
          item("swift:swift-subarray-sum-count"),
          item("swift:swift-three-sum"),
          item("swift:swift-valid-palindrome"),
          item("swift:swift-daily-temperatures"),
          item("swift:swift-search-rotated"),
          item("swift:swift-koko-bananas"),
          item("swift:swift-erase-overlap-intervals"),
          item("swift:swift-minimum-size-window"),
        ],
        focus: ["Prefix products", "set membership", "prefix sums", "duplicate skipping", "monotonic stack", "search space"],
        estimatedMinutes: 55,
      },
    ],
  },
  {
    id: "ownership-concurrency",
    number: 3,
    title: "Ownership & concurrency",
    subtitle: "Make lifetime and async work explicit",
    description:
      "Revisit the bugs that tend to appear in production iOS code: retained closures, shared mutable state, stale requests, and unstructured tasks.",
    outcome:
      "You can describe who owns state, who cancels work, and what may run concurrently.",
    estimatedMinutes: 45,
    modules: [
      {
        id: "ios-reactivation:ownership-concurrency",
        eyebrow: "Runtime boundaries",
        title: "Lifetime, actors, and cancellation",
        summary:
          "Practice the ownership and isolation decisions that keep an app responsive and leak-free.",
        outcome: "Choose a safe boundary for mutable state and asynchronous work.",
        itemIds: [
          item("ios:weak-stored-closure"),
          item("ios:async-let-dashboard"),
          item("ios:actor-response-cache"),
          item("ios:cancellable-search"),
        ],
        focus: ["weak capture", "async let", "actor isolation", "Task cancellation"],
        estimatedMinutes: 45,
      },
    ],
  },
  {
    id: "ui-composition",
    number: 4,
    title: "UI composition",
    subtitle: "Reconnect the screen-level fundamentals",
    description:
      "Refresh lifecycle placement, adaptive layout, reusable cells, SwiftUI identity, and typed navigation—the seams interviewers and production bugs expose quickly.",
    outcome:
      "You can explain how a screen owns state, responds to size, and moves through navigation.",
    estimatedMinutes: 55,
    modules: [
      {
        id: "ios-reactivation:ui-composition",
        eyebrow: "UIKit + SwiftUI",
        title: "Lifecycle, layout, and state",
        summary:
          "Rebuild a screen from its lifecycle boundary to its navigation state without cargo-culting a framework recipe.",
        outcome: "Place work where its lifetime and ownership actually belong.",
        itemIds: [
          item("ios:uikit-lifecycle-boundaries"),
          item("ios:uikit-adaptive-layout"),
          item("ios:uikit-cell-registration"),
          item("ios:swiftui-owned-observable-state"),
          item("ios:swiftui-typed-navigation"),
        ],
        focus: ["view lifecycle", "trait changes", "cell reuse", "stable identity", "typed routes"],
        estimatedMinutes: 55,
      },
    ],
  },
  {
    id: "production-quality",
    number: 5,
    title: "Production quality",
    subtitle: "Close with the boundaries real apps need",
    description:
      "Finish with networking policy, deterministic tests, and accessible controls so the refresh ends in engineering judgment—not trivia recall.",
    outcome:
      "You can defend a small iOS design under correctness, testability, and accessibility questions.",
    estimatedMinutes: 40,
    modules: [
      {
        id: "ios-reactivation:production-quality",
        eyebrow: "Engineering judgment",
        title: "Networking, tests, accessibility",
        summary:
          "Practice the seams that turn a demo into maintainable product code.",
        outcome: "State the policy, inject the dependency, and expose the semantic label.",
        itemIds: [
          item("ios:network-decode-cache-policy"),
          item("ios:dependency-injected-test"),
          item("ios:accessible-rating-control"),
        ],
        focus: ["HTTP caching", "dependency injection", "VoiceOver semantics"],
        estimatedMinutes: 40,
      },
    ],
  },
] as const;

export const IOS_REACTIVATION_TRACK: IOSReactivationTrack = {
  id: "swift-ios-reactivation",
  title: "Swift & iOS Reactivation",
  description:
    "A finite path from rusty Swift syntax back to clear iOS engineering judgment, built from the same concepts and runnable challenges as the rest of the app.",
  promise:
    "Explain the boundary, type the smallest useful version, then verify what you actually remember.",
  phases: IOS_REACTIVATION_PHASES,
};

export const IOS_REACTIVATION_ITEM_IDS: readonly ItemId[] = [
  ...new Set(
    IOS_REACTIVATION_PHASES.flatMap((phase) =>
      phase.modules.flatMap((module) => module.itemIds),
    ),
  ),
];
