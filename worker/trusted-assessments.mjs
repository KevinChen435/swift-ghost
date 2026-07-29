const MAX_CLIENT_ID = 128;
export const MAX_TRUSTED_SOURCE_BYTES = 40_000;
export const MAX_TRUSTED_CALLBACK_BYTES = 16_384;
export const TRUSTED_ASSIGNMENT_TTL_MS = 2 * 60 * 60 * 1000;
export const TRUSTED_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export const TRUSTED_ASSESSMENT_PROGRAM = Object.freeze({
  id: "python-verified-baseline",
  revision: 1,
  title: "Verified Python checkpoint",
  shortTitle: "Verified checkpoint",
  description:
    "A server-selected Python problem judged against a sealed test suite in an isolated runtime.",
  evidenceLabel: "Server-verified code evidence",
  language: "python",
});

function freezeChallenge(challenge) {
  return Object.freeze({
    ...challenge,
    tags: Object.freeze([...challenge.tags]),
    constraints: Object.freeze([...challenge.constraints]),
    entrypoint: Object.freeze({ ...challenge.entrypoint }),
    samples: Object.freeze(
      challenge.samples.map((testCase) => Object.freeze({ ...testCase })),
    ),
    hiddenCases: Object.freeze(
      challenge.hiddenCases.map((testCase) => Object.freeze({ ...testCase })),
    ),
  });
}

/**
 * This bank is imported only by the Worker bundle. Never import it from app/**.
 * The public projection below deliberately omits hiddenCases and expected
 * values outside the authored samples.
 */
