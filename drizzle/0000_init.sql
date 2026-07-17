CREATE TABLE `answers` (
	`id` varchar(36) NOT NULL,
	`submission_id` varchar(36) NOT NULL,
	`question_id` varchar(128) NOT NULL,
	`value` json NOT NULL,
	`answered_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forms` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`spec` json NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `forms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` varchar(36) NOT NULL,
	`form_id` varchar(36) NOT NULL,
	`status` enum('PARTIAL','FINISHED') NOT NULL DEFAULT 'PARTIAL',
	`source` varchar(255),
	`ip` varchar(45),
	`user_agent` varchar(512),
	`ab_assignments` json NOT NULL DEFAULT ('{}'),
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`finished_at` timestamp,
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `answers_submission_id_idx` ON `answers` (`submission_id`);--> statement-breakpoint
CREATE INDEX `submissions_form_id_idx` ON `submissions` (`form_id`);