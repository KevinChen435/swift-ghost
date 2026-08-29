import assert from "node:assert/strict";
import test from "node:test";
import { CLOUD_LIMITS, createCloudClient } from "../app/lib/cloud.mjs";
import { createProgressSnapshot } from "../app/lib/progress-sync.mjs";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function recorder(responder) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return responder(url, init, calls.length);
    },
  };
}

function attempt(index, overrides = {}) {
  return {
    id: `attempt-${index}`,
    itemId: index % 2 ? "ios:actor-cache" : "builtin:1",
    itemRevision: 1,
    stage: 5,
    mode: "strict",
    track: index % 2 ? "ios" : "interview",
    titleSnapshot: `Attempt ${index}`,
    startedAt: "2026-07-25T20:00:00.000Z",
    completedAt: "2026-07-25T20:01:00.000Z",
    durationMs: 60_000,
    typedChars: 300,
    totalKeystrokes: 310,
    correctKeystrokes: 300,
    rejectedKeystrokes: 10,
    corrections: 2,
    peeks: 0,
    accuracy: 96.77,
    outcome: "completed",
    qualification: "independent",
    challengeDate: "2026-07-25",
    keyErrors: { x: 2 },
    lineErrors: { 4: 3 },
    timeline: [{ atMs: 1_000, wpm: 42, progress: 20 }],
    ...overrides,
  };
}

function studyWorkspace(overrides = {}) {
  return {
    version: 1,
    revision: 0,
    updatedAt: "2026-07-28T12:00:00.000Z",
    activePlanId: null,
    collections: [],
    plans: [],
    tombstones: [],
    ...overrides,
  };
}

function progressSnapshot(overrides = {}) {
  return createProgressSnapshot(
    {
      attempts: [{ ...attempt("progress-attempt"), practiceKind: "typing" }],
      ...overrides,
    },
    { now: "2026-07-28T12:00:00.000Z" },
  );
}

function inMemoryStudyDatabase() {
  const profiles = new Map();
  const workspaces = new Map();
  const progressSnapshots = new Map();
  return {
    profiles,
    workspaces,
    progressSnapshots,
    prepare(sql) {
      const statement = sql.replace(/\s+/g, " ").trim();
      return {
        bind(...values) {
          return {
            async first() {
              if (statement.includes("FROM study_workspaces"))
                return workspaces.get(values[0]) ?? null;
              if (statement.includes("FROM progress_snapshots"))
                return progressSnapshots.get(values[0]) ?? null;
              if (
                statement.includes("FROM community_profiles") &&
                statement.includes("WHERE user_id = ?")
              )
                return profiles.get(values[0]) ?? null;
              throw new Error(`Unhandled fake D1 first: ${statement}`);
            },
            async run() {
              if (statement.startsWith("INSERT OR IGNORE INTO community_profiles")) {
                if (!profiles.has(values[0])) {
                  profiles.set(values[0], {
                    user_id: values[0],
                    email: values[1],
                    handle: values[2],
                    display_name: values[3],
                    bio: null,
                    timezone: null,
                    is_public: 0,
                    share_activity: 0,
                    show_on_leaderboards: 0,
                    updated_at: values[5],
                  });
                }
                return { meta: { changes: 1 } };
              }
              if (statement.startsWith("INSERT INTO study_workspaces")) {
                const userId = values[0];
                if (workspaces.has(userId)) return { meta: { changes: 0 } };
                workspaces.set(userId, {
                  revision: 1,
                  payload_json: values[1],
                  updated_at: values[2],
                });
                return { meta: { changes: 1 } };
              }
              if (statement.startsWith("UPDATE study_workspaces")) {
                const [payloadJson, updatedAt, userId, expectedRevision] = values;
                const current = workspaces.get(userId);
                if (!current || current.revision !== expectedRevision)
                  return { meta: { changes: 0 } };
                workspaces.set(userId, {
                  revision: expectedRevision + 1,
                  payload_json: payloadJson,
                  updated_at: updatedAt,
                });
                return { meta: { changes: 1 } };
              }
              if (statement.startsWith("INSERT INTO progress_snapshots")) {
                const userId = values[0];
                if (progressSnapshots.has(userId)) return { meta: { changes: 0 } };
                progressSnapshots.set(userId, {
                  revision: 1,
                  payload_json: values[1],
                  updated_at: values[2],
                });
                return { meta: { changes: 1 } };
              }
              if (statement.startsWith("UPDATE progress_snapshots")) {
                const [payloadJson, updatedAt, userId, expectedRevision] = values;
                const current = progressSnapshots.get(userId);
                if (!current || current.revision !== expectedRevision)
                  return { meta: { changes: 0 } };
                progressSnapshots.set(userId, {
                  revision: expectedRevision + 1,
                  payload_json: payloadJson,
                  updated_at: updatedAt,
                });
                return { meta: { changes: 1 } };
              }
              throw new Error(`Unhandled fake D1 run: ${statement}`);
            },
          };
        },
      };
    },
  };
}

