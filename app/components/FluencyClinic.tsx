"use client";

import { useEffect, useRef, useState } from "react";
import type {
  FluencyClinicModel,
  FluencyClinicPassKind,
  FluencyClinicRecord,
} from "../lib/fluency-clinic.mjs";
import { maskCode } from "../lib/product";

type PassInput = {
  kind: FluencyClinicPassKind;
  startedAt: string;
  durationMs: number;
  corrections: number;
};

type Props = {
  model: FluencyClinicModel;
  workspaceRevision: number;
  routedCaseId?: string;
  onSelect: (caseId?: string) => void;
  onRecordPass: (
    caseId: string,
    input: PassInput,
    expectedRevision: number,
  ) => void;
  onOpenReconstruction: (record: FluencyClinicRecord) => void;
  onOpenTransfer: (record: FluencyClinicRecord) => void;
};

const STATUS_COPY: Record<FluencyClinicRecord["status"], string> = {
  repairing: "Guided repair",
  "reconstruction-ready": "Full reconstruction",
  "recheck-waiting": "Delayed recheck scheduled",
  "recheck-due": "Delayed recheck due",
  "transfer-ready": "Mapped transfer ready",
  stabilized: "Stabilized",
  "transfer-observed": "Transfer observed",
  retired: "Archived revision",
};

const PASS_COPY = {
  visible: {
    label: "Visible",
    note: "Rebuild the line with its structure exposed.",
    stage: 1,
  },
  faded: {
    label: "Faded",
    note: "Retrieve more of the syntax from partial cues.",
    stage: 2,
  },
  blank: {
    label: "Blank",
    note: "Reconstruct the exact line without character cues.",
    stage: 5,
  },
  recheck: {
    label: "Delayed blank",
    note: "Retrieve the line again after the spacing delay.",
    stage: 5,
  },
} as const;

function formatWhen(value: string | null) {
  if (!value) return "Not scheduled";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(parsed)
    : "Not scheduled";
}

function signed(value: number, suffix = "") {
  return `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}${suffix}`;
}

