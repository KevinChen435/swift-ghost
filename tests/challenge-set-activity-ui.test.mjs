import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [component, styles, catalog] = await Promise.all([
  readFile(
    new URL("../app/components/ChallengeSetActivity.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(
    new URL("../app/components/CatalogLibrary.tsx", import.meta.url),
    "utf8",
  ),
]);

test("Challenge Set activity consumes immutable manifests and derived reports", () => {
  for (const contract of [
    "workspace: RunManifestWorkspace",
    "reports: readonly RunManifestReport[]",
    "selectedManifestId?: string",
    "onSelectManifest?:",
    "onResume:",
    "onOpenExecution:",
    "onArchive:",
  ]) {
    assert.match(component, new RegExp(contract.replace(/[?()[\]]/g, "\\$&")));
  }

  assert.match(component, /workspace\.manifests/);
  assert.match(component, /new Map\(reports\.map/);
  assert.match(component, /manifest\.status === "active"/);
  assert.match(component, />Active now</);
  assert.match(component, />History</);
  assert.match(component, /No Challenge Set activity yet/);
});

test("activity report shows bounded progress and explicit evidence trust without inventing mastery", () => {
  for (const count of [
    "selectedReport?.attemptedCount",
    "selectedReport?.acceptedCount",
    "selectedReport?.currentAcceptedCount",
    "selectedReport?.pendingCount",
  ]) {
    assert.ok(component.includes(count));
  }

  for (const evidence of [
    "accepted-current",
    "accepted-stale",
    "pending",
    "attempted",
    "not-started",
  ]) {
    assert.match(component, new RegExp(`case \\"${evidence}\\"|status: \\"${evidence}\\"`));
  }

  assert.match(component, /Activity progress only/);
  assert.match(component, /not a composite mastery,[\s\S]*interview-readiness score/);
  assert.match(component, /cannot claim current evidence/);
  assert.match(component, /judge receipt does[\s\S]*not match the current evidence revision/);
  assert.doesNotMatch(component, /readinessScore|masteryScore|compositeScore|scorePercent/);
});

test("immutable entry detail preserves launch provenance and revisions", () => {
  for (const text of [
    "Frozen at launch",
    "Immutable problem snapshot",
    "Content rev",
    "Judge rev",
    "Attempts",
    "Submissions",
    "Study plan",
    "Timed round",
    "Untimed practice",
    "No time limit",
  ]) {
    assert.match(component, new RegExp(text));
  }

  assert.match(component, /entry\.order \+ 1/);
  assert.match(component, /entry\.contentRevision/);
  assert.match(component, /entry\.judgeRevision/);
  assert.match(component, /entry\.currentEvidenceEligible/);
  assert.match(component, /selected\.source/);
  assert.match(component, /sourceLabel\(selected\.source\)/);
  assert.match(component, /manifest\.durationMinutes/);
  assert.match(component, /durationLabel\(selected\)/);
});

test("resume, linked execution, archive, and list-detail focus remain delegated", () => {
  assert.match(component, /onResume\(selected\.id, selected\.execution!\)/);
  assert.match(component, /onOpenExecution\(selected\.execution!\)/);
  assert.match(component, /onArchive\(selected\.id\)/);
  assert.match(component, /selected\.status === "completed" \|\| selected\.status === "ended"/);
  assert.match(component, /selected\.status === "active" && selected\.execution/);
  assert.doesNotMatch(component, /archiveRunManifest\(|finishRunManifest\(|startRunManifest\(/);

  assert.match(component, /const listHeadingRef = useRef<HTMLHeadingElement>\(null\)/);
  assert.match(component, /const detailHeadingRef = useRef<HTMLHeadingElement>\(null\)/);
  assert.match(component, /window\.requestAnimationFrame\(\(\) => detailHeadingRef\.current\?\.focus\(\)\)/);
  assert.match(component, /const \[mobileListOpen, setMobileListOpen\] = useState\(false\)/);
  assert.match(component, /const \[showArchived, setShowArchived\] = useState\(false\)/);
  assert.match(component, /manifest\.status !== "archived"/);
  assert.match(component, /Show archived/);
  assert.match(component, /aria-pressed=\{showArchived\}/);
  assert.match(component, /All Challenge Set activity is archived/);
  assert.match(component, /setMobileListOpen\(true\)/);
  assert.match(component, /selected && !mobileListOpen/);
  assert.match(component, /aria-current=\{selected \? "true" : undefined\}/);
  assert.match(component, /aria-label="Challenge Set evidence scope"/);
  assert.match(component, /aria-label="Challenge Set activity summary"/);
  assert.match(component, /← All Challenge Sets/);
});

test("practice resume requires the frozen prompt and judge revisions", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const start = app.indexOf("function resumeChallengeSet");
  const end = app.indexOf("function openChallengeSetExecution", start);
  const resume = app.slice(start, end);
  assert.notEqual(start, -1);
  assert.match(resume, /candidate\.contentRevision === snapshot\?\.contentRevision/);
  assert.match(resume, /snapshot\?\.judgeRevision === undefined/);
  assert.match(resume, /currentJudgeRevision\(candidate\) === snapshot\.judgeRevision/);
  assert.match(resume, /snapshot\.judgeRevision/);
  assert.match(resume, /frozen problem revision is unavailable/i);
});

test("Swift solve submissions preserve the active session context for Records", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const submitStart = app.indexOf("async function runSwiftSubmit");
  const submitEnd = app.indexOf("async function runSwiftExamples", submitStart);
  const submit = app.slice(submitStart, submitEnd);
  assert.notEqual(submitStart, -1);
  assert.match(submit, /const submissionContextKind: SubmissionContextKind/);
  assert.match(submit, /context:\s*\{[\s\S]*kind: submissionContextKind[\s\S]*sessionId: props\.draft\.sessionId/);

  const persistedStart = app.indexOf("const persistedSwiftRequestFor");
  const persistedEnd = app.indexOf("const reconcileSettledSwiftAssignment", persistedStart);
  const persisted = app.slice(persistedStart, persistedEnd);
  assert.match(persisted, /context: receipt\.context/);
});

test("planned Swift solve entries remain runnable instead of being demoted to typing", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const start = app.indexOf("const planned = plannedEntries");
  const end = app.indexOf("const entries = planned", start);
  const planned = app.slice(start, end);
  assert.match(planned, /entry\.practiceKind === "solving" && canSolveItem\(candidate\)/);
  assert.doesNotMatch(planned, /entry\.practiceKind === "solving" && candidate\.verification/);
});

test("direct Virtual Round launches are linked into the durable activity ledger", async () => {
  const app = await readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  );
  const start = app.indexOf("function startVirtualRoundPreset");
  const end = app.indexOf("function resumeVirtualRound", start);
  const launch = app.slice(start, end);
  assert.notEqual(start, -1);
  assert.match(launch, /createRunManifest\(/);
  assert.match(launch, /execution: \{ kind: "virtual-round", id: runId \}/);
  assert.match(launch, /startRunManifest\(/);
  assert.match(launch, /runManifests,\s*$/m);
});

test("Challenge Set activity and catalog launch styling cover responsive, touch, focus, and forced colors", () => {
  assert.match(styles, /\.challenge-set-layout\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(styles, /\.challenge-set-summary\s*\{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /\.challenge-set-layout\.has-selection \.challenge-set-list-panel\s*\{\s*display: none/);
  assert.match(styles, /\.challenge-set-back\s*\{[\s\S]*?display: inline-flex/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /\.challenge-set-actions button:focus-visible/);
  assert.match(styles, /\.challenge-set-list-tools button:focus-visible/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*?\.challenge-set-list-group button\.is-selected/);

  assert.match(catalog, /className="catalog-challenge-set-launch"/);
  assert.match(catalog, /Start untimed practice/);
  assert.match(catalog, /Start timed round/);
  assert.match(styles, /\.catalog-challenge-set-launch\s*\{/);
  assert.match(styles, /\.catalog-challenge-set-actions button:focus-visible/);
  assert.match(styles, /@media \(max-width: 470px\)[\s\S]*?\.catalog-challenge-set-actions/);
});