async function builtWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("study-sync-test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

async function callStudyApi(worker, db, method, email, body) {
  return worker.fetch(
    new Request("http://localhost/api/v1/study/workspace", {
      method,
      headers: {
        ...(email ? { "oai-authenticated-user-email": email } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    { DB: db },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function callProgressApi(worker, db, method, email, body) {
  return worker.fetch(
    new Request("http://localhost/api/v1/progress/snapshot", {
      method,
      headers: {
        ...(email ? { "oai-authenticated-user-email": email } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    { DB: db },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("GitHub Pages mode is deliberately quiet and unavailable", async () => {
  let calls = 0;
  const client = createCloudClient({
    location: { hostname: "kevinchen435.github.io" },
    fetchImpl: async () => {
      calls += 1;
      throw new Error("must not fetch");
    },
  });
  assert.deepEqual(await client.capabilities(), {
    available: false,
    reason: "disabled",
  });
  assert.equal(calls, 0);
});

test("capabilities uses a same-origin, abortable request and bounds its response", async () => {
  const controller = new AbortController();
  const mock = recorder(() =>
    json({
      data: {
        apiVersion: "v1-with-an-unreasonably-long-suffix",
        cloudSync: true,
        studySync: true,
        progressSync: true,
        community: true,
        leaderboards: true,
        trustedAssessments: true,
        auth: "session",
        maxAttemptBatch: 5_000,
      },
    }),
  );
  const result = await createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "swift.test" },
  }).capabilities({ signal: controller.signal });
  assert.equal(result.available, true);
  assert.deepEqual(result.data, {
    apiVersion: "v1-with-an-unrea",
    cloudSync: true,
    studySync: true,
    progressSync: true,
    community: true,
    leaderboards: true,
    trustedAssessments: true,
    auth: "session",
    maxAttemptBatch: CLOUD_LIMITS.maxAttemptBatch,
    privacy: {
      profileDefault: "private",
      activityDefault: "off",
      leaderboardsDefault: "off",
    },
  });
  assert.equal(mock.calls[0].url, "/api/v1/capabilities");
  assert.equal(mock.calls[0].init.credentials, "same-origin");
  assert.equal(mock.calls[0].init.cache, "no-store");
  assert.equal(mock.calls[0].init.signal, controller.signal);
});

test("trusted assessment transport is bounded, fail-closed, and omits private fields", async () => {
  const assignment = {
    id: "trusted-abc12345",
    program: {
      id: "python-verified-baseline",
      revision: 1,
      title: "Verified Python checkpoint",
      evidenceLabel: "Server-verified code evidence",
      language: "python",
    },
    challenge: {
      key: "stable-window",
      language: "python",
      runtime: "python-3.13-linux",
      contentRevision: 1,
      judgeRevision: 2,
      title: "Longest Stable Window",
      difficulty: "Medium",
      estimatedMinutes: 18,
      summary: "Find a bounded window.",
      prompt: "Implement longest_stable_window.",
      constraints: ["n is bounded"],
      tags: ["window"],
      starterCode: "def longest_stable_window(nums, gap):\n    pass",
      entrypoint: { kind: "function", name: "longest_stable_window" },
      samples: [
        { id: "sample-1", name: "sample", args: [[1, 2], 1], expected: 2 },
      ],
      hiddenCases: [{ expected: "must be dropped" }],
    },
    status: "active",
    assignedAt: "2026-07-28T12:00:00.000Z",
    expiresAt: "2026-07-28T14:00:00.000Z",
    latestSubmission: null,
  };
  const program = {
    id: "verified-code-lab",
    revision: 2,
    title: "Verified Code Lab",
    description: "Server-selected code evidence.",
    evidenceLabel: "Server-verified code evidence",
    language: "mixed",
  };
  const settled = {
    id: "verified-abc12345",
    clientSubmissionId: "submission:abc12345",
    status: "settled",
    verdict: "accepted",
    submittedAt: "2026-07-28T12:05:00.000Z",
    settledAt: "2026-07-28T12:05:01.000Z",
    result: {
      passed: 7,
      total: 7,
      durationMs: 83,
      language: "python",
      runtime: "python-3.13-linux",
      contractDigest: "a".repeat(64),
      authority: "server-isolated-python",
      contentRevision: 1,
      judgeRevision: 2,
      privateCases: ["must be dropped"],
    },
  };
  const swiftAssignment = {
    ...assignment,
    id: "trusted-swift12345",
    program: {
      ...assignment.program,
      id: "swift-verified-baseline",
      title: "Verified Swift checkpoint",
      language: "swift",
    },
    challenge: {
      ...assignment.challenge,
      key: "swift-product-except-self",
      language: "swift",
      runtime: "swift-6.3.3-linux",
      samples: [
        ...assignment.challenge.samples,
        { id: "sample-2", name: "sample 2", args: [[2, 3, 4]], expected: [12, 8, 6] },
      ],
      title: "Product Except Self in Swift",
      starterCode: "import Foundation\n\nfunc productExceptSelf(_ nums: [Int]) -> [Int] { return [] }",
      entrypoint: {
        kind: "function",
        name: "productExceptSelf",
        parameters: [{ name: "nums", type: "[Int]" }],
        returns: "[Int]",
      },
    },
  };
  const mock = recorder((url, init, call) => {
    if (call === 1) return json({ program, entries: [assignment] });
    if (call === 2) {
      assert.deepEqual(JSON.parse(init.body), {
        clientRequestId: "assignment-request:abc12345",
        language: "python",
      });
      return json({ assignment }, 201);
    }
    if (call === 3) {
      assert.deepEqual(JSON.parse(init.body), {
        clientRequestId: "assignment-request:swift12345",
        language: "swift",
        challengeKey: "swift-product-except-self",
      });
      return json({ assignment: swiftAssignment }, 201);
    }
    if (call === 4) {
      assert.deepEqual(JSON.parse(init.body), {
        clientSubmissionId: "submission:abc12345",
        source: "def longest_stable_window(nums, gap):\n    return len(nums)",
      });
      return json({ submission: settled }, 201);
    }
    if (call === 5) {
      assert.deepEqual(JSON.parse(init.body), {
        clientRunId: "example:abc12345",
        source: swiftAssignment.challenge.starterCode,
      });
      return json({
        exampleRun: {
          id: "example-server12345",
          assignmentId: swiftAssignment.id,
          clientRunId: "example:abc12345",
          status: "settled",
          verdict: "wrong-answer",
          requestedAt: "2026-07-28T12:06:00.000Z",
          settledAt: "2026-07-28T12:06:01.000Z",
          result: {
            passed: 1,
            total: 2,
            authority: "server-isolated-swift",
            language: "swift",
            runtime: "swift-6.3.3-linux",
            contractDigest: "b".repeat(64),
            contentRevision: 1,
            judgeRevision: 2,
            failedCaseIndex: 1,
            failedCaseId: "sample-2",
            diagnostic: "compile output is bounded",
            publicCaseResults: [
              { id: "sample-1", status: "passed", actual: 2, expected: "drop me" },
              {
                id: "sample-2",
                status: "failed",
                actual: [0, 0, 0],
                diagnostic: "sample output differs",
              },
            ],
            hiddenOutput: "must be dropped",
          },
        },
      });
    }
    throw new Error(`unexpected call ${call}`);
  });
  const client = createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "swift.test" },
  });

  const listed = await client.trustedAssignments({ limit: 500 });
  assert.equal(listed.available, true);
  assert.equal(listed.data.entries.length, 1);
  assert.equal(Object.hasOwn(listed.data.entries[0].challenge, "hiddenCases"), false);
  assert.equal(mock.calls[0].url, "/api/v1/trusted/assignments?limit=50");

  const issued = await client.issueTrustedAssignment(
    "assignment-request:abc12345",
  );
  assert.equal(issued.available, true);
  assert.equal(mock.calls[1].init.method, "POST");

  const swiftIssued = await client.issueTrustedAssignment(
    "assignment-request:swift12345",
    { language: "swift", challengeKey: "swift-product-except-self" },
  );
  assert.equal(swiftIssued.available, true);
  assert.equal(swiftIssued.data.challenge.key, "swift-product-except-self");

  const submitted = await client.submitTrustedAssignment(
    assignment.id,
    {
      clientSubmissionId: "submission:abc12345",
      source: "def longest_stable_window(nums, gap):\r\n    return len(nums)",
    },
  );
  assert.equal(submitted.available, true);
  assert.equal(submitted.data.verdict, "accepted");
  assert.equal(Object.hasOwn(submitted.data.result, "privateCases"), false);
  assert.equal(Object.hasOwn(submitted.data.result, "durationMs"), false);
  assert.equal(submitted.data.result.runtime, "python-3.13-linux");
  assert.equal(submitted.data.result.language, "python");
  assert.equal(submitted.data.result.contractDigest, "a".repeat(64));
  assert.equal(submitted.data.clientSubmissionId, "submission:abc12345");
  assert.equal(
    mock.calls[3].url,
    "/api/v1/trusted/assignments/trusted-abc12345/submissions",
  );

  const exampleRun = await client.runTrustedExamples(swiftAssignment.id, {
    clientRunId: "example:abc12345",
    source: swiftAssignment.challenge.starterCode,
  }, { challenge: swiftAssignment.challenge });
  assert.equal(exampleRun.available, true);
  assert.equal(exampleRun.data.verdict, "wrong-answer");
  assert.equal(exampleRun.data.result.failedCaseIndex, 1);
  assert.equal(exampleRun.data.result.failedCaseId, "sample-2");
  assert.equal(exampleRun.data.result.diagnostic, "compile output is bounded");
  assert.deepEqual(exampleRun.data.result.publicCaseResults, [
    { id: "sample-1", visibility: "sample", passed: true, status: "passed", actual: 2 },
    {
      id: "sample-2",
      visibility: "sample",
      passed: false,
      status: "failed",
      actual: [0, 0, 0],
      diagnostic: "sample output differs",
    },
  ]);
  assert.equal(Object.hasOwn(exampleRun.data.result.publicCaseResults[0], "expected"), false);
  assert.equal(Object.hasOwn(exampleRun.data.result, "hiddenOutput"), false);

  const reordered = {
    ...exampleRun.data,
    result: {
      ...exampleRun.data.result,
      publicCaseResults: [...exampleRun.data.result.publicCaseResults].reverse(),
    },
  };
  const reorderedMock = recorder(() => json({ exampleRun: reordered }));
  const reorderedClient = createCloudClient({
    fetchImpl: reorderedMock.fetchImpl,
    location: { hostname: "swift.test" },
  });
  assert.deepEqual(
    await reorderedClient.runTrustedExamples(swiftAssignment.id, {
      clientRunId: "example:reordered123",
      source: swiftAssignment.challenge.starterCode,
    }, { challenge: swiftAssignment.challenge }),
    { available: false, reason: "invalid-response", status: 200 },
  );
  assert.equal(
    mock.calls[4].url,
    "/api/v1/trusted/assignments/trusted-swift12345/example-runs",
  );

  assert.deepEqual(
    await client.issueTrustedAssignment(
      "assignment-request:invalid12345",
      { language: "swift", challengeKey: "not a key" },
    ),
    { available: false, reason: "invalid-request" },
  );

  assert.deepEqual(
    await client.submitTrustedAssignment(assignment.id, {
      clientSubmissionId: "submission:too-large",
      source: "x".repeat(49 * 1024),
    }),
    { available: false, reason: "invalid-request" },
  );
  assert.deepEqual(
    await client.submitTrustedAssignment(assignment.id, {
      clientSubmissionId: `submission:${"a".repeat(128)}`,
      source: "def solve():\n    return 1",
    }),
    { available: false, reason: "invalid-request" },
  );
  assert.deepEqual(
    await client.runTrustedExamples(swiftAssignment.id, {
      clientRunId: "example:too-large",
      source: "x".repeat(49 * 1024),
    }),
    { available: false, reason: "invalid-request" },
  );
  assert.equal(mock.calls.length, 5);
});

test("trusted assignment lookup can target one challenge and preserves enqueue retry semantics", async () => {
  const mock = recorder((url) => {
    assert.equal(url, "/api/v1/trusted/assignments?limit=50&challengeKey=swift-two-sum");
    return json({
      program: {
        id: "verified-code-lab",
        revision: 1,
        title: "Verified Swift checkpoint",
        description: "Server-selected Swift evidence.",
        evidenceLabel: "Server-verified code evidence",
        language: "mixed",
      },
      entries: [],
    });
  });
  const client = createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "swift.test" },
  });
  const result = await client.trustedAssignments({
    limit: 50,
    challengeKey: "swift-two-sum",
  });
  assert.equal(result.available, true);

  const enqueueFailure = createCloudClient({
    fetchImpl: async () =>
      json(
        {
          error: {
            code: "JUDGE_ENQUEUE_UNAVAILABLE",
            message: "retry",
          },
        },
        503,
      ),
    location: { hostname: "swift.test" },
  });
  assert.deepEqual(
    await enqueueFailure.submitTrustedAssignment("trusted-abc12345", {
      clientSubmissionId: "submission:retry12345",
      source: "func twoSum(_ nums: [Int], _ target: Int) -> [Int] { [] }",
    }),
    { available: false, reason: "judge-enqueue-unavailable", status: 503 },
  );
});

test("trusted example runs accept the frozen Python execution contract", async () => {
  const challenge = {
    key: "python-stable-window",
    language: "python",
    runtime: "python-3.13-linux",
    contentRevision: 1,
    judgeRevision: 2,
    samples: [
      { id: "sample-1", name: "small window", args: [[1, 2], 1], expected: 2 },
      { id: "sample-2", name: "single item", args: [[4], 0], expected: 1 },
    ],
  };
  const response = {
    exampleRun: {
      id: "example-python12345",
      assignmentId: "trusted-python12345",
      clientRunId: "example:python12345",
      status: "settled",
      verdict: "wrong-answer",
      requestedAt: "2026-07-28T12:06:00.000Z",
      settledAt: "2026-07-28T12:06:01.000Z",
      result: {
        passed: 1,
        total: 2,
        authority: "server-isolated-python",
        language: "python",
        runtime: "python-3.13-linux",
        contractDigest: "c".repeat(64),
        contentRevision: 1,
        judgeRevision: 2,
        publicCaseResults: [
          { id: "sample-1", status: "passed", actual: 2 },
          { id: "sample-2", status: "failed", actual: 0, diagnostic: "wrong output" },
        ],
      },
    },
  };
  const mock = recorder(() => json(response));
  const client = createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "python.test" },
  });
  const result = await client.runTrustedExamples(
    "trusted-python12345",
    { clientRunId: "example:python12345", source: "def solve():\n    return 0" },
    { challenge },
  );
  assert.equal(result.available, true);
  assert.equal(result.data.result.language, "python");
  assert.equal(result.data.result.authority, "server-isolated-python");
  assert.equal(result.data.result.runtime, "python-3.13-linux");
  assert.equal(result.data.result.publicCaseResults?.length, 2);
  assert.equal(result.data.result.publicCaseResults?.[1].diagnostic, "wrong output");
  assert.equal(mock.calls[0].url, "/api/v1/trusted/assignments/trusted-python12345/example-runs");
});

test("trusted Swift custom runs send only bounded arguments and normalize observed output", async () => {
  const challenge = {
    key: "swift-two-sum",
    language: "swift",
    runtime: "swift-6.3.3-linux",
    contentRevision: 1,
    judgeRevision: 1,
    entrypoint: {
      kind: "function",
      name: "twoSum",
      parameters: [
        { name: "nums", type: "[Int]" },
        { name: "target", type: "Int" },
      ],
      returns: "[Int]",
    },
    samples: [],
  };
  const mock = recorder((url, init) => {
    assert.equal(
      url,
      "/api/v1/trusted/assignments/trusted-swift12345/custom-runs",
    );
    assert.deepEqual(JSON.parse(init.body), {
      clientRunId: "custom:abc12345",
      source: "func twoSum(_ nums: [Int], _ target: Int) -> [Int] { return [] }",
      cases: [{ id: "custom-1", name: "duplicate values", args: [[3, 3], 6] }],
    });
    return json({
      customRun: {
        id: "custom-server12345",
        assignmentId: "trusted-swift12345",
        clientRunId: "custom:abc12345",
        status: "settled",
        verdict: "accepted",
        requestedAt: "2026-08-29T12:06:00.000Z",
        settledAt: "2026-08-29T12:06:01.000Z",
        result: {
          passed: 1,
          total: 1,
          authority: "server-isolated-swift",
          language: "swift",
          runtime: "swift-6.3.3-linux",
          contractDigest: "d".repeat(64),
          contentRevision: 1,
          judgeRevision: 1,
          publicCaseResults: [
            {
              id: "custom-1",
              status: "passed",
              actualOutput: "[0,1]",
              diagnostic: "bounded diagnostic",
              expected: "must never be copied",
            },
          ],
          hiddenCases: ["must never be copied"],
        },
      },
    });
  });
  const client = createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "swift.test" },
  });
  const result = await client.runTrustedCustomCases(
    "trusted-swift12345",
    {
      clientRunId: "custom:abc12345",
      source: "func twoSum(_ nums: [Int], _ target: Int) -> [Int] { return [] }",
      cases: [{ id: "custom-1", name: "duplicate values", args: [[3, 3], 6] }],
    },
    { challenge },
  );
  assert.equal(result.available, true);
  assert.equal(result.data.result.cases[0].passed, true);
  assert.equal(result.data.result.cases[0].actual, "[0,1]");
  assert.equal(result.data.result.cases[0].diagnostic, "bounded diagnostic");
  assert.equal(Object.hasOwn(result.data.result.cases[0], "expected"), false);
  assert.equal(Object.hasOwn(result.data.result, "hiddenCases"), false);
  assert.deepEqual(
    await client.runTrustedCustomCases("trusted-swift12345", {
      clientRunId: "custom:invalid123",
      source: "func twoSum(_ nums: [Int], _ target: Int) -> [Int] { return [] }",
      cases: [],
    }),
    { available: false, reason: "invalid-request" },
  );
});

