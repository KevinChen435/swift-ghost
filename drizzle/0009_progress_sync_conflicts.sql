CREATE TABLE `progress_sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mutation_hash` text NOT NULL,
	`base_revision` integer NOT NULL,
	`server_revision` integer NOT NULL,
	`summary_json` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`purge_after` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `community_profiles`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "progress_sync_conflicts_hash_check" CHECK(length("progress_sync_conflicts"."mutation_hash") = 64),
	CONSTRAINT "progress_sync_conflicts_revision_check" CHECK("progress_sync_conflicts"."base_revision" >= 0 AND "progress_sync_conflicts"."server_revision" >= 0),
	CONSTRAINT "progress_sync_conflicts_summary_check" CHECK(json_valid("progress_sync_conflicts"."summary_json") = 1 AND length("progress_sync_conflicts"."summary_json") BETWEEN 2 AND 32768),
	CONSTRAINT "progress_sync_conflicts_purge_check" CHECK("progress_sync_conflicts"."purge_after" >= "progress_sync_conflicts"."occurred_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_sync_conflicts_user_mutation_uidx` ON `progress_sync_conflicts` (`user_id`,`mutation_hash`,`server_revision`);
--> statement-breakpoint
CREATE INDEX `progress_sync_conflicts_user_occurred_idx` ON `progress_sync_conflicts` (`user_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `progress_sync_conflicts_purge_idx` ON `progress_sync_conflicts` (`purge_after`);
