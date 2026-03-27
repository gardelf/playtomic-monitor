/**
 * Motor de monitorización de disponibilidad de PISTAS de Playtomic
 * - Consulta /v1/availability cada 5 minutos
 * - Detecta la primera apertura del día (slots que no existían antes)
 * - Envía alertas a TODOS los contactos Telegram activos con enlace directo
 */

import axios from "axios";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "./db";
import {
  CourtWatchConfig,
  courtAvailabilitySnapshots,
  courtWatchConfigs,
  InsertCourtWatchConfig,
} from "../drizzle/schema";
import {
  cleanupOrphanedRuns,
  createMonitorRun,
  finishMonitorRun,
  getActiveTelegramContacts,
  getAlertConfig,
  getCourtSchedulerState,
  incrementContactAlerts,
  insertAlert,
  persistSchedulerStart,
  persistSchedulerStop,
  resetDbConnection,
} from "./db";

const PLAYTOMIC_API = "https://api.playtomic.io/v1";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "X-Requested-With": "com.playtomic.web",
  Accept: "application/json",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaytomicSlot {
  start_time: string;
  duration: number;
  price: string;
}

interface PlaytomicAvailability {
  resource_id: string;
  start_date: string;
  slots: PlaytomicSlot[];
}

interface PlaytomicResource {
  resource_id: string;
  name: string;
  sport_id: string;
  is_active: boolean;
  properties?: {
    resource_type?: string;
    resource_size?: string;
    resource_feature?: string;
  };
}

export interface CourtSlotResult {
  date: string;
  time: string;
  duration: number;
  courtName: string;
  resourceId: string;
  courtType?: string;
  courtFeature?: string;
  price: string;
  isNew: boolean;
}

// ─── Playtomic URL builder ────────────────────────────────────────────────────

/**
 * Genera el enlace directo a la página de reservas de Playtomic para un club y fecha.
 * Formato: https://playtomic.io/clubs/{tenantUid}?date=YYYY-MM-DD
 */
export function buildPlaytomicBookingUrl(tenantUid: string, dateStr: string): string {
  return `https://playtomic.io/clubs/${tenantUid}?date=${dateStr}`;
}

// ─── API Fetchers ─────────────────────────────────────────────────────────────

