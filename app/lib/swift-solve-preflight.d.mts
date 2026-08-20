export type SwiftPreflightCheckId =
  | "signature"
  | "samples"
  | "boundaries"
  | "complexity";

export type SwiftPreflightCheck = {
  id: SwiftPreflightCheckId;
  label: string;
  detail: string;
};

export type SwiftReadinessTone = "blocked" | "warm" | "ready";

export type SwiftReadinessSummary = {
  tone: SwiftReadinessTone;
  label: string;
  detail: string;
};

export type SwiftSubmissionDossierTone =
  | "blocked"
  | "warm"
  | "ready"
  | "pending"
  | "repair"
  | "accepted";

export type SwiftSubmissionDossierRow = {
  id: string;
  label: string;
  state: "ready" | "open" | "pending";
  detail: string;
};

export type SwiftSubmissionDossier = {
  tone: SwiftSubmissionDossierTone;
  label: string;
  nextAction: string;
  gaps: string[];
  rows: SwiftSubmissionDossierRow[];
  explanationReady: boolean;
};

export const SWIFT_PREFLIGHT_CHECKS: readonly SwiftPreflightCheck[];

export function formatSwiftEntrypoint(entrypoint: {
  kind?: string;
  name?: string;
  parameters?: Array<{ name?: string; type?: string }>;
  returns?: string;
} | null | undefined): string;

export function summarizeSwiftReadiness(input?: {
  completedChecks?: number;
  totalChecks?: number;
  tracedSamples?: number;
  totalSamples?: number;
  sourcePresent?: boolean;
}): SwiftReadinessSummary;

export function buildSwiftSubmissionDossier(input?: {
  completedChecks?: number;
  totalChecks?: number;
  tracedSamples?: number;
  totalSamples?: number;
  sourcePresent?: boolean;
  verdict?: string | null;
  status?: string | null;
  notes?: {
    approach?: string;
    complexity?: string;
    boundary?: string;
  };
}): SwiftSubmissionDossier;

export function swiftVerdictGuidance(verdict?: string | null): {
  title: string;
  actions: string[];
};
