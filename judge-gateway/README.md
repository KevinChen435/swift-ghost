# Judge Gateway

An independently deployable Cloudflare Worker that accepts authenticated Python
stdin/stdout submissions, places them on Cloudflare Queues, and judges them in a
fresh Cloudflare Sandbox container. This directory intentionally has no build or
runtime dependency on the root application.

## Security and delivery properties

- Every Queue delivery creates a cryptographically unique Sandbox ID. The
  sandbox is always destroyed in `finally`, including after SDK timeouts.
- `JudgeSandbox.enableInternet = false`; contestant processes receive no
  credentials. The trusted runner also drops the child to UID/GID 65534 and
  applies CPU, address-space, process, descriptor, and core-dump limits.
- The Worker writes source once and calls `exec()` once per test, passing only
  that test's input through `stdin`. Expected outputs remain in the Worker and
  are compared there.
- Source, request, inputs, expected outputs, test count, stdout, stderr, and
  callback diagnostics are bounded. The runner kills the process group when
  either output stream reaches its cap.
- Ingress accepts either a bearer service token or a timestamped HMAC. Callback
  URLs must match an explicit HTTPS origin allowlist and redirects are rejected.
- Judging and callback delivery are separate Queue messages. Once a result is
  produced, callback retries redeliver that exact result and never rerun code.
- Queue delivery is at least once. Callbacks carry the stable
  `Idempotency-Key: judge-result:<submissionId>` and a signed body.

This is defense in depth, not a substitute for Cloudflare account limits, WAF
rate limits, Access policy, monitoring, and an incident response process.

## HTTP submission contract

`POST /v1/submissions` with `Content-Type: application/json`:

```json
{
  "version": "judge.submission.v1",
  "submissionId": "018f-example-id",
  "language": "python3",
  "source": "print(input())",
  "comparison": "exact",
  "tests": [
    { "id": "sample-1", "input": "hello\n", "expectedOutput": "hello\n" }
  ],
  "callbackUrl": "https://app.example.com/internal/judge-results"
}
```

Limits are 120 KB for the HTTP/Queue message, 48,000 UTF-8 bytes of source, 64
tests, and 32,000 UTF-8 bytes per input or expected output. Comparison converts
CRLF to LF. `exact` otherwise preserves whitespace;
`trim-final-newline` removes at most one final LF.

Authenticate with one of:

```text
Authorization: Bearer <INGRESS_SERVICE_TOKEN>
```

or:

```text
X-Judge-Timestamp: <Unix seconds, within 300 seconds>
X-Judge-Signature: sha256=<hex HMAC-SHA256(secret, timestamp + "." + exact_body)>
```

The accepted response is `202 {"submissionId":"...","status":"queued"}`.
The gateway intentionally exposes no contestant-controlled sandbox endpoint.

## Callback contract

The gateway POSTs an immutable `judge.result.v1` object:

```json
{
  "version": "judge.result.v1",
  "submissionId": "018f-example-id",
  "verdict": "accepted",
  "passed": 1,
  "total": 1
}
```

Verdicts are `accepted`, `wrong-answer`, `runtime-error`, `time-limit`, and
`judge-error`. Failed results can also contain a zero-based `failedCaseIndex`
and a bounded diagnostic; neither expected output nor test input is returned.

Callbacks include:

```text
Idempotency-Key: judge-result:<submissionId>
X-Judge-Timestamp: <Unix seconds>
X-Judge-Signature: sha256=<hex HMAC-SHA256(CALLBACK_HMAC_SECRET, timestamp + "." + exact_body)>
```

The receiver must verify timestamp/signature before parsing, then settle a
pending submission transactionally. It must return 2xx both for the first
settlement and for an already-applied identical idempotency key. A contradictory
second result should be logged and quarantined without changing the first
settlement; returning non-2xx causes Queue retries and eventual DLQ delivery.

The HTTP submission endpoint does not claim exactly-once enqueue semantics: a
producer retry can enqueue the same `submissionId` more than once. Queue and
network delivery are at least once, so the callback settlement key is the
authoritative deduplication boundary.

## Deploy

Prerequisites:

1. A Cloudflare account with Workers Paid and Sandbox/Containers access.
2. Wrangler authenticated to the target account, plus a running Docker-compatible
   CLI/daemon so Wrangler can build the custom Sandbox image.
3. A real HTTPS callback origin and a receiver implementing the contract above.
4. A Queue and DLQ (create once):

   ```sh
   npx wrangler queues create swift-ghost-judge-submissions
   npx wrangler queues create swift-ghost-judge-dlq
   ```

5. Replace `CALLBACK_ALLOWED_ORIGINS` in `wrangler.jsonc` (comma-separated exact
   origins; no path), then provision secrets:

   ```sh
   npx wrangler secret put CALLBACK_HMAC_SECRET
   npx wrangler secret put INGRESS_HMAC_SECRET
   npx wrangler secret put INGRESS_SERVICE_TOKEN
   ```

   At least one ingress secret is required. Both may be configured during a
   credential migration.

Then run:

```sh
npm ci
npm run check
npm test
npm run deploy
```

The Sandbox SDK package and Docker base are deliberately pinned to the same
version (`0.12.4`). Upgrade them together. RPC transport is explicitly enabled;
the removed HTTP/WebSocket transports are not used.

`deploy` and `dev` pass `--config wrangler.jsonc` explicitly because this service
may live below another Wrangler project. A bundle-only check can use
`npx wrangler deploy --dry-run --config wrangler.jsonc --containers-rollout=none`,
but that does **not** build or validate the container.

## Integration still required

The existing browser judge uses callable function/method cases and rich codecs;
this service accepts a narrower stdin/stdout Python program contract. A trusted
producer must translate problem revisions into this contract or add a reviewed
harness format without ever embedding expected values in sandbox files.

No status database is included. The application remains the source of truth and
must create its pending receipt before enqueueing, then implement the idempotent
callback settlement described above. Before production, also set Queue/container
concurrency for the paid-plan quota, attach WAF/rate limiting or Access, add alerting
for the DLQ and `sandbox destroy failed` logs, pin an image digest if Cloudflare
publishes one for the SDK image, and perform a deployed egress-block smoke test.

The POSIX runner cannot execute natively on Windows. Its syntax and Worker-side
protocol are tested here, but the Docker build and runner resource-limit behavior
must be exercised on Linux/Docker and again in a deployed Sandbox before launch.

## Official API basis (verified July 28, 2026)

- [Sandbox RPC migration](https://developers.cloudflare.com/sandbox/guides/2026-deprecation/)
- [Sandbox command timeouts](https://developers.cloudflare.com/sandbox/api/commands/)
- [Sandbox lifecycle and destroy](https://developers.cloudflare.com/sandbox/api/lifecycle/)
- [Blocking outbound traffic](https://developers.cloudflare.com/sandbox/guides/outbound-traffic/)
- [Custom Docker images](https://developers.cloudflare.com/sandbox/configuration/dockerfile/)
- [Queue JavaScript API](https://developers.cloudflare.com/queues/configuration/javascript-apis/)
- [Queue configuration](https://developers.cloudflare.com/queues/configuration/configure-queues/)
