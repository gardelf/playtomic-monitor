import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  AlertConfig,
  AlertHistory,
  InsertUser,
  InsertTelegramContact,
  InsertMonitorRun,
  MonitorRun,
  MonitoredClub,
  MonitoredCourse,
  MonitorSettings,
  TelegramContact,
  alertConfigs,
  alertHistory,
  courseSnapshots,
  monitorSettings,
  monitoredClubs,
  monitoredCourses,
  monitorRuns,
  telegramContacts,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Monitored Clubs ──────────────────────────────────────────────────────────

export async function getAllClubs(): Promise<MonitoredClub[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(monitoredClubs).orderBy(monitoredClubs.name);
}

export async function getClubByTenantId(tenantId: string): Promise<MonitoredClub | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(monitoredClubs).where(eq(monitoredClubs.tenantId, tenantId)).limit(1);
  return result[0];
}

export async function upsertClub(data: {
  tenantId: string;
  tenantUid?: string;
  name: string;
  city?: string;
  country?: string;
  imageUrl?: string;
}): Promise<MonitoredClub> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(monitoredClubs).values({ ...data, isActive: true }).onDuplicateKeyUpdate({
    set: { name: data.name, city: data.city ?? null, country: data.country ?? null, imageUrl: data.imageUrl ?? null },
  });
  const result = await db.select().from(monitoredClubs).where(eq(monitoredClubs.tenantId, data.tenantId)).limit(1);
  return result[0]!;
}

// ─── Monitored Courses ────────────────────────────────────────────────────────

export async function getCoursesByClub(clubId: number): Promise<MonitoredCourse[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(monitoredCourses).where(eq(monitoredCourses.clubId, clubId)).orderBy(monitoredCourses.name);
}

export async function getAllActiveCourses(): Promise<MonitoredCourse[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(monitoredCourses).where(eq(monitoredCourses.isActive, true));
}

export async function getCourseByExternalId(externalId: string, clubId: number): Promise<MonitoredCourse | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(monitoredCourses)
    .where(and(eq(monitoredCourses.externalId, externalId), eq(monitoredCourses.clubId, clubId)))
    .limit(1);
  return result[0];
}

export async function upsertCourse(data: {
  clubId: number;
  externalId: string;
  courseType: "lesson" | "course";
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  maxPlayers?: number;
  lastAvailablePlaces?: number;
  lastRegisteredCount?: number;
}): Promise<MonitoredCourse> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const existing = await getCourseByExternalId(data.externalId, data.clubId);
  if (existing) {
    await db
      .update(monitoredCourses)
      .set({
        name: data.name,
        description: data.description ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        maxPlayers: data.maxPlayers ?? 0,
        lastAvailablePlaces: data.lastAvailablePlaces ?? 0,
        lastRegisteredCount: data.lastRegisteredCount ?? 0,
        lastCheckedAt: new Date(),
      })
      .where(eq(monitoredCourses.id, existing.id));
    const updated = await db.select().from(monitoredCourses).where(eq(monitoredCourses.id, existing.id)).limit(1);
    return updated[0]!;
  }

  await db.insert(monitoredCourses).values({ ...data, isActive: true, lastCheckedAt: new Date() });
  const result = await db
    .select()
    .from(monitoredCourses)
    .where(and(eq(monitoredCourses.externalId, data.externalId), eq(monitoredCourses.clubId, data.clubId)))
    .limit(1);
  return result[0]!;
}

export async function toggleCourseActive(courseId: number, isActive: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(monitoredCourses).set({ isActive }).where(eq(monitoredCourses.id, courseId));
}

export async function deleteCourse(courseId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(monitoredCourses).where(eq(monitoredCourses.id, courseId));
}

// ─── Course Snapshots ─────────────────────────────────────────────────────────

export async function insertSnapshot(data: {
  courseId: number;
  availablePlaces: number;
  registeredCount: number;
  maxPlayers: number;
  isChangeDetected: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(courseSnapshots).values(data);
}

export async function getRecentSnapshots(courseId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(courseSnapshots)
    .where(eq(courseSnapshots.courseId, courseId))
    .orderBy(desc(courseSnapshots.checkedAt))
    .limit(limit);
}

// ─── Alert History ────────────────────────────────────────────────────────────

export async function insertAlert(data: {
  courseId: number;
  channel: "telegram" | "email";
  message: string;
  availablePlaces: number;
  status: "sent" | "failed";
  errorMessage?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(alertHistory).values({ ...data, errorMessage: data.errorMessage ?? null });
}

export async function getAlertHistory(limit = 50): Promise<AlertHistory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alertHistory).orderBy(desc(alertHistory.sentAt)).limit(limit);
}

export async function getAlertHistoryWithCourse(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: alertHistory.id,
      courseId: alertHistory.courseId,
      channel: alertHistory.channel,
      message: alertHistory.message,
      availablePlaces: alertHistory.availablePlaces,
      status: alertHistory.status,
      errorMessage: alertHistory.errorMessage,
      sentAt: alertHistory.sentAt,
      courseName: monitoredCourses.name,
      courseType: monitoredCourses.courseType,
    })
    .from(alertHistory)
    .leftJoin(monitoredCourses, eq(alertHistory.courseId, monitoredCourses.id))
    .orderBy(desc(alertHistory.sentAt))
    .limit(limit);
}

// ─── Alert Configs ────────────────────────────────────────────────────────────

export async function getAlertConfig(channel: "telegram" | "email"): Promise<AlertConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(alertConfigs).where(eq(alertConfigs.channel, channel)).limit(1);
  return result[0];
}

export async function getAllAlertConfigs(): Promise<AlertConfig[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alertConfigs);
}

