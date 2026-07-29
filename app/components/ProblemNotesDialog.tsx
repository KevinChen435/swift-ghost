"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PROBLEM_NOTE_LIMITS, type ProblemNote } from "../lib/problem-notes.mjs";
import type { PracticeItem } from "../lib/items";

type ProblemNotesDialogProps = {
  item: PracticeItem;
  note?: ProblemNote;
  onSave: (note: Omit<ProblemNote, "updatedAt">) => boolean;
  onDelete: () => boolean;
  onClose: () => void;
};

export function ProblemNotesDialog({ item, note, onSave, onDelete, onClose }: ProblemNotesDialogProps) {
  const [approach, setApproach] = useState(note?.approach ?? "");
  const [pitfalls, setPitfalls] = useState(note?.pitfalls ?? "");
  const [complexity, setComplexity] = useState(note?.complexity ?? "");
  const dialogRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const closeRef = useRef(onClose);
  const initial = useMemo(() => ({
    approach: note?.approach ?? "",
    pitfalls: note?.pitfalls ?? "",
    complexity: note?.complexity ?? "",
  }), [note]);
  const dirty = approach !== initial.approach || pitfalls !== initial.pitfalls || complexity !== initial.complexity;
  const hasContent = Boolean(approach.trim() || pitfalls.trim() || complexity.trim());

  useEffect(() => {
    dirtyRef.current = dirty;
    closeRef.current = onClose;
  }, [dirty, onClose]);

  const requestClose = () => {
    if (dirty && !window.confirm("Discard the unsaved changes to this problem note?")) return;
    onClose();
  };

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>("textarea, input, button");
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (dirtyRef.current && !window.confirm("Discard the unsaved changes to this problem note?")) return;
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, []);

  const save = () => {
    if (!hasContent) {
      if (!note || onDelete()) onClose();
      return;
    }
    const saved = onSave({
      itemId: item.itemId,
      itemRevision: item.contentRevision,
      approach,
      pitfalls,
      complexity,
    });
    if (saved) onClose();
  };

  return (
    <div className="dialog-backdrop problem-notes-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) requestClose();
    }}>
      <div
        ref={dialogRef}
        className="problem-notes-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="problem-notes-title"
        aria-describedby="problem-notes-description"
      >
        <header>
          <div>
            <p>Device-local notebook</p>
            <h2 id="problem-notes-title">{item.title}</h2>
            <span id="problem-notes-description">Capture the cues you want available before your next independent attempt.</span>
          </div>
          <button type="button" className="problem-notes-close" aria-label="Close problem notes" onClick={requestClose}>×</button>
        </header>

        <div className="problem-notes-fields">
          {note && note.itemRevision !== item.contentRevision ? (
            <div className="problem-notes-revision-warning" role="status">
              This note was written for revision {note.itemRevision}. Review it against revision {item.contentRevision} before saving.
            </div>
          ) : null}
          <label>
            <span>Approach and invariant</span>
            <textarea
              value={approach}
              maxLength={PROBLEM_NOTE_LIMITS.maxApproachLength}
              placeholder="What makes the solution work? Write the invariant in your own words."
              onChange={(event) => setApproach(event.target.value)}
            />
            <small>{approach.length}/{PROBLEM_NOTE_LIMITS.maxApproachLength}</small>
          </label>
          <label>
            <span>Mistakes and edge cases</span>
            <textarea
              value={pitfalls}
              maxLength={PROBLEM_NOTE_LIMITS.maxPitfallsLength}
              placeholder="What did you miss? Which edge case or API detail should you test first?"
              onChange={(event) => setPitfalls(event.target.value)}
            />
            <small>{pitfalls.length}/{PROBLEM_NOTE_LIMITS.maxPitfallsLength}</small>
          </label>
          <label className="problem-notes-complexity">
            <span>Complexity</span>
            <input
              value={complexity}
              maxLength={PROBLEM_NOTE_LIMITS.maxComplexityLength}
              placeholder="Time O(n) · Space O(n) · why"
              onChange={(event) => setComplexity(event.target.value)}
            />
            <small>{complexity.length}/{PROBLEM_NOTE_LIMITS.maxComplexityLength}</small>
          </label>
        </div>

        <footer>
          <span>{note ? `Last saved ${new Date(note.updatedAt).toLocaleString()}` : "Not saved yet"}</span>
          <div>
            {note ? <button type="button" className="problem-notes-delete" onClick={() => {
              if (!window.confirm("Delete this problem note?")) return;
              if (onDelete()) onClose();
            }}>Delete note</button> : null}
            <button type="button" onClick={requestClose}>Cancel</button>
            <button type="button" className="problem-notes-save" disabled={!dirty && Boolean(note)} onClick={save}>
              {hasContent ? "Save note" : note ? "Delete empty note" : "Close"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
