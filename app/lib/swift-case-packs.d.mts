import type { CloudTrustedAssignment } from "./cloud.mjs";

export type SwiftCasePackCase = {
  name: string;
  args: unknown[];
};

export type SwiftCasePack = {
  kind: "swift-ghost.swift-case-pack.v1";
  challengeKey: string;
  title: string;
  runtime: string;
  contentRevision: number;
  judgeRevision: number;
  entrypoint: {
    kind: "function";
    name: string;
    parameters: Array<{ name: string; type: string }>;
    returns?: string;
  };
  cases: SwiftCasePackCase[];
};

export type SwiftCasePackChallenge = NonNullable<
  CloudTrustedAssignment["challenge"]
>;

export function swiftCaseValueMatches(value: unknown, type: string): boolean;
export function parseSwiftCasePackArgs(
  raw: string,
  parameters: Array<{ name: string; type: string }>,
): unknown[];
export function buildSwiftCasePack(input?: {
  challenge?: SwiftCasePackChallenge | null;
  cases?: SwiftCasePackCase[];
}): SwiftCasePack;
export function encodeSwiftCasePack(input?: {
  challenge?: SwiftCasePackChallenge | null;
  cases?: SwiftCasePackCase[];
}): string;
export function importSwiftCasePack(
  text: string,
  challenge?: SwiftCasePackChallenge | null,
): SwiftCasePackCase[];
export const SWIFT_CASE_PACK_LIMITS: Readonly<{
  maxCases: number;
  maxBytes: number;
}>;
