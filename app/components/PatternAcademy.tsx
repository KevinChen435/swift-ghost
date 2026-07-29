"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PatternLesson, PatternLessonStep } from "../data/pattern-lessons";
import {
  countStrongPatternChecks,
  derivePatternEvidence,
  selectNextPatternLesson,
  type PatternLearningWorkspace,
} from "../lib/pattern-learning.mjs";
import type {
  AttemptRecord,
  PracticeKind,
} from "../lib/product";
import type { RetrievalGrade } from "../lib/learning-state.mjs";
import type { PracticeItem } from "../lib/items";

type Props = {
  lessons: readonly PatternLesson[];
  items: PracticeItem[];
  attempts: AttemptRecord[];
  workspace: PatternLearningWorkspace;
  draftBoundary: string;
  selectedPatternId?: string;
  lessonStep?: PatternLessonStep;
  onSelectPattern: (
    patternId?: string,
    lessonStep?: PatternLessonStep,
    replace?: boolean,
  ) => void;
  onCommitResponse: (lesson: PatternLesson, checkId: string, response: string) => void;
  onRevealAnswer: (lesson: PatternLesson, checkId: string) => void;
  onGradeCheck: (
    lesson: PatternLesson,
    checkId: string,
    grade: RetrievalGrade,
  ) => void;
  onStartPractice: (
    item: PracticeItem,
    stage: number,
    practiceKind: PracticeKind,
  ) => void;
  onBrowsePattern: (lesson: PatternLesson) => void;
  onOpenTransferLab: () => void;
};

const STEP_META: {
  id: PatternLessonStep;
  label: string;
  note: string;
}[] = [
  { id: "recognize", label: "Recognize", note: "Choose the pattern" },
  { id: "reason", label: "Reason", note: "State the invariant" },
  { id: "trace", label: "Trace", note: "Walk the state" },
  { id: "template", label: "Template", note: "Recall the skeleton" },
  { id: "practice", label: "Practice", note: "Fade assistance" },
];

const GRADE_META: { id: RetrievalGrade; label: string }[] = [
  { id: "again", label: "Again" },
  { id: "hard", label: "Hard" },
  { id: "good", label: "Good" },
  { id: "easy", label: "Easy" },
];

