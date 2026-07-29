import type { ItemId } from "../lib/items";

export type TestPurpose =
  "baseline" | "boundary" | "adversarial" | "regression";
export type TestDesignSource = "academy" | "today" | "assessment" | "weakness";
export type TestDesignLane = "python" | "swift" | "ios";
export type TestDesignInputFormat = "call-arguments" | "event-sequence";
export type TestObservationKind =
  | "value"
  | "error"
  | "lifetime"
  | "event-sequence"
  | "state-transition"
  | "accessibility-tree";
export type TestDesignSkillId =
  | "collection-contracts"
  | "normalization-contracts"
  | "window-contracts"
  | "swift-value-identity"
  | "swift-failure-contracts"
  | "swift-ownership-lifetime"
  | "swift-concurrency-ordering"
  | "ios-lifecycle-reuse"
  | "ios-state-restoration"
  | "ios-network-boundaries"
  | "ios-test-seams"
  | "ios-accessibility-behavior";

export type AuthoredTestCase = {
  id: string;
  purpose: TestPurpose;
  input: string;
  expected: string;
  rationale: string;
  defectCaught: string;
  comparator?: "unorderedNested" | "unorderedObjectArrays";
};

export type TestDesignProbe = {
  id: `test-design:${string}`;
  revision: number;
  lane: TestDesignLane;
  inputFormat: TestDesignInputFormat;
  observationKind: TestObservationKind;
  executionPolicy: "design-only";
  itemId: ItemId;
  itemRevision: number;
  skillId: TestDesignSkillId;
  skillLabel: string;
  title: string;
  prompt: string;
  constraint: string;
  primaryPurpose: TestPurpose;
  hint: string;
  referenceCases: AuthoredTestCase[];
};

