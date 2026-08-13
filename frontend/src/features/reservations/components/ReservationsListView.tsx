import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MoneyDisplay } from '@/components/ui/money-display';
import { toDateOnly } from '../date-utils';
import { CANAL_LABEL } from '../reservation-presentation';
import type { Reservation, StatutReservation } from '../types';

const STATUS_BADGE: Record<
  StatutReservation,
  { label: string; variant: 'success' | 'destructive' | 'warning' | 'info' }
> = {
  CONFIRMEE: { label: 'Confirmée', variant: 'success' },
  ANNULEE: { label: 'Annulée', variant: 'destructive' },
  NO_SHOW: { label: 'No-show', variant: 'warning' },
  TRANSFORMEE_EN_SEJOUR: { label: 'En séjour', variant: 'info' },
};

const CANAL_DOT: Record<Reservation['canal'], string> = {
  DIRECT: 'bg-primary',
  WALK_IN: 'bg-canal-walkin',
  BOOKING_COM: 'bg-info',
  EXPEDIA: 'bg-warning',
  AIRBNB: 'bg-violet',
};

function nights(dateArrivee: string, dateDepart: string) {
  return Math.round(
    (new Date(dateDepart).getTime() - new Date(dateArrivee).getTime()) /
      86_400_000,
  );
}

interface Props {
  reservations: Reservation[];
  today: string;
  hasActiveSearch: boolean;
  onSelect: (reservation: Reservation) => void;
}

// DESIGN-007 — vue Liste validée sur Prototype C2 : table dense, statut
// "Aujourd'hui" mis en évidence, aucune donnée mock (reservations vient de
// GET /reservations côté ReservationsCalendarPage). Colonnes limitées aux
// champs réellement disponibles sur `Reservation` (types.ts).
export function ReservationsListView({
  reservations,
  today,
  hasActiveSearch,
  onSelect,
}: Props) {
  if (reservations.length === 0) {
    return (
      <EmptyState
        icon={<Search />}
        title="Aucun résultat"
        description={
          hasActiveSearch
            ? 'Modifiez la recherche ou les filtres pour retrouver une réservation.'
            : 'Aucune réservation sur la période couverte par cet écran.'
        }
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          {reservations.length} réservation{reservations.length > 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs font-bold tracking-wide uppercase">
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Arrivée → Départ</th>
              <th className="px-3 py-2">Nuits</th>
              <th className="px-3 py-2">Chambre</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Canal</th>
              <th className="px-3 py-2 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => {
              const isToday = toDateOnly(r.dateArrivee) === today;
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ouvrir la réservation de ${r.guest.nom} ${r.guest.prenom}`}
                  onClick={() => onSelect(r)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(r);
                    }
                  }}
                  className="hover:bg-surface-2 focus-visible:bg-surface-2 cursor-pointer border-b transition-colors duration-[var(--duration-fast)] last:border-b-0 focus-visible:outline-none"
                >
                  <td className="px-3 py-2">
                    <p className="font-semibold">
                      {r.guest.nom} {r.guest.prenom}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Réf #{r.id}
                      {r.guest.telephone ? ` · ${r.guest.telephone}` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        isToday ? 'text-primary font-semibold' : undefined
                      }
                    >
                      {toDateOnly(r.dateArrivee)}
                    </span>{' '}
                    → {toDateOnly(r.dateDepart)}
                    {isToday && (
                      <Badge variant="brand" className="ml-2">
                        Aujourd'hui
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {nights(r.dateArrivee, r.dateDepart)}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.room.numero}</p>
                    <p className="text-muted-foreground text-xs">
                      {r.room.roomType.nom}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_BADGE[r.statut].variant}>
                      {STATUS_BADGE[r.statut].label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className={`size-2 rounded-full ${CANAL_DOT[r.canal]}`}
                      />
                      {CANAL_LABEL[r.canal]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MoneyDisplay value={r.prixTotalFinal} />
                    {r.ajustementManuel && (
                      <p className="text-muted-foreground text-[10px]">
                        ajusté
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
