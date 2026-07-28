import { lstat, rm } from "node:fs/promises";
import { dirname, parse, resolve } from "node:path";

export function validatePagesOutputPath({ repositoryRoot, outputPath, packageName }) {
  const resolvedRepositoryRoot = resolve(repositoryRoot);
  const resolvedOutputPath = resolve(outputPath);
  const parsedOutputPath = parse(resolvedOutputPath);

  if (packageName !== "swift-ghost") {
    throw new Error("Refusing to clean Pages output outside the Swift Ghost project.");
  }

  if (
    dirname(resolvedOutputPath) !== resolvedRepositoryRoot ||
    parsedOutputPath.base !== "out" ||
    resolvedOutputPath === parsedOutputPath.root
  ) {
    throw new Error("Refusing to clean an unexpected Pages output path.");
  }

  return resolvedOutputPath;
}

export async function cleanPagesOutput(options) {
  const outputPath = validatePagesOutputPath(options);

  try {
    const outputStats = await lstat(outputPath);
    if (outputStats.isSymbolicLink()) {
      throw new Error("Refusing to clean a symbolic-link Pages output path.");
    }
    await rm(outputPath, { recursive: true });
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}
