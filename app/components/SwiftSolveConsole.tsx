"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import {
  SWIFT_CASE_PACK_LIMITS,
  encodeSwiftCasePack,
  importSwiftCasePack,
  parseSwiftCasePackArgs,
} from "../lib/swift-case-packs.mjs";
import {
  normalizeSwiftExampleHistory,
  swiftExampleHistoryEntryFromRun,
  SWIFT_EXAMPLE_HISTORY_LIMITS,
} from "../lib/swift-example-history.mjs";
import type { SwiftExampleHistoryEntry } from "../lib/swift-example-history.mjs";
import {
  GUEST_PERSISTENCE_SCOPE,
  normalizePersistenceScope,
  scopedStateKey,
  type PersistenceScope,
} from "../lib/account-storage.mjs";

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
  historyScope?: PersistenceScope;
  sourcePresent: boolean;
  retryAvailable: boolean;
  onRequestAssignment: () => void;
  onRunExamples: () => void;
  onRunCustom: (input: { cases: CloudTrustedCustomCaseInput[] }) => void;
  onSubmit: () => void;
  onOpenAttemptClosure?: (submissionId: string) => void;
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
const SWIFT_EXAMPLE_HISTORY_STORAGE_KEY = "swift-example-history:v1:";
const SWIFT_EXAMPLE_HISTORY_EVENT = "swift-ghost:example-history-change";
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

const EMPTY_EXAMPLE_HISTORY: readonly SwiftExampleHistoryEntry[] = Object.freeze([]);
const exampleHistorySnapshotCache = new Map<string, SwiftExampleHistoryEntry[]>();

function exampleHistoryStorageKey(
  challengeKey: string | undefined,
  historyScope: PersistenceScope | undefined,
  authenticated: boolean,
) {
  if (!challengeKey) return null;
  const normalizedScope = normalizePersistenceScope(historyScope);
  // Do not expose a guest snapshot while an authenticated profile is still
  // resolving. Signed-out/direct use safely falls back to the guest profile.
  const scope = normalizedScope ?? (authenticated ? undefined : GUEST_PERSISTENCE_SCOPE);
  return scope
    ? scopedStateKey(`${SWIFT_EXAMPLE_HISTORY_STORAGE_KEY}${challengeKey}`, scope) ?? null
    : null;
}

function readExampleHistorySnapshot(
  storageKey: string | null,
  challenge: NonNullable<CloudTrustedAssignment["challenge"]> | undefined,
): SwiftExampleHistoryEntry[] | readonly SwiftExampleHistoryEntry[] {
  if (!storageKey || !challenge || typeof window === "undefined") return EMPTY_EXAMPLE_HISTORY;
  let raw = "";
  try {
    raw = window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return EMPTY_EXAMPLE_HISTORY;
  }
  const contractKey = [
    challenge.contentRevision,
    challenge.judgeRevision,
    challenge.samples.map((sample) => sample.id).join("\u0001"),
  ].join("\u0000");
  const cacheKey = `${storageKey}\u0000${contractKey}\u0000${raw}`;
  const cached = exampleHistorySnapshotCache.get(cacheKey);
  if (cached) return cached;
  let parsed: unknown = [];
  try {
    parsed = raw ? JSON.parse(raw) : [];
  } catch {
    parsed = [];
  }
  const normalized = normalizeSwiftExampleHistory(parsed, challenge);
  exampleHistorySnapshotCache.set(cacheKey, normalized);
  if (exampleHistorySnapshotCache.size > 24) {
    const oldest = exampleHistorySnapshotCache.keys().next().value;
    if (oldest) exampleHistorySnapshotCache.delete(oldest);
  }
  return normalized;
}

function notifyExampleHistoryChange(storageKey: string | null) {
  if (!storageKey || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SWIFT_EXAMPLE_HISTORY_EVENT, { detail: { storageKey } }),
  );
}

