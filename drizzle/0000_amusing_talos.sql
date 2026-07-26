CREATE TABLE `community_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_attempt_id` text NOT NULL,
	`item_id` text NOT NULL,
	`item_revision` integer NOT NULL,
	`item_title` text NOT NULL,
	`track` text NOT NULL,
	`stage` integer NOT NULL,
	`mode` text NOT NULL,
	`accuracy_bps` integer NOT NULL,
	`wpm_bps` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`typed_chars` integer NOT NULL,
	`peeks` integer NOT NULL,
	`completed_at` integer NOT NULL,
	`completed_day` text NOT NULL,
	`challenge_date` text,
	`feed_eligible` integer DEFAULT false NOT NULL,
	`ranking_eligible` integer DEFAULT false NOT NULL,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `community_profiles`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "community_attempts_stage_check" CHECK("community_attempts"."stage" BETWEEN 1 AND 5),
	CONSTRAINT "community_attempts_accuracy_check" CHECK("community_attempts"."accuracy_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "community_attempts_ranking_check" CHECK("community_attempts"."ranking_eligible" = 0 OR ("community_attempts"."mode" = 'strict' AND "community_attempts"."peeks" = 0 AND "community_attempts"."accuracy_bps" >= 9500 AND "community_attempts"."wpm_bps" <= 30000 AND "community_attempts"."typed_chars" >= 20 AND "community_attempts"."duration_ms" >= 1000)),
	CONSTRAINT "community_attempts_feed_check" CHECK("community_attempts"."feed_eligible" = 0 OR ("community_attempts"."mode" = 'strict' AND "community_attempts"."peeks" = 0 AND "community_attempts"."accuracy_bps" >= 9500 AND "community_attempts"."wpm_bps" <= 30000 AND "community_attempts"."typed_chars" >= 20 AND "community_attempts"."duration_ms" >= 1000))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `community_attempts_user_client_uidx` ON `community_attempts` (`user_id`,`client_attempt_id`);--> statement-breakpoint
CREATE INDEX `community_attempts_recent_idx` ON `community_attempts` (`feed_eligible`,`completed_at`);--> statement-breakpoint
CREATE INDEX `community_attempts_item_rank_idx` ON `community_attempts` (`item_id`,`item_revision`,`stage`,`mode`,`ranking_eligible`,`wpm_bps`);--> statement-breakpoint
CREATE INDEX `community_attempts_daily_rank_idx` ON `community_attempts` (`challenge_date`,`ranking_eligible`,`user_id`);--> statement-breakpoint
CREATE INDEX `community_attempts_user_idx` ON `community_attempts` (`user_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `community_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`handle` text NOT NULL,
	`display_name` text,
	`bio` text,
	`timezone` text,
	`is_public` integer DEFAULT false NOT NULL,
	`share_activity` integer DEFAULT false NOT NULL,
	`show_on_leaderboards` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "community_profiles_private_off_check" CHECK("community_profiles"."is_public" = 1 OR ("community_profiles"."share_activity" = 0 AND "community_profiles"."show_on_leaderboards" = 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `community_profiles_email_uidx` ON `community_profiles` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `community_profiles_handle_uidx` ON `community_profiles` (`handle`);--> statement-breakpoint
CREATE TABLE `daily_challenges` (
	`date` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`item_revision` integer NOT NULL,
	`item_title` text NOT NULL,
	`track` text NOT NULL,
	`stage` integer NOT NULL,
	`mode` text DEFAULT 'strict' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "daily_challenges_stage_check" CHECK("daily_challenges"."stage" = 1),
	CONSTRAINT "daily_challenges_mode_check" CHECK("daily_challenges"."mode" = 'strict')
);
