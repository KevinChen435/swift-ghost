"use client";

import { useEffect, useMemo, useRef } from "react";
import { buildSessionRecap, type SessionReplayMode } from "../lib/session-recap.mjs";
import { formatDuration, STAGES, type AppState, type SessionHistoryRecord } from "../lib/product";
import type { PracticeItem } from "../lib/items";

function practiceLabel(kind: string | undefined, stage: number) {
  if (kind === "solving") return "Independent solve";
  if (kind === "concept") return "Concept recall";
  return `Stage ${stage} · ${STAGES[stage - 1]?.short ?? "Recall"}`;
}

export function SessionRecap({
  record,
  state,
  items,
  onBack,
  onReplay,
  onOpenItem,
}: {
  record: SessionHistoryRecord;
  state: AppState;
  items: PracticeItem[];
  onBack: () => void;
  onReplay: (mode: SessionReplayMode) => void;
  onOpenItem: (item: PracticeItem, stage: number, practiceKind?: "typing" | "solving" | "concept") => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const recap = useMemo(
    () => buildSessionRecap(record, state.attempts, items, state.typingProgress),
    [record, state.attempts, state.typingProgress, items],
  );
  useEffect(() => {
    titleRef.current?.focus();
  }, [record.id]);
  return (
    <section className="session-recap" aria-labelledby="session-recap-title">
      <header className="session-recap-hero">
        <button className="text-button" type="button" onClick={onBack}>
          ← All sessions
        </button>
        <span className="eyebrow">Practice session recap</span>
        <h2 ref={titleRef} id="session-recap-title" tabIndex={-1}>{record.name}</h2>
        <p>
          {record.completed}/{record.total} completed · {formatDuration(recap.elapsedMs)} elapsed · {record.outcome ?? (record.completed === record.total ? "completed" : "ended")}
        </p>
        <small>
          Evidence is matched by saved attempt ID, item revision, and session—not by title or timestamp.
        </small>
      </header>

      {recap.hasEntryDetail ? (
        <>
          <div className="session-recap-stats" aria-label="Session evidence summary">
            <article><strong>{recap.strongCount}</strong><span>strong outcomes</span></article>
            <article><strong>{recap.weakCount}</strong><span>retry candidates</span></article>
            <article><strong>{recap.typing.count ? `${recap.typing.averageWpm} WPM` : "—"}</strong><span>{recap.typing.count ? `${recap.typing.averageAccuracy}% typing accuracy` : "no typing passes"}</span></article>
            <article><strong>{recap.solving.accepted}/{recap.solving.count}</strong><span>accepted solves</span></article>
            <article><strong>{recap.concept.strong}/{recap.concept.count}</strong><span>strong concept recalls</span></article>
          </div>

          <div className="session-recap-actions">
            <button
              className="primary-button"
              type="button"
              disabled={!recap.weakAvailableCount}
              onClick={() => onReplay("weak")}
            >
              Retry weak items · {recap.weakAvailableCount}
            </button>
            <button
              className="outline-button"
              type="button"
              disabled={!recap.availableCount}
              onClick={() => onReplay("all")}
            >
              Replay available set · {recap.availableCount}
            </button>
          </div>

          <ol className="session-recap-list">
            {recap.entries.map((entry) => (
              <li className={entry.needsRetry ? "needs-retry" : "is-strong"} key={`${entry.itemId}-${entry.index}`}>
                <span className="session-recap-index" aria-hidden="true">
                  {entry.status === "completed" ? (entry.strong ? "✓" : "!") : entry.status === "skipped" ? "–" : entry.index + 1}
                </span>
                <div>
                  <small>{practiceLabel(entry.practiceKind, entry.stage)} · {entry.status}</small>
                  <strong>{entry.title}</strong>
                  <span>{entry.evidence}</span>
                  {entry.superseded ? <em>Saved revision {entry.itemRevision}; current revision {entry.item?.contentRevision}. Replay uses the current content.</em> : null}
                  {!entry.available ? <em>This item is no longer available, so it is preserved in the recap but excluded from replay.</em> : null}
                </div>
                {entry.item ? (
                  <button
                    className="outline-button"
                    type="button"
                    onClick={() => onOpenItem(entry.item as PracticeItem, entry.stage, entry.practiceKind ?? "typing")}
                  >
                    Practice current version
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="session-recap-legacy" role="status">
          <strong>Item-level detail was not saved for this older session.</strong>
          <p>
            The aggregate {record.completed}/{record.total} result remains intact. Swift Ghost will not guess the original queue from timestamps or problem titles, so replay is unavailable for this record.
          </p>
        </div>
      )}
    </section>
  );
}
