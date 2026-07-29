export const BACKUP_KIND = "swift-ghost-backup";
export const BACKUP_ENVELOPE_VERSION = 1;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function boundedCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

export function backupInventory(state) {
  const submissionReceipts = isRecord(state?.submissionLog)
    ? boundedCount(state.submissionLog.receipts)
    : 0;
  const studyCollections = isRecord(state?.studyWorkspace)
    ? boundedCount(state.studyWorkspace.collections)
    : 0;
  const studyPlans = isRecord(state?.studyWorkspace)
    ? boundedCount(state.studyWorkspace.plans)
    : 0;
  const interviewHistory = isRecord(state?.interviewStudio)
    ? boundedCount(state.interviewStudio.history)
    : 0;
  const assessmentHistory = isRecord(state?.assessments)
    ? boundedCount(state.assessments.history)
    : 0;
  const virtualRoundHistory = isRecord(state?.virtualRoundWorkspace)
    ? boundedCount(state.virtualRoundWorkspace.history)
    : 0;
  const patternReviews = isRecord(state?.patternLearning)
    ? boundedCount(state.patternLearning.reviews)
    : 0;
  const patternDecisions = isRecord(state?.patternLearning)
    ? boundedCount(state.patternLearning.decisionAttempts)
    : 0;
  const testDesignAttempts = isRecord(state?.testDesign)
    ? boundedCount(state.testDesign.attempts)
    : 0;
  const testDesignDrafts = isRecord(state?.testDesign)
    ? boundedCount(state.testDesign.drafts)
    : 0;
  const activeTestDesignSprints =
    isRecord(state?.testDesign) &&
    isRecord(state.testDesign.activeSprint) &&
    state.testDesign.activeSprint.status === "active"
      ? 1
      : 0;
  const typingProgressRecords = isRecord(state?.typingProgress)
    ? boundedCount(state.typingProgress.records)
    : 0;
  const conceptTransferAttempts = isRecord(state?.conceptTransfer)
    ? boundedCount(state.conceptTransfer.attempts)
    : 0;
  const conceptTransferDrafts = isRecord(state?.conceptTransfer)
    ? boundedCount(state.conceptTransfer.drafts)
    : 0;
  const activeConceptTransferAttempts =
    isRecord(state?.conceptTransfer) &&
    typeof state.conceptTransfer.activeAttemptId === "string" &&
    Array.isArray(state.conceptTransfer.attempts) &&
    state.conceptTransfer.attempts.some(
      (attempt) =>
        isRecord(attempt) &&
        attempt.id === state.conceptTransfer.activeAttemptId &&
        !attempt.finishedAt &&
        !attempt.retired,
    )
      ? 1
      : 0;
  return {
    attempts: boundedCount(state?.attempts),
    submissions: submissionReceipts,
    sessions: boundedCount(state?.sessionHistory),
    customItems: boundedCount(state?.customItems),
    notes: isRecord(state?.problemNotes) ? Object.keys(state.problemNotes).length : 0,
    reviews: boundedCount(state?.solutionReviews),
    assessments: assessmentHistory,
    interviews: interviewHistory,
    virtualRounds: virtualRoundHistory,
    plans: studyPlans,
    collections: studyCollections,
    patternReviews,
    patternDecisions,
    testDesignAttempts,
    testDesignDrafts,
    activeTestDesignSprints,
    typingProgressRecords,
    conceptTransferAttempts,
    conceptTransferDrafts,
    activeConceptTransferAttempts,
  };
}

export function hasMeaningfulBackupState(state) {
  if (!isRecord(state)) return false;
  const inventory = backupInventory(state);
  if (Object.values(inventory).some((count) => count > 0)) return true;
  return Boolean(
    state.draft ||
      state.activeSession ||
      (isRecord(state.interviewStudio) && state.interviewStudio.active) ||
      (isRecord(state.assessments) && state.assessments.active) ||
      (isRecord(state.virtualRoundWorkspace) && state.virtualRoundWorkspace.active) ||
      boundedCount(state.favorites) ||
      boundedCount(state.learningEvents),
  );
}

export function createBackupEnvelope(state, now = new Date().toISOString()) {
  return {
    kind: BACKUP_KIND,
    envelopeVersion: BACKUP_ENVELOPE_VERSION,
    stateVersion: Number(state?.version) || 0,
    exportedAt: new Date(now).toISOString(),
    inventory: backupInventory(state),
    payload: state,
  };
}

function plausibleRawState(value, supportedVersions) {
  if (!isRecord(value) || !supportedVersions.includes(Number(value.version)))
    return false;
  const knownKeys = [
    "attempts",
    "settings",
    "lastItemId",
    "customItems",
    "sessionHistory",
    "studyWorkspace",
  ].filter((key) => Object.hasOwn(value, key));
  return knownKeys.length >= 3;
}

export function readBackupPayload(value, supportedVersions) {
  const raw =
    isRecord(value) &&
    value.kind === BACKUP_KIND &&
    Number(value.envelopeVersion) === BACKUP_ENVELOPE_VERSION
      ? value.payload
      : value;
  if (!plausibleRawState(raw, supportedVersions)) return undefined;
  return {
    payload: raw,
    exportedAt:
      isRecord(value) &&
      value.kind === BACKUP_KIND &&
      typeof value.exportedAt === "string" &&
      !Number.isNaN(Date.parse(value.exportedAt))
        ? new Date(value.exportedAt).toISOString()
        : undefined,
    envelope: isRecord(value) && value.kind === BACKUP_KIND,
  };
}
