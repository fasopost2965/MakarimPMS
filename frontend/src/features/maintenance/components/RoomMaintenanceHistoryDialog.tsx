import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { listTickets } from '../api';
import type { MaintenanceTicket, PrioriteTicket } from '../types';

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

interface RoomMaintenanceHistoryDialogProps {
  roomId: number | null;
  roomNumero: string | null;
  onClose: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR');
}

function sortTickets(tickets: MaintenanceTicket[]) {
  return [...tickets].sort((left, right) => {
    const byDate =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    return byDate || right.id - left.id;
  });
}

export function RoomMaintenanceHistoryDialog({
  roomId,
  roomNumero,
  onClose,
}: RoomMaintenanceHistoryDialogProps) {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadHistory = useCallback(async () => {
    if (roomId === null) return;

    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const data = await listTickets({ roomId });
      if (requestId === requestSequence.current) {
        setTickets(sortTickets(data));
      }
    } catch (err) {
      if (requestId === requestSequence.current) {
        setError(
          err instanceof Error
            ? err.message
            : 'Erreur de chargement de l’historique',
        );
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (roomId === null) {
      requestSequence.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTickets([]);
      setError(null);
      setLoading(false);
      return;
    }

    setTickets([]);
    void loadHistory();

    return () => {
      requestSequence.current += 1;
    };
  }, [loadHistory, roomId]);

  function handleClose() {
    requestSequence.current += 1;
    onClose();
  }

  return (
    <Dialog
      open={roomId !== null}
      onOpenChange={(open) => !open && handleClose()}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Historique maintenance — chambre {roomNumero ?? '—'}
          </DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          Du plus récent au plus ancien
        </p>

        {loading && (
          <p className="text-muted-foreground text-sm" role="status">
            Chargement de l’historique…
          </p>
        )}

        {!loading && error && (
          <ErrorState
            title="Impossible de charger l’historique"
            description={error}
            onRetry={() => void loadHistory()}
          />
        )}

        {!loading && !error && tickets.length === 0 && (
          <EmptyState
            title={`Aucun ticket pour la chambre ${roomNumero ?? '—'}`}
            description="Aucun ticket de maintenance n’est lié à cette chambre."
          />
        )}

        {!loading && !error && tickets.length > 0 && (
          <ol className="grid gap-3" aria-label="Chronologie des tickets">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="bg-card rounded-lg border p-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-xs">Identifiant</p>
                    <p className="font-medium">#{ticket.id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Panne</p>
                    <p className="font-medium">{ticket.typePanne}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Priorité</p>
                    <Badge variant={PRIORITE_BADGE_VARIANT[ticket.priorite]}>
                      {PRIORITE_LABEL[ticket.priorite]}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Assigné à</p>
                    <p className="font-medium">{ticket.assigneA ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Statut</p>
                    <Badge variant={ticket.resoluAt ? 'success' : 'info'}>
                      {ticket.resoluAt ? 'Résolu' : 'Ouvert'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Créé le</p>
                    <p className="font-medium">
                      {formatDate(ticket.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Résolu le</p>
                    <p className="font-medium">
                      {ticket.resoluAt ? formatDate(ticket.resoluAt) : '—'}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
