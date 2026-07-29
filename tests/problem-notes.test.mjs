import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PROBLEM_NOTE_LIMITS,
  deleteProblemNote,
  normalizeProblemNotes,
  saveProblemNote,
} from "../app/lib/problem-notes.mjs";

const validItemIds = new Set(["python:1", "builtin:1", "custom:archived"]);
const revisions = new Map([["python:1", 3], ["builtin:1", 1], ["custom:archived", 7]]);

test("current state retains notes while preserving the complete fallback chain", async () => {
  const product = await readFile(new URL("../app/lib/product.ts", import.meta.url), "utf8");
  assert.match(product, /version: 33;/);
  assert.match(product, /problemNotes: ProblemNotes/);
  assert.match(product, /STORAGE_KEY = "swift-ghost-state-v33"/);
  assert.match(product, /THIRTY_SECOND_STORAGE_KEY = "swift-ghost-state-v32"/);
  assert.match(product, /THIRTY_FIRST_STORAGE_KEY = "swift-ghost-state-v31"/);
  assert.match(product, /THIRTIETH_STORAGE_KEY = "swift-ghost-state-v30"/);
  assert.match(product, /TWENTY_SIXTH_STORAGE_KEY = "swift-ghost-state-v26"/);
  assert.match(product, /TWENTY_FIFTH_STORAGE_KEY = "swift-ghost-state-v25"/);
  assert.match(product, /STATE_STORAGE_KEYS = \[\s+STORAGE_KEY,\s+THIRTY_SECOND_STORAGE_KEY,\s+THIRTY_FIRST_STORAGE_KEY,\s+THIRTIETH_STORAGE_KEY,\s+TWENTY_NINTH_STORAGE_KEY,\s+TWENTY_EIGHTH_STORAGE_KEY,\s+TWENTY_SEVENTH_STORAGE_KEY,\s+TWENTY_SIXTH_STORAGE_KEY,\s+TWENTY_FIFTH_STORAGE_KEY/);
  assert.match(product, /Number\(value\.version\) >= 26 \? value\.problemNotes : undefined/);
});

test("problem notes normalize bounded structured content and survive revision changes", () => {
  const notes = normalizeProblemNotes({
    "python:1": {
      itemId: "spoofed",
      itemRevision: 1,
      approach: "a".repeat(PROBLEM_NOTE_LIMITS.maxApproachLength + 20),
      pitfalls: "watch duplicates",
      complexity: "O(n)",
      updatedAt: "2026-07-28T12:00:00.000Z",
    },
    "missing:1": { approach: "discard me", updatedAt: "2026-07-28T12:00:00.000Z" },
    "builtin:1": { approach: "   ", pitfalls: "", complexity: "" },
  }, { validItemIds, revisions });

  assert.deepEqual(Object.keys(notes), ["python:1"]);
  assert.equal(notes["python:1"].itemId, "python:1");
  assert.equal(notes["python:1"].itemRevision, 1);
  assert.equal(notes["python:1"].approach.length, PROBLEM_NOTE_LIMITS.maxApproachLength);
});

test("save and delete keep notes current and empty-safe", () => {
  const saved = saveProblemNote({}, {
    itemId: "custom:archived",
    itemRevision: 1,
    approach: "Use an actor to isolate mutation.",
    pitfalls: "Do not await while holding stale assumptions.",
    complexity: "Lookup O(1)",
  }, { validItemIds, revisions, now: "2026-07-28T13:00:00.000Z" });
  assert.equal(saved["custom:archived"].itemRevision, 1);
  assert.equal(saved["custom:archived"].updatedAt, "2026-07-28T13:00:00.000Z");
  const withUnrelated = saveProblemNote(saved, {
    itemId: "python:1",
    itemRevision: 3,
    approach: "Hash seen values.",
    pitfalls: "Check before insert.",
    complexity: "O(n)",
  }, { validItemIds, now: "2026-07-28T14:00:00.000Z" });
  assert.equal(withUnrelated["custom:archived"].approach, saved["custom:archived"].approach);
  assert.ok(deleteProblemNote(withUnrelated, "python:1", { validItemIds })["custom:archived"]);
  assert.deepEqual(deleteProblemNote(saved, "custom:archived", { validItemIds }), {});

  const empty = saveProblemNote({}, {
    itemId: "python:1",
    itemRevision: 3,
    approach: " ",
    pitfalls: "",
    complexity: "",
  }, { validItemIds, revisions });
  assert.deepEqual(empty, {});
});

test("normalization enforces the record count cap by most recent update", () => {
  const manyIds = new Set();
  const manyRevisions = new Map();
  const raw = {};
  for (let index = 0; index < PROBLEM_NOTE_LIMITS.maxNotes + 15; index += 1) {
    const itemId = `custom:${index}`;
    manyIds.add(itemId);
    manyRevisions.set(itemId, 1);
    raw[itemId] = {
      itemRevision: 1,
      approach: `note ${index}`,
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    };
  }
  const notes = normalizeProblemNotes(raw, { validItemIds: manyIds, revisions: manyRevisions });
  assert.equal(Object.keys(notes).length, PROBLEM_NOTE_LIMITS.maxNotes);
  assert.ok(notes[`custom:${PROBLEM_NOTE_LIMITS.maxNotes + 14}`]);
  assert.equal(notes["custom:0"], undefined);
});

test("normalization enforces an aggregate UTF-8 storage budget", () => {
  const manyIds = new Set();
  const manyRevisions = new Map();
  const raw = {};
  for (let index = 0; index < 100; index += 1) {
    const itemId = `custom:wide-${index}`;
    manyIds.add(itemId);
    manyRevisions.set(itemId, 1);
    raw[itemId] = {
      itemRevision: 1,
      approach: "ðŸ§ ".repeat(PROBLEM_NOTE_LIMITS.maxApproachLength / 2),
      pitfalls: "è¾¹".repeat(PROBLEM_NOTE_LIMITS.maxPitfallsLength),
      complexity: "O(n)",
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    };
  }
  const notes = normalizeProblemNotes(raw, { validItemIds: manyIds, revisions: manyRevisions });
  const encodedBytes = new TextEncoder().encode(JSON.stringify(Object.entries(notes))).byteLength;
  assert.ok(encodedBytes <= PROBLEM_NOTE_LIMITS.maxTotalBytes);
  assert.ok(Object.keys(notes).length < 100);
});
