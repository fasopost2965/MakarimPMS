import { useCallback, useEffect, useState } from "react";
import {
  BedDouble,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Coins,
  LogIn,
  LogOut,
  RefreshCw,
  ScanLine,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  ArrowUpRight,
} from "lucide-react";
import type { Tab } from "@/App";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listDepartsDuJour, listStaysEnCours } from "@/features/checkin/api";
import type { Stay } from "@/features/checkin/types";
import { arrivalsToday, listRooms } from "@/features/reservations/api";
import type { Reservation, Room } from "@/features/reservations/types";
import { getDashboardResume } from "../api";
import type { DashboardResume } from "../types";
import { BookingTrendsChart } from "../components/BookingTrendsChart";
import { HousekeepingTasksWidget } from "../components/HousekeepingTasksWidget";
import { AlertsPanel } from "../components/AlertsPanel";

export type DashboardTarget = Tab;

interface Props {
  onNavigate: (target: DashboardTarget) => void;
}

export function DashboardPage({ onNavigate }: Props) {
  const [resume, setResume] = useState<DashboardResume | null>(null);
  const [arrivals, setArrivals] = useState<Reservation[]>([]);
  const [departures, setDepartures] = useState<Stay[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "arrivals" | "departures" | "stays"
  >("arrivals");
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const [resumeRes, arrivalsRes, departuresRes, roomsRes, staysRes] =
      await Promise.allSettled([
        getDashboardResume(),
        arrivalsToday(),
        listDepartsDuJour(),
        listRooms(),
        listStaysEnCours(),
      ]);

    if (resumeRes.status === "fulfilled") {
      setResume(resumeRes.value);
    } else {
      setError(
        resumeRes.reason instanceof Error
          ? resumeRes.reason.message
          : "Erreur lors du chargement des indicateurs",
      );
    }

    if (arrivalsRes.status === "fulfilled") setArrivals(arrivalsRes.value);
    if (departuresRes.status === "fulfilled")
      setDepartures(departuresRes.value);
    if (roomsRes.status === "fulfilled") setRooms(roomsRes.value);
    if (staysRes.status === "fulfilled") setStays(staysRes.value);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const todayDateStr = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const formattedDate =
    todayDateStr.charAt(0).toUpperCase() + todayDateStr.slice(1);

  // Stats room counts
  const totalRoomsCount = resume?.totalChambres || rooms.length || 0;
  const librePropreCount = rooms.filter(
    (r) => r.statut === "LIBRE_PROPRE",
  ).length;
  const occupeeCount = rooms.filter((r) => r.statut === "OCCUPEE").length;
  const aNettoyerCount = rooms.filter(
    (r) => r.statut === "A_NETTOYER" || r.statut === "EN_NETTOYAGE",
  ).length;
  const reserveeCount = rooms.filter(
    (r) => r.statut === "RESERVEE" || r.statut === "DEPART_PREVU",
  ).length;
  const maintenanceCount = rooms.filter(
    (r) => r.statut === "EN_MAINTENANCE",
  ).length;

  // Calculated RevPAR & ADR
  const encaisse = Number(resume?.encaisseAujourdhui || 0);
  const revPAR = totalRoomsCount > 0 ? encaisse / totalRoomsCount : 0;
  const adr =
    occupeeCount > 0 ? encaisse / occupeeCount : encaisse > 0 ? encaisse : 650;

  // Filtered lists for main desk view
  const filteredArrivals = arrivals.filter((res) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const guestName =
      `${res.guest?.nom ?? ""} ${res.guest?.prenom ?? ""}`.toLowerCase();
    const roomNum = res.room?.numero?.toLowerCase() ?? "";
    const roomType = res.room?.roomType?.nom?.toLowerCase() ?? "";
    return (
      guestName.includes(term) ||
      roomNum.includes(term) ||
      roomType.includes(term)
    );
  });

  const filteredDepartures = departures.filter((stay) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const guestName =
      `${stay.guest?.nom ?? ""} ${stay.guest?.prenom ?? ""}`.toLowerCase();
    const roomNum = stay.room?.numero?.toLowerCase() ?? "";
    return guestName.includes(term) || roomNum.includes(term);
  });

  const filteredStays = stays.filter((stay) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const guestName =
      `${stay.guest?.nom ?? ""} ${stay.guest?.prenom ?? ""}`.toLowerCase();
    const roomNum = stay.room?.numero?.toLowerCase() ?? "";
    return guestName.includes(term) || roomNum.includes(term);
  });

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* HEADER BAR & QUICK ACTIONS */}
      <div className="flex flex-col justify-between gap-4 border-b pb-5 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Cockpit Opérationnel Réception
            </h1>
            <Badge variant="outline" className="gap-1.5 text-xs font-normal">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Direct Front Desk
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <span>{formattedDate}</span>
            <span>•</span>
            <span className="font-medium text-foreground">
              Hôtel Makarim PMS
            </span>
          </p>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            title="Rafraîchir les données en direct"
          >
            <RefreshCw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Rafraîchir</span>
          </Button>

          <Button
            size="sm"
            onClick={() => onNavigate("checkin")}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            <LogIn className="size-4" />+ Walk-In
          </Button>

          <Button
            size="sm"
            onClick={() => onNavigate("reservations")}
            className="gap-2"
          >
            <CalendarRange className="size-4" />+ Réservation
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate("housekeeping")}
            className="gap-2"
          >
            <Sparkles className="size-4" />
            Gouvernance
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("document-ocr")}
            className="gap-2"
          >
            <ScanLine className="size-4" />
            Scan ID / OCR
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive text-sm flex items-center justify-between">
          <p>{error}</p>
          <Button size="sm" variant="outline" onClick={() => loadData()}>
            Réessayer
          </Button>
        </div>
      )}

      {/* EXECUTIVE KPI RIBBON - 6 HIGH-LEVEL CARDS */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-lg border bg-card p-4 animate-pulse"
            />
          ))}
        </div>
      ) : (
        resume && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* KPI 1: TAUX OCCUPATION */}
            <button
              type="button"
              onClick={() => onNavigate("housekeeping")}
              className="bg-card hover:border-primary/50 cursor-pointer rounded-lg border p-4 shadow-xs transition-all flex flex-col justify-between gap-3 group text-left w-full"
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Taux Occupation
                </span>
                <div className="rounded-md bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <BedDouble className="size-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-bold tracking-tight text-primary">
                    {resume.tauxOccupation}%
                  </p>
                  <span className="text-[10px] text-emerald-600 font-medium flex items-center">
                    <ArrowUpRight className="size-3" /> +3.2%
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{
                      width: `${Math.min(100, resume.tauxOccupation)}%`,
                    }}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                {resume.chambresOccupees} / {resume.totalChambres} occupées
              </p>
            </button>

            {/* KPI 2: RevPAR */}
            <button
              type="button"
              onClick={() => onNavigate("reporting")}
              className="bg-card hover:border-primary/50 cursor-pointer rounded-lg border p-4 shadow-xs transition-all flex flex-col justify-between gap-3 group text-left w-full"
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  RevPAR
                </span>
                <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
                  {Math.round(revPAR).toLocaleString("fr-MA")}{" "}
                  <span className="text-xs font-normal">MAD</span>
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (revPAR / 800) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Revenu / chambre disponible
              </p>
            </button>

            {/* KPI 3: ADR (Prix Moyen) */}
            <button
              type="button"
              onClick={() => onNavigate("reporting")}
              className="bg-card hover:border-primary/50 cursor-pointer rounded-lg border p-4 shadow-xs transition-all flex flex-col justify-between gap-3 group text-left w-full"
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  ADR (Prix Moyen)
                </span>
                <div className="rounded-md bg-amber-500/10 p-2 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Coins className="size-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {Math.round(adr).toLocaleString("fr-MA")}{" "}
                  <span className="text-xs font-normal">MAD</span>
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (adr / 1200) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Prix moyen par nuitée
              </p>
            </button>

            {/* KPI 4: ARRIVEES DU JOUR */}
            <button
              type="button"
              onClick={() => onNavigate("checkin")}
              className="bg-card hover:border-primary/50 cursor-pointer rounded-lg border p-4 shadow-xs transition-all flex flex-col justify-between gap-3 group text-left w-full"
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Arrivées du jour
                </span>
                <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <LogIn className="size-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold tracking-tight">
                  {resume.arriveesAujourdhui}
                </p>
                {arrivals.length > 0 && (
                  <Badge variant="success" className="text-[10px]">
                    {arrivals.length} à traiter
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <span>Accéder au Check-in</span>
                <ChevronRight className="size-3" />
              </p>
            </button>

            {/* KPI 5: DEPARTS DU JOUR */}
            <button
              type="button"
              onClick={() => onNavigate("checkin")}
              className="bg-card hover:border-primary/50 cursor-pointer rounded-lg border p-4 shadow-xs transition-all flex flex-col justify-between gap-3 group text-left w-full"
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Départs du jour
                </span>
                <div className="rounded-md bg-blue-500/10 p-2 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <LogOut className="size-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold tracking-tight">
                  {resume.departsAujourdhui}
                </p>
                {departures.length > 0 && (
                  <Badge variant="info" className="text-[10px]">
                    {departures.length} libérations
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <span>Accéder aux Libérations</span>
                <ChevronRight className="size-3" />
              </p>
            </button>

            {/* KPI 6: GOUVERNANCE / MENAGE */}
            <button
              type="button"
              onClick={() => onNavigate("housekeeping")}
              className="bg-card hover:border-primary/50 cursor-pointer rounded-lg border p-4 shadow-xs transition-all flex flex-col justify-between gap-3 group text-left w-full"
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Gouvernance
                </span>
                <div className="rounded-md bg-purple-500/10 p-2 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Sparkles className="size-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold tracking-tight">
                  {resume.chambresANettoyer}
                </p>
                {resume.chambresANettoyer > 0 ? (
                  <Badge variant="warning" className="text-[10px]">
                    À nettoyer
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    À jour
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <span>Planning Ménage</span>
                <ChevronRight className="size-3" />
              </p>
            </button>
          </div>
        )
      )}

      {/* BOOKING TRENDS CHART (RECHARTS) */}
      <BookingTrendsChart />

      {/* MAIN OPERATIONAL GRID */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: LIVE DESK MOVEMENTS & UPCOMING TASKS WIDGET (2 COLS) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* MOVEMENTS DESK CARD */}
          <div className="rounded-lg border bg-card p-5 shadow-xs flex flex-col gap-5">
            {/* TAB BAR & LIVE SEARCH */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border">
                <Button
                  variant={activeTab === "arrivals" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("arrivals")}
                  className="gap-2 text-xs"
                >
                  <LogIn className="size-3.5" />
                  <span>Arrivées</span>
                  <Badge
                    variant="secondary"
                    className="px-1.5 text-[10px] py-0"
                  >
                    {arrivals.length}
                  </Badge>
                </Button>
                <Button
                  variant={activeTab === "departures" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("departures")}
                  className="gap-2 text-xs"
                >
                  <LogOut className="size-3.5" />
                  <span>Départs</span>
                  <Badge
                    variant="secondary"
                    className="px-1.5 text-[10px] py-0"
                  >
                    {departures.length}
                  </Badge>
                </Button>
                <Button
                  variant={activeTab === "stays" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("stays")}
                  className="gap-2 text-xs"
                >
                  <UserCheck className="size-3.5" />
                  <span>Séjours en cours</span>
                  <Badge
                    variant="secondary"
                    className="px-1.5 text-[10px] py-0"
                  >
                    {stays.length}
                  </Badge>
                </Button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher client, chambre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
            </div>

            {/* LIST VIEW 1: ARRIVAL MOVEMENTS */}
            {activeTab === "arrivals" && (
              <div className="flex flex-col gap-3">
                {filteredArrivals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed my-2">
                    <CheckCircle2 className="size-10 text-emerald-500 mb-2" />
                    <p className="font-semibold text-sm">
                      {searchTerm
                        ? "Aucune arrivée ne correspond à votre recherche."
                        : "Toutes les arrivées prévues aujourd'hui ont été traitées !"}
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Pour enregistrer un client sans réservation, utilisez le
                      bouton Walk-In.
                    </p>
                    <Button
                      size="sm"
                      className="mt-4 gap-2"
                      onClick={() => onNavigate("checkin")}
                    >
                      <LogIn className="size-4" /> Effectuer un Walk-In
                    </Button>
                  </div>
                ) : (
                  filteredArrivals.map((res) => (
                    <div
                      key={res.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border p-4 hover:border-primary/40 transition-colors bg-background"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">
                            {res.guest?.nom} {res.guest?.prenom}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {res.canal === "WALK_IN"
                              ? "Walk-in"
                              : res.canal === "BOOKING_COM"
                                ? "Booking.com"
                                : "Direct"}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            Chambre #{res.room?.numero ?? "Non attribuée"} (
                            {res.room?.roomType?.nom ?? "Standard"})
                          </span>
                          <span>•</span>
                          <span>
                            Du {res.dateArrivee.slice(0, 10)} au{" "}
                            {res.dateDepart.slice(0, 10)}
                          </span>
                        </p>
                        {res.guest?.telephone && (
                          <p className="text-muted-foreground text-[11px]">
                            Tél: {res.guest.telephone}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                        <div className="text-right">
                          <p className="text-xs font-bold">
                            {Number(res.prixTotalFinal).toLocaleString("fr-MA")}{" "}
                            MAD
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Total séjour
                          </p>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => onNavigate("checkin")}
                          className="gap-1 text-xs"
                        >
                          <span>Check-in</span>
                          <ChevronRight className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* LIST VIEW 2: DEPARTURE MOVEMENTS */}
            {activeTab === "departures" && (
              <div className="flex flex-col gap-3">
                {filteredDepartures.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed my-2">
                    <CheckCircle2 className="size-10 text-blue-500 mb-2" />
                    <p className="font-semibold text-sm">
                      {searchTerm
                        ? "Aucun départ ne correspond à votre recherche."
                        : "Aucun départ restant pour aujourd'hui."}
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Les clés et folios de départ sont gérés dans le guichet
                      Check-out.
                    </p>
                  </div>
                ) : (
                  filteredDepartures.map((stay) => (
                    <div
                      key={stay.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border p-4 hover:border-primary/40 transition-colors bg-background"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="font-bold text-xs"
                          >
                            Chambre #{stay.room?.numero}
                          </Badge>
                          <span className="font-semibold text-sm">
                            {stay.guest?.nom} {stay.guest?.prenom}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs flex items-center gap-2">
                          <span>Check-in: {stay.dateCheckin.slice(0, 10)}</span>
                          <span>•</span>
                          <span>
                            Départ prévu: {stay.dateCheckoutPrevue.slice(0, 10)}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                        {stay.policeRecord ? (
                          <Badge variant="success" className="text-[10px]">
                            Police DGSN ok
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="text-[10px]">
                            Fiche police à compléter
                          </Badge>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onNavigate("checkin")}
                          className="gap-1 text-xs"
                        >
                          <span>Check-out</span>
                          <ChevronRight className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* LIST VIEW 3: IN-HOUSE STAYS */}
            {activeTab === "stays" && (
              <div className="flex flex-col gap-3">
                {filteredStays.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed my-2">
                    <BedDouble className="size-10 text-muted-foreground mb-2" />
                    <p className="font-semibold text-sm">
                      {searchTerm
                        ? "Aucun séjour en cours ne correspond à la recherche."
                        : "Aucun séjour actuellement actif dans l'établissement."}
                    </p>
                  </div>
                ) : (
                  filteredStays.map((stay) => (
                    <div
                      key={stay.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border p-4 hover:border-primary/40 transition-colors bg-background"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge className="font-bold text-xs">
                            Ch. {stay.room?.numero}
                          </Badge>
                          <span className="font-semibold text-sm">
                            {stay.guest?.nom} {stay.guest?.prenom}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          Arrivé le {stay.dateCheckin.slice(0, 10)} — Départ
                          prévu le {stay.dateCheckoutPrevue.slice(0, 10)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onNavigate("checkin")}
                          className="gap-1 text-xs"
                        >
                          <span>Détails Stay</span>
                          <ChevronRight className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* UPCOMING TASKS & HOUSEKEEPING PRIORITY WIDGET */}
          <HousekeepingTasksWidget
            onNavigate={onNavigate}
            chambresANettoyerCount={resume?.chambresANettoyer ?? aNettoyerCount}
          />
        </div>

        {/* RIGHT COLUMN: ALERTS, INVENTORY & COCKPIT SHORTCUTS (1 COL) */}
        <div className="flex flex-col gap-6">
          {/* URGENT ALERTS PANEL */}
          <AlertsPanel onNavigate={onNavigate} />

          {/* CARD 2: ROOM INVENTORY BREAKDOWN */}
          <div className="rounded-lg border bg-card p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold">
                  État du Parc de Chambres
                </h3>
                <p className="text-muted-foreground text-xs">
                  Inventaire temps réel ({totalRoomsCount} chambres)
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate("housekeeping")}
                className="text-xs p-1 h-auto"
              >
                Gouvernance →
              </Button>
            </div>

            {/* Visual Status Bar */}
            {totalRoomsCount > 0 && (
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary gap-0.5">
                <div
                  className="bg-emerald-600 h-full"
                  style={{
                    width: `${(librePropreCount / totalRoomsCount) * 100}%`,
                  }}
                  title={`Libre & Propre: ${librePropreCount}`}
                />
                <div
                  className="bg-blue-600 h-full"
                  style={{
                    width: `${(occupeeCount / totalRoomsCount) * 100}%`,
                  }}
                  title={`Occupée: ${occupeeCount}`}
                />
                <div
                  className="bg-amber-500 h-full"
                  style={{
                    width: `${(aNettoyerCount / totalRoomsCount) * 100}%`,
                  }}
                  title={`À nettoyer: ${aNettoyerCount}`}
                />
                <div
                  className="bg-purple-500 h-full"
                  style={{
                    width: `${(reserveeCount / totalRoomsCount) * 100}%`,
                  }}
                  title={`Réservée: ${reserveeCount}`}
                />
                <div
                  className="bg-rose-600 h-full"
                  style={{
                    width: `${(maintenanceCount / totalRoomsCount) * 100}%`,
                  }}
                  title={`Maintenance: ${maintenanceCount}`}
                />
              </div>
            )}

            {/* Room Status Chips */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between rounded-md border p-2 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
                <span className="font-medium">Libre & Propre</span>
                <span className="font-bold text-sm">{librePropreCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border p-2 bg-blue-500/10 text-blue-900 dark:text-blue-200">
                <span className="font-medium">Occupées</span>
                <span className="font-bold text-sm">{occupeeCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border p-2 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                <span className="font-medium">À nettoyer</span>
                <span className="font-bold text-sm">{aNettoyerCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border p-2 bg-purple-500/10 text-purple-900 dark:text-purple-200">
                <span className="font-medium">Réservées / Départ</span>
                <span className="font-bold text-sm">{reserveeCount}</span>
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-md border p-2 bg-rose-500/10 text-rose-900 dark:text-rose-200">
                <span className="font-medium">Hors service / Maintenance</span>
                <span className="font-bold text-sm">{maintenanceCount}</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("housekeeping")}
              className="w-full justify-between mt-1 text-xs"
            >
              <span>Accéder à la grille Housekeeping</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* CARD 3: COCKPIT SHORTCUTS */}
          <div className="rounded-lg border bg-card p-5 shadow-xs flex flex-col gap-4">
            <h3 className="text-base font-bold border-b pb-3">
              Raccourcis & Conformité PMS
            </h3>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onNavigate("document-ocr")}
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 cursor-pointer bg-background transition-all group text-left w-full"
              >
                <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <ScanLine className="size-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold">OCR Pièce d'Identité</p>
                  <p className="text-[11px] text-muted-foreground">
                    Scan automatique CIN & Passeport
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate("guests")}
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 cursor-pointer bg-background transition-all group text-left w-full"
              >
                <div className="p-2 rounded-md bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Users className="size-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold">Fichiers Clients & CRM</p>
                  <p className="text-[11px] text-muted-foreground">
                    Historique séjours & fiches d'identité
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate("companies")}
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 cursor-pointer bg-background transition-all group text-left w-full"
              >
                <div className="p-2 rounded-md bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Building2 className="size-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold">Comptes Sociétés</p>
                  <p className="text-[11px] text-muted-foreground">
                    Facturation entreprise & partenariats
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate("reporting")}
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 cursor-pointer bg-background transition-all group text-left w-full"
              >
                <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <TrendingUp className="size-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold">Rapports & Statistiques</p>
                  <p className="text-[11px] text-muted-foreground">
                    RevPAR, ADR, encaissements & main courante
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
