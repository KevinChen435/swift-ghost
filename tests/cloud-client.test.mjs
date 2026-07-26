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
    ...overrides,
  };
}

test("GitHub Pages mode is deliberately quiet and unavailable", async () => {
  let calls = 0;
  const client = createCloudClient({
    location: { hostname: "kevinchen435.github.io" },
    fetchImpl: async () => { calls += 1; throw new Error("must not fetch"); },
  });
  assert.deepEqual(await client.capabilities(), { available: false, reason: "disabled" });
  assert.equal(calls, 0);
});

test("capabilities uses a same-origin, abortable request and bounds its response", async () => {
  const controller = new AbortController();
  const mock = recorder(() => json({ data: {
    apiVersion: "v1-with-an-unreasonably-long-suffix",
    cloudSync: true,
    community: true,
    leaderboards: true,
    auth: "session",
    maxAttemptBatch: 5_000,
  } }));
  const result = await createCloudClient({ fetchImpl: mock.fetchImpl, location: { hostname: "swift.test" } }).capabilities({ signal: controller.signal });
  assert.equal(result.available, true);
  assert.deepEqual(result.data, {
    apiVersion: "v1-with-an-unrea",
    cloudSync: true,
    community: true,
    leaderboards: true,
    auth: "session",
    maxAttemptBatch: CLOUD_LIMITS.maxAttemptBatch,
    privacy: { profileDefault: "private", activityDefault: "off", leaderboardsDefault: "off" },
  });
  assert.equal(mock.calls[0].url, "/api/v1/capabilities");
  assert.equal(mock.calls[0].init.credentials, "same-origin");
  assert.equal(mock.calls[0].init.cache, "no-store");
  assert.equal(mock.calls[0].init.signal, controller.signal);
});

test("missing local endpoints and transport errors resolve without throwing", async () => {
  const missing = createCloudClient({ fetchImpl: async () => json({ error: "missing" }, 404), location: { hostname: "localhost" } });
  assert.deepEqual(await missing.session(), { available: false, reason: "unsupported", status: 404 });

  const offline = createCloudClient({ fetchImpl: async () => { throw new TypeError("fetch failed"); }, location: { hostname: "localhost" } });
  assert.deepEqual(await offline.capabilities(), { available: false, reason: "offline" });

  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await offline.capabilities({ signal: controller.signal }), { available: false, reason: "aborted" });
});

test("session preserves private identity fields without mixing them into public users", async () => {
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () => json({
      authenticated: true,
      user: { id: "internal-id", displayName: "Kevin", email: "KEVIN@EXAMPLE.COM" },
      profile: { handle: "kevin-swift", displayName: "Kevin", bio: null, timezone: null, isPublic: false, shareActivity: false, showOnLeaderboards: false },
    }),
  });
  const result = await client.session();
  assert.equal(result.available, true);
  assert.deepEqual(result.data.user, { id: "internal-id", displayName: "Kevin", email: "kevin@example.com" });
  assert.equal(result.data.profile.handle, "kevin-swift");
});

test("profile patches are trimmed, bounded, and invalid patches never fetch", async () => {
  const mock = recorder((_url, init) => json({ profile: {
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
  } }));
  const client = createCloudClient({ fetchImpl: mock.fetchImpl, location: { hostname: "swift.test" } });
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
  const mock = recorder((url, _init, call) => call === 1
    ? json({ profile: { handle: "kevin-swift", displayName: "Kevin", bio: "iOS learner", email: "must-not-leak@example.com", isPublic: true, stats: { completedAttempts: 12, highestStage: 5 } } })
    : json({ error: { code: "not_public" } }, 404));
  const client = createCloudClient({ fetchImpl: mock.fetchImpl, location: { hostname: "swift.test" } });
  assert.deepEqual(await client.publicProfile(" Kevin-Swift "), {
    available: true,
    status: 200,
    data: { handle: "kevin-swift", displayName: "Kevin", bio: "iOS learner", stats: { completedAttempts: 12, highestStage: 5 } },
  });
  assert.equal(mock.calls[0].url, "/api/v1/profiles/kevin-swift");
  assert.deepEqual(await client.publicProfile("private-user"), { available: false, reason: "not-public", status: 404 });
  assert.deepEqual(await client.publicProfile("not--valid"), { available: false, reason: "invalid-request" });
});

test("profile handle conflicts surface status without copying server details", async () => {
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () => json({ error: { code: "HANDLE_TAKEN", message: "private diagnostic" } }, 409),
  });
  const result = await client.patchProfile({ handle: "taken-handle" });
  assert.deepEqual(result, { available: false, reason: "request-failed", status: 409 });
  assert.equal(JSON.stringify(result).includes("private diagnostic"), false);
});