test("legacy Python receipts remain visible with an explicit missing-contract marker", async () => {
  const legacyAssignment = {
    id: "trusted-legacy123",
    program: {
      id: "python-verified-baseline",
      revision: 1,
      title: "Verified Python checkpoint",
      evidenceLabel: "Server-verified code evidence",
      language: "python",
    },
    challenge: {
      key: "stable-window",
      language: "python",
      runtime: "python-3.13-linux",
      contentRevision: 1,
      judgeRevision: 2,
      title: "Longest Stable Window",
      difficulty: "Medium",
      estimatedMinutes: 18,
      summary: "Find a bounded window.",
      prompt: "Implement longest_stable_window.",
      constraints: [],
      tags: [],
      starterCode: "def longest_stable_window(nums, gap):\n    pass",
      entrypoint: { kind: "function", name: "longest_stable_window" },
      samples: [{ id: "sample-1", name: "sample", args: [[1], 1], expected: 1 }],
    },
    status: "accepted",
    assignedAt: "2026-07-28T12:00:00.000Z",
    expiresAt: "2026-07-28T14:00:00.000Z",
    latestSubmission: {
      id: "verified-legacy123",
      status: "settled",
      verdict: "accepted",
      submittedAt: "2026-07-28T12:05:00.000Z",
      settledAt: "2026-07-28T12:05:01.000Z",
      result: {
        passed: 3,
        total: 3,
        authority: "server-isolated-python",
        contentRevision: 1,
        judgeRevision: 1,
      },
    },
  };
  const client = createCloudClient({
    fetchImpl: async () => json({
      program: {
        id: "verified-code-lab",
        revision: 2,
        title: "Verified Code Lab",
        description: "Server-selected code evidence.",
        evidenceLabel: "Server-verified code evidence",
        language: "mixed",
      },
      entries: [legacyAssignment],
    }),
    location: { hostname: "swift.test" },
  });
  const result = await client.trustedAssignments();
  assert.equal(result.available, true);
  assert.equal(result.data.entries[0].latestSubmission.result.language, "python");
  assert.equal(result.data.entries[0].latestSubmission.result.runtime, "python-3.13-linux");
  assert.equal(result.data.entries[0].latestSubmission.result.contractDigest, undefined);
});

