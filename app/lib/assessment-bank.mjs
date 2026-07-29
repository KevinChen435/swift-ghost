const RESPONSE_MODES = new Set([
  "local-verified-solve",
  "swift-reconstruction",
  "concept-recall",
]);

export const ASSESSMENT_BANK_REVISION = 1;
export const CROSS_LANE_BLUEPRINT_ID = "cross-lane-reentry";

function freezeEntry(entry) {
  return Object.freeze({
    revision: ASSESSMENT_BANK_REVISION,
    itemRevision: entry.itemId.startsWith("ios:") ? 2 : 1,
    stage: 5,
    ...(entry.lane === "python" ? { judgeRevision: 2 } : {}),
    ...(entry.responseMode === "concept-recall" ? { conceptCheckIndex: 1 } : {}),
    ...entry,
  });
}

const rawEntries = [
  ["python-fluency", "python", "Python fluency", "local-verified-solve", [
    ["python:10001", "Frequency Map Warm-up", "Collections and control-flow fluency", "Easy", 4],
    ["python:10004", "Sort with a Composite Key", "Key functions and stable ordering", "Easy", 4],
    ["python:10005", "Queue with Deque", "Deque-backed breadth-first traversal", "Easy", 5],
    ["python:10006", "Heap Tuple Ordering", "Heap tuple ordering and boundaries", "Easy", 5],
  ]],
  ["python-data-structures", "python", "Python core data structures", "local-verified-solve", [
    ["python:1", "Two Sum", "Arrays and hashing", "Easy", 5],
    ["python:20", "Valid Parentheses", "Stack reasoning", "Easy", 5],
    ["python:206", "Reverse Linked List", "Linked-list pointer updates", "Easy", 6],
    ["python:215", "Kth Largest Element in an Array", "Heaps and priority queues", "Medium", 8],
  ]],
  ["python-traversal-state", "python", "Python traversal & state", "local-verified-solve", [
    ["python:3", "Longest Substring Without Repeating Characters", "Sliding-window state", "Medium", 8],
    ["python:102", "Binary Tree Level Order Traversal", "Tree breadth-first traversal", "Medium", 7],
    ["python:200", "Number of Islands", "Graph traversal and visited state", "Medium", 9],
    ["python:39", "Combination Sum", "Backtracking state", "Medium", 10],
  ]],
  ["swift-algorithm-reconstruction", "swift", "Swift algorithm reconstruction", "swift-reconstruction", [
    ["builtin:1", "Two Sum", "Dictionary lookup in Swift", "Easy", 4],
    ["builtin:125", "Valid Palindrome", "Two-pointer reconstruction in Swift", "Easy", 5],
    ["builtin:20", "Valid Parentheses", "Stack reconstruction in Swift", "Easy", 5],
    ["builtin:704", "Binary Search", "Index-safe binary search in Swift", "Easy", 5],
  ]],
  ["swift-language-boundaries", "swift", "Swift language boundaries", "concept-recall", [
    ["ios:value-reference-snapshots", "Copy a Value, Share a Reference", "Value and reference semantics", "Easy", 4],
    ["ios:optional-throwing-boundary", "Separate Absence From Invalid Input", "Optionals and throwing boundaries", "Easy", 5],
    ["ios:weak-stored-closure", "Break a Stored-Closure Retain Cycle", "ARC and closure capture", "Medium", 6],
    ["ios:actor-response-cache", "Isolate a Mutable Cache With an Actor", "Actor isolation and Sendable values", "Medium", 6],
  ]],
  ["ios-engineering-boundaries", "ios", "iOS engineering boundaries", "concept-recall", [
    ["ios:uikit-lifecycle-boundaries", "Place Work in the Right UIKit Lifecycle Hook", "UIKit lifecycle ownership", "Easy", 8],
    ["ios:swiftui-owned-observable-state", "Own Observable State at a Stable Identity", "SwiftUI state ownership", "Medium", 8],
    ["ios:network-decode-cache-policy", "Validate, Decode, and Respect HTTP Caching", "Networking and cache policy", "Medium", 10],
    ["ios:dependency-injected-test", "Inject a Deterministic Test Double", "Architecture and deterministic testing", "Medium", 9],
  ]],
];

export const ASSESSMENT_BANK_ENTRIES = Object.freeze(rawEntries.flatMap(
  ([sectionId, lane, skillLabel, responseMode, candidates]) => candidates.map(
    ([itemId, title, focus, difficulty, estimatedMinutes]) => freezeEntry({
      id: `assessment-bank:${itemId}`,
      sectionId,
      itemId,
      lane,
      skillId: sectionId,
      skillLabel,
      title,
      focus,
      difficulty,
      responseMode,
      estimatedMinutes,
    }),
  ),
));

const ENTRY_BY_ID = new Map(ASSESSMENT_BANK_ENTRIES.map((entry) => [entry.id, entry]));

