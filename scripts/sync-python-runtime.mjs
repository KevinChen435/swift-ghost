import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PINNED_VERSION = "1.28.0-6";
export const REQUIRED_FILES = Object.freeze([
  "micropython.mjs",
  "micropython.wasm",
]);
export const OBSOLETE_RUNTIME_DIRECTORIES = Object.freeze([
  "pyodide",
  "pyodide-0.27.7",
  "pyodide-0.29.4",
]);

const obsoleteRuntimeDirectoryAllowlist = new Set(
  OBSOLETE_RUNTIME_DIRECTORIES,
);
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const vendorRoot = path.resolve(projectRoot, "public", "vendor");
const packageRoot = path.join(
  projectRoot,
  "node_modules",
  "@micropython",
  "micropython-webassembly-pyscript",
);
export const destination = path.join(
  vendorRoot,
  `micropython-${PINNED_VERSION}`,
);

export function resolveObsoleteRuntimeTarget(directoryName) {
  if (!obsoleteRuntimeDirectoryAllowlist.has(directoryName)) {
    throw new Error(
      `Refusing to remove non-allowlisted runtime directory: ${String(directoryName)}`,
    );
  }

  const target = path.resolve(vendorRoot, directoryName);
  if (
    path.dirname(target) !== vendorRoot ||
    path.basename(target) !== directoryName
  ) {
    throw new Error(
      `Refusing to remove runtime outside public/vendor: ${directoryName}`,
    );
  }
  return target;
}

export async function cleanupObsoleteRuntimeDirectories(remove = rm) {
  for (const directoryName of OBSOLETE_RUNTIME_DIRECTORIES) {
    const target = resolveObsoleteRuntimeTarget(directoryName);
    await remove(target, { recursive: true, force: true });
  }
}

export async function syncPythonRuntime() {
  const packageMetadata = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8"),
  );
  if (packageMetadata.version !== PINNED_VERSION) {
    throw new Error(
      `Expected MicroPython ${PINNED_VERSION}, found ${packageMetadata.version ?? "an unknown version"}`,
    );
  }

  await cleanupObsoleteRuntimeDirectories();
  await mkdir(destination, { recursive: true });
  await Promise.all(
    REQUIRED_FILES.map((file) =>
      copyFile(path.join(packageRoot, file), path.join(destination, file)),
    ),
  );
  console.log(
    `Synced MicroPython ${PINNED_VERSION} browser runtime (${REQUIRED_FILES.length} files).`,
  );
}

const isDirectInvocation =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectInvocation) await syncPythonRuntime();
