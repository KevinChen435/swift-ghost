import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PINNED_VERSION = "314.0.3";
const REQUIRED_FILES = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "pyodide-lock.json",
  "python_stdlib.zip",
];
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageRoot = path.join(projectRoot, "node_modules", "pyodide");
const destination = path.join(projectRoot, "public", "vendor", "pyodide");

const packageMetadata = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8"),
);
if (packageMetadata.version !== PINNED_VERSION) {
  throw new Error(
    `Expected pyodide ${PINNED_VERSION}, found ${packageMetadata.version ?? "an unknown version"}`,
  );
}

await mkdir(destination, { recursive: true });
await Promise.all(
  REQUIRED_FILES.map((file) =>
    copyFile(path.join(packageRoot, file), path.join(destination, file)),
  ),
);
console.log(
  `Synced Pyodide ${PINNED_VERSION} browser runtime (${REQUIRED_FILES.length} files).`,
);
