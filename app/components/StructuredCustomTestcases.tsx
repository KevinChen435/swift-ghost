"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  CUSTOM_TESTCASE_LIMITS,
  parseCustomTestcaseField,
  type CustomTestcase,
  type CustomTestcaseCollection,
  type CustomTestcaseField,
  type CustomTestcaseSchema,
} from "../lib/custom-testcases.mjs";
import type {
  PythonCodec,
  PythonVerificationResult,
} from "../lib/python-runner.mjs";

export type StructuredCustomExecutionState = {
  status: "idle" | "loading" | "running" | "finished" | "error";
  result?: PythonVerificationResult;
  message?: string;
  /** Case IDs in the same order as result.cases. */
  caseIds?: readonly string[];
};

export type CustomTestcaseModeSnapshot = {
  /** Exact raw text last entered for this case, when available. */
  raw?: string;
  /** Exact structured field drafts last entered for this case, when available. */
  fields?: readonly CustomTestcaseField[];
};

export type StructuredCustomTestcasesProps = {
  schema: CustomTestcaseSchema;
  collection: CustomTestcaseCollection;
  executionState: StructuredCustomExecutionState;
  runnerSourcePresent: boolean;
  checksAreBusy: boolean;
  onSelectCase: (caseId: string) => void;
  onAddCase: (afterCaseId?: string) => void;
  onDuplicateCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onRenameCase: (caseId: string, name: string) => void;
  /**
   * Apply the new mode with the matching value from snapshot. The snapshot is
   * how the parent can preserve both representations while the collection's
   * discriminated union stores only the active representation.
   */
  onModeChange: (
    caseId: string,
    mode: CustomTestcase["mode"],
    snapshot: CustomTestcaseModeSnapshot,
  ) => void;
  onFieldChange: (
    caseId: string,
    parameterId: string,
    text: string,
  ) => void;
  onRawChange: (caseId: string, raw: string) => void;
  onRunSelected: () => void | Promise<void>;
  onRunAll: () => void | Promise<void>;
};

