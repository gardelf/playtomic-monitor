/**
 * Motor de monitorización de disponibilidad de PISTAS de Playtomic
 * Consulta /v1/availability y /v1/tenants/{id}/resources
 */

import axios from "axios";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  CourtWatchConfig,
  courtAvailabilitySnapshots,
  courtWatchConfigs,
  InsertCourtWatchConfig,
} from "../drizzle/schema";
import { getAlertConfig, insertAlert } from "./db";

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
    // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
    let diff = dayOfWeek - d.getDay();
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff + w * 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  // Deduplicate
  const seen = new Set<string>();
  return dates.filter((d) => { if (seen.has(d)) return false; seen.add(d); return true; });
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
  // Get the most recent check time
  const latest = await db
    .select()
    .from(courtAvailabilitySnapshots)
    .where(eq(courtAvailabilitySnapshots.watchConfigId, watchConfigId))
    .orderBy(desc(courtAvailabilitySnapshots.checkedAt))
    .limit(1);

  if (!latest[0]) return [];

  const latestTime = latest[0].checkedAt;
  // Get all snapshots from the same check cycle (within 60 seconds)
  const cutoff = new Date(latestTime.getTime() - 60000);

  return db
    .select()
    .from(courtAvailabilitySnapshots)
    .where(
      and(
        eq(courtAvailabilitySnapshots.watchConfigId, watchConfigId),
        // checkedAt >= cutoff — use raw comparison
      )
    )
    .orderBy(courtAvailabilitySnapshots.slotDate, courtAvailabilitySnapshots.slotTime)
    .limit(100);
}

// ─── Alert Senders ────────────────────────────────────────────────────────────

async function sendCourtTelegramAlert(message: string): Promise<boolean> {
  try {
    const config = await getAlertConfig("telegram");
    if (!config?.isEnabled) return false;
    const { botToken, chatId } = JSON.parse(config.config || "{}") as {
      botToken?: string;
      chatId?: string;
    };
    if (!botToken || !chatId) return false;

    await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: chatId, text: message, parse_mode: "HTML" },
      { timeout: 10000 }
    );
    return true;
  } catch (err) {
    console.error("[CourtMonitor] Telegram error:", err instanceof Error ? err.message : err);
    return false;
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

export async function runCourtMonitorCycle(): Promise<{
  checked: number;
  slotsFound: number;
  newSlots: number;
  alertsSent: number;
}> {
  console.log("[CourtMonitor] Starting court monitor cycle...");
  const db = await getDb();
  if (!db) return { checked: 0, slotsFound: 0, newSlots: 0, alertsSent: 0 };

  const configs = await getActiveCourtWatchConfigs();
  let totalChecked = 0;
  let totalSlotsFound = 0;
  let totalNewSlots = 0;
  let totalAlerts = 0;

  // Cache resources per tenant
  const resourceCache: Record<string, Record<string, PlaytomicResource>> = {};

  for (const config of configs) {
    // Get club tenant ID
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
          const time = slot.start_time.substring(0, 5); // HH:MM
          const inRange = time >= config.startTimeMin && time <= config.startTimeMax;
          const durationOk = !config.preferredDuration || slot.duration === config.preferredDuration;
          return inRange && durationOk;
        });

        for (const slot of matchingSlots) {
          totalSlotsFound++;

          // Check if this slot was already seen recently (same date+time+court in last 24h)
          const existing = await db
            .select()
            .from(courtAvailabilitySnapshots)
            .where(
              and(
                eq(courtAvailabilitySnapshots.watchConfigId, config.id),
                eq(courtAvailabilitySnapshots.slotDate, dateStr),
                eq(courtAvailabilitySnapshots.slotTime, slot.start_time.substring(0, 5)),
                eq(courtAvailabilitySnapshots.resourceId, courtAvail.resource_id),
                eq(courtAvailabilitySnapshots.duration, slot.duration)
              )
            )
            .limit(1);

          const isNew = existing.length === 0;

          // Save snapshot
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
            isNewDetection: isNew,
          });

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

      let tgMsg = `🎾 <b>¡Pistas disponibles en ${club.name}!</b>\n`;
      tgMsg += `📅 <b>Vigilancia:</b> ${config.name}\n`;
      tgMsg += `📆 <b>Día:</b> ${dayName} ${config.startTimeMin}-${config.startTimeMax}\n\n`;
      tgMsg += `<b>Slots encontrados (${newSlotsForConfig.length}):</b>\n`;
      for (const slot of newSlotsForConfig.slice(0, 10)) {
        const typeIcon = slot.courtType === "indoor" ? "🏠" : "☀️";
        tgMsg += `${typeIcon} <b>${slot.courtName}</b> · ${slot.date} ${slot.time} · ${slot.duration}min · ${slot.price}\n`;
      }
      if (newSlotsForConfig.length > 10) {
        tgMsg += `...y ${newSlotsForConfig.length - 10} más\n`;
      }
      tgMsg += `\nEntra en Playtomic para reservar.`;

      const emailBody = tgMsg.replace(/<[^>]+>/g, "");

      const tgOk = await sendCourtTelegramAlert(tgMsg);
      // Use courseId=0 as placeholder for court alerts (no course associated)
      await insertAlert({
        courseId: 0,
        channel: "telegram",
        message: tgMsg,
        availablePlaces: newSlotsForConfig.length,
        status: tgOk ? "sent" : "failed",
        errorMessage: tgOk ? undefined : "Telegram not configured",
      });
      if (tgOk) totalAlerts++;

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

  console.log(
    `[CourtMonitor] Cycle complete: ${totalChecked} dates checked, ${totalSlotsFound} slots found, ${totalNewSlots} new, ${totalAlerts} alerts`
  );
  return {
    checked: totalChecked,
    slotsFound: totalSlotsFound,
    newSlots: totalNewSlots,
    alertsSent: totalAlerts,
  };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let _courtSchedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startCourtScheduler(intervalMinutes: number): void {
  stopCourtScheduler();
  const ms = intervalMinutes * 60 * 1000;
  console.log(`[CourtMonitor] Scheduler started: every ${intervalMinutes} minutes`);
  _courtSchedulerInterval = setInterval(async () => {
    try {
      await runCourtMonitorCycle();
    } catch (err) {
      console.error("[CourtMonitor] Scheduler error:", err);
    }
  }, ms);
}

export function stopCourtScheduler(): void {
  if (_courtSchedulerInterval) {
    clearInterval(_courtSchedulerInterval);
    _courtSchedulerInterval = null;
    console.log("[CourtMonitor] Scheduler stopped");
  }
}

export function isCourtSchedulerRunning(): boolean {
  return _courtSchedulerInterval !== null;
}
