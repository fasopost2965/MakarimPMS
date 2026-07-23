import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { arrivalsToday, listRooms } from '../../reservations/api';
import type { Reservation, Room } from '../../reservations/types';
import {
  checkinFromReservation,
  checkinWalkIn,
  checkoutStay,
  listDepartsDuJour,
  listStaysEnCours,
} from '../api';
import type { Stay, WalkinCheckinInput } from '../types';
import { WalkinCheckinDialog } from '../components/WalkinCheckinDialog';
import { StayDetailsDialog } from '../components/StayDetailsDialog';

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
      // Garde le séjour actuellement ouvert dans le dialogue à jour (ex.
      // badge "fiche police manquante" après enregistrement) sans
      // dépendre de viewingStay ici — sinon l'identité de refetch changerait
      // à chaque ouverture/fermeture du dialogue et redéclencherait l'effet
      // de chargement initial.
      setViewingStay((current) =>
        current
          ? ([...staysData, ...departsData].find((s) => s.id === current.id) ??
            current)
          : null,
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
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
      setActionError(err instanceof Error ? err.message : 'Erreur de check-in');
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
      setWalkinError(err instanceof Error ? err.message : 'Erreur de check-in');
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
        err instanceof Error ? err.message : 'Erreur de check-out',
      );
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Button onClick={() => setWalkinOpen(true)}>+ Check-in walk-in</Button>
      </div>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="bg-card flex flex-col gap-2 rounded-lg border p-4">
            <h2 className="text-xs font-bold">Arrivées du jour</h2>
            {arrivals.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Aucune arrivée prévue aujourd'hui.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {arrivals.map((reservation) => (
                <li
                  key={reservation.id}
                  className="border-l-info bg-background flex items-center justify-between rounded-md border border-l-4 p-2 text-sm"
                >
                  <span>
                    {reservation.guest.nom} {reservation.guest.prenom} — chambre{' '}
                    {reservation.room.numero}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleCheckin(reservation.id)}
                    disabled={checkingInReservationId === reservation.id}
                  >
                    {checkingInReservationId === reservation.id
                      ? 'Check-in…'
                      : 'Check-in'}
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-card flex flex-col gap-2 rounded-lg border p-4">
            <h2 className="text-xs font-bold">Départs du jour</h2>
            {departs.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Aucun départ prévu aujourd'hui.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {departs.map((stay) => (
                <li
                  key={stay.id}
                  className="border-l-warning bg-background hover:border-primary/50 flex cursor-pointer items-center justify-between rounded-md border border-l-4 p-2 text-sm transition-colors"
                  onClick={() => openStay(stay)}
                >
                  <span>
                    {stay.guest.nom} {stay.guest.prenom} — chambre{' '}
                    {stay.room.numero}
                    {!stay.policeRecord && (
                      <span
                        className="text-amber-600 ml-2 text-xs"
                        title="Fiche de police (registre légal DGSN) non renseignée"
                      >
                        ⚠ Fiche police manquante
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Voir / check-out
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-card flex flex-col gap-2 rounded-lg border p-4 md:col-span-2">
            <h2 className="text-xs font-bold">Séjours en cours</h2>
            {staysEnCours.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Aucun séjour en cours.
              </p>
            )}
            <ul className="grid gap-2 md:grid-cols-2">
              {staysEnCours.map((stay) => (
                <li
                  key={stay.id}
                  className="border-l-success bg-background hover:border-primary/50 flex cursor-pointer items-center justify-between rounded-md border border-l-4 p-2 text-sm transition-colors"
                  onClick={() => openStay(stay)}
                >
                  <span>
                    {stay.guest.nom} {stay.guest.prenom} — chambre{' '}
                    {stay.room.numero}
                    {!stay.policeRecord && (
                      <span
                        className="text-amber-600 ml-2 text-xs"
                        title="Fiche de police (registre légal DGSN) non renseignée"
                      >
                        ⚠ Fiche police manquante
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Départ prévu {stay.dateCheckoutPrevue.slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
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
        onPoliceRecordSaved={refetch}
      />
    </div>
  );
}
