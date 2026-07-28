import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("state v17 preserves multi-problem mock notebooks and debriefs", async () => {
  const product = await readFile(
    new URL("../app/lib/product.ts", import.meta.url),
    "utf8",
  );
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(product, /export type AppState = \{\s+version: 18;/);
  assert.match(product, /export const STORAGE_KEY = "swift-ghost-state-v18"/);
  assert.match(product, /SEVENTEENTH_STORAGE_KEY = "swift-ghost-state-v17"/);
  assert.match(product, /SIXTEENTH_STORAGE_KEY = "swift-ghost-state-v16"/);
  assert.match(product, /FIFTEENTH_STORAGE_KEY = "swift-ghost-state-v15"/);
  assert.match(product, /FOURTEENTH_STORAGE_KEY = "swift-ghost-state-v14"/);
  assert.match(product, /THIRTEENTH_STORAGE_KEY = "swift-ghost-state-v13"/);
  assert.match(product, /TWELFTH_STORAGE_KEY = "swift-ghost-state-v12"/);
  assert.match(product, /export const PREVIOUS_STORAGE_KEY = "swift-ghost-state-v11"/);
  assert.match(product, /SECOND_VERSION_STORAGE_KEY = "swift-ghost-state-v3"/);
  assert.match(product, /entries\.length === requestedProblemCount/);
  assert.match(product, /entry\.practiceKind === "solving"/);
  assert.match(product, /entry\.stage === 5/);
  assert.match(product, /if \(requestedKind === "mock" && !validMockEnvelope\) return null/);
  assert.match(product, /const rejectedMockSession = Boolean/);
  assert.match(product, /draft && !rejectedMockSession/);
  assert.match(product, /kind === "mock"\s+\? \{/);
  assert.match(product, /mockPreset: \(\["screen", "standard", "stretch"\] as const\)/);
  assert.match(product, /durationMinutes,\s+expiresAt,\s+problemCount/);
  assert.match(product, /2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17/);
  assert.match(product, /normalizeMockProblemWorkspace/);
  assert.match(product, /normalizeMockProblemWorkspaces/);
  assert.match(product, /normalizeMockDebrief/);
  assert.match(product, /const total = kind === "mock" \? problemCount : rawTotal/);
  assert.match(product, /MOCK_HISTORY_PAYLOAD_BYTE_LIMIT = 1024 \* 1024/);
  assert.match(product, /customCaseInput:/);
  assert.match(product, /customCaseInputs: Partial<Record<ItemId, string>>/);
  assert.match(product, /customCaseInputs\[draftItemId\] = draft\.customCaseInput/);
  assert.match(product, /customTestcases: Partial<Record<ItemId, CustomTestcaseCollection>>/);
  assert.match(product, /migrateLegacyCustomTestcases/);
  assert.match(product, /CUSTOM_TESTCASE_STATE_BYTE_LIMIT = 512_000/);
  assert.match(product, /submissions: Math\.round/);
  assert.match(product, /submissionHistory: SubmissionRecord\[\]/);
  assert.match(product, /normalizeSubmissionHistory/);

  assert.match(app, /expireMockInterviewRef/);
  assert.match(app, /mockInterviewRemainingMs\(session, now\) !== 0/);
  assert.match(app, /recordAbandon\(current\)/);
  assert.match(app, /sessionHistoryRecord\(archived, archived\.entries, "expired"\)/);
  assert.match(app, /selectMockInterviewItems/);
  assert.match(app, /withMockDraftSnapshot/);
  assert.match(app, /withMockCheckpoint/);
  assert.match(app, /setMockReviewSessionId/);
  assert.match(app, /<MockNotebook/);
  assert.match(app, /<MockDebriefDialog/);
  assert.match(app, /isRecordableChallengeResult/);
  assert.match(app, /purpose === "full" \? "full" : "submit"/);
});
