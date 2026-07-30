import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * The authenticated email is deliberately kept on the private profile row.
 * Community queries select an explicit public projection and never expose it.
 */
export const communityProfiles = sqliteTable(
  "community_profiles",
  {
    userId: text("user_id").primaryKey(),
    email: text("email").notNull(),
    handle: text("handle").notNull(),
    displayName: text("display_name"),
    bio: text("bio"),
    timezone: text("timezone"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    shareActivity: integer("share_activity", { mode: "boolean" }).notNull().default(false),
    showOnLeaderboards: integer("show_on_leaderboards", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("community_profiles_email_uidx").on(table.email),
    uniqueIndex("community_profiles_handle_uidx").on(table.handle),
    check(
      "community_profiles_private_off_check",
      sql`${table.isPublic} = 1 OR (${table.shareActivity} = 0 AND ${table.showOnLeaderboards} = 0)`,
    ),
  ],
);

export const communityAttempts = sqliteTable(
  "community_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => communityProfiles.userId, { onDelete: "cascade" }),
    clientAttemptId: text("client_attempt_id").notNull(),
    itemId: text("item_id").notNull(),
    itemRevision: integer("item_revision").notNull(),
    itemTitle: text("item_title").notNull(),
    track: text("track", { enum: ["interview", "ios"] }).notNull(),
    stage: integer("stage").notNull(),
    mode: text("mode", { enum: ["strict", "free"] }).notNull(),
    accuracyBps: integer("accuracy_bps").notNull(),
    wpmBps: integer("wpm_bps").notNull(),
    durationMs: integer("duration_ms").notNull(),
    typedChars: integer("typed_chars").notNull(),
    peeks: integer("peeks").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
    completedDay: text("completed_day").notNull(),
    challengeDate: text("challenge_date"),
    feedEligible: integer("feed_eligible", { mode: "boolean" }).notNull().default(false),
    rankingEligible: integer("ranking_eligible", { mode: "boolean" }).notNull().default(false),
    uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("community_attempts_user_client_uidx").on(table.userId, table.clientAttemptId),
    index("community_attempts_recent_idx").on(table.feedEligible, table.completedAt),
    index("community_attempts_item_rank_idx").on(table.itemId, table.itemRevision, table.stage, table.mode, table.rankingEligible, table.wpmBps),
    index("community_attempts_daily_rank_idx").on(table.challengeDate, table.rankingEligible, table.userId),
    index("community_attempts_user_idx").on(table.userId, table.completedAt),
    check("community_attempts_stage_check", sql`${table.stage} BETWEEN 1 AND 5`),
    check("community_attempts_accuracy_check", sql`${table.accuracyBps} BETWEEN 0 AND 10000`),
    check(
      "community_attempts_ranking_check",
      sql`${table.rankingEligible} = 0 OR (${table.mode} = 'strict' AND ${table.peeks} = 0 AND ${table.accuracyBps} >= 9500 AND ${table.wpmBps} <= 30000 AND ${table.typedChars} >= 20 AND ${table.durationMs} >= 1000)`,
    ),
    check(
      "community_attempts_feed_check",
      sql`${table.feedEligible} = 0 OR (${table.mode} = 'strict' AND ${table.peeks} = 0 AND ${table.accuracyBps} >= 9500 AND ${table.wpmBps} <= 30000 AND ${table.typedChars} >= 20 AND ${table.durationMs} >= 1000)`,
    ),
  ],
);

/**
 * The learner's private, canonical Study Plans snapshot. The revision is
 * server-owned and is used for optimistic concurrency; payloadJson is never
 * selected by community or leaderboard queries.
 */
export const studyWorkspaces = sqliteTable(
  "study_workspaces",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => communityProfiles.userId, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    payloadJson: text("payload_json").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check("study_workspaces_revision_check", sql`${table.revision} >= 1`),
    check(
      "study_workspaces_payload_size_check",
      sql`length(${table.payloadJson}) BETWEEN 2 AND 262144`,
    ),
  ],
);