const CHALLENGES = Object.freeze([
  freezeChallenge({
    key: "stable-window",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Longest Stable Window",
    difficulty: "Medium",
    estimatedMinutes: 18,
    summary:
      "Find the longest contiguous window whose largest and smallest values stay within a limit.",
    prompt:
      "Implement longest_stable_window(nums, max_gap). Return the maximum length of a contiguous subarray where max(window) - min(window) <= max_gap. Return 0 for an empty input.",
    constraints: [
      "0 <= len(nums) <= 20,000",
      "-1,000,000 <= nums[i] <= 1,000,000",
      "0 <= max_gap <= 2,000,000",
      "Aim for O(n) time.",
    ],
    tags: ["sliding-window", "monotonic-deque"],
    starterCode:
      "def longest_stable_window(nums: list[int], max_gap: int) -> int:\n    # Return the longest valid contiguous window.\n    raise NotImplementedError",
    entrypoint: { kind: "function", name: "longest_stable_window" },
    samples: [
      {
        id: "sample-1",
        name: "window contracts after a spike",
        args: [[8, 2, 4, 7], 4],
        expected: 2,
      },
      {
        id: "sample-2",
        name: "entire repeated range remains stable",
        args: [[10, 1, 2, 4, 7, 2], 5],
        expected: 4,
      },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty input", args: [[], 3], expected: 0 },
      { id: "hidden-single", name: "single value", args: [[-8], 0], expected: 1 },
      { id: "hidden-zero-gap", name: "zero gap", args: [[4, 4, 5, 4, 4], 0], expected: 2 },
      { id: "hidden-negative", name: "negative values", args: [[-5, -2, -4, -3, 10], 3], expected: 4 },
      { id: "hidden-contract", name: "repeated contractions", args: [[1, 5, 6, 7, 8, 10, 6, 5, 6], 4], expected: 5 },
    ],
  }),
  freezeChallenge({
    key: "first-complete-group",
    contentRevision: 1,
    judgeRevision: 1,
    title: "First Complete Group",
    difficulty: "Easy",
    estimatedMinutes: 12,
    summary:
      "Find the first event index at which every required label has appeared.",
    prompt:
      "Implement first_complete_group(events, required). Return the smallest zero-based event index where every distinct label in required has appeared at least once. Return -1 if completion never occurs. An empty required list is complete before processing events, so return -1.",
    constraints: [
      "0 <= len(events) <= 100,000",
      "0 <= len(required) <= 10,000",
      "Labels are case-sensitive strings.",
      "Duplicate values in required count once.",
    ],
    tags: ["hash-set", "streaming"],
    starterCode:
      "def first_complete_group(events: list[str], required: list[str]) -> int:\n    # Return the first completion index, or -1.\n    raise NotImplementedError",
    entrypoint: { kind: "function", name: "first_complete_group" },
    samples: [
      {
        id: "sample-1",
        name: "completes after all labels arrive",
        args: [["build", "test", "build", "ship"], ["build", "ship"]],
        expected: 3,
      },
      {
        id: "sample-2",
        name: "missing requirement",
        args: [["a", "b", "a"], ["a", "c"]],
        expected: -1,
      },
    ],
    hiddenCases: [
      { id: "hidden-empty-required", name: "empty requirement", args: [["a"], []], expected: -1 },
      { id: "hidden-empty-events", name: "empty event stream", args: [[], ["a"]], expected: -1 },
      { id: "hidden-first", name: "first event completes", args: [["ready", "later"], ["ready"]], expected: 0 },
      { id: "hidden-duplicates", name: "duplicate requirements", args: [["a", "b"], ["a", "a", "b"]], expected: 1 },
      { id: "hidden-case-sensitive", name: "case sensitivity", args: [["A", "a"], ["a"]], expected: 1 },
    ],
  }),
  freezeChallenge({
    key: "merge-busy-intervals",
    contentRevision: 1,
    judgeRevision: 1,
    title: "Merge Busy Intervals",
    difficulty: "Medium",
    estimatedMinutes: 16,
    summary:
      "Normalize overlapping or touching busy intervals into a compact schedule.",
    prompt:
      "Implement merge_busy_intervals(intervals). Each interval is [start, end] with start <= end. Return sorted, non-overlapping intervals. Overlapping or touching intervals must merge, so [1, 3] and [3, 5] become [1, 5]. Do not mutate the input.",
    constraints: [
      "0 <= len(intervals) <= 50,000",
      "-1,000,000 <= start <= end <= 1,000,000",
      "The input order is arbitrary.",
      "Aim for O(n log n) time.",
    ],
    tags: ["sorting", "intervals"],
    starterCode:
      "def merge_busy_intervals(intervals: list[list[int]]) -> list[list[int]]:\n    # Merge overlaps and touching boundaries.\n    raise NotImplementedError",
    entrypoint: { kind: "function", name: "merge_busy_intervals" },
    samples: [
      {
        id: "sample-1",
        name: "overlaps and touching boundaries",
        args: [[[1, 3], [2, 4], [7, 9], [9, 10]]],
        expected: [[1, 4], [7, 10]],
      },
      {
        id: "sample-2",
        name: "unsorted contained intervals",
        args: [[[8, 12], [2, 6], [3, 4]]],
        expected: [[2, 6], [8, 12]],
      },
    ],
    hiddenCases: [
      { id: "hidden-empty", name: "empty schedule", args: [[]], expected: [] },
      { id: "hidden-point", name: "touching point intervals", args: [[[2, 2], [2, 4], [4, 4]]], expected: [[2, 4]] },
      { id: "hidden-negative", name: "negative boundaries", args: [[[-8, -3], [-5, 0], [2, 3]]], expected: [[-8, 0], [2, 3]] },
      { id: "hidden-chain", name: "long touching chain", args: [[[5, 6], [1, 2], [2, 3], [3, 5]]], expected: [[1, 6]] },
      { id: "hidden-no-mutate", name: "already disjoint", args: [[[1, 1], [3, 4], [9, 12]]], expected: [[1, 1], [3, 4], [9, 12]] },
    ],
  }),
]);

const CHALLENGE_BY_KEY = new Map(CHALLENGES.map((entry) => [entry.key, entry]));

export function trustedChallengeForKey(key) {
  return CHALLENGE_BY_KEY.get(String(key ?? "")) ?? null;
}

export function trustedChallengeForSequence(sequence) {
  const index = Number.isInteger(sequence) && sequence >= 0 ? sequence : 0;
  return CHALLENGES[index % CHALLENGES.length];
}

