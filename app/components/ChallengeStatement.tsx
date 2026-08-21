"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { challengeSpecForItem } from "../lib/challenge-lab.mjs";
import { getSwiftChallenge } from "../data/swift-challenges";
import type { PracticeItem } from "../lib/items";

type ChallengeStatementProps = {
  item: PracticeItem;
  hideExpected?: boolean;
};

const CHALLENGE_TABS = ["description", "examples", "constraints"] as const;

function formatValue(value: unknown) {
  const document = JSON.stringify(value, null, 2);
  return document === undefined ? "null" : document;
}

export function ChallengeStatement({
  item,
  hideExpected = false,
}: ChallengeStatementProps) {
  const [tab, setTab] = useState<"description" | "examples" | "constraints">(
    "description",
  );
  const idPrefix = `challenge-${useId().replace(/:/g, "")}`;
  const titleId = `${idPrefix}-title`;
  const tabId = (value: (typeof CHALLENGE_TABS)[number]) =>
    `${idPrefix}-${value}-tab`;
  const panelId = (value: (typeof CHALLENGE_TABS)[number]) =>
    `${idPrefix}-${value}-panel`;
  const localChallenge = challengeSpecForItem(item);
  const swiftChallenge = item.trustedChallengeKey
    ? getSwiftChallenge(item.trustedChallengeKey)
    : undefined;
  const challenge = localChallenge ?? (swiftChallenge
    ? {
        statement: swiftChallenge.prompt,
        entrypoint: `${swiftChallenge.entrypoint.name}(${swiftChallenge.entrypoint.parameters
          .map((parameter) => `${parameter.name}: ${parameter.type}`)
          .join(", ")})`,
        parameters: swiftChallenge.entrypoint.parameters.map((parameter) => ({
          name: parameter.name,
          type: parameter.type,
          description: "",
        })),
        returns: swiftChallenge.entrypoint.returns,
        notes: [
          `Swift ${swiftChallenge.runtime} · ${swiftChallenge.tags.join(" · ")}`,
        ],
        examples: swiftChallenge.samples.map((sample) => ({
          name: sample.name,
          args: sample.args,
          expected: sample.expected,
          explanation: undefined,
        })),
        constraints: [...swiftChallenge.constraints],
        visibleCaseCount: swiftChallenge.samples.length,
        // The worker keeps the sealed-case count private. The header below
        // intentionally uses a non-numeric label for this server-backed lane.
        hiddenCaseCount: 0,
      }
    : null);
  if (!challenge) return null;
  const callableLabel = swiftChallenge
    ? `func ${swiftChallenge.entrypoint.name}(${swiftChallenge.entrypoint.parameters
        .map((parameter) => `_ ${parameter.name}: ${parameter.type}`)
        .join(", ")}) -> ${swiftChallenge.entrypoint.returns}`
    : challenge.entrypoint;

  function selectAdjacentTab(
    event: KeyboardEvent<HTMLButtonElement>,
    current: (typeof CHALLENGE_TABS)[number],
  ) {
    const currentIndex = CHALLENGE_TABS.indexOf(current);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? CHALLENGE_TABS.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % CHALLENGE_TABS.length
            : event.key === "ArrowLeft"
              ? (currentIndex - 1 + CHALLENGE_TABS.length) %
                CHALLENGE_TABS.length
              : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = CHALLENGE_TABS[nextIndex];
    setTab(nextTab);
    window.requestAnimationFrame(() =>
      document.getElementById(tabId(nextTab))?.focus(),
    );
  }

  return (
    <section className="challenge-statement" aria-labelledby={titleId}>
      <header>
        <div>
          <span className="eyebrow">
            {hideExpected ? "Interview prompt" : "Challenge statement"}
          </span>
          <h2 id={titleId}>{callableLabel}</h2>
        </div>
        <span className="hidden-check-count">
          {swiftChallenge
            ? "Private sealed judge"
            : `${challenge.hiddenCaseCount} unshown check${
                challenge.hiddenCaseCount === 1 ? "" : "s"
              }`}
        </span>
      </header>
      <div className="challenge-tabs" role="tablist" aria-label="Challenge details">
        {CHALLENGE_TABS.map((value) => (
          <button
            key={value}
            id={tabId(value)}
            role="tab"
            aria-controls={panelId(value)}
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
            onKeyDown={(event) => selectAdjacentTab(event, value)}
          >
            {value[0].toUpperCase() + value.slice(1)}
            {value === "examples" && ` - ${challenge.examples.length}`}
          </button>
        ))}
      </div>
      {tab === "description" && (
        <div
          className="challenge-copy"
          id={panelId("description")}
          role="tabpanel"
          aria-labelledby={tabId("description")}
        >
          <p>{challenge.statement}</p>
          <dl>
            <div>
              <dt>Callable</dt>
              <dd><code>{callableLabel}</code></dd>
            </div>
            <div>
              <dt>Returns</dt>
              <dd>{challenge.returns}</dd>
            </div>
          </dl>
          {challenge.parameters.length > 0 && (
            <div className="challenge-parameters">
              <strong>Parameters</strong>
              {challenge.parameters.map((parameter) => (
                <p key={parameter.name}>
                  <code>{parameter.name}: {parameter.type}</code>
                  <span>{parameter.description}</span>
                </p>
              ))}
            </div>
          )}
          {challenge.notes.map((note) => (
            <p className="challenge-note" key={note}>{note}</p>
          ))}
        </div>
      )}
      {tab === "examples" && (
        <div
          className="challenge-examples"
          id={panelId("examples")}
          role="tabpanel"
          aria-labelledby={tabId("examples")}
        >
          {challenge.examples.map((example, index) => (
            <article key={example.name}>
              <div>
                <span>Example {index + 1}</span>
                <strong>{example.name}</strong>
              </div>
              <label>
                Input
                <pre>{formatValue({ args: example.args })}</pre>
              </label>
              <label>
                Output
                <pre>
                  {hideExpected
                    ? "Hidden during the mock"
                    : formatValue(example.expected)}
                </pre>
              </label>
              {example.explanation && (
                <p className="example-explanation">{example.explanation}</p>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === "constraints" && (
        <ul
          className="challenge-constraints"
          id={panelId("constraints")}
          role="tabpanel"
          aria-labelledby={tabId("constraints")}
        >
          {challenge.constraints.map((constraint) => (
            <li key={constraint}>{constraint}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
