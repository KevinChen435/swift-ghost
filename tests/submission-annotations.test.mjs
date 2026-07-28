import assert from "node:assert/strict";
import test from "node:test";

import {
  SUBMISSION_ANNOTATION_TAGS,
  normalizeSubmissionAnnotations,
  pruneSubmissionAnnotations,
  updateSubmissionAnnotation,
} from "../app/lib/submission-annotations.mjs";

const EPOCH = "1970-01-01T00:00:00.000Z";
const NOW = "2026-07-28T19:30:00.000Z";

test("exports the complete frozen receipt annotation tag allowlist", () => {
  assert.deepEqual(SUBMISSION_ANNOTATION_TAGS, [
    "off-by-one",
    "syntax",
    "edge-case",
    "complexity",
    "review",
    "clean",
  ]);
  assert.equal(Object.isFrozen(SUBMISSION_ANNOTATION_TAGS), true);
  assert.equal(
    new Set(SUBMISSION_ANNOTATION_TAGS).size,
    SUBMISSION_ANNOTATION_TAGS.length,
  );
});

test("normalizes note, tags, timestamp, and exact public shape", () => {
  const normalized = normalizeSubmissionAnnotations(
    {
      receipt: {
        note: "  Check the empty input.  ",
        tags: [
          "clean",
          "syntax",
          "clean",
          "unsupported",
          "edge-case",
          "review",
          "complexity",
          "off-by-one",
        ],
        updatedAt: "2026-07-28T12:30:00-07:00",
        privateJudgeData: "must not copy",
      },
    },
    new Set(["receipt"]),
  );

  assert.deepEqual(normalized, {
    receipt: {
      note: "Check the empty input.",
      tags: ["off-by-one", "syntax", "edge-case", "complexity"],
      updatedAt: "2026-07-28T19:30:00.000Z",
    },
  });
  assert.deepEqual(Object.keys(normalized.receipt), [
    "note",
    "tags",
    "updatedAt",
  ]);
  assert.equal(JSON.stringify(normalized).includes("privateJudgeData"), false);
});

test("repairs malformed persistence deterministically and drops empty annotations", () => {
  const raw = {
    kept: { note: 17, tags: ["review"], updatedAt: "not-a-date" },
    empty: { note: "   ", tags: ["unknown"], updatedAt: NOW },
    scalar: "review",
    orphan: { note: "No receipt", tags: [], updatedAt: NOW },
  };
  const before = structuredClone(raw);
  const validIds = ["kept", "empty", "scalar"];
  const normalized = normalizeSubmissionAnnotations(raw, validIds);

  assert.deepEqual(normalized, {
    kept: { note: "", tags: ["review"], updatedAt: EPOCH },
  });
  assert.deepEqual(raw, before);
  assert.deepEqual(
    normalizeSubmissionAnnotations(normalized, validIds),
    normalized,
  );
});

test("rejects non-ISO and impossible calendar timestamps", () => {
  const normalized = normalizeSubmissionAnnotations(
    {
      prose: { note: "One", tags: [], updatedAt: "July 28, 2026" },
      impossible: {
        note: "Two",
        tags: [],
        updatedAt: "2026-02-30T12:00:00.000Z",
      },
      leapDay: {
        note: "Three",
        tags: [],
        updatedAt: "2024-02-29T12:00:00Z",
      },
    },
    ["prose", "impossible", "leapDay"],
  );

  assert.equal(normalized.prose.updatedAt, EPOCH);
  assert.equal(normalized.impossible.updatedAt, EPOCH);
  assert.equal(normalized.leapDay.updatedAt, "2024-02-29T12:00:00.000Z");
});

test("bounds notes by Unicode characters without splitting a surrogate pair", () => {
  const long = `  ${"x".repeat(1_199)}👻tail  `;
  const normalized = normalizeSubmissionAnnotations(
    { receipt: { note: long, tags: [], updatedAt: NOW } },
    ["receipt"],
  );
  assert.equal([...normalized.receipt.note].length, 1_200);
  assert.equal(normalized.receipt.note.endsWith("👻"), true);
});