export function publicTrustedChallenge(challenge) {
  if (!challenge) return null;
  return {
    key: challenge.key,
    contentRevision: challenge.contentRevision,
    judgeRevision: challenge.judgeRevision,
    title: challenge.title,
    difficulty: challenge.difficulty,
    estimatedMinutes: challenge.estimatedMinutes,
    summary: challenge.summary,
    prompt: challenge.prompt,
    constraints: [...challenge.constraints],
    tags: [...challenge.tags],
    starterCode: challenge.starterCode,
    entrypoint: { ...challenge.entrypoint },
    samples: challenge.samples.map((testCase) => ({
      id: testCase.id,
      name: testCase.name,
      args: structuredClone(testCase.args),
      expected: structuredClone(testCase.expected),
    })),
  };
}

export function privateJudgeSpec(challenge) {
  if (!challenge) return null;
  return {
    protocolVersion: 1,
    language: "python",
    contentRevision: challenge.contentRevision,
    judgeRevision: challenge.judgeRevision,
    entrypoint: { ...challenge.entrypoint },
    cases: [...challenge.samples, ...challenge.hiddenCases].map((testCase) => ({
      id: testCase.id,
      visibility: testCase.id.startsWith("sample-") ? "sample" : "hidden",
      name: testCase.name,
      args: structuredClone(testCase.args),
      expected: structuredClone(testCase.expected),
      comparator: "deepEqual",
    })),
  };
}

export function cleanTrustedId(value, limit = MAX_CLIENT_ID) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length > limit) return null;
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/.test(normalized)
    ? normalized
    : null;
}

export function cleanTrustedSource(value) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n?/g, "\n");
  const bytes = new TextEncoder().encode(normalized).byteLength;
  if (bytes < 1 || bytes > MAX_TRUSTED_SOURCE_BYTES) return null;
  return normalized;
}

function canonicalJson(value) {
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new Error("UNSUPPORTED_TRUSTED_CASE_VALUE");
  return serialized;
}

function pythonCallableHarness(source, entrypointName) {
  const embeddedSource = JSON.stringify(source);
  const embeddedEntrypoint = JSON.stringify(entrypointName);
  return [
    "import json as __swift_ghost_json",
    "import sys as __swift_ghost_sys",
    `__swift_ghost_source = ${embeddedSource}`,
    "__swift_ghost_scope = {'__name__': '__swift_ghost_submission__'}",
    "exec(compile(__swift_ghost_source, '<submission>', 'exec'), __swift_ghost_scope, __swift_ghost_scope)",
    "__swift_ghost_payload = __swift_ghost_json.loads(__swift_ghost_sys.stdin.read())",
    `__swift_ghost_entrypoint = __swift_ghost_scope.get(${embeddedEntrypoint})`,
    "if not callable(__swift_ghost_entrypoint):",
    "    raise TypeError('required entrypoint is not callable')",
    "__swift_ghost_result = __swift_ghost_entrypoint(*__swift_ghost_payload['args'])",
    "__swift_ghost_sys.stdout.write(__swift_ghost_json.dumps(",
    "    __swift_ghost_result, ensure_ascii=False, sort_keys=True, separators=(',', ':')",
    "))",
    "__swift_ghost_sys.stdout.write('\\n')",
    "",
  ].join("\n");
}

