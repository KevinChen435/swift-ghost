CREATE TABLE `progress_snapshots` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `community_profiles`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "progress_snapshots_revision_check" CHECK("progress_snapshots"."revision" >= 1),
	CONSTRAINT "progress_snapshots_payload_size_check" CHECK(length("progress_snapshots"."payload_json") BETWEEN 2 AND 262144)
);
