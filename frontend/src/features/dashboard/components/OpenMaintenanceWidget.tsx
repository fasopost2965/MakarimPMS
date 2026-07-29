import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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

  return (
    <div className="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Tickets de maintenance ouverts</h3>
        <button
          type="button"
          onClick={onNavigate}
          className="text-primary text-xs hover:underline"
        >
          Voir la maintenance →
        </button>
      </div>
      {tickets.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Aucun ticket ouvert pour le moment.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tickets.slice(0, 5).map((ticket) => (
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
          {tickets.length > 5 && (
            <li className="text-muted-foreground text-xs">
              + {tickets.length - 5} autre(s)
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
