import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [component, styles] = await Promise.all([
  readFile(
    new URL("../app/components/AttemptClosureCenter.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("attempt closure center exposes the bounded Records workspace contract", () => {
  for (const prop of [
    "workspace: AttemptClosureWorkspace",
    "model: AttemptClosureModel",
    "items: readonly PracticeItem[]",
    "selectedId?: string",
    "onSelect:",
    "onSave:",
    "onComplete:",
    "onRetry:",
  ])
    assert.match(component, new RegExp(prop.replace(/[?()[\]]/g, "\\$&")));

  for (const count of ["model.summary.open", "model.summary.due", "model.summary.resolved", "model.summary.retired"])
    assert.match(component, new RegExp(count.replaceAll(".", "\\.")));
  assert.match(component, /Remediation, not mastery/);
  assert.match(component, /do not count as a solve or mastery/i);
  assert.match(component, /private local workspace/i);
});

test("failure anchors remain visible and immutable while reflection fields are complete", () => {
  assert.match(component, /Original attempt anchor/);
  assert.match(component, /selected\.anchor\.outcome/);
  assert.match(component, /selected\.anchor\.occurredAt/);
  assert.match(component, /selected\.anchor\.assistance/);
  assert.match(component, /selected\.anchor\.id/);
  assert.match(component, /This anchor is immutable/);

  for (const label of [
    "Mistake tags",
    "First wrong decision",
    "Verification notes",
    "Teach-back",
    "Retrieval grade",
    "Again",
    "Hard",
    "Good",
    "Easy",
  ])
    assert.match(component, new RegExp(label));
  assert.match(component, /ATTEMPT_CLOSURE_MISTAKE_TAGS\.map/);
  assert.match(component, /ATTEMPT_CLOSURE_LIMITS\.maxTags/);
  assert.match(component, /maxLength=\{ATTEMPT_CLOSURE_LIMITS\.maxTextChars\}/);
});

test("draft and completion actions delegate without mutating the domain locally", () => {
  assert.match(component, /onSave\(selected\.id, form, selected\.updatedAt\)/);
  assert.match(component, /onComplete\(selected\.id, selected\.updatedAt\)/);
  assert.match(component, /expectedUpdatedAt: string/);
  assert.match(component, /Save this complete draft before closing the record/);
  assert.match(component, /disabled=\{[\s\S]*?isDirty[\s\S]*?persistedCompletionIssues\.length > 0/);
  assert.doesNotMatch(component, /updateAttemptClosureDraft\(/);
  assert.doesNotMatch(component, /completeAttemptClosure\(/);
  assert.match(component, /Save draft/);
  assert.match(component, /Complete closure/);
});

test("clean retry status is honest and only routes runnable current evidence", () => {
  assert.match(component, /Retry is due now/);
  assert.match(component, /Start clean retry/);
  assert.match(component, /current-revision, hint-free accepted attempt/);
  assert.match(component, /item\.language === "python"/);
  assert.match(component, /item\.verification/);
  assert.match(component, /selected\.status === "due"/);
  assert.match(component, /onRetry\(selected\.id\)/);
  assert.match(component, /No local runner is available for this closure lane/);
  assert.match(component, /selected\.resolutionAttemptId/);
  assert.match(component, /selected\.resolutionSubmissionId/);
});

test("list-detail navigation moves focus and retains keyboard semantics", () => {
  assert.match(component, /const listHeadingRef = useRef<HTMLHeadingElement>\(null\)/);
  assert.match(component, /const detailHeadingRef = useRef<HTMLHeadingElement>\(null\)/);
  assert.match(component, /window\.requestAnimationFrame\(\(\) => target\.focus\(\)\)/);
  assert.match(component, /ref=\{listHeadingRef\} tabIndex=\{-1\}/);
  assert.match(component, /ref=\{detailHeadingRef\} tabIndex=\{-1\}/);
  assert.match(component, /← All closure records/);
  assert.match(component, /onClick=\{\(\) => onSelect\(\)\}/);
  assert.match(component, /role="group" aria-label="Filter attempt closures by status"/);
  assert.match(component, /aria-pressed=\{filter === option\.id\}/);
  assert.match(component, /aria-current=\{active \? "true" : undefined\}/);
  assert.match(component, /role="status"/);
  assert.match(component, /aria-live="polite"/);
});

test("attempt closure styling supports desktop, mobile, safe areas, focus, and forced colors", () => {
  assert.match(styles, /\.attempt-closure-layout\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /\.attempt-closure-layout\.has-selection \.attempt-closure-list-panel\s*\{\s*display: none/);
  assert.match(styles, /\.attempt-closure-back\s*\{\s*display: inline-flex/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /\.attempt-closure-toolbar > div \{[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/);
  assert.match(styles, /\.attempt-closure-field textarea:focus-visible/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /\.attempt-closure-list button\.is-active[\s\S]*?outline: 3px solid Highlight/);
});
