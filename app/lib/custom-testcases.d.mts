import type {
  PythonCodec,
  PythonEntrypoint,
  PythonExecution,
} from "./python-runner.mjs";

export type CustomTestcaseParameterInput =
  | string
  | { readonly name?: string; readonly [key: string]: unknown };

export type CustomTestcaseField = {
  parameterId: string;
  text: string;
};

export type CustomTestcase =
  | {
      id: string;
      name: string;
      mode: "structured";
      fields: readonly CustomTestcaseField[];
    }
  | { id: string; name: string; mode: "raw"; raw: string };

export type CustomTestcaseSchema = {
  version: 1;
  itemId: string;
  itemRevision: number;
  judgeRevision: number;
  parameters: readonly {
    id: string;
    name: string;
    codec: PythonCodec;
  }[];
  starterCases: readonly {
    name: string;
    fields: readonly CustomTestcaseField[];
  }[];
};

export type CustomTestcaseCollection = {
  version: 1;
  itemId: string;
  itemRevision: number;
  judgeRevision: number;
  cases: readonly CustomTestcase[];
  selectedCaseId: string;
  nextOrdinal: number;
};

export const CUSTOM_TESTCASE_LIMITS: Readonly<{
  minCases: number;
  maxCases: number;
  maxArguments: number;
  maxVisibleSamples: number;
  maxItemIdBytes: number;
  maxParameterNameBytes: number;
  maxCaseNameBytes: number;
  maxFieldBytes: number;
  maxRawBytes: number;
  maxItemBytes: number;
  maxJsonDepth: number;
  maxJsonNodes: number;
}>;

export function deriveCustomTestcaseSchema(input: {
  itemId: string;
  itemRevision: number;
  judgeRevision: number;
  parameters: readonly CustomTestcaseParameterInput[];
  argCodecs: readonly PythonCodec[];
  visibleSampleArgs?: readonly (readonly unknown[])[];
  readonly [key: string]: unknown;
}): CustomTestcaseSchema;

export function createCustomTestcaseCollection(
  schema: CustomTestcaseSchema,
): CustomTestcaseCollection;
export function normalizeCustomTestcaseCollection(
  schema: CustomTestcaseSchema,
  raw: unknown,
): CustomTestcaseCollection;
export function addCustomTestcase(
  collection: CustomTestcaseCollection,
  schema: CustomTestcaseSchema,
  options?: { name?: string; afterCaseId?: string },
): CustomTestcaseCollection;
export function duplicateCustomTestcase(
  collection: CustomTestcaseCollection,
  caseId: string,
): CustomTestcaseCollection;
export function updateCustomTestcase(
  collection: CustomTestcaseCollection,
  schema: CustomTestcaseSchema,
  caseId: string,
  patch: {
    name?: string;
    mode?: "structured" | "raw";
    fields?: readonly CustomTestcaseField[];
    raw?: string;
  },
): CustomTestcaseCollection;
export function updateCustomTestcaseField(
  collection: CustomTestcaseCollection,
  schema: CustomTestcaseSchema,
  caseId: string,
  parameterId: string,
  text: string,
): CustomTestcaseCollection;
export function deleteCustomTestcase(
  collection: CustomTestcaseCollection,
  caseId: string,
): CustomTestcaseCollection;
export function selectCustomTestcase(
  collection: CustomTestcaseCollection,
  caseId: string,
): CustomTestcaseCollection;
export function parseCustomTestcaseField(
  text: string,
  codec: PythonCodec,
): unknown;
export function buildCustomTestcaseExecution(
  collection: CustomTestcaseCollection,
  schema: CustomTestcaseSchema,
  options: {
    entrypoint: PythonEntrypoint;
    argCodecs: readonly PythonCodec[];
    outputCodec?: PythonCodec;
    revision: number;
    caseIds?: "selected" | "all" | readonly string[];
    readonly [key: string]: unknown;
  },
): PythonExecution;
export function migrateLegacyCustomTestcases(
  schema: CustomTestcaseSchema,
  legacyInput: string,
): CustomTestcaseCollection;