export function trustedGatewaySubmission({
  submissionId,
  source,
  judgeSpec,
  callbackUrl,
}) {
  if (
    !cleanTrustedId(submissionId, 160) ||
    cleanTrustedSource(source) !== source ||
    typeof callbackUrl !== "string"
  )
    throw new Error("INVALID_TRUSTED_GATEWAY_INPUT");
  let parsedCallback;
  try {
    parsedCallback = new URL(callbackUrl);
  } catch {
    throw new Error("INVALID_TRUSTED_GATEWAY_INPUT");
  }
  if (
    parsedCallback.protocol !== "https:" ||
    parsedCallback.username ||
    parsedCallback.password ||
    parsedCallback.hash
  )
    throw new Error("INVALID_TRUSTED_GATEWAY_INPUT");
  if (
    !judgeSpec ||
    typeof judgeSpec !== "object" ||
    Array.isArray(judgeSpec) ||
    judgeSpec.protocolVersion !== 1 ||
    judgeSpec.language !== "python" ||
    !judgeSpec.entrypoint ||
    judgeSpec.entrypoint.kind !== "function" ||
    !/^[A-Za-z_][A-Za-z0-9_]{0,95}$/.test(judgeSpec.entrypoint.name) ||
    !Array.isArray(judgeSpec.cases) ||
    judgeSpec.cases.length < 1 ||
    judgeSpec.cases.length > 64
  )
    throw new Error("INVALID_TRUSTED_JUDGE_SPEC");
  const wrappedSource = pythonCallableHarness(source, judgeSpec.entrypoint.name);
  if (new TextEncoder().encode(wrappedSource).byteLength > 48_000)
    throw new Error("TRUSTED_GATEWAY_SOURCE_TOO_LARGE");
  const gatewayRequest = {
    version: "judge.submission.v1",
    submissionId,
    language: "python3",
    source: wrappedSource,
    comparison: "exact",
    tests: judgeSpec.cases.map((testCase) => {
      if (
        !testCase ||
        typeof testCase !== "object" ||
        Array.isArray(testCase) ||
        !cleanTrustedId(testCase.id, 160) ||
        !Array.isArray(testCase.args) ||
        testCase.comparator !== "deepEqual"
      )
        throw new Error("INVALID_TRUSTED_JUDGE_SPEC");
      const input = `${canonicalJson({ args: testCase.args })}\n`;
      const expectedOutput = `${canonicalJson(testCase.expected)}\n`;
      if (
        new TextEncoder().encode(input).byteLength > 32_000 ||
        new TextEncoder().encode(expectedOutput).byteLength > 32_000
      )
        throw new Error("TRUSTED_GATEWAY_CASE_TOO_LARGE");
      return {
        id: testCase.id,
        input,
        expectedOutput,
      };
    }),
    callbackUrl: parsedCallback.toString(),
  };
  if (
    new TextEncoder().encode(JSON.stringify(gatewayRequest)).byteLength >
    120_000
  )
    throw new Error("TRUSTED_GATEWAY_REQUEST_TOO_LARGE");
  return gatewayRequest;
}

export function normalizeTrustedGatewayResult(
  value,
  submissionId,
  expectedTotal,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const verdicts = new Set([
    "accepted",
    "wrong-answer",
    "runtime-error",
    "time-limit",
    "judge-error",
  ]);
  const verdict = verdicts.has(value.verdict) ? value.verdict : null;
  const total = Number(value.total);
  const passed = Number(value.passed);
  const failedCaseIndex = value.failedCaseIndex === undefined
    ? null
    : Number(value.failedCaseIndex);
  if (
    value.version !== "judge.result.v1" ||
    value.submissionId !== submissionId ||
    !verdict ||
    !Number.isInteger(total) ||
    total !== expectedTotal ||
    !Number.isInteger(passed) ||
    passed < 0 ||
    passed > total ||
    (verdict === "accepted" && passed !== total) ||
    (verdict === "wrong-answer" && passed >= total) ||
    (failedCaseIndex !== null &&
      (!Number.isInteger(failedCaseIndex) ||
        failedCaseIndex < 0 ||
        failedCaseIndex >= total)) ||
    (verdict === "accepted" && failedCaseIndex !== null)
  )
    return null;
  return { verdict, passed, total };
}

export function normalizeTrustedJudgeResult(value, expectedTotal) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const verdicts = new Set([
    "accepted",
    "wrong-answer",
    "runtime-error",
    "time-limit",
    "judge-error",
  ]);
  const verdict = verdicts.has(value.verdict) ? value.verdict : null;
  const total = Number(value.total);
  const passed = Number(value.passed);
  const durationMs = Number(value.durationMs);
  if (
    !verdict ||
    !Number.isInteger(total) ||
    total !== expectedTotal ||
    !Number.isInteger(passed) ||
    passed < 0 ||
    passed > total ||
    !Number.isInteger(durationMs) ||
    durationMs < 0 ||
    durationMs > 120_000 ||
    (verdict === "accepted" && passed !== total)
  )
    return null;
  return {
    verdict,
    passed,
    total,
    durationMs,
    runtime: typeof value.runtime === "string"
      ? value.runtime.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80)
      : "isolated-python",
  };
}

export const TRUSTED_CHALLENGE_COUNT = CHALLENGES.length;
