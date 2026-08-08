import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { AlertTriangle, BedDouble, LogIn, LogOut, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toastManager } from '@/components/ui/toast';
import { arrivalsToday, listRooms } from '../../reservations/api';
import { toISODate } from '../../reservations/date-utils';
import type {
  CanalReservation,
  Reservation,
  Room,
} from '../../reservations/types';
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
import { StayDetailsDialog } from '../components/StayDetailsDialog';
import { ReservationCheckinDialog } from '../components/ReservationCheckinDialog';
import { ExtendStayDialog } from '../components/ExtendStayDialog';
import { ChangeRoomDialog } from '../components/ChangeRoomDialog';

// CH-063 (docs/design/design_handoff_exploitation_hotel) — un séjour créé
// via le check-in walk-in (StayService.checkinWalkIn) n'a jamais de
// Reservation associée (reservationId reste null) : seul ce chemin produit
// un séjour sans réservation, donc `reservation === null` désigne fidèlement
// un walk-in, pas une valeur par défaut inventée.
const CANAL_LABEL: Record<CanalReservation, string> = {
  DIRECT: 'Direct',
  WALK_IN: 'Walk-in',
  BOOKING_COM: 'Booking.com',
  EXPEDIA: 'Expedia',
  AIRBNB: 'Airbnb',
};
const CANAL_TEXT_CLASS: Record<CanalReservation, string> = {
  DIRECT: 'text-primary',
  WALK_IN: 'text-warning',
  BOOKING_COM: 'text-info',
  EXPEDIA: 'text-warning',
  AIRBNB: 'text-violet',
};
const CANAL_AVATAR_CLASS: Record<CanalReservation, string> = {
  DIRECT: 'bg-primary/15 text-primary',
  WALK_IN: 'bg-warning/20 text-warning',
  BOOKING_COM: 'bg-info/15 text-info',
  EXPEDIA: 'bg-warning/20 text-warning',
  AIRBNB: 'bg-violet/15 text-violet',
};

function resolveCanal(reservation: Reservation | null): CanalReservation {
  return reservation?.canal ?? 'WALK_IN';
}

function initials(nom: string, prenom: string) {
  return `${nom.charAt(0)}${prenom.charAt(0)}`.toUpperCase();
}

// Handoff design final, lot 3 (MicroInteractionCheckin.dc.html) — le mockup
// anime un toggle de démo (chambre Réservée ↔ Occupée) sans action serveur
// réelle. Ici le check-in est une vraie mutation, jamais réversible en un
// clic (INV-SEJ-*), donc la micro-interaction se traduit par une
// confirmation immédiate et honnête (même convention que le toast de
// réassort stock, CH-032 : « une confirmation dit ce qui s'est passé »)
// plutôt qu'un état togglable fictif.
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

