CREATE TABLE `treasury_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`created` text NOT NULL
);
