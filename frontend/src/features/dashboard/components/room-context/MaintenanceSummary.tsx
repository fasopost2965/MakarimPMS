import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { listTickets } from '../../../maintenance/api';
import type {
  MaintenanceTicket,
  PrioriteTicket,
} from '../../../maintenance/types';
import type { Room } from '../../../reservations/types';
import { AccessDenied } from './AccessDenied';

interface Props {
  room: Room;
  permissions: string[] | null;
  onNavigate: () => void;
}

const PRIORITE_LABEL: Record<PrioriteTicket, string> = {
  BASSE: 'Basse',
  MOYENNE: 'Moyenne',
  HAUTE: 'Haute',
  URGENTE: 'Urgente',
};

const PRIORITE_BADGE_VARIANT: Record<
  PrioriteTicket,
  'secondary' | 'info' | 'warning' | 'destructive'
> = {
  BASSE: 'secondary',
  MOYENNE: 'info',
  HAUTE: 'warning',
  URGENTE: 'destructive',
};

// DESIGN-006 (mission §8) — plusieurs tickets ouverts sont un cas réel
// (Discovery Phase 1 §7) : on liste TOUS les tickets ouverts de la chambre,
// jamais seulement le plus prioritaire.
export function MaintenanceSummary({ room, permissions, onNavigate }: Props) {
  const can = (permission: string) =>
    permissions?.includes(permission) ?? false;

  const [tickets, setTickets] = useState<MaintenanceTicket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const data = await listTickets({ roomId: room.id, ouvert: true });
      if (requestId === requestSequence.current) setTickets(data);
    } catch (err) {
      if (requestId === requestSequence.current) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [room.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      requestSequence.current += 1;
    };
  }, [load]);

  if (!can('maintenance:read')) return <AccessDenied />;

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Impossible de charger les tickets de maintenance"
        description={error}
        onRetry={() => void load()}
      />
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <EmptyState
        title="Cette chambre a changé d'état depuis le dernier rafraîchissement."
        description="Aucun ticket de maintenance ouvert n'est plus enregistré pour cette chambre."
        action={{ label: 'Rafraîchir', onClick: () => void load() }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tickets.map((ticket) => (
        <div key={ticket.id} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={PRIORITE_BADGE_VARIANT[ticket.priorite]}>
              {PRIORITE_LABEL[ticket.priorite]}
            </Badge>
            {ticket.bloqueVente && (
              <Badge variant="destructive">Bloquant</Badge>
            )}
          </div>
          <p className="mt-1.5 font-medium">{ticket.typePanne}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Ouvert le {new Date(ticket.createdAt).toLocaleString('fr-FR')}
          </p>
          {ticket.assigneA && (
            <p className="text-muted-foreground text-xs">
              Assigné à {ticket.assigneA}
            </p>
          )}
          {ticket.photoUrl && (
            <img
              src={ticket.photoUrl}
              alt={ticket.typePanne}
              className="mt-2 max-h-32 rounded-md border object-cover"
            />
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={onNavigate}
      >
        {tickets.length === 1 ? 'Voir le ticket' : 'Voir Maintenance'}
      </Button>
    </div>
  );
}
