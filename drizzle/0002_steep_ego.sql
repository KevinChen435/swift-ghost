CREATE TABLE `trusted_assignment_secrets` (
	`assignment_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`judge_payload_json` text NOT NULL,
	`purge_after` integer NOT NULL,
	FOREIGN KEY (`assignment_id`,`user_id`) REFERENCES `trusted_assignments`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trusted_assignment_secrets_payload_check" CHECK(json_valid("trusted_assignment_secrets"."judge_payload_json") = 1 AND length("trusted_assignment_secrets"."judge_payload_json") BETWEEN 2 AND 65536)
);
--> statement-breakpoint
CREATE INDEX `trusted_assignment_secrets_purge_idx` ON `trusted_assignment_secrets` (`purge_after`);--> statement-breakpoint
CREATE TABLE `trusted_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_request_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`program_id` text NOT NULL,
	`program_revision` integer NOT NULL,
	`challenge_key` text NOT NULL,
	`content_revision` integer NOT NULL,
	`judge_revision` integer NOT NULL,
	`public_payload_json` text NOT NULL,
	`status` text NOT NULL,
	`assigned_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`purge_after` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `community_profiles`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trusted_assignments_request_hash_check" CHECK(length("trusted_assignments"."request_hash") = 64),
	CONSTRAINT "trusted_assignments_revision_check" CHECK("trusted_assignments"."program_revision" >= 1 AND "trusted_assignments"."content_revision" >= 1 AND "trusted_assignments"."judge_revision" >= 1),
	CONSTRAINT "trusted_assignments_payload_check" CHECK(json_valid("trusted_assignments"."public_payload_json") = 1 AND length("trusted_assignments"."public_payload_json") BETWEEN 2 AND 32768),
	CONSTRAINT "trusted_assignments_status_check" CHECK("trusted_assignments"."status" IN ('active', 'accepted', 'expired')),
	CONSTRAINT "trusted_assignments_expiry_check" CHECK("trusted_assignments"."expires_at" > "trusted_assignments"."assigned_at" AND "trusted_assignments"."purge_after" >= "trusted_assignments"."expires_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trusted_assignments_id_user_uidx` ON `trusted_assignments` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `trusted_assignments_user_client_uidx` ON `trusted_assignments` (`user_id`,`client_request_id`);--> statement-breakpoint
CREATE INDEX `trusted_assignments_user_assigned_idx` ON `trusted_assignments` (`user_id`,`assigned_at`);--> statement-breakpoint
CREATE INDEX `trusted_assignments_user_expiry_idx` ON `trusted_assignments` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `trusted_assignments_purge_idx` ON `trusted_assignments` (`purge_after`);--> statement-breakpoint
CREATE TABLE `trusted_submission_payloads` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_text` text NOT NULL,
	`purge_after` integer NOT NULL,
	FOREIGN KEY (`submission_id`,`user_id`) REFERENCES `trusted_submissions`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trusted_submission_payloads_source_check" CHECK(length("trusted_submission_payloads"."source_text") BETWEEN 1 AND 49152)
);
--> statement-breakpoint
CREATE INDEX `trusted_submission_payloads_purge_idx` ON `trusted_submission_payloads` (`purge_after`);--> statement-breakpoint
CREATE TABLE `trusted_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`client_submission_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`source_hash` text NOT NULL,
	`status` text NOT NULL,
	`verdict` text,
	`result_json` text,
	`submitted_at` integer NOT NULL,
	`settled_at` integer,
	`purge_after` integer NOT NULL,
	FOREIGN KEY (`assignment_id`,`user_id`) REFERENCES `trusted_assignments`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trusted_submissions_hashes_check" CHECK(length("trusted_submissions"."request_hash") = 64 AND length("trusted_submissions"."source_hash") = 64),
	CONSTRAINT "trusted_submissions_status_check" CHECK("trusted_submissions"."status" IN ('pending', 'settled')),
	CONSTRAINT "trusted_submissions_verdict_check" CHECK("trusted_submissions"."verdict" IS NULL OR "trusted_submissions"."verdict" IN ('accepted', 'wrong-answer', 'runtime-error', 'time-limit', 'judge-error')),
	CONSTRAINT "trusted_submissions_settlement_check" CHECK(("trusted_submissions"."status" = 'pending' AND "trusted_submissions"."verdict" IS NULL AND "trusted_submissions"."result_json" IS NULL AND "trusted_submissions"."settled_at" IS NULL) OR ("trusted_submissions"."status" = 'settled' AND "trusted_submissions"."verdict" IS NOT NULL AND "trusted_submissions"."result_json" IS NOT NULL AND json_valid("trusted_submissions"."result_json") = 1 AND length("trusted_submissions"."result_json") BETWEEN 2 AND 8192 AND "trusted_submissions"."settled_at" IS NOT NULL AND "trusted_submissions"."settled_at" >= "trusted_submissions"."submitted_at")),
	CONSTRAINT "trusted_submissions_purge_check" CHECK("trusted_submissions"."purge_after" >= "trusted_submissions"."submitted_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trusted_submissions_id_user_uidx` ON `trusted_submissions` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `trusted_submissions_user_client_uidx` ON `trusted_submissions` (`user_id`,`client_submission_id`);--> statement-breakpoint
CREATE INDEX `trusted_submissions_assignment_idx` ON `trusted_submissions` (`assignment_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `trusted_submissions_user_submitted_idx` ON `trusted_submissions` (`user_id`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `trusted_submissions_purge_idx` ON `trusted_submissions` (`purge_after`);
