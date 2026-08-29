"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CloudTrustedAssignment,
  CloudTrustedCustomCaseInput,
  CloudTrustedCustomRun,
  CloudTrustedExampleRun,
  CloudTrustedSubmission,
} from "../lib/cloud.mjs";
import type { PracticeItem } from "../lib/items";
import {
  SWIFT_PREFLIGHT_CHECKS,
  buildSwiftSubmissionDossier,
  formatSwiftEntrypoint,
  summarizeSwiftReadiness,
  swiftVerdictGuidance,
} from "../lib/swift-solve-preflight.mjs";

type SwiftSolveConsoleProps = {
  item: PracticeItem;
  assignment: CloudTrustedAssignment | null;
  submission: CloudTrustedSubmission | null;
  exampleRun: CloudTrustedExampleRun | null;
  customRun: CloudTrustedCustomRun | null;
  loadState: "idle" | "loading" | "ready" | "error";
  action: "idle" | "loading" | "submitting";
  exampleAction: "idle" | "running";
  customAction: "idle" | "running";
  message: string;
  available: boolean;
  authenticated: boolean;
  sourcePresent: boolean;
  retryAvailable: boolean;
  onRequestAssignment: () => void;
  onRunExamples: () => void;
  onRunCustom: (input: { cases: CloudTrustedCustomCaseInput[] }) => void;
  onSubmit: () => void;
};

type SampleTraceState = "untried" | "matched" | "mismatch";
type SwiftPreflightNotes = {
  approach: string;
  complexity: string;
  boundary: string;
};

const SAMPLE_TRACE_OPTIONS: ReadonlyArray<{
  id: SampleTraceState;
  label: string;
}> = [
  { id: "untried", label: "Untried" },
  { id: "matched", label: "Trace matches" },
  { id: "mismatch", label: "Mismatch" },
];

const EMPTY_NOTES = Object.freeze({
  approach: "",
  complexity: "",
  boundary: "",
} satisfies SwiftPreflightNotes);

type SwiftCustomInputMode = "structured" | "raw";
type SwiftCustomDraft = {
  mode: SwiftCustomInputMode;
  name: string;
  fields: string[];
  raw: string;
};

type SwiftCustomCaseDraft = SwiftCustomDraft & {
  id: string;
};

type SwiftCustomHistoryEntry = {
  id: string;
  settledAt: string;
  verdict: CloudTrustedCustomRun["verdict"];
  passed: number;
  total: number;
  caseNames: string[];
  contentRevision: number;
  judgeRevision: number;
};

type SwiftCustomWorkspace = {
  cases: SwiftCustomCaseDraft[];
  selectedId: string;
  history: SwiftCustomHistoryEntry[];
};

const SWIFT_CUSTOM_CASE_STORAGE_PREFIX = "swift-ghost:swift-custom-case:v1:";
const MAX_CUSTOM_DRAFT_CHARACTERS = 24_000;
const MAX_CUSTOM_CASES = 6;
const MAX_CUSTOM_HISTORY = 5;

const CUSTOM_HISTORY_VERDICTS = new Set<NonNullable<SwiftCustomHistoryEntry["verdict"]>>([
  "accepted",
  "wrong-answer",
  "compile-error",
  "runtime-error",
  "time-limit",
  "judge-error",
]);

function swiftTypeLabel(type: string) {
  return type || "JSON value";
}

function defaultSwiftValue(type: string, sampleValue?: unknown) {
  if (sampleValue !== undefined) return valueLabel(sampleValue);
  if (type.endsWith("?")) return "null";
  switch (type) {
    case "Int":
      return "0";
    case "Bool":
      return "false";
    case "String":
      return '""';
    case "[Int]":
    case "[String]":
    case "[[Int]]":
      return "[]";
    default:
      return "null";
  }
}

function swiftValueMatches(value: unknown, type: string): boolean {
  if (type.endsWith("?")) return value === null || swiftValueMatches(value, type.slice(0, -1));
  if (type === "Int") return typeof value === "number" && Number.isSafeInteger(value);
  if (type === "Bool") return typeof value === "boolean";
  if (type === "String") return typeof value === "string";
  if (type === "[Int]") return Array.isArray(value) && value.every((entry) => swiftValueMatches(entry, "Int"));
  if (type === "[String]") return Array.isArray(value) && value.every((entry) => swiftValueMatches(entry, "String"));
  if (type === "[[Int]]") return Array.isArray(value) && value.every((entry) => swiftValueMatches(entry, "[Int]"));
  return false;
}

