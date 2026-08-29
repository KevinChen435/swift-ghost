"use client";

import { useEffect, useRef, useState } from "react";
import type { AnnotationType, Compartment } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export type SolveCodeEditorProps = {
  value: string;
  language?: "python" | "swift";
  fontSize: number;
  tabSize: number;
  isMock: boolean;
  readOnly?: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
  onRunExamples: () => void;
  onSubmit: () => void;
  onExitFocus: () => void;
};

type EditorConfiguration = Pick<
  SolveCodeEditorProps,
  "fontSize" | "tabSize" | "isMock" | "readOnly" | "ariaLabel" | "language"
>;

type EditorRuntime = {
  view: EditorView;
  externalChange: AnnotationType<boolean>;
  fontSize: Compartment;
  tabSize: Compartment;
  completions: Compartment;
  syntax: Compartment;
  accessibility: Compartment;
  editable: Compartment;
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

const SWIFT_FLUENCY_COMPLETIONS = [
  { label: "func", type: "keyword", info: "Declare a function" },
  { label: "let", type: "keyword", info: "Declare an immutable binding" },
  { label: "var", type: "keyword", info: "Declare a mutable binding" },
  { label: "return", type: "keyword", info: "Return a value" },
  { label: "if", type: "keyword", info: "Start a conditional" },
  { label: "else", type: "keyword", info: "Add a fallback branch" },
  { label: "for", type: "keyword", info: "Iterate over a sequence" },
  { label: "while", type: "keyword", info: "Repeat while a condition holds" },
  { label: "guard", type: "keyword", info: "Exit when a condition fails" },
  { label: "in", type: "keyword", info: "Bind an iteration sequence" },
  { label: "Array", type: "class", info: "Swift ordered collection" },
  { label: "Dictionary", type: "class", info: "Swift key-value collection" },
  { label: "Set", type: "class", info: "Swift unique-value collection" },
  { label: "enumerated", type: "method", info: "Iterate with offsets" },
  { label: "sorted", type: "method", info: "Return sorted elements" },
] as const;

type SwiftStreamState = {
  blockCommentDepth: number;
  stringDelimiter: 0 | 1 | 3;
};

const SWIFT_KEYWORDS = new Set([
  "actor",
  "associatedtype",
  "async",
  "await",
  "borrowing",
  "break",
  "case",
  "catch",
  "class",
  "consume",
  "consuming",
  "continue",
  "convenience",
  "default",
  "defer",
  "deinit",
  "didSet",
  "distributed",
  "else",
  "enum",
  "extension",
  "fallthrough",
  "fileprivate",
  "final",
  "for",
  "func",
  "get",
  "guard",
  "if",
  "import",
  "indirect",
  "in",
  "infix",
  "init",
  "inout",
  "internal",
  "isolated",
  "is",
  "keyPath",
  "lazy",
  "let",
  "macro",
  "mutating",
  "nonisolated",
  "nonmutating",
  "open",
  "operator",
  "optional",
  "override",
  "package",
  "postfix",
  "precedencegroup",
  "prefix",
  "private",
  "protocol",
  "public",
  "repeat",
  "required",
  "rethrows",
  "return",
  "sending",
  "set",
  "some",
  "static",
  "struct",
  "subscript",
  "super",
  "switch",
  "throws",
  "try",
  "typealias",
  "unowned",
  "unsafe",
  "var",
  "weak",
  "where",
  "while",
  "willSet",
]);

const SWIFT_TYPES = new Set([
  "Array",
  "Bool",
  "Character",
  "Collection",
  "Dictionary",
  "Double",
  "Error",
  "Float",
  "Int",
  "Int8",
  "Int16",
  "Int32",
  "Int64",
  "Optional",
  "Set",
  "String",
  "UInt",
  "UInt8",
  "UInt16",
  "UInt32",
  "UInt64",
  "Void",
]);

const SWIFT_BUILTINS = new Set([
  "abs",
  "contains",
  "enumerated",
  "filter",
  "first",
  "last",
  "map",
  "max",
  "min",
  "print",
  "reduce",
  "reversed",
  "sorted",
  "stride",
  "zip",
]);

function consumeSwiftBlockComment(
  stream: import("@codemirror/language").StringStream,
  state: SwiftStreamState,
) {
  while (!stream.eol()) {
    if (stream.match("/*")) {
      state.blockCommentDepth += 1;
    } else if (stream.match("*/")) {
      state.blockCommentDepth -= 1;
      if (state.blockCommentDepth === 0) break;
    } else {
      stream.next();
    }
  }
  return "comment";
}

function consumeSwiftString(
  stream: import("@codemirror/language").StringStream,
  state: SwiftStreamState,
) {
  const delimiter = state.stringDelimiter === 3 ? "\"\"\"" : "\"";
  while (!stream.eol()) {
    if (stream.match(delimiter)) {
      state.stringDelimiter = 0;
      break;
    }
    if (stream.eat("\\")) {
      // Keep escaped quotes and interpolation markers inside the string.
      stream.next();
    } else {
      stream.next();
    }
  }
  return "string";
}

function swiftToken(
  stream: import("@codemirror/language").StringStream,
  state: SwiftStreamState,
) {
  if (state.blockCommentDepth > 0) {
    return consumeSwiftBlockComment(stream, state);
  }
  if (state.stringDelimiter !== 0) {
    return consumeSwiftString(stream, state);
  }
  if (stream.eatSpace()) return null;
  if (stream.match("//")) {
    stream.skipToEnd();
    return "comment";
  }
  if (stream.match("/*")) {
    state.blockCommentDepth = 1;
    return consumeSwiftBlockComment(stream, state);
  }
  if (stream.match("\"\"\"")) {
    state.stringDelimiter = 3;
    return consumeSwiftString(stream, state);
  }
  if (stream.eat("\"")) {
    state.stringDelimiter = 1;
    return consumeSwiftString(stream, state);
  }
  if (stream.match(/^@[A-Za-z_]\w*/)) return "meta";
  if (stream.match(/^#[A-Za-z_]\w*/)) return "meta";
  if (
    stream.match(
      /^(?:0[xX][\da-fA-F](?:_?[\da-fA-F])*|0[bB][01](?:_?[01])*|0[oO][0-7](?:_?[0-7])*|(?:\d(?:_?\d)*)(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?)/,
    )
  ) {
    return "number";
  }
  const identifier = stream.match(/^[A-Za-z_]\w*/);
  if (identifier) {
    const word = stream.current();
    if (SWIFT_KEYWORDS.has(word)) return "keyword";
    if (word === "true" || word === "false" || word === "nil") return "bool";
    if (SWIFT_TYPES.has(word) || /^[A-Z]/.test(word)) return "typeName";
    if (SWIFT_BUILTINS.has(word)) return "function";
    if (stream.string.slice(stream.pos).match(/^\s*\(/)) return "function";
    return "variableName";
  }
  if (
    stream.match(
      /^(?:===|!==|==|!=|<=|>=|&&|\|\||\+=|-=|\*=|\/=|%=|->|=>|\?\?|\.\.\.<|\.\.<|\.\.\.|<<|>>|&\||[+\-*\/%=<>!&|^~?])/,
    )
  ) {
    return "operator";
  }
  if (stream.match(/^[()[\]{}.,:;]/)) return "punctuation";
  stream.next();
  return null;
}

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
        const syntax = new state.Compartment();
        const accessibility = new state.Compartment();
        const editable = new state.Compartment();
        const externalChange = state.Annotation.define<boolean>();
        const swiftSyntax = language.StreamLanguage.define<SwiftStreamState>({
          name: "swift",
          startState: () => ({ blockCommentDepth: 0, stringDelimiter: 0 }),
          token: swiftToken,
          languageData: {
            commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
          },
        });

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

        const completionExtension = (
          isMock: boolean,
          editorLanguage: "python" | "swift" = "python",
        ) => {
          if (isMock) return [];
          const pythonFluencySource: import("@codemirror/autocomplete").CompletionSource =
            (context) => {
              const word = context.matchBefore(/[A-Za-z_]\w*/);
              if (!word && !context.explicit) return null;
              return {
                from: word?.from ?? context.pos,
                options: [
                  ...(editorLanguage === "swift"
                    ? SWIFT_FLUENCY_COMPLETIONS
                    : PYTHON_FLUENCY_COMPLETIONS),
                ],
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
            syntax.of(
              initialProps.language === "swift"
                ? swiftSyntax.extension
                : python.python(),
            ),
            state.Prec.highest(view.keymap.of(commandKeymap)),
            state.Prec.high(view.keymap.of(editingKeymap)),
            view.keymap.of([
              ...autocomplete.closeBracketsKeymap,
              ...search.searchKeymap,
              ...language.foldKeymap,
            ]),
            fontSize.of(fontSizeExtension(initialProps.fontSize)),
            tabSize.of(tabSizeExtension(initialProps.tabSize)),
            completions.of(
              completionExtension(
                initialProps.isMock,
                initialProps.language ?? "python",
              ),
            ),
            accessibility.of(accessibilityExtension(initialProps.ariaLabel)),
            editable.of(view.EditorView.editable.of(!initialProps.readOnly)),
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
          syntax,
          accessibility,
          editable,
          configure(configuration) {
            editorView.dispatch({
              effects: [
                fontSize.reconfigure(fontSizeExtension(configuration.fontSize)),
                tabSize.reconfigure(tabSizeExtension(configuration.tabSize)),
                completions.reconfigure(
                  completionExtension(
                    configuration.isMock,
                    configuration.language ?? "python",
                  ),
                ),
                syntax.reconfigure(
                  configuration.language === "swift"
                    ? swiftSyntax.extension
                    : python.python(),
                ),
                accessibility.reconfigure(
                  accessibilityExtension(configuration.ariaLabel),
                ),
                editable.reconfigure(
                  view.EditorView.editable.of(!configuration.readOnly),
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
      language: props.language,
      readOnly: props.readOnly,
      ariaLabel: props.ariaLabel,
    });
  }, [props.ariaLabel, props.fontSize, props.isMock, props.language, props.readOnly, props.tabSize]);

  return (
    <div className="solve-code-editor" data-editor-state={loadState}>
      {loadState === "loading" && (
        <div className="solve-code-editor-loading" role="status">
          Loading {props.language === "swift" ? "Swift" : "Python"} editor…
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
            readOnly={props.readOnly}
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
