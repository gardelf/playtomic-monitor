import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function SectionCard({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h2 className="font-semibold text-foreground font-display text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function Settings() {
  const utils = trpc.useUtils();
  const { data: configs } = trpc.alerts.configs.useQuery();

  // Telegram state
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Email state
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [toEmail, setToEmail] = useState("");

  // Load configs
  useEffect(() => {
    if (!configs) return;
    const tg = configs.find((c) => c.channel === "telegram");
    const em = configs.find((c) => c.channel === "email");

    if (tg) {
      setTgEnabled(tg.isEnabled);
      try {
        const cfg = JSON.parse(tg.config || "{}");
        setTgToken(cfg.botToken || "");
        setTgChatId(cfg.chatId || "");
      } catch {}
    }
    if (em) {
      setEmailEnabled(em.isEnabled);
      try {
        const cfg = JSON.parse(em.config || "{}");
        setSmtpHost(cfg.smtpHost || "");
        setSmtpPort(String(cfg.smtpPort || 587));
        setSmtpUser(cfg.smtpUser || "");
        setSmtpPass(cfg.smtpPass || "");
        setToEmail(cfg.toEmail || "");
      } catch {}
    }
  }, [configs]);

  const saveConfig = trpc.alerts.saveConfig.useMutation({
    onSuccess: () => {
      utils.alerts.configs.invalidate();
      toast.success("Configuración guardada");
    },
    onError: () => toast.error("Error al guardar"),
  });

  const saveTelegram = () => {
    saveConfig.mutate({
      channel: "telegram",
      isEnabled: tgEnabled,
      config: { botToken: tgToken, chatId: tgChatId },
    });
  };

  const saveEmail = () => {
    saveConfig.mutate({
      channel: "email",
      isEnabled: emailEnabled,
      config: {
        smtpHost,
        smtpPort: parseInt(smtpPort),
        smtpUser,
        smtpPass,
        toEmail,
      },
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Gestiona los canales de alerta. El control del monitor (intervalo, iniciar/detener) está en el Dashboard.
        </p>
      </div>

      {/* Telegram */}
      <SectionCard title="Alertas por Telegram" icon={Bell}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Activar notificaciones Telegram</p>
              <p className="text-xs text-muted-foreground mt-0.5">Recibe alertas instantáneas en tu bot de Telegram</p>
            </div>
            <Switch checked={tgEnabled} onCheckedChange={setTgEnabled} />
          </div>

          {tgEnabled && (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bot Token</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                    value={tgToken}
                    onChange={(e) => setTgToken(e.target.value)}
                    className="bg-input border-border text-foreground pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground/70">
                  Obtén tu token en <span className="text-primary">@BotFather</span> en Telegram
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chat ID</Label>
                <Input
                  type="text"
                  placeholder="-1001234567890"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  className="bg-input border-border text-foreground font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground/70">
                  Tu ID personal o el ID de un grupo/canal. Usa <span className="text-primary">@userinfobot</span> para obtenerlo
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={saveTelegram}
            disabled={saveConfig.isPending}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar configuración Telegram
          </Button>
        </div>
      </SectionCard>

      {/* Email */}
      <SectionCard title="Alertas por Email" icon={Bell}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Activar notificaciones Email</p>
              <p className="text-xs text-muted-foreground mt-0.5">Recibe alertas en tu correo electrónico (requiere SMTP)</p>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>

          {emailEnabled && (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Servidor SMTP</Label>
                  <Input
                    placeholder="smtp.gmail.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="bg-input border-border text-foreground text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Puerto</Label>
                  <Input
                    type="number"
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="bg-input border-border text-foreground text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Usuario SMTP</Label>
                <Input
                  type="email"
                  placeholder="tu@gmail.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="bg-input border-border text-foreground text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contraseña / App Password</Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    className="bg-input border-border text-foreground text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground/70">
                  Para Gmail, usa una <span className="text-primary">contraseña de aplicación</span> (no tu contraseña normal)
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Enviar alertas a</Label>
                <Input
                  type="email"
                  placeholder="destino@email.com"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="bg-input border-border text-foreground text-sm"
                />
              </div>
            </div>
          )}

          <Button
            onClick={saveEmail}
            disabled={saveConfig.isPending}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar configuración Email
          </Button>
        </div>
      </SectionCard>

      {/* Help */}
      <div className="bg-muted/20 border border-border/50 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground font-display mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          Guía de configuración
        </h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p><span className="text-foreground font-medium">Telegram:</span> Crea un bot con @BotFather, obtén el token y añade el bot a tu chat. El Chat ID lo obtienes con @userinfobot o @RawDataBot.</p>
          <p><span className="text-foreground font-medium">Gmail:</span> Activa la verificación en 2 pasos y genera una "Contraseña de aplicación" en tu cuenta de Google. Usa smtp.gmail.com:587.</p>
          <p><span className="text-foreground font-medium">Monitor:</span> El intervalo y los controles de inicio/parada están en el <span className="text-primary">Dashboard</span>. Se recomienda un intervalo de 2-5 minutos.</p>
        </div>
      </div>
    </div>
  );
}
