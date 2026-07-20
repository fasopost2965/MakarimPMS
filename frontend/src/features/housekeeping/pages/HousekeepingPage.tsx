import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listRooms, updateRoomStatus } from "../api";
import type { Room, StatutChambre } from "../../reservations/types";
import {
  Brush,
  CheckCircle2,
  Sparkles,
  Wrench,
  AlertCircle,
  Search,
  User,
  Calendar,
  Grid,
  List,
  RefreshCw,
} from "lucide-react";

// Machine à états complète (cahier des charges §5.6, Phase 2) : ces quatre
// statuts sont pilotables manuellement. RESERVEE, OCCUPEE et DEPART_PREVU
// sont exclusivement pilotés par le système (réservation du jour, check-in,
// check-out — voir HousekeepingService côté backend) — jamais par un choix
// manuel ici.
const STATUTS_MANUELS: StatutChambre[] = [
  "A_NETTOYER",
  "EN_NETTOYAGE",
  "LIBRE_PROPRE",
  "EN_MAINTENANCE",
];

const NON_MODIFIABLE_MANUELLEMENT: Partial<Record<StatutChambre, string>> = {
  RESERVEE: "Passera en Occupée au check-in",
  OCCUPEE: "Libérée via le check-out",
  DEPART_PREVU: "Libérée via le check-out",
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

// Styling profiles for room cards based on status
interface StatusStyle {
  borderClass: string;
  bgClass: string;
  textClass: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
}

const STATUS_STYLES: Record<StatutChambre, StatusStyle> = {
  LIBRE_PROPRE: {
    borderClass: "border-emerald-500/30 dark:border-emerald-500/20",
    bgClass: "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]",
    textClass: "text-emerald-700 dark:text-emerald-400",
    badgeVariant: "default",
    icon: (
      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    ),
  },
  EN_NETTOYAGE: {
    borderClass: "border-amber-500/30 dark:border-amber-500/20",
    bgClass: "bg-amber-500/[0.04] hover:bg-amber-500/[0.07] animate-pulse",
    textClass: "text-amber-700 dark:text-amber-400",
    badgeVariant: "outline",
    icon: <Brush className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
  },
  A_NETTOYER: {
    borderClass: "border-rose-500/30 dark:border-rose-500/20",
    bgClass: "bg-rose-500/[0.04] hover:bg-rose-500/[0.07]",
    textClass: "text-rose-700 dark:text-rose-400",
    badgeVariant: "outline",
    icon: <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
  },
  EN_MAINTENANCE: {
    borderClass: "border-destructive/30 dark:border-destructive/20",
    bgClass: "bg-destructive/[0.04] hover:bg-destructive/[0.07]",
    textClass: "text-destructive",
    badgeVariant: "destructive",
    icon: <Wrench className="h-4 w-4 text-destructive" />,
  },
  RESERVEE: {
    borderClass: "border-blue-500/30 dark:border-blue-500/20",
    bgClass: "bg-blue-500/[0.04] hover:bg-blue-500/[0.07]",
    textClass: "text-blue-700 dark:text-blue-400",
    badgeVariant: "secondary",
    icon: <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
  },
  OCCUPEE: {
    borderClass: "border-purple-500/30 dark:border-purple-500/20",
    bgClass: "bg-purple-500/[0.04] hover:bg-purple-500/[0.07]",
    textClass: "text-purple-700 dark:text-purple-400",
    badgeVariant: "destructive",
    icon: <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />,
  },
  DEPART_PREVU: {
    borderClass: "border-indigo-500/30 dark:border-indigo-500/20",
    bgClass: "bg-indigo-500/[0.04] hover:bg-indigo-500/[0.07]",
    textClass: "text-indigo-700 dark:text-indigo-400",
    badgeVariant: "secondary",
    icon: <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
  },
};

export function HousekeepingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingRoomId, setUpdatingRoomId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
      // Actualise les chambres
      const updatedRooms = await listRooms();
      setRooms(updatedRooms);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erreur de mise à jour du statut",
      );
    } finally {
      setUpdatingRoomId(null);
    }
  }

  // Live Stats calculations
  const total = rooms.length;
  const cleanCount = rooms.filter((r) => r.statut === "LIBRE_PROPRE").length;
  const toCleanCount = rooms.filter((r) => r.statut === "A_NETTOYER").length;
  const inCleaningCount = rooms.filter(
    (r) => r.statut === "EN_NETTOYAGE",
  ).length;
  const maintenanceCount = rooms.filter(
    (r) => r.statut === "EN_MAINTENANCE",
  ).length;
  const readyPercent = total > 0 ? Math.round((cleanCount / total) * 100) : 0;

  // Filter implementation
  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      room.numero.includes(searchQuery) ||
      room.roomType.nom.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === "ALL") return matchesSearch;
    if (statusFilter === "TO_CLEAN")
      return matchesSearch && room.statut === "A_NETTOYER";
    if (statusFilter === "IN_CLEANING")
      return matchesSearch && room.statut === "EN_NETTOYAGE";
    if (statusFilter === "CLEAN")
      return matchesSearch && room.statut === "LIBRE_PROPRE";
    if (statusFilter === "MAINTENANCE")
      return matchesSearch && room.statut === "EN_MAINTENANCE";
    if (statusFilter === "OCCUPIED_RESERVED") {
      return (
        matchesSearch &&
        ["OCCUPEE", "RESERVEE", "DEPART_PREVU"].includes(room.statut)
      );
    }
    return matchesSearch;
  });

  return (
    <div className="flex h-full flex-col gap-5 p-6">
      {/* Title with stats summary */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Brush className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-serif font-bold text-foreground">
              Suivi Housekeeping & Propreté
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Mettez à jour instantanément le statut de propreté des 24 chambres
            de l'Hôtel Makarim.
          </p>
        </div>

        {/* Mini progress widget - gorgeous on tablet */}
        <div className="flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3 shadow-sm min-w-[200px]">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-muted-foreground">
              Taux de chambres prêtes :
            </span>
            <span className="text-primary">{readyPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${readyPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-right">
            {cleanCount} prêtes · {toCleanCount} à nettoyer · {inCleaningCount}{" "}
            en cours
          </p>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm flex items-center justify-between">
          <span>{loadError}</span>
          <button
            onClick={refetch}
            className="flex items-center gap-1.5 text-xs underline font-semibold"
          >
            <RefreshCw className="h-3 w-3" /> Réessayer
          </button>
        </div>
      )}
      {actionError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive text-sm">
          {actionError}
        </div>
      )}

      {/* Filter and control panel */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
        {/* Search & View Switcher */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher une chambre (ex: 101, Double)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/40 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg border transition-all ${viewMode === "grid" ? "bg-primary/10 border-primary/30 text-primary" : "bg-background hover:bg-secondary"}`}
              title="Vue en grille"
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg border transition-all ${viewMode === "list" ? "bg-primary/10 border-primary/30 text-primary" : "bg-background hover:bg-secondary"}`}
              title="Vue en liste"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tablet-optimized Touch Pills for Quick Status Filtering */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t mt-1">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${statusFilter === "ALL" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-secondary text-muted-foreground"}`}
          >
            Toutes ({total})
          </button>
          <button
            onClick={() => setStatusFilter("TO_CLEAN")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${statusFilter === "TO_CLEAN" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40" : "bg-background hover:bg-rose-500/5 text-muted-foreground"}`}
          >
            À nettoyer ({toCleanCount})
          </button>
          <button
            onClick={() => setStatusFilter("IN_CLEANING")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${statusFilter === "IN_CLEANING" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40" : "bg-background hover:bg-amber-500/5 text-muted-foreground"}`}
          >
            En nettoyage ({inCleaningCount})
          </button>
          <button
            onClick={() => setStatusFilter("CLEAN")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${statusFilter === "CLEAN" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" : "bg-background hover:bg-emerald-500/5 text-muted-foreground"}`}
          >
            Prêtes / Propres ({cleanCount})
          </button>
          <button
            onClick={() => setStatusFilter("OCCUPIED_RESERVED")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${statusFilter === "OCCUPIED_RESERVED" ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40" : "bg-background hover:bg-blue-500/5 text-muted-foreground"}`}
          >
            Réservées / Occupées
          </button>
          <button
            onClick={() => setStatusFilter("MAINTENANCE")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${statusFilter === "MAINTENANCE" ? "bg-destructive/10 text-destructive border-destructive/40" : "bg-background hover:bg-secondary text-muted-foreground"}`}
          >
            Hors-service ({maintenanceCount})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-16 justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Chargement de l'état des chambres…
        </div>
      ) : (
        <>
          {filteredRooms.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-muted-foreground">
                Aucune chambre ne correspond aux filtres
              </p>
              <button
                onClick={() => {
                  setStatusFilter("ALL");
                  setSearchQuery("");
                }}
                className="text-xs text-primary underline mt-1 font-semibold"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "flex flex-col gap-2"
              }
            >
              {filteredRooms.map((room) => {
                const sStyle =
                  STATUS_STYLES[room.statut] || STATUS_STYLES.A_NETTOYER;
                const isSystemManaged =
                  NON_MODIFIABLE_MANUELLEMENT[room.statut] !== undefined;

                return (
                  <div
                    key={room.id}
                    className={`group relative flex ${viewMode === "grid" ? "flex-col justify-between" : "items-center justify-between gap-4"} rounded-xl border p-4 shadow-sm transition-all duration-200 ${sStyle.borderClass} ${sStyle.bgClass}`}
                  >
                    {/* Top Room Meta info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-left">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-mono text-xl font-extrabold tracking-tight">
                            {room.numero}
                          </span>
                          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                            · {room.roomType.nom}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/90 font-medium mt-0.5">
                          Chambre de {room.roomType.capacite} pax
                        </p>
                      </div>

                      {/* Icon of status */}
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background shadow-xs">
                        {sStyle.icon}
                      </div>
                    </div>

                    {/* Middle: Badge displaying status */}
                    <div
                      className={`mt-3 ${viewMode === "grid" ? "flex flex-col gap-3" : "flex items-center gap-4"}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={sStyle.badgeVariant}
                          className="font-semibold text-[10px] py-0.5 tracking-wide uppercase shadow-xs"
                        >
                          {STATUT_LABEL[room.statut]}
                        </Badge>
                      </div>

                      {/* Actions: Tablet Quick-Touch buttons OR Dropdown */}
                      <div className="flex-1 text-right mt-1">
                        {isSystemManaged ? (
                          <span className="text-[10px] font-medium text-muted-foreground italic bg-background/50 px-2 py-1 rounded border border-border/30">
                            {NON_MODIFIABLE_MANUELLEMENT[room.statut]}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 justify-end">
                            {/* Tablet touch quick-triggers directly on card! */}
                            {room.statut === "A_NETTOYER" && (
                              <button
                                onClick={() =>
                                  handleChange(room.id, "EN_NETTOYAGE")
                                }
                                disabled={updatingRoomId === room.id}
                                className="w-full md:w-auto px-2.5 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-bold text-xs shadow-xs hover:shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1"
                              >
                                🧹 Nettoyer
                              </button>
                            )}

                            {room.statut === "EN_NETTOYAGE" && (
                              <button
                                onClick={() =>
                                  handleChange(room.id, "LIBRE_PROPRE")
                                }
                                disabled={updatingRoomId === room.id}
                                className="w-full md:w-auto px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-xs hover:shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1"
                              >
                                ✅ Propre
                              </button>
                            )}

                            {/* Dropdown for other states or manual adjustment */}
                            <div className="w-24">
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
                                <SelectTrigger
                                  size="sm"
                                  className="h-7 text-[10px] font-semibold bg-background border shadow-xs"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUTS_MANUELS.map((s) => (
                                    <SelectItem
                                      key={s}
                                      value={s}
                                      className="text-xs font-medium"
                                    >
                                      {STATUT_LABEL[s]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
