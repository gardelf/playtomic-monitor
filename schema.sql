-- =============================================================================
-- Playtomic Monitor — Schema completo MySQL / Railway
-- Generado desde: drizzle/schema.ts + migraciones 0000–0003
-- Compatible con: MySQL 8.x, TiDB, Railway MySQL
-- Ejecutar en orden (respeta dependencias FK)
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT            NOT NULL AUTO_INCREMENT,
  `openId`        VARCHAR(64)    NOT NULL,
  `name`          TEXT,
  `email`         VARCHAR(320),
  `loginMethod`   VARCHAR(64),
  `role`          ENUM('user','admin') NOT NULL DEFAULT 'user',
  `createdAt`     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn`  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `users_id`      PRIMARY KEY (`id`),
  CONSTRAINT `users_openId_unique` UNIQUE (`openId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. monitored_clubs
--    Clubes de Playtomic a monitorizar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `monitored_clubs` (
  `id`         INT           NOT NULL AUTO_INCREMENT,
  `tenantId`   VARCHAR(128)  NOT NULL,
  `tenantUid`  VARCHAR(128),
  `name`       VARCHAR(256)  NOT NULL,
  `city`       VARCHAR(128),
  `country`    VARCHAR(64),
  `imageUrl`   TEXT,
  `isActive`   BOOLEAN       NOT NULL DEFAULT TRUE,
  `createdAt`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `monitored_clubs_id`              PRIMARY KEY (`id`),
  CONSTRAINT `monitored_clubs_tenantId_unique` UNIQUE (`tenantId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. monitored_courses
--    Cursos/clases de Playtomic vigilados
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `monitored_courses` (
  `id`                   INT           NOT NULL AUTO_INCREMENT,
  `clubId`               INT           NOT NULL,
  `externalId`           VARCHAR(128)  NOT NULL,
  `courseType`           ENUM('lesson','course') NOT NULL DEFAULT 'lesson',
  `name`                 VARCHAR(256)  NOT NULL,
  `description`          TEXT,
  `startDate`            TIMESTAMP     NULL,
  `endDate`              TIMESTAMP     NULL,
  `maxPlayers`           INT           DEFAULT 0,
  `lastAvailablePlaces`  INT           DEFAULT 0,
  `lastRegisteredCount`  INT           DEFAULT 0,
  `isActive`             BOOLEAN       NOT NULL DEFAULT TRUE,
  `lastCheckedAt`        TIMESTAMP     NULL,
  `createdAt`            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `monitored_courses_id` PRIMARY KEY (`id`),
  INDEX `idx_monitored_courses_clubId` (`clubId`),
  CONSTRAINT `fk_monitored_courses_clubId`
    FOREIGN KEY (`clubId`) REFERENCES `monitored_clubs` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. course_snapshots
--    Historial de estado de cada curso (cambios de plazas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `course_snapshots` (
  `id`               INT       NOT NULL AUTO_INCREMENT,
  `courseId`         INT       NOT NULL,
  `availablePlaces`  INT       NOT NULL,
  `registeredCount`  INT       NOT NULL,
  `maxPlayers`       INT       NOT NULL,
  `isChangeDetected` BOOLEAN   NOT NULL DEFAULT FALSE,
  `checkedAt`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `course_snapshots_id` PRIMARY KEY (`id`),
  INDEX `idx_course_snapshots_courseId` (`courseId`),
  CONSTRAINT `fk_course_snapshots_courseId`
    FOREIGN KEY (`courseId`) REFERENCES `monitored_courses` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. alert_history
--    Historial de alertas enviadas (telegram / email)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `alert_history` (
  `id`               INT       NOT NULL AUTO_INCREMENT,
  `courseId`         INT       NOT NULL,
  `channel`          ENUM('telegram','email') NOT NULL,
  `message`          TEXT      NOT NULL,
  `availablePlaces`  INT       NOT NULL,
  `status`           ENUM('sent','failed') NOT NULL DEFAULT 'sent',
  `errorMessage`     TEXT,
  `sentAt`           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `alert_history_id` PRIMARY KEY (`id`),
  INDEX `idx_alert_history_courseId` (`courseId`),
  CONSTRAINT `fk_alert_history_courseId`
    FOREIGN KEY (`courseId`) REFERENCES `monitored_courses` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. alert_configs
--    Configuración de canales de alerta (singleton por canal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `alert_configs` (
  `id`         INT       NOT NULL AUTO_INCREMENT,
  `channel`    ENUM('telegram','email') NOT NULL,
  `isEnabled`  BOOLEAN   NOT NULL DEFAULT FALSE,
  `config`     TEXT      NOT NULL,
  `createdAt`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `alert_configs_id`             PRIMARY KEY (`id`),
  CONSTRAINT `alert_configs_channel_unique` UNIQUE (`channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. monitor_settings
--    Configuración global del monitor de cursos (singleton, id=1)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `monitor_settings` (
  `id`               INT       NOT NULL AUTO_INCREMENT,
  `intervalMinutes`  INT       NOT NULL DEFAULT 5,
  `isRunning`        BOOLEAN   NOT NULL DEFAULT FALSE,
  `lastRunAt`        TIMESTAMP NULL,
  `nextRunAt`        TIMESTAMP NULL,
  `totalChecks`      BIGINT    NOT NULL DEFAULT 0,
  `totalAlertssSent` BIGINT    NOT NULL DEFAULT 0,
  `createdAt`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `monitor_settings_id` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. court_watch_configs
--    Vigilancias de pistas: qué día/hora/duración/club vigilar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `court_watch_configs` (
  `id`                INT          NOT NULL AUTO_INCREMENT,
  `clubId`            INT          NOT NULL,
  `name`              VARCHAR(128) NOT NULL,
  `dayOfWeek`         INT          NOT NULL COMMENT '0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb',
  `startTimeMin`      VARCHAR(8)   NOT NULL COMMENT 'HH:MM p.ej. 18:30',
  `startTimeMax`      VARCHAR(8)   NOT NULL COMMENT 'HH:MM p.ej. 20:30',
  `preferredDuration` INT          NULL     COMMENT 'Duración en minutos, NULL = cualquiera',
  `sportId`           VARCHAR(32)  NOT NULL DEFAULT 'PADEL',
  `isActive`          BOOLEAN      NOT NULL DEFAULT TRUE,
  `weeksAhead`        INT          NOT NULL DEFAULT 4,
  `lastSlotCount`     INT          NOT NULL DEFAULT -1,
  `createdAt`         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `court_watch_configs_id` PRIMARY KEY (`id`),
  INDEX `idx_court_watch_configs_clubId` (`clubId`),
  CONSTRAINT `fk_court_watch_configs_clubId`
    FOREIGN KEY (`clubId`) REFERENCES `monitored_clubs` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. court_availability_snapshots
--    Slots de pistas detectados por el scheduler
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `court_availability_snapshots` (
  `id`              INT          NOT NULL AUTO_INCREMENT,
  `watchConfigId`   INT          NOT NULL,
  `slotDate`        VARCHAR(16)  NOT NULL COMMENT 'YYYY-MM-DD',
  `slotTime`        VARCHAR(8)   NOT NULL COMMENT 'HH:MM',
  `duration`        INT          NOT NULL COMMENT 'Minutos',
  `courtName`       VARCHAR(128) NOT NULL,
  `resourceId`      VARCHAR(128) NOT NULL COMMENT 'ID de pista en Playtomic',
  `courtType`       VARCHAR(32)  NULL     COMMENT 'indoor / outdoor',
  `courtFeature`    VARCHAR(32)  NULL     COMMENT 'crystal / panoramic / wall',
  `price`           VARCHAR(32)  NULL,
  `isNewDetection`  BOOLEAN      NOT NULL DEFAULT TRUE,
  `checkedAt`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `court_availability_snapshots_id` PRIMARY KEY (`id`),
  INDEX `idx_court_avail_watchConfigId` (`watchConfigId`),
  INDEX `idx_court_avail_slotDate`      (`slotDate`),
  CONSTRAINT `fk_court_avail_watchConfigId`
    FOREIGN KEY (`watchConfigId`) REFERENCES `court_watch_configs` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. telegram_contacts
--     Contactos de Telegram que reciben alertas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `telegram_contacts` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(128) NOT NULL,
  `chatId`       VARCHAR(64)  NOT NULL,
  `isActive`     BOOLEAN      NOT NULL DEFAULT TRUE,
  `notes`        TEXT,
  `lastAlertAt`  TIMESTAMP    NULL,
  `totalAlerts`  INT          NOT NULL DEFAULT 0,
  `createdAt`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `telegram_contacts_id`            PRIMARY KEY (`id`),
  CONSTRAINT `telegram_contacts_chatId_unique` UNIQUE (`chatId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. court_scheduler_state
--     Estado persistente del scheduler de pistas (singleton, id=1)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `court_scheduler_state` (
  `id`               INT       NOT NULL AUTO_INCREMENT,
  `isRunning`        BOOLEAN   NOT NULL DEFAULT FALSE,
  `intervalMinutes`  INT       NOT NULL DEFAULT 5,
  `startedAt`        TIMESTAMP NULL,
  `stoppedAt`        TIMESTAMP NULL,
  `updatedAt`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `court_scheduler_state_id` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. monitor_runs
--     Registro de cada ciclo de ejecución del scheduler
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `monitor_runs` (
  `id`            INT       NOT NULL AUTO_INCREMENT,
  `startedAt`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finishedAt`    TIMESTAMP NULL,
  `durationMs`    INT       NULL,
  `datesChecked`  TEXT      NULL     COMMENT 'JSON array de fechas YYYY-MM-DD consultadas',
  `slotsFound`    INT       NOT NULL DEFAULT 0,
  `newSlotsFound` INT       NOT NULL DEFAULT 0,
  `alertsSent`    INT       NOT NULL DEFAULT 0,
  `triggeredBy`   ENUM('scheduler','manual') NOT NULL DEFAULT 'scheduler',
  `status`        ENUM('ok','error','running') NOT NULL DEFAULT 'running',
  `errorMessage`  TEXT      NULL,
  `notes`         TEXT      NULL,
  CONSTRAINT `monitor_runs_id` PRIMARY KEY (`id`),
  INDEX `idx_monitor_runs_startedAt` (`startedAt`),
  INDEX `idx_monitor_runs_status`    (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Datos iniciales (seed mínimo para que la app arranque correctamente)
-- =============================================================================

-- Scheduler state singleton (la app espera que exista id=1)
INSERT IGNORE INTO `court_scheduler_state` (`id`, `isRunning`, `intervalMinutes`)
VALUES (1, FALSE, 5);

-- Monitor settings singleton (la app espera que exista id=1)
INSERT IGNORE INTO `monitor_settings` (`id`, `intervalMinutes`, `isRunning`, `totalChecks`, `totalAlertssSent`)
VALUES (1, 5, FALSE, 0, 0);

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- FIN DEL SCHEMA
-- Tablas: 12 | Relaciones FK: 5 | Índices adicionales: 7
-- =============================================================================
