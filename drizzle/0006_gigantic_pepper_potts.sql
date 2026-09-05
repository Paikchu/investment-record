CREATE TABLE `portfolio_history` (
	`date` text PRIMARY KEY NOT NULL,
	`generated_at` text NOT NULL,
	`net_liquidation` text NOT NULL,
	`net_deposits` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portfolio_state` (
	`id` text PRIMARY KEY NOT NULL,
	`report_date` text NOT NULL,
	`generated_at` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
