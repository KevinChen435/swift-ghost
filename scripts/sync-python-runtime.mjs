import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PINNED_VERSION = "1.28.0-6";
const REQUIRED_FILES = ["micropython.mjs", "micropython.wasm"];
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageRoot = path.join(
  projectRoot,
  "node_modules",
  "@micropython",
  "micropython-webassembly-pyscript",
);
const destination = path.join(
  projectRoot,
  "public",
  "vendor",
  `micropython-${PINNED_VERSION}`,
);

const packageMetadata = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8"),
);
if (packageMetadata.version !== PINNED_VERSION) {
  throw new Error(
    `Expected MicroPython ${PINNED_VERSION}, found ${packageMetadata.version ?? "an unknown version"}`,
  );
}

await mkdir(destination, { recursive: true });
await Promise.all(
  REQUIRED_FILES.map((file) =>
    copyFile(path.join(packageRoot, file), path.join(destination, file)),
  ),
);
console.log(
  `Synced MicroPython ${PINNED_VERSION} browser runtime (${REQUIRED_FILES.length} files).`,
);
