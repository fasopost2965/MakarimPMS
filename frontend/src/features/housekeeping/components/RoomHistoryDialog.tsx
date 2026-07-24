import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

  useEffect(() => {
    if (roomId === null) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    setError(null);
    getRoomStatusHistory(roomId)
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  return (
    <Dialog open={roomId !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Historique des statuts — chambre {roomNumero}
          </DialogTitle>
        </DialogHeader>
        {loading && (
          <p className="text-muted-foreground text-sm">Chargement…</p>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Aucun changement de statut enregistré.
          </p>
        )}
        {entries.length > 0 && (
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-md border p-2 text-sm">
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
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
