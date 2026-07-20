import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wrench,
  AlertTriangle,
  AlertCircle,
  Clock,
  Plus,
  Search,
  User,
  Image as ImageIcon,
  Calendar,
  RefreshCw,
  Check,
  UserCheck,
  Activity,
} from "lucide-react";
import { createTicket, listRooms, listTickets, resolveTicket } from "../api";
import type {
  CreateMaintenanceTicketInput,
  MaintenanceTicket,
  PrioriteTicket,
} from "../types";
import type { Room } from "../../reservations/types";

const PRIORITES: PrioriteTicket[] = ["BASSE", "MOYENNE", "HAUTE", "URGENTE"];

const PRIORITE_LABEL: Record<PrioriteTicket, string> = {
  BASSE: "Basse",
  MOYENNE: "Moyenne",
  HAUTE: "Haute",
  URGENTE: "Urgente",
};

const PRIORITE_STYLES: Record<
  PrioriteTicket,
  {
    border: string;
    bg: string;
    text: string;
    badge: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
  }
> = {
  BASSE: {
    border: "border-slate-200 dark:border-slate-800",
    bg: "bg-slate-50 dark:bg-slate-900/30",
    text: "text-slate-600 dark:text-slate-400",
    badge: "outline",
    icon: <Clock className="h-3.5 w-3.5 text-slate-500" />,
  },
  MOYENNE: {
    border: "border-blue-200 dark:border-blue-900/30",
    bg: "bg-blue-50/40 dark:bg-blue-950/10",
    text: "text-blue-600 dark:text-blue-400",
    badge: "secondary",
    icon: <Activity className="h-3.5 w-3.5 text-blue-500" />,
  },
  HAUTE: {
    border: "border-amber-200 dark:border-amber-900/30",
    bg: "bg-amber-50/40 dark:bg-amber-950/10",
    text: "text-amber-700 dark:text-amber-400",
    badge: "default",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  },
  URGENTE: {
    border: "border-rose-200 dark:border-rose-900/40",
    bg: "bg-rose-50/50 dark:bg-rose-950/20",
    text: "text-rose-700 dark:text-rose-400",
    badge: "destructive",
    icon: <AlertCircle className="h-3.5 w-3.5 text-rose-500 animate-pulse" />,
  },
};

