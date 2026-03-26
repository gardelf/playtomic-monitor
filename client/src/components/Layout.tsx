import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  Activity,
  Bell,
  Settings,
  Menu,
  X,
  Radio,
  ChevronRight,
  Zap,
  Grid3X3,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courts", label: "Pistas", icon: Grid3X3 },
  { href: "/contacts", label: "Contactos", icon: Users },
  { href: "/monitor", label: "Cursos", icon: Activity },
  { href: "/alerts", label: "Alertas", icon: Bell },
  { href: "/settings", label: "Configuración", icon: Settings },
];

function Sidebar({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { data: status } = trpc.monitor.status.useQuery(undefined, { refetchInterval: 10000 });

  return (
    <aside className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground font-display leading-none">Playtomic</p>
            <p className="text-xs text-muted-foreground leading-none mt-0.5">Monitor</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Club info */}
      <div className="mx-4 mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Club activo</span>
        </div>
        <p className="text-sm font-semibold text-foreground">Rivapadel Sport Club</p>
        <p className="text-xs text-muted-foreground">Rivas-Vaciamadrid, Madrid</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = location === href;
          return (
            <Link key={href} href={href} onClick={onClose}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/25"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className={cn("w-4.5 h-4.5 flex-shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary/60" />}
                {label === "Alertas" && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 bg-primary/20 text-primary border-0">
                    nuevo
                  </Badge>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Monitor status */}
      <div className="px-4 pb-5">
        <div className={cn(
          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-medium",
          status?.schedulerRunning
            ? "bg-primary/10 border-primary/25 text-primary"
            : "bg-muted/50 border-border text-muted-foreground"
        )}>
          <Radio className={cn("w-3.5 h-3.5", status?.schedulerRunning && "animate-pulse")} />
          <span>{status?.schedulerRunning ? "Monitor activo" : "Monitor inactivo"}</span>
          {status?.schedulerRunning && (
            <span className="ml-auto text-primary/60">c/{status?.intervalMinutes}min</span>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm font-display">Playtomic Monitor</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
