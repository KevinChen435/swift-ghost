export type FundamentalsDifficulty = "Easy" | "Medium";

export type FundamentalsPattern =
  | "Swift Semantics"
  | "Optionals & Errors"
  | "Protocols & Generics"
  | "Memory Management"
  | "Concurrency"
  | "UIKit"
  | "SwiftUI"
  | "Networking"
  | "Architecture & Testing"
  | "Accessibility";

export type FundamentalsPracticeItem = {
  id: `ios:${string}`;
  track: "ios";
  title: string;
  slug: string;
  difficulty: FundamentalsDifficulty;
  pattern: FundamentalsPattern;
  summary: string;
  prompt: string;
  cue: string;
  invariant: string;
  complexity: string;
  swiftNote: string;
  estimatedMinutes: number;
  code: string;
  sourceUrl: string;
  tags: string[];
  recallChecks: [string, string, string];
  conceptAnswers: [string, string, string];
};

export const FUNDAMENTALS: FundamentalsPracticeItem[] = [
  {
    id: "ios:value-reference-snapshots",
    track: "ios",
    title: "Copy a Value, Share a Reference",
    slug: "value-reference-snapshots",
    difficulty: "Easy",
    pattern: "Swift Semantics",
    summary: "Create an independent settings snapshot without accidentally mutating a shared session.",
    prompt: "Implement a preview session whose settings can change without changing the live session.",
    cue: "A struct assignment copies a value; a class assignment shares an object identity.",
    invariant: "The preview and live sessions are distinct class instances, and each owns its own settings value.",
    complexity: "O(1) time · O(1) additional space",
    swiftNote: "Prefer structs for independent values and classes when shared identity is intentional.",
    estimatedMinutes: 4,
    code: `struct PlaybackSettings {
    var speed: Double
    var captionsEnabled: Bool
}

final class PlayerSession {
    var settings: PlaybackSettings

    init(settings: PlaybackSettings) {
        self.settings = settings
    }
}

func makePreview(from live: PlayerSession) -> PlayerSession {
    var previewSettings = live.settings
    previewSettings.speed = 1.5
    return PlayerSession(settings: previewSettings)
}`,
    sourceUrl: "https://developer.apple.com/documentation/swift/choosing-between-structures-and-classes",
    tags: ["struct", "class", "value semantics", "identity"],
    recallChecks: [
      "Predict what would happen if makePreview returned live after assigning it to another constant.",
      "Rebuild the copy boundary without looking at the code.",
      "Explain when identity makes a class the better model.",
    ],
    conceptAnswers: [
      "Both constants would reference the same PlayerSession, so changing the supposed preview's settings would also change the live session. A new constant does not create a copy of a class instance.",
      "Copy live.settings into a mutable local value, change that value, and pass it into a newly initialized PlayerSession. The boundary requires both a copied settings value and a distinct session identity.",
      "Use a class when shared identity, shared mutable state, or an identity-bound lifecycle is part of the model. The tradeoff is reference sharing, so ownership and mutation must be controlled deliberately.",
    ],
  },
  {
    id: "ios:copy-on-write-draft",
    track: "ios",
    title: "Mutate Independent Collection Copies",
    slug: "copy-on-write-draft",
    difficulty: "Easy",
    pattern: "Swift Semantics",
    summary: "Use a value type containing an array while preserving independent observable behavior after copying.",
    prompt: "Create mobile and desktop drafts from one original, then append a different paragraph to each copy.",
    cue: "Swift collections may share storage internally until mutation, but their public behavior remains value-like.",
    invariant: "Mutating either returned draft never changes the original or the other returned draft.",
    complexity: "O(n) total copy-on-write cost after both copies mutate · O(n) additional space",
    swiftNote: "Copy-on-write is an optimization; write code against value semantics rather than storage sharing.",
    estimatedMinutes: 5,
    code: `struct ArticleDraft {
    private(set) var paragraphs: [String]

    mutating func append(_ paragraph: String) {
        paragraphs.append(paragraph)
    }
}

func makePlatformDrafts(
    from original: ArticleDraft
) -> (mobile: ArticleDraft, desktop: ArticleDraft) {
    var mobile = original
    var desktop = original

    mobile.append("Read comfortably on a smaller screen.")
    desktop.append("Use the additional horizontal space.")

    return (mobile, desktop)
}`,
    sourceUrl: "https://docs.swift.org/swift-book/documentation/the-swift-programming-language/classesandstructures/",
    tags: ["array", "copy-on-write", "mutation", "value semantics"],
    recallChecks: [
      "Predict the three paragraph counts after this function returns.",
      "Reconstruct the two-copy mutation without aliasing mutable state.",
      "Explain why copy-on-write does not turn Array into a reference-semantic API.",
    ],
    conceptAnswers: [
      "If the original starts with n paragraphs, it still has n; mobile and desktop each have n + 1. Each mutation is observable only in the value that was mutated.",
      "Assign original to separate var values named mobile and desktop, then call append once on each before returning both. The invariant is that neither mutation can change the original or the other draft.",
      "Copy-on-write may share backing storage only as an implementation optimization, then separates storage when a copy mutates. Array still presents value semantics: mutations to one value are not observable through another.",
    ],
  },
  {
    id: "ios:optional-throwing-boundary",
    track: "ios",
    title: "Separate Absence From Invalid Input",
    slug: "optional-throwing-boundary",
    difficulty: "Easy",
    pattern: "Optionals & Errors",
    summary: "Use optional lookup for absence and a thrown domain error for invalid configuration.",
    prompt: "Parse a required TCP port from a dictionary without force-unwrapping or discarding the failure reason.",
    cue: "An optional answers whether a value exists; a thrown error explains why an operation failed.",
    invariant: "The function returns only a port in 1...65535 and reports missing and malformed values distinctly.",
    complexity: "O(k) time to parse k digits · O(1) additional space",
    swiftNote: "Avoid try? when callers need to distinguish domain failures.",
    estimatedMinutes: 5,
    code: `enum ConfigurationError: Error {
    case missingPort
    case invalidPort(String)
}

func port(from values: [String: String]) throws -> Int {
    guard let rawPort = values["port"] else {
        throw ConfigurationError.missingPort
    }

    guard let port = Int(rawPort), (1...65_535).contains(port) else {
        throw ConfigurationError.invalidPort(rawPort)
    }

    return port
}`,
    sourceUrl: "https://docs.swift.org/swift-book/documentation/the-swift-programming-language/errorhandling/",
    tags: ["optional binding", "guard", "throws", "domain errors"],
    recallChecks: [
      "Name the three possible outcomes before tracing the guards.",
      "Rebuild the function using two guard statements.",
      "Explain what information try? would erase at the call site.",
    ],
    conceptAnswers: [
      "A valid value returns a port in 1...65535, an absent key throws missingPort, and a non-integer or out-of-range value throws invalidPort with the original string. Absence and invalidity remain distinct outcomes.",
      "First guard-let the raw \"port\" string or throw missingPort; then guard that Int(rawPort) succeeds and the range contains it or throw invalidPort(rawPort). Return the validated Int only after both invariants hold.",
      "try? converts any thrown error into nil, collapsing missingPort and invalidPort into the same absence signal. That is concise when the reason is irrelevant, but it discards actionable domain information here.",
    ],
  },
  {
    id: "ios:generic-associated-id",
    track: "ios",
    title: "Index Records by an Associated ID",
    slug: "generic-associated-id",
    difficulty: "Medium",
    pattern: "Protocols & Generics",
    summary: "Preserve the concrete relationship between a record and its identifier through a generic constraint.",
    prompt: "Define an identifiable record protocol and build a type-safe dictionary keyed by each record's associated ID.",
    cue: "The caller chooses one concrete Record type, and its associated ID must be Hashable.",
    invariant: "Every dictionary entry uses the exact ID type declared by the record conformance; later duplicates replace earlier ones.",
    complexity: "O(n) expected time · O(n) space",
    swiftNote: "Use a generic constraint when the relationship between associated types matters to the result type.",
    estimatedMinutes: 7,
    code: `protocol IdentifiableRecord {
    associatedtype ID: Hashable
    var id: ID { get }
}

func indexByID<Record: IdentifiableRecord>(
    _ records: [Record]
) -> [Record.ID: Record] {
    var result: [Record.ID: Record] = [:]

    for record in records {
        result[record.id] = record
    }

    return result
}`,
    sourceUrl: "https://docs.swift.org/swift-book/documentation/the-swift-programming-language/generics/",
    tags: ["protocol", "associatedtype", "generic constraint", "Hashable"],
    recallChecks: [
      "State the relationship the return type must preserve.",
      "Reconstruct the protocol and generic signature from memory.",
      "Explain what type information would be harder to express with an unconstrained any IdentifiableRecord array.",
    ],
    conceptAnswers: [
      "The dictionary key must be the exact Record.ID associated with the concrete Record value, and the value must remain that same Record type. Repeated IDs overwrite earlier records because dictionary keys are unique.",
      "Declare IdentifiableRecord with associatedtype ID: Hashable and an id property, then write indexByID<Record: IdentifiableRecord>(_ records: [Record]) -> [Record.ID: Record]. The Hashable constraint is required because IDs become dictionary keys.",
      "An unconstrained array of any IdentifiableRecord erases the single concrete relationship between each record type and its associated ID, making a precise [Record.ID: Record] result unavailable. Existentials allow heterogeneity, while this generic API preserves type relationships.",
    ],
  },
  {
    id: "ios:weak-stored-closure",
    track: "ios",
    title: "Break a Stored-Closure Retain Cycle",
    slug: "weak-stored-closure",
    difficulty: "Medium",
    pattern: "Memory Management",
    summary: "Capture an owner weakly when the owner also retains an escaping callback.",
    prompt: "Wire a saved callback that updates its owning editor without preventing the editor from deallocating.",
    cue: "The owner strongly retains the closure, so a default strong capture of self would complete a cycle.",
    invariant: "The callback does nothing after the editor deallocates and never extends the editor's lifetime.",
    complexity: "O(1) time · O(1) additional space",
    swiftNote: "Choose weak from the ownership relationship; unowned is unsafe unless the owner is guaranteed to outlive the closure.",
    estimatedMinutes: 6,
    code: `final class DraftSaver {
    var didSave: (() -> Void)?

    func save() {
        didSave?()
    }
}

final class Editor {
    private let saver: DraftSaver
    private(set) var saveCount = 0

    init(saver: DraftSaver) {
        self.saver = saver
        saver.didSave = { [weak self] in
            self?.saveCount += 1
        }
    }
}`,
    sourceUrl: "https://docs.swift.org/swift-book/documentation/the-swift-programming-language/automaticreferencecounting/",
    tags: ["ARC", "closure", "capture list", "weak self"],
    recallChecks: [
      "Draw the reference cycle that exists without the capture list.",
      "Rebuild the callback with the correct ownership qualifier.",
      "Explain why using unowned here would change the failure mode.",
    ],
    conceptAnswers: [
      "Editor strongly owns DraftSaver, DraftSaver strongly owns didSave, and the closure would strongly capture Editor as self. Those edges form a cycle, so neither object can be released through ordinary reference counting.",
      "Assign saver.didSave = { [weak self] in self?.saveCount += 1 }. The weak optional capture breaks the ownership cycle and makes a late callback safely do nothing.",
      "unowned avoids the cycle but assumes self is alive whenever the closure executes; invoking it after Editor deallocation traps. weak trades optional handling for safety when the callback may outlive its owner.",
    ],
  },
  {
    id: "ios:async-let-dashboard",
    track: "ios",
    title: "Fetch Independent Data Concurrently",
    slug: "async-let-dashboard",
    difficulty: "Medium",
    pattern: "Concurrency",
    summary: "Use structured child tasks for two independent requests whose results build one screen model.",
    prompt: "Load a profile and messages concurrently, then await both results to create a dashboard.",
    cue: "Neither request depends on the other's result, and both belong to the lifetime of one parent operation.",
    invariant: "The function returns only after both child tasks succeed, and no child outlives the function's structured scope.",
    complexity: "O(max(profile latency, message latency)) wall-clock time · result-dependent space",
    swiftNote: "async let creates structured child tasks; awaiting a tuple keeps the join point explicit.",
    estimatedMinutes: 7,
    code: `struct Profile: Sendable {}
struct Message: Sendable {}

struct Dashboard: Sendable {
    let profile: Profile
    let messages: [Message]
}

protocol DashboardAPI: Sendable {
    func fetchProfile() async throws -> Profile
    func fetchMessages() async throws -> [Message]
}

func loadDashboard(using api: some DashboardAPI) async throws -> Dashboard {
    async let profile = api.fetchProfile()
    async let messages = api.fetchMessages()

    return try await Dashboard(
        profile: profile,
        messages: messages
    )
}`,
    sourceUrl: "https://docs.swift.org/swift-book/documentation/the-swift-programming-language/concurrency/",
    tags: ["async let", "structured concurrency", "Sendable", "parallel requests"],
    recallChecks: [
      "Identify the dependency graph before choosing async let.",
      "Reconstruct the child-task declarations and join point.",
      "Explain how error and cancellation propagate through this scope.",
    ],
    conceptAnswers: [
      "fetchProfile and fetchMessages are independent sibling operations, and Dashboard depends on both results. async let is appropriate because neither child needs the other's output and both must finish within the parent scope.",
      "Declare async let profile = api.fetchProfile() and async let messages = api.fetchMessages(), then construct the Dashboard with try await using both values. The explicit join preserves structured lifetime while overlapping the request latency.",
      "If an awaited child throws, the parent operation throws and unfinished sibling work is cancelled as the structured scope unwinds; cancellation remains cooperative. The scope cannot return while either child is still running.",
    ],
  },
  {
    id: "ios:actor-response-cache",
    track: "ios",
    title: "Isolate a Mutable Cache With an Actor",
    slug: "actor-response-cache",
    difficulty: "Medium",
    pattern: "Concurrency",
    summary: "Protect shared mutable cache state with actor isolation instead of manual locking.",
    prompt: "Build a generic actor-backed cache that safely reads, inserts, and removes values across tasks.",
    cue: "Several concurrent callers need one mutable dictionary, but only one isolated operation may access it at a time.",
    invariant: "All storage mutations occur on the actor, and values crossing its boundary are Sendable.",
    complexity: "O(1) expected time per operation · O(n) storage",
    swiftNote: "Cross-actor calls generally require await; an actor provides isolation, not a dedicated thread.",
    estimatedMinutes: 6,
    code: `actor ResponseCache<Key, Value>
where Key: Hashable & Sendable, Value: Sendable {
    private var storage: [Key: Value] = [:]

    func value(for key: Key) -> Value? {
        storage[key]
    }

    func insert(_ value: Value, for key: Key) {
        storage[key] = value
    }

    func removeValue(for key: Key) {
        storage[key] = nil
    }
}`,
    sourceUrl: "https://developer.apple.com/documentation/swift/actor",
    tags: ["actor", "isolation", "Sendable", "cache"],
    recallChecks: [
      "Name the mutable state that needs an isolation boundary.",
      "Rebuild the generic constraints and three actor methods.",
      "Explain why await does not promise a hop to a particular thread.",
    ],
    conceptAnswers: [
      "The shared mutable [Key: Value] dictionary needs the isolation boundary. Keeping it private to the actor ensures reads and mutations are serialized through actor isolation.",
      "Declare actor ResponseCache<Key, Value> where Key: Hashable & Sendable, Value: Sendable, then provide value(for:), insert(_:for:), and removeValue(for:). Sendable protects values crossing concurrency domains, while Hashable enables dictionary lookup.",
      "await marks a possible suspension while the actor's executor schedules isolated work; it does not bind that work to a named OS thread. Actor isolation guarantees serialized access, not thread affinity.",
    ],
  },
  {
    id: "ios:cancellable-search",
    track: "ios",
    title: "Cancel Stale Search Work",
    slug: "cancellable-search",
    difficulty: "Medium",
    pattern: "Concurrency",
    summary: "Keep only the newest search task and cooperate with cancellation before publishing results.",
    prompt: "Implement latest-query-wins search with debounce, cancellation, and main-actor state updates.",
    cue: "A new query makes the previous task's eventual result stale, but cancel() alone cannot forcibly stop arbitrary work.",
    invariant: "Only a noncancelled task for the latest submitted query may update visible results.",
    complexity: "O(1) task bookkeeping · service-dependent search cost",
    swiftNote: "Cancellation is cooperative; use cancellation-aware suspension points and Task.checkCancellation().",
    estimatedMinutes: 10,
    code: `import Foundation

protocol SearchService: Sendable {
    func results(for query: String) async throws -> [String]
}

@MainActor
final class SearchModel {
    private let service: any SearchService
    private var searchTask: Task<Void, Never>?
    private(set) var results: [String] = []

    init(service: any SearchService) {
        self.service = service
    }

    func search(for query: String) {
        searchTask?.cancel()
        searchTask = Task {
            do {
                try await Task.sleep(for: .milliseconds(300))
                let matches = try await service.results(for: query)
                try Task.checkCancellation()
                results = matches
            } catch is CancellationError {
                // A newer query replaced this work.
            } catch {
                guard !Task.isCancelled,
                      (error as? URLError)?.code != .cancelled else { return }
                results = []
            }
        }
    }

    deinit {
        searchTask?.cancel()
    }
}`,
    sourceUrl: "https://developer.apple.com/documentation/swift/task/cancel%28%29",
    tags: ["Task", "cancellation", "debounce", "MainActor"],
    recallChecks: [
      "Find both places where stale work is prevented from publishing.",
      "Rebuild the cancel-create-check sequence.",
      "Explain why cancel() is a signal rather than a forced interruption.",
    ],
    conceptAnswers: [
      "searchTask?.cancel() marks the previous query obsolete, and Task.checkCancellation() immediately before assignment prevents a stale completed request from publishing. Cancellation-aware sleep and service errors can stop work earlier, but the pre-publish check protects the visible-state invariant.",
      "Cancel the stored task, replace it with a new Task, debounce with an awaited sleep, await the service, call Task.checkCancellation(), and only then assign results. Keeping one task handle enforces latest-query-wins bookkeeping.",
      "cancel() only records cancellation and lets cooperative code observe it; it cannot safely terminate arbitrary execution. Suspension points, explicit checks, and cancellation-aware dependencies trade prompt stopping for structured cleanup and safety.",
    ],
  },
  {
    id: "ios:uikit-lifecycle-boundaries",
    track: "ios",
    title: "Place Work in the Right UIKit Lifecycle Hook",
    slug: "uikit-lifecycle-boundaries",
    difficulty: "Easy",
    pattern: "UIKit",
    summary: "Separate one-time hierarchy setup, per-appearance refresh, and geometry-dependent layer updates.",
    prompt: "Implement a view controller that builds once, refreshes each appearance, and sizes a gradient after layout.",
    cue: "UIKit may lay out a visible hierarchy many times, while viewDidLoad runs once per loaded view hierarchy.",
    invariant: "Subviews and constraints are installed once; data refreshes once per appearance; the gradient always matches current bounds.",
    complexity: "O(1) lifecycle work excluding the data refresh",
    swiftNote: "viewIsAppearing has current geometry and traits; viewDidLayoutSubviews may run repeatedly.",
    estimatedMinutes: 8,
    code: `import UIKit

final class ProfileViewController: UIViewController {
    private let titleLabel = UILabel()
    private let gradient = CAGradientLayer()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.layer.insertSublayer(gradient, at: 0)
        view.addSubview(titleLabel)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    override func viewIsAppearing(_ animated: Bool) {
        super.viewIsAppearing(animated)
        refreshProfile()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        gradient.frame = view.bounds
    }

    private func refreshProfile() {}
}`,
    sourceUrl: "https://developer.apple.com/documentation/uikit/displaying-and-managing-views-with-a-view-controller",
    tags: ["UIViewController", "lifecycle", "layout", "viewIsAppearing"],
    recallChecks: [
      "Classify each operation as one-time, per-appearance, or geometry-dependent.",
      "Reconstruct the three lifecycle overrides in order.",
      "Explain the bug caused by adding constraints inside viewDidLayoutSubviews.",
    ],
    conceptAnswers: [
      "Insert the gradient, add the label, and install constraints once in viewDidLoad; refresh data in viewIsAppearing; update gradient.frame in viewDidLayoutSubviews. The split prevents duplicate setup while keeping appearance data and geometry current.",
      "Override viewDidLoad for hierarchy and constraints, viewIsAppearing for refreshProfile(), and viewDidLayoutSubviews for gradient.frame = view.bounds, calling super in each. Their order reflects setup, appearance, then potentially repeated layout.",
      "viewDidLayoutSubviews may run many times, so adding constraints there repeatedly creates duplicates, warnings, and unnecessary layout work. Geometry may be updated there, but the constraint graph should normally be installed once.",
    ],
  },
  {
    id: "ios:uikit-adaptive-layout",
    track: "ios",
    title: "Build an Adaptive Empty State",
    slug: "uikit-adaptive-layout",
    difficulty: "Easy",
    pattern: "UIKit",
    summary: "Create a Dynamic Type-friendly view using layout margins and Auto Layout rather than fixed frames.",
    prompt: "Lay out a multiline title and message that adapt to content size and container width.",
    cue: "The intrinsic sizes change with text and accessibility settings, so constraints must describe relationships rather than pixels.",
    invariant: "Both labels remain inside the readable width and vertical margins, while the stack derives its height from intrinsic content sizes.",
    complexity: "O(1) view construction and constraints",
    swiftNote: "Use preferred text styles with adjustsFontForContentSizeCategory for Dynamic Type.",
    estimatedMinutes: 7,
    code: `import UIKit

final class EmptyStateView: UIView {
    private let titleLabel = UILabel()
    private let messageLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)

        titleLabel.font = .preferredFont(forTextStyle: .headline)
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.numberOfLines = 0

        messageLabel.font = .preferredFont(forTextStyle: .body)
        messageLabel.adjustsFontForContentSizeCategory = true
        messageLabel.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [titleLabel, messageLabel])
        stack.axis = .vertical
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        let centered = stack.centerYAnchor.constraint(equalTo: centerYAnchor)
        centered.priority = .defaultHigh

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: readableContentGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: readableContentGuide.trailingAnchor),
            stack.topAnchor.constraint(greaterThanOrEqualTo: layoutMarginsGuide.topAnchor),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: layoutMarginsGuide.bottomAnchor),
            centered,
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}`,
    sourceUrl: "https://developer.apple.com/documentation/uikit/view-layout",
    tags: ["Auto Layout", "Dynamic Type", "UIStackView", "layout margins"],
    recallChecks: [
      "Identify which intrinsic values can change at runtime.",
      "Rebuild the stack and its five adaptive constraints.",
      "Explain why a fixed height would fail at large accessibility text sizes.",
    ],
    conceptAnswers: [
      "The labels' intrinsic widths and heights can change with their text, container width, localization, and Dynamic Type size. Multiline labels therefore need relational constraints that allow their height to grow.",
      "Put both multiline labels in a vertical stack, pin its leading and trailing anchors to readableContentGuide, constrain its top and bottom within layoutMarginsGuide, and center it vertically at a lower priority. The inequalities preserve margins while intrinsic content determines height.",
      "At large accessibility sizes, text wraps into more lines and needs more vertical space, so a fixed height would clip content or create unsatisfiable constraints. Letting intrinsic content size drive height preserves readability across sizes.",
    ],
  },
  {
    id: "ios:uikit-cell-registration",
    track: "ios",
    title: "Configure Every Reused Cell",
    slug: "uikit-cell-registration",
    difficulty: "Medium",
    pattern: "UIKit",
    summary: "Use cell registration and stable diffable identifiers so reused cells never leak prior row state.",
    prompt: "Create a diffable table data source whose registration fully configures every dequeued cell.",
    cue: "A dequeued cell may have displayed another row, so every model-dependent property needs a new value.",
    invariant: "Each visible cell reflects only its current Person, while snapshots use stable person IDs rather than index paths.",
    complexity: "O(n) snapshot construction · O(v) live cell storage for v visible rows",
    swiftNote: "Cell registrations centralize reuse-safe configuration; diffable data sources track stable Hashable identity.",
    estimatedMinutes: 10,
    code: `import UIKit

struct Person: Hashable {
    let id: UUID
    let name: String
    let isFavorite: Bool
}

final class PeopleViewController: UITableViewController {
    private lazy var registration = UITableView.CellRegistration<
        UITableViewCell, Person
    > { cell, _, person in
        var content = cell.defaultContentConfiguration()
        content.text = person.name
        content.image = UIImage(
            systemName: person.isFavorite ? "star.fill" : "star"
        )
        cell.contentConfiguration = content
    }

    private lazy var dataSource = UITableViewDiffableDataSource<Int, Person.ID>(
        tableView: tableView
    ) { [weak self] tableView, indexPath, id in
        guard let self, let person = peopleByID[id] else { return nil }
        return tableView.dequeueConfiguredReusableCell(
            using: registration,
            for: indexPath,
            item: person
        )
    }

    private var peopleByID: [Person.ID: Person] = [:]

    func apply(_ people: [Person], animated: Bool = true) {
        peopleByID = Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0) })
        let previousIDs = Set(dataSource.snapshot().itemIdentifiers)
        let nextIDs = people.map(\\.id)
        var snapshot = NSDiffableDataSourceSnapshot<Int, Person.ID>()
        snapshot.appendSections([0])
        snapshot.appendItems(nextIDs, toSection: 0)
        snapshot.reconfigureItems(nextIDs.filter(previousIDs.contains))
        dataSource.apply(snapshot, animatingDifferences: animated)
    }
}`,
    sourceUrl: "https://developer.apple.com/documentation/uikit/uitableviewdiffabledatasource",
    tags: ["UITableView", "cell reuse", "cell registration", "diffable data source"],
    recallChecks: [
      "List every property that must be refreshed when the cell is reused.",
      "Reconstruct the registration and dequeue path.",
      "Explain why an index path is a location rather than stable model identity.",
    ],
    conceptAnswers: [
      "The registration rebuilds the model-dependent text and star image, then assigns the complete contentConfiguration for every dequeue. No visible property may depend on whatever Person the cell previously displayed.",
      "Create a CellRegistration<UITableViewCell, Person> that fully configures the cell, then have the diffable provider resolve Person.ID to a Person and call dequeueConfiguredReusableCell. Stable IDs select models; the registration renders them reuse-safely.",
      "An index path describes a row's current position, which can change after inserts, deletes, or sorting. A stable Person.ID preserves model identity across those moves, at the cost of maintaining an ID-to-model lookup.",
    ],
  },
  {
    id: "ios:swiftui-owned-observable-state",
    track: "ios",
    title: "Own Observable State at a Stable Identity",
    slug: "swiftui-owned-observable-state",
    difficulty: "Medium",
    pattern: "SwiftUI",
    summary: "Let one view own an observable reference model and pass bindings to children that edit it.",
    prompt: "Create an iOS 17+ profile editor whose model survives body reevaluation for the owning view's identity.",
    cue: "The source of truth needs stable storage outside the transient value returned by body.",
    invariant: "ProfileScreen creates one model for its identity, and EditorFields mutates that same model through bindings.",
    complexity: "O(1) state access · rendering cost depends on affected views",
    swiftNote: "For Observation models, store the owned reference in private @State and use @Bindable where bindings are needed.",
    estimatedMinutes: 8,
    code: `import Observation
import SwiftUI

@Observable
final class ProfileModel {
    var name = ""
    var notificationsEnabled = true
}

struct ProfileScreen: View {
    @State private var model = ProfileModel()

    var body: some View {
        EditorFields(model: model)
    }
}

struct EditorFields: View {
    @Bindable var model: ProfileModel

    var body: some View {
        Form {
            TextField("Name", text: $model.name)
            Toggle(
                "Notifications",
                isOn: $model.notificationsEnabled
            )
        }
    }
}`,
    sourceUrl: "https://developer.apple.com/documentation/swiftui/managing-model-data-in-your-app",
    tags: ["SwiftUI", "Observation", "State", "Bindable", "identity"],
    recallChecks: [
      "Name the view that owns the source of truth and the view that borrows it.",
      "Rebuild the @State-to-@Bindable handoff.",
      "Explain how changing the owner's identity affects its stored state.",
    ],
    conceptAnswers: [
      "ProfileScreen owns the ProfileModel in @State, while EditorFields borrows the same reference through @Bindable. There must be one stable source of truth rather than a new model created during each body evaluation.",
      "Store @State private var model = ProfileModel() in the owner, pass model to EditorFields, and declare @Bindable var model there so $model.name and $model.notificationsEnabled produce bindings. @State provides stable ownership; @Bindable provides editable projections.",
      "SwiftUI associates @State storage with the owner's identity, so replacing that identity discards the old storage and initializes a new ProfileModel. Stable identity preserves state across body reevaluations, not across replacement of the view identity.",
    ],
  },
  {
    id: "ios:swiftui-typed-navigation",
    track: "ios",
    title: "Model Navigation as Typed State",
    slug: "swiftui-typed-navigation",
    difficulty: "Medium",
    pattern: "SwiftUI",
    summary: "Drive a NavigationStack with lightweight Hashable route values that support programmatic navigation.",
    prompt: "Build a typed route path for detail and settings destinations.",
    cue: "Navigation is state when the app must inspect, restore, or mutate the visible path.",
    invariant: "Every value appended to the path has one discoverable destination mapping outside the lazy list content.",
    complexity: "O(d) path storage for navigation depth d",
    swiftNote: "Use an array for one homogeneous route type; NavigationPath is useful for heterogeneous values.",
    estimatedMinutes: 8,
    code: `import SwiftUI

enum Route: Hashable {
    case detail(UUID)
    case settings
}

struct BookDetailScreen: View {
    let id: UUID

    var body: some View {
        Text("Book \\(id.uuidString)")
            .navigationTitle("Book")
    }
}

struct SettingsScreen: View {
    var body: some View {
        Text("Settings")
            .navigationTitle("Settings")
    }
}

struct LibraryScreen: View {
    let bookIDs: [UUID]
    @State private var path: [Route] = []

    var body: some View {
        NavigationStack(path: $path) {
            List(bookIDs, id: \\.self) { id in
                NavigationLink(value: Route.detail(id)) {
                    Text("Open book")
                }
            }
            .toolbar {
                Button("Settings") {
                    path.append(.settings)
                }
            }
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .detail(let id): BookDetailScreen(id: id)
                case .settings: SettingsScreen()
                }
            }
        }
    }
}`,
    sourceUrl: "https://developer.apple.com/documentation/swiftui/understanding-the-navigation-stack",
    tags: ["NavigationStack", "NavigationLink", "route", "state restoration"],
    recallChecks: [
      "Describe the visible stack using route values rather than view instances.",
      "Rebuild the path binding and destination switch.",
      "Explain why lightweight stable route values are preferable to transporting full models.",
    ],
    conceptAnswers: [
      "The root is LibraryScreen, and each pushed element is a Route such as .detail(bookID) or .settings. The path stores navigation intent and navigationDestination translates each value into a view.",
      "Keep @State private var path: [Route], pass $path to NavigationStack, append route values from links or buttons, and switch over Route in navigationDestination(for: Route.self). Every appended case must have exactly one destination mapping.",
      "Lightweight Hashable routes are easier to compare, mutate, persist, and restore without coupling navigation state to large mutable models. The destination can resolve fresh data by stable ID, trading direct transport for cleaner state and ownership boundaries.",
    ],
  },
  {
    id: "ios:network-decode-cache-policy",
    track: "ios",
    title: "Validate, Decode, and Respect HTTP Caching",
    slug: "network-decode-cache-policy",
    difficulty: "Medium",
    pattern: "Networking",
    summary: "Build a configurable URLSession client that validates HTTP status before decoding cached protocol-compliant responses.",
    prompt: "Fetch a Decodable value, reject non-2xx responses, and configure bounded URLCache storage.",
    cue: "A successful transport is not necessarily a successful HTTP response, and decoding can fail independently.",
    invariant: "Only 2xx response bodies reach the decoder; caching follows the request and server cache policy rather than acting as durable storage.",
    complexity: "O(n) decode time and space for an n-byte response",
    swiftNote: "URLCache combines memory and disk caches, but iOS may purge disk entries when the app is not running.",
    estimatedMinutes: 10,
    code: `import Foundation

enum APIError: Error {
    case invalidResponse
    case badStatus(Int)
}

struct APIClient {
    let session: URLSession
    let decoder: JSONDecoder

    func fetch<Value: Decodable>(
        _ type: Value.Type,
        from url: URL
    ) async throws -> Value {
        let (data, response) = try await session.data(from: url)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.badStatus(http.statusCode)
        }

        return try decoder.decode(Value.self, from: data)
    }
}

func makeCachedSession() -> URLSession {
    let configuration = URLSessionConfiguration.default
    configuration.urlCache = URLCache(
        memoryCapacity: 8_000_000,
        diskCapacity: 40_000_000
    )
    configuration.requestCachePolicy = .useProtocolCachePolicy
    return URLSession(configuration: configuration)
}`,
    sourceUrl: "https://developer.apple.com/documentation/foundation/urlcache",
    tags: ["URLSession", "HTTPURLResponse", "JSONDecoder", "URLCache"],
    recallChecks: [
      "Separate transport, HTTP, and decoding failures before reading the solution.",
      "Reconstruct the response guards and generic decode call.",
      "Explain why URLCache must not be treated as guaranteed persistent storage.",
    ],
    conceptAnswers: [
      "URLSession can throw a transport error, a non-HTTP or non-2xx response is an HTTP-layer failure, and JSONDecoder can throw for an incompatible body. Keeping these stages distinct prevents a successful connection from being mistaken for a valid decoded result.",
      "Await session.data(from:), guard-cast the response to HTTPURLResponse, guard that statusCode is in 200..<300, then return try decoder.decode(Value.self, from: data). Only validated success bodies may reach the generic decoder.",
      "URLCache obeys request and server caching policy, has bounded capacity, and its disk contents may be evicted or purged. It improves network efficiency but cannot provide the durability guarantees of application-owned persistent storage.",
    ],
  },
  {
    id: "ios:dependency-injected-test",
    track: "ios",
    title: "Inject a Deterministic Test Double",
    slug: "dependency-injected-test",
    difficulty: "Medium",
    pattern: "Architecture & Testing",
    summary: "Put a protocol boundary around an effect so the unit test can substitute a fast deterministic stub.",
    prompt: "Implement and test a greeting service without performing real networking.",
    cue: "The behavior under test depends on returned user data, not on URLSession itself.",
    invariant: "Production and test loaders satisfy the same contract, while the test controls every input and outcome.",
    complexity: "O(1) service logic · dependency-specific load cost",
    swiftNote: "Apple recommends dependency injection and protocol-oriented boundaries for substituting deterministic stubs.",
    estimatedMinutes: 9,
    code: `import XCTest

struct User: Equatable, Sendable {
    let id: Int
    let name: String
}

protocol UserLoading: Sendable {
    func user(id: Int) async throws -> User
}

struct GreetingService {
    let loader: any UserLoading

    func greeting(for id: Int) async throws -> String {
        let user = try await loader.user(id: id)
        return "Welcome, \\(user.name)!"
    }
}

private struct StubUserLoader: UserLoading {
    let response: @Sendable (Int) throws -> User

    func user(id: Int) async throws -> User {
        try response(id)
    }
}

final class GreetingServiceTests: XCTestCase {
    func testGreetingUsesLoadedName() async throws {
        let stub = StubUserLoader { id in
            User(id: id, name: "Mina")
        }
        let service = GreetingService(loader: stub)

        let greeting = try await service.greeting(for: 7)

        XCTAssertEqual(greeting, "Welcome, Mina!")
    }
}`,
    sourceUrl: "https://developer.apple.com/documentation/xcode/adding-tests-to-your-xcode-project",
    tags: ["dependency injection", "protocol", "stub", "XCTest", "async test"],
    recallChecks: [
      "Name the smallest effect boundary that makes this test deterministic.",
      "Rebuild the protocol, stub, and arrange-act-assert flow.",
      "Explain which integration behavior this unit test intentionally does not prove.",
    ],
    conceptAnswers: [
      "UserLoading is the smallest useful boundary because GreetingService depends only on obtaining a User, not on networking mechanics. Injecting that contract lets the test control the result without broadening the abstraction unnecessarily.",
      "Define UserLoading.user(id:), inject any UserLoading into GreetingService, implement a closure-backed StubUserLoader, arrange its User response, call greeting, and assert the string. Production and test implementations must honor the same contract.",
      "The unit test does not prove that a real loader builds requests correctly, reaches a server, decodes responses, or handles transport failures. Those integration concerns require separate tests; isolating them keeps this behavior test fast and deterministic.",
    ],
  },
  {
    id: "ios:accessible-rating-control",
    track: "ios",
    title: "Give a Custom Control Accessible Semantics",
    slug: "accessible-rating-control",
    difficulty: "Medium",
    pattern: "Accessibility",
    summary: "Expose a visual five-star picker as one named, valued, adjustable accessibility element.",
    prompt: "Build a rating control that works with touch and VoiceOver increment/decrement actions.",
    cue: "The row's visual meaning is not fully described by five decorative star images.",
    invariant: "Every interaction produced by the control keeps the binding within 1...5, and assistive technology receives a meaningful label, value, and adjustment action.",
    complexity: "O(1) rendering and interaction",
    swiftNote: "Accessibility labels are user-facing descriptions; identifiers are separate automation hooks.",
    estimatedMinutes: 8,
    code: `import SwiftUI

struct RatingControl: View {
    @Binding var rating: Int

    var body: some View {
        HStack {
            ForEach(1...5, id: \\.self) { value in
                Button {
                    rating = value
                } label: {
                    Image(systemName: value <= rating ? "star.fill" : "star")
                }
                .buttonStyle(.plain)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Rating")
        .accessibilityValue("\\(rating) of 5")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: rating = min(5, rating + 1)
            case .decrement: rating = max(1, rating - 1)
            @unknown default: break
            }
        }
        .accessibilityIdentifier("rating-control")
    }
}`,
    sourceUrl: "https://developer.apple.com/documentation/swiftui/accessibility-fundamentals",
    tags: ["SwiftUI", "VoiceOver", "accessibilityLabel", "adjustable action"],
    recallChecks: [
      "Describe what VoiceOver should announce before inspecting the modifiers.",
      "Rebuild the label, value, and bounded adjustable action.",
      "Explain why accessibilityIdentifier cannot replace accessibilityLabel.",
    ],
    conceptAnswers: [
      "VoiceOver should expose one adjustable control and announce a meaningful name and current value, such as \"Rating, 3 of 5, adjustable.\" Combining the decorative stars avoids five ambiguous child elements.",
      "Ignore child semantics, set accessibilityLabel to \"Rating\" and accessibilityValue to the current score, then clamp increment with min(5, rating + 1) and decrement with max(1, rating - 1). Touch and assistive actions must preserve the same 1...5 invariant.",
      "accessibilityIdentifier is a stable automation hook and is not intended as user-facing speech. accessibilityLabel communicates meaning to assistive-technology users, so replacing it with an identifier would expose implementation language instead of usable semantics.",
    ],
  },
];
