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
  version: 27,
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
};

test("round trips a versioned backup envelope", () => {
  const envelope = createBackupEnvelope(state, "2026-07-28T12:00:00.000Z");
  assert.equal(envelope.kind, BACKUP_KIND);
  assert.equal(envelope.stateVersion, 27);
  assert.equal(envelope.exportedAt, "2026-07-28T12:00:00.000Z");
  const restored = readBackupPayload(envelope, [27]);
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
  });
  assert.equal(hasMeaningfulBackupState(state), true);
  assert.equal(hasMeaningfulBackupState({ version: 27 }), false);
});

test("accepts plausible legacy raw states and rejects version-only impostors", () => {
  assert.equal(readBackupPayload(state, [27]).envelope, false);
  assert.equal(readBackupPayload({ version: 27 }, [27]), undefined);
  assert.equal(readBackupPayload({ ...state, version: 1 }, [27]), undefined);
  assert.equal(
    readBackupPayload(
      { kind: BACKUP_KIND, envelopeVersion: 99, payload: state },
      [27],
    ),
    undefined,
  );
});
