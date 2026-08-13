import { useCallback, useEffect, useState } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { toastManager } from '@/components/ui/toast';
import { RoomContextModal } from '../../dashboard/components/RoomContextModal';
import { arrivalsToday, listRooms, markNoShow } from '../../reservations/api';
import { toISODate } from '../../reservations/date-utils';
import { NoShowDialog } from '../../reservations/components/NoShowDialog';
import type { Reservation, Room } from '../../reservations/types';
import {
  changeRoom,
  checkinFromReservation,
  checkinWalkIn,
  checkoutStay,
  extendStay,
  getStay,
  listDepartsDuJour,
  listStaysEnCours,
} from '../api';
import type { Stay, WalkinCheckinInput } from '../types';
import { WalkinCheckinDialog } from '../components/WalkinCheckinDialog';
import { ReservationCheckinDialog } from '../components/ReservationCheckinDialog';
import { ExtendStayDialog } from '../components/ExtendStayDialog';
import { ChangeRoomDialog } from '../components/ChangeRoomDialog';
import { ArrivalContextPanel } from '../components/ArrivalContextPanel';
import { StayContextPanel } from '../components/StayContextPanel';
import { DepartureContextPanel } from '../components/DepartureContextPanel';
import { FrontDeskKpiStrip } from '../components/FrontDeskKpiStrip';
import {
  FrontDeskToolbar,
  type FrontDeskView,
} from '../components/FrontDeskToolbar';
import { ArrivalsView } from '../components/ArrivalsView';
import { ActiveStaysView } from '../components/ActiveStaysView';
import { DeparturesView } from '../components/DeparturesView';

