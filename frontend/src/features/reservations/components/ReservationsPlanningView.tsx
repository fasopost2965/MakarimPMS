import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  addDays,
  formatDayLabel,
  getDateRange,
  getVisibleReservationSpan,
  isSameDay,
  startOfDay,
  toISODate,
} from '../date-utils';
import { CANAL_LABEL } from '../reservation-presentation';
import type { Reservation, Room } from '../types';
import type { CreateReservationSelection } from './CreateReservationDialog';

// DESIGN-007 — vue Planning validée sur Prototype C2 : présentation resserrée
// à 7 jours + navigation ←/Aujourd'hui/→ (mission §5). La mécanique
// (sélection de plage à la souris, glisser-déposer, revalidation serveur de
// disponibilité côté ReservationsCalendarPage) est reprise EXACTEMENT de
// l'ancien PlanningGrid — extraite ici telle quelle, aucune réécriture de
// logique métier.
const VISIBLE_DAYS = 7;
const ROW_HEIGHT = 52;
const LABEL_COL_WIDTH = 154;

const CANAL_BAR_CLASS: Record<Reservation['canal'], string> = {
  DIRECT: 'border-primary/40 bg-primary-soft text-primary',
  WALK_IN: 'border-canal-walkin/40 bg-canal-walkin-soft text-canal-walkin',
  BOOKING_COM: 'border-info/40 bg-info-soft text-info',
  EXPEDIA: 'border-warning/40 bg-warning-soft text-warning',
  AIRBNB: 'border-violet/40 bg-violet-soft text-violet',
};

interface Selecting {
  roomId: number;
  startIdx: number;
  endIdx: number;
}

interface Props {
  rooms: Room[];
  reservations: Reservation[];
  canWrite: boolean;
  canDelete: boolean;
  onView: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
  onDrop: (
    reservationId: number,
    roomId: number,
    dateArrivee: string,
  ) => Promise<void>;
  onCreateSelection: (selection: CreateReservationSelection) => void;
}

export function ReservationsPlanningView({
  rooms,
  reservations,
  canWrite,
  canDelete,
  onView,
  onCancel,
  onDrop,
  onCreateSelection,
}: Props) {
  const [windowStart, setWindowStart] = useState(() => startOfDay(new Date()));
  const [selecting, setSelecting] = useState<Selecting | null>(null);
  const selectingRef = useRef<Selecting | null>(null);
  const roomsRef = useRef<Room[]>(rooms);
  const daysRef = useRef<Date[]>([]);

  const days = getDateRange(windowStart, VISIBLE_DAYS);
  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);
  useEffect(() => {
    daysRef.current = days;
  }, [days]);
  const windowEnd = addDays(windowStart, VISIBLE_DAYS);
  const visibleReservations = reservations.filter(
    (reservation) =>
      new Date(reservation.dateArrivee) < windowEnd &&
      new Date(reservation.dateDepart) > windowStart,
  );
  const periodLabel = `${toISODate(windowStart)} → ${toISODate(addDays(windowStart, VISIBLE_DAYS - 1))}`;

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
        onCreateSelection({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardContent className="gap-3 p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Période précédente"
            onClick={() =>
              setWindowStart((date) => addDays(date, -VISIBLE_DAYS))
            }
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            onClick={() => setWindowStart(startOfDay(new Date()))}
          >
            Aujourd'hui
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Période suivante"
            onClick={() =>
              setWindowStart((date) => addDays(date, VISIBLE_DAYS))
            }
          >
            <ChevronRight />
          </Button>
          <span className="text-muted-foreground ml-2 hidden text-sm font-semibold sm:inline">
            {periodLabel}
          </span>
          {canWrite && (
            <span className="text-muted-foreground ml-auto hidden text-xs md:inline">
              Glissez sur une zone vide pour créer · déplacez uniquement les
              réservations confirmées
            </span>
          )}
        </div>

        <div className="max-h-[60vh] min-h-0 overflow-auto rounded-lg border select-none">
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
            onDrop={(reservationId, roomId, dayIndex) =>
              onDrop(reservationId, roomId, toISODate(days[dayIndex]))
            }
            onView={onView}
            onCancel={onCancel}
          />
        </div>
      </CardContent>
    </Card>
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
  onDrop: (reservationId: number, roomId: number, day: number) => void;
  onView: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
}) {
  const columns = `${LABEL_COL_WIDTH}px repeat(${VISIBLE_DAYS}, minmax(90px, 1fr))`;
  return (
    <div
      className="grid min-w-[720px]"
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
                  ? 'bg-surface-2 text-muted-foreground'
                  : 'bg-surface',
            )}
          >
            {formatDayLabel(day)}
            {today && (
              <span className="mt-1 block text-[10px] font-bold uppercase">
                Aujourd'hui
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
                <p className="text-muted-foreground truncate text-xs">
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
                    if (id) onDrop(id, room.id, dayIndex);
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
