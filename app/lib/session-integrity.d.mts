import type { SessionQueueEntry } from "./sessions.mjs";

export type SessionEntryPracticeKind = "typing" | "solving" | "concept";
export type SessionEntryIdentity = {
  itemId: string;
  itemRevision: number;
  stage: number;
  practiceKind: SessionEntryPracticeKind;
};
export type SessionEntrySession = {
  currentIndex: number;
  entries: SessionQueueEntry[];
};
export type MatchedSessionEntry = {
  index: number;
  entry: SessionQueueEntry;
};

export function sessionEntryIdentity(value: {
  itemId?: string;
  itemRevision?: number;
  stage?: number;
  practiceKind?: SessionEntryPracticeKind;
}): SessionEntryIdentity;
export function sessionEntryMatches(
  entry: SessionQueueEntry | null | undefined,
  identity: SessionEntryIdentity | null | undefined,
): boolean;
export function matchingSessionEntry(
  session: SessionEntrySession | null | undefined,
  index: number,
  identity: SessionEntryIdentity,
): MatchedSessionEntry | null;
export function currentSessionEntry(
  session: SessionEntrySession | null | undefined,
  identity: SessionEntryIdentity,
): MatchedSessionEntry | null;
export function nextPendingSessionEntry(
  session: SessionEntrySession | null | undefined,
  fromIndex: number,
): MatchedSessionEntry | null;
