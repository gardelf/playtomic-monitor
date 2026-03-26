import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("./db", () => ({
  getAlertConfig: vi.fn(),
  insertAlert: vi.fn(),
}));

import axios from "axios";
import {
  fetchCourtAvailability,
  fetchCourtResources,
  getUpcomingDates,
  isCourtSchedulerRunning,
  startCourtScheduler,
  stopCourtScheduler,
} from "./courtMonitor";

describe("getUpcomingDates", () => {
  it("returns the correct number of dates", () => {
    const dates = getUpcomingDates(3, 4); // miércoles, 4 semanas
    expect(dates).toHaveLength(4);
  });

  it("all returned dates are on the correct day of week", () => {
    const dates = getUpcomingDates(3, 4); // miércoles = 3
    for (const d of dates) {
      const [y, m, day] = d.split("-").map(Number);
      const date = new Date(y!, m! - 1, day!);
      expect(date.getDay()).toBe(3);
    }
  });

  it("all dates are in the future", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = getUpcomingDates(1, 3); // lunes
    for (const d of dates) {
      const [y, m, day] = d.split("-").map(Number);
      const date = new Date(y!, m! - 1, day!);
      expect(date.getTime()).toBeGreaterThan(today.getTime());
    }
  });

  it("returns no duplicates", () => {
    const dates = getUpcomingDates(5, 6);
    const unique = new Set(dates);
    expect(unique.size).toBe(dates.length);
  });

  it("returns correct format YYYY-MM-DD", () => {
    const dates = getUpcomingDates(3, 2);
    for (const d of dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("fetchCourtAvailability", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns availability array on success", async () => {
    const mockData = [
      {
        resource_id: "abc-123",
        start_date: "2026-04-02",
        slots: [
          { start_time: "18:30:00", duration: 90, price: "31.20 EUR" },
          { start_time: "19:00:00", duration: 60, price: "20.80 EUR" },
        ],
      },
    ];
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockData });

    const result = await fetchCourtAvailability("tenant-123", "2026-04-02");

    expect(result).toHaveLength(1);
    expect(result[0]?.resource_id).toBe("abc-123");
    expect(result[0]?.slots).toHaveLength(2);
  });

  it("returns empty array on API error", async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchCourtAvailability("tenant-123", "2026-04-02");

    expect(result).toEqual([]);
  });

  it("returns empty array when response is not an array", async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { error: "not found" } });

    const result = await fetchCourtAvailability("tenant-123", "2026-04-02");

    expect(result).toEqual([]);
  });
});

describe("fetchCourtResources", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns resources array on success", async () => {
    const mockResources = [
      {
        resource_id: "res-001",
        name: "Padel 1",
        sport_id: "PADEL",
        is_active: true,
        properties: { resource_type: "indoor", resource_feature: "crystal" },
      },
      {
        resource_id: "res-002",
        name: "Padel 2",
        sport_id: "PADEL",
        is_active: false,
        properties: { resource_type: "outdoor", resource_feature: "panoramic" },
      },
    ];
    (axios.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockResources });

    const result = await fetchCourtResources("tenant-123");

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("Padel 1");
    expect(result[1]?.is_active).toBe(false);
  });

  it("returns empty array on API error", async () => {
    (axios.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Timeout"));

    const result = await fetchCourtResources("tenant-123");

    expect(result).toEqual([]);
  });
});

describe("slot time filtering logic", () => {
  it("correctly filters slots within time range", () => {
    const slots = [
      { start_time: "17:00:00", duration: 90, price: "20 EUR" },
      { start_time: "18:30:00", duration: 90, price: "31 EUR" },
      { start_time: "19:00:00", duration: 60, price: "20 EUR" },
      { start_time: "20:00:00", duration: 60, price: "20 EUR" },
      { start_time: "20:30:00", duration: 60, price: "20 EUR" },
      { start_time: "21:00:00", duration: 60, price: "20 EUR" },
    ];

    const startTimeMin = "18:30";
    const startTimeMax = "20:30";

    const filtered = slots.filter((slot) => {
      const time = slot.start_time.substring(0, 5);
      return time >= startTimeMin && time <= startTimeMax;
    });

    expect(filtered).toHaveLength(4);
    expect(filtered[0]?.start_time).toBe("18:30:00");
    expect(filtered[3]?.start_time).toBe("20:30:00");
  });

  it("filters by preferred duration", () => {
    const slots = [
      { start_time: "18:30:00", duration: 60, price: "20 EUR" },
      { start_time: "18:30:00", duration: 90, price: "31 EUR" },
      { start_time: "18:30:00", duration: 120, price: "41 EUR" },
    ];

    const preferredDuration = 90;
    const filtered = slots.filter((s) => s.duration === preferredDuration);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.duration).toBe(90);
  });
});

describe("court scheduler", () => {
  beforeEach(() => {
    stopCourtScheduler();
    vi.clearAllMocks();
  });

  it("isCourtSchedulerRunning returns false initially", () => {
    expect(isCourtSchedulerRunning()).toBe(false);
  });

  it("isCourtSchedulerRunning returns true after startCourtScheduler", () => {
    startCourtScheduler(60);
    expect(isCourtSchedulerRunning()).toBe(true);
    stopCourtScheduler();
  });

  it("isCourtSchedulerRunning returns false after stopCourtScheduler", () => {
    startCourtScheduler(60);
    stopCourtScheduler();
    expect(isCourtSchedulerRunning()).toBe(false);
  });

  it("stopCourtScheduler is safe when not running", () => {
    expect(() => stopCourtScheduler()).not.toThrow();
    expect(isCourtSchedulerRunning()).toBe(false);
  });
});