export async function fetchCourtAvailability(
  tenantId: string,
  dateStr: string,
  sportId = "PADEL"
): Promise<PlaytomicAvailability[]> {
  try {
    const resp = await axios.get(`${PLAYTOMIC_API}/availability`, {
      params: {
        tenant_id: tenantId,
        sport_id: sportId,
        local_start_min: `${dateStr}T00:00:00`,
        local_start_max: `${dateStr}T23:59:59`,
      },
      headers: HEADERS,
      timeout: 15000,
    });
    return Array.isArray(resp.data) ? resp.data : [];
  } catch (err) {
    console.error(`[CourtMonitor] Error fetching availability for ${dateStr}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchCourtResources(tenantId: string): Promise<PlaytomicResource[]> {
  try {
    const resp = await axios.get(`${PLAYTOMIC_API}/tenants/${tenantId}/resources`, {
      headers: HEADERS,
      timeout: 10000,
    });
    return Array.isArray(resp.data) ? resp.data : [];
  } catch (err) {
    console.error(`[CourtMonitor] Error fetching resources:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

/**
 * Obtiene las próximas N fechas que corresponden a un día de la semana dado.
 * dayOfWeek: 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
 */
export function getUpcomingDates(dayOfWeek: number, weeksAhead: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let w = 0; w < weeksAhead; w++) {
    const d = new Date(today);
    let diff = dayOfWeek - d.getDay();
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff + w * 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  const seen = new Set<string>();
  return dates.filter((d) => {
    if (seen.has(d)) return false;
    seen.add(d);
    return true;
  });
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

export async function getCourtWatchConfigs(clubId?: number): Promise<CourtWatchConfig[]> {
  const db = await getDb();
  if (!db) return [];
  if (clubId !== undefined) {
    return db.select().from(courtWatchConfigs).where(eq(courtWatchConfigs.clubId, clubId));
  }
  return db.select().from(courtWatchConfigs);
}

export async function getActiveCourtWatchConfigs(): Promise<CourtWatchConfig[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(courtWatchConfigs).where(eq(courtWatchConfigs.isActive, true));
}

export async function createCourtWatchConfig(data: InsertCourtWatchConfig): Promise<CourtWatchConfig> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(courtWatchConfigs).values(data);
  const result = await db
    .select()
    .from(courtWatchConfigs)
    .where(eq(courtWatchConfigs.name, data.name))
    .orderBy(desc(courtWatchConfigs.id))
    .limit(1);
  return result[0]!;
}

export async function updateCourtWatchConfig(
  id: number,
  data: Partial<InsertCourtWatchConfig>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(courtWatchConfigs).set(data).where(eq(courtWatchConfigs.id, id));
}

export async function deleteCourtWatchConfig(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(courtWatchConfigs).where(eq(courtWatchConfigs.id, id));
}

export async function getRecentCourtSnapshots(watchConfigId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(courtAvailabilitySnapshots)
    .where(eq(courtAvailabilitySnapshots.watchConfigId, watchConfigId))
    .orderBy(desc(courtAvailabilitySnapshots.checkedAt))
    .limit(limit);
}

export async function getLatestCourtAvailability(watchConfigId: number) {
  const db = await getDb();
  if (!db) return [];
  const latest = await db
    .select()
    .from(courtAvailabilitySnapshots)
    .where(eq(courtAvailabilitySnapshots.watchConfigId, watchConfigId))
    .orderBy(desc(courtAvailabilitySnapshots.checkedAt))
    .limit(1);

  if (!latest[0]) return [];

  return db
    .select()
    .from(courtAvailabilitySnapshots)
    .where(eq(courtAvailabilitySnapshots.watchConfigId, watchConfigId))
    .orderBy(courtAvailabilitySnapshots.slotDate, courtAvailabilitySnapshots.slotTime)
    .limit(100);
}

// ─── Alert Senders ────────────────────────────────────────────────────────────

/**
 * Envía un mensaje Telegram a UN contacto específico.
 */
async function sendTelegramToContact(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  try {
    await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: false },
      { timeout: 10000 }
    );
    return true;
  } catch (err) {
    console.error(`[CourtMonitor] Telegram error for chatId ${chatId}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Envía una alerta a TODOS los contactos Telegram activos.
 * Retorna el número de envíos exitosos.
 */
export async function sendTelegramAlertToAll(message: string): Promise<number> {
  const config = await getAlertConfig("telegram");
  if (!config?.isEnabled) return 0;

  const { botToken } = JSON.parse(config.config || "{}") as { botToken?: string };
  if (!botToken) return 0;

  const contacts = await getActiveTelegramContacts();
  if (contacts.length === 0) {
    console.warn("[CourtMonitor] No active Telegram contacts found");
    return 0;
  }

  let sent = 0;
  for (const contact of contacts) {
    const ok = await sendTelegramToContact(botToken, contact.chatId, message);
    if (ok) {
      sent++;
      await incrementContactAlerts(contact.id);
    }
  }
  console.log(`[CourtMonitor] Telegram alerts sent to ${sent}/${contacts.length} contacts`);
  return sent;
}

/**
 * Envía un mensaje de prueba a un contacto específico por chatId.
 */
export async function sendTelegramTestMessage(chatId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = await getAlertConfig("telegram");
    if (!config?.isEnabled) return { ok: false, error: "Telegram no está habilitado en Configuración" };
    const { botToken } = JSON.parse(config.config || "{}") as { botToken?: string };
    if (!botToken) return { ok: false, error: "Bot token no configurado" };

    const msg = `✅ <b>Playtomic Monitor</b>\n\nMensaje de prueba recibido correctamente.\nEste contacto recibirá alertas cuando haya pistas disponibles.`;
    const ok = await sendTelegramToContact(botToken, chatId, msg);
    return ok ? { ok: true } : { ok: false, error: "Error al enviar el mensaje. Verifica el Chat ID." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

async function sendCourtEmailAlert(subject: string, body: string): Promise<boolean> {
  try {
    const config = await getAlertConfig("email");
    if (!config?.isEnabled) return false;
    const { smtpHost, smtpPort, smtpUser, smtpPass, toEmail } = JSON.parse(config.config || "{}") as {
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPass?: string;
      toEmail?: string;
    };
    if (!smtpHost || !smtpUser || !smtpPass || !toEmail) return false;

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: smtpPort || 587,
      secure: (smtpPort || 587) === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Playtomic Monitor" <${smtpUser}>`,
      to: toEmail,
      subject,
      text: body,
      html: body.replace(/\n/g, "<br>"),
    });
    return true;
  } catch (err) {
    console.error("[CourtMonitor] Email error:", err instanceof Error ? err.message : err);
    return false;
  }
}

