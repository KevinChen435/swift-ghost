import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, assessmentCenter, transferLab, items] = await Promise.all([
  readFile(
    new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../app/components/AssessmentCenter.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../app/components/TransferLab.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../app/lib/items.ts", import.meta.url), "utf8"),
]);

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `Missing source marker: ${start}`);
  assert.ok(endIndex > startIndex, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("transfer variants stay out of ordinary curriculum, catalog, and mock pools", () => {
  assert.match(items, /export const TRANSFER_ITEMS: PracticeItem\[\]/);
  assert.match(items, /itemId: `transfer:\$\{problem\.id\}` as ItemId/);
  assert.match(items, /\.\.\.TRANSFER_ITEMS,/);

  assert.match(
    app,
    /const curriculumItems = useMemo\(\s*\(\) => allItems\.filter\(\(candidate\) => !candidate\.transfer\)/,
  );

  for (const surface of [
    "TodayView",
    "StudyPlans",
    "SessionsView",
    "AssessmentCenter",
    "CatalogLibrary",
  ]) {
    assert.match(
      app,
      new RegExp(`<${surface}\\b[\\s\\S]*?items=\\{curriculumItems\\}`),
      `${surface} must receive the sealed-transfer-free curriculum`,
    );
  }

  const mockSelections = app.match(
    /selectMockInterviewItems\(\s*curriculumItems/g,
  ) ?? [];
  assert.ok(
    mockSelections.length >= 2,
    "both timed mocks and coding interviews must select from curriculum items",
  );
  assert.doesNotMatch(app, /selectMockInterviewItems\(\s*allItems/);
});

test("opening a transfer prompt records local exposure before practice navigation", () => {
  const coercion = section(app, "function coercePracticeKind(", "function matchesLane(");
  assert.match(
    coercion,
    /\| "transfer"[\s\S]*?if \(item\.transfer\) return "solving";/,
  );
  assert.ok(
    coercion.indexOf('if (item.transfer) return "solving";') <
      coercion.indexOf('requested === "solving"'),
    "transfer items must be forced into solving before requested route modes are considered",
  );

  const openItem = section(app, "function openItem(", "function chooseStage(");

  assert.match(
    openItem,
    /next\.transfer[\s\S]*?transferWorkspace: recordTransferOpened\([\s\S]*?navigated\.transferWorkspace,[\s\S]*?next\.itemId,[\s\S]*?variantRevision: next\.contentRevision/,
  );

  const exposureIndex = openItem.indexOf("recordTransferOpened(");
  const practiceViewIndex = openItem.indexOf('setView("practice")');
  const routeIndex = openItem.indexOf("writeRoute(routeForItem(");
  assert.ok(exposureIndex >= 0);
  assert.ok(practiceViewIndex > exposureIndex);
  assert.ok(routeIndex > exposureIndex);

  assert.match(
    app,
    /const hydratedState =\s*route\.view === "practice" && initialItem\.transfer[\s\S]*?recordTransferOpened\([\s\S]*?restored\.transferWorkspace,[\s\S]*?initialItem\.itemId/,
  );
  assert.match(
    app,
    /function onPopState\(\)[\s\S]*?route\.view === "practice" &&[\s\S]*?activeItem\.transfer[\s\S]*?recordTransferOpened\([\s\S]*?activeItem\.itemId/,
  );
});

test("progressive hints and revealed work preserve assistance level", () => {
  const useSolveHint = section(
    app,
    "function useSolveHint(",
    "function saveCatalogSavedView(",
  );
  assert.match(useSolveHint, /level: 1 \| 2 \| 3/);
  assert.match(
    useSolveHint,
    /item\.transfer[\s\S]*?recordTransferHint\([\s\S]*?item\.itemId,[\s\S]*?level,[\s\S]*?variantRevision: item\.contentRevision,[\s\S]*?referenceRevealed: level === 3/,
  );

  const practiceView = section(app, "function PracticeView(", "function SessionsView(");
  assert.match(
    practiceView,
    /const nextLevel = Math\.min\(3, solveHintLevel \+ 1\) as 1 \| 2 \| 3;[\s\S]*?props\.onUseHint\(nextLevel\)/,
  );
  assert.match(
    practiceView,
    /function inspectSubmission\([\s\S]*?props\.onUseHint\(3\)/,
  );
  assert.match(
    app,
    /key=\{`\$\{selectedId\}:\$\{item\.contentRevision\}:\$\{stage\}:\$\{practiceKind\}:\$\{practiceEpoch\}`\}/,
  );
});

test("unseen transfer cards render neutral identity and no revealed evidence", () => {
  const variantCard = section(
    transferLab,
    "function VariantCard(",
    "export function TransferLab(",
  );

  assert.match(variantCard, /const isUnseen = variant\.status === "unseen"/);
  assert.match(variantCard, /const revealed = isUnseen \? undefined : variant\.revealed/);
  assert.match(
    variantCard,
    /revealed\?\.title \?\?[\s\S]*?isUnseen[\s\S]*?"Hidden until you open it"/,
  );
  assert.match(
    variantCard,
    /labels=\{isUnseen \? \[\] : variant\.evidenceLabels\}/,
  );
  assert.match(
    variantCard,
    /The title, pattern, and problem family stay hidden for a valid cold start/,
  );

  assert.match(
    app,
    /const debriefReady = Boolean\([\s\S]*?progress\.attemptCount > 0[\s\S]*?progress\.isProven[\s\S]*?progress\.isDue[\s\S]*?revealed:[\s\S]*?debriefReady && candidate\.transfer/,
  );
});

test("active transfer solving hides recognition cues and ordinary navigation", () => {
  const practiceView = section(app, "function PracticeView(", "function SessionsView(");

  assert.match(practiceView, /const isTransfer = Boolean\(props\.item\.transfer\)/);
  assert.match(
    practiceView,
    /\{isLocked \|\| isTransfer \? "Pattern hidden" : props\.item\.pattern\}/,
  );
  assert.match(
    practiceView,
    /\{prompt && !isLocked && !isTransfer && \(/,
  );
  assert.match(
    practiceView,
    /\) : isTransfer \? \([\s\S]*?Cold-transfer evidence contract[\s\S]*?\) : \(\s*<div className="practice-kind-switch"/,
  );
  assert.match(
    practiceView,
    /isTransfer \? \([\s\S]*?className="assessment-practice-rail transfer-practice-rail"/,
  );
  assert.match(
    practiceView,
    /\.filter\(\s*\(item\) =>\s*!item\.transfer &&/,
  );
});

test("post-attempt transfer results reveal the contrast and return to the lab", () => {
  const resultDialog = section(app, "function ResultDialog(", "function PageHeading(");

  assert.match(resultDialog, /const isTransfer = Boolean\(result\.item\.transfer\)/);
  assert.match(
    resultDialog,
    /Pattern revealed after attempt[\s\S]*?postAttemptPatternLabel[\s\S]*?contrastExplanation[\s\S]*?Teach it back[\s\S]*?teachBackQuestion/,
  );
  assert.match(
    resultDialog,
    /onClick=\{onTransferLab\}[\s\S]*?Back to Transfer Lab/,
  );
  assert.match(app, /onTransferLab=\{openTransferLab\}/);

  assert.match(assessmentCenter, /onOpenTransferLab: \(\) => void/);
  assert.match(
    assessmentCenter,
    /onClick=\{onOpenTransferLab\}[\s\S]*?Open Transfer Lab/,
  );
});