test("study workspace sync is network-quiet on static builds", async () => {
  let calls = 0;
  const client = createCloudClient({
    location: { hostname: "kevinchen435.github.io" },
    fetchImpl: async () => {
      calls += 1;
      throw new Error("must not fetch");
    },
  });
  assert.deepEqual(await client.getStudyWorkspace(), {
    available: false,
    reason: "disabled",
  });
  assert.deepEqual(await client.putStudyWorkspace(studyWorkspace(), { baseRevision: 0 }), {
    available: false,
    reason: "disabled",
  });
  assert.equal(calls, 0);
});

test("private progress sync client sends only normalized source-free evidence", async () => {
  const snapshot = progressSnapshot();
  const serverTime = "2026-07-28T12:30:00.000Z";
  const mock = recorder((url, init) => {
    if (url === "/api/v1/capabilities") {
      return json({
        data: {
          apiVersion: "v1",
          cloudSync: true,
          studySync: true,
          progressSync: true,
          community: true,
          leaderboards: true,
          trustedAssessments: true,
          auth: "session",
          maxAttemptBatch: 100,
        },
      });
    }
    if (init?.method === "GET") return json({ snapshot: null });
    assert.equal(url, "/api/v1/progress/snapshot");
    const body = JSON.parse(init.body);
    assert.equal(body.baseRevision, 0);
    assert.equal(body.snapshot.version, 1);
    assert.equal("source" in body.snapshot.attempts[0], false);
    assert.equal("timeline" in body.snapshot.attempts[0], false);
    return json({
      snapshot: {
        ...body.snapshot,
        revision: 1,
        updatedAt: serverTime,
        privateServerExtra: "drop-me",
      },
    });
  });
  const client = createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "swift.test" },
  });
  assert.deepEqual(await client.capabilities(), {
    available: true,
    status: 200,
    data: {
      apiVersion: "v1",
      cloudSync: true,
      studySync: true,
      progressSync: true,
      community: true,
      leaderboards: true,
      trustedAssessments: true,
      auth: "session",
      maxAttemptBatch: CLOUD_LIMITS.maxAttemptBatch,
      privacy: {
        profileDefault: "private",
        activityDefault: "off",
        leaderboardsDefault: "off",
      },
    },
  });
  assert.deepEqual(await client.getProgressSnapshot(), {
    available: true,
    status: 200,
    data: null,
  });
  const result = await client.putProgressSnapshot(snapshot, { baseRevision: 0 });
  assert.equal(result.available, true);
  assert.equal(result.data.revision, 1);
  assert.equal(result.data.updatedAt, serverTime);
  assert.equal("privateServerExtra" in result.data, false);
});

