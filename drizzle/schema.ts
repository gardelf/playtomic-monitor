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

// ─── Court Monitor Tables ─────────────────────────────────────────────────────

/** Configuración de vigilancia de pistas (qué día/hora/duración vigilar) */
export const courtWatchConfigs = mysqlTable("court_watch_configs", {
  id: int("id").autoincrement().primaryKey(),
  clubId: int("clubId").notNull(),
  /** Nombre descriptivo de la vigilancia */
  name: varchar("name", { length: 128 }).notNull(),
  /** Día de la semana: 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb */
  dayOfWeek: int("dayOfWeek").notNull(),
  /** Hora mínima de inicio (HH:MM), ej: '18:30' */
  startTimeMin: varchar("startTimeMin", { length: 8 }).notNull(),
  /** Hora máxima de inicio (HH:MM), ej: '20:30' */
  startTimeMax: varchar("startTimeMax", { length: 8 }).notNull(),
  /** Duración deseada en minutos (60, 90, 120...) - null = cualquiera */
  preferredDuration: int("preferredDuration"),
  /** Sport: PADEL, TENNIS, etc. */
  sportId: varchar("sportId", { length: 32 }).default("PADEL").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  /** Cuántas semanas hacia adelante buscar */
  weeksAhead: int("weeksAhead").default(4).notNull(),
  /** Número de slots encontrados en el último ciclo (para detectar transición 0→>0) */
  lastSlotCount: int("lastSlotCount").default(-1).notNull(),
  /** Fechas concretas a vigilar (JSON array de strings 'YYYY-MM-DD'). Si es null, usa dayOfWeek+weeksAhead */
  specificDates: text("specificDates"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CourtWatchConfig = typeof courtWatchConfigs.$inferSelect;
export type InsertCourtWatchConfig = typeof courtWatchConfigs.$inferInsert;

/** Snapshot de disponibilidad de pistas detectada */
export const courtAvailabilitySnapshots = mysqlTable("court_availability_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  watchConfigId: int("watchConfigId").notNull(),
  /** Fecha del miércoles (o día vigilado) */
  slotDate: varchar("slotDate", { length: 16 }).notNull(),
  /** Hora de inicio del slot */
  slotTime: varchar("slotTime", { length: 8 }).notNull(),
  /** Duración en minutos */
  duration: int("duration").notNull(),
  /** Nombre de la pista */
  courtName: varchar("courtName", { length: 128 }).notNull(),
  /** ID de la pista en Playtomic */
  resourceId: varchar("resourceId", { length: 128 }).notNull(),
  /** Tipo: indoor/outdoor */
  courtType: varchar("courtType", { length: 32 }),
  /** Feature: crystal/panoramic/wall */
  courtFeature: varchar("courtFeature", { length: 32 }),
  /** Precio */
  price: varchar("price", { length: 32 }),
  /** Si fue la primera vez que se detectó este slot (para alertas) */
  isNewDetection: boolean("isNewDetection").default(true).notNull(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
});

export type CourtAvailabilitySnapshot = typeof courtAvailabilitySnapshots.$inferSelect;

/** Contactos de Telegram a los que enviar alertas */
export const telegramContacts = mysqlTable("telegram_contacts", {
  id: int("id").autoincrement().primaryKey(),
  /** Nombre del contacto (para mostrar en la app) */
  name: varchar("name", { length: 128 }).notNull(),
  /** Chat ID de Telegram (puede ser usuario o grupo, ej: 123456789 o -987654321) */
  chatId: varchar("chatId", { length: 64 }).notNull().unique(),
  /** Si este contacto recibe alertas */
  isActive: boolean("isActive").default(true).notNull(),
  /** Notas opcionales (ej: 'Grupo de pádel miércoles') */
  notes: text("notes"),
  /** Última vez que se le envió una alerta */
  lastAlertAt: timestamp("lastAlertAt"),
  /** Total de alertas enviadas a este contacto */
  totalAlerts: int("totalAlerts").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TelegramContact = typeof telegramContacts.$inferSelect;

/** Estado persistente del scheduler de pistas (singleton, id=1) */
export const courtSchedulerState = mysqlTable("court_scheduler_state", {
  id: int("id").autoincrement().primaryKey(),
  isRunning: boolean("isRunning").default(false).notNull(),
  intervalMinutes: int("intervalMinutes").default(5).notNull(),
  startedAt: timestamp("startedAt"),
  stoppedAt: timestamp("stoppedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CourtSchedulerState = typeof courtSchedulerState.$inferSelect;
export type InsertTelegramContact = typeof telegramContacts.$inferInsert;

/** Registro de cada ciclo de ejecución del monitor de pistas */
export const monitorRuns = mysqlTable("monitor_runs", {
  id: int("id").autoincrement().primaryKey(),
  /** Fecha/hora de inicio del ciclo */
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  /** Fecha/hora de fin del ciclo */
  finishedAt: timestamp("finishedAt"),
  /** Duración en milisegundos */
  durationMs: int("durationMs"),
  /** Días consultados (JSON array de strings 'YYYY-MM-DD') */
  datesChecked: text("datesChecked"),
  /** Total de slots libres encontrados en todos los días */
  slotsFound: int("slotsFound").default(0).notNull(),
  /** Slots que son nuevos (primera detección del día) */
  newSlotsFound: int("newSlotsFound").default(0).notNull(),
  /** Número de alertas Telegram enviadas */
  alertsSent: int("alertsSent").default(0).notNull(),
  /** Si fue disparado manualmente o por el scheduler */
  triggeredBy: mysqlEnum("triggeredBy", ["scheduler", "manual"]).default("scheduler").notNull(),
  /** 'ok' | 'error' | 'running' */
  status: mysqlEnum("status", ["ok", "error", "running"]).default("running").notNull(),
  /** Mensaje de error si status='error' */
  errorMessage: text("errorMessage"),
  /** Notas adicionales (ej: 'Sin pistas disponibles') */
  notes: text("notes"),
});

export type MonitorRun = typeof monitorRuns.$inferSelect;
export type InsertMonitorRun = typeof monitorRuns.$inferInsert;
