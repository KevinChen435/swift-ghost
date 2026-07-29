import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Cold Reconstruction is a routed, autosaved, evidence-honest product surface", async () => {
  const [component, app, routes, product] = await Promise.all([
    readFile(new URL("app/components/ConceptTransferLab.tsx", root), "utf8"),
    readFile(new URL("app/components/SwiftGhostApp.tsx", root), "utf8"),
    readFile(new URL("app/lib/routes.mjs", root), "utf8"),
    readFile(new URL("app/lib/product.ts", root), "utf8"),
  ]);

  assert.match(component, /Commit before reveal/);
  assert.match(component, /not compiled or semantically graded/);
  assert.match(component, /Project-authored reference/);
  assert.match(component, /onSaveDraft/);
  assert.match(component, /onSaveDebrief/);
  assert.match(component, /onSaveDebrief\(attempt\.id, \{ grade: entry \}\)/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /revealHeadingRef/);

  assert.match(app, /patternReviewMode === "reconstruct"[\s\S]*<ConceptTransferLab/);
  assert.match(app, /function saveConceptTransferDebrief/);
  assert.match(app, /openConceptTransferLab\("today", lane\)/);
  assert.match(app, /openConceptTransferLab\("academy", lane\)/);
  assert.match(app, /openConceptTransferLab\("weakness", lane\)/);
  assert.match(app, /openConceptTransferLab\("assessment", lane\)/);
  assert.match(app, /conceptTransferVariants: CONCEPT_TRANSFER_VARIANTS/);
  assert.match(app, /typingProgress: applyTypingAttempt/);

  assert.match(routes, /CONCEPT_TRANSFER_SOURCES/);
  assert.match(routes, /url\.searchParams\.set\("from", route\.conceptTransferSource\)/);
  assert.match(product, /version: 32;/);
  assert.match(product, /typingProgress: TypingProgressionWorkspace/);
  assert.match(product, /conceptTransfer: ConceptTransferWorkspace/);
  assert.match(product, /THIRTY_FIRST_STORAGE_KEY = "swift-ghost-state-v31"/);
});

test("Cold Reconstruction has desktop, mobile, keyboard-focus, and forced-color styling", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(css, /\.concept-transfer-shell/);
  assert.match(css, /\.concept-transfer-compare-grid/);
  assert.match(css, /\.ghosted-reference/);
  assert.match(
    css,
    /@media \(max-width: 720px\)[\s\S]*\.concept-transfer-compare-grid/,
  );
  assert.match(
    css,
    /@media \(forced-colors: active\)[\s\S]*\.concept-transfer-shell/,
  );
});
