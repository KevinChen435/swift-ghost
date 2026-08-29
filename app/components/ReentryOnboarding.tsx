import { useState } from "react";
import {
  DEFAULT_ONBOARDING_STATE,
  ONBOARDING_DAILY_PACES,
  ONBOARDING_FOCUSES,
  normalizeOnboardingState,
  type OnboardingDailyMinutes,
  type OnboardingFocus,
  type OnboardingState,
} from "../lib/onboarding.mjs";

const FOCUS_COPY: Record<
  OnboardingFocus,
  { label: string; title: string; copy: string; icon: string }
> = {
  python: {
    label: "Python interview",
    title: "Rebuild coding fluency",
    copy: "Syntax reps, patterns, and clean interview reasoning.",
    icon: "Py",
  },
  ios: {
    label: "Swift + iOS",
    title: "Reactivate your native toolkit",
    copy: "Swift recall, iOS boundaries, and server-judged solves.",
    icon: "S",
  },
  both: {
    label: "Both tracks",
    title: "Keep both muscles warm",
    copy: "A small Python rep plus a Swift/iOS maintenance pass.",
    icon: "↗",
  },
};

const PACE_COPY: Record<OnboardingDailyMinutes, string> = {
  15: "A focused reset",
  30: "A steady practice block",
  45: "A deeper interview block",
};

export function ReentryOnboarding({
  initial,
  onStart,
  onSkip,
}: {
  initial?: Partial<OnboardingState> | null;
  onStart: (next: OnboardingState) => void;
  onSkip: () => void;
}) {
  const [selection, setSelection] = useState<OnboardingState>(() =>
    normalizeOnboardingState(initial ?? DEFAULT_ONBOARDING_STATE),
  );

  function chooseFocus(focus: OnboardingFocus) {
    setSelection((current) => ({ ...current, focus }));
  }

  function choosePace(dailyMinutes: OnboardingDailyMinutes) {
    setSelection((current) => ({ ...current, dailyMinutes }));
  }

  return (
    <section className="reentry-onboarding" aria-labelledby="reentry-title">
      <div className="reentry-onboarding-heading">
        <div>
          <span className="eyebrow">Start here · re-entry setup</span>
          <h2 id="reentry-title">Choose the first reps that feel useful.</h2>
          <p>
            You do not need to remember everything before you begin. Pick a
            lane and a realistic pace; Swift Ghost will open a short starter
            session and keep the rest of the dashboard out of your way.
          </p>
        </div>
        <span className="reentry-onboarding-step" aria-label="Setup step 1 of 1">
          01 <i>/</i> 01
        </span>
      </div>

      <div className="reentry-onboarding-grid">
        <fieldset>
          <legend>What are you warming up?</legend>
          <div className="reentry-choice-grid" role="radiogroup" aria-label="Practice focus">
            {ONBOARDING_FOCUSES.map((focus) => {
              const copy = FOCUS_COPY[focus];
              const selected = selection.focus === focus;
              return (
                <button
                  key={focus}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`reentry-choice ${selected ? "is-selected" : ""}`}
                  onClick={() => chooseFocus(focus)}
                >
                  <span className="reentry-choice-icon" aria-hidden="true">
                    {copy.icon}
                  </span>
                  <span>
                    <strong>{copy.label}</strong>
                    <small>{copy.copy}</small>
                  </span>
                  <i aria-hidden="true">{selected ? "✓" : ""}</i>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend>How much time do you have today?</legend>
          <div className="reentry-pace-grid" role="radiogroup" aria-label="Daily practice pace">
            {ONBOARDING_DAILY_PACES.map((dailyMinutes) => {
              const selected = selection.dailyMinutes === dailyMinutes;
              return (
                <button
                  key={dailyMinutes}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`reentry-pace ${selected ? "is-selected" : ""}`}
                  onClick={() => choosePace(dailyMinutes)}
                >
                  <strong>{dailyMinutes} min</strong>
                  <small>{PACE_COPY[dailyMinutes]}</small>
                </button>
              );
            })}
          </div>
          <p className="reentry-onboarding-note">
            This sets the first session length, not a permanent commitment.
          </p>
        </fieldset>
      </div>

      <div className="reentry-onboarding-actions">
        <button type="button" className="quiet-button" onClick={onSkip}>
          I’ll explore first
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => onStart({ ...selection, status: "started" })}
        >
          Start my {selection.dailyMinutes}-minute session <span>→</span>
        </button>
      </div>
    </section>
  );
}

