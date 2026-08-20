import assert from "node:assert/strict";
import test from "node:test";
import {
  SWIFT_PREFLIGHT_CHECKS,
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
