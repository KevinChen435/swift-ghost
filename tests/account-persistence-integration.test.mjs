import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(
  new URL("../app/components/SwiftGhostApp.tsx", import.meta.url),
  "utf8",
);
const product = await readFile(
  new URL("../app/lib/product.ts", import.meta.url),
  "utf8",
);

test("hydrates and saves an isolated profile only after identity resolves", () => {
  assert.match(app, /resolvePersistenceScope\([\s\S]*cloud\.session\?\.user\?\.id/);
  assert.match(app, /loadStateForScope\(nextScope\)/);
  assert.match(app, /saveStateForScope\(stateRef\.current, persistenceScope\)/);
  assert.match(app, /expectedPersistenceScope[\s\S]*persistenceScope !== expectedPersistenceScope/);
  assert.match(product, /migrateLegacyStateToGuest/);
  assert.match(product, /normalizedScope === GUEST_PERSISTENCE_SCOPE/);
});

test("invalidates cloud work and rejects stale account callbacks", () => {
  assert.match(app, /function invalidateCloudWork\(\)/);
  assert.match(app, /studySyncEpochRef\.current/);
  assert.match(app, /expectedEpoch !== studySyncEpochRef\.current/);
  assert.match(app, /scopeMatchesAuthenticatedUser\([\s\S]*expectedUserId/);
  assert.match(app, /cloud\.session\?\.user\?\.id,[\s\S]*persistenceScope,[\s\S]*studySyncEpoch/);
  assert.match(app, /key=\{`\$\{cloud\.status\}:\$\{cloud\.refresh\}:\$\{cloud\.session\?\.user\?\.id/);
});

test("opens the remote read gate before writes and retries an initial local upload", () => {
  assert.match(app, /studySyncReadyRef\.current = false;[\s\S]*getStudyWorkspace/);
  assert.match(app, /setStudySyncReadyVersion\(\(current\) => current \+ 1\)/);
  assert.match(app, /studySyncReadyVersion,[\s\S]*\]\);/);
});

test("import and reset persist to the active scope before swapping visible state", () => {
  assert.match(app, /readBackupPayload\(parsed, SUPPORTED_STATE_VERSIONS\)/);
  assert.match(app, /createBackupEnvelope\(portableState\)/);
  assert.match(app, /saveStateForScope\(restored, activeScope\)[\s\S]*stateRef\.current = restored/);
  assert.match(app, /saveStateForScope\(EMPTY_STATE, activeScope\)[\s\S]*stateRef\.current = EMPTY_STATE/);
  assert.doesNotMatch(app, /localStorage\.removeItem/);
  assert.match(app, /Hosted Study Plans stay intact/);
  assert.match(app, /communityEnabled: false, uploadedAttemptIds: \[\]/);
});

test("offers an explicit, non-destructive guest-to-account copy", () => {
  assert.match(app, /function copyGuestDataToAccount\(\)/);
  assert.match(app, /loadStateForScope\(GUEST_PERSISTENCE_SCOPE\)/);
  assert.match(app, /original guest profile kept/i);
  assert.match(app, /Copy guest progress here/);
});

test("scope resolution preserves sealed-transfer exposure and unsaved prior state", () => {
  assert.match(app, /volatileScopeStateRef/);
  assert.match(
    app,
    /previousSaveFailed[\s\S]*volatileScopeStateRef\.current\.set\(previousScope, stateRef\.current\)/,
  );
  assert.match(
    app,
    /volatileScopeStateRef\.current\.get\(nextScope\)[\s\S]*loadStateForScope\(nextScope\)/,
  );
  assert.match(
    app,
    /!previousScope[\s\S]*route\.view === "practice" && initialItem\.transfer[\s\S]*recordTransferOpened/,
  );
});
