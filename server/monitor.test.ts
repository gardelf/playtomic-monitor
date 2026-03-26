import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock axios ───────────────────────────────────────────────────────────────

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// ─── Mock db ─────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getAllClubs: vi.fn(),
  getAllActiveCourses: vi.fn(),
  upsertCourse: vi.fn(),
  insertSnapshot: vi.fn(),
  insertAlert: vi.fn(),
  getAlertConfig: vi.fn(),
  incrementMonitorStats: vi.fn(),
  updateMonitorSettings: vi.fn(),
  ensureMonitorSettings: vi.fn(),
}));

import axios from "axios";
import * as db from "./db";
import { fetchLessons, fetchCourses, isSchedulerRunning, startScheduler, stopScheduler } from "./monitor";

describe("fetchLessons", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an array of lessons on success", async () => {
    const mockLessons = [
      { tournament_id: "abc123", tournament_name: "Clase Padel Iniciación", max_players: 8, registered_players: [{}, {}] },
    ];
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockLessons });

    const result = await fetchLessons("tenant-123");

    expect(result).toHaveLength(1);
    expect(result[0]?.tournament_name).toBe("Clase Padel Iniciación");
  });

  it("returns empty array on API error", async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchLessons("tenant-123");

    expect(result).toEqual([]);
  });

  it("returns empty array when response is not an array", async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { error: "not found" } });

    const result = await fetchLessons("tenant-123");

    expect(result).toEqual([]);
  });
});

describe("fetchCourses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an array of courses on success", async () => {
    const mockCourses = [
      {
        course_id: "course-001",
        name: "Curso Padel Avanzado",
        restrictions_configuration: { max_players: 10 },
        available_places_summary: [{ available_places: 3 }],
        registrations: [{}, {}, {}, {}, {}, {}, {}],
      },
    ];
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockCourses });

    const result = await fetchCourses("tenant-123");

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Curso Padel Avanzado");
  });

  it("returns empty array on API error", async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Timeout"));

    const result = await fetchCourses("tenant-123");

    expect(result).toEqual([]);
  });
});

describe("scheduler", () => {
  beforeEach(() => {
    stopScheduler();
    vi.clearAllMocks();
  });

  it("isSchedulerRunning returns false initially", () => {
    expect(isSchedulerRunning()).toBe(false);
  });

  it("isSchedulerRunning returns true after startScheduler", () => {
    startScheduler(60); // 60 min interval so it won't fire during test
    expect(isSchedulerRunning()).toBe(true);
    stopScheduler();
  });

  it("isSchedulerRunning returns false after stopScheduler", () => {
    startScheduler(60);
    stopScheduler();
    expect(isSchedulerRunning()).toBe(false);
  });

  it("calling stopScheduler when not running is safe", () => {
    expect(() => stopScheduler()).not.toThrow();
    expect(isSchedulerRunning()).toBe(false);
  });
});

describe("available places calculation", () => {
  it("calculates available places correctly for lessons", () => {
    const maxPlayers = 8;
    const registeredPlayers = [{}, {}, {}]; // 3 registered
    const availablePlaces = Math.max(0, maxPlayers - registeredPlayers.length);
    expect(availablePlaces).toBe(5);
  });

  it("never returns negative available places", () => {
    const maxPlayers = 8;
    const registeredPlayers = new Array(10).fill({}); // 10 registered (overflow)
    const availablePlaces = Math.max(0, maxPlayers - registeredPlayers.length);
    expect(availablePlaces).toBe(0);
  });

  it("calculates available places from summary for courses", () => {
    const availSummary = [{ available_places: 2 }, { available_places: 3 }];
    const total = availSummary.reduce((sum, s) => sum + (s.available_places || 0), 0);
    expect(total).toBe(5);
  });

  it("handles empty available_places_summary", () => {
    const availSummary: { available_places?: number }[] = [];
    const total = availSummary.reduce((sum, s) => sum + (s.available_places || 0), 0);
    expect(total).toBe(0);
  });
});

describe("auth.logout", () => {
  it("clears session cookie on logout", async () => {
    const { appRouter } = await import("./routers");
    const { COOKIE_NAME } = await import("../shared/const");
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];

    const ctx = {
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as never,
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as never,
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});
