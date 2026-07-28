"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

export type SolveWorkbenchProps = {
  problem: ReactNode;
  notebook?: ReactNode;
  notebookLabel?: string;
  editor: ReactNode;
  tests: ReactNode;
  initialDesktopPercent?: number;
  mobilePane?: MobilePane;
  onMobilePaneChange?: (pane: MobilePane) => void;
};

export type MobilePane = "problem" | "notes" | "code" | "tests";

const MIN_PROBLEM_PERCENT = 30;
const MAX_PROBLEM_PERCENT = 65;
const KEYBOARD_STEP = 2;

const BASE_MOBILE_PANES: ReadonlyArray<{
  id: MobilePane;
  label: string;
}> = [
  { id: "problem", label: "Problem" },
];
const CODE_MOBILE_PANES: ReadonlyArray<{ id: MobilePane; label: string }> = [
  { id: "code", label: "Code" },
  { id: "tests", label: "Tests" },
];

function clampProblemPercent(value: number) {
  if (!Number.isFinite(value)) return 45;
  return Math.min(MAX_PROBLEM_PERCENT, Math.max(MIN_PROBLEM_PERCENT, value));
}

function tabId(prefix: string, pane: MobilePane) {
  return `${prefix}-${pane}-tab`;
}

function paneId(prefix: string, pane: MobilePane) {
  return `${prefix}-${pane}-pane`;
}

function desktopPromptTabId(
  prefix: string,
  ownerPane: "problem" | "notes",
  targetPane: "problem" | "notes",
) {
  return `${prefix}-${ownerPane}-view-${targetPane}-tab`;
}