function parseSwiftCustomArgs(raw: string, parameters: Array<{ name: string; type: string }>) {
  if (raw.length > MAX_CUSTOM_DRAFT_CHARACTERS)
    throw new Error("Custom input is too large. Keep it under 24,000 characters.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Use valid JSON for each Swift argument.");
  }
  const args = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "args" in parsed
      ? (parsed as { args?: unknown }).args
      : undefined;
  if (!Array.isArray(args) || args.length !== parameters.length)
    throw new Error(`This function expects ${parameters.length} argument${parameters.length === 1 ? "" : "s"}.`);
  args.forEach((value, index) => {
    if (!swiftValueMatches(value, parameters[index].type))
      throw new Error(`${parameters[index].name} must be a ${swiftTypeLabel(parameters[index].type)} value.`);
  });
  return args;
}

function draftArgs(
  draft: SwiftCustomDraft,
  parameters: Array<{ name: string; type: string }>,
) {
  if (draft.mode === "raw") return parseSwiftCustomArgs(draft.raw, parameters);
  if (draft.fields.length !== parameters.length)
    throw new Error("Add one JSON value for every function parameter.");
  return parseSwiftCustomArgs(
    JSON.stringify({
      args: draft.fields.map((field, index) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(field);
        } catch {
          throw new Error(`${parameters[index].name} must be valid JSON.`);
        }
        return parsed;
      }),
    }),
    parameters,
  );
}

function initialSwiftCustomDraft(
  challenge: NonNullable<CloudTrustedAssignment["challenge"]>,
) {
  const parameters = challenge.entrypoint.parameters ?? [];
  const sampleArgs = challenge.samples[0]?.args ?? [];
  const fields = parameters.map((parameter, index) =>
    defaultSwiftValue(parameter.type, sampleArgs[index]),
  );
  return {
    mode: "structured" as const,
    name: "My case",
    fields,
    raw: JSON.stringify({ args: sampleArgs }, null, 2),
  } satisfies SwiftCustomDraft;
}

function initialSwiftCustomWorkspace(
  challenge: NonNullable<CloudTrustedAssignment["challenge"]>,
): SwiftCustomWorkspace {
  return {
    cases: [{ id: "case-1", ...initialSwiftCustomDraft(challenge) }],
    selectedId: "case-1",
    history: [],
  };
}

function normalizedCustomCase(
  candidate: Partial<SwiftCustomCaseDraft> | undefined,
  fallback: SwiftCustomCaseDraft,
  id: string,
  parameterCount: number,
): SwiftCustomCaseDraft {
  const fields = Array.isArray(candidate?.fields)
    ? candidate.fields
        .filter((field): field is string => typeof field === "string")
        .slice(0, parameterCount)
    : fallback.fields;
  return {
    id,
    mode: candidate?.mode === "raw" ? "raw" : "structured",
    name: typeof candidate?.name === "string" && candidate.name.trim()
      ? candidate.name.slice(0, 120)
      : fallback.name,
    fields: fields.length === parameterCount ? fields : fallback.fields,
    raw: typeof candidate?.raw === "string"
      ? candidate.raw.slice(0, MAX_CUSTOM_DRAFT_CHARACTERS)
      : fallback.raw,
  };
}

function normalizeCustomWorkspace(
  value: unknown,
  challenge: NonNullable<CloudTrustedAssignment["challenge"]>,
): SwiftCustomWorkspace {
  const fallback = initialSwiftCustomWorkspace(challenge);
  const parameterCount = challenge.entrypoint.parameters?.length ?? 0;
  if (!value || typeof value !== "object") return fallback;
  const parsed = value as Partial<SwiftCustomWorkspace> & Partial<SwiftCustomDraft>;
  if (!Array.isArray(parsed.cases)) {
    // Migrate the original one-case local draft without discarding it.
    return {
      ...fallback,
      cases: [{
        ...normalizedCustomCase(parsed, fallback.cases[0], "case-1", parameterCount),
      }],
    };
  }
  const cases: SwiftCustomCaseDraft[] = [];
  const used = new Set<string>();
  parsed.cases.slice(0, MAX_CUSTOM_CASES).forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return;
    const requestedId = typeof candidate.id === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,40}$/.test(candidate.id)
      ? candidate.id
      : `case-${index + 1}`;
    let id = requestedId;
    let suffix = 2;
    while (used.has(id)) id = `${requestedId}-${suffix++}`;
    used.add(id);
    const defaultCase = fallback.cases[0];
    cases.push(normalizedCustomCase(candidate, defaultCase, id, parameterCount));
  });
  if (!cases.length) return fallback;
  const selectedId = typeof parsed.selectedId === "string" && cases.some((item) => item.id === parsed.selectedId)
    ? parsed.selectedId
    : cases[0].id;
  const history = Array.isArray(parsed.history)
    ? parsed.history
        .filter((entry): entry is SwiftCustomHistoryEntry => Boolean(
          entry && typeof entry === "object" &&
          typeof entry.id === "string" &&
          typeof entry.settledAt === "string" &&
          Array.isArray(entry.caseNames) &&
          typeof entry.passed === "number" &&
          typeof entry.total === "number" &&
          CUSTOM_HISTORY_VERDICTS.has(entry.verdict as NonNullable<SwiftCustomHistoryEntry["verdict"]>) &&
          entry.contentRevision === challenge.contentRevision &&
          entry.judgeRevision === challenge.judgeRevision,
        ))
        .slice(0, MAX_CUSTOM_HISTORY)
        .map((entry) => ({
          id: entry.id.slice(0, 160),
          settledAt: entry.settledAt.slice(0, 64),
          verdict: entry.verdict ?? null,
          passed: Math.max(0, Math.floor(entry.passed)),
          total: Math.max(0, Math.floor(entry.total)),
          contentRevision: challenge.contentRevision,
          judgeRevision: challenge.judgeRevision,
          caseNames: entry.caseNames
            .filter((name): name is string => typeof name === "string")
            .slice(0, MAX_CUSTOM_CASES)
            .map((name) => name.slice(0, 120)),
        }))
    : [];
  return { cases, selectedId, history };
}

