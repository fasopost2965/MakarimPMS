import { CalendarDays, DoorOpen, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Reservation } from '../types';
import { CANAL_LABEL } from '../reservation-presentation';

const STATUS: Record<
  Reservation['statut'],
  { label: string; variant: 'success' | 'destructive' | 'warning' | 'info' }
> = {
  CONFIRMEE: { label: 'Confirmée', variant: 'success' },
  ANNULEE: { label: 'Annulée', variant: 'destructive' },
  NO_SHOW: { label: 'No-show', variant: 'warning' },
  TRANSFORMEE_EN_SEJOUR: { label: 'En séjour', variant: 'info' },
};

const CANAL_CLASS: Record<Reservation['canal'], string> = {
  DIRECT: 'border-primary/30 bg-primary-soft text-primary',
  WALK_IN: 'border-canal-walkin/30 bg-canal-walkin-soft text-canal-walkin',
  BOOKING_COM: 'border-info/30 bg-info-soft text-info',
  EXPEDIA: 'border-warning/30 bg-warning-soft text-warning',
  AIRBNB: 'border-violet/30 bg-violet-soft text-violet',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function ReservationCard({
  reservation,
  onOpen,
  compact = false,
}: {
  reservation: Reservation;
  onOpen: () => void;
  compact?: boolean;
}) {
  return (
    <Card interactive className="overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        className="min-h-11 w-full text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={`Ouvrir la réservation de ${reservation.guest.nom} ${reservation.guest.prenom}`}
      >
        <CardContent className={cn('gap-3', compact ? 'p-3' : 'p-4')}>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">
                {reservation.guest.nom} {reservation.guest.prenom}
              </p>
              <p className="text-text-secondary mt-0.5 text-xs">
                Réservation #{reservation.id}
              </p>
            </div>
            <Badge variant={STATUS[reservation.statut].variant}>
              {STATUS[reservation.statut].label}
            </Badge>
          </div>
          <div className="text-text-secondary grid gap-2 text-sm sm:grid-cols-2">
            <span className="flex items-center gap-2">
              <CalendarDays
                aria-hidden="true"
                className="size-4 text-primary"
              />
              {formatDate(reservation.dateArrivee)} →{' '}
              {formatDate(reservation.dateDepart)}
            </span>
            <span className="flex items-center gap-2">
              <DoorOpen aria-hidden="true" className="size-4 text-primary" />
              Chambre {reservation.room.numero} ·{' '}
              {reservation.room.roomType.nom}
            </span>
            {reservation.nombreOccupants !== null && (
              <span className="flex items-center gap-2">
                <Users aria-hidden="true" className="size-4 text-primary" />
                {reservation.nombreOccupants} occupant
                {reservation.nombreOccupants > 1 ? 's' : ''}
              </span>
            )}
            <span
              className={cn(
                'w-fit rounded-full border px-2 py-0.5 text-xs font-semibold',
                CANAL_CLASS[reservation.canal],
              )}
            >
              {CANAL_LABEL[reservation.canal]}
            </span>
          </div>
        </CardContent>
      </button>
    </Card>
  );
}
