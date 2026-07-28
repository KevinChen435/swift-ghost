"use client";

import { useEffect, useRef, useState } from "react";
import type { AnnotationType, Compartment } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export type SolveCodeEditorProps = {
  value: string;
  fontSize: number;
  tabSize: number;
  isMock: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
  onRunExamples: () => void;
  onSubmit: () => void;
  onExitFocus: () => void;
};

type EditorConfiguration = Pick<
  SolveCodeEditorProps,
  "fontSize" | "tabSize" | "isMock" | "ariaLabel"
>;

type EditorRuntime = {
  view: EditorView;
  externalChange: AnnotationType<boolean>;
  fontSize: Compartment;
  tabSize: Compartment;
  completions: Compartment;
  accessibility: Compartment;
  configure: (configuration: EditorConfiguration) => void;
  syncValue: (value: string) => void;
};

type LoadState = "loading" | "ready" | "error";

const PYTHON_FLUENCY_COMPLETIONS = [
  { label: "def", type: "keyword", info: "Define a function" },
  { label: "return", type: "keyword", info: "Return a value" },
  { label: "for", type: "keyword", info: "Iterate over a sequence" },
  { label: "while", type: "keyword", info: "Repeat while a condition holds" },
  { label: "if", type: "keyword", info: "Start a conditional" },
  { label: "elif", type: "keyword", info: "Add a conditional branch" },
  { label: "else", type: "keyword", info: "Add a fallback branch" },
  { label: "in", type: "keyword", info: "Test membership or iterate" },
  { label: "range", type: "function", info: "Produce an integer range" },
  { label: "enumerate", type: "function", info: "Iterate with indexes" },
  { label: "zip", type: "function", info: "Iterate over sequences together" },
  { label: "len", type: "function", info: "Read a collection length" },
  { label: "list", type: "class", info: "Create a list" },
  { label: "dict", type: "class", info: "Create a dictionary" },
  { label: "set", type: "class", info: "Create a set" },
  { label: "tuple", type: "class", info: "Create a tuple" },
  { label: "sorted", type: "function", info: "Return sorted values" },
  { label: "min", type: "function", info: "Return the smallest value" },
  { label: "max", type: "function", info: "Return the largest value" },
  { label: "sum", type: "function", info: "Add numeric values" },
  { label: "any", type: "function", info: "Test whether any value is true" },
  { label: "all", type: "function", info: "Test whether all values are true" },
] as const;

function normalizedFontSize(value: number) {
  return Number.isFinite(value) ? Math.min(30, Math.max(11, value)) : 15;
}

function normalizedTabSize(value: number) {
  return Number.isFinite(value) ? Math.min(8, Math.max(1, Math.round(value))) : 4;
}

/**
 * A Solve-only CodeMirror editor. Runtime modules are loaded in the browser so
 * the typing and concept-recall paths do not pay for the editor bundle.
 */