function valueLabel(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unavailable]";
  }
}

function verdictLabel(verdict: CloudTrustedSubmission["verdict"]) {
  return verdict
    ? verdict
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Pending";
}

function exampleStatusFor(
  exampleRun: CloudTrustedExampleRun | null,
  sampleId: string,
  index: number,
) {
  if (!exampleRun) return { label: "Not run", className: "idle" };
  if (exampleRun.status === "pending")
    return { label: "Running", className: "pending" };
  const publicCaseResult = exampleRun.result?.publicCaseResults?.find(
    (result) => result.id === sampleId,
  );
  if (publicCaseResult) {
    if (publicCaseResult.status === "passed")
      return { label: "Passed", className: "passed" };
    if (publicCaseResult.status === "compile-error")
      return { label: "Compile blocked", className: "failed" };
    if (publicCaseResult.status === "runtime-error")
      return { label: "Runtime blocked", className: "failed" };
    if (publicCaseResult.status === "time-limit")
      return { label: "Timed out", className: "failed" };
    if (publicCaseResult.status === "judge-error")
      return { label: "Judge unavailable", className: "failed" };
    if (publicCaseResult.status === "not-run")
      return { label: "Not reached", className: "idle" };
    if (publicCaseResult.status === "wrong-answer")
      return { label: "Failed", className: "failed" };
    return { label: "Failed", className: "failed" };
  }
  if (!exampleRun.result || !exampleRun.verdict)
    return { label: "Unavailable", className: "failed" };
  if (exampleRun.verdict === "accepted")
    return { label: "Passed", className: "passed" };
  if (
    exampleRun.result.failedCaseId === sampleId ||
    exampleRun.result.failedCaseIndex === index
  )
    return { label: verdictLabel(exampleRun.verdict), className: "failed" };
  if (
    typeof exampleRun.result.failedCaseIndex === "number" &&
    index < exampleRun.result.failedCaseIndex
  )
    return { label: "Passed", className: "passed" };
  if (exampleRun.verdict === "compile-error")
    return { label: "Compile blocked", className: "failed" };
  if (exampleRun.verdict === "runtime-error")
    return { label: "Runtime blocked", className: "failed" };
  if (exampleRun.verdict === "time-limit")
    return { label: "Timed out", className: "failed" };
  return { label: "Not reached", className: "idle" };
}

