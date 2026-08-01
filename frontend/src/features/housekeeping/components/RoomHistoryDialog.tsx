import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { getRoomStatusHistory } from '../api';
import type { RoomStatusLogEntry } from '../types';
import type { StatutChambre } from '../../reservations/types';

const STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'Libre & propre',
  RESERVEE: 'Réservée',
  OCCUPEE: 'Occupée',
  DEPART_PREVU: 'Départ prévu',
  A_NETTOYER: 'À nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  EN_MAINTENANCE: 'En maintenance',
};

interface Props {
  roomId: number | null;
  roomNumero: string | null;
  onClose: () => void;
}

// CH-014 — consultation de RoomStatusLog (peuplée à chaque transition,
// jamais lue par aucune route avant ce chantier). Purement informatif,
// aucune action possible depuis cette modale.
export function RoomHistoryDialog({ roomId, roomNumero, onClose }: Props) {
  const [entries, setEntries] = useState<RoomStatusLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadHistory = useCallback(async () => {
    if (roomId === null) return;

    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getRoomStatusHistory(roomId);
      if (requestId === requestSequence.current) {
        setEntries(
          [...data].sort((left, right) => {
            const byDate =
              new Date(right.createdAt).getTime() -
              new Date(left.createdAt).getTime();
            return byDate || right.id - left.id;
          }),
        );
      }
    } catch (err) {
      if (requestId === requestSequence.current) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (roomId === null) {
      requestSequence.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntries([]);
      setError(null);
      setLoading(false);
      return;
    }

    setEntries([]);
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
      onOpenChange={(next) => !next && handleClose()}
    >
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Historique des statuts — chambre {roomNumero}
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
        {!loading && !error && entries.length === 0 && (
          <EmptyState
            title={`Aucun historique pour la chambre ${roomNumero ?? '—'}`}
            description="Aucun changement de statut n’est enregistré pour cette chambre."
          />
        )}
        {!loading && !error && entries.length > 0 && (
          <ol
            className="grid gap-2"
            aria-label="Chronologie des statuts de la chambre"
          >
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-md border p-3 text-sm">
                <p>
                  {STATUT_LABEL[entry.ancienStatut]} →{' '}
                  <span className="font-medium">
                    {STATUT_LABEL[entry.nouveauStatut]}
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(entry.createdAt).toLocaleString('fr-FR')}
                  {entry.motif ? ` — ${entry.motif}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
