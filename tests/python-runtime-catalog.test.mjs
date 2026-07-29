import assert from "node:assert/strict";
import test from "node:test";
import { loadMicroPython } from "@micropython/micropython-webassembly-pyscript";
import { ADVANCED_PYTHON_PROBLEMS } from "../app/data/advanced-python-problems.ts";
import { PYTHON_PROBLEMS } from "../app/data/python-problems.ts";
import { TRANSFER_PROBLEMS } from "../app/data/transfer-problems.ts";
import { buildPythonHarness } from "../app/lib/python-runner.mjs";

let runtimePromise;

function sharedRuntime() {
  runtimePromise ??= loadMicroPython({
    heapsize: 32 * 1024 * 1024,
    stdout: () => {},
    stderr: () => {},
  });
  return runtimePromise;
}

async function execute(source, verification, executionMode = "verify") {
  const runtime = await sharedRuntime();
  runtime.runPython(buildPythonHarness({ source, verification, executionMode }));
  return JSON.parse(runtime.globals.get("_RESULT_JSON"));
}

test("custom execution returns actual output without fabricating an assertion", async () => {
  const result = await execute(
    "def add(left, right):\n    return left + right",
    {
      revision: 2,
      entrypoint: { kind: "function", name: "add" },
      cases: [{ name: "custom", args: [3, 4] }],
    },
    "run",
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.kind, "execution");
  assert.equal(result.cases[0].actual, 7);
  assert.equal(result.cases[0].passed, true);
});

test("every shipped Python reference solution passes in the bundled runtime", async () => {
  const catalog = [...PYTHON_PROBLEMS, ...ADVANCED_PYTHON_PROBLEMS];
  const failures = [];
  for (const problem of catalog) {
    const result = await execute(problem.code, problem.verification);
    if (!result.ok) failures.push({ slug: problem.slug, result });
  }
  assert.equal(catalog.length, 48);
  assert.deepEqual(failures, []);
});

test("every original transfer variant passes its sample and unshown checks", async () => {
  const failures = [];
  for (const problem of TRANSFER_PROBLEMS) {
    const result = await execute(problem.code, problem.verification);
    if (!result.ok) failures.push({ slug: problem.slug, result });
  }
  assert.equal(TRANSFER_PROBLEMS.length, 8);
  assert.deepEqual(failures, []);
});

test("the compatibility layer covers common interview imports and codecs", async () => {
  const source = `from collections import Counter, defaultdict, deque
import heapq

class Solution:
    def inspect(self, root):
        queue = deque([root])
        values = []
        counts = Counter()
        grouped = defaultdict(list)
        while queue:
            node = queue.popleft()
            values.append(node.val)
            counts[node.val] += 1
            grouped[node.val].append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        heapq.heapify(values)
        if values:
            heapq.heapreplace(values, values[0])
        return [counts[2], len(grouped.values()), list(grouped), sorted(values)]`.replace(
    /^  /gm,
    "",
  );
  const result = await execute(source, {
    entrypoint: { kind: "method", className: "Solution", name: "inspect" },
    cases: [
      {
        name: "tree with repeated values",
        args: [[2, 2, 3]],
        argCodecs: ["binaryTree"],
        expected: [2, 2, [2, 3], [2, 2, 3]],
      },
    ],
  });
  assert.equal(result.ok, true, JSON.stringify(result));
});

test("the direct JavaScript bridge is not exposed to learner code by default", async () => {
  const result = await execute(
    `def solve():
    import js
    return hasattr(js, "eval") or hasattr(js, "globalThis")`.replace(
      /^  /gm,
      "",
    ),
    {
      entrypoint: { kind: "function", name: "solve" },
      cases: [{ name: "bridge is hidden", args: [], expected: false }],
    },
  );
  assert.equal(result.ok, true, JSON.stringify(result));
});

test("deleting the shadow module cannot restore the native JavaScript bridge", async () => {
  const result = await execute(
    `def solve():
    import sys
    del sys.modules["js"]
    import js
    return hasattr(js, "eval") or hasattr(js, "globalThis")`.replace(
      /^  /gm,
      "",
    ),
    {
      entrypoint: { kind: "function", name: "solve" },
      cases: [{ name: "bridge remains hidden", args: [], expected: false }],
    },
  );
  assert.equal(result.ok, true, JSON.stringify(result));
});
