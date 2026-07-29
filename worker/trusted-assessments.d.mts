export type TrustedJudgeVerdict =
  | "accepted"
  | "wrong-answer"
  | "runtime-error"
  | "time-limit"
  | "judge-error";

export type TrustedChallengeCase = {
  id: string;
  name: string;
  args: unknown[];
  expected: unknown;
};

export type TrustedChallenge = {
  key: string;
  contentRevision: number;
  judgeRevision: number;
  title: string;
  difficulty: "Easy" | "Medium";
  estimatedMinutes: number;
  summary: string;
  prompt: string;
  constraints: readonly string[];
  tags: readonly string[];
  starterCode: string;
  entrypoint: { kind: "function"; name: string };
  samples: readonly TrustedChallengeCase[];
  hiddenCases: readonly TrustedChallengeCase[];
};

export const MAX_TRUSTED_SOURCE_BYTES: number;
export const MAX_TRUSTED_CALLBACK_BYTES: number;
export const TRUSTED_ASSIGNMENT_TTL_MS: number;
export const TRUSTED_RETENTION_MS: number;
export const TRUSTED_CHALLENGE_COUNT: number;
export const TRUSTED_ASSESSMENT_PROGRAM: Readonly<{
  id: string;
  revision: number;
  title: string;
  shortTitle: string;
  description: string;
  evidenceLabel: string;
  language: "python";
}>;
export function trustedChallengeForKey(key: unknown): TrustedChallenge | null;
export function trustedChallengeForSequence(sequence: number): TrustedChallenge;
export function publicTrustedChallenge(challenge: TrustedChallenge): Omit<TrustedChallenge, "hiddenCases">;
export function privateJudgeSpec(challenge: TrustedChallenge): {
  protocolVersion: 1;
  language: "python";
  contentRevision: number;
  judgeRevision: number;
  entrypoint: TrustedChallenge["entrypoint"];
  cases: Array<TrustedChallengeCase & { visibility: "sample" | "hidden"; comparator: "deepEqual" }>;
};
export function cleanTrustedId(value: unknown, limit?: number): string | null;
export function cleanTrustedSource(value: unknown): string | null;
export function trustedGatewaySubmission(input: {
  submissionId: string;
  source: string;
  judgeSpec: ReturnType<typeof privateJudgeSpec>;
  callbackUrl: string;
}): {
  version: "judge.submission.v1";
  submissionId: string;
  language: "python3";
  source: string;
  comparison: "exact";
  tests: Array<{ id: string; input: string; expectedOutput: string }>;
  callbackUrl: string;
};
export function normalizeTrustedGatewayResult(
  value: unknown,
  submissionId: string,
  expectedTotal: number,
): { verdict: TrustedJudgeVerdict; passed: number; total: number } | null;
export function normalizeTrustedJudgeResult(
  value: unknown,
  expectedTotal: number,
): { verdict: TrustedJudgeVerdict; passed: number; total: number; durationMs: number; runtime: string } | null;
