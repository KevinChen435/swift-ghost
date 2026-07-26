"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  aggregateWeakLines,
  repairLineExcerpt,
  summarizeAttemptTimeline,
  type WeakLine,
} from "../lib/analytics.mjs";
import { maskCode, type AttemptRecord } from "../lib/product";
import { itemDisplayId, type PracticeItem } from "../lib/items";

type Props = {
  attempts: AttemptRecord[];
  items: PracticeItem[];
  onOpenItem: (item: PracticeItem, stage?: number) => void;
};

type RepairTarget = { item: PracticeItem; weakLine: WeakLine };

function formatSeconds(milliseconds: number) {
  return `${Math.max(0, Math.round(milliseconds / 100) / 10)}s`;
}

export function LearningAnalytics({ attempts, items, onOpenItem }: Props) {
  const currentAttempts = useMemo(
    () =>
      attempts.filter((attempt) => {
        const item = items.find(
          (candidate) => candidate.itemId === attempt.itemId,
        );
        return item && item.contentRevision === attempt.itemRevision;
      }),
    [attempts, items],
  );
  const recent = currentAttempts.slice(-12).reverse();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [repairTarget, setRepairTarget] = useState<RepairTarget | null>(null);
  const selected =
    currentAttempts.find((attempt) => attempt.id === selectedId) ??
    recent[0] ??
    null;
  const weakLines = useMemo(
    () => aggregateWeakLines(currentAttempts, { limit: 8 }),
    [currentAttempts],
  );
  const summary = summarizeAttemptTimeline(selected?.timeline);
  const maxTimelineWpm = Math.max(
    1,
    ...(selected?.timeline ?? []).map((sample) => sample.wpm),
  );
  const selectedLineErrors = Object.entries(selected?.lineErrors ?? {})
    .map(([line, errorCount]) => ({ line: Number(line), errorCount }))
    .sort(
      (left, right) =>
        right.errorCount - left.errorCount || left.line - right.line,
    )
    .slice(0, 8);

  function startRepair(weakLine: WeakLine) {
    const item = items.find(
      (candidate) => candidate.itemId === weakLine.itemId,
    );
    if (item) setRepairTarget({ item, weakLine });
  }

  return (
    <section className="dashboard-card attempt-lab">
      <div className="section-head">
        <div>
          <small>Device-local attempt forensics</small>
          <h2>See where recall breaks down</h2>
        </div>
        <span>Detailed telemetry starts with v8</span>
      </div>
      <p className="attempt-lab-copy">
        Pacing and line-level misses stay in this browser. They diagnose typing
        and implementation friction—not whether you recognized the right
        algorithm.
      </p>

      <div className="attempt-lab-grid">
        <div className="attempt-picker" aria-label="Recent attempts">
          {recent.map((attempt) => (
            <button
              key={attempt.id}
              className={selected?.id === attempt.id ? "active" : ""}
              aria-pressed={selected?.id === attempt.id}
              onClick={() => setSelectedId(attempt.id)}
            >
              <span>
                <strong>{attempt.titleSnapshot}</strong>
                <small>
                  {attempt.language === "python" ? "Python" : "Swift"} · stage{" "}
                  {attempt.stage}
                </small>
              </span>
              <b>{attempt.wpm} WPM</b>
            </button>
          ))}
          {!recent.length && (
            <div className="empty-history">
              Complete a pass to unlock attempt details.
            </div>
          )}
        </div>

        <div className="attempt-detail">
          {selected ? (
            <>
              <div className="attempt-detail-head">
                <span>
                  <small>
                    {selected.outcome} · {selected.qualification}
                  </small>
                  <strong>{selected.titleSnapshot}</strong>
                </span>
                <div>
                  <b>{selected.accuracy}%</b>
                  <small>accuracy</small>
                </div>
              </div>
              {selected.timeline.length ? (
                <>
                  <div
                    className="pace-chart"
                    aria-label="Within-attempt WPM timeline"
                  >
                    {selected.timeline.map((sample, index) => (
                      <i
                        key={`${sample.atMs}-${index}`}
                        style={{
                          height: `${Math.max(6, (sample.wpm / maxTimelineWpm) * 100)}%`,
                        }}
                        title={`${sample.wpm} WPM at ${formatSeconds(sample.atMs)} · ${sample.progress}% complete`}
                      />
                    ))}
                  </div>
                  <div className="pace-summary">
                    <span>
                      <small>Peak</small>
                      <strong>{summary.peakWpm} WPM</strong>
                    </span>
                    <span>
                      <small>Average</small>
                      <strong>{summary.averageWpm} WPM</strong>
                    </span>
                    <span>
                      <small>Finish</small>
                      <strong>{summary.paceTrend}</strong>
                    </span>
                    <span>
                      <small>Trace</small>
                      <strong>{summary.sampleCount} points</strong>
                    </span>
                  </div>
                </>
              ) : (
                <div className="legacy-telemetry">
                  This pass predates detailed pacing capture. Its aggregate WPM,
                  accuracy, and key errors are still preserved.
                </div>
              )}
              <div className="attempt-lines">
                <small>Most-missed lines in this pass</small>
                {selectedLineErrors.map(({ line, errorCount }) => {
                  const item = items.find(
                    (candidate) => candidate.itemId === selected.itemId,
                  );
                  return (
                    <button
                      key={line}
                      disabled={!item}
                      onClick={() =>
                        item &&
                        startRepair({
                          key: `${selected.itemId}:${line}`,
                          itemId: selected.itemId,
                          title: selected.titleSnapshot,
                          language: selected.language,
                          line,
                          errorCount,
                          attemptCount: 1,
                          lastSeenAtMs: Date.parse(selected.completedAt),
                        })
                      }
                    >
                      <span>Line {line}</span>
                      <b>
                        {errorCount} miss{errorCount === 1 ? "" : "es"}
                      </b>
                    </button>
                  );
                })}
                {!selectedLineErrors.length && (
                  <span className="clean-lines">
                    No line-level misses recorded.
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="empty-history">No attempt selected.</div>
          )}
        </div>
      </div>

      <div className="weak-lines">
        <div className="section-head compact">
          <div>
            <small>Repeated implementation friction</small>
            <h3>Weak-line repair queue</h3>
          </div>
          <span>{weakLines.length} targets</span>
        </div>
        <div className="weak-line-grid">
          {weakLines.map((weakLine) => {
            const item = items.find(
              (candidate) => candidate.itemId === weakLine.itemId,
            );
            const excerpt = item
              ? repairLineExcerpt(item.code, weakLine.line, 0)
              : null;
            return (
              <article key={weakLine.key}>
                <span className="weak-line-meta">
                  {item ? itemDisplayId(item) : weakLine.language} · line{" "}
                  {weakLine.line}
                </span>
                <strong>{weakLine.title}</strong>
                <code>
                  {excerpt?.lineText.trim() || "Archived source line"}
                </code>
                <small>
                  {weakLine.errorCount} misses across {weakLine.attemptCount}{" "}
                  pass{weakLine.attemptCount === 1 ? "" : "es"}
                </small>
                <button disabled={!item} onClick={() => startRepair(weakLine)}>
                  Repair this line →
                </button>
              </article>
            );
          })}
          {!weakLines.length && (
            <div className="empty-history">
              Line-level misses from new attempts will appear here.
            </div>
          )}
        </div>
      </div>

      {repairTarget && (
        <LineRepairDialog
          target={repairTarget}
          onClose={() => setRepairTarget(null)}
          onFullRecall={() => {
            setRepairTarget(null);
            onOpenItem(repairTarget.item, 5);
          }}
        />
      )}
    </section>
  );
}

function LineRepairDialog({
  target,
  onClose,
  onFullRecall,
}: {
  target: RepairTarget;
  onClose: () => void;
  onFullRecall: () => void;
}) {
  const excerpt = repairLineExcerpt(target.item.code, target.weakLine.line, 1);
  const targetLine = excerpt?.lineText ?? "";
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stages = [1, 2, 5] as const;
  const ghost = maskCode(
    targetLine,
    stages[step],
    false,
    undefined,
    target.item.language,
  );

  useEffect(() => {
    textareaRef.current?.focus();
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, step]);

  function handleChange(next: string) {
    if (!targetLine.startsWith(next)) {
      setError(
        `Expected ${JSON.stringify(targetLine[value.length] ?? "end of line")}`,
      );
      return;
    }
    setError("");
    setValue(next);
    if (next !== targetLine) return;
    if (step < stages.length - 1) {
      setStep((current) => current + 1);
      setValue("");
      return;
    }
    setComplete(true);
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="line-repair-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-title"
      >
        <button className="dialog-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <span className="eyebrow">
          Line repair · {target.item.language === "python" ? "Python" : "Swift"}
        </span>
        <h2 id="repair-title">
          {target.item.title} · line {excerpt?.lineNumber}
        </h2>
        <p>
          Rebuild the exact weak line three times: visible, faded, then from
          memory. This drill does not advance mastery by itself.
        </p>
        <div className="repair-context">
          {excerpt?.context.map((line) => (
            <div
              className={line.isTarget ? "target" : ""}
              key={line.lineNumber}
            >
              <span>{line.lineNumber}</span>
              <code>{line.isTarget ? "← repair target" : line.text}</code>
            </div>
          ))}
        </div>
        {!complete ? (
          <>
            <div className="repair-progress">
              {stages.map((stage, index) => (
                <i className={index <= step ? "active" : ""} key={stage} />
              ))}
              <span>
                Rep {step + 1}/3 ·{" "}
                {step === 0 ? "visible" : step === 1 ? "faded" : "memory"}
              </span>
            </div>
            <div className="repair-editor">
              <pre aria-hidden="true">{ghost}</pre>
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(event) => handleChange(event.target.value)}
                spellCheck={false}
                aria-label={`Repair line ${excerpt?.lineNumber} from ${target.item.title}`}
              />
            </div>
            <small className="repair-error" aria-live="polite">
              {error || "Type the complete line, including indentation."}
            </small>
          </>
        ) : (
          <div className="repair-complete">
            <strong>Line repaired.</strong>
            <p>
              Now retrieve the whole solution to prove the line transfers back
              into context.
            </p>
            <button className="primary-button" onClick={onFullRecall}>
              Recall the full solution →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
