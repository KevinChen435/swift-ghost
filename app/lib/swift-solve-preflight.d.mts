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

export function swiftVerdictGuidance(verdict?: string | null): {
  title: string;
  actions: string[];
};