// ─── Core Monitor Cycle ───────────────────────────────────────────────────────

export async function runCourtMonitorCycle(triggeredBy: "scheduler" | "manual" = "scheduler"): Promise<{
  checked: number;
  slotsFound: number;
  newSlots: number;
  alertsSent: number;
}> {
  console.log("[CourtMonitor] Starting court monitor cycle...");

  // FALLBACK SIN DB: createMonitorRun ya captura errores internamente y devuelve -1 si la DB no está disponible.
  // El ciclo SIEMPRE continúa aunque la DB esté caída — Playtomic + Telegram siguen funcionando.
  const runId = await createMonitorRun(triggeredBy);
  if (runId < 0) {
    console.warn('[CourtMonitor] DB unavailable for logging, but cycle will continue (Playtomic + Telegram still active)');
  }

  try {
  const db = await getDb();
  if (!db) {
    console.warn('[CourtMonitor] DB unavailable for court watch configs, skipping cycle');
    return { checked: 0, slotsFound: 0, newSlots: 0, alertsSent: 0 };
  }

  const configs = await getActiveCourtWatchConfigs();
  let totalChecked = 0;
  let totalSlotsFound = 0;
  let totalNewSlots = 0;
  let totalAlerts = 0;

  // Cache resources per tenant
  const resourceCache: Record<string, Record<string, PlaytomicResource>> = {};

  for (const config of configs) {
    const { monitoredClubs } = await import("../drizzle/schema");
    const clubs = await db.select().from(monitoredClubs).where(eq(monitoredClubs.id, config.clubId)).limit(1);
    const club = clubs[0];
    if (!club) continue;

    // Load resources for this tenant (cached)
    if (!resourceCache[club.tenantId]) {
      const resources = await fetchCourtResources(club.tenantId);
      resourceCache[club.tenantId] = Object.fromEntries(resources.map((r) => [r.resource_id, r]));
    }
    const resources = resourceCache[club.tenantId]!;

    // Get upcoming dates for this day of week
    const dates = getUpcomingDates(config.dayOfWeek, config.weeksAhead);
    const newSlotsForConfig: CourtSlotResult[] = [];

    for (const dateStr of dates) {
      const availability = await fetchCourtAvailability(club.tenantId, dateStr, config.sportId);
      totalChecked++;

      for (const courtAvail of availability) {
        const resource = resources[courtAvail.resource_id];
        if (!resource?.is_active) continue;

        // Filter slots in the time range
        const matchingSlots = courtAvail.slots.filter((slot) => {
          const time = slot.start_time.substring(0, 5);
          const inRange = time >= config.startTimeMin && time <= config.startTimeMax;
          const durationOk =
            !config.preferredDuration || slot.duration === config.preferredDuration;
          return inRange && durationOk;
        });

        for (const slot of matchingSlots) {
          totalSlotsFound++;

          // Un slot es NUEVO si no estaba disponible en el ciclo anterior.
          // Usamos una ventana de 2×intervalo para comparar contra el último snapshot de este slot.
          // Esto garantiza que si Playtomic libera una pista que antes no existía, se detecta.
          const windowMs = Math.max((_courtSchedulerIntervalMinutes * 2 + 2) * 60 * 1000, 12 * 60 * 1000);
          const windowStart = new Date(Date.now() - windowMs);

          const existing = await db
            .select()
            .from(courtAvailabilitySnapshots)
            .where(
              and(
                eq(courtAvailabilitySnapshots.watchConfigId, config.id),
                eq(courtAvailabilitySnapshots.slotDate, dateStr),
                eq(courtAvailabilitySnapshots.slotTime, slot.start_time.substring(0, 5)),
                eq(courtAvailabilitySnapshots.resourceId, courtAvail.resource_id),
                eq(courtAvailabilitySnapshots.duration, slot.duration),
                gte(courtAvailabilitySnapshots.checkedAt, windowStart)
              )
            )
            .limit(1);

          const isNew = existing.length === 0;

          // Guardar snapshot solo si es nuevo (evita acumular millones de filas)
          if (isNew) {
            await db.insert(courtAvailabilitySnapshots).values({
              watchConfigId: config.id,
              slotDate: dateStr,
              slotTime: slot.start_time.substring(0, 5),
              duration: slot.duration,
              courtName: resource.name,
              resourceId: courtAvail.resource_id,
              courtType: resource.properties?.resource_type,
              courtFeature: resource.properties?.resource_feature,
              price: slot.price,
              isNewDetection: true,
            });
          }

          if (isNew) {
            totalNewSlots++;
            newSlotsForConfig.push({
              date: dateStr,
              time: slot.start_time.substring(0, 5),
              duration: slot.duration,
              courtName: resource.name,
              resourceId: courtAvail.resource_id,
              courtType: resource.properties?.resource_type,
              courtFeature: resource.properties?.resource_feature,
              price: slot.price,
              isNew: true,
            });
          }
        }
      }
    }

    // Send alerts for new slots
    if (newSlotsForConfig.length > 0) {
      const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
      const dayName = dayNames[config.dayOfWeek] ?? "día";

      // Group new slots by date for cleaner message
      const byDate = new Map<string, CourtSlotResult[]>();
      for (const slot of newSlotsForConfig) {
        if (!byDate.has(slot.date)) byDate.set(slot.date, []);
        byDate.get(slot.date)!.push(slot);
      }

      let tgMsg = `🎾 <b>¡Pistas disponibles en ${club.name}!</b>\n\n`;
      tgMsg += `📋 <b>${config.name}</b> · ${dayName} ${config.startTimeMin}–${config.startTimeMax}\n`;
      tgMsg += `🆕 <b>${newSlotsForConfig.length} slot${newSlotsForConfig.length !== 1 ? "s" : ""} nuevos</b>\n\n`;

      for (const [date, slots] of Array.from(byDate.entries())) {
        const [y, m, d] = date.split("-");
        const dateObj = new Date(parseInt(y!), parseInt(m!) - 1, parseInt(d!));
        const dateLabel = dateObj.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
        tgMsg += `📅 <b>${dateLabel}</b>\n`;

        for (const slot of slots.slice(0, 8)) {
          const typeIcon = slot.courtType === "indoor" ? "🏠" : "☀️";
          const priceClean = slot.price.replace(" EUR", "€");
          tgMsg += `${typeIcon} ${slot.courtName} · <b>${slot.time}</b> · ${slot.duration}min · ${priceClean}\n`;
        }
        if (slots.length > 8) tgMsg += `  ...y ${slots.length - 8} más\n`;

        // Direct booking link for this date
        const tenantUid = club.tenantUid || club.tenantId;
        const bookingUrl = buildPlaytomicBookingUrl(tenantUid, date);
        tgMsg += `🔗 <a href="${bookingUrl}">Reservar en Playtomic</a>\n\n`;
      }

      tgMsg += `⏰ Detectado a las ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

      const emailBody = tgMsg.replace(/<[^>]+>/g, "");

      // Send to ALL active Telegram contacts
      const tgSent = await sendTelegramAlertToAll(tgMsg);
      await insertAlert({
        courseId: 0,
        channel: "telegram",
        message: tgMsg,
        availablePlaces: newSlotsForConfig.length,
        status: tgSent > 0 ? "sent" : "failed",
        errorMessage: tgSent === 0 ? "No active contacts or Telegram not configured" : undefined,
      });
      if (tgSent > 0) totalAlerts += tgSent;

      const emailOk = await sendCourtEmailAlert(`🎾 Pistas disponibles: ${config.name}`, emailBody);
      await insertAlert({
        courseId: 0,
        channel: "email",
        message: emailBody,
        availablePlaces: newSlotsForConfig.length,
        status: emailOk ? "sent" : "failed",
        errorMessage: emailOk ? undefined : "Email not configured",
      });
      if (emailOk) totalAlerts++;
    }
  }

  // Collect all dates checked
  const allDatesChecked: string[] = [];
  for (const config of configs) {
    const dates = getUpcomingDates(config.dayOfWeek, config.weeksAhead);
    for (const d of dates) {
      if (!allDatesChecked.includes(d)) allDatesChecked.push(d);
    }
  }

  const notes = totalSlotsFound === 0
    ? "Sin pistas disponibles en el rango configurado"
    : totalNewSlots === 0
    ? `${totalSlotsFound} slots encontrados, ninguno nuevo`
    : `${totalNewSlots} nuevos slots detectados de ${totalSlotsFound} totales`;

  await finishMonitorRun(runId, {
    slotsFound: totalSlotsFound,
    newSlotsFound: totalNewSlots,
    alertsSent: totalAlerts,
    datesChecked: allDatesChecked,
    status: "ok",
    notes,
  });

  console.log(
    `[CourtMonitor] Cycle complete: ${totalChecked} dates checked, ${totalSlotsFound} slots found, ${totalNewSlots} new, ${totalAlerts} alerts`
  );
  return {
    checked: totalChecked,
    slotsFound: totalSlotsFound,
    newSlots: totalNewSlots,
    alertsSent: totalAlerts,
  };

  } catch (err: any) {
    const errorMessage = err?.message ?? String(err);
    console.error("[CourtMonitor] Cycle failed with error:", errorMessage);
    try {
      await finishMonitorRun(runId, {
        slotsFound: 0,
        newSlotsFound: 0,
        alertsSent: 0,
        datesChecked: [],
        status: "error",
        errorMessage,
      });
    } catch (finishErr) {
      console.error("[CourtMonitor] Could not finishMonitorRun after error:", finishErr);
    }
    return { checked: 0, slotsFound: 0, newSlots: 0, alertsSent: 0 };
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let _courtSchedulerInterval: ReturnType<typeof setInterval> | null = null;
let _courtSchedulerWatchdogInterval: ReturnType<typeof setInterval> | null = null;
let _courtSchedulerIntervalMinutes = 5;
let _courtSchedulerLastRunAt = 0; // timestamp ms del último ciclo completado
let _cycleInProgress = false; // flag para evitar ciclos solapados

/**
 * Ejecuta un ciclo de forma segura y actualiza el timestamp del último ciclo.
 * Evita solapamiento: si hay un ciclo en curso, lo omite.
 */
async function safeCycle(): Promise<void> {
  if (_cycleInProgress) {
    console.warn('[CourtMonitor] Ciclo anterior todavía en curso, omitiendo este tick');
    return;
  }
  _cycleInProgress = true;
  _courtSchedulerLastRunAt = Date.now();
  try {
    await runCourtMonitorCycle("scheduler");
  } finally {
    _cycleInProgress = false;
  }
}

export function startCourtScheduler(intervalMinutes = 5): void {
  stopCourtScheduler();
  _courtSchedulerIntervalMinutes = intervalMinutes;
  const ms = intervalMinutes * 60 * 1000;
  console.log(`[CourtMonitor] Scheduler started: every ${intervalMinutes} minutes`);
  // Persistir en DB para sobrevivir reinicios
  persistSchedulerStart(intervalMinutes).catch(console.error);

  // Marcar el tiempo de inicio para que el watchdog no dispare inmediatamente
  _courtSchedulerLastRunAt = Date.now();

  _courtSchedulerInterval = setInterval(async () => {
    try {
      await safeCycle();
    } catch (err) {
      console.error("[CourtMonitor] Scheduler error:", err);
    }
  }, ms);

  // Watchdog: comprueba cada minuto si el scheduler lleva más de 2×intervalo sin ejecutar
  if (_courtSchedulerWatchdogInterval) {
    clearInterval(_courtSchedulerWatchdogInterval);
  }
  _courtSchedulerWatchdogInterval = setInterval(() => {
    if (!isCourtSchedulerRunning()) return; // scheduler detenido intencionalmente
    if (_cycleInProgress) return; // hay un ciclo en curso, no es un atasco real
    const elapsed = Date.now() - _courtSchedulerLastRunAt;
    const threshold = 2 * ms;
    if (elapsed > threshold) {
      console.warn(`[CourtMonitor] Watchdog: scheduler stalled (${Math.round(elapsed / 60000)}min without a cycle). Restarting...`);
      // Limpiar ciclos huérfanos antes de reiniciar
      cleanupOrphanedRuns(15).catch(console.error);
      // Resetear la conexión a la DB por si el problema es ECONNRESET
      try { resetDbConnection(); } catch {}
      startCourtScheduler(_courtSchedulerIntervalMinutes);
    }
  }, 60_000); // cada minuto
}

export function stopCourtScheduler(): void {
  if (_courtSchedulerInterval) {
    clearInterval(_courtSchedulerInterval);
    _courtSchedulerInterval = null;
    console.log("[CourtMonitor] Scheduler stopped");
    persistSchedulerStop().catch(console.error);
  }
  if (_courtSchedulerWatchdogInterval) {
    clearInterval(_courtSchedulerWatchdogInterval);
    _courtSchedulerWatchdogInterval = null;
  }
}

export function isCourtSchedulerRunning(): boolean {
  return _courtSchedulerInterval !== null;
}

export function getCourtSchedulerIntervalMinutes(): number {
  return _courtSchedulerIntervalMinutes;
}

export function getCourtSchedulerLastRunAt(): number {
  return _courtSchedulerLastRunAt;
}

/**
 * Auto-arranque al iniciar el servidor: si el scheduler estaba activo
 * antes del reinicio, lo reactiva automáticamente.
 */
export async function autoStartCourtSchedulerIfNeeded(): Promise<void> {
  try {
    // Limpiar ciclos huérfanos de sesiones anteriores antes de arrancar
    const cleaned = await cleanupOrphanedRuns(15);
    if (cleaned > 0) {
      console.log(`[CourtMonitor] Cleaned up ${cleaned} orphaned running cycles from previous session`);
    }
    const state = await getCourtSchedulerState();
    if (state?.isRunning && !isCourtSchedulerRunning()) {
      console.log(`[CourtMonitor] Auto-restarting scheduler (was running before restart, interval: ${state.intervalMinutes}min)`);
      startCourtScheduler(state.intervalMinutes);
    }
  } catch (err) {
    console.error("[CourtMonitor] Auto-start check failed:", err);
  }
}
