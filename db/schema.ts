import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
