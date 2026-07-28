import assert from "node:assert/strict";
import test from "node:test";
import {
  persistJson,
  persistJsonProperty,
} from "../app/lib/local-persistence.mjs";

test("reports a durable JSON write only after storage accepts it", () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };
  assert.equal(persistJson(storage, "state", { version: 23 }), true);
  assert.deepEqual(writes, [["state", '{"version":23}']]);
});

test("reports storage and serialization failures without throwing", () => {
  const unavailable = {
    setItem() {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    },
  };
  assert.equal(persistJson(unavailable, "state", { version: 23 }), false);

  const circular = {};
  circular.self = circular;
  assert.equal(persistJson({ setItem() {} }, "state", circular), false);
});

test("guards storage property access in hardened browser contexts", () => {
  const blockedWindow = {};
  Object.defineProperty(blockedWindow, "localStorage", {
    get() {
      throw new DOMException("Access denied", "SecurityError");
    },
  });
  assert.equal(
    persistJsonProperty(blockedWindow, "localStorage", "state", { version: 23 }),
    false,
  );
});
