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

function clientId(prefix: string) {
  const token = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${token}`;
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
}: {
  available: boolean;
  authenticated: boolean;
}) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [entries, setEntries] = useState<CloudTrustedAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [source, setSource] = useState("");
  const [sampleResult, setSampleResult] =
    useState<PythonVerificationResult | null>(null);
  const [submission, setSubmission] =
    useState<CloudTrustedSubmission | null>(null);
  const [action, setAction] = useState<"idle" | "samples" | "submitting">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const runnerRef = useRef<ReturnType<typeof createPythonRunner> | null>(null);
  const retryClientSubmissionIdRef = useRef<string | null>(null);
  const retrySubmissionSourceRef = useRef<string | null>(null);
  const selected = useMemo(
    () =>
      entries.find((entry) => entry.id === selectedId) ?? entries.at(0) ?? null,
    [entries, selectedId],
  );
  const selectedAssignmentId = selected?.id;

  const activateAssignment = useCallback((assignment?: CloudTrustedAssignment) => {
    retryClientSubmissionIdRef.current = null;
    retrySubmissionSourceRef.current = null;
    setSelectedId(assignment?.id);
    setSampleResult(null);
    setMessage("");
    setSubmission(assignment?.latestSubmission ?? null);
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
  }, []);

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
    setSubmission(refreshed?.latestSubmission ?? null);
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
      setSubmission(refreshed.latestSubmission);
      if (refreshed.latestSubmission?.status === "settled") {
        setMessage(
          refreshed.latestSubmission.verdict === "accepted"
            ? "Accepted. This receipt is server-owned verified evidence."
            : refreshed.latestSubmission.verdict === "judge-error"
              ? "The isolated judge did not settle in time. No correctness inference was recorded."
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
  ]);

  async function retryHistory() {
    setLoadState("loading");
    const refreshed = await refreshAssignments(selectedId);
    setLoadState(refreshed ? "ready" : "error");
  }

  async function startAssignment() {
    setMessage("");
    setAction("submitting");
    const result = await trustedClient.issueTrustedAssignment(
      clientId("assignment-request"),
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
    setAction("samples");
    setMessage("");
    try {
      runnerRef.current?.dispose();
      const runner = createPythonRunner();
      runnerRef.current = runner;
      const result = await runner.verify(source, sampleVerification(selected));
      setSampleResult(result);
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
    retryClientSubmissionIdRef.current = null;
    retrySubmissionSourceRef.current = null;
    setSubmission(result.data);
    if (result.data.status === "pending") {
      setMessage("Queued in the isolated judge. This page will poll for the signed receipt.");
    } else if (result.data.verdict === "accepted") {
      setMessage("Accepted. This receipt is server-owned verified evidence.");
      await refreshAssignments(selected.id);
    } else if (result.data.verdict === "judge-error") {
      setMessage("The isolated judge did not settle in time. No correctness inference was recorded.");
      await refreshAssignments(selected.id);
    } else {
      setMessage("The server returned aggregate feedback without exposing sealed cases.");
      await refreshAssignments(selected.id);
    }
  }

  return (
    <section className="trusted-assessment" aria-labelledby="trusted-assessment-title">
      <div className="trusted-assessment-hero">
        <div>
          <span className="eyebrow">Verified lane · Python</span>
          <h2 id="trusted-assessment-title">A real server-owned checkpoint.</h2>
          <p>
            The server selects and freezes the prompt. Samples run in your browser;
            Submit sends source to an isolated Python sandbox and returns only an
            aggregate receipt. Sealed tests never ship in this page.
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
              This deployment has not connected its VM-backed judge yet, so Swift
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
              <button
                className="primary-button"
                type="button"
                disabled={action !== "idle"}
                onClick={() => void startAssignment()}
              >
                New checkpoint
              </button>
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
                  <small>{formatDate(entry.assignedAt)}</small>
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
                <span>Python 3 · source stays in this tab until Submit</span>
                <small>Ctrl/⌘+Enter samples · Shift+Ctrl/⌘+Enter submit</small>
              </div>
              <SolveCodeEditor
                value={source}
                fontSize={15}
                tabSize={4}
                isMock={false}
                readOnly={selected.status !== "active" || action !== "idle"}
                ariaLabel={`${selected.challenge.title} verified checkpoint Python editor`}
                onChange={setSource}
                onRunExamples={() => void runSamples()}
                onSubmit={() => void submit()}
                onExitFocus={() => {}}
              />
            </div>
            {sampleResult ? (
              <div className={`trusted-result ${sampleResult.ok ? "accepted" : "failed"}`}>
                <strong>
                  Browser samples: {sampleResult.cases.filter((entry) => entry.passed).length}/
                  {sampleResult.cases.length}
                </strong>
                <span>Practice feedback only · not verified evidence</span>
              </div>
            ) : null}
            {submission ? (
              <div className={`trusted-result ${submission.verdict ?? "pending"}`}>
                <div>
                  <span className="verified-badge">
                    {submission.status === "settled"
                      ? "Server verified"
                      : "Server receipt"}
                  </span>
                  <strong>{verdictLabel(submission.verdict)}</strong>
                </div>
                {submission.verdict === "judge-error" ? (
                  <p>
                    Infrastructure result · no learner correctness was inferred
                  </p>
                ) : submission.result ? (
                  <p>
                    {submission.result.passed}/{submission.result.total} sealed +
                    sample checks · isolated Python sandbox
                  </p>
                ) : (
                  <p>Waiting for the isolated judge receipt.</p>
                )}
                <small>Receipt {submission.id}</small>
              </div>
            ) : null}
            {message ? <p className="trusted-assessment-message" role="status">{message}</p> : null}
            <div className="trusted-assessment-actions">
              <button
                className="outline-button"
                type="button"
                disabled={action !== "idle"}
                onClick={() => void runSamples()}
              >
                {action === "samples" ? "Running samples…" : "Run samples"}
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
          <button
            className="primary-button"
            type="button"
            disabled={action !== "idle"}
            onClick={() => void startAssignment()}
          >
            {action === "submitting" ? "Issuing checkpoint…" : "Start verified checkpoint →"}
          </button>
          {message ? <p role="status">{message}</p> : null}
        </div>
      )}
    </section>
  );
}
