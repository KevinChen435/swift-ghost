const MAX_SOURCE_BYTES = 48_000;
const MAX_SPEC_BYTES = 64_000;
const MAX_CASES = 64;
const MAX_CASE_NAME_BYTES = 120;
const EXECUTION_TIMEOUT_MS = 4_000;
const INITIALIZATION_TIMEOUT_MS = 12_000;
const DEFAULT_WORKER_PATH =
  "./python-runner.worker.mjs?v=1.28.0-6-micropython-1";

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
  const revision =
    Number.isInteger(raw.revision) && raw.revision > 0
      ? Math.min(raw.revision, 1_000_000)
      : 1;
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
  const normalized = { mode: "verify", revision, entrypoint, cases };
  if (byteLength(JSON.stringify(normalized)) > MAX_SPEC_BYTES)
    throw new Error(`verification exceeds ${MAX_SPEC_BYTES} bytes`);
  return normalized;
}

function normalizeExecution(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("execution must be an object");
  const entrypoint = normalizeEntrypoint(raw.entrypoint);
  const revision =
    Number.isInteger(raw.revision) && raw.revision > 0
      ? Math.min(raw.revision, 1_000_000)
      : 1;
  if (
    !Array.isArray(raw.cases) ||
    raw.cases.length === 0 ||
    raw.cases.length > MAX_CASES
  ) {
    throw new Error(`execution must contain 1-${MAX_CASES} cases`);
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
    if (!CODECS.has(outputCodec))
      throw new Error(`case ${index + 1} has an unsupported outputCodec`);
    return {
      name,
      args: cloneJson(testCase.args, `case ${index + 1} args`),
      argCodecs: [...argCodecs],
      outputCodec,
    };
  });
  const normalized = { mode: "run", revision, entrypoint, cases };
  if (byteLength(JSON.stringify(normalized)) > MAX_SPEC_BYTES)
    throw new Error(`execution exceeds ${MAX_SPEC_BYTES} bytes`);
  return normalized;
}

/**
 * Build the deterministic Python program used by the browser worker.
 * All caller-controlled data is embedded as a JSON document, never as Python code.
 */
