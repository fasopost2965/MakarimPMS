import { Badge } from '@/components/ui/badge';
import {
  CANAL_LABEL,
  FORMULE_LABEL,
} from '../../reservations/reservation-presentation';
import type { CanalReservation, Reservation } from '../../reservations/types';

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

function initials(nom: string, prenom: string) {
  return `${nom.charAt(0)}${prenom.charAt(0)}`.toUpperCase();
}

interface Props {
  arrivals: Reservation[];
  hasAnyArrival: boolean;
  onSelect: (reservation: Reservation) => void;
}

// DESIGN-009 — grille de cartes reprise du prototype PrototypeFrontDeskA
// (vue "arrivees") : chaque carte ouvre un panneau de consultation
// (ArrivalContextPanel), jamais d'action directe sur la carte elle-même.
export function ArrivalsView({ arrivals, hasAnyArrival, onSelect }: Props) {
  if (arrivals.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        {hasAnyArrival
          ? 'Aucun résultat pour cette recherche.'
          : "Aucune arrivée prévue aujourd'hui."}
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {arrivals.map((reservation) => (
        <button
          key={reservation.id}
          type="button"
          onClick={() => onSelect(reservation)}
          className="bg-card hover:border-primary/50 flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${CANAL_AVATAR_CLASS[reservation.canal]}`}
              >
                {initials(reservation.guest.nom, reservation.guest.prenom)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">
                  {reservation.guest.nom} {reservation.guest.prenom}
                </span>
                <span
                  className={`text-xs ${CANAL_TEXT_CLASS[reservation.canal]}`}
                >
                  {CANAL_LABEL[reservation.canal]}
                </span>
              </span>
            </span>
            <Badge variant="outline">Ch. {reservation.room.numero}</Badge>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <span>
              {reservation.nombreOccupants ?? '—'} occupant
              {(reservation.nombreOccupants ?? 0) > 1 ? 's' : ''}
            </span>
            <span>·</span>
            <span>{FORMULE_LABEL[reservation.formule]}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
