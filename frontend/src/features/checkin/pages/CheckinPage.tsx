import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  UserMinus,
  Plus,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Home,
} from "lucide-react";

export function CheckinPage() {
  const [arrivals, setArrivals] = useState<Reservation[]>([]);
  const [staysEnCours, setStaysEnCours] = useState<Stay[]>([]);
  const [departs, setDeparts] = useState<Stay[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkingInReservationId, setCheckingInReservationId] = useState<
    number | null
  >(null);

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
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Chargement au montage, pas de condition de course (un seul fetch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  function openStay(stay: Stay) {
    setSoldeDu(null);
    setCheckoutError(null);
    setViewingStay(stay);
  }

  async function handleCheckin(reservationId: number) {
    setActionError(null);
    setCheckingInReservationId(reservationId);
    try {
      await checkinFromReservation(reservationId);
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
    try {
      await checkinWalkIn(input);
      setWalkinOpen(false);
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
    try {
      const result = await checkoutStay(viewingStay.id);
      setSoldeDu(result.soldeDu);
      setViewingStay(result);
      await refetch();
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "Erreur de check-out",
      );
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Title & Actions Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-serif font-bold text-foreground">
              Gestion des séjours & réception
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Pilotez les arrivées, départs et séjours en cours à l'Hôtel Makarim.
          </p>
        </div>
        <Button
          onClick={() => setWalkinOpen(true)}
          className="gap-2 self-start sm:self-auto shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Check-in walk-in (Saisie libre)
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

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-16 justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Chargement de la réception…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Section: Arrivées du jour */}
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm border-emerald-500/10">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Arrivées du jour
                  </h2>
                  <p className="text-[10px] text-muted-foreground">
                    Réservations attendues aujourd'hui
                  </p>
                </div>
              </div>
              <Badge
                variant="default"
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-2.5"
              >
                {arrivals.length}
              </Badge>
            </div>

            {arrivals.length === 0 ? (
              <p className="text-muted-foreground text-xs py-8 text-center italic bg-secondary/30 rounded-lg border border-dashed">
                Aucune arrivée prévue aujourd'hui.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-[300px] overflow-auto pr-1">
                {arrivals.map((reservation) => (
                  <li
                    key={reservation.id}
                    className="flex items-center justify-between rounded-lg border bg-background p-3 hover:border-emerald-500/30 transition-all text-sm shadow-xs"
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-foreground">
                        {reservation.guest.nom} {reservation.guest.prenom}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                          Chambre {reservation.room.numero}
                        </span>
                        <span className="text-[10px] uppercase font-semibold">
                          · {reservation.canal}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCheckin(reservation.id)}
                      disabled={checkingInReservationId === reservation.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 h-8"
                    >
                      {checkingInReservationId === reservation.id ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Check-in…
                        </>
                      ) : (
                        "Faire Check-in"
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Section: Départs du jour */}
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm border-indigo-500/10">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <UserMinus className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Départs du jour
                  </h2>
                  <p className="text-[10px] text-muted-foreground">
                    Libérations de chambres attendues
                  </p>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="font-bold text-xs px-2.5 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
              >
                {departs.length}
              </Badge>
            </div>

            {departs.length === 0 ? (
              <p className="text-muted-foreground text-xs py-8 text-center italic bg-secondary/30 rounded-lg border border-dashed">
                Aucun départ prévu aujourd'hui.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-[300px] overflow-auto pr-1">
                {departs.map((stay) => (
                  <li
                    key={stay.id}
                    className="group hover:border-primary/40 flex cursor-pointer items-center justify-between rounded-lg border bg-background p-3 transition-all text-sm shadow-xs"
                    onClick={() => openStay(stay)}
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {stay.guest.nom} {stay.guest.prenom}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          Chambre {stay.room.numero}
                        </span>
                        <span>· Client direct</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-md hover:bg-primary/20 transition-all flex items-center gap-1">
                      Facturer & Sortir <ArrowUpRight className="h-3 w-3" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Section: Séjours en cours */}
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Home className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Séjours en cours à l'hôtel
                  </h2>
                  <p className="text-[10px] text-muted-foreground">
                    Liste des clients actuellement présents
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="font-bold text-xs px-2.5 border-primary/30 text-primary bg-primary/[0.04]"
              >
                {staysEnCours.length} / 24 chambres
              </Badge>
            </div>

            {staysEnCours.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40 animate-pulse" />
                <p className="text-sm font-semibold text-muted-foreground">
                  Aucun séjour en cours
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enregistrez un client avec le bouton ci-dessus.
                </p>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-auto p-1">
                {staysEnCours.map((stay) => (
                  <li
                    key={stay.id}
                    className="group hover:border-primary/40 flex flex-col justify-between cursor-pointer rounded-xl border bg-background p-4 transition-all text-sm shadow-xs hover:shadow-sm"
                    onClick={() => openStay(stay)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-left">
                        <span className="font-bold text-foreground group-hover:text-primary transition-colors block">
                          {stay.guest.nom} {stay.guest.prenom}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          Du {stay.dateCheckin.slice(0, 10)} au{" "}
                          {stay.dateCheckoutPrevue.slice(0, 10)}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="font-mono text-xs font-bold border-primary/30 text-primary bg-primary/[0.04] px-2 py-0.5"
                      >
                        {stay.room.numero}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between border-t mt-3 pt-2.5 text-[10px] text-muted-foreground font-semibold">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Séjour actif
                      </span>
                      <span className="text-primary group-hover:underline flex items-center gap-0.5">
                        Détails & Facture →
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

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
      />
    </div>
  );
}
