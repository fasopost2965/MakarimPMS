import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  Building,
  BedDouble,
  Image as ImageIcon,
  List,
  LayoutGrid,
  ExternalLink,
  Kanban,
  Edit,
  RotateCcw,
  GripVertical,
  Printer,
} from "lucide-react";
import { WorkOrderPrintModal } from "../components/WorkOrderPrintModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTicket,
  listRooms,
  listTickets,
  resolveTicket,
  unresolveTicket,
  updateTicket,
} from "../api";
import { CreateTicketDialog } from "../components/CreateTicketDialog";
import { EditTicketDialog } from "../components/EditTicketDialog";
import type {
  CreateMaintenanceTicketInput,
  MaintenanceTicket,
  PrioriteTicket,
  UpdateMaintenanceTicketInput,
} from "../types";
import type { Room } from "../../reservations/types";

const PRIORITE_LABEL: Record<PrioriteTicket, string> = {
  BASSE: "Basse",
  MOYENNE: "Moyenne",
  HAUTE: "Haute",
  URGENTE: "Urgente",
};

const PRIORITE_BADGE_CLASS: Record<PrioriteTicket, string> = {
  BASSE:
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  MOYENNE:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 font-semibold",
  HAUTE:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 font-bold",
  URGENTE:
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 font-bold animate-pulse",
};

const PRIORITE_CARD_BORDER: Record<PrioriteTicket, string> = {
  BASSE: "border-l-slate-400",
  MOYENNE: "border-l-blue-500",
  HAUTE: "border-l-amber-500",
  URGENTE: "border-l-rose-600 bg-rose-50/10 dark:bg-rose-950/10",
};