export function FluencyClinic({
  model,
  workspaceRevision,
  routedCaseId,
  onSelect,
  onRecordPass,
  onOpenReconstruction,
  onOpenTransfer,
}: Props) {
  const selected = routedCaseId ? model.selected : null;
  const selectedId = selected?.id;
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (routedCaseId && selectedId) detailHeadingRef.current?.focus();
  }, [routedCaseId, selectedId]);

  return (
    <section className="fluency-clinic" aria-labelledby="fluency-clinic-title">
      <div className="fluency-clinic-hero">
        <div>
          <span className="eyebrow">Implementation Fluency Clinic</span>
          <h2 id="fluency-clinic-title">Turn recurring line misses into durable recall</h2>
          <p>
            Repair one troublesome line through progressively weaker cues, rebuild the
            full solution, then return for a delayed blank check and a mapped sibling.
          </p>
        </div>
        <div className="fluency-trust-card">
          <strong>Evidence boundary</strong>
          <span>Private to this device</span>
          <span>Measures implementation fluency only</span>
          <span>Never upgrades mastery or independent-solve claims</span>
        </div>
      </div>

      <div className="fluency-summary" aria-label="Fluency Clinic summary">
        <SummaryMetric value={model.summary.active} label="Active" />
        <SummaryMetric value={model.summary.due} label="Due now" tone="due" />
        <SummaryMetric value={model.summary.reconstructionReady} label="Full recalls" />
        <SummaryMetric value={model.summary.stabilized} label="Stabilized" />
      </div>

      {routedCaseId && !model.selected ? (
        <div className="fluency-route-warning" role="status">
          <strong>This Clinic case is unavailable.</strong>
          <span>It may belong to an older import or a removed item revision.</span>
          <button onClick={() => onSelect(undefined)}>Return to the Clinic queue</button>
        </div>
      ) : !model.records.length ? (
        <div className="fluency-empty">
          <strong>No implementation-friction cases yet.</strong>
          <p>
            Repeat a typing pass or send any missed line here from Records. A case is
            created after recurring misses; a single large burst can also be queued so
            you can repair it immediately.
          </p>
        </div>
      ) : (
        <div className={`fluency-workspace${selected ? " has-selection" : ""}`}>
          <aside className="fluency-queue" aria-label="Fluency Clinic cases">
            <div className="fluency-queue-head">
              <div>
                <small>Priority queue</small>
                <strong>{model.records.length} line targets</strong>
              </div>
              <span>{model.summary.due ? `${model.summary.due} due` : "Up to date"}</span>
            </div>
            {model.records.map((record) => (
              <button
                key={record.id}
                className={selected?.id === record.id ? "active" : ""}
                aria-current={selected?.id === record.id ? "true" : undefined}
                onClick={() => onSelect(record.id)}
              >
                <span className="fluency-case-title">
                  <small>
                    {record.language === "python" ? "Python" : "Swift"} · line {record.line}
                  </small>
                  <strong>{record.titleSnapshot}</strong>
                </span>
                <span className={`fluency-status status-${record.status}`}>
                  {STATUS_COPY[record.status]}
                </span>
                <small>
                  {record.errorCount} misses · {record.attemptCount} passes
                </small>
              </button>
            ))}
          </aside>

          {selected && (
            <ClinicCaseDetail
              record={selected}
              workspaceRevision={workspaceRevision}
              headingRef={detailHeadingRef}
              onBack={() => onSelect(undefined)}
              onRecordPass={onRecordPass}
              onOpenReconstruction={onOpenReconstruction}
              onOpenTransfer={onOpenTransfer}
            />
          )}
          {!selected && (
            <div className="fluency-detail fluency-detail-empty">
              <span className="eyebrow">Choose a case</span>
              <h3>Start with the highest-priority line target.</h3>
              <p>
                Due delayed checks appear first, followed by active repairs and full
                reconstructions. Selecting a case creates a reload-safe URL.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SummaryMetric({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "due";
}) {
  return (
    <span className={tone ? `tone-${tone}` : ""}>
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

function ClinicCaseDetail({
  record,
  workspaceRevision,
  headingRef,
  onBack,
  onRecordPass,
  onOpenReconstruction,
  onOpenTransfer,
}: {
  record: FluencyClinicRecord;
  workspaceRevision: number;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onRecordPass: Props["onRecordPass"];
  onOpenReconstruction: Props["onOpenReconstruction"];
  onOpenTransfer: Props["onOpenTransfer"];
}) {
  const repairKind = record.status === "recheck-due" ? "recheck" : record.nextPass;

  return (
    <article className="fluency-detail">
      <button className="fluency-mobile-back" onClick={onBack}>
        ← Clinic queue
      </button>
      <div className="fluency-detail-head">
        <div>
          <span className="eyebrow">
            {record.language === "python" ? "Python" : "Swift"} · line {record.line}
          </span>
          <h3 ref={headingRef} tabIndex={-1}>
            {record.titleSnapshot}
          </h3>
          <p>{STATUS_COPY[record.status]}</p>
        </div>
        <span className={`fluency-status status-${record.status}`}>
          {record.passes.length}/4 evidence steps
        </span>
      </div>

      <ol className="fluency-evidence-path" aria-label="Clinic evidence path">
        {(["visible", "faded", "blank"] as const).map((kind, index) => (
          <li key={kind} className={record.passes.some((pass) => pass.kind === kind) ? "done" : ""}>
            <span>{index + 1}</span>
            <div>
              <strong>{PASS_COPY[kind].label} repair</strong>
              <small>Guided exposure, never mastery evidence</small>
            </div>
          </li>
        ))}
        <li className={record.reconstructionAttempt ? "done" : ""}>
          <span>4</span>
          <div>
            <strong>Full stage-5 reconstruction</strong>
            <small>Clean, current-revision typing pass at 95%+ accuracy</small>
          </div>
        </li>
        <li className={record.passes.some((pass) => pass.kind === "recheck") ? "done" : ""}>
          <span>5</span>
          <div>
            <strong>Delayed blank line recheck</strong>
            <small>{record.recheckDueAt ? `Scheduled ${formatWhen(record.recheckDueAt)}` : "Scheduled after full reconstruction"}</small>
          </div>
        </li>
      </ol>

      <div className="fluency-context" aria-label="Frozen source context">
        {record.contextSnapshot.map((line) => (
          <div className={line.isTarget ? "target" : ""} key={line.lineNumber}>
            <span>{line.lineNumber}</span>
            <code>{line.isTarget ? "← repair target" : line.text}</code>
          </div>
        ))}
      </div>

      {repairKind && (
        <ClinicLineEditor
          key={`${record.id}:${repairKind}:${workspaceRevision}`}
          record={record}
          kind={repairKind}
          workspaceRevision={workspaceRevision}
          onRecordPass={onRecordPass}
        />
      )}

      {record.status === "reconstruction-ready" && (
        <div className="fluency-action-card">
          <span className="eyebrow">Next evidence step</span>
          <strong>Rebuild the complete solution from a blank editor.</strong>
          <p>
            The three micro-repairs were guided. Only a later clean stage-5 pass can
            show that the repaired line fits back into the whole implementation.
          </p>
          <button className="primary-button" onClick={() => onOpenReconstruction(record)}>
            Start fresh full reconstruction →
          </button>
        </div>
      )}

      {record.status === "recheck-waiting" && (
        <div className="fluency-action-card quiet">
          <span className="eyebrow">Spacing interval</span>
          <strong>Return {formatWhen(record.recheckDueAt)}.</strong>
          <p>The delay is intentional. Repeating now would measure short-term echo, not retrieval.</p>
        </div>
      )}

      {record.status === "transfer-ready" && record.transferVariant && (
        <div className="fluency-action-card">
          <span className="eyebrow">Mapped transfer</span>
          <strong>Try a related problem without seeing its solution.</strong>
          <p>
            This sibling was selected from the source mapping. The routing is targeted,
            so it cannot count as cold-transfer proof or independent mastery.
          </p>
          <button className="primary-button" onClick={() => onOpenTransfer(record)}>
            Start targeted transfer →
          </button>
        </div>
      )}

      {["stabilized", "transfer-observed"].includes(record.status) && (
        <div className="fluency-action-card success">
          <span className="eyebrow">Clinic cycle complete</span>
          <strong>
            {record.status === "transfer-observed"
              ? "Mapped transfer evidence is now attached."
              : "The line held after the delayed blank check."}
          </strong>
          <p>This is implementation-fluency evidence only. Mastery remains governed by the normal spaced progression.</p>
        </div>
      )}

      {record.comparison.delta && (
        <div className="fluency-comparison">
          <span>
            <small>WPM change</small>
            <strong>{signed(record.comparison.delta.wpm)}</strong>
          </span>
          <span>
            <small>Accuracy</small>
            <strong>{signed(record.comparison.delta.accuracy, "%")}</strong>
          </span>
          <span>
            <small>Corrections</small>
            <strong>{signed(record.comparison.delta.corrections)}</strong>
          </span>
          <span>
            <small>Duration</small>
            <strong>{signed(record.comparison.delta.durationMs / 1000, "s")}</strong>
          </span>
        </div>
      )}

      <details className="fluency-audit-trail">
        <summary>Evidence audit trail</summary>
        <dl>
          <div><dt>Frozen revision</dt><dd>r{record.itemRevision}</dd></div>
          <div><dt>Source attempts</dt><dd>{record.sourceAttemptIds.length || "Manual queue"}</dd></div>
          <div><dt>Recorded repairs</dt><dd>{record.passes.length}</dd></div>
          <div><dt>Evidence scope</dt><dd>Local implementation fluency</dd></div>
        </dl>
      </details>
    </article>
  );
}

function ClinicLineEditor({
  record,
  kind,
  workspaceRevision,
  onRecordPass,
}: {
  record: FluencyClinicRecord;
  kind: FluencyClinicPassKind;
  workspaceRevision: number;
  onRecordPass: Props["onRecordPass"];
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [corrections, setCorrections] = useState(0);
  const [startedAt] = useState(() => new Date().toISOString());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const copy = PASS_COPY[kind];
  const ghost = maskCode(
    record.targetLineSnapshot,
    copy.stage,
    false,
    undefined,
    record.language,
  );

  useEffect(() => {
    textareaRef.current?.focus();
  }, [record.id, kind]);

  function handleChange(next: string) {
    if (!record.targetLineSnapshot.startsWith(next)) {
      setCorrections((current) => current + 1);
      setError(
        `Expected ${JSON.stringify(record.targetLineSnapshot[value.length] ?? "end of line")}`,
      );
      return;
    }
    if (next.length < value.length) setCorrections((current) => current + 1);
    setError("");
    setValue(next);
    if (next !== record.targetLineSnapshot) return;
    onRecordPass(
      record.id,
      {
        kind,
        startedAt,
        durationMs: Math.max(0, Date.now() - Date.parse(startedAt)),
        corrections,
      },
      workspaceRevision,
    );
  }

  return (
    <section className="fluency-editor-card" aria-labelledby="fluency-pass-title">
      <div className="fluency-editor-head">
        <div>
          <small>Current pass</small>
          <h4 id="fluency-pass-title">{copy.label} retrieval</h4>
        </div>
        <span>{record.passes.length + 1}/4</span>
      </div>
      <p>{copy.note} This pass is always recorded as guided.</p>
      <div className="repair-editor fluency-editor">
        <pre aria-hidden="true">{ghost}</pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          spellCheck={false}
          aria-label={`${copy.label} repair for ${record.titleSnapshot}, line ${record.line}`}
        />
      </div>
      <small className="repair-error" aria-live="polite">
        {error || "Type the exact line, including indentation."}
      </small>
    </section>
  );
}