export function SwiftSolveConsole({
  item,
  assignment,
  submission,
  exampleRun,
  customRun,
  loadState,
  action,
  exampleAction,
  customAction,
  message,
  available,
  authenticated,
  sourcePresent,
  retryAvailable,
  onRequestAssignment,
  onRunExamples,
  onRunCustom,
  onSubmit,
}: SwiftSolveConsoleProps) {
  const challenge = assignment?.challenge;
  const challengeKey = challenge?.key ?? "none";
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sampleTrace, setSampleTrace] = useState<Record<string, SampleTraceState>>({});
  const [notesByChallenge, setNotesByChallenge] = useState<Record<string, SwiftPreflightNotes>>({});
  const [customWorkspace, setCustomWorkspace] = useState<SwiftCustomWorkspace | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customRunVisible, setCustomRunVisible] = useState(false);
  const recordedCustomRunIds = useRef(new Set<string>());
  const hydratedCustomChallengeKey = useRef<string | null>(null);
  const customCases = customWorkspace?.cases ?? [];
  const customDraft = customWorkspace?.cases.find(
    (customCase) => customCase.id === customWorkspace.selectedId,
  ) ?? customCases[0] ?? null;
  const notes = notesByChallenge[challengeKey] ?? EMPTY_NOTES;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!challenge) {
        hydratedCustomChallengeKey.current = null;
        setCustomWorkspace(null);
        setCustomRunVisible(false);
        return;
      }
      try {
        const stored = window.localStorage.getItem(
          `${SWIFT_CUSTOM_CASE_STORAGE_PREFIX}${challenge.key}`,
        );
        setCustomWorkspace(
          normalizeCustomWorkspace(stored ? JSON.parse(stored) : null, challenge),
        );
      } catch {
        setCustomWorkspace(initialSwiftCustomWorkspace(challenge));
      }
      hydratedCustomChallengeKey.current = challenge.key;
      setCustomError(null);
      setCustomRunVisible(false);
      recordedCustomRunIds.current.clear();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [challenge, challengeKey]);

  useEffect(() => {
    if (
      !challenge ||
      !customWorkspace ||
      hydratedCustomChallengeKey.current !== challenge.key
    ) return;
    try {
      window.localStorage.setItem(
        `${SWIFT_CUSTOM_CASE_STORAGE_PREFIX}${challenge.key}`,
        JSON.stringify(customWorkspace),
      );
    } catch {
      // Local persistence is best-effort; the editor remains usable if storage is blocked.
    }
  }, [challenge, customWorkspace]);

  useEffect(() => {
    if (
      !challenge ||
      !assignment ||
      !customWorkspace ||
      !customRunVisible ||
      customRun?.status !== "settled" ||
      !customRun.result ||
      customRun.assignmentId !== assignment.id ||
      recordedCustomRunIds.current.has(customRun.clientRunId)
    ) return;
    recordedCustomRunIds.current.add(customRun.clientRunId);
    const historyEntry: SwiftCustomHistoryEntry = {
      id: customRun.clientRunId,
      settledAt: customRun.settledAt ?? new Date().toISOString(),
      verdict: customRun.verdict,
      passed: customRun.result.passed,
      total: customRun.result.total,
      contentRevision: customRun.result.contentRevision,
      judgeRevision: customRun.result.judgeRevision,
      caseNames: customRun.result.cases.map((result) => result.name),
    };
    setCustomWorkspace((current) => current ? {
      ...current,
      history: [
        historyEntry,
        ...current.history.filter((entry) => entry.id !== historyEntry.id),
      ].slice(0, MAX_CUSTOM_HISTORY),
    } : current);
  }, [assignment, challenge, customRun, customRunVisible, customWorkspace]);

  const entrypointSignature = useMemo(
    () => formatSwiftEntrypoint(challenge?.entrypoint),
    [challenge?.entrypoint],
  );
  const completedChecks = SWIFT_PREFLIGHT_CHECKS.filter((check) => checked[`${challengeKey}:${check.id}`]).length;
  const tracedSamples = challenge?.samples.filter((sample) => sampleTrace[`${challengeKey}:${sample.id}`] === "matched").length ?? 0;
  const readiness = summarizeSwiftReadiness({
    completedChecks,
    totalChecks: SWIFT_PREFLIGHT_CHECKS.length,
    tracedSamples,
    totalSamples: challenge?.samples.length ?? 0,
    sourcePresent,
  });
  const dossier = buildSwiftSubmissionDossier({
    completedChecks,
    totalChecks: SWIFT_PREFLIGHT_CHECKS.length,
    tracedSamples,
    totalSamples: challenge?.samples.length ?? 0,
    sourcePresent,
    verdict: submission?.verdict,
    status: submission?.status,
    notes,
  });
  const verdictGuidance = swiftVerdictGuidance(submission?.verdict);
  const canSubmit = Boolean(
    assignment?.status === "active" &&
      (submission?.status !== "pending" || retryAvailable) &&
      action === "idle" &&
      available &&
      authenticated &&
      sourcePresent,
  );
  const canRunExamples = Boolean(
    assignment?.status === "active" &&
      action === "idle" &&
      exampleAction === "idle" &&
      exampleRun?.status !== "pending" &&
      available &&
      authenticated &&
      sourcePresent,
  );
  const canRunCustom = Boolean(
    assignment?.status === "active" &&
      customDraft &&
      action === "idle" &&
      customAction === "idle" &&
      customRun?.status !== "pending" &&
      available &&
      authenticated &&
      sourcePresent,
  );
  const statusLabel = submission?.status === "pending"
    ? "Queued in isolated Swift judge"
    : submission?.verdict
      ? verdictLabel(submission.verdict)
      : assignment
        ? "Assignment ready"
        : "No assignment loaded";

  function updateCustomDraft(patch: Partial<SwiftCustomDraft>) {
    setCustomRunVisible(false);
    setCustomError(null);
    setCustomWorkspace((current) => {
      if (!current) return current;
      return {
        ...current,
        cases: current.cases.map((customCase) =>
          customCase.id === current.selectedId
            ? { ...customCase, ...patch }
            : customCase,
        ),
      };
    });
  }

  function selectCustomCase(id: string) {
    setCustomWorkspace((current) => current && current.cases.some((customCase) => customCase.id === id)
      ? { ...current, selectedId: id }
      : current);
    setCustomError(null);
  }

  function addCustomCase() {
    if (!challenge || !customWorkspace || customWorkspace.cases.length >= MAX_CUSTOM_CASES) return;
    const used = new Set(customWorkspace.cases.map((customCase) => customCase.id));
    let index = customWorkspace.cases.length + 1;
    let id = `case-${index}`;
    while (used.has(id)) id = `case-${++index}`;
    const nextCase: SwiftCustomCaseDraft = {
      id,
      ...initialSwiftCustomDraft(challenge),
      name: `Case ${customWorkspace.cases.length + 1}`,
    };
    setCustomWorkspace({
      ...customWorkspace,
      cases: [...customWorkspace.cases, nextCase],
      selectedId: id,
    });
    setCustomRunVisible(false);
    setCustomError(null);
  }

  function duplicateCustomCase() {
    if (!customWorkspace || !customDraft || customWorkspace.cases.length >= MAX_CUSTOM_CASES) return;
    const used = new Set(customWorkspace.cases.map((customCase) => customCase.id));
    let index = customWorkspace.cases.length + 1;
    let id = `case-${index}`;
    while (used.has(id)) id = `case-${++index}`;
    const nextCase: SwiftCustomCaseDraft = {
      ...customDraft,
      id,
      name: `${customDraft.name.trim() || "Case"} copy`.slice(0, 120),
      fields: [...customDraft.fields],
    };
    setCustomWorkspace({
      ...customWorkspace,
      cases: [...customWorkspace.cases, nextCase],
      selectedId: id,
    });
    setCustomRunVisible(false);
    setCustomError(null);
  }

  function deleteCustomCase() {
    if (!customWorkspace || !customDraft || customWorkspace.cases.length <= 1) return;
    const nextCases = customWorkspace.cases.filter((customCase) => customCase.id !== customDraft.id);
    const nextSelected = nextCases[Math.max(0, customWorkspace.cases.findIndex((customCase) => customCase.id === customDraft.id) - 1)] ?? nextCases[0];
    setCustomWorkspace({
      ...customWorkspace,
      cases: nextCases,
      selectedId: nextSelected.id,
    });
    setCustomRunVisible(false);
    setCustomError(null);
  }

  function runCustomCases() {
    if (!customWorkspace || !customCases.length || !challenge?.entrypoint.parameters) return;
    try {
      const cases = customCases.map((customCase, index) => ({
        id: customCase.id,
        name: customCase.name.trim().slice(0, 120) || `Custom case ${index + 1}`,
        args: draftArgs(customCase, challenge.entrypoint.parameters!),
      }));
      onRunCustom({
        cases,
      });
      setCustomError(null);
      setCustomRunVisible(true);
    } catch (error) {
      setCustomRunVisible(false);
      setCustomError(error instanceof Error ? error.message : "Enter valid Swift inputs.");
    }
  }

  return (
    <section className="swift-solve-console" aria-labelledby="swift-solve-console-title">
      <div className="swift-solve-console-header">
        <div>
          <span className="eyebrow">Server-judged Swift</span>
          <h3 id="swift-solve-console-title">Compile, run, and submit without exposing sealed tests.</h3>
          <p>
            Samples stay visible here. Your source is compiled in the pinned Swift
            Linux runtime; only an aggregate receipt returns to this browser.
          </p>
        </div>
        <span className={available && authenticated ? "swift-judge-status online" : "swift-judge-status offline"}>
          {available && authenticated ? "Judge connected" : authenticated ? "Judge unavailable" : "Sign in required"}
        </span>
      </div>

      {!available || !authenticated ? (
        <div className="swift-solve-console-empty" role="status">
          <strong>{authenticated ? "The isolated judge is not connected." : "Sign in to run Swift submissions."}</strong>
          <p>
            This lane is fail-closed: local text remains editable, but no browser result
            is promoted to verified evidence.
          </p>
        </div>
      ) : loadState === "loading" ? (
        <p className="swift-solve-console-status" role="status">Loading the sealed assignment…</p>
      ) : loadState === "error" ? (
        <div className="swift-solve-console-empty" role="alert">
          <strong>Assignment history is unavailable.</strong>
          <button className="outline-button" type="button" onClick={onRequestAssignment}>Retry assignment</button>
        </div>
      ) : assignment && challenge ? (
        <>
          <div className="swift-solve-console-meta">
            <span><small>Challenge</small><strong>{challenge.title}</strong></span>
            <span><small>Runtime</small><strong>{challenge.runtime}</strong></span>
            <span><small>Status</small><strong>{statusLabel}</strong></span>
          </div>
          <section className="swift-solve-preflight" aria-label="Swift pre-submit rehearsal">
            <header>
              <div>
                <span className="eyebrow">Pre-submit board</span>
                <strong>Trace the public contract before using the sealed judge.</strong>
              </div>
              <span className={`swift-readiness-pill ${readiness.tone}`}>
                {readiness.label}
              </span>
            </header>
            <div className="swift-contract-card">
              <small>Entrypoint contract</small>
              <code>{entrypointSignature}</code>
              <p>{readiness.detail}</p>
            </div>
            <div className="swift-preflight-grid">
              <fieldset className="swift-preflight-checklist">
                <legend>Checklist</legend>
                {SWIFT_PREFLIGHT_CHECKS.map((check) => (
                  <label key={check.id}>
                    <input
                      type="checkbox"
                      checked={Boolean(checked[`${challengeKey}:${check.id}`])}
                      onChange={(event) =>
                        setChecked((current) => ({
                          ...current,
                          [`${challengeKey}:${check.id}`]: event.target.checked,
                        }))
                      }
                    />
                    <span>
                      <strong>{check.label}</strong>
                      <small>{check.detail}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="swift-sample-trace-board">
                <div>
                  <small>Public trace state</small>
                  <strong>{tracedSamples}/{challenge.samples.length} examples matched</strong>
                </div>
                {challenge.samples.map((sample) => (
                  <article key={sample.id}>
                    <div>
                      <strong>{sample.name}</strong>
                      <small>Expected {valueLabel(sample.expected)}</small>
                    </div>
                    <div role="radiogroup" aria-label={`${sample.name} trace state`}>
                      {SAMPLE_TRACE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={(sampleTrace[`${challengeKey}:${sample.id}`] ?? "untried") === option.id}
                          className={(sampleTrace[`${challengeKey}:${sample.id}`] ?? "untried") === option.id ? "is-active" : undefined}
                          onClick={() =>
                            setSampleTrace((current) => ({
                              ...current,
                              [`${challengeKey}:${sample.id}`]: option.id,
                            }))
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="swift-explanation-notes">
              <label>
                Approach
                <textarea
                  rows={3}
                  value={notes.approach}
                  onChange={(event) =>
                    setNotesByChallenge((current) => ({
                      ...current,
                      [challengeKey]: {
                        ...(current[challengeKey] ?? EMPTY_NOTES),
                        approach: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label>
                Complexity
                <textarea
                  rows={3}
                  value={notes.complexity}
                  onChange={(event) =>
                    setNotesByChallenge((current) => ({
                      ...current,
                      [challengeKey]: {
                        ...(current[challengeKey] ?? EMPTY_NOTES),
                        complexity: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label>
                Boundary case
                <textarea
                  rows={3}
                  value={notes.boundary}
                  onChange={(event) =>
                    setNotesByChallenge((current) => ({
                      ...current,
                      [challengeKey]: {
                        ...(current[challengeKey] ?? EMPTY_NOTES),
                        boundary: event.target.value,
                      },
                    }))
                  }
                />
              </label>
            </div>
            <section className={`swift-submission-dossier ${dossier.tone}`} aria-label="Swift submission dossier">
              <header>
                <div>
                  <small>Submission dossier</small>
                  <strong>{dossier.label}</strong>
                </div>
                <span>{dossier.tone === "accepted" ? "Teach-back" : dossier.tone === "repair" ? "Repair" : dossier.tone === "ready" ? "Ready" : dossier.tone === "pending" ? "Queued" : "Prep"}</span>
              </header>
              <div className="swift-dossier-grid">
                {dossier.rows.map((row) => (
                  <article className={`is-${row.state}`} key={row.id}>
                    <small>{row.label}</small>
                    <strong>{row.state === "ready" ? "Ready" : row.state === "pending" ? "Pending" : "Open"}</strong>
                    <p>{row.detail}</p>
                  </article>
                ))}
              </div>
              <div className="swift-dossier-next">
                <strong>Next action</strong>
                <p>{dossier.nextAction}</p>
              </div>
              {dossier.gaps.length ? (
                <ul className="swift-dossier-gaps" aria-label="Open dossier gaps">
                  {dossier.gaps.slice(0, 3).map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          </section>
          {customDraft && challenge.entrypoint.parameters ? (
            <section className="swift-custom-rehearsal" aria-label="Swift custom testcase rehearsal">
              <header>
                <div>
                  <span className="eyebrow">Custom rehearsal</span>
                  <strong>Try an edge case before you submit.</strong>
                  <p>
                    Use structured fields or raw JSON. This run is execution-only:
                    it never changes progress, creates evidence, or reveals sealed cases.
                  </p>
                </div>
                <span className="swift-custom-practice-badge">Practice only</span>
              </header>
              <div className="swift-custom-case-tabs" aria-label="Custom Swift cases">
                <div className="swift-custom-case-tab-list" role="tablist" aria-label="Custom cases">
                  {customCases.map((customCase, index) => (
                    <button
                      key={customCase.id}
                      type="button"
                      role="tab"
                      aria-selected={customCase.id === customWorkspace?.selectedId}
                      className={customCase.id === customWorkspace?.selectedId ? "is-active" : undefined}
                      onClick={() => selectCustomCase(customCase.id)}
                    >
                      <span>{index + 1}</span>
                      {customCase.name.trim() || `Case ${index + 1}`}
                    </button>
                  ))}
                </div>
                <div className="swift-custom-case-controls">
                  <small>{customCases.length}/{MAX_CUSTOM_CASES} cases</small>
                  <button
                    type="button"
                    className="swift-custom-small-button"
                    disabled={customCases.length >= MAX_CUSTOM_CASES}
                    onClick={addCustomCase}
                  >
                    + Add case
                  </button>
                </div>
              </div>
              <div className="swift-custom-toolbar">
                <label>
                  Case name
                  <input
                    value={customDraft.name}
                    maxLength={120}
                    onChange={(event) => updateCustomDraft({ name: event.target.value.slice(0, 120) })}
                  />
                </label>
                <div className="swift-custom-mode" role="radiogroup" aria-label="Custom input mode">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={customDraft.mode === "structured"}
                    className={customDraft.mode === "structured" ? "is-active" : undefined}
                    onClick={() => updateCustomDraft({ mode: "structured" })}
                  >
                    Fields
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={customDraft.mode === "raw"}
                    className={customDraft.mode === "raw" ? "is-active" : undefined}
                    onClick={() => updateCustomDraft({ mode: "raw" })}
                  >
                    Raw JSON
                  </button>
                </div>
                <div className="swift-custom-case-actions" aria-label="Selected custom case actions">
                  <button
                    type="button"
                    className="swift-custom-small-button"
                    disabled={customCases.length >= MAX_CUSTOM_CASES}
                    onClick={duplicateCustomCase}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="swift-custom-small-button danger"
                    disabled={customCases.length <= 1}
                    onClick={deleteCustomCase}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {customDraft.mode === "structured" ? (
                <div className="swift-custom-fields">
                  {challenge.entrypoint.parameters.map((parameter, index) => (
                    <label key={parameter.name}>
                      <span>{parameter.name}<small>{parameter.type}</small></span>
                      <textarea
                        rows={2}
                        aria-label={`${parameter.name} JSON value`}
                        value={customDraft.fields[index] ?? "null"}
                        onChange={(event) => {
                          const fields = [...customDraft.fields];
                          fields[index] = event.target.value.slice(0, 12_000);
                          updateCustomDraft({ fields });
                        }}
                      />
                      <small>JSON value, bounded to the server’s Swift type allowlist.</small>
                    </label>
                  ))}
                </div>
              ) : (
                <label className="swift-custom-raw">
                  <span>Arguments JSON</span>
                  <textarea
                    rows={7}
                    aria-label="Custom arguments JSON"
                    value={customDraft.raw}
                    maxLength={MAX_CUSTOM_DRAFT_CHARACTERS}
                    onChange={(event) => updateCustomDraft({ raw: event.target.value.slice(0, MAX_CUSTOM_DRAFT_CHARACTERS) })}
                  />
                  <small>Use an array such as <code>[ [2, 7, 11, 15], 9 ]</code> or <code>{'{"args":[…]}'}</code>.</small>
                </label>
              )}
              <div className="swift-custom-actions">
                <button
                  className="outline-button"
                  type="button"
                  disabled={!canRunCustom}
                  onClick={runCustomCases}
                >
                  {customAction === "running" || customRun?.status === "pending"
                    ? `Running ${customCases.length} custom case${customCases.length === 1 ? "" : "s"}…`
                    : `Run ${customCases.length} custom case${customCases.length === 1 ? "" : "s"}`}
                </button>
                <small>{customCases.length} case{customCases.length === 1 ? "" : "s"} · Swift {challenge.runtime} · source leaves this tab only for the isolated run.</small>
              </div>
              {customError ? <p className="swift-custom-error" role="alert">{customError}</p> : null}
              {customRunVisible && customRun?.status === "pending" ? (
                <div className="swift-custom-result pending" role="status">
                  <strong>Custom case running</strong>
                  <span>The isolated Swift runtime is compiling your input.</span>
                </div>
              ) : customRunVisible && customRun?.status === "settled" && customRun.result ? (
                <div className="swift-custom-result" role="status" aria-live="polite">
                  <div className="swift-custom-result-head">
                    <strong>{customRun.verdict === "accepted" ? "Custom case finished" : verdictLabel(customRun.verdict)}</strong>
                    <span>{customRun.result.passed}/{customRun.result.total} case{customRun.result.total === 1 ? "" : "s"} produced output</span>
                  </div>
                  {customRun.result.cases.map((result) => (
                    <article className={result.passed ? "passed" : "failed"} key={result.id}>
                      <div><strong>{result.name}</strong><span>{result.passed ? "Executed" : result.status.replaceAll("-", " ")}</span></div>
                      {Object.hasOwn(result, "actual") ? <code>actual: {valueLabel(result.actual)}</code> : null}
                      {result.error ? <pre>{result.error}</pre> : null}
                      {result.diagnostic ? <small>{result.diagnostic}</small> : null}
                    </article>
                  ))}
                  {customRun.result.diagnostic ? <pre className="swift-custom-diagnostic">{customRun.result.diagnostic}</pre> : null}
                </div>
              ) : null}
              {customWorkspace?.history.length ? (
                <section className="swift-custom-history" aria-label="Recent custom rehearsals">
                  <header>
                    <div>
                      <small>Recent rehearsals</small>
                      <strong>Local run history</strong>
                    </div>
                    <span>Practice-only summaries</span>
                  </header>
                  <div className="swift-custom-history-list">
                    {customWorkspace.history.map((entry) => (
                      <article key={entry.id}>
                        <div>
                          <strong>{entry.verdict === "accepted" ? "Finished" : verdictLabel(entry.verdict)}</strong>
                          <span>{entry.passed}/{entry.total} case{entry.total === 1 ? "" : "s"} produced output</span>
                        </div>
                        <small>
                          {entry.caseNames.slice(0, 3).join(", ") || "Custom cases"}
                          {entry.caseNames.length > 3 ? ` +${entry.caseNames.length - 3}` : ""}
                          {" · "}
                          {new Date(entry.settledAt).toLocaleString()}
                        </small>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </section>
          ) : null}
          <div className="swift-solve-console-actions">
            <button
              className="outline-button"
              type="button"
              disabled={!canRunExamples}
              onClick={onRunExamples}
            >
              {exampleAction === "running" || exampleRun?.status === "pending"
                ? "Running examples…"
                : "Run examples"}
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              {action === "submitting"
                ? "Queueing…"
                : submission?.status === "pending"
                  ? retryAvailable
                    ? "Retry queue"
                    : "Judge running…"
                  : "Submit to Swift judge"}
            </button>
            <small>{item.title} · sealed cases stay server-side</small>
          </div>
          {exampleRun?.status === "settled" && exampleRun.result ? (
            <>
              <div className={`swift-example-verdict ${exampleRun.verdict === "accepted" ? "accepted" : "failed"}`} role="status">
                <strong>{exampleRun.verdict === "accepted" ? "Examples passed" : verdictLabel(exampleRun.verdict)}</strong>
                <span>{exampleRun.result.passed}/{exampleRun.result.total} public examples passed</span>
              </div>
              {exampleRun.result.diagnostic ? (
                <pre className="swift-example-diagnostic" aria-label="Swift example diagnostic">
                  {exampleRun.result.diagnostic}
                </pre>
              ) : null}
            </>
          ) : exampleRun?.status === "pending" ? (
            <div className="swift-example-verdict pending" role="status">
              <strong>Examples running</strong>
              <span>The isolated Swift runtime is compiling this source.</span>
            </div>
          ) : null}
          {submission?.status === "settled" && submission.result ? (
            <>
              <div className={`swift-solve-verdict ${submission.verdict === "accepted" ? "accepted" : "failed"}`} role="status">
                <strong>{verdictLabel(submission.verdict)}</strong>
                <span>{submission.result.passed}/{submission.result.total} public + sealed cases passed</span>
              </div>
              <section className="swift-verdict-guidance" aria-label="Verdict review">
                <strong>{verdictGuidance.title}</strong>
                <ol>
                  {verdictGuidance.actions.map((actionItem) => (
                    <li key={actionItem}>{actionItem}</li>
                  ))}
                </ol>
              </section>
            </>
          ) : null}
          <div className="swift-solve-samples">
            <div>
              <span className="eyebrow">Public examples</span>
              <p>
                Expected values are part of the visible contract. After a run,
                the observed output is shown for these public examples only;
                sealed cases never appear here.
              </p>
            </div>
            <div className="swift-solve-sample-grid">
              {challenge.samples.map((sample, index) => {
                const status = exampleStatusFor(exampleRun, sample.id, index);
                const publicCaseResult = exampleRun?.result?.publicCaseResults?.find(
                  (result) => result.id === sample.id,
                );
                return (
                <article key={sample.id}>
                  <div className="swift-sample-result-row">
                    <strong>{sample.name}</strong>
                    <span className={`swift-sample-result ${status.className}`}>{status.label}</span>
                  </div>
                  <code>args: {valueLabel(sample.args)}</code>
                  <code>expected: {valueLabel(sample.expected)}</code>
                  {publicCaseResult && Object.hasOwn(publicCaseResult, "actual") ? (
                    <code className="swift-sample-actual">
                      actual: {valueLabel(publicCaseResult.actual)}
                    </code>
                  ) : null}
                  {publicCaseResult?.diagnostic ? (
                    <small className="swift-sample-diagnostic">
                      {publicCaseResult.diagnostic}
                    </small>
                  ) : null}
                </article>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="swift-solve-console-empty" role="status">
          <strong>No assignment is ready yet.</strong>
          <button className="primary-button" type="button" disabled={action !== "idle"} onClick={onRequestAssignment}>
            {action === "loading" ? "Loading…" : "Load Swift challenge"}
          </button>
        </div>
      )}
      {message ? <p className="swift-solve-console-message" role="status">{message}</p> : null}
    </section>
  );
}
