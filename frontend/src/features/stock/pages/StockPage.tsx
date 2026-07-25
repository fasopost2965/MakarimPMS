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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { toastManager } from "@/components/ui/toast";
import {
  changeRoomLinen,
  getLinenStatus,
  getRoomDotations,
  listMovements,
  listRooms,
  listStockItems,
  replenishStock,
  sendLaundryMovement,
  updateRoomDotation,
} from "../api";
import type {
  LinenStatus,
  RoomTypeDotation,
  StockCategory,
  StockItem,
  StockMovement,
} from "../types";
import {
  AlertTriangle,
  BedDouble,
  Building2,
  CheckCircle2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Shirt,
  Sparkles,
} from "lucide-react";

type StockView = "articles" | "dotations" | "blanchisserie" | "mouvements";

export function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [dotations, setDotations] = useState<RoomTypeDotation[]>([]);
  const [linenStatus, setLinenStatus] = useState<LinenStatus | null>(null);
  const [rooms, setRooms] = useState<
    Array<{ id: number; numero: string; roomTypeId: number; statut: string }>
  >([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<StockView>("articles");

  // State for search and filter
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | StockCategory>(
    "ALL",
  );

  // Modals
  const [replenishingItem, setReplenishingItem] = useState<StockItem | null>(
    null,
  );
  const [laundryModalOpen, setLaundryModalOpen] = useState(false);
  const [selectedLinenItem, setSelectedLinenItem] = useState<StockItem | null>(
    null,
  );
  const [laundryAction, setLaundryAction] = useState<
    "ENVOI_BUANDERIE" | "RETOUR_BUANDERIE"
  >("ENVOI_BUANDERIE");

  const [roomLinenModalOpen, setRoomLinenModalOpen] = useState(false);
  const [editingDotation, setEditingDotation] =
    useState<RoomTypeDotation | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [itemsData, movementsData, dotationsData, linenData, roomsData] =
        await Promise.all([
          listStockItems(),
          listMovements(),
          getRoomDotations().catch(() => []),
          getLinenStatus().catch(() => null),
          listRooms().catch(() => []),
        ]);
      setItems(itemsData);
      setMovements(movementsData);
      setDotations(dotationsData);
      setLinenStatus(linenData);
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

  // Statistics
  const totalItemsCount = items.length;
  const alertItems = items.filter((i) => i.sousSeuilAlerte);
  const totalEquipments = items
    .filter((i) => i.categorie === "EQUIPEMENT")
    .reduce((acc, curr) => acc + curr.quantiteTotale, 0);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.libelle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat =
      categoryFilter === "ALL" || item.categorie === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="flex h-full flex-col gap-6 p-6 overflow-y-auto">
      {/* Top Header & KPI Summary */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Gestion des Stocks & Équipements
          </h1>
          <p className="text-muted-foreground text-sm">
            Inventaire central, dotations des 24 chambres, matériel et circuit
            de blanchisserie.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setRoomLinenModalOpen(true)}
          >
            <BedDouble className="h-4 w-4" />
            Changement Linge Chambre
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => {
              setSelectedLinenItem(
                items.find((i) => i.categorie === "LINGERIE") || null,
              );
              setLaundryAction("ENVOI_BUANDERIE");
              setLaundryModalOpen(true);
            }}
          >
            <Shirt className="h-4 w-4" />
            Mouvement Blanchisserie
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setReplenishingItem(items[0] || null)}
          >
            <Plus className="h-4 w-4" />
            Réassort
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Articles Référencés
            </span>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{totalItemsCount}</span>
            <span className="text-xs text-muted-foreground">
              articles physiques
            </span>
          </div>
          {alertItems.length > 0 ? (
            <p className="mt-2 text-xs font-medium text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {alertItems.length} sous le seuil d'alerte
            </p>
          ) : (
            <p className="mt-2 text-xs font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Niveaux de stock conformes
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Stock Lingerie Propre
            </span>
            <Shirt className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">
              {linenStatus?.totalPropre ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">
              unités en réserve
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Disponible immédiatement pour la réfection
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Linge en Buanderie
            </span>
            <RefreshCw className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">
              {linenStatus?.totalSaleBuanderie ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">
              unités en lavage
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Linge sale / en cours de repassage
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Équipements Installés (24 Ch.)
            </span>
            <Building2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{totalEquipments}</span>
            <span className="text-xs text-muted-foreground">
              matériels en parc
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Mini-frigos, TV, coffres, climatiseurs
          </p>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {alertItems.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start md:items-center gap-3">
            <div className="p-2 bg-destructive text-destructive-foreground rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                Alerte de Stock Critique ({alertItems.length} article{alertItems.length > 1 ? "s" : ""})
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Certains articles de lingerie ou consommables ont dépassé leur seuil minimal de sécurité :{" "}
                <span className="font-semibold text-destructive">
                  {alertItems.map((a) => `${a.libelle} (${a.quantiteDisponible} dispo / seuil ${a.seuilAlerte})`).join(", ")}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="destructive"
              className="text-xs h-8"
              onClick={() => setReplenishingItem(alertItems[0])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Réassort Immédiat
            </Button>
          </div>
        </div>
      )}

      {loadError && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center justify-between">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Réessayer
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-sm text-muted-foreground">
            Chargement des stocks…
          </span>
        </div>
      ) : (
        <Tabs
          value={view}
          onValueChange={(v) => v && setView(v as StockView)}
          className="flex flex-1 flex-col gap-4"
        >
          <TabsList className="w-fit">
            <TabsTrigger value="articles" className="gap-2">
              <Package className="h-4 w-4" />
              Inventaire & Articles
            </TabsTrigger>
            <TabsTrigger value="dotations" className="gap-2">
              <BedDouble className="h-4 w-4" />
              Dotations & Équipements par Chambre
            </TabsTrigger>
            <TabsTrigger value="blanchisserie" className="gap-2">
              <Shirt className="h-4 w-4" />
              Circuit Lingerie & Blanchisserie
            </TabsTrigger>
            <TabsTrigger value="mouvements" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Mouvements & Historique
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Articles Catalog */}
          <TabsPanel value="articles" className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par libellé ou code (ex: LINGE, EQP, AMEN)..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-start">
                <Button
                  size="sm"
                  variant={categoryFilter === "ALL" ? "default" : "ghost"}
                  onClick={() => setCategoryFilter("ALL")}
                  className="text-xs h-7"
                >
                  Tous ({items.length})
                </Button>
                <Button
                  size="sm"
                  variant={categoryFilter === "LINGERIE" ? "default" : "ghost"}
                  onClick={() => setCategoryFilter("LINGERIE")}
                  className="text-xs h-7"
                >
                  🧺 Lingerie
                </Button>
                <Button
                  size="sm"
                  variant={
                    categoryFilter === "EQUIPEMENT" ? "default" : "ghost"
                  }
                  onClick={() => setCategoryFilter("EQUIPEMENT")}
                  className="text-xs h-7"
                >
                  📺 Matériel
                </Button>
                <Button
                  size="sm"
                  variant={
                    categoryFilter === "KIT_ACCUEIL" ? "default" : "ghost"
                  }
                  onClick={() => setCategoryFilter("KIT_ACCUEIL")}
                  className="text-xs h-7"
                >
                  🧼 Kits & Consommables
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col justify-between gap-3 rounded-xl border p-4 transition-all ${
                    item.sousSeuilAlerte
                      ? "border-destructive/40 bg-destructive/5"
                      : "bg-card hover:border-primary/30 shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                          {item.code}
                        </span>
                        <h3 className="text-sm font-semibold text-foreground leading-tight">
                          {item.libelle}
                        </h3>
                      </div>
                      {item.sousSeuilAlerte ? (
                        <Badge
                          variant="destructive"
                          className="shrink-0 text-[10px]"
                        >
                          Alerte Seuil
                        </Badge>
                      ) : (
                        <Badge
                          variant={
                            item.categorie === "LINGERIE"
                              ? "default"
                              : item.categorie === "EQUIPEMENT"
                                ? "secondary"
                                : "outline"
                          }
                          className="shrink-0 text-[10px]"
                        >
                          {item.categorie === "LINGERIE"
                            ? "Lingerie"
                            : item.categorie === "EQUIPEMENT"
                              ? "Équipement"
                              : "Consommable"}
                        </Badge>
                      )}
                    </div>

                    {/* Stock Detail Rows & Visual Gauges */}
                    <div className="mt-3 space-y-2 text-xs">
                      {/* Lingerie Stacked Progress Bar */}
                      {item.categorie === "LINGERIE" ? (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground font-medium">Répartition Totale ({item.quantiteTotale} pces)</span>
                            <span className="font-semibold text-primary">{Math.round((item.quantiteDisponible / (item.quantiteTotale || 1)) * 100)}% Propre</span>
                          </div>
                          {/* Stacked Bar */}
                          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                            <div
                              className="bg-emerald-500 transition-all"
                              style={{ width: `${Math.min(100, (item.quantiteDisponible / (item.quantiteTotale || 1)) * 100)}%` }}
                              title={`Propre (Réserve) : ${item.quantiteDisponible}`}
                            />
                            <div
                              className="bg-sky-500 transition-all"
                              style={{ width: `${Math.min(100, (item.quantiteEnChambre / (item.quantiteTotale || 1)) * 100)}%` }}
                              title={`En Chambre : ${item.quantiteEnChambre}`}
                            />
                            <div
                              className="bg-amber-500 transition-all"
                              style={{ width: `${Math.min(100, (item.quantiteSaleBuanderie / (item.quantiteTotale || 1)) * 100)}%` }}
                              title={`En Buanderie (Sale) : ${item.quantiteSaleBuanderie}`}
                            />
                          </div>
                          {/* Legend Dots */}
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                            <span className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                              Propre ({item.quantiteDisponible})
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-sky-500 inline-block" />
                              Chambre ({item.quantiteEnChambre})
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                              Lavage ({item.quantiteSaleBuanderie})
                            </span>
                          </div>
                        </div>
                      ) : item.categorie === "EQUIPEMENT" ? (
                        /* Equipment Progress Bar */
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center py-0.5 border-b border-muted">
                            <span className="text-muted-foreground">Disponible Réserve :</span>
                            <span className="font-bold text-foreground">
                              {item.quantiteDisponible} {item.uniteMesure}s
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] pt-1">
                            <span className="text-muted-foreground">Taux de couverture hôtel</span>
                            <span className="font-mono font-semibold">
                              {item.quantiteDisponible} / {item.stockMinimumHotel || 24} {item.uniteMesure}s
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                item.quantiteDisponible >= (item.stockMinimumHotel || 24)
                                  ? "bg-emerald-500"
                                  : item.quantiteDisponible > 0
                                  ? "bg-sky-500"
                                  : "bg-destructive"
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((item.quantiteDisponible + item.quantiteEnChambre) /
                                    (item.stockMinimumHotel || 24)) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        /* Consumables Progress Bar */
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center py-0.5 border-b border-muted">
                            <span className="text-muted-foreground">Disponible Réserve :</span>
                            <span className="font-bold text-foreground">
                              {item.quantiteDisponible} {item.uniteMesure}s
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] pt-1">
                            <span className="text-muted-foreground">Jauge de sécurité (Seuil {item.seuilAlerte})</span>
                            <span
                              className={`font-mono font-bold ${
                                item.sousSeuilAlerte ? "text-destructive" : "text-emerald-600"
                              }`}
                            >
                              {item.quantiteDisponible} dispo
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                item.sousSeuilAlerte
                                  ? "bg-destructive"
                                  : item.quantiteDisponible <= item.seuilAlerte * 1.5
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (item.quantiteDisponible / (item.seuilAlerte * 3 || 100)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-1 text-[11px] text-muted-foreground">
                        <span>Seuil Alerte : {item.seuilAlerte}</span>
                        <span>Min. Requis Hôtel : {item.stockMinimumHotel || item.seuilAlerte}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-muted/60">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs h-8"
                      onClick={() => setReplenishingItem(item)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Réassort
                    </Button>
                    {item.categorie === "LINGERIE" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 text-xs h-8"
                        onClick={() => {
                          setSelectedLinenItem(item);
                          setLaundryAction("ENVOI_BUANDERIE");
                          setLaundryModalOpen(true);
                        }}
                      >
                        <Shirt className="h-3.5 w-3.5 mr-1" />
                        Buanderie
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsPanel>

          {/* Tab 2: Dotations & Equipments per Room Type */}
          <TabsPanel value="dotations" className="flex flex-col gap-6">
            <div className="bg-muted/40 border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <BedDouble className="h-5 w-5 text-primary" />
                  Référentiel & Dotation Standard par Chambre
                </h2>
                <p className="text-xs text-muted-foreground">
                  Configuration du matériel installé et du linge théorique
                  minimum pour les 24 chambres de l'établissement.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-background">
                  Parc Total : 24 Chambres
                </Badge>
              </div>
            </div>

            <div className="grid gap-6">
              {dotations.map((dotation) => {
                const equipmentItems = dotation.items.filter(
                  (i) => i.categorie === "EQUIPEMENT",
                );
                const linenItems = dotation.items.filter(
                  (i) => i.categorie === "LINGERIE",
                );
                const kitItems = dotation.items.filter(
                  (i) => i.categorie === "KIT_ACCUEIL",
                );

                return (
                  <div
                    key={dotation.roomTypeId}
                    className="rounded-xl border bg-card p-5 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-foreground">
                            {dotation.roomTypeName}
                          </h3>
                          <Badge variant="secondary">
                            Capacité {dotation.capacite} pers.
                          </Badge>
                          <Badge variant="outline">
                            {dotation.roomCount} chambres
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Dotation matérielle et textile installée à l'arrivée
                          du client.
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingDotation(dotation)}
                      >
                        Ajuster la Dotation
                      </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Equipment List */}
                      <div className="rounded-lg bg-muted/20 p-3 border space-y-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          📺 Équipements de Chambre
                        </span>
                        <ul className="space-y-1.5 text-xs">
                          {equipmentItems.map((item) => (
                            <li
                              key={item.stockItemId}
                              className="flex items-center justify-between py-1 border-b border-muted/50 last:border-0"
                            >
                              <span className="text-foreground">
                                {item.libelle}
                              </span>
                              <Badge
                                variant={
                                  item.quantiteDotation > 0
                                    ? "default"
                                    : "outline"
                                }
                                className="font-mono text-[11px]"
                              >
                                x{item.quantiteDotation}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Linen List */}
                      <div className="rounded-lg bg-muted/20 p-3 border space-y-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          🧺 Lingerie & Linge de Lit
                        </span>
                        <ul className="space-y-1.5 text-xs">
                          {linenItems.map((item) => (
                            <li
                              key={item.stockItemId}
                              className="flex items-center justify-between py-1 border-b border-muted/50 last:border-0"
                            >
                              <span className="text-foreground">
                                {item.libelle}
                              </span>
                              <Badge
                                variant={
                                  item.quantiteDotation > 0
                                    ? "default"
                                    : "outline"
                                }
                                className="font-mono text-[11px]"
                              >
                                x{item.quantiteDotation}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Consumables List */}
                      <div className="rounded-lg bg-muted/20 p-3 border space-y-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          🧼 Kits & Produits d'Accueil
                        </span>
                        <ul className="space-y-1.5 text-xs">
                          {kitItems.map((item) => (
                            <li
                              key={item.stockItemId}
                              className="flex items-center justify-between py-1 border-b border-muted/50 last:border-0"
                            >
                              <span className="text-foreground">
                                {item.libelle}
                              </span>
                              <Badge
                                variant={
                                  item.quantiteDotation > 0
                                    ? "default"
                                    : "outline"
                                }
                                className="font-mono text-[11px]"
                              >
                                x{item.quantiteDotation}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsPanel>

          {/* Tab 3: Laundry & Linen Pipeline */}
          <TabsPanel value="blanchisserie" className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Shirt className="h-5 w-5 text-primary" />
                  Circuit de Blanchisserie & Rotation Lingerie
                </h2>
                <p className="text-xs text-muted-foreground">
                  Suivi en temps réel des 3 états du linge : Réserve Propre,
                  Installé en Chambre, et Sale en Buanderie.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedLinenItem(
                      items.find((i) => i.categorie === "LINGERIE") || null,
                    );
                    setLaundryAction("ENVOI_BUANDERIE");
                    setLaundryModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Envoyer au Lavage
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedLinenItem(
                      items.find((i) => i.categorie === "LINGERIE") || null,
                    );
                    setLaundryAction("RETOUR_BUANDERIE");
                    setLaundryModalOpen(true);
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Retour de Blanchisserie
                </Button>
              </div>
            </div>

            {/* Pipeline Columns */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Column 1: Clean Reserve */}
              <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-sm flex items-center gap-2 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    1. Stock Propre (Réserve)
                  </span>
                  <Badge variant="default" className="font-mono">
                    {linenStatus?.totalPropre ?? 0} pces
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Linge repassé et plié en gouvernance, disponible pour les
                  nettoyages.
                </p>

                <div className="space-y-2 mt-2">
                  {linenStatus?.details.map((detail) => (
                    <div
                      key={detail.id}
                      className="p-2.5 rounded-lg border bg-muted/20 text-xs flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{detail.libelle}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {detail.code}
                        </p>
                      </div>
                      <span className="font-bold text-primary font-mono text-sm">
                        {detail.quantitePropreReserve}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Deployed in Rooms */}
              <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-sm flex items-center gap-2 text-slate-700">
                    <BedDouble className="h-4 w-4" />
                    2. Installé en Chambre (24 Ch.)
                  </span>
                  <Badge variant="secondary" className="font-mono">
                    ~{linenStatus?.totalEnChambre ?? 0} pces
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Linge déployé sur les lits et dans les salles de bain occupées
                  ou prêtes.
                </p>

                <div className="space-y-2 mt-2">
                  {linenStatus?.details.map((detail) => (
                    <div
                      key={detail.id}
                      className="p-2.5 rounded-lg border bg-muted/20 text-xs flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{detail.libelle}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Dotation théorique
                        </p>
                      </div>
                      <span className="font-bold text-slate-700 font-mono text-sm">
                        ~{detail.quantiteEnChambre}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 3: Dirty / Laundry */}
              <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-sm flex items-center gap-2 text-amber-600">
                    <RefreshCw className="h-4 w-4" />
                    3. Linge Sale / Blanchisserie
                  </span>
                  <Badge
                    variant="destructive"
                    className="bg-amber-600 font-mono"
                  >
                    {linenStatus?.totalSaleBuanderie ?? 0} pces
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Linge retiré des chambres lors du ménage, envoyé au lavage.
                </p>

                <div className="space-y-2 mt-2">
                  {linenStatus?.details.map((detail) => (
                    <div
                      key={detail.id}
                      className="p-2.5 rounded-lg border bg-amber-500/10 border-amber-200 text-xs flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{detail.libelle}</p>
                        <p className="text-[10px] text-amber-700">
                          En blanchisserie
                        </p>
                      </div>
                      <span className="font-bold text-amber-600 font-mono text-sm">
                        {detail.quantiteSaleBuanderie}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsPanel>

          {/* Tab 4: Movements History */}
          <TabsPanel value="mouvements">
            {movements.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                Aucun mouvement de stock enregistré.
              </p>
            ) : (
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Horodatage</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead>Article</TableHead>
                      <TableHead>Chambre</TableHead>
                      <TableHead>Motif / Référence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              m.typeMouvement === "ENTREE"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {m.typeMouvement === "ENTREE"
                              ? "Entrée +"
                              : "Sortie −"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {m.typeMouvement === "ENTREE" ? "+" : "−"}
                          {m.quantite}
                        </TableCell>
                        <TableCell className="font-medium text-xs">
                          {m.stockItem
                            ? m.stockItem.libelle
                            : `Article #${m.stockItemId}`}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.room
                            ? `Chambre ${m.room.numero}`
                            : "Stock Central"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {m.motif}
                          {m.referenceFournisseur && (
                            <span className="block text-[11px] text-muted-foreground">
                              Réf: {m.referenceFournisseur}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsPanel>
        </Tabs>
      )}

      {/* Modal: Replenishment */}
      <Dialog
        open={replenishingItem !== null}
        onOpenChange={(next) => !next && setReplenishingItem(null)}
      >
        <DialogContent>
          {replenishingItem && (
            <ReplenishForm
              item={replenishingItem}
              onClose={() => setReplenishingItem(null)}
              onDone={async () => {
                setReplenishingItem(null);
                await refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Laundry Movement */}
      <Dialog open={laundryModalOpen} onOpenChange={setLaundryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {laundryAction === "ENVOI_BUANDERIE"
                ? "Envoyer du linge à la buanderie"
                : "Retour de blanchisserie (Linge propre)"}
            </DialogTitle>
          </DialogHeader>
          <LaundryMovementForm
            items={items.filter((i) => i.categorie === "LINGERIE")}
            selectedItem={selectedLinenItem}
            action={laundryAction}
            onClose={() => setLaundryModalOpen(false)}
            onDone={async () => {
              setLaundryModalOpen(false);
              await refetch();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal: Room Linen Change */}
      <Dialog open={roomLinenModalOpen} onOpenChange={setRoomLinenModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Changement de Linge par Chambre (Rotation)
            </DialogTitle>
          </DialogHeader>
          <RoomLinenChangeForm
            rooms={rooms}
            onClose={() => setRoomLinenModalOpen(false)}
            onDone={async () => {
              setRoomLinenModalOpen(false);
              await refetch();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Room Dotation */}
      <Dialog
        open={editingDotation !== null}
        onOpenChange={(n) => !n && setEditingDotation(null)}
      >
        <DialogContent className="max-w-xl">
          {editingDotation && (
            <EditDotationForm
              dotation={editingDotation}
              onClose={() => setEditingDotation(null)}
              onDone={async () => {
                setEditingDotation(null);
                await refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* Replenish Form */
interface ReplenishFormProps {
  item: StockItem;
  onClose: () => void;
  onDone: () => void;
}

function ReplenishForm({ item, onClose, onDone }: ReplenishFormProps) {
  const [quantite, setQuantite] = useState("");
  const [referenceFournisseur, setReferenceFournisseur] = useState("");
  const [motif, setMotif] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = quantite && Number(quantite) > 0 && motif;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await replenishStock({
        stockItemId: item.id,
        quantite: Number(quantite),
        motif,
        referenceFournisseur: referenceFournisseur || undefined,
      });
      toastManager.add({
        title: "Réassort enregistré",
        description: `+${quantite} ${item.uniteMesure} — ${item.libelle}`,
        type: "success",
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantite">Quantité reçue ({item.uniteMesure})</Label>
        <Input
          id="quantite"
          type="number"
          min="1"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="referenceFournisseur">
          Référence fournisseur (bon de livraison)
        </Label>
        <Input
          id="referenceFournisseur"
          value={referenceFournisseur}
          onChange={(e) => setReferenceFournisseur(e.target.value)}
          placeholder="Ex. BL-2026-089"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="motif">Motif</Label>
        <Input
          id="motif"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Ex. Livraison hebdomadaire fournisseur habituel"
          required
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? "Enregistrement…" : "Enregistrer le réassort"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* Laundry Movement Form */
interface LaundryMovementFormProps {
  items: StockItem[];
  selectedItem: StockItem | null;
  action: "ENVOI_BUANDERIE" | "RETOUR_BUANDERIE";
  onClose: () => void;
  onDone: () => void;
}

function LaundryMovementForm({
  items,
  selectedItem,
  action,
  onClose,
  onDone,
}: LaundryMovementFormProps) {
  const [stockItemId, setStockItemId] = useState<number>(
    selectedItem?.id || (items[0]?.id ?? 0),
  );
  const [quantite, setQuantite] = useState("10");
  const [prestataire, setPrestataire] = useState(
    "Blanchisserie Centrale Makarim",
  );
  const [motif, setMotif] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stockItemId || !quantite || Number(quantite) <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await sendLaundryMovement({
        stockItemId,
        action,
        quantite: Number(quantite),
        prestataire: prestataire || undefined,
        motif: motif || undefined,
      });

      toastManager.add({
        title:
          action === "ENVOI_BUANDERIE"
            ? "Linge envoyé en buanderie"
            : "Retour de blanchisserie enregistré",
        description: `${quantite} articles mis à jour dans le circuit.`,
        type: "success",
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de traitement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label>Article de Lingerie</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          value={stockItemId}
          onChange={(e) => setStockItemId(Number(e.target.value))}
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.libelle} (Propre: {i.quantiteDisponible}, Sale:{" "}
              {i.quantiteSaleBuanderie})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantite">Quantité (articles)</Label>
        <Input
          id="quantite"
          type="number"
          min="1"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prestataire">Prestataire / Service Buanderie</Label>
        <Input
          id="prestataire"
          value={prestataire}
          onChange={(e) => setPrestataire(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="motif">Motif / Note</Label>
        <Input
          id="motif"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder={
            action === "ENVOI_BUANDERIE"
              ? "Ex. Retrait du linge sale étage 1 & 2"
              : "Ex. Réception lot repassé et désinfecté"
          }
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={submitting || !quantite}>
          {submitting ? "Traitement…" : "Valider le mouvement"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* Room Linen Change Form */
interface RoomLinenChangeFormProps {
  rooms: Array<{ id: number; numero: string }>;
  onClose: () => void;
  onDone: () => void;
}

function RoomLinenChangeForm({
  rooms,
  onClose,
  onDone,
}: RoomLinenChangeFormProps) {
  const [roomId, setRoomId] = useState<number>(rooms[0]?.id || 0);
  const [motif, setMotif] = useState("Changement de linge - Ménage complet");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await changeRoomLinen({
        roomId,
        motif,
      });

      toastManager.add({
        title: "Linge renouvelé",
        description: res.message,
        type: "success",
      });
      onDone();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors du renouvellement",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <p className="text-xs text-muted-foreground">
        Le prélèvement de linge propre en réserve et le transfert du linge sale
        en buanderie seront automatiquement décomptés selon la dotation de cette
        chambre.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label>Sélectionner la Chambre</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          value={roomId}
          onChange={(e) => setRoomId(Number(e.target.value))}
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              Chambre {r.numero}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="motif">Motif / Type de ménage</Label>
        <Input
          id="motif"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={submitting || !roomId}>
          {submitting ? "Mise à jour…" : "Effectuer la rotation de linge"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* Edit Dotation Form */
interface EditDotationFormProps {
  dotation: RoomTypeDotation;
  onClose: () => void;
  onDone: () => void;
}

function EditDotationForm({
  dotation,
  onClose,
  onDone,
}: EditDotationFormProps) {
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>(
    () => {
      const map: Record<number, number> = {};
      for (const item of dotation.items) {
        map[item.stockItemId] = item.quantiteDotation;
      }
      return map;
    },
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleQtyChange(stockItemId: number, val: string) {
    const num = Math.max(0, Number(val) || 0);
    setItemQuantities((prev) => ({ ...prev, [stockItemId]: num }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = Object.entries(itemQuantities).map(
        ([stockItemId, quantite]) => ({
          stockItemId: Number(stockItemId),
          quantite,
        }),
      );

      await updateRoomDotation({
        roomTypeId: dotation.roomTypeId,
        dotations: payload,
      });

      toastManager.add({
        title: "Dotation enregistrée",
        description: `Dotations ajustées pour ${dotation.roomTypeName}`,
        type: "success",
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de sauvegarde");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Dotation Standard — {dotation.roomTypeName}</DialogTitle>
      </DialogHeader>

      <p className="text-xs text-muted-foreground">
        Définissez le matériel et la lingerie nécessaires pour équiper 1 chambre
        de type "{dotation.roomTypeName}".
      </p>

      <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
        {dotation.items.map((item) => (
          <div
            key={item.stockItemId}
            className="flex items-center justify-between gap-3 p-2 border rounded-md text-xs"
          >
            <div className="flex-1">
              <span className="font-semibold block">{item.libelle}</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {item.code} — {item.categorie}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs">Quantité :</Label>
              <Input
                type="number"
                min="0"
                className="w-20 h-8 text-xs text-center"
                value={itemQuantities[item.stockItemId] ?? 0}
                onChange={(e) =>
                  handleQtyChange(item.stockItemId, e.target.value)
                }
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Enregistrement…" : "Sauvegarder la dotation"}
        </Button>
      </DialogFooter>
    </form>
  );
}
