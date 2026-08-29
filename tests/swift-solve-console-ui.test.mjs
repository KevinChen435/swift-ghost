import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Swift solve console exposes a muted answer sketch for typing rehearsal", async () => {
  const component = await read("../app/components/SwiftSolveConsole.tsx");
  const styles = await read("../app/globals.css");

  assert.match(component, /Muted answer sketch/);
  assert.match(component, /Keep the outline visible while you type your own pass\./);
  assert.match(component, /Keep the outline visible while you rehearse the Swift pass\./);
  assert.match(component, /aria-labelledby="swift-answer-sketch-title"/);
  assert.match(component, /aria-labelledby="swift-answer-sketch-fallback-title"/);
  assert.match(component, /aria-pressed=\{sketchFocused\}/);
  assert.match(component, /Focus answer/);
  assert.match(component, /Soft blur/);
  assert.match(component, /setSketchFocusByChallenge/);
  assert.match(component, /\[challengeKey\]: !current\[challengeKey\]/);
  assert.doesNotMatch(component, /setSketchFocused\(false\)/);
  assert.match(component, /fallbackSketchLines/);
  assert.match(component, /swift-answer-sketch--fallback/);
  assert.match(component, /dossier\.rows\.map/);
  assert.match(component, /swift-answer-sketch-grid/);
  assert.match(component, /swift-answer-sketch-footer/);
  assert.match(component, /swift-explanation-notes/);

  assert.match(styles, /\.swift-answer-sketch\s*\{/);
  assert.match(styles, /\.swift-solve-console-empty \.swift-answer-sketch\s*\{/);
  assert.match(styles, /\.swift-answer-sketch--fallback\s*\{/);
  assert.match(styles, /\.swift-answer-sketch-grid\s*\{/);
  assert.match(styles, /\.swift-answer-sketch-grid\.is-muted/);
  assert.match(styles, /filter:\s*blur\(1\.5px\);/);
  assert.match(styles, /\.swift-answer-sketch-footer\s*\{/);
  assert.match(styles, /@media \(max-width: 1100px\)[\s\S]*\.swift-answer-sketch-grid/);
  assert.match(styles, /@media \(max-width: 470px\)[\s\S]*\.swift-answer-sketch header/);
});
