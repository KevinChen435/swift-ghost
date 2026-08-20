import assert from "node:assert/strict";
import test from "node:test";
import {
  SWIFT_PREFLIGHT_CHECKS,
  buildSwiftSubmissionDossier,
  formatSwiftEntrypoint,
  summarizeSwiftReadiness,
  swiftVerdictGuidance,
} from "../app/lib/swift-solve-preflight.mjs";

test("Swift preflight exposes the interview checklist in a stable order", () => {
  assert.deepEqual(
    SWIFT_PREFLIGHT_CHECKS.map((entry) => entry.id),
    ["signature", "samples", "boundaries", "complexity"],
  );
});

test("Swift entrypoint formatting preserves function contract details", () => {
  assert.equal(
    formatSwiftEntrypoint({
      kind: "function",
      name: "twoSum",
      parameters: [
        { name: "nums", type: "[Int]" },
        { name: "target", type: "Int" },
      ],
      returns: "[Int]",
    }),
    "func twoSum(_ nums: [Int], _ target: Int) -> [Int]",
  );
  assert.equal(formatSwiftEntrypoint(null), "func solve()");
});

test("Swift readiness blocks empty code and marks complete rehearsal", () => {
  assert.deepEqual(
    summarizeSwiftReadiness({
      completedChecks: 4,
      totalChecks: 4,
      tracedSamples: 2,
      totalSamples: 2,
      sourcePresent: false,
    }),
    {
      tone: "blocked",
      label: "Code needed",
      detail: "Type a Swift implementation before submitting to the judge.",
    },
  );
  assert.deepEqual(
    summarizeSwiftReadiness({
      completedChecks: 4,
      totalChecks: 4,
      tracedSamples: 2,
      totalSamples: 2,
      sourcePresent: true,
    }),
    {
      tone: "ready",
      label: "Ready to submit",
      detail: "Preflight is complete; sealed cases still decide the final verdict.",
    },
  );
});

test("Swift verdict guidance maps failed outcomes to useful next actions", () => {
  assert.match(swiftVerdictGuidance("compile-error").title, /contract/i);
  assert.match(swiftVerdictGuidance("wrong-answer").actions.join(" "), /invariant/i);
  assert.match(swiftVerdictGuidance("time-limit").actions.join(" "), /constraints/i);
  assert.match(swiftVerdictGuidance(null).title, /waiting/i);
});

test("Swift submission dossier names concrete pre-submit gaps", () => {
  const dossier = buildSwiftSubmissionDossier({
    completedChecks: 2,
    totalChecks: 4,
    tracedSamples: 1,
    totalSamples: 2,
    sourcePresent: true,
    notes: {
      approach: "Use a hash map to remember complements.",
      complexity: "",
      boundary: "Duplicate values can still be valid.",
    },
  });

  assert.equal(dossier.tone, "warm");
  assert.equal(dossier.label, "3/6 evidence locked");
  assert.equal(dossier.explanationReady, false);
  assert.match(dossier.nextAction, /rehearsal gaps/i);
  assert.deepEqual(
    dossier.rows.map((row) => [row.id, row.state]),
    [
      ["contract", "open"],
      ["samples", "open"],
      ["approach", "ready"],
      ["complexity", "open"],
      ["boundary", "ready"],
      ["verdict", "open"],
    ],
  );
  assert.ok(dossier.gaps.some((gap) => /complexity/i.test(gap)));
});

test("Swift submission dossier switches to verdict-driven action after judging", () => {
  const pending = buildSwiftSubmissionDossier({
    completedChecks: 4,
    totalChecks: 4,
    tracedSamples: 2,
    totalSamples: 2,
    sourcePresent: true,
    status: "pending",
    notes: {
      approach: "Use two pointers after sorting the values.",
      complexity: "Sorting costs O(n log n) time and O(n) output.",
      boundary: "All duplicates must collapse into one triplet.",
    },
  });
  assert.equal(pending.tone, "pending");
  assert.match(pending.nextAction, /Wait/i);
  assert.equal(pending.rows.at(-1).state, "pending");

  const accepted = buildSwiftSubmissionDossier({
    completedChecks: 4,
    totalChecks: 4,
    tracedSamples: 2,
    totalSamples: 2,
    sourcePresent: true,
    verdict: "accepted",
    status: "settled",
    notes: {
      approach: "Use a set to start only at sequence heads.",
      complexity: "Expected O(n) time and O(n) space.",
      boundary: "Duplicates should not extend the streak.",
    },
  });
  assert.equal(accepted.tone, "accepted");
  assert.equal(accepted.explanationReady, true);
  assert.match(accepted.nextAction, /teach-back/i);
  assert.deepEqual(accepted.gaps, []);

  const failed = buildSwiftSubmissionDossier({
    completedChecks: 4,
    totalChecks: 4,
    tracedSamples: 2,
    totalSamples: 2,
    sourcePresent: true,
    verdict: "wrong-answer",
    status: "settled",
  });
  assert.equal(failed.tone, "repair");
  assert.match(failed.nextAction, /Repair/i);
  assert.match(failed.rows.at(-1).detail, /Trace visible state/i);
});