export function MaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TOUS" | "OUVERT" | "RESOLU">("TOUS");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ticketsData, roomsData] = await Promise.all([
        listTickets(),
        listRooms(),
      ]);
      setTickets(ticketsData);
      setRooms(roomsData);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  async function handleResolve(id: number) {
    setActionError(null);
    setResolvingId(id);
    try {
      await resolveTicket(id);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur de résolution");
    } finally {
      setResolvingId(null);
    }
  }

  async function handleCreate(input: CreateMaintenanceTicketInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await createTicket(input);
      setDialogOpen(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de création");
    } finally {
      setSubmitting(false);
    }
  }

  // Stats
  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => !t.resoluAt).length;
  const urgentCount = tickets.filter((t) => !t.resoluAt && (t.priorite === "URGENTE" || t.priorite === "HAUTE")).length;
  const resolvedCount = tickets.filter((t) => t.resoluAt).length;

  // Filter implementation
  const filteredTickets = tickets.filter((ticket) => {
    const isRoomMatch = ticket.room?.numero.includes(searchQuery) || false;
    const isTypeMatch = ticket.typePanne.toLowerCase().includes(searchQuery.toLowerCase());
    const isAssignedMatch = ticket.assigneA?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const matchesSearch = searchQuery === "" || isRoomMatch || isTypeMatch || isAssignedMatch;

    const matchesStatus =
      statusFilter === "TOUS" ||
      (statusFilter === "OUVERT" && !ticket.resoluAt) ||
      (statusFilter === "RESOLU" && !!ticket.resoluAt);

    const matchesPriority =
      priorityFilter === "ALL" || ticket.priorite === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Title Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-serif font-bold text-foreground">
              Tickets de Maintenance
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Signalez des pannes en chambre ou zones communes, et suivez les interventions techniques.
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="gap-2 self-start sm:self-auto shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nouveau ticket de maintenance
        </Button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm flex items-center justify-between">
          <span>{loadError}</span>
          <button
            onClick={refetch}
            className="flex items-center gap-1.5 text-xs underline font-semibold"
          >
            <RefreshCw className="h-3 w-3" /> Actualiser
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm">
          {actionError}
        </div>
      )}

      {/* Stats Summary Panel */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Total Signalés
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold">{totalCount}</span>
            <span className="text-xs text-muted-foreground">tickets</span>
          </div>
        </div>

        <div className="rounded-xl border border-rose-500/10 bg-rose-500/[0.02] p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            En Cours / Ouverts
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{openCount}</span>
            <span className="text-xs text-rose-500/70 font-semibold">actifs</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Urgences & Hautes
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{urgentCount}</span>
            <span className="text-xs text-amber-500/70 font-semibold">prioritaires</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Résolus
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{resolvedCount}</span>
            <span className="text-xs text-emerald-500/70 font-semibold">clôturés</span>
          </div>
        </div>
      </div>

      {/* Interactive Controls */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrer par type de panne, chambre, technicien..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/40 transition-all"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 overflow-auto pb-1 md:pb-0">
            <button
              onClick={() => setStatusFilter("TOUS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${statusFilter === "TOUS" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-secondary text-muted-foreground"}`}
            >
              Tous
            </button>
            <button
              onClick={() => setStatusFilter("OUVERT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${statusFilter === "OUVERT" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30" : "bg-background hover:bg-secondary text-muted-foreground"}`}
            >
              Ouverts ({openCount})
            </button>
            <button
              onClick={() => setStatusFilter("RESOLU")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${statusFilter === "RESOLU" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" : "bg-background hover:bg-secondary text-muted-foreground"}`}
            >
              Résolus ({resolvedCount})
            </button>
          </div>
        </div>

        {/* Priority Filter Pills */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t mt-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center mr-2">
            Priorité :
          </span>
          <button
            onClick={() => setPriorityFilter("ALL")}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${priorityFilter === "ALL" ? "bg-secondary text-foreground border-border" : "bg-background hover:bg-secondary text-muted-foreground"}`}
          >
            Toutes
          </button>
          {PRIORITES.map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${priorityFilter === p ? "bg-primary/10 text-primary border-primary/30" : "bg-background hover:bg-secondary text-muted-foreground"}`}
            >
              {PRIORITE_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Main List Grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-16 justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Chargement des tickets de maintenance...
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center bg-card">
          <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-45" />
          <p className="text-sm font-semibold text-muted-foreground">
            Aucun ticket de maintenance trouvé
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Modifiez vos critères de recherche ou créez un nouveau ticket.
          </p>
          {(searchQuery || statusFilter !== "TOUS" || priorityFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("TOUS");
                setPriorityFilter("ALL");
              }}
              className="text-xs text-primary underline mt-2 font-semibold"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTickets.map((ticket) => {
            const pStyle = PRIORITE_STYLES[ticket.priorite] || PRIORITE_STYLES.BASSE;
            const isResolu = !!ticket.resoluAt;

            return (
              <div
                key={ticket.id}
                className={`group flex flex-col justify-between rounded-xl border bg-card p-4.5 transition-all hover:shadow-sm ${isResolu ? "border-muted opacity-80" : `border-l-4 ${pStyle.border}`}`}
              >
                <div>
                  {/* Card Header: Location & Priority Badges */}
                  <div className="flex items-start justify-between gap-2 border-b pb-2.5">
                    <div className="text-left">
                      <span className="font-serif text-sm font-bold text-foreground">
                        {ticket.room ? `Chambre ${ticket.room.numero}` : "Zone commune"}
                      </span>
                      {ticket.room && (
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {ticket.room.roomType.nom}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={pStyle.badge}
                        className="font-bold text-[9px] uppercase tracking-wider px-1.5 py-0.2 h-5 flex items-center gap-0.5"
                      >
                        {pStyle.icon}
                        {PRIORITE_LABEL[ticket.priorite]}
                      </Badge>
                      <Badge
                        variant={isResolu ? "secondary" : "outline"}
                        className={`font-semibold text-[9px] px-1.5 py-0.2 h-5 flex items-center ${isResolu ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/5 text-rose-500 border-rose-500/10 animate-pulse"}`}
                      >
                        {isResolu ? "Résolu" : "Ouvert"}
                      </Badge>
                    </div>
                  </div>

                  {/* Body: Issue detail */}
                  <div className="py-3 text-left">
                    <h3 className="font-semibold text-sm text-foreground">
                      {ticket.typePanne}
                    </h3>

                    {ticket.photoUrl && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-primary bg-primary/5 hover:bg-primary/10 transition-colors p-1.5 rounded-lg w-fit cursor-pointer">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-semibold">Photo disponible</span>
                      </div>
                    )}

                    {/* Meta dates and assigns */}
                    <div className="flex flex-col gap-1 mt-3 pt-2.5 border-t border-dashed text-[10px] text-muted-foreground font-medium">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>Signalé le {new Date(ticket.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>

                      {ticket.assigneA && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span>Assigné à : <strong className="text-foreground">{ticket.assigneA}</strong></span>
                        </div>
                      )}

                      {ticket.resoluAt && (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold mt-1 bg-emerald-500/[0.04] p-1 rounded">
                          <UserCheck className="h-3 w-3" />
                          <span>Résolu le {new Date(ticket.resoluAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                {!isResolu && (
                  <div className="border-t pt-2.5 mt-1 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-bold gap-1.5 border-emerald-600/30 hover:bg-emerald-600/10 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition-all shadow-xs"
                      disabled={resolvingId === ticket.id}
                      onClick={() => handleResolve(ticket.id)}
                    >
                      {resolvingId === ticket.id ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                          Clôture...
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Résoudre & Clôturer
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => !next && setDialogOpen(false)}
      >
        <DialogContent className="sm:max-w-[450px]">
          {dialogOpen && (
            <CreateTicketForm
              rooms={rooms}
              onClose={() => setDialogOpen(false)}
              onConfirm={handleCreate}
              submitting={submitting}
              error={formError}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CreateTicketFormProps {
  rooms: Room[];
  onClose: () => void;
  onConfirm: (input: CreateMaintenanceTicketInput) => void;
  submitting: boolean;
  error: string | null;
}

function CreateTicketForm({
  rooms,
  onClose,
  onConfirm,
  submitting,
  error,
}: CreateTicketFormProps) {
  const [roomId, setRoomId] = useState("");
  const [typePanne, setTypePanne] = useState("");
  const [priorite, setPriorite] = useState<PrioriteTicket>("MOYENNE");
  const [assigneA, setAssigneA] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-xl font-bold tracking-tight text-foreground">
          Nouveau ticket de maintenance
        </DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-4 mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!typePanne) return;
          onConfirm({
            roomId: roomId ? Number(roomId) : undefined,
            typePanne,
            priorite,
            assigneA: assigneA || undefined,
            photoUrl: photoUrl || undefined,
          });
        }}
      >
        <div className="flex flex-col gap-1.5 text-left">
          <Label htmlFor="room" className="text-xs font-semibold text-muted-foreground uppercase">
            Chambre ou Espace
          </Label>
          <Select
            value={roomId}
            onValueChange={(v) => setRoomId(v ?? "")}
            items={[
              { value: "", label: "Zone commune / non applicable" },
              ...rooms.map((room) => ({
                value: String(room.id),
                label: `Chambre ${room.numero} — ${room.roomType.nom}`,
              })),
            ]}
          >
            <SelectTrigger id="room" className="w-full h-9 bg-background border text-xs">
              <SelectValue placeholder="Choisir un emplacement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs">Zone commune / non applicable</SelectItem>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={String(room.id)} className="text-xs">
                  Chambre {room.numero} — {room.roomType.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground">
            L'affectation d'une chambre à un ticket de maintenance la bloquera automatiquement en statut "En maintenance".
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-left">
          <Label htmlFor="typePanne" className="text-xs font-semibold text-muted-foreground uppercase">
            Type de panne / Signalement
          </Label>
          <Input
            id="typePanne"
            value={typePanne}
            onChange={(e) => setTypePanne(e.target.value)}
            placeholder="Ex: Climatisation fait du bruit, ampoule grillée..."
            required
            className="h-9 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5 text-left">
          <Label htmlFor="priorite" className="text-xs font-semibold text-muted-foreground uppercase">
            Niveau de Priorité
          </Label>
          <Select
            value={priorite}
            onValueChange={(v) => v && setPriorite(v as PrioriteTicket)}
            items={PRIORITES.map((p) => ({
              value: p,
              label: PRIORITE_LABEL[p],
            }))}
          >
            <SelectTrigger id="priorite" className="w-full h-9 bg-background border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITES.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  {PRIORITE_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 text-left">
          <Label htmlFor="assigneA" className="text-xs font-semibold text-muted-foreground uppercase">
            Technicien assigné
          </Label>
          <Input
            id="assigneA"
            value={assigneA}
            onChange={(e) => setAssigneA(e.target.value)}
            placeholder="Nom du technicien ou de l'entreprise"
            className="h-9 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5 text-left">
          <Label htmlFor="photoUrl" className="text-xs font-semibold text-muted-foreground uppercase">
            URL de photo justificative
          </Label>
          <Input
            id="photoUrl"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="Lien d'image d'illustration de la panne"
            className="h-9 text-xs"
          />
        </div>

        {error && <p className="text-destructive text-xs mt-1 text-center font-semibold">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-0 mt-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="h-9 text-xs font-semibold"
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting || !typePanne} className="h-9 text-xs font-bold">
            {submitting ? (
              <>
                <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Création...
              </>
            ) : (
              "Créer le ticket"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
