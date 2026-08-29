"use client";

import { useMemo } from "react";
import { IOS_REACTIVATION_PHASES } from "../data/ios-curriculum";
import { itemDisplayId, type ItemId, type PracticeItem } from "../lib/items";
import type { AttemptRecord } from "../lib/product";
import type { LearningEvent } from "../lib/learning-state.mjs";
import {
  deriveIOSReactivationProgress,
  type IOSReactivationItemProgress,
} from "../lib/ios-curriculum.mjs";
import type { TypingProgressionWorkspace } from "../lib/typing-progression.mjs";

export type IOSReactivationTrackProps = {
  items: PracticeItem[];
  attempts: AttemptRecord[];
  learningEvents?: LearningEvent[];
  typingProgress?: TypingProgressionWorkspace;
  now?: string | Date | number;
  onOpenItem?: (itemId: ItemId) => void;
};

const STATUS_LABEL: Record<IOSReactivationItemProgress["status"], string> = {
  "not-started": "Not started",
  practiced: "Practiced",
  independent: "Independent",
  due: "Due for review",
  outdated: "Outdated revision",
  unavailable: "Unavailable",
};

function statusClass(status: IOSReactivationItemProgress["status"]) {
  return `ios-reactivation-status is-${status}`;
}

function moduleActionLabel(module: {
  independent: number;
  totalItems: number;
  due: number;
}) {
  if (!module.totalItems) return "No exercises";
  if (module.due) return `${module.due} due`;
  if (module.independent === module.totalItems) return "Revisit anytime";
  return "Continue module";
}

function itemLabel(progress: IOSReactivationItemProgress) {
  return STATUS_LABEL[progress.status];
}

