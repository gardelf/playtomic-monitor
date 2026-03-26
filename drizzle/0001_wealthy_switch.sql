CREATE TABLE `alert_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channel` enum('telegram','email') NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT false,
	`config` text NOT NULL DEFAULT ('{}'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alert_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `alert_configs_channel_unique` UNIQUE(`channel`)
);
--> statement-breakpoint
CREATE TABLE `alert_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`channel` enum('telegram','email') NOT NULL,
	`message` text NOT NULL,
	`availablePlaces` int NOT NULL,
	`status` enum('sent','failed') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`availablePlaces` int NOT NULL,
	`registeredCount` int NOT NULL,
	`maxPlayers` int NOT NULL,
	`isChangeDetected` boolean NOT NULL DEFAULT false,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitor_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intervalMinutes` int NOT NULL DEFAULT 5,
	`isRunning` boolean NOT NULL DEFAULT false,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`totalChecks` bigint NOT NULL DEFAULT 0,
	`totalAlertssSent` bigint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitor_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitored_clubs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(128) NOT NULL,
	`tenantUid` varchar(128),
	`name` varchar(256) NOT NULL,
	`city` varchar(128),
	`country` varchar(64),
	`imageUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitored_clubs_id` PRIMARY KEY(`id`),
	CONSTRAINT `monitored_clubs_tenantId_unique` UNIQUE(`tenantId`)
);
--> statement-breakpoint
CREATE TABLE `monitored_courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clubId` int NOT NULL,
	`externalId` varchar(128) NOT NULL,
	`courseType` enum('lesson','course') NOT NULL DEFAULT 'lesson',
	`name` varchar(256) NOT NULL,
	`description` text,
	`startDate` timestamp,
	`endDate` timestamp,
	`maxPlayers` int DEFAULT 0,
	`lastAvailablePlaces` int DEFAULT 0,
	`lastRegisteredCount` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastCheckedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitored_courses_id` PRIMARY KEY(`id`)
);
