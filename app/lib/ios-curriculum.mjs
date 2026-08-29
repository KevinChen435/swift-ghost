import { supportsConceptPractice } from "./concept-practice.mjs";
import { deriveReviewProgression } from "./review-progression.mjs";
import {
  deriveTypingProgression,
  rebuildTypingProgression,
} from "./typing-progression.mjs";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function timestamp(value) {
  const parsed =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value, fallback = new Date().toISOString()) {
  const parsed = timestamp(value);
  return parsed === null ? fallback : new Date(parsed).toISOString();
}

function positiveRevision(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision > 0 ? revision : 1;
}

function text(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function phaseId(value, fallback) {
  const id = text(value).trim();
  return id || fallback;
}

function itemId(value) {
  const id = text(value).trim();
  return id || "";
}

function moduleId(value, fallback) {
  const id = text(value).trim();
  return id || fallback;
}

function activityKindFor(item) {
  if (supportsConceptPractice(item)) return "concept";
  if (item?.language === "swift" && item?.solveCapability === "server") {
    return "solve";
  }
  return null;
}

function lastAttempt(attempts) {
  return [...attempts]
    .filter((attempt) => timestamp(attempt?.completedAt) !== null)
    .sort(
      (left, right) =>
        timestamp(left.completedAt) - timestamp(right.completedAt) ||
        text(left.id).localeCompare(text(right.id)),
    )
    .at(-1) ?? null;
}

function itemProgress(item, requestedItemId, evidence, typingWorkspace, now) {
  const attempts = asArray(evidence.attempts).filter(
    (attempt) => attempt?.itemId === requestedItemId,
  );
  const revision = positiveRevision(item?.contentRevision);
  const currentAttempts = attempts.filter(
    (attempt) => positiveRevision(attempt?.itemRevision) === revision,
  );
  const outdated = attempts.some(
    (attempt) => positiveRevision(attempt?.itemRevision) !== revision,
  );
  const activityKind = activityKindFor(item);
  const last = lastAttempt(currentAttempts);
  let independent = false;
  let due = false;
  let retained = false;
  let recallLevel = 0;
  let dueAt = null;
  let attemptCount = currentAttempts.length;
  let completedStages = [];

  if (activityKind) {
    const review = deriveReviewProgression(currentAttempts, {
      itemId: requestedItemId,
      itemRevision: revision,
      activityKind,
      events: asArray(evidence.learningEvents),
      now,
    });
    independent = review.successes > 0;
    due = review.due;
    retained = independent && !due;
    recallLevel = review.level;
    dueAt = review.dueAt;
  } else {
    const typing = deriveTypingProgression(
      typingWorkspace,
      requestedItemId,
      revision,
      now,
    );
    independent = typing.owned;
    due = typing.due;
    retained = typing.retained;
    recallLevel = typing.recallLevel;
    dueAt = typing.dueAt;
    attemptCount = Math.max(attemptCount, typing.attemptCount);
    completedStages = typing.completedStages;
  }

  const attempted = currentAttempts.length > 0 || attemptCount > 0;
  const status = !item
    ? "unavailable"
    : outdated && !currentAttempts.length
      ? "outdated"
      : due
        ? "due"
        : independent
          ? "independent"
          : attempted
            ? "practiced"
            : "not-started";

  return {
    itemId: requestedItemId,
    itemRevision: revision,
    status,
    activityKind: activityKind ?? "typing",
    independent,
    attempted,
    due,
    retained,
    outdated,
    attemptCount,
    recallLevel,
    completedStages,
    lastAttemptAt: last?.completedAt ?? null,
    dueAt,
  };
}

function progressCounts(items) {
  return {
    totalItems: items.length,
    availableItems: items.filter((item) => item.status !== "unavailable").length,
    independent: items.filter((item) => item.independent).length,
    attempted: items.filter((item) => item.attempted).length,
    due: items.filter((item) => item.due).length,
    retained: items.filter((item) => item.retained).length,
    outdated: items.filter((item) => item.outdated).length,
  };
}

function actionableRank(item) {
  if (item.status === "due") return 0;
  if (item.status === "not-started") return 1;
  if (item.status === "practiced") return 2;
  if (item.status === "outdated") return 3;
  return 4;
}

/**
 * Derive phase/module/item evidence for the fixed Swift and iOS reactivation
 * path. This intentionally returns counts and next-item routing, not a single
 * readiness score. Concept and server-judged evidence use their normal review
 * semantics; the fallback is the existing typing progression.
 */
export function deriveIOSReactivationProgress(phases, evidence = {}) {
  const now = iso(evidence.now, new Date().toISOString());
  const items = asArray(evidence.items);
  const itemsById = new Map(items.map((item) => [item?.itemId, item]));
  const attempts = asArray(evidence.attempts);
  const revisions = new Map(
    items.map((item) => [item?.itemId, positiveRevision(item?.contentRevision)]),
  );
  const typingWorkspace = evidence.typingProgress ?? rebuildTypingProgression(attempts, {
    now,
    validItemIds: revisions.keys(),
    revisions,
  });

  let next = null;
  const phaseProgress = asArray(phases).map((phase, phaseIndex) => {
    const modules = asArray(phase?.modules).map((moduleEntry, moduleIndex) => {
      const moduleItems = asArray(moduleEntry?.itemIds)
        .map(itemId)
        .filter(Boolean)
        .map((requestedItemId) =>
          itemProgress(
            itemsById.get(requestedItemId),
            requestedItemId,
            evidence,
            typingWorkspace,
            now,
          ),
        );
      const counts = progressCounts(moduleItems);
      const candidate = moduleItems
        .filter((item) => item.status !== "independent" && item.status !== "unavailable")
        .sort((left, right) => actionableRank(left) - actionableRank(right))
        .at(0);
      if (!next && candidate) {
        next = {
          itemId: candidate.itemId,
          phaseId: phaseId(phase?.id, `phase-${phaseIndex + 1}`),
          moduleId: moduleId(moduleEntry?.id, `module-${moduleIndex + 1}`),
        };
      }
      return {
        id: moduleId(moduleEntry?.id, `module-${moduleIndex + 1}`),
        title: text(moduleEntry?.title, `Module ${moduleIndex + 1}`),
        eyebrow: text(moduleEntry?.eyebrow),
        summary: text(moduleEntry?.summary),
        outcome: text(moduleEntry?.outcome),
        focus: asArray(moduleEntry?.focus).map((value) => text(value)).filter(Boolean),
        estimatedMinutes: positiveRevision(moduleEntry?.estimatedMinutes),
        items: moduleItems,
        ...counts,
      };
    });
    const itemsInPhase = modules.flatMap((moduleEntry) => moduleEntry.items);
    const counts = progressCounts(itemsInPhase);
    return {
      id: phaseId(phase?.id, `phase-${phaseIndex + 1}`),
      number: Number.isInteger(phase?.number) ? phase.number : phaseIndex + 1,
      title: text(phase?.title, `Phase ${phaseIndex + 1}`),
      subtitle: text(phase?.subtitle),
      description: text(phase?.description),
      outcome: text(phase?.outcome),
      estimatedMinutes: positiveRevision(phase?.estimatedMinutes),
      modules,
      ...counts,
    };
  });

  const allItems = phaseProgress.flatMap((phase) =>
    phase.modules.flatMap((moduleEntry) => moduleEntry.items),
  );
  const counts = progressCounts(allItems);
  return {
    trackId: "swift-ios-reactivation",
    phases: phaseProgress,
    ...counts,
    next,
    now,
  };
}
