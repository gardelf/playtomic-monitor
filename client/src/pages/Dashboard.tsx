import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Bell,
  CheckCircle2,
  Clock,
  MapPin,
  Play,
  RefreshCw,
  Square,
  TrendingUp,
  Users,
  Zap,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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
  const { data: clubs, isLoading: clubsLoading } = trpc.clubs.list.useQuery();
  const { data: status, isLoading: statusLoading } = trpc.monitor.status.useQuery(undefined, { refetchInterval: 10000 });
  const { data: alertHistory } = trpc.alerts.history.useQuery({ limit: 5 });

  const rivapadel = clubs?.find((c) => c.tenantId === "da78a74a-43b3-11e8-8674-52540049669c");
  const { data: courses } = trpc.courses.byClub.useQuery(
    { clubId: rivapadel?.id ?? 0 },
    { enabled: !!rivapadel }
  );

  const addDefaultClub = trpc.clubs.addDefault.useMutation({
    onSuccess: () => {
      utils.clubs.list.invalidate();
      toast.success("Club añadido correctamente");
    },
  });

  const syncClub = trpc.clubs.syncFromPlaytomic.useMutation({
    onSuccess: (data) => {
      utils.clubs.list.invalidate();
      utils.courses.byClub.invalidate();
      toast.success(`Sincronizado: ${data.synced} cursos/clases encontrados`);
    },
    onError: () => toast.error("Error al sincronizar con Playtomic"),
  });

  const runNow = trpc.monitor.runNow.useMutation({
    onSuccess: (data) => {
      utils.monitor.status.invalidate();
      utils.alerts.history.invalidate();
      utils.courses.byClub.invalidate();
      toast.success(`Comprobación completada: ${data.checked} cursos, ${data.changes} cambios`);
    },
    onError: () => toast.error("Error al ejecutar la comprobación"),
  });

  const startMonitor = trpc.monitor.start.useMutation({
    onSuccess: (data) => {
      utils.monitor.status.invalidate();
      toast.success(`Monitor iniciado (cada ${data.intervalMinutes} min)`);
    },
  });

  const stopMonitor = trpc.monitor.stop.useMutation({
    onSuccess: () => {
      utils.monitor.status.invalidate();
      toast.info("Monitor detenido");
    },
  });

  const activeCourses = courses?.filter((c) => c.isActive) ?? [];
  const coursesWithPlaces = courses?.filter((c) => (c.lastAvailablePlaces ?? 0) > 0) ?? [];
  const recentAlerts = alertHistory?.filter((a) => a.status === "sent") ?? [];

  const handleInitialize = async () => {
    await addDefaultClub.mutateAsync();
    await syncClub.mutateAsync({ tenantId: "da78a74a-43b3-11e8-8674-52540049669c" });
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {status?.lastRunAt
              ? `Última comprobación: ${format(new Date(status.lastRunAt), "dd MMM, HH:mm", { locale: es })}`
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
          {status?.schedulerRunning ? (
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
              onClick={() => startMonitor.mutate({ intervalMinutes: status?.intervalMinutes ?? 5 })}
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
                onClick={handleInitialize}
                disabled={addDefaultClub.isPending || syncClub.isPending}
                className="bg-primary text-primary-foreground"
              >
                <Zap className="w-4 h-4 mr-2" />
                Inicializar club
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncClub.mutate({ tenantId: "da78a74a-43b3-11e8-8674-52540049669c" })}
                disabled={syncClub.isPending}
                className="border-border bg-transparent hover:bg-accent"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 mr-2", syncClub.isPending && "animate-spin")} />
                Sincronizar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Cursos vigilados"
          value={activeCourses.length}
          sub="activos"
          accent="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Con plazas libres"
          value={coursesWithPlaces.length}
          sub="disponibles ahora"
          accent="green"
        />
        <StatCard
          icon={Bell}
          label="Alertas enviadas"
          value={status?.totalAlertssSent ?? 0}
          sub="en total"
          accent="yellow"
        />
        <StatCard
          icon={TrendingUp}
          label="Comprobaciones"
          value={status?.totalChecks ?? 0}
          sub="realizadas"
          accent="blue"
        />
      </div>

      {/* Monitor status + Recent alerts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monitor status */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground font-display mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Estado del monitor
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Estado</span>
              <Badge className={cn(
                "text-xs",
                status?.schedulerRunning
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-muted text-muted-foreground border-border"
              )}>
                {status?.schedulerRunning ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse inline-block" />Activo</>
                ) : "Inactivo"}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Intervalo</span>
              <span className="text-sm font-medium text-foreground">{status?.intervalMinutes ?? 5} minutos</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Última ejecución</span>
              <span className="text-sm font-medium text-foreground">
                {status?.lastRunAt
                  ? format(new Date(status.lastRunAt), "HH:mm:ss", { locale: es })
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Total comprobaciones</span>
              <span className="text-sm font-medium text-foreground">{status?.totalChecks ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Recent alerts */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-foreground font-display mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Alertas recientes
          </h3>
          {recentAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Sin alertas enviadas aún</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Las alertas aparecerán aquí cuando se detecten plazas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                    alert.channel === "telegram" ? "bg-blue-500/15 text-blue-400" : "bg-yellow-500/15 text-yellow-400"
                  )}>
                    {alert.channel === "telegram" ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{alert.courseName ?? "Curso"}</p>
                    <p className="text-xs text-muted-foreground">
                      {alert.availablePlaces} plaza{alert.availablePlaces !== 1 ? "s" : ""} · {format(new Date(alert.sentAt), "dd/MM HH:mm")}
                    </p>
                  </div>
                  <Badge className="text-xs bg-primary/15 text-primary border-primary/25 flex-shrink-0">
                    {alert.availablePlaces}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Courses with available places */}
      {coursesWithPlaces.length > 0 && (
        <div className="bg-card border border-primary/25 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h3 className="font-semibold text-foreground font-display">
              Plazas disponibles ahora
            </h3>
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">{coursesWithPlaces.length}</Badge>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {coursesWithPlaces.map((course) => (
              <div key={course.id} className="bg-primary/5 border border-primary/20 rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{course.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{course.courseType}</p>
                  </div>
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-xs flex-shrink-0">
                    {course.lastAvailablePlaces} libre{(course.lastAvailablePlaces ?? 0) !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span>{course.lastRegisteredCount}/{course.maxPlayers} inscritos</span>
                  {course.lastCheckedAt && (
                    <>
                      <span className="mx-1">·</span>
                      <Clock className="w-3 h-3" />
                      <span>{format(new Date(course.lastCheckedAt), "HH:mm")}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