export function IOSReactivationTrack({
  items,
  attempts,
  learningEvents = [],
  typingProgress,
  now,
  onOpenItem,
}: IOSReactivationTrackProps) {
  const progress = useMemo(
    () =>
      deriveIOSReactivationProgress(IOS_REACTIVATION_PHASES, {
        items,
        attempts,
        learningEvents,
        typingProgress,
        now,
      }),
    [attempts, items, learningEvents, now, typingProgress],
  );
  const itemsById = useMemo(
    () => new Map<string, PracticeItem>(items.map((item) => [item.itemId, item])),
    [items],
  );
  const nextItem = progress.next ? itemsById.get(progress.next.itemId) : null;
  const activePhaseId = progress.next?.phaseId ?? progress.phases[0]?.id;

  return (
    <section
      className="ios-reactivation-track"
      aria-labelledby="ios-reactivation-track-title"
      style={{
        display: "grid",
        gap: "1.25rem",
        padding: "1.35rem",
        border: "1px solid var(--border-soft)",
        borderRadius: "1.25rem",
        background: "linear-gradient(135deg, color-mix(in srgb, var(--panel) 94%, #7dd3fc), var(--panel))",
      }}
    >
      <header style={{ display: "grid", gap: "0.55rem" }}>
        <span className="eyebrow">Swift + iOS reactivation</span>
        <h2 id="ios-reactivation-track-title" style={{ margin: 0 }}>
          Rebuild the mental model before the interview clock starts.
        </h2>
        <p style={{ maxWidth: "68ch", margin: 0 }}>
          A finite sequence from Swift semantics to production-quality iOS
          judgment. Work the next item, then use the evidence below to decide
          what deserves another retrieval.
        </p>
        <div
          className="ios-reactivation-track-summary"
          aria-label="Swift and iOS reactivation evidence summary"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.55rem",
            alignItems: "center",
            marginTop: "0.25rem",
          }}
        >
          <span className="status-chip">{progress.independent} independent</span>
          <span className="status-chip">{progress.attempted} practiced</span>
          <span className="status-chip">{progress.due} due</span>
          <span className="status-chip">{progress.totalItems} exercises in path</span>
        </div>
        <small>
          This is a practice map, not a composite readiness score. Concept
          answers remain self-assessed; runnable Swift keeps its normal judge
          evidence.
        </small>
      </header>

      <div
        className="ios-reactivation-next"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.8rem",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.9rem 1rem",
          borderRadius: "0.85rem",
          background: "var(--panel-strong)",
        }}
      >
        <div>
          <span className="eyebrow">Next useful retrieval</span>
          <strong style={{ display: "block", marginTop: "0.18rem" }}>
            {nextItem?.title ?? (progress.next ? progress.next.itemId : "All available exercises have current evidence")}
          </strong>
          <small>
            {progress.next
              ? `${progress.next.phaseId.replaceAll("-", " ")} · ${progress.next.moduleId.replaceAll("-", " ")}`
              : "Choose a phase below to revisit any retained item."}
          </small>
        </div>
        {nextItem && onOpenItem ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => onOpenItem(nextItem.itemId)}
          >
            Open next exercise →
          </button>
        ) : null}
      </div>

      <div className="ios-reactivation-phases" style={{ display: "grid", gap: "0.8rem" }}>
        {progress.phases.map((phase) => {
          const phaseActive = phase.id === activePhaseId;
          return (
            <details key={phase.id} open={phaseActive}>
              <summary
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.7rem",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  <span className="eyebrow">Phase {String(phase.number).padStart(2, "0")}</span>
                  <strong style={{ display: "block" }}>{phase.title}</strong>
                  <small>{phase.subtitle}</small>
                </span>
                <span className="ios-reactivation-count" aria-label={`${phase.independent} of ${phase.totalItems} independent, ${phase.due} due`}>
                  {phase.independent}/{phase.totalItems} independent{phase.due ? ` · ${phase.due} due` : ""}
                </span>
              </summary>
              <div style={{ display: "grid", gap: "0.85rem", padding: "0.9rem 0 0.15rem" }}>
                <p style={{ margin: 0 }}>{phase.description}</p>
                <p style={{ margin: 0 }}><strong>Phase outcome:</strong> {phase.outcome}</p>
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {phase.modules.map((moduleProgress) => (
                    <article
                      key={moduleProgress.id}
                      className="ios-reactivation-module"
                      style={{
                        display: "grid",
                        gap: "0.6rem",
                        padding: "0.95rem",
                        border: "1px solid var(--border-soft)",
                        borderRadius: "0.9rem",
                        background: "var(--panel)",
                      }}
                    >
                      <header style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", justifyContent: "space-between" }}>
                        <div>
                          <span className="eyebrow">{moduleProgress.eyebrow}</span>
                          <h3 style={{ margin: "0.15rem 0" }}>{moduleProgress.title}</h3>
                          <p style={{ margin: 0 }}>{moduleProgress.summary}</p>
                        </div>
                        <span className="ios-reactivation-count">{moduleActionLabel(moduleProgress)}</span>
                      </header>
                      <div aria-label={`${moduleProgress.title} evidence`}>
                        <progress value={moduleProgress.independent} max={Math.max(1, moduleProgress.totalItems)} style={{ width: "100%" }}>
                          {moduleProgress.independent} of {moduleProgress.totalItems} independent
                        </progress>
                        <small>
                          {moduleProgress.independent} independent · {moduleProgress.attempted} practiced · {moduleProgress.due} due
                          {moduleProgress.outdated ? ` · ${moduleProgress.outdated} outdated` : ""}
                        </small>
                      </div>
                      <p style={{ margin: 0 }}><strong>Outcome:</strong> {moduleProgress.outcome}</p>
                      {moduleProgress.focus.length ? (
                        <ul style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", margin: 0, padding: 0, listStyle: "none" }} aria-label={`${moduleProgress.title} focus topics`}>
                          {moduleProgress.focus.map((focus) => <li key={focus} className="status-chip">{focus}</li>)}
                        </ul>
                      ) : null}
                      <ul
                        className="ios-reactivation-item-list"
                        aria-label={`${moduleProgress.title} exercises`}
                        style={{ display: "grid", gap: "0.3rem", margin: 0, padding: 0, listStyle: "none" }}
                      >
                        {moduleProgress.items.map((itemProgress) => {
                          const item = itemsById.get(itemProgress.itemId);
                          return (
                            <li key={itemProgress.itemId} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.55rem", justifyContent: "space-between" }}>
                              <span>
                                <small>{item ? itemDisplayId(item) : itemProgress.itemId}</small>
                                <strong style={{ display: "block" }}>{item?.title ?? "Catalog item unavailable"}</strong>
                              </span>
                              <span className={statusClass(itemProgress.status)}>{itemLabel(itemProgress)}</span>
                              {item && onOpenItem ? (
                                <button type="button" className="text-button" onClick={() => onOpenItem(item.itemId)}>
                                  Open
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export default IOSReactivationTrack;
