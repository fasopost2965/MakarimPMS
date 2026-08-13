import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { checkinFromReservation } from '@/features/checkin/api';
import { ReservationCheckinDialog } from '@/features/checkin/components/ReservationCheckinDialog';
import {
  cancelReservation,
  createReservation,
  listReservations,
  listRooms,
  markNoShow,
  updateReservation,
} from '../api';
import { addDays, startOfDay, toDateOnly, toISODate } from '../date-utils';
import { CANAL_LABEL } from '../reservation-presentation';
import type { Reservation, Room, StatutReservation } from '../types';
import {
  CreateReservationDialog,
  type CreateReservationConfirmInput,
  type CreateReservationSelection,
} from '../components/CreateReservationDialog';
import { ReservationCard } from '../components/ReservationCard';
import { ReservationDetailsDialog } from '../components/ReservationDetailsDialog';
import { ReservationContextPanel } from '../components/ReservationContextPanel';
import { ReservationsKpiStrip } from '../components/ReservationsKpiStrip';
import {
  ReservationsToolbar,
  type ReservationsView,
} from '../components/ReservationsToolbar';
import { ReservationsListView } from '../components/ReservationsListView';
import { ReservationsPlanningView } from '../components/ReservationsPlanningView';
import { CancelDialog } from '../components/CancelDialog';
import { NoShowDialog } from '../components/NoShowDialog';

// DESIGN-007 — écran production reconstruit depuis Prototype C2 validé
// (mission "PRODUCTION BUILD FROM C2") : header compact + bande KPI (3
// cartes réelles) + barre d'outils (switch Liste/Planning) + zone de
// travail. Ce fichier orchestre désormais l'état et les appels API ;
// chaque bloc visuel vit dans son propre composant (ReservationsKpiStrip,
// ReservationsToolbar, ReservationsListView, ReservationsPlanningView,
// ReservationContextPanel) — voir rapport de mission pour la justification
// de ce découpage.
//
// Fenêtre opérationnelle des données (mission §4) : aucun nouvel endpoint —
// GET /reservations est appelé avec une fenêtre du/au large mais bornée
// (30 jours en arrière, 180 jours en avant) plutôt que sans bornes du tout,
// pour rester un usage raisonnable de l'endpoint existant sur un historique
// qui grossit indéfiniment. Les 3 KPI, la Liste et le Planning partagent
// cette même donnée — le Planning ne fait que fenêtrer davantage côté
// client (7 jours visibles, navigation ←/Aujourd'hui/→). Limite connue :
// une réservation confirmée en retard de plus de 30 jours, ou réservée plus
// de 180 jours à l'avance, sort de cette fenêtre (voir rapport de mission).
const OPERATIONS_LOOKBACK_DAYS = 30;
const OPERATIONS_LOOKAHEAD_DAYS = 180;

function todayISO() {
  return toISODate(startOfDay(new Date()));
}

