import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PATTERN_LESSONS,
  PATTERN_LESSON_BY_ID,
  PATTERN_LESSON_BY_SLUG,
} from "../app/data/pattern-lessons.ts";

test("ships twelve complete, stable pattern playbooks", () => {
  assert.equal(PATTERN_LESSONS.length, 12);
  assert.equal(new Set(PATTERN_LESSONS.map((lesson) => lesson.id)).size, 12);
  assert.equal(new Set(PATTERN_LESSONS.map((lesson) => lesson.slug)).size, 12);
  assert.deepEqual(
    PATTERN_LESSONS.map((lesson) => lesson.order),
    Array.from({ length: 12 }, (_, index) => index + 1),
  );
  for (const lesson of PATTERN_LESSONS) {
    assert.equal(PATTERN_LESSON_BY_ID.get(lesson.id), lesson);
    assert.equal(PATTERN_LESSON_BY_SLUG.get(lesson.slug), lesson);
    assert.equal(lesson.revision, 1);
    assert.equal(lesson.checks.length, 3);
    assert.equal(new Set(lesson.checks.map((check) => check.id)).size, 3);
    assert.ok(lesson.selection.useWhen.length >= 2);
    assert.ok(lesson.selection.rejectWhen.length >= 2);
    assert.ok(lesson.invariant.length >= 60);
    assert.ok(lesson.trace.steps.length >= 3);
    assert.match(lesson.templates.python, /\.\.\.|TODO|derive|combine|valid|goal|base|failure|success/i);
    assert.match(lesson.templates.swift, /\/\*|TODO|derive|combine|valid|goal|base|failure|success/i);
    assert.match(lesson.practice.workedItemId, /^python:/);
    assert.match(lesson.practice.guidedItemId, /^python:/);
    assert.match(lesson.practice.coldItemId, /^python:/);
    assert.match(lesson.practice.swiftItemId, /^builtin:/);
    for (const check of lesson.checks) {
      assert.ok(check.prompt.length >= 25);
      assert.ok(check.answer.length >= 40);
    }
  }
});
test("every authored practice link resolves to the shipped catalog sources", async () => {
  const [python, swift, transfer] = await Promise.all([
    readFile(new URL("../app/data/python-problems.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/problems.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/transfer-problems.ts", import.meta.url), "utf8"),
  ]);
  for (const lesson of PATTERN_LESSONS) {
    for (const itemId of [
      lesson.practice.workedItemId,
      lesson.practice.guidedItemId,
      lesson.practice.coldItemId,
    ]) {
      const id = itemId.split(":")[1];
      assert.match(python, new RegExp(`id:\\s*${id}\\b`), itemId);
    }
    const swiftId = lesson.practice.swiftItemId.split(":")[1];
    assert.match(swift, new RegExp(`id:\\s*${swiftId}\\b`), lesson.practice.swiftItemId);
    if (lesson.practice.transferItemId) {
      const transferId = lesson.practice.transferItemId.split(":")[1];
      assert.match(
        transfer,
        new RegExp(`id:\\s*${transferId}\\b`),
        lesson.practice.transferItemId,
      );
    }
  }
});

test("playbooks teach selection and skeletons without embedding reference answers", () => {
  for (const lesson of PATTERN_LESSONS) {
    assert.doesNotMatch(lesson.summary, /mastered|certified|server verified/i);
    assert.doesNotMatch(lesson.templates.python, /class Solution/);
    assert.doesNotMatch(lesson.templates.swift, /final answer/i);
    assert.ok(
      lesson.selection.confusableWith.every(
        (entry) => entry.pattern && entry.distinction.length >= 35,
      ),
    );
  }
});
