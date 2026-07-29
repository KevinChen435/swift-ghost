"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  INTERVIEW_PATTERN_ORDER,
  IOS_PATTERN_ORDER,
  PYTHON_PATTERN_ORDER,
  type Difficulty,
  type Pattern,
} from "../data/problems";
import {
  CUSTOM_CHALLENGE_LIMITS,
  customChallengeInputFromBundle,
  normalizeCustomChallenge,
  type CustomChallengeCaseInput,
  type CustomChallengeInput,
  type CustomChallengeParameterInput,
} from "../lib/custom-challenges";
import type {
  PythonCodec,
  PythonComparator,
} from "../lib/python-runner.mjs";
import { createPythonRunner } from "../lib/python-runner.mjs";
import type {
  CodeLanguage,
  CustomItemInput,
  PracticeItem,
} from "../lib/items";

type BuilderStep = "basics" | "contract" | "tests" | "solution";
type EditableCase = Omit<CustomChallengeCaseInput, "args" | "expected"> & {
  argsText: string;
  expectedText: string;
};

const BUILDER_STEPS: readonly { id: BuilderStep; label: string; number: string }[] = [
  { id: "basics", label: "Basics", number: "01" },
  { id: "contract", label: "Contract", number: "02" },
  { id: "tests", label: "Judge cases", number: "03" },
  { id: "solution", label: "Solution", number: "04" },
];

const CODEC_OPTIONS: readonly { value: PythonCodec; label: string }[] = [
  { value: "json", label: "JSON value" },
  { value: "linkedList", label: "Linked list" },
  { value: "cyclicLinkedList", label: "Cyclic linked list" },
  { value: "binaryTree", label: "Binary tree" },
];

const COMPARATOR_OPTIONS: readonly {
  value: PythonComparator;
  label: string;
}[] = [
  { value: "deepEqual", label: "Exact deep equality" },
  { value: "unordered", label: "Unordered collection" },
  { value: "unorderedNested", label: "Unordered nested groups" },
  { value: "validTopologicalOrder", label: "Valid topological order" },
];

const DEFAULT_PARAMETER: CustomChallengeParameterInput = {
  name: "values",
  type: "list[int]",
  description: "Values to process.",
  codec: "json",
};

const DEFAULT_CASES: EditableCase[] = [
  {
    id: "sample-basic",
    name: "basic example",
    visibility: "sample",
    argsText: "[[1, 2, 3]]",
    expectedText: "[1, 2, 3]",
    outputCodec: "json",
    comparator: "deepEqual",
  },
  {
    id: "hidden-empty",
    name: "handles the empty boundary",
    visibility: "hidden",
    argsText: "[[]]",
    expectedText: "[]",
    outputCodec: "json",
    comparator: "deepEqual",
  },
];

function defaultStarter(
  kind: "function" | "method",
  className: string,
  functionName: string,
  parameters: readonly CustomChallengeParameterInput[],
) {
  const args = parameters.map((parameter) => parameter.name).join(", ");
  if (kind === "method")
    return `class ${className}:\n    def ${functionName}(self${args ? `, ${args}` : ""}):\n        raise NotImplementedError("Implement ${functionName}")`;
  return `def ${functionName}(${args}):\n    raise NotImplementedError("Implement ${functionName}")`;
}

function editableCases(input: readonly CustomChallengeCaseInput[]) {
  return input.map((testCase) => ({
    id: testCase.id,
    name: testCase.name,
    visibility: testCase.visibility,
    argsText: JSON.stringify(testCase.args, null, 2),
    expectedText: JSON.stringify(testCase.expected, null, 2),
    outputCodec: testCase.outputCodec ?? "json",
    comparator: testCase.comparator ?? "deepEqual",
  }));
}

function parseJson(value: string, label: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

function useDialogKeyboard(
  onClose: () => void,
  dialogRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>("[data-modal-autofocus]");
    first?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [dialogRef, onClose]);
}