export function CheckinPage({ permissions }: { permissions: string[] | null }) {
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
  const [checkingInReservation, setCheckingInReservation] =
    useState<Reservation | null>(null);

  const [walkinOpen, setWalkinOpen] = useState(false);
  const [walkinSubmitting, setWalkinSubmitting] = useState(false);
  const [walkinError, setWalkinError] = useState<string | null>(null);

  const [viewingStay, setViewingStay] = useState<Stay | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [soldeDu, setSoldeDu] = useState<string | null>(null);

  // GL-003 (MX-002A) — le séjour prolongé est toujours celui déjà ouvert
  // dans StayDetailsDialog (viewingStay) ; ce booléen contrôle uniquement
  // l'ouverture du second dialogue, jamais une copie séparée du Stay.
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState<unknown>(null);

  // GL-002 (MX-002C) — même convention que l'extension de séjour ci-dessus :
  // le séjour dont on change la chambre est toujours celui déjà ouvert dans
  // StayDetailsDialog (viewingStay).
  const [changeRoomDialogOpen, setChangeRoomDialogOpen] = useState(false);
  const [changingRoom, setChangingRoom] = useState(false);
  const [changeRoomError, setChangeRoomError] = useState<unknown>(null);

  const [search, setSearch] = useState('');
  // UX-003B — pur affichage, aucune donnée nouvelle : distingue un départ
  // aujourd'hui (urgent) d'un départ dans plusieurs jours au sein de la même
  // liste "Séjours en cours" (qui, contrairement à departsRef, n'est pas
  // filtrée sur la seule journée en cours).
  const todayISO = toISODate(new Date());
  const arrivalsRef = useRef<HTMLElement>(null);
  const departsRef = useRef<HTMLElement>(null);
  const staysRef = useRef<HTMLElement>(null);

  const filteredArrivals = useMemo(
    () => arrivals.filter((r) => matchesSearch(search, r.guest, r.room.numero)),
    [arrivals, search],
  );
  const filteredDeparts = useMemo(
    () => departs.filter((s) => matchesSearch(search, s.guest, s.room.numero)),
    [departs, search],
  );
  const filteredStaysEnCours = useMemo(
    () =>
      staysEnCours.filter((s) => matchesSearch(search, s.guest, s.room.numero)),
    [staysEnCours, search],
  );

  const departsSansFiche = departs.filter((s) => !s.policeRecord);
  const staysSansFiche = staysEnCours.filter((s) => !s.policeRecord);
  const alerteFichePoliceCount =
    departsSansFiche.length + staysSansFiche.length;

  function scrollToSection(ref: RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scrollToFichePoliceAlerte() {
    if (departsSansFiche.length > 0) scrollToSection(departsRef);
    else if (staysSansFiche.length > 0) scrollToSection(staysRef);
  }

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
    void Promise.resolve().then(() => refetch());
  }, [refetch]);

  function openStay(stay: Stay) {
    setSoldeDu(null);
    setCheckoutError(null);
    setExtendError(null);
    setChangeRoomError(null);
    setViewingStay(stay);
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

  // MX-002A — GL-003. `POST /stays/:id/extend` renvoie déjà le Stay à jour
  // (STAY_INCLUDE), mais on ne s'appuie volontairement pas sur cette seule
  // hypothèse : une fois le POST confirmé réussi, on relit l'état réel via
  // getStay(). Un échec de cette relecture ne doit jamais être présenté
  // comme un échec de la prolongation elle-même (le POST a déjà réussi) —
  // le refetch() général des listes sert alors de filet de secours, il
  // resynchronise déjà viewingStay depuis les données fraîches (voir
  // refetch ci-dessus).
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

  // MX-002C — GL-002. Même garantie que handleExtendStay ci-dessus : relit
  // l'état réel via getStay() après un POST confirmé réussi plutôt que de
  // se fier uniquement à sa réponse ; un échec de cette relecture n'est
  // jamais présenté comme un échec du changement de chambre lui-même
  // (refetch() sert de filet de secours, il resynchronise déjà viewingStay).
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

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => scrollToSection(arrivalsRef)}
            className="border-info/30 bg-info/10 text-info flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-info/20"
          >
            <LogIn className="size-3.5" />
            <span className="text-sm font-bold">{arrivals.length}</span>
            arrivée{arrivals.length > 1 ? 's' : ''} aujourd'hui
          </button>
          <button
            type="button"
            onClick={() => scrollToSection(departsRef)}
            className="border-warning/30 bg-warning/10 text-warning flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-warning/20"
          >
            <LogOut className="size-3.5" />
            <span className="text-sm font-bold">{departs.length}</span>
            départ{departs.length > 1 ? 's' : ''} aujourd'hui
          </button>
          <button
            type="button"
            onClick={() => scrollToSection(staysRef)}
            className="border-success/30 bg-success/10 text-success flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-success/20"
          >
            <BedDouble className="size-3.5" />
            <span className="text-sm font-bold">{staysEnCours.length}</span>
            séjour{staysEnCours.length > 1 ? 's' : ''} en cours
          </button>
          <button
            type="button"
            onClick={scrollToFichePoliceAlerte}
            disabled={alerteFichePoliceCount === 0}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              alerteFichePoliceCount > 0
                ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20'
                : 'border-border text-muted-foreground'
            }`}
          >
            <AlertTriangle className="size-3.5" />
            <span className="text-sm font-bold">{alerteFichePoliceCount}</span>
            fiche{alerteFichePoliceCount > 1 ? 's' : ''} police manquante
            {alerteFichePoliceCount > 1 ? 's' : ''}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client ou une chambre…"
              className="w-64 pl-8"
            />
          </div>
          <Button onClick={() => setWalkinOpen(true)}>
            + Check-in walk-in
          </Button>
        </div>
      </div>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <section
            ref={arrivalsRef}
            className="bg-card flex flex-col gap-2 rounded-lg border p-4"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <LogIn className="text-muted-foreground size-4" />
              Arrivées du jour
            </h2>
            {filteredArrivals.length === 0 && (
              <p className="text-muted-foreground text-sm">
                {arrivals.length === 0
                  ? "Aucune arrivée prévue aujourd'hui."
                  : 'Aucun résultat pour cette recherche.'}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {filteredArrivals.map((reservation) => (
                <li
                  key={reservation.id}
                  className="bg-background flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${CANAL_AVATAR_CLASS[resolveCanal(reservation)]}`}
                    >
                      {initials(
                        reservation.guest.nom,
                        reservation.guest.prenom,
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold">
                        {reservation.guest.nom} {reservation.guest.prenom}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Badge variant="outline" className="h-4 px-1.5">
                          Ch. {reservation.room.numero}
                        </Badge>
                        <span className={CANAL_TEXT_CLASS[reservation.canal]}>
                          {CANAL_LABEL[reservation.canal]}
                        </span>
                      </span>
                    </span>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      setActionError(null);
                      setCheckingInReservation(reservation);
                    }}
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

          <section
            ref={departsRef}
            className="bg-card flex flex-col gap-2 rounded-lg border p-4"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <LogOut className="text-muted-foreground size-4" />
              Départs du jour
            </h2>
            {filteredDeparts.length === 0 && (
              <p className="text-muted-foreground text-sm">
                {departs.length === 0
                  ? "Aucun départ prévu aujourd'hui."
                  : 'Aucun résultat pour cette recherche.'}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {filteredDeparts.map((stay) => (
                <li key={stay.id}>
                  <button
                    type="button"
                    className="bg-background hover:border-primary/40 flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border p-2 text-left text-sm transition-[box-shadow,border-color] hover:shadow-[var(--shadow-card)]"
                    onClick={() => openStay(stay)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${CANAL_AVATAR_CLASS[resolveCanal(stay.reservation)]}`}
                      >
                        {initials(stay.guest.nom, stay.guest.prenom)}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-semibold">
                          {stay.guest.nom} {stay.guest.prenom}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="h-4 px-1.5">
                            Ch. {stay.room.numero}
                          </Badge>
                          <span
                            className={`text-xs ${CANAL_TEXT_CLASS[resolveCanal(stay.reservation)]}`}
                          >
                            {CANAL_LABEL[resolveCanal(stay.reservation)]}
                          </span>
                          {!stay.policeRecord && (
                            <Badge
                              variant="warning"
                              title="Fiche de police (registre légal DGSN) non renseignée"
                            >
                              <AlertTriangle className="size-3" />
                              Fiche police manquante
                            </Badge>
                          )}
                        </span>
                      </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      Voir / check-out
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section
            ref={staysRef}
            className="bg-card flex flex-col gap-2 rounded-lg border p-4 md:col-span-2"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BedDouble className="text-muted-foreground size-4" />
              Séjours en cours
            </h2>
            {filteredStaysEnCours.length === 0 && (
              <p className="text-muted-foreground text-sm">
                {staysEnCours.length === 0
                  ? 'Aucun séjour en cours.'
                  : 'Aucun résultat pour cette recherche.'}
              </p>
            )}
            <ul className="grid gap-2 md:grid-cols-2">
              {filteredStaysEnCours.map((stay) => (
                <li key={stay.id}>
                  <button
                    type="button"
                    className="bg-background hover:border-primary/40 flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border p-2 text-left text-sm transition-[box-shadow,border-color] hover:shadow-[var(--shadow-card)]"
                    onClick={() => openStay(stay)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${CANAL_AVATAR_CLASS[resolveCanal(stay.reservation)]}`}
                      >
                        {initials(stay.guest.nom, stay.guest.prenom)}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-semibold">
                          {stay.guest.nom} {stay.guest.prenom}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="h-4 px-1.5">
                            Ch. {stay.room.numero}
                          </Badge>
                          <span
                            className={`text-xs ${CANAL_TEXT_CLASS[resolveCanal(stay.reservation)]}`}
                          >
                            {CANAL_LABEL[resolveCanal(stay.reservation)]}
                          </span>
                          {!stay.policeRecord && (
                            <Badge
                              variant="warning"
                              title="Fiche de police (registre légal DGSN) non renseignée"
                            >
                              <AlertTriangle className="size-3" />
                              Fiche police manquante
                            </Badge>
                          )}
                        </span>
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs ${
                        stay.dateCheckoutPrevue.slice(0, 10) === todayISO
                          ? 'text-warning font-semibold'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Départ prévu {stay.dateCheckoutPrevue.slice(0, 10)}
                    </span>
                  </button>
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
        permissions={permissions}
        onExtendClick={() => {
          setExtendError(null);
          setExtendDialogOpen(true);
        }}
        onChangeRoomClick={() => {
          setChangeRoomError(null);
          setChangeRoomDialogOpen(true);
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
    </div>
  );
}
