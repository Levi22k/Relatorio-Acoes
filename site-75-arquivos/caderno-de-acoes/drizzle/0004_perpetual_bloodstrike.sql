CREATE TABLE `treasury_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`created` text NOT NULL
);
