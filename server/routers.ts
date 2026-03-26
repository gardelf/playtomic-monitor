import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  deleteCourse,
  ensureMonitorSettings,
  getAllAlertConfigs,
  getAllClubs,
  getAlertHistoryWithCourse,
  getCoursesByClub,
  getMonitorSettings,
  getRecentSnapshots,
  toggleCourseActive,
  upsertAlertConfig,
  upsertClub,
  upsertCourse,
} from "./db";
import { fetchCourses, fetchLessons, isSchedulerRunning, runMonitorCycle, startScheduler, stopScheduler } from "./monitor";
import {
  createCourtWatchConfig,
  deleteCourtWatchConfig,
  fetchCourtAvailability,
  fetchCourtResources,
  getCourtSchedulerIntervalMinutes,
  getCourtWatchConfigs,
  getLatestCourtAvailability,
  getRecentCourtSnapshots,
  getUpcomingDates,
  isCourtSchedulerRunning,
  runCourtMonitorCycle,
  sendTelegramTestMessage,
  startCourtScheduler,
  stopCourtScheduler,
  updateCourtWatchConfig,
} from "./courtMonitor";
import {
  createTelegramContact,
  deleteTelegramContact,
  getAllTelegramContacts,
  updateTelegramContact,
} from "./db";

// ─── Club Router ──────────────────────────────────────────────────────────────