function freezeSection(section, order) {
  return Object.freeze({
    id: section[0],
    order,
    lane: section[1],
    title: section[2],
    count: 1,
    candidateCount: section[4].length,
    candidateIds: Object.freeze(section[4].map(([itemId]) => `assessment-bank:${itemId}`)),
    estimatedMinutes: Object.freeze({
      minimum: Math.min(...section[4].map((candidate) => candidate[4])),
      maximum: Math.max(...section[4].map((candidate) => candidate[4])),
    }),
  });
}

export const CROSS_LANE_REENTRY_BLUEPRINT = Object.freeze({
  id: CROSS_LANE_BLUEPRINT_ID,
  revision: ASSESSMENT_BANK_REVISION,
  title: "Cross-lane re-entry assessment",
  formSize: 6,
  candidateCount: ASSESSMENT_BANK_ENTRIES.length,
  sections: Object.freeze(rawEntries.map((section, index) => freezeSection(section, index + 1))),
});

export const ASSESSMENT_BLUEPRINTS = Object.freeze([CROSS_LANE_REENTRY_BLUEPRINT]);

export function assessmentBankEntry(entryId) {
  return ENTRY_BY_ID.get(typeof entryId === "string" ? entryId : "") ?? null;
}

export function assessmentBlueprint(blueprintId) {
  return blueprintId === CROSS_LANE_BLUEPRINT_ID ? CROSS_LANE_REENTRY_BLUEPRINT : null;
}

function hash(text) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function exposureRecords(history) {
  const records = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value.itemId === "string") records.push(value);
    if (Array.isArray(value.form)) value.form.forEach((entry) => records.push({
      ...entry,
      exposedAt: value.startedAt ?? value.updatedAt,
    }));
    else if (Array.isArray(value.results)) value.results.forEach((entry) => records.push({
      ...entry,
      exposedAt: value.startedAt ?? value.updatedAt,
    }));
    if (Array.isArray(value.runs)) value.runs.forEach(visit);
  };
  visit(history);
  return records;
}

function independentEvidence(record, entry) {
  if (!record || record.itemId !== entry.itemId) return false;
  if (Number(record.itemRevision) !== entry.itemRevision) return false;
  if (record.currentEvidenceEligible === false) return false;
  const attempt = record.objectiveAttempt ?? record.attempt ?? record;
  if (attempt.outcome !== "completed") return false;
  if (entry.responseMode === "local-verified-solve") {
    const verification = attempt.verification;
    return attempt.practiceKind === "solving" &&
      attempt.qualification === "solved" &&
      Number(attempt.peeks) === 0 &&
      verification &&
      Number(verification.revision) === entry.judgeRevision &&
      Number(verification.total) > 0 &&
      Number(verification.passed) === Number(verification.total);
  }
  if (entry.responseMode === "swift-reconstruction") {
    return attempt.practiceKind === "typing" && Number(attempt.stage) === entry.stage;
  }
  return attempt.practiceKind === "concept" &&
    Number(attempt.stage) === entry.stage &&
    Number(attempt.conceptCheckIndex) === entry.conceptCheckIndex;
}

/**
 * Creates one deterministic candidate per blueprint section. Selection is
 * lexicographic: unseen, no current independent evidence, appearance count,
 * oldest exposure, then a stable seed-derived tie break.
 */
export function selectAssessmentForm(options = {}) {
  const blueprint = assessmentBlueprint(options.blueprintId ?? CROSS_LANE_BLUEPRINT_ID);
  if (!blueprint) return [];
  const history = exposureRecords(options.history);
  const evidence = exposureRecords(options.evidence);
  const seed = String(options.seed ?? CROSS_LANE_BLUEPRINT_ID);
  return blueprint.sections.map((section) => {
    const ranked = section.candidateIds.map((entryId) => {
      const entry = assessmentBankEntry(entryId);
      const appearances = history.filter((record) => record.itemId === entry.itemId);
      const exposedTimes = appearances
        .map((record) => Date.parse(String(record.exposedAt ?? record.startedAt ?? record.completedAt ?? "")))
        .filter(Number.isFinite);
      const mostRecentExposure = exposedTimes.length ? Math.max(...exposedTimes) : Number.NEGATIVE_INFINITY;
      return {
        entry,
        neverAssessed: appearances.length === 0,
        hasIndependentEvidence: evidence.some((record) => independentEvidence(record, entry)),
        appearances: appearances.length,
        mostRecentExposure,
        tie: hash(`${seed}:${section.id}:${entry.id}`),
      };
    }).sort((left, right) =>
      Number(right.neverAssessed) - Number(left.neverAssessed) ||
      Number(left.hasIndependentEvidence) - Number(right.hasIndependentEvidence) ||
      left.appearances - right.appearances ||
      left.mostRecentExposure - right.mostRecentExposure ||
      left.tie - right.tie ||
      left.entry.id.localeCompare(right.entry.id),
    );
    return ranked[0].entry;
  });
}

export function isAssessmentResponseMode(value) {
  return RESPONSE_MODES.has(value);
}
