import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  CalendarDays,
  Bell,
  BarChart3,
  RefreshCw,
  Zap,
  TrendingUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type MonitorRun = {
  id: number;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  datesChecked: string | null;
  slotsFound: number;
  newSlotsFound: number;
  alertsSent: number;
  triggeredBy: "scheduler" | "manual";
  status: "ok" | "error" | "running";
  errorMessage: string | null;
  notes: string | null;
};

function StatusBadge({ status }: { status: MonitorRun["status"] }) {
  if (status === "ok")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 gap-1 text-xs">
        <CheckCircle2 className="w-3 h-3" /> OK
      </Badge>
    );
  if (status === "error")
    return (
      <Badge className="bg-red-500/15 text-red-400 border-red-500/20 gap-1 text-xs">
        <XCircle className="w-3 h-3" /> Error
      </Badge>
    );
  return (
    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20 gap-1 text-xs">
      <Loader2 className="w-3 h-3 animate-spin" /> Ejecutando
    </Badge>
  );
}

function TriggerBadge({ triggeredBy }: { triggeredBy: MonitorRun["triggeredBy"] }) {
  if (triggeredBy === "manual")
    return (
      <Badge variant="outline" className="text-xs gap-1 text-amber-400 border-amber-400/30">
        <Zap className="w-3 h-3" /> Manual
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
      <Clock className="w-3 h-3" /> Auto
    </Badge>
  );
}

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ActivityPage() {
  const [limit, setLimit] = useState(50);
  const utils = trpc.useUtils();

  const { data: runs = [], isLoading, refetch } = trpc.activity.list.useQuery(
    { limit },
    { refetchInterval: 15000 }
  );
  const { data: stats } = trpc.activity.stats.useQuery(undefined, { refetchInterval: 15000 });

  const lastRun = runs[0];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registro de Actividad</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Historial completo de ejecuciones del monitor de pistas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-primary/60" />
              <span className="text-xs text-muted-foreground">Total ciclos</span>
            </div>
            <p className="text-2xl font-bold">{stats?.totalRuns ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500/60" />
              <span className="text-xs text-muted-foreground">Tasa de éxito</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{stats?.successRate ?? 0}%</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="w-4 h-4 text-blue-500/60" />
              <span className="text-xs text-muted-foreground">Slots encontrados</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{stats?.totalSlotsFound ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-amber-500/60" />
              <span className="text-xs text-muted-foreground">Alertas enviadas</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{stats?.totalAlertsSent ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Last run highlight */}
      {lastRun && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4 flex-wrap">
            <Activity className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Última ejecución:{" "}
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(lastRun.startedAt), { addSuffix: true, locale: es })}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lastRun.notes ?? "Sin notas"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={lastRun.status} />
              <TriggerBadge triggeredBy={lastRun.triggeredBy} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Cargando registros...
        </div>
      ) : runs.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-16 text-center">
            <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay registros todavía</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Los ciclos del monitor aparecerán aquí cuando se ejecuten
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_80px_90px_80px] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Fecha / Hora</span>
            <span>Estado</span>
            <span>Origen</span>
            <span className="text-right">Slots</span>
            <span className="text-right">Nuevos</span>
            <span className="text-right">Alertas</span>
            <span className="text-right">Duración</span>
          </div>

          {runs.map((run) => {
            const dates: string[] = run.datesChecked ? JSON.parse(run.datesChecked) : [];
            return (
              <div
                key={run.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px_80px_80px_90px_80px] gap-2 sm:gap-3 items-center px-4 py-3 rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 transition-colors"
              >
                {/* Date */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(run.startedAt), "dd MMM yyyy · HH:mm:ss", { locale: es })}
                  </p>
                  {run.notes && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{run.notes}</p>
                  )}
                  {run.errorMessage && (
                    <p className="text-xs text-red-400 truncate mt-0.5">{run.errorMessage}</p>
                  )}
                  {dates.length > 0 && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      Fechas: {dates.slice(0, 3).join(", ")}{dates.length > 3 ? ` +${dates.length - 3}` : ""}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="sm:justify-self-start">
                  <StatusBadge status={run.status} />
                </div>

                {/* Trigger */}
                <div className="sm:justify-self-start">
                  <TriggerBadge triggeredBy={run.triggeredBy} />
                </div>

                {/* Slots found */}
                <div className="sm:text-right">
                  <span className={`text-sm font-semibold ${run.slotsFound > 0 ? "text-blue-400" : "text-muted-foreground"}`}>
                    {run.slotsFound}
                  </span>
                  <span className="text-xs text-muted-foreground sm:hidden"> slots</span>
                </div>

                {/* New slots */}
                <div className="sm:text-right">
                  <span className={`text-sm font-semibold ${run.newSlotsFound > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {run.newSlotsFound}
                  </span>
                  <span className="text-xs text-muted-foreground sm:hidden"> nuevos</span>
                </div>

                {/* Alerts */}
                <div className="sm:text-right">
                  <span className={`text-sm font-semibold ${run.alertsSent > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
                    {run.alertsSent}
                  </span>
                  <span className="text-xs text-muted-foreground sm:hidden"> alertas</span>
                </div>

                {/* Duration */}
                <div className="sm:text-right">
                  <span className="text-sm text-muted-foreground font-mono">
                    {formatDuration(run.durationMs)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Load more */}
          {runs.length >= limit && (
            <div className="text-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLimit((l) => l + 100)}
                className="text-muted-foreground"
              >
                Cargar más registros
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
