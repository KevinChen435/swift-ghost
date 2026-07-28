import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildPythonHarness,
  createPythonRunner,
  PYTHON_RUNNER_LIMITS,
} from "../app/lib/python-runner.mjs";

const functionVerification = {
  entrypoint: { kind: "function", name: "solve" },
  cases: [
    { name: "normalizes tuple output", args: [[1, 2]], expected: [1, 2] },
  ],
};

test("buildPythonHarness embeds source and metadata as inert JSON documents", () => {
  const malicious = `def solve(values):\n    return values\n\n# \" ); raise RuntimeError('escaped')\n#   `;
  const harness = buildPythonHarness({
    source: malicious,
    verification: functionVerification,
  });
  assert.match(harness, /_SOURCE = _json\.loads\(/);
  assert.match(harness, /_SPEC = _json\.loads\(/);
  assert.doesNotMatch(harness, /# " \); raise RuntimeError/);
  assert.match(harness, /def _normalize\(/);
  assert.match(harness, /class _Counter/);
  assert.match(harness, /class _Deque/);
  assert.match(harness, /_sys\.modules\["js"\] = _blocked_js/);
  assert.match(harness, /_RESULT_JSON = _json\.dumps/);
  assert.match(harness, /isinstance\(value, \(list, tuple\)\)/);
});

test("buildPythonHarness normalizes line endings deterministically", () => {
  const windows = buildPythonHarness({
    source: "def solve():\r\n    return []\r\n",
    verification: functionVerification,
  });
  const unix = buildPythonHarness({
    source: "def solve():\n    return []\n",
    verification: functionVerification,
  });
  assert.equal(windows, unix);
});

test("closed verification metadata supports methods, codecs, and fixed comparators", () => {
  const harness = buildPythonHarness({
    source:
      "class Solution:\n    def sortList(self, head):\n        return head",
    verification: {
      entrypoint: { kind: "method", className: "Solution", name: "sortList" },
      cases: [
        {
          name: "linked values",
          args: [[2, 1]],
          argCodecs: ["linkedList"],
          expected: [1, 2],
          outputCodec: "linkedList",
          comparator: "unordered",
        },
      ],
    },
  });
  assert.match(harness, /def _decode_linked_list/);
  assert.match(harness, /validTopologicalOrder/);
  assert.match(harness, /namespace\[entrypoint\["className"\]\]\(\)/);
});

test("buildPythonHarness rejects executable or malformed verification metadata", () => {
  assert.throws(
    () =>
      buildPythonHarness({
        source: "def solve(): pass",
        verification: { helpers: "print('no')", cases: [] },
      }),
    /entrypoint\.kind/,
  );
  assert.throws(
    () =>
      buildPythonHarness({
        source: "def solve(): pass",
        verification: {
          entrypoint: { kind: "function", name: "solve()" },
          cases: [{ name: "x", args: [], expected: null }],
        },
      }),
    /Python identifier/,
  );
  assert.throws(
    () =>
      buildPythonHarness({
        source: "def solve(): pass",
        verification: {
          entrypoint: { kind: "function", name: "solve" },
          cases: [
            { name: "x", args: [], expected: null, comparator: "expression" },
          ],
        },
      }),
    /unsupported comparator/,
  );
});

test("source and verification inputs are bounded before a worker is created", () => {
  assert.throws(
    () =>
      buildPythonHarness({
        source: `#${"x".repeat(PYTHON_RUNNER_LIMITS.maxSourceBytes)}`,
        verification: functionVerification,
      }),
    /source exceeds/,
  );
  const cases = Array.from(
    { length: PYTHON_RUNNER_LIMITS.maxCases + 1 },
    (_, index) => ({ name: `case ${index}`, args: [], expected: null }),
  );
  assert.throws(
    () =>
      buildPythonHarness({
        source: "def solve(): pass",
        verification: {
          entrypoint: { kind: "function", name: "solve" },
          cases,
        },
      }),
    /1-64 cases/,
  );
});

test("the harness contains every closed codec and comparator without evaluating expressions", () => {
  const harness = buildPythonHarness({
    source: "def solve(value): return value",
    verification: functionVerification,
  });
  for (const codec of ["json", "linkedList", "cyclicLinkedList", "binaryTree"])
    assert.ok(harness.includes(`\"${codec}\"`));
  for (const comparator of [
    "deepEqual",
    "unordered",
    "unorderedNested",
    "validTopologicalOrder",
  ])
    assert.ok(harness.includes(`\"${comparator}\"`));
  assert.doesNotMatch(harness, /eval\(case\[/);
  assert.doesNotMatch(harness, /case\["expression"\]/);
});

test("execution timeout starts after readiness and a timed-out worker is replaced", async () => {
  const workers = [];
  const timers = [];
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (callback, delay) => {
    const timer = { callback, delay, cleared: false };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => {
    timer.cleared = true;
  };

  class FakeWorker {
    constructor(url, options) {
      this.url = url;
      this.options = options;
      this.listeners = new Map();
      this.messages = [];
      this.terminated = false;
      workers.push(this);
    }
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }
    postMessage(message) {
      this.messages.push(message);
    }
    terminate() {
      this.terminated = true;
    }
    emit(data) {
      this.listeners.get("message")?.({ data });
    }
  }

  const runner = createPythonRunner({
    Worker: FakeWorker,
    baseUrl: "https://example.test/swift-ghost/",
  });
  try {
    const firstRun = runner.verify(
      "def solve(values):\n    return values",
      functionVerification,
    );
    await Promise.resolve();
    assert.equal(workers.length, 1);
    assert.equal(workers[0].options.type, "module");
    assert.equal(
      workers[0].url.href,
      "https://example.test/swift-ghost/python-runner.worker.mjs?v=1.28.0-6-micropython-1",
    );
    assert.equal(workers[0].messages[0].type, "init");
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 12_000);

    workers[0].emit({ type: "ready", nonce: workers[0].messages[0].nonce });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(workers[0].messages[1].type, "verify");
    assert.equal(timers[0].cleared, true);
    assert.equal(timers.length, 2);
    assert.equal(timers[1].delay, 4_000);
    timers[1].callback();
    await assert.rejects(firstRun, /4 second limit/);
    assert.equal(workers[0].terminated, true);

    const secondRun = runner.verify(
      "def solve(values):\n    return values",
      functionVerification,
    );
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(
      workers.length,
      2,
      "a timeout must cause the next run to create a fresh worker",
    );
    runner.dispose();
    await assert.rejects(secondRun, /disposed/);
  } finally {
    runner.dispose();
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("a stalled runtime initialization is bounded and replaced", async () => {
  const workers = [];
  class FakeWorker {
    constructor() {
      this.listeners = new Map();
      this.messages = [];
      this.terminated = false;
      workers.push(this);
    }
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }
    postMessage(message) {
      this.messages.push(message);
    }
    terminate() {
      this.terminated = true;
    }
  }

  const runner = createPythonRunner({
    Worker: FakeWorker,
    baseUrl: "https://example.test/",
    initializationTimeoutMs: 5,
  });
  try {
    const firstRun = runner.verify(
      "def solve(values):\n    return values",
      functionVerification,
    );
    await assert.rejects(firstRun, /Python runtime did not start/);
    assert.equal(workers[0].terminated, true);

    const secondRun = runner.verify(
      "def solve(values):\n    return values",
      functionVerification,
    );
    await Promise.resolve();
    assert.equal(workers.length, 2);
    runner.dispose();
    await assert.rejects(secondRun, /disposed/);
  } finally {
    runner.dispose();
  }
});

test("worker loads only the pinned same-origin runtime and closes browser network primitives", async () => {
  const workerSource = await readFile(
    new URL("../public/python-runner.worker.mjs", import.meta.url),
    "utf8",
  );
  const syncSource = await readFile(
    new URL("../scripts/sync-python-runtime.mjs", import.meta.url),
    "utf8",
  );
  assert.match(workerSource, /MICROPYTHON_VERSION = "1\.28\.0-6"/);
  assert.match(
    workerSource,
    /`\.\/vendor\/micropython-\$\{MICROPYTHON_VERSION\}\/`/,
  );
  assert.match(workerSource, /import \{ loadMicroPython \}/);
  assert.match(workerSource, /linebuffer: false/);
  assert.doesNotMatch(workerSource, /https?:\/\//);
  for (const primitive of [
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "WebTransport",
    "Worker",
    "SharedWorker",
    "importScripts",
  ]) {
    assert.ok(
      workerSource.includes(`\"${primitive}\"`),
      `${primitive} should be disabled after initialization`,
    );
  }
  assert.match(workerSource, /NONCE_PATTERN/);
  assert.match(syncSource, /PINNED_VERSION = "1\.28\.0-6"/);
  for (const artifact of ["micropython.mjs", "micropython.wasm"]) {
    assert.ok(
      syncSource.includes(`\"${artifact}\"`),
      `${artifact} should be copied into the public vendor directory`,
    );
  }
});

test("a failed verification result is returned but its worker is discarded", async () => {
  const workers = [];
  class FakeWorker {
    constructor() {
      this.listeners = new Map();
      this.messages = [];
      this.terminated = false;
      workers.push(this);
    }
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }
    postMessage(message) {
      this.messages.push(message);
    }
    terminate() {
      this.terminated = true;
    }
    emit(data) {
      this.listeners.get("message")?.({ data });
    }
  }
  const runner = createPythonRunner({
    Worker: FakeWorker,
    baseUrl: "https://example.test/",
  });
  try {
    const run = runner.verify(
      "def solve(values):\n    return []",
      functionVerification,
    );
    await Promise.resolve();
    workers[0].emit({ type: "ready", nonce: workers[0].messages[0].nonce });
    await Promise.resolve();
    await Promise.resolve();
    workers[0].emit({
      type: "result",
      nonce: workers[0].messages[1].nonce,
      result: {
        ok: false,
        setupError: null,
        cases: [{ name: "x", passed: false, actual: [], error: null }],
        stdout: "",
        stderr: "",
      },
    });
    assert.equal((await run).ok, false);
    assert.equal(workers[0].terminated, true);
  } finally {
    runner.dispose();
  }
});

test("a successful verification also discards mutable Python process state", async () => {
  const workers = [];
  class FakeWorker {
    constructor() {
      this.listeners = new Map();
      this.messages = [];
      this.terminated = false;
      workers.push(this);
    }
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }
    postMessage(message) {
      this.messages.push(message);
    }
    terminate() {
      this.terminated = true;
    }
    emit(data) {
      this.listeners.get("message")?.({ data });
    }
  }
  const runner = createPythonRunner({
    Worker: FakeWorker,
    baseUrl: "https://example.test/",
  });
  try {
    const run = runner.verify(
      "def solve(values):\n    return values",
      functionVerification,
    );
    await Promise.resolve();
    workers[0].emit({
      type: "ready",
      nonce: workers[0].messages[0].nonce,
    });
    await Promise.resolve();
    await Promise.resolve();
    workers[0].emit({
      type: "result",
      nonce: workers[0].messages[1].nonce,
      result: {
        ok: true,
        setupError: null,
        cases: [{ name: "x", passed: true, actual: [1, 2], error: null }],
        stdout: "",
        stderr: "",
      },
    });
    assert.equal((await run).ok, true);
    assert.equal(workers[0].terminated, true);

    const secondRun = runner.verify(
      "def solve(values):\n    return values",
      functionVerification,
    );
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(workers.length, 2);
    runner.dispose();
    await assert.rejects(secondRun, /disposed/);
  } finally {
    runner.dispose();
  }
});