// DESIGN-009 — un séjour créé via le check-in walk-in (StayService.
// checkinWalkIn) n'a jamais de Reservation associée (reservationId reste
// null) : seul ce chemin produit un séjour sans réservation.
function notifyCheckinDone(
  guest: { nom: string; prenom: string },
  room: { numero: string },
) {
  toastManager.add({
    title: 'Check-in effectué',
    description: `${guest.prenom} ${guest.nom} — Chambre ${room.numero} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    type: 'success',
  });
}

function matchesSearch(
  query: string,
  guest: { nom: string; prenom: string },
  roomNumero: string,
) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    guest.nom.toLowerCase().includes(q) ||
    guest.prenom.toLowerCase().includes(q) ||
    roomNumero.toLowerCase().includes(q)
  );
}

// DESIGN-009 — reconstruction de l'écran Front Desk sur l'UX validée par
// PrototypeFrontDeskA (design/design-005-desktop-prototypes) : bande KPI +
// switch Arrivées/Séjours/Départs + panneaux contextuels de consultation
// avant action, plutôt que 3 listes empilées (ancien CheckinPage.tsx).
// Aucun nouvel endpoint, aucune règle métier modifiée — uniquement une
// réorganisation de l'existant, cf. rapport de mission DESIGN-009.
export function CheckinPage({ permissions }: { permissions: string[] | null }) {
  const [view, setView] = useState<FrontDeskView>('arrivees');
  const [search, setSearch] = useState('');

  const [arrivals, setArrivals] = useState<Reservation[]>([]);
  const [staysEnCours, setStaysEnCours] = useState<Stay[]>([]);
  const [departs, setDeparts] = useState<Stay[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Panneau contextuel — Arrivée.
  const [selectedArrival, setSelectedArrival] = useState<Reservation | null>(
    null,
  );

  // Check-in réel (dialogue de confirmation existant, ReservationCheckinDialog).
  const [checkingInReservationId, setCheckingInReservationId] = useState<
    number | null
  >(null);
  const [checkingInReservation, setCheckingInReservation] =
    useState<Reservation | null>(null);

  // No-show (DESIGN-007, réutilisé tel quel — NoShowDialog + markNoShow).
  const [noShowReservation, setNoShowReservation] =
    useState<Reservation | null>(null);
  const [noShowMotif, setNoShowMotif] = useState('');
  const [noShowSubmitting, setNoShowSubmitting] = useState(false);
  const [noShowError, setNoShowError] = useState<string | null>(null);

  const [walkinOpen, setWalkinOpen] = useState(false);
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);
  const [walkinError, setWalkinError] = useState<string | null>(null);

  // Panneau contextuel — Séjour en cours / Départ du jour. `viewingKind`
  // détermine uniquement quel wrapper (StayContextPanel vs
  // DepartureContextPanel) est monté — les deux réutilisent la même
  // StayDetailsDialog sous-jacente (voir composants dédiés).
  const [viewingStay, setViewingStay] = useState<Stay | null>(null);
  const [viewingKind, setViewingKind] = useState<'sejour' | 'depart' | null>(
    null,
  );
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [soldeDu, setSoldeDu] = useState<string | null>(null);
  const [forcingCheckout, setForcingCheckout] = useState(false);

  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState<unknown>(null);

  const [changeRoomDialogOpen, setChangeRoomDialogOpen] = useState(false);
  const [changingRoom, setChangingRoom] = useState(false);
  const [changeRoomError, setChangeRoomError] = useState<unknown>(null);

  // RoomContextModal (DESIGN-006, protégé — jamais modifié). Toujours
  // ouvert après fermeture du panneau parent (jamais de modales imbriquées).
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const todayISO = toISODate(new Date());

  const refetch = useCallback(async () => {
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
      // Garde le séjour actuellement ouvert dans le panneau à jour (ex.
      // badge "fiche police manquante" après enregistrement) sans dépendre
      // de viewingStay ici — sinon l'identité de refetch changerait à
      // chaque ouverture/fermeture du panneau.
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
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Chargement au montage, pas de condition de course (un seul fetch).
    void Promise.resolve().then(() => refetch());
  }, [refetch]);

  function handleRefresh() {
    setRefreshing(true);
    void refetch();
  }

  function openStayPanel(stay: Stay, kind: 'sejour' | 'depart') {
    setSoldeDu(null);
    setCheckoutError(null);
    setExtendError(null);
    setChangeRoomError(null);
    setViewingKind(kind);
    setViewingStay(stay);
  }

  function closeStayPanel() {
    setViewingStay(null);
    setViewingKind(null);
    setCheckoutError(null);
    setSoldeDu(null);
  }

  async function handleCheckin(reservationId: number, nombreOccupants: number) {
    setActionError(null);
    setCheckingInReservationId(reservationId);
    try {
      const stay = await checkinFromReservation(reservationId, nombreOccupants);
      notifyCheckinDone(stay.guest, stay.room);
      setCheckingInReservation(null);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur de check-in');
    } finally {
      setCheckingInReservationId(null);
    }
  }

  async function handleNoShowConfirm() {
    if (!noShowReservation) return;
    setNoShowSubmitting(true);
    setNoShowError(null);
    try {
      await markNoShow(noShowReservation.id, noShowMotif);
      toastManager.add({
        title: 'Non-présentation enregistrée',
        description: `${noShowReservation.guest.prenom} ${noShowReservation.guest.nom}`,
        type: 'success',
      });
      setNoShowReservation(null);
      setNoShowMotif('');
      await refetch();
    } catch (err) {
      setNoShowError(
        err instanceof Error ? err.message : 'Erreur lors du no-show',
      );
    } finally {
      setNoShowSubmitting(false);
    }
  }

  async function handleWalkinConfirm(input: WalkinCheckinInput) {
    setWalkinSubmitting(true);
    setWalkinError(null);
    try {
      const stay = await checkinWalkIn(input);
      notifyCheckinDone(stay.guest, stay.room);
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

  // DESIGN-009 — check-out forcé (CH-005), réservé à checkin:force-checkout,
  // uniquement proposé après l'échec d'un check-out normal (voir
  // StayDetailsDialog : `showForceCheckout`). Même API (`POST
  // /checkout/:stayId`), seul le corps change (`force`/`motif`).
  async function handleForceCheckout(motif: string) {
    if (!viewingStay) return;
    setForcingCheckout(true);
    setCheckoutError(null);
    try {
      const result = await checkoutStay(viewingStay.id, {
        force: true,
        motif,
      });
      setSoldeDu(result.soldeDu);
      setViewingStay(result);
      toastManager.add({
        title: 'Check-out forcé effectué',
        description: `${result.guest.prenom} ${result.guest.nom} — Chambre ${result.room.numero}`,
        type: 'success',
      });
      await refetch();
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Erreur de check-out forcé',
      );
    } finally {
      setForcingCheckout(false);
    }
  }

  // MX-002A — GL-003. `POST /stays/:id/extend` renvoie déjà le Stay à jour,
  // mais on relit systématiquement via getStay() (voir commentaire détaillé
  // dans l'historique du module) : un échec de cette relecture n'est jamais
  // présenté comme un échec de la prolongation elle-même.
  async function handleExtendStay(
    nouvelleDateCheckoutPrevue: string,
    motif: string,
  ) {
    if (!viewingStay) return;
    const stayId = viewingStay.id;
    setExtending(true);
    setExtendError(null);
    try {
      await extendStay(stayId, nouvelleDateCheckoutPrevue, motif);
      setExtendDialogOpen(false);
      try {
        const refreshed = await getStay(stayId);
        setViewingStay(refreshed);
        toastManager.add({
          title: 'Séjour prolongé',
          description: `Nouvelle date de départ prévue : ${nouvelleDateCheckoutPrevue}`,
          type: 'success',
        });
      } catch {
        toastManager.add({
          title: 'Prolongation enregistrée',
          description:
            "L'affichage n'a pas pu être actualisé immédiatement — rafraîchissement en cours.",
          type: 'success',
        });
      }
      await refetch();
    } catch (err) {
      setExtendError(err);
    } finally {
      setExtending(false);
    }
  }

  // MX-002C — GL-002. Même garantie que handleExtendStay ci-dessus.
  async function handleChangeRoom(newRoomId: number, motif: string) {
    if (!viewingStay) return;
    const stayId = viewingStay.id;
    setChangingRoom(true);
    setChangeRoomError(null);
    try {
      await changeRoom(stayId, newRoomId, motif);
      setChangeRoomDialogOpen(false);
      try {
        const refreshed = await getStay(stayId);
        setViewingStay(refreshed);
        toastManager.add({
          title: 'Chambre changée',
          description: `Chambre ${refreshed.room.numero} — ${refreshed.room.roomType.nom}`,
          type: 'success',
        });
      } catch {
        toastManager.add({
          title: 'Changement de chambre enregistré',
          description:
            "L'affichage n'a pas pu être actualisé immédiatement — rafraîchissement en cours.",
          type: 'success',
        });
      }
      await refetch();
    } catch (err) {
      setChangeRoomError(err);
    } finally {
      setChangingRoom(false);
    }
  }

  const filteredArrivals = arrivals.filter((r) =>
    matchesSearch(search, r.guest, r.room.numero),
  );
  const filteredStaysEnCours = staysEnCours.filter((s) =>
    matchesSearch(search, s.guest, s.room.numero),
  );
  const filteredDeparts = departs.filter((s) =>
    matchesSearch(search, s.guest, s.room.numero),
  );

  const fichesPoliceACompleter =
    staysEnCours.filter((s) => !s.policeRecord).length +
    departs.filter((s) => !s.policeRecord).length;

  const canWalkin = permissions?.includes('checkin:write') ?? false;
  const canForceCheckout =
    permissions?.includes('checkin:force-checkout') ?? false;

  const ContextPanel =
    viewingKind === 'depart' ? DepartureContextPanel : StayContextPanel;

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <FrontDeskKpiStrip
        arriveesAujourdhui={arrivals.length}
        fichesPoliceACompleter={fichesPoliceACompleter}
        sejoursEnCours={staysEnCours.length}
        departsAujourdhui={departs.length}
      />

      <FrontDeskToolbar
        view={view}
        onViewChange={setView}
        search={search}
        onSearchChange={setSearch}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onWalkinClick={() => setWalkinOpen(true)}
        canWalkin={canWalkin}
      />

      {loadError && (
        <ErrorState
          title="Erreur de chargement du Front Desk"
          description={loadError}
          onRetry={handleRefresh}
        />
      )}
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <>
          {view === 'arrivees' && (
            <ArrivalsView
              arrivals={filteredArrivals}
              hasAnyArrival={arrivals.length > 0}
              onSelect={(reservation) => {
                setActionError(null);
                setSelectedArrival(reservation);
              }}
            />
          )}
          {view === 'sejours' && (
            <ActiveStaysView
              stays={filteredStaysEnCours}
              hasAnyStay={staysEnCours.length > 0}
              onSelect={(stay) => openStayPanel(stay, 'sejour')}
            />
          )}
          {view === 'departs' && (
            <DeparturesView
              stays={filteredDeparts}
              hasAnyStay={departs.length > 0}
              todayISO={todayISO}
              onSelect={(stay) => openStayPanel(stay, 'depart')}
            />
          )}
        </>
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

      <ArrivalContextPanel
        reservation={selectedArrival}
        permissions={permissions}
        onClose={() => setSelectedArrival(null)}
        onViewRoom={(reservation) => {
          setSelectedArrival(null);
          setSelectedRoom(reservation.room);
        }}
        onCheckinClick={(reservation) => {
          setSelectedArrival(null);
          setActionError(null);
          setCheckingInReservation(reservation);
        }}
        onNoShowClick={(reservation) => {
          setSelectedArrival(null);
          setNoShowMotif('');
          setNoShowError(null);
          setNoShowReservation(reservation);
        }}
      />

      <ReservationCheckinDialog
        reservation={checkingInReservation}
        roomStatus={
          rooms.find((room) => room.id === checkingInReservation?.roomId)
            ?.statut ?? null
        }
        permissions={permissions}
        onClose={() => {
          if (checkingInReservationId !== null) return;
          setCheckingInReservation(null);
          setActionError(null);
        }}
        onConfirm={(nombreOccupants) => {
          if (checkingInReservation) {
            void handleCheckin(checkingInReservation.id, nombreOccupants);
          }
        }}
        submitting={checkingInReservationId !== null}
        error={actionError}
      />

      <NoShowDialog
        reservation={noShowReservation}
        motif={noShowMotif}
        setMotif={setNoShowMotif}
        submitting={noShowSubmitting}
        error={noShowError}
        onClose={() => {
          if (noShowSubmitting) return;
          setNoShowReservation(null);
          setNoShowError(null);
        }}
        onConfirm={handleNoShowConfirm}
      />

      <ContextPanel
        stay={viewingStay}
        onClose={closeStayPanel}
        onCheckout={handleCheckout}
        checkingOut={checkingOut}
        error={checkoutError}
        soldeDu={soldeDu}
        onPoliceRecordSaved={refetch}
        permissions={permissions}
        onExtendClick={() => {
          setExtendError(null);
          setExtendDialogOpen(true);
        }}
        onChangeRoomClick={() => {
          setChangeRoomError(null);
          setChangeRoomDialogOpen(true);
        }}
        canForceCheckout={canForceCheckout}
        onForceCheckout={handleForceCheckout}
        forcingCheckout={forcingCheckout}
        onViewRoom={(stay) => {
          closeStayPanel();
          setSelectedRoom(stay.room);
        }}
      />

      <ExtendStayDialog
        stay={extendDialogOpen ? viewingStay : null}
        onClose={() => {
          if (extending) return;
          setExtendDialogOpen(false);
          setExtendError(null);
        }}
        onConfirm={handleExtendStay}
        submitting={extending}
        error={extendError}
      />

      <ChangeRoomDialog
        stay={changeRoomDialogOpen ? viewingStay : null}
        rooms={rooms}
        onClose={() => {
          if (changingRoom) return;
          setChangeRoomDialogOpen(false);
          setChangeRoomError(null);
        }}
        onConfirm={handleChangeRoom}
        submitting={changingRoom}
        error={changeRoomError}
      />

      <RoomContextModal
        room={selectedRoom}
        rooms={rooms}
        permissions={permissions}
        onClose={() => setSelectedRoom(null)}
        onNavigate={() => setSelectedRoom(null)}
      />
    </div>
  );
}
