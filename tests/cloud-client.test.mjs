import assert from "node:assert/strict";
import test from "node:test";
import { CLOUD_LIMITS, createCloudClient } from "../app/lib/cloud.mjs";

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

function inMemoryStudyDatabase() {
  const profiles = new Map();
  const workspaces = new Map();
  return {
    profiles,
    workspaces,
    prepare(sql) {
      const statement = sql.replace(/\s+/g, " ").trim();
      return {
        bind(...values) {
          return {
            async first() {
              if (statement.includes("FROM study_workspaces"))
                return workspaces.get(values[0]) ?? null;
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
    },
    challenge: {
      key: "stable-window",
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
    id: "python-verified-baseline",
    revision: 1,
    title: "Verified Python checkpoint",
    description: "Server-selected Python evidence.",
    evidenceLabel: "Server-verified code evidence",
    language: "python",
  };
  const settled = {
    id: "verified-abc12345",
    status: "settled",
    verdict: "accepted",
    submittedAt: "2026-07-28T12:05:00.000Z",
    settledAt: "2026-07-28T12:05:01.000Z",
    result: {
      passed: 7,
      total: 7,
      durationMs: 83,
      runtime: "sandbox-python-3.13",
      authority: "server-isolated-python",
      contentRevision: 1,
      judgeRevision: 2,
      privateCases: ["must be dropped"],
    },
  };
  const mock = recorder((url, init, call) => {
    if (call === 1) return json({ program, entries: [assignment] });
    if (call === 2) {
      assert.deepEqual(JSON.parse(init.body), {
        clientRequestId: "assignment-request:abc12345",
      });
      return json({ assignment }, 201);
    }
    assert.deepEqual(JSON.parse(init.body), {
      clientSubmissionId: "submission:abc12345",
      source: "def longest_stable_window(nums, gap):\n    return len(nums)",
    });
    return json({ submission: settled }, 201);
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
  assert.equal(Object.hasOwn(submitted.data.result, "runtime"), false);
  assert.equal(
    mock.calls[2].url,
    "/api/v1/trusted/assignments/trusted-abc12345/submissions",
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
  assert.equal(mock.calls.length, 3);
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
