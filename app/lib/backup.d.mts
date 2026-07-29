export const BACKUP_KIND: "swift-ghost-backup";
export const BACKUP_ENVELOPE_VERSION: 1;

export type BackupInventory = {
  attempts: number;
  submissions: number;
  sessions: number;
  customItems: number;
  notes: number;
  reviews: number;
  assessments: number;
  interviews: number;
  virtualRounds: number;
  plans: number;
  collections: number;
  patternReviews: number;
  patternDecisions: number;
  testDesignAttempts: number;
  testDesignDrafts: number;
  activeTestDesignSprints: number;
  typingProgressRecords: number;
  conceptTransferAttempts: number;
  conceptTransferDrafts: number;
  activeConceptTransferAttempts: number;
};

export function backupInventory(state: unknown): BackupInventory;
export function hasMeaningfulBackupState(state: unknown): boolean;
export function createBackupEnvelope(
  state: unknown,
  now?: string,
): {
  kind: typeof BACKUP_KIND;
  envelopeVersion: typeof BACKUP_ENVELOPE_VERSION;
  stateVersion: number;
  exportedAt: string;
  inventory: BackupInventory;
  payload: unknown;
};
export function readBackupPayload(
  value: unknown,
  supportedVersions: readonly number[],
): { payload: Record<string, unknown>; exportedAt?: string; envelope: boolean } | undefined;