/** One authoritative challenge definition per UTC day. */
export const dailyChallenges = sqliteTable(
  "daily_challenges",
  {
    date: text("date").primaryKey(),
    itemId: text("item_id").notNull(),
    itemRevision: integer("item_revision").notNull(),
    itemTitle: text("item_title").notNull(),
    track: text("track", { enum: ["interview", "ios"] }).notNull(),
    stage: integer("stage").notNull(),
    mode: text("mode", { enum: ["strict"] }).notNull().default("strict"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check("daily_challenges_stage_check", sql`${table.stage} = 1`),
    check("daily_challenges_mode_check", sql`${table.mode} = 'strict'`),
  ],
);

/**
 * A server-issued, owner-scoped Python checkpoint. Only publicPayloadJson may
 * be projected to the browser; the frozen judge lives in the separate secrets
 * table below.
 */
export const trustedAssignments = sqliteTable(
  "trusted_assignments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => communityProfiles.userId, { onDelete: "cascade" }),
    clientRequestId: text("client_request_id").notNull(),
    requestHash: text("request_hash").notNull(),
    programId: text("program_id").notNull(),
    programRevision: integer("program_revision").notNull(),
    challengeKey: text("challenge_key").notNull(),
    contentRevision: integer("content_revision").notNull(),
    judgeRevision: integer("judge_revision").notNull(),
    publicPayloadJson: text("public_payload_json").notNull(),
    status: text("status", {
      enum: ["active", "accepted", "expired"],
    }).notNull(),
    assignedAt: integer("assigned_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    purgeAfter: integer("purge_after", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("trusted_assignments_id_user_uidx").on(table.id, table.userId),
    uniqueIndex("trusted_assignments_user_client_uidx").on(
      table.userId,
      table.clientRequestId,
    ),
    index("trusted_assignments_user_assigned_idx").on(
      table.userId,
      table.assignedAt,
    ),
    index("trusted_assignments_user_expiry_idx").on(
      table.userId,
      table.expiresAt,
    ),
    index("trusted_assignments_purge_idx").on(table.purgeAfter),
    check(
      "trusted_assignments_request_hash_check",
      sql`length(${table.requestHash}) = 64`,
    ),
    check(
      "trusted_assignments_revision_check",
      sql`${table.programRevision} >= 1 AND ${table.contentRevision} >= 1 AND ${table.judgeRevision} >= 1`,
    ),
    check(
      "trusted_assignments_payload_check",
      sql`json_valid(${table.publicPayloadJson}) = 1 AND length(${table.publicPayloadJson}) BETWEEN 2 AND 32768`,
    ),
    check(
      "trusted_assignments_status_check",
      sql`${table.status} IN ('active', 'accepted', 'expired')`,
    ),
    check(
      "trusted_assignments_expiry_check",
      sql`${table.expiresAt} > ${table.assignedAt} AND ${table.purgeAfter} >= ${table.expiresAt}`,
    ),
  ],
);

/** Hidden inputs/expected values never appear in assignment projections. */
export const trustedAssignmentSecrets = sqliteTable(
  "trusted_assignment_secrets",
  {
    assignmentId: text("assignment_id").primaryKey(),
    userId: text("user_id").notNull(),
    judgePayloadJson: text("judge_payload_json").notNull(),
    purgeAfter: integer("purge_after", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.assignmentId, table.userId],
      foreignColumns: [trustedAssignments.id, trustedAssignments.userId],
      name: "trusted_assignment_secrets_owner_fk",
    }).onDelete("cascade"),
    index("trusted_assignment_secrets_purge_idx").on(table.purgeAfter),
    check(
      "trusted_assignment_secrets_payload_check",
      sql`json_valid(${table.judgePayloadJson}) = 1 AND length(${table.judgePayloadJson}) BETWEEN 2 AND 65536`,
    ),
  ],
);

