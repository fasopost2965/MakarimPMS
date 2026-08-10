import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  cancelReservation,
  createReservation,
  listReservations,
  listRooms,
  updateReservation,
} from '../api';
import {
  addDays,
  formatDayLabel,
  getDateRange,
  getVisibleReservationSpan,
  isSameDay,
  startOfDay,
  toISODate,
} from '../date-utils';
import type { Reservation, Room, StatutReservation } from '../types';
import { CANAL_LABEL } from '../reservation-presentation';
import {
  CreateReservationDialog,
  type CreateReservationConfirmInput,
  type CreateReservationSelection,
} from '../components/CreateReservationDialog';
import { ReservationCard } from '../components/ReservationCard';
import { ReservationDetailsDialog } from '../components/ReservationDetailsDialog';

const VISIBLE_DAYS = 14;
const ROW_HEIGHT = 52;
const LABEL_COL_WIDTH = 154;
const STATUS_LABEL: Partial<Record<StatutReservation, string>> = {
  CONFIRMEE: 'Confirmées',
  NO_SHOW: 'No-show',
  TRANSFORMEE_EN_SEJOUR: 'Transformées en séjour',
};
const CANAL_BAR_CLASS: Record<Reservation['canal'], string> = {
  DIRECT: 'border-primary/40 bg-primary-soft text-primary',
  WALK_IN: 'border-canal-walkin/40 bg-canal-walkin-soft text-canal-walkin',
  BOOKING_COM: 'border-info/40 bg-info-soft text-info',
  EXPEDIA: 'border-warning/40 bg-warning-soft text-warning',
  AIRBNB: 'border-violet/40 bg-violet-soft text-violet',
};
const CANAL_DOT_CLASS: Record<Reservation['canal'], string> = {
  DIRECT: 'bg-primary',
  WALK_IN: 'bg-canal-walkin',
  BOOKING_COM: 'bg-info',
  EXPEDIA: 'bg-warning',
  AIRBNB: 'bg-violet',
};

interface Selecting {
  roomId: number;
  startIdx: number;
  endIdx: number;
}

