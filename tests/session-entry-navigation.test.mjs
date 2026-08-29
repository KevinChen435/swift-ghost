import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function section(source, start, end) {
  const startAt = source.indexOf(start);
  assert.notEqual(startAt, -1, `missing ${start}`);
  const endAt = end ? source.indexOf(end, startAt) : source.length;
  assert.notEqual(endAt, -1, `missing ${end}`);
  return source.slice(startAt, endAt);
}

test("session entry navigation reconciles the old draft before moving the cursor", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const openItem = section(app, "function openItem(", "function chooseStage(");
  assert.match(openItem, /forceFresh = false,\s*sessionEntryIndex\?: number/);
  assert.match(openItem, /const abandoned = resuming \? current : recordAbandon\(current\)/);
  assert.ok(
    openItem.indexOf("const abandoned =") <
      openItem.indexOf("currentIndex: sessionEntryIndex"),
    "the old draft must be recorded before the session cursor changes",
  );
  assert.match(openItem, /activeSession\.id === sessionId/);
  assert.match(openItem, /sessionEntryIndex < activeSession\.entries\.length/);
  assert.match(openItem, /currentIndex: sessionEntryIndex/);
  assert.match(openItem, /mockWorkspaceSource/);
});

test("session entry opening validates status, revision, transfer, and mock semantics", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const handler = section(app, "function openSessionEntry(", "function resumeSession(");
  assert.match(handler, /Number\.isInteger\(sessionEntryIndex\)/);
  assert.match(handler, /entry\.status !== "pending" && entry\.status !== "completed"/);
  assert.match(handler, /entry\.itemRevision < 1/);
  assert.match(handler, /candidate\.contentRevision === entry\.itemRevision/);
  assert.match(handler, /!candidate\.transfer/);
  assert.match(handler, /session\.kind === "mock" && practiceKind !== "solving"/);
  assert.match(handler, /sessionEntryIndex,\s*\);/);
});

test("active session preview exposes accessible open controls without changing mock skip rules", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const sessions = section(
    app,
    "function SessionsView(",
    "function RecordsSectionSwitch(",
  );
  assert.match(sessions, /onOpenSessionEntry/);
  assert.match(sessions, /disabled=\{!canOpen \|\| index === active\.currentIndex\}/);
  assert.match(sessions, /aria-label=\{/);
  assert.match(sessions, /Open session item \$\{index \+ 1\}/);
  assert.match(sessions, /onClick=\{\(\) => onOpenSessionEntry\(index\)\}/);
  assert.match(sessions, /\{index === active\.currentIndex \? "Current" : "Open"\}/);
  assert.match(app, /onOpenSessionEntry=\{openSessionEntry\}/);
  assert.match(app, /if \(session\.kind === "mock"\) \{\s*setToast\("Mock problems cannot be skipped/);
  assert.match(app, /if \(!virtualRoundId && blockVirtualRoundNavigation\(\)\) return;/);
});
