import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  MAX_TRUSTED_SOURCE_BYTES,
  TRUSTED_CHALLENGE_COUNT,
  TRUSTED_SWIFT_CHALLENGE_COUNT,
  cleanTrustedId,
  cleanTrustedSource,
  normalizeTrustedGatewayResult,
  normalizeTrustedGatewayExampleResult,
  normalizeTrustedPublicCaseResults,
  normalizeTrustedJudgeResult,
  privateJudgeSpec,
  publicExampleJudgeSpec,
  publicTrustedChallenge,
  trustedChallengeForKey,
  trustedChallengeForSequence,
  trustedGatewaySubmission,
} from "../worker/trusted-assessments.mjs";

test("server-only challenge projections never expose sealed cases", () => {
  assert.equal(TRUSTED_CHALLENGE_COUNT, 3);
  const keys = new Set();
  for (let index = 0; index < TRUSTED_CHALLENGE_COUNT; index += 1) {
    const challenge = trustedChallengeForSequence(index);
    keys.add(challenge.key);
    const publicProjection = publicTrustedChallenge(challenge);
    const privateProjection = privateJudgeSpec(challenge);
    assert.equal(Object.hasOwn(publicProjection, "hiddenCases"), false);
    assert.equal(
      privateProjection.cases.length,
      challenge.samples.length + challenge.hiddenCases.length,
    );
    assert.equal(
      privateProjection.cases.filter((entry) => entry.visibility === "hidden").length,
      challenge.hiddenCases.length,
    );
    for (const hidden of challenge.hiddenCases) {
      assert.doesNotMatch(JSON.stringify(publicProjection), new RegExp(hidden.id));
    }
  }
  assert.equal(keys.size, TRUSTED_CHALLENGE_COUNT);
  assert.equal(trustedChallengeForSequence(3).key, trustedChallengeForSequence(0).key);
});

test("trusted request and source boundaries fail closed", () => {
  assert.equal(cleanTrustedId("short"), null);
  assert.equal(cleanTrustedId("submission:abc12345"), "submission:abc12345");
  assert.equal(cleanTrustedId("submission/abc12345"), null);
  assert.equal(cleanTrustedId(`submission:${"a".repeat(128)}`), null);
  assert.equal(cleanTrustedSource("def solve():\r\n    return 1"), "def solve():\n    return 1");
  assert.equal(cleanTrustedSource(""), null);
  assert.equal(cleanTrustedSource("x".repeat(MAX_TRUSTED_SOURCE_BYTES + 1)), null);
});

test("judge results require exact totals and cannot manufacture acceptance", () => {
  assert.equal(
    normalizeTrustedJudgeResult(
      { verdict: "accepted", passed: 6, total: 7, durationMs: 10 },
      7,
    ),
    null,
  );
  assert.equal(
    normalizeTrustedJudgeResult(
      { verdict: "accepted", passed: 7, total: 8, durationMs: 10 },
      7,
    ),
    null,
  );
  assert.deepEqual(
    normalizeTrustedJudgeResult(
      {
        verdict: "wrong-answer",
        passed: 3,
        total: 7,
        durationMs: 51,
        runtime: "python\nsecret",
        hiddenOutput: "drop",
      },
      7,
    ),
    {
      verdict: "wrong-answer",
      passed: 3,
      total: 7,
      durationMs: 51,
      runtime: "pythonsecret",
    },
  );
});

