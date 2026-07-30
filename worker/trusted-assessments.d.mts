export type TrustedLanguage = "python" | "swift";
export type TrustedJudgeVerdict =
  | "accepted"
  | "wrong-answer"
  | "compile-error"
  | "runtime-error"
  | "time-limit"
  | "judge-error";

export type TrustedEntrypointParameter = Readonly<{
  name: string;
  type: "Int" | "Bool" | "String" | "[Int]" | "[String]" | "[[Int]]";
}>;

export type TrustedEntrypoint = Readonly<{
  kind: "function";
  name: string;
  parameters?: readonly TrustedEntrypointParameter[];
  returns?: TrustedEntrypointParameter["type"];
}>;

export type TrustedChallengeCase = Readonly<{
  id: string;
  name: string;
  args: readonly unknown[];
  expected: unknown;
}>;

export type TrustedChallenge = Readonly<{
  key: string;
  language: TrustedLanguage;
  programId: string;
  runtime: string;
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
  entrypoint: TrustedEntrypoint;
  samples: readonly TrustedChallengeCase[];
  hiddenCases: readonly TrustedChallengeCase[];
}>;

export type TrustedJudgeSpec = Readonly<{
  protocolVersion: 1;
  language: TrustedLanguage;
  runtime: string;
  contentRevision: number;
  judgeRevision: number;
  entrypoint: TrustedEntrypoint;
  cases: readonly (TrustedChallengeCase & Readonly<{
    visibility: "sample" | "hidden";
    comparator: "deepEqual";
  }>)[];
}>;

export type TrustedGatewayRequest = Readonly<{
  version: "judge.submission.v1";
  submissionId: string;
  language: "python3" | "swift6";
  runtime: string;
  contentRevision: number;
  judgeRevision: number;
  contractDigest: string;
  source: string;
  comparison: "exact";
  tests: readonly { id: string; input: string; expectedOutput: string }[];
  callbackUrl: string;
}>;

export type NormalizedTrustedGatewayResult = Readonly<{
  verdict: TrustedJudgeVerdict;
  passed: number;
  total: number;
  language: TrustedLanguage;
  runtime: string;
  contentRevision: number;
  judgeRevision: number;
  contractDigest: string;
}>;

export type NormalizedTrustedJudgeResult = Readonly<{
  verdict: TrustedJudgeVerdict;
  passed: number;
  total: number;
  durationMs: number;
  runtime: string;
}>;

export const MAX_TRUSTED_SOURCE_BYTES: number;
export const MAX_TRUSTED_CALLBACK_BYTES: number;
export const TRUSTED_ASSIGNMENT_TTL_MS: number;
export const TRUSTED_RETENTION_MS: number;
export const TRUSTED_CHALLENGE_COUNT: number;
export const TRUSTED_SWIFT_CHALLENGE_COUNT: number;
export const TRUSTED_ASSESSMENT_PROGRAM: Readonly<{
  id: string;
  revision: number;
  title: string;
  shortTitle: string;
  description: string;
  evidenceLabel: string;
  language: "python";
}>;
export const TRUSTED_SWIFT_PROGRAM: Readonly<{
  id: string;
  revision: number;
  title: string;
  shortTitle: string;
  description: string;
  evidenceLabel: string;
  language: "swift";
}>;
export const TRUSTED_CODE_LAB_PROGRAM: Readonly<{
  id: string;
  revision: number;
  title: string;
  description: string;
  evidenceLabel: string;
  language: "mixed";
}>;

export function trustedProgramForId(id: unknown): TrustedAssessmentProgram | TrustedSwiftProgram | null;
export function trustedProgramForLanguage(language: unknown): TrustedAssessmentProgram | TrustedSwiftProgram | null;
export function trustedChallengeForKey(key: unknown): TrustedChallenge | null;
export function trustedChallengeForSequence(sequence: number, language?: TrustedLanguage): TrustedChallenge;
export function publicTrustedChallenge(challenge: TrustedChallenge): Omit<TrustedChallenge, "hiddenCases">;
export function privateJudgeSpec(challenge: TrustedChallenge): TrustedJudgeSpec;
export function cleanTrustedId(value: unknown, limit?: number): string | null;
export function cleanTrustedSource(value: unknown): string | null;
export function trustedJudgeContractDigest(judgeSpec: TrustedJudgeSpec): Promise<string>;
export function trustedGatewaySubmission(input: {
  submissionId: string;
  source: string;
  judgeSpec: TrustedJudgeSpec;
  callbackUrl: string;
}): Promise<TrustedGatewayRequest>;
export function normalizeTrustedGatewayResult(
  value: unknown,
  submissionId: string,
  expected: Pick<TrustedJudgeSpec, "language" | "runtime" | "contentRevision" | "judgeRevision"> & { total: number; contractDigest: string },
): NormalizedTrustedGatewayResult | null;
export function normalizeTrustedJudgeResult(
  value: unknown,
  expectedTotal: number,
): NormalizedTrustedJudgeResult | null;

type TrustedAssessmentProgram = typeof TRUSTED_ASSESSMENT_PROGRAM;
type TrustedSwiftProgram = typeof TRUSTED_SWIFT_PROGRAM;
