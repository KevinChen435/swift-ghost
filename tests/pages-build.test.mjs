import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  cleanPagesOutput,
  validatePagesOutputPath,
} from "../scripts/pages-output.mjs";

const buildPagesSource = await readFile(
  new URL("../scripts/build-pages.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("Pages builds start from a validated clean output directory", () => {
  assert.equal(packageJson.scripts["build:pages"], "node scripts/build-pages.mjs");
  assert.match(buildPagesSource, /cleanPagesOutput/);
});

test("Pages builds always enable the static export configuration", () => {
  assert.match(buildPagesSource, /GITHUB_ACTIONS: "true"/);
  assert.match(buildPagesSource, /\[nextCliPath, "build"\]/);
});

test("Pages cleanup removes stale output from only the exact project child", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "swift-ghost-pages-"));
  const repositoryRoot = join(temporaryRoot, "repository");
  const outputPath = join(repositoryRoot, "out");
  const siblingPath = join(repositoryRoot, "keep.txt");

  try {
    await mkdir(outputPath, { recursive: true });
    await writeFile(join(outputPath, "stale.txt"), "stale");
    await writeFile(siblingPath, "keep");

    await cleanPagesOutput({ repositoryRoot, outputPath, packageName: "swift-ghost" });

    await assert.rejects(access(outputPath));
    await access(siblingPath);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Pages cleanup rejects unrelated projects and non-child targets", () => {
  assert.throws(
    () =>
      validatePagesOutputPath({
        repositoryRoot: "C:/workspace/swift-ghost",
        outputPath: "C:/workspace/swift-ghost/out",
        packageName: "another-project",
      }),
    /outside the Swift Ghost project/,
  );
  assert.throws(
    () =>
      validatePagesOutputPath({
        repositoryRoot: "C:/workspace/swift-ghost",
        outputPath: "C:/workspace/out",
        packageName: "swift-ghost",
      }),
    /unexpected Pages output path/,
  );
});