export function MaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Dialog & Form states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<MaintenanceTicket | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Print ticket state
  const [printingTicket, setPrintingTicket] =
    useState<MaintenanceTicket | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const handlePrintTicket = (ticket: MaintenanceTicket) => {
    setPrintingTicket(ticket);
    setPrintModalOpen(true);
  };

  // Filters & Views
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL"); // "ALL" | "OPEN" | "RESOLVED"
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [locationFilter, setLocationFilter] = useState<string>("ALL"); // "ALL" | "ROOMS" | "COMMON"
  const [viewMode, setViewMode] = useState<"kanban" | "grid" | "table">(
    "kanban",
  );

  // Drag & drop state
  const [draggedTicketId, setDraggedTicketId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  async function handleResolve(id: number) {
    setActionError(null);
    setProcessingId(id);
    try {
      await resolveTicket(id);
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erreur lors de la résolution",
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleUnresolve(id: number) {
    setActionError(null);
    setProcessingId(id);
    try {
      await unresolveTicket(id);
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erreur lors de la réouverture",
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCreate(input: CreateMaintenanceTicketInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await createTicket(input);
      setCreateDialogOpen(false);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id: number, input: UpdateMaintenanceTicketInput) {
    setFormError(null);
    setSubmitting(true);
    try {
      await updateTicket(id, input);
      setEditingTicket(null);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Erreur lors de la modification",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Drag & Drop move
  async function handleDropOnColumn(
    targetColumn: "OPEN_NORMAL" | "OPEN_URGENT" | "RESOLVED",
  ) {
    if (!draggedTicketId) return;
    const ticket = tickets.find((t) => t.id === draggedTicketId);
    if (!ticket) return;

    setProcessingId(ticket.id);
    setActionError(null);

    try {
      if (targetColumn === "RESOLVED") {
        if (!ticket.resoluAt) {
          await resolveTicket(ticket.id);
        }
      } else if (targetColumn === "OPEN_URGENT") {
        if (ticket.resoluAt) {
          await unresolveTicket(ticket.id);
        }
        if (ticket.priorite !== "URGENTE" && ticket.priorite !== "HAUTE") {
          await updateTicket(ticket.id, { priorite: "HAUTE" });
        }
      } else if (targetColumn === "OPEN_NORMAL") {
        if (ticket.resoluAt) {
          await unresolveTicket(ticket.id);
        }
        if (ticket.priorite === "URGENTE" || ticket.priorite === "HAUTE") {
          await updateTicket(ticket.id, { priorite: "MOYENNE" });
        }
      }
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Erreur lors du déplacement du ticket",
      );
    } finally {
      setProcessingId(null);
      setDraggedTicketId(null);
      setDragOverColumn(null);
    }
  }

  // KPIs
  const kpis = useMemo(() => {
    const total = tickets.length;
    const openCount = tickets.filter((t) => !t.resoluAt).length;
    const urgentCount = tickets.filter(
      (t) =>
        !t.resoluAt && (t.priorite === "URGENTE" || t.priorite === "HAUTE"),
    ).length;
    const resolvedCount = tickets.filter((t) => t.resoluAt).length;
    const blockedRooms = rooms.filter(
      (r) => r.statut === "EN_MAINTENANCE",
    ).length;

    return { total, openCount, urgentCount, resolvedCount, blockedRooms };
  }, [tickets, rooms]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Search
      const roomNum = ticket.room?.numero || "";
      const matchSearch =
        search === "" ||
        ticket.typePanne.toLowerCase().includes(search.toLowerCase()) ||
        roomNum.toLowerCase().includes(search.toLowerCase()) ||
        (ticket.assigneA &&
          ticket.assigneA.toLowerCase().includes(search.toLowerCase()));

      // Status
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "OPEN" && !ticket.resoluAt) ||
        (statusFilter === "RESOLVED" && Boolean(ticket.resoluAt));

      // Priority
      const matchPriority =
        priorityFilter === "ALL" || ticket.priorite === priorityFilter;

      // Location
      const matchLocation =
        locationFilter === "ALL" ||
        (locationFilter === "ROOMS" && ticket.roomId !== null) ||
        (locationFilter === "COMMON" && ticket.roomId === null);

      return matchSearch && matchStatus && matchPriority && matchLocation;
    });
  }, [tickets, search, statusFilter, priorityFilter, locationFilter]);

  // Kanban Categorization
  const kanbanColumns = useMemo(() => {
    const openNormal = filteredTickets.filter(
      (t) =>
        !t.resoluAt && (t.priorite === "BASSE" || t.priorite === "MOYENNE"),
    );
    const openUrgent = filteredTickets.filter(
      (t) =>
        !t.resoluAt && (t.priorite === "HAUTE" || t.priorite === "URGENTE"),
    );
    const resolved = filteredTickets.filter((t) => Boolean(t.resoluAt));

    return [
      {
        key: "OPEN_NORMAL" as const,
        title: "À Traiter (Priorité Normale)",
        icon: <Clock className="size-4 text-amber-500" />,
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
        tickets: openNormal,
      },
      {
        key: "OPEN_URGENT" as const,
        title: "Interventions Urgentes / Hautes",
        icon: <AlertTriangle className="size-4 text-rose-500 animate-pulse" />,
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
        tickets: openUrgent,
      },
      {
        key: "RESOLVED" as const,
        title: "Résolus & Clôturés",
        icon: <CheckCircle2 className="size-4 text-emerald-500" />,
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
        tickets: resolved,
      },
    ];
  }, [filteredTickets]);

  return (
    <div className="flex h-full flex-col gap-5 p-6 bg-muted/10 overflow-y-auto">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Wrench className="size-6 text-amber-600 dark:text-amber-400" />
              <span>Maintenance & Incidents Techniques</span>
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200"
            >
              Hôtel Makarim
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Suivi centralisé des interventions, blocages de chambres et pannes
            techniques
          </p>
        </div>

        {/* HEADER ACTIONS */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Actualiser</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setFormError(null);
              setCreateDialogOpen(true);
            }}
            className="gap-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow"
          >
            <Plus className="size-4" />
            <span>Nouveau Ticket d'Incident</span>
          </Button>
        </div>
      </div>

      {/* ERROR ALERTS */}
      {loadError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs font-medium">
          {loadError}
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs font-medium">
          {actionError}
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* TOTAL TICKETS */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("ALL");
            setPriorityFilter("ALL");
          }}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-primary/50 ${
            statusFilter === "ALL" && priorityFilter === "ALL"
              ? "ring-2 ring-primary border-primary"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Tickets
            </span>
            <Wrench className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-extrabold text-foreground mt-1 font-mono">
            {kpis.total}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Historique complet
          </p>
        </button>

        {/* TICKETS OUVERTS */}
        <button
          type="button"
          onClick={() => setStatusFilter("OPEN")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-amber-500/50 ${
            statusFilter === "OPEN"
              ? "ring-2 ring-amber-500 border-amber-500 bg-amber-50/20"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              En Cours / Ouverts
            </span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 font-mono">
            {kpis.openCount}
          </p>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 font-medium">
            Interventions actives
          </p>
        </button>

        {/* TICKETS URGENTS */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("OPEN");
            setPriorityFilter("URGENTE");
          }}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-rose-500/50 ${
            priorityFilter === "URGENTE"
              ? "ring-2 ring-rose-500 border-rose-500 bg-rose-50/20"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Haute / Urgente
            </span>
            <AlertTriangle className="size-4 text-rose-500 animate-pulse" />
          </div>
          <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 font-mono">
            {kpis.urgentCount}
          </p>
          <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 font-medium">
            Priorités critiques
          </p>
        </button>

        {/* TICKETS RESOLUS */}
        <button
          type="button"
          onClick={() => setStatusFilter("RESOLVED")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-emerald-500/50 ${
            statusFilter === "RESOLVED"
              ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Résolus
            </span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {kpis.resolvedCount}
          </p>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 font-medium">
            Incidents clôturés
          </p>
        </button>

        {/* CHAMBRES BLOQUEES */}
        <div className="p-3.5 rounded-xl border text-left bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Chambres Hors Service
            </span>
            <BedDouble className="size-4 text-purple-500" />
          </div>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1 font-mono">
            {kpis.blockedRooms}
          </p>
          <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-0.5 font-medium">
            En maintenance
          </p>
        </div>
      </div>

      {/* FILTER & CONTROL BAR */}
      <div className="rounded-xl border bg-card p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* LEFT SEARCH & SELECTS */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* SEARCH INPUT */}
          <div className="relative min-w-[200px] flex-1 md:flex-initial">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher incident, chambre, technicien…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* STATUS FILTER */}
          <Select
            value={statusFilter}
            onValueChange={(val) => val && setStatusFilter(val)}
            items={[
              { value: "ALL", label: "Tous les tickets" },
              { value: "OPEN", label: "Tickets Ouverts" },
              { value: "RESOLVED", label: "Tickets Résolus" },
            ]}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les tickets</SelectItem>
              <SelectItem value="OPEN">Tickets Ouverts</SelectItem>
              <SelectItem value="RESOLVED">Tickets Résolus</SelectItem>
            </SelectContent>
          </Select>

          {/* PRIORITY FILTER */}
          <Select
            value={priorityFilter}
            onValueChange={(val) => val && setPriorityFilter(val)}
            items={[
              { value: "ALL", label: "Toutes priorités" },
              { value: "URGENTE", label: "Urgente" },
              { value: "HAUTE", label: "Haute" },
              { value: "MOYENNE", label: "Moyenne" },
              { value: "BASSE", label: "Basse" },
            ]}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Priorité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes priorités</SelectItem>
              <SelectItem value="URGENTE">Urgente</SelectItem>
              <SelectItem value="HAUTE">Haute</SelectItem>
              <SelectItem value="MOYENNE">Moyenne</SelectItem>
              <SelectItem value="BASSE">Basse</SelectItem>
            </SelectContent>
          </Select>

          {/* LOCATION FILTER */}
          <Select
            value={locationFilter}
            onValueChange={(val) => val && setLocationFilter(val)}
            items={[
              { value: "ALL", label: "Tous emplacements" },
              { value: "ROOMS", label: "Chambres uniquement" },
              { value: "COMMON", label: "Zones communes" },
            ]}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Emplacement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous emplacements</SelectItem>
              <SelectItem value="ROOMS">Chambres uniquement</SelectItem>
              <SelectItem value="COMMON">Zones communes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* RIGHT VIEW SWITCHER */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-muted-foreground text-[11px] font-medium hidden sm:inline">
            Affichage :
          </span>
          <div className="flex items-center border rounded-lg p-0.5 bg-muted/40">
            <Button
              type="button"
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="h-7 px-2.5 text-[11px] gap-1"
            >
              <Kanban className="size-3.5" />
              <span>Kanban Drag&Drop</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-7 px-2.5 text-[11px] gap-1"
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Grille</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-7 px-2.5 text-[11px] gap-1"
            >
              <List className="size-3.5" />
              <span className="hidden sm:inline">Tableau</span>
            </Button>
          </div>
        </div>
      </div>

      {/* CONTENT LISTING */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
          <RefreshCw className="size-8 animate-spin text-primary" />
          <span>Chargement des registres d'incidents…</span>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="py-16 border rounded-xl bg-card text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
          <Wrench className="size-10 text-muted-foreground/60" />
          <p className="font-bold text-foreground text-sm">
            Aucun ticket de maintenance ne correspond aux critères
          </p>
          <p className="text-muted-foreground">
            Modifiez vos filtres ou signalez une nouvelle panne.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("ALL");
              setPriorityFilter("ALL");
              setLocationFilter("ALL");
            }}
            className="mt-2 text-xs"
          >
            Réinitialiser les filtres
          </Button>
        </div>
      ) : viewMode === "kanban" ? (
        /* KANBAN BOARD DRAG AND DROP VIEW */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {kanbanColumns.map((col) => {
            const isOver = dragOverColumn === col.key;

            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverColumn(col.key);
                }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleDropOnColumn(col.key);
                }}
                className={`flex flex-col gap-3 rounded-2xl border p-3.5 transition-all min-h-[500px] ${
                  isOver
                    ? "bg-primary/5 border-primary ring-2 ring-primary/40 shadow-lg scale-[1.01]"
                    : "bg-card/80 border-border"
                }`}
              >
                {/* COLUMN HEADER */}
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-2">
                    {col.icon}
                    <h3 className="font-bold text-xs text-foreground">
                      {col.title}
                    </h3>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${col.badgeClass}`}
                  >
                    {col.tickets.length}
                  </Badge>
                </div>

                {/* DRAG AND DROP DROP ZONE INFO */}
                {col.tickets.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-[11px] border border-dashed rounded-xl flex flex-col items-center justify-center gap-1 my-auto">
                    <p>Déposez un ticket ici</p>
                    <span className="text-[9px] opacity-70">
                      Glisser & déposer pour modifier
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {col.tickets.map((ticket) => {
                      const isResolved = Boolean(ticket.resoluAt);
                      const isProcessing = processingId === ticket.id;

                      return (
                        <div
                          key={ticket.id}
                          draggable={!isProcessing}
                          onDragStart={(e) => {
                            setDraggedTicketId(ticket.id);
                            e.dataTransfer.setData(
                              "text/plain",
                              String(ticket.id),
                            );
                          }}
                          className={`bg-card rounded-xl border border-l-4 p-3.5 transition-all flex flex-col gap-2.5 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing group ${
                            PRIORITE_CARD_BORDER[ticket.priorite]
                          } ${draggedTicketId === ticket.id ? "opacity-50 scale-95" : ""}`}
                        >
                          {/* CARD HEADER & DRAG HANDLE */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <GripVertical className="size-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
                              {ticket.room ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-bold gap-1 bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-800 dark:text-amber-300"
                                >
                                  <BedDouble className="size-3" />
                                  <span>#{ticket.room.numero}</span>
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-bold gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                  <Building className="size-3" />
                                  <span>Espace Commun</span>
                                </Badge>
                              )}

                              <Badge
                                className={`text-[9px] ${
                                  PRIORITE_BADGE_CLASS[ticket.priorite]
                                }`}
                              >
                                {PRIORITE_LABEL[ticket.priorite]}
                              </Badge>
                            </div>

                            {/* EDIT BUTTON */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setFormError(null);
                                setEditingTicket(ticket);
                              }}
                              className="size-6 p-0 text-muted-foreground hover:text-foreground"
                              title="Modifier ce ticket"
                            >
                              <Edit className="size-3.5" />
                            </Button>
                          </div>

                          {/* PANNE DESCRIPTION */}
                          <p className="font-semibold text-xs text-foreground leading-snug">
                            {ticket.typePanne}
                          </p>

                          {/* TECHNICIAN & CREATED DATE */}
                          <div className="flex flex-col gap-1 text-[10px] text-muted-foreground pt-1.5 border-t">
                            <div className="flex items-center justify-between">
                              <span className="font-mono">
                                {new Date(ticket.createdAt).toLocaleDateString(
                                  "fr-FR",
                                )}
                              </span>
                              <span className="font-mono font-bold">
                                #{ticket.id}
                              </span>
                            </div>

                            {ticket.assigneA && (
                              <p className="flex items-center gap-1 text-foreground font-medium truncate">
                                <UserCheck className="size-3 text-emerald-600 shrink-0" />
                                <span>{ticket.assigneA}</span>
                              </p>
                            )}
                          </div>

                          {/* CARD BOTTOM ACTIONS */}
                          <div className="flex items-center justify-between gap-1.5 pt-2 border-t">
                            <div className="flex items-center gap-1">
                              {ticket.photoUrl && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setPreviewPhotoUrl(ticket.photoUrl)
                                  }
                                  className="h-6 text-[10px] gap-1 text-blue-600 px-1.5"
                                >
                                  <ImageIcon className="size-3" />
                                  <span>Photo</span>
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handlePrintTicket(ticket)}
                                className="h-6 text-[10px] gap-1 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 px-1.5 font-medium"
                                title="Imprimer Bon de Travail pour la chambre"
                              >
                                <Printer className="size-3 text-amber-600" />
                                <span>Imprimer</span>
                              </Button>
                            </div>

                            {isResolved ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() => handleUnresolve(ticket.id)}
                                className="h-6 text-[10px] gap-1 text-amber-700 dark:text-amber-300 border-amber-300 px-2"
                              >
                                <RotateCcw className="size-3" />
                                <span>Rouvrir</span>
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() => handleResolve(ticket.id)}
                                className="h-6 text-[10px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                              >
                                {isProcessing ? (
                                  <RefreshCw className="size-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="size-3" />
                                )}
                                <span>Résoudre</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : viewMode === "grid" ? (
        /* GRID CARDS VIEW */
        <div className="grid gap-3.5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredTickets.map((ticket) => {
            const isResolved = Boolean(ticket.resoluAt);
            const isProcessing = processingId === ticket.id;

            return (
              <div
                key={ticket.id}
                className={`bg-card rounded-xl border border-l-4 p-4 transition-all flex flex-col justify-between gap-3 shadow-sm hover:shadow-md ${
                  PRIORITE_CARD_BORDER[ticket.priorite]
                }`}
              >
                {/* HEADER */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ticket.room ? (
                        <Badge
                          variant="outline"
                          className="text-xs font-bold gap-1 bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-800 dark:text-amber-300"
                        >
                          <BedDouble className="size-3" />
                          <span>Chambre #{ticket.room.numero}</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs font-bold gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          <Building className="size-3" />
                          <span>Zone Commune</span>
                        </Badge>
                      )}

                      <Badge
                        className={`text-[10px] ${
                          PRIORITE_BADGE_CLASS[ticket.priorite]
                        }`}
                      >
                        {PRIORITE_LABEL[ticket.priorite]}
                      </Badge>
                    </div>

                    <p className="font-bold text-sm text-foreground mt-1 leading-snug">
                      {ticket.typePanne}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormError(null);
                        setEditingTicket(ticket);
                      }}
                      className="size-7 p-0"
                      title="Modifier"
                    >
                      <Edit className="size-3.5" />
                    </Button>
                    <Badge
                      variant={isResolved ? "success" : "warning"}
                      className="text-[10px] font-semibold"
                    >
                      {isResolved ? "Résolu" : "Ouvert"}
                    </Badge>
                  </div>
                </div>

                {/* DETAILS & METADATA */}
                <div className="flex flex-col gap-1.5 pt-2 border-t text-[11px] text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="size-3" />
                      {new Date(ticket.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="font-mono text-[10px]">
                      Ticket #{ticket.id}
                    </span>
                  </div>

                  {ticket.assigneA && (
                    <p className="flex items-center gap-1 text-foreground font-medium">
                      <UserCheck className="size-3 text-emerald-600" />
                      <span>Assigné à : {ticket.assigneA}</span>
                    </p>
                  )}

                  {isResolved && ticket.resoluAt && (
                    <p className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-lg text-[10px] flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
                      <span>
                        Résolu le :{" "}
                        {new Date(ticket.resoluAt).toLocaleString("fr-FR")}
                      </span>
                    </p>
                  )}
                </div>

                {/* FOOTER ACTIONS & PHOTO LINK */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  {ticket.photoUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewPhotoUrl(ticket.photoUrl)}
                      className="h-7 text-[11px] gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <ImageIcon className="size-3.5" />
                      <span>Voir Photo</span>
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">
                      Pas de photo
                    </span>
                  )}

                  {isResolved ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => handleUnresolve(ticket.id)}
                      className="h-7 text-[11px] gap-1 border-amber-300 text-amber-800 dark:text-amber-300"
                    >
                      <RotateCcw className="size-3" />
                      <span>Rouvrir</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => handleResolve(ticket.id)}
                      className="h-7 text-[11px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isProcessing ? (
                        <RefreshCw className="size-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3" />
                      )}
                      <span>Marquer Résolu</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">Ticket</th>
                  <th className="p-3">Emplacement</th>
                  <th className="p-3">Description / Panne</th>
                  <th className="p-3">Priorité</th>
                  <th className="p-3">Technicien</th>
                  <th className="p-3">Statut & Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTickets.map((ticket) => {
                  const isResolved = Boolean(ticket.resoluAt);
                  const isProcessing = processingId === ticket.id;

                  return (
                    <tr
                      key={ticket.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 font-mono font-bold text-foreground">
                        #{ticket.id}
                      </td>
                      <td className="p-3">
                        {ticket.room ? (
                          <Badge variant="outline" className="font-bold">
                            Chambre #{ticket.room.numero}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground italic">
                            Zone commune
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-foreground max-w-xs truncate">
                        {ticket.typePanne}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`text-[10px] ${
                            PRIORITE_BADGE_CLASS[ticket.priorite]
                          }`}
                        >
                          {PRIORITE_LABEL[ticket.priorite]}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground font-medium">
                        {ticket.assigneA || "Non assigné"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant={isResolved ? "success" : "warning"}
                            className="text-[10px] w-fit"
                          >
                            {isResolved ? "Résolu" : "Ouvert"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(ticket.createdAt).toLocaleDateString(
                              "fr-FR",
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFormError(null);
                              setEditingTicket(ticket);
                            }}
                            className="h-7 text-[11px] gap-1"
                          >
                            <Edit className="size-3" />
                            <span>Modifier</span>
                          </Button>

                          {!isResolved ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={isProcessing}
                              onClick={() => handleResolve(ticket.id)}
                              className="h-7 text-[11px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {isProcessing ? (
                                <RefreshCw className="size-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="size-3" />
                              )}
                              <span>Résoudre</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isProcessing}
                              onClick={() => handleUnresolve(ticket.id)}
                              className="h-7 text-[11px] gap-1"
                            >
                              <RotateCcw className="size-3" />
                              <span>Rouvrir</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE TICKET DIALOG */}
      <CreateTicketDialog
        open={createDialogOpen}
        rooms={rooms}
        onClose={() => setCreateDialogOpen(false)}
        onConfirm={handleCreate}
        submitting={submitting}
        error={formError}
      />

      {/* EDIT TICKET DIALOG */}
      <EditTicketDialog
        open={editingTicket !== null}
        ticket={editingTicket}
        rooms={rooms}
        onClose={() => setEditingTicket(null)}
        onConfirm={handleUpdate}
        submitting={submitting}
        error={formError}
      />

      {/* PHOTO PREVIEW DIALOG */}
      <Dialog
        open={previewPhotoUrl !== null}
        onOpenChange={(next) => !next && setPreviewPhotoUrl(null)}
      >
        <DialogContent className="sm:max-w-md max-w-[calc(100%-1rem)] p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <ImageIcon className="size-4 text-primary" />
              <span>Photo illustrative de l'incident</span>
            </DialogTitle>
          </DialogHeader>

          {previewPhotoUrl && (
            <div className="mt-2 flex flex-col gap-3">
              <div className="rounded-xl overflow-hidden border bg-black/5 flex items-center justify-center max-h-[60vh]">
                <img
                  src={previewPhotoUrl}
                  alt="Illustration incident"
                  className="object-contain max-h-[60vh] w-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://placehold.co/600x400?text=Image+Indisponible";
                  }}
                />
              </div>

              <div className="flex justify-between items-center text-xs">
                <a
                  href={previewPhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Ouvrir dans un nouvel onglet</span>
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewPhotoUrl(null)}
                >
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PRINT WORK ORDER DIALOG */}
      <WorkOrderPrintModal
        ticket={printingTicket}
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
      />
    </div>
  );
}
