import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
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
  courtSchedulerState,
  monitorSettings,
  monitoredClubs,
  monitoredCourses,
  monitorRuns,
  telegramContacts,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

function createPool(): mysql.Pool {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    connectTimeout: 20000,
  });
  // Reconectar automáticamente ante errores de conexión en conexiones individuales
  pool.on('connection', (conn) => {
    conn.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
        console.warn('[Database] Connection lost, resetting pool:', err.code);
        _db = null;
        _pool = null;
      }
    });
  });
  return pool;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (!_pool) _pool = createPool();
      _db = drizzle(_pool);
    } catch (error) {
      console.warn('[Database] Failed to connect:', error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

/** Fuerza reconexión en el próximo getDb() — llamar tras ECONNRESET */
export function resetDbConnection(): void {
  console.warn('[Database] Resetting connection pool...');
  try {
    if (_pool) {
      _pool.end(); // sin callback — mysql2/promise usa Promise
    }
  } catch {}
  _db = null;
  _pool = null;
}

/**
 * Wrapper que ejecuta una función con acceso a la DB y reintenta automáticamente
 * si la conexión falla con ECONNRESET, PROTOCOL_CONNECTION_LOST o ECONNREFUSED.
 * Esto garantiza que el scheduler nunca se detenga por un timeout de conexión MySQL.
 */
export async function withDbRetry<T>(fn: (db: NonNullable<Awaited<ReturnType<typeof getDb>>>) => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i <= retries; i++) {
    try {
      const db = await getDb();
      if (!db) throw new Error('DB not available');
      return await fn(db);
    } catch (err: any) {
      lastError = err;
      const code = err?.code ?? err?.cause?.code ?? '';
      if (
        code === 'ECONNRESET' ||
        code === 'PROTOCOL_CONNECTION_LOST' ||
        code === 'ECONNREFUSED' ||
        err?.message?.includes('ECONNRESET') ||
        err?.message?.includes('PROTOCOL_CONNECTION_LOST')
      ) {
        console.warn(`[Database] withDbRetry: connection broken (${code}), resetting pool (attempt ${i + 1}/${retries + 1})...`);
        resetDbConnection();
        // Espera pequeña antes de reconectar
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      // Error que no es de conexión → relanzar inmediatamente
      throw err;
    }
  }

  throw lastError;
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
  try {
    return await withDbRetry(async (db) => {
      await db.insert(monitorRuns).values({
        startedAt: new Date(),
        status: "running",
        triggeredBy,
        slotsFound: 0,
        newSlotsFound: 0,
        alertsSent: 0,
      });
      // Drizzle/mysql2 no expone insertId de forma fiable; obtenemos el último ID insertado directamente
      const rows = await db
        .select({ id: monitorRuns.id })
        .from(monitorRuns)
        .orderBy(sql`${monitorRuns.id} DESC`)
        .limit(1);
      const id = rows[0]?.id ?? -1;
      console.log(`[CourtMonitor] createMonitorRun → runId=${id}`);
      return id;
    });
  } catch (err) {
    console.warn('[CourtMonitor] createMonitorRun failed (DB unavailable), continuing without logging:', err instanceof Error ? err.message : err);
    return -1;
  }
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
  console.log(`[CourtMonitor] finishMonitorRun → runId=${id}, status=${data.status}`);
  if (id < 0) { console.warn('[CourtMonitor] finishMonitorRun: invalid runId, skipping'); return; }
  try {
    await withDbRetry(async (db) => {
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
    });
  } catch (err) {
    console.warn('[CourtMonitor] finishMonitorRun failed (DB unavailable), continuing:', err instanceof Error ? err.message : err);
  }
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

// ─── Court Scheduler State (persistencia en DB) ───────────────────────────────

/** Obtiene o crea el registro singleton del estado del scheduler de pistas */
export async function getCourtSchedulerState() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(courtSchedulerState).limit(1);
  if (rows.length > 0) return rows[0]!;
  // Crear el singleton si no existe
  await db.insert(courtSchedulerState).values({ isRunning: false, intervalMinutes: 5 });
  const created = await db.select().from(courtSchedulerState).limit(1);
  return created[0] ?? null;
}

/** Persiste en DB que el scheduler ha arrancado */
export async function persistSchedulerStart(intervalMinutes: number) {
  const db = await getDb();
  if (!db) return;
  const state = await getCourtSchedulerState();
  if (!state) return;
  await db
    .update(courtSchedulerState)
    .set({ isRunning: true, intervalMinutes, startedAt: new Date(), stoppedAt: null })
    .where(eq(courtSchedulerState.id, state.id));
}

/** Marca como 'error' todos los ciclos que llevan más de maxAgeMinutes en estado 'running' (huérfanos) */
export async function cleanupOrphanedRuns(maxAgeMinutes = 15): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const orphans = await db
    .select({ id: monitorRuns.id })
    .from(monitorRuns)
    .where(and(eq(monitorRuns.status, 'running'), sql`${monitorRuns.startedAt} < ${cutoff}`));
  if (orphans.length === 0) return 0;
  await db
    .update(monitorRuns)
    .set({
      status: 'error',
      finishedAt: new Date(),
      errorMessage: 'Ciclo interrumpido (servidor reiniciado o watchdog)',
      notes: 'Marcado como error automáticamente al detectar ciclo huérfano',
    })
    .where(and(eq(monitorRuns.status, 'running'), sql`${monitorRuns.startedAt} < ${cutoff}`));
  console.log(`[Database] Cleaned up ${orphans.length} orphaned running cycles`);
  return orphans.length;
}

/** Persiste en DB que el scheduler se ha detenido */
export async function persistSchedulerStop() {
  const db = await getDb();
  if (!db) return;
  const state = await getCourtSchedulerState();
  if (!state) return;
  await db
    .update(courtSchedulerState)
    .set({ isRunning: false, stoppedAt: new Date() })
    .where(eq(courtSchedulerState.id, state.id));
}

// ─── Aliases para multi-club support (usan las funciones ya definidas arriba) ──
export const getMonitoredClubs = getAllClubs;
export const addMonitoredClub = upsertClub;

export async function removeMonitoredClub(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(monitoredClubs).where(eq(monitoredClubs.id, id));
}
