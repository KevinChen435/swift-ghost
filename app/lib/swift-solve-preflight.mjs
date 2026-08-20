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

function hasMeaningfulNote(value, minimum = 12) {
  return typeof value === "string" && value.trim().replace(/\s+/g, " ").length >= minimum;
}

function dossierRow(id, label, state, detail) {
  return { id, label, state, detail };
}

export function buildSwiftSubmissionDossier(input = {}) {
  const completedChecks = Math.max(0, Number(input.completedChecks) || 0);
  const totalChecks = Math.max(completedChecks, Number(input.totalChecks) || 0);
  const tracedSamples = Math.max(0, Number(input.tracedSamples) || 0);
  const totalSamples = Math.max(tracedSamples, Number(input.totalSamples) || 0);
  const sourcePresent = input.sourcePresent === true;
  const verdict = typeof input.verdict === "string" ? input.verdict : null;
  const status = typeof input.status === "string" ? input.status : null;
  const notes = input.notes && typeof input.notes === "object" ? input.notes : {};
  const approachReady = hasMeaningfulNote(notes.approach);
  const complexityReady = hasMeaningfulNote(notes.complexity);
  const boundaryReady = hasMeaningfulNote(notes.boundary);
  const explanationReady = approachReady && complexityReady && boundaryReady;
  const checklistReady = totalChecks > 0 && completedChecks >= totalChecks;
  const samplesReady = totalSamples === 0 || tracedSamples >= totalSamples;
  const gaps = [
    !sourcePresent ? "Type a Swift implementation." : null,
    !checklistReady ? "Finish the contract, sample, boundary, and complexity checklist." : null,
    !samplesReady ? "Mark every visible sample trace as matched or find the mismatch first." : null,
    !approachReady ? "Write the approach in your own words." : null,
    !complexityReady ? "Commit the time and space costs before submitting." : null,
    !boundaryReady ? "Name the boundary case you expect sealed tests to probe." : null,
  ].filter(Boolean);

  const evidenceLocked =
    Number(sourcePresent) +
    Number(checklistReady) +
    Number(samplesReady) +
    Number(approachReady) +
    Number(complexityReady) +
    Number(boundaryReady);
  const evidenceTotal = 6;

  let tone = "warm";
  let nextAction = "Close the open rehearsal gaps before using another sealed submission.";
  if (status === "pending") {
    tone = "pending";
    nextAction = "Wait for the isolated judge result before editing the source.";
  } else if (verdict === "accepted") {
    tone = "accepted";
    nextAction = "Move to teach-back: explain the invariant, costs, and one variant without reading the code.";
  } else if (verdict) {
    tone = "repair";
    nextAction = "Repair from the verdict, then submit a smaller current-revision change.";
  } else if (!sourcePresent) {
    tone = "blocked";
    nextAction = "Type an implementation first.";
  } else if (!gaps.length) {
    tone = "ready";
    nextAction = "Submit once, then keep the receipt as the evidence anchor.";
  }

  return {
    tone,
    label: `${evidenceLocked}/${evidenceTotal} evidence locked`,
    nextAction,
    gaps,
    rows: [
      dossierRow(
        "contract",
        "Contract",
        checklistReady ? "ready" : "open",
        `${completedChecks}/${totalChecks} checklist items complete`,
      ),
      dossierRow(
        "samples",
        "Visible samples",
        samplesReady ? "ready" : "open",
        `${tracedSamples}/${totalSamples} public traces matched`,
      ),
      dossierRow(
        "approach",
        "Approach",
        approachReady ? "ready" : "open",
        approachReady ? "Reasoning note is written" : "Missing own-words plan",
      ),
      dossierRow(
        "complexity",
        "Complexity",
        complexityReady ? "ready" : "open",
        complexityReady ? "Cost explanation is committed" : "Missing time/space statement",
      ),
      dossierRow(
        "boundary",
        "Boundary",
        boundaryReady ? "ready" : "open",
        boundaryReady ? "Sealed-test risk is named" : "Missing edge-case forecast",
      ),
      dossierRow(
        "verdict",
        "Verdict",
        status === "pending"
          ? "pending"
          : verdict === "accepted"
            ? "ready"
            : verdict
              ? "open"
              : "open",
        status === "pending"
          ? "Judge run is queued"
          : verdict
            ? swiftVerdictGuidance(verdict).title
            : "No sealed submission yet",
      ),
    ],
    explanationReady,
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
