"use client";

import { useId, type KeyboardEvent } from "react";
import type { PythonVerificationResult } from "../lib/python-runner.mjs";
import type { ResolvedBoundaryDrillSuite } from "../lib/boundary-suites.mjs";
import type { PracticeKind, SubmissionRecord } from "../lib/product";
import type {
  CustomTestcase,
  CustomTestcaseCollection,
  CustomTestcaseSchema,
} from "../lib/custom-testcases.mjs";
import {
  StructuredCustomTestcases,
  type CustomTestcaseModeSnapshot,
} from "./StructuredCustomTestcases";
import { SubmissionInspector } from "./SubmissionInspector";

export type ChallengeConsoleTab =
  | "examples"
  | "custom"
  | "edge-cases"
  | "output"
  | "submissions";

export type ChallengeVerificationState = {
  status: "idle" | "loading" | "running" | "passed" | "failed" | "error";
  purpose?: "examples" | "submit" | "full";
  result?: PythonVerificationResult;
  message?: string;
  submissionId?: string;
  submissionStatus?: SubmissionRecord["status"];
};

export type ChallengeCustomExecutionState = {
  status: "idle" | "loading" | "running" | "finished" | "error";
  result?: PythonVerificationResult;
  message?: string;
  caseIds?: readonly string[];
};

export type BoundaryDrillExecutionState = {
  status: "idle" | "loading" | "running" | "finished" | "error";
  packId?: string;
  caseIds?: readonly string[];
  expectedValues?: readonly unknown[];
  result?: PythonVerificationResult;
  message?: string;
};

export type ChallengeConsoleProps = {
  practiceKind: PracticeKind;
  isMock: boolean;
  isStudio?: boolean;
  runnerSourcePresent: boolean;
  checksAreBusy: boolean;
  consoleTab: ChallengeConsoleTab;
  onConsoleTabChange: (tab: ChallengeConsoleTab) => void;
  customCaseInput: string;
  defaultCustomCaseInput: string;
  onCustomCaseInputChange: (value: string) => void;
  onLoadDefaultCustomCase: () => void;
  onRunCustomCase: () => void | Promise<void>;
  customTestcaseSchema: CustomTestcaseSchema | null;
  customTestcases: CustomTestcaseCollection | null;
  onSelectCustomTestcase: (caseId: string) => void;
  onAddCustomTestcase: (afterCaseId?: string) => void;
  onDuplicateCustomTestcase: (caseId: string) => void;
  onDeleteCustomTestcase: (caseId: string) => void;
  onRenameCustomTestcase: (caseId: string, name: string) => void;
  onCustomTestcaseModeChange: (
    caseId: string,
    mode: CustomTestcase["mode"],
    snapshot: CustomTestcaseModeSnapshot,
  ) => void;
  onCustomTestcaseFieldChange: (
    caseId: string,
    parameterId: string,
    text: string,
  ) => void;
  onCustomTestcaseRawChange: (caseId: string, raw: string) => void;
  onRunCustomTestcases: (scope: "selected" | "all") => void | Promise<void>;
  customExecutionState: ChallengeCustomExecutionState;
  boundarySuite: ResolvedBoundaryDrillSuite | null;
  boundaryExecutionState: BoundaryDrillExecutionState;
  onRunBoundaryDrill: (packId: string, caseId?: string) => void | Promise<void>;
  verificationState: ChallengeVerificationState;
  exampleExpectedValues: readonly unknown[];
  onRunExamples: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
  onRunFull: () => void | Promise<void>;
  onCancelRun: () => void;
  onOpenAttemptClosure?: (submissionId: string) => void;
  submissionHistory: readonly SubmissionRecord[];
  currentItemRevision: number;
  currentVerificationRevision: number;
  currentSource: string;
  onInspectSubmission: (submission: SubmissionRecord) => void;
  onRestoreSubmission: (submission: SubmissionRecord) => void;
  canRecordMock?: boolean;
  onRecordMock?: () => void;
};

const TAB_LABELS: Readonly<Record<ChallengeConsoleTab, string>> = {
  examples: "Testcases",
  custom: "Custom",
  "edge-cases": "Edge cases",
  output: "Result",
  submissions: "Submissions",
};

