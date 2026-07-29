import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `Missing source marker: ${start}`);
  assert.ok(endIndex > startIndex, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Records renders transfer evidence as a first-class local workspace", async () => {
  const [app, component] = await Promise.all([
    read("../app/components/SwiftGhostApp.tsx"),
    read("../app/components/TransferEvidenceRecords.tsx"),
  ]);

  assert.match(
    app,
    /import \{ TransferEvidenceRecords \} from "\.\/TransferEvidenceRecords";/,
  );
  assert.match(app, /if \(section === "transfer"\) \{/);
  assert.match(app, /<RecordsSectionSwitch section="transfer"/);
  assert.match(app, /<TransferEvidenceRecords\b/);
  const transferBranch = section(
    app,
    'if (section === "transfer") {',
    'if (section === "reviews") {',
  );
  assert.match(
    transferBranch,
    /buildTransferRecords\(\{[\s\S]*?variants: items\.filter\([\s\S]*?workspace: state\.transferWorkspace,[\s\S]*?attempts: state\.attempts,[\s\S]*?submissionLog: state\.submissionLog,[\s\S]*?reviews: state\.solutionReviews,[\s\S]*?now: new Date\(now\)\.toISOString\(\),[\s\S]*?\}\)/,
  );
  assert.match(
    transferBranch,
    /<TransferEvidenceRecords[\s\S]*?model=\{model\}[\s\S]*?selectedVariantId=\{transferRecordVariantId\}[\s\S]*?selectedAttemptId=\{transferRecordAttemptId\}/,
  );
  assert.match(component, /model: TransferRecordsResult/);
  assert.match(component, /device-local practice evidence/i);
  assert.match(component, /timeline/);
  assert.match(component, /evidenceClass/);
  assert.match(component, /aria-live="polite"|role="status"/);
});

test("transfer record selection is exact, record-scoped, and invalid-safe", async () => {
  const component = await read(
    "../app/components/TransferEvidenceRecords.tsx",
  );

  assert.match(
    component,
    /\.find\(\s*\(record\) =>\s*record\.variantId === selectedVariantId\s*\)/,
  );
  assert.match(
    component,
    /selectedRecord[\s\S]*?timeline\.find\([\s\S]*?event\.kind === "attempt"[\s\S]*?event\.attemptId === selectedAttemptId/,
  );
  assert.match(component, /role="status"/);
  assert.doesNotMatch(component, /\?\?\s*records\[0\]/);
  assert.doesNotMatch(component, /find\([\s\S]{0,180}(completedAt|sourceSnapshot)/);
});

test("records keep variant identity sealed until post-attempt debrief is ready", async () => {
  const component = await read(
    "../app/components/TransferEvidenceRecords.tsx",
  );

  const identityGuard = section(component, "function identityIsSealed(", "function titleFor(");
  const titleGuard = section(component, "function titleFor(", "function patternFor(");
  const patternGuard = section(component, "function patternFor(", "function evidenceClassFor(");
  assert.match(identityGuard, /record\.status === "unseen"/);
  assert.match(identityGuard, /record\.progress\.exposureUnknown/);
  assert.match(identityGuard, /!variant\?\.revealed/);
  assert.match(titleGuard, /identityIsSealed\(record, variant\)/);
  assert.match(titleGuard, /Hidden until first open/);
  assert.match(titleGuard, /Hidden until an attempt is recorded/);
  assert.match(titleGuard, /:\s*variant!\.revealed!\.title/);
  assert.match(patternGuard, /identityIsSealed\(record, variant\)/);
  assert.match(patternGuard, /Pattern and family remain sealed/);
  assert.match(patternGuard, /:\s*variant!\.revealed!\.pattern/);
  assert.match(
    component,
    /const safeSearchText = identityIsSealed\(record, variant\)[\s\S]*?\? `\$\{variant\?\.displayLabel \?\? record\.variantId\} \$\{record\.difficulty\}`[\s\S]*?: `\$\{variant\?\.displayLabel \?\? record\.variantId\} \$\{record\.title\} \$\{record\.pattern\} \$\{record\.family\}/,
  );
  assert.doesNotMatch(component, /title\s*=\s*\{(?:record|selectedRecord)\.title\}/);
});

test("canonical transfer routes connect Records, Transfer Lab, and exact results", async () => {
  const [app, routes, transferLab] = await Promise.all([
    read("../app/components/SwiftGhostApp.tsx"),
    read("../app/lib/routes.mjs"),
    read("../app/components/TransferLab.tsx"),
  ]);

  assert.match(routes, /recordsSection === "transfer"[\s\S]*?params\.get\("variant"\)/);
  assert.match(
    routes,
    /recordsSection === "transfer" && transferVariantId[\s\S]*?params\.get\("attempt"\)/,
  );
  assert.match(
    routes,
    /recordsSection === "transfer"[\s\S]*?set\("section", "transfer"\)[\s\S]*?set\("variant", transferVariantId\)[\s\S]*?set\("attempt", transferAttemptId\)/,
  );

  const openRecords = section(
    app,
    "function openTransferRecords(",
    "function timedSolutionReviewAttemptIds(",
  );
  assert.match(openRecords, /recordsSection: "transfer"/);
  assert.match(openRecords, /transferAttemptId: variantId \? attemptId : undefined/);
  assert.match(
    app,
    /onReview=\{\(variantId\) => openTransferRecords\(variantId\)\}/,
  );
  assert.match(
    app,
    /result\.item\.transfer[\s\S]*?openTransferRecords\(result\.itemId, result\.id\)/,
  );
  assert.match(transferLab, /onClick=\{\(\) => onReview\(variant\.id\)\}/);
  assert.match(app, /View transfer records/);
  assert.match(app, /Open Transfer Lab/);
});
