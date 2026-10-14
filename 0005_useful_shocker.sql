CREATE TABLE `treasury_adjustment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`adjustment_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`event` text NOT NULL,
	`created` text NOT NULL
);
