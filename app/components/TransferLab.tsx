"use client";

export type TransferVariantStatus =
  | "unseen"
  | "opened"
  | "attempted"
  | "assisted"
  | "proven"
  | "due";

export type TransferVariantDifficulty = "Easy" | "Medium" | "Hard";

export interface TransferVariant {
  id: string;
  /** A neutral label such as "Variant 04" that cannot reveal the problem family. */
  displayLabel: string;
  difficulty: TransferVariantDifficulty;
  estimatedMinutes: number;
  status: TransferVariantStatus;
  evidenceLabels: string[];
  /** Reveal-only content. It is never rendered while status is `unseen`. */
  revealed?: {
    title: string;
    pattern: string;
    contrast?: string;
    teachBack?: string;
  };
  attemptedAtLabel?: string;
}

export interface TransferTotals {
  total: number;
  unseen: number;
  opened: number;
  attempted: number;
  assisted: number;
  proven: number;
  due: number;
}

export interface TransferLabProps {
  variants: TransferVariant[];
  recommendedVariantId?: string;
  totals: TransferTotals;
  onStart: (variantId: string) => void;
  onReview: (variantId: string) => void;
  onBack: () => void;
}

const STATUS_LABELS: Record<TransferVariantStatus, string> = {
  unseen: "Unseen",
  opened: "Opened",
  attempted: "Attempted",
  assisted: "Assisted",
  proven: "Proven",
  due: "Due for transfer check",
};

const START_LABELS: Record<TransferVariantStatus, string> = {
  unseen: "Open cold",
  opened: "Continue",
  attempted: "Try again",
  assisted: "Retry without help",
  proven: "Retest",
  due: "Start due check",
};

const HISTORY_STATUSES = new Set<TransferVariantStatus>([
  "attempted",
  "assisted",
  "proven",
  "due",
]);

function EvidenceList({ labels, variantLabel }: { labels: string[]; variantLabel: string }) {
  if (labels.length === 0) {
    return <p className="transfer-evidence-empty">No attempt evidence recorded yet.</p>;
  }

  return (
    <ul className="transfer-evidence-list" aria-label={`Evidence for ${variantLabel}`}>
      {labels.map((label, index) => (
        <li key={`${label}-${index}`}>{label}</li>
      ))}
    </ul>
  );
}

function VariantCard({
  variant,
  recommended,
  onStart,
}: {
  variant: TransferVariant;
  recommended: boolean;
  onStart: (variantId: string) => void;
}) {
  const isUnseen = variant.status === "unseen";
  const revealed = isUnseen ? undefined : variant.revealed;
  const headingId = `transfer-variant-${variant.id}`;

  return (
    <li className={`transfer-variant-card transfer-status-${variant.status}`}>
      <article aria-labelledby={headingId}>
        <div className="transfer-card-topline">
          <span className="transfer-variant-label">{variant.displayLabel}</span>
          <span className="transfer-status-badge" data-status={variant.status}>
            {STATUS_LABELS[variant.status]}
          </span>
        </div>

        <div className="transfer-card-heading">
          {recommended ? <span className="transfer-recommended-badge">Recommended next</span> : null}
          <h3 id={headingId}>
            {revealed?.title ??
              (isUnseen
                ? "Hidden until you open it"
                : "Hidden until you record an attempt")}
          </h3>
          <p>
            {revealed
              ? `Pattern: ${revealed.pattern}`
              : "The title, pattern, and problem family stay hidden for a valid cold start."}
          </p>
        </div>

        <dl className="transfer-card-meta">
          <div>
            <dt>Difficulty</dt>
            <dd>{variant.difficulty}</dd>
          </div>
          <div>
            <dt>Timebox</dt>
            <dd>{variant.estimatedMinutes} min</dd>
          </div>
        </dl>

        <EvidenceList
          labels={isUnseen ? [] : variant.evidenceLabels}
          variantLabel={variant.displayLabel}
        />

        <button
          className={recommended ? "primary-button transfer-card-action" : "outline-button transfer-card-action"}
          type="button"
          onClick={() => onStart(variant.id)}
          aria-label={`${START_LABELS[variant.status]}: ${variant.displayLabel}`}
        >
          {START_LABELS[variant.status]} <span aria-hidden="true">→</span>
        </button>
      </article>
    </li>
  );
}

