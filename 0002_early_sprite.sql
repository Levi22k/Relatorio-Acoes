CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`aliases` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_owner_name` ON `members` (`owner`,`name_key`);