const clubRouter = router({
  list: publicProcedure.query(() => getAllClubs()),

  addDefault: publicProcedure.mutation(async () => {
    // Add Rivapadel Sport Club as the default club
    return upsertClub({
      tenantId: "da78a74a-43b3-11e8-8674-52540049669c",
      tenantUid: "rivapadel",
      name: "Rivapadel Sport Club",
      city: "Rivas-Vaciamadrid",
      country: "España",
    });
  }),

  syncFromPlaytomic: publicProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ input }) => {
      const club = await upsertClub({ tenantId: input.tenantId, name: "Cargando..." });

      // Fetch lessons and courses from Playtomic
      const [lessons, courses] = await Promise.all([
        fetchLessons(input.tenantId),
        fetchCourses(input.tenantId),
      ]);

      let synced = 0;
      for (const lesson of lessons) {
        const maxPlayers = lesson.max_players || 0;
        const registeredCount = (lesson.registered_players || []).length;
        const availablePlaces = Math.max(0, maxPlayers - registeredCount);
        await upsertCourse({
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
        synced++;
      }
      for (const c of courses) {
        const maxPlayers = c.restrictions_configuration?.max_players || 0;
        const registeredCount = (c.registrations || []).length;
        const availSummary = c.available_places_summary || [];
        const availablePlaces = availSummary.reduce((sum: number, s: { available_places?: number }) => sum + (s.available_places || 0), 0);
        await upsertCourse({
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
        synced++;
      }

      return { synced, lessons: lessons.length, courses: courses.length };
    }),
});

// ─── Courses Router ───────────────────────────────────────────────────────────

const coursesRouter = router({
  byClub: publicProcedure
    .input(z.object({ clubId: z.number() }))
    .query(({ input }) => getCoursesByClub(input.clubId)),

  snapshots: publicProcedure
    .input(z.object({ courseId: z.number(), limit: z.number().optional() }))
    .query(({ input }) => getRecentSnapshots(input.courseId, input.limit)),

  toggleActive: publicProcedure
    .input(z.object({ courseId: z.number(), isActive: z.boolean() }))
    .mutation(({ input }) => toggleCourseActive(input.courseId, input.isActive)),

  delete: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .mutation(({ input }) => deleteCourse(input.courseId)),
});

// ─── Alerts Router ────────────────────────────────────────────────────────────

const alertsRouter = router({
  history: publicProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(({ input }) => getAlertHistoryWithCourse(input.limit ?? 50)),

  configs: publicProcedure.query(() => getAllAlertConfigs()),

  saveConfig: publicProcedure
    .input(
      z.object({
        channel: z.enum(["telegram", "email"]),
        isEnabled: z.boolean(),
        config: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(({ input }) => upsertAlertConfig(input.channel, input.isEnabled, input.config)),
});

// ─── Monitor Router ───────────────────────────────────────────────────────────

const monitorRouter = router({
  settings: publicProcedure.query(() => ensureMonitorSettings()),

  status: publicProcedure.query(async () => {
    const settings = await ensureMonitorSettings();
    return {
      ...settings,
      schedulerRunning: isSchedulerRunning(),
    };
  }),

  runNow: publicProcedure.mutation(async () => {
    return runMonitorCycle();
  }),

  start: publicProcedure
    .input(z.object({ intervalMinutes: z.number().min(1).max(60) }))
    .mutation(async ({ input }) => {
      startScheduler(input.intervalMinutes);
      await upsertAlertConfig("telegram", false, {});
      const settings = await ensureMonitorSettings();
      const { updateMonitorSettings } = await import("./db");
      await updateMonitorSettings({ isRunning: true, intervalMinutes: input.intervalMinutes });
      return { started: true, intervalMinutes: input.intervalMinutes };
    }),

  stop: publicProcedure.mutation(async () => {
    stopScheduler();
    const { updateMonitorSettings } = await import("./db");
    await updateMonitorSettings({ isRunning: false });
    return { stopped: true };
  }),

  updateInterval: publicProcedure
    .input(z.object({ intervalMinutes: z.number().min(1).max(60) }))
    .mutation(async ({ input }) => {
      const { updateMonitorSettings } = await import("./db");
      await updateMonitorSettings({ intervalMinutes: input.intervalMinutes });
      if (isSchedulerRunning()) {
        startScheduler(input.intervalMinutes);
      }
      return { updated: true };
    }),
});

// ─── Courts Router ───────────────────────────────────────────────────────────

const courtsRouter = router({
  /** Listar configuraciones de vigilancia de pistas */
  watchConfigs: publicProcedure
    .input(z.object({ clubId: z.number().optional() }))
    .query(({ input }) => getCourtWatchConfigs(input.clubId)),

  /** Crear nueva configuración de vigilancia */
  createWatch: publicProcedure
    .input(
      z.object({
        clubId: z.number(),
        name: z.string().min(1),
        dayOfWeek: z.number().min(0).max(6),
        startTimeMin: z.string(),
        startTimeMax: z.string(),
        preferredDuration: z.number().optional(),
        sportId: z.string().default("PADEL"),
        weeksAhead: z.number().min(1).max(12).default(4),
      })
    )
    .mutation(({ input }) => createCourtWatchConfig(input)),

  /** Actualizar configuración */
  updateWatch: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        dayOfWeek: z.number().min(0).max(6).optional(),
        startTimeMin: z.string().optional(),
        startTimeMax: z.string().optional(),
        preferredDuration: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
        weeksAhead: z.number().min(1).max(12).optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateCourtWatchConfig(id, data);
    }),

  /** Eliminar configuración */
  deleteWatch: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteCourtWatchConfig(input.id)),

  /** Disponibilidad actual (último ciclo) para una configuración */
  latestAvailability: publicProcedure
    .input(z.object({ watchConfigId: z.number() }))
    .query(({ input }) => getLatestCourtAvailability(input.watchConfigId)),

  /** Historial de snapshots */
  snapshots: publicProcedure
    .input(z.object({ watchConfigId: z.number(), limit: z.number().optional() }))
    .query(({ input }) => getRecentCourtSnapshots(input.watchConfigId, input.limit)),

  /** Ejecutar ciclo de monitorización de pistas ahora */
  runNow: publicProcedure.mutation(() => runCourtMonitorCycle()),

  /** Iniciar scheduler de pistas */
  startScheduler: publicProcedure
    .input(z.object({ intervalMinutes: z.number().min(1).max(60) }))
    .mutation(({ input }) => {
      startCourtScheduler(input.intervalMinutes);
      return { started: true };
    }),

  /** Detener scheduler de pistas */
  stopScheduler: publicProcedure.mutation(() => {
    stopCourtScheduler();
    return { stopped: true };
  }),

  /** Estado del scheduler */
  schedulerStatus: publicProcedure.query(() => ({
    running: isCourtSchedulerRunning(),
  })),

  /** Consulta directa de disponibilidad de pistas en Playtomic para una fecha */
  checkDate: publicProcedure
    .input(
      z.object({
        tenantId: z.string(),
        date: z.string(),
        sportId: z.string().default("PADEL"),
        startTimeMin: z.string().default("18:30"),
        startTimeMax: z.string().default("20:30"),
        preferredDuration: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const [availability, resources] = await Promise.all([
        fetchCourtAvailability(input.tenantId, input.date, input.sportId),
        fetchCourtResources(input.tenantId),
      ]);
      const resourceMap = Object.fromEntries(resources.map((r) => [r.resource_id, r]));

      const slots: {
        courtName: string;
        resourceId: string;
        courtType?: string;
        courtFeature?: string;
        time: string;
        duration: number;
        price: string;
      }[] = [];

      for (const courtAvail of availability) {
        const resource = resourceMap[courtAvail.resource_id];
        if (!resource?.is_active) continue;
        for (const slot of courtAvail.slots) {
          const time = slot.start_time.substring(0, 5);
          if (time < input.startTimeMin || time > input.startTimeMax) continue;
          if (input.preferredDuration && slot.duration !== input.preferredDuration) continue;
          slots.push({
            courtName: resource.name,
            resourceId: courtAvail.resource_id,
            courtType: resource.properties?.resource_type,
            courtFeature: resource.properties?.resource_feature,
            time,
            duration: slot.duration,
            price: slot.price,
          });
        }
      }
      return { date: input.date, slots };
    }),

  /** Próximas fechas para un día de la semana */
  upcomingDates: publicProcedure
    .input(z.object({ dayOfWeek: z.number().min(0).max(6), weeksAhead: z.number().min(1).max(12) }))
    .query(({ input }) => getUpcomingDates(input.dayOfWeek, input.weeksAhead)),

  /** Estado del scheduler con intervalo */
  schedulerStatusFull: publicProcedure.query(() => ({
    running: isCourtSchedulerRunning(),
    intervalMinutes: getCourtSchedulerIntervalMinutes(),
  })),
});

// ─── Telegram Contacts Router ─────────────────────────────────────────────────

const telegramContactsRouter = router({
  list: publicProcedure.query(() => getAllTelegramContacts()),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        chatId: z.string().min(1).max(64),
        notes: z.string().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(({ input }) => createTelegramContact(input)),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        chatId: z.string().min(1).max(64).optional(),
        notes: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateTelegramContact(id, data);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteTelegramContact(input.id)),

  testMessage: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .mutation(({ input }) => sendTelegramTestMessage(input.chatId)),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  clubs: clubRouter,
  courses: coursesRouter,
  alerts: alertsRouter,
  monitor: monitorRouter,
  courts: courtsRouter,
  telegramContacts: telegramContactsRouter,
});

export type AppRouter = typeof appRouter;