export function ReservationsCalendarPage({
  permissions,
}: {
  permissions: string[];
}) {
  const canWrite = permissions.includes('reservations:write');
  const canDelete = permissions.includes('reservations:delete');

  const [view, setView] = useState<ReservationsView>('liste');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StatutReservation>(
    'ALL',
  );
  const [canalFilter, setCanalFilter] = useState<'ALL' | Reservation['canal']>(
    'ALL',
  );

  const [pendingSelection, setPendingSelection] =
    useState<CreateReservationSelection | null>(null);
  const [manualCreateOpen, setManualCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);

  const [editingReservation, setEditingReservation] =
    useState<Reservation | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [cancellingReservation, setCancellingReservation] =
    useState<Reservation | null>(null);
  const [cancelMotif, setCancelMotif] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [checkingInReservation, setCheckingInReservation] =
    useState<Reservation | null>(null);
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  const [noShowReservation, setNoShowReservation] =
    useState<Reservation | null>(null);
  const [noShowMotif, setNoShowMotif] = useState('');
  const [noShowSubmitting, setNoShowSubmitting] = useState(false);
  const [noShowError, setNoShowError] = useState<string | null>(null);

  const today = todayISO();

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const now = startOfDay(new Date());
      const [roomData, reservationData] = await Promise.all([
        listRooms(),
        listReservations({
          du: toISODate(addDays(now, -OPERATIONS_LOOKBACK_DAYS)),
          au: toISODate(addDays(now, OPERATIONS_LOOKAHEAD_DAYS)),
        }),
      ]);
      setRooms(roomData);
      setReservations(reservationData);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Erreur de chargement',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  // KPI — formules exactes mission §4, dérivées de la même fenêtre de
  // données que la Liste et le Planning (aucune fabrication côté client).
  const arrivalsTodayCount = useMemo(
    () =>
      reservations.filter(
        (r) => toDateOnly(r.dateArrivee) === today && r.statut === 'CONFIRMEE',
      ).length,
    [reservations, today],
  );
  const toHandleCount = useMemo(
    () =>
      reservations.filter(
        (r) => r.statut === 'CONFIRMEE' && toDateOnly(r.dateArrivee) <= today,
      ).length,
    [reservations, today],
  );
  const upcomingCount = useMemo(
    () =>
      reservations.filter(
        (r) => r.statut === 'CONFIRMEE' && toDateOnly(r.dateArrivee) > today,
      ).length,
    [reservations, today],
  );
  const noShowCount = useMemo(
    () => reservations.filter((r) => r.statut === 'NO_SHOW').length,
    [reservations],
  );
  const cancelledCount = useMemo(
    () => reservations.filter((r) => r.statut === 'ANNULEE').length,
    [reservations],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr');
    return reservations
      .filter((r) => {
        const searchable =
          `${r.guest.nom} ${r.guest.prenom} ${r.room.numero} ${CANAL_LABEL[r.canal]}`.toLocaleLowerCase(
            'fr',
          );
        return (
          (!needle || searchable.includes(needle)) &&
          (statusFilter === 'ALL' || r.statut === statusFilter) &&
          (canalFilter === 'ALL' || r.canal === canalFilter)
        );
      })
      .sort((a, b) => a.dateArrivee.localeCompare(b.dateArrivee));
  }, [reservations, query, statusFilter, canalFilter]);

  const agendaReservations = useMemo(
    () => filtered.filter((r) => r.statut !== 'ANNULEE'),
    [filtered],
  );
  const planningReservations = useMemo(
    () => reservations.filter((r) => r.statut !== 'ANNULEE'),
    [reservations],
  );

  async function handleConfirmCreate(input: CreateReservationConfirmInput) {
    const { prixTotalFinal, motifAjustement, ...createInput } = input;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createReservation(createInput);
      if (prixTotalFinal !== undefined && motifAjustement !== undefined) {
        try {
          await updateReservation(created.id, {
            prixTotalFinal,
            motifAjustement,
          });
        } catch (error) {
          setPendingSelection(null);
          setManualCreateOpen(false);
          await refetch();
          setSubmitError(
            `Réservation créée mais ajustement du prix échoué : ${error instanceof Error ? error.message : 'Erreur'}`,
          );
          return;
        }
      }
      setPendingSelection(null);
      setManualCreateOpen(false);
      await refetch();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Erreur de création',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDrop(
    reservationId: number,
    roomId: number,
    dateArrivee: string,
  ) {
    const reservation = reservations.find((item) => item.id === reservationId);
    if (!reservation) return;
    const nights = Math.round(
      (new Date(reservation.dateDepart).getTime() -
        new Date(reservation.dateArrivee).getTime()) /
        86_400_000,
    );
    setActionError(null);
    try {
      await updateReservation(reservationId, {
        roomId,
        dateArrivee,
        dateDepart: toISODate(addDays(new Date(dateArrivee), nights)),
      });
      await refetch();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Erreur de déplacement',
      );
    }
  }

  async function handleCancel() {
    if (!cancellingReservation || cancelMotif.trim().length < 10) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelReservation(cancellingReservation.id, cancelMotif.trim());
      setCancellingReservation(null);
      setCancelMotif('');
      await refetch();
    } catch (error) {
      setCancelError(
        error instanceof Error ? error.message : 'Erreur d’annulation',
      );
    } finally {
      setCancelling(false);
    }
  }

  async function handleSaveDetails(input: {
    prixTotalFinal?: number;
    motifAjustement?: string;
  }) {
    if (!editingReservation) return;
    if (input.prixTotalFinal === undefined) {
      setEditingReservation(null);
      return;
    }
    setSavingDetails(true);
    setDetailsError(null);
    try {
      await updateReservation(editingReservation.id, input);
      setEditingReservation(null);
      await refetch();
    } catch (error) {
      setDetailsError(
        error instanceof Error
          ? error.message
          : 'Erreur de mise à jour du prix',
      );
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleCheckin(nombreOccupants: number) {
    if (!checkingInReservation) return;
    setCheckinSubmitting(true);
    setCheckinError(null);
    try {
      await checkinFromReservation(checkingInReservation.id, nombreOccupants);
      setCheckingInReservation(null);
      await refetch();
    } catch (error) {
      setCheckinError(
        error instanceof Error ? error.message : 'Erreur de check-in',
      );
    } finally {
      setCheckinSubmitting(false);
    }
  }

  async function handleNoShow() {
    if (!noShowReservation || noShowMotif.trim().length < 10) return;
    setNoShowSubmitting(true);
    setNoShowError(null);
    try {
      await markNoShow(noShowReservation.id, noShowMotif.trim());
      setNoShowReservation(null);
      setNoShowMotif('');
      await refetch();
    } catch (error) {
      setNoShowError(
        error instanceof Error ? error.message : 'Erreur de no-show',
      );
    } finally {
      setNoShowSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 p-3 sm:p-4 xl:p-5">
      <header className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <p className="text-primary text-[11px] font-bold tracking-[.08em] uppercase">
          Exploitation hôtel
        </p>
        <h1 className="text-xl font-extrabold tracking-tight">Réservations</h1>
        <p className="text-muted-foreground text-xs first-letter:uppercase">
          ·{' '}
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </header>

      <ReservationsKpiStrip
        arrivalsTodayCount={arrivalsTodayCount}
        toHandleCount={toHandleCount}
        upcomingCount={upcomingCount}
        loading={loading && reservations.length === 0}
      />

      <ReservationsToolbar
        view={view}
        onViewChange={setView}
        query={query}
        onQueryChange={setQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        canalFilter={canalFilter}
        onCanalFilterChange={setCanalFilter}
        noShowCount={noShowCount}
        cancelledCount={cancelledCount}
        canWrite={canWrite}
        onCreate={() => setManualCreateOpen(true)}
      />

      {actionError && (
        <Alert
          tone="destructive"
          title="Déplacement impossible"
          description={actionError}
        />
      )}

      {loadError ? (
        <ErrorState
          title="Les réservations n’ont pas pu être chargées"
          description={loadError}
          onRetry={() => void refetch()}
        />
      ) : loading ? (
        <OperationsSkeleton />
      ) : (
        <>
          <div className="hidden min-h-0 flex-1 flex-col gap-3 xl:flex">
            {view === 'liste' ? (
              <ReservationsListView
                reservations={filtered}
                today={today}
                hasActiveSearch={
                  query.trim() !== '' ||
                  statusFilter !== 'ALL' ||
                  canalFilter !== 'ALL'
                }
                onSelect={setSelectedReservation}
              />
            ) : (
              <ReservationsPlanningView
                rooms={rooms}
                reservations={planningReservations}
                canWrite={canWrite}
                canDelete={canDelete}
                onView={setSelectedReservation}
                onCancel={(reservation) => {
                  setCancellingReservation(reservation);
                  setCancelMotif('');
                  setCancelError(null);
                }}
                onDrop={handleDrop}
                onCreateSelection={setPendingSelection}
              />
            )}
          </div>
          <MobileAgenda
            reservations={agendaReservations}
            onOpen={setSelectedReservation}
            canWrite={canWrite}
            onCreate={() => setManualCreateOpen(true)}
          />
        </>
      )}

      <CreateReservationDialog
        open={pendingSelection !== null || manualCreateOpen}
        selection={pendingSelection}
        rooms={rooms}
        onClose={() => {
          setPendingSelection(null);
          setManualCreateOpen(false);
          setSubmitError(null);
        }}
        onConfirm={handleConfirmCreate}
        submitting={submitting}
        error={submitError}
      />

      <ReservationContextPanel
        reservation={selectedReservation}
        today={today}
        permissions={permissions}
        onClose={() => setSelectedReservation(null)}
        onEdit={(reservation) => {
          setSelectedReservation(null);
          setEditingReservation(reservation);
          setDetailsError(null);
        }}
        onCancel={(reservation) => {
          setSelectedReservation(null);
          setCancellingReservation(reservation);
          setCancelMotif('');
          setCancelError(null);
        }}
        onCheckin={(reservation) => {
          setSelectedReservation(null);
          setCheckingInReservation(reservation);
          setCheckinError(null);
        }}
        onNoShow={(reservation) => {
          setSelectedReservation(null);
          setNoShowReservation(reservation);
          setNoShowMotif('');
          setNoShowError(null);
        }}
      />

      <ReservationDetailsDialog
        reservation={editingReservation}
        onClose={() => {
          setEditingReservation(null);
          setDetailsError(null);
        }}
        onSave={handleSaveDetails}
        saving={savingDetails}
        error={detailsError}
        canWrite={canWrite}
      />

      <CancelDialog
        reservation={cancellingReservation}
        motif={cancelMotif}
        setMotif={setCancelMotif}
        cancelling={cancelling}
        error={cancelError}
        onClose={() => {
          setCancellingReservation(null);
          setCancelMotif('');
          setCancelError(null);
        }}
        onConfirm={() => void handleCancel()}
      />

      <ReservationCheckinDialog
        reservation={checkingInReservation}
        roomStatus={checkingInReservation?.room.statut ?? null}
        permissions={permissions}
        onClose={() => {
          setCheckingInReservation(null);
          setCheckinError(null);
        }}
        onConfirm={(nombreOccupants) => void handleCheckin(nombreOccupants)}
        submitting={checkinSubmitting}
        error={checkinError}
      />

      <NoShowDialog
        reservation={noShowReservation}
        motif={noShowMotif}
        setMotif={setNoShowMotif}
        submitting={noShowSubmitting}
        error={noShowError}
        onClose={() => {
          setNoShowReservation(null);
          setNoShowMotif('');
          setNoShowError(null);
        }}
        onConfirm={() => void handleNoShow()}
      />
    </div>
  );
}

function MobileAgenda({
  reservations,
  onOpen,
  canWrite,
  onCreate,
}: {
  reservations: Reservation[];
  onOpen: (reservation: Reservation) => void;
  canWrite: boolean;
  onCreate: () => void;
}) {
  const groups = reservations.reduce<Record<string, Reservation[]>>(
    (result, reservation) => {
      const key = reservation.dateArrivee.slice(0, 10);
      (result[key] ??= []).push(reservation);
      return result;
    },
    {},
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 xl:hidden">
      <SectionHeader
        title="Agenda des réservations"
        description="Réservations classées par date d’arrivée"
      />
      {Object.keys(groups).length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Aucune réservation"
          description="Aucune réservation sur cette période."
          action={
            canWrite
              ? { label: 'Nouvelle réservation', onClick: onCreate }
              : undefined
          }
        />
      ) : (
        Object.entries(groups)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, items]) => (
            <section
              key={date}
              aria-labelledby={`agenda-${date}`}
              className="space-y-2"
            >
              <div className="sticky top-0 z-10 bg-background/95 py-1 backdrop-blur">
                <h2
                  id={`agenda-${date}`}
                  className="text-sm font-bold capitalize"
                >
                  {new Date(date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    timeZone: 'UTC',
                  })}
                </h2>
                <p className="text-muted-foreground text-xs">
                  {items.length} arrivée{items.length > 1 ? 's' : ''}
                </p>
              </div>
              {items.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  onOpen={() => onOpen(reservation)}
                />
              ))}
            </section>
          ))
      )}
    </div>
  );
}

function OperationsSkeleton() {
  return (
    <Card className="min-h-72 flex-1">
      <CardContent className="gap-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
