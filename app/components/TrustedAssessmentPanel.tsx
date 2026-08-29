"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createCloudClient,
  type CloudTrustedAssignment,
  type CloudTrustedExampleRun,
  type CloudTrustedSubmission,
} from "../lib/cloud.mjs";
import { SolveCodeEditor } from "./SolveCodeEditor";

const trustedClient = createCloudClient();

type LoadState = "idle" | "loading" | "ready" | "error";

type SampleResultSnapshot = {
  result: CloudTrustedExampleRun;
  source: string;
};

export type TrustedAssessmentReceiptEvent = {
  submissionId: string;
  challengeKey: string;
  title: string;
  language: "python" | "swift";
  source: string;
  submittedAt: string;
  settledAt: string;
  status: Exclude<CloudTrustedSubmission["verdict"], null>;
  passed: number;
  total: number;
  contentRevision: number;
  judgeRevision: number;
};

function clientId(prefix: string) {
  const token = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${token}`;
}

function submittedSourceKey(submissionId: string) {
  return `swift-ghost-trusted-submission-source:${submissionId}`;
}

function assignmentSubmittedSourceKey(assignmentId: string, submissionId: string) {
  return `swift-ghost-trusted-submission-source:${assignmentId}:${submissionId}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Unknown time"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
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

function languageLabel(language: "python" | "swift") {
  return language === "swift" ? "Swift" : "Python";
}

export function TrustedAssessmentPanel({
  available,
  authenticated,
  onReceipt,
}: {
  available: boolean;
  authenticated: boolean;
  onReceipt?: (event: TrustedAssessmentReceiptEvent) => void;
}) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [entries, setEntries] = useState<CloudTrustedAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [source, setSource] = useState("");
  const [sampleResult, setSampleResult] =
    useState<SampleResultSnapshot | null>(null);
  const [submission, setSubmission] =
    useState<CloudTrustedSubmission | null>(null);
  const [submissionSource, setSubmissionSource] = useState<string | null>(null);
  const [action, setAction] = useState<"idle" | "samples" | "submitting">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const sampleRunRequestRef = useRef<{
    assignmentId: string;
    clientRunId: string;
    source: string;
  } | null>(null);
  const retryClientSubmissionIdRef = useRef<string | null>(null);
  const retrySubmissionSourceRef = useRef<string | null>(null);
  const submittedSourcesRef = useRef(new Map<string, string>());
  const emittedReceiptIdsRef = useRef(new Set<string>());
  const onReceiptRef = useRef(onReceipt);
  useEffect(() => {
    onReceiptRef.current = onReceipt;
  }, [onReceipt]);
  const selected = useMemo(
    () =>
      entries.find((entry) => entry.id === selectedId) ?? entries.at(0) ?? null,
    [entries, selectedId],
  );
  const selectedAssignmentId = selected?.id;

  const rememberSubmittedSource = useCallback(
    (submissionId: string, assignmentId: string, submittedSource: string) => {
      submittedSourcesRef.current.set(submissionId, submittedSource);
      try {
        globalThis.sessionStorage?.setItem(
          submittedSourceKey(submissionId),
          submittedSource,
        );
        globalThis.sessionStorage?.setItem(
          assignmentSubmittedSourceKey(assignmentId, submissionId),
          submittedSource,
        );
      } catch {
        // A blocked session store must not prevent solving.
      }
    },
    [],
  );

  const submittedSourceFor = useCallback(
    (submissionId: string, assignmentId?: string) => {
      const cached = submittedSourcesRef.current.get(submissionId);
      if (cached) return cached;
      let restored: string | null = null;
      try {
        restored = globalThis.sessionStorage?.getItem(
          submittedSourceKey(submissionId),
        ) ?? null;
        if (!restored && assignmentId) {
          restored = globalThis.sessionStorage?.getItem(
            assignmentSubmittedSourceKey(assignmentId, submissionId),
          ) ?? null;
        }
      } catch {
        // A blocked session store must not prevent solving.
      }
      if (restored) submittedSourcesRef.current.set(submissionId, restored);
      return restored;
    },
    [],
  );

  const showSubmission = useCallback(
    (
      assignment: CloudTrustedAssignment | undefined,
      candidate: CloudTrustedSubmission | null,
    ) => {
      setSubmission(candidate);
      setSubmissionSource(
        candidate ? submittedSourceFor(candidate.id, assignment?.id) : null,
      );
    },
    [submittedSourceFor],
  );

  const emitSettledReceipt = useCallback(
    (assignment: CloudTrustedAssignment, candidate: CloudTrustedSubmission | null) => {
      if (
        !candidate ||
        candidate.status !== "settled" ||
        !candidate.verdict ||
        !candidate.result ||
        emittedReceiptIdsRef.current.has(candidate.id)
      ) return;
      const submittedSource = submittedSourceFor(candidate.id, assignment.id);
      if (!submittedSource) return;
      emittedReceiptIdsRef.current.add(candidate.id);
      onReceiptRef.current?.({
        submissionId: candidate.id,
        challengeKey: assignment.challenge.key,
        title: assignment.challenge.title,
        language: candidate.result.language,
        source: submittedSource,
        submittedAt: candidate.submittedAt,
        settledAt: candidate.settledAt ?? candidate.submittedAt,
        status: candidate.verdict,
        passed: candidate.result.passed,
        total: candidate.result.total,
        contentRevision: candidate.result.contentRevision,
        judgeRevision: candidate.result.judgeRevision,
      });
    },
    [submittedSourceFor],
  );

  const activateAssignment = useCallback((assignment?: CloudTrustedAssignment) => {
    retryClientSubmissionIdRef.current = null;
    retrySubmissionSourceRef.current = null;
    sampleRunRequestRef.current = null;
    setSelectedId(assignment?.id);
    setSampleResult(null);
    setMessage("");
    showSubmission(assignment, assignment?.latestSubmission ?? null);
    if (!assignment) {
      setSource("");
      return;
    }
    let restored: string | null = null;
    try {
      restored = globalThis.sessionStorage?.getItem(
        `swift-ghost-trusted-source:${assignment.id}`,
      ) ?? null;
    } catch {
      // A blocked session store must not prevent solving.
    }
    setSource(restored ?? assignment.challenge.starterCode);
  }, [showSubmission]);

  useEffect(() => {
    if (!available || !authenticated) return;
    const controller = new AbortController();
    async function loadAssignments() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoadState("loading");
      const result = await trustedClient.trustedAssignments({
        limit: 20,
        signal: controller.signal,
      });
      if (!result.available) {
        if (result.reason !== "aborted") setLoadState("error");
        return;
      }
      setEntries(result.data.entries);
      activateAssignment(result.data.entries.at(0));
      setLoadState("ready");
    }
    void loadAssignments();
    return () => controller.abort();
  }, [activateAssignment, authenticated, available]);

  useEffect(() => {
    if (!available || !authenticated) return;
    entries.forEach((entry) =>
      emitSettledReceipt(entry, entry.latestSubmission),
    );
  }, [authenticated, available, emitSettledReceipt, entries]);

  useEffect(() => {
    if (!selected || !source) return;
    try {
      globalThis.sessionStorage?.setItem(
        `swift-ghost-trusted-source:${selected.id}`,
        source,
      );
    } catch {
      // A blocked session store must not prevent solving.
    }
  }, [selected, source]);

  async function refreshAssignments(
    preferredId?: string,
    signal?: AbortSignal,
  ) {
    const result = await trustedClient.trustedAssignments({ limit: 20, signal });
    if (!result.available) return false;
    setEntries(result.data.entries);
    const refreshed = (preferredId
      ? result.data.entries.find((entry) => entry.id === preferredId)
      : undefined) ?? result.data.entries.at(0);
    setSelectedId(refreshed?.id);
    showSubmission(refreshed, refreshed?.latestSubmission ?? null);
    return true;
  }

  useEffect(() => {
    if (
      !available ||
      !authenticated ||
      !selectedAssignmentId ||
      submission?.status !== "pending"
    )
      return;
    const controller = new AbortController();
    let cancelled = false;
    let timer: ReturnType<typeof globalThis.setTimeout>;
    async function poll() {
      const result = await trustedClient.trustedAssignments({
        limit: 20,
        signal: controller.signal,
      });
      if (cancelled) return;
      if (!result.available) {
        timer = globalThis.setTimeout(() => void poll(), 3_000);
        return;
      }
      setEntries(result.data.entries);
      const refreshed = result.data.entries.find(
        (entry) => entry.id === selectedAssignmentId,
      );
      if (!refreshed) return;
      showSubmission(refreshed, refreshed.latestSubmission);
      emitSettledReceipt(refreshed, refreshed.latestSubmission);
      if (refreshed.latestSubmission?.status === "settled") {
        setMessage(
          refreshed.latestSubmission.verdict === "accepted"
            ? "Accepted. This receipt is server-owned verified evidence."
            : refreshed.latestSubmission.verdict === "judge-error"
              ? "The isolated judge did not settle in time. No correctness inference was recorded."
                : refreshed.latestSubmission.verdict === "compile-error"
                ? `The server could not compile this ${languageLabel(refreshed.challenge.language)} source. Fix the syntax or signature and submit a new revision.`
            : "The server returned aggregate feedback without exposing sealed cases.",
        );
        return;
      }
      timer = globalThis.setTimeout(() => void poll(), 1_500);
    }
    timer = globalThis.setTimeout(() => void poll(), 1_500);
    return () => {
      cancelled = true;
      controller.abort();
      globalThis.clearTimeout(timer);
    };
  }, [
    authenticated,
    available,
    selectedAssignmentId,
    submission?.status,
    emitSettledReceipt,
    showSubmission,
  ]);

  async function retryHistory() {
    setLoadState("loading");
    const refreshed = await refreshAssignments(selectedId);
    setLoadState(refreshed ? "ready" : "error");
  }

  async function startAssignment(language: "python" | "swift") {
    setMessage("");
    setAction("submitting");
    const result = await trustedClient.issueTrustedAssignment(
      clientId("assignment-request"),
      { language },
    );
    setAction("idle");
    if (!result.available) {
      setMessage(
        result.reason === "unauthorized"
          ? "Sign in again before starting a verified checkpoint."
          : "The isolated judge could not issue a checkpoint. Your local assessments are still available below.",
      );
      return;
    }
    setEntries((current) => [
      result.data,
      ...current.filter((entry) => entry.id !== result.data.id),
    ]);
    activateAssignment(result.data);
  }

  async function runSamples() {
    if (
      !selected ||
      action !== "idle" ||
      selected.status !== "active" ||
      !source.trim() ||
      sampleResult?.result.status === "pending"
    ) return;
    const retry = sampleRunRequestRef.current;
    const request =
      retry && retry.assignmentId === selected.id && retry.source === source
        ? retry
        : {
            assignmentId: selected.id,
            clientRunId: clientId("example"),
            source,
          };
    sampleRunRequestRef.current = request;
    setAction("samples");
    setMessage("");
    setSampleResult(null);
    try {
      const result = await trustedClient.runTrustedExamples(
        request.assignmentId,
        { clientRunId: request.clientRunId, source: request.source },
        { challenge: selected.challenge },
      );
      if (sampleRunRequestRef.current?.clientRunId !== request.clientRunId) return;
      if (!result.available) {
        if (result.reason === "judge-enqueue-unavailable" || result.reason === "offline") {
          sampleRunRequestRef.current = request;
          setSampleResult({
            source: request.source,
            result: {
              id: request.clientRunId,
              assignmentId: request.assignmentId,
              clientRunId: request.clientRunId,
              status: "pending",
              verdict: null,
              requestedAt: new Date().toISOString(),
              settledAt: null,
              result: null,
            },
          });
        } else {
          sampleRunRequestRef.current = null;
        }
        setMessage(
          result.reason === "unauthorized"
            ? "Sign in again before running isolated examples."
            : result.reason === "rate-limited"
              ? "Wait for the earlier example run to finish before trying again."
              : result.reason === "judge-enqueue-unavailable"
                ? "The example run is saved and waiting for the isolated judge; this page will retry it."
                : "The isolated example runner could not be reached. Your source remains in this tab.",
        );
        return;
      }
      if (
        result.data.assignmentId !== request.assignmentId ||
        result.data.clientRunId !== request.clientRunId
      ) {
        sampleRunRequestRef.current = null;
        setMessage("The example result did not match this source. Run examples again.");
        return;
      }
      setSampleResult({ result: result.data, source: request.source });
      if (result.data.status === "pending") {
        setMessage("Examples queued in the isolated runtime. This page will poll for public sample feedback.");
      } else {
        sampleRunRequestRef.current = null;
        setMessage(
          result.data.verdict === "accepted"
            ? "Public examples passed. Submit when you are ready for sealed tests."
            : "Public examples found a problem. Fix this before using the sealed judge.",
        );
      }
    } catch (error) {
      if (sampleRunRequestRef.current?.clientRunId !== request.clientRunId) return;
      sampleRunRequestRef.current = null;
      setMessage(
        error instanceof Error
          ? error.message
          : "The isolated example runner could not be reached. Your source remains in this tab.",
      );
    } finally {
      setAction("idle");
    }
  }

  useEffect(() => {
    if (
      !available ||
      !authenticated ||
      !selected ||
      sampleResult?.result.status !== "pending"
    )
      return;
    const request = sampleRunRequestRef.current;
    if (!request || request.assignmentId !== selected.id) return;
    const pollRequest = { ...request };
    const controller = new AbortController();
    let cancelled = false;
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
    let pollAttempts = 0;
    const maxPollAttempts = 40;
    async function pollExamples() {
      pollAttempts += 1;
      const result = await trustedClient.runTrustedExamples(
        pollRequest.assignmentId,
        { clientRunId: pollRequest.clientRunId, source: pollRequest.source },
        {
          signal: controller.signal,
          challenge: selected?.challenge,
        },
      );
      if (cancelled) return;
      if (result.available) {
        if (
          result.data.assignmentId !== pollRequest.assignmentId ||
          result.data.clientRunId !== pollRequest.clientRunId
        ) {
          sampleRunRequestRef.current = null;
          setSampleResult(null);
          setMessage("The example result did not match this source. Run examples again.");
          return;
        }
        setSampleResult({ result: result.data, source: pollRequest.source });
        if (result.data.status === "settled") {
          sampleRunRequestRef.current = null;
          setMessage(
            result.data.verdict === "accepted"
              ? "Public examples passed. Submit when you are ready for sealed tests."
              : "Public examples found a problem. Fix this before using the sealed judge.",
          );
          return;
        }
      } else if (result.reason !== "aborted") {
        const retryable = new Set(["judge-enqueue-unavailable", "rate-limited", "offline"]);
        if (!retryable.has(result.reason) || pollAttempts >= maxPollAttempts) {
          sampleRunRequestRef.current = null;
          setSampleResult(null);
          setMessage(
            pollAttempts >= maxPollAttempts
              ? "The example run took too long to settle. Run examples again."
              : result.reason === "unauthorized"
                ? "Your sign-in expired. Sign in again before running examples."
                : "The example run is no longer available. Run examples again.",
          );
          return;
        }
      }
      timer = globalThis.setTimeout(() => void pollExamples(), 1_500);
    }
    timer = globalThis.setTimeout(() => void pollExamples(), 1_500);
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) globalThis.clearTimeout(timer);
    };
  }, [authenticated, available, sampleResult?.result.status, selected]);

  async function submit() {
    if (!selected || action !== "idle" || selected.status !== "active") return;
    setAction("submitting");
    setMessage("");
    const clientSubmissionId =
      retryClientSubmissionIdRef.current &&
      retrySubmissionSourceRef.current === source
        ? retryClientSubmissionIdRef.current
        : clientId("submission");
    retryClientSubmissionIdRef.current = clientSubmissionId;
    retrySubmissionSourceRef.current = source;
    rememberSubmittedSource(clientSubmissionId, selected.id, source);
    const result = await trustedClient.submitTrustedAssignment(
      selected.id,
      { clientSubmissionId, source },
    );
    setAction("idle");
    if (!result.available) {
      setMessage(
        result.reason === "offline"
          ? "Submission did not reach the server. Your source remains in this tab."
          : "The verified submission was not accepted by the service. Nothing was converted into trusted evidence.",
      );
      return;
    }
    rememberSubmittedSource(result.data.id, selected.id, source);
    retryClientSubmissionIdRef.current = null;
    retrySubmissionSourceRef.current = null;
    emitSettledReceipt(selected, result.data);
    showSubmission(selected, result.data);
    if (result.data.status === "pending") {
      setMessage("Queued in the isolated judge. This page will poll for the signed receipt.");
    } else if (result.data.verdict === "accepted") {
      setMessage("Accepted. This receipt is server-owned verified evidence.");
      await refreshAssignments(selected.id);
    } else if (result.data.verdict === "judge-error") {
      setMessage("The isolated judge did not settle in time. No correctness inference was recorded.");
      await refreshAssignments(selected.id);
    } else if (result.data.verdict === "compile-error") {
      setMessage(`The server could not compile this ${languageLabel(selected.challenge.language)} source. Fix the syntax or signature and submit a new revision.`);
      await refreshAssignments(selected.id);
    } else {
      setMessage("The server returned aggregate feedback without exposing sealed cases.");
      await refreshAssignments(selected.id);
    }
  }

  function handleSourceChange(nextSource: string) {
    setSource(nextSource);
    if (sampleResult?.source !== nextSource) {
      sampleRunRequestRef.current = null;
    }
    setSampleResult((current) =>
      current && current.source !== nextSource ? null : current,
    );
  }

  const submissionSourceState = submission
    ? submissionSource
      ? submissionSource === source
        ? "matches"
        : "edited"
      : "unavailable"
    : null;

  return (
    <section className="trusted-assessment" aria-labelledby="trusted-assessment-title">
      <div className="trusted-assessment-hero">
        <div>
          <span className="eyebrow">Verified lane · Python + Swift</span>
          <h2 id="trusted-assessment-title">Compile, run, and earn a server-owned receipt.</h2>
          <p>
            The server selects and freezes the prompt. Run samples sends only your
            current source to the matching isolated Linux runtime and returns
            bounded public feedback. Submit separately when you are ready for
            sealed tests; hidden cases never ship to this page.
          </p>
        </div>
        <div className="trusted-assessment-boundary" aria-label="Trust boundary">
          <span className={available ? "online" : "offline"}>
            {available ? "Sandbox connected" : "Sandbox not connected"}
          </span>
          <strong>Auth + D1 + isolated judge</strong>
          <small>Code verdicts are verified · reflection remains self-reported</small>
        </div>
      </div>

      {!available ? (
        <div className="trusted-assessment-unavailable">
          <div>
            <strong>Verified execution is fail-closed.</strong>
            <p>
              This deployment has not connected its isolated judge yet, so Swift
              Ghost will not relabel browser-local results as trusted. The local
              diagnostics and Virtual Rounds below remain fully usable.
            </p>
          </div>
          <span>Infrastructure milestone</span>
        </div>
      ) : !authenticated ? (
        <div className="trusted-assessment-unavailable">
          <div>
            <strong>Sign in to own a verified receipt.</strong>
            <p>
              Assignment ownership, idempotency, and immutable verdict history are
              tied to your authenticated account.
            </p>
          </div>
          <span>Account required</span>
        </div>
      ) : loadState === "loading" ? (
        <p className="trusted-assessment-status" role="status">
          Loading verified checkpoint history…
        </p>
      ) : loadState === "error" ? (
        <div className="trusted-assessment-unavailable" role="alert">
          <div>
            <strong>Verified history is unavailable.</strong>
            <p>No local result will be promoted while the server cannot be read.</p>
          </div>
          <button className="outline-button" type="button" onClick={() => void retryHistory()}>
            Retry
          </button>
        </div>
      ) : selected ? (
        <div className="trusted-assessment-workspace">
          <aside className="trusted-assignment-list" aria-label="Verified checkpoints">
            <div>
              <span className="eyebrow">History</span>
              <div className="trusted-new-actions">
                <button
                  className="outline-button"
                  type="button"
                  disabled={action !== "idle"}
                  onClick={() => void startAssignment("python")}
                >
                  New Python
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={action !== "idle"}
                  onClick={() => void startAssignment("swift")}
                >
                  New Swift
                </button>
              </div>
            </div>
            {entries.map((entry) => (
              <button
                type="button"
                key={entry.id}
                className={entry.id === selected.id ? "selected" : ""}
                aria-pressed={entry.id === selected.id}
                disabled={action !== "idle"}
                onClick={() => activateAssignment(entry)}
              >
                <span>
                  <strong>{entry.challenge.title}</strong>
                  <small>
                    {entry.challenge.language === "swift" ? "Swift 6" : "Python 3"}
                    {" · "}{formatDate(entry.assignedAt)}
                  </small>
                </span>
                <span className={`trusted-status ${entry.status}`}>{entry.status}</span>
              </button>
            ))}
          </aside>

          <div className="trusted-assignment-main">
            <header>
              <div>
                <span>{selected.challenge.difficulty}</span>
                <span>{selected.challenge.estimatedMinutes} min</span>
                <span>Prompt r{selected.challenge.contentRevision}</span>
                <span>Judge r{selected.challenge.judgeRevision}</span>
              </div>
              <h3>{selected.challenge.title}</h3>
              <p>{selected.challenge.prompt}</p>
            </header>
            <div className="trusted-constraints">
              <strong>Constraints</strong>
              <ul>
                {selected.challenge.constraints.map((constraint) => (
                  <li key={constraint}>{constraint}</li>
                ))}
              </ul>
            </div>
            <div className="trusted-samples">
              {selected.challenge.samples.map((sample) => (
                <article key={sample.id}>
                  <strong>{sample.name}</strong>
                  <code>args = {valueLabel(sample.args)}</code>
                  <code>expected = {valueLabel(sample.expected)}</code>
                </article>
              ))}
            </div>
            <div className="trusted-editor-shell">
              <div className="trusted-editor-toolbar">
                <span>
                  {selected.challenge.language === "swift"
                    ? "Swift 6.3.3 · Linux"
                    : "Python 3.13 · Linux"}
                  {" · source is sent only when you run or submit (including isolated checks)"}
                </span>
                <small>Ctrl/⌘+Enter samples · Shift+Ctrl/⌘+Enter submit</small>
              </div>
              <SolveCodeEditor
                value={source}
                language={selected.challenge.language}
                fontSize={15}
                tabSize={4}
                isMock={false}
                readOnly={selected.status !== "active" || action !== "idle"}
                ariaLabel={`${selected.challenge.title} verified ${selected.challenge.language} editor`}
                onChange={handleSourceChange}
                onRunExamples={() => void runSamples()}
                onSubmit={() => void submit()}
                onExitFocus={() => {}}
              />
            </div>
            {sampleResult ? (() => {
              const result = sampleResult.result;
              const payload = result.result;
              const passed = payload?.passed ?? 0;
              const total = payload?.total ?? selected.challenge.samples.length;
              return (
                <div
                  className={`trusted-result ${result.status === "pending" ? "pending" : result.verdict === "accepted" ? "accepted" : "failed"}`}
                >
                  <strong>
                    Isolated public examples: {passed}/{total}
                  </strong>
                  <span>
                    {result.status === "pending"
                      ? "Queued feedback · hidden cases stay sealed"
                      : `Practice feedback only · ${payload?.runtime ?? selected.challenge.runtime}`}
                  </span>
                  {payload?.publicCaseResults?.length ? (
                    <ul className="trusted-public-cases">
                      {payload.publicCaseResults.map((entry) => (
                        <li key={entry.id} className={entry.passed ? "passed" : "failed"}>
                          <span>{entry.passed ? "✓" : "×"} {entry.id}</span>
                          <small>
                            {entry.status ?? (entry.passed ? "passed" : "failed")}
                            {entry.actual !== undefined
                              ? ` · actual ${valueLabel(entry.actual)}`
                              : ""}
                            {entry.diagnostic ? ` · ${entry.diagnostic}` : ""}
                          </small>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })() : null}
            {submission ? (
              <div className={`trusted-result ${submission.verdict ?? "pending"}`}>
                <div>
                  <span className="verified-badge">
                    {submission.status === "settled"
                      ? submission.result?.contractDigest
                        ? "Server verified"
                        : "Legacy server receipt"
                      : "Server receipt"}
                  </span>
                  <strong>{verdictLabel(submission.verdict)}</strong>
                </div>
                {submission.verdict === "judge-error" ? (
                  <p>
                    Infrastructure result · no learner correctness was inferred
                  </p>
                ) : submission.result ? (
                  <>
                    <p>
                      {submission.result.passed}/{submission.result.total} sample +
                      sealed checks · {submission.result.runtime}
                    </p>
                    <small>
                      {submission.result.contractDigest
                        ? `Contract ${submission.result.contractDigest.slice(0, 12)}…`
                        : "Legacy receipt · contract metadata unavailable"}
                      {" · "}prompt r{submission.result.contentRevision} · judge r{submission.result.judgeRevision}
                    </small>
                  </>
                ) : (
                  <p>Waiting for the isolated judge receipt.</p>
                )}
                {submissionSourceState === "matches" ? (
                  <small>Receipt source matches the current editor.</small>
                ) : submissionSourceState === "edited" ? (
                  <small>Receipt belongs to an earlier source snapshot.</small>
                ) : submissionSourceState === "unavailable" ? (
                  <small>Receipt source snapshot is unavailable in this tab.</small>
                ) : null}
                {submissionSourceState === "edited" ? (
                  <small>Receipt belongs to the submitted source; the editor has since changed.</small>
                ) : submissionSourceState === "unavailable" ? (
                  <small>Receipt source is not available in this browser session.</small>
                ) : null}
                <small>Receipt {submission.id}</small>
              </div>
            ) : null}
            {message ? <p className="trusted-assessment-message" role="status">{message}</p> : null}
            <div className="trusted-assessment-actions">
              <button
                className="outline-button"
                type="button"
                disabled={
                  action !== "idle" ||
                  selected.status !== "active" ||
                  !source.trim() ||
                  sampleResult?.result.status === "pending"
                }
                onClick={() => void runSamples()}
              >
                {action === "samples" ? "Running isolated samples…" : "Run samples"}
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={action !== "idle" || selected.status !== "active"}
                onClick={() => void submit()}
              >
                {action === "submitting" ? "Submitting to sandbox…" : "Submit sealed tests →"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="trusted-assessment-empty">
          <span className="eyebrow">No verified history yet</span>
          <h3>Start with a server-selected problem.</h3>
          <p>
            You will have two hours to submit. Exact retries are idempotent, and
            client-supplied verdicts or revisions are ignored.
          </p>
          <div className="trusted-empty-actions">
            <button
              className="outline-button"
              type="button"
              disabled={action !== "idle"}
              onClick={() => void startAssignment("python")}
            >
              Start Python
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={action !== "idle"}
              onClick={() => void startAssignment("swift")}
            >
              {action === "submitting" ? "Issuing checkpoint…" : "Start Swift →"}
            </button>
          </div>
          {message ? <p role="status">{message}</p> : null}
        </div>
      )}
    </section>
  );
}