export function ReservationsCalendarPage({
  permissions,
}: {
  permissions: string[];
}) {
  const canWrite = permissions.includes('reservations:write');
  const canDelete = permissions.includes('reservations:delete');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [windowStart, setWindowStart] = useState(() => startOfDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StatutReservation>(
    'ALL',
  );
  const [selecting, setSelecting] = useState<Selecting | null>(null);
  const selectingRef = useRef<Selecting | null>(null);
  const roomsRef = useRef<Room[]>([]);
  const daysRef = useRef<Date[]>([]);
  const [pendingSelection, setPendingSelection] =
    useState<CreateReservationSelection | null>(null);
  const [manualCreateOpen, setManualCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewingReservation, setViewingReservation] =
    useState<Reservation | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [cancellingReservation, setCancellingReservation] =
    useState<Reservation | null>(null);
  const [cancelMotif, setCancelMotif] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const days = useMemo(
    () => getDateRange(windowStart, VISIBLE_DAYS),
    [windowStart],
  );
  const windowEnd = useMemo(
    () => addDays(windowStart, VISIBLE_DAYS),
    [windowStart],
  );
  const visibleReservations = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr');
    return reservations.filter((reservation) => {
      const searchable =
        `${reservation.guest.nom} ${reservation.guest.prenom} ${reservation.room.numero} ${CANAL_LABEL[reservation.canal]}`.toLocaleLowerCase(
          'fr',
        );
      return (
        (!needle || searchable.includes(needle)) &&
        (statusFilter === 'ALL' || reservation.statut === statusFilter)
      );
    });
  }, [query, reservations, statusFilter]);
  const periodLabel = `${days[0]?.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', timeZone: 'UTC' })} — ${days.at(-1)?.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);
  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [roomData, reservationData] = await Promise.all([
        listRooms(),
        listReservations({
          du: toISODate(windowStart),
          au: toISODate(windowEnd),
        }),
      ]);
      setRooms(roomData);
      setReservations(
        reservationData.filter(
          (reservation) => reservation.statut !== 'ANNULEE',
        ),
      );
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Erreur de chargement',
      );
    } finally {
      setLoading(false);
    }
  }, [windowEnd, windowStart]);
  useEffect(() => {
    // Chargement déclenché par la fenêtre de dates, comme avant DESIGN-003B.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  const beginSelection = useCallback((roomId: number, dayIndex: number) => {
    const initial = { roomId, startIdx: dayIndex, endIdx: dayIndex };
    selectingRef.current = initial;
    setSelecting(initial);
    const onMouseUp = () => {
      const current = selectingRef.current;
      const room =
        current && roomsRef.current.find((item) => item.id === current.roomId);
      if (current && room) {
        const from = Math.min(current.startIdx, current.endIdx);
        const to = Math.max(current.startIdx, current.endIdx);
        setPendingSelection({
          room,
          dateArrivee: toISODate(daysRef.current[from]),
          dateDepart: toISODate(addDays(daysRef.current[to], 1)),
        });
      }
      selectingRef.current = null;
      setSelecting(null);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mouseup', onMouseUp);
  }, []);

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
    dayIndex: number,
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
        dateArrivee: toISODate(days[dayIndex]),
        dateDepart: toISODate(addDays(days[dayIndex], nights)),
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
    if (!viewingReservation) return;
    if (input.prixTotalFinal === undefined) {
      setViewingReservation(null);
      return;
    }
    setSavingDetails(true);
    setDetailsError(null);
    try {
      await updateReservation(viewingReservation.id, input);
      setViewingReservation(null);
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

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 p-3 sm:p-4 xl:p-5">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-primary text-[11px] font-bold tracking-[.08em] uppercase">
            Planning hôtelier
          </p>
          <h1 className="text-xl font-extrabold tracking-tight">
            Réservations
          </h1>
          <p className="text-text-secondary mt-0.5 text-sm">
            {periodLabel} · {visibleReservations.length} réservation
            {visibleReservations.length > 1 ? 's' : ''}
          </p>
        </div>
        {canWrite && (
          <Button
            size="lg"
            className="min-h-11 w-full gap-2 sm:w-auto"
            onClick={() => setManualCreateOpen(true)}
          >
            <Plus aria-hidden="true" />
            Nouvelle réservation
          </Button>
        )}
      </header>

      <Card className="shrink-0">
        <CardContent className="gap-3 p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Période précédente"
                onClick={() => setWindowStart((date) => addDays(date, -7))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="min-h-9 flex-1 sm:flex-none"
                onClick={() => setWindowStart(startOfDay(new Date()))}
              >
                Aujourd’hui
              </Button>
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Période suivante"
                onClick={() => setWindowStart((date) => addDays(date, 7))}
              >
                <ChevronRight />
              </Button>
              <span className="text-text-secondary ml-2 hidden text-sm font-semibold sm:inline">
                {periodLabel}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px] lg:w-[500px]">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="text-text-secondary absolute top-1/2 left-3 size-4 -translate-y-1/2"
                />
                <Input
                  aria-label="Rechercher une réservation"
                  className="h-10 pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Client, chambre ou canal…"
                />
              </div>
              <select
                aria-label="Filtrer par statut"
                className="h-10 rounded-lg border border-input bg-surface px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as typeof statusFilter)
                }
              >
                <option value="ALL">Tous les statuts</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-text-secondary hidden flex-wrap items-center gap-3 border-t pt-2 text-xs md:flex">
            {(Object.keys(CANAL_LABEL) as Reservation['canal'][]).map(
              (canal) => (
                <span key={canal} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'size-2.5 rounded-sm',
                      CANAL_DOT_CLASS[canal],
                    )}
                  />
                  {CANAL_LABEL[canal]}
                </span>
              ),
            )}
            {canWrite && (
              <span className="ml-auto">
                Glissez sur une zone vide pour créer · déplacez uniquement les
                réservations confirmées
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {actionError && (
        <Alert
          tone="destructive"
          title="Déplacement impossible"
          description={actionError}
        />
      )}
      {loadError ? (
        <ErrorState
          title="Le planning n’a pas pu être chargé"
          description={loadError}
          onRetry={() => void refetch()}
        />
      ) : loading ? (
        <PlanningSkeleton />
      ) : visibleReservations.length === 0 && query ? (
        <EmptyState
          icon={<Search />}
          title="Aucun résultat"
          description="Modifiez la recherche ou le filtre pour retrouver une réservation."
        />
      ) : (
        <>
          <div className="hidden min-h-0 flex-1 overflow-auto rounded-lg border bg-surface shadow-[var(--shadow-card)] select-none xl:block">
            <PlanningGrid
              rooms={rooms}
              reservations={visibleReservations}
              days={days}
              canWrite={canWrite}
              canDelete={canDelete}
              selecting={selecting}
              selectingRef={selectingRef}
              onSelectionChange={setSelecting}
              beginSelection={beginSelection}
              onDrop={handleDrop}
              onView={setViewingReservation}
              onCancel={(reservation) => {
                setCancellingReservation(reservation);
                setCancelMotif('');
                setCancelError(null);
              }}
            />
          </div>
          <MobileAgenda
            reservations={visibleReservations}
            onOpen={setViewingReservation}
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
      <ReservationDetailsDialog
        reservation={viewingReservation}
        onClose={() => {
          setViewingReservation(null);
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
    </div>
  );
}

function PlanningGrid({
  rooms,
  reservations,
  days,
  canWrite,
  canDelete,
  selecting,
  selectingRef,
  onSelectionChange,
  beginSelection,
  onDrop,
  onView,
  onCancel,
}: {
  rooms: Room[];
  reservations: Reservation[];
  days: Date[];
  canWrite: boolean;
  canDelete: boolean;
  selecting: Selecting | null;
  selectingRef: React.MutableRefObject<Selecting | null>;
  onSelectionChange: (selection: Selecting) => void;
  beginSelection: (roomId: number, day: number) => void;
  onDrop: (reservationId: number, roomId: number, day: number) => Promise<void>;
  onView: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
}) {
  const columns = `${LABEL_COL_WIDTH}px repeat(${VISIBLE_DAYS}, minmax(66px, 1fr))`;
  return (
    <div
      className="grid min-w-[1120px]"
      style={{ gridTemplateColumns: columns }}
    >
      <div className="sticky top-0 left-0 z-30 flex items-center border-r border-b bg-surface-2 px-3 text-xs font-bold tracking-wide uppercase">
        Chambre
      </div>
      {days.map((day) => {
        const today = isSameDay(day, new Date());
        const weekend = [0, 6].includes(day.getUTCDay());
        return (
          <div
            key={toISODate(day)}
            className={cn(
              'sticky top-0 z-20 border-b border-l px-1 py-2 text-center text-xs font-semibold capitalize',
              today
                ? 'bg-primary-soft text-primary'
                : weekend
                  ? 'bg-surface-2 text-text-secondary'
                  : 'bg-surface',
            )}
          >
            {formatDayLabel(day)}
            {today && (
              <span className="mt-1 block text-[10px] font-bold uppercase">
                Aujourd’hui
              </span>
            )}
          </div>
        );
      })}
      {rooms.map((room) => {
        const roomReservations = reservations.filter(
          (reservation) => reservation.roomId === room.id,
        );
        const spans = roomReservations
          .map((reservation) => ({
            reservation,
            placement: getVisibleReservationSpan(
              reservation.dateArrivee,
              reservation.dateDepart,
              days,
            ),
          }))
          .filter(
            (
              item,
            ): item is typeof item & {
              placement: { startIndex: number; span: number };
            } => item.placement !== null,
          );
        return (
          <div key={room.id} className="contents">
            <div
              className="sticky left-0 z-10 flex items-center justify-between gap-2 border-r border-b bg-surface px-3"
              style={{ height: ROW_HEIGHT }}
            >
              <div>
                <p className="text-sm font-bold">{room.numero}</p>
                <p className="text-text-secondary truncate text-xs">
                  {room.roomType.nom}
                </p>
              </div>
              <Badge
                variant={
                  room.statut === 'EN_MAINTENANCE' ? 'warning' : 'outline'
                }
                className="max-w-16 truncate"
              >
                {room.statut === 'LIBRE_PROPRE'
                  ? 'Libre'
                  : room.statut.replaceAll('_', ' ')}
              </Badge>
            </div>
            {days.map((day, dayIndex) => {
              const reservationHere = roomReservations.find(
                (reservation) =>
                  day >= startOfDay(new Date(reservation.dateArrivee)) &&
                  day < startOfDay(new Date(reservation.dateDepart)),
              );
              const visible = spans.find(
                (item) => item.placement.startIndex === dayIndex,
              );
              const today = isSameDay(day, new Date());
              return (
                // Les cellules portent le geste spatial souris existant
                // (sélection de plage + drop). Le mobile utilise l'agenda.
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                <div
                  key={toISODate(day)}
                  className={cn(
                    'relative border-b border-l transition-colors duration-[var(--duration-fast)]',
                    today && 'bg-primary/3',
                    canWrite && !reservationHere && 'hover:bg-primary-soft/60',
                  )}
                  style={{ height: ROW_HEIGHT }}
                  onMouseDown={() =>
                    canWrite &&
                    !reservationHere &&
                    beginSelection(room.id, dayIndex)
                  }
                  onMouseEnter={() => {
                    const current = selectingRef.current;
                    if (current?.roomId === room.id) {
                      const next = { ...current, endIdx: dayIndex };
                      selectingRef.current = next;
                      onSelectionChange(next);
                    }
                  }}
                  onDragOver={(event) => {
                    if (canWrite) {
                      event.preventDefault();
                      event.currentTarget.classList.add('bg-primary-soft');
                    }
                  }}
                  onDragLeave={(event) =>
                    event.currentTarget.classList.remove('bg-primary-soft')
                  }
                  onDrop={(event) => {
                    event.currentTarget.classList.remove('bg-primary-soft');
                    if (!canWrite) return;
                    event.preventDefault();
                    const id = Number(event.dataTransfer.getData('text/plain'));
                    if (id) void onDrop(id, room.id, dayIndex);
                  }}
                >
                  {selecting?.roomId === room.id &&
                    dayIndex >=
                      Math.min(selecting.startIdx, selecting.endIdx) &&
                    dayIndex <=
                      Math.max(selecting.startIdx, selecting.endIdx) && (
                      <div className="absolute inset-1 rounded bg-primary/20 ring-1 ring-primary/40" />
                    )}
                  {visible && (
                    <ReservationBar
                      reservation={visible.reservation}
                      span={visible.placement.span}
                      canMove={
                        canWrite && visible.reservation.statut === 'CONFIRMEE'
                      }
                      canCancel={
                        canDelete && visible.reservation.statut === 'CONFIRMEE'
                      }
                      onView={() => onView(visible.reservation)}
                      onCancel={() => onCancel(visible.reservation)}
                      disablePointerEvents={selecting !== null}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ReservationBar({
  reservation,
  span,
  canMove,
  canCancel,
  onCancel,
  onView,
  disablePointerEvents,
}: {
  reservation: Reservation;
  span: number;
  canMove: boolean;
  canCancel: boolean;
  onCancel: () => void;
  onView: () => void;
  disablePointerEvents: boolean;
}) {
  return (
    <div
      draggable={canMove}
      role="button"
      tabIndex={0}
      aria-label={`${reservation.guest.nom} ${reservation.guest.prenom}`}
      onDragStart={(event) =>
        canMove &&
        event.dataTransfer.setData('text/plain', String(reservation.id))
      }
      onClick={onView}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onView();
        }
      }}
      className={cn(
        'absolute inset-y-1 left-1 z-10 flex min-w-0 items-center justify-between gap-1 overflow-hidden rounded-md border px-2 text-xs font-semibold shadow-sm transition-[box-shadow,transform] duration-[var(--duration-fast)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none hover:-translate-y-px hover:shadow-[var(--shadow-card-hover)]',
        CANAL_BAR_CLASS[reservation.canal],
        canMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        disablePointerEvents && 'pointer-events-none',
      )}
      style={{ width: `calc(${span * 100}% - 6px)` }}
      title={`${reservation.guest.nom} ${reservation.guest.prenom} · ${CANAL_LABEL[reservation.canal]} · ${reservation.dateArrivee.slice(0, 10)} → ${reservation.dateDepart.slice(0, 10)}`}
    >
      <span className="truncate">
        {reservation.guest.nom} {reservation.guest.prenom}
      </span>
      {canCancel && (
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-current hover:bg-surface/50"
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
          aria-label="Annuler la réservation"
        >
          ×
        </button>
      )}
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
                <p className="text-text-secondary text-xs">
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

function PlanningSkeleton() {
  return (
    <Card className="min-h-72">
      <CardContent className="gap-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function CancelDialog({
  reservation,
  motif,
  setMotif,
  cancelling,
  error,
  onClose,
  onConfirm,
}: {
  reservation: Reservation | null;
  motif: string;
  setMotif: (value: string) => void;
  cancelling: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={reservation !== null}
      onOpenChange={(open) => !open && !cancelling && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler la réservation</DialogTitle>
        </DialogHeader>
        <Alert
          tone="warning"
          title="Action irréversible"
          description={
            reservation
              ? `${reservation.guest.nom} ${reservation.guest.prenom} · chambre ${reservation.room.numero}`
              : undefined
          }
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cancel-motif">Motif de l’annulation</Label>
          <Input
            id="cancel-motif"
            value={motif}
            onChange={(event) => setMotif(event.target.value)}
            minLength={10}
            required
            disabled={cancelling}
          />
          <p className="text-text-secondary text-xs">10 caractères minimum.</p>
        </div>
        {error && (
          <Alert
            tone="destructive"
            title="Annulation impossible"
            description={error}
          />
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={cancelling}
            onClick={onClose}
          >
            Fermer
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={cancelling || motif.trim().length < 10}
            onClick={onConfirm}
          >
            {cancelling ? 'Annulation…' : 'Confirmer l’annulation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
