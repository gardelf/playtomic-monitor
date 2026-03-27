import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  MapPin,
  Timer,
  Euro,
  X,
  Search,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const COURT_TYPE_LABELS: Record<string, string> = {
  indoor: "Interior",
  outdoor: "Exterior",
};
const COURT_FEATURE_LABELS: Record<string, string> = {
  crystal: "Cristal",
  panoramic: "Panorámica",
  wall: "Muro",
  synthetic_grass: "Hierba",
  quick: "Quick",
};

const STORAGE_KEY = "playtomic_selected_dates";
const MAX_DAYS = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-");
  return new Date(parseInt(y!), parseInt(m!) - 1, parseInt(d!));
}

function formatDateFull(dateStr: string): string {
  if (!dateStr) return "";
  const date = fromDateStr(dateStr);
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const date = fromDateStr(dateStr);
  return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

function courtFeatureBadge(feature?: string | null) {
  const label = feature ? (COURT_FEATURE_LABELS[feature] ?? feature) : null;
  if (!label) return null;
  const colors: Record<string, string> = {
    crystal: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    panoramic: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    wall: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    synthetic_grass: "bg-green-500/20 text-green-300 border-green-500/30",
    quick: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  };
  const cls = colors[feature ?? ""] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
  return <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{label}</span>;
}

// ─── Slot types ───────────────────────────────────────────────────────────────

type Slot = {
  courtName: string;
  courtFeature?: string;
  courtType?: string;
  time: string;
  duration: number;
  price: string;
};

function groupByCourt(slots: Slot[]) {
  const map = new Map<string, Slot[]>();
  for (const slot of slots) {
    if (!map.has(slot.courtName)) map.set(slot.courtName, []);
    map.get(slot.courtName)!.push(slot);
  }
  return Array.from(map.entries()).map(([name, s]) => ({ name, slots: s }));
}

// ─── Slot list renderer ───────────────────────────────────────────────────────

function SlotList({ byCourt, totalSlots }: { byCourt: { name: string; slots: Slot[] }[]; totalSlots: number }) {
  if (byCourt.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-border rounded-lg">
        <CalendarIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">Sin pistas disponibles en el rango horario</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        {totalSlots} slot{totalSlots !== 1 ? "s" : ""} en {byCourt.length} pista{byCourt.length !== 1 ? "s" : ""}
      </p>
      {byCourt.map(({ name, slots }) => (
        <div key={name} className="bg-background/50 border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-medium text-foreground">{name}</span>
            {courtFeatureBadge(slots[0]?.courtFeature)}
            <span className="text-xs text-muted-foreground ml-auto">
              {slots[0]?.courtType ? (COURT_TYPE_LABELS[slots[0].courtType] ?? slots[0].courtType) : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {slots.map((slot, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1.5"
              >
                <Clock className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-foreground">{slot.time}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <Timer className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{slot.duration}min</span>
                <span className="text-xs text-muted-foreground">·</span>
                <Euro className="w-3 h-3 text-green-400" />
                <span className="text-xs text-green-400">{slot.price.replace(" EUR", "")}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Day availability card ────────────────────────────────────────────────────

function DayAvailabilityCard({
  tenantId,
  date,
  startTimeMin,
  startTimeMax,
  onRemove,
}: {
  tenantId: string;
  date: string;
  startTimeMin: string;
  startTimeMax: string;
  onRemove: () => void;
}) {
  const { data, isLoading, refetch } = trpc.courts.checkDate.useQuery(
    { tenantId, date, startTimeMin, startTimeMax },
    { enabled: !!date, staleTime: 120000 }
  );

  const byCourt = useMemo(() => groupByCourt(data?.slots ?? []), [data]);
  const hasSlots = byCourt.length > 0;

  return (
    <Card className={`bg-card border flex-1 min-w-0 transition-colors ${hasSlots && !isLoading ? "border-primary/40" : "border-border"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm text-foreground capitalize truncate">
              {formatDateFull(date)}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{startTimeMin}–{startTimeMax}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isLoading && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                  hasSlots
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-muted/40 text-muted-foreground border-border"
                }`}
              >
                {hasSlots ? `${data?.slots.length} libre${data!.slots.length !== 1 ? "s" : ""}` : "Sin pistas"}
              </span>
            )}
            <button
              onClick={() => refetch()}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Actualizar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Quitar día"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Consultando Playtomic...</div>
        ) : (
          <SlotList byCourt={byCourt} totalSlots={data?.slots.length ?? 0} />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Date picker (calendar popover, max 2 days) ───────────────────────────────

function DatePicker({
  selectedDates,
  onChange,
}: {
  selectedDates: string[];
  onChange: (dates: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const selected = selectedDates.map(fromDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleSelect = (days: Date[] | undefined) => {
    if (!days) return;
    const sorted = [...days].sort((a, b) => a.getTime() - b.getTime());
    const limited = sorted.slice(-MAX_DAYS);
    onChange(limited.map(toDateStr));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-border text-muted-foreground hover:text-foreground"
        >
          <CalendarIcon className="w-4 h-4" />
          {selectedDates.length === 0
            ? "Seleccionar días"
            : selectedDates.length === 1
            ? formatDateShort(selectedDates[0]!)
            : `${formatDateShort(selectedDates[0]!)} · ${formatDateShort(selectedDates[1]!)}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-card border-border" align="end">
        <div className="p-3 border-b border-border">
          <p className="text-xs text-muted-foreground">
            Selecciona hasta <strong className="text-foreground">2 días</strong> para comparar disponibilidad
          </p>
          {selectedDates.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedDates.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 text-xs bg-primary/15 text-primary border border-primary/30 rounded-full px-2.5 py-0.5"
                >
                  {formatDateShort(d)}
                  <button
                    onClick={() => onChange(selectedDates.filter((x) => x !== d))}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <Calendar
          mode="multiple"
          selected={selected}
          onSelect={handleSelect}
          disabled={(d) => d < today}
          className="rounded-none"
        />
        <div className="p-3 border-t border-border flex justify-between items-center">
          <button
            onClick={() => onChange([])}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpiar selección
          </button>
          <Button size="sm" onClick={() => setOpen(false)} className="bg-primary text-primary-foreground">
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Time options ─────────────────────────────────────────────────────────────

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 22; h++) {
  for (const m of ["00", "30"]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${m}`);
  }
}

// ─── Club Search Dialog ───────────────────────────────────────────────────────

type ClubSearchResult = {
  tenantId: string;
  tenantUid?: string;
  name: string;
  city?: string;
  country?: string;
  imageUrl?: string;
  address?: string;
};

function AddClubDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: results, isLoading: searching } = trpc.courts.searchClubs.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  const { data: monitoredClubs, refetch: refetchMonitored } = trpc.courts.monitoredClubs.useQuery();

  const addClubMut = trpc.courts.addClub.useMutation({
    onSuccess: () => {
      toast.success("Club añadido correctamente");
      refetchMonitored();
      onAdded();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const removeClubMut = trpc.courts.removeClub.useMutation({
    onSuccess: () => {
      toast.success("Club eliminado");
      refetchMonitored();
      onAdded();
    },
    onError: (err) => toast.error(`Error al eliminar: ${err.message}`),
  });

  const monitoredIds = new Set(monitoredClubs?.map((c) => c.tenantId) ?? []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val), 500);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
          <Building2 className="w-4 h-4" />
          Gestionar clubs
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Gestionar clubs monitorizados</DialogTitle>
        </DialogHeader>

        {/* Monitored clubs list */}
        {monitoredClubs && monitoredClubs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              Clubs monitorizados ({monitoredClubs.length})
            </p>
            {monitoredClubs.map((club) => (
              <div
                key={club.id}
                className="flex items-center justify-between gap-3 bg-background/60 border border-border rounded-lg px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{club.name}</p>
                  {club.city && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {club.city}{club.country ? `, ${club.country}` : ""}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => removeClubMut.mutate({ id: club.id })}
                  disabled={removeClubMut.isPending}
                  title="Eliminar club"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
            Buscar y añadir club
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Nombre del club (ej: Rivapadel, Padel Nuestro...)"
              className="bg-background border-border pl-9"
            />
          </div>

          {searching && (
            <p className="text-xs text-muted-foreground text-center py-2">Buscando...</p>
          )}

          {!searching && debouncedQuery.length >= 2 && results && results.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No se encontraron clubs con ese nombre
            </p>
          )}

          {results && results.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(results as ClubSearchResult[]).map((club) => {
                const isAdded = monitoredIds.has(club.tenantId);
                return (
                  <div
                    key={club.tenantId}
                    className="flex items-center justify-between gap-3 bg-background/60 border border-border rounded-lg px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{club.name}</p>
                      {club.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {club.address}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isAdded ? "outline" : "default"}
                      className={`flex-shrink-0 h-7 text-xs ${isAdded ? "border-primary/40 text-primary" : "bg-primary text-primary-foreground"}`}
                      disabled={isAdded || addClubMut.isPending}
                      onClick={() =>
                        addClubMut.mutate({
                          tenantId: club.tenantId,
                          tenantUid: club.tenantUid,
                          name: club.name,
                          city: club.city,
                          country: club.country,
                          imageUrl: club.imageUrl,
                        })
                      }
                    >
                      {isAdded ? "Añadido" : "Añadir"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Watch Form ───────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  name: "",
  clubId: "",
  dayOfWeek: "3",
  startTimeMin: "18:30",
  startTimeMax: "20:30",
  preferredDuration: "any",
  weeksAhead: "4",
};

function NewWatchForm({
  clubs,
  onCreated,
}: {
  clubs: { id: number; name: string; tenantId: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(DEFAULT_FORM.name);
  const [clubId, setClubId] = useState(clubs[0] ? String(clubs[0].id) : DEFAULT_FORM.clubId);
  const [dayOfWeek, setDayOfWeek] = useState(DEFAULT_FORM.dayOfWeek);
  const [startTimeMin, setStartTimeMin] = useState(DEFAULT_FORM.startTimeMin);
  const [startTimeMax, setStartTimeMax] = useState(DEFAULT_FORM.startTimeMax);
  const [preferredDuration, setPreferredDuration] = useState(DEFAULT_FORM.preferredDuration);
  const [weeksAhead, setWeeksAhead] = useState(DEFAULT_FORM.weeksAhead);

  // Sync default clubId when clubs load
  useEffect(() => {
    if (clubs.length > 0 && !clubId) {
      setClubId(String(clubs[0].id));
    }
  }, [clubs]);

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      setName(DEFAULT_FORM.name);
      setClubId(clubs[0] ? String(clubs[0].id) : DEFAULT_FORM.clubId);
      setDayOfWeek(DEFAULT_FORM.dayOfWeek);
      setStartTimeMin(DEFAULT_FORM.startTimeMin);
      setStartTimeMax(DEFAULT_FORM.startTimeMax);
      setPreferredDuration(DEFAULT_FORM.preferredDuration);
      setWeeksAhead(DEFAULT_FORM.weeksAhead);
    }
  };

  const createMut = trpc.courts.createWatch.useMutation({
    onSuccess: () => {
      toast.success("Vigilancia creada correctamente");
      handleOpenChange(false);
      onCreated();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (!clubId) { toast.error("Selecciona un club"); return; }
    if (startTimeMin >= startTimeMax) { toast.error("La hora mínima debe ser anterior a la máxima"); return; }
    createMut.mutate({
      clubId: parseInt(clubId),
      name: name.trim(),
      dayOfWeek: parseInt(dayOfWeek),
      startTimeMin,
      startTimeMax,
      preferredDuration: preferredDuration !== "any" ? parseInt(preferredDuration) : undefined,
      sportId: "PADEL",
      weeksAhead: parseInt(weeksAhead),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={clubs.length === 0}>
          <Plus className="w-4 h-4" />
          Nueva vigilancia
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Configurar vigilancia de pistas</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Club selector */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Club</Label>
            <Select value={clubId} onValueChange={setClubId}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Selecciona un club" />
              </SelectTrigger>
              <SelectContent>
                {clubs.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Viernes tarde Rivapadel"
              className="bg-background border-border"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Día</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Semanas adelante</Label>
              <Select value={weeksAhead} onValueChange={setWeeksAhead}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 6, 8, 12].map((w) => (
                    <SelectItem key={w} value={String(w)}>{w} semanas</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Hora desde</Label>
              <Select value={startTimeMin} onValueChange={setStartTimeMin}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Hora hasta</Label>
              <Select value={startTimeMax} onValueChange={setStartTimeMax}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {TIME_OPTIONS.filter((t) => t > startTimeMin).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Busca pistas con hora de inicio entre <strong className="text-foreground">{startTimeMin}</strong> y <strong className="text-foreground">{startTimeMax}</strong>
          </p>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Duración preferida</Label>
            <Select value={preferredDuration} onValueChange={setPreferredDuration}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
                <SelectItem value="90">90 min</SelectItem>
                <SelectItem value="120">120 min</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={createMut.isPending || !name.trim() || !clubId}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {createMut.isPending ? "Creando..." : "Crear vigilancia"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Live Availability Panel (inside watch config card) ───────────────────────

function LiveAvailabilityPanel({
  tenantId,
  config,
}: {
  tenantId: string;
  config: {
    dayOfWeek: number;
    startTimeMin: string;
    startTimeMax: string;
    preferredDuration?: number | null;
    weeksAhead: number;
  };
}) {
  const dates = getUpcomingDatesClient(config.dayOfWeek, config.weeksAhead);
  const [selectedDate, setSelectedDate] = useState(dates[0] ?? "");

  const { data, isLoading, refetch } = trpc.courts.checkDate.useQuery(
    {
      tenantId,
      date: selectedDate,
      startTimeMin: config.startTimeMin,
      startTimeMax: config.startTimeMax,
      preferredDuration: config.preferredDuration ?? undefined,
    },
    { enabled: !!selectedDate, staleTime: 60000 }
  );

  const byCourt = useMemo(() => groupByCourt(data?.slots ?? []), [data]);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Fecha:</span>
        {dates.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDate(d)}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
              selectedDate === d
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {formatDateShort(d)}
          </button>
        ))}
        <button
          onClick={() => refetch()}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>
      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Consultando Playtomic...</div>
      ) : (
        <SlotList byCourt={byCourt} totalSlots={data?.slots.length ?? 0} />
      )}
    </div>
  );
}

// ─── Watch Config Card ────────────────────────────────────────────────────────

function WatchConfigCard({
  config,
  tenantId,
  clubName,
  onDeleted,
  onToggled,
}: {
  config: {
    id: number;
    name: string;
    dayOfWeek: number;
    startTimeMin: string;
    startTimeMax: string;
    preferredDuration?: number | null;
    isActive: boolean;
    weeksAhead: number;
    sportId: string;
  };
  tenantId: string;
  clubName: string;
  onDeleted: () => void;
  onToggled: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  const deleteMut = trpc.courts.deleteWatch.useMutation({
    onSuccess: () => {
      toast.success("Vigilancia eliminada");
      onDeleted();
    },
  });

  const toggleMut = trpc.courts.updateWatch.useMutation({
    onSuccess: () => {
      utils.courts.watchConfigs.invalidate();
      onToggled();
    },
  });

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                config.isActive ? "bg-primary animate-pulse" : "bg-muted-foreground"
              }`}
            />
            <div className="min-w-0">
              <CardTitle className="text-base text-foreground truncate">{config.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs border-border text-muted-foreground gap-1">
                  <Building2 className="w-3 h-3" />
                  {clubName}
                </Badge>
                <Badge variant="outline" className="text-xs border-border text-muted-foreground gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {DAY_NAMES[config.dayOfWeek]}
                </Badge>
                <Badge variant="outline" className="text-xs border-border text-muted-foreground gap-1">
                  <Clock className="w-3 h-3" />
                  {config.startTimeMin}–{config.startTimeMax}
                </Badge>
                {config.preferredDuration && (
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground gap-1">
                    <Timer className="w-3 h-3" />
                    {config.preferredDuration}min
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                  {config.weeksAhead} sem.
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => toggleMut.mutate({ id: config.id, isActive: !config.isActive })}
            >
              {config.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => deleteMut.mutate({ id: config.id })}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 border-t border-border">
          <LiveAvailabilityPanel tenantId={tenantId} config={config} />
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Courts() {
  const { data: monitoredClubs, refetch: refetchClubs } = trpc.courts.monitoredClubs.useQuery();

  // Selected club for the availability preview (defaults to first)
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const activeClub = useMemo(() => {
    if (!monitoredClubs || monitoredClubs.length === 0) return null;
    if (selectedClubId) return monitoredClubs.find((c) => c.id === selectedClubId) ?? monitoredClubs[0];
    return monitoredClubs[0];
  }, [monitoredClubs, selectedClubId]);

  const { data: watchConfigs, refetch: refetchConfigs } = trpc.courts.watchConfigs.useQuery(
    {},
    { staleTime: 30000 }
  );

  // Build a map of clubId → club for quick lookup
  const clubMap = useMemo(() => {
    const m = new Map<number, { id: number; name: string; tenantId: string }>();
    for (const c of monitoredClubs ?? []) {
      m.set(c.id, { id: c.id, name: c.name, tenantId: c.tenantId });
    }
    return m;
  }, [monitoredClubs]);

  const runNowMut = trpc.courts.runNow.useMutation({
    onSuccess: (result) => {
      toast.success(`Ciclo completado: ${result.slotsFound} slots encontrados, ${result.newSlots} nuevos`);
      refetchConfigs();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  // Selected dates — persisted in localStorage
  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return parsed.filter((d) => fromDateStr(d) >= today).slice(0, MAX_DAYS);
      }
    } catch {}
    return getUpcomingDatesClient(5, 2); // default: próximos 2 viernes
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedDates));
  }, [selectedDates]);

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pistas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Disponibilidad de pistas de pádel en los clubs monitorizados
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border text-muted-foreground hover:text-foreground"
            onClick={() => runNowMut.mutate()}
            disabled={runNowMut.isPending}
          >
            <RefreshCw className={`w-4 h-4 ${runNowMut.isPending ? "animate-spin" : ""}`} />
            Comprobar ahora
          </Button>
          <AddClubDialog onAdded={() => { refetchClubs(); refetchConfigs(); }} />
          <NewWatchForm
            clubs={(monitoredClubs ?? []).map((c) => ({ id: c.id, name: c.name, tenantId: c.tenantId }))}
            onCreated={() => refetchConfigs()}
          />
        </div>
      </div>

      {/* Club selector tabs (if multiple clubs) */}
      {monitoredClubs && monitoredClubs.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wide mr-1">Club:</span>
          {monitoredClubs.map((club) => (
            <button
              key={club.id}
              onClick={() => setSelectedClubId(club.id)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                (activeClub?.id === club.id)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {club.name}
            </button>
          ))}
        </div>
      )}

      {/* No clubs configured */}
      {(!monitoredClubs || monitoredClubs.length === 0) && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm font-medium">Sin clubs configurados</p>
            <p className="text-muted-foreground/60 text-xs mt-1 mb-4">
              Añade un club para empezar a monitorizar la disponibilidad de pistas
            </p>
            <AddClubDialog onAdded={() => refetchClubs()} />
          </CardContent>
        </Card>
      )}

      {/* Selected days availability (only shown when there's an active club) */}
      {activeClub && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Consulta rápida — {activeClub.name}
            </h2>
            <DatePicker selectedDates={selectedDates} onChange={setSelectedDates} />
          </div>

          {selectedDates.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <CalendarIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm font-medium">Ningún día seleccionado</p>
                <p className="text-muted-foreground/60 text-xs mt-1">
                  Usa el botón "Seleccionar días" para elegir hasta 2 días y ver la disponibilidad
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col lg:flex-row gap-4">
              {selectedDates.map((date) => (
                <DayAvailabilityCard
                  key={date}
                  tenantId={activeClub.tenantId}
                  date={date}
                  startTimeMin="18:30"
                  startTimeMax="20:30"
                  onRemove={() => setSelectedDates((prev) => prev.filter((d) => d !== date))}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Watch Configs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Vigilancias configuradas ({watchConfigs?.length ?? 0})
          </h2>
        </div>

        {!watchConfigs || watchConfigs.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-10 text-center">
              <CalendarIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Sin vigilancias configuradas</p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                Crea una vigilancia para recibir alertas cuando haya pistas disponibles
              </p>
            </CardContent>
          </Card>
        ) : (
          watchConfigs.map((cfg) => {
            const club = clubMap.get(cfg.clubId);
            return (
              <WatchConfigCard
                key={cfg.id}
                config={cfg}
                tenantId={club?.tenantId ?? ""}
                clubName={club?.name ?? `Club #${cfg.clubId}`}
                onDeleted={() => refetchConfigs()}
                onToggled={() => refetchConfigs()}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getUpcomingDatesClient(dayOfWeek: number, weeksAhead: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const seen = new Set<string>();

  for (let w = 0; w < weeksAhead; w++) {
    const d = new Date(today);
    let diff = dayOfWeek - d.getDay();
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff + w * 7);
    const key = toDateStr(d);
    if (!seen.has(key)) {
      seen.add(key);
      dates.push(key);
    }
  }
  return dates;
}
