import { persistJson } from "./local-persistence.mjs";

export const GUEST_PERSISTENCE_SCOPE = "guest";
export const ACCOUNT_STATE_NAMESPACE = "swift-ghost-account-v1";

const SAFE_ACCOUNT_ID = /^[\w:.-]{1,96}$/;

export function accountPersistenceScope(userId) {
  return typeof userId === "string" && SAFE_ACCOUNT_ID.test(userId)
    ? `account:${userId}`
    : undefined;
}

export function normalizePersistenceScope(value) {
  if (value === GUEST_PERSISTENCE_SCOPE) return value;
  if (typeof value !== "string" || !value.startsWith("account:"))
    return undefined;
  return accountPersistenceScope(value.slice("account:".length));
}

export function scopedStateKey(stateKey, scope) {
  const normalized = normalizePersistenceScope(scope);
  if (typeof stateKey !== "string" || !stateKey || !normalized)
    return undefined;
  return `${ACCOUNT_STATE_NAMESPACE}:${normalized}:${stateKey}`;
}

export function resolvePersistenceScope({
  status,
  authenticated,
  userId,
  currentScope,
}) {
  if (status === "local" || status === "signed-out")
    return GUEST_PERSISTENCE_SCOPE;
  if ((status === "connected" || status === "syncing") && authenticated)
    return accountPersistenceScope(userId);
  if (status === "error")
    return normalizePersistenceScope(currentScope) ?? GUEST_PERSISTENCE_SCOPE;
  return undefined;
}

export function scopeMatchesAuthenticatedUser(scope, userId) {
  const accountScope = accountPersistenceScope(userId);
  return Boolean(accountScope && normalizePersistenceScope(scope) === accountScope);
}

export function readStoredJson(storage, keys, supportedVersions) {
  try {
    for (const key of keys) {
      const stored = storage.getItem(key);
      if (!stored) continue;
      try {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed) &&
          supportedVersions.includes(Number(parsed.version))
        )
          return { found: true, value: parsed, key };
      } catch {
        // Try the next key when a write was interrupted.
      }
    }
  } catch {
    // Storage may be unavailable in hardened browser contexts.
  }
  return { found: false };
}

export function persistScopedJson(storage, stateKey, scope, value) {
  const key = scopedStateKey(stateKey, scope);
  return Boolean(key && persistJson(storage, key, value));
}

export function removeStoredKeys(storage, keys) {
  let removed = true;
  for (const key of new Set(keys)) {
    try {
      storage.removeItem(key);
    } catch {
      removed = false;
    }
  }
  return removed;
}