test("private progress sync client preserves bounded revision conflicts", async () => {
  const current = progressSnapshot();
  current.revision = 3;
  current.updatedAt = "2026-07-28T12:45:00.000Z";
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () =>
      json(
        {
          error: {
            code: "PROGRESS_REVISION_CONFLICT",
            message: "private diagnostic",
          },
          current: { revision: 3, snapshot: current },
        },
        409,
      ),
  });
  const conflict = await client.putProgressSnapshot(progressSnapshot(), {
    baseRevision: 2,
  });
  assert.deepEqual(conflict, {
    available: false,
    reason: "revision-conflict",
    status: 409,
    conflict: { revision: 3, snapshot: current },
  });
  assert.equal(JSON.stringify(conflict).includes("private diagnostic"), false);
});

test("study workspace methods normalize private snapshots and send optimistic revisions", async () => {
  const serverTime = "2026-07-28T12:30:00.000Z";
  const mock = recorder((url, init, call) => {
    if (call === 1) return json({ workspace: null });
    const body = JSON.parse(init.body);
    assert.equal(body.baseRevision, 0);
    assert.equal(body.workspace.version, 1);
    assert.equal(Object.hasOwn(body.workspace, "privateExtra"), false);
    return json({
      workspace: {
        ...body.workspace,
        revision: 1,
        updatedAt: serverTime,
        privateServerExtra: "drop-me",
      },
    });
  });
  const client = createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "swift.test" },
  });

  assert.deepEqual(await client.getStudyWorkspace(), {
    available: true,
    status: 200,
    data: null,
  });
  const result = await client.putStudyWorkspace(
    studyWorkspace({ privateExtra: "drop-me" }),
    { baseRevision: 0 },
  );
  assert.equal(result.available, true);
  assert.equal(result.data.revision, 1);
  assert.equal(result.data.updatedAt, serverTime);
  assert.equal(Object.hasOwn(result.data, "privateServerExtra"), false);
  assert.equal(mock.calls[1].url, "/api/v1/study/workspace");
  assert.equal(mock.calls[1].init.method, "PUT");
  assert.equal(mock.calls[1].init.credentials, "same-origin");
});

test("study workspace transport rejects oversized input and surfaces bounded revision conflicts", async () => {
  let calls = 0;
  const current = studyWorkspace({
    revision: 3,
    updatedAt: "2026-07-28T12:45:00.000Z",
  });
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () => {
      calls += 1;
      return json(
        {
          error: {
            code: "REVISION_CONFLICT",
            message: "private diagnostic",
          },
          current: { revision: 3, workspace: current },
        },
        409,
      );
    },
  });
  assert.deepEqual(
    await client.putStudyWorkspace(
      studyWorkspace({ oversized: "x".repeat(CLOUD_LIMITS.maxStudyWorkspaceBytes) }),
      { baseRevision: 0 },
    ),
    { available: false, reason: "invalid-request" },
  );
  assert.equal(calls, 0);

  const conflict = await client.putStudyWorkspace(studyWorkspace(), {
    baseRevision: 2,
  });
  assert.deepEqual(conflict, {
    available: false,
    reason: "revision-conflict",
    status: 409,
    conflict: { revision: 3, workspace: current },
  });
  assert.equal(JSON.stringify(conflict).includes("private diagnostic"), false);
});

test("study workspace responses fail closed on mismatched revision metadata", async () => {
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () =>
      json({
        workspace: studyWorkspace({
          revision: 2,
          updatedAt: "not-a-date",
        }),
      }),
  });
  assert.deepEqual(await client.getStudyWorkspace(), {
    available: false,
    reason: "invalid-response",
    status: 200,
  });
});

