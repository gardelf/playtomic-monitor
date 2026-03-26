import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Users,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function PlacesBadge({ available, max }: { available: number; max: number }) {
  if (available === 0) {
    return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">Completo</Badge>;
  }
  if (available <= 2) {
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">{available} plaza{available !== 1 ? "s" : ""}</Badge>;
  }
  return <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">{available} plazas</Badge>;
}

function CourseRow({ course, onToggle, onDelete }: {
  course: {
    id: number;
    name: string;
    courseType: "lesson" | "course";
    isActive: boolean;
    maxPlayers: number | null;
    lastAvailablePlaces: number | null;
    lastRegisteredCount: number | null;
    lastCheckedAt: Date | null;
    startDate: Date | null;
    description: string | null;
  };
  onToggle: (id: number, active: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: snapshots } = trpc.courses.snapshots.useQuery(
    { courseId: course.id, limit: 5 },
    { enabled: expanded }
  );

  const available = course.lastAvailablePlaces ?? 0;
  const max = course.maxPlayers ?? 0;
  const registered = course.lastRegisteredCount ?? 0;
  const pct = max > 0 ? Math.round((registered / max) * 100) : 0;

  return (
    <div className={cn(
      "bg-card border rounded-xl overflow-hidden transition-all duration-200",
      !course.isActive && "opacity-50",
      available > 0 ? "border-primary/25" : "border-border"
    )}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
            course.courseType === "lesson"
              ? "bg-blue-500/15 text-blue-400"
              : "bg-purple-500/15 text-purple-400"
          )}>
            {course.courseType === "lesson" ? <Activity className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm leading-tight">{course.name}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">
                  {course.courseType === "lesson" ? "Clase" : "Curso"}
                  {course.startDate && ` · ${format(new Date(course.startDate), "dd MMM yyyy", { locale: es })}`}
                </p>
              </div>
              <PlacesBadge available={available} max={max} />
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {registered}/{max} inscritos
                </span>
                {course.lastCheckedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(course.lastCheckedAt), "HH:mm:ss")}
                  </span>
                )}
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    pct >= 100 ? "bg-destructive" : pct >= 75 ? "bg-yellow-400" : "bg-primary"
                  )}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Ocultar historial" : "Ver historial"}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggle(course.id, !course.isActive)}
              className={cn(
                "text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded-lg",
                course.isActive
                  ? "text-muted-foreground hover:text-foreground hover:bg-accent"
                  : "text-primary hover:bg-primary/10"
              )}
            >
              {course.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {course.isActive ? "Desactivar" : "Activar"}
            </button>
            <button
              onClick={() => onDelete(course.id)}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Snapshots */}
      {expanded && (
        <div className="border-t border-border/50 bg-muted/20 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Últimas comprobaciones</p>
          {!snapshots || snapshots.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">Sin historial aún</p>
          ) : (
            <div className="space-y-1.5">
              {snapshots.map((snap) => (
                <div key={snap.id} className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground/60 w-16 flex-shrink-0">
                    {format(new Date(snap.checkedAt), "HH:mm:ss")}
                  </span>
                  {snap.isChangeDetected ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <span className={cn(
                    "font-medium",
                    snap.availablePlaces > 0 ? "text-primary" : "text-muted-foreground"
                  )}>
                    {snap.availablePlaces} plazas libres
                  </span>
                  <span className="text-muted-foreground/60">
                    ({snap.registeredCount}/{snap.maxPlayers})
                  </span>
                  {snap.isChangeDetected && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs ml-auto">¡Cambio!</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Monitor() {
  const utils = trpc.useUtils();
  const { data: clubs } = trpc.clubs.list.useQuery();
  const rivapadel = clubs?.find((c) => c.tenantId === "da78a74a-43b3-11e8-8674-52540049669c");

  const { data: courses, isLoading } = trpc.courses.byClub.useQuery(
    { clubId: rivapadel?.id ?? 0 },
    { enabled: !!rivapadel, refetchInterval: 30000 }
  );

  const { data: status } = trpc.monitor.status.useQuery(undefined, { refetchInterval: 10000 });

  const syncClub = trpc.clubs.syncFromPlaytomic.useMutation({
    onSuccess: (data) => {
      utils.courses.byClub.invalidate();
      toast.success(`Sincronizado: ${data.synced} cursos/clases`);
    },
    onError: () => toast.error("Error al sincronizar"),
  });

  const runNow = trpc.monitor.runNow.useMutation({
    onSuccess: (data) => {
      utils.monitor.status.invalidate();
      utils.courses.byClub.invalidate();
      toast.success(`${data.checked} cursos comprobados, ${data.changes} cambios detectados`);
    },
    onError: () => toast.error("Error al ejecutar comprobación"),
  });

  const toggleActive = trpc.courses.toggleActive.useMutation({
    onSuccess: () => utils.courses.byClub.invalidate(),
    onError: () => toast.error("Error al cambiar estado"),
  });

  const deleteCourse = trpc.courses.delete.useMutation({
    onSuccess: () => {
      utils.courses.byClub.invalidate();
      toast.success("Curso eliminado");
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const [filter, setFilter] = useState<"all" | "available" | "full" | "inactive">("all");

  const filteredCourses = courses?.filter((c) => {
    if (filter === "available") return (c.lastAvailablePlaces ?? 0) > 0 && c.isActive;
    if (filter === "full") return (c.lastAvailablePlaces ?? 0) === 0 && c.isActive;
    if (filter === "inactive") return !c.isActive;
    return true;
  }) ?? [];

  const availableCount = courses?.filter((c) => (c.lastAvailablePlaces ?? 0) > 0 && c.isActive).length ?? 0;
  const fullCount = courses?.filter((c) => (c.lastAvailablePlaces ?? 0) === 0 && c.isActive).length ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Monitorización</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {courses?.length ?? 0} cursos/clases · {status?.schedulerRunning ? `Activo (c/${status.intervalMinutes}min)` : "Monitor inactivo"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncClub.mutate({ tenantId: "da78a74a-43b3-11e8-8674-52540049669c" })}
            disabled={syncClub.isPending || !rivapadel}
            className="border-border bg-card hover:bg-accent"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", syncClub.isPending && "animate-spin")} />
            Sincronizar
          </Button>
          <Button
            size="sm"
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Activity className={cn("w-4 h-4 mr-2", runNow.isPending && "animate-spin")} />
            Comprobar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: "all", label: "Todos", count: courses?.length ?? 0 },
          { key: "available", label: "Con plazas", count: availableCount },
          { key: "full", label: "Completos", count: fullCount },
          { key: "inactive", label: "Inactivos", count: courses?.filter((c) => !c.isActive).length ?? 0 },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key as typeof filter)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2",
              filter === key
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {label}
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded-md",
              filter === key ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Course list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !rivapadel ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground font-display mb-2">Club no inicializado</h3>
          <p className="text-sm text-muted-foreground mb-4">Ve al Dashboard para inicializar Rivapadel Sport Club</p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground font-display mb-2">Sin resultados</h3>
          <p className="text-sm text-muted-foreground">No hay cursos en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCourses.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              onToggle={(id, active) => toggleActive.mutate({ courseId: id, isActive: active })}
              onDelete={(id) => deleteCourse.mutate({ courseId: id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
