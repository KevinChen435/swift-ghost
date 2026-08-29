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
      openItem.indexOf("currentIndex: requestedSessionEntry.index"),
    "the old draft must be recorded before the session cursor changes",
  );
  assert.match(openItem, /activeSession\.id === sessionId/);
  assert.match(openItem, /sessionEntryIndex < activeSession\.entries\.length/);
  assert.match(openItem, /currentIndex: requestedSessionEntry\.index/);
  assert.match(openItem, /mockWorkspaceSource/);
});

test("resuming an active session routes through the same pending-entry revision gate", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const resume = section(app, "function resumeSession()", "function skipSessionEntry(");
  assert.match(resume, /entry\.status === "pending"/);
  assert.match(resume, /findIndex\(\(entry\) => entry\.status === "pending"\)/);
  assert.match(resume, /openSessionEntry\(pendingIndex\)/);
  assert.match(resume, /no pending work left to resume/);
});

test("session entry opening validates status, revision, transfer, and mock semantics", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const handler = section(app, "function openSessionEntry(", "function resumeSession(");
  assert.match(handler, /Number\.isInteger\(sessionEntryIndex\)/);
  assert.match(handler, /entry\.status !== "pending" && entry\.status !== "completed"/);
  assert.match(handler, /entry\.itemRevision < 1/);
  assert.match(handler, /candidate\.contentRevision === entry\.itemRevision/);
  assert.match(handler, /!candidate\.transfer/);
  assert.match(handler, /session\.kind === "mock" && entry\.status === "completed"/);
  assert.match(handler, /entry\.status === "completed" \? undefined : session\.id/);
  assert.match(handler, /Completed mock items stay locked until the debrief/);
  assert.match(handler, /targetSessionEntryIndex,\s*\);/);
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
  assert.match(sessions, /active\.kind !== "mock" \|\| entry\.status === "pending"/);
  assert.match(sessions, /aria-label=\{/);
  assert.match(sessions, /Review.*session item \$\{index \+ 1\}/);
  assert.match(sessions, /onClick=\{\(\) => onOpenSessionEntry\(index\)\}/);
  assert.match(sessions, /entry\.status === "completed"\s*\? "Review"\s*:\s*"Open"/);
  assert.match(app, /onOpenSessionEntry=\{openSessionEntry\}/);
  assert.match(app, /if \(session\.kind === "mock"\) \{\s*setToast\("Mock problems cannot be skipped/);
  assert.match(app, /if \(!virtualRoundId && blockVirtualRoundNavigation\(\)\) return;/);
});

test("session builder exposes the practice-mode queue contract", async () => {
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const product = await read("../app/lib/product.ts");
  const sessions = section(
    app,
    "function SessionsView(",
    "function RecordsSectionSwitch(",
  );
  assert.match(sessions, /useState<SessionPracticeMode>\("smart"\)/);
  assert.match(sessions, /practiceMode,/);
  assert.match(sessions, /<span>Practice mode<\/span>/);
  assert.match(sessions, /<option value="typing">Known-answer typing<\/option>/);
  assert.match(sessions, /<option value="solving">Swift judge solves<\/option>/);
  assert.match(sessions, /if \(next === "solving"\)/);
  assert.match(sessions, /setTrack\("interview"\)/);
  assert.match(sessions, /setLanguage\("swift"\)/);
  assert.match(sessions, /Only current server-judged Swift contracts appear/);
  assert.match(sessions, /disabled=\{practiceMode === "solving"\}/);
  assert.match(product, /practiceMode\?: SessionPracticeMode/);
  assert.match(product, /value\.practiceMode as SessionPracticeMode/);
  assert.match(app, /practiceMode: options\.practiceMode \?\? "smart"/);
});
