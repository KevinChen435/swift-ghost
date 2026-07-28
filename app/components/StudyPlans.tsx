"use client";

import { FormEvent, useMemo, useState } from "react";
import type { PracticeItem, ItemId } from "../lib/items";
import type {
  AttemptRecord,
  SessionHistoryRecord,
  TrainingSession,
} from "../lib/product";
import type { LearningEvent } from "../lib/learning-state.mjs";
import type {
  InterviewStudioFormat,
  InterviewStudioHistoryRecord,
  InterviewStudioMode,
} from "../lib/interview-studio.mjs";
import type { SessionQueueEntry } from "../lib/sessions.mjs";
import {
  STUDY_PLAN_TEMPLATES,
  buildNextFocusBlock,
  deriveStudyPlanProgress,
  type StudyCollection,
  type StudyModule,
  type StudyPlan,
  type StudyPlanTemplate,
  type StudyWorkspace,
} from "../lib/study-plans.mjs";

const PACE_OPTIONS = [15, 30, 45] as const;
const MAX_COLLECTION_NAME = 60;
const MAX_COLLECTION_DESCRIPTION = 240;
const MAX_SEARCH_LENGTH = 80;
const MAX_COLLECTION_ITEMS = 80;

export type StudyPlanPace = (typeof PACE_OPTIONS)[number];
export type StudyPlanSyncStatus =
  | "local"
  | "checking"
  | "syncing"
  | "synced"
  | "offline"
  | "error";

export type StudyCollectionInput = {
  title: string;
  description: string;
  itemIds: ItemId[];
};

export type StudyPlanInput = {
  collectionId: string;
  title: string;
  paceMinutes: StudyPlanPace;
};

export type StudyPlansProps = {
  workspace: StudyWorkspace;
  items: PracticeItem[];
  attempts: AttemptRecord[];
  learningEvents?: LearningEvent[];
  interviewStudioHistory: InterviewStudioHistoryRecord[];
  sessionHistory: SessionHistoryRecord[];
  activeSession: TrainingSession | null;
  syncStatus: StudyPlanSyncStatus;
  onInstantiateTemplate: (
    templateId: string,
    paceMinutes: StudyPlanPace,
  ) => void;
  onCreateCollection: (input: StudyCollectionInput) => void;
  onUpdateCollection: (
    collectionId: string,
    changes: Partial<StudyCollectionInput>,
  ) => void;
  onDeleteCollection: (collectionId: string) => void;
  onCreatePlan: (input: StudyPlanInput) => void;
  onUpdatePlan: (
    planId: string,
    changes: { title?: string; paceMinutes?: StudyPlanPace },
  ) => void;
  onDeletePlan: (planId: string) => void;
  onActivatePlan: (planId: string) => void;
  onPausePlan: (planId: string) => void;
  onStartFocusBlock: (
    planId: string,
    entries: SessionQueueEntry[],
    budgetMinutes: StudyPlanPace,
  ) => void;
  onResumeActiveSession: () => void;
  onStartCapstone: (
    planId: string,
    format: InterviewStudioFormat,
    mode: InterviewStudioMode,
  ) => void;
};

type PlanView = {
  id: string;
  title: string;
  description: string;
  status: StudyPlan["status"];
  paceMinutes: StudyPlanPace;
  outcome: string;
  modules: StudyModule[];
  capstone?: StudyPlan["capstone"];
};

type CollectionView = {
  id: string;
  title: string;
  description: string;
  itemIds: ItemId[];
  source: StudyCollection["source"];
};

type ProgressView = {
  completed: number;
  total: number;
  independent: number;
  assisted: number;
  due: number;
  outdated: number;
  retained: number;
  currentModule: string;
  currentOutcome: string;
  whyNext: string;
  capstoneReady: boolean;
};

type BlockView = {
  name: string;
  entries: SessionQueueEntry[];
  estimatedMinutes: number;
  deferredDueCount: number;
  rationale: string;
};

function planView(value: StudyPlan): PlanView {
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    status: value.status,
    paceMinutes: value.paceMinutes,
    outcome: value.outcome,
    modules: value.collectionSnapshot.modules,
    capstone: value.capstone,
  };
}

