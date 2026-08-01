import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { getTicket } from '../api';
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

interface MaintenanceTicketDetailDialogProps {
  ticketId: number | null;
  onClose: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR');
}

export function MaintenanceTicketDetailDialog({
  ticketId,
  onClose,
}: MaintenanceTicketDetailDialogProps) {
  const [ticket, setTicket] = useState<MaintenanceTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadTicket = useCallback(async () => {
    if (ticketId === null) return;

    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getTicket(ticketId);
      if (requestId === requestSequence.current) setTicket(data);
    } catch (err) {
      if (requestId === requestSequence.current) {
        setError(
          err instanceof Error ? err.message : 'Erreur de chargement du ticket',
        );
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (ticketId === null) {
      requestSequence.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTicket(null);
      setError(null);
      setLoading(false);
      return;
    }

    setTicket(null);
    void loadTicket();
  }, [loadTicket, ticketId]);

  return (
    <Dialog
      open={ticketId !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Détail du ticket #{ticketId}</DialogTitle>
        </DialogHeader>

        {loading && (
          <p className="text-muted-foreground text-sm" role="status">
            Chargement du ticket…
          </p>
        )}

        {!loading && error && (
          <ErrorState
            title="Impossible de charger le détail"
            description={error}
            onRetry={() => void loadTicket()}
          />
        )}

        {!loading && !error && ticket && (
          <div className="grid gap-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">Identifiant</dt>
                <dd className="font-medium">#{ticket.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Localisation</dt>
                <dd className="font-medium">
                  {ticket.room
                    ? `Chambre ${ticket.room.numero}`
                    : 'Zone commune'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs">Type de panne</dt>
                <dd className="font-medium">{ticket.typePanne}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Priorité</dt>
                <dd className="mt-1">
                  <Badge variant={PRIORITE_BADGE_VARIANT[ticket.priorite]}>
                    {PRIORITE_LABEL[ticket.priorite]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Statut</dt>
                <dd className="mt-1">
                  <Badge variant={ticket.resoluAt ? 'success' : 'info'}>
                    {ticket.resoluAt ? 'Résolu' : 'Ouvert'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Assigné à</dt>
                <dd className="font-medium">{ticket.assigneA ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Créé le</dt>
                <dd className="font-medium">{formatDate(ticket.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Résolu le</dt>
                <dd className="font-medium">
                  {ticket.resoluAt ? formatDate(ticket.resoluAt) : '—'}
                </dd>
              </div>
            </dl>

            {ticket.photoUrl && (
              <div className="grid gap-1.5">
                <p className="text-muted-foreground text-xs">Photo</p>
                <img
                  src={ticket.photoUrl}
                  alt={`Pièce jointe du ticket ${ticket.id}`}
                  className="max-h-80 max-w-full rounded-md object-contain"
                />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