export function buildPythonHarness({
  source,
  verification,
  executionMode = "verify",
}) {
  if (typeof source !== "string") throw new Error("source must be a string");
  const normalizedSource = source.replace(/\r\n?/g, "\n");
  if (!normalizedSource.trim()) throw new Error("source must not be empty");
  if (byteLength(normalizedSource) > MAX_SOURCE_BYTES)
    throw new Error(`source exceeds ${MAX_SOURCE_BYTES} bytes`);
  const normalizedVerification =
    executionMode === "run"
      ? normalizeExecution(verification)
      : normalizeVerification(verification);
  const sourceLiteral = jsonDocumentLiteral(normalizedSource);
  const verificationLiteral = jsonDocumentLiteral(normalizedVerification);

  return `import json as _json
import math as _math
import sys as _sys
import io as _io
import collections as _collections
import functools as _functools
import itertools as _itertools
import heapq as _heapq
import builtins as _builtins

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

class _Deque:
    def __init__(self, iterable=(), maxlen=None):
        self._items = list(iterable)
        self.maxlen = maxlen
        self._trim_left()
    def _trim_left(self):
        if self.maxlen is not None:
            while len(self._items) > self.maxlen:
                self._items.pop(0)
    def append(self, value):
        self._items.append(value)
        self._trim_left()
    def appendleft(self, value):
        self._items.insert(0, value)
        if self.maxlen is not None and len(self._items) > self.maxlen:
            self._items.pop()
    def pop(self):
        if not self._items:
            raise IndexError("pop from an empty deque")
        return self._items.pop()
    def popleft(self):
        if not self._items:
            raise IndexError("pop from an empty deque")
        return self._items.pop(0)
    def extend(self, iterable):
        for value in iterable:
            self.append(value)
    def extendleft(self, iterable):
        for value in iterable:
            self.appendleft(value)
    def clear(self):
        self._items.clear()
    def rotate(self, steps=1):
        if not self._items:
            return
        steps %= len(self._items)
        self._items[:] = self._items[-steps:] + self._items[:-steps]
    def reverse(self):
        self._items.reverse()
    def copy(self):
        return _Deque(self._items, self.maxlen)
    def __bool__(self):
        return bool(self._items)
    def __len__(self):
        return len(self._items)
    def __iter__(self):
        return iter(self._items)
    def __getitem__(self, index):
        return self._items[index]
    def __setitem__(self, index, value):
        self._items[index] = value
    def __repr__(self):
        return "deque(" + repr(self._items) + ")"

class _DefaultDict:
    def __init__(self, default_factory=None, source=None, **kwargs):
        self.default_factory = default_factory
        self._data = {}
        if source is not None:
            self.update(source)
        self.update(kwargs)
    def keys(self):
        return list(self._data.keys())
    def items(self):
        return list(self._data.items())
    def values(self):
        return list(self._data.values())
    def __iter__(self):
        return iter(self._data)
    def __len__(self):
        return len(self._data)
    def __contains__(self, key):
        return key in self._data
    def __getitem__(self, key):
        if key not in self._data:
            if self.default_factory is None:
                raise KeyError(key)
            self._data[key] = self.default_factory()
        return self._data[key]
    def __setitem__(self, key, value):
        self._data[key] = value
    def get(self, key, default=None):
        return self._data.get(key, default)
    def setdefault(self, key, default=None):
        return self._data.setdefault(key, default)
    def update(self, source=None, **kwargs):
        if source is not None:
            if hasattr(source, "keys"):
                for key in source.keys():
                    self[key] = source[key]
            else:
                for key, value in source:
                    self[key] = value
        for key, value in kwargs.items():
            self[key] = value
    def copy(self):
        clone = _DefaultDict(self.default_factory)
        clone.update(self._data)
        return clone
    def __repr__(self):
        return "defaultdict(" + repr(self.default_factory) + ", " + repr(self._data) + ")"

_deque = _Deque

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
        if isinstance(value, dict) or (
            hasattr(value, "keys") and hasattr(value, "items")
        ):
            pairs = sorted(value.items(), key=lambda item: repr(item[0]))[:_MAX_ITEMS]
            return {str(key)[:200]: _normalize(item, depth + 1, seen) for key, item in pairs}
        if isinstance(value, (list, tuple)):
            return [_normalize(item, depth + 1, seen) for item in value[:_MAX_ITEMS]]
        if isinstance(value, (set, frozenset)):
            items = [_normalize(item, depth + 1, seen) for item in list(value)[:_MAX_ITEMS]]
            return sorted(items, key=_canonical)
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
    if value is None:
        return "none"
    if isinstance(value, bool):
        return "bool:" + str(value)
    if isinstance(value, (int, float, str)):
        return type(value).__name__ + ":" + repr(value)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(_canonical(item) for item in value) + "]"
    if isinstance(value, dict):
        pairs = sorted((_canonical(key), _canonical(item)) for key, item in value.items())
        return "{" + ",".join(key + ":" + item for key, item in pairs) + "}"
    return type(value).__name__ + ":" + repr(value)

def _counts(values):
    result = {}
    for value in values:
        key = _canonical(value)
        result[key] = result.get(key, 0) + 1
    return result

def _compare(actual, expected, comparator):
    if comparator == "deepEqual":
        return actual == expected
    if comparator == "unordered":
        return isinstance(actual, list) and isinstance(expected, list) and _counts(actual) == _counts(expected)
    if comparator == "unorderedNested":
        if not isinstance(actual, list) or not isinstance(expected, list):
            return False
        normalize_group = lambda group: sorted((_canonical(item) for item in group)) if isinstance(group, list) else [_canonical(group)]
        return _counts(normalize_group(group) for group in actual) == _counts(normalize_group(group) for group in expected)
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

class _Counter(dict):
    def __init__(self, iterable=None, **kwargs):
        super().__init__()
        if iterable is not None:
            self.update(iterable)
        self.update(kwargs)
    def __getitem__(self, key):
        return self.get(key, 0)
    def update(self, iterable=None, **kwargs):
        if iterable is not None:
            if hasattr(iterable, "items"):
                for key, value in iterable.items():
                    self[key] = self.get(key, 0) + value
            else:
                for key in iterable:
                    self[key] = self.get(key, 0) + 1
        for key, value in kwargs.items():
            self[key] = self.get(key, 0) + value
    def most_common(self, count=None):
        pairs = sorted(self.items(), key=lambda item: item[1], reverse=True)
        return pairs if count is None else pairs[:count]
    def elements(self):
        for key, count in self.items():
            for _ in range(max(0, count)):
                yield key

def _bisect_left(values, target, lo=0, hi=None, key=None):
    if hi is None:
        hi = len(values)
    while lo < hi:
        mid = (lo + hi) // 2
        value = values[mid] if key is None else key(values[mid])
        if value < target:
            lo = mid + 1
        else:
            hi = mid
    return lo

def _bisect_right(values, target, lo=0, hi=None, key=None):
    if hi is None:
        hi = len(values)
    while lo < hi:
        mid = (lo + hi) // 2
        value = values[mid] if key is None else key(values[mid])
        if target < value:
            hi = mid
        else:
            lo = mid + 1
    return lo

def _insort_left(values, target, lo=0, hi=None, key=None):
    values.insert(_bisect_left(values, target if key is None else key(target), lo, hi, key), target)

def _insort_right(values, target, lo=0, hi=None, key=None):
    values.insert(_bisect_right(values, target if key is None else key(target), lo, hi, key), target)

def _memoize(function):
    cache = {}
    def wrapped(*args, **kwargs):
        key = (args, tuple(sorted(kwargs.items())))
        if key not in cache:
            cache[key] = function(*args, **kwargs)
        return cache[key]
    wrapped.cache_clear = cache.clear
    return wrapped

def _lru_cache(maxsize=128, typed=False):
    if callable(maxsize):
        return _memoize(maxsize)
    return lambda function: _memoize(function)

def _heapreplace(heap, item):
    if not heap:
        raise IndexError("index out of range")
    smallest = _heapq.heappop(heap)
    _heapq.heappush(heap, item)
    return smallest

def _heappushpop(heap, item):
    if heap and heap[0] < item:
        smallest = _heapq.heappop(heap)
        _heapq.heappush(heap, item)
        return smallest
    return item

def _nsmallest(count, iterable, key=None):
    values = sorted(iterable, key=key)
    return values[:max(0, count)]

def _nlargest(count, iterable, key=None):
    values = sorted(iterable, key=key, reverse=True)
    return values[:max(0, count)]

class _TypingAlias:
    def __getitem__(self, value):
        return object

class _Module:
    pass

_collections.Counter = _Counter
_collections.deque = _Deque
_collections.defaultdict = _DefaultDict
_functools.cache = _memoize
_functools.lru_cache = _lru_cache

_heapq_module = _Module()
_heapq_module.heapify = _heapq.heapify
_heapq_module.heappush = _heapq.heappush
_heapq_module.heappop = _heapq.heappop
_heapq_module.heapreplace = _heapreplace
_heapq_module.heappushpop = _heappushpop
_heapq_module.nsmallest = _nsmallest
_heapq_module.nlargest = _nlargest
_sys.modules["heapq"] = _heapq_module

_bisect_module = _Module()
_bisect_module.bisect_left = _bisect_left
_bisect_module.bisect_right = _bisect_right
_bisect_module.bisect = _bisect_right
_bisect_module.insort_left = _insort_left
_bisect_module.insort_right = _insort_right
_bisect_module.insort = _insort_right
_sys.modules["bisect"] = _bisect_module

_typing_module = _Module()
_typing_module.List = list
_typing_module.Dict = dict
_typing_module.Set = set
_typing_module.Tuple = tuple
_typing_module.Deque = list
_typing_module.DefaultDict = dict
_typing_module.Optional = _TypingAlias()
_typing_module.Union = _TypingAlias()
_typing_module.Any = object
_sys.modules["typing"] = _typing_module

_blocked_js = _Module()
_sys.modules["js"] = _blocked_js

_original_import = _builtins.__import__
def _guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
    if name == "js" or name.startswith("js."):
        return _blocked_js
    return _original_import(name, globals, locals, fromlist, level)
_builtins.__import__ = _guarded_import

def _format_error(error):
    writer = _io.StringIO()
    _sys.print_exception(error, writer)
    return _clip_text(writer.getvalue(), 1200).strip()

_results = []
_setup_error = None
_namespace = {"ListNode": ListNode, "TreeNode": TreeNode}

try:
    exec(compile(_SOURCE, "<learner-solution>", "exec"), _namespace, _namespace)
except BaseException as error:
    _setup_error = _format_error(error)
else:
    for case in _SPEC["cases"]:
        actual = None
        case_error = None
        passed = False
        try:
            args = [_decode(value, codec) for value, codec in zip(case["args"], case["argCodecs"])]
            raw_actual = _call_entrypoint(_namespace, _SPEC["entrypoint"], args)
            actual = _encode(raw_actual, case["outputCodec"])
            if _SPEC.get("mode") == "run":
                passed = True
            else:
                passed = bool(_compare(actual, case["expected"], case["comparator"]))
        except BaseException as error:
            case_error = _format_error(error)
        _results.append({"name": case["name"], "passed": passed, "actual": actual, "error": case_error})

_payload = {
    "kind": "execution" if _SPEC.get("mode") == "run" else "verification",
    "ok": _setup_error is None and all(case["passed"] for case in _results),
    "setupError": _setup_error,
    "cases": _results,
    "stdout": "",
    "stderr": "",
}
_RESULT_JSON = _json.dumps(_payload)`;
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
    this.initializationTimeoutMs =
      options.initializationTimeoutMs ?? INITIALIZATION_TIMEOUT_MS;
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

  run(source, execution) {
    let harness;
    try {
      harness = buildPythonHarness({
        source,
        verification: execution,
        executionMode: "run",
      });
    } catch (error) {
      return Promise.reject(error);
    }
    const normalizedExecution = normalizeExecution(execution);
    const job = () =>
      this.#execute({
        source: source.replace(/\r\n?/g, "\n"),
        verification: normalizedExecution,
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
      this.workerUrl ?? DEFAULT_WORKER_PATH,
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
    worker.addEventListener("error", (event) => {
      const message =
        typeof event?.message === "string" && event.message.trim()
          ? event.message.trim()
          : "Unknown worker error";
      const source =
        typeof event?.filename === "string" && event.filename
          ? ` (${event.filename.split("/").pop()}:${event.lineno ?? 0}:${event.colno ?? 0})`
          : "";
      this.#reset(new Error(`Python worker failed: ${message}${source}`));
    });
    worker.addEventListener("messageerror", () =>
      this.#reset(new Error("Python worker returned an unreadable message")),
    );
    const nonce = randomNonce();
    this.readyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(nonce);
        const error = new Error(
          `Python runtime did not start within ${Math.round(this.initializationTimeoutMs / 1000)} seconds`,
        );
        this.#reset(error);
        reject(error);
      }, this.initializationTimeoutMs);
      this.pending.set(nonce, {
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
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
  initializationTimeoutMs: INITIALIZATION_TIMEOUT_MS,
});
