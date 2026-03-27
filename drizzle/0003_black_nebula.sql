CREATE TABLE `court_availability_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`watchConfigId` int NOT NULL,
	`slotDate` varchar(16) NOT NULL,
	`slotTime` varchar(8) NOT NULL,
	`duration` int NOT NULL,
	`courtName` varchar(128) NOT NULL,
	`resourceId` varchar(128) NOT NULL,
	`courtType` varchar(32),
	`courtFeature` varchar(32),
	`price` varchar(32),
	`isNewDetection` boolean NOT NULL DEFAULT true,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `court_availability_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `court_scheduler_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isRunning` boolean NOT NULL DEFAULT false,
	`intervalMinutes` int NOT NULL DEFAULT 5,
	`startedAt` timestamp,
	`stoppedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `court_scheduler_state_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `court_watch_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clubId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`dayOfWeek` int NOT NULL,
	`startTimeMin` varchar(8) NOT NULL,
	`startTimeMax` varchar(8) NOT NULL,
	`preferredDuration` int,
	`sportId` varchar(32) NOT NULL DEFAULT 'PADEL',
	`isActive` boolean NOT NULL DEFAULT true,
	`weeksAhead` int NOT NULL DEFAULT 4,
	`lastSlotCount` int NOT NULL DEFAULT -1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `court_watch_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitor_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`durationMs` int,
	`datesChecked` text,
	`slotsFound` int NOT NULL DEFAULT 0,
	`newSlotsFound` int NOT NULL DEFAULT 0,
	`alertsSent` int NOT NULL DEFAULT 0,
	`triggeredBy` enum('scheduler','manual') NOT NULL DEFAULT 'scheduler',
	`status` enum('ok','error','running') NOT NULL DEFAULT 'running',
	`errorMessage` text,
	`notes` text,
	CONSTRAINT `monitor_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`chatId` varchar(64) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`lastAlertAt` timestamp,
	`totalAlerts` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_contacts_chatId_unique` UNIQUE(`chatId`)
);
