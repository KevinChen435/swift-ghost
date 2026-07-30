"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createCloudClient,
  type CloudTrustedAssignment,
  type CloudTrustedSubmission,
} from "../lib/cloud.mjs";
import {
  createPythonRunner,
  type PythonVerificationResult,
} from "../lib/python-runner.mjs";
import { SolveCodeEditor } from "./SolveCodeEditor";

const trustedClient = createCloudClient();

type LoadState = "idle" | "loading" | "ready" | "error";

type SampleResultSnapshot = {
  result: PythonVerificationResult;
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

function sampleVerification(assignment: CloudTrustedAssignment) {
  return {
    revision: assignment.challenge.judgeRevision,
    entrypoint: assignment.challenge.entrypoint,
    cases: assignment.challenge.samples.map((sample) => ({
      id: sample.id,
      visibility: "sample" as const,
      name: sample.name,
      args: sample.args,
      expected: sample.expected,
      comparator: "deepEqual" as const,
    })),
  };
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
  const runnerRef = useRef<ReturnType<typeof createPythonRunner> | null>(null);
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

  useEffect(
    () => () => {
      runnerRef.current?.dispose();
      runnerRef.current = null;
    },
    [],
  );

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
                ? "The server could not compile this Swift source. Fix the syntax or signature and submit a new revision."
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
    if (!selected || action !== "idle") return;
    if (selected.challenge.language === "swift") {
      setMessage(
        "Swift samples stay visible, but compilation runs only in the isolated server. Submit compiles once and checks samples plus sealed cases.",
      );
      return;
    }
    setAction("samples");
    setMessage("");
    try {
      runnerRef.current?.dispose();
      const runner = createPythonRunner();
      runnerRef.current = runner;
      const result = await runner.verify(source, sampleVerification(selected));
      setSampleResult({ result, source });
    } catch {
      setMessage("The browser sample runner could not start. Server submission remains separate.");
    } finally {
      runnerRef.current?.dispose();
      runnerRef.current = null;
      setAction("idle");
    }
  }

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
      setMessage("The server could not compile this Swift source. Fix the syntax or signature and submit a new revision.");
      await refreshAssignments(selected.id);
    } else {
      setMessage("The server returned aggregate feedback without exposing sealed cases.");
      await refreshAssignments(selected.id);
    }
  }

  function handleSourceChange(nextSource: string) {
    setSource(nextSource);
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
            The server selects and freezes the prompt. Samples run in your browser;
            Python samples can run locally. Swift and Python submissions go to
            isolated Linux sandboxes and return only an aggregate receipt.
            Sealed tests never ship in this page.
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
                    : "Python 3"}
                  {" · source stays in this tab until Submit"}
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
            {sampleResult ? (
              <div className={`trusted-result ${sampleResult.result.ok ? "accepted" : "failed"}`}>
                <strong>
                  Browser samples: {sampleResult.result.cases.filter((entry) => entry.passed).length}/
                  {sampleResult.result.cases.length}
                </strong>
                <span>Practice feedback only · current editor snapshot</span>
              </div>
            ) : null}
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
                  action !== "idle" || selected.challenge.language === "swift"
                }
                onClick={() => void runSamples()}
              >
                {selected.challenge.language === "swift"
                  ? "Samples run on Submit"
                  : action === "samples"
                    ? "Running samples…"
                    : "Run samples"}
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
