import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  UserPlus,
  Send,
  Trash2,
  Pencil,
  Users,
  MessageCircle,
  Bell,
  BellOff,
  Info,
} from "lucide-react";

type Contact = {
  id: number;
  name: string;
  chatId: string;
  isActive: boolean;
  notes: string | null;
  totalAlerts: number;
  lastAlertAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function ContactCard({
  contact,
  onEdit,
  onDelete,
  onTest,
  onToggle,
  testingId,
}: {
  contact: Contact;
  onEdit: (c: Contact) => void;
  onDelete: (id: number) => void;
  onTest: (chatId: string, id: number) => void;
  onToggle: (id: number, active: boolean) => void;
  testingId: number | null;
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card/80 transition-colors">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <MessageCircle className="w-5 h-5 text-primary" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground truncate">{contact.name}</span>
          {contact.isActive ? (
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-xs">Activo</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs opacity-60">Inactivo</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-mono mt-0.5">Chat ID: {contact.chatId}</p>
        {contact.notes && (
          <p className="text-xs text-muted-foreground/70 mt-1 italic">{contact.notes}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Bell className="w-3 h-3" />
            {contact.totalAlerts} alertas enviadas
          </span>
          {contact.lastAlertAt && (
            <span>
              Última: {new Date(contact.lastAlertAt).toLocaleDateString("es-ES")}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={contact.isActive}
          onCheckedChange={(v) => onToggle(contact.id, v)}
          title={contact.isActive ? "Desactivar" : "Activar"}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary"
          onClick={() => onTest(contact.chatId, contact.id)}
          disabled={testingId === contact.id}
          title="Enviar mensaje de prueba"
        >
          <Send className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => onEdit(contact)}
          title="Editar"
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(contact.id)}
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Contacts() {
  const utils = trpc.useUtils();
  const { data: contacts = [], isLoading } = trpc.telegramContacts.list.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);

  const [form, setForm] = useState({ name: "", chatId: "", notes: "", isActive: true });

  const createMutation = trpc.telegramContacts.create.useMutation({
    onSuccess: () => {
      utils.telegramContacts.list.invalidate();
      toast.success("Contacto añadido correctamente");
      setShowForm(false);
      setForm({ name: "", chatId: "", notes: "", isActive: true });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.telegramContacts.update.useMutation({
    onSuccess: () => {
      utils.telegramContacts.list.invalidate();
      toast.success("Contacto actualizado");
      setEditContact(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.telegramContacts.delete.useMutation({
    onSuccess: () => {
      utils.telegramContacts.list.invalidate();
      toast.success("Contacto eliminado");
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.telegramContacts.testMessage.useMutation({
    onSuccess: (data, vars) => {
      setTestingId(null);
      if (data.ok) {
        toast.success("Mensaje de prueba enviado correctamente");
      } else {
        toast.error(data.error ?? "Error al enviar el mensaje de prueba");
      }
    },
    onError: (err) => {
      setTestingId(null);
      toast.error(err.message);
    },
  });

  const handleCreate = () => {
    if (!form.name.trim() || !form.chatId.trim()) {
      toast.error("Nombre y Chat ID son obligatorios");
      return;
    }
    createMutation.mutate(form);
  };

  const handleUpdate = () => {
    if (!editContact) return;
    updateMutation.mutate({
      id: editContact.id,
      name: editContact.name,
      chatId: editContact.chatId,
      notes: editContact.notes,
      isActive: editContact.isActive,
    });
  };

  const handleTest = (chatId: string, id: number) => {
    setTestingId(id);
    testMutation.mutate({ chatId });
  };

  const handleToggle = (id: number, active: boolean) => {
    updateMutation.mutate({ id, isActive: active });
  };

  const activeCount = contacts.filter((c) => c.isActive).length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contactos Telegram</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona quién recibe las alertas de disponibilidad de pistas
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Añadir contacto
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-primary/60" />
            <div>
              <p className="text-2xl font-bold">{contacts.length}</p>
              <p className="text-xs text-muted-foreground">Total contactos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Bell className="w-8 h-8 text-emerald-500/60" />
            <div>
              <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Activos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <BellOff className="w-8 h-8 text-muted-foreground/40" />
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{contacts.length - activeCount}</p>
              <p className="text-xs text-muted-foreground">Inactivos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How to get Chat ID */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">¿Cómo obtener el Chat ID de Telegram?</p>
            <p>1. Busca el bot <strong>@userinfobot</strong> en Telegram y escríbele cualquier mensaje.</p>
            <p>2. Te responderá con tu <strong>ID numérico</strong> (ej: <code className="bg-muted px-1 rounded text-xs">123456789</code>).</p>
            <p>3. Para grupos: añade el bot al grupo y escribe <code className="bg-muted px-1 rounded text-xs">/start</code>. El ID del grupo empieza por <code className="bg-muted px-1 rounded text-xs">-</code> (negativo).</p>
            <p>4. Asegúrate de que tu bot de Telegram también esté en el grupo o haya iniciado conversación contigo.</p>
          </div>
        </CardContent>
      </Card>

      {/* Contact list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando contactos...</div>
      ) : contacts.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-12 text-center">
            <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay contactos todavía</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Añade contactos para recibir alertas cuando haya pistas disponibles
            </p>
            <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4 gap-2">
              <UserPlus className="w-4 h-4" />
              Añadir primer contacto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              onEdit={setEditContact}
              onDelete={(id) => deleteMutation.mutate({ id })}
              onTest={handleTest}
              onToggle={handleToggle}
              testingId={testingId}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir contacto Telegram</DialogTitle>
            <DialogDescription>
              Este contacto recibirá alertas cuando se detecten pistas disponibles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                placeholder="Ej: Juan García"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Chat ID de Telegram</Label>
              <Input
                placeholder="Ej: 123456789 o -987654321 (grupos)"
                value={form.chatId}
                onChange={(e) => setForm((f) => ({ ...f, chatId: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Ej: Grupo de pádel miércoles"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <Label>Activo (recibirá alertas)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Añadiendo..." : "Añadir contacto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar contacto</DialogTitle>
          </DialogHeader>
          {editContact && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input
                  value={editContact.name}
                  onChange={(e) => setEditContact((c) => c && ({ ...c, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Chat ID de Telegram</Label>
                <Input
                  value={editContact.chatId}
                  onChange={(e) => setEditContact((c) => c && ({ ...c, chatId: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={editContact.notes ?? ""}
                  onChange={(e) => setEditContact((c) => c && ({ ...c, notes: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={editContact.isActive}
                  onCheckedChange={(v) => setEditContact((c) => c && ({ ...c, isActive: v }))}
                />
                <Label>Activo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditContact(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