export const TEST_DESIGN_PROBES: readonly TestDesignProbe[] = [
  {
    id: "test-design:two-sum-distinct-index",
    revision: 1,
    lane: "python",
    inputFormat: "call-arguments",
    observationKind: "value",
    executionPolicy: "design-only",
    itemId: "python:1",
    itemRevision: 1,
    skillId: "collection-contracts",
    skillLabel: "Collection output contracts",
    title: "Two Sum",
    prompt:
      "Design one small test that exposes an implementation which inserts the current value before checking its complement.",
    constraint:
      "The answer is a pair of original indices, and one array position cannot be reused.",
    primaryPurpose: "adversarial",
    hint: "A single value equal to half the target can tempt a buggy table lookup to reuse its own index.",
    referenceCases: [
      {
        id: "single-no-reuse",
        purpose: "adversarial",
        input: "[[4], 8]",
        expected: "[]",
        rationale: "The smallest input that can expose self-reuse.",
        defectCaught:
          "Inserting before lookup can return the same index twice.",
      },
      {
        id: "duplicate-pair",
        purpose: "regression",
        input: "[[4, 4], 8]",
        expected: "[0, 1]",
        rationale:
          "Confirms equal values at distinct indices still form a valid pair.",
        defectCaught:
          "Rejecting all equal-value complements would miss the real answer.",
      },
    ],
  },
  {
    id: "test-design:three-sum-dedup",
    revision: 1,
    lane: "python",
    inputFormat: "call-arguments",
    observationKind: "value",
    executionPolicy: "design-only",
    itemId: "python:15",
    itemRevision: 1,
    skillId: "collection-contracts",
    skillLabel: "Collection output contracts",
    title: "3Sum",
    prompt:
      "Design one small test that distinguishes unique value triples from duplicate emissions.",
    constraint:
      "The output contains each zero-sum value triple once; index combinations are not separate answers.",
    primaryPurpose: "regression",
    hint: "Use repeated copies of values that make exactly one value triple.",
    referenceCases: [
      {
        id: "many-zeroes",
        purpose: "regression",
        input: "[[0, 0, 0, 0, 0]]",
        expected: "[[0, 0, 0]]",
        rationale:
          "One extra zero is enough to create duplicate index combinations.",
        defectCaught:
          "Failing to skip duplicates can emit the same triple more than once.",
        comparator: "unorderedNested",
      },
      {
        id: "short-input",
        purpose: "boundary",
        input: "[[0, 0]]",
        expected: "[]",
        rationale: "A triple cannot exist below length three.",
        defectCaught:
          "Loose pointer bounds can read invalid positions or invent a result.",
      },
    ],
  },
  {
    id: "test-design:anagram-multiplicity",
    revision: 1,
    lane: "python",
    inputFormat: "call-arguments",
    observationKind: "value",
    executionPolicy: "design-only",
    itemId: "python:49",
    itemRevision: 1,
    skillId: "normalization-contracts",
    skillLabel: "Normalization contracts",
    title: "Group Anagrams",
    prompt:
      "Design one test that proves an anagram key must preserve character multiplicity, not only membership.",
    constraint:
      "Two words belong together only when every lowercase letter has the same count.",
    primaryPurpose: "adversarial",
    hint: "Choose two words with the same set of letters but different counts.",
    referenceCases: [
      {
        id: "same-set-different-count",
        purpose: "adversarial",
        input: '[["abb", "ab"]]',
        expected: '[["abb"], ["ab"]]',
        rationale:
          "The words share a character set but not a frequency signature.",
        defectCaught:
          "Using a set or unique letters as the key merges non-anagrams.",
        comparator: "unorderedNested",
      },
      {
        id: "empty-and-nonempty",
        purpose: "boundary",
        input: '[["", "a"]]',
        expected: '[[""], ["a"]]',
        rationale: "Makes the empty signature explicit.",
        defectCaught: "Skipping empty strings loses a valid group.",
        comparator: "unorderedNested",
      },
    ],
  },
  {
    id: "test-design:palindrome-normalization",
    revision: 1,
    lane: "python",
    inputFormat: "call-arguments",
    observationKind: "value",
    executionPolicy: "design-only",
    itemId: "python:125",
    itemRevision: 1,
    skillId: "normalization-contracts",
    skillLabel: "Normalization contracts",
    title: "Valid Palindrome",
    prompt:
      "Design one test that forces the comparison to honor both normalization rules: ignore punctuation and ignore case.",
    constraint:
      "ASCII letters and digits are significant; other characters are skipped.",
    primaryPurpose: "baseline",
    hint: "A two-letter palindrome separated by punctuation can exercise both rules at once.",
    referenceCases: [
      {
        id: "case-and-punctuation",
        purpose: "baseline",
        input: '["A, a"]',
        expected: "true",
        rationale: "A compact example exercises skipping and lowercasing.",
        defectCaught:
          "Comparing raw characters rejects a normalized palindrome.",
      },
      {
        id: "digits-significant",
        purpose: "adversarial",
        input: '["1a2"]',
        expected: "false",
        rationale: "Digits must remain in the normalized sequence.",
        defectCaught:
          "A letters-only filter can incorrectly discard a real mismatch.",
      },
    ],
  },
  {
    id: "test-design:longest-window-left",
    revision: 1,
    lane: "python",
    inputFormat: "call-arguments",
    observationKind: "value",
    executionPolicy: "design-only",
    itemId: "python:3",
    itemRevision: 1,
    skillId: "window-contracts",
    skillLabel: "Window boundary contracts",
    title: "Longest Unique Substring",
    prompt:
      "Design one regression test for an implementation that moves the left boundary backward when it sees an old repeat.",
    constraint:
      "Only repeats whose prior index is inside the current window may move the left boundary.",
    primaryPurpose: "regression",
    hint: "Create a repeat, move past it, then repeat a character whose old position is already outside the window.",
    referenceCases: [
      {
        id: "stale-repeat",
        purpose: "regression",
        input: '["abbac"]',
        expected: "3",
        rationale:
          "The second a is stale, and the trailing c makes a backward left-edge move visibly overcount.",
        defectCaught:
          "Assigning left directly to last_seen + 1 can move it backward and overcount.",
      },
      {
        id: "empty",
        purpose: "boundary",
        input: '[""]',
        expected: "0",
        rationale: "Defines the neutral result for no window.",
        defectCaught:
          "Initializing the best length to one fails on empty input.",
      },
    ],
  },
  {
    id: "test-design:min-window-multiplicity",
    revision: 1,
    lane: "python",
    inputFormat: "call-arguments",
    observationKind: "value",
    executionPolicy: "design-only",
    itemId: "python:76",
    itemRevision: 1,
    skillId: "window-contracts",
    skillLabel: "Window boundary contracts",
    title: "Minimum Window Substring",
    prompt:
      "Design one adversarial test that proves the target is a multiset, not a set of required characters.",
    constraint:
      "The returned substring must cover every target character with its full multiplicity.",
    primaryPurpose: "adversarial",
    hint: "Require the same character twice while the source offers tempting one-copy windows.",
    referenceCases: [
      {
        id: "repeated-requirement",
        purpose: "adversarial",
        input: '["ABAAC", "AAC"]',
        expected: '"AAC"',
        rationale:
          "A set-based check would accept windows containing only one A.",
        defectCaught:
          "Tracking only distinct required characters returns an invalid shorter window.",
      },
      {
        id: "target-longer",
        purpose: "boundary",
        input: '["ab", "aab"]',
        expected: '""',
        rationale: "The source cannot satisfy the target multiplicity.",
        defectCaught:
          "Missing impossibility handling can return a partial or stale window.",
      },
    ],
  },
  {
    id: "test-design:swift-preview-isolation",
    revision: 1,
    lane: "swift",
    inputFormat: "call-arguments",
    observationKind: "state-transition",
    executionPolicy: "design-only",
    itemId: "ios:value-reference-snapshots",
    itemRevision: 2,
    skillId: "swift-value-identity",
    skillLabel: "Swift value and identity contracts",
    title: "Independent Preview Session",
    prompt:
      "Design the smallest observation that proves changing preview settings does not change the live session or reuse its identity.",
    constraint:
      "The preview owns an independent settings value and is a different PlayerSession instance from the live session.",
    primaryPurpose: "regression",
    hint: "Mutate one preview property, then observe both property values and the two session identities.",
    referenceCases: [
      {
        id: "preview-speed-isolated",
        purpose: "regression",
        input: '{"liveSpeed":1,"action":{"setPreviewSpeed":1.5}}',
        expected:
          '{"liveSpeed":1,"previewSpeed":1.5,"sameSessionIdentity":false}',
        rationale:
          "One property mutation distinguishes an independent settings copy and new session identity from an alias.",
        defectCaught:
          "Returning the live session or assigning it to the preview mutates shared state.",
      },
      {
        id: "preview-captions-isolated",
        purpose: "boundary",
        input:
          '{"liveCaptions":false,"action":{"setPreviewCaptions":true}}',
        expected:
          '{"liveCaptions":false,"previewCaptions":true,"sameSessionIdentity":false}',
        rationale:
          "A Boolean toggle checks that isolation is structural rather than special-cased for playback speed.",
        defectCaught:
          "Copying only one field or sharing the PlayerSession still leaks the preview mutation into live state.",
      },
    ],
  },
  {
    id: "test-design:swift-cow-branch-independence",
    revision: 1,
    lane: "swift",
    inputFormat: "call-arguments",
    observationKind: "value",
    executionPolicy: "design-only",
    itemId: "ios:copy-on-write-draft",
    itemRevision: 2,
    skillId: "swift-value-identity",
    skillLabel: "Swift value and identity contracts",
    title: "Copy-on-Write Branches",
    prompt:
      "Design one observation proving two Array-backed value copies can diverge without changing the original or each other.",
    constraint:
      "Each branch starts from the same value snapshot and appends independently under Swift copy-on-write semantics.",
    primaryPurpose: "regression",
    hint: "Append a different marker to each branch and observe all three arrays afterward.",
    referenceCases: [
      {
        id: "two-branches-diverge",
        purpose: "regression",
        input:
          '{"original":["A"],"mobileAppend":"M","desktopAppend":"D"}',
        expected:
          '{"original":["A"],"mobile":["A","M"],"desktop":["A","D"]}',
        rationale:
          "Distinct suffixes make accidental shared mutation or reuse of one branch observable.",
        defectCaught:
          "Shared mutable storage or appending both values through one variable corrupts branch independence.",
      },
      {
        id: "empty-snapshot-branches",
        purpose: "boundary",
        input:
          '{"original":[],"mobileAppend":"M","desktopAppend":"D"}',
        expected:
          '{"original":[],"mobile":["M"],"desktop":["D"]}',
        rationale:
          "The empty snapshot removes prefix noise and exposes exactly which branch receives each mutation.",
        defectCaught:
          "An implementation that aliases a mutable backing object produces a nonempty original or combines both markers.",
      },
    ],
  },
  {
    id: "test-design:swift-port-missing",
    revision: 1,
    lane: "swift",
    inputFormat: "call-arguments",
    observationKind: "error",
    executionPolicy: "design-only",
    itemId: "ios:optional-throwing-boundary",
    itemRevision: 2,
    skillId: "swift-failure-contracts",
    skillLabel: "Swift failure contracts",
    title: "Missing Port Is Its Own Failure",
    prompt:
      "Design a boundary test proving an absent port throws the specific missingPort error.",
    constraint:
      "Absence, malformed text, and a parsed number outside the valid port range are distinct failure contracts.",
    primaryPurpose: "boundary",
    hint: "Give the parser no port key at all and observe the error case, not only that something failed.",
    referenceCases: [
      {
        id: "port-key-absent",
        purpose: "boundary",
        input: '{"values":{}}',
        expected: '{"outcome":"throws","error":{"case":"missingPort"}}',
        rationale:
          "An empty dictionary is the smallest input that isolates the absence branch.",
        defectCaught:
          "Force-unwrapping, silently defaulting, or collapsing absence into invalidPort violates the public failure contract.",
      },
      {
        id: "other-key-without-port",
        purpose: "regression",
        input: '{"values":{"host":"api.example.test"}}',
        expected: '{"outcome":"throws","error":{"case":"missingPort"}}',
        rationale:
          "An unrelated valid setting proves dictionary non-emptiness cannot stand in for presence of the port key.",
        defectCaught:
          "Checking only whether the configuration contains any values can skip the missingPort branch.",
      },
    ],
  },
  {
    id: "test-design:swift-port-invalid-range",
    revision: 1,
    lane: "swift",
    inputFormat: "call-arguments",
    observationKind: "error",
    executionPolicy: "design-only",
    itemId: "ios:optional-throwing-boundary",
    itemRevision: 2,
    skillId: "swift-failure-contracts",
    skillLabel: "Swift failure contracts",
    title: "Parsed Port Still Needs Validation",
    prompt:
      "Design an adversarial test proving a numeric string is not enough: the parsed port must also be inside the valid range.",
    constraint:
      "A present but out-of-range value throws invalidPort and preserves its raw input for diagnosis.",
    primaryPurpose: "adversarial",
    hint: "Choose a numeric boundary value that Int can parse but a network port cannot accept.",
    referenceCases: [
      {
        id: "port-zero-invalid",
        purpose: "adversarial",
        input: '{"values":{"port":"0"}}',
        expected:
          '{"outcome":"throws","error":{"case":"invalidPort","raw":"0"}}',
        rationale:
          "Zero parses cleanly, so it separates syntactic conversion from domain validation.",
        defectCaught:
          "Parse-only validation accepts an unusable port or collapses the present value into the missing case.",
      },
      {
        id: "port-above-upper-bound",
        purpose: "boundary",
        input: '{"values":{"port":"65536"}}',
        expected:
          '{"outcome":"throws","error":{"case":"invalidPort","raw":"65536"}}',
        rationale:
          "The first integer above the maximum valid port pins the upper-bound comparison.",
        defectCaught:
          "A missing upper-bound check or off-by-one comparison accepts 65536.",
      },
    ],
  },
  {
    id: "test-design:swift-weak-owner-release",
    revision: 1,
    lane: "swift",
    inputFormat: "event-sequence",
    observationKind: "lifetime",
    executionPolicy: "design-only",
    itemId: "ios:weak-stored-closure",
    itemRevision: 2,
    skillId: "swift-ownership-lifetime",
    skillLabel: "Swift ownership and lifetime",
    title: "Stored Closure Releases Its Owner",
    prompt:
      "Design a lifecycle observation that exposes a stored callback retaining its editor owner after external editor references are released.",
    constraint:
      "The saver may outlive the editor, but the callback must not create a strong reference cycle through self.",
    primaryPurpose: "regression",
    hint: "Keep only a weak editor observation, release the strong editor reference, and leave the saver alive.",
    referenceCases: [
      {
        id: "saver-outlives-editor",
        purpose: "regression",
        input:
          '{"steps":["createSaver","createEditor","retainWeakEditor","releaseEditor"],"saverRemainsAlive":true}',
        expected: '{"weakEditorIsNil":true}',
        rationale:
          "Keeping the callback holder alive isolates whether its stored closure strongly captures the editor.",
        defectCaught:
          "A strong self capture forms a cycle and keeps the editor alive after its owner releases it.",
      },
      {
        id: "whole-graph-releases",
        purpose: "boundary",
        input:
          '{"steps":["createSaver","createEditor","retainWeakSaver","retainWeakEditor","releaseSaver","releaseEditor"],"saverRemainsAlive":false}',
        expected: '{"weakEditorIsNil":true,"weakSaverIsNil":true}',
        rationale:
          "Releasing both roots proves neither object is stranded by an unexpected ownership edge.",
        defectCaught:
          "A mutual strong capture can leak both the callback owner and the saver.",
      },
    ],
  },
  {
    id: "test-design:swift-weak-callback-live-owner",
    revision: 1,
    lane: "swift",
    inputFormat: "event-sequence",
    observationKind: "lifetime",
    executionPolicy: "design-only",
    itemId: "ios:weak-stored-closure",
    itemRevision: 2,
    skillId: "swift-ownership-lifetime",
    skillLabel: "Swift ownership and lifetime",
    title: "Weak Callback Still Works While Alive",
    prompt:
      "Design a baseline observation proving the weak capture fix still invokes the owner while the editor is alive.",
    constraint:
      "Breaking the cycle must not disconnect a valid callback during the editor's lifetime.",
    primaryPurpose: "baseline",
    hint: "Keep the editor alive, trigger the saver, and observe a state change owned by the editor.",
    referenceCases: [
      {
        id: "one-live-save",
        purpose: "baseline",
        input: '{"editorAlive":true,"saveCalls":1}',
        expected: '{"saveCount":1}',
        rationale:
          "One call is the smallest positive proof that weak capture is not the same as removing the callback.",
        defectCaught:
          "Overcorrecting the ownership fix by clearing or never wiring the callback loses legitimate saves.",
      },
      {
        id: "repeated-live-saves",
        purpose: "regression",
        input: '{"editorAlive":true,"saveCalls":2}',
        expected: '{"saveCount":2}',
        rationale:
          "A second invocation checks that the weakly captured owner remains reachable for its full intended lifetime.",
        defectCaught:
          "A one-shot callback implementation can pass a single-call check while dropping later saves.",
      },
    ],
  },
  {
    id: "test-design:swift-async-let-overlap",
    revision: 1,
    lane: "swift",
    inputFormat: "event-sequence",
    observationKind: "event-sequence",
    executionPolicy: "design-only",
    itemId: "ios:async-let-dashboard",
    itemRevision: 2,
    skillId: "swift-concurrency-ordering",
    skillLabel: "Swift concurrency ordering",
    title: "Async Let Starts Both Children",
    prompt:
      "Design a controlled concurrency observation that distinguishes overlapping async-let child work from sequential awaits.",
    constraint:
      "Both independent child operations start before the test releases either suspension, and the dashboard returns only after both complete.",
    primaryPurpose: "regression",
    hint: "Suspend each dependency at entry and release them only after the test has observed both starts.",
    referenceCases: [
      {
        id: "both-start-before-release",
        purpose: "regression",
        input:
          '{"profile":"suspend-at-start","messages":"suspend-at-start","release":"after-both-started"}',
        expected:
          '{"startedBeforeRelease":["profile","messages"],"dashboardReturnedAfterBothCompleted":true}',
        rationale:
          "A shared gate makes overlap observable without depending on wall-clock timing.",
        defectCaught:
          "Awaiting profile before starting messages deadlocks at the gate or records only one start before release.",
        comparator: "unorderedObjectArrays",
      },
      {
        id: "reverse-start-order-still-overlaps",
        purpose: "adversarial",
        input:
          '{"profile":"suspend-at-start","messages":"suspend-at-start","schedulerPreference":"messages-first","release":"after-both-started"}',
        expected:
          '{"startedBeforeRelease":["profile","messages"],"dashboardReturnedAfterBothCompleted":true}',
        rationale:
          "Allowing either start order keeps the test about overlap rather than a scheduler accident.",
        defectCaught:
          "An order-sensitive test can flake even when both async-let children start concurrently.",
        comparator: "unorderedObjectArrays",
      },
    ],
  },
  {
    id: "test-design:swift-latest-query-wins",
    revision: 1,
    lane: "swift",
    inputFormat: "event-sequence",
    observationKind: "event-sequence",
    executionPolicy: "design-only",
    itemId: "ios:cancellable-search",
    itemRevision: 2,
    skillId: "swift-concurrency-ordering",
    skillLabel: "Swift concurrency ordering",
    title: "Latest Search Query Wins",
    prompt:
      "Design an adversarial completion order proving a canceled older search cannot publish after the latest query.",
    constraint:
      "Only results belonging to the current query may become visible, even if a dependency returns after cancellation.",
    primaryPurpose: "adversarial",
    hint: "Submit two queries, complete the newer one first, then make the canceled older request return anyway.",
    referenceCases: [
      {
        id: "older-completes-last",
        purpose: "adversarial",
        input:
          '{"submissions":["a","ab"],"completionOrder":["ab","a"],"results":{"a":["old"],"ab":["new"]}}',
        expected: '{"visibleResults":["new"],"publishedQueries":["ab"]}',
        rationale:
          "Reversing completion order makes a stale publication overwrite visible results unless guarded immediately before publish.",
        defectCaught:
          "Canceling the task without a cooperative prepublication check still permits old results to win.",
      },
      {
        id: "three-query-race",
        purpose: "regression",
        input:
          '{"submissions":["c","ca","cat"],"completionOrder":["cat","c","ca"],"results":{"c":["old-c"],"ca":["old-ca"],"cat":["current"]}}',
        expected:
          '{"visibleResults":["current"],"publishedQueries":["cat"]}',
        rationale:
          "Two stale completions prove the invariant applies to every superseded task, not only the immediately previous one.",
        defectCaught:
          "Tracking just one canceled task or comparing against the wrong captured query can allow an earlier result to publish.",
      },
    ],
  },
  {
    id: "test-design:ios-lifecycle-repeat-appearance",
    revision: 1,
    lane: "ios",
    inputFormat: "event-sequence",
    observationKind: "event-sequence",
    executionPolicy: "design-only",
    itemId: "ios:uikit-lifecycle-boundaries",
    itemRevision: 2,
    skillId: "ios-lifecycle-reuse",
    skillLabel: "iOS lifecycle and reuse",
    title: "UIKit Work at the Right Lifecycle Boundary",
    prompt:
      "Design an event sequence proving one-time setup, per-appearance refresh, and size-dependent layout happen at different lifecycle boundaries.",
    constraint:
      "Setup runs once, refresh runs for every appearance, and the gradient follows every reported layout size.",
    primaryPurpose: "regression",
    hint: "Appear twice with a size change between appearances, then count setup and refresh and observe both frames.",
    referenceCases: [
      {
        id: "repeat-appearance-and-rotation",
        purpose: "regression",
        input:
          '{"events":["load","appear","layout:100x200","disappear","appear","layout:200x100"]}',
        expected:
          '{"setupCount":1,"refreshCount":2,"gradientFrames":["100x200","200x100"]}',
        rationale:
          "A second appearance plus a new size exposes work placed too early, too late, or on every layout pass.",
        defectCaught:
          "Installing constraints during layout, refreshing only during load, or sizing the layer once produces the wrong counts or stale frame.",
      },
      {
        id: "multiple-layout-passes-one-appearance",
        purpose: "boundary",
        input:
          '{"events":["load","appear","layout:100x100","layout:100x120"]}',
        expected:
          '{"setupCount":1,"refreshCount":1,"gradientFrames":["100x100","100x120"]}',
        rationale:
          "Two layouts in one appearance distinguish geometry updates from appearance-driven data refresh.",
        defectCaught:
          "Refreshing or reinstalling constraints on every layout pass duplicates work while a layer that never resizes keeps stale geometry.",
      },
    ],
  },
  {
    id: "test-design:ios-cell-reuse-reset",
    revision: 1,
    lane: "ios",
    inputFormat: "event-sequence",
    observationKind: "event-sequence",
    executionPolicy: "design-only",
    itemId: "ios:uikit-cell-registration",
    itemRevision: 2,
    skillId: "ios-lifecycle-reuse",
    skillLabel: "iOS lifecycle and reuse",
    title: "Reused Cell Resets Every Property",
    prompt:
      "Design a reuse sequence that exposes cell configuration code which only assigns the affirmative state.",
    constraint:
      "Every dequeue writes all model-dependent text and image properties from the current Person.",
    primaryPurpose: "regression",
    hint: "Render a favorite row and then reuse the same cell for a nonfavorite row.",
    referenceCases: [
      {
        id: "favorite-then-nonfavorite",
        purpose: "regression",
        input:
          '{"sameCell":[{"name":"A","favorite":true},{"name":"B","favorite":false}]}',
        expected: '{"finalText":"B","finalImage":"star"}',
        rationale:
          "The first model plants affirmative state that the second configuration must actively replace.",
        defectCaught:
          "Affirmative-only image assignment leaks the filled star from the previous row.",
      },
      {
        id: "nonfavorite-then-favorite",
        purpose: "baseline",
        input:
          '{"sameCell":[{"name":"C","favorite":false},{"name":"D","favorite":true}]}',
        expected: '{"finalText":"D","finalImage":"star.fill"}',
        rationale:
          "The reverse transition proves both text and affirmative image are written from the current model.",
        defectCaught:
          "Partial configuration can leave old text or fail to render the favorite state after reuse.",
      },
    ],
  },
  {
    id: "test-design:ios-swiftui-same-identity",
    revision: 1,
    lane: "ios",
    inputFormat: "event-sequence",
    observationKind: "state-transition",
    executionPolicy: "design-only",
    itemId: "ios:swiftui-owned-observable-state",
    itemRevision: 2,
    skillId: "ios-state-restoration",
    skillLabel: "iOS state identity and restoration",
    title: "SwiftUI Preserves Owned Model Identity",
    prompt:
      "Design a state transition proving a view body reevaluation preserves its owned observable model and user edits.",
    constraint:
      "For one owner identity, reevaluating body keeps the same model object instead of constructing replacement state.",
    primaryPurpose: "regression",
    hint: "Mutate the model, force a body reevaluation without changing owner identity, then observe both value and identity.",
    referenceCases: [
      {
        id: "name-survives-body-reevaluation",
        purpose: "regression",
        input:
          '{"ownerIdentity":"profile-7","steps":["setName:Mina","reevaluateBody"]}',
        expected: '{"name":"Mina","modelIdentity":"unchanged"}',
        rationale:
          "A visible edit and identity observation distinguish owned state from a fresh model with coincidentally similar defaults.",
        defectCaught:
          "Constructing the observable model in body replaces it and loses the user's mutation.",
      },
      {
        id: "multiple-reevaluations-preserve-count",
        purpose: "adversarial",
        input:
          '{"ownerIdentity":"profile-8","steps":["setCount:1","reevaluateBody","setCount:2","reevaluateBody"]}',
        expected: '{"count":2,"modelIdentity":"unchanged"}',
        rationale:
          "Two reevaluations catch code that survives only the first render through incidental retention.",
        defectCaught:
          "Recreating or replacing the model during a later body pass resets accumulated state.",
      },
    ],
  },
  {
    id: "test-design:ios-route-round-trip",
    revision: 1,
    lane: "ios",
    inputFormat: "event-sequence",
    observationKind: "state-transition",
    executionPolicy: "design-only",
    itemId: "ios:swiftui-typed-navigation",
    itemRevision: 2,
    skillId: "ios-state-restoration",
    skillLabel: "iOS state identity and restoration",
    title: "Typed Navigation Round-Trips",
    prompt:
      "Design a restoration observation proving a navigation path is represented by stable route values rather than views or positions.",
    constraint:
      "Encoding and restoring the path preserves route case, associated stable identifier, and order.",
    primaryPurpose: "regression",
    hint: "Round-trip a mixed path containing an associated ID and a route without a payload.",
    referenceCases: [
      {
        id: "detail-and-settings-round-trip",
        purpose: "regression",
        input:
          '{"path":[{"case":"detail","id":"00000000-0000-0000-0000-000000000007"},{"case":"settings"}],"action":"roundTrip"}',
        expected:
          '{"restoredPath":[{"case":"detail","id":"00000000-0000-0000-0000-000000000007"},{"case":"settings"}]}',
        rationale:
          "A heterogeneous two-step path proves both associated identity and route ordering survive restoration.",
        defectCaught:
          "Storing views or index positions cannot reliably reconstruct stable typed destinations.",
      },
      {
        id: "empty-path-round-trip",
        purpose: "boundary",
        input: '{"path":[],"action":"roundTrip"}',
        expected: '{"restoredPath":[]}',
        rationale:
          "The root path defines the neutral restoration case without inventing a destination.",
        defectCaught:
          "A decoder that assumes at least one route can crash or restore a phantom screen.",
      },
    ],
  },
  {
    id: "test-design:ios-http-before-decode",
    revision: 1,
    lane: "ios",
    inputFormat: "call-arguments",
    observationKind: "error",
    executionPolicy: "design-only",
    itemId: "ios:network-decode-cache-policy",
    itemRevision: 2,
    skillId: "ios-network-boundaries",
    skillLabel: "iOS network boundary contracts",
    title: "Validate HTTP Before Decoding",
    prompt:
      "Design an adversarial response proving a syntactically decodable error body is rejected by HTTP status before decoding.",
    constraint:
      "Transport success is not application success; non-2xx status throws badStatus and does not invoke the model decoder.",
    primaryPurpose: "adversarial",
    hint: "Return a 500 response whose body looks exactly like a valid model and count decoder calls.",
    referenceCases: [
      {
        id: "decodable-server-error",
        purpose: "adversarial",
        input:
          '{"transport":"success","status":500,"body":{"id":7,"name":"Mina"}}',
        expected:
          '{"outcome":"throws","error":{"case":"badStatus","status":500},"decoderCalls":0}',
        rationale:
          "A valid-looking body removes decoding failure as an accidental reason to reject the response.",
        defectCaught:
          "Decoding before status validation accepts an HTTP failure as usable model data.",
      },
      {
        id: "decodable-not-found",
        purpose: "boundary",
        input:
          '{"transport":"success","status":404,"body":{"id":8,"name":"Lee"}}',
        expected:
          '{"outcome":"throws","error":{"case":"badStatus","status":404},"decoderCalls":0}',
        rationale:
          "A different non-2xx class proves the rule is a status-range contract rather than a special case for 500.",
        defectCaught:
          "Checking only server errors can accidentally decode client-error responses.",
      },
    ],
  },
  {
    id: "test-design:ios-decode-failure-separate",
    revision: 1,
    lane: "ios",
    inputFormat: "call-arguments",
    observationKind: "error",
    executionPolicy: "design-only",
    itemId: "ios:network-decode-cache-policy",
    itemRevision: 2,
    skillId: "ios-network-boundaries",
    skillLabel: "iOS network boundary contracts",
    title: "Decoding Failure Stays Distinct",
    prompt:
      "Design a response proving valid HTTP success with an invalid model body surfaces a decoding failure rather than a default model.",
    constraint:
      "A 2xx response reaches the decoder exactly once, and schema mismatch remains distinguishable from transport and HTTP failures.",
    primaryPurpose: "adversarial",
    hint: "Use status 200 but give one required field the wrong JSON type.",
    referenceCases: [
      {
        id: "wrong-id-type",
        purpose: "adversarial",
        input:
          '{"transport":"success","status":200,"body":{"id":"not-an-int","name":"Mina"}}',
        expected:
          '{"outcome":"throws","error":{"category":"decoding"},"decoderCalls":1}',
        rationale:
          "One wrong field type isolates model-schema validation after HTTP success.",
        defectCaught:
          "Swallowing the decoder error or manufacturing a default model hides corrupted response data.",
      },
      {
        id: "missing-required-name",
        purpose: "boundary",
        input:
          '{"transport":"success","status":200,"body":{"id":7}}',
        expected:
          '{"outcome":"throws","error":{"category":"decoding"},"decoderCalls":1}',
        rationale:
          "An omitted required key checks a second decoding failure shape without changing transport or status.",
        defectCaught:
          "Optionalizing or defaulting required fields can turn incomplete payloads into misleading success.",
      },
    ],
  },
  {
    id: "test-design:ios-loader-argument",
    revision: 1,
    lane: "ios",
    inputFormat: "call-arguments",
    observationKind: "value",
    executionPolicy: "design-only",
    itemId: "ios:dependency-injected-test",
    itemRevision: 2,
    skillId: "ios-test-seams",
    skillLabel: "iOS dependency test seams",
    title: "Injected Loader Receives the Requested ID",
    prompt:
      "Design a baseline test proving the feature calls its injected loader with the requested identifier and uses the returned user.",
    constraint:
      "The dependency is observable without real networking, and the greeting is derived from the stub result.",
    primaryPurpose: "baseline",
    hint: "Record arguments in a closure stub and return a name that would reveal a hard-coded greeting.",
    referenceCases: [
      {
        id: "loader-observes-seven",
        purpose: "baseline",
        input: '{"requestedID":7,"stubUser":{"id":7,"name":"Mina"}}',
        expected: '{"observedLoaderIDs":[7],"result":"Welcome, Mina!"}',
        rationale:
          "A nondefault ID and distinctive name jointly prove argument forwarding and result use.",
        defectCaught:
          "A hard-coded ID, concrete network call, or ignored returned name breaks the observable seam.",
      },
      {
        id: "loader-observes-another-id",
        purpose: "regression",
        input: '{"requestedID":42,"stubUser":{"id":42,"name":"Lee"}}',
        expected: '{"observedLoaderIDs":[42],"result":"Welcome, Lee!"}',
        rationale:
          "A second ID prevents an implementation tailored to the first fixture from appearing injected.",
        defectCaught:
          "Caching or hard-coding the first request can return the wrong user for later inputs.",
      },
    ],
  },
  {
    id: "test-design:ios-loader-error-forwarding",
    revision: 1,
    lane: "ios",
    inputFormat: "call-arguments",
    observationKind: "error",
    executionPolicy: "design-only",
    itemId: "ios:dependency-injected-test",
    itemRevision: 2,
    skillId: "ios-test-seams",
    skillLabel: "iOS dependency test seams",
    title: "Injected Failure Is Forwarded",
    prompt:
      "Design a regression test proving dependency failure is propagated and no success greeting is produced.",
    constraint:
      "The feature preserves the loader's failure semantics instead of replacing the error with successful placeholder output.",
    primaryPurpose: "regression",
    hint: "Make the stub throw a recognizable error and observe both the thrown value and absence of output.",
    referenceCases: [
      {
        id: "offline-forwarded",
        purpose: "regression",
        input: '{"requestedID":7,"stubOutcome":{"throws":"offline"}}',
        expected:
          '{"outcome":"throws","error":"offline","greetingProduced":false}',
        rationale:
          "A named stub failure makes accidental replacement or swallowing immediately visible.",
        defectCaught:
          "Catching dependency errors and returning a greeting produces misleading success while offline.",
      },
      {
        id: "unauthorized-forwarded",
        purpose: "adversarial",
        input:
          '{"requestedID":42,"stubOutcome":{"throws":"unauthorized"}}',
        expected:
          '{"outcome":"throws","error":"unauthorized","greetingProduced":false}',
        rationale:
          "A second error identity proves forwarding is general and not a special-case branch for offline.",
        defectCaught:
          "Mapping every dependency failure to one fallback erases actionable error semantics.",
      },
    ],
  },
  {
    id: "test-design:ios-rating-upper-bound",
    revision: 1,
    lane: "ios",
    inputFormat: "event-sequence",
    observationKind: "state-transition",
    executionPolicy: "design-only",
    itemId: "ios:accessible-rating-control",
    itemRevision: 2,
    skillId: "ios-accessibility-behavior",
    skillLabel: "iOS accessibility behavior",
    title: "Adjustable Rating Clamps and Announces",
    prompt:
      "Design a boundary interaction proving an accessibility adjustment clamps the rating and announces the resulting value consistently.",
    constraint:
      "Increment and decrement actions keep rating within 1 through 5, and accessibilityValue reflects the final state.",
    primaryPurpose: "boundary",
    hint: "Increment while already at the maximum, then observe both model value and spoken value.",
    referenceCases: [
      {
        id: "increment-at-five",
        purpose: "boundary",
        input: '{"initialRating":5,"adjustment":"increment"}',
        expected: '{"finalRating":5,"accessibilityValue":"5 of 5"}',
        rationale:
          "Acting at the upper endpoint exposes missing clamping without requiring multiple gestures.",
        defectCaught:
          "An unchecked increment creates rating 6 or leaves the accessibility announcement inconsistent with state.",
      },
      {
        id: "decrement-at-one",
        purpose: "boundary",
        input: '{"initialRating":1,"adjustment":"decrement"}',
        expected: '{"finalRating":1,"accessibilityValue":"1 of 5"}',
        rationale:
          "The symmetric lower endpoint verifies both adjustment directions honor the same range contract.",
        defectCaught:
          "An unchecked decrement creates rating 0 or announces a value different from the control state.",
      },
    ],
  },
  {
    id: "test-design:ios-rating-single-element",
    revision: 1,
    lane: "ios",
    inputFormat: "event-sequence",
    observationKind: "accessibility-tree",
    executionPolicy: "design-only",
    itemId: "ios:accessible-rating-control",
    itemRevision: 2,
    skillId: "ios-accessibility-behavior",
    skillLabel: "iOS accessibility behavior",
    title: "Rating Is One Adjustable Element",
    prompt:
      "Design an accessibility-tree inspection proving the rating is exposed as one labeled adjustable control rather than five ambiguous children.",
    constraint:
      "The container communicates label, current value, and adjustable behavior while decorative star children stay hidden.",
    primaryPurpose: "baseline",
    hint: "Inspect the accessible elements and assert the user-facing semantics, not an internal identifier.",
    referenceCases: [
      {
        id: "single-element-at-three",
        purpose: "baseline",
        input: '{"rating":3,"inspection":"accessible-elements"}',
        expected:
          '{"elementCount":1,"label":"Rating","value":"3 of 5","adjustable":true,"childStarsExposed":false}',
        rationale:
          "A middle value makes label, value, trait, and child grouping observable in one compact inspection.",
        defectCaught:
          "Exposing five unlabeled stars or using a test identifier as the spoken label creates an ambiguous control.",
      },
      {
        id: "single-element-at-five",
        purpose: "regression",
        input: '{"rating":5,"inspection":"accessible-elements"}',
        expected:
          '{"elementCount":1,"label":"Rating","value":"5 of 5","adjustable":true,"childStarsExposed":false}',
        rationale:
          "The maximum value confirms grouping remains stable while the dynamic announcement changes.",
        defectCaught:
          "A fixed accessibilityValue or conditional child exposure can make the tree disagree with the visible rating.",
      },
    ],
  },
];