export function CustomChallengeDialog({
  item,
  onClose,
  onSave,
}: {
  item?: PracticeItem;
  onClose: () => void;
  onSave: (input: CustomItemInput) => void;
}) {
  const existingChallenge =
    item?.challenge && item.verification && item.starterCode
      ? customChallengeInputFromBundle({
          challenge: item.challenge,
          verification: item.verification,
          starterCode: item.starterCode,
        })
      : null;
  const [step, setStep] = useState<BuilderStep>("basics");
  const [title, setTitle] = useState(item?.title ?? "");
  const [track, setTrack] = useState<"interview" | "ios">(
    item?.track ?? "interview",
  );
  const [language, setLanguage] = useState<CodeLanguage>(
    item?.language ?? "python",
  );
  const [pattern, setPattern] = useState<Pattern>(
    item?.pattern ?? PYTHON_PATTERN_ORDER[0],
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    item?.difficulty ?? "Easy",
  );
  const [challengeEnabled, setChallengeEnabled] = useState(
    Boolean(existingChallenge),
  );
  const [statement, setStatement] = useState(
    existingChallenge?.statement ??
      "Given a list of integers, return the requested transformed list.",
  );
  const [entrypointKind, setEntrypointKind] = useState<"function" | "method">(
    existingChallenge?.entrypoint.kind ?? "function",
  );
  const [functionName, setFunctionName] = useState(
    existingChallenge?.entrypoint.name ?? "example",
  );
  const [className, setClassName] = useState(
    existingChallenge?.entrypoint.kind === "method"
      ? existingChallenge.entrypoint.className
      : "Solution",
  );
  const [parameters, setParameters] = useState<CustomChallengeParameterInput[]>(
    existingChallenge?.parameters.length
      ? [...existingChallenge.parameters]
      : [{ ...DEFAULT_PARAMETER }],
  );
  const [returns, setReturns] = useState(
    existingChallenge?.returns ?? "list[int] — the transformed values.",
  );
  const [constraintsText, setConstraintsText] = useState(
    existingChallenge?.constraints.join("\n") ??
      "values may be empty.\nEvery value is an integer.\nDo not mutate the input list.",
  );
  const [notesText, setNotesText] = useState(
    existingChallenge?.notes?.join("\n") ?? "",
  );
  const [exampleExplanation, setExampleExplanation] = useState(
    existingChallenge?.exampleExplanation ?? "",
  );
  const [cases, setCases] = useState<EditableCase[]>(
    existingChallenge ? editableCases(existingChallenge.cases) : DEFAULT_CASES,
  );
  const [starterCode, setStarterCode] = useState(
    existingChallenge?.starterCode ??
      defaultStarter("function", "Solution", "example", [DEFAULT_PARAMETER]),
  );
  const [code, setCode] = useState(
    item?.code ??
      "def example(values: list[int]) -> list[int]:\n    return list(values)",
  );
  const [cue, setCue] = useState(item?.cue ?? "");
  const [invariant, setInvariant] = useState(item?.invariant ?? "");
  const [complexity, setComplexity] = useState(item?.complexity ?? "");
  const [languageNote, setLanguageNote] = useState(item?.languageNote ?? "");
  const [referenceStatus, setReferenceStatus] = useState<
    "idle" | "running" | "passed" | "failed"
  >("idle");
  const [referenceMessage, setReferenceMessage] = useState("");
  const [validatedFingerprint, setValidatedFingerprint] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const runnerRef = useRef<ReturnType<typeof createPythonRunner> | null>(null);
  const referenceValidationRunId = useRef(0);
  const authoringFingerprint = JSON.stringify([
    title,
    track,
    language,
    difficulty,
    pattern,
    challengeEnabled,
    statement,
    entrypointKind,
    className,
    functionName,
    parameters,
    returns,
    constraintsText,
    notesText,
    exampleExplanation,
    cases,
    starterCode,
    code,
    cue,
    invariant,
    complexity,
    languageNote,
  ]);
  const initialAuthoringFingerprint = useRef(authoringFingerprint);
  const requestClose = useCallback(() => {
    if (
      authoringFingerprint !== initialAuthoringFingerprint.current &&
      !window.confirm("Discard your unsaved practice item changes?")
    )
      return;
    onClose();
  }, [authoringFingerprint, onClose]);
  useDialogKeyboard(requestClose, dialogRef);
  useEffect(
    () => () => {
      runnerRef.current?.dispose();
      runnerRef.current = null;
    },
    [],
  );

  const patterns =
    track === "ios"
      ? IOS_PATTERN_ORDER
      : language === "python"
        ? PYTHON_PATTERN_ORDER
        : INTERVIEW_PATTERN_ORDER;
  const challengeAvailable = track === "interview" && language === "python";

  const challengeValidation = useMemo(() => {
    if (!challengeEnabled || !challengeAvailable)
      return { input: null as CustomChallengeInput | null, error: "" };
    try {
      const parsedCases: CustomChallengeCaseInput[] = cases.map(
        (testCase, index) => {
          const args = parseJson(
            testCase.argsText,
            `Case ${index + 1} arguments`,
          );
          if (!Array.isArray(args))
            throw new Error(`Case ${index + 1} arguments must be a JSON array`);
          return {
            id: testCase.id,
            name: testCase.name,
            visibility: testCase.visibility,
            args,
            expected: parseJson(
              testCase.expectedText,
              `Case ${index + 1} expected output`,
            ),
            outputCodec: testCase.outputCodec,
            comparator: testCase.comparator,
          };
        },
      );
      const input: CustomChallengeInput = {
        statement,
        entrypoint:
          entrypointKind === "method"
            ? { kind: "method", className, name: functionName }
            : { kind: "function", name: functionName },
        parameters,
        returns,
        constraints: constraintsText.split("\n"),
        notes: notesText.split("\n"),
        exampleExplanation,
        starterCode,
        cases: parsedCases,
      };
      normalizeCustomChallenge(input, {
        stableId: item?.itemId ?? "custom:preview",
        title,
        revision: item?.verification?.revision ?? 1,
      });
      return { input, error: "" };
    } catch (error) {
      return {
        input: null,
        error:
          error instanceof Error ? error.message : "Challenge is not valid yet",
      };
    }
  }, [
    challengeEnabled,
    challengeAvailable,
    cases,
    statement,
    entrypointKind,
    className,
    functionName,
    parameters,
    returns,
    constraintsText,
    notesText,
    exampleExplanation,
    starterCode,
    item,
    title,
  ]);

  const baseValid =
    title.trim().length >= 1 &&
    title.trim().length <= 80 &&
    code.trim().length >= 10 &&
    code.length <= 20_000;
  const valid =
    baseValid &&
    (!challengeEnabled || Boolean(challengeValidation.input));
  const currentFingerprint = useMemo(
    () => JSON.stringify([code, challengeValidation.input]),
    [code, challengeValidation.input],
  );
  const effectiveReferenceStatus =
    validatedFingerprint === currentFingerprint ? referenceStatus : "idle";
  const effectiveReferenceMessage =
    validatedFingerprint === currentFingerprint ? referenceMessage : "";
  const canSave =
    valid && (!challengeEnabled || effectiveReferenceStatus === "passed");
  const sampleCount = cases.filter(
    (testCase) => testCase.visibility === "sample",
  ).length;
  const hiddenCount = cases.length - sampleCount;
  const stepIndex = BUILDER_STEPS.findIndex((candidate) => candidate.id === step);

  async function validateReference() {
    if (!challengeValidation.input || !baseValid) return;
    const runId = ++referenceValidationRunId.current;
    runnerRef.current?.dispose();
    setValidatedFingerprint(currentFingerprint);
    setReferenceStatus("running");
    setReferenceMessage("Starting the local Python judge…");
    const runner = createPythonRunner();
    runnerRef.current = runner;
    try {
      const bundle = normalizeCustomChallenge(challengeValidation.input, {
        stableId: item?.itemId ?? "custom:preview",
        title,
        revision: item?.verification?.revision ?? 1,
      });
      const starterResult = await runner.verify(
        bundle.starterCode,
        bundle.verification,
      );
      if (runId !== referenceValidationRunId.current) return;
      if (starterResult.setupError) {
        setReferenceStatus("failed");
        setReferenceMessage(
          `Starter code could not initialize: ${starterResult.setupError}`,
        );
        return;
      }
      const result = await runner.verify(code, bundle.verification);
      if (runId !== referenceValidationRunId.current) return;
      if (result.ok) {
        setReferenceStatus("passed");
        setReferenceMessage(
          `Reference passed all ${result.cases.length} judge cases in ${Math.max(1, Math.round(result.durationMs))} ms.`,
        );
      } else {
        const failed = result.cases.find((testCase) => !testCase.passed);
        setReferenceStatus("failed");
        setReferenceMessage(
          result.setupError ||
            failed?.error ||
            `${failed?.name ?? "A judge case"} did not match the expected output.`,
        );
      }
    } catch (error) {
      if (runId !== referenceValidationRunId.current) return;
      setReferenceStatus("failed");
      setReferenceMessage(
        error instanceof Error ? error.message : "Reference validation failed",
      );
    } finally {
      runner.dispose();
      if (runnerRef.current === runner) runnerRef.current = null;
    }
  }

  function updateParameter(
    index: number,
    patch: Partial<CustomChallengeParameterInput>,
  ) {
    setParameters((current) =>
      current.map((parameter, candidate) =>
        candidate === index ? { ...parameter, ...patch } : parameter,
      ),
    );
  }

  function updateCase(index: number, patch: Partial<EditableCase>) {
    setCases((current) =>
      current.map((testCase, candidate) =>
        candidate === index ? { ...testCase, ...patch } : testCase,
      ),
    );
  }

  function regenerateStarter() {
    setStarterCode(
      defaultStarter(entrypointKind, className, functionName, parameters),
    );
  }

  function changeLanguage(next: CodeLanguage) {
    setLanguage(next);
    setPattern(
      next === "python"
        ? PYTHON_PATTERN_ORDER[0]
        : INTERVIEW_PATTERN_ORDER[0],
    );
    if (next !== "python") setChallengeEnabled(false);
    if (!item)
      setCode(
        next === "python"
          ? "def example(values: list[int]) -> list[int]:\n    return list(values)"
          : "func example(_ values: [Int]) -> [Int] {\n    values\n}",
      );
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && requestClose()
      }
    >
      <section
        ref={dialogRef}
        className="custom-dialog challenge-studio-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-title"
        tabIndex={-1}
      >
        <button className="dialog-close" onClick={requestClose} aria-label="Close">
          ×
        </button>
        <header className="challenge-studio-header">
          <div>
            <span className="eyebrow">
              Device-local challenge studio
              {item ? ` · revision ${item.contentRevision}` : ""}
            </span>
            <h2 id="custom-title">
              {item ? "Edit practice item" : "Build a practice item"}
            </h2>
            <p>
              Author the prompt, callable contract, examples, hidden checks, and
              solution. Nothing in this studio uploads to the community.
            </p>
          </div>
          <div className="challenge-studio-status" aria-live="polite">
            <strong>
              {challengeEnabled ? `${sampleCount} sample · ${hiddenCount} hidden` : "Typing drill"}
            </strong>
            <span>
              {canSave
                ? challengeEnabled
                  ? "Reference verified"
                  : "Ready to save"
                : effectiveReferenceStatus === "running"
                  ? "Checking every judge case…"
                  : effectiveReferenceMessage || challengeValidation.error || "Complete the required fields"}
            </span>
          </div>
        </header>

        <nav className="challenge-builder-steps" aria-label="Challenge builder steps">
          {BUILDER_STEPS.map((candidate) => (
            <button
              key={candidate.id}
              className={candidate.id === step ? "active" : ""}
              aria-current={candidate.id === step ? "step" : undefined}
              onClick={() => setStep(candidate.id)}
            >
              <span>{candidate.number}</span>
              {candidate.label}
            </button>
          ))}
        </nav>

        <div className="challenge-builder-body">
          {step === "basics" ? (
            <div className="custom-form challenge-builder-panel">
              <div className="builder-section-heading">
                <span>01 · Basics</span>
                <h3>Choose what you want to practice</h3>
                <p>Runnable challenges unlock Run examples, Submit, verdicts, and submission history.</p>
              </div>
              <label>
                <span>Title</span>
                <input
                  data-modal-autofocus="true"
                  maxLength={80}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Merge overlapping windows"
                />
              </label>
              <div className="form-pair">
                <label>
                  <span>Track</span>
                  <select
                    value={track}
                    onChange={(event) => {
                      const next = event.target.value as "interview" | "ios";
                      setTrack(next);
                      if (next === "ios") {
                        setLanguage("swift");
                        setPattern(IOS_PATTERN_ORDER[0]);
                        setChallengeEnabled(false);
                      } else {
                        setPattern(
                          language === "python"
                            ? PYTHON_PATTERN_ORDER[0]
                            : INTERVIEW_PATTERN_ORDER[0],
                        );
                      }
                    }}
                  >
                    <option value="interview">Coding interviews</option>
                    <option value="ios">iOS &amp; Swift fundamentals</option>
                  </select>
                </label>
                <label>
                  <span>Language</span>
                  <select
                    value={language}
                    disabled={track === "ios"}
                    onChange={(event) =>
                      changeLanguage(event.target.value as CodeLanguage)
                    }
                  >
                    <option value="python">Python</option>
                    <option value="swift">Swift</option>
                  </select>
                </label>
              </div>
              <div className="form-pair">
                <label>
                  <span>Pattern</span>
                  <select
                    value={pattern}
                    onChange={(event) => setPattern(event.target.value as Pattern)}
                  >
                    {patterns.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Difficulty</span>
                  <select
                    value={difficulty}
                    onChange={(event) =>
                      setDifficulty(event.target.value as Difficulty)
                    }
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </label>
              </div>
              {challengeAvailable ? (
                <fieldset className="practice-kind-picker">
                  <legend>Practice experience</legend>
                  <label className={!challengeEnabled ? "active" : ""}>
                    <input
                      type="radio"
                      name="practice-kind"
                      checked={!challengeEnabled}
                      onChange={() => setChallengeEnabled(false)}
                    />
                    <span>
                      <strong>Ghost typing drill</strong>
                      <small>Progressive masks and exact reproduction.</small>
                    </span>
                  </label>
                  <label className={challengeEnabled ? "active" : ""}>
                    <input
                      type="radio"
                      name="practice-kind"
                      checked={challengeEnabled}
                      onChange={() => setChallengeEnabled(true)}
                    />
                    <span>
                      <strong>Runnable coding challenge</strong>
                      <small>Prompt, examples, hidden judge, and submissions.</small>
                    </span>
                  </label>
                </fieldset>
              ) : (
                <div className="builder-callout">
                  Runnable local judging currently supports Python. Swift and iOS items remain progressive typing and recall drills.
                </div>
              )}
            </div>
          ) : null}

          {step === "contract" ? (
            <div className="custom-form challenge-builder-panel">
              <div className="builder-section-heading">
                <span>02 · Contract</span>
                <h3>Write the problem the way an interviewer would</h3>
                <p>The function signature and codecs become the judge boundary.</p>
              </div>
              {!challengeEnabled ? (
                <div className="builder-empty-state">
                  <strong>This item is a typing drill.</strong>
                  <span>Enable Runnable coding challenge in Basics to author a judge contract.</span>
                  <button className="outline-button" onClick={() => setStep("basics")}>Open Basics</button>
                </div>
              ) : (
                <>
                  <label>
                    <span>Problem statement</span>
                    <textarea
                      className="builder-prose-input"
                      maxLength={CUSTOM_CHALLENGE_LIMITS.statementCharacters}
                      value={statement}
                      onChange={(event) => setStatement(event.target.value)}
                      placeholder="Describe the input, required output, and important behavior without revealing the solution."
                    />
                  </label>
                  <div className="form-pair">
                    <label>
                      <span>Callable style</span>
                      <select
                        value={entrypointKind}
                        onChange={(event) =>
                          setEntrypointKind(
                            event.target.value as "function" | "method",
                          )
                        }
                      >
                        <option value="function">Top-level function</option>
                        <option value="method">Class method</option>
                      </select>
                    </label>
                    {entrypointKind === "method" ? (
                      <label>
                        <span>Class name</span>
                        <input
                          value={className}
                          onChange={(event) => setClassName(event.target.value)}
                          placeholder="Solution"
                        />
                      </label>
                    ) : (
                      <label>
                        <span>Function name</span>
                        <input
                          value={functionName}
                          onChange={(event) => setFunctionName(event.target.value)}
                          placeholder="solve"
                        />
                      </label>
                    )}
                  </div>
                  {entrypointKind === "method" ? (
                    <label>
                      <span>Method name</span>
                      <input
                        value={functionName}
                        onChange={(event) => setFunctionName(event.target.value)}
                        placeholder="solve"
                      />
                    </label>
                  ) : null}
                  <div className="builder-list-heading">
                    <div>
                      <span>Parameters</span>
                      <small>JSON is right for most arrays, strings, maps, and primitives.</small>
                    </div>
                    <button
                      className="outline-button compact-button"
                      disabled={parameters.length >= CUSTOM_CHALLENGE_LIMITS.parameters}
                      onClick={() =>
                        setParameters((current) => [
                          ...current,
                          {
                            name: `arg${current.length + 1}`,
                            type: "int",
                            description: "Describe this input.",
                            codec: "json",
                          },
                        ])
                      }
                    >
                      + Parameter
                    </button>
                  </div>
                  <div className="builder-repeat-list">
                    {parameters.map((parameter, index) => (
                      <article className="builder-repeat-card" key={`${index}-${parameter.name}`}>
                        <div className="builder-repeat-index">{String(index + 1).padStart(2, "0")}</div>
                        <div className="builder-repeat-grid parameter-grid">
                          <label>
                            <span>Name</span>
                            <input
                              value={parameter.name}
                              onChange={(event) =>
                                updateParameter(index, { name: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span>Python type</span>
                            <input
                              value={parameter.type}
                              onChange={(event) =>
                                updateParameter(index, { type: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span>Input shape</span>
                            <select
                              value={parameter.codec}
                              onChange={(event) =>
                                updateParameter(index, {
                                  codec: event.target.value as PythonCodec,
                                })
                              }
                            >
                              {CODEC_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="builder-span-two">
                            <span>Description</span>
                            <input
                              value={parameter.description}
                              onChange={(event) =>
                                updateParameter(index, { description: event.target.value })
                              }
                            />
                          </label>
                        </div>
                        <button
                          className="icon-danger-button"
                          aria-label={`Remove parameter ${index + 1}`}
                          onClick={() =>
                            setParameters((current) =>
                              current.filter((_, candidate) => candidate !== index),
                            )
                          }
                        >
                          ×
                        </button>
                      </article>
                    ))}
                  </div>
                  <label>
                    <span>Return contract</span>
                    <input
                      maxLength={500}
                      value={returns}
                      onChange={(event) => setReturns(event.target.value)}
                      placeholder="list[int] — values in the required order."
                    />
                  </label>
                  <div className="form-pair">
                    <label>
                      <span>Constraints · one per line</span>
                      <textarea
                        value={constraintsText}
                        onChange={(event) => setConstraintsText(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Notes · optional, one per line</span>
                      <textarea
                        value={notesText}
                        onChange={(event) => setNotesText(event.target.value)}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {step === "tests" ? (
            <div className="custom-form challenge-builder-panel">
              <div className="builder-section-heading">
                <span>03 · Judge cases</span>
                <h3>Separate examples from the real submission check</h3>
                <p>Samples are visible during Run examples. Hidden cases reveal only their verdict after Submit.</p>
              </div>
              {!challengeEnabled ? (
                <div className="builder-empty-state">
                  <strong>No judge cases for a typing drill.</strong>
                  <span>Enable a runnable challenge in Basics first.</span>
                </div>
              ) : (
                <>
                  <div className="builder-list-heading">
                    <div>
                      <span>{cases.length} cases</span>
                      <small>{sampleCount} visible · {hiddenCount} hidden · argument count must match the contract.</small>
                    </div>
                    <button
                      className="outline-button compact-button"
                      disabled={cases.length >= CUSTOM_CHALLENGE_LIMITS.cases}
                      onClick={() =>
                        setCases((current) => [
                          ...current,
                          {
                            id: `case-${Date.now()}`,
                            name: `case ${current.length + 1}`,
                            visibility: "hidden",
                            argsText: JSON.stringify(
                              parameters.map(() => null),
                              null,
                              2,
                            ),
                            expectedText: "null",
                            outputCodec: "json",
                            comparator: "deepEqual",
                          },
                        ])
                      }
                    >
                      + Judge case
                    </button>
                  </div>
                  <div className="builder-repeat-list judge-case-list">
                    {cases.map((testCase, index) => (
                      <article className="builder-repeat-card judge-case-card" key={testCase.id ?? index}>
                        <div className="judge-case-topline">
                          <span className={`judge-visibility ${testCase.visibility}`}>
                            {testCase.visibility === "sample" ? "Visible sample" : "Hidden check"}
                          </span>
                          <button
                            className="icon-danger-button"
                            aria-label={`Remove judge case ${index + 1}`}
                            disabled={cases.length <= 2}
                            onClick={() =>
                              setCases((current) =>
                                current.filter((_, candidate) => candidate !== index),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                        <div className="form-pair">
                          <label>
                            <span>Case name</span>
                            <input
                              maxLength={CUSTOM_CHALLENGE_LIMITS.caseNameCharacters}
                              value={testCase.name}
                              onChange={(event) => updateCase(index, { name: event.target.value })}
                            />
                          </label>
                          <label>
                            <span>Visibility</span>
                            <select
                              value={testCase.visibility}
                              onChange={(event) =>
                                updateCase(index, {
                                  visibility: event.target.value as "sample" | "hidden",
                                })
                              }
                            >
                              <option value="sample">Visible sample</option>
                              <option value="hidden">Hidden on submit</option>
                            </select>
                          </label>
                        </div>
                        <div className="form-pair builder-json-pair">
                          <label>
                            <span>Arguments · JSON array</span>
                            <textarea
                              spellCheck={false}
                              value={testCase.argsText}
                              onChange={(event) => updateCase(index, { argsText: event.target.value })}
                              placeholder='[[1, 2, 3], 2]'
                            />
                          </label>
                          <label>
                            <span>Expected output · JSON</span>
                            <textarea
                              spellCheck={false}
                              value={testCase.expectedText}
                              onChange={(event) => updateCase(index, { expectedText: event.target.value })}
                              placeholder="[1, 2]"
                            />
                          </label>
                        </div>
                        <div className="form-pair">
                          <label>
                            <span>Output shape</span>
                            <select
                              value={testCase.outputCodec ?? "json"}
                              onChange={(event) => updateCase(index, { outputCodec: event.target.value as PythonCodec })}
                            >
                              {CODEC_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Comparison</span>
                            <select
                              value={testCase.comparator ?? "deepEqual"}
                              onChange={(event) => updateCase(index, { comparator: event.target.value as PythonComparator })}
                            >
                              {COMPARATOR_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                  <label>
                    <span>First example explanation · optional</span>
                    <textarea
                      value={exampleExplanation}
                      onChange={(event) => setExampleExplanation(event.target.value)}
                      placeholder="Explain why the first sample produces its output."
                    />
                  </label>
                </>
              )}
            </div>
          ) : null}

          {step === "solution" ? (
            <div className="custom-form challenge-builder-panel">
              <div className="builder-section-heading">
                <span>04 · Solution</span>
                <h3>Finish the learner and reference views</h3>
                <p>The starter opens in Solve mode. The reference solution powers progressive ghost practice and remains device-local.</p>
              </div>
              {challengeEnabled ? (
                <label>
                  <span className="builder-label-row">
                    Starter code
                    <button className="text-button" onClick={regenerateStarter}>Regenerate signature</button>
                  </span>
                  <textarea
                    className="builder-code-input"
                    spellCheck={false}
                    value={starterCode}
                    onChange={(event) => setStarterCode(event.target.value)}
                  />
                </label>
              ) : null}
              <label>
                <span>{language === "python" ? "Python" : "Swift"} reference solution</span>
                <textarea
                  className="builder-code-input reference-solution-input"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  spellCheck={false}
                />
              </label>
              <label>
                <span>Pattern cue</span>
                <input
                  value={cue}
                  onChange={(event) => setCue(event.target.value)}
                  placeholder="What should you recognize before coding?"
                />
              </label>
              <label>
                <span>Invariant</span>
                <input
                  value={invariant}
                  onChange={(event) => setInvariant(event.target.value)}
                  placeholder="What must remain true?"
                />
              </label>
              <div className="form-pair">
                <label>
                  <span>Complexity or tradeoff</span>
                  <input
                    value={complexity}
                    onChange={(event) => setComplexity(event.target.value)}
                    placeholder="O(n) time · O(k) space"
                  />
                </label>
                <label>
                  <span>Language detail</span>
                  <input
                    value={languageNote}
                    onChange={(event) => setLanguageNote(event.target.value)}
                    placeholder="Syntax or API detail to remember"
                  />
                </label>
              </div>
              <div className={`builder-validation ${canSave ? "ready" : "blocked"}`}>
                <strong>{canSave ? "Ready to save" : effectiveReferenceStatus === "running" ? "Running local judge" : "Needs attention"}</strong>
                <span>
                  {canSave
                    ? challengeEnabled
                      ? `The local judge has ${sampleCount} visible and ${hiddenCount} hidden case${hiddenCount === 1 ? "" : "s"}.`
                      : "This item will use the progressive ghost-typing workflow."
                    : effectiveReferenceMessage || challengeValidation.error || "Add a title and at least ten characters of reference code."}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="challenge-builder-footer">
          <button className="outline-button" onClick={requestClose}>Cancel</button>
          <div className="challenge-builder-footer-main">
            {challengeEnabled && step === "solution" ? (
              <button
                className="outline-button"
                disabled={!valid || effectiveReferenceStatus === "running"}
                onClick={() => void validateReference()}
              >
                {effectiveReferenceStatus === "running" ? "Checking…" : "Validate reference"}
              </button>
            ) : null}
            {stepIndex > 0 ? (
              <button
                className="outline-button"
                onClick={() => setStep(BUILDER_STEPS[stepIndex - 1].id)}
              >
                ← Back
              </button>
            ) : null}
            {stepIndex < BUILDER_STEPS.length - 1 ? (
              <button
                className="primary-button"
                onClick={() => setStep(BUILDER_STEPS[stepIndex + 1].id)}
              >
                Continue →
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={!canSave}
                onClick={() =>
                  onSave({
                    title,
                    track,
                    language,
                    pattern,
                    difficulty,
                    code,
                    cue,
                    invariant,
                    complexity,
                    languageNote,
                    challenge:
                      challengeEnabled && challengeAvailable
                        ? challengeValidation.input
                        : null,
                  })
                }
              >
                {item ? "Save revision" : "Save and practice"} →
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