test("attempt batches are deduplicated, capped, normalized, and omit client WPM", async () => {
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
  const client = createCloudClient({ fetchImpl: mock.fetchImpl, location: { hostname: "swift.test" } });
  const oversized = [
    { nope: true },
    attempt(0, { stage: 99, accuracy: 300, durationMs: -2, wpm: 999 }),
    attempt(0),
    ...Array.from({ length: 70 }, (_, index) => attempt(index + 1)),
  ];
  const result = await client.postAttemptBatch(oversized, { maximum: 3 });
  assert.equal(result.available, true);
  assert.equal(mock.calls[0].url, "/api/v1/attempts/batch");
  assert.equal(mock.calls[0].init.method, "POST");
  assert.equal(sent.attempts.length, 3);
  assert.deepEqual(sent.attempts.map((entry) => entry.id), ["attempt-0", "attempt-1", "attempt-2"]);
  assert.equal(sent.attempts[0].stage, 5);
  assert.equal(sent.attempts[0].accuracy, 96.77);
  assert.equal(sent.attempts[0].durationMs, 60_000);
  assert.equal(sent.attempts[0].itemTitle, "Attempt 0");
  assert.equal(sent.attempts[0].typedChars, 300);
  assert.equal(Object.hasOwn(sent.attempts[0], "wpm"), false);
});

test("community results drop malformed rows and bound fields and limits", async () => {
  const mock = recorder(() => json({ entries: [
    { user: { id: "must-not-survive", displayName: `  ${"K".repeat(80)} ` }, itemId: "ios:actor-cache", itemRevision: 3, itemTitle: "Actor cache", track: "ios", stage: 9, wpm: 5_000, accuracy: 105, durationMs: 5000, completedAt: "2026-07-25T20:01:00Z" },
    { malformed: true },
  ], nextCursor: " cursor-2 " }));
  const result = await createCloudClient({ fetchImpl: mock.fetchImpl, location: { hostname: "swift.test" } }).communityRecent({ limit: 999 });
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
    if (url.startsWith("/api/v1/leaderboards/items/")) return json({ itemId: "ios:actor-cache", entries: [
      { rank: 7, user: { displayName: "Ada" }, wpm: 82, accuracy: 99, itemRevision: 4, completedAt: "2026-07-25T20:01:00Z" },
    ] });
    return json({
      date: "2026-07-25",
      challenge: { date: "2026-07-25", itemId: "builtin:1", itemRevision: 2, itemTitle: "Two Sum", track: "interview", stage: 1, mode: "strict" },
      entries: [{ rank: 3, user: { displayName: "Grace" }, score: 82, completions: 4, completed: 4, wpm: 82, accuracy: 98, averageAccuracy: 98, totalDurationMs: 240_000, minutes: 4, highestStage: 5 }],
    });
  });
  const client = createCloudClient({ fetchImpl: mock.fetchImpl, location: { hostname: "swift.test" } });
  const itemResult = await client.itemLeaderboard("ios:actor-cache", { limit: 2 });
  assert.equal(itemResult.available, true);
  assert.equal(mock.calls[0].url, "/api/v1/leaderboards/items/ios%3Aactor-cache?limit=2");
  assert.equal(itemResult.data.entries[0].rank, 7);
  assert.equal(itemResult.data.entries[0].itemRevision, 4);

  const dailyResult = await client.dailyLeaderboard("2026-07-25", { limit: 10 });
  assert.equal(dailyResult.available, true);
  assert.equal(mock.calls[1].url, "/api/v1/leaderboards/daily?date=2026-07-25&limit=10");
  assert.deepEqual(dailyResult.data.challenge, { date: "2026-07-25", itemId: "builtin:1", itemRevision: 2, itemTitle: "Two Sum", track: "interview", stage: 1, mode: "strict" });
  assert.equal(dailyResult.data.entries[0].rank, 3);
  assert.equal(dailyResult.data.entries[0].averageAccuracy, 98);
  assert.equal(dailyResult.data.entries[0].accuracy, 98);
});

test("invalid leaderboard identifiers and oversized or non-JSON responses fail closed", async () => {
  let calls = 0;
  const client = createCloudClient({
    location: { hostname: "swift.test" },
    fetchImpl: async () => { calls += 1; return new Response("<html>nope</html>", { headers: { "content-type": "text/html" } }); },
  });
  assert.deepEqual(await client.itemLeaderboard("../../admin"), { available: false, reason: "invalid-request" });
  assert.deepEqual(await client.dailyLeaderboard("2026-02-31"), { available: false, reason: "invalid-request" });
  assert.equal(calls, 0);
  assert.deepEqual(await client.capabilities(), { available: false, reason: "invalid-response", status: 200 });
});
