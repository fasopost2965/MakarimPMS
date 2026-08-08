import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listTickets } from '../../maintenance/api';
import type { MaintenanceTicket } from '../../maintenance/types';

interface Props {
  onNavigate: () => void;
}

const PRIORITE_VARIANT: Record<
  MaintenanceTicket['priorite'],
  'destructive' | 'warning' | 'info' | 'outline'
> = {
  URGENTE: 'destructive',
  HAUTE: 'warning',
  MOYENNE: 'info',
  BASSE: 'outline',
};

// CH-043 — même principe que RoomsToCleanWidget : liste réelle des tickets
// ouverts (GET /maintenance-tickets?ouvert=true, déjà utilisé par
// MaintenancePage), jamais de ticket fictif. Rôles sans maintenance:read :
// échec 403 capturé silencieusement, widget non affiché.
export function OpenMaintenanceWidget({ onNavigate }: Props) {
  const [tickets, setTickets] = useState<MaintenanceTicket[] | null>(null);

  useEffect(() => {
    listTickets({ ouvert: true })
      .then(setTickets)
      .catch(() => setTickets(null));
  }, []);

  if (tickets === null) return null;

  const urgentCount = tickets.filter(
    (ticket) => ticket.priorite === 'URGENTE',
  ).length;
  // Deux filtres préservent l'ordre renvoyé par l'API à priorité égale :
  // seules les urgences sont déplacées devant les autres tickets ouverts.
  const orderedTickets = [
    ...tickets.filter((ticket) => ticket.priorite === 'URGENTE'),
    ...tickets.filter((ticket) => ticket.priorite !== 'URGENTE'),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets de maintenance ouverts</CardTitle>
        <button
          type="button"
          onClick={onNavigate}
          className="text-primary focus-visible:ring-ring/50 min-h-11 rounded-md text-xs hover:underline focus-visible:ring-3 focus-visible:outline-none sm:min-h-0"
        >
          Voir la maintenance →
        </button>
      </CardHeader>
      <CardContent className="gap-3 pt-2">
        {tickets.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune intervention ouverte ou urgente pour le moment.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs" aria-live="polite">
              {urgentCount === 0
                ? 'Aucune intervention urgente'
                : `${urgentCount} intervention${urgentCount > 1 ? 's' : ''} urgente${urgentCount > 1 ? 's' : ''}`}
            </p>
            <ul className="flex flex-col gap-1.5">
              {orderedTickets.slice(0, 5).map((ticket) => (
                <li
                  key={ticket.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate">
                    {ticket.room ? `Ch. ${ticket.room.numero} — ` : ''}
                    {ticket.typePanne}
                  </span>
                  <Badge variant={PRIORITE_VARIANT[ticket.priorite]}>
                    {ticket.priorite}
                  </Badge>
                </li>
              ))}
              {orderedTickets.length > 5 && (
                <li className="text-muted-foreground text-xs">
                  + {orderedTickets.length - 5} autre(s)
                </li>
              )}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
