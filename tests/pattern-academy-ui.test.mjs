import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Pattern Academy is a first-class routed workspace with honest handoffs", async () => {
  const [app, component, routes] = await Promise.all([
    readFile(new URL("../app/components/SwiftGhostApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PatternAcademy.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/routes.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(app, /id: "learn", label: "Learn"/);
  assert.match(app, /view === "learn"[\s\S]*<PatternAcademy/);
  assert.match(app, /draftBoundary=\{`\$\{persistenceScope/);
  assert.match(app, /openItem\(next, nextStage, undefined, undefined, nextPracticeKind\)/);
  assert.match(routes, /view === "learn"[\s\S]*patternId/);
  assert.match(component, /Reading[\s\S]*is instruction—not solve evidence/);
  assert.match(component, /Full ghost opened|guided exposure/i);
  assert.match(component, /Open missing-lines stage/);
  assert.match(component, /Open local solve/);
  assert.match(component, /isolated server judge/);
  assert.doesNotMatch(component, /server verified|mastered|certified/i);
});

test("Academy uses accessible navigation, static code, and commit-before-reveal retrieval", async () => {
  const component = await readFile(
    new URL("../app/components/PatternAcademy.tsx", import.meta.url),
    "utf8",
  );
  assert.match(component, /nav aria-label="Pattern Academy lessons"/);
  assert.match(component, /aria-current=.*page/);
  assert.match(component, /tabIndex=\{0\}[\s\S]*aria-label=.*skeleton/);
  assert.match(component, /disabled=\{!saved\}/);
  assert.match(component, /Commit before reveal/);
  assert.match(component, /aria-pressed=\{saved\.grade === grade\.id\}/);
  assert.match(component, /draft\.boundary === draftBoundary/);
  assert.match(component, /draft\.savedResponse === savedResponse/);
  assert.match(component, /countStrongPatternChecks\(lessons, workspace\)/);
  assert.doesNotMatch(component, /SolveCodeEditor|PracticeEditor|CodeMirror/);
});

test("Academy layout covers narrow navigation, code overflow, focus, and forced colors", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.academy-detail-layout/);
  assert.match(css, /\.academy-code-shell pre[\s\S]*overflow: auto/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.main-nav[\s\S]*overflow-x: auto/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*\.academy-hero/);
});
