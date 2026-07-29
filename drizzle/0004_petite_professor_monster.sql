PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_trusted_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`client_submission_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`source_hash` text NOT NULL,
	`status` text NOT NULL,
	`verdict` text,
	`result_json` text,
	`settlement_hash` text,
	`submitted_at` integer NOT NULL,
	`enqueued_at` integer,
	`settled_at` integer,
	`purge_after` integer NOT NULL,
	FOREIGN KEY (`assignment_id`,`user_id`) REFERENCES `trusted_assignments`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trusted_submissions_hashes_check" CHECK(length("__new_trusted_submissions"."request_hash") = 64 AND length("__new_trusted_submissions"."source_hash") = 64 AND ("__new_trusted_submissions"."settlement_hash" IS NULL OR length("__new_trusted_submissions"."settlement_hash") = 64)),
	CONSTRAINT "trusted_submissions_status_check" CHECK("__new_trusted_submissions"."status" IN ('pending', 'settled')),
	CONSTRAINT "trusted_submissions_verdict_check" CHECK("__new_trusted_submissions"."verdict" IS NULL OR "__new_trusted_submissions"."verdict" IN ('accepted', 'wrong-answer', 'runtime-error', 'time-limit', 'judge-error')),
	CONSTRAINT "trusted_submissions_settlement_check" CHECK(("__new_trusted_submissions"."status" = 'pending' AND "__new_trusted_submissions"."verdict" IS NULL AND "__new_trusted_submissions"."result_json" IS NULL AND "__new_trusted_submissions"."settlement_hash" IS NULL AND "__new_trusted_submissions"."settled_at" IS NULL) OR ("__new_trusted_submissions"."status" = 'settled' AND "__new_trusted_submissions"."verdict" IS NOT NULL AND "__new_trusted_submissions"."result_json" IS NOT NULL AND json_valid("__new_trusted_submissions"."result_json") = 1 AND length("__new_trusted_submissions"."result_json") BETWEEN 2 AND 8192 AND "__new_trusted_submissions"."settlement_hash" IS NOT NULL AND "__new_trusted_submissions"."settled_at" IS NOT NULL AND "__new_trusted_submissions"."settled_at" >= "__new_trusted_submissions"."submitted_at")),
	CONSTRAINT "trusted_submissions_purge_check" CHECK("__new_trusted_submissions"."purge_after" >= "__new_trusted_submissions"."submitted_at"),
	CONSTRAINT "trusted_submissions_enqueue_check" CHECK("__new_trusted_submissions"."enqueued_at" IS NULL OR "__new_trusted_submissions"."enqueued_at" >= "__new_trusted_submissions"."submitted_at")
);
--> statement-breakpoint
INSERT INTO `__new_trusted_submissions`("id", "assignment_id", "user_id", "client_submission_id", "request_hash", "source_hash", "status", "verdict", "result_json", "settlement_hash", "submitted_at", "enqueued_at", "settled_at", "purge_after") SELECT "id", "assignment_id", "user_id", "client_submission_id", "request_hash", "source_hash", "status", "verdict", "result_json", "settlement_hash", "submitted_at", NULL, "settled_at", "purge_after" FROM `trusted_submissions`;--> statement-breakpoint
DROP TABLE `trusted_submissions`;--> statement-breakpoint
ALTER TABLE `__new_trusted_submissions` RENAME TO `trusted_submissions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `trusted_submissions_id_user_uidx` ON `trusted_submissions` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `trusted_submissions_user_client_uidx` ON `trusted_submissions` (`user_id`,`client_submission_id`);--> statement-breakpoint
CREATE INDEX `trusted_submissions_assignment_idx` ON `trusted_submissions` (`assignment_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `trusted_submissions_user_submitted_idx` ON `trusted_submissions` (`user_id`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `trusted_submissions_purge_idx` ON `trusted_submissions` (`purge_after`);