function tabId(prefix: string, tab: ChallengeConsoleTab) {
  return `${prefix}-${tab}-tab`;
}

function panelId(prefix: string, tab: ChallengeConsoleTab) {
  return `${prefix}-${tab}-panel`;
}

function formatJson(value: unknown) {
  const encoded = JSON.stringify(value, null, 2);
  return encoded === undefined ? "undefined" : encoded;
}

function passedCount(result: PythonVerificationResult) {
  return result.cases.filter((testCase) => testCase.passed).length;
}

function BoundaryDrillPanel({
  boundarySuite,
  boundaryExecutionState,
  runnerSourcePresent,
  checksAreBusy,
  onRunBoundaryDrill,
}: Pick<
  ChallengeConsoleProps,
  | "boundarySuite"
  | "boundaryExecutionState"
  | "runnerSourcePresent"
  | "checksAreBusy"
  | "onRunBoundaryDrill"
>) {
  if (!boundarySuite) return null;
  const isRunning =
    boundaryExecutionState.status === "loading" ||
    boundaryExecutionState.status === "running";
  return (
    <div className="custom-case-panel boundary-drill-panel">
      <div className="custom-case-head">
        <span>
          <small>Boundary drill packs</small>
          <strong>Predict the failure mode, then run</strong>
        </span>
      </div>
      <p>
        These authored checks are private practice. They do not submit your code
        or record mastery, and expected values stay hidden until a run finishes.
      </p>
      {boundarySuite.packs.map((pack) => {
        const showsResult = boundaryExecutionState.packId === pack.id;
        return (
          <section className="custom-case-result" key={pack.id}>
            <span>{pack.kind.replaceAll("-", " ")}</span>
            <strong>{pack.title}</strong>
            <p>{pack.purpose}</p>
            <small>{pack.rationale}</small>
            <div className="custom-case-actions">
              <button
                className="outline-button"
                type="button"
                disabled={!runnerSourcePresent || checksAreBusy}
                onClick={() => void onRunBoundaryDrill(pack.id)}
              >
                {isRunning && showsResult ? "Running pack..." : "Run pack"}
              </button>
            </div>
            <ul>
              {pack.cases.map((testCase) => (
                <li key={testCase.id}>
                  <span>{testCase.name}</span>{" "}
                  <button
                    className="text-button"
                    type="button"
                    disabled={!runnerSourcePresent || checksAreBusy}
                    onClick={() => void onRunBoundaryDrill(pack.id, testCase.id)}
                  >
                    Run case
                  </button>
                </li>
              ))}
            </ul>
            {showsResult && boundaryExecutionState.status === "error" && (
              <code>{boundaryExecutionState.message}</code>
            )}
            {showsResult && boundaryExecutionState.result && (
              <div role="status" aria-live="polite" aria-atomic="true">
                <strong>
                  {boundaryExecutionState.result.ok
                    ? "Boundary checks passed"
                    : `${passedCount(boundaryExecutionState.result)}/${boundaryExecutionState.result.cases.length} boundary checks passed`}
                </strong>
                <ul>
                  {boundaryExecutionState.result.cases.map((testCase, index) => (
                    <li
                      className={testCase.passed ? "passed" : "failed"}
                      key={`${testCase.name}-${index}`}
                    >
                      <strong>{testCase.name}</strong>
                      {testCase.error ? (
                        <code>{testCase.error}</code>
                      ) : (
                        <code>
                          expected: {formatJson(boundaryExecutionState.expectedValues?.[index])}
                          {"\n"}
                          received: {formatJson(testCase.actual)}
                        </code>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function CustomCasePanel({
  customCaseInput,
  defaultCustomCaseInput,
  onCustomCaseInputChange,
  onLoadDefaultCustomCase,
  onRunCustomCase,
  customExecutionState,
  runnerSourcePresent,
  checksAreBusy,
}: Pick<
  ChallengeConsoleProps,
  | "customCaseInput"
  | "defaultCustomCaseInput"
  | "onCustomCaseInputChange"
  | "onLoadDefaultCustomCase"
  | "onRunCustomCase"
  | "customExecutionState"
  | "runnerSourcePresent"
  | "checksAreBusy"
>) {
  const customResult = customExecutionState.result;
  const customIsRunning =
    customExecutionState.status === "loading" ||
    customExecutionState.status === "running";

  return (
    <div className="custom-case-panel challenge-console-custom">
      <div className="custom-case-head">
        <span>
          <small>Custom testcase</small>
          <strong>Run your own JSON arguments</strong>
        </span>
        <button
          className="text-button"
          type="button"
          onClick={onLoadDefaultCustomCase}
        >
          Load example
        </button>
      </div>
      <label>
        JSON arguments
        <textarea
          value={customCaseInput}
          onChange={(event) => onCustomCaseInputChange(event.target.value)}
          placeholder={defaultCustomCaseInput}
          spellCheck={false}
          aria-label="Custom testcase arguments as JSON"
        />
      </label>
      <div className="custom-case-actions">
        <button
          className="outline-button"
          type="button"
          disabled={!runnerSourcePresent || checksAreBusy}
          onClick={() => void onRunCustomCase()}
        >
          {customExecutionState.status === "loading"
            ? "Loading Python..."
            : customExecutionState.status === "running"
              ? "Running testcase..."
              : "Run custom testcase"}
        </button>
        <small>This output is private practice and never records mastery.</small>
      </div>

      {(customResult || customExecutionState.status === "error") && (
        <div
          className={`custom-case-result${customExecutionState.status === "error" ? " failed" : ""}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {customExecutionState.status === "error" ? (
            <>
              <strong>Custom testcase could not run</strong>
              <code>{customExecutionState.message}</code>
            </>
          ) : (
            <>
              <span>Output</span>
              {customResult?.cases.map((testCase, index) => (
                <div key={`${testCase.name}-${index}`}>
                  <strong>{testCase.name}</strong>
                  {testCase.error ? (
                    <code>{testCase.error}</code>
                  ) : (
                    <pre>{formatJson(testCase.actual)}</pre>
                  )}
                </div>
              ))}
              {customResult?.stdout && (
                <div>
                  <strong>Standard output</strong>
                  <pre>{customResult.stdout}</pre>
                </div>
              )}
              {customResult?.stderr && (
                <div>
                  <strong>Standard error</strong>
                  <pre>{customResult.stderr}</pre>
                </div>
              )}
              <small>{Math.round(customResult?.durationMs ?? 0)} ms</small>
            </>
          )}
        </div>
      )}
      {!customResult &&
        customExecutionState.status !== "error" &&
        !customIsRunning && (
          <p className="challenge-console-empty">
            Add one JSON testcase, then run it to inspect the returned value.
          </p>
        )}
    </div>
  );
}

function VerificationOutput({
  verificationState,
  exampleExpectedValues,
  isMock,
  onOpenAttemptClosure,
}: Pick<
  ChallengeConsoleProps,
  | "verificationState"
  | "exampleExpectedValues"
  | "isMock"
  | "onOpenAttemptClosure"
>) {
  const result = verificationState.result;
  const showsExampleDetails =
    verificationState.purpose === "examples" && !isMock;

  if (verificationState.status === "error") {
    return (
      <div
        className="python-verification-results failed"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <strong>Checks could not run</strong>
        {showsExampleDetails && verificationState.message && (
          <code>{verificationState.message}</code>
        )}
        {!showsExampleDetails && (
          <p className="mock-test-note">
            The judge could not finish this run. Individual judge details stay
            private.
          </p>
        )}
      </div>
    );
  }

  if (!result) {
    const isRunning =
      verificationState.status === "loading" ||
      verificationState.status === "running";
    return (
      <div
        className="challenge-console-empty"
        role={isRunning ? "status" : undefined}
        aria-live={isRunning ? "polite" : undefined}
      >
        {isRunning
          ? verificationState.status === "loading"
            ? "Loading the local Python judge..."
            : "Running checks..."
          : "Run the examples or submit your solution to see a result."}
      </div>
    );
  }

  const passed = passedCount(result);
  const isSubmission = verificationState.purpose === "submit";
  const isRedacted = isMock || isSubmission;
  const repairableSubmission = [
    "wrong-answer",
    "compile-error",
    "runtime-error",
    "time-limit",
    "invalid-entrypoint",
  ].includes(verificationState.submissionStatus ?? "");

  return (
    <div
      className={`python-verification-results ${result.ok ? "passed" : "failed"}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <strong>
        {isSubmission
          ? result.ok
            ? "Accepted"
            : "Not accepted"
          : result.ok
            ? `All ${result.cases.length} checks passed`
            : `${passed}/${result.cases.length} checks passed`}
      </strong>
      <small>{Math.round(result.durationMs)} ms</small>

      {isSubmission &&
        !isMock &&
        !result.ok &&
        repairableSubmission &&
        verificationState.submissionId &&
        onOpenAttemptClosure ? (
        <button
          className="outline-button failure-repair-link"
          type="button"
          onClick={() => onOpenAttemptClosure(verificationState.submissionId!)}
        >
          Open repair plan →
        </button>
      ) : null}

      {isRedacted ? (
        <p className="mock-test-note">
          Unshown judge details stay out of the interface, but they ship in this local app and are not a security boundary. Use the aggregate
          result to revise your edge cases.
        </p>
      ) : showsExampleDetails ? (
        <>
          {result.setupError && <code>{result.setupError}</code>}
          <ul>
            {result.cases.map((testCase, index) => (
              <li
                className={testCase.passed ? "passed" : "failed"}
                key={`${testCase.name}-${index}`}
              >
                <span aria-hidden="true">{testCase.passed ? "OK" : "X"}</span>
                <strong>{testCase.name}</strong>
                {testCase.error ? (
                  <code>{testCase.error}</code>
                ) : (
                  <code>
                    expected: {formatJson(exampleExpectedValues[index])}
                    {"\n"}
                    received: {formatJson(testCase.actual)}
                  </code>
                )}
              </li>
            ))}
          </ul>
          {result.stdout && (
            <div className="challenge-console-stream">
              <strong>Standard output</strong>
              <pre>{result.stdout}</pre>
            </div>
          )}
          {result.stderr && (
            <div className="challenge-console-stream">
              <strong>Standard error</strong>
              <pre>{result.stderr}</pre>
            </div>
          )}
        </>
      ) : (
        <p className="mock-test-note">
          This verification run is summarized without individual judge cases.
        </p>
      )}
    </div>
  );
}

function SubmissionHistory({
  submissions,
  currentSource,
  currentItemRevision,
  currentVerificationRevision,
  checksAreBusy,
  onInspectSubmission,
  onRestoreSubmission,
}: {
  submissions: readonly SubmissionRecord[];
  currentSource: string;
  currentItemRevision: number;
  currentVerificationRevision: number;
  checksAreBusy: boolean;
  onInspectSubmission: (submission: SubmissionRecord) => void;
  onRestoreSubmission: (submission: SubmissionRecord) => void;
}) {
  return (
    <SubmissionInspector
      submissions={submissions}
      currentSource={currentSource}
      currentItemRevision={currentItemRevision}
      currentVerificationRevision={currentVerificationRevision}
      checksAreBusy={checksAreBusy}
      onInspect={onInspectSubmission}
      onRestoreSubmission={onRestoreSubmission}
    />
  );
}

export function ChallengeConsole({
  practiceKind,
  isMock,
  isStudio = false,
  runnerSourcePresent,
  checksAreBusy,
  consoleTab,
  onConsoleTabChange,
  customCaseInput,
  defaultCustomCaseInput,
  onCustomCaseInputChange,
  onLoadDefaultCustomCase,
  onRunCustomCase,
  customTestcaseSchema,
  customTestcases,
  onSelectCustomTestcase,
  onAddCustomTestcase,
  onDuplicateCustomTestcase,
  onDeleteCustomTestcase,
  onRenameCustomTestcase,
  onCustomTestcaseModeChange,
  onCustomTestcaseFieldChange,
  onCustomTestcaseRawChange,
  onRunCustomTestcases,
  customExecutionState,
  boundarySuite,
  boundaryExecutionState,
  onRunBoundaryDrill,
  verificationState,
  exampleExpectedValues,
  onRunExamples,
  onSubmit,
  onRunFull,
  onCancelRun,
  onOpenAttemptClosure,
  submissionHistory,
  currentItemRevision,
  currentVerificationRevision,
  currentSource,
  onInspectSubmission,
  onRestoreSubmission,
  canRecordMock = false,
  onRecordMock,
}: ChallengeConsoleProps) {
  const idPrefix = `challenge-console-${useId().replace(/:/g, "")}`;
  const isSolving = practiceKind === "solving";
  const availableTabs: readonly ChallengeConsoleTab[] = isMock
    ? ["examples", "output"]
    : isSolving
      ? [
          "examples",
          "custom",
          ...(boundarySuite ? (["edge-cases"] as const) : []),
          "output",
          "submissions",
        ]
      : ["examples", "output"];
  const activeTab = availableTabs.includes(consoleTab)
    ? consoleTab
    : availableTabs[0];

  function selectAdjacentTab(
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: ChallengeConsoleTab,
  ) {
    const currentIndex = availableTabs.indexOf(currentTab);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? availableTabs.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % availableTabs.length
            : event.key === "ArrowLeft"
              ? (currentIndex - 1 + availableTabs.length) %
                availableTabs.length
              : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = availableTabs[nextIndex];
    onConsoleTabChange(nextTab);
    document.getElementById(tabId(idPrefix, nextTab))?.focus();
  }

  const isRunning =
    verificationState.status === "loading" ||
    verificationState.status === "running";

  return (
    <section
      className={`python-verification challenge-console${isMock ? " is-mock" : ""}`}
      aria-label="Code runner and submissions"
    >
      <header className="challenge-console-header">
        <div>
          <span className="eyebrow">Browser Python - local judge</span>
          <h2>{isSolving ? "Testcases and results" : "Check your solution"}</h2>
        </div>
        <p>
          {isSolving
            ? "Run examples while you iterate. Submit checks the complete local judge suite."
            : "Your code stays on this device and runs in a fresh Python worker."}
        </p>
      </header>

      <div
        className="challenge-console-tabs"
        role="tablist"
        aria-label="Test console panels"
        aria-orientation="horizontal"
      >
        {availableTabs.map((tab) => (
          <button
            className={`challenge-console-tab${activeTab === tab ? " is-active" : ""}`}
            id={tabId(idPrefix, tab)}
            key={tab}
            type="button"
            role="tab"
            aria-controls={panelId(idPrefix, tab)}
            aria-selected={activeTab === tab}
            aria-label={
              tab === "submissions" && submissionHistory.length > 0
                ? `Submissions, ${submissionHistory.length} ${submissionHistory.length === 1 ? "submission" : "submissions"}`
                : TAB_LABELS[tab]
            }
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => onConsoleTabChange(tab)}
            onKeyDown={(event) => selectAdjacentTab(event, tab)}
          >
            {TAB_LABELS[tab]}
            {tab === "submissions" && submissionHistory.length > 0 && (
              <span className="challenge-console-tab-count">
                {submissionHistory.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        className={`challenge-console-panel challenge-console-${activeTab}-panel`}
        id={panelId(idPrefix, activeTab)}
        role="tabpanel"
        aria-labelledby={tabId(idPrefix, activeTab)}
        tabIndex={0}
      >
        {activeTab === "examples" && (
          <div className="challenge-console-example-summary">
            <strong>Start with the examples</strong>
            <p>
              Run the published examples for fast feedback. A submission checks
              additional edge cases without revealing their inputs or outputs.
            </p>
            {verificationState.purpose === "examples" &&
              verificationState.result && (
                <VerificationOutput
                  verificationState={verificationState}
                  exampleExpectedValues={exampleExpectedValues}
                  isMock={isMock}
                  onOpenAttemptClosure={onOpenAttemptClosure}
                />
              )}
          </div>
        )}
        {activeTab === "custom" && !isMock && isSolving && (
          customTestcaseSchema && customTestcases ? (
            <StructuredCustomTestcases
              schema={customTestcaseSchema}
              collection={customTestcases}
              executionState={customExecutionState}
              runnerSourcePresent={runnerSourcePresent}
              checksAreBusy={checksAreBusy}
              onSelectCase={onSelectCustomTestcase}
              onAddCase={onAddCustomTestcase}
              onDuplicateCase={onDuplicateCustomTestcase}
              onDeleteCase={onDeleteCustomTestcase}
              onRenameCase={onRenameCustomTestcase}
              onModeChange={onCustomTestcaseModeChange}
              onFieldChange={onCustomTestcaseFieldChange}
              onRawChange={onCustomTestcaseRawChange}
              onRunSelected={() => onRunCustomTestcases("selected")}
              onRunAll={() => onRunCustomTestcases("all")}
            />
          ) : (
            <CustomCasePanel
              customCaseInput={customCaseInput}
              defaultCustomCaseInput={defaultCustomCaseInput}
              onCustomCaseInputChange={onCustomCaseInputChange}
              onLoadDefaultCustomCase={onLoadDefaultCustomCase}
              onRunCustomCase={onRunCustomCase}
              customExecutionState={customExecutionState}
              runnerSourcePresent={runnerSourcePresent}
              checksAreBusy={checksAreBusy}
            />
          )
        )}
        {activeTab === "edge-cases" && !isMock && isSolving && (
          <BoundaryDrillPanel
            boundarySuite={boundarySuite}
            boundaryExecutionState={boundaryExecutionState}
            runnerSourcePresent={runnerSourcePresent}
            checksAreBusy={checksAreBusy}
            onRunBoundaryDrill={onRunBoundaryDrill}
          />
        )}
        {activeTab === "output" && (
          <VerificationOutput
            verificationState={verificationState}
            exampleExpectedValues={exampleExpectedValues}
            isMock={isMock}
            onOpenAttemptClosure={onOpenAttemptClosure}
          />
        )}
        {activeTab === "submissions" && !isMock && isSolving && (
          <SubmissionHistory
            submissions={submissionHistory}
            currentItemRevision={currentItemRevision}
            currentVerificationRevision={currentVerificationRevision}
            currentSource={currentSource}
            checksAreBusy={checksAreBusy}
            onInspectSubmission={onInspectSubmission}
            onRestoreSubmission={onRestoreSubmission}
          />
        )}
      </div>

      <footer className="python-verification-actions challenge-console-actions">
        {checksAreBusy && (
          <button
            className="outline-button cancel-run"
            type="button"
            onClick={onCancelRun}
          >
            Cancel run
          </button>
        )}
        {isSolving && (!isMock || isStudio) ? (
          <>
            <button
              className="outline-button"
              type="button"
              disabled={!runnerSourcePresent || checksAreBusy}
              onClick={() => void onRunExamples()}
            >
              {isRunning && verificationState.purpose === "examples"
                ? "Running examples..."
                : "Run examples"}
            </button>
            <button
              className="primary-button submit-solution"
              type="button"
              disabled={!runnerSourcePresent || checksAreBusy}
              onClick={() => void onSubmit()}
            >
              {isRunning && verificationState.purpose === "submit"
                ? "Judging solution..."
                : "Submit solution"}
            </button>
            <small>Ctrl/Cmd+Enter runs examples; add Shift to submit</small>
          </>
        ) : (
          <button
            className="primary-button"
            type="button"
            disabled={!runnerSourcePresent || checksAreBusy}
            onClick={() => void onRunFull()}
          >
            {verificationState.status === "loading"
              ? "Loading Python..."
              : verificationState.status === "running"
                ? "Running checks..."
                : "Run checks"}
          </button>
        )}

        {!runnerSourcePresent && (
          <small>Type some code before running checks.</small>
        )}

        {isMock &&
          !isStudio &&
          canRecordMock &&
          onRecordMock &&
          verificationState.purpose === "full" &&
          verificationState.result?.ok && (
            <button
              className="primary-button record-solve"
              type="button"
              disabled={checksAreBusy}
              onClick={onRecordMock}
            >
              Record verified solve
            </button>
          )}
      </footer>
    </section>
  );
}
