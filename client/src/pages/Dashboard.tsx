import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Clock,
  MapPin,
  Play,
  RefreshCw,
  Square,
  TrendingUp,
  Zap,
  Grid3X3,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "red" | "yellow" | "blue";
}) {
  const colors = {
    green: "text-primary bg-primary/10 border-primary/20",
    red: "text-destructive bg-destructive/10 border-destructive/20",
    yellow: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    blue: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  };
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0", accent ? colors[accent] : "text-muted-foreground bg-muted/50 border-border")}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground font-display">{value}</p>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const utils = trpc.useUtils();
  const { data: clubs } = trpc.clubs.list.useQuery();
  const { data: courtStatus } = trpc.courts.schedulerStatusFull.useQuery(undefined, { refetchInterval: 10000 });
  const { data: activityStats } = trpc.activity.stats.useQuery(undefined, { refetchInterval: 30000 });
  const { data: recentRuns } = trpc.activity.list.useQuery({ limit: 5 }, { refetchInterval: 15000 });

  const rivapadel = clubs?.find((c) => c.tenantId === "da78a74a-43b3-11e8-8674-52540049669c");

  const addDefaultClub = trpc.clubs.addDefault.useMutation({
    onSuccess: () => {
      utils.clubs.list.invalidate();
      toast.success("Club añadido correctamente");
    },
  });

  const runNow = trpc.courts.runNow.useMutation({
    onSuccess: (data: { slotsFound?: number; newSlotsFound?: number; alertsSent?: number }) => {
      utils.courts.schedulerStatusFull.invalidate();
      utils.activity.list.invalidate();
      utils.activity.stats.invalidate();
      toast.success(`Comprobación completada: ${data.slotsFound ?? 0} slots encontrados`);
    },
    onError: () => toast.error("Error al ejecutar la comprobación"),
  });

  const startMonitor = trpc.courts.startScheduler.useMutation({
    onSuccess: (_data: { started: boolean }) => {
      utils.courts.schedulerStatusFull.invalidate();
      toast.success(`Monitor iniciado (cada ${courtStatus?.intervalMinutes ?? 5} min)`);
    },
  });

  const stopMonitor = trpc.courts.stopScheduler.useMutation({
    onSuccess: () => {
      utils.courts.schedulerStatusFull.invalidate();
      toast.info("Monitor detenido");
    },
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {recentRuns && recentRuns.length > 0
              ? `Última comprobación: ${format(new Date(recentRuns[0].startedAt), "dd MMM, HH:mm", { locale: es })}`
              : "Sin comprobaciones aún"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending}
            className="border-border bg-card hover:bg-accent"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", runNow.isPending && "animate-spin")} />
            Comprobar ahora
          </Button>
          {courtStatus?.running ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => stopMonitor.mutate()}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <Square className="w-4 h-4 mr-2" />
              Detener
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => startMonitor.mutate({ intervalMinutes: courtStatus?.intervalMinutes ?? 5 })}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Play className="w-4 h-4 mr-2" />
              Iniciar monitor
            </Button>
          )}
        </div>
      </div>

      {/* Club Card */}
      <div className="relative overflow-hidden bg-card border border-border rounded-2xl p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-foreground font-display">Rivapadel Sport Club</h2>
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Club principal</Badge>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-muted-foreground text-sm">
              <MapPin className="w-3.5 h-3.5" />
              <span>Rivas-Vaciamadrid, Madrid, España</span>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
              ID: da78a74a-43b3-11e8-8674-52540049669c
            </p>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            {!rivapadel ? (
              <Button
                size="sm"
                onClick={() => addDefaultClub.mutate()}
                disabled={addDefaultClub.isPending}
                className="bg-primary text-primary-foreground"
              >
                <Zap className="w-4 h-4 mr-2" />
                Inicializar club
              </Button>
            ) : (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Club activo
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Grid3X3}
          label="Ciclos ejecutados"
          value={activityStats?.totalRuns ?? 0}
          sub="comprobaciones"
          accent="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Slots detectados"
          value={activityStats?.totalSlotsFound ?? 0}
          sub="en total"
          accent="green"
        />
        <StatCard
          icon={Bell}
          label="Alertas enviadas"
          value={activityStats?.totalAlertsSent ?? 0}
          sub="notificaciones"
          accent="yellow"
        />
        <StatCard
          icon={TrendingUp}
          label="Ciclos ejecutados"
          value={activityStats?.totalRuns ?? 0}
          sub={`${activityStats?.successRate ?? 0}% éxito`}
          accent="blue"
        />
      </div>

      {/* Monitor status + Recent activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monitor status */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground font-display mb-4 flex items-center gap-2">
            <Grid3X3 className="w-4 h-4 text-primary" />
            Estado del monitor
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Estado</span>
              <Badge className={cn(
                "text-xs",
                courtStatus?.running
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-muted text-muted-foreground border-border"
              )}>
                {courtStatus?.running ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse inline-block" />Activo</>
                ) : "Inactivo"}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Intervalo</span>
              <span className="text-sm font-medium text-foreground">{courtStatus?.intervalMinutes ?? 5} minutos</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Última ejecución</span>
              <span className="text-sm font-medium text-foreground">
                {recentRuns && recentRuns.length > 0
                  ? format(new Date(recentRuns[0].startedAt), "HH:mm:ss", { locale: es })
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Tasa de éxito</span>
              <span className="text-sm font-medium text-foreground">{activityStats?.successRate ?? 0}%</span>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground font-display mb-4 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Actividad reciente
          </h3>
          {!recentRuns || recentRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <ClipboardList className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Sin actividad todavía</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Los ciclos del monitor aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <div key={run.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    run.status === "ok" ? "bg-emerald-400" :
                    run.status === "error" ? "bg-red-400" : "bg-blue-400 animate-pulse"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true, locale: es })}
                    </p>
                    <p className="text-xs text-muted-foreground/60 truncate">{run.notes ?? "—"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {run.newSlotsFound > 0 && (
                      <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                        +{run.newSlotsFound} nuevos
                      </Badge>
                    )}
                    {run.alertsSent > 0 && (
                      <p className="text-xs text-amber-400 mt-0.5">{run.alertsSent} alertas</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
