import type { PracticeItem } from "./items";
import type {
  PythonExecution,
  PythonVerification,
} from "./python-runner.mjs";

export type ChallengeExample = {
  name: string;
  args: unknown[];
  expected: unknown;
  explanation?: string;
};

export type ChallengeSpec = {
  statement: string;
  entrypoint: string;
  parameters: ReadonlyArray<{
    name: string;
    type: string;
    description: string;
  }>;
  returns: string;
  notes: readonly string[];
  examples: ChallengeExample[];
  constraints: string[];
  visibleCaseCount: number;
  hiddenCaseCount: number;
};

export function challengeEntrypointLabel(
  verification: PythonVerification,
): string;
export function challengeVisibleCaseCount(
  verification: PythonVerification,
): number;
export function challengeSpecForItem(item: PracticeItem): ChallengeSpec | null;
export function visibleChallengeVerification(
  verification: PythonVerification,
): PythonVerification;
export function challengeVerificationForPurpose(
  verification: PythonVerification,
  purpose: "examples" | "submit" | "full",
): PythonVerification;
export function isRecordableChallengeResult(
  result: {
    kind?: "verification" | "execution";
    ok?: boolean;
    cases?: ReadonlyArray<{ passed?: boolean }>;
  },
  purpose: "examples" | "submit" | "full",
  isMock?: boolean,
): boolean;
export function defaultCustomCaseInput(
  verification: PythonVerification,
): string;
export function customCaseVerification(
  verification: PythonVerification,
  input: string,
): PythonExecution;
export const CHALLENGE_LAB_LIMITS: Readonly<{
  maxCustomCaseBytes: number;
  maxCustomArguments: number;
  maxCustomCases: number;
}>;
