import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LogIn,
  LogOut,
  BedDouble,
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  Phone,
  CheckCircle2,
  Plus,
  AlertCircle,
  FileCheck2,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { arrivalsToday, listRooms } from "../../reservations/api";
import type { Reservation, Room } from "../../reservations/types";
import {
  checkinFromReservation,
  checkinWalkIn,
  checkoutStay,
  listDepartsDuJour,
  listStaysEnCours,
} from "../api";
import type { Stay, WalkinCheckinInput } from "../types";
import { WalkinCheckinDialog } from "../components/WalkinCheckinDialog";
import { StayDetailsDialog } from "../components/StayDetailsDialog";
import { QrCheckinScannerDialog } from "../components/QrCheckinScannerDialog";

type TabMode = "ARRIVEES" | "EN_COURS" | "DEPARTS" | "POLICE_ALERT";

export function CheckinPage() {
  const [arrivals, setArrivals] = useState<Reservation[]>([]);
  const [staysEnCours, setStaysEnCours] = useState<Stay[]>([]);
  const [departs, setDeparts] = useState<Stay[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [checkingInReservationId, setCheckingInReservationId] = useState<
    number | null
  >(null);

  // Filters state
  const [activeTab, setActiveTab] = useState<TabMode>("ARRIVEES");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<string>("ALL");

  // Modals state
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);
  const [walkinError, setWalkinError] = useState<string | null>(null);

  const [viewingStay, setViewingStay] = useState<Stay | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [soldeDu, setSoldeDu] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [arrivalsData, staysData, departsData, roomsData] =
        await Promise.all([
          arrivalsToday(),
          listStaysEnCours(),
          listDepartsDuJour(),
          listRooms(),
        ]);
      setArrivals(arrivalsData);
      setStaysEnCours(staysData);
      setDeparts(departsData);
      setRooms(roomsData);

      setViewingStay((current) =>
        current
          ? ([...staysData, ...departsData].find((s) => s.id === current.id) ??
            current)
          : null,
      );
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

  function openStay(stay: Stay) {
    setSoldeDu(null);
    setCheckoutError(null);
    setViewingStay(stay);
  }

  async function handleCheckin(reservationId: number, guestName?: string) {
    setActionError(null);
    setSuccessMsg(null);
    setCheckingInReservationId(reservationId);
    try {
      await checkinFromReservation(reservationId);
      setSuccessMsg(
        `Check-in réussi pour ${guestName || "la réservation"} ! Le client est maintenant enregistré en séjour.`,
      );
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur de check-in");
    } finally {
      setCheckingInReservationId(null);
    }
  }

  async function handleWalkinConfirm(input: WalkinCheckinInput) {
    setWalkinSubmitting(true);
    setWalkinError(null);
    setSuccessMsg(null);
    try {
      await checkinWalkIn(input);
      setWalkinOpen(false);
      setSuccessMsg(
        "Walk-in enregistré avec succès ! Le client a été installé dans sa chambre.",
      );
      await refetch();
    } catch (err) {
      setWalkinError(err instanceof Error ? err.message : "Erreur de check-in");
    } finally {
      setWalkinSubmitting(false);
    }
  }

  async function handleCheckout() {
    if (!viewingStay) return;
    setCheckingOut(true);
    setCheckoutError(null);
    setSuccessMsg(null);
    try {
      const result = await checkoutStay(viewingStay.id);
      setSoldeDu(result.soldeDu);
      setViewingStay(result);
      setSuccessMsg(
        `Check-out effectué pour la chambre #${viewingStay.room.numero}. Solde final : ${result.soldeDu} MAD.`,
      );
      await refetch();
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "Erreur de check-out",
      );
    } finally {
      setCheckingOut(false);
    }
  }

  // Calculate Police Alert missing records
  const missingPoliceStays = useMemo(() => {
    const allActive = [...staysEnCours, ...departs];
    const uniqueMap = new Map<number, Stay>();
    allActive.forEach((s) => uniqueMap.set(s.id, s));
    return Array.from(uniqueMap.values()).filter((s) => !s.policeRecord);
  }, [staysEnCours, departs]);

  // Filter functions
  const filteredArrivals = useMemo(() => {
    return arrivals.filter((res) => {
      const matchQuery =
        !searchQuery ||
        `${res.guest.nom} ${res.guest.prenom}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        res.room.numero.includes(searchQuery) ||
        (res.guest.telephone && res.guest.telephone.includes(searchQuery));

      const floor = res.room.numero.startsWith("1")
        ? "1"
        : res.room.numero.startsWith("2")
          ? "2"
          : res.room.numero.startsWith("3")
            ? "3"
            : "0";

      const matchFloor = selectedFloor === "ALL" || floor === selectedFloor;

      return matchQuery && matchFloor;
    });
  }, [arrivals, searchQuery, selectedFloor]);

  const filteredStaysEnCours = useMemo(() => {
    return staysEnCours.filter((stay) => {
      const matchQuery =
        !searchQuery ||
        `${stay.guest.nom} ${stay.guest.prenom}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        stay.room.numero.includes(searchQuery) ||
        (stay.guest.telephone && stay.guest.telephone.includes(searchQuery));

      const floor = stay.room.numero.startsWith("1")
        ? "1"
        : stay.room.numero.startsWith("2")
          ? "2"
          : stay.room.numero.startsWith("3")
            ? "3"
            : "0";

      const matchFloor = selectedFloor === "ALL" || floor === selectedFloor;

      return matchQuery && matchFloor;
    });
  }, [staysEnCours, searchQuery, selectedFloor]);

  const filteredDeparts = useMemo(() => {
    return departs.filter((stay) => {
      const matchQuery =
        !searchQuery ||
        `${stay.guest.nom} ${stay.guest.prenom}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        stay.room.numero.includes(searchQuery) ||
        (stay.guest.telephone && stay.guest.telephone.includes(searchQuery));

      const floor = stay.room.numero.startsWith("1")
        ? "1"
        : stay.room.numero.startsWith("2")
          ? "2"
          : stay.room.numero.startsWith("3")
            ? "3"
            : "0";

      const matchFloor = selectedFloor === "ALL" || floor === selectedFloor;

      return matchQuery && matchFloor;
    });
  }, [departs, searchQuery, selectedFloor]);

  const filteredPoliceAlerts = useMemo(() => {
    return missingPoliceStays.filter((stay) => {
      const matchQuery =
        !searchQuery ||
        `${stay.guest.nom} ${stay.guest.prenom}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        stay.room.numero.includes(searchQuery);

      const floor = stay.room.numero.startsWith("1")
        ? "1"
        : stay.room.numero.startsWith("2")
          ? "2"
          : stay.room.numero.startsWith("3")
            ? "3"
            : "0";

      const matchFloor = selectedFloor === "ALL" || floor === selectedFloor;

      return matchQuery && matchFloor;
    });
  }, [missingPoliceStays, searchQuery, selectedFloor]);

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6 bg-background/50">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <LogIn className="size-6 text-emerald-600" />
              Réception & Check-In / Out
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              Hôtel Makarim
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gestion des flux de réception, arrivées du jour, séjours occupés et
            conformité légale DGSN
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={loading}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin text-primary" : ""}`}
            />
            <span>Actualiser</span>
          </Button>

          <Button
            onClick={() => setQrScannerOpen(true)}
            size="sm"
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
          >
            <QrCode className="size-4" />
            <span>Scanner Pass QR Express</span>
          </Button>

          <Button
            onClick={() => setWalkinOpen(true)}
            size="sm"
            className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs"
          >
            <Plus className="size-4" />
            <span>+ Walk-In Réception Direct</span>
          </Button>
        </div>
      </div>

      {/* SUCCESS OR ERROR MESSAGES */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            {successMsg}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px]"
            onClick={() => setSuccessMsg(null)}
          >
            Fermer
          </Button>
        </div>
      )}

      {(loadError || actionError) && (
        <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="size-4" />
          <span>{loadError || actionError}</span>
        </div>
      )}

      {/* TOP KPI STATS SUMMARY GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: ARRIVEES DU JOUR */}
        <button
          type="button"
          onClick={() => setActiveTab("ARRIVEES")}
          className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
            activeTab === "ARRIVEES"
              ? "bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/20 shadow-xs"
              : "bg-card hover:bg-muted/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <LogIn className="size-4 text-blue-600" />
              Arrivées du Jour
            </span>
            <Badge variant="info" className="text-xs font-bold font-mono">
              {arrivals.length}
            </Badge>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-foreground font-mono">
              {arrivals.length}
            </span>
            <span className="text-[11px] text-muted-foreground">
              À enregistrer
            </span>
          </div>
        </button>

        {/* KPI 2: SEJOURS EN COURS */}
        <button
          type="button"
          onClick={() => setActiveTab("EN_COURS")}
          className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
            activeTab === "EN_COURS"
              ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/20 shadow-xs"
              : "bg-card hover:bg-muted/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <BedDouble className="size-4 text-emerald-600" />
              Séjours en Cours
            </span>
            <Badge variant="success" className="text-xs font-bold font-mono">
              {staysEnCours.length}
            </Badge>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-foreground font-mono">
              {staysEnCours.length}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Chambres occupées
            </span>
          </div>
        </button>

        {/* KPI 3: DEPARTS DU JOUR */}
        <button
          type="button"
          onClick={() => setActiveTab("DEPARTS")}
          className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
            activeTab === "DEPARTS"
              ? "bg-amber-500/10 border-amber-500 ring-1 ring-amber-500/20 shadow-xs"
              : "bg-card hover:bg-muted/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <LogOut className="size-4 text-amber-600" />
              Départs Prévus
            </span>
            <Badge variant="warning" className="text-xs font-bold font-mono">
              {departs.length}
            </Badge>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-foreground font-mono">
              {departs.length}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Aujourd'hui
            </span>
          </div>
        </button>

        {/* KPI 4: DGSN POLICE CONFORMITY */}
        <button
          type="button"
          onClick={() => setActiveTab("POLICE_ALERT")}
          className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
            activeTab === "POLICE_ALERT"
              ? "bg-destructive/10 border-destructive ring-1 ring-destructive/20 shadow-xs"
              : "bg-card hover:bg-muted/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="size-4 text-destructive" />
              Police DGSN
            </span>
            <Badge
              variant={
                missingPoliceStays.length > 0 ? "destructive" : "outline"
              }
              className="text-xs font-bold font-mono"
            >
              {missingPoliceStays.length}
            </Badge>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-foreground font-mono">
              {missingPoliceStays.length}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {missingPoliceStays.length > 0
                ? "⚠ Fiches requises"
                : "✓ Registre 100% conforme"}
            </span>
          </div>
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-3.5 rounded-xl border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* TABS SELECTOR */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            {
              id: "ARRIVEES" as TabMode,
              label: "Arrivées du Jour",
              count: arrivals.length,
            },
            {
              id: "EN_COURS" as TabMode,
              label: "Séjours en Cours",
              count: staysEnCours.length,
            },
            {
              id: "DEPARTS" as TabMode,
              label: "Départs du Jour",
              count: departs.length,
            },
            {
              id: "POLICE_ALERT" as TabMode,
              label: "Alertes Fiches Police",
              count: missingPoliceStays.length,
              alert: missingPoliceStays.length > 0,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : tab.alert
                        ? "bg-destructive text-destructive-foreground font-bold"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* SEARCH & FLOOR FILTERS */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Nom client, chambre, tel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>

          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-xs focus-visible:outline-hidden"
          >
            <option value="ALL">Tous les étages</option>
            <option value="1">1er Étage</option>
            <option value="2">2ème Étage</option>
            <option value="3">3ème Étage</option>
          </select>
        </div>
      </div>

      {/* DYNAMIC LIST CONTENT BY TAB */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
          <RefreshCw className="size-6 animate-spin text-primary" />
          <span>Chargement des données de réception en cours…</span>
        </div>
      ) : (
        <>
          {/* VIEW 1: ARRIVEES DU JOUR */}
          {activeTab === "ARRIVEES" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                <span>Client & Réservation ({filteredArrivals.length})</span>
                <span>Actions Réception</span>
              </div>

              {filteredArrivals.length === 0 ? (
                <div className="py-12 border rounded-xl bg-card text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                  <CheckCircle2 className="size-8 text-emerald-500" />
                  <p className="font-semibold text-foreground">
                    Aucune arrivée restante pour aujourd'hui
                  </p>
                  <p className="text-[11px]">
                    Toutes les arrivées prévues ont été traitées ou aucune
                    réservation ne correspond.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredArrivals.map((res) => {
                    const floor = res.room.numero.startsWith("1")
                      ? "1er Étage"
                      : res.room.numero.startsWith("2")
                        ? "2ème Étage"
                        : "3ème Étage";

                    return (
                      <div
                        key={res.id}
                        className="rounded-xl border bg-card p-4 flex flex-col justify-between gap-3 hover:shadow-md transition-all border-l-4 border-l-blue-500"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between border-b pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base text-foreground font-mono">
                                Ch. #{res.room.numero}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {floor}
                              </Badge>
                            </div>
                            <Badge variant="info" className="text-[10px]">
                              {res.canal === "BOOKING_COM"
                                ? "Booking.com"
                                : res.canal === "WALK_IN"
                                  ? "Walk-In"
                                  : "Direct"}
                            </Badge>
                          </div>

                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-sm text-foreground">
                              {res.guest.nom} {res.guest.prenom}
                            </p>
                            {res.guest.telephone && (
                              <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
                                <Phone className="size-3 text-emerald-600" />
                                <span>{res.guest.telephone}</span>
                              </p>
                            )}
                            <p className="text-muted-foreground text-[11px]">
                              Catégorie : {res.room.roomType.nom} (
                              {res.room.roomType.prixBase} MAD/nuit)
                            </p>
                            <p className="text-muted-foreground text-[11px] font-mono">
                              Séjour: {res.dateArrivee.slice(0, 10)} →{" "}
                              {res.dateDepart.slice(0, 10)}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t flex items-center justify-between">
                          <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400 font-mono">
                            {Number(res.prixTotalFinal).toLocaleString("fr-MA")}{" "}
                            MAD
                          </span>

                          <Button
                            size="sm"
                            onClick={() =>
                              handleCheckin(
                                res.id,
                                `${res.guest.nom} ${res.guest.prenom}`,
                              )
                            }
                            disabled={checkingInReservationId === res.id}
                            className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                          >
                            <LogIn className="size-3.5" />
                            <span>
                              {checkingInReservationId === res.id
                                ? "Check-in en cours…"
                                : "Valider Check-In"}
                            </span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: SEJOURS EN COURS */}
          {activeTab === "EN_COURS" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                <span>
                  Chambres Occupées en Séjour ({filteredStaysEnCours.length})
                </span>
                <span>Fiche & Facturation</span>
              </div>

              {filteredStaysEnCours.length === 0 ? (
                <div className="py-12 border rounded-xl bg-card text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                  <BedDouble className="size-8 text-muted-foreground" />
                  <p className="font-semibold text-foreground">
                    Aucun séjour actuellement en cours
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStaysEnCours.map((stay) => {
                    const floor = stay.room.numero.startsWith("1")
                      ? "1er Étage"
                      : stay.room.numero.startsWith("2")
                        ? "2ème Étage"
                        : "3ème Étage";

                    return (
                      <div
                        key={stay.id}
                        className="rounded-xl border bg-card p-4 flex flex-col justify-between gap-3 hover:shadow-md transition-all border-l-4 border-l-emerald-500"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between border-b pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base text-foreground font-mono">
                                Ch. #{stay.room.numero}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {floor}
                              </Badge>
                            </div>
                            {stay.policeRecord ? (
                              <Badge
                                variant="success"
                                className="text-[9px] gap-1"
                              >
                                <ShieldCheck className="size-3" />
                                <span>Police OK</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="text-[9px] gap-1 animate-pulse"
                              >
                                <ShieldAlert className="size-3" />
                                <span>Fiche Police Requise</span>
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-sm text-foreground">
                              {stay.guest.nom} {stay.guest.prenom}
                            </p>
                            {stay.guest.telephone && (
                              <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
                                <Phone className="size-3 text-emerald-600" />
                                <span>{stay.guest.telephone}</span>
                              </p>
                            )}
                            <p className="text-muted-foreground text-[11px]">
                              Check-in :{" "}
                              {new Date(stay.dateCheckin).toLocaleDateString(
                                "fr-FR",
                              )}
                            </p>
                            <p className="text-muted-foreground text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                              Départ prévu :{" "}
                              {stay.dateCheckoutPrevue.slice(0, 10)}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t flex items-center justify-between">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openStay(stay)}
                            className="gap-1.5 text-xs font-semibold"
                          >
                            <FileCheck2 className="size-3.5" />
                            <span>Dossier & Folio</span>
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => openStay(stay)}
                            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                          >
                            <LogOut className="size-3.5" />
                            <span>Check-out</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: DEPARTS DU JOUR */}
          {activeTab === "DEPARTS" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                <span>Départs du Jour ({filteredDeparts.length})</span>
                <span>Règlement & Restitution</span>
              </div>

              {filteredDeparts.length === 0 ? (
                <div className="py-12 border rounded-xl bg-card text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                  <LogOut className="size-8 text-amber-500" />
                  <p className="font-semibold text-foreground">
                    Aucun départ prévu aujourd'hui
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDeparts.map((stay) => {
                    const floor = stay.room.numero.startsWith("1")
                      ? "1er Étage"
                      : stay.room.numero.startsWith("2")
                        ? "2ème Étage"
                        : "3ème Étage";

                    return (
                      <div
                        key={stay.id}
                        className="rounded-xl border bg-card p-4 flex flex-col justify-between gap-3 hover:shadow-md transition-all border-l-4 border-l-amber-500"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between border-b pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base text-foreground font-mono">
                                Ch. #{stay.room.numero}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {floor}
                              </Badge>
                            </div>
                            <Badge variant="warning" className="text-[10px]">
                              Départ aujourd'hui
                            </Badge>
                          </div>

                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-sm text-foreground">
                              {stay.guest.nom} {stay.guest.prenom}
                            </p>
                            {stay.guest.telephone && (
                              <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
                                <Phone className="size-3 text-emerald-600" />
                                <span>{stay.guest.telephone}</span>
                              </p>
                            )}
                            <p className="text-muted-foreground text-[11px]">
                              Arrivé le :{" "}
                              {new Date(stay.dateCheckin).toLocaleDateString(
                                "fr-FR",
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t flex items-center justify-between">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openStay(stay)}
                            className="gap-1.5 text-xs font-semibold"
                          >
                            <span>Facture & Extrait</span>
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => openStay(stay)}
                            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                          >
                            <LogOut className="size-3.5" />
                            <span>Procéder au Check-Out</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 4: POLICE ALERTS */}
          {activeTab === "POLICE_ALERT" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                <span>
                  Alertes Fiches de Police DGSN Requis (
                  {filteredPoliceAlerts.length})
                </span>
                <span>Obligation Légale Réglementaire</span>
              </div>

              {filteredPoliceAlerts.length === 0 ? (
                <div className="py-12 border rounded-xl bg-card text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                  <ShieldCheck className="size-10 text-emerald-500" />
                  <p className="font-bold text-base text-foreground">
                    Registre de Police DGSN 100% Conforme !
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tous les clients actuellement en séjour disposent d'une
                    fiche de police réglementaire remplie.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPoliceAlerts.map((stay) => (
                    <div
                      key={stay.id}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="font-bold text-sm text-foreground font-mono">
                            Chambre #{stay.room.numero}
                          </span>
                          <Badge
                            variant="destructive"
                            className="text-[9px] gap-1"
                          >
                            <ShieldAlert className="size-3" />
                            <span>Fiche Manquante</span>
                          </Badge>
                        </div>

                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-foreground">
                            {stay.guest.nom} {stay.guest.prenom}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            Check-in :{" "}
                            {new Date(stay.dateCheckin).toLocaleDateString(
                              "fr-FR",
                            )}
                          </p>
                          <p className="text-amber-800 dark:text-amber-300 text-[11px] font-medium">
                            Obligation de renseigner CIN / Passeport,
                            nationalité et provenance pour la préfecture de
                            police.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => openStay(stay)}
                          className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                        >
                          <FileCheck2 className="size-3.5" />
                          <span>Renseigner Fiche Police</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* DIALOG 1: WALKIN CHECK-IN */}
      <WalkinCheckinDialog
        open={walkinOpen}
        rooms={rooms}
        onClose={() => {
          setWalkinOpen(false);
          setWalkinError(null);
        }}
        onConfirm={handleWalkinConfirm}
        submitting={walkinSubmitting}
        error={walkinError}
      />

      {/* DIALOG 2: STAY DETAILS & CHECK-OUT */}
      <StayDetailsDialog
        stay={viewingStay}
        onClose={() => {
          setViewingStay(null);
          setCheckoutError(null);
          setSoldeDu(null);
        }}
        onCheckout={handleCheckout}
        checkingOut={checkingOut}
        error={checkoutError}
        soldeDu={soldeDu}
        onPoliceRecordSaved={refetch}
      />

      {/* DIALOG 3: QR CODE CHECK-IN SCANNER */}
      <QrCheckinScannerDialog
        open={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        arrivals={arrivals}
        onConfirmCheckin={handleCheckin}
      />
    </div>
  );
}
