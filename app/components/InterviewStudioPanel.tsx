"use client";

import { useEffect, useRef, useState } from "react";

export const INTERVIEW_PHASE_ORDER = [
  "introduction",
  "clarification",
  "approach",
  "implementation",
  "testing",
  "complexity",
  "follow-up",
  "closing",
] as const;

export type InterviewPanelPhase =
  | (typeof INTERVIEW_PHASE_ORDER)[number]
  | "completed";

export type InterviewPanelSession = {
  id: string;
  format: "python-coding" | "ios-technical";
  mode: "mock" | "coach";
  phase: InterviewPanelPhase;
  startedAt: string;
  expiresAt?: string;
  script: {
    title: string;
    scenario?: string;
    prompts: Partial<Record<InterviewPanelPhase, string>>;
    referenceCriteria?: string[];
  };
  transcript: Array<{
    id: string;
    role: "interviewer" | "candidate" | "system";
    text: string;
    at: string;
    phase: InterviewPanelPhase;
    kind?: string;
  }>;
  runnerEvents?: Array<{
    id?: string;
    status: string;
    at: string;
    passed?: number;
    total?: number;
  }>;
  hintLog?: Array<{
    id?: string;
    phase: InterviewPanelPhase;
    text?: string;
    at: string;
    level?: number;
  }>;
};

type InterviewStudioPanelProps = {
  session: InterviewPanelSession;
  compact?: boolean;
  responseLabel?: string;
  onCommitResponse: (text: string) => void;
  onAdvance: () => void;
  onRequestHint: () => void;
  onFinish: () => void;
  canFinish?: boolean;
  finishLabel?: string;
};

