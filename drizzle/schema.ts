import {
  bigint,
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Playtomic Monitor Tables ────────────────────────────────────────────────

/** Clubes de Playtomic a monitorizar */
export const monitoredClubs = mysqlTable("monitored_clubs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: varchar("tenantId", { length: 128 }).notNull().unique(),
  tenantUid: varchar("tenantUid", { length: 128 }),
  name: varchar("name", { length: 256 }).notNull(),
  city: varchar("city", { length: 128 }),
  country: varchar("country", { length: 64 }),
  imageUrl: text("imageUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonitoredClub = typeof monitoredClubs.$inferSelect;

/** Cursos/clases de Playtomic vigilados */
export const monitoredCourses = mysqlTable("monitored_courses", {
  id: int("id").autoincrement().primaryKey(),
  clubId: int("clubId").notNull(),
  /** ID externo de Playtomic (tournament_id para lessons, course_id para courses) */
  externalId: varchar("externalId", { length: 128 }).notNull(),
  /** 'lesson' | 'course' */
  courseType: mysqlEnum("courseType", ["lesson", "course"]).default("lesson").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  maxPlayers: int("maxPlayers").default(0),
  /** Última cantidad de plazas disponibles conocida */
  lastAvailablePlaces: int("lastAvailablePlaces").default(0),
  /** Última cantidad de inscritos conocida */
  lastRegisteredCount: int("lastRegisteredCount").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  /** Última vez que se comprobó este curso */
  lastCheckedAt: timestamp("lastCheckedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonitoredCourse = typeof monitoredCourses.$inferSelect;

/** Instantáneas del estado de cada curso (historial de cambios) */
export const courseSnapshots = mysqlTable("course_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  availablePlaces: int("availablePlaces").notNull(),
  registeredCount: int("registeredCount").notNull(),
  maxPlayers: int("maxPlayers").notNull(),
  /** Si en este snapshot se detectó un cambio relevante (0→>0 plazas) */
  isChangeDetected: boolean("isChangeDetected").default(false).notNull(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
});

export type CourseSnapshot = typeof courseSnapshots.$inferSelect;

/** Historial de alertas enviadas */
export const alertHistory = mysqlTable("alert_history", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  /** 'telegram' | 'email' */
  channel: mysqlEnum("channel", ["telegram", "email"]).notNull(),
  message: text("message").notNull(),
  availablePlaces: int("availablePlaces").notNull(),
  /** 'sent' | 'failed' */
  status: mysqlEnum("status", ["sent", "failed"]).default("sent").notNull(),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type AlertHistory = typeof alertHistory.$inferSelect;

/** Configuración de canales de alerta */
export const alertConfigs = mysqlTable("alert_configs", {
  id: int("id").autoincrement().primaryKey(),
  channel: mysqlEnum("channel", ["telegram", "email"]).notNull().unique(),
  isEnabled: boolean("isEnabled").default(false).notNull(),
  /** JSON con la configuración específica del canal */
  config: text("config").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertConfig = typeof alertConfigs.$inferSelect;

/** Configuración global del monitor */
export const monitorSettings = mysqlTable("monitor_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** Intervalo de polling en minutos */
  intervalMinutes: int("intervalMinutes").default(5).notNull(),
  isRunning: boolean("isRunning").default(false).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  totalChecks: bigint("totalChecks", { mode: "number" }).default(0).notNull(),
  totalAlertssSent: bigint("totalAlertssSent", { mode: "number" }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MonitorSettings = typeof monitorSettings.$inferSelect;