export function SolveWorkbench({
  problem,
  notebook,
  notebookLabel,
  editor,
  tests,
  initialDesktopPercent = 45,
  mobilePane: controlledMobilePane,
  onMobilePaneChange,
}: SolveWorkbenchProps) {
  const [problemPercent, setProblemPercent] = useState(() =>
    clampProblemPercent(initialDesktopPercent),
  );
  const [internalMobilePane, setInternalMobilePane] =
    useState<MobilePane>("problem");
  const requestedMobilePane = controlledMobilePane ?? internalMobilePane;
  const mobilePane =
    requestedMobilePane === "notes" && !notebook
      ? "problem"
      : requestedMobilePane;
  const mobilePanes = notebook
    ? [
        ...BASE_MOBILE_PANES,
        { id: "notes" as const, label: notebookLabel ?? "Notes" },
        ...CODE_MOBILE_PANES,
      ]
    : [...BASE_MOBILE_PANES, ...CODE_MOBILE_PANES];
  const [desktopPromptPane, setDesktopPromptPane] = useState<
    "problem" | "notes"
  >("problem");
  const idPrefix = `solve-workbench-${useId().replace(/:/g, "")}`;
  const layoutRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const pendingProblemPercent = useRef(problemPercent);
  const resizeFrame = useRef<number | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  function selectMobilePane(pane: MobilePane) {
    if (controlledMobilePane === undefined) setInternalMobilePane(pane);
    onMobilePaneChange?.(pane);
  }

  function selectDesktopPromptPane(pane: "problem" | "notes") {
    setDesktopPromptPane(pane);
    requestAnimationFrame(() => {
      document
        .getElementById(desktopPromptTabId(idPrefix, pane, pane))
        ?.focus();
    });
  }

  const layoutStyle = {
    "--solve-workbench-problem-percent": `${problemPercent}%`,
  } as CSSProperties;

  useEffect(
    () => () => {
      if (resizeFrame.current !== null) {
        window.cancelAnimationFrame(resizeFrame.current);
      }
    },
    [],
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1100px)");
    const updateLayout = () => setIsMobileLayout(query.matches);
    updateLayout();
    query.addEventListener("change", updateLayout);
    return () => query.removeEventListener("change", updateLayout);
  }, []);

  function problemPercentFromPointer(clientX: number) {
    const bounds = layoutRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return null;
    const nextPercent = ((clientX - bounds.left) / bounds.width) * 100;
    return clampProblemPercent(nextPercent);
  }

  function paintPendingResize() {
    layoutRef.current?.style.setProperty(
      "--solve-workbench-problem-percent",
      `${pendingProblemPercent.current}%`,
    );
  }

  function queueResizeFromPointer(clientX: number) {
    const nextPercent = problemPercentFromPointer(clientX);
    if (nextPercent === null) return;
    pendingProblemPercent.current = nextPercent;
    if (resizeFrame.current !== null) return;
    resizeFrame.current = window.requestAnimationFrame(() => {
      resizeFrame.current = null;
      paintPendingResize();
    });
  }

  function flushPendingResize() {
    if (resizeFrame.current !== null) {
      window.cancelAnimationFrame(resizeFrame.current);
      resizeFrame.current = null;
    }
    pendingProblemPercent.current = clampProblemPercent(
      pendingProblemPercent.current,
    );
    paintPendingResize();
    setProblemPercent(pendingProblemPercent.current);
  }

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    activePointerId.current = event.pointerId;
    pendingProblemPercent.current = problemPercent;
    event.currentTarget.setPointerCapture(event.pointerId);
    queueResizeFromPointer(event.clientX);
  }

  function continueResize(event: PointerEvent<HTMLDivElement>) {
    if (activePointerId.current !== event.pointerId) return;
    queueResizeFromPointer(event.clientX);
  }

  function finishResize(
    event: PointerEvent<HTMLDivElement>,
    useFinalPointerPosition: boolean,
  ) {
    if (activePointerId.current !== event.pointerId) return;
    if (useFinalPointerPosition) {
      const nextPercent = problemPercentFromPointer(event.clientX);
      if (nextPercent !== null) pendingProblemPercent.current = nextPercent;
    }
    activePointerId.current = null;
    flushPendingResize();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function commitLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
    if (activePointerId.current !== event.pointerId) return;
    activePointerId.current = null;
    flushPendingResize();
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (activePointerId.current !== null) return;
    const step = event.shiftKey ? KEYBOARD_STEP * 5 : KEYBOARD_STEP;
    if (
      event.key !== "Home" &&
      event.key !== "End" &&
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Enter"
    ) {
      return;
    }
    event.preventDefault();
    setProblemPercent((currentPercent) => {
      const nextPercent =
        event.key === "Home"
          ? MIN_PROBLEM_PERCENT
          : event.key === "End"
            ? MAX_PROBLEM_PERCENT
            : event.key === "ArrowLeft"
              ? currentPercent - step
              : event.key === "ArrowRight"
                ? currentPercent + step
                : initialDesktopPercent;
      const clampedPercent = clampProblemPercent(nextPercent);
      pendingProblemPercent.current = clampedPercent;
      return clampedPercent;
    });
  }

  function selectAdjacentMobilePane(
    event: KeyboardEvent<HTMLButtonElement>,
    currentPane: MobilePane,
  ) {
    const currentIndex = mobilePanes.findIndex(
      (candidate) => candidate.id === currentPane,
    );
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? mobilePanes.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % mobilePanes.length
            : event.key === "ArrowLeft"
              ? (currentIndex - 1 + mobilePanes.length) % mobilePanes.length
              : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextPane = mobilePanes[nextIndex].id;
    selectMobilePane(nextPane);
    document.getElementById(tabId(idPrefix, nextPane))?.focus();
  }

  function selectAdjacentDesktopPromptPane(
    event: KeyboardEvent<HTMLButtonElement>,
    currentPane: "problem" | "notes",
  ) {
    const nextPane =
      event.key === "Home"
        ? "problem"
        : event.key === "End"
          ? "notes"
          : event.key === "ArrowLeft" || event.key === "ArrowRight"
            ? currentPane === "problem"
              ? "notes"
              : "problem"
          : null;
    if (!nextPane) return;
    event.preventDefault();
    selectDesktopPromptPane(nextPane);
  }

  function paneClassName(pane: MobilePane) {
    return [
      "solve-workbench-pane",
      `solve-workbench-${pane}-pane`,
      mobilePane === pane ? "is-mobile-active" : "is-mobile-inactive",
    ].join(" ");
  }

  return (
    <section
      className="solve-workbench"
      aria-label="Coding challenge workspace"
      data-mobile-pane={mobilePane}
    >
      <div
        className="solve-workbench-mobile-tabs"
        role="tablist"
        aria-label="Workspace panels"
        aria-orientation="horizontal"
      >
        {mobilePanes.map(({ id, label }) => (
          <button
            key={id}
            id={tabId(idPrefix, id)}
            className={`solve-workbench-mobile-tab${
              mobilePane === id ? " is-active" : ""
            }`}
            type="button"
            role="tab"
            aria-controls={paneId(idPrefix, id)}
            aria-selected={mobilePane === id}
            tabIndex={mobilePane === id ? 0 : -1}
            onClick={() => selectMobilePane(id)}
            onKeyDown={(event) => selectAdjacentMobilePane(event, id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        ref={layoutRef}
        className="solve-workbench-desktop-layout"
        style={layoutStyle}
      >
        <section
          id={paneId(idPrefix, "problem")}
          className={paneClassName("problem")}
          role="tabpanel"
          aria-labelledby={
            isMobileLayout
              ? tabId(idPrefix, "problem")
              : notebook
                ? desktopPromptTabId(idPrefix, "problem", "problem")
                : tabId(idPrefix, "problem")
          }
          tabIndex={0}
          data-mobile-active={mobilePane === "problem"}
          hidden={
            isMobileLayout
              ? mobilePane !== "problem"
              : Boolean(notebook && desktopPromptPane !== "problem")
          }
        >
          {notebook && (
            <div
              className="solve-workbench-prompt-tabs"
              role="tablist"
              aria-label="Interview workspace notes"
            >
              <button
                id={desktopPromptTabId(idPrefix, "problem", "problem")}
                type="button"
                role="tab"
                aria-controls={paneId(idPrefix, "problem")}
                aria-selected={desktopPromptPane === "problem"}
                tabIndex={desktopPromptPane === "problem" ? 0 : -1}
                className={desktopPromptPane === "problem" ? "is-active" : ""}
                onClick={() => selectDesktopPromptPane("problem")}
                onKeyDown={(event) =>
                  selectAdjacentDesktopPromptPane(event, "problem")
                }
              >
                Prompt
              </button>
              <button
                id={desktopPromptTabId(idPrefix, "problem", "notes")}
                type="button"
                role="tab"
                aria-controls={paneId(idPrefix, "notes")}
                aria-selected={desktopPromptPane === "notes"}
                tabIndex={desktopPromptPane === "notes" ? 0 : -1}
                className={desktopPromptPane === "notes" ? "is-active" : ""}
                onClick={() => selectDesktopPromptPane("notes")}
                onKeyDown={(event) =>
                  selectAdjacentDesktopPromptPane(event, "notes")
                }
              >
              {notebookLabel ?? "Notebook"}
              </button>
            </div>
          )}
          <div className="solve-workbench-prompt-panel">{problem}</div>
        </section>

        {notebook && (
          <section
            id={paneId(idPrefix, "notes")}
            className={paneClassName("notes")}
            role="tabpanel"
            aria-labelledby={
              isMobileLayout
                ? tabId(idPrefix, "notes")
                : desktopPromptTabId(idPrefix, "notes", "notes")
            }
            tabIndex={0}
            data-mobile-active={mobilePane === "notes"}
            hidden={
              isMobileLayout
                ? mobilePane !== "notes"
                : desktopPromptPane !== "notes"
            }
          >
            <div
              className="solve-workbench-prompt-tabs"
              role="tablist"
              aria-label="Interview workspace notes"
            >
              <button
                id={desktopPromptTabId(idPrefix, "notes", "problem")}
                type="button"
                role="tab"
                aria-controls={paneId(idPrefix, "problem")}
                aria-selected={desktopPromptPane === "problem"}
                tabIndex={desktopPromptPane === "problem" ? 0 : -1}
                className={desktopPromptPane === "problem" ? "is-active" : ""}
                onClick={() => selectDesktopPromptPane("problem")}
                onKeyDown={(event) =>
                  selectAdjacentDesktopPromptPane(event, "problem")
                }
              >
                Prompt
              </button>
              <button
                id={desktopPromptTabId(idPrefix, "notes", "notes")}
                type="button"
                role="tab"
                aria-controls={paneId(idPrefix, "notes")}
                aria-selected={desktopPromptPane === "notes"}
                tabIndex={desktopPromptPane === "notes" ? 0 : -1}
                className={desktopPromptPane === "notes" ? "is-active" : ""}
                onClick={() => selectDesktopPromptPane("notes")}
                onKeyDown={(event) =>
                  selectAdjacentDesktopPromptPane(event, "notes")
                }
              >
              {notebookLabel ?? "Notebook"}
              </button>
            </div>
            <div className="solve-workbench-notebook-panel">{notebook}</div>
          </section>
        )}

        <div
          className="solve-workbench-separator"
          role="separator"
          aria-label="Resize problem and code panels"
          aria-controls={`${paneId(idPrefix, "problem")} ${paneId(idPrefix, "code")}`}
          aria-orientation="vertical"
          aria-valuemin={MIN_PROBLEM_PERCENT}
          aria-valuemax={MAX_PROBLEM_PERCENT}
          aria-valuenow={Math.round(problemPercent)}
          aria-valuetext={`Problem panel ${Math.round(problemPercent)} percent`}
          tabIndex={0}
          style={{ touchAction: "none" }}
          onKeyDown={resizeWithKeyboard}
          onPointerDown={startResize}
          onPointerMove={continueResize}
          onPointerUp={(event) => finishResize(event, true)}
          onPointerCancel={(event) => finishResize(event, false)}
          onLostPointerCapture={commitLostPointerCapture}
        />

        <div className="solve-workbench-workspace-pane">
          <section
            id={paneId(idPrefix, "code")}
            className={paneClassName("code")}
            role="tabpanel"
            aria-labelledby={tabId(idPrefix, "code")}
            tabIndex={0}
            data-mobile-active={mobilePane === "code"}
            hidden={isMobileLayout && mobilePane !== "code"}
          >
            {editor}
          </section>

          <section
            id={paneId(idPrefix, "tests")}
            className={paneClassName("tests")}
            role="tabpanel"
            aria-labelledby={tabId(idPrefix, "tests")}
            tabIndex={0}
            data-mobile-active={mobilePane === "tests"}
            hidden={isMobileLayout && mobilePane !== "tests"}
          >
            {tests}
          </section>
        </div>
      </div>
    </section>
  );
}
