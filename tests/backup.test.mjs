import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_KIND,
  backupInventory,
  createBackupEnvelope,
  hasMeaningfulBackupState,
  readBackupPayload,
} from "../app/lib/backup.mjs";

const state = {
  version: 31,
  attempts: [{ id: "a" }],
  settings: {},
  lastItemId: "two-sum",
  customItems: [{ itemId: "custom" }],
  sessionHistory: [{ id: "session" }],
  favorites: [],
  learningEvents: [],
  problemNotes: { "two-sum": { body: "review" } },
  solutionReviews: [{ id: "review" }],
  submissionLog: { receipts: [{ id: "submission" }] },
  studyWorkspace: { collections: [{ id: "c" }], plans: [{ id: "p" }] },
  interviewStudio: { history: [{ id: "i" }], active: null },
  assessments: { history: [{ id: "assessment" }], active: null },
  virtualRoundWorkspace: { history: [{ id: "round" }], active: null },
  patternLearning: {
    reviews: [{ lessonId: "pattern:arrays-hashing" }],
    decisionAttempts: [{ id: "decision" }],
  },
  testDesign: {
    attempts: [{ id: "test-design-attempt" }],
    drafts: [{ probeId: "test-design:two-sum-distinct-index" }],
    activeSprint: { id: "test-design-sprint", status: "active" },
  },
  typingProgress: {
    records: [{ itemId: "two-sum", itemRevision: 1 }],
  },
  conceptTransfer: {
    attempts: [{ id: "concept-transfer-attempt" }],
    drafts: [{ attemptId: "concept-transfer-attempt" }],
    activeAttemptId: "concept-transfer-attempt",
  },
  attemptClosures: {
    closures: [{ id: "closure:submission:failed" }],
  },
};

test("round trips a versioned backup envelope", () => {
  const envelope = createBackupEnvelope(state, "2026-07-28T12:00:00.000Z");
  assert.equal(envelope.kind, BACKUP_KIND);
  assert.equal(envelope.stateVersion, 31);
  assert.equal(envelope.exportedAt, "2026-07-28T12:00:00.000Z");
  const restored = readBackupPayload(envelope, [30, 31]);
  assert.equal(restored.envelope, true);
  assert.equal(restored.exportedAt, envelope.exportedAt);
  assert.equal(restored.payload, state);
});

test("reports a human-checkable inventory", () => {
  assert.deepEqual(backupInventory(state), {
    attempts: 1,
    submissions: 1,
    sessions: 1,
    customItems: 1,
    notes: 1,
    reviews: 1,
    assessments: 1,
    interviews: 1,
    virtualRounds: 1,
    plans: 1,
    collections: 1,
    patternReviews: 1,
    patternDecisions: 1,
    testDesignAttempts: 1,
    testDesignDrafts: 1,
    activeTestDesignSprints: 1,
    typingProgressRecords: 1,
    conceptTransferAttempts: 1,
    conceptTransferDrafts: 1,
    activeConceptTransferAttempts: 1,
    attemptClosures: 1,
  });
  assert.equal(hasMeaningfulBackupState(state), true);
  assert.equal(hasMeaningfulBackupState({ version: 31 }), false);
  assert.equal(
    hasMeaningfulBackupState({
      version: 31,
      patternLearning: { reviews: [{ lessonId: "pattern:trees" }] },
    }),
    true,
  );
  assert.equal(
    hasMeaningfulBackupState({
      version: 31,
      testDesign: { attempts: [], drafts: [{ probeId: "draft-only" }] },
    }),
    true,
  );
  assert.equal(
    hasMeaningfulBackupState({
      version: 31,
      testDesign: {
        attempts: [],
        drafts: [],
        activeSprint: { id: "active-only", status: "active" },
      },
    }),
    true,
  );
  assert.equal(
    backupInventory({
      testDesign: { activeSprint: { id: "finished", status: "completed" } },
    }).activeTestDesignSprints,
    0,
  );
  assert.equal(
    hasMeaningfulBackupState({
      version: 31,
      typingProgress: { records: [{ itemId: "typing-only" }] },
    }),
    true,
  );
  assert.equal(
    hasMeaningfulBackupState({
      version: 31,
      conceptTransfer: { attempts: [{ id: "attempt-only" }], drafts: [] },
    }),
    true,
  );
  assert.equal(
    hasMeaningfulBackupState({
      version: 31,
      conceptTransfer: { attempts: [], drafts: [{ attemptId: "draft-only" }] },
    }),
    true,
  );
  assert.equal(
    hasMeaningfulBackupState({
      version: 31,
      conceptTransfer: {
        attempts: [{ id: "active-only" }],
        drafts: [],
        activeAttemptId: "active-only",
      },
    }),
    true,
  );
  assert.equal(
    backupInventory({
      conceptTransfer: {
        attempts: [{ id: "finished", finishedAt: "2026-07-28T12:00:00.000Z" }],
        activeAttemptId: "finished",
      },
    }).activeConceptTransferAttempts,
    0,
  );
  assert.equal(
    backupInventory({
      conceptTransfer: {
        attempts: [{ id: "retired", retired: true }],
        activeAttemptId: "retired",
      },
    }).activeConceptTransferAttempts,
    0,
  );
  assert.equal(
    backupInventory({
      conceptTransfer: {
        attempts: [{ id: "different" }],
        activeAttemptId: "missing",
      },
    }).activeConceptTransferAttempts,
    0,
  );
  assert.equal(
    hasMeaningfulBackupState({
      version: 33,
      attemptClosures: { closures: [{ id: "closure-only" }] },
    }),
    true,
  );
  assert.equal(
    backupInventory({ attemptClosures: { closures: "invalid" } })
      .attemptClosures,
    0,
  );
});

test("accepts plausible legacy raw states and rejects version-only impostors", () => {
  assert.equal(readBackupPayload(state, [30, 31]).envelope, false);
  assert.deepEqual(
    readBackupPayload(
      {
        version: 33,
        settings: {},
        attempts: [],
        attemptClosures: { closures: [{ id: "closure-only" }] },
      },
      [33],
    ),
    {
      envelope: false,
      exportedAt: undefined,
      payload: {
        version: 33,
        settings: {},
        attempts: [],
        attemptClosures: { closures: [{ id: "closure-only" }] },
      },
    },
  );
  assert.equal(readBackupPayload({ version: 29 }, [30, 31]), undefined);
  assert.equal(readBackupPayload({ ...state, version: 1 }, [30, 31]), undefined);
  assert.equal(
    readBackupPayload(
      { kind: BACKUP_KIND, envelopeVersion: 99, payload: state },
      [30, 31],
    ),
    undefined,
  );
});
