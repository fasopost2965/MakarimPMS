import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  Brush,
  CheckCircle2,
  Wrench,
  BedDouble,
  Search,
  RefreshCw,
  History,
  Layers,
  LayoutGrid,
  List,
  CheckSquare,
  Square,
  Building,
  Info,
  Kanban,
  GripVertical,
} from "lucide-react";
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
import { listRooms, updateRoomStatus } from "../api";
import { RoomHistoryDialog } from "../components/RoomHistoryDialog";
import type { Room, StatutChambre } from "../../reservations/types";

// Statuts pilotables manuellement par la gouvernance
const STATUTS_MANUELS: StatutChambre[] = [
  "A_NETTOYER",
  "EN_NETTOYAGE",
  "LIBRE_PROPRE",
  "EN_MAINTENANCE",
];

// Statuts pilotés automatiquement par le système (check-in, check-out, réservation)
const NON_MODIFIABLE_MANUELLEMENT: Partial<Record<StatutChambre, string>> = {
  RESERVEE: "Géré via Check-in",
  OCCUPEE: "Géré via Check-out",
  DEPART_PREVU: "Géré via Check-out",
};

const STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: "Libre & propre",
  RESERVEE: "Réservée",
  OCCUPEE: "Occupée",
  DEPART_PREVU: "Départ prévu",
  A_NETTOYER: "À nettoyer",
  EN_NETTOYAGE: "En nettoyage",
  EN_MAINTENANCE: "En maintenance",
};

const STATUT_BADGE_VARIANT: Record<
  StatutChambre,
  "success" | "info" | "destructive" | "warning" | "secondary"
> = {
  LIBRE_PROPRE: "success",
  RESERVEE: "info",
  OCCUPEE: "destructive",
  DEPART_PREVU: "info",
  A_NETTOYER: "warning",
  EN_NETTOYAGE: "warning",
  EN_MAINTENANCE: "destructive",
};

const STATUT_BORDER_CLASS: Record<StatutChambre, string> = {
  LIBRE_PROPRE: "border-l-emerald-500",
  RESERVEE: "border-l-blue-500",
  OCCUPEE: "border-l-purple-600",
  DEPART_PREVU: "border-l-amber-500",
  A_NETTOYER: "border-l-orange-500",
  EN_NETTOYAGE: "border-l-sky-500",
  EN_MAINTENANCE: "border-l-rose-500",
};

function getFloorLabel(numero: string): string {
  if (numero.startsWith("1")) return "1er Étage";
  if (numero.startsWith("2")) return "2ème Étage";
  if (numero.startsWith("3")) return "3ème Étage";
  if (numero.startsWith("4")) return "4ème Étage";
  return "Rez-de-chaussée";
}

