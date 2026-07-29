import assert from "node:assert/strict";
import test from "node:test";
import { authenticateIngress, signPayload } from "../src/auth";

test("accepts a current valid HMAC and rejects replay outside five minutes", async () => {
  const body = '{"hello":"world"}';
  const timestamp = "1700000000";
  const signature = await signPayload("secret", timestamp, body);
  const request = new Request("https://judge.example/v1/submissions", {
    method: "POST",
    headers: { "x-judge-timestamp": timestamp, "x-judge-signature": signature },
    body,
  });
  assert.equal(await authenticateIngress(request, body, { hmac: "secret" }, 1_700_000_001), true);
  assert.equal(await authenticateIngress(request, body, { hmac: "secret" }, 1_700_000_301), false);
});

test("supports a constant-time bearer service token fallback", async () => {
  const request = new Request("https://judge.example/v1/submissions", {
    headers: { authorization: "Bearer top-secret" },
  });
  assert.equal(await authenticateIngress(request, "", { serviceToken: "top-secret" }), true);
  assert.equal(await authenticateIngress(request, "", { serviceToken: "wrong" }), false);
});
