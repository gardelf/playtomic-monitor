/**
 * Motor de monitorización de Playtomic
 * Consulta la API de Playtomic y detecta cambios en la disponibilidad de plazas.
 */

import axios from "axios";
import {
  getAllActiveCourses,
  getAllClubs,
  getAlertConfig,
  incrementMonitorStats,
  insertAlert,
  insertSnapshot,
  updateMonitorSettings,
  upsertCourse,
} from "./db";

const PLAYTOMIC_API = "https://api.playtomic.io/v1";
const PLAYTOMIC_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "X-Requested-With": "com.playtomic.web",
  Accept: "application/json",
};

// ─── Playtomic API Types ───────────────────────────────────────────────────────

interface PlaytomicLesson {
  tournament_id: string;
  tournament_name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  max_players: number;
  registered_players: unknown[];
  type?: string;
}

interface PlaytomicCourse {
  course_id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  restrictions_configuration?: { max_players?: number };
  available_places_summary?: { available_places: number }[];
  registrations?: unknown[];
  status?: string;
}

// ─── Fetch from Playtomic ─────────────────────────────────────────────────────

export async function fetchLessons(tenantId: string): Promise<PlaytomicLesson[]> {
  try {
    const resp = await axios.get(`${PLAYTOMIC_API}/lessons`, {
      params: { tenant_id: tenantId, size: 50, sort: "start_date,ASC" },
      headers: PLAYTOMIC_HEADERS,
      timeout: 15000,
    });
    return Array.isArray(resp.data) ? resp.data : [];
  } catch (err) {
    console.error(`[Monitor] Error fetching lessons for ${tenantId}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchCourses(tenantId: string): Promise<PlaytomicCourse[]> {
  try {
    const resp = await axios.get(`${PLAYTOMIC_API}/courses`, {
      params: { tenant_id: tenantId, size: 50 },
      headers: PLAYTOMIC_HEADERS,
      timeout: 15000,
    });
    return Array.isArray(resp.data) ? resp.data : [];
  } catch (err) {
    console.error(`[Monitor] Error fetching courses for ${tenantId}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Alert Senders ────────────────────────────────────────────────────────────

async function sendTelegramAlert(message: string): Promise<boolean> {
  try {
    const config = await getAlertConfig("telegram");
    if (!config?.isEnabled) return false;
    const { botToken, chatId } = JSON.parse(config.config || "{}") as { botToken?: string; chatId?: string };
    if (!botToken || !chatId) return false;

    await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: chatId, text: message, parse_mode: "HTML" },
      { timeout: 10000 }
    );
    return true;
  } catch (err) {
    console.error("[Monitor] Telegram error:", err instanceof Error ? err.message : err);
    return false;
  }
}

async function sendEmailAlert(subject: string, body: string): Promise<boolean> {
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

    // Dynamic import of nodemailer
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
    console.error("[Monitor] Email error:", err instanceof Error ? err.message : err);
    return false;
  }
}

async function sendAlerts(courseId: number, courseName: string, availablePlaces: number, clubName: string): Promise<number> {
  const message =
    `🎾 <b>¡Plaza disponible en ${clubName}!</b>\n\n` +
    `📋 <b>Clase/Curso:</b> ${courseName}\n` +
    `✅ <b>Plazas libres:</b> ${availablePlaces}\n\n` +
    `Entra en la app de Playtomic para reservar tu plaza.`;

  const emailBody =
    `¡Plaza disponible en ${clubName}!\n\n` +
    `Clase/Curso: ${courseName}\n` +
    `Plazas libres: ${availablePlaces}\n\n` +
    `Entra en la app de Playtomic para reservar tu plaza.`;

  let sent = 0;

  // Telegram
  const tgOk = await sendTelegramAlert(message);
  await insertAlert({
    courseId,
    channel: "telegram",
    message,
    availablePlaces,
    status: tgOk ? "sent" : "failed",
    errorMessage: tgOk ? undefined : "Telegram not configured or failed",
  });
  if (tgOk) sent++;

  // Email
  const emailOk = await sendEmailAlert(`🎾 Plaza disponible: ${courseName}`, emailBody);
  await insertAlert({
    courseId,
    channel: "email",
    message: emailBody,
    availablePlaces,
    status: emailOk ? "sent" : "failed",
    errorMessage: emailOk ? undefined : "Email not configured or failed",
  });
  if (emailOk) sent++;

  return sent;
}

// ─── Core Monitor Loop ────────────────────────────────────────────────────────

