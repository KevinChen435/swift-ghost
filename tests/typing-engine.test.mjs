import test from "node:test";
import assert from "node:assert/strict";
import { analyzeEdit, correctPositionCount } from "../app/lib/typing-engine.mjs";

test("append reports the exact inserted characters", () => {
  assert.deepEqual(analyzeEdit("func", "func ", "func test()"), {
    prefix: 4,
    removed: "",
    inserted: " ",
    deletedCount: 0,
    insertedCount: 1,
    correctInserted: 1,
    incorrectInserted: 0,
  });
});

test("selection replacement is measured at its real target position", () => {
  const edit = analyzeEdit("let wrong = 1", "let value = 1", "let value = 1");
  assert.equal(edit.prefix, 4);
  assert.equal(edit.removed, "wrong");
  assert.equal(edit.inserted, "value");
  assert.equal(edit.deletedCount, 5);
  assert.equal(edit.correctInserted, 5);
  assert.equal(edit.incorrectInserted, 0);
});

test("mid-line mistakes are not credited as correct keystrokes", () => {
  const edit = analyzeEdit("return best", "return bust", "return best");
  assert.equal(edit.inserted, "u");
  assert.equal(edit.correctInserted, 0);
  assert.equal(edit.incorrectInserted, 1);
});

test("deletion and undo-style multi-character replacement stay selection aware", () => {
  const deletion = analyzeEdit("array.count", "arr.count", "array.count");
  assert.equal(deletion.removed, "ay");
  assert.equal(deletion.deletedCount, 2);
  assert.equal(deletion.insertedCount, 0);

  const undo = analyzeEdit("arr.count", "array.count", "array.count");
  assert.equal(undo.inserted, "ay");
  assert.equal(undo.correctInserted, 2);
});

test("deletion-only edits are distinguishable from rejected inserted keys", () => {
  const edit = analyzeEdit("let value = 1", "let alue = 1", "let value = 1");
  assert.equal(edit.insertedCount, 0);
  assert.equal(edit.deletedCount, 1);
  assert.equal(edit.incorrectInserted, 0);
});

test("position-correct speed never counts wrong characters", () => {
  assert.equal(correctPositionCount("abcxef", "abcdef"), 5);
  assert.equal(correctPositionCount("xxxx", "abcd"), 0);
  assert.equal(correctPositionCount("abcdef", "abcdef"), 6);
});