const DISPLAY_LIMITS = Object.freeze({
  resultCases: CUSTOM_TESTCASE_LIMITS.maxCases,
  valueCharacters: 6_000,
  streamCharacters: 4_000,
  errorCharacters: 2_000,
});

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n… output truncated`;
}

function formatJson(value: unknown) {
  try {
    const encoded = JSON.stringify(value, null, 2);
    return truncate(
      encoded === undefined ? "undefined" : encoded,
      DISPLAY_LIMITS.valueCharacters,
    );
  } catch {
    return "The returned value could not be displayed as JSON.";
  }
}

function codecLabel(codec: PythonCodec) {
  switch (codec) {
    case "linkedList":
      return "linked list";
    case "cyclicLinkedList":
      return "cyclic linked list";
    case "binaryTree":
      return "binary tree";
    default:
      return "JSON";
  }
}

function codecGuidance(codec: PythonCodec) {
  switch (codec) {
    case "linkedList":
      return "Enter a JSON array in head-to-tail order, such as [1, 2, 3].";
    case "cyclicLinkedList":
      return 'Enter {"values":[...],"pos":n}; use -1 when there is no cycle.';
    case "binaryTree":
      return "Enter a level-order JSON array and use null for missing nodes.";
    default:
      return "Enter one valid JSON value: a number, string, boolean, array, object, or null.";
  }
}

function fieldError(text: string, codec: PythonCodec) {
  try {
    parseCustomTestcaseField(text, codec);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Enter valid JSON.";
  }
}

function rawError(raw: string, schema: CustomTestcaseSchema) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "Raw input must be valid JSON.";
  }

  const args = Array.isArray(parsed)
    ? parsed
    : parsed !== null && typeof parsed === "object" && "args" in parsed
      ? (parsed as { args?: unknown }).args
      : undefined;
  if (!Array.isArray(args)) {
    return 'Use a JSON arguments array or an object shaped like {"args":[...]}.';
  }
  if (args.length !== schema.parameters.length) {
    return `This problem expects ${schema.parameters.length} argument${schema.parameters.length === 1 ? "" : "s"}.`;
  }

  for (let index = 0; index < args.length; index += 1) {
    try {
      const encoded = JSON.stringify(args[index]);
      if (encoded === undefined) throw new Error("not JSON");
      parseCustomTestcaseField(encoded, schema.parameters[index].codec);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "uses an invalid value";
      return `${schema.parameters[index].name}: ${detail}`;
    }
  }
  return null;
}

function structuredRawDraft(
  testCase: Extract<CustomTestcase, { mode: "structured" }>,
  schema: CustomTestcaseSchema,
) {
  const byParameter = new Map(
    testCase.fields.map((field) => [field.parameterId, field.text]),
  );
  const argumentsText = schema.parameters.map(
    (parameter) => byParameter.get(parameter.id) ?? "null",
  );
  return `{
  "args": [
${argumentsText.map((value) => `    ${value}`).join(",\n")}
  ]
}`;
}

function testcaseTabId(prefix: string, caseId: string) {
  return `${prefix}-${caseId}-tab`;
}

function testcasePanelId(prefix: string, caseId: string) {
  return `${prefix}-${caseId}-panel`;
}

function CaseResult({
  name,
  result,
}: {
  name: string;
  result: PythonVerificationResult["cases"][number];
}) {
  return (
    <li className={result.error ? "has-error" : "is-finished"}>
      <div className="custom-testcase-result-head">
        <strong>{name}</strong>
        <span>{result.error ? "Runtime error" : "Finished"}</span>
      </div>
      {result.error ? (
        <code>
          {truncate(result.error, DISPLAY_LIMITS.errorCharacters)}
        </code>
      ) : (
        <pre>{formatJson(result.actual)}</pre>
      )}
    </li>
  );
}

function ExecutionResults({
  collection,
  executionState,
}: Pick<StructuredCustomTestcasesProps, "collection" | "executionState">) {
  const result = executionState.result;
  const isRunning =
    executionState.status === "loading" ||
    executionState.status === "running";

  if (isRunning) {
    return (
      <div className="custom-testcase-empty" role="status" aria-live="polite">
        {executionState.status === "loading"
          ? "Loading the local Python runner…"
          : "Running custom testcases…"}
      </div>
    );
  }

  if (executionState.status === "error") {
    return (
      <div
        className="custom-testcase-run-error"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <strong>Custom testcases could not run</strong>
        {executionState.message && (
          <code>
            {truncate(executionState.message, DISPLAY_LIMITS.errorCharacters)}
          </code>
        )}
      </div>
    );
  }

  if (!result) {
    return (
      <p className="custom-testcase-empty">
        Run the selected case or all cases to inspect returned values.
      </p>
    );
  }

  // Custom input must never become a back door into verification details.
  if (result.kind !== "execution") {
    return (
      <p className="custom-testcase-empty" role="status" aria-live="polite">
        Custom output is unavailable. Run these private inputs again.
      </p>
    );
  }

  const caseIds = executionState.caseIds ?? [];
  const caseNames = new Map(
    collection.cases.map((testCase) => [testCase.id, testCase.name]),
  );
  const visibleResults = result.cases.slice(0, DISPLAY_LIMITS.resultCases);

  return (
    <section
      className="custom-testcase-results"
      aria-label="Custom testcase output"
      aria-live="polite"
    >
      <header>
        <strong>
          {visibleResults.length} custom testcase
          {visibleResults.length === 1 ? "" : "s"} finished
        </strong>
        <small>{Math.round(result.durationMs)} ms</small>
      </header>
      {result.setupError && (
        <code>{truncate(result.setupError, DISPLAY_LIMITS.errorCharacters)}</code>
      )}
      <ol>
        {visibleResults.map((caseResult, index) => {
          const caseId = caseIds[index];
          return (
            <CaseResult
              key={`${caseId ?? caseResult.name}-${index}`}
              name={
                (caseId ? caseNames.get(caseId) : undefined) ??
                caseResult.name ??
                `Case ${index + 1}`
              }
              result={caseResult}
            />
          );
        })}
      </ol>
      {result.stdout && (
        <div className="custom-testcase-stream">
          <strong>Standard output</strong>
          <pre>
            {truncate(result.stdout, DISPLAY_LIMITS.streamCharacters)}
          </pre>
        </div>
      )}
      {result.stderr && (
        <div className="custom-testcase-stream">
          <strong>Standard error</strong>
          <pre>
            {truncate(result.stderr, DISPLAY_LIMITS.streamCharacters)}
          </pre>
        </div>
      )}
    </section>
  );
}

export function StructuredCustomTestcases({
  schema,
  collection,
  executionState,
  runnerSourcePresent,
  checksAreBusy,
  onSelectCase,
  onAddCase,
  onDuplicateCase,
  onDeleteCase,
  onRenameCase,
  onModeChange,
  onFieldChange,
  onRawChange,
  onRunSelected,
  onRunAll,
}: StructuredCustomTestcasesProps) {
  const idPrefix = `custom-testcases-${useId().replace(/:/g, "")}`;
  const selectedCase =
    collection.cases.find(
      (testCase) => testCase.id === collection.selectedCaseId,
    ) ?? collection.cases[0];
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const rawSnapshots = useRef(new Map<string, string>());
  const fieldSnapshots = useRef(
    new Map<string, readonly CustomTestcaseField[]>(),
  );

  useEffect(() => {
    if (!selectedCase) return;
    if (selectedCase.mode === "raw") {
      rawSnapshots.current.set(selectedCase.id, selectedCase.raw);
    } else {
      fieldSnapshots.current.set(selectedCase.id, selectedCase.fields);
    }
  }, [selectedCase]);

  if (!selectedCase) {
    return (
      <p className="custom-testcase-empty" role="status">
        Add a testcase to continue.
      </p>
    );
  }

  const atCaseLimit =
    collection.cases.length >= CUSTOM_TESTCASE_LIMITS.maxCases;
  const canDelete =
    collection.cases.length > CUSTOM_TESTCASE_LIMITS.minCases;
  const canRun = runnerSourcePresent && !checksAreBusy;
  const nameDraft = nameDrafts[selectedCase.id] ?? selectedCase.name;

  function selectAdjacentCase(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? collection.cases.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % collection.cases.length
            : event.key === "ArrowLeft"
              ? (currentIndex - 1 + collection.cases.length) %
                collection.cases.length
              : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextCase = collection.cases[nextIndex];
    onSelectCase(nextCase.id);
    document.getElementById(testcaseTabId(idPrefix, nextCase.id))?.focus();
  }

  function safelyEdit(operation: () => void) {
    try {
      operation();
      setEditError(null);
      return true;
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "That edit could not be saved.",
      );
      return false;
    }
  }

  function clearNameDraft() {
    setNameDrafts((current) => {
      const next = { ...current };
      delete next[selectedCase.id];
      return next;
    });
  }

  function commitName() {
    if (nameDraft.length === 0) {
      clearNameDraft();
      setEditError("A testcase name cannot be empty.");
      return;
    }
    if (safelyEdit(() => onRenameCase(selectedCase.id, nameDraft))) {
      clearNameDraft();
    }
  }

  function switchMode(mode: CustomTestcase["mode"]) {
    if (mode === selectedCase.mode) return;
    if (selectedCase.mode === "raw") {
      rawSnapshots.current.set(selectedCase.id, selectedCase.raw);
    } else {
      fieldSnapshots.current.set(selectedCase.id, selectedCase.fields);
    }
    const snapshot: CustomTestcaseModeSnapshot = {
      raw:
        rawSnapshots.current.get(selectedCase.id) ??
        (selectedCase.mode === "structured"
          ? structuredRawDraft(selectedCase, schema)
          : selectedCase.raw),
      fields: fieldSnapshots.current.get(selectedCase.id),
    };
    safelyEdit(() => onModeChange(selectedCase.id, mode, snapshot));
  }

  return (
    <section
      className="structured-custom-testcases"
      aria-label="Custom testcases"
    >
      <header className="custom-testcase-heading">
        <div>
          <small>Custom testcases</small>
          <strong>Try your own inputs</strong>
        </div>
        <p>
          These runs are private practice only. They do not affect progress or
          reveal judge cases.
        </p>
      </header>

      <div className="custom-testcase-casebar">
        <div
          className="custom-testcase-tabs"
          role="tablist"
          aria-label="Custom testcases"
          aria-orientation="horizontal"
        >
          {collection.cases.map((testCase, index) => {
            const isSelected = testCase.id === selectedCase.id;
            return (
              <button
                className={`custom-testcase-tab${isSelected ? " is-active" : ""}`}
                id={testcaseTabId(idPrefix, testCase.id)}
                key={testCase.id}
                type="button"
                role="tab"
                aria-controls={testcasePanelId(idPrefix, testCase.id)}
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onSelectCase(testCase.id)}
                onKeyDown={(event) => selectAdjacentCase(event, index)}
              >
                {testCase.name}
              </button>
            );
          })}
        </div>
        <button
          className="text-button custom-testcase-add"
          type="button"
          disabled={atCaseLimit}
          aria-label={
            atCaseLimit
              ? `Maximum of ${CUSTOM_TESTCASE_LIMITS.maxCases} testcases reached`
              : "Add testcase after selected case"
          }
          onClick={() =>
            safelyEdit(() => onAddCase(collection.selectedCaseId))
          }
        >
          + Add case
        </button>
      </div>

      <div
        className="custom-testcase-editor"
        id={testcasePanelId(idPrefix, selectedCase.id)}
        role="tabpanel"
        aria-labelledby={testcaseTabId(idPrefix, selectedCase.id)}
        tabIndex={0}
      >
        <div className="custom-testcase-toolbar">
          <label className="custom-testcase-name">
            Case name
            <input
              value={nameDraft}
              maxLength={CUSTOM_TESTCASE_LIMITS.maxCaseNameBytes}
              onChange={(event) =>
                setNameDrafts((current) => ({
                  ...current,
                  [selectedCase.id]: event.target.value,
                }))
              }
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitName();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  clearNameDraft();
                  event.currentTarget.blur();
                }
              }}
            />
          </label>

          <div
            className="custom-testcase-mode"
            role="radiogroup"
            aria-label="Testcase input mode"
          >
            <button
              type="button"
              role="radio"
              aria-checked={selectedCase.mode === "structured"}
              className={
                selectedCase.mode === "structured" ? "is-active" : undefined
              }
              onClick={() => switchMode("structured")}
            >
              Fields
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={selectedCase.mode === "raw"}
              className={selectedCase.mode === "raw" ? "is-active" : undefined}
              onClick={() => switchMode("raw")}
            >
              Raw JSON
            </button>
          </div>

          <div className="custom-testcase-case-actions">
            <button
              className="text-button"
              type="button"
              disabled={atCaseLimit}
              onClick={() =>
                safelyEdit(() => onDuplicateCase(selectedCase.id))
              }
            >
              Duplicate
            </button>
            <button
              className="text-button is-danger"
              type="button"
              disabled={!canDelete}
              aria-label={
                canDelete
                  ? `Delete ${selectedCase.name}`
                  : "At least one testcase is required"
              }
              onClick={() => safelyEdit(() => onDeleteCase(selectedCase.id))}
            >
              Delete
            </button>
          </div>
        </div>

        {selectedCase.mode === "structured" ? (
          <div className="custom-testcase-fields">
            {schema.parameters.map((parameter) => {
              const field = selectedCase.fields.find(
                (candidate) => candidate.parameterId === parameter.id,
              );
              const value = field?.text ?? "";
              const error = fieldError(value, parameter.codec);
              const inputId = `${idPrefix}-${selectedCase.id}-${parameter.id}`;
              const helpId = `${inputId}-help`;
              const errorId = `${inputId}-error`;
              return (
                <label className="custom-testcase-field" key={parameter.id}>
                  <span>
                    <strong>{parameter.name}</strong>
                    <small>{codecLabel(parameter.codec)}</small>
                  </span>
                  <textarea
                    id={inputId}
                    value={value}
                    rows={3}
                    spellCheck={false}
                    aria-invalid={Boolean(error)}
                    aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
                    onChange={(event) => {
                      const nextText = event.target.value;
                      const nextFields = selectedCase.fields.map((candidate) =>
                        candidate.parameterId === parameter.id
                          ? { ...candidate, text: nextText }
                          : candidate,
                      );
                      fieldSnapshots.current.set(selectedCase.id, nextFields);
                      safelyEdit(() =>
                        onFieldChange(
                          selectedCase.id,
                          parameter.id,
                          nextText,
                        ),
                      );
                    }}
                  />
                  <small id={helpId}>{codecGuidance(parameter.codec)}</small>
                  {error && (
                    <small className="field-error" id={errorId} role="alert">
                      {error}
                    </small>
                  )}
                </label>
              );
            })}
          </div>
        ) : (
          <label className="custom-testcase-raw">
            Raw arguments
            <textarea
              value={selectedCase.raw}
              rows={8}
              spellCheck={false}
              aria-invalid={Boolean(rawError(selectedCase.raw, schema))}
              aria-describedby={`${idPrefix}-${selectedCase.id}-raw-help${rawError(selectedCase.raw, schema) ? ` ${idPrefix}-${selectedCase.id}-raw-error` : ""}`}
              onChange={(event) => {
                const nextRaw = event.target.value;
                rawSnapshots.current.set(selectedCase.id, nextRaw);
                safelyEdit(() => onRawChange(selectedCase.id, nextRaw));
              }}
            />
            <small id={`${idPrefix}-${selectedCase.id}-raw-help`}>
              Use a JSON array of arguments, or <code>{'{"args":[...]}'}</code>.
              Switching back to fields keeps this exact raw draft available.
            </small>
            {rawError(selectedCase.raw, schema) && (
              <small
                className="field-error"
                id={`${idPrefix}-${selectedCase.id}-raw-error`}
                role="alert"
              >
                {rawError(selectedCase.raw, schema)}
              </small>
            )}
          </label>
        )}

        {editError && (
          <p className="custom-testcase-edit-error" role="alert">
            {editError}
          </p>
        )}
      </div>

      <div className="custom-testcase-run-actions">
        <button
          className="outline-button"
          type="button"
          disabled={!canRun}
          onClick={() => void onRunSelected()}
        >
          {executionState.status === "loading" ||
          executionState.status === "running"
            ? "Running…"
            : "Run selected"}
        </button>
        <button
          className="outline-button"
          type="button"
          disabled={!canRun}
          onClick={() => void onRunAll()}
        >
          Run all ({collection.cases.length})
        </button>
        {!runnerSourcePresent && (
          <small>Type some code before running a testcase.</small>
        )}
      </div>

      <ExecutionResults
        collection={collection}
        executionState={executionState}
      />
    </section>
  );
}