test("study workspace API requires auth, keeps GET read-only and private, and returns the current conflict snapshot", async () => {
  const worker = await builtWorker();
  const db = inMemoryStudyDatabase();
  const capabilityResponse = await worker.fetch(
    new Request("http://localhost/api/v1/capabilities"),
    { DB: db },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(capabilityResponse.status, 200);
  assert.equal((await capabilityResponse.json()).studySync, true);
  const unauthenticated = await callStudyApi(worker, db, "GET");
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).error.code, "AUTH_REQUIRED");

  const initial = await callStudyApi(
    worker,
    db,
    "GET",
    "alice@example.com",
  );
  assert.equal(initial.status, 200);
  assert.deepEqual(await initial.json(), { workspace: null });
  assert.equal(db.profiles.size, 0, "GET must not create a profile");

  const created = await callStudyApi(
    worker,
    db,
    "PUT",
    "alice@example.com",
    { baseRevision: 0, workspace: studyWorkspace() },
  );
  assert.equal(created.status, 200);
  const createdWorkspace = (await created.json()).workspace;
  assert.equal(createdWorkspace.revision, 1);
  assert.equal(db.profiles.size, 1);
  assert.equal([...db.profiles.values()][0].is_public, 0);

  const otherUser = await callStudyApi(
    worker,
    db,
    "GET",
    "bob@example.com",
  );
  assert.equal(otherUser.status, 200);
  assert.deepEqual(await otherUser.json(), { workspace: null });
  assert.equal(db.profiles.size, 1, "another user's GET must remain read-only");

  const stale = await callStudyApi(
    worker,
    db,
    "PUT",
    "alice@example.com",
    { baseRevision: 0, workspace: studyWorkspace() },
  );
  assert.equal(stale.status, 409);
  const conflict = await stale.json();
  assert.equal(conflict.error.code, "REVISION_CONFLICT");
  assert.equal(conflict.current.revision, 1);
  assert.deepEqual(conflict.current.workspace, createdWorkspace);

  const updated = await callStudyApi(
    worker,
    db,
    "PUT",
    "alice@example.com",
    { baseRevision: 1, workspace: createdWorkspace },
  );
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).workspace.revision, 2);
});

test("private progress API is authenticated, source-free, and revision guarded", async () => {
  const worker = await builtWorker();
  const db = inMemoryStudyDatabase();
  const unauthenticated = await callProgressApi(worker, db, "GET");
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json()).error.code, "AUTH_REQUIRED");

  const initial = await callProgressApi(worker, db, "GET", "alice@example.com");
  assert.equal(initial.status, 200);
  assert.deepEqual(await initial.json(), { snapshot: null });
  assert.equal(db.profiles.size, 0, "GET must not create a profile");

  const sourceful = progressSnapshot();
  sourceful.attempts[0].source = "private source must not survive";
  const created = await callProgressApi(
    worker,
    db,
    "PUT",
    "alice@example.com",
    { baseRevision: 0, snapshot: sourceful },
  );
  assert.equal(created.status, 200);
  const createdSnapshot = (await created.json()).snapshot;
  assert.equal(createdSnapshot.revision, 1);
  assert.equal("source" in createdSnapshot.attempts[0], false);
  assert.equal(db.profiles.size, 1);

  const stale = await callProgressApi(
    worker,
    db,
    "PUT",
    "alice@example.com",
    { baseRevision: 0, snapshot: sourceful },
  );
  assert.equal(stale.status, 409);
  const conflict = await stale.json();
  assert.equal(conflict.error.code, "PROGRESS_REVISION_CONFLICT");
  assert.equal(conflict.current.revision, 1);
  assert.equal("source" in conflict.current.snapshot.attempts[0], false);
});

test("missing local endpoints and transport errors resolve without throwing", async () => {
  const missing = createCloudClient({
    fetchImpl: async () => json({ error: "missing" }, 404),
    location: { hostname: "localhost" },
  });
  assert.deepEqual(await missing.session(), {
    available: false,
    reason: "unsupported",
    status: 404,
  });

  const offline = createCloudClient({
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
    location: { hostname: "localhost" },
  });
  assert.deepEqual(await offline.capabilities(), {
    available: false,
    reason: "offline",
  });

  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await offline.capabilities({ signal: controller.signal }), {
    available: false,
    reason: "aborted",
  });
});

test("session preserves private identity fields without mixing them into public users", async () => {
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () =>
      json({
        authenticated: true,
        user: {
          id: "internal-id",
          displayName: "Kevin",
          email: "KEVIN@EXAMPLE.COM",
        },
        profile: {
          handle: "kevin-swift",
          displayName: "Kevin",
          bio: null,
          timezone: null,
          isPublic: false,
          shareActivity: false,
          showOnLeaderboards: false,
        },
      }),
  });
  const result = await client.session();
  assert.equal(result.available, true);
  assert.deepEqual(result.data.user, {
    id: "internal-id",
    displayName: "Kevin",
    email: "kevin@example.com",
  });
  assert.equal(result.data.profile.handle, "kevin-swift");
});

test("authenticated sessions without a stable user id fail closed", async () => {
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () =>
      json({
        authenticated: true,
        user: { displayName: "Missing identity" },
        profile: { handle: "should-not-load", isPublic: false },
      }),
  });
  const result = await client.session();
  assert.equal(result.available, true);
  assert.deepEqual(result.data, {
    authenticated: false,
    user: null,
    profile: null,
  });
});

test("profile patches are trimmed, bounded, and invalid patches never fetch", async () => {
  const mock = recorder((_url, init) =>
    json({
      profile: {
        handle: "kevin-swift",
        displayName: null,
        bio: null,
        timezone: "America/Los_Angeles",
        isPublic: false,
        shareActivity: false,
        showOnLeaderboards: false,
        shareCommunity: false,
        persisted: true,
        updatedAt: "2026-07-25T20:00:00.000Z",
        ...JSON.parse(init.body),
      },
    }),
  );
  const client = createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "swift.test" },
  });
  const invalid = await client.patchProfile({ handle: "not--valid" });
  assert.deepEqual(invalid, { available: false, reason: "invalid-request" });
  assert.equal(mock.calls.length, 0);

  const result = await client.patchProfile({
    handle: " Kevin-Swift ",
    displayName: `  ${"A".repeat(80)}  `,
    bio: ` ${"B".repeat(200)} `,
    isPublic: true,
    shareActivity: true,
    showOnLeaderboards: true,
    timezone: " America/Los_Angeles ",
  });
  assert.equal(result.available, true);
  const call = mock.calls[0];
  assert.equal(call.url, "/api/v1/profile");
  assert.equal(call.init.method, "PATCH");
  assert.equal(call.init.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(call.init.body), {
    handle: "kevin-swift",
    displayName: "A".repeat(48),
    bio: "B".repeat(160),
    isPublic: true,
    shareActivity: true,
    showOnLeaderboards: true,
    timezone: "America/Los_Angeles",
  });
});

