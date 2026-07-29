import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Studio wires routeable practice recaps to full and weak replay", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  assert.match(app, /const \[selectedSessionId, setSelectedSessionId\] = useState<string>\(\)/);
  assert.match(app, /setSelectedSessionId\(route\.sessionId\)/);
  assert.match(app, /writeRoute\(\{ view: "sessions", sessionId \}, replace\)/);
  assert.match(app, /buildSessionReplayQueue\([\s\S]*record,[\s\S]*current\.attempts,[\s\S]*curriculumItems,[\s\S]*mode/);
  assert.match(app, /selectedSessionId=\{selectedSessionId\}/);
  assert.match(app, /onReplaySession=\{replayPracticeSession\}/);
  assert.match(app, /result\.sessionComplete[\s\S]*openSessionRecap\(completedSessionId\)/);
});

test("recap UI discloses trust boundaries, stale content, and legacy limits", async () => {
  const recap = await read("../app/components/SessionRecap.tsx");
  assert.match(recap, /matched by saved attempt ID, item revision, and session/);
  assert.match(recap, /Replay uses the current content/);
  assert.match(recap, /excluded from replay/);
  assert.match(recap, /will not guess the original queue/);
  assert.match(recap, /titleRef\.current\?\.focus\(\)/);
  assert.match(recap, /disabled=\{!recap\.weakAvailableCount\}/);
  assert.match(recap, /disabled=\{!recap\.availableCount\}/);
});

test("recap layout has desktop, mobile, and forced-colors coverage", async () => {
  const css = await read("../app/globals.css");
  assert.match(css, /\.session-recap-stats \{/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.session-recap-list li/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*\.session-recap-hero/);
});