export function HousekeepingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingRoomId, setUpdatingRoomId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyRoom, setHistoryRoom] = useState<Room | null>(null);

  // Filters & State
  const [search, setSearch] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<string>("ALL");
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>("ALL");
  const [selectedRoomType, setSelectedRoomType] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"kanban" | "grid" | "floors" | "table">(
    "kanban",
  );

  // Drag & drop state
  const [draggedRoomId, setDraggedRoomId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  async function handleDropOnColumn(targetStatus: StatutChambre) {
    if (!draggedRoomId) return;
    const roomId = draggedRoomId;
    setDraggedRoomId(null);
    setDragOverColumn(null);
    await handleChange(roomId, targetStatus);
  }

  // Selection for batch actions
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [batchTargetStatus, setBatchTargetStatus] =
    useState<StatutChambre>("LIBRE_PROPRE");
  const [batchUpdating, setBatchUpdating] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRooms(await listRooms());
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

  async function handleChange(roomId: number, statut: StatutChambre) {
    setActionError(null);
    setUpdatingRoomId(roomId);
    try {
      await updateRoomStatus(roomId, statut);
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erreur de mise à jour du statut",
      );
    } finally {
      setUpdatingRoomId(null);
    }
  }

  // Handle batch status change
  async function handleBatchChange() {
    if (selectedRoomIds.length === 0) return;
    setActionError(null);
    setBatchUpdating(true);
    try {
      for (const id of selectedRoomIds) {
        await updateRoomStatus(id, batchTargetStatus);
      }
      setSelectedRoomIds([]);
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la mise à jour groupée",
      );
    } finally {
      setBatchUpdating(false);
    }
  }

  // Metric counts
  const kpis = useMemo(() => {
    const total = rooms.length;
    const toClean = rooms.filter((r) => r.statut === "A_NETTOYER").length;
    const cleaning = rooms.filter((r) => r.statut === "EN_NETTOYAGE").length;
    const cleanReady = rooms.filter((r) => r.statut === "LIBRE_PROPRE").length;
    const occupied = rooms.filter(
      (r) =>
        r.statut === "OCCUPEE" ||
        r.statut === "RESERVEE" ||
        r.statut === "DEPART_PREVU",
    ).length;
    const maintenance = rooms.filter(
      (r) => r.statut === "EN_MAINTENANCE",
    ).length;

    return { total, toClean, cleaning, cleanReady, occupied, maintenance };
  }, [rooms]);

  // Unique room types
  const roomTypes = useMemo(() => {
    const map = new Map<number, string>();
    rooms.forEach((r) => {
      if (r.roomType) map.set(r.roomType.id, r.roomType.nom);
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }));
  }, [rooms]);

  // Unique floors
  const floors = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => set.add(getFloorLabel(r.numero)));
    return Array.from(set).sort();
  }, [rooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchSearch =
        search === "" ||
        room.numero.toLowerCase().includes(search.toLowerCase()) ||
        room.roomType.nom.toLowerCase().includes(search.toLowerCase());

      const matchFloor =
        selectedFloor === "ALL" || getFloorLabel(room.numero) === selectedFloor;

      const matchStatus =
        selectedStatusTab === "ALL" || room.statut === selectedStatusTab;

      const matchType =
        selectedRoomType === "ALL" ||
        room.roomType.id.toString() === selectedRoomType;

      return matchSearch && matchFloor && matchStatus && matchType;
    });
  }, [rooms, search, selectedFloor, selectedStatusTab, selectedRoomType]);

  // Group rooms by floor for matrix view
  const roomsByFloor = useMemo(() => {
    const map: Record<string, Room[]> = {};
    floors.forEach((f) => {
      map[f] = filteredRooms.filter((r) => getFloorLabel(r.numero) === f);
    });
    return map;
  }, [floors, filteredRooms]);

  const toggleSelectRoom = (id: number) => {
    setSelectedRoomIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    const manualFilteredIds = filteredRooms
      .filter((r) => STATUTS_MANUELS.includes(r.statut))
      .map((r) => r.id);

    if (selectedRoomIds.length === manualFilteredIds.length) {
      setSelectedRoomIds([]);
    } else {
      setSelectedRoomIds(manualFilteredIds);
    }
  };

  return (
    <div className="flex h-full flex-col gap-5 p-6 bg-muted/10 overflow-y-auto">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="size-6 text-amber-500" />
              <span>Gouvernance & Housekeeping</span>
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200"
            >
              Hôtel Makarim
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gestion en temps réel de la propreté, du nettoyage et de la
            disponibilité des chambres
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
        </div>
      </div>

      {/* ERRORS */}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* TOTAL */}
        <button
          type="button"
          onClick={() => setSelectedStatusTab("ALL")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-primary/50 ${
            selectedStatusTab === "ALL"
              ? "ring-2 ring-primary border-primary"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total
            </span>
            <BedDouble className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-extrabold text-foreground mt-1 font-mono">
            {kpis.total}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Toutes chambres
          </p>
        </button>

        {/* A NETTOYER */}
        <button
          type="button"
          onClick={() => setSelectedStatusTab("A_NETTOYER")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-orange-500/50 ${
            selectedStatusTab === "A_NETTOYER"
              ? "ring-2 ring-orange-500 border-orange-500 bg-orange-50/20"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
              À Nettoyer
            </span>
            <Brush className="size-4 text-orange-500" />
          </div>
          <p className="text-2xl font-extrabold text-orange-600 dark:text-orange-400 mt-1 font-mono">
            {kpis.toClean}
          </p>
          <p className="text-[10px] text-orange-600/80 dark:text-orange-400/80 mt-0.5 font-medium">
            Priorité gouvernance
          </p>
        </button>

        {/* EN NETTOYAGE */}
        <button
          type="button"
          onClick={() => setSelectedStatusTab("EN_NETTOYAGE")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-sky-500/50 ${
            selectedStatusTab === "EN_NETTOYAGE"
              ? "ring-2 ring-sky-500 border-sky-500 bg-sky-50/20"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              En Nettoyage
            </span>
            <RefreshCw className="size-4 text-sky-500 animate-spin" />
          </div>
          <p className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-1 font-mono">
            {kpis.cleaning}
          </p>
          <p className="text-[10px] text-sky-600/80 dark:text-sky-400/80 mt-0.5 font-medium">
            En cours par valets
          </p>
        </button>

        {/* LIBRE PROPRE */}
        <button
          type="button"
          onClick={() => setSelectedStatusTab("LIBRE_PROPRE")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-emerald-500/50 ${
            selectedStatusTab === "LIBRE_PROPRE"
              ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Libres & Propres
            </span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {kpis.cleanReady}
          </p>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 font-medium">
            Prêtes au check-in
          </p>
        </button>

        {/* OCCUPEES */}
        <button
          type="button"
          onClick={() => setSelectedStatusTab("OCCUPEE")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-purple-500/50 ${
            selectedStatusTab === "OCCUPEE"
              ? "ring-2 ring-purple-500 border-purple-500 bg-purple-50/20"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Occupées
            </span>
            <Building className="size-4 text-purple-500" />
          </div>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1 font-mono">
            {kpis.occupied}
          </p>
          <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-0.5 font-medium">
            Clients en séjour
          </p>
        </button>

        {/* MAINTENANCE */}
        <button
          type="button"
          onClick={() => setSelectedStatusTab("EN_MAINTENANCE")}
          className={`p-3.5 rounded-xl border text-left transition-all bg-card hover:border-rose-500/50 ${
            selectedStatusTab === "EN_MAINTENANCE"
              ? "ring-2 ring-rose-500 border-rose-500 bg-rose-50/20"
              : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Maintenance
            </span>
            <Wrench className="size-4 text-rose-500" />
          </div>
          <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 font-mono">
            {kpis.maintenance}
          </p>
          <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 font-medium">
            Hors service / Travaux
          </p>
        </button>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="rounded-xl border bg-card p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* LEFT SEARCH & FILTERS */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* SEARCH */}
          <div className="relative min-w-[200px] flex-1 md:flex-initial">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher N° ou type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* FLOOR FILTER */}
          <Select
            value={selectedFloor}
            onValueChange={(val) => val && setSelectedFloor(val)}
            items={[
              { value: "ALL", label: "Tous les étages" },
              ...floors.map((f) => ({ value: f, label: f })),
            ]}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Étage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les étages</SelectItem>
              {floors.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ROOM TYPE FILTER */}
          <Select
            value={selectedRoomType}
            onValueChange={(val) => val && setSelectedRoomType(val)}
            items={[
              { value: "ALL", label: "Tous les types" },
              ...roomTypes.map((t) => ({
                value: t.id.toString(),
                label: t.nom,
              })),
            ]}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Type de chambre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les types</SelectItem>
              {roomTypes.map((t) => (
                <SelectItem key={t.id.toString()} value={t.id.toString()}>
                  {t.nom}
                </SelectItem>
              ))}
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
              className="h-7 px-2.5 text-[11px] gap-1 font-bold text-amber-700 dark:text-amber-300"
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
              variant={viewMode === "floors" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("floors")}
              className="h-7 px-2.5 text-[11px] gap-1"
            >
              <Layers className="size-3.5" />
              <span className="hidden sm:inline">Par Étage</span>
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

      {/* BATCH OPERATION BAR (if rooms selected) */}
      {selectedRoomIds.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckSquare className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="font-bold text-foreground">
              {selectedRoomIds.length} chambre(s) sélectionnée(s)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium hidden sm:inline">
              Passer en :
            </span>
            <Select
              value={batchTargetStatus}
              onValueChange={(v) =>
                v && setBatchTargetStatus(v as StatutChambre)
              }
              items={STATUTS_MANUELS.map((s) => ({
                value: s,
                label: STATUT_LABEL[s],
              }))}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUTS_MANUELS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUT_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              size="sm"
              onClick={handleBatchChange}
              disabled={batchUpdating}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1"
            >
              {batchUpdating ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>Appliquer</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRoomIds([])}
              className="h-8 text-xs"
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* CONTENT AREA */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
          <RefreshCw className="size-8 animate-spin text-primary" />
          <span>Chargement du parc des chambres…</span>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="py-16 border rounded-xl bg-card text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
          <BedDouble className="size-10 text-muted-foreground/60" />
          <p className="font-bold text-foreground text-sm">
            Aucune chambre ne correspond aux critères
          </p>
          <p className="text-muted-foreground">
            Ajustez vos filtres de recherche ou sélectionnez un autre statut.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setSelectedFloor("ALL");
              setSelectedStatusTab("ALL");
              setSelectedRoomType("ALL");
            }}
            className="mt-2 text-xs"
          >
            Réinitialiser les filtres
          </Button>
        </div>
      ) : viewMode === "kanban" ? (
        /* KANBAN BOARD DRAG AND DROP VIEW */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {[
            {
              key: "A_NETTOYER" as StatutChambre,
              title: "À Nettoyer (En Attente)",
              icon: <Brush className="size-4 text-orange-500" />,
              badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
              rooms: filteredRooms.filter((r) => r.statut === "A_NETTOYER"),
            },
            {
              key: "EN_NETTOYAGE" as StatutChambre,
              title: "En Nettoyage (En Cours)",
              icon: <RefreshCw className="size-4 text-sky-500 animate-spin" />,
              badgeClass: "bg-sky-100 text-sky-800 border-sky-300",
              rooms: filteredRooms.filter((r) => r.statut === "EN_NETTOYAGE"),
            },
            {
              key: "LIBRE_PROPRE" as StatutChambre,
              title: "Libres & Propres (Terminé)",
              icon: <CheckCircle2 className="size-4 text-emerald-500" />,
              badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
              rooms: filteredRooms.filter((r) => r.statut === "LIBRE_PROPRE"),
            },
          ].map((col) => {
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
                className={`flex flex-col gap-3 rounded-2xl border p-3.5 transition-all min-h-[520px] ${
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
                    {col.rooms.length}
                  </Badge>
                </div>

                {/* DRAG DROP ZONE INFO */}
                {col.rooms.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-[11px] border border-dashed rounded-xl flex flex-col items-center justify-center gap-1 my-auto">
                    <p>Glissez une chambre ici</p>
                    <span className="text-[9px] opacity-70">
                      Déposer pour mettre à jour le statut
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {col.rooms.map((room) => {
                      const isUpdating = updatingRoomId === room.id;

                      return (
                        <div
                          key={room.id}
                          draggable={!isUpdating}
                          onDragStart={(e) => {
                            setDraggedRoomId(room.id);
                            e.dataTransfer.setData(
                              "text/plain",
                              String(room.id),
                            );
                          }}
                          className={`bg-card rounded-xl border border-l-4 p-3.5 transition-all flex flex-col gap-2.5 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing group ${
                            STATUT_BORDER_CLASS[room.statut]
                          } ${draggedRoomId === room.id ? "opacity-50 scale-95" : ""}`}
                        >
                          {/* ROOM CARD HEADER */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <GripVertical className="size-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
                              <Badge
                                variant="outline"
                                className="text-xs font-bold gap-1 bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-800 dark:text-amber-300"
                              >
                                <BedDouble className="size-3" />
                                <span>Chambre #{room.numero}</span>
                              </Badge>
                            </div>

                            <Badge
                              variant={STATUT_BADGE_VARIANT[room.statut]}
                              className="text-[9px] font-bold"
                            >
                              {STATUT_LABEL[room.statut]}
                            </Badge>
                          </div>

                          {/* TYPE & FLOOR */}
                          <div className="text-xs font-medium text-foreground flex items-center justify-between">
                            <span>{room.roomType.nom}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {getFloorLabel(room.numero)}
                            </span>
                          </div>

                          {/* QUICK ACTION BUTTONS */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setHistoryRoom(room)}
                              className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground px-1.5"
                            >
                              <History className="size-3" />
                              <span>Historique</span>
                            </Button>

                            {room.statut === "A_NETTOYER" && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={isUpdating}
                                onClick={() => handleChange(room.id, "EN_NETTOYAGE")}
                                className="h-6 text-[10px] font-bold bg-sky-600 hover:bg-sky-700 text-white px-2"
                              >
                                {isUpdating ? (
                                  <RefreshCw className="size-3 animate-spin" />
                                ) : (
                                  <span>Démarrer</span>
                                )}
                              </Button>
                            )}

                            {room.statut === "EN_NETTOYAGE" && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={isUpdating}
                                onClick={() => handleChange(room.id, "LIBRE_PROPRE")}
                                className="h-6 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                              >
                                {isUpdating ? (
                                  <RefreshCw className="size-3 animate-spin" />
                                ) : (
                                  <span>Valider Propre</span>
                                )}
                              </Button>
                            )}

                            {room.statut === "LIBRE_PROPRE" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isUpdating}
                                onClick={() => handleChange(room.id, "A_NETTOYER")}
                                className="h-6 text-[10px] text-orange-700 border-orange-300 px-2"
                              >
                                <span>Remettre à nettoyer</span>
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
        /* GRID VIEW */
        <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredRooms.map((room) => {
            const floor = getFloorLabel(room.numero);
            const isSelected = selectedRoomIds.includes(room.id);
            const isManual = STATUTS_MANUELS.includes(room.statut);

            return (
              <div
                key={room.id}
                className={`bg-card rounded-xl border border-l-4 p-4 transition-all flex flex-col justify-between gap-3 shadow-sm hover:shadow-md ${
                  STATUT_BORDER_CLASS[room.statut]
                } ${isSelected ? "ring-2 ring-primary border-primary bg-primary/5" : ""}`}
              >
                {/* CARD HEADER */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isManual && (
                      <button
                        type="button"
                        onClick={() => toggleSelectRoom(room.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isSelected ? (
                          <CheckSquare className="size-4 text-primary" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-base text-foreground font-mono">
                          #{room.numero}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 font-normal"
                        >
                          {floor}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {room.roomType.nom} ({room.roomType.prixBase} MAD)
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setHistoryRoom(room)}
                    title="Voir l'historique"
                  >
                    <History className="size-3.5" />
                  </Button>
                </div>

                {/* STATUS & QUICK ACTIONS */}
                <div className="flex flex-col gap-2 pt-2 border-t">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-muted-foreground">
                      Statut Actuel :
                    </span>
                    <Badge
                      variant={STATUT_BADGE_VARIANT[room.statut]}
                      className="text-xs font-semibold"
                    >
                      {STATUT_LABEL[room.statut]}
                    </Badge>
                  </div>

                  {/* QUICK ONE-CLICK SHORTCUTS */}
                  {room.statut === "A_NETTOYER" && (
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={updatingRoomId === room.id}
                        onClick={() => handleChange(room.id, "EN_NETTOYAGE")}
                        className="h-7 text-[11px] gap-1 font-semibold border-sky-300 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                      >
                        <RefreshCw className="size-3" />
                        <span>Démarrer</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={updatingRoomId === room.id}
                        onClick={() => handleChange(room.id, "LIBRE_PROPRE")}
                        className="h-7 text-[11px] gap-1 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="size-3" />
                        <span>Propre</span>
                      </Button>
                    </div>
                  )}

                  {room.statut === "EN_NETTOYAGE" && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={updatingRoomId === room.id}
                      onClick={() => handleChange(room.id, "LIBRE_PROPRE")}
                      className="h-7 text-[11px] gap-1 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white w-full mt-1"
                    >
                      <Sparkles className="size-3" />
                      <span>Terminer & Marquer Propre</span>
                    </Button>
                  )}

                  {room.statut === "LIBRE_PROPRE" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updatingRoomId === room.id}
                      onClick={() => handleChange(room.id, "A_NETTOYER")}
                      className="h-7 text-[11px] gap-1 font-semibold border-orange-300 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 w-full mt-1"
                    >
                      <Brush className="size-3" />
                      <span>Signaler À Nettoyer</span>
                    </Button>
                  )}

                  {/* DROPDOWN CHANGE */}
                  <div className="mt-1">
                    {NON_MODIFIABLE_MANUELLEMENT[room.statut] ? (
                      <div className="p-1.5 bg-muted/40 rounded-lg text-[10px] text-muted-foreground flex items-center justify-between">
                        <span className="italic">
                          {NON_MODIFIABLE_MANUELLEMENT[room.statut]}
                        </span>
                        <Info className="size-3 text-muted-foreground" />
                      </div>
                    ) : (
                      <Select
                        value={room.statut}
                        onValueChange={(v) =>
                          v && handleChange(room.id, v as StatutChambre)
                        }
                        disabled={updatingRoomId === room.id}
                        items={STATUTS_MANUELS.map((s) => ({
                          value: s,
                          label: STATUT_LABEL[s],
                        }))}
                      >
                        <SelectTrigger className="h-7 text-[11px] bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUTS_MANUELS.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {STATUT_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === "floors" ? (
        /* MATRIX BY FLOOR VIEW */
        <div className="flex flex-col gap-6">
          {floors.map((floor) => {
            const floorRooms = roomsByFloor[floor] || [];
            if (floorRooms.length === 0) return null;

            return (
              <div
                key={floor}
                className="rounded-xl border bg-card p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Building className="size-4 text-primary" />
                    <span>{floor}</span>
                  </h3>
                  <Badge variant="outline" className="text-xs font-mono">
                    {floorRooms.length} chambre(s)
                  </Badge>
                </div>

                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {floorRooms.map((room) => (
                    <div
                      key={room.id}
                      className={`p-3 rounded-lg border border-l-4 flex items-center justify-between gap-2 bg-background ${STATUT_BORDER_CLASS[room.statut]}`}
                    >
                      <div>
                        <p className="font-bold text-sm font-mono text-foreground">
                          #{room.numero}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {room.roomType.nom}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant={STATUT_BADGE_VARIANT[room.statut]}
                          className="text-[10px]"
                        >
                          {STATUT_LABEL[room.statut]}
                        </Badge>

                        {!NON_MODIFIABLE_MANUELLEMENT[room.statut] && (
                          <Select
                            value={room.statut}
                            onValueChange={(v) =>
                              v && handleChange(room.id, v as StatutChambre)
                            }
                            disabled={updatingRoomId === room.id}
                            items={STATUTS_MANUELS.map((s) => ({
                              value: s,
                              label: STATUT_LABEL[s],
                            }))}
                          >
                            <SelectTrigger className="h-6 text-[10px] w-[110px] bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUTS_MANUELS.map((s) => (
                                <SelectItem
                                  key={s}
                                  value={s}
                                  className="text-xs"
                                >
                                  {STATUT_LABEL[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
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
                  <th className="p-3 w-8">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <CheckSquare className="size-4" />
                    </button>
                  </th>
                  <th className="p-3">Numéro</th>
                  <th className="p-3">Étage</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Statut Actuel</th>
                  <th className="p-3">Action / Modification</th>
                  <th className="p-3 text-right">Historique</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRooms.map((room) => {
                  const floor = getFloorLabel(room.numero);
                  const isSelected = selectedRoomIds.includes(room.id);

                  return (
                    <tr
                      key={room.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="p-3">
                        {STATUTS_MANUELS.includes(room.statut) && (
                          <button
                            type="button"
                            onClick={() => toggleSelectRoom(room.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isSelected ? (
                              <CheckSquare className="size-4 text-primary" />
                            ) : (
                              <Square className="size-4" />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="p-3 font-bold font-mono text-sm">
                        #{room.numero}
                      </td>
                      <td className="p-3 text-muted-foreground">{floor}</td>
                      <td className="p-3 font-medium">{room.roomType.nom}</td>
                      <td className="p-3">
                        <Badge variant={STATUT_BADGE_VARIANT[room.statut]}>
                          {STATUT_LABEL[room.statut]}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {NON_MODIFIABLE_MANUELLEMENT[room.statut] ? (
                          <span className="text-muted-foreground italic text-[11px]">
                            {NON_MODIFIABLE_MANUELLEMENT[room.statut]}
                          </span>
                        ) : (
                          <Select
                            value={room.statut}
                            onValueChange={(v) =>
                              v && handleChange(room.id, v as StatutChambre)
                            }
                            disabled={updatingRoomId === room.id}
                            items={STATUTS_MANUELS.map((s) => ({
                              value: s,
                              label: STATUT_LABEL[s],
                            }))}
                          >
                            <SelectTrigger className="h-7 text-xs w-[150px] bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUTS_MANUELS.map((s) => (
                                <SelectItem
                                  key={s}
                                  value={s}
                                  className="text-xs"
                                >
                                  {STATUT_LABEL[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryRoom(room)}
                          className="h-7 text-xs gap-1"
                        >
                          <History className="size-3.5" />
                          <span>Logs</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HISTORY DIALOG */}
      <RoomHistoryDialog
        roomId={historyRoom?.id ?? null}
        roomNumero={historyRoom?.numero ?? null}
        onClose={() => setHistoryRoom(null)}
      />
    </div>
  );
}
