import { trpc } from "@/lib/trpc";
import { Bell, CheckCircle2, XCircle, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

function TelegramIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export default function Alerts() {
  const { data: history, isLoading } = trpc.alerts.history.useQuery({ limit: 100 }, { refetchInterval: 30000 });
  const [channelFilter, setChannelFilter] = useState<"all" | "telegram" | "email">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "failed">("all");

  const filtered = history?.filter((a) => {
    if (channelFilter !== "all" && a.channel !== channelFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  }) ?? [];

  const sentCount = history?.filter((a) => a.status === "sent").length ?? 0;
  const failedCount = history?.filter((a) => a.status === "failed").length ?? 0;
  const telegramCount = history?.filter((a) => a.channel === "telegram").length ?? 0;
  const emailCount = history?.filter((a) => a.channel === "email").length ?? 0;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Historial de Alertas</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {history?.length ?? 0} notificaciones registradas
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Enviadas", value: sentCount, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
          { label: "Fallidas", value: failedCount, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
          { label: "Telegram", value: telegramCount, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "Email", value: emailCount, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn("rounded-xl border p-4", bg)}>
            <p className={cn("text-2xl font-bold font-display", color)}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl p-1">
          {(["all", "telegram", "email"] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                channelFilter === ch
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {ch === "all" ? "Todos" : ch.charAt(0).toUpperCase() + ch.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl p-1">
          {(["all", "sent", "failed"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                statusFilter === st
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {st === "all" ? "Todos" : st === "sent" ? "Enviados" : "Fallidos"}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Bell className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground font-display mb-2">Sin alertas</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Las alertas aparecerán aquí cuando el monitor detecte plazas disponibles en los cursos vigilados.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "bg-card border rounded-xl p-4 flex items-start gap-4 transition-all duration-200",
                alert.status === "sent" ? "border-border" : "border-destructive/20"
              )}
            >
              {/* Channel icon */}
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                alert.channel === "telegram"
                  ? "bg-blue-500/15 text-blue-400"
                  : "bg-yellow-500/15 text-yellow-400"
              )}>
                {alert.channel === "telegram" ? <TelegramIcon /> : <EmailIcon />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {alert.courseName ?? "Curso desconocido"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alert.channel === "telegram" ? "Telegram" : "Email"} ·{" "}
                      {format(new Date(alert.sentAt), "dd MMM yyyy, HH:mm:ss", { locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                      {alert.availablePlaces} plaza{alert.availablePlaces !== 1 ? "s" : ""}
                    </Badge>
                    {alert.status === "sent" ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                </div>

                {/* Message preview */}
                <p className="text-xs text-muted-foreground/70 mt-2 line-clamp-2 bg-muted/30 rounded-lg px-2.5 py-1.5">
                  {alert.message}
                </p>

                {alert.errorMessage && (
                  <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {alert.errorMessage}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