function subscribeExampleHistory(storageKey: string | null, onChange: () => void) {
  if (!storageKey || typeof window === "undefined") return () => {};
  const handleCustomChange = (event: Event) => {
    const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
    if (detail?.storageKey === storageKey) onChange();
  };
  const handleStorageChange = (event: StorageEvent) => {
    if (event.storageArea === window.localStorage && event.key === storageKey) onChange();
  };
  window.addEventListener(SWIFT_EXAMPLE_HISTORY_EVENT, handleCustomChange);
  window.addEventListener("storage", handleStorageChange);
  return () => {
    window.removeEventListener(SWIFT_EXAMPLE_HISTORY_EVENT, handleCustomChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function persistExampleHistory(
  storageKey: string | null,
  history: SwiftExampleHistoryEntry[],
) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    if (history.length) window.localStorage.setItem(storageKey, JSON.stringify(history));
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Device-local history is best-effort; the feedback board remains usable.
  }
  notifyExampleHistoryChange(storageKey);
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

function parseSwiftCustomArgs(raw: string, parameters: Array<{ name: string; type: string }>) {
  return parseSwiftCasePackArgs(raw, parameters);
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

function packCaseDraft(
  importedCase: { name: string; args: unknown[] },
  id: string,
): SwiftCustomCaseDraft {
  const fields = importedCase.args.map((argument) => valueLabel(argument));
  return {
    id,
    mode: "structured",
    name: importedCase.name.trim().slice(0, 120) || id.replace("-", " "),
    fields,
    raw: JSON.stringify({ args: importedCase.args }, null, 2),
  };
}

function verdictLabel(verdict: CloudTrustedSubmission["verdict"]) {
  return verdict
    ? verdict
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Pending";
}

function customExecutionLabel(verdict: CloudTrustedCustomRun["verdict"]) {
  return verdict === "accepted" ? "Execution complete" : verdictLabel(verdict);
}

function exampleHistoryLabel(verdict: CloudTrustedExampleRun["verdict"]) {
  return verdict === "accepted" ? "Examples passed" : verdictLabel(verdict);
}

function publicCaseStatusLabel(
  status: SwiftExampleHistoryEntry["publicCaseResults"][number]["status"],
  passed: boolean,
) {
  if (passed || status === "passed") return "Passed";
  if (status === "compile-error") return "Compile blocked";
  if (status === "runtime-error") return "Runtime blocked";
  if (status === "time-limit") return "Timed out";
  if (status === "judge-error") return "Judge unavailable";
  if (status === "not-run") return "Not reached";
  return "Failed";
}

function exampleHistoryDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved locally" : date.toLocaleString();
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
  historyScope,
  sourcePresent,
  retryAvailable,
  onRequestAssignment,
  onRunExamples,
  onRunCustom,
  onSubmit,
  onOpenAttemptClosure,
}: SwiftSolveConsoleProps) {
  const challenge = assignment?.challenge;
  const challengeKey = challenge?.key ?? "none";
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sampleTrace, setSampleTrace] = useState<Record<string, SampleTraceState>>({});
  const [notesByChallenge, setNotesByChallenge] = useState<Record<string, SwiftPreflightNotes>>({});
  const [sketchFocusByChallenge, setSketchFocusByChallenge] = useState<Record<string, boolean>>({});
  const [customWorkspace, setCustomWorkspace] = useState<SwiftCustomWorkspace | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [casePackDraft, setCasePackDraft] = useState("");
  const [casePackMessage, setCasePackMessage] = useState("");
  const [customRunVisible, setCustomRunVisible] = useState(false);
  const recordedCustomRunIds = useRef(new Set<string>());
  const recordedExampleRunIds = useRef(new Set<string>());
  const hydratedCustomChallengeKey = useRef<string | null>(null);
  const historyStorageKey = exampleHistoryStorageKey(challenge?.key, historyScope, authenticated);
  const historySnapshot = useCallback(
    () => readExampleHistorySnapshot(historyStorageKey, challenge),
    [challenge, historyStorageKey],
  );
  const historySubscribe = useCallback(
    (onChange: () => void) => subscribeExampleHistory(historyStorageKey, onChange),
    [historyStorageKey],
  );
  const exampleHistory = useSyncExternalStore(
    historySubscribe,
    historySnapshot,
    () => EMPTY_EXAMPLE_HISTORY,
  );
  const customCases = customWorkspace?.cases ?? [];
  const customDraft = customWorkspace?.cases.find(
    (customCase) => customCase.id === customWorkspace.selectedId,
  ) ?? customCases[0] ?? null;
  const notes = notesByChallenge[challengeKey] ?? EMPTY_NOTES;
  const sketchFocused = sketchFocusByChallenge[challengeKey] === true;

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
      setCasePackDraft("");
      setCasePackMessage("");
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

  useEffect(() => {
    recordedExampleRunIds.current.clear();
  }, [historyStorageKey]);

  useEffect(() => {
    if (
      !challenge ||
      !assignment ||
      !historyStorageKey ||
      !exampleRun ||
      exampleRun.status !== "settled" ||
      !exampleRun.result ||
      !exampleRun.verdict ||
      exampleRun.assignmentId !== assignment.id ||
      recordedExampleRunIds.current.has(exampleRun.clientRunId)
    ) return;
    const historyEntry = swiftExampleHistoryEntryFromRun(exampleRun, challenge);
    recordedExampleRunIds.current.add(exampleRun.clientRunId);
    if (!historyEntry) return;
    const currentHistory = readExampleHistorySnapshot(historyStorageKey, challenge);
    persistExampleHistory(historyStorageKey, [
      historyEntry,
      ...currentHistory.filter((entry) => entry.id !== historyEntry.id),
    ].slice(0, SWIFT_EXAMPLE_HISTORY_LIMITS.maxEntries));
  }, [assignment, challenge, exampleRun, historyStorageKey]);

  function clearExampleHistory() {
    if (!historyStorageKey) return;
    persistExampleHistory(historyStorageKey, []);
  }

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
  const fallbackSketchLines = [
    {
      id: "contract",
      label: "Contract",
      title: "Match the signature exactly",
      detail: `Keep ${item.title} anchored to the visible Swift entrypoint and do not change the argument or return shape.`,
    },
    {
      id: "trace",
      label: "Trace",
      title: "Replay the public examples",
      detail: "Walk the public cases first so the invariant is visible before you start typing.",
    },
    {
      id: "boundary",
      label: "Boundary",
      title: "Name the smallest break point",
      detail: "Check the empty, singleton, and off-by-one shape that would break a memorized answer.",
    },
  ] as const;
  const repairableSubmission = Boolean(
    submission?.status === "settled" &&
      submission.verdict &&
      submission.verdict !== "accepted" &&
      submission.verdict !== "judge-error" &&
      submission.clientSubmissionId &&
      onOpenAttemptClosure,
  );
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
    setCasePackMessage("");
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
    setCasePackMessage("");
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
    setCasePackMessage("");
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
    setCasePackMessage("");
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
    setCasePackMessage("");
  }

  function currentPackCases() {
    if (!challenge?.entrypoint.parameters)
      throw new Error("Load a Swift assignment before sharing cases.");
    return customCases.map((customCase, index) => ({
      name: customCase.name.trim().slice(0, 120) || `Custom case ${index + 1}`,
      args: draftArgs(customCase, challenge.entrypoint.parameters!),
    }));
  }

  async function exportCasePack() {
    if (!challenge || !customCases.length) return;
    try {
      const text = encodeSwiftCasePack({
        challenge,
        cases: currentPackCases(),
      });
      setCasePackDraft(text);
      setCustomError(null);
      try {
        await navigator.clipboard?.writeText(text);
        setCasePackMessage("Case pack copied.");
      } catch {
        setCasePackMessage("Case pack is ready to copy.");
      }
    } catch (error) {
      setCasePackMessage("");
      setCustomError(error instanceof Error ? error.message : "These cases cannot be exported.");
    }
  }

  function importCasePackDraft() {
    if (!challenge || !customWorkspace) return;
    try {
      const imported = importSwiftCasePack(casePackDraft, challenge);
      const cases = imported
        .slice(0, SWIFT_CASE_PACK_LIMITS.maxCases)
        .map((testCase, index) => packCaseDraft(testCase, `case-${index + 1}`));
      setCustomWorkspace({
        ...customWorkspace,
        cases,
        selectedId: cases[0].id,
      });
      setCustomRunVisible(false);
      setCustomError(null);
      setCasePackMessage(`Imported ${cases.length} case${cases.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setCasePackMessage("");
      setCustomError(error instanceof Error ? error.message : "Paste a valid Swift Ghost case pack.");
    }
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
          <section className="swift-answer-sketch swift-answer-sketch--fallback" aria-labelledby="swift-answer-sketch-fallback-title">
            <header>
              <div>
                <span className="eyebrow">Muted answer sketch</span>
                <strong id="swift-answer-sketch-fallback-title">Keep the outline visible while you rehearse the Swift pass.</strong>
                <p>
                  The judge is unavailable, but the scaffold still shows the
                  shape of a clean answer. Use it to type the first pass from
                  memory before you ask for a run.
                </p>
              </div>
            </header>
            <div className="swift-answer-sketch-grid is-muted">
              {fallbackSketchLines.map((line) => (
                <article key={line.id}>
                  <small>{line.label}</small>
                  <strong>{line.title}</strong>
                  <p>{line.detail}</p>
                </article>
              ))}
            </div>
          </section>
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
            <section className="swift-answer-sketch" aria-labelledby="swift-answer-sketch-title">
              <header>
                <div>
                  <span className="eyebrow">Muted answer sketch</span>
                  <strong id="swift-answer-sketch-title">Keep the outline visible while you type your own pass.</strong>
                  <p>
                    The scaffold stays on screen but softened until you focus it.
                    Use it to rehearse the contract, sample trace, approach, and
                    boundary before you start the judge run.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-button"
                  aria-pressed={sketchFocused}
                  onClick={() =>
                    setSketchFocusByChallenge((current) => ({
                      ...current,
                      [challengeKey]: !current[challengeKey],
                    }))
                  }
                >
                  {sketchFocused ? "Soft blur" : "Focus answer"}
                </button>
              </header>
              <div className={`swift-answer-sketch-grid${sketchFocused ? " is-focused" : " is-muted"}`}>
                {dossier.rows.map((row) => (
                  <article key={row.id}>
                    <small>{row.label}</small>
                    <strong>{row.state === "ready" ? "Ready" : row.state === "pending" ? "Pending" : "Open"}</strong>
                    <p>{row.detail}</p>
                  </article>
                ))}
              </div>
              <small className="swift-answer-sketch-footer">{dossier.nextAction}</small>
            </section>
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
              <section className="swift-case-pack" aria-label="Swift case pack sharing">
                <header>
                  <div>
                    <small>Case pack</small>
                    <strong>Save or import rehearsal inputs</strong>
                  </div>
                  <span>{challenge.key}</span>
                </header>
                <div className="swift-case-pack-actions">
                  <button
                    type="button"
                    className="swift-custom-small-button"
                    onClick={() => void exportCasePack()}
                  >
                    Export pack
                  </button>
                  <button
                    type="button"
                    className="swift-custom-small-button"
                    disabled={!casePackDraft.trim()}
                    onClick={importCasePackDraft}
                  >
                    Import pack
                  </button>
                  <small>Inputs only · challenge revision locked · {SWIFT_CASE_PACK_LIMITS.maxCases} cases max</small>
                </div>
                <textarea
                  value={casePackDraft}
                  maxLength={SWIFT_CASE_PACK_LIMITS.maxBytes}
                  spellCheck={false}
                  aria-label="Swift case pack JSON"
                  placeholder="Export this challenge's cases or paste a Swift Ghost case pack."
                  onChange={(event) => {
                    setCasePackDraft(event.target.value.slice(0, SWIFT_CASE_PACK_LIMITS.maxBytes));
                    setCasePackMessage("");
                  }}
                />
                {casePackMessage ? (
                  <p className="swift-case-pack-message" role="status">{casePackMessage}</p>
                ) : null}
              </section>
              {customError ? <p className="swift-custom-error" role="alert">{customError}</p> : null}
              {customRunVisible && customRun?.status === "pending" ? (
                <div className="swift-custom-result pending" role="status">
                  <strong>Custom case running</strong>
                  <span>The isolated Swift runtime is compiling your input.</span>
                </div>
              ) : customRunVisible && customRun?.status === "settled" && customRun.result ? (
                <div className="swift-custom-result" role="status" aria-live="polite">
                  <div className="swift-custom-result-head">
                    <strong>{customExecutionLabel(customRun.verdict)}</strong>
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
                          <strong>{customExecutionLabel(entry.verdict)}</strong>
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
              {repairableSubmission ? (
                <button
                  className="outline-button failure-repair-link"
                  type="button"
                  onClick={() =>
                    onOpenAttemptClosure?.(submission.clientSubmissionId!)
                  }
                >
                  Open repair plan →
                </button>
              ) : null}
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
                const failedCaseEmphasis = status.className === "failed";
                const selectedFailedCase = Boolean(
                  exampleRun?.result &&
                    (exampleRun.result.failedCaseId === sample.id ||
                      exampleRun.result.failedCaseIndex === index),
                );
                const diagnostic = publicCaseResult?.diagnostic ?? (
                  exampleRun?.status === "settled" &&
                  exampleRun.result?.diagnostic &&
                  (selectedFailedCase || exampleRun.verdict === "compile-error")
                    ? exampleRun.result.diagnostic
                    : undefined
                );
                return (
                  <article
                    key={sample.id}
                    className={`swift-sample-feedback-card${failedCaseEmphasis ? " is-failed" : ""}${selectedFailedCase ? " is-failed-case" : ""}`}
                    aria-label={`${sample.name} public example feedback`}
                  >
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
                    {diagnostic ? (
                      <small className="swift-sample-diagnostic" aria-label={`${sample.name} diagnostic`}>
                        {diagnostic}
                      </small>
                    ) : null}
                    {selectedFailedCase ? (
                      <small className="swift-sample-failure-note">First failing public case</small>
                    ) : null}
                  </article>
                );
              })}
            </div>
            {exampleHistory.length ? (
              <section className="swift-example-history" aria-label="Recent public example runs">
                <header>
                  <div>
                    <small>Run history</small>
                    <strong>Recent public rehearsals</strong>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={clearExampleHistory}
                  >
                    Clear history
                  </button>
                </header>
                <p className="swift-example-history-note">
                  Device-local summaries only · {exampleHistory.length}/{SWIFT_EXAMPLE_HISTORY_LIMITS.maxEntries} saved · source and sealed cases are never stored.
                </p>
                <div className="swift-example-history-list">
                  {exampleHistory.map((entry, index) => (
                    <article key={entry.id} className={index === 0 ? "is-latest" : undefined}>
                      <div className="swift-example-history-head">
                        <strong>{exampleHistoryLabel(entry.verdict)}</strong>
                        <span>{entry.passed}/{entry.total} examples</span>
                      </div>
                      <small>{index === 0 ? "Latest · " : ""}{exampleHistoryDate(entry.settledAt)}</small>
                      {entry.publicCaseResults.length ? (
                        <div className="swift-example-history-cases" aria-label="Historical public case statuses">
                          {entry.publicCaseResults.map((result) => (
                            <span
                              key={result.id}
                              className={result.passed ? "passed" : "failed"}
                            >
                              {result.id}: {publicCaseStatusLabel(result.status, result.passed)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <small>Per-example detail was not returned by this run.</small>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
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
