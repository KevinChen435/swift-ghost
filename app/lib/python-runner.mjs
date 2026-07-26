const MAX_SOURCE_BYTES = 48_000;
const MAX_SPEC_BYTES = 64_000;
const MAX_CASES = 64;
const MAX_CASE_NAME_BYTES = 120;
const EXECUTION_TIMEOUT_MS = 4_000;

const ENTRYPOINT_KINDS = new Set(["function", "method"]);
const CODECS = new Set([
  "json",
  "linkedList",
  "cyclicLinkedList",
  "binaryTree",
]);
const COMPARATORS = new Set([
  "deepEqual",
  "unordered",
  "unorderedNested",
  "validTopologicalOrder",
]);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function jsonDocumentLiteral(value) {
  const document = JSON.stringify(value);
  if (document === undefined)
    throw new Error("verification values must be JSON-serializable");
  return JSON.stringify(document)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function cloneJson(value, label) {
  function assertJson(item, seen = new Set()) {
    if (item === null || typeof item === "string" || typeof item === "boolean")
      return;
    if (typeof item === "number") {
      if (!Number.isFinite(item))
        throw new Error(`${label} contains a non-finite number`);
      return;
    }
    if (typeof item !== "object" || seen.has(item))
      throw new Error(`${label} must contain only JSON values`);
    const prototype = Object.getPrototypeOf(item);
    if (
      prototype !== Array.prototype &&
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      throw new Error(`${label} must contain only JSON values`);
    }
    seen.add(item);
    for (const child of Array.isArray(item) ? item : Object.values(item))
      assertJson(child, seen);
    seen.delete(item);
  }
  assertJson(value);
  let document;
  try {
    document = JSON.stringify(value);
  } catch {
    throw new Error(`${label} must be JSON-serializable`);
  }
  if (document === undefined)
    throw new Error(`${label} must be JSON-serializable`);
  const normalized = JSON.parse(document);
  if (JSON.stringify(normalized) !== document)
    throw new Error(`${label} contains unsupported values`);
  return normalized;
}

function normalizeEntrypoint(raw) {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    !ENTRYPOINT_KINDS.has(raw.kind)
  ) {
    throw new Error("entrypoint.kind must be function or method");
  }
  if (typeof raw.name !== "string" || !IDENTIFIER.test(raw.name))
    throw new Error("entrypoint.name must be a Python identifier");
  if (
    raw.kind === "method" &&
    (typeof raw.className !== "string" || !IDENTIFIER.test(raw.className))
  ) {
    throw new Error("method entrypoint.className must be a Python identifier");
  }
  return raw.kind === "method"
    ? { kind: "method", className: raw.className, name: raw.name }
    : { kind: "function", name: raw.name };
}

function normalizeVerification(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("verification must be an object");
  const entrypoint = normalizeEntrypoint(raw.entrypoint);
  if (
    !Array.isArray(raw.cases) ||
    raw.cases.length === 0 ||
    raw.cases.length > MAX_CASES
  ) {
    throw new Error(`verification must contain 1-${MAX_CASES} cases`);
  }
  const cases = raw.cases.map((testCase, index) => {
    if (!testCase || typeof testCase !== "object" || Array.isArray(testCase))
      throw new Error(`case ${index + 1} must be an object`);
    const name = typeof testCase.name === "string" ? testCase.name.trim() : "";
    if (!name || byteLength(name) > MAX_CASE_NAME_BYTES)
      throw new Error(`case ${index + 1} has an invalid name`);
    if (!Array.isArray(testCase.args))
      throw new Error(`case ${index + 1} args must be an array`);
    const argCodecs =
      testCase.argCodecs === undefined
        ? testCase.args.map(() => "json")
        : testCase.argCodecs;
    if (
      !Array.isArray(argCodecs) ||
      argCodecs.length !== testCase.args.length ||
      argCodecs.some((codec) => !CODECS.has(codec))
    ) {
      throw new Error(
        `case ${index + 1} argCodecs must match args and use supported codecs`,
      );
    }
    const outputCodec = testCase.outputCodec ?? "json";
    const comparator = testCase.comparator ?? "deepEqual";
    if (!CODECS.has(outputCodec))
      throw new Error(`case ${index + 1} has an unsupported outputCodec`);
    if (!COMPARATORS.has(comparator))
      throw new Error(`case ${index + 1} has an unsupported comparator`);
    if (!Object.prototype.hasOwnProperty.call(testCase, "expected"))
      throw new Error(`case ${index + 1} must include expected`);
    return {
      name,
      args: cloneJson(testCase.args, `case ${index + 1} args`),
      argCodecs: [...argCodecs],
      expected: cloneJson(testCase.expected, `case ${index + 1} expected`),
      outputCodec,
      comparator,
    };
  });
  const normalized = { entrypoint, cases };
  if (byteLength(JSON.stringify(normalized)) > MAX_SPEC_BYTES)
    throw new Error(`verification exceeds ${MAX_SPEC_BYTES} bytes`);
  return normalized;
}

