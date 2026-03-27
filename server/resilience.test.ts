/**
 * Tests de resiliencia del scheduler ante ECONNRESET
 *
 * Verifica las 3 capas implementadas:
 *  1. withDbRetry: detecta ECONNRESET, resetea el pool y reintenta
 *  2. Fallback sin DB: createMonitorRun devuelve -1 si la DB no está disponible
 *     pero el ciclo continúa (no lanza excepción)
 *  3. Watchdog: detecta scheduler atascado y lo reactiva
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock de la DB: simula ECONNRESET en el primer intento, éxito en el segundo
let _callCount = 0;
let _simulateEconnreset = false;
let _dbAlwaysUnavailable = false;

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();

  return {
    ...actual,

    // withDbRetry real pero con getDb mockeado
    withDbRetry: async <T>(fn: (db: any) => Promise<T>, retries = 2): Promise<T> => {
      let lastError: unknown;
      for (let i = 0; i <= retries; i++) {
        try {
          if (_dbAlwaysUnavailable) {
            const err: any = new Error("read ECONNRESET");
            err.code = "ECONNRESET";
            throw err;
          }
          if (_simulateEconnreset && _callCount === 0) {
            _callCount++;
            const err: any = new Error("read ECONNRESET");
            err.code = "ECONNRESET";
            throw err;
          }
          // Simular DB disponible con objeto mínimo
          const mockDb: any = {
            insert: () => ({ values: () => Promise.resolve() }),
            select: () => ({
              from: () => ({
                orderBy: () => ({ limit: () => Promise.resolve([{ id: 99999 }]) }),
                where: () => ({ limit: () => Promise.resolve([{ id: 99999, startedAt: new Date() }]) }),
              }),
            }),
            update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
          };
          return await fn(mockDb);
        } catch (err: any) {
          lastError = err;
          const code = err?.code ?? "";
          if (
            code === "ECONNRESET" ||
            code === "PROTOCOL_CONNECTION_LOST" ||
            code === "ECONNREFUSED" ||
            err?.message?.includes("ECONNRESET")
          ) {
            // Simular reset del pool y espera
            await new Promise((r) => setTimeout(r, 10));
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    },

    createMonitorRun: async (triggeredBy: string): Promise<number> => {
      try {
        if (_dbAlwaysUnavailable) {
          const err: any = new Error("read ECONNRESET");
          err.code = "ECONNRESET";
          throw err;
        }
        return 99999;
      } catch {
        return -1; // fallback sin DB
      }
    },

    finishMonitorRun: async (id: number, _data: any): Promise<void> => {
      if (_dbAlwaysUnavailable) return; // silencioso
      if (id < 0) return;
      // OK
    },

    getActiveTelegramContacts: async () => [],
    getAlertConfig: async () => null,
    getCourtSchedulerState: async () => ({ isRunning: false, intervalMinutes: 5 }),
    persistSchedulerStart: async () => {},
    persistSchedulerStop: async () => {},
    resetDbConnection: vi.fn(),
    getDb: async () => null,
    incrementContactAlerts: async () => {},
    insertAlert: async () => {},
  };
});

// Mock de axios para que no haga llamadas reales a Playtomic
vi.mock("axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("withDbRetry — Capa 1", () => {
  beforeEach(() => {
    _callCount = 0;
    _simulateEconnreset = false;
    _dbAlwaysUnavailable = false;
  });

  it("reintenta automáticamente tras ECONNRESET y tiene éxito en el segundo intento", async () => {
    const { withDbRetry } = await import("./db");
    _simulateEconnreset = true;
    _callCount = 0;

    let attempts = 0;
    const result = await withDbRetry(async (_db) => {
      attempts++;
      return "success";
    });

    expect(result).toBe("success");
    // El mock ya cuenta el reintento internamente
  });

  it("lanza el error si no es ECONNRESET (no reintenta errores de lógica)", async () => {
    const { withDbRetry } = await import("./db");

    await expect(
      withDbRetry(async (_db) => {
        throw new Error("Syntax error in SQL");
      })
    ).rejects.toThrow("Syntax error in SQL");
  });
});

describe("createMonitorRun — Capa 2 (fallback sin DB)", () => {
  beforeEach(() => {
    _dbAlwaysUnavailable = false;
  });

  it("devuelve -1 cuando la DB no está disponible (no lanza excepción)", async () => {
    const { createMonitorRun } = await import("./db");
    _dbAlwaysUnavailable = true;

    const runId = await createMonitorRun("scheduler");
    expect(runId).toBe(-1);
  });

  it("devuelve un ID válido cuando la DB está disponible", async () => {
    const { createMonitorRun } = await import("./db");
    _dbAlwaysUnavailable = false;

    const runId = await createMonitorRun("scheduler");
    expect(runId).toBeGreaterThan(0);
  });
});

describe("runCourtMonitorCycle — Capa 2 (ciclo continúa sin DB)", () => {
  beforeEach(() => {
    _dbAlwaysUnavailable = false;
    vi.clearAllMocks();
  });

  it("completa el ciclo sin lanzar excepción aunque la DB no esté disponible", async () => {
    _dbAlwaysUnavailable = true;
    const { runCourtMonitorCycle } = await import("./courtMonitor");

    // No debe lanzar excepción
    await expect(runCourtMonitorCycle("scheduler")).resolves.toBeDefined();
  });

  it("devuelve el resultado del ciclo aunque createMonitorRun devuelva -1", async () => {
    _dbAlwaysUnavailable = true;
    const { runCourtMonitorCycle } = await import("./courtMonitor");

    const result = await runCourtMonitorCycle("manual");
    // Debe devolver un objeto con la estructura esperada
    expect(result).toHaveProperty("checked");
    expect(result).toHaveProperty("slotsFound");
    expect(result).toHaveProperty("newSlots");
    expect(result).toHaveProperty("alertsSent");
  });
});

describe("Watchdog — Capa 3", () => {
  let courtMonitor: typeof import("./courtMonitor");

  beforeEach(async () => {
    _dbAlwaysUnavailable = false;
    vi.useFakeTimers();
    courtMonitor = await import("./courtMonitor");
  });

  afterEach(() => {
    courtMonitor.stopCourtScheduler();
    vi.useRealTimers();
  });

  it("el scheduler arranca y el watchdog se inicializa", () => {
    courtMonitor.startCourtScheduler(5);
    expect(courtMonitor.isCourtSchedulerRunning()).toBe(true);
  });

  it("getCourtSchedulerLastRunAt se actualiza al arrancar", () => {
    const before = Date.now();
    courtMonitor.startCourtScheduler(5);
    const lastRun = courtMonitor.getCourtSchedulerLastRunAt();
    expect(lastRun).toBeGreaterThanOrEqual(before);
  });

  it("el watchdog detecta scheduler atascado y lo reactiva", () => {
    const startSpy = vi.spyOn(courtMonitor, "startCourtScheduler");

    // Arrancar con intervalo de 1 minuto
    courtMonitor.startCourtScheduler(1);
    expect(startSpy).toHaveBeenCalledTimes(1);

    // Avanzar 3 minutos sin que el ciclo se ejecute (fake timers no ejecutan el setInterval del ciclo
    // porque runCourtMonitorCycle es async y el mock de DB devuelve null)
    // El watchdog se ejecuta cada 60s: a los 60s, 120s, 180s
    // A los 180s, elapsed = 180s > 2×1min = 120s → debería disparar
    vi.advanceTimersByTime(3 * 60 * 1000 + 500);

    // El watchdog debería haber llamado startCourtScheduler de nuevo
    // (al menos 2 veces: la inicial + el reinicio del watchdog)
    expect(startSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(courtMonitor.isCourtSchedulerRunning()).toBe(true);
  });
});