export function SolveCodeEditor(props: SolveCodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<EditorRuntime | null>(null);
  const latestPropsRef = useRef(props);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    latestPropsRef.current = props;
  }, [props]);

  useEffect(() => {
    let cancelled = false;
    let createdView: EditorView | null = null;

    async function loadEditor() {
      try {
        const [
          codeMirror,
          state,
          view,
          commands,
          language,
          autocomplete,
          python,
          search,
        ] = await Promise.all([
          import("codemirror"),
          import("@codemirror/state"),
          import("@codemirror/view"),
          import("@codemirror/commands"),
          import("@codemirror/language"),
          import("@codemirror/autocomplete"),
          import("@codemirror/lang-python"),
          import("@codemirror/search"),
        ]);

        if (cancelled || !hostRef.current) return;

        const fontSize = new state.Compartment();
        const tabSize = new state.Compartment();
        const completions = new state.Compartment();
        const accessibility = new state.Compartment();
        const externalChange = state.Annotation.define<boolean>();

        const fontSizeExtension = (value: number) =>
          view.EditorView.theme({
            "&": { fontSize: `${normalizedFontSize(value)}px` },
            ".cm-scroller": {
              fontFamily:
                "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
            },
          });

        const tabSizeExtension = (value: number) => {
          const size = normalizedTabSize(value);
          return [
            state.EditorState.tabSize.of(size),
            language.indentUnit.of(" ".repeat(size)),
          ];
        };

        const completionExtension = (isMock: boolean) => {
          if (isMock) return [];
          const pythonFluencySource: import("@codemirror/autocomplete").CompletionSource =
            (context) => {
              const word = context.matchBefore(/[A-Za-z_]\w*/);
              if (!word && !context.explicit) return null;
              return {
                from: word?.from ?? context.pos,
                options: [...PYTHON_FLUENCY_COMPLETIONS],
                validFor: /^\w*$/,
              };
            };
          return [
            autocomplete.autocompletion({
              override: [pythonFluencySource],
              activateOnTyping: true,
              defaultKeymap: false,
            }),
            view.keymap.of(autocomplete.completionKeymap),
          ];
        };

        const accessibilityExtension = (ariaLabel: string) =>
          view.EditorView.contentAttributes.of({
            "aria-label": ariaLabel,
            "aria-multiline": "true",
            "aria-keyshortcuts":
              "Control+Enter Meta+Enter Shift+Control+Enter Shift+Meta+Enter Control+/ Meta+/",
            autocapitalize: "off",
            autocomplete: "off",
            spellcheck: "false",
          });

        const commandKeymap: import("@codemirror/view").KeyBinding[] = [
          {
            key: "Shift-Mod-Enter",
            run: () => {
              const current = latestPropsRef.current;
              if (current.isMock) current.onRunExamples();
              else current.onSubmit();
              return true;
            },
          },
          {
            key: "Mod-Enter",
            run: () => {
              latestPropsRef.current.onRunExamples();
              return true;
            },
          },
        ];

        const editingKeymap: import("@codemirror/view").KeyBinding[] = [
          commands.indentWithTab,
          { key: "Mod-/", run: commands.toggleLineComment },
          {
            key: "Escape",
            run: () => {
              latestPropsRef.current.onExitFocus();
              // Returning false preserves CodeMirror's native Escape-then-Tab
              // focus escape hatch for keyboard and assistive-technology users.
              return false;
            },
          },
        ];

        const initialProps = latestPropsRef.current;
        const editorState = state.EditorState.create({
          doc: initialProps.value,
          extensions: [
            codeMirror.minimalSetup,
            view.lineNumbers(),
            view.highlightActiveLineGutter(),
            view.dropCursor(),
            view.rectangularSelection(),
            view.crosshairCursor(),
            view.highlightActiveLine(),
            state.EditorState.allowMultipleSelections.of(true),
            language.foldGutter(),
            language.indentOnInput(),
            language.bracketMatching(),
            autocomplete.closeBrackets(),
            search.highlightSelectionMatches(),
            python.python(),
            state.Prec.highest(view.keymap.of(commandKeymap)),
            state.Prec.high(view.keymap.of(editingKeymap)),
            view.keymap.of([
              ...autocomplete.closeBracketsKeymap,
              ...search.searchKeymap,
              ...language.foldKeymap,
            ]),
            fontSize.of(fontSizeExtension(initialProps.fontSize)),
            tabSize.of(tabSizeExtension(initialProps.tabSize)),
            completions.of(completionExtension(initialProps.isMock)),
            accessibility.of(accessibilityExtension(initialProps.ariaLabel)),
            view.EditorView.updateListener.of((update) => {
              if (!update.docChanged) return;
              const cameFromExternalSync = update.transactions.some(
                (transaction) => transaction.annotation(externalChange) === true,
              );
              if (!cameFromExternalSync) {
                latestPropsRef.current.onChange(update.state.doc.toString());
              }
            }),
          ],
        });

        const editorView = new codeMirror.EditorView({
          state: editorState,
          parent: hostRef.current,
        });
        createdView = editorView;

        const runtime: EditorRuntime = {
          view: editorView,
          externalChange,
          fontSize,
          tabSize,
          completions,
          accessibility,
          configure(configuration) {
            editorView.dispatch({
              effects: [
                fontSize.reconfigure(fontSizeExtension(configuration.fontSize)),
                tabSize.reconfigure(tabSizeExtension(configuration.tabSize)),
                completions.reconfigure(
                  completionExtension(configuration.isMock),
                ),
                accessibility.reconfigure(
                  accessibilityExtension(configuration.ariaLabel),
                ),
              ],
            });
          },
          syncValue(value) {
            if (editorView.state.doc.toString() === value) return;
            editorView.dispatch({
              changes: {
                from: 0,
                to: editorView.state.doc.length,
                insert: value,
              },
              annotations: [
                externalChange.of(true),
                state.Transaction.addToHistory.of(false),
              ],
            });
          },
        };

        runtimeRef.current = runtime;
        setLoadState("ready");
      } catch (error) {
        if (cancelled) return;
        console.error("Could not load the Solve code editor", error);
        setLoadState("error");
      }
    }

    void loadEditor();

    return () => {
      cancelled = true;
      runtimeRef.current = null;
      createdView?.destroy();
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.syncValue(props.value);
  }, [props.value]);

  useEffect(() => {
    runtimeRef.current?.configure({
      fontSize: props.fontSize,
      tabSize: props.tabSize,
      isMock: props.isMock,
      ariaLabel: props.ariaLabel,
    });
  }, [props.ariaLabel, props.fontSize, props.isMock, props.tabSize]);

  return (
    <div className="solve-code-editor" data-editor-state={loadState}>
      {loadState === "loading" && (
        <div className="solve-code-editor-loading" role="status">
          Loading Python editor…
        </div>
      )}
      {loadState === "error" && (
        <div className="solve-code-editor-error">
          <p role="alert">
            The enhanced editor could not load. You can keep coding in the
            fallback editor below.
          </p>
          <textarea
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
            onKeyDown={(event) => {
              if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") {
                return;
              }
              event.preventDefault();
              if (event.shiftKey && !props.isMock) props.onSubmit();
              else props.onRunExamples();
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label={`${props.ariaLabel} Fallback editor.`}
          />
        </div>
      )}
      <div
        ref={hostRef}
        className="solve-code-editor-mount"
        aria-hidden={loadState !== "ready"}
      />
    </div>
  );
}
