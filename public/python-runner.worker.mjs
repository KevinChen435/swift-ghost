const PYODIDE_VERSION = "314.0.3";
const PYODIDE_BASE_URL = new URL("./vendor/pyodide/", import.meta.url);
const PYODIDE_MODULE_URL = new URL("pyodide.mjs", PYODIDE_BASE_URL);
const MAX_SOURCE_BYTES = 48_000;
const MAX_SPEC_BYTES = 64_000;
const MAX_HARNESS_BYTES = 180_000;
const MAX_RESULT_BYTES = 160_000;
const MAX_CASES = 64;
const NONCE_PATTERN = /^[a-f0-9]{32}$/;

let runtimePromise;
let busy = false;

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function safePost(message) {
  self.postMessage(message);
}

function blockNetworkPrimitives() {
  const blocked = () => {
    throw new Error("Network access is disabled during Python verification");
  };
  // Keep JavaScript language intrinsics intact: Pyodide uses Function internally
  // after initialization. Network-capable browser APIs are the exfiltration
  // boundary this worker needs to close.
  for (const name of [
    "fetch",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "WebTransport",
    "Worker",
    "SharedWorker",
    "importScripts",
  ]) {
    try {
      Object.defineProperty(self, name, {
        value: blocked,
        writable: false,
        configurable: false,
      });
    } catch {
      try {
        self[name] = blocked;
      } catch {
        /* unavailable in this worker */
      }
    }
  }
  try {
    Object.defineProperty(self.navigator, "sendBeacon", {
      value: blocked,
      writable: false,
      configurable: false,
    });
  } catch {
    // WorkerNavigator normally has no sendBeacon. Keep compatibility with browsers that omit it.
  }
}

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const pyodideModule = await import(PYODIDE_MODULE_URL.href);
      if (typeof pyodideModule.loadPyodide !== "function")
        throw new Error("vendored Python runtime is invalid");
      const loaded = await pyodideModule.loadPyodide({
        indexURL: PYODIDE_BASE_URL.href,
      });
      if (loaded.version !== PYODIDE_VERSION)
        throw new Error("vendored Python runtime version mismatch");
      blockNetworkPrimitives();
      return loaded;
    })();
  }
  return runtimePromise;
}

function validateJob(message) {
  if (
    typeof message.source !== "string" ||
    !message.source.trim() ||
    byteLength(message.source) > MAX_SOURCE_BYTES
  ) {
    throw new Error("Python source is outside the accepted size range");
  }
  if (
    !message.verification ||
    typeof message.verification !== "object" ||
    !Array.isArray(message.verification.cases)
  ) {
    throw new Error("Python verification metadata is invalid");
  }
  if (
    message.verification.cases.length < 1 ||
    message.verification.cases.length > MAX_CASES
  ) {
    throw new Error("Python verification case count is invalid");
  }
  const specification = JSON.stringify(message.verification);
  if (byteLength(specification) > MAX_SPEC_BYTES)
    throw new Error("Python verification metadata is too large");
  if (
    typeof message.harness !== "string" ||
    byteLength(message.harness) > MAX_HARNESS_BYTES
  ) {
    throw new Error("Python verification harness is invalid");
  }
}

self.addEventListener("message", async (event) => {
  const message = event.data;
  if (
    !message ||
    typeof message !== "object" ||
    !NONCE_PATTERN.test(message.nonce ?? "")
  )
    return;
  const nonce = message.nonce;
  try {
    if (message.type === "init") {
      await loadRuntime();
      safePost({ type: "ready", nonce });
      return;
    }
    if (message.type !== "verify") return;
    if (busy)
      throw new Error("Python worker is already running a verification");
    validateJob(message);
    const pyodide = await loadRuntime();
    busy = true;
    try {
      const resultJson = await pyodide.runPythonAsync(message.harness);
      if (
        typeof resultJson !== "string" ||
        byteLength(resultJson) > MAX_RESULT_BYTES
      )
        throw new Error("Python verification returned an invalid result");
      const result = JSON.parse(resultJson);
      safePost({ type: "result", nonce, result });
    } finally {
      busy = false;
    }
  } catch (error) {
    safePost({
      type: "error",
      nonce,
      error:
        error instanceof Error
          ? error.message.slice(0, 1200)
          : "Python worker failed",
    });
  }
});
