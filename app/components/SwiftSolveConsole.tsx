"use client";

import type { CloudTrustedAssignment, CloudTrustedSubmission } from "../lib/cloud.mjs";
import type { PracticeItem } from "../lib/items";

type SwiftSolveConsoleProps = {
  item: PracticeItem;
  assignment: CloudTrustedAssignment | null;
  submission: CloudTrustedSubmission | null;
  loadState: "idle" | "loading" | "ready" | "error";
  action: "idle" | "loading" | "submitting";
  message: string;
  available: boolean;
  authenticated: boolean;
  onRequestAssignment: () => void;
  onSubmit: () => void;
};

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

export function SwiftSolveConsole({
  item,
  assignment,
  submission,
  loadState,
  action,
  message,
  available,
  authenticated,
  onRequestAssignment,
  onSubmit,
}: SwiftSolveConsoleProps) {
  const challenge = assignment?.challenge;
  const canSubmit = Boolean(
    assignment?.status === "active" &&
      submission?.status !== "pending" &&
      action === "idle" &&
      available &&
      authenticated,
  );
  const statusLabel = submission?.status === "pending"
    ? "Queued in isolated Swift judge"
    : submission?.verdict
      ? verdictLabel(submission.verdict)
      : assignment
        ? "Assignment ready"
        : "No assignment loaded";

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
          <div className="swift-solve-console-actions">
            <button
              className="primary-button"
              type="button"
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              {action === "submitting" ? "Queueing…" : submission?.status === "pending" ? "Judge running…" : "Submit to Swift judge"}
            </button>
            <small>{item.title} · sealed cases stay server-side</small>
          </div>
          {submission?.status === "settled" && submission.result ? (
            <div className={`swift-solve-verdict ${submission.verdict === "accepted" ? "accepted" : "failed"}`} role="status">
              <strong>{verdictLabel(submission.verdict)}</strong>
              <span>{submission.result.passed}/{submission.result.total} public + sealed cases passed</span>
            </div>
          ) : null}
          <div className="swift-solve-samples">
            <div>
              <span className="eyebrow">Public examples</span>
              <p>Use these to sanity-check your implementation before submitting.</p>
            </div>
            <div className="swift-solve-sample-grid">
              {challenge.samples.map((sample) => (
                <article key={sample.id}>
                  <strong>{sample.name}</strong>
                  <code>args: {valueLabel(sample.args)}</code>
                  <code>expected: {valueLabel(sample.expected)}</code>
                </article>
              ))}
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
