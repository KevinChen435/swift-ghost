export const GUEST_PERSISTENCE_SCOPE: "guest";
export const ACCOUNT_STATE_NAMESPACE: "swift-ghost-account-v1";

export type PersistenceScope = "guest" | `account:${string}`;

export function accountPersistenceScope(
  userId: unknown,
): PersistenceScope | undefined;
export function normalizePersistenceScope(
  value: unknown,
): PersistenceScope | undefined;
export function scopedStateKey(
  stateKey: unknown,
  scope: unknown,
): string | undefined;
export function resolvePersistenceScope(input: {
  status: string;
  authenticated?: boolean;
  userId?: unknown;
  currentScope?: unknown;
}): PersistenceScope | undefined;
export function scopeMatchesAuthenticatedUser(
  scope: unknown,
  userId: unknown,
): boolean;
export function readStoredJson(
  storage: Pick<Storage, "getItem">,
  keys: readonly string[],
  supportedVersions: readonly number[],
): { found: true; value: Record<string, unknown>; key: string } | { found: false };
export function persistScopedJson(
  storage: Pick<Storage, "setItem">,
  stateKey: string,
  scope: PersistenceScope,
  value: unknown,
): boolean;
