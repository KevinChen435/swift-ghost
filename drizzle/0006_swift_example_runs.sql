CREATE TABLE `trusted_example_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`client_run_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`source_hash` text NOT NULL,
	`status` text NOT NULL,
	`verdict` text,
	`result_json` text,
	`settlement_hash` text,
	`requested_at` integer NOT NULL,
	`enqueued_at` integer,
	`settled_at` integer,
	`purge_after` integer NOT NULL,
	FOREIGN KEY (`assignment_id`,`user_id`) REFERENCES `trusted_assignments`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trusted_example_runs_hashes_check" CHECK(length(`request_hash`) = 64 AND length(`source_hash`) = 64 AND (`settlement_hash` IS NULL OR length(`settlement_hash`) = 64)),
	CONSTRAINT "trusted_example_runs_status_check" CHECK(`status` IN ('pending', 'settled')),
	CONSTRAINT "trusted_example_runs_verdict_check" CHECK(`verdict` IS NULL OR `verdict` IN ('accepted', 'wrong-answer', 'compile-error', 'runtime-error', 'time-limit', 'judge-error')),
	CONSTRAINT "trusted_example_runs_settlement_check" CHECK((`status` = 'pending' AND `verdict` IS NULL AND `result_json` IS NULL AND `settlement_hash` IS NULL AND `settled_at` IS NULL) OR (`status` = 'settled' AND `verdict` IS NOT NULL AND `result_json` IS NOT NULL AND json_valid(`result_json`) = 1 AND length(`result_json`) BETWEEN 2 AND 8192 AND `settlement_hash` IS NOT NULL AND `settled_at` IS NOT NULL AND `settled_at` >= `requested_at`)),
	CONSTRAINT "trusted_example_runs_purge_check" CHECK(`purge_after` >= `requested_at`),
	CONSTRAINT "trusted_example_runs_enqueue_check" CHECK(`enqueued_at` IS NULL OR `enqueued_at` >= `requested_at`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trusted_example_runs_id_user_uidx` ON `trusted_example_runs` (`id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `trusted_example_runs_user_client_uidx` ON `trusted_example_runs` (`user_id`,`client_run_id`);
--> statement-breakpoint
CREATE INDEX `trusted_example_runs_assignment_idx` ON `trusted_example_runs` (`assignment_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `trusted_example_runs_user_requested_idx` ON `trusted_example_runs` (`user_id`,`requested_at`);
--> statement-breakpoint
CREATE INDEX `trusted_example_runs_purge_idx` ON `trusted_example_runs` (`purge_after`);
--> statement-breakpoint
CREATE TABLE `trusted_example_run_payloads` (
	`run_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_text` text NOT NULL,
	`purge_after` integer NOT NULL,
	FOREIGN KEY (`run_id`,`user_id`) REFERENCES `trusted_example_runs`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trusted_example_run_payloads_source_check" CHECK(length(`source_text`) BETWEEN 1 AND 49152)
);
--> statement-breakpoint
CREATE INDEX `trusted_example_run_payloads_purge_idx` ON `trusted_example_run_payloads` (`purge_after`);