test("callable challenges translate into the bounded stdin/stdout gateway contract", async () => {
  const challenge = trustedChallengeForSequence(0);
  const judgeSpec = privateJudgeSpec(challenge);
  const source =
    "def longest_stable_window(nums, max_gap):\n    return len(nums)";
  const submission = await trustedGatewaySubmission({
    submissionId: "verified-abc12345",
    source,
    judgeSpec,
    callbackUrl: "https://swift.example/api/internal/judge-results",
  });
  assert.equal(submission.version, "judge.submission.v1");
  assert.equal(submission.language, "python3");
  assert.equal(submission.runtime, "python-3.13-linux");
  assert.match(submission.contractDigest, /^[a-f0-9]{64}$/);
  assert.equal(submission.comparison, "exact");
  assert.equal(submission.tests.length, judgeSpec.cases.length);
  assert.equal(submission.tests[0].input, '{"args":[[8,2,4,7],4]}\n');
  assert.equal(submission.tests[0].expectedOutput, "2\n");
  assert.match(submission.source, /compile\(__swift_ghost_source/);
  assert.match(submission.source, /saved_stdio/);
  assert.match(submission.source, /submission exited before its required entrypoint/);
  assert.match(submission.source, /longest_stable_window/);
  assert.doesNotMatch(submission.source, /hidden-contract/);
  assert.ok(new TextEncoder().encode(submission.source).byteLength <= 48_000);
  assert.equal(
    submission.callbackUrl,
    "https://swift.example/api/internal/judge-results",
  );
  await assert.rejects(
    () => trustedGatewaySubmission({
        submissionId: "verified-abc12345",
        source,
        judgeSpec,
        callbackUrl: "http://swift.example/api/internal/judge-results",
      }),
    /INVALID_TRUSTED_GATEWAY_INPUT/,
  );
});

test("Swift challenges generate typed harnesses without embedding sealed cases", async () => {
  assert.equal(TRUSTED_SWIFT_CHALLENGE_COUNT, 20);
  const challenge = trustedChallengeForSequence(0, "swift");
  const publicProjection = publicTrustedChallenge(challenge);
  const judgeSpec = privateJudgeSpec(challenge);
  assert.equal(publicProjection.language, "swift");
  assert.equal(publicProjection.runtime, "swift-6.3.3-linux");
  assert.equal(Object.hasOwn(publicProjection, "hiddenCases"), false);
  const submission = await trustedGatewaySubmission({
    submissionId: "verified-swift12345",
    source: "import Foundation\nfunc twoSum(_ nums: [Int], _ target: Int) -> [Int] { [0, 1] }",
    judgeSpec,
    callbackUrl: "https://swift.example/api/internal/judge-results",
  });
  assert.equal(submission.language, "swift6");
  assert.match(submission.source, /JSONDecoder/);
  assert.match(submission.source, /@main/);
  assert.match(submission.source, /__SwiftGhostMain/);
  assert.match(submission.source, /twoSum\(__swiftGhostInput\.arg0, __swiftGhostInput\.arg1\)/);
  assert.doesNotMatch(submission.source, /hidden-duplicate|negative complement/);
  assert.equal(submission.tests.length, challenge.samples.length + challenge.hiddenCases.length);
  await assert.rejects(
    () => trustedGatewaySubmission({
      submissionId: "verified-swift12345",
      source: "func twoSum(_ nums: [Int], _ target: Int) -> [Int] { [0, 1] }",
      judgeSpec: { ...judgeSpec, runtime: "python-3.13-linux" },
      callbackUrl: "https://swift.example/api/internal/judge-results",
    }),
    /INVALID_TRUSTED_JUDGE_SPEC/,
  );
});

test("portable iOS Swift contract uses only JSON-safe values and keeps its sealed checks server-side", async () => {
  const challenge = trustedChallengeForKey("swift-independent-array-copies");
  assert.ok(challenge);
  assert.equal(challenge.language, "swift");
  assert.equal(challenge.entrypoint.returns, "[[Int]]");
  assert.deepEqual(
    challenge.entrypoint.parameters.map((parameter) => parameter.type),
    ["[Int]", "Int", "Int"],
  );
  const publicProjection = publicTrustedChallenge(challenge);
  assert.equal(Object.hasOwn(publicProjection, "hiddenCases"), false);
  const request = await trustedGatewaySubmission({
    submissionId: "verified-ios-swift12345",
    source: "import Foundation\nfunc makeIndependentCopies(_ values: [Int], _ first: Int, _ second: Int) -> [[Int]] { var left = values; var right = values; left.append(first); right.append(second); return [left, right] }",
    judgeSpec: privateJudgeSpec(challenge),
    callbackUrl: "https://swift.example/api/internal/judge-results",
  });
  assert.equal(request.tests.length, challenge.samples.length + challenge.hiddenCases.length);
  assert.match(request.source, /makeIndependentCopies\(__swiftGhostInput\.arg0, __swiftGhostInput\.arg1, __swiftGhostInput\.arg2\)/);
  assert.equal(request.tests.filter((testCase) => testCase.visibility === "sample").length, 2);
  assert.equal(request.tests.filter((testCase) => testCase.visibility === "hidden").length, 4);
});

test("optional iOS Swift contract preserves nil through the typed JSON harness", async () => {
  const challenge = trustedChallengeForKey("swift-optional-port-boundary");
  assert.ok(challenge);
  assert.equal(challenge.entrypoint.returns, "Int?");
  assert.deepEqual(
    challenge.entrypoint.parameters.map((parameter) => parameter.type),
    ["String?"],
  );
  const request = await trustedGatewaySubmission({
    submissionId: "verified-ios-optional12345",
    source: "import Foundation\nfunc normalizedPort(_ raw: String?) -> Int? { guard let raw, let port = Int(raw), (1...65535).contains(port) else { return nil }; return port }",
    judgeSpec: privateJudgeSpec(challenge),
    callbackUrl: "https://swift.example/api/internal/judge-results",
  });
  assert.equal(request.tests.length, challenge.samples.length + challenge.hiddenCases.length);
  assert.equal(request.tests[1].input, '{"args":[null]}\n');
  assert.equal(request.tests[1].expectedOutput, "null\n");
  assert.match(request.source, /arg0: String\?/);
  assert.match(request.source, /normalizedPort\(__swiftGhostInput\.arg0\)/);
});

test("Swift example contracts include only public samples and expose only public failure indexes", async () => {
  const challenge = trustedChallengeForSequence(0, "swift");
  const exampleSpec = publicExampleJudgeSpec(challenge);
  assert.equal(exampleSpec.language, "swift");
  assert.equal(exampleSpec.cases.length, challenge.samples.length);
  assert.equal(
    exampleSpec.cases.every((entry) => entry.visibility === "sample"),
    true,
  );
  assert.doesNotMatch(JSON.stringify(exampleSpec), /hidden-duplicate|negative complement/);
  const submission = await trustedGatewaySubmission({
    submissionId: "example-swift12345",
    source: "import Foundation\nfunc twoSum(_ nums: [Int], _ target: Int) -> [Int] { [0, 1] }",
    judgeSpec: exampleSpec,
    callbackUrl: "https://swift.example/api/internal/judge-results",
  });
  assert.equal(submission.tests.length, challenge.samples.length);
  assert.deepEqual(
    normalizeTrustedGatewayExampleResult(
      {
        version: "judge.result.v1",
        submissionId: "example-swift12345",
        verdict: "wrong-answer",
        passed: 1,
        total: challenge.samples.length,
        failedCaseIndex: 1,
        language: "swift6",
        runtime: "swift-6.3.3-linux",
        contentRevision: challenge.contentRevision,
        judgeRevision: challenge.judgeRevision,
        contractDigest: submission.contractDigest,
        diagnostic: "bounded public diagnostic",
      },
      "example-swift12345",
      {
        total: challenge.samples.length,
        language: "swift",
        runtime: "swift-6.3.3-linux",
        contentRevision: challenge.contentRevision,
        judgeRevision: challenge.judgeRevision,
        contractDigest: submission.contractDigest,
      },
    ),
    {
      verdict: "wrong-answer",
      passed: 1,
      total: challenge.samples.length,
      language: "swift",
      runtime: "swift-6.3.3-linux",
      contentRevision: challenge.contentRevision,
      judgeRevision: challenge.judgeRevision,
      contractDigest: submission.contractDigest,
      failedCaseIndex: 1,
      diagnostic: "bounded public diagnostic",
    },
  );
});

test("public example case results are sample-bound, bounded, and omit hidden payloads", () => {
  const publicCaseIds = ["sample-1", "sample-2"];
  const normalized = normalizeTrustedPublicCaseResults(
    {
      caseResults: [
        {
          id: "sample-1",
          visibility: "sample",
          status: "passed",
          actualOutput: "[0,1]",
          expected: "must never be copied",
        },
        {
          id: "sample-2",
          visibility: "public",
          passed: false,
          actual: "[1,0]",
          diagnostic: "bounded mismatch",
          hiddenOutput: "must never be copied",
        },
      ],
      hiddenCases: [{ id: "hidden-secret", actual: "private" }],
    },
    publicCaseIds,
  );
  assert.deepEqual(normalized, [
    {
      id: "sample-1",
      status: "passed",
      actualOutput: "[0,1]",
    },
    {
      id: "sample-2",
      status: "failed",
      actualOutput: "[1,0]",
      diagnostic: "bounded mismatch",
    },
  ]);
  assert.equal(JSON.stringify(normalized).includes("hidden"), false);
  assert.equal(
    normalizeTrustedPublicCaseResults(
      { caseResults: [{ id: "hidden-secret", passed: true }, { id: "sample-2", passed: true }] },
      publicCaseIds,
    ),
    null,
  );
  assert.equal(
    normalizeTrustedPublicCaseResults(
      { caseResults: [{ id: "sample-1", visibility: "hidden", passed: true }, { id: "sample-2", passed: true }] },
      publicCaseIds,
    ),
    null,
  );
  assert.equal(
    normalizeTrustedPublicCaseResults(
      { caseResults: [{ id: "sample-1", passed: true }] },
      publicCaseIds,
    ),
    null,
  );
  const bounded = normalizeTrustedPublicCaseResults(
    {
      caseResults: publicCaseIds.map((id) => ({
        id,
        passed: true,
        actualOutput: "x".repeat(5_000),
      })),
    },
    publicCaseIds,
  );
  assert.ok(bounded.every((entry) => new TextEncoder().encode(entry.actualOutput).byteLength <= 2_048));
  const unicodeBounded = normalizeTrustedPublicCaseResults(
    {
      caseResults: publicCaseIds.map((id) => ({
        id,
        passed: true,
        actualOutput: "🙂".repeat(5_000),
      })),
    },
    publicCaseIds,
  );
  assert.ok(unicodeBounded.every((entry) => new TextEncoder().encode(entry.actualOutput).byteLength <= 2_048));
  assert.ok(unicodeBounded.every((entry) => !entry.actualOutput.includes("�")));
});

test("aggregate-only example callbacks remain compatible while case results bind revisions", async () => {
  const challenge = trustedChallengeForSequence(0, "swift");
  const spec = publicExampleJudgeSpec(challenge);
  const submission = await trustedGatewaySubmission({
    submissionId: "example-swift-case-results",
    source: "func twoSum(_ nums: [Int], _ target: Int) -> [Int] { [0, 1] }",
    judgeSpec: spec,
    callbackUrl: "https://swift.example/api/internal/judge-results",
  });
  const callback = {
    version: "judge.result.v1",
    submissionId: "example-swift-case-results",
    verdict: "accepted",
    passed: spec.cases.length,
    total: spec.cases.length,
    language: "swift6",
    runtime: spec.runtime,
    contentRevision: spec.contentRevision,
    judgeRevision: spec.judgeRevision,
    contractDigest: submission.contractDigest,
    caseResults: spec.cases.map((entry) => ({
      id: entry.id,
      visibility: entry.visibility,
      passed: true,
      actualOutput: "[0,1]",
    })),
  };
  const normalized = normalizeTrustedGatewayExampleResult(
    callback,
    callback.submissionId,
    {
      total: spec.cases.length,
      language: "swift",
      runtime: spec.runtime,
      contentRevision: spec.contentRevision,
      judgeRevision: spec.judgeRevision,
      contractDigest: submission.contractDigest,
      publicCaseIds: spec.cases.map((entry) => entry.id),
    },
  );
  assert.equal(normalized.publicCaseResults.length, spec.cases.length);
  assert.equal(normalized.publicCaseResults[0].actualOutput, "[0,1]");
  assert.equal(
    normalizeTrustedGatewayExampleResult(
      { ...callback, judgeRevision: callback.judgeRevision + 1 },
      callback.submissionId,
      {
        total: spec.cases.length,
        language: "swift",
        runtime: spec.runtime,
        contentRevision: spec.contentRevision,
        judgeRevision: spec.judgeRevision,
        contractDigest: submission.contractDigest,
        publicCaseIds: spec.cases.map((entry) => entry.id),
      },
    ),
    null,
  );
});

test("signed gateway results require the frozen language, revisions, digest, and total", () => {
  const expected = {
    total: 7,
    language: "python",
    runtime: "python-3.13-linux",
    contentRevision: 1,
    judgeRevision: 2,
    contractDigest: "a".repeat(64),
  };
  assert.deepEqual(
    normalizeTrustedGatewayResult(
      {
        version: "judge.result.v1",
        submissionId: "verified-abc12345",
        verdict: "wrong-answer",
        passed: 4,
        total: 7,
        failedCaseIndex: 4,
        language: "python3",
        runtime: expected.runtime,
        contentRevision: expected.contentRevision,
        judgeRevision: expected.judgeRevision,
        contractDigest: expected.contractDigest,
        diagnostic: "discarded",
      },
      "verified-abc12345",
      expected,
    ),
    {
      verdict: "wrong-answer",
      passed: 4,
      total: 7,
      language: "python",
      runtime: expected.runtime,
      contentRevision: expected.contentRevision,
      judgeRevision: expected.judgeRevision,
      contractDigest: expected.contractDigest,
    },
  );
  assert.equal(
    normalizeTrustedGatewayResult(
      {
        version: "judge.result.v1",
        submissionId: "verified-abc12345",
        verdict: "accepted",
        passed: 6,
        total: 7,
        language: "python3",
        runtime: expected.runtime,
        contentRevision: expected.contentRevision,
        judgeRevision: expected.judgeRevision,
        contractDigest: expected.contractDigest,
      },
      "verified-abc12345",
      expected,
    ),
    null,
  );
  assert.equal(
    normalizeTrustedGatewayResult(
      {
        version: "judge.result.v1",
        submissionId: "verified-other",
        verdict: "accepted",
        passed: 7,
        total: 7,
        language: "python3",
        runtime: expected.runtime,
        contentRevision: expected.contentRevision,
        judgeRevision: expected.judgeRevision,
        contractDigest: expected.contractDigest,
      },
      "verified-abc12345",
      expected,
    ),
    null,
  );
  assert.equal(
    normalizeTrustedGatewayResult(
      {
        version: "judge.result.v1",
        submissionId: "verified-abc12345",
        verdict: "accepted",
        passed: 7,
        total: 7,
        language: "swift6",
        runtime: expected.runtime,
        contentRevision: expected.contentRevision,
        judgeRevision: expected.judgeRevision,
        contractDigest: expected.contractDigest,
      },
      "verified-abc12345",
      expected,
    ),
    null,
  );
});

async function applyMigration(db, name) {
  const sql = await readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) db.exec(trimmed);
  }
}

