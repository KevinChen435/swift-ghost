import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_STATE_NAMESPACE,
  GUEST_PERSISTENCE_SCOPE,
  accountPersistenceScope,
  normalizePersistenceScope,
  persistScopedJson,
  readStoredJson,
  removeStoredKeys,
  resolvePersistenceScope,
  scopeMatchesAuthenticatedUser,
  scopedStateKey,
} from "../app/lib/account-storage.mjs";

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("creates separate stable keys for guest and account profiles", () => {
  assert.equal(accountPersistenceScope("user-123"), "account:user-123");
  assert.equal(accountPersistenceScope("../unsafe/user"), undefined);
  assert.equal(normalizePersistenceScope("account:user-123"), "account:user-123");
  assert.equal(normalizePersistenceScope("account:"), undefined);
  assert.equal(
    scopedStateKey("swift-ghost-state-v27", GUEST_PERSISTENCE_SCOPE),
    `${ACCOUNT_STATE_NAMESPACE}:guest:swift-ghost-state-v27`,
  );
  assert.equal(
    scopedStateKey("swift-ghost-state-v27", "account:user-123"),
    `${ACCOUNT_STATE_NAMESPACE}:account:user-123:swift-ghost-state-v27`,
  );
});

test("resolves guest, account, checking, and transient error scopes safely", () => {
  assert.equal(resolvePersistenceScope({ status: "local" }), "guest");
  assert.equal(resolvePersistenceScope({ status: "signed-out" }), "guest");
  assert.equal(
    resolvePersistenceScope({
      status: "connected",
      authenticated: true,
      userId: "member:7",
    }),
    "account:member:7",
  );
  assert.equal(
    resolvePersistenceScope({ status: "checking", authenticated: true }),
    undefined,
  );
  assert.equal(
    resolvePersistenceScope({
      status: "error",
      currentScope: "account:member:7",
    }),
    "account:member:7",
  );
  assert.equal(scopeMatchesAuthenticatedUser("account:member:7", "member:7"), true);
  assert.equal(scopeMatchesAuthenticatedUser("guest", "member:7"), false);
});

test("persists and reads only the requested scoped key", () => {
  const storage = memoryStorage();
  assert.equal(
    persistScopedJson(storage, "state-v27", "account:a", { version: 27, attempts: [] }),
    true,
  );
  assert.equal(
    persistScopedJson(storage, "state-v27", "account:b", { version: 27, attempts: [1] }),
    true,
  );
  const aKey = scopedStateKey("state-v27", "account:a");
  const bKey = scopedStateKey("state-v27", "account:b");
  assert.notEqual(aKey, bKey);
  assert.deepEqual(readStoredJson(storage, [aKey], [27]).value.attempts, []);
  assert.deepEqual(readStoredJson(storage, [bKey], [27]).value.attempts, [1]);
});

test("skips corrupt, unsupported, and inaccessible storage entries", () => {
  const storage = memoryStorage({
    corrupt: "{",
    old: JSON.stringify({ version: 1 }),
    current: JSON.stringify({ version: 27, settings: {} }),
  });
  const result = readStoredJson(storage, ["corrupt", "old", "current"], [27]);
  assert.equal(result.found, true);
  assert.equal(result.key, "current");
  assert.equal(
    readStoredJson(
      {
        getItem() {
          throw new Error("blocked");
        },
      },
      ["state"],
      [27],
    ).found,
    false,
  );
});

test("removes obsolete keys without letting one blocked key stop cleanup", () => {
  const storage = memoryStorage({ old: "1", older: "2" });
  storage.removeItem = (key) => storage.values.delete(key);
  assert.equal(removeStoredKeys(storage, ["old", "older", "old"]), true);
  assert.deepEqual([...storage.values.keys()], []);

  assert.equal(
    removeStoredKeys(
      {
        removeItem(key) {
          if (key === "blocked") throw new Error("blocked");
        },
      },
      ["blocked", "reachable"],
    ),
    false,
  );
});
