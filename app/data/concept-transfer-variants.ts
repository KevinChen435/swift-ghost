import type { FundamentalsPattern } from "./fundamentals";

export type ConceptTransferLane = "swift" | "ios";

export type ConceptTransferVariant = {
  id: `concept-transfer:${string}`;
  revision: 1;
  lane: ConceptTransferLane;
  family: FundamentalsPattern;
  sourceItemIds: [`ios:${string}`, ...`ios:${string}`[]];
  neutralLabel: string;
  revealedTitle: string;
  scenario: string;
  constraints: string[];
  estimatedMinutes: number;
  predictionPrompt: string;
  reconstructionPrompt: string;
  referenceSnippet: string;
  tradeoffPrompt: string;
  hints: [string, string, string];
  review: {
    patternLabel: string;
    invariant: string;
    criteria: [string, string, string, ...string[]];
    contrast: string;
    teachBack: string;
  };
};

export const CONCEPT_TRANSFER_VARIANTS = [
  {
    id: "concept-transfer:ct-01",
    revision: 1,
    lane: "swift",
    family: "Swift Semantics",
    sourceItemIds: ["ios:value-reference-snapshots", "ios:copy-on-write-draft"],
    neutralLabel: "Language reconstruction 01",
    revealedTitle: "Snapshot a Ledger Without Aliasing Its Owner",
    scenario:
      "A checkout preview may edit its line items, but the live cart object must keep its identity and contents.",
    constraints: [
      "The live object is supplied by the caller.",
      "The preview begins with the same line items.",
      "Appending to the preview must not change the live object.",
    ],
    estimatedMinutes: 7,
    predictionPrompt:
      "Predict which observations change after one item is appended to the preview.",
    reconstructionPrompt:
      "Reconstruct a function that returns a separately owned preview with an editable snapshot.",
    referenceSnippet: `struct CartSnapshot {
    var items: [String]
}
final class Cart {
    var snapshot: CartSnapshot
    init(snapshot: CartSnapshot) { self.snapshot = snapshot }
}
func preview(of live: Cart) -> Cart {
    Cart(snapshot: live.snapshot)
}`,
    tradeoffPrompt:
      "When would sharing the original object's identity be preferable to making this boundary?",
    hints: [
      "Separate the identity that stays live from the data that may diverge.",
      "An assignment of the outer object and an assignment of its stored value have different effects.",
      "Create a new outer instance initialized from the stored value.",
    ],
    review: {
      patternLabel: "Value snapshot across a reference boundary",
      invariant:
        "The preview and live cart have different identities, while their initial item values are equal and may later diverge.",
      criteria: [
        "Creates a distinct Cart instance.",
        "Copies the snapshot value into the new owner.",
        "Does not mutate the caller's object during construction.",
        "Explains observable value behavior without relying on storage implementation details.",
      ],
      contrast:
        "Copying the Cart variable would preserve one shared identity; copying its value-typed snapshot into a new Cart establishes the intended mutation boundary.",
      teachBack:
        "Why does copying the stored snapshot matter even though its array may initially share backing storage?",
    },
  },
  {
    id: "concept-transfer:ct-02",
    revision: 1,
    lane: "swift",
    family: "Optionals & Errors",
    sourceItemIds: ["ios:optional-throwing-boundary"],
    neutralLabel: "Language reconstruction 02",
    revealedTitle: "Preserve Missing and Invalid Token Failures",
    scenario:
      "A launch configuration may omit a token or provide one that is present but too short.",
    constraints: [
      "Absence and invalid text are distinct outcomes.",
      "A usable token contains at least eight characters.",
      "No force unwrap or failure-erasing conversion is allowed.",
    ],
    estimatedMinutes: 6,
    predictionPrompt:
      "Predict the returned or thrown outcome for an absent, short, and usable value.",
    reconstructionPrompt:
      "Reconstruct the boundary so each failure retains enough information for its caller.",
    referenceSnippet: `enum TokenError: Error {
    case missing
    case tooShort(String)
}
func token(in values: [String: String]) throws -> String {
    guard let raw = values["token"] else { throw TokenError.missing }
    guard raw.count >= 8 else { throw TokenError.tooShort(raw) }
    return raw
}`,
    tradeoffPrompt:
      "When would collapsing every failure to nil be an acceptable caller-facing contract?",
    hints: [
      "Treat the dictionary lookup and the domain check as separate decisions.",
      "Use one early exit for absence and another for invalid content.",
      "Carry the rejected text in the invalid case.",
    ],
    review: {
      patternLabel: "Optional lookup followed by typed failure",
      invariant:
        "The function returns only a usable token and never merges an absent key with a present invalid value.",
      criteria: [
        "Binds the optional without forcing it.",
        "Uses distinct error cases for absence and invalidity.",
        "Returns only after the length constraint succeeds.",
      ],
      contrast:
        "An optional alone can represent absence, while a thrown domain error preserves why a present operation could not produce a valid result.",
      teachBack:
        "What caller decision becomes impossible if this function uses try? at the boundary?",
    },
  },
  {
    id: "concept-transfer:ct-03",
    revision: 1,
    lane: "swift",
    family: "Protocols & Generics",
    sourceItemIds: ["ios:generic-associated-id"],
    neutralLabel: "Language reconstruction 03",
    revealedTitle: "Keep a Repository's Key and Model Coupled",
    scenario:
      "A reusable indexing helper must return a dictionary whose key type follows the concrete model type.",
    constraints: [
      "Different model types may choose different key types.",
      "Keys must be usable in a dictionary.",
      "A repeated key keeps the later model.",
    ],
    estimatedMinutes: 8,
    predictionPrompt:
      "Predict the concrete return type for a model whose key is UUID.",
    reconstructionPrompt:
      "Reconstruct the contract and helper while preserving the model-to-key relationship.",
    referenceSnippet: `protocol KeyedModel {
    associatedtype Key: Hashable
    var key: Key { get }
}
func indexed<Model: KeyedModel>(
    _ models: [Model]
) -> [Model.Key: Model] {
    Dictionary(models.map { ($0.key, $0) }, uniquingKeysWith: { _, new in new })
}`,
    tradeoffPrompt:
      "What flexibility would an erased heterogeneous collection add, and what relationship would it hide?",
    hints: [
      "The output type needs information selected by the conforming model.",
      "Declare a nested placeholder type constrained for dictionary keys.",
      "Reference that placeholder through the generic model in the return type.",
    ],
    review: {
      patternLabel: "Associated-type relationship preserved by a generic",
      invariant:
        "Every entry uses the exact key type declared by the same concrete model type stored as its value.",
      criteria: [
        "Declares a Hashable associated key type.",
        "Constrains one concrete generic model type.",
        "Returns Model.Key mapped to Model.",
        "Defines deterministic duplicate-key behavior.",
      ],
      contrast:
        "A generic keeps one concrete conformance and its associated type connected; broad erasure is useful for heterogeneity but weakens this precise result type.",
      teachBack:
        "Why can the compiler express this dictionary result for a generic parameter more precisely than for unrelated erased values?",
    },
  },
  {
    id: "concept-transfer:ct-04",
    revision: 1,
    lane: "swift",
    family: "Memory Management",
    sourceItemIds: ["ios:weak-stored-closure"],
    neutralLabel: "Language reconstruction 04",
    revealedTitle: "End an Observer Cycle at the Capture",
    scenario:
      "A coordinator owns an event source, and the source stores a callback that updates the coordinator.",
    constraints: [
      "The callback may run after the coordinator is gone.",
      "The source stores the callback strongly.",
      "A late event must be harmless.",
    ],
    estimatedMinutes: 7,
    predictionPrompt:
      "Predict the ownership graph and deallocation behavior with a default capture.",
    reconstructionPrompt:
      "Reconstruct callback wiring that follows the stated lifetime relationship.",
    referenceSnippet: `final class EventSource {
    var onEvent: (() -> Void)?
}
final class Coordinator {
    let source: EventSource
    private(set) var count = 0
    init(source: EventSource) {
        self.source = source
        source.onEvent = { [weak self] in self?.count += 1 }
    }
}`,
    tradeoffPrompt:
      "What stronger lifetime proof would be required before choosing an unowned capture?",
    hints: [
      "Draw every strong edge, including the callback's captures.",
      "The callback cannot assume its updater still exists when invoked.",
      "Capture the updater as an optional nonowning reference.",
    ],
    review: {
      patternLabel: "Weak capture for an owner-retained callback",
      invariant:
        "The stored callback never extends the coordinator's lifetime and safely does nothing after deallocation.",
      criteria: [
        "Identifies the owner-source-closure cycle.",
        "Uses a weak capture rather than a default strong capture.",
        "Handles the optional owner at callback time.",
        "Explains why unowned is not justified by the scenario.",
      ],
      contrast:
        "Weak models a callback that may outlive its target; unowned removes optional handling only when a stronger lifetime guarantee makes post-deallocation invocation impossible.",
      teachBack:
        "Which exact strong references form the cycle when the capture list is removed?",
    },
  },
  {
    id: "concept-transfer:ct-05",
    revision: 1,
    lane: "swift",
    family: "Concurrency",
    sourceItemIds: ["ios:async-let-dashboard"],
    neutralLabel: "Language reconstruction 05",
    revealedTitle: "Join Independent Summary Requests",
    scenario:
      "A report requires two independent remote values before it can be returned.",
    constraints: [
      "Neither request consumes the other's result.",
      "Both operations belong to one parent call.",
      "The report is returned only after both succeed.",
    ],
    estimatedMinutes: 8,
    predictionPrompt:
      "Predict the dependency graph, completion boundary, and failure propagation.",
    reconstructionPrompt:
      "Reconstruct the parent operation so independent latency overlaps within a bounded lifetime.",
    referenceSnippet: `struct Summary: Sendable {
    let balance: Int
    let alerts: [String]
}
func loadSummary(api: some SummaryAPI) async throws -> Summary {
    async let balance = api.balance()
    async let alerts = api.alerts()
    return try await Summary(balance: balance, alerts: alerts)
}`,
    tradeoffPrompt:
      "How would the structure change if the second request required a value from the first?",
    hints: [
      "Represent the two requests as siblings under the same parent.",
      "Start both before awaiting either result.",
      "Join both child values when constructing the return value.",
    ],
    review: {
      patternLabel: "Structured sibling tasks with an explicit join",
      invariant:
        "Both children remain within the parent scope, and the result is constructed only from two successful child values.",
      criteria: [
        "Starts independent work before the join.",
        "Uses structured child tasks rather than detached work.",
        "Awaits both results when constructing the summary.",
        "Describes cooperative cancellation without claiming immediate termination.",
      ],
      contrast:
        "Sequential awaits impose an unnecessary dependency, while detached tasks weaken the lifetime and error relationship supplied by structured children.",
      teachBack:
        "What property of the dependency graph makes sibling child tasks appropriate here?",
    },
  },
  {
    id: "concept-transfer:ct-06",
    revision: 1,
    lane: "swift",
    family: "Concurrency",
    sourceItemIds: ["ios:actor-response-cache"],
    neutralLabel: "Language reconstruction 06",
    revealedTitle: "Serialize Inventory Mutation Behind an Actor",
    scenario:
      "Several tasks read and update one in-memory count table.",
    constraints: [
      "The table is mutable and shared across callers.",
      "Keys and values cross the isolation boundary.",
      "No external lock is exposed.",
    ],
    estimatedMinutes: 7,
    predictionPrompt:
      "Predict which calls may suspend and which state is protected from overlapping mutation.",
    reconstructionPrompt:
      "Reconstruct a small isolated owner for reading and incrementing counts.",
    referenceSnippet: `actor Inventory<Key: Hashable & Sendable> {
    private var counts: [Key: Int] = [:]
    func count(for key: Key) -> Int {
        counts[key, default: 0]
    }
    func add(_ amount: Int, for key: Key) {
        counts[key, default: 0] += amount
    }
}`,
    tradeoffPrompt:
      "When would immutable snapshots or task-local ownership be simpler than this boundary?",
    hints: [
      "Put the shared mutable table inside one language-level isolation domain.",
      "Keep storage private and expose operations rather than the dictionary itself.",
      "Constrain the key so it can cross tasks and serve as a dictionary key.",
    ],
    review: {
      patternLabel: "Actor-isolated mutable state",
      invariant:
        "All accesses to the count table occur through the actor's isolation, and values crossing that boundary satisfy the declared contract.",
      criteria: [
        "Uses an actor as the state owner.",
        "Keeps mutable storage private.",
        "Applies Hashable and Sendable constraints to the key.",
        "Does not claim the actor owns a dedicated thread.",
      ],
      contrast:
        "An actor serializes access to its isolated state; it is a semantic isolation boundary, not a promise about which operating-system thread performs each call.",
      teachBack:
        "Why does awaiting a cross-actor call say something about suspension but not thread affinity?",
    },
  },
  {
    id: "concept-transfer:ct-07",
    revision: 1,
    lane: "ios",
    family: "UIKit",
    sourceItemIds: ["ios:uikit-cell-registration"],
    neutralLabel: "Application reconstruction 01",
    revealedTitle: "Reset Every Reused Badge Cell Property",
    scenario:
      "A scrolling list reuses one cell for rows that may or may not show a status badge.",
    constraints: [
      "Every dequeue may receive a different model.",
      "Text and badge visibility both depend on the current model.",
      "No visible property may depend on the previous row.",
    ],
    estimatedMinutes: 8,
    predictionPrompt:
      "Predict the final cell after a badged row is followed by an unbadged row.",
    reconstructionPrompt:
      "Reconstruct configuration that fully derives visible state from the current model.",
    referenceSnippet: `let registration = UICollectionView.CellRegistration<UICollectionViewListCell, Row> {
    cell, _, row in
    var content = cell.defaultContentConfiguration()
    content.text = row.name
    content.secondaryText = row.hasBadge ? "New" : nil
    cell.contentConfiguration = content
    cell.accessories = row.hasBadge ? [.checkmark()] : []
}`,
    tradeoffPrompt:
      "What does a registration simplify compared with scattered conditional mutations after dequeue?",
    hints: [
      "Assume the cell begins with arbitrary visible state.",
      "Assign both the affirmative and negative form of every model-dependent property.",
      "Build a complete content configuration and replace the accessories array each time.",
    ],
    review: {
      patternLabel: "Total configuration at a reuse boundary",
      invariant:
        "After configuration, every model-dependent visible property is determined only by the current row.",
      criteria: [
        "Writes current text for every dequeue.",
        "Clears secondary text for the negative state.",
        "Replaces accessories for both states.",
        "Does not rely on prepareForReuse as the sole correctness boundary.",
      ],
      contrast:
        "Resetting in prepareForReuse can be defensive, but total configuration is the local proof that each rendered model replaces all stale row state.",
      teachBack:
        "Why is an affirmative-only assignment incorrect even if prepareForReuse usually runs?",
    },
  },
  {
    id: "concept-transfer:ct-08",
    revision: 1,
    lane: "ios",
    family: "SwiftUI",
    sourceItemIds: ["ios:swiftui-owned-observable-state"],
    neutralLabel: "Application reconstruction 02",
    revealedTitle: "Keep Form State at a Stable View Identity",
    scenario:
      "A form owns an editable reference model and delegates fields to a child view.",
    constraints: [
      "User edits survive body reevaluation for one owner identity.",
      "The child needs bindings into the same model.",
      "Replacing the owner identity may create fresh state.",
    ],
    estimatedMinutes: 8,
    predictionPrompt:
      "Predict the model identity and edited value after a body reevaluation.",
    reconstructionPrompt:
      "Reconstruct the ownership and binding handoff between the two views.",
    referenceSnippet: `@Observable final class FormModel { var email = "" }
struct FormScreen: View {
    @State private var model = FormModel()
    var body: some View { FormFields(model: model) }
}
struct FormFields: View {
    @Bindable var model: FormModel
    var body: some View { TextField("Email", text: $model.email) }
}`,
    tradeoffPrompt:
      "How would the ownership contract differ if a parent injected the source of truth?",
    hints: [
      "The owner needs storage associated with its stable identity, outside transient body values.",
      "The child borrows the reference but needs projected bindings.",
      "Use owned state in the parent and a bindable view of that model in the child.",
    ],
    review: {
      patternLabel: "Stable state ownership with a bindable child",
      invariant:
        "One owner identity stores one model reference, and the child edits that exact source of truth.",
      criteria: [
        "Creates the model in owned state.",
        "Passes the same reference to the child.",
        "Uses a bindable projection where fields need bindings.",
        "Relates state lifetime to view identity rather than body call count.",
      ],
      contrast:
        "Creating the model as a transient body value risks replacement, while injected state changes which view owns initialization and lifetime.",
      teachBack:
        "What does stable view identity preserve, and what event can legitimately reset the stored model?",
    },
  },
  {
    id: "concept-transfer:ct-09",
    revision: 1,
    lane: "ios",
    family: "Networking",
    sourceItemIds: ["ios:cancellable-search", "ios:network-decode-cache-policy"],
    neutralLabel: "Application reconstruction 03",
    revealedTitle: "Publish Only the Latest Image Request",
    scenario:
      "A rapidly changing selection starts remote loads whose responses can finish out of order.",
    constraints: [
      "A new selection supersedes earlier work.",
      "Cancellation is cooperative.",
      "Only current noncancelled work may update visible data.",
    ],
    estimatedMinutes: 10,
    predictionPrompt:
      "Predict visible data when the oldest request completes after the newest request.",
    reconstructionPrompt:
      "Reconstruct latest-selection-wins task management and the final publication guard.",
    referenceSnippet: `@MainActor final class ImageModel {
    private var loadTask: Task<Void, Never>?
    private(set) var data: Data?
    func select(_ url: URL, client: ImageClient) {
        loadTask?.cancel()
        loadTask = Task {
            guard let next = try? await client.data(from: url) else { return }
            guard !Task.isCancelled else { return }
            data = next
        }
    }
}`,
    tradeoffPrompt:
      "What additional identity check could protect publication if a dependency ignores cancellation?",
    hints: [
      "Keep a handle to the work made obsolete by the next selection.",
      "Cancel the prior handle before starting a replacement.",
      "Check cooperative cancellation immediately before publishing to visible state.",
    ],
    review: {
      patternLabel: "Latest request wins with cooperative cancellation",
      invariant:
        "Visible data is assigned only by work that has not been superseded when it reaches the publication boundary.",
      criteria: [
        "Stores the active task handle.",
        "Cancels prior work when selection changes.",
        "Checks cancellation after the awaited dependency returns.",
        "Publishes state through the intended isolation boundary.",
      ],
      contrast:
        "Calling cancel expresses intent; a cancellation-aware suspension or an explicit check is still needed because arbitrary dependencies are not forcibly stopped.",
      teachBack:
        "Why is checking cancellation only before the remote call insufficient for out-of-order completion?",
    },
  },
  {
    id: "concept-transfer:ct-10",
    revision: 1,
    lane: "ios",
    family: "Architecture & Testing",
    sourceItemIds: ["ios:dependency-injected-test"],
    neutralLabel: "Application reconstruction 04",
    revealedTitle: "Inject Time Through a Narrow Test Seam",
    scenario:
      "A greeting changes by hour, and a unit test must remain deterministic without changing the system clock.",
    constraints: [
      "Production code may read real time.",
      "The test controls the observed date.",
      "The feature depends only on obtaining the current date.",
    ],
    estimatedMinutes: 8,
    predictionPrompt:
      "Predict which input the unit test must control to cover the morning branch reliably.",
    reconstructionPrompt:
      "Reconstruct the smallest injectable contract and a feature that consumes it.",
    referenceSnippet: `protocol DateProviding { var now: Date { get } }
struct SystemDate: DateProviding { var now: Date { Date() } }
struct Greeting {
    let clock: any DateProviding
    let calendar: Calendar
    func text() -> String {
        calendar.component(.hour, from: clock.now) < 12
            ? "Good morning" : "Good afternoon"
    }
}`,
    tradeoffPrompt:
      "Why is injecting a broad service container less precise than this dependency?",
    hints: [
      "Identify the nondeterministic value rather than the concrete framework that supplies it.",
      "Expose that one value through a tiny protocol.",
      "Inject both the time source and calendar used to interpret it.",
    ],
    review: {
      patternLabel: "Narrow dependency seam for deterministic time",
      invariant:
        "The feature derives its result only from injected date and calendar inputs, so a test controls every relevant condition.",
      criteria: [
        "Abstracts the current date behind a small contract.",
        "Injects the calendar rather than relying on ambient interpretation.",
        "Keeps real time in the production implementation.",
        "Does not claim the unit test proves operating-system clock behavior.",
      ],
      contrast:
        "A narrow seam documents the value the feature needs; a large service locator obscures dependencies and gives tests more power than this behavior requires.",
      teachBack:
        "Which behavior does the deterministic unit test establish, and which integration behavior remains outside its evidence?",
    },
  },
  {
    id: "concept-transfer:ct-11",
    revision: 1,
    lane: "ios",
    family: "Accessibility",
    sourceItemIds: ["ios:accessible-rating-control"],
    neutralLabel: "Application reconstruction 05",
    revealedTitle: "Expose Volume as One Adjustable Element",
    scenario:
      "A custom row of visual bars changes a bounded level and must work without direct touch.",
    constraints: [
      "The level remains between zero and ten.",
      "Assistive technology receives a name, current value, and adjustment action.",
      "Decorative children do not become ambiguous separate controls.",
    ],
    estimatedMinutes: 9,
    predictionPrompt:
      "Predict the accessible element and value after an increment at the upper boundary.",
    reconstructionPrompt:
      "Reconstruct the semantic modifiers and bounded adjustment behavior.",
    referenceSnippet: `Bars(level: level)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Volume")
    .accessibilityValue("\\(level) of 10")
    .accessibilityAdjustableAction { direction in
        switch direction {
        case .increment: level = min(10, level + 1)
        case .decrement: level = max(0, level - 1)
        @unknown default: break
        }
    }`,
    tradeoffPrompt:
      "When would exposing several meaningful child controls be better than combining them?",
    hints: [
      "Describe the control as a user perceives it, not as its decorative pieces are drawn.",
      "Combine the children and provide a dynamic spoken value.",
      "Handle both adjustment directions with explicit endpoint clamping.",
    ],
    review: {
      patternLabel: "Combined adjustable accessibility control",
      invariant:
        "Touch and assistive adjustments preserve the same bounded value, and the accessible announcement reflects that value.",
      criteria: [
        "Combines or hides decorative child semantics.",
        "Provides a user-facing label and dynamic value.",
        "Implements increment and decrement actions.",
        "Clamps both endpoints.",
      ],
      contrast:
        "An automation identifier is a testing hook, while label, value, and actions form the user-facing semantic contract.",
      teachBack:
        "Why can a row that looks obvious visually still be unusable when exposed as separate unlabeled children?",
    },
  },
  {
    id: "concept-transfer:ct-12",
    revision: 1,
    lane: "ios",
    family: "UIKit",
    sourceItemIds: ["ios:uikit-lifecycle-boundaries", "ios:swiftui-typed-navigation"],
    neutralLabel: "Application reconstruction 06",
    revealedTitle: "Restore a Scene Draft at the State Boundary",
    scenario:
      "Each window keeps an editable draft that should survive disconnection and later restoration without being stored in a view controller.",
    constraints: [
      "Multiple scenes may exist at once.",
      "Restoration uses a stable scene identifier.",
      "The view controller renders state but does not own durable restoration data.",
    ],
    estimatedMinutes: 10,
    predictionPrompt:
      "Predict where two simultaneous windows must diverge and which identifier reconnects each draft.",
    reconstructionPrompt:
      "Reconstruct a small scene-scoped store and the connection lookup boundary.",
    referenceSnippet: `final class SceneDraftStore {
    private var drafts: [String: String] = [:]
    func draft(for session: UISceneSession) -> String {
        drafts[session.persistentIdentifier, default: ""]
    }
    func save(_ text: String, for session: UISceneSession) {
        drafts[session.persistentIdentifier] = text
    }
}`,
    tradeoffPrompt:
      "Which durability requirement would require replacing this in-memory store with persistent storage?",
    hints: [
      "The lifetime belongs to a window session, not to one rendered controller instance.",
      "Use the platform-provided stable session identity as the lookup key.",
      "Keep reading and saving behind a scene-scoped data owner.",
    ],
    review: {
      patternLabel: "Scene-scoped state keyed by persistent identity",
      invariant:
        "Every scene reads and writes only the draft associated with its stable session identifier.",
      criteria: [
        "Keys state by persistent scene identity.",
        "Keeps simultaneous scene values separate.",
        "Separates the state owner from a particular view controller instance.",
        "Distinguishes reconnection from guaranteed process-level durability.",
      ],
      contrast:
        "Controller-owned text follows a replaceable presentation object, while scene-scoped state follows the window identity; disk persistence is a separate durability decision.",
      teachBack:
        "Why is a view controller reference the wrong restoration key when a scene disconnects and reconnects?",
    },
  },
] as const satisfies readonly ConceptTransferVariant[];
