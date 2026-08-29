import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  currentSessionEntry,
  matchingSessionEntry,
  nextPendingSessionEntry,
  sessionEntryIdentity,
  sessionEntryMatches,
} from "../app/lib/session-integrity.mjs";

const identity = {
  itemId: "swift:two-sum",
  itemRevision: 3,
  stage: 5,
  practiceKind: "solving",
};

const session = {
  id: "session-1",
  currentIndex: 0,
  entries: [
    { ...identity, status: "pending" },
    {
      itemId: "swift:valid-parentheses",
      itemRevision: 2,
      stage: 5,
      practiceKind: "solving",
      status: "pending",
    },
  ],
};

test("session entry identity rejects every stale draft dimension", () => {
  assert.equal(sessionEntryMatches(session.entries[0], identity), true);
  for (const field of ["itemId", "itemRevision", "stage", "practiceKind"]) {
    const stale = {
      ...identity,
      [field]:
        field === "itemId"
          ? "swift:other"
          : field === "practiceKind"
            ? "typing"
            : identity[field] + 1,
    };
    assert.equal(
      sessionEntryMatches(session.entries[0], stale),
      false,
      `${field} mismatch must fail closed`,
    );
  }
  assert.equal(
    sessionEntryMatches(
      { ...session.entries[0], practiceKind: undefined },
      { ...identity, practiceKind: "typing" },
    ),
    true,
    "a missing persisted kind is legacy typing",
  );
  assert.equal(
    sessionEntryMatches(
      { ...session.entries[0], practiceKind: undefined },
      identity,
    ),
    false,
    "a missing persisted kind cannot satisfy solving",
  );
});

test("current and next navigation return exact entry index and revision", () => {
  assert.deepEqual(currentSessionEntry(session, sessionEntryIdentity(identity)), {
    index: 0,
    entry: session.entries[0],
  });
  assert.equal(
    matchingSessionEntry(session, 0, {
      ...identity,
      itemRevision: 4,
    }),
    null,
  );
  const next = nextPendingSessionEntry(session, 0);
  assert.deepEqual(next, { index: 1, entry: session.entries[1] });
  assert.equal(next.entry.itemRevision, 2);
});

test("SwiftGhostApp uses the guard for abandon, completion, skip, and result-next", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  assert.match(app, /currentSessionEntry\(\s*current\.activeSession[\s\S]*sessionEntryIdentity\(active\)/);
  assert.match(app, /if \(active\?\.sessionId && !draftSessionBinding\)/);
  assert.match(app, /if \(active\.sessionId && !draftSessionBinding\)/);
  assert.match(app, /draft: \{ \.\.\.active, sessionId: undefined \}/);
  assert.match(app, /attempt = \{ \.\.\.attempt, sessionId: undefined \}/);
  assert.match(app, /detachedFromSession/);
  assert.match(app, /nextPendingSessionEntry\(\s*completedSession/);
  assert.match(app, /sessionNext = \{\s*index: nextIndex,[\s\S]*itemRevision: nextEntry\.itemRevision/);
  assert.match(app, /matchingSessionEntry\(\s*session,[\s\S]*result\.sessionNext\.index/);
  assert.match(app, /matchingSessionEntry\(\s*session,[\s\S]*sessionEntryIdentity\(session\.entries\[session\.currentIndex\]\)/);
  assert.match(app, /false,\s*sessionNext\.index/);
});