export function TransferLab({
  variants,
  recommendedVariantId,
  totals,
  onStart,
  onReview,
  onBack,
}: TransferLabProps) {
  const recommended = variants.find((variant) => variant.id === recommendedVariantId);
  const history = variants.filter((variant) => HISTORY_STATUSES.has(variant.status));
  const debriefs = history.filter(
    (variant) =>
      variant.status !== "unseen" &&
      (variant.revealed?.contrast || variant.revealed?.teachBack),
  );

  return (
    <section className="transfer-lab" aria-labelledby="transfer-lab-title">
      <header className="transfer-hero">
        <div className="transfer-hero-copy">
          <button className="text-button transfer-back-button" type="button" onClick={onBack}>
            <span aria-hidden="true">←</span> Back to Assess
          </button>
          <span className="eyebrow">Cold transfer lab</span>
          <h2 id="transfer-lab-title">Can you recognize the move without the label?</h2>
          <p>
            Open a variant unseen in Swift Ghost history on this device, solve from first
            principles, then compare what changed. Prior exposure and help remain visible in
            the evidence.
          </p>
        </div>
        <aside className="transfer-trust-card" aria-label="Evidence limitations">
          <span>Practice evidence</span>
          <strong>Honest signals, not a credential</strong>
          <small>Saved locally · not proctored · not independently verified</small>
        </aside>
      </header>

      <section className="transfer-evidence-contract" aria-labelledby="transfer-contract-title">
        <div>
          <span className="eyebrow">Evidence contract</span>
          <h3 id="transfer-contract-title">What each result can—and cannot—claim</h3>
        </div>
        <ul>
          <li><strong>Attempted</strong><span>You opened the cold prompt and recorded an attempt.</span></li>
          <li><strong>Assisted</strong><span>A hint, solution, or refresher influenced the attempt.</span></li>
          <li><strong>Proven</strong><span>You completed the app&apos;s transfer criteria without recorded help.</span></li>
        </ul>
        <p>
          “Proven” describes evidence in this local practice session only. It is not proof of
          interview performance, authorship, or independent mastery.
        </p>
      </section>

      <section className="transfer-status-summary" aria-labelledby="transfer-summary-title">
        <div className="transfer-section-heading">
          <div>
            <span className="eyebrow">Your queue</span>
            <h3 id="transfer-summary-title">Transfer status</h3>
          </div>
          <p aria-live="polite">
            {totals.total} total · {totals.unseen} still unseen · {totals.due} due
          </p>
        </div>
        <dl className="transfer-summary-grid">
          <div><dt>Unseen</dt><dd>{totals.unseen}</dd></div>
          <div><dt>Opened</dt><dd>{totals.opened}</dd></div>
          <div><dt>Attempted</dt><dd>{totals.attempted}</dd></div>
          <div><dt>Assisted</dt><dd>{totals.assisted}</dd></div>
          <div><dt>Proven</dt><dd>{totals.proven}</dd></div>
          <div><dt>Due</dt><dd>{totals.due}</dd></div>
        </dl>
      </section>

      {recommended ? (
        <section className="transfer-recommended" aria-labelledby="transfer-recommended-title">
          <div>
            <span className="eyebrow">Recommended next</span>
            <h3 id="transfer-recommended-title">
              {recommended.status === "unseen"
                ? `${recommended.displayLabel} is ready for a clean cold start.`
                : `${recommended.displayLabel} is the strongest next check.`}
            </h3>
            <p>
              {recommended.status === "unseen"
                ? "Its identity stays sealed until you begin. Set aside the full timebox before opening it."
                : `${STATUS_LABELS[recommended.status]} · ${recommended.estimatedMinutes} minute timebox`}
            </p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => onStart(recommended.id)}
            aria-label={`${START_LABELS[recommended.status]}: ${recommended.displayLabel}`}
          >
            {START_LABELS[recommended.status]} <span aria-hidden="true">→</span>
          </button>
        </section>
      ) : null}

      <section className="transfer-variants" aria-labelledby="transfer-variants-title">
        <div className="transfer-section-heading">
          <div>
            <span className="eyebrow">Variant queue</span>
            <h3 id="transfer-variants-title">Choose a transfer check</h3>
          </div>
          <p>Unopened cards conceal all recognition cues.</p>
        </div>
        {variants.length > 0 ? (
          <ul className="transfer-variant-grid">
            {variants.map((variant) => (
              <VariantCard
                key={variant.id}
                variant={variant}
                recommended={variant.id === recommendedVariantId}
                onStart={onStart}
              />
            ))}
          </ul>
        ) : (
          <div className="transfer-empty-state" role="status">
            <h4>No transfer variants are available yet.</h4>
            <p>Complete eligible practice to build a cold-transfer queue.</p>
          </div>
        )}
      </section>

      <section className="transfer-history" aria-labelledby="transfer-history-title">
        <div className="transfer-section-heading">
          <div>
            <span className="eyebrow">History</span>
            <h3 id="transfer-history-title">Recorded transfer evidence</h3>
          </div>
          <p>{history.length} variant{history.length === 1 ? "" : "s"} with attempt evidence</p>
        </div>
        {history.length > 0 ? (
          <ul className="transfer-history-list">
            {history.map((variant) => (
              <li key={variant.id}>
                <div>
                  <strong>{variant.revealed?.title ?? variant.displayLabel}</strong>
                  <span>{variant.revealed ? variant.revealed.pattern : "Pattern not recorded"}</span>
                </div>
                <div>
                  <span className="transfer-status-badge" data-status={variant.status}>
                    {STATUS_LABELS[variant.status]}
                  </span>
                  {variant.attemptedAtLabel ? <time>{variant.attemptedAtLabel}</time> : null}
                </div>
                <EvidenceList labels={variant.evidenceLabels} variantLabel={variant.displayLabel} />
                <div className="transfer-history-actions">
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => onReview(variant.id)}
                  >
                    Review evidence <span aria-hidden="true">→</span>
                  </button>
                  <button
                    className="outline-button"
                    type="button"
                    onClick={() => onStart(variant.id)}
                  >
                    {variant.status === "due" ? "Start due recheck" : "Retry variant"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="transfer-history-empty">Your first completed attempt will appear here.</p>
        )}
      </section>

      <section className="transfer-debrief" aria-labelledby="transfer-debrief-title">
        <div className="transfer-section-heading">
          <div>
            <span className="eyebrow">Contrastive debrief</span>
            <h3 id="transfer-debrief-title">Name what transferred—and what did not</h3>
          </div>
        </div>
        {debriefs.length > 0 ? (
          <ul className="transfer-debrief-list">
            {debriefs.map((variant) => (
              <li key={variant.id}>
                <div className="transfer-debrief-heading">
                  <span>{variant.displayLabel}</span>
                  <h4>{variant.revealed?.title}</h4>
                </div>
                {variant.revealed?.contrast ? (
                  <div>
                    <strong>What changed</strong>
                    <p>{variant.revealed.contrast}</p>
                  </div>
                ) : null}
                {variant.revealed?.teachBack ? (
                  <div>
                    <strong>Teach-back</strong>
                    <p>{variant.revealed.teachBack}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="transfer-empty-state">
            <h4>No debrief is ready yet.</h4>
            <p>After an attempt, compare the new constraints and explain the reusable idea in your own words.</p>
          </div>
        )}
      </section>
    </section>
  );
}
