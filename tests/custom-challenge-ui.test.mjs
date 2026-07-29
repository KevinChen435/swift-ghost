import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const studio = await readFile(
  new URL("../app/components/CustomChallengeDialog.tsx", import.meta.url),
  "utf8",
);
const catalog = await readFile(
  new URL("../app/components/CatalogLibrary.tsx", import.meta.url),
  "utf8",
);
const styles = await readFile(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

test("the studio exposes a complete four-step challenge authoring workflow", () => {
  for (const label of ["Basics", "Contract", "Judge cases", "Solution"])
    assert.match(studio, new RegExp(`label: "${label}"`));
  for (const field of [
    "Problem statement",
    "Callable style",
    "Function name",
    "Method name",
    "Parameters",
    "Return contract",
    "Arguments · JSON array",
    "Expected output · JSON",
    "Starter code",
    "reference solution",
  ])
    assert.match(studio, new RegExp(field, "i"));
});

test("sample visibility and hidden judging are explicit and bounded", () => {
  assert.match(studio, /Visible sample/);
  assert.match(studio, /Hidden on submit/);
  assert.match(studio, /CUSTOM_CHALLENGE_LIMITS\.cases/);
  assert.match(studio, /CUSTOM_CHALLENGE_LIMITS\.parameters/);
  assert.match(studio, /sampleCount/);
  assert.match(studio, /hiddenCount/);
  assert.match(studio, /Run examples/);
  assert.match(studio, /Submit/);
});

test("saving a runnable challenge requires the current reference fingerprint to pass", () => {
  assert.match(studio, /currentFingerprint/);
  assert.match(studio, /validatedFingerprint === currentFingerprint/);
  assert.match(studio, /runner\.verify\(code, bundle\.verification\)/);
  assert.match(studio, /runner\.verify\(\s*bundle\.starterCode,/);
  assert.match(studio, /starterResult\.setupError/);
  assert.match(studio, /effectiveReferenceStatus === "passed"/);
  assert.match(studio, /disabled=\{!canSave\}/);
  assert.match(studio, /runner\.dispose\(\)/);
  assert.match(studio, /referenceValidationRunId/);
  assert.match(studio, /runId !== referenceValidationRunId\.current/);
});

test("the Library launches the builder and labels runnable custom items", () => {
  assert.match(catalog, /Build practice item/);
  assert.match(catalog, /item\.verification \? "challenge" : "snippet"/);
  assert.match(catalog, /canSolve/);
  assert.match(catalog, />\s*Solve\s*</);
});

test("the studio becomes a full-height mobile workspace with safe-area actions", () => {
  assert.match(styles, /\.challenge-studio-dialog\s*\{/);
  assert.match(styles, /grid-template-rows: auto auto minmax\(0, 1fr\) auto/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /min-height: 100dvh/);
  assert.match(styles, /\.challenge-builder-footer\s*\{[\s\S]*?position: fixed/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test("the modal keeps keyboard focus inside the authoring workspace", () => {
  assert.match(studio, /event\.key !== "Tab"/);
  assert.match(studio, /dialog\.querySelectorAll<HTMLElement>/);
  assert.match(studio, /lastFocusable\.focus\(\)/);
  assert.match(studio, /firstFocusable\.focus\(\)/);
  assert.match(studio, /tabIndex=\{-1\}/);
});

test("the modal confirms before discarding unsaved authoring work", () => {
  assert.match(studio, /initialAuthoringFingerprint/);
  assert.match(studio, /Discard your unsaved practice item changes/);
  assert.match(studio, /useDialogKeyboard\(requestClose, dialogRef\)/);
  assert.match(studio, /onClick=\{requestClose\}/);
});