function collectionView(value: StudyCollection): CollectionView {
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    itemIds: value.itemIds,
    source: value.source,
  };
}

function workspaceLists(workspace: StudyWorkspace) {
  return {
    plans: workspace.plans,
    collections: workspace.collections,
    activePlanId: workspace.activePlanId ?? "",
  };
}

function progressView(
  value: ReturnType<typeof deriveStudyPlanProgress>,
): ProgressView {
  return {
    completed: value.completedItems,
    total: value.totalItems,
    independent: value.evidence.independent,
    assisted: value.evidence.assisted,
    due: value.evidence.due,
    outdated: value.evidence.outdated,
    retained: value.evidence.retained,
    currentModule: value.currentModule.title,
    currentOutcome: value.currentModule.outcome,
    whyNext: value.whyNext,
    capstoneReady: value.capstoneReady,
  };
}

function blockView(
  value: ReturnType<typeof buildNextFocusBlock>,
): BlockView {
  return {
    name: "Next focus block",
    entries: value.entries,
    estimatedMinutes: value.estimatedMinutes,
    deferredDueCount: value.deferredDueCount,
    rationale: value.rationale,
  };
}

function templateView(value: StudyPlanTemplate | undefined, index: number) {
  const defaults = [
    {
      title: "Back to Interview Shape",
      description: "Rebuild Python fluency, pattern transfer, and interview communication while keeping iOS active.",
      outcome: "A balanced return to interview readiness",
    },
    {
      title: "Python Re-entry: Type → Recall → Solve",
      description: "Fade a known answer from visible code to blank reconstruction and an independent verified solve.",
      outcome: "Reliable Python implementation from a blank editor",
    },
    {
      title: "Swift & iOS Reactivation",
      description: "Refresh language semantics, ownership, concurrency, architecture, testing, and accessibility.",
      outcome: "Clear self-assessed iOS technical explanations",
    },
    {
      title: "Interview Simulation",
      description: "Move from coached communication to timed Python and Swift/iOS interview rehearsals.",
      outcome: "Repeatable interview execution under time pressure",
    },
  ];
  const fallback = defaults[index] ?? defaults[0];
  if (value)
    return {
      id: value.id,
      title: value.title,
      description: value.description,
      outcome: value.outcome,
      estimatedBlocks: value.estimatedBlocks,
      paceMinutes: value.defaultPace,
      recommended: value.recommended === true,
      lanes: [...value.lanes],
    };
  return {
    id: `template-${index + 1}`,
    title: fallback.title,
    description: fallback.description,
    outcome: fallback.outcome,
    estimatedBlocks: 8,
    paceMinutes: 30 as StudyPlanPace,
    recommended: index === 0,
    lanes: [] as string[],
  };
}

function laneForItem(item: PracticeItem) {
  if (item.track === "ios") return "ios";
  return item.language === "python" ? "python" : "swift";
}

function laneLabel(value: string) {
  if (value === "ios") return "iOS concepts";
  if (value === "python") return "Python";
  if (value === "swift") return "Swift algorithms";
  if (value === "simulation") return "Interview simulation";
  if (value === "review") return "Delayed review";
  return value;
}

function taskLabel(entry: SessionQueueEntry, item?: PracticeItem) {
  if (entry.practiceKind === "solving") return "Independent solve";
  if (entry.practiceKind === "concept") return "Self-assessed iOS concept";
  if (entry.stage === 5) return "Blank-editor recall";
  if (item?.pattern === "Python Fluency") return "Python syntax re-entry";
  return `Stage ${entry.stage} guided recall`;
}

function syncCopy(status: StudyPlanSyncStatus) {
  switch (status) {
    case "synced":
      return { label: "Cloud synced", detail: "Plan structure is available on signed-in devices. Practice content and transcripts stay private." };
    case "syncing":
      return { label: "Syncing plan structure", detail: "This device remains usable while the private plan metadata catches up." };
    case "checking":
      return { label: "Checking sync", detail: "Your device-local copy is ready even if the hosted service is not." };
    case "offline":
    case "error":
      return { label: "Saved on this device", detail: "Cloud sync is unavailable. Nothing is lost here, and private code or transcripts are not uploaded." };
    default:
      return { label: "Device-local plans", detail: "This edition stores plans in this browser. It does not upload code, answers, or interview transcripts." };
  }
}