/**
 * Build the deterministic Python program used by the browser worker.
 * All caller-controlled data is embedded as a JSON document, never as Python code.
 */
export function buildPythonHarness({ source, verification }) {
  if (typeof source !== "string") throw new Error("source must be a string");
  const normalizedSource = source.replace(/\r\n?/g, "\n");
  if (!normalizedSource.trim()) throw new Error("source must not be empty");
  if (byteLength(normalizedSource) > MAX_SOURCE_BYTES)
    throw new Error(`source exceeds ${MAX_SOURCE_BYTES} bytes`);
  const normalizedVerification = normalizeVerification(verification);
  const sourceLiteral = jsonDocumentLiteral(normalizedSource);
  const verificationLiteral = jsonDocumentLiteral(normalizedVerification);

  return `import contextlib as _contextlib
import json as _json
import math as _math
import traceback as _traceback
from collections import Counter as _Counter, deque as _deque

_SOURCE = _json.loads(${sourceLiteral})
_SPEC = _json.loads(${verificationLiteral})
_MAX_TEXT = 8000
_MAX_ITEMS = 100

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class _BoundedWriter:
    encoding = "utf-8"
    def __init__(self, limit):
        self.limit = limit
        self.parts = []
        self.length = 0
        self.truncated = False
    def write(self, value):
        text = str(value)
        available = self.limit - self.length
        if available > 0:
            piece = text[:available]
            self.parts.append(piece)
            self.length += len(piece)
        if len(text) > max(available, 0):
            self.truncated = True
        return len(text)
    def flush(self):
        return None
    def getvalue(self):
        return "".join(self.parts) + ("..." if self.truncated else "")

def _clip_text(value, limit=_MAX_TEXT):
    text = str(value)
    return text if len(text) <= limit else text[:limit] + "..."

def _normalize(value, depth=0, seen=None):
    if value is None or isinstance(value, (bool, int, float, str)):
        if isinstance(value, float) and not _math.isfinite(value):
            return repr(value)
        return _clip_text(value, 1000) if isinstance(value, str) else value
    if depth >= 7:
        return "<depth limit>"
    if seen is None:
        seen = set()
    marker = id(value)
    if marker in seen:
        return "<cycle>"
    seen.add(marker)
    try:
        if isinstance(value, dict):
            pairs = sorted(value.items(), key=lambda item: repr(item[0]))[:_MAX_ITEMS]
            return {str(key)[:200]: _normalize(item, depth + 1, seen) for key, item in pairs}
        if isinstance(value, (list, tuple)):
            return [_normalize(item, depth + 1, seen) for item in value[:_MAX_ITEMS]]
        if isinstance(value, (set, frozenset)):
            items = [_normalize(item, depth + 1, seen) for item in list(value)[:_MAX_ITEMS]]
            return sorted(items, key=lambda item: _json.dumps(item, sort_keys=True, default=str))
        return _clip_text(repr(value), 1000)
    finally:
        seen.discard(marker)

def _decode_linked_list(values, cyclic=False):
    if cyclic:
        if not isinstance(values, dict) or not isinstance(values.get("values"), list):
            raise ValueError("cyclicLinkedList input must be {values, pos}")
        pos = values.get("pos", -1)
        values = values["values"]
    else:
        if not isinstance(values, list):
            raise ValueError("linkedList input must be an array")
        pos = -1
    nodes = [ListNode(value) for value in values[:_MAX_ITEMS]]
    for index in range(1, len(nodes)):
        nodes[index - 1].next = nodes[index]
    if cyclic and nodes and isinstance(pos, int) and 0 <= pos < len(nodes):
        nodes[-1].next = nodes[pos]
    return nodes[0] if nodes else None

def _decode_tree(values):
    if not isinstance(values, list):
        raise ValueError("binaryTree input must be a level-order array")
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue = _deque([root])
    index = 1
    while queue and index < min(len(values), _MAX_ITEMS):
        node = queue.popleft()
        if values[index] is not None:
            node.left = TreeNode(values[index])
            queue.append(node.left)
        index += 1
        if index < min(len(values), _MAX_ITEMS) and values[index] is not None:
            node.right = TreeNode(values[index])
            queue.append(node.right)
        index += 1
    return root

def _decode(value, codec):
    if codec == "json":
        return value
    if codec == "linkedList":
        return _decode_linked_list(value)
    if codec == "cyclicLinkedList":
        return _decode_linked_list(value, True)
    if codec == "binaryTree":
        return _decode_tree(value)
    raise ValueError("unsupported input codec")

def _encode_linked_list(head, cyclic=False):
    values = []
    seen = {}
    node = head
    cycle_at = -1
    while node is not None and len(values) < _MAX_ITEMS:
        marker = id(node)
        if marker in seen:
            cycle_at = seen[marker]
            break
        seen[marker] = len(values)
        values.append(_normalize(node.val))
        node = node.next
    if node is not None and cycle_at < 0:
        raise ValueError("linked list output exceeds the size limit")
    if cyclic:
        return {"values": values, "pos": cycle_at}
    if cycle_at >= 0:
        raise ValueError("linkedList output unexpectedly contains a cycle")
    return values

def _encode_tree(root):
    if root is None:
        return []
    values = []
    queue = _deque([root])
    seen = set()
    while queue and len(values) < _MAX_ITEMS:
        node = queue.popleft()
        if node is None:
            values.append(None)
            continue
        marker = id(node)
        if marker in seen:
            raise ValueError("binary tree output contains a cycle")
        seen.add(marker)
        values.append(_normalize(node.val))
        queue.append(node.left)
        queue.append(node.right)
    if queue:
        raise ValueError("binary tree output exceeds the size limit")
    while values and values[-1] is None:
        values.pop()
    return values

def _encode(value, codec):
    if codec == "json":
        return _normalize(value)
    if codec == "linkedList":
        return _encode_linked_list(value)
    if codec == "cyclicLinkedList":
        return _encode_linked_list(value, True)
    if codec == "binaryTree":
        return _encode_tree(value)
    raise ValueError("unsupported output codec")

def _canonical(value):
    return _json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)

def _compare(actual, expected, comparator):
    if comparator == "deepEqual":
        return actual == expected
    if comparator == "unordered":
        return isinstance(actual, list) and isinstance(expected, list) and _Counter(map(_canonical, actual)) == _Counter(map(_canonical, expected))
    if comparator == "unorderedNested":
        if not isinstance(actual, list) or not isinstance(expected, list):
            return False
        normalize_group = lambda group: sorted((_canonical(item) for item in group)) if isinstance(group, list) else [_canonical(group)]
        return _Counter(_canonical(normalize_group(group)) for group in actual) == _Counter(_canonical(normalize_group(group)) for group in expected)
    if comparator == "validTopologicalOrder":
        if not isinstance(actual, list) or not isinstance(expected, dict):
            return False
        if isinstance(expected.get("nodes"), list):
            nodes = expected["nodes"]
        elif isinstance(expected.get("numNodes"), int):
            nodes = list(range(expected["numNodes"]))
        elif isinstance(expected.get("numCourses"), int):
            nodes = list(range(expected["numCourses"]))
        else:
            return False
        edges = expected.get("edges")
        if edges is None and isinstance(expected.get("prerequisites"), list):
            edges = [[pair[1], pair[0]] for pair in expected["prerequisites"] if isinstance(pair, list) and len(pair) == 2]
        if not isinstance(edges, list) or len(actual) != len(nodes) or set(map(_canonical, actual)) != set(map(_canonical, nodes)):
            return False
        positions = {_canonical(node): index for index, node in enumerate(actual)}
        return all(isinstance(edge, list) and len(edge) == 2 and _canonical(edge[0]) in positions and _canonical(edge[1]) in positions and positions[_canonical(edge[0])] < positions[_canonical(edge[1])] for edge in edges)
    return False

def _call_entrypoint(namespace, entrypoint, args):
    if entrypoint["kind"] == "function":
        target = namespace[entrypoint["name"]]
    else:
        target = getattr(namespace[entrypoint["className"]](), entrypoint["name"])
    if not callable(target):
        raise TypeError("verification entrypoint is not callable")
    return target(*args)

_stdout = _BoundedWriter(_MAX_TEXT)
_stderr = _BoundedWriter(_MAX_TEXT)
_results = []
_setup_error = None
_namespace = {"__builtins__": __builtins__, "ListNode": ListNode, "TreeNode": TreeNode}

with _contextlib.redirect_stdout(_stdout), _contextlib.redirect_stderr(_stderr):
    try:
        exec(compile(_SOURCE, "<learner-solution>", "exec"), _namespace, _namespace)
    except BaseException as error:
        _setup_error = _clip_text("".join(_traceback.format_exception_only(type(error), error)), 1200).strip()
    else:
        for case in _SPEC["cases"]:
            actual = None
            case_error = None
            passed = False
            try:
                args = [_decode(value, codec) for value, codec in zip(case["args"], case["argCodecs"])]
                raw_actual = _call_entrypoint(_namespace, _SPEC["entrypoint"], args)
                actual = _encode(raw_actual, case["outputCodec"])
                passed = bool(_compare(actual, case["expected"], case["comparator"]))
            except BaseException as error:
                case_error = _clip_text("".join(_traceback.format_exception_only(type(error), error)), 1200).strip()
            _results.append({"name": case["name"], "passed": passed, "actual": actual, "error": case_error})

_payload = {
    "ok": _setup_error is None and all(case["passed"] for case in _results),
    "setupError": _setup_error,
    "cases": _results,
    "stdout": _clip_text(_stdout.getvalue()),
    "stderr": _clip_text(_stderr.getvalue()),
}
_json.dumps(_payload, allow_nan=False, ensure_ascii=False)`;
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export class PythonRunner {
  constructor(options = {}) {
    this.workerUrl = options.workerUrl;
    this.baseUrl = options.baseUrl;
    this.WorkerConstructor = options.Worker ?? globalThis.Worker;
    this.worker = null;
    this.readyPromise = null;
    this.pending = new Map();
    this.queue = Promise.resolve();
    this.disposed = false;
  }

  verify(source, verification) {
    let harness;
    try {
      harness = buildPythonHarness({ source, verification });
    } catch (error) {
      return Promise.reject(error);
    }
    const job = () =>
      this.#execute({
        source: source.replace(/\r\n?/g, "\n"),
        verification: normalizeVerification(verification),
        harness,
      });
    const result = this.queue.then(job, job);
    this.queue = result.catch(() => undefined);
    return result;
  }

  dispose() {
    this.disposed = true;
    this.#reset(new Error("Python runner was disposed"));
  }

  async #execute(payload) {
    if (this.disposed) throw new Error("Python runner was disposed");
    await this.#ensureReady();
    const nonce = randomNonce();
    const startedAt = performance.now();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(nonce);
        const error = new Error(
          "Python verification exceeded the 4 second limit",
        );
        this.#reset(error);
        reject(error);
      }, EXECUTION_TIMEOUT_MS);
      this.pending.set(nonce, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve({
            ...result,
            durationMs: Math.round(performance.now() - startedAt),
          });
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.worker.postMessage({ type: "verify", nonce, ...payload });
    });
  }

  #ensureReady() {
    if (this.readyPromise) return this.readyPromise;
    if (typeof this.WorkerConstructor !== "function")
      return Promise.reject(
        new Error("Python verification requires browser Worker support"),
      );
    const base =
      this.baseUrl ?? globalThis.document?.baseURI ?? globalThis.location?.href;
    if (!base)
      return Promise.reject(new Error("Python worker URL cannot be resolved"));
    const baseUrl = new URL(base);
    const workerUrl = new URL(
      this.workerUrl ?? "./python-runner.worker.mjs",
      baseUrl,
    );
    if (workerUrl.origin !== baseUrl.origin)
      return Promise.reject(
        new Error("Python worker must be served from the same origin"),
      );

    const worker = new this.WorkerConstructor(workerUrl, {
      type: "module",
      name: "swift-ghost-python",
    });
    this.worker = worker;
    worker.addEventListener("message", (event) =>
      this.#onMessage(worker, event.data),
    );
    worker.addEventListener("error", () =>
      this.#reset(new Error("Python worker failed")),
    );
    worker.addEventListener("messageerror", () =>
      this.#reset(new Error("Python worker returned an unreadable message")),
    );
    const nonce = randomNonce();
    this.readyPromise = new Promise((resolve, reject) =>
      this.pending.set(nonce, { resolve, reject }),
    );
    worker.postMessage({ type: "init", nonce });
    return this.readyPromise;
  }

  #onMessage(worker, message) {
    if (
      worker !== this.worker ||
      !message ||
      typeof message !== "object" ||
      typeof message.nonce !== "string"
    )
      return;
    const pending = this.pending.get(message.nonce);
    if (!pending) return;
    this.pending.delete(message.nonce);
    if (message.type === "ready") {
      pending.resolve();
      return;
    }
    if (message.type === "result") {
      if (!message.result || typeof message.result !== "object") {
        const error = new Error("Python worker returned an invalid result");
        pending.reject(error);
        this.#reset(error);
        return;
      }
      pending.resolve(message.result);
      // Learner code can mutate process-wide Python modules or builtins even
      // when every case passes. A fresh worker keeps attempts independent.
      this.#reset(
        new Error("Python verification runtime was reset after completion"),
      );
      return;
    }
    const error = new Error(
      typeof message.error === "string"
        ? message.error
        : "Python worker failed",
    );
    pending.reject(error);
    this.#reset(error);
  }

  #reset(error) {
    const worker = this.worker;
    this.worker = null;
    this.readyPromise = null;
    if (worker) worker.terminate();
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}

export function createPythonRunner(options) {
  return new PythonRunner(options);
}

export const PYTHON_RUNNER_LIMITS = Object.freeze({
  maxSourceBytes: MAX_SOURCE_BYTES,
  maxSpecBytes: MAX_SPEC_BYTES,
  maxCases: MAX_CASES,
  executionTimeoutMs: EXECUTION_TIMEOUT_MS,
});
