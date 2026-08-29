import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

class SqliteD1Statement {
  constructor(database, sql, args = [], beforeRun = null) {
    this.database = database;
    this.sql = sql;
    this.args = args;
    this.beforeRun = beforeRun;
  }

  bind(...args) {
    return new SqliteD1Statement(
      this.database,
      this.sql,
      args,
      this.beforeRun,
    );
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.args) ?? null;
  }

  async all() {
    return { results: this.database.prepare(this.sql).all(...this.args) };
  }

  async run() {
    await this.beforeRun?.(this.sql, this.args, this.database);
    const result = this.database.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class SqliteD1 {
  constructor(database, beforeRun = null) {
    this.database = database;
    this.beforeRun = beforeRun;
  }

  prepare(sql) {
    return new SqliteD1Statement(this.database, sql, [], this.beforeRun);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

async function applyMigrations(database) {
  database.exec("PRAGMA foreign_keys = ON");
  for (const name of [
    "0000_amusing_talos.sql",
    "0001_familiar_whizzer.sql",
    "0002_steep_ego.sql",
    "0003_clean_scourge.sql",
    "0004_petite_professor_monster.sql",
    "0005_lying_wilson_fisk.sql",
    "0006_swift_example_runs.sql",
    "0007_tiny_oracle.sql",
  ]) {
    const sql = await readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) database.exec(trimmed);
    }
  }
}

function workerRequest(path, body, email = "alice@example.com") {
  return new Request(`https://swift.example/api/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      "oai-authenticated-user-email": email,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function signedCallbackRequest(env, result, overrides = {}) {
  const body = overrides.body ?? JSON.stringify(result);
  const timestamp = String(
    overrides.timestamp ?? Math.floor(Date.now() / 1_000),
  );
  const signedBody = overrides.signedBody ?? body;
  const signature = createHmac(
    "sha256",
    env.TRUSTED_JUDGE_CALLBACK_SECRET,
  )
    .update(`${timestamp}.${signedBody}`)
    .digest("hex");
  return new Request(env.TRUSTED_JUDGE_CALLBACK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key":
        overrides.idempotencyKey ?? `judge-result:${result.submissionId}`,
      "x-judge-timestamp": timestamp,
      "x-judge-signature": `sha256=${signature}`,
    },
    body,
  });
}

const context = { waitUntil() {}, passThroughOnException() {} };

function callbackContract(gatewayBody) {
  return {
    language: gatewayBody.language,
    runtime: gatewayBody.runtime,
    contentRevision: gatewayBody.contentRevision,
    judgeRevision: gatewayBody.judgeRevision,
    contractDigest: gatewayBody.contractDigest,
  };
}

test("Worker queues callable checkpoints and settles only signed idempotent callbacks", async () => {
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const errorLogs = [];
  try {
    console.error = (...args) => errorLogs.push(args);
    await applyMigrations(database);
    const db = new SqliteD1(database);
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("trusted-worker-test", `${process.pid}-${Date.now()}`);
    const { default: worker } = await import(workerUrl.href);
    const baseEnv = { DB: db };

    const disabledCapability = await worker.fetch(
      workerRequest("/capabilities"),
      baseEnv,
      context,
    );
    assert.equal((await disabledCapability.json()).trustedAssessments, false);
    const unavailable = await worker.fetch(
      workerRequest("/trusted/assignments", {
        clientRequestId: "assignment-request:abc12345",
      }),
      baseEnv,
      context,
    );
    assert.equal(unavailable.status, 503);

    let gatewayAvailable = false;
    const judgeCalls = [];
    globalThis.fetch = async (url, init) => {
      judgeCalls.push({ url: String(url), init, body: JSON.parse(init.body) });
      return gatewayAvailable
        ? new Response(
            JSON.stringify({
              ...(judgeCalls.at(-1).body.version === "judge.execution.v1"
                ? { executionId: judgeCalls.at(-1).body.executionId }
                : { submissionId: judgeCalls.at(-1).body.submissionId }),
              status: "queued",
            }),
            { status: 202, headers: { "content-type": "application/json" } },
          )
        : new Response(
            JSON.stringify({ error: { code: "enqueue_failed" } }),
            { status: 503, headers: { "content-type": "application/json" } },
          );
    };
    const env = {
      DB: db,
      TRUSTED_JUDGE_URL: "https://judge.example/v1/submissions",
      TRUSTED_JUDGE_TOKEN: "test-ingress-token-that-is-at-least-32-bytes",
      TRUSTED_JUDGE_CALLBACK_SECRET:
        "test-callback-secret-that-is-at-least-32-bytes",
      TRUSTED_JUDGE_CALLBACK_URL:
        "https://swift.example/api/internal/judge-results",
    };
    const enabledCapability = await worker.fetch(
      workerRequest("/capabilities"),
      env,
      context,
    );
    assert.equal((await enabledCapability.json()).trustedAssessments, true);

    const issueBody = { clientRequestId: "assignment-request:abc12345" };
    const issuedResponse = await worker.fetch(
      workerRequest("/trusted/assignments", issueBody),
      env,
      context,
    );
    assert.equal(issuedResponse.status, 201);
    const issued = (await issuedResponse.json()).assignment;
    assert.match(issued.id, /^trusted-[a-f0-9]{32}$/);
    assert.equal(issued.challenge.key, "stable-window");
    assert.equal(Object.hasOwn(issued.challenge, "hiddenCases"), false);
    assert.equal(Object.hasOwn(issued, "judge"), false);

    const replayResponse = await worker.fetch(
      workerRequest("/trusted/assignments", issueBody),
      env,
      context,
    );
    assert.equal(replayResponse.status, 200);
    assert.equal((await replayResponse.json()).assignment.id, issued.id);
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM trusted_assignments").get().count,
      1,
    );

    const bobList = await worker.fetch(
      workerRequest("/trusted/assignments", undefined, "bob@example.com"),
      env,
      context,
    );
    assert.deepEqual((await bobList.json()).entries, []);
    const bobForgery = await worker.fetch(
      workerRequest(
        `/trusted/assignments/${issued.id}/submissions`,
        {
          clientSubmissionId: "submission:bob-abc12345",
          source: "def longest_stable_window(nums, gap):\n    return 0",
        },
        "bob@example.com",
      ),
      env,
      context,
    );
    assert.equal(bobForgery.status, 404);

    const submissionBody = {
      clientSubmissionId: "submission:alice-abc12345",
      source: "def longest_stable_window(nums, max_gap):\n    return len(nums)",
      verdict: "accepted",
      judgeRevision: 999,
      userId: "bob",
    };
    const oversizedEnvelope = await worker.fetch(
      workerRequest(
        `/trusted/assignments/${issued.id}/submissions`,
        {
          clientSubmissionId: "submission:alice-oversized",
          source: "\\".repeat(30_000),
        },
      ),
      env,
      context,
    );
    assert.equal(oversizedEnvelope.status, 413);
    assert.equal((await oversizedEnvelope.json()).error.code, "SUBMISSION_TOO_LARGE");
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM trusted_submissions").get().count,
      0,
      "packaging failures are rejected before a pending row is created",
    );
    const unavailableSubmission = await worker.fetch(
      workerRequest(
        `/trusted/assignments/${issued.id}/submissions`,
        submissionBody,
      ),
      env,
      context,
    );
    assert.equal(unavailableSubmission.status, 503);
    assert.equal((await unavailableSubmission.json()).error.code, "JUDGE_ENQUEUE_UNAVAILABLE");
    assert.equal(judgeCalls.length, 1);
    const serverSubmissionId = judgeCalls[0].body.submissionId;
    assert.match(serverSubmissionId, /^verified-[a-f0-9]{32}$/);
    assert.equal(judgeCalls[0].url, env.TRUSTED_JUDGE_URL);
    assert.equal(
      judgeCalls[0].init.headers.authorization,
      `Bearer ${env.TRUSTED_JUDGE_TOKEN}`,
    );
    assert.equal(judgeCalls[0].body.version, "judge.submission.v1");
    assert.equal(judgeCalls[0].body.language, "python3");
    assert.equal(judgeCalls[0].body.runtime, "python-3.13-linux");
    assert.match(judgeCalls[0].body.contractDigest, /^[a-f0-9]{64}$/);
    assert.equal(judgeCalls[0].body.callbackUrl, env.TRUSTED_JUDGE_CALLBACK_URL);
    assert.equal(judgeCalls[0].body.tests.length, 7);
    assert.ok(judgeCalls[0].body.tests.some((entry) => entry.id.startsWith("hidden-")));
    assert.equal(Object.hasOwn(judgeCalls[0].body, "judge"), false);
    assert.equal(Object.hasOwn(judgeCalls[0].body, "verdict"), false);
    assert.doesNotMatch(
      judgeCalls[0].body.source,
      /hidden-contract|repeated contractions/,
    );
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM trusted_submission_payloads").get().count,
      1,
    );

    gatewayAvailable = true;
    const queuedResponse = await worker.fetch(
      workerRequest(
        `/trusted/assignments/${issued.id}/submissions`,
        submissionBody,
      ),
      env,
      context,
    );
    assert.equal(queuedResponse.status, 202);
    const queued = (await queuedResponse.json()).submission;
    assert.equal(queued.id, serverSubmissionId);
    assert.equal(queued.status, "pending");
    assert.equal(queued.verdict, null);
    assert.equal(judgeCalls.length, 2);
    assert.equal(judgeCalls[1].body.submissionId, serverSubmissionId);
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM trusted_submission_payloads").get().count,
      0,
      "source is deleted as soon as the gateway durably accepts the queue job",
    );
    assert.equal(
      typeof database.prepare(
        "SELECT enqueued_at FROM trusted_submissions WHERE id = ?",
      ).get(serverSubmissionId).enqueued_at,
      "number",
    );
    const alreadyQueuedReplay = await worker.fetch(
      workerRequest(
        `/trusted/assignments/${issued.id}/submissions`,
        submissionBody,
      ),
      env,
      context,
    );
    assert.equal(alreadyQueuedReplay.status, 202);
    assert.equal(
      (await alreadyQueuedReplay.json()).submission.id,
      serverSubmissionId,
    );
    assert.equal(
      judgeCalls.length,
      2,
      "a confirmed queued receipt is not enqueued again",
    );

    const wrongResult = {
      version: "judge.result.v1",
      submissionId: serverSubmissionId,
      ...callbackContract(judgeCalls[0].body),
      verdict: "wrong-answer",
      passed: 4,
      total: 7,
      failedCaseIndex: 4,
    };
    const missingSignature = new Request(env.TRUSTED_JUDGE_CALLBACK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(wrongResult),
    });
    assert.equal(
      (await worker.fetch(missingSignature, env, context)).status,
      401,
    );
    const stale = signedCallbackRequest(env, wrongResult, {
      timestamp: Math.floor(Date.now() / 1_000) - 301,
    });
    assert.equal((await worker.fetch(stale, env, context)).status, 401);
    const signedDifferentBody = signedCallbackRequest(env, wrongResult, {
      signedBody: JSON.stringify({ ...wrongResult, passed: 3 }),
    });
    assert.equal(
      (await worker.fetch(signedDifferentBody, env, context)).status,
      401,
    );
    const wrongKey = signedCallbackRequest(env, wrongResult, {
      idempotencyKey: "judge-result:wrong",
    });
    assert.equal((await worker.fetch(wrongKey, env, context)).status, 400);
    const wrongTotal = {
      ...wrongResult,
      total: 8,
    };
    assert.equal(
      (
        await worker.fetch(
          signedCallbackRequest(env, wrongTotal),
          env,
          context,
        )
      ).status,
      400,
    );

    const settledWrong = await worker.fetch(
      signedCallbackRequest(env, wrongResult),
      env,
      context,
    );
    assert.equal(settledWrong.status, 204);
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM trusted_submission_payloads").get().count,
      0,
    );
    assert.equal(
      database.prepare("SELECT status FROM trusted_assignments WHERE id = ?").get(issued.id).status,
      "active",
    );
    assert.equal(
      (
        await worker.fetch(
          signedCallbackRequest(env, wrongResult),
          env,
          context,
        )
      ).status,
      204,
    );

    const contradictoryAccepted = {
      version: "judge.result.v1",
      submissionId: serverSubmissionId,
      ...callbackContract(judgeCalls[0].body),
      verdict: "accepted",
      passed: 7,
      total: 7,
    };
    assert.equal(
      (
        await worker.fetch(
          signedCallbackRequest(env, contradictoryAccepted),
          env,
          context,
        )
      ).status,
      409,
    );
    assert.equal(
      database.prepare("SELECT status FROM trusted_assignments WHERE id = ?").get(issued.id).status,
      "active",
      "a losing contradictory accepted callback must not close the assignment",
    );
    assert.ok(
      errorLogs.some(([message]) =>
        String(message).includes("Contradictory trusted judge callback")
      ),
    );

    const acceptedBody = {
      clientSubmissionId: "submission:alice-second",
      source: "def longest_stable_window(nums, max_gap):\n    return 2",
    };
    const acceptedQueuedResponse = await worker.fetch(
      workerRequest(
        `/trusted/assignments/${issued.id}/submissions`,
        acceptedBody,
      ),
      env,
      context,
    );
    assert.equal(acceptedQueuedResponse.status, 202);
    const acceptedQueued = (await acceptedQueuedResponse.json()).submission;
    const acceptedResult = {
      version: "judge.result.v1",
      submissionId: acceptedQueued.id,
      ...callbackContract(judgeCalls[2].body),
      verdict: "accepted",
      passed: 7,
      total: 7,
    };
    assert.equal(
      (
        await worker.fetch(
          signedCallbackRequest(env, acceptedResult),
          env,
          context,
        )
      ).status,
      204,
    );

    const acceptedReplay = await worker.fetch(
      workerRequest(
        `/trusted/assignments/${issued.id}/submissions`,
        acceptedBody,
      ),
      env,
      context,
    );
    assert.equal(acceptedReplay.status, 200);
    const accepted = (await acceptedReplay.json()).submission;
    assert.equal(accepted.id, acceptedQueued.id);
    assert.equal(accepted.verdict, "accepted");
    assert.equal(accepted.result.authority, "server-isolated-python");
    assert.equal(accepted.result.language, "python");
    assert.equal(accepted.result.runtime, "python-3.13-linux");
    assert.match(accepted.result.contractDigest, /^[a-f0-9]{64}$/);
    assert.equal(Object.hasOwn(accepted.result, "durationMs"), false);
    assert.equal(judgeCalls.length, 3);

    const conflictingReplay = await worker.fetch(
      workerRequest(`/trusted/assignments/${issued.id}/submissions`, {
        clientSubmissionId: acceptedBody.clientSubmissionId,
        source: `${acceptedBody.source}\n# changed`,
      }),
      env,
      context,
    );
    assert.equal(conflictingReplay.status, 409);
    assert.equal((await conflictingReplay.json()).error.code, "IDEMPOTENCY_CONFLICT");
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM trusted_submissions").get().count,
      2,
    );

    // Example rehearsal is a separate, samples-only lane for both trusted
    // languages. It must not accept the assignment or expose hidden cases.
    const pythonExampleAssignmentResponse = await worker.fetch(
      workerRequest(
        "/trusted/assignments",
        {
          clientRequestId: "assignment-request:bob-examples12345",
          language: "python",
          challengeKey: "stable-window",
        },
        "bob@example.com",
      ),
      env,
      context,
    );
    assert.equal(pythonExampleAssignmentResponse.status, 201);
    const pythonExampleAssignment =
      (await pythonExampleAssignmentResponse.json()).assignment;
    const pythonExampleSource =
      "def longest_stable_window(nums, max_gap):\n    return 2";
    const pythonExampleResponse = await worker.fetch(
      workerRequest(
        `/trusted/assignments/${pythonExampleAssignment.id}/example-runs`,
        {
          clientRunId: "example:bob-python12345",
          source: pythonExampleSource,
        },
        "bob@example.com",
      ),
      env,
      context,
    );
    assert.equal(pythonExampleResponse.status, 202);
    const pythonExample = (await pythonExampleResponse.json()).exampleRun;
    const pythonExampleJudgeBody = judgeCalls.at(-1).body;
    assert.equal(pythonExampleJudgeBody.language, "python3");
    assert.equal(pythonExampleJudgeBody.runtime, "python-3.13-linux");
    assert.deepEqual(
      pythonExampleJudgeBody.tests.map((entry) => entry.id),
      pythonExampleAssignment.challenge.samples.map((entry) => entry.id),
    );
    assert.equal(
      pythonExampleJudgeBody.tests.every((entry) => entry.visibility === "sample"),
      true,
    );
    assert.doesNotMatch(JSON.stringify(pythonExampleJudgeBody.tests), /hidden-/);
    const pythonExampleResult = {
      version: "judge.result.v1",
      submissionId: pythonExample.id,
      ...callbackContract(pythonExampleJudgeBody),
      verdict: "accepted",
      passed: 2,
      total: 2,
      caseResults: pythonExampleJudgeBody.tests.map((entry, index) => ({
        id: entry.id,
        visibility: "sample",
        status: "passed",
        actualOutput: index === 0 ? "2" : "4",
        expected: "must not be persisted",
      })),
    };
    assert.equal(
      (
        await worker.fetch(
          signedCallbackRequest(env, pythonExampleResult),
          env,
          context,
        )
      ).status,
      204,
    );
    const pythonExampleReplay = await worker.fetch(
      workerRequest(
        `/trusted/assignments/${pythonExampleAssignment.id}/example-runs`,
        {
          clientRunId: "example:bob-python12345",
          source: pythonExampleSource,
        },
        "bob@example.com",
      ),
      env,
      context,
    );
    assert.equal(pythonExampleReplay.status, 200);
    const settledPythonExample = (await pythonExampleReplay.json()).exampleRun;
    assert.equal(settledPythonExample.result.authority, "server-isolated-python");
    assert.equal(settledPythonExample.result.language, "python");
    assert.equal(settledPythonExample.result.runtime, "python-3.13-linux");
    assert.equal(settledPythonExample.result.total, 2);
    assert.equal(settledPythonExample.result.publicCaseResults.length, 2);
    assert.equal(
      JSON.stringify(settledPythonExample.result).includes("must not be persisted"),
      false,
    );
    assert.equal(
      database.prepare("SELECT status FROM trusted_assignments WHERE id = ?").get(
        pythonExampleAssignment.id,
      ).status,
      "active",
      "Python example rehearsal must not close the assignment",
    );

    const listedResponse = await worker.fetch(
      workerRequest("/trusted/assignments"),
      env,
      context,
    );
    const listed = await listedResponse.json();
    assert.equal(listed.entries[0].status, "accepted");
    assert.equal(listed.entries[0].latestSubmission.id, accepted.id);
    assert.equal(
      listed.entries[0].latestSubmission.clientSubmissionId,
      "submission:alice-second",
    );
    assert.equal(Object.hasOwn(listed.entries[0].challenge, "hiddenCases"), false);

    const swiftIssuedResponse = await worker.fetch(
      workerRequest("/trusted/assignments", {
        clientRequestId: "assignment-request:swift12345",
        language: "swift",
      }),
      env,
      context,
    );
    assert.equal(swiftIssuedResponse.status, 201);
    const swiftIssued = (await swiftIssuedResponse.json()).assignment;
    assert.equal(swiftIssued.program.language, "swift");
    assert.equal(swiftIssued.challenge.language, "swift");
    assert.equal(swiftIssued.challenge.key, "swift-two-sum");
    const swiftCatalogIssueBody = {
      clientRequestId: "assignment-request:swift-product12345",
      language: "swift",
      challengeKey: "swift-product-except-self",
    };
    const swiftCatalogIssuedResponse = await worker.fetch(
      workerRequest("/trusted/assignments", swiftCatalogIssueBody),
      env,
      context,
    );
    assert.equal(swiftCatalogIssuedResponse.status, 201);
    const swiftCatalogIssued = (await swiftCatalogIssuedResponse.json()).assignment;
    assert.equal(swiftCatalogIssued.program.language, "swift");
    assert.equal(swiftCatalogIssued.challenge.key, "swift-product-except-self");
    const swiftCatalogReplayResponse = await worker.fetch(
      workerRequest("/trusted/assignments", swiftCatalogIssueBody),
      env,
      context,
    );
    assert.equal(swiftCatalogReplayResponse.status, 200);
    assert.equal(
      (await swiftCatalogReplayResponse.json()).assignment.id,
      swiftCatalogIssued.id,
    );
    const swiftCatalogConflictResponse = await worker.fetch(
      workerRequest("/trusted/assignments", {
        clientRequestId: swiftCatalogIssueBody.clientRequestId,
        language: "swift",
      }),
      env,
      context,
    );
    assert.equal(swiftCatalogConflictResponse.status, 409);
    assert.equal(
      (await swiftCatalogConflictResponse.json()).error.code,
      "IDEMPOTENCY_CONFLICT",
    );
    const filteredSwiftListResponse = await worker.fetch(
      workerRequest("/trusted/assignments?challengeKey=swift-product-except-self"),
      env,
      context,
    );
    assert.equal(filteredSwiftListResponse.status, 200);
    const filteredSwiftList = await filteredSwiftListResponse.json();
    assert.ok(filteredSwiftList.entries.length >= 1);
    assert.ok(
      filteredSwiftList.entries.every(
        (entry) => entry.challenge.key === "swift-product-except-self",
      ),
    );
    for (const [clientRequestId, challengeKey] of [
      ["assignment-request:swift-unknown123", "swift-not-allowlisted"],
      ["assignment-request:swift-python123", "stable-window"],
    ]) {
      const invalidChallengeResponse = await worker.fetch(
        workerRequest("/trusted/assignments", {
          clientRequestId,
          language: "swift",
          challengeKey,
        }),
        env,
        context,
      );
      assert.equal(invalidChallengeResponse.status, 400);
      assert.equal(
        (await invalidChallengeResponse.json()).error.code,
        "INVALID_CHALLENGE_KEY",
      );
    }
    const swiftSource = "import Foundation\nfunc twoSum(_ nums: [Int], _ target: Int) -> [Int] { [0, 1] }";
    const swiftQueuedResponse = await worker.fetch(
      workerRequest(`/trusted/assignments/${swiftIssued.id}/submissions`, {
        clientSubmissionId: "submission:swift-abc12345",
        source: swiftSource,
      }),
      env,
      context,
    );
    assert.equal(swiftQueuedResponse.status, 202);
    const swiftQueued = (await swiftQueuedResponse.json()).submission;
    const swiftJudgeBody = judgeCalls.at(-1).body;
    assert.equal(swiftJudgeBody.language, "swift6");
    assert.equal(swiftJudgeBody.runtime, "swift-6.3.3-linux");
    assert.match(swiftJudgeBody.source, /JSONDecoder/);
    assert.doesNotMatch(swiftJudgeBody.source, /hidden-duplicate|negative complement/);
    const swiftCompileResult = {
      version: "judge.result.v1",
      submissionId: swiftQueued.id,
      ...callbackContract(swiftJudgeBody),
      verdict: "compile-error",
      passed: 0,
      total: swiftJudgeBody.tests.length,
    };
    assert.equal(
      (
        await worker.fetch(
          signedCallbackRequest(env, swiftCompileResult),
          env,
          context,
        )
      ).status,
      204,
    );
    const swiftCompileReplay = await worker.fetch(
      workerRequest(`/trusted/assignments/${swiftIssued.id}/submissions`, {
        clientSubmissionId: "submission:swift-abc12345",
        source: swiftSource,
      }),
      env,
      context,
    );
    const swiftCompileReceipt = (await swiftCompileReplay.json()).submission;
    assert.equal(swiftCompileReceipt.verdict, "compile-error");
    assert.equal(swiftCompileReceipt.result.authority, "server-isolated-swift");
    assert.equal(swiftCompileReceipt.result.language, "swift");
    assert.equal(swiftCompileReceipt.result.runtime, "swift-6.3.3-linux");
    const assignmentStatusBeforeExamples = database.prepare(
      "SELECT status FROM trusted_assignments WHERE id = ?",
    ).get(swiftIssued.id).status;
    const swiftExampleResponse = await worker.fetch(
      workerRequest(`/trusted/assignments/${swiftIssued.id}/example-runs`, {
        clientRunId: "example:swift-abc12345",
        source: swiftSource,
      }),
      env,
      context,
    );
    assert.equal(swiftExampleResponse.status, 202);
    const swiftExample = (await swiftExampleResponse.json()).exampleRun;
    assert.match(swiftExample.id, /^example-[a-f0-9]{32}$/);
    assert.equal(swiftExample.status, "pending");
    const swiftExampleJudgeBody = judgeCalls.at(-1).body;
    assert.equal(swiftExampleJudgeBody.submissionId, swiftExample.id);
    assert.equal(swiftExampleJudgeBody.language, "swift6");
    assert.equal(swiftExampleJudgeBody.tests.length, swiftIssued.challenge.samples.length);
    assert.equal(
      swiftExampleJudgeBody.tests.every((entry) => entry.id.startsWith("sample-")),
      true,
    );
    assert.doesNotMatch(JSON.stringify(swiftExampleJudgeBody.tests), /hidden-duplicate|negative complement/);
    const swiftExampleResult = {
      version: "judge.result.v1",
      submissionId: swiftExample.id,
      ...callbackContract(swiftExampleJudgeBody),
      verdict: "wrong-answer",
      passed: 1,
      total: swiftExampleJudgeBody.tests.length,
      failedCaseIndex: 1,
      diagnostic: "public example mismatch",
      caseResults: swiftExampleJudgeBody.tests.map((entry, index) => ({
        id: entry.id,
        visibility: "sample",
        passed: index === 0,
        actualOutput: index === 0 ? "[0,1]" : "[1,0]",
        expected: "should not be returned",
      })),
    };
    assert.equal(
      (
        await worker.fetch(
          signedCallbackRequest(env, swiftExampleResult),
          env,
          context,
        )
      ).status,
      204,
    );
    const swiftExampleReplay = await worker.fetch(
      workerRequest(`/trusted/assignments/${swiftIssued.id}/example-runs`, {
        clientRunId: "example:swift-abc12345",
        source: swiftSource,
      }),
      env,
      context,
    );
    assert.equal(swiftExampleReplay.status, 200);
    const settledSwiftExample = (await swiftExampleReplay.json()).exampleRun;
    assert.equal(settledSwiftExample.verdict, "wrong-answer");
    assert.equal(settledSwiftExample.result.authority, "server-isolated-swift");
    assert.equal(settledSwiftExample.result.total, swiftIssued.challenge.samples.length);
    assert.equal(settledSwiftExample.result.failedCaseIndex, 1);
    assert.deepEqual(
      settledSwiftExample.result.publicCaseResults.map(({ id, status, actualOutput }) => ({
        id,
        status,
        actualOutput,
      })),
      [
        {
          id: swiftIssued.challenge.samples[0].id,
          status: "passed",
          actualOutput: "[0,1]",
        },
        {
          id: swiftIssued.challenge.samples[1].id,
          status: "failed",
          actualOutput: "[1,0]",
        },
      ],
    );
    assert.equal(
      JSON.stringify(settledSwiftExample.result).includes("should not be returned"),
      false,
    );
    assert.equal(
      settledSwiftExample.result.failedCaseId,
      swiftIssued.challenge.samples[1].id,
    );
    assert.equal(
      database.prepare("SELECT status FROM trusted_assignments WHERE id = ?").get(swiftIssued.id).status,
      assignmentStatusBeforeExamples,
      "example runs must not close or accept the assignment",
    );

    // Custom Swift rehearsal uses the execution-only gateway contract. It
    // receives inputs but never expected values, revisions, or hidden cases,
    // and it must not create trusted submission evidence.
    const submissionCountBeforeCustom = database.prepare(
      "SELECT COUNT(*) AS count FROM trusted_submissions",
    ).get().count;
    const customBody = {
      clientRunId: "custom:swift-abc12345",
      source: swiftSource,
      cases: [
        {
          id: "case-1",
          name: "pair exists",
          args: [[2, 7, 11, 15], 9],
        },
        {
          id: "case-2",
          name: "pair missing",
          args: [[1, 2], 8],
        },
      ],
    };
    gatewayAvailable = false;
    const customUnavailableResponse = await worker.fetch(
      workerRequest(`/trusted/assignments/${swiftIssued.id}/custom-runs`, customBody),
      env,
      context,
    );
    assert.equal(customUnavailableResponse.status, 503);
    assert.equal((await customUnavailableResponse.json()).error.code, "JUDGE_ENQUEUE_UNAVAILABLE");
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM trusted_custom_run_payloads").get().count,
      1,
      "a custom run keeps its input only while enqueue is unavailable",
    );
    gatewayAvailable = true;
    const customQueuedResponse = await worker.fetch(
      workerRequest(`/trusted/assignments/${swiftIssued.id}/custom-runs`, customBody),
      env,
      context,
    );
    assert.equal(customQueuedResponse.status, 202);
    const customQueued = (await customQueuedResponse.json()).customRun;
    assert.match(customQueued.id, /^custom-[a-f0-9]{32}$/);
    assert.equal(customQueued.status, "pending");
    const customJudgeBody = judgeCalls.at(-1).body;
    assert.equal(judgeCalls.at(-1).url, "https://judge.example/v1/executions");
    assert.equal(customJudgeBody.version, "judge.execution.v1");
    assert.equal(customJudgeBody.executionId, customQueued.id);
    assert.equal(customJudgeBody.cases.length, 2);
    assert.equal(Object.hasOwn(customJudgeBody, "expected"), false);
    assert.equal(Object.hasOwn(customJudgeBody, "contentRevision"), false);
    assert.equal(Object.hasOwn(customJudgeBody, "judgeRevision"), false);
    assert.equal(Object.hasOwn(customJudgeBody, "entrypoint"), false);
    assert.match(customJudgeBody.source, /JSONDecoder/);
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM trusted_submissions").get().count,
      submissionCountBeforeCustom,
    );
    const customResult = {
      version: "judge.execution.result.v1",
      executionId: customQueued.id,
      language: "swift6",
      runtime: "swift-6.3.3-linux",
      executed: 1,
      total: 2,
      diagnostic: "second input failed at runtime",
      cases: [
        { id: "case-1", status: "executed", actualOutput: "[0,1]\n" },
        { id: "case-2", status: "runtime-error", diagnostic: "boom" },
      ],
    };
    const customCallback = await worker.fetch(
      signedCallbackRequest(env, customResult, {
        idempotencyKey: `judge-execution-result:${customQueued.id}`,
      }),
      env,
      context,
    );
    assert.equal(customCallback.status, 204);
    const customReplay = await worker.fetch(
      workerRequest(`/trusted/assignments/${swiftIssued.id}/custom-runs`, customBody),
      env,
      context,
    );
    assert.equal(customReplay.status, 200);
    const settledCustom = (await customReplay.json()).customRun;
    assert.equal(settledCustom.verdict, "runtime-error");
    assert.equal(settledCustom.result.authority, "server-isolated-swift");
    assert.equal(settledCustom.result.language, "swift");
    assert.equal(settledCustom.result.passed, 1);
    assert.equal(settledCustom.result.total, 2);
    assert.deepEqual(
      settledCustom.result.cases.map(({ id, name, status, passed, actual }) => ({
        id,
        name,
        status,
        passed,
        actual,
      })),
      [
        { id: "case-1", name: "pair exists", status: "passed", passed: true, actual: [0, 1] },
        { id: "case-2", name: "pair missing", status: "runtime-error", passed: false, actual: undefined },
      ],
    );
    assert.equal(
      database.prepare("SELECT status FROM trusted_assignments WHERE id = ?").get(swiftIssued.id).status,
      assignmentStatusBeforeExamples,
    );
    const customConflict = await worker.fetch(
      workerRequest(`/trusted/assignments/${swiftIssued.id}/custom-runs`, {
        ...customBody,
        cases: [{ ...customBody.cases[0], args: [[3, 4], 7] }],
      }),
      env,
      context,
    );
    assert.equal(customConflict.status, 409);
    assert.equal((await customConflict.json()).error.code, "IDEMPOTENCY_CONFLICT");

    const ownerId = database.prepare(
      "SELECT user_id FROM trusted_assignments WHERE id = ?",
    ).get(issued.id).user_id;
    const maintenanceNow = Date.now();
    for (const [id, clientId, enqueuedAt] of [
      [
        "verified-stale-delivery",
        "submission:stale-delivery",
        null,
      ],
      [
        "verified-stale-callback",
        "submission:stale-callback",
        maintenanceNow - 31 * 60 * 1000,
      ],
    ]) {
      database.prepare(`
        INSERT INTO trusted_submissions
          (id, assignment_id, user_id, client_submission_id, request_hash,
           source_hash, status, verdict, result_json, settlement_hash,
           submitted_at, enqueued_at, settled_at, purge_after)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?,
                ?, NULL, ?)
      `).run(
        id,
        issued.id,
        ownerId,
        clientId,
        "d".repeat(64),
        "e".repeat(64),
        maintenanceNow - 2 * 60 * 60 * 1000,
        enqueuedAt,
        maintenanceNow + 60 * 60 * 1000,
      );
      if (enqueuedAt === null) {
        database.prepare(`
          INSERT INTO trusted_submission_payloads
            (submission_id, user_id, source_text, purge_after)
          VALUES (?, ?, 'def solve():\n    return 1', ?)
        `).run(id, ownerId, maintenanceNow - 1);
      }
    }
    const maintenanceResponse = await worker.fetch(
      workerRequest("/capabilities"),
      env,
      context,
    );
    assert.equal(maintenanceResponse.status, 200);
    const maintained = database.prepare(`
      SELECT id, status, verdict, settlement_hash
      FROM trusted_submissions
      WHERE id IN ('verified-stale-delivery', 'verified-stale-callback')
      ORDER BY id
    `).all();
    assert.deepEqual(
      maintained.map((row) => [row.id, row.status, row.verdict]),
      [
        ["verified-stale-callback", "settled", "judge-error"],
        ["verified-stale-delivery", "settled", "judge-error"],
      ],
    );
    assert.ok(maintained.every((row) => row.settlement_hash.length === 64));
    assert.equal(
      database.prepare(`
        SELECT COUNT(*) AS count
        FROM trusted_submission_payloads
        WHERE submission_id = 'verified-stale-delivery'
      `).get().count,
      0,
    );

    database.prepare(`
      INSERT INTO trusted_submissions
        (id, assignment_id, user_id, client_submission_id, request_hash,
         source_hash, status, verdict, result_json, settlement_hash,
         submitted_at, enqueued_at, settled_at, purge_after)
      VALUES ('verified-timeout-race', ?, ?, 'submission:timeout-race', ?, ?,
              'pending', NULL, NULL, NULL, ?, NULL, NULL, ?)
    `).run(
      issued.id,
      ownerId,
      "f".repeat(64),
      "a".repeat(64),
      maintenanceNow - 2 * 60 * 60 * 1000,
      maintenanceNow + 60 * 60 * 1000,
    );
    database.prepare(`
      INSERT INTO trusted_submission_payloads
        (submission_id, user_id, source_text, purge_after)
      VALUES ('verified-timeout-race', ?, 'def solve():\n    return 1', ?)
    `).run(ownerId, maintenanceNow + 60 * 60 * 1000);
    let injectedRetry = false;
    const racingDb = new SqliteD1(database, async (sql, args, sqlite) => {
      if (
        !injectedRetry &&
        sql.includes("SET status = 'settled', verdict = 'judge-error'") &&
        args.includes("verified-timeout-race")
      ) {
        injectedRetry = true;
        sqlite.prepare(`
          UPDATE trusted_submissions
          SET enqueued_at = ?
          WHERE id = 'verified-timeout-race' AND status = 'pending'
        `).run(maintenanceNow);
        sqlite.prepare(`
          DELETE FROM trusted_submission_payloads
          WHERE submission_id = 'verified-timeout-race'
        `).run();
      }
    });
    const racedMaintenanceResponse = await worker.fetch(
      workerRequest("/capabilities"),
      { ...env, DB: racingDb },
      context,
    );
    assert.equal(racedMaintenanceResponse.status, 200);
    assert.equal(injectedRetry, true);
    const racedSubmission = database.prepare(`
        SELECT status, verdict, enqueued_at
        FROM trusted_submissions
        WHERE id = 'verified-timeout-race'
      `).get();
    assert.deepEqual(
      [
        racedSubmission.status,
        racedSubmission.verdict,
        racedSubmission.enqueued_at,
      ],
      ["pending", null, maintenanceNow],
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    database.close();
  }
});