export async function runMonitorCycle(): Promise<{ checked: number; alertsSent: number; changes: number }> {
  console.log("[Monitor] Starting monitor cycle...");
  const clubs = await getAllClubs();
  let totalAlerts = 0;
  let totalChanges = 0;
  let totalChecked = 0;

  for (const club of clubs) {
    if (!club.isActive) continue;

    // Fetch lessons (clases sueltas)
    const lessons = await fetchLessons(club.tenantId);
    for (const lesson of lessons) {
      const maxPlayers = lesson.max_players || 0;
      const registeredCount = (lesson.registered_players || []).length;
      const availablePlaces = Math.max(0, maxPlayers - registeredCount);

      const course = await upsertCourse({
        clubId: club.id,
        externalId: lesson.tournament_id,
        courseType: "lesson",
        name: lesson.tournament_name,
        description: lesson.description,
        startDate: lesson.start_date ? new Date(lesson.start_date) : undefined,
        endDate: lesson.end_date ? new Date(lesson.end_date) : undefined,
        maxPlayers,
        lastAvailablePlaces: availablePlaces,
        lastRegisteredCount: registeredCount,
      });

      // Detect change: previously 0 places, now >0
      const wasZero = (course.lastAvailablePlaces ?? 0) === 0 && availablePlaces > 0;
      // Note: upsertCourse already updated lastAvailablePlaces, so we detect based on DB state before update
      // We use the snapshot to track changes
      const isChangeDetected = wasZero;

      await insertSnapshot({
        courseId: course.id,
        availablePlaces,
        registeredCount,
        maxPlayers,
        isChangeDetected,
      });

      if (isChangeDetected) {
        console.log(`[Monitor] CHANGE DETECTED: ${lesson.tournament_name} - ${availablePlaces} places available`);
        const sent = await sendAlerts(course.id, lesson.tournament_name, availablePlaces, club.name);
        totalAlerts += sent;
        totalChanges++;
      }

      totalChecked++;
    }

    // Fetch courses (cursos de academia)
    const courses = await fetchCourses(club.tenantId);
    for (const c of courses) {
      const maxPlayers = c.restrictions_configuration?.max_players || 0;
      const registeredCount = (c.registrations || []).length;
      const availSummary = c.available_places_summary || [];
      const availablePlaces = availSummary.reduce((sum, s) => sum + (s.available_places || 0), 0);

      const course = await upsertCourse({
        clubId: club.id,
        externalId: c.course_id,
        courseType: "course",
        name: c.name,
        description: c.description,
        startDate: c.start_date ? new Date(c.start_date) : undefined,
        endDate: c.end_date ? new Date(c.end_date) : undefined,
        maxPlayers,
        lastAvailablePlaces: availablePlaces,
        lastRegisteredCount: registeredCount,
      });

      const wasZero = (course.lastAvailablePlaces ?? 0) === 0 && availablePlaces > 0;
      const isChangeDetected = wasZero;

      await insertSnapshot({
        courseId: course.id,
        availablePlaces,
        registeredCount,
        maxPlayers,
        isChangeDetected,
      });

      if (isChangeDetected) {
        console.log(`[Monitor] CHANGE DETECTED: ${c.name} - ${availablePlaces} places available`);
        const sent = await sendAlerts(course.id, c.name, availablePlaces, club.name);
        totalAlerts += sent;
        totalChanges++;
      }

      totalChecked++;
    }
  }

  await incrementMonitorStats(totalAlerts);
  await updateMonitorSettings({ lastRunAt: new Date() });

  console.log(`[Monitor] Cycle complete: ${totalChecked} checked, ${totalChanges} changes, ${totalAlerts} alerts sent`);
  return { checked: totalChecked, alertsSent: totalAlerts, changes: totalChanges };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let _schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startScheduler(intervalMinutes: number): void {
  stopScheduler();
  const ms = intervalMinutes * 60 * 1000;
  console.log(`[Monitor] Scheduler started: every ${intervalMinutes} minutes`);
  _schedulerInterval = setInterval(async () => {
    try {
      await runMonitorCycle();
    } catch (err) {
      console.error("[Monitor] Scheduler error:", err);
    }
  }, ms);
}

export function stopScheduler(): void {
  if (_schedulerInterval) {
    clearInterval(_schedulerInterval);
    _schedulerInterval = null;
    console.log("[Monitor] Scheduler stopped");
  }
}

export function isSchedulerRunning(): boolean {
  return _schedulerInterval !== null;
}
