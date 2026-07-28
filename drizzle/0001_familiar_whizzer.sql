CREATE TABLE `study_workspaces` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `community_profiles`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "study_workspaces_revision_check" CHECK("study_workspaces"."revision" >= 1),
	CONSTRAINT "study_workspaces_payload_size_check" CHECK(length("study_workspaces"."payload_json") BETWEEN 2 AND 262144)
);