function phaseLabel(phase: InterviewPanelPhase) {
  if (phase === "follow-up") return "Follow-up";
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function timeLabel(value: string, startedAt: string) {
  const elapsed = Math.max(0, Date.parse(value) - Date.parse(startedAt));
  const minutes = Math.floor(elapsed / 60_000);
  const seconds = Math.floor((elapsed % 60_000) / 1_000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function nextActionLabel(session: InterviewPanelSession) {
  switch (session.phase) {
    case "introduction":
      return "Begin clarification";
    case "clarification":
      return "Commit questions";
    case "approach":
      return "Commit approach";
    case "implementation":
      return session.format === "python-coding"
        ? "Continue to testing"
        : "Commit implementation answer";
    case "testing":
      return "Commit verification plan";
    case "complexity":
      return "Commit tradeoffs";
    case "follow-up":
      return "Commit follow-up";
    case "closing":
      return "Commit final explanation";
    default:
      return "Completed";
  }
}

function needsWrittenResponse(session: InterviewPanelSession) {
  if (session.phase === "completed") return false;
  if (session.phase === "introduction") return false;
  return !(
    session.format === "python-coding" &&
    (session.phase === "implementation" || session.phase === "testing")
  );
}

export function InterviewStudioPanel({
  session,
  compact = false,
  responseLabel = "Your spoken-style answer",
  onCommitResponse,
  onAdvance,
  onRequestHint,
  onFinish,
  canFinish = false,
  finishLabel = "Finish interview",
}: InterviewStudioPanelProps) {
  const [response, setResponse] = useState("");
  const phaseHeadingRef = useRef<HTMLHeadingElement>(null);
  const phase = session.phase;
  const phaseIndex = INTERVIEW_PHASE_ORDER.indexOf(
    phase as (typeof INTERVIEW_PHASE_ORDER)[number],
  );
  const prompt = session.script.prompts[phase] ?? "";
  const writtenResponseRequired = needsWrittenResponse(session);
  const runnerEvents = session.runnerEvents ?? [];
  const lastRunner = runnerEvents[runnerEvents.length - 1];
  const hintCount =
    session.hintLog?.length ??
    session.transcript.filter((entry) => entry.kind === "coach-hint").length;

  useEffect(() => {
    phaseHeadingRef.current?.focus();
  }, [phase]);

  function commitOrAdvance() {
    const normalized = response.trim();
    if (writtenResponseRequired) onCommitResponse(normalized);
    else onAdvance();
    setResponse("");
  }

  return (
    <section
      className={`interview-studio-panel${compact ? " is-compact" : ""}`}
      aria-label="Interview Studio"
    >
      <header className="interview-studio-header">
        <div>
          <span className="eyebrow">
            {session.mode === "mock" ? "Interview mode" : "Coach mode"}
          </span>
          <strong>{session.script.title}</strong>
        </div>
        <span className="interview-local-badge">Private on this device</span>
      </header>

      <ol className="interview-stepper" aria-label="Interview progress">
        {INTERVIEW_PHASE_ORDER.map((step, index) => {
          const complete = phase === "completed" || index < phaseIndex;
          const current = step === phase;
          return (
            <li
              key={step}
              className={`${complete ? "is-complete" : ""}${current ? " is-current" : ""}`}
              aria-current={current ? "step" : undefined}
            >
              <span aria-hidden="true">{complete ? "✓" : index + 1}</span>
              <small>{phaseLabel(step)}</small>
            </li>
          );
        })}
      </ol>

      <div className="interview-transcript" aria-label="Interview transcript">
        {session.transcript.length ? (
          session.transcript.slice(-24).map((entry) => (
            <article className={`is-${entry.role}`} key={entry.id}>
              <header>
                <strong>
                  {entry.role === "interviewer"
                    ? "Interviewer"
                    : entry.role === "candidate"
                      ? "You"
                      : "Evidence"}
                </strong>
                <time dateTime={entry.at}>
                  {timeLabel(entry.at, session.startedAt)}
                </time>
              </header>
              <p>{entry.text}</p>
            </article>
          ))
        ) : (
          <p className="interview-empty-transcript">
            The transcript begins when you commit the first step.
          </p>
        )}
      </div>

      {phase !== "completed" ? (
        <section className="interview-current-turn" aria-live="polite">
          <span className="eyebrow">Current turn · {phaseLabel(phase)}</span>
          <h3 ref={phaseHeadingRef} tabIndex={-1}>
            {prompt || "Continue the interview."}
          </h3>
          {session.format === "python-coding" &&
            (phase === "implementation" || phase === "testing") && (
              <p className="interview-workspace-direction">
                {phase === "implementation"
                  ? "Use the Code pane to implement. Move on when your approach is represented in code."
                  : "Use the Tests pane. The interviewer records runs and submissions as evidence, but does not interpret free-form text."}
              </p>
            )}
          {writtenResponseRequired && (
            <label className="interview-response-field">
              <span>{responseLabel}</span>
              <textarea
                value={response}
                maxLength={4000}
                rows={compact ? 4 : 6}
                placeholder="Write what you would say aloud. This is recorded, not automatically interpreted."
                onChange={(event) => setResponse(event.target.value)}
              />
              <small>
                Recorded locally · no semantic score · {response.length}/4000
              </small>
            </label>
          )}
          <div className="interview-turn-actions">
            <button
              className="primary-button"
              type="button"
              disabled={writtenResponseRequired && response.trim().length < 3}
              onClick={commitOrAdvance}
            >
              {nextActionLabel(session)} →
            </button>
            <button
              className="outline-button"
              type="button"
              disabled={session.mode === "mock"}
              title={
                session.mode === "mock"
                  ? "Hints stay locked in interview mode"
                  : "Every coach hint is recorded as assistance"
              }
              onClick={onRequestHint}
            >
              {session.mode === "mock" ? "Hints locked" : "Ask for coach hint"}
            </button>
          </div>
        </section>
      ) : (
        <section className="interview-complete-state" aria-live="polite">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Script complete</strong>
            <p>
              Finish to archive this transcript and reveal the authored review
              criteria.
            </p>
          </div>
        </section>
      )}

      <footer className="interview-evidence-strip">
        <span>
          <small>Runner</small>
          <strong>
            {lastRunner
              ? `${lastRunner.status}${
                  lastRunner.total
                    ? ` · ${lastRunner.passed ?? 0}/${lastRunner.total}`
                    : ""
                }`
              : session.format === "python-coding"
                ? "No run yet"
                : "Authored comparison"}
          </strong>
        </span>
        <span>
          <small>Assistance</small>
          <strong>
            {hintCount
              ? `${hintCount} logged hint${hintCount === 1 ? "" : "s"}`
              : "None"}
          </strong>
        </span>
        <button
          className="primary-button"
          type="button"
          disabled={!canFinish}
          onClick={onFinish}
        >
          {finishLabel}
        </button>
      </footer>
    </section>
  );
}
