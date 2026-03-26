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
});

export type AppRouter = typeof appRouter;
