import { loadMicroPython } from "./vendor/micropython-1.28.0-6/micropython.mjs";

const MICROPYTHON_VERSION = "1.28.0-6";
// Each worker is short-lived and is replaced after a run, failure, or timeout.
// Keep its linear memory bounded so opening a Python exercise cannot reserve
// the previous 32 MiB budget on every tab. 8 MiB covers the shipped catalog
// and harness (including all 56 built-in/transfer verification fixtures).
const MICROPYTHON_HEAP_SIZE_BYTES = 8 * 1024 * 1024;
const MICROPYTHON_BASE_URL = new URL(
  `./vendor/micropython-${MICROPYTHON_VERSION}/`,
  import.meta.url,
);
const MICROPYTHON_WASM_URL = new URL("micropython.wasm", MICROPYTHON_BASE_URL);
const MAX_SOURCE_BYTES = 48_000;
const MAX_SPEC_BYTES = 64_000;
const MAX_HARNESS_BYTES = 180_000;
const MAX_RESULT_BYTES = 160_000;
const MAX_CASES = 64;
const NONCE_PATTERN = /^[a-f0-9]{32}$/;

let runtimePromise;
let busy = false;
let activeOutput = null;

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function safePost(message) {
  self.postMessage(message);
}

function appendOutput(channel, value) {
  if (!activeOutput) return;
  const text =
    value instanceof Uint8Array
      ? activeOutput.decoders[channel].decode(value, { stream: true })
      : String(value);
  const used = activeOutput[channel].reduce(
    (total, part) => total + part.length,
    0,
  );
  if (used >= 8_000) return;
  activeOutput[channel].push(text.slice(0, 8_000 - used));
}

function blockNetworkPrimitives() {
  const blocked = () => {
    throw new Error("Network access is disabled during Python verification");
  };
  // Keep JavaScript language intrinsics intact: MicroPython uses them internally
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
      if (typeof loadMicroPython !== "function")
        throw new Error("vendored Python runtime is invalid");
      const loaded = await loadMicroPython({
        url: MICROPYTHON_WASM_URL.href,
        heapsize: MICROPYTHON_HEAP_SIZE_BYTES,
        stdout: (line) => appendOutput("stdout", line),
        stderr: (line) => appendOutput("stderr", line),
        linebuffer: false,
      });
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
    const python = await loadRuntime();
    busy = true;
    activeOutput = {
      stdout: [],
      stderr: [],
      decoders: { stdout: new TextDecoder(), stderr: new TextDecoder() },
    };
    try {
      python.runPython(message.harness);
      appendOutput("stdout", activeOutput.decoders.stdout.decode());
      appendOutput("stderr", activeOutput.decoders.stderr.decode());
      const resultJson = python.globals.get("_RESULT_JSON");
      if (
        typeof resultJson !== "string" ||
        byteLength(resultJson) > MAX_RESULT_BYTES
      )
        throw new Error("Python verification returned an invalid result");
      const result = JSON.parse(resultJson);
      result.stdout = activeOutput.stdout.join("");
      result.stderr = activeOutput.stderr.join("");
      safePost({ type: "result", nonce, result });
    } finally {
      activeOutput = null;
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
