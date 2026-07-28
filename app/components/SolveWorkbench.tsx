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
  editor: ReactNode;
  tests: ReactNode;
  initialDesktopPercent?: number;
  mobilePane?: MobilePane;
  onMobilePaneChange?: (pane: MobilePane) => void;
};

export type MobilePane = "problem" | "code" | "tests";

const MIN_PROBLEM_PERCENT = 30;
const MAX_PROBLEM_PERCENT = 65;
const KEYBOARD_STEP = 2;

const MOBILE_PANES: ReadonlyArray<{
  id: MobilePane;
  label: string;
}> = [
  { id: "problem", label: "Problem" },
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

export function SolveWorkbench({
  problem,
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
  const mobilePane = controlledMobilePane ?? internalMobilePane;
  const idPrefix = `solve-workbench-${useId().replace(/:/g, "")}`;
  const layoutRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const pendingProblemPercent = useRef(problemPercent);
  const resizeFrame = useRef<number | null>(null);

  function selectMobilePane(pane: MobilePane) {
    if (controlledMobilePane === undefined) setInternalMobilePane(pane);
    onMobilePaneChange?.(pane);
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
    const currentIndex = MOBILE_PANES.findIndex(
      (candidate) => candidate.id === currentPane,
    );
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? MOBILE_PANES.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % MOBILE_PANES.length
            : event.key === "ArrowLeft"
              ? (currentIndex - 1 + MOBILE_PANES.length) %
                MOBILE_PANES.length
              : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextPane = MOBILE_PANES[nextIndex].id;
    selectMobilePane(nextPane);
    document.getElementById(tabId(idPrefix, nextPane))?.focus();
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
        {MOBILE_PANES.map(({ id, label }) => (
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
          aria-labelledby={tabId(idPrefix, "problem")}
          tabIndex={0}
          data-mobile-active={mobilePane === "problem"}
        >
          {problem}
        </section>

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
          >
            {tests}
          </section>
        </div>
      </div>
    </section>
  );
}
