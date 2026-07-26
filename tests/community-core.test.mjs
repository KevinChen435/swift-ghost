import assert from "node:assert/strict";
import test from "node:test";
import {
  deterministicChallenge,
  isSameOrigin,
  normalizeProfilePatch,
  rankDailyRows,
  rankItemRows,
  redactCommunityRow,
  validateAttemptUpload,
  validateHandle,
} from "../app/lib/community-core.mjs";

const PRIVATE_PROFILE = {
  handle: "swift-learner",
  displayName: null,
  bio: null,
  timezone: null,
  isPublic: false,
  shareActivity: false,
  showOnLeaderboards: false,
};

const NOW = Date.parse("2026-07-25T20:00:00.000Z");
const validAttempt = {
  id: "attempt-1",
  itemId: "builtin:1",
  itemRevision: 1,
  title: "Two Sum",
  track: "interview",
  stage: 1,
  mode: "strict",
  completedAt: "2026-07-25T19:58:00.000Z",
  durationMs: 60_000,
  typedChars: 250,
  totalKeystrokes: 255,
  correctKeystrokes: 250,
  rejectedKeystrokes: 5,
  peeks: 0,
  accuracy: 98,
  outcome: "completed",
  qualification: "syntax",
};

test("private profiles force every public sharing flag off", () => {
  const next = normalizeProfilePatch({ shareActivity: true, showOnLeaderboards: true }, PRIVATE_PROFILE);
  assert.equal(next.isPublic, false);
  assert.equal(next.shareActivity, false);
  assert.equal(next.showOnLeaderboards, false);
});

test("shareCommunity is an explicit all-surfaces opt-in and opt-out", () => {
  const enabled = normalizeProfilePatch({ shareCommunity: true }, PRIVATE_PROFILE);
  assert.deepEqual(
    { public: enabled.isPublic, feed: enabled.shareActivity, ranks: enabled.showOnLeaderboards },
    { public: true, feed: true, ranks: true },
  );
  const disabled = normalizeProfilePatch({ shareCommunity: false }, enabled);
  assert.deepEqual(
    { public: disabled.isPublic, feed: disabled.shareActivity, ranks: disabled.showOnLeaderboards },
    { public: false, feed: false, ranks: false },
  );
});

test("profile text can be cleared without changing omitted fields", () => {
  const current = { ...PRIVATE_PROFILE, displayName: "Old name", bio: "Old bio", timezone: "America/Los_Angeles" };
  const next = normalizeProfilePatch({ displayName: "", bio: null, timezone: null }, current);
  assert.equal(next.displayName, null);
  assert.equal(next.bio, null);
  assert.equal(next.timezone, null);
  assert.equal(next.handle, current.handle);
});

test("handles are normalized and reject confusable separators", () => {
  assert.equal(validateHandle(" Swift-Coder "), "swift-coder");
  assert.throws(() => validateHandle("swift--coder"));
  assert.throws(() => validateHandle("ab"));
});

test("attempt validation computes trusted WPM and eligibility", () => {
  const result = validateAttemptUpload(validAttempt, NOW);
  assert.equal(result.ok, true);
  assert.equal(result.value.wpmBps, 5_000);
  assert.equal(result.value.rankingEligible, true);
  assert.equal(result.value.itemRevision, 1);
});

test("free, peeked, inaccurate, and implausibly fast passes never rank", () => {
  for (const attempt of [
    { ...validAttempt, mode: "free" },
    { ...validAttempt, peeks: 1 },
    { ...validAttempt, accuracy: 94.99 },
    { ...validAttempt, durationMs: 1_000 },
  ]) {
    const result = validateAttemptUpload(attempt, NOW);
    assert.equal(result.ok, true);
    assert.equal(result.value.rankingEligible, false);
  }
});

test("uploads reject abandoned, custom, stale-shaped, and future attempts", () => {
  const rejected = [
    { ...validAttempt, outcome: "abandoned" },
    { ...validAttempt, itemId: "custom:mine" },
    { ...validAttempt, itemRevision: 0 },
    { ...validAttempt, completedAt: "2026-07-26T00:00:01.000Z" },
    { ...validAttempt, challengeDate: "not-a-date" },
    { ...validAttempt, challengeDate: "2026-07-24" },
  ];
  for (const attempt of rejected) assert.equal(validateAttemptUpload(attempt, NOW).ok, false);
});

test("item ranking is exact-order and returns no account identifiers", () => {
  const ranked = rankItemRows([
    { displayName: "B", itemRevision: 1, stage: 1, wpmBps: 4_000, accuracyBps: 10_000, durationMs: 50_000, completedAt: NOW },
    { displayName: "A", itemRevision: 1, stage: 1, wpmBps: 5_000, accuracyBps: 9_500, durationMs: 60_000, completedAt: NOW },
  ]);
  assert.equal(ranked[0].user.displayName, "A");
  assert.equal(ranked[0].rank, 1);
  assert.equal("userId" in ranked[0], false);
  assert.equal("email" in ranked[0], false);
});

test("daily ranking prioritizes trusted WPM and exposes client summary fields", () => {
  const ranked = rankDailyRows([
    { displayName: "Slow", completions: 1, wpmBps: 4_000, averageAccuracyBps: 10_000, totalDurationMs: 90_000, highestStage: 1 },
    { displayName: "Fast", completions: 1, wpmBps: 6_000, averageAccuracyBps: 9_500, totalDurationMs: 60_000, highestStage: 1 },
  ]);
  assert.equal(ranked[0].user.displayName, "Fast");
  assert.equal(ranked[0].wpm, 60);
  assert.equal(ranked[0].accuracy, 95);
});

test("public activity projection is an allowlist", () => {
  const projected = redactCommunityRow({
    userId: "secret", email: "secret@example.com", clientAttemptId: "private",
    displayName: "Learner", itemId: "builtin:1", itemRevision: 1, itemTitle: "Two Sum",
    track: "interview", stage: 1, accuracyBps: 9_800, wpmBps: 5_200,
    durationMs: 60_000, completedAt: NOW,
  });
  assert.deepEqual(Object.keys(projected).sort(), [
    "accuracy", "completedAt", "durationMs", "itemId", "itemRevision", "itemTitle", "stage", "track", "user", "wpm",
  ]);
});

test("daily challenge selection is stable and always stage 1 strict", () => {
  const items = [
    { itemId: "builtin:1", itemRevision: 1, itemTitle: "One", track: "interview" },
    { itemId: "ios:actors", itemRevision: 2, itemTitle: "Actors", track: "ios" },
  ];
  const first = deterministicChallenge("2026-07-25", items);
  assert.deepEqual(first, deterministicChallenge("2026-07-25", items));
  assert.equal(first.stage, 1);
  assert.equal(first.mode, "strict");
});

test("CORS origin guard accepts absent or exact origins only", () => {
  assert.equal(isSameOrigin("https://swift.example/api/v1/session", null), true);
  assert.equal(isSameOrigin("https://swift.example/api/v1/session", "https://swift.example"), true);
  assert.equal(isSameOrigin("https://swift.example/api/v1/session", "https://evil.example"), false);
});