test("public profiles use validated handles and map private or missing rows to not-public", async () => {
  const mock = recorder((url, _init, call) =>
    call === 1
      ? json({
          profile: {
            handle: "kevin-swift",
            displayName: "Kevin",
            bio: "iOS learner",
            email: "must-not-leak@example.com",
            isPublic: true,
            stats: { completedAttempts: 12, highestStage: 5 },
          },
        })
      : json({ error: { code: "not_public" } }, 404),
  );
  const client = createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "swift.test" },
  });
  assert.deepEqual(await client.publicProfile(" Kevin-Swift "), {
    available: true,
    status: 200,
    data: {
      handle: "kevin-swift",
      displayName: "Kevin",
      bio: "iOS learner",
      stats: { completedAttempts: 12, highestStage: 5 },
    },
  });
  assert.equal(mock.calls[0].url, "/api/v1/profiles/kevin-swift");
  assert.deepEqual(await client.publicProfile("private-user"), {
    available: false,
    reason: "not-public",
    status: 404,
  });
  assert.deepEqual(await client.publicProfile("not--valid"), {
    available: false,
    reason: "invalid-request",
  });
});

test("profile handle conflicts surface status without copying server details", async () => {
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () =>
      json(
        { error: { code: "HANDLE_TAKEN", message: "private diagnostic" } },
        409,
      ),
  });
  const result = await client.patchProfile({ handle: "taken-handle" });
  assert.deepEqual(result, {
    available: false,
    reason: "request-failed",
    status: 409,
  });
  assert.equal(JSON.stringify(result).includes("private diagnostic"), false);
});

test("attempt batches are deduplicated, capped, normalized, and omit client WPM", async () => {
  const privateMockSentinel = "PRIVATE_MOCK_NOTEBOOK_SENTINEL";
  let sent;
  const mock = recorder((_url, init) => {
    sent = JSON.parse(init.body);
    return json({
      accepted: sent.attempts.map((entry) => entry.id),
      duplicates: [],
      rejected: [],
      serverTime: "2026-07-25T20:02:00.000Z",
    });
  });
  const client = createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "swift.test" },
  });
  const oversized = [
    { nope: true },
    attempt(0, {
      stage: 99,
      accuracy: 300,
      durationMs: -2,
      wpm: 999,
      notebook: { approach: privateMockSentinel },
      mockProblems: [{ source: privateMockSentinel }],
      checkpoints: { codingStarted: 12 },
      debrief: { nextStep: privateMockSentinel },
    }),
    attempt(0),
    ...Array.from({ length: 70 }, (_, index) => attempt(index + 1)),
  ];
  const result = await client.postAttemptBatch(oversized, { maximum: 3 });
  assert.equal(result.available, true);
  assert.equal(mock.calls[0].url, "/api/v1/attempts/batch");
  assert.equal(mock.calls[0].init.method, "POST");
  assert.equal(sent.attempts.length, 3);
  assert.deepEqual(
    sent.attempts.map((entry) => entry.id),
    ["attempt-0", "attempt-1", "attempt-2"],
  );
  assert.equal(sent.attempts[0].stage, 5);
  assert.equal(sent.attempts[0].accuracy, 96.77);
  assert.equal(sent.attempts[0].durationMs, 60_000);
  assert.equal(sent.attempts[0].itemTitle, "Attempt 0");
  assert.equal(sent.attempts[0].typedChars, 300);
  assert.equal(Object.hasOwn(sent.attempts[0], "wpm"), false);
  assert.equal(Object.hasOwn(sent.attempts[0], "keyErrors"), false);
  assert.equal(Object.hasOwn(sent.attempts[0], "lineErrors"), false);
  assert.equal(Object.hasOwn(sent.attempts[0], "timeline"), false);
  assert.equal(JSON.stringify(sent).includes(privateMockSentinel), false);
  assert.equal(Object.hasOwn(sent.attempts[0], "notebook"), false);
  assert.equal(Object.hasOwn(sent.attempts[0], "mockProblems"), false);
  assert.equal(Object.hasOwn(sent.attempts[0], "checkpoints"), false);
  assert.equal(Object.hasOwn(sent.attempts[0], "debrief"), false);
});

test("Python built-ins are eligible for the same defensive upload path", async () => {
  let sent;
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body);
      return json({
        accepted: ["attempt-python"],
        duplicates: [],
        rejected: [],
        serverTime: "2026-07-25T20:02:00.000Z",
      });
    },
  });
  const result = await client.postAttemptBatch([
    attempt(1, {
      id: "attempt-python",
      itemId: "python:1",
      track: "interview",
      titleSnapshot: "Two Sum in Python",
    }),
  ]);
  assert.equal(result.available, true);
  assert.equal(sent.attempts[0].itemId, "python:1");
  assert.equal(sent.attempts[0].track, "interview");
});

test("server-backed Swift IDs pass cloud upload and leaderboard validation", async () => {
  let sent;
  const mock = recorder((url, init) => {
    if (url === "/api/v1/attempts/batch") {
      sent = JSON.parse(init.body);
      return json({ accepted: ["attempt-swift"], duplicates: [], rejected: [] });
    }
    if (url.startsWith("/api/v1/community/recent")) {
      return json({
        entries: [
          {
            user: { displayName: "Swift learner" },
            itemId: "swift:swift-two-sum",
            itemRevision: 1,
            itemTitle: "Two Sum in Swift",
            track: "interview",
            stage: 5,
            wpm: 50,
            accuracy: 98,
            durationMs: 60_000,
            completedAt: "2026-07-25T20:01:00Z",
          },
        ],
      });
    }
    return json({
      itemId: "swift:swift-two-sum",
      itemRevision: 1,
      stage: 5,
      entries: [],
    });
  });
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: mock.fetchImpl,
  });
  const upload = await client.postAttemptBatch([
    attempt(0, {
      id: "attempt-swift",
      itemId: "swift:swift-two-sum",
      track: "interview",
    }),
  ]);
  assert.equal(upload.available, true);
  assert.equal(sent.attempts[0].itemId, "swift:swift-two-sum");

  const recent = await client.communityRecent();
  assert.equal(recent.available, true);
  assert.equal(recent.data.entries[0].itemId, "swift:swift-two-sum");

  const leaderboard = await client.itemLeaderboard("swift:swift-two-sum", {
    itemRevision: 1,
    stage: 5,
  });
  assert.equal(leaderboard.available, true);
  assert.equal(leaderboard.data.itemId, "swift:swift-two-sum");
  assert.equal(
    mock.calls[2].url,
    "/api/v1/leaderboards/items/swift%3Aswift-two-sum?limit=25&itemRevision=1&stage=5&mode=strict",
  );
});