export function StudyPlans({
  workspace,
  items,
  attempts,
  learningEvents = [],
  interviewStudioHistory,
  sessionHistory,
  activeSession,
  syncStatus,
  onInstantiateTemplate,
  onCreateCollection,
  onUpdateCollection,
  onDeleteCollection,
  onCreatePlan,
  onUpdatePlan,
  onDeletePlan,
  onActivatePlan,
  onPausePlan,
  onStartFocusBlock,
  onResumeActiveSession,
  onStartCapstone,
}: StudyPlansProps) {
  const lists = workspaceLists(workspace);
  const planViews = lists.plans.map(planView);
  const collectionViews = lists.collections.map(collectionView);
  const activePlan =
    planViews.find((plan) => plan.id === lists.activePlanId) ??
    planViews.find((plan) => plan.status === "active") ??
    null;
  const activePlanSource = activePlan
    ? lists.plans.find((plan) => plan.id === activePlan.id) ?? null
    : null;
  const [budgetOverrides, setBudgetOverrides] = useState<
    Record<string, StudyPlanPace>
  >({});
  const activeBudget = activePlan
    ? budgetOverrides[activePlan.id] ?? activePlan.paceMinutes
    : 30;
  const [templatePaces, setTemplatePaces] = useState<Record<string, StudyPlanPace>>({});
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [deleteCollectionId, setDeleteCollectionId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [collectionLane, setCollectionLane] = useState<"all" | "python" | "swift" | "ios">("all");
  const [selectedItemIds, setSelectedItemIds] = useState<ItemId[]>([]);

  const evidenceContext = {
    items,
    attempts,
    learningEvents,
    interviewStudioHistory,
    sessionHistory,
    now: new Date().toISOString(),
  };
  const progress = activePlanSource
    ? progressView(
        deriveStudyPlanProgress(
          activePlanSource,
          workspace,
          evidenceContext,
        ),
      )
    : null;
  const nextBlock = activePlanSource
    ? blockView(
        buildNextFocusBlock(activePlanSource, workspace, evidenceContext, {
          budgetMinutes: activeBudget,
        }),
      )
    : null;

  const filteredItems = useMemo(() => {
    const query = collectionSearch.trim().toLocaleLowerCase();
    return items
      .filter((item) => !item.archivedAt)
      .filter((item) => collectionLane === "all" || laneForItem(item) === collectionLane)
      .filter((item) => {
        if (!query) return true;
        return [item.title, item.pattern, item.difficulty, ...item.tags]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query);
      })
      .slice(0, 100);
  }, [collectionLane, collectionSearch, items]);

  const templateSources = STUDY_PLAN_TEMPLATES;
  const templates = Array.from({ length: 4 }, (_, index) =>
    templateView(templateSources[index], index),
  );
  const cloudCopy = syncCopy(syncStatus);

  function toggleSelected(itemId: ItemId) {
    setSelectedItemIds((current) => {
      if (current.includes(itemId)) return current.filter((id) => id !== itemId);
      if (current.length >= MAX_COLLECTION_ITEMS) return current;
      return [...current, itemId];
    });
  }

  function resetCollectionBuilder() {
    setCollectionName("");
    setCollectionDescription("");
    setCollectionSearch("");
    setCollectionLane("all");
    setSelectedItemIds([]);
    setEditingCollectionId(null);
  }

  function openCollectionEditor(collection: CollectionView) {
    setEditingCollectionId(collection.id);
    setCollectionName(collection.title.slice(0, MAX_COLLECTION_NAME));
    setCollectionDescription(
      collection.description.slice(0, MAX_COLLECTION_DESCRIPTION),
    );
    setSelectedItemIds(
      collection.itemIds
        .filter((itemId): itemId is ItemId =>
          items.some((item) => item.itemId === itemId),
        )
        .slice(0, MAX_COLLECTION_ITEMS),
    );
    setCollectionSearch("");
    setCollectionLane("all");
    setBuilderOpen(true);
  }

  function createOrUpdateCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = collectionName.trim();
    if (!title || !selectedItemIds.length) return;
    const input = {
      title,
      description: collectionDescription.trim(),
      itemIds: selectedItemIds.slice(0, MAX_COLLECTION_ITEMS),
    };
    if (editingCollectionId)
      onUpdateCollection(editingCollectionId, input);
    else onCreateCollection(input);
    resetCollectionBuilder();
    setBuilderOpen(false);
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="page-container study-plans"
      aria-labelledby="study-plans-title"
    >
      <header className="study-plans-heading">
        <div>
          <span className="eyebrow">Study Plans</span>
          <h1 id="study-plans-title">Know what to practice next—and what it proves.</h1>
          <p>
            Plans turn Python, Swift, iOS concepts, delayed review, and interview
            rehearsal into a reusable path. Assisted practice stays separate
            from independent evidence.
          </p>
        </div>
        <div className={`study-sync-status is-${syncStatus}`} role="status">
          <strong>{cloudCopy.label}</strong>
          <span>{cloudCopy.detail}</span>
        </div>
      </header>

      {activePlan && progress && nextBlock ? (
        <section className="study-active-hero" aria-labelledby="active-plan-title">
          <div className="study-active-copy">
            <span className="eyebrow">Your next focus block</span>
            <h2 id="active-plan-title">{activePlan.title}</h2>
            <p className="study-active-outcome">
              <strong>
                {progress.currentModule === "Next module"
                  ? nextBlock.name
                  : progress.currentModule}
              </strong>
              <span>
                {progress.currentOutcome ||
                  activePlan.outcome ||
                  activePlan.description}
              </span>
            </p>
            <dl className="study-next-answers">
              <div>
                <dt>Why this is next</dt>
                <dd>{progress.whyNext || nextBlock.rationale}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{nextBlock.estimatedMinutes || activeBudget} focused minutes</dd>
              </div>
              <div>
                <dt>Evidence target</dt>
                <dd>
                  {nextBlock.entries.some((entry) => entry.practiceKind === "solving")
                    ? "Independent, verified problem solving"
                    : nextBlock.entries.some((entry) => entry.practiceKind === "concept")
                      ? "Committed recall with an authored, self-assessed comparison"
                      : "Implementation recall; guided stages do not count as solving mastery"}
                </dd>
              </div>
            </dl>

            <fieldset className="study-pace-picker">
              <legend>Focus-block length</legend>
              {PACE_OPTIONS.map((minutes) => (
                <button
                  type="button"
                  key={minutes}
                  className={activeBudget === minutes ? "active" : ""}
                  aria-pressed={activeBudget === minutes}
                  onClick={() => {
                    setBudgetOverrides((current) => ({
                      ...current,
                      [activePlan.id]: minutes,
                    }));
                    onUpdatePlan(activePlan.id, { paceMinutes: minutes });
                  }}
                >
                  {minutes} min
                </button>
              ))}
            </fieldset>

            <div className="study-active-actions">
              {activeSession?.studyPlanId === activePlan.id ? (
                <button className="primary-button" type="button" onClick={onResumeActiveSession}>
                  Resume active focus block →
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  disabled={!nextBlock.entries.length}
                  onClick={() =>
                    onStartFocusBlock(activePlan.id, nextBlock.entries, activeBudget)
                  }
                >
                  Start next {activeBudget}-minute block →
                </button>
              )}
              <button className="outline-button" type="button" onClick={() => onPausePlan(activePlan.id)}>
                Pause plan
              </button>
            </div>
          </div>

          <aside className="study-active-evidence" aria-label="Current plan evidence">
            <div className="study-progress-summary">
              <span>
                <strong>{progress.completed}</strong>
                <small>of {progress.total || "—"} evidence requirements</small>
              </span>
              <progress value={progress.completed} max={Math.max(1, progress.total)}>
                {progress.completed} of {progress.total}
              </progress>
            </div>
            <dl className="study-evidence-counts">
              <div><dt>Independent</dt><dd>{progress.independent}</dd></div>
              <div><dt>Assisted</dt><dd>{progress.assisted}</dd></div>
              <div><dt>Review due</dt><dd>{progress.due}</dd></div>
              <div><dt>Retained</dt><dd>{progress.retained}</dd></div>
              <div><dt>Outdated revision</dt><dd>{progress.outdated}</dd></div>
            </dl>
            <p className="study-evidence-note">
              Guided typing builds fluency but does not become independent solving.
              iOS concept evidence is self-assessed after committing an answer.
            </p>
            <details className="study-evidence-key">
              <summary>How this evidence is counted</summary>
              <dl>
                <div>
                  <dt>Independent</dt>
                  <dd>
                    Current-revision work completed without material help;
                    Python solving also needs accepted verification.
                  </dd>
                </div>
                <div>
                  <dt>Assisted</dt>
                  <dd>
                    A hint, answer exposure, or guided ghost helped. It records
                    useful practice, not independent mastery.
                  </dd>
                </div>
                <div>
                  <dt>Review due</dt>
                  <dd>
                    Earlier evidence earned another retrieval now. Due does not
                    mean failed or lost.
                  </dd>
                </div>
                <div>
                  <dt>Outdated revision</dt>
                  <dd>
                    Historical work remains in Records but no longer proves the
                    current exercise or judge revision.
                  </dd>
                </div>
              </dl>
            </details>
          </aside>

          <div className="study-queue-preview">
            <header>
              <div>
                <span className="eyebrow">Queue preview</span>
                <h3>{nextBlock.entries.length} focused task{nextBlock.entries.length === 1 ? "" : "s"}</h3>
              </div>
              {nextBlock.deferredDueCount > 0 && (
                <span>{nextBlock.deferredDueCount} due review{nextBlock.deferredDueCount === 1 ? "" : "s"} deferred by this budget</span>
              )}
            </header>
            {nextBlock.entries.length ? (
              <ol>
                {nextBlock.entries.map((entry, index) => {
                  const item = items.find((candidate) => candidate.itemId === entry.itemId);
                  return (
                    <li key={`${entry.itemId}:${entry.practiceKind ?? "typing"}:${index}`}>
                      <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <small>{taskLabel(entry, item)}</small>
                        <strong>{item?.title ?? "Unavailable catalog item"}</strong>
                        <p>{entry.rationale ?? nextBlock.rationale}</p>
                      </div>
                      <b>{entry.estimatedMinutes ?? item?.estimatedMinutes ?? 5}m</b>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="study-empty-copy">
                No compatible task is available for this block. Review the plan or start its capstone when ready.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="study-plan-empty" aria-labelledby="study-plan-empty-title">
          <span className="eyebrow">No active plan</span>
          <h2 id="study-plan-empty-title">Choose a path, then practice one focused block at a time.</h2>
          <p>
            Start with the recommended interview re-entry plan, or build a fixed
            collection from exercises you already know you need.
          </p>
          <a className="primary-button" href="#explore-study-plans">Explore plans ↓</a>
        </section>
      )}

      <section className="study-template-section" id="explore-study-plans" aria-labelledby="study-template-title">
        <header className="section-head">
          <div>
            <small>Four reusable starting points</small>
            <h2 id="study-template-title">Explore plans</h2>
          </div>
          <span>Templates are copied into your workspace; later edits do not rewrite active evidence.</span>
        </header>
        <div className="study-template-grid">
          {templates.map((template) => {
            const pace = templatePaces[template.id] ?? template.paceMinutes;
            return (
              <article className={template.recommended ? "is-recommended" : ""} key={template.id}>
                <header>
                  <span className="eyebrow">{template.recommended ? "Recommended" : "Study plan"}</span>
                  <h3>{template.title}</h3>
                  <p>{template.description}</p>
                </header>
                <div className="study-template-outcome">
                  <small>Intended outcome</small>
                  <strong>{template.outcome}</strong>
                </div>
                {template.lanes.length > 0 && (
                  <ul className="study-lane-list" aria-label="Plan lanes">
                    {template.lanes.map((lane) => <li key={lane}>{laneLabel(lane)}</li>)}
                  </ul>
                )}
                <div className="study-template-meta">
                  <span>≈ {template.estimatedBlocks} focus blocks</span>
                  <label>
                    <span>Default pace</span>
                    <select
                      value={pace}
                      onChange={(event) =>
                        setTemplatePaces((current) => ({
                          ...current,
                          [template.id]: Number(event.target.value) as StudyPlanPace,
                        }))
                      }
                    >
                      {PACE_OPTIONS.map((minutes) => <option value={minutes} key={minutes}>{minutes} min</option>)}
                    </select>
                  </label>
                </div>
                <button className={template.recommended ? "primary-button" : "outline-button"} type="button" onClick={() => onInstantiateTemplate(template.id, pace)}>
                  Add this plan
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="study-current-plans" aria-labelledby="current-study-plans-title">
        <header className="section-head">
          <div>
            <small>Reusable paths and their current evidence</small>
            <h2 id="current-study-plans-title">Current plans</h2>
          </div>
          <span>{planViews.length} saved</span>
        </header>
        {planViews.length ? (
          <div className="study-plan-list">
            {planViews.map((plan) => {
              const source = lists.plans.find(
                (candidate) => candidate.id === plan.id,
              ) as StudyPlan;
              const itemProgress = progressView(
                deriveStudyPlanProgress(source, workspace, evidenceContext),
              );
              const expanded = expandedPlanId === plan.id;
              const deleting = deletePlanId === plan.id;
              return (
                <article className={`study-plan-card is-${plan.status}`} key={plan.id}>
                  <header>
                    <div>
                      <span className="eyebrow">{plan.status === "active" ? "Active plan" : plan.status}</span>
                      <h3>{plan.title}</h3>
                      <p>{plan.description}</p>
                    </div>
                    <span>{itemProgress.completed}/{itemProgress.total || "—"} requirements</span>
                  </header>
                  <dl className="study-plan-card-evidence">
                    <div><dt>Independent</dt><dd>{itemProgress.independent}</dd></div>
                    <div><dt>Assisted</dt><dd>{itemProgress.assisted}</dd></div>
                    <div><dt>Due</dt><dd>{itemProgress.due}</dd></div>
                    <div><dt>Outdated</dt><dd>{itemProgress.outdated}</dd></div>
                  </dl>
                  <div className="study-plan-card-actions">
                    {plan.status === "active" ? (
                      <button className="outline-button" type="button" onClick={() => onPausePlan(plan.id)}>Pause</button>
                    ) : (
                      <button className="primary-button" type="button" onClick={() => onActivatePlan(plan.id)}>Make active</button>
                    )}
                    <button className="text-button" type="button" aria-expanded={expanded} aria-controls={`plan-detail-${plan.id}`} onClick={() => setExpandedPlanId(expanded ? null : plan.id)}>
                      {expanded ? "Hide details" : "View plan"}
                    </button>
                    {!deleting ? (
                      <button className="text-button danger" type="button" onClick={() => setDeletePlanId(plan.id)}>Delete</button>
                    ) : (
                      <span className="study-inline-confirm" role="group" aria-label={`Delete ${plan.title}?`}>
                        <span>Delete this saved plan? Evidence remains in Records.</span>
                        <button type="button" className="danger-button" onClick={() => { onDeletePlan(plan.id); setDeletePlanId(null); }}>Confirm</button>
                        <button type="button" className="text-button" onClick={() => setDeletePlanId(null)}>Cancel</button>
                      </span>
                    )}
                  </div>
                  {expanded && (
                    <div className="study-plan-detail" id={`plan-detail-${plan.id}`}>
                      <div>
                        <small>Outcome</small>
                        <p>{plan.outcome || "Build current-revision evidence across this plan."}</p>
                      </div>
                      <label>
                        <span>Focus-block pace</span>
                        <select value={plan.paceMinutes} onChange={(event) => onUpdatePlan(plan.id, { paceMinutes: Number(event.target.value) as StudyPlanPace })}>
                          {PACE_OPTIONS.map((minutes) => <option value={minutes} key={minutes}>{minutes} min</option>)}
                        </select>
                      </label>
                      {plan.modules.length > 0 && (
                        <ol className="study-module-list">
                          {plan.modules.map((module, index) => (
                            <li key={module.id || String(index)}>
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <div>
                                <strong>{module.title || `Module ${index + 1}`}</strong>
                                <p>{module.outcome}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                      <div className="study-capstone-actions">
                        <span>
                          <strong>Interview capstone</strong>
                          <small>{itemProgress.capstoneReady ? "Prerequisite evidence is ready." : "You can practice now; it will not claim readiness automatically."}</small>
                        </span>
                        {plan.capstone ? (
                          <button
                            type="button"
                            className="outline-button"
                            onClick={() =>
                              onStartCapstone(
                                plan.id,
                                plan.capstone!.format,
                                plan.capstone!.mode,
                              )
                            }
                          >
                            Start {plan.capstone.format === "python-coding" ? "Python" : "iOS"} {plan.capstone.mode}
                            {plan.capstone.selfAssessed ? " · self-assessed" : ""}
                          </button>
                        ) : (
                          <>
                            <button type="button" className="outline-button" onClick={() => onStartCapstone(plan.id, "python-coding", "coach")}>Python coach · assisted</button>
                            <button type="button" className="outline-button" onClick={() => onStartCapstone(plan.id, "ios-technical", "coach")}>iOS coach · self-assessed</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="study-empty-copy">No plans saved yet. Templates above are reusable and can be paused without penalty.</p>
        )}
      </section>

      <section className="study-collections" aria-labelledby="study-collections-title">
        <header className="section-head">
          <div>
            <small>Fixed, named exercise sets</small>
            <h2 id="study-collections-title">My collections</h2>
          </div>
          <button className="primary-button" type="button" aria-expanded={builderOpen} aria-controls="study-collection-builder" onClick={() => {
            if (builderOpen) {
              resetCollectionBuilder();
              setBuilderOpen(false);
            } else {
              resetCollectionBuilder();
              setBuilderOpen(true);
            }
          }}>
            {builderOpen ? "Close builder" : "New collection"}
          </button>
        </header>

        {builderOpen && (
          <form className="study-collection-builder" id="study-collection-builder" onSubmit={createOrUpdateCollection}>
            <div className="study-builder-copy">
              <span className="eyebrow">{editingCollectionId ? "Edit collection" : "Collection builder"}</span>
              <h3>{editingCollectionId ? "Keep this fixed set useful." : "Name a set you want to return to."}</h3>
              <p>
                This creates a fixed list from the selected catalog items. It
                does not copy answer code or silently add future search results.
              </p>
              <label>
                <span>Collection name</span>
                <input required maxLength={MAX_COLLECTION_NAME} value={collectionName} onChange={(event) => setCollectionName(event.target.value.slice(0, MAX_COLLECTION_NAME))} placeholder="Arrays I want to reconstruct" />
                <small>{collectionName.length}/{MAX_COLLECTION_NAME}</small>
              </label>
              <label>
                <span>Description</span>
                <textarea rows={4} maxLength={MAX_COLLECTION_DESCRIPTION} value={collectionDescription} onChange={(event) => setCollectionDescription(event.target.value.slice(0, MAX_COLLECTION_DESCRIPTION))} placeholder="Why this group matters and when I want to use it." />
                <small>{collectionDescription.length}/{MAX_COLLECTION_DESCRIPTION}</small>
              </label>
              <button className="primary-button" type="submit" disabled={!collectionName.trim() || !selectedItemIds.length}>
                {editingCollectionId ? "Save collection" : "Create fixed collection"} · {selectedItemIds.length} selected
              </button>
            </div>
            <div className="study-builder-catalog">
              <div className="study-builder-filters">
                <label>
                  <span>Search catalog</span>
                  <input type="search" value={collectionSearch} maxLength={MAX_SEARCH_LENGTH} onChange={(event) => setCollectionSearch(event.target.value.slice(0, MAX_SEARCH_LENGTH))} placeholder="Title, pattern, tag, or difficulty" />
                </label>
                <label>
                  <span>Lane</span>
                  <select value={collectionLane} onChange={(event) => setCollectionLane(event.target.value as typeof collectionLane)}>
                    <option value="all">All lanes</option>
                    <option value="python">Python</option>
                    <option value="swift">Swift algorithms</option>
                    <option value="ios">iOS concepts</option>
                  </select>
                </label>
              </div>
              <p className="study-selection-summary" aria-live="polite">
                {selectedItemIds.length}/{MAX_COLLECTION_ITEMS} selected · {filteredItems.length} shown
              </p>
              <fieldset className="study-item-selector">
                <legend>Choose exercises for this fixed collection</legend>
                {filteredItems.length ? filteredItems.map((item) => {
                  const checked = selectedItemIds.includes(item.itemId);
                  const disabled = !checked && selectedItemIds.length >= MAX_COLLECTION_ITEMS;
                  return (
                    <label key={item.itemId} className={checked ? "is-selected" : ""}>
                      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleSelected(item.itemId)} />
                      <span>
                        <strong>{item.title}</strong>
                        <small>{laneLabel(laneForItem(item))} · {item.pattern} · {item.difficulty}</small>
                      </span>
                      <em>{item.estimatedMinutes}m</em>
                    </label>
                  );
                }) : <p>No exercises match these filters.</p>}
              </fieldset>
            </div>
          </form>
        )}

        {collectionViews.length ? (
          <div className="study-collection-grid">
            {collectionViews.map((collection) => {
              const deleting = deleteCollectionId === collection.id;
              const totalMinutes = collection.itemIds.reduce((sum, itemId) => sum + (items.find((item) => item.itemId === itemId)?.estimatedMinutes ?? 0), 0);
              return (
                <article key={collection.id}>
                  <header>
                    <span className="eyebrow">{collection.source === "builtin" ? "Built-in" : "Your collection"}</span>
                    <h3>{collection.title}</h3>
                    <p>{collection.description || "A fixed set of exercises saved for deliberate return."}</p>
                  </header>
                  <div className="study-collection-meta">
                    <span>{collection.itemIds.length} exercises</span>
                    <span>≈ {totalMinutes || collection.itemIds.length * 5} minutes once through</span>
                  </div>
                  <ul className="study-collection-preview" aria-label={`Exercises in ${collection.title}`}>
                    {collection.itemIds.slice(0, 4).map((itemId) => <li key={itemId}>{items.find((item) => item.itemId === itemId)?.title ?? "Unavailable catalog item"}</li>)}
                    {collection.itemIds.length > 4 && <li>+{collection.itemIds.length - 4} more</li>}
                  </ul>
                  <div className="study-collection-actions">
                    <button className="primary-button" type="button" onClick={() => onCreatePlan({ collectionId: collection.id, title: collection.title, paceMinutes: 30 })}>
                      Turn into a plan
                    </button>
                    <button className="text-button" type="button" onClick={() => openCollectionEditor(collection)}>
                      Edit collection
                    </button>
                    {!deleting ? (
                      <button className="text-button danger" type="button" onClick={() => setDeleteCollectionId(collection.id)}>Delete</button>
                    ) : (
                      <span className="study-inline-confirm" role="group" aria-label={`Delete ${collection.title}?`}>
                        <span>Delete collection? Plans already created from it keep their snapshot.</span>
                        <button className="danger-button" type="button" onClick={() => { onDeleteCollection(collection.id); setDeleteCollectionId(null); }}>Confirm</button>
                        <button className="text-button" type="button" onClick={() => setDeleteCollectionId(null)}>Cancel</button>
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="study-empty-copy">No personal collections yet. Create a fixed set when a group of exercises deserves repeated attention.</p>
        )}
      </section>
    </main>
  );
}
