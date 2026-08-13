"use client";

import type { ClipboardEvent, CSSProperties, KeyboardEvent } from "react";
import { problemLineCount } from "../data/problems";
import type { PracticeItem } from "../lib/items";
import { SolveCodeEditor } from "./SolveCodeEditor";
import {
  formatDuration,
  type Draft,
  type PracticeKind,
  type Settings,
} from "../lib/product";

type EditorMetrics = {
  progress: number;
  wpm: number;
  accuracy: number;
  durationMs: number;
};

export type PracticeEditorProps = {
  item: PracticeItem;
  draft: Draft;
  practiceKind: PracticeKind;
  settings: Settings;
  metrics: EditorMetrics;
  ghostCode: string;
  editorLineCount: number;
  errorCount: number;
  linesLeft: number;
  isMock: boolean;
  readOnly?: boolean;
  reveal: boolean;
  focusMode: boolean;
  copied: boolean;
  hideReveal?: boolean;
  onCopyLink: () => void;
  onReveal: () => void;
  onRestart: () => void;
  onFocusMode: () => void;
  onRunExamples: () => void;
  onSubmit: () => void;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
};

const LANGUAGE_META = {
  python: { short: "Py", label: "Python", file: "solution.py" },
  swift: { short: "S", label: "Swift", file: "Solution.swift" },
} as const;

export function PracticeEditor(props: PracticeEditorProps) {
  const language = LANGUAGE_META[props.item.language];
  return (
    <div className="editor-card">
      <div className="editor-toolbar">
        <div className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="file-tab">
          <span className={`swift-badge ${props.item.language}`}>
            {language.short}
          </span>
          {language.file}{" "}
          <small>
            {props.practiceKind === "solving"
              ? props.editorLineCount
              : problemLineCount(props.item)}{" "}
            lines
          </small>
        </div>
        <div className="editor-actions">
          <button className="copy-action" onClick={props.onCopyLink}>
            {props.copied ? "Copied" : "Copy link"}
          </button>
          {props.practiceKind === "typing" && !props.hideReveal && (
            <button className="peek-action" onClick={props.onReveal}>
              {props.reveal ? "Hide answer" : "Peek"}
            </button>
          )}
          <button className="restart-action" disabled={props.readOnly} onClick={props.onRestart}>
            Restart
          </button>
          <button className="focus-action" onClick={props.onFocusMode}>
            {props.focusMode ? "Exit focus" : "Focus"}
          </button>
        </div>
      </div>
      <div className="metric-strip">
        {props.practiceKind === "typing" ? (
          <>
            <span>
              <small>Progress</small>
              <strong>{props.metrics.progress}%</strong>
            </span>
            {props.settings.showLiveWpm && (
              <span>
                <small>WPM</small>
                <strong>{props.metrics.wpm}</strong>
              </span>
            )}
            <span>
              <small>Accuracy</small>
              <strong>{props.metrics.accuracy}%</strong>
            </span>
            <span>
              <small>Errors</small>
              <strong>{props.errorCount}</strong>
            </span>
            <span>
              <small>Lines left</small>
              <strong>{props.linesLeft}</strong>
            </span>
          </>
        ) : (
          <>
            <span>
              <small>Workspace</small>
              <strong>{props.editorLineCount} lines</strong>
            </span>
            <span>
              <small>Test runs</small>
              <strong>{props.draft.testRuns}</strong>
            </span>
            <span>
              <small>Submissions</small>
              <strong>{props.draft.submissions}</strong>
            </span>
            <span>
              <small>{props.isMock ? "Guidance" : "Hints"}</small>
              <strong>{props.isMock ? "Locked" : props.draft.peeks}</strong>
            </span>
          </>
        )}
        <span>
          <small>Time</small>
          <strong>{formatDuration(props.metrics.durationMs)}</strong>
        </span>
        <span className="strict-indicator">
          <i />
          {props.practiceKind === "solving"
            ? "Free-form solve"
            : props.draft.challengeDate || props.settings.strictMode
              ? "Strict correction"
              : "Free correction"}
        </span>
      </div>
      <div
        className={`editor-wrap${props.practiceKind === "solving" ? " solve-editor-wrap" : ""}`}
        style={
          {
            "--font-size": `${props.settings.fontSize}px`,
            "--editor-lines": props.settings.editorLines,
            "--code-height": `${props.editorLineCount * props.settings.fontSize * 1.65 + 56}px`,
          } as CSSProperties
        }
      >
        {props.practiceKind === "solving" ? (
          <SolveCodeEditor
            value={props.draft.value}
            fontSize={props.settings.fontSize}
            tabSize={props.settings.tabSize}
            isMock={props.isMock}
            readOnly={props.readOnly}
            language={props.item.language}
            ariaLabel={`Solve ${props.item.title} in ${language.label}. Press Escape, then Tab, to leave the editor.`}
            onChange={props.onChange}
            onRunExamples={props.onRunExamples}
            onSubmit={props.onSubmit}
            onExitFocus={() => {
              if (props.focusMode) props.onFocusMode();
            }}
          />
        ) : (
          <>
            <pre className="line-numbers" aria-hidden="true">
              {Array.from(
                { length: props.editorLineCount },
                (_, index) => index + 1,
              ).join("\n")}
            </pre>
            <pre className="ghost-layer" aria-hidden="true">
              {props.ghostCode}
            </pre>
            <pre className="typed-layer" aria-hidden="true">
              {props.draft.value.split("").map((character, index) => (
                <span
                  className={
                    character === props.item.code[index] ? "right" : "wrong"
                  }
                  key={`${index}-${character}`}
                >
                  {character}
                </span>
              ))}
            </pre>
            <textarea
              value={props.draft.value}
              onChange={(event) => props.onChange(event.target.value)}
              onKeyDown={props.onKeyDown}
              onPaste={props.onPaste}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label={`Type the ${language.label} solution for ${props.item.title}. Press Escape to leave the editor.`}
            />
          </>
        )}
      </div>
      <div className="editor-footer">
        <span>
          <i className="key-swatch typed" />
          typed
        </span>
        {props.practiceKind === "typing" && (
          <>
            <span>
              <i className="key-swatch ghost" />
              ghost
            </span>
            <span>
              <i className="key-swatch hidden" />
              hidden
            </span>
          </>
        )}
        <span className="spacer" />
        <span>
          {props.practiceKind === "solving"
            ? "Ctrl/Cmd+Enter runs - add Shift to submit - Esc then Tab leaves"
            : `Tab inserts ${props.settings.tabSize} spaces - Esc leaves editor`}
        </span>
      </div>
      {props.practiceKind === "typing" && (
        <div className="progress-line">
          <i style={{ width: `${props.metrics.progress}%` }} />
        </div>
      )}
    </div>
  );
}
