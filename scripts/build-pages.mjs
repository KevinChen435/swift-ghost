import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanPagesOutput } from "./pages-output.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = join(repositoryRoot, "package.json");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));

const outputPath = resolve(repositoryRoot, "out");
await cleanPagesOutput({
  repositoryRoot,
  outputPath,
  packageName: packageJson.name,
});

const nextCliPath = join(repositoryRoot, "node_modules", "next", "dist", "bin", "next");
const build = spawnSync(process.execPath, [nextCliPath, "build"], {
  cwd: repositoryRoot,
  env: { ...process.env, GITHUB_ACTIONS: "true" },
  stdio: "inherit",
});

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
