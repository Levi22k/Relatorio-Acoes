CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`result` text NOT NULL,
	`participants` text NOT NULL,
	`image_key` text NOT NULL,
	`created` text NOT NULL
);
