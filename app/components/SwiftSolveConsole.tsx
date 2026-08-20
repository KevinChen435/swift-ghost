"use client";

import { useMemo, useState } from "react";
import type { CloudTrustedAssignment, CloudTrustedSubmission } from "../lib/cloud.mjs";
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
  loadState: "idle" | "loading" | "ready" | "error";
  action: "idle" | "loading" | "submitting";
  message: string;
  available: boolean;
  authenticated: boolean;
  sourcePresent: boolean;
  retryAvailable: boolean;
  onRequestAssignment: () => void;
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
  sourcePresent,
  retryAvailable,
  onRequestAssignment,
  onSubmit,
}: SwiftSolveConsoleProps) {
  const challenge = assignment?.challenge;
  const challengeKey = challenge?.key ?? "none";
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sampleTrace, setSampleTrace] = useState<Record<string, SampleTraceState>>({});
  const [notesByChallenge, setNotesByChallenge] = useState<Record<string, SwiftPreflightNotes>>({});
  const notes = notesByChallenge[challengeKey] ?? EMPTY_NOTES;

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
          <div className="swift-solve-console-actions">
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