function insertProfile(db, userId, email, handle) {
  db.prepare(`
    INSERT INTO community_profiles
      (user_id, email, handle, display_name, bio, timezone, is_public,
       share_activity, show_on_leaderboards, created_at, updated_at)
    VALUES (?, ?, ?, NULL, NULL, NULL, 0, 0, 0, 1, 1)
  `).run(userId, email, handle);
}

function insertAssignment(db, overrides = {}) {
  const row = {
    id: "trusted-assignment-a",
    userId: "alice",
    clientRequestId: "assignment-request:a",
    challengeKey: "stable-window",
    status: "active",
    ...overrides,
  };
  db.prepare(`
    INSERT INTO trusted_assignments
      (id, user_id, client_request_id, request_hash, program_id,
       program_revision, challenge_key, content_revision, judge_revision,
       public_payload_json, status, assigned_at, expires_at, purge_after)
    VALUES (?, ?, ?, ?, 'python-verified-baseline', 1, ?, 1, 1, ?, ?, 100, 200, 300)
  `).run(
    row.id,
    row.userId,
    row.clientRequestId,
    "a".repeat(64),
    row.challengeKey,
    JSON.stringify({
      key: row.challengeKey,
      contentRevision: 1,
      judgeRevision: 1,
      title: "Frozen public prompt",
    }),
    row.status,
  );
  return row;
}

