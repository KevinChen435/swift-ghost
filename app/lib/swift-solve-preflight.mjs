export const SWIFT_PREFLIGHT_CHECKS = Object.freeze([
  {
    id: "signature",
    label: "Signature matches the contract",
    detail: "Name, parameter order, labels, and return type stay unchanged.",
  },
  {
    id: "samples",
    label: "Public examples traced",
    detail: "Each visible example has a manual expected-value trace.",
  },
  {
    id: "boundaries",
    label: "Boundary case named",
    detail: "Empty, singleton, duplicate, ordering, or overflow cases are considered.",
  },
  {
    id: "complexity",
    label: "Complexity answer ready",
    detail: "Time and space costs are explainable before submit.",
  },
]);

export function formatSwiftEntrypoint(entrypoint) {
  if (!entrypoint || entrypoint.kind !== "function" || !entrypoint.name) {
    return "func solve()";
  }
  const parameters = Array.isArray(entrypoint.parameters)
    ? entrypoint.parameters
        .filter((parameter) => parameter?.name && parameter?.type)
        .map((parameter) => `_ ${parameter.name}: ${parameter.type}`)
    : [];
  const returnType = entrypoint.returns ? ` -> ${entrypoint.returns}` : "";
  return `func ${entrypoint.name}(${parameters.join(", ")})${returnType}`;
}

export function summarizeSwiftReadiness(input = {}) {
  const completedChecks = Math.max(0, Number(input.completedChecks) || 0);
  const totalChecks = Math.max(completedChecks, Number(input.totalChecks) || 0);
  const tracedSamples = Math.max(0, Number(input.tracedSamples) || 0);
  const totalSamples = Math.max(tracedSamples, Number(input.totalSamples) || 0);
  const sourcePresent = input.sourcePresent === true;
  const checksReady = totalChecks > 0 && completedChecks >= totalChecks;
  const samplesReady = totalSamples === 0 || tracedSamples >= totalSamples;

  if (!sourcePresent) {
    return {
      tone: "blocked",
      label: "Code needed",
      detail: "Type a Swift implementation before submitting to the judge.",
    };
  }
  if (checksReady && samplesReady) {
    return {
      tone: "ready",
      label: "Ready to submit",
      detail: "Preflight is complete; sealed cases still decide the final verdict.",
    };
  }
  return {
    tone: "warm",
    label: `${completedChecks}/${totalChecks} checks · ${tracedSamples}/${totalSamples} samples`,
    detail: "You can submit now, but the board still has unfinished rehearsal evidence.",
  };
}

export function swiftVerdictGuidance(verdict) {
  switch (verdict) {
    case "accepted":
      return {
        title: "Seal the solve with a teach-back",
        actions: [
          "State the invariant without reading the code.",
          "Explain the chosen Swift data structures and their costs.",
          "Name one variant that would break a memorized solution.",
        ],
      };
    case "compile-error":
      return {
        title: "Fix the contract before reasoning deeper",
        actions: [
          "Compare your function signature with the entrypoint contract.",
          "Check optional unwrapping, mutation permissions, and return paths.",
          "Submit a smaller compiling revision before optimizing.",
        ],
      };
    case "wrong-answer":
      return {
        title: "Trace visible state, then infer the sealed miss",
        actions: [
          "Replay each public example through the exact variables in code.",
          "Add one boundary case that stresses duplicates or empty input.",
          "Re-state the invariant and find where the code violates it.",
        ],
      };
    case "runtime-error":
      return {
        title: "Remove unsafe assumptions",
        actions: [
          "Audit force unwraps, index math, and dictionary lookups.",
          "Trace the smallest input allowed by constraints.",
          "Prefer guarded exits over assuming a shape exists.",
        ],
      };
    case "time-limit":
      return {
        title: "Re-check the complexity target",
        actions: [
          "Find nested scans that can become hashing, pointers, or monotonic state.",
          "State the intended asymptotic cost before editing.",
          "Use the constraints to reject brute force explicitly.",
        ],
      };
    case "judge-error":
      return {
        title: "Keep the attempt, retry later",
        actions: [
          "Do not treat this as a correctness signal.",
          "Save the current reasoning notes.",
          "Retry once the judge is reachable.",
        ],
      };
    default:
      return {
        title: "Waiting for judge feedback",
        actions: [
          "Keep the public traces visible while the run settles.",
          "Avoid editing until the queued verdict returns.",
        ],
      };
  }
}
