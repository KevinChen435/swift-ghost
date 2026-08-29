const SESSION_PRACTICE_KINDS = ["typing", "solving", "concept"];

/**
 * Build the immutable identity used when a draft is attached to a session
 * entry. A missing kind is the legacy typing mode, so old saved sessions keep
 * the same identity they had before practice kinds were persisted.
 */
export function sessionEntryIdentity(value) {
  return {
    itemId: value?.itemId,
    itemRevision: value?.itemRevision,
    stage: value?.stage,
    practiceKind: value?.practiceKind ?? "typing",
  };
}

/**
 * Compare every field that affects the meaning of a session attempt. Never
 * compare only itemId: a saved row may refer to a different prompt revision,
 * stage, or practice surface for the same item.
 */
export function sessionEntryMatches(entry, identity) {
  return Boolean(
    entry &&
      identity &&
      typeof identity.itemId === "string" &&
      Number.isInteger(identity.itemRevision) &&
      Number.isInteger(identity.stage) &&
      SESSION_PRACTICE_KINDS.includes(identity.practiceKind) &&
      entry.itemId === identity.itemId &&
      entry.itemRevision === identity.itemRevision &&
      entry.stage === identity.stage &&
      (entry.practiceKind ?? "typing") === identity.practiceKind,
  );
}

/**
 * Return an entry only when the requested index and its full identity agree.
 * Callers can use a null result as a fail-closed signal before changing state.
 */
export function matchingSessionEntry(session, index, identity) {
  if (
    !session ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= session.entries.length
  ) {
    return null;
  }
  const entry = session.entries[index];
  return sessionEntryMatches(entry, identity) ? { index, entry } : null;
}

/** Return the current cursor only when it still points at the expected row. */
export function currentSessionEntry(session, identity) {
  return matchingSessionEntry(session, session?.currentIndex, identity);
}

/**
 * Find the next pending row after a cursor and return its exact index and
 * revisioned entry. The caller should pass those values into the next open;
 * re-looking up by itemId is intentionally not part of this helper.
 */
export function nextPendingSessionEntry(session, fromIndex) {
  if (!session || !Number.isInteger(fromIndex)) return null;
  const index = session.entries.findIndex(
    (entry, candidateIndex) =>
      candidateIndex > fromIndex && entry?.status === "pending",
  );
  if (index < 0) return null;
  return { index, entry: session.entries[index] };
}
