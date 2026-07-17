ALTER TABLE `forms` ADD `allow_multiple_submits` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `submissions_form_status_ip_idx` ON `submissions` (`form_id`,`status`,`ip`);