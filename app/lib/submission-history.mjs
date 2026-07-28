const MAX_RECORDS = 200;
const MAX_PER_ITEM = 10;
const MAX_SOURCE_BYTES = 48_000;
const MAX_TOTAL_SOURCE_BYTES = 1_000_000;

function sourceBytes(source) {
  return new TextEncoder().encode(source).byteLength;
}

export function isStorableSubmissionSource(source) {
  return (
    typeof source === "string" &&
    source.length > 0 &&
    sourceBytes(source) <= MAX_SOURCE_BYTES
  );
}

export function submissionHistorySourceBytes(history) {
  return history.reduce((total, entry) => total + sourceBytes(entry.source), 0);
}

export function appendSubmissionHistory(history, submission) {
  if (!isStorableSubmissionSource(submission?.source)) return [...history];
  const deduplicated = history.filter((entry) => entry.id !== submission.id);
  const retainedForItem = new Set(
    deduplicated
      .filter((entry) => entry.itemId === submission.itemId)
      .slice(-(MAX_PER_ITEM - 1))
      .map((entry) => entry.id),
  );
  const next = [
    ...deduplicated.filter(
      (entry) =>
        entry.itemId !== submission.itemId || retainedForItem.has(entry.id),
    ),
    { ...submission },
  ].slice(-MAX_RECORDS);
  let totalBytes = submissionHistorySourceBytes(next);
  while (next.length > 1 && totalBytes > MAX_TOTAL_SOURCE_BYTES) {
    totalBytes -= sourceBytes(next[0].source);
    next.shift();
  }
  return next;
}

export const SUBMISSION_HISTORY_LIMITS = Object.freeze({
  maxRecords: MAX_RECORDS,
  maxPerItem: MAX_PER_ITEM,
  maxSourceBytes: MAX_SOURCE_BYTES,
  maxTotalSourceBytes: MAX_TOTAL_SOURCE_BYTES,
});