test("community results drop malformed rows and bound fields and limits", async () => {
  const mock = recorder(() =>
    json({
      entries: [
        {
          user: { id: "must-not-survive", displayName: `  ${"K".repeat(80)} ` },
          itemId: "ios:actor-cache",
          itemRevision: 3,
          itemTitle: "Actor cache",
          track: "ios",
          stage: 9,
          wpm: 5_000,
          accuracy: 105,
          durationMs: 5000,
          completedAt: "2026-07-25T20:01:00Z",
        },
        { malformed: true },
      ],
      nextCursor: " cursor-2 ",
    }),
  );
  const result = await createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "swift.test" },
  }).communityRecent({ limit: 999 });
  assert.equal(result.available, true);
  assert.equal(mock.calls[0].url, "/api/v1/community/recent?limit=50");
  assert.equal(result.data.entries.length, 1);
  assert.equal(result.data.entries[0].user.displayName, "K".repeat(50));
  assert.deepEqual(Object.keys(result.data.entries[0].user), ["displayName"]);
  assert.equal(result.data.entries[0].stage, 5);
  assert.equal(result.data.entries[0].wpm, 1_000);
  assert.equal(result.data.entries[0].accuracy, 100);
  assert.equal(result.data.nextCursor, "cursor-2");
});

test("item and daily leaderboard helpers encode identifiers and keep server ranks", async () => {
  const mock = recorder((url) => {
    if (url.startsWith("/api/v1/leaderboards/items/"))
      return json({
        itemId: "ios:actor-cache",
        itemRevision: 4,
        stage: 5,
        entries: [
          {
            rank: 7,
            user: { displayName: "Ada" },
            wpm: 82,
            accuracy: 99,
            itemRevision: 4,
            stage: 5,
            completedAt: "2026-07-25T20:01:00Z",
          },
        ],
      });
    return json({
      date: "2026-07-25",
      challenge: {
        date: "2026-07-25",
        itemId: "builtin:1",
        itemRevision: 2,
        itemTitle: "Two Sum",
        track: "interview",
        stage: 1,
        mode: "strict",
      },
      entries: [
        {
          rank: 3,
          user: { displayName: "Grace" },
          score: 82,
          completions: 4,
          completed: 4,
          wpm: 82,
          accuracy: 98,
          averageAccuracy: 98,
          totalDurationMs: 240_000,
          minutes: 4,
          highestStage: 5,
        },
      ],
    });
  });
  const client = createCloudClient({
    fetchImpl: mock.fetchImpl,
    location: { hostname: "swift.test" },
  });
  const itemResult = await client.itemLeaderboard("ios:actor-cache", {
    limit: 2,
    itemRevision: 4,
    stage: 5,
  });
  assert.equal(itemResult.available, true);
  assert.equal(
    mock.calls[0].url,
    "/api/v1/leaderboards/items/ios%3Aactor-cache?limit=2&itemRevision=4&stage=5&mode=strict",
  );
  assert.equal(itemResult.data.itemRevision, 4);
  assert.equal(itemResult.data.stage, 5);
  assert.equal(itemResult.data.mode, "strict");
  assert.equal(itemResult.data.entries[0].rank, 7);
  assert.equal(itemResult.data.entries[0].itemRevision, 4);

  const dailyResult = await client.dailyLeaderboard("2026-07-25", {
    limit: 10,
  });
  assert.equal(dailyResult.available, true);
  assert.equal(
    mock.calls[1].url,
    "/api/v1/leaderboards/daily?date=2026-07-25&limit=10",
  );
  assert.deepEqual(dailyResult.data.challenge, {
    date: "2026-07-25",
    itemId: "builtin:1",
    itemRevision: 2,
    itemTitle: "Two Sum",
    track: "interview",
    stage: 1,
    mode: "strict",
  });
  assert.equal(dailyResult.data.entries[0].rank, 3);
  assert.equal(dailyResult.data.entries[0].averageAccuracy, 98);
  assert.equal(dailyResult.data.entries[0].accuracy, 98);
});

test("item leaderboards fail closed when the response is for another revision or stage", async () => {
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () =>
      json({
        itemId: "python:1",
        itemRevision: 2,
        stage: 4,
        entries: [],
      }),
  });

  assert.deepEqual(
    await client.itemLeaderboard("python:1", {
      itemRevision: 3,
      stage: 5,
    }),
    {
      available: false,
      reason: "invalid-response",
      status: 200,
    },
  );
});

test("exact item leaderboards require explicit response metadata and exclude mixed entries", async () => {
  let call = 0;
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () => {
      call += 1;
      if (call === 1) return json({ entries: [] });
      return json({
        itemId: "python:1",
        itemRevision: 3,
        stage: 5,
        entries: [
          {
            user: { displayName: "Exact" },
            itemRevision: 3,
            stage: 5,
            wpm: 70,
            accuracy: 99,
            durationMs: 60_000,
            completedAt: "2026-07-25T20:01:00Z",
          },
          {
            user: { displayName: "Missing revision" },
            stage: 5,
            wpm: 90,
            accuracy: 99,
            durationMs: 50_000,
            completedAt: "2026-07-25T20:02:00Z",
          },
          {
            user: { displayName: "Wrong stage" },
            itemRevision: 3,
            stage: 4,
            wpm: 80,
            accuracy: 99,
            durationMs: 55_000,
            completedAt: "2026-07-25T20:03:00Z",
          },
        ],
      });
    },
  });

  const missing = await client.itemLeaderboard("python:1", {
    itemRevision: 3,
    stage: 5,
  });
  assert.deepEqual(missing, {
    available: false,
    reason: "invalid-response",
    status: 200,
  });

  const exact = await client.itemLeaderboard("python:1", {
    itemRevision: 3,
    stage: 5,
  });
  assert.equal(exact.available, true);
  assert.deepEqual(
    exact.data.entries.map((entry) => entry.user.displayName),
    ["Exact"],
  );
});

test("invalid leaderboard identifiers and oversized or non-JSON responses fail closed", async () => {
  let calls = 0;
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () => {
      calls += 1;
      return new Response("<html>nope</html>", {
        headers: { "content-type": "text/html" },
      });
    },
  });
  assert.deepEqual(await client.itemLeaderboard("../../admin"), {
    available: false,
    reason: "invalid-request",
  });
  assert.deepEqual(await client.dailyLeaderboard("2026-02-31"), {
    available: false,
    reason: "invalid-request",
  });
  assert.equal(calls, 0);
  assert.deepEqual(await client.capabilities(), {
    available: false,
    reason: "invalid-response",
    status: 200,
  });
});
