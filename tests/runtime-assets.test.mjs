import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  cleanupObsoleteRuntimeDirectories,
  destination,
  OBSOLETE_RUNTIME_DIRECTORIES,
  PINNED_VERSION,
  REQUIRED_FILES,
  resolveObsoleteRuntimeTarget,
} from "../scripts/sync-python-runtime.mjs";

const EXPECTED_OBSOLETE_DIRECTORIES = [
  "pyodide",
  "pyodide-0.27.7",
  "pyodide-0.29.4",
];
const vendorRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "vendor",
);

test("obsolete runtime cleanup is restricted to exact direct-child allowlist entries", async () => {
  assert.deepEqual(
    [...OBSOLETE_RUNTIME_DIRECTORIES],
    EXPECTED_OBSOLETE_DIRECTORIES,
  );

  const removals = [];
  await cleanupObsoleteRuntimeDirectories(async (target, options) => {
    removals.push({ target, options });
  });

  assert.deepEqual(
    removals.map(({ target }) => path.basename(target)),
    EXPECTED_OBSOLETE_DIRECTORIES,
  );
  for (const { target, options } of removals) {
    assert.equal(path.dirname(target), vendorRoot);
    assert.deepEqual(options, { recursive: true, force: true });
  }
});

test("cleanup target validation rejects traversal, wildcards, pinned, and unrelated content", () => {
  for (const unsafeName of [
    "",
    "pyodide*",
    "pyodide-0.29.4-copy",
    "../pyodide",
    "nested/pyodide",
    path.resolve("pyodide"),
    `micropython-${PINNED_VERSION}`,
    "unrelated-library",
  ]) {
    assert.throws(
      () => resolveObsoleteRuntimeTarget(unsafeName),
      /Refusing to remove non-allowlisted runtime directory/,
    );
  }
});

test("the worker, runner, and local server support the pinned MicroPython runtime", async () => {
  assert.equal(PINNED_VERSION, "1.28.0-6");
  assert.deepEqual([...REQUIRED_FILES], ["micropython.mjs", "micropython.wasm"]);
  assert.equal(path.basename(destination), `micropython-${PINNED_VERSION}`);
  assert.equal(path.dirname(destination), vendorRoot);

  const [workerSource, runnerSource, startSource] = await Promise.all([
    readFile(new URL("../public/python-runner.worker.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/python-runner.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/start.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(
    workerSource,
    new RegExp(
      `from "\\./vendor/micropython-${PINNED_VERSION.replaceAll(".", "\\.")}/micropython\\.mjs"`,
    ),
  );
  assert.match(
    workerSource,
    new RegExp(`MICROPYTHON_VERSION = "${PINNED_VERSION.replaceAll(".", "\\.")}"`),
  );
  assert.match(
    runnerSource,
    new RegExp(`python-runner\\.worker\\.mjs\\?v=${PINNED_VERSION.replaceAll(".", "\\.")}-micropython-1`),
  );
  assert.doesNotMatch(`${workerSource}\n${runnerSource}`, /pyodide/i);
  assert.match(startSource, /CONTENT_TYPES\["\.wasm"\] = "application\/wasm"/);

  for (const artifact of REQUIRED_FILES) {
    const metadata = await stat(path.join(destination, artifact));
    assert.equal(metadata.isFile(), true);
    assert.ok(metadata.size > 0, `${artifact} should not be empty`);
  }
});
