import path from "node:path";

// Vinext 0.0.50 builds its static-file cache from path.relative(). On Windows,
// that returns backslashes, while browser request paths always use slashes.
// Normalize the paths before loading the production server so local production
// previews serve the same hashed assets that Workers serve on Linux.
const platformRelative = path.relative.bind(path);

const { loadEnv } = await import("vite");
const productionEnv = loadEnv("production", process.cwd(), "");
for (const [name, value] of Object.entries(productionEnv)) {
  if (process.env[name] === undefined) process.env[name] = value;
}

function option(name, shortName, fallback) {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(`--${name}=`)) {
      const value = arg.slice(name.length + 3);
      if (!value) throw new Error(`--${name} requires a value`);
      return value;
    }
    if (arg === `--${name}` || arg === shortName) {
      const value = args[index + 1];
      if (!value || /^(?:--|-[A-Za-z]$)/.test(value)) throw new Error(`${arg} requires a value`);
      return value;
    }
  }
  return fallback;
}

const rawPort = option("port", "-p", process.env.PORT || "3000");
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid port: ${rawPort}`);

if (process.platform === "win32") path.relative = (...args) => platformRelative(...args).replaceAll("\\", "/");

// Vinext 0.0.50 omits .wasm from its static MIME map. Patch the shared map
// before the server constructs its immutable file cache so browsers can use
// WebAssembly.instantiateStreaming instead of downloading and recompiling a
// generic octet stream. Resolve from Vinext's public entry rather than relying
// on a machine-specific node_modules path.
const vinextEntryUrl = import.meta.resolve("vinext");
const staticCacheUrl = new URL("./server/static-file-cache.js", vinextEntryUrl);
const { CONTENT_TYPES } = await import(staticCacheUrl.href);
CONTENT_TYPES[".wasm"] = "application/wasm";

const { startProdServer } = await import("vinext/server/prod-server");
try {
  await startProdServer({
    port,
    host: option("hostname", "-H", "0.0.0.0"),
    outDir: path.resolve("dist"),
  });
} finally {
  path.relative = platformRelative;
}