function EvidenceStrip({
  lesson,
  workspace,
  attempts,
  items,
}: {
  lesson: PatternLesson;
  workspace: PatternLearningWorkspace;
  attempts: AttemptRecord[];
  items: PracticeItem[];
}) {
  const evidence = derivePatternEvidence(lesson, workspace, attempts, items);
  return (
    <dl className="academy-evidence" aria-label={`${lesson.title} evidence`}>
      <div>
        <dt>Retrieval</dt>
        <dd>{evidence.strongChecks}/{lesson.checks.length} recalled</dd>
      </div>
      <div>
        <dt>Worked typing</dt>
        <dd>{evidence.worked ? "Recorded" : "Not recorded"}</dd>
      </div>
      <div>
        <dt>Guided rebuild</dt>
        <dd>{evidence.guided ? "Recorded" : "Not recorded"}</dd>
      </div>
      <div>
        <dt>Local solve</dt>
        <dd>{evidence.independent ? "Accepted without hints" : "No current receipt"}</dd>
      </div>
      {lesson.practice.transferItemId ? (
        <div>
          <dt>Transfer</dt>
          <dd>{evidence.transfer ? "Independent evidence" : "Still sealed or due"}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function RetrievalCard({
  lesson,
  check,
  workspace,
  draftBoundary,
  onCommit,
  onReveal,
  onGrade,
}: {
  lesson: PatternLesson;
  check: PatternLesson["checks"][number];
  workspace: PatternLearningWorkspace;
  draftBoundary: string;
  onCommit: (response: string) => void;
  onReveal: () => void;
  onGrade: (grade: RetrievalGrade) => void;
}) {
  const saved = workspace.reviews.find(
    (review) =>
      review.lessonId === lesson.id &&
      review.lessonRevision === lesson.revision &&
      review.checkId === check.id,
  );
  const savedResponse = saved?.response ?? "";
  const [draft, setDraft] = useState(() => ({
    boundary: draftBoundary,
    savedResponse,
    value: savedResponse,
  }));
  const response =
    draft.boundary === draftBoundary && draft.savedResponse === savedResponse
      ? draft.value
      : savedResponse;
  return (
    <article className="academy-retrieval-card">
      <p className="academy-check-kicker">Commit before reveal</p>
      <h4>{check.prompt}</h4>
      <label>
        Your explanation
        <textarea
          value={response}
          maxLength={1000}
          onChange={(event) =>
            setDraft({
              boundary: draftBoundary,
              savedResponse,
              value: event.target.value,
            })
          }
          placeholder="State the rule in your own words."
        />
      </label>
      <div className="academy-check-actions">
        <button
          className="secondary-button"
          disabled={!response.trim()}
          onClick={() => onCommit(response)}
        >
          {saved ? "Recommit answer" : "Commit answer"}
        </button>
        <button
          className="text-button"
          disabled={!saved}
          onClick={onReveal}
        >
          Reveal authored answer
        </button>
      </div>
      {saved?.revealedAt ? (
        <div className="academy-answer" aria-live="polite">
          <span>Authored answer</span>
          <p>{check.answer}</p>
          <div className="academy-grade-row" aria-label="How difficult was this recall?">
            {GRADE_META.map((grade) => (
              <button
                key={grade.id}
                className={saved.grade === grade.id ? "active" : ""}
                aria-pressed={saved.grade === grade.id}
                onClick={() => onGrade(grade.id)}
              >
                {grade.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function PatternAcademy({
  lessons,
  items,
  attempts,
  workspace,
  draftBoundary,
  selectedPatternId,
  lessonStep = "recognize",
  onSelectPattern,
  onCommitResponse,
  onRevealAnswer,
  onGradeCheck,
  onStartPractice,
  onBrowsePattern,
  onOpenTransferLab,
}: Props) {
  const [templateLanguage, setTemplateLanguage] = useState<"python" | "swift">("python");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const lesson = lessons.find((candidate) => candidate.slug === selectedPatternId);
  const nextLesson = useMemo(
    () => selectNextPatternLesson(lessons, workspace, attempts, items),
    [attempts, items, lessons, workspace],
  );
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.itemId, item])),
    [items],
  );

  useEffect(() => {
    if (lesson) titleRef.current?.focus();
  }, [lesson]);

  if (!selectedPatternId) {
    const completedChecks = countStrongPatternChecks(lessons, workspace);
    return (
      <main id="main-content" className="page-container academy-page">
        <section className="academy-hero">
          <div>
            <p className="eyebrow">Pattern Academy</p>
            <h1>Learn the decision before memorizing the code.</h1>
            <p>
              Twelve interview playbooks teach recognition cues, invariants,
              state traces, and lightweight Python and Swift skeletons. Reading
              is instruction—not solve evidence.
            </p>
            {nextLesson ? (
              <button
                className="primary-button"
                onClick={() => onSelectPattern(nextLesson.slug, "recognize")}
              >
                Continue with {nextLesson.title}
              </button>
            ) : null}
          </div>
          <dl className="academy-hero-stats">
            <div><dt>Playbooks</dt><dd>{lessons.length}</dd></div>
            <div><dt>Retrieval checks</dt><dd>{completedChecks}/{lessons.length * 3}</dd></div>
            <div><dt>Languages</dt><dd>Python + Swift</dd></div>
          </dl>
        </section>
        <section className="academy-boundary" aria-label="Evidence boundary">
          <strong>Evidence stays separate.</strong>
          <span>Lesson reading is exposure. Guided typing is assisted. Only a current, hint-free accepted local Python submission is labeled an independent local solve.</span>
        </section>
        <section aria-labelledby="academy-curriculum-title">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Activation order</p>
              <h2 id="academy-curriculum-title">Core interview patterns</h2>
            </div>
          </div>
          <div className="academy-card-grid">
            {lessons.map((candidate) => {
              const evidence = derivePatternEvidence(candidate, workspace, attempts, items);
              return (
                <article className="academy-card" key={candidate.id}>
                  <div className="academy-card-index">{String(candidate.order).padStart(2, "0")}</div>
                  <p className="eyebrow">{candidate.pattern}</p>
                  <h3>{candidate.title}</h3>
                  <p>{candidate.summary}</p>
                  <div className="academy-card-status">
                    <span>{evidence.strongChecks}/3 retrieval checks</span>
                    <span>{evidence.independent ? "Local solve recorded" : "Solve still open"}</span>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => onSelectPattern(candidate.slug, "recognize")}
                  >
                    Open playbook
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  if (!lesson) {
    return (
      <main id="main-content" className="page-container academy-page">
        <section className="empty-panel">
          <p className="eyebrow">Pattern unavailable</p>
          <h1>This playbook is not in the current curriculum.</h1>
          <p>The route was safe, but it does not match one of the twelve authored lessons.</p>
          <button className="primary-button" onClick={() => onSelectPattern(undefined, undefined, true)}>
            Back to Pattern Academy
          </button>
        </section>
      </main>
    );
  }

  const workedItem = itemsById.get(lesson.practice.workedItemId);
  const guidedItem = itemsById.get(lesson.practice.guidedItemId);
  const coldItem = itemsById.get(lesson.practice.coldItemId);
  const swiftItem = itemsById.get(lesson.practice.swiftItemId);
  const activeStep = STEP_META.find((step) => step.id === lessonStep) ?? STEP_META[0];

  return (
    <main id="main-content" className="page-container academy-page academy-detail-page">
      <button className="text-button academy-back" onClick={() => onSelectPattern()}>
        ← All patterns
      </button>
      <div className="academy-detail-layout">
        <aside className="academy-pattern-index">
          <p className="eyebrow">Curriculum</p>
          <nav aria-label="Pattern Academy lessons">
            {lessons.map((candidate) => (
              <button
                key={candidate.id}
                aria-current={candidate.id === lesson.id ? "page" : undefined}
                className={candidate.id === lesson.id ? "active" : ""}
                onClick={() => onSelectPattern(candidate.slug, "recognize")}
              >
                <span>{String(candidate.order).padStart(2, "0")}</span>
                {candidate.title}
              </button>
            ))}
          </nav>
        </aside>
        <section className="academy-lesson">
          <header className="academy-lesson-header">
            <p className="eyebrow">Playbook {String(lesson.order).padStart(2, "0")} · revision {lesson.revision}</p>
            <h1 ref={titleRef} tabIndex={-1}>{lesson.title}</h1>
            <p>{lesson.summary}</p>
          <EvidenceStrip lesson={lesson} workspace={workspace} attempts={attempts} items={items} />
          </header>

          <nav className="academy-step-nav" aria-label={`${lesson.title} lesson sections`}>
            {STEP_META.map((step) => (
              <button
                key={step.id}
                className={activeStep.id === step.id ? "active" : ""}
                aria-current={activeStep.id === step.id ? "step" : undefined}
                onClick={() => onSelectPattern(lesson.slug, step.id)}
              >
                <strong>{step.label}</strong>
                <span>{step.note}</span>
              </button>
            ))}
          </nav>

          {activeStep.id === "recognize" ? (
            <div className="academy-lesson-section">
              <div className="academy-section-intro"><span>01</span><div><p className="eyebrow">Selection cues</p><h2>Know when the pattern earns its keep.</h2></div></div>
              <div className="academy-cue-grid">
                <article><h3>Use it when</h3><ul>{lesson.selection.useWhen.map((cue) => <li key={cue}>{cue}</li>)}</ul></article>
                <article><h3>Do not reach for it when</h3><ul>{lesson.selection.rejectWhen.map((cue) => <li key={cue}>{cue}</li>)}</ul></article>
              </div>
              <div className="academy-confusables">
                <h3>Separate it from nearby patterns</h3>
                {lesson.selection.confusableWith.map((entry) => (
                  <div key={entry.pattern}><strong>{entry.pattern}</strong><span>{entry.distinction}</span></div>
                ))}
              </div>
            </div>
          ) : null}

          {activeStep.id === "reason" ? (
            <div className="academy-lesson-section">
              <div className="academy-section-intro"><span>02</span><div><p className="eyebrow">Correctness anchor</p><h2>State the invariant before the loop.</h2></div></div>
              <blockquote className="academy-invariant">{lesson.invariant}</blockquote>
              <ol className="academy-reasoning-list">{lesson.reasoning.map((item) => <li key={item}>{item}</li>)}</ol>
              <div className="academy-complexity-table" role="table" aria-label={`${lesson.title} complexity`}>
                {lesson.complexity.map((row) => (
                  <div role="row" key={row.operation}><strong role="cell">{row.operation}</strong><span role="cell">{row.time}</span><span role="cell">{row.space}</span></div>
                ))}
              </div>
              <div className="academy-pitfalls"><h3>Failure modes</h3><ul>{lesson.pitfalls.map((pitfall) => <li key={pitfall}>{pitfall}</li>)}</ul></div>
            </div>
          ) : null}

          {activeStep.id === "trace" ? (
            <div className="academy-lesson-section">
              <div className="academy-section-intro"><span>03</span><div><p className="eyebrow">State trace</p><h2>{lesson.trace.title}</h2></div></div>
              <div className="academy-trace-input"><span>Input</span><code>{lesson.trace.input}</code></div>
              <ol className="academy-trace-steps">{lesson.trace.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
              <p className="academy-takeaway"><strong>Takeaway</strong>{lesson.trace.takeaway}</p>
            </div>
          ) : null}

          {activeStep.id === "template" ? (
            <div className="academy-lesson-section">
              <div className="academy-section-intro"><span>04</span><div><p className="eyebrow">Language bridge</p><h2>Recall the skeleton, not a full answer.</h2></div></div>
              <p className="academy-instruction-note">These templates deliberately omit problem-specific expressions. Viewing them is instructional exposure and creates no solve evidence.</p>
              <div className="academy-language-toggle" aria-label="Template language">
                {(["python", "swift"] as const).map((language) => (
                  <button key={language} aria-pressed={templateLanguage === language} className={templateLanguage === language ? "active" : ""} onClick={() => setTemplateLanguage(language)}>
                    {language === "python" ? "Python" : "Swift"}
                  </button>
                ))}
              </div>
              <div className="academy-code-shell">
                <header><span className={`language-chip ${templateLanguage}`}>{templateLanguage === "python" ? "PY" : "SW"}</span><strong>{templateLanguage === "python" ? "pattern.py" : "Pattern.swift"}</strong><small>Skeleton · intentionally incomplete</small></header>
                <pre tabIndex={0} aria-label={`${templateLanguage} skeleton for ${lesson.title}`}><code>{lesson.templates[templateLanguage]}</code></pre>
              </div>
            </div>
          ) : null}

          {activeStep.id === "practice" ? (
            <div className="academy-lesson-section">
              <div className="academy-section-intro"><span>05</span><div><p className="eyebrow">Assistance ladder</p><h2>See it, reconstruct it, then solve locally.</h2></div></div>
              <p className="academy-instruction-note">Stages stay honest: full ghost is exposure, reconstruction is assisted recall, and a blank local submission records only what the browser judge actually checked.</p>
              <div className="academy-practice-ladder">
                {workedItem ? <article><span>1 · Worked · guided exposure</span><h3>{workedItem.title}</h3><p>Type with the complete ghost visible. Notice control flow and state shape.</p><button className="secondary-button" onClick={() => onStartPractice(workedItem, 1, "typing")}>Open full ghost</button></article> : null}
                {guidedItem ? <article><span>2 · Reconstruct</span><h3>{guidedItem.title}</h3><p>Recover missing lines with structure still available.</p><button className="secondary-button" onClick={() => onStartPractice(guidedItem, 3, "typing")}>Open missing-lines stage</button></article> : null}
                {coldItem ? <article><span>3 · Blank solve</span><h3>{coldItem.title}</h3><p>Use the local Python judge from a blank editor. Prior lesson exposure remains visible in your history.</p><button className="primary-button" onClick={() => onStartPractice(coldItem, 5, "solving")}>Open local solve</button></article> : null}
                {swiftItem ? <article><span>Swift bridge</span><h3>{swiftItem.title}</h3><p>Reconstruct the Swift implementation. Swift execution is not available yet, so this remains typing evidence.</p><button className="secondary-button" onClick={() => onStartPractice(swiftItem, 3, "typing")}>Open Swift reconstruction</button></article> : null}
              </div>
              <div className="academy-practice-actions">
                <button className="text-button" onClick={() => onBrowsePattern(lesson)}>Browse all {lesson.pattern} problems</button>
                {lesson.practice.transferItemId ? <button className="text-button" onClick={onOpenTransferLab}>Open sealed Transfer Lab</button> : null}
              </div>
            </div>
          ) : null}

          <section className="academy-retrieval-lab" aria-labelledby="academy-retrieval-title">
            <div className="section-heading-row"><div><p className="eyebrow">Retrieval lab</p><h2 id="academy-retrieval-title">Explain it before revealing it.</h2></div><span>{lesson.checks.length} checks · local only</span></div>
            <div className="academy-retrieval-grid">
              {lesson.checks.map((check) => (
                <RetrievalCard key={`${lesson.id}:${check.id}`} lesson={lesson} check={check} workspace={workspace} draftBoundary={draftBoundary} onCommit={(response) => onCommitResponse(lesson, check.id, response)} onReveal={() => onRevealAnswer(lesson, check.id)} onGrade={(grade) => onGradeCheck(lesson, check.id, grade)} />
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