test("trusted migrations enforce ownership, idempotency, settlement hashes, checks, and cascades", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    await applyMigration(db, "0000_amusing_talos.sql");
    await applyMigration(db, "0001_familiar_whizzer.sql");
    await applyMigration(db, "0002_steep_ego.sql");
    await applyMigration(db, "0003_clean_scourge.sql");
    await applyMigration(db, "0004_petite_professor_monster.sql");
    await applyMigration(db, "0005_lying_wilson_fisk.sql");
    await applyMigration(db, "0006_swift_example_runs.sql");
    insertProfile(db, "alice", "alice@example.com", "alice-swift");
    insertProfile(db, "bob", "bob@example.com", "bob-swift");
    const assignment = insertAssignment(db);
    db.prepare(`
      INSERT INTO trusted_assignment_secrets
        (assignment_id, user_id, judge_payload_json, purge_after)
      VALUES (?, 'alice', ?, 300)
    `).run(assignment.id, JSON.stringify({ cases: [{ expected: 3 }] }));

    assert.throws(
      () => insertAssignment(db, {
        id: "trusted-assignment-b",
        clientRequestId: assignment.clientRequestId,
      }),
      /UNIQUE constraint failed/,
    );
    assert.throws(
      () => insertAssignment(db, {
        id: "trusted-assignment-c",
        clientRequestId: "assignment-request:c",
        status: "client-accepted",
      }),
      /CHECK constraint failed/,
    );
    db.prepare(`
      INSERT INTO trusted_submissions
        (id, assignment_id, user_id, client_submission_id, request_hash,
         source_hash, status, verdict, result_json, submitted_at, settled_at,
         purge_after)
      VALUES ('verified-a', ?, 'alice', 'submission:alice-a', ?, ?,
              'pending', NULL, NULL, 110, NULL, 300)
    `).run(assignment.id, "b".repeat(64), "c".repeat(64));
    assert.throws(
      () => db.prepare(`
        UPDATE trusted_submissions
        SET settlement_hash = ?
        WHERE id = 'verified-a'
      `).run("f".repeat(64)),
      /CHECK constraint failed/,
    );
    assert.throws(
      () => db.prepare(`
        INSERT INTO trusted_submissions
          (id, assignment_id, user_id, client_submission_id, request_hash,
           source_hash, status, verdict, result_json, submitted_at, settled_at,
           purge_after)
        VALUES ('verified-cross-owner', ?, 'bob', 'submission:bob-a', ?, ?,
                'pending', NULL, NULL, 110, NULL, 300)
      `).run(assignment.id, "d".repeat(64), "e".repeat(64)),
      /FOREIGN KEY constraint failed/,
    );
    assert.throws(
      () => db.prepare(`
        UPDATE trusted_submissions
        SET status = 'settled', verdict = 'accepted', result_json = '{}'
        WHERE id = 'verified-a'
      `).run(),
      /CHECK constraint failed/,
    );
    db.prepare(`
      INSERT INTO trusted_example_runs
        (id, assignment_id, user_id, client_run_id, request_hash,
         source_hash, status, verdict, result_json, requested_at, settled_at,
         purge_after)
      VALUES ('example-a', ?, 'alice', 'example:alice-a', ?, ?,
              'pending', NULL, NULL, 120, NULL, 300)
    `).run(assignment.id, "1".repeat(64), "2".repeat(64));
    assert.throws(
      () => db.prepare(`
        UPDATE trusted_example_runs
        SET status = 'settled', verdict = 'accepted', result_json = '{}'
        WHERE id = 'example-a'
      `).run(),
      /CHECK constraint failed/,
    );

    const foreignKeyProblems = db.prepare("PRAGMA foreign_key_check").all();
    assert.deepEqual(foreignKeyProblems, []);
    db.prepare("DELETE FROM community_profiles WHERE user_id = 'alice'").run();
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM trusted_assignments").get().count,
      0,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM trusted_submissions").get().count,
      0,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM trusted_example_runs").get().count,
      0,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM trusted_assignment_secrets").get().count,
      0,
    );
  } finally {
    db.close();
  }
});

test("Sites build packages the trusted migration", async () => {
  const sql = await readFile(
    new URL("../dist/.openai/drizzle/0002_steep_ego.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE `trusted_assignments`/);
  assert.match(sql, /trusted_submissions_assignment_owner_fk|FOREIGN KEY \(`assignment_id`,`user_id`\)/);
  const settlementSql = await readFile(
    new URL("../dist/.openai/drizzle/0003_clean_scourge.sql", import.meta.url),
    "utf8",
  );
  assert.match(settlementSql, /settlement_hash/);
  const enqueueSql = await readFile(
    new URL(
      "../dist/.openai/drizzle/0004_petite_professor_monster.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(enqueueSql, /enqueued_at/);
  const swiftVerdictSql = await readFile(
    new URL("../dist/.openai/drizzle/0005_lying_wilson_fisk.sql", import.meta.url),
    "utf8",
  );
  assert.match(swiftVerdictSql, /compile-error/);
  const swiftExampleSql = await readFile(
    new URL("../dist/.openai/drizzle/0006_swift_example_runs.sql", import.meta.url),
    "utf8",
  );
  assert.match(swiftExampleSql, /trusted_example_runs/);
});
