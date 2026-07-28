import assert from "node:assert/strict";
import test from "node:test";
import {
  SOLUTION_GUIDES,
  getSolutionGuide,
} from "../app/data/solution-guides.ts";
import { PYTHON_PROBLEMS } from "../app/data/python-problems.ts";
import { ADVANCED_PYTHON_PROBLEMS } from "../app/data/advanced-python-problems.ts";
import { TRANSFER_PROBLEMS } from "../app/data/transfer-problems.ts";

const runnableBuiltIns = [
  ...PYTHON_PROBLEMS.map((item) => ({
    itemId: `python:${item.id}`,
    contentRevision: 1,
  })),
  ...ADVANCED_PYTHON_PROBLEMS.map((item) => ({
    itemId: `python:${item.id}`,
    contentRevision: 1,
  })),
  ...TRANSFER_PROBLEMS.map((item) => ({
    itemId: `transfer:${item.id}`,
    contentRevision: 1,
  })),
];

test("every runnable built-in Python item has exactly one revision-matched project-authored guide", () => {
  assert.equal(runnableBuiltIns.length, 56);
  assert.equal(SOLUTION_GUIDES.length, 56);
  assert.equal(new Set(SOLUTION_GUIDES.map((guide) => guide.itemId)).size, 56);
  assert.deepEqual(
    new Set(SOLUTION_GUIDES.map((guide) => guide.itemId)),
    new Set(runnableBuiltIns.map((item) => item.itemId)),
  );
  for (const item of runnableBuiltIns) {
    const guide = getSolutionGuide(item.itemId, item.contentRevision);
    assert.ok(guide, item.itemId);
    assert.equal(guide.itemRevision, item.contentRevision, item.itemId);
    assert.equal(guide.provenance.origin, "project-authored", item.itemId);
  }
});

test("guides remain bounded, structured, honest about alternatives, and deeply frozen", () => {
  for (const guide of SOLUTION_GUIDES) {
    assert.equal(guide.schemaVersion, 1, guide.itemId);
    assert.match(guide.itemId, /^(python|transfer):\d+$/, guide.itemId);
    assert.equal(guide.approach.steps.length >= 2, true, guide.itemId);
    assert.equal(guide.approach.steps.length <= 6, true, guide.itemId);
    assert.equal(guide.edgeCases.length >= 2, true, guide.itemId);
    assert.equal(guide.edgeCases.length <= 5, true, guide.itemId);
    assert.equal(guide.alternatives.length <= 3, true, guide.itemId);
    assert.equal(guide.pitfalls.length >= 1, true, guide.itemId);
    assert.equal(guide.pitfalls.length <= 4, true, guide.itemId);
    const totalBytes = new TextEncoder().encode(JSON.stringify(guide)).byteLength;
    assert.equal(totalBytes <= 8_000, true, `${guide.itemId}: ${totalBytes} bytes`);
    assert.equal(Object.isFrozen(guide), true, guide.itemId);
    assert.equal(Object.isFrozen(guide.approach), true, guide.itemId);
    assert.equal(Object.isFrozen(guide.approach.steps), true, guide.itemId);
    assert.equal(Object.isFrozen(guide.edgeCases), true, guide.itemId);
    assert.equal(Object.isFrozen(guide.alternatives), true, guide.itemId);
    assert.equal(Object.isFrozen(guide.pitfalls), true, guide.itemId);
  }
});

test("guide lookup never falls through to a stale revision or custom item", () => {
  const first = SOLUTION_GUIDES[0];
  assert.equal(getSolutionGuide(first.itemId, first.itemRevision), first);
  assert.equal(getSolutionGuide(first.itemId, first.itemRevision + 1), null);
  assert.equal(getSolutionGuide("custom:private", 1), null);
  assert.equal(getSolutionGuide(first.itemId, undefined), null);
});