export async function upsertAlertConfig(channel: "telegram" | "email", isEnabled: boolean, config: object): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const configStr = JSON.stringify(config);
  await db
    .insert(alertConfigs)
    .values({ channel, isEnabled, config: configStr })
    .onDuplicateKeyUpdate({ set: { isEnabled, config: configStr } });
}

// ─── Monitor Settings ─────────────────────────────────────────────────────────

export async function getMonitorSettings(): Promise<MonitorSettings | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(monitorSettings).limit(1);
  return result[0];
}

export async function ensureMonitorSettings(): Promise<MonitorSettings> {
  const existing = await getMonitorSettings();
  if (existing) return existing;
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(monitorSettings).values({ intervalMinutes: 5, isRunning: false, totalChecks: 0, totalAlertssSent: 0 });
  return (await getMonitorSettings())!;
}

export async function updateMonitorSettings(data: {
  intervalMinutes?: number;
  isRunning?: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  totalChecks?: number;
  totalAlertssSent?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const settings = await ensureMonitorSettings();
  await db.update(monitorSettings).set(data).where(eq(monitorSettings.id, settings.id));
}

export async function incrementMonitorStats(alertsSent: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const settings = await ensureMonitorSettings();
  await db
    .update(monitorSettings)
    .set({
      totalChecks: sql`${monitorSettings.totalChecks} + 1`,
      totalAlertssSent: sql`${monitorSettings.totalAlertssSent} + ${alertsSent}`,
      lastRunAt: new Date(),
    })
    .where(eq(monitorSettings.id, settings.id));
}

// ─── Telegram Contacts ─────────────────────────────────────────────────────────────────────────────────

export async function getAllTelegramContacts(): Promise<TelegramContact[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(telegramContacts).orderBy(telegramContacts.name);
}

export async function getActiveTelegramContacts(): Promise<TelegramContact[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(telegramContacts).where(eq(telegramContacts.isActive, true)).orderBy(telegramContacts.name);
}

export async function createTelegramContact(data: InsertTelegramContact): Promise<TelegramContact> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(telegramContacts).values(data);
  const result = await db.select().from(telegramContacts).where(eq(telegramContacts.chatId, data.chatId)).limit(1);
  return result[0]!;
}

export async function updateTelegramContact(id: number, data: Partial<InsertTelegramContact>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(telegramContacts).set(data).where(eq(telegramContacts.id, id));
}

export async function deleteTelegramContact(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(telegramContacts).where(eq(telegramContacts.id, id));
}

export async function incrementContactAlerts(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(telegramContacts)
    .set({
      totalAlerts: sql`${telegramContacts.totalAlerts} + 1`,
      lastAlertAt: new Date(),
    })
    .where(eq(telegramContacts.id, id));
}

// ─── Monitor Runs (Activity Log) ─────────────────────────────────────────────────────────────────────────────────

/** Crea un registro de inicio de ciclo y devuelve su ID */
export async function createMonitorRun(triggeredBy: "scheduler" | "manual"): Promise<number> {
  const db = await getDb();
  if (!db) return -1;
  const result = await db.insert(monitorRuns).values({
    startedAt: new Date(),
    status: "running",
    triggeredBy,
    slotsFound: 0,
    newSlotsFound: 0,
    alertsSent: 0,
  });
  return (result as any).insertId ?? -1;
}

/** Actualiza el registro al finalizar el ciclo */
export async function finishMonitorRun(
  id: number,
  data: {
    slotsFound: number;
    newSlotsFound: number;
    alertsSent: number;
    datesChecked: string[];
    status: "ok" | "error";
    errorMessage?: string;
    notes?: string;
  }
): Promise<void> {
  const db = await getDb();
  if (!db || id < 0) return;
  const now = new Date();
  const run = await db.select().from(monitorRuns).where(eq(monitorRuns.id, id)).limit(1);
  const startedAt = run[0]?.startedAt ?? now;
  const durationMs = now.getTime() - new Date(startedAt).getTime();
  await db
    .update(monitorRuns)
    .set({
      finishedAt: now,
      durationMs,
      slotsFound: data.slotsFound,
      newSlotsFound: data.newSlotsFound,
      alertsSent: data.alertsSent,
      datesChecked: JSON.stringify(data.datesChecked),
      status: data.status,
      errorMessage: data.errorMessage ?? null,
      notes: data.notes ?? null,
    })
    .where(eq(monitorRuns.id, id));
}

/** Obtiene los últimos N registros de actividad */
export async function getMonitorRuns(limit = 100): Promise<MonitorRun[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(monitorRuns)
    .orderBy(sql`${monitorRuns.startedAt} DESC`)
    .limit(limit);
}

/** Estadísticas globales de actividad */
export async function getMonitorRunStats(): Promise<{
  totalRuns: number;
  totalSlotsFound: number;
  totalAlertsSent: number;
  lastRunAt: Date | null;
  successRate: number;
}> {
  const db = await getDb();
  if (!db) return { totalRuns: 0, totalSlotsFound: 0, totalAlertsSent: 0, lastRunAt: null, successRate: 0 };
  const rows = await db.select().from(monitorRuns).orderBy(sql`${monitorRuns.startedAt} DESC`).limit(500);
  const finished = rows.filter((r) => r.status !== "running");
  const ok = finished.filter((r) => r.status === "ok").length;
  return {
    totalRuns: finished.length,
    totalSlotsFound: finished.reduce((s, r) => s + (r.slotsFound ?? 0), 0),
    totalAlertsSent: finished.reduce((s, r) => s + (r.alertsSent ?? 0), 0),
    lastRunAt: rows[0]?.startedAt ?? null,
    successRate: finished.length > 0 ? Math.round((ok / finished.length) * 100) : 0,
  };
}