test("keeps only the newest two hundred record entries", () => {
  const raw = Object.fromEntries(
    Array.from({ length: 205 }, (_, index) => [
      `submission-${index}`,
      { note: `Note ${index}`, tags: [], updatedAt: NOW },
    ]),
  );
  const snapshot = structuredClone(raw);
  const validIds = new Set(Object.keys(raw));
  const normalized = normalizeSubmissionAnnotations(raw, validIds);

  assert.equal(Object.keys(normalized).length, 200);
  assert.equal("submission-0" in normalized, false);
  assert.equal("submission-4" in normalized, false);
  assert.equal(normalized["submission-5"].note, "Note 5");
  assert.equal(normalized["submission-204"].note, "Note 204");
  assert.deepEqual(raw, snapshot);
});

test("a partial edit preserves omitted fields from an entry outside the repair cap", () => {
  const current = Object.fromEntries(
    Array.from({ length: 201 }, (_, index) => [
      `submission-${index}`,
      {
        note: `Note ${index}`,
        tags: index === 0 ? ["review"] : [],
        updatedAt: NOW,
      },
    ]),
  );
  const updated = updateSubmissionAnnotation(
    current,
    "submission-0",
    { tags: ["clean"] },
    { validSubmissionIds: Object.keys(current), now: NOW },
  );

  assert.equal(Object.keys(updated).length, 200);
  assert.deepEqual(updated["submission-0"], {
    note: "Note 0",
    tags: ["clean"],
    updatedAt: NOW,
  });
});

test("updates one receipt immutably while preserving omitted fields", () => {
  const current = {
    first: {
      note: "Original",
      tags: ["syntax", "review"],
      updatedAt: "2026-07-27T12:00:00.000Z",
    },
    second: { note: "Keep", tags: [], updatedAt: NOW },
  };
  const patch = { tags: ["clean", "clean", "bad", "off-by-one"] };
  const before = structuredClone(current);
  const patchBefore = structuredClone(patch);
  const updated = updateSubmissionAnnotation(current, "first", patch, {
    validSubmissionIds: new Set(["first", "second"]),
    now: "2026-07-28T12:30:00-07:00",
  });

  assert.deepEqual(updated.first, {
    note: "Original",
    tags: ["off-by-one", "clean"],
    updatedAt: NOW,
  });
  assert.deepEqual(updated.second, current.second);
  assert.notEqual(updated.second, current.second);
  assert.deepEqual(current, before);
  assert.deepEqual(patch, patchBefore);
});

test("creates annotations, removes cleared annotations, and ignores orphan edits", () => {
  const validSubmissionIds = ["receipt"];
  const created = updateSubmissionAnnotation(
    {},
    "receipt",
    { note: "  Revisit this  ", tags: ["review"] },
    { validSubmissionIds, now: NOW },
  );
  assert.deepEqual(created.receipt, {
    note: "Revisit this",
    tags: ["review"],
    updatedAt: NOW,
  });

  const cleared = updateSubmissionAnnotation(
    created,
    "receipt",
    { note: " ", tags: [] },
    { validSubmissionIds, now: NOW },
  );
  assert.deepEqual(cleared, {});

  const ignored = updateSubmissionAnnotation(
    created,
    "orphan",
    { note: "Cannot attach", tags: ["clean"] },
    { validSubmissionIds, now: NOW },
  );
  assert.deepEqual(ignored, created);
  assert.notEqual(ignored.receipt, created.receipt);
});

test("an invalid mutation timestamp uses the deterministic epoch fallback", () => {
  const updated = updateSubmissionAnnotation(
    {},
    "receipt",
    { tags: ["syntax"] },
    { validSubmissionIds: ["receipt"], now: "invalid" },
  );
  assert.equal(updated.receipt.updatedAt, EPOCH);
});

test("pruning removes deleted receipts and returns detached canonical values", () => {
  const current = {
    retained: { note: "Keep", tags: ["clean"], updatedAt: NOW },
    deleted: { note: "Drop", tags: ["review"], updatedAt: NOW },
  };
  const pruned = pruneSubmissionAnnotations(current, new Set(["retained"]));

  assert.deepEqual(pruned, {
    retained: { note: "Keep", tags: ["clean"], updatedAt: NOW },
  });
  assert.notEqual(pruned.retained, current.retained);
  assert.notEqual(pruned.retained.tags, current.retained.tags);
});