/** Immutable aggregate receipts; source text is retained only while judging. */
export const trustedSubmissions = sqliteTable(
  "trusted_submissions",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id").notNull(),
    userId: text("user_id").notNull(),
    clientSubmissionId: text("client_submission_id").notNull(),
    requestHash: text("request_hash").notNull(),
    sourceHash: text("source_hash").notNull(),
    status: text("status", { enum: ["pending", "settled"] }).notNull(),
    verdict: text("verdict", {
      enum: [
        "accepted",
        "wrong-answer",
        "compile-error",
        "runtime-error",
        "time-limit",
        "judge-error",
      ],
    }),
    resultJson: text("result_json"),
    settlementHash: text("settlement_hash"),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }).notNull(),
    enqueuedAt: integer("enqueued_at", { mode: "timestamp_ms" }),
    settledAt: integer("settled_at", { mode: "timestamp_ms" }),
    purgeAfter: integer("purge_after", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("trusted_submissions_id_user_uidx").on(table.id, table.userId),
    uniqueIndex("trusted_submissions_user_client_uidx").on(
      table.userId,
      table.clientSubmissionId,
    ),
    foreignKey({
      columns: [table.assignmentId, table.userId],
      foreignColumns: [trustedAssignments.id, trustedAssignments.userId],
      name: "trusted_submissions_assignment_owner_fk",
    }).onDelete("cascade"),
    index("trusted_submissions_assignment_idx").on(
      table.assignmentId,
      table.userId,
    ),
    index("trusted_submissions_user_submitted_idx").on(
      table.userId,
      table.submittedAt,
    ),
    index("trusted_submissions_purge_idx").on(table.purgeAfter),
    check(
      "trusted_submissions_hashes_check",
      sql`length(${table.requestHash}) = 64 AND length(${table.sourceHash}) = 64 AND (${table.settlementHash} IS NULL OR length(${table.settlementHash}) = 64)`,
    ),
    check(
      "trusted_submissions_status_check",
      sql`${table.status} IN ('pending', 'settled')`,
    ),
    check(
      "trusted_submissions_verdict_check",
      sql`${table.verdict} IS NULL OR ${table.verdict} IN ('accepted', 'wrong-answer', 'compile-error', 'runtime-error', 'time-limit', 'judge-error')`,
    ),
    check(
      "trusted_submissions_settlement_check",
      sql`(${table.status} = 'pending' AND ${table.verdict} IS NULL AND ${table.resultJson} IS NULL AND ${table.settlementHash} IS NULL AND ${table.settledAt} IS NULL) OR (${table.status} = 'settled' AND ${table.verdict} IS NOT NULL AND ${table.resultJson} IS NOT NULL AND json_valid(${table.resultJson}) = 1 AND length(${table.resultJson}) BETWEEN 2 AND 8192 AND ${table.settlementHash} IS NOT NULL AND ${table.settledAt} IS NOT NULL AND ${table.settledAt} >= ${table.submittedAt})`,
    ),
    check(
      "trusted_submissions_purge_check",
      sql`${table.purgeAfter} >= ${table.submittedAt}`,
    ),
    check(
      "trusted_submissions_enqueue_check",
      sql`${table.enqueuedAt} IS NULL OR ${table.enqueuedAt} >= ${table.submittedAt}`,
    ),
  ],
);

export const trustedSubmissionPayloads = sqliteTable(
  "trusted_submission_payloads",
  {
    submissionId: text("submission_id").primaryKey(),
    userId: text("user_id").notNull(),
    sourceText: text("source_text").notNull(),
    purgeAfter: integer("purge_after", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.submissionId, table.userId],
      foreignColumns: [trustedSubmissions.id, trustedSubmissions.userId],
      name: "trusted_submission_payloads_owner_fk",
    }).onDelete("cascade"),
    index("trusted_submission_payloads_purge_idx").on(table.purgeAfter),
    check(
      "trusted_submission_payloads_source_check",
      sql`length(${table.sourceText}) BETWEEN 1 AND 49152`,
    ),
  ],
);
