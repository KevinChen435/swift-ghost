import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BOUNDARY_DRILL_SUITES } from "../app/data/boundary-suites.ts";
import {
  BOUNDARY_DRILL_LIMITS,
  buildBoundaryDrillVerification,
  resolveBoundaryDrillSuite,
  validateBoundaryDrillRegistry,
} from "../app/lib/boundary-suites.mjs";

const twoSumDescriptor = BOUNDARY_DRILL_SUITES.find(
  (suite) => suite.itemId === "python:1",
);

function twoSumItem(overrides = {}) {
  return {
    itemId: "python:1",
    language: "python",
    contentRevision: 2,
    verification: {
      revision: 2,
      entrypoint: { kind: "method", className: "Solution", name: "twoSum" },
      cases: [
        {
          id: "1:uses-distinct-indices-for-duplicate-values",
          name: "uses distinct indices for duplicate values",
          args: [[3, 3], 6],
          expected: [0, 1],
        },
        {
          id: "1:finds-a-zero-target-using-opposite-signs",
          name: "finds a zero target using opposite signs",
          args: [[-4, 4], 0],
          expected: [0, 1],
        },
      ],
    },
    ...overrides,
  };
}

test("authored boundary suites stay bounded and resolve against the live revision contract", () => {
  assert.equal(validateBoundaryDrillRegistry(BOUNDARY_DRILL_SUITES), BOUNDARY_DRILL_SUITES);
  assert.ok(BOUNDARY_DRILL_SUITES.length <= BOUNDARY_DRILL_LIMITS.maxSuites);
  const resolved = resolveBoundaryDrillSuite(twoSumItem(), BOUNDARY_DRILL_SUITES);
  assert.equal(resolved?.contentRevision, twoSumDescriptor.contentRevision);
  assert.equal(resolved?.verificationRevision, twoSumDescriptor.verificationRevision);
  assert.deepEqual(resolved?.packs[0].cases.map((entry) => entry.id), twoSumDescriptor.packs[0].caseIds);
});

test("every authored suite resolves against the current built-in item catalog", () => {
  const itemsUrl = new URL("../app/lib/items.ts", import.meta.url).href;
  const registryUrl = new URL("../app/data/boundary-suites.ts", import.meta.url).href;
  const boundaryUrl = new URL("../app/lib/boundary-suites.mjs", import.meta.url).href;
  const script = `
    import assert from "node:assert/strict";
    import { BUILTIN_ITEMS } from ${JSON.stringify(itemsUrl)};
    import { BOUNDARY_DRILL_SUITES } from ${JSON.stringify(registryUrl)};
    import { resolveBoundaryDrillSuite } from ${JSON.stringify(boundaryUrl)};
    for (const descriptor of BOUNDARY_DRILL_SUITES) {
      const item = BUILTIN_ITEMS.find((candidate) => candidate.itemId === descriptor.itemId);
      assert.ok(item, \`missing built-in item: \${descriptor.itemId}\`);
      const resolved = resolveBoundaryDrillSuite(item, BOUNDARY_DRILL_SUITES);
      assert.ok(resolved, \`stale boundary suite: \${descriptor.itemId}\`);
      assert.equal(resolved.contentRevision, item.contentRevision);
      assert.equal(resolved.verificationRevision, item.verification.revision ?? 1);
      assert.deepEqual(
        resolved.packs.flatMap((pack) => pack.cases.map((testCase) => testCase.id)),
        descriptor.packs.flatMap((pack) => pack.caseIds),
      );
    }
    process.stdout.write(String(BOUNDARY_DRILL_SUITES.length));
  `;
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", script],
    { encoding: "utf8" },
  );
  assert.equal(Number(output), BOUNDARY_DRILL_SUITES.length);
});

test("stale content, judge revisions, and missing live case ids hide a boundary suite", () => {
  assert.equal(
    resolveBoundaryDrillSuite(twoSumItem({ contentRevision: 1 }), BOUNDARY_DRILL_SUITES),
    null,
  );
  assert.equal(
    resolveBoundaryDrillSuite(
      twoSumItem({ verification: { ...twoSumItem().verification, revision: 3 } }),
      BOUNDARY_DRILL_SUITES,
    ),
    null,
  );
  assert.equal(
    resolveBoundaryDrillSuite(
      twoSumItem({
        verification: { ...twoSumItem().verification, cases: twoSumItem().verification.cases.slice(0, 1) },
      }),
      BOUNDARY_DRILL_SUITES,
    ),
    null,
  );
});

test("a selected pack or case reuses the current verification cases", () => {
  const item = twoSumItem();
  const suite = resolveBoundaryDrillSuite(item, BOUNDARY_DRILL_SUITES);
  const pack = buildBoundaryDrillVerification(
    item,
    suite,
    "distinct-index-boundaries",
  );
  assert.equal(pack.verification.cases.length, 2);
  assert.deepEqual(pack.expectedValues, [[0, 1], [0, 1]]);
  const one = buildBoundaryDrillVerification(
    item,
    suite,
    "distinct-index-boundaries",
    "1:finds-a-zero-target-using-opposite-signs",
  );
  assert.deepEqual(one.caseIds, ["1:finds-a-zero-target-using-opposite-signs"]);
  assert.equal(one.verification.cases[0], item.verification.cases[1]);
});

test("Edge cases UI is gated and reveals expected versus actual only after a run", async () => {
  const [consoleUi, app] = await Promise.all([
    readFile(new URL("../app/components/ChallengeConsole.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(consoleUi, /"edge-cases": "Edge cases"/);
  assert.match(consoleUi, /isLocked\s*\? \["examples", "output"\]/);
  assert.match(consoleUi, /const boundaryEnabled = !isLocked && !isStudio && Boolean\(boundarySuite\)/);
  assert.match(consoleUi, /\.\.\.\(boundaryEnabled \? \(\["edge-cases"\]/);
  assert.match(consoleUi, /activeTab === "edge-cases" && boundaryEnabled/);
  assert.match(consoleUi, /disabled=\{isLocked \|\| !runnerSourcePresent \|\| checksAreBusy\}/);
  assert.match(app, /isLocked=\{isLocked\}/);
  assert.match(consoleUi, /expected values stay hidden until a run finishes/);
  assert.match(consoleUi, /<small>Input arguments<\/small>/);
  assert.match(consoleUi, /formatJson\(testCase\.args\)/);
  assert.match(consoleUi, /boundaryExecutionState\.result &&/);
  assert.match(consoleUi, /expected: \{formatJson\(boundaryExecutionState\.expectedValues/);
  const runStart = app.indexOf("async function runBoundaryDrill");
  const runEnd = app.indexOf("function changeCustomCaseInput", runStart);
  const run = app.slice(runStart, runEnd);
  assert.match(run, /runner\.verify\(runnerSource, drill\.verification\)/);
  assert.doesNotMatch(run, /onSolveComplete|onSubmissionRequested|onTestRun/);
  assert.match(run, /if \(isLocked \|\| isStudio \|\| runnerBusy\.current\) return/);
});
