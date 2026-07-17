import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listRooms, updateRoomStatus } from '../api';
import type { Room, StatutChambre } from '../../reservations/types';

// Housekeeping simplifié (cahier des charges §5.6, Phase 1) : seuls ces
// trois statuts sont pilotables manuellement — les autres (RESERVEE,
// OCCUPEE, DEPART_PREVU, EN_NETTOYAGE) sont gérés par d'autres modules ou
// arriveront avec la machine à états complète de la Phase 2.
const STATUTS_MANUELS: StatutChambre[] = [
  'LIBRE_PROPRE',
  'A_NETTOYER',
  'EN_MAINTENANCE',
];

const STATUT_LABEL: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'Libre & propre',
  RESERVEE: 'Réservée',
  OCCUPEE: 'Occupée',
  DEPART_PREVU: 'Départ prévu',
  A_NETTOYER: 'À nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  EN_MAINTENANCE: 'En maintenance',
};

const STATUT_BADGE_VARIANT: Record<
  StatutChambre,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  LIBRE_PROPRE: 'default',
  RESERVEE: 'secondary',
  OCCUPEE: 'destructive',
  DEPART_PREVU: 'secondary',
  A_NETTOYER: 'outline',
  EN_NETTOYAGE: 'outline',
  EN_MAINTENANCE: 'destructive',
};

export function HousekeepingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingRoomId, setUpdatingRoomId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRooms(await listRooms());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Chargement au montage, pas de condition de course (un seul fetch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch();
  }, [refetch]);

  async function handleChange(roomId: number, statut: StatutChambre) {
    setActionError(null);
    setUpdatingRoomId(roomId);
    try {
      await updateRoomStatus(roomId, statut);
      await refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Erreur de mise à jour du statut',
      );
    } finally {
      setUpdatingRoomId(null);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h1 className="text-xl font-medium">Housekeeping — chambres</h1>

      {loadError && <p className="text-destructive text-sm">{loadError}</p>}
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between gap-2 rounded-md border p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {room.numero}{' '}
                  <span className="text-muted-foreground text-xs">
                    {room.roomType.nom}
                  </span>
                </p>
                <Badge
                  variant={STATUT_BADGE_VARIANT[room.statut]}
                  className="mt-1"
                >
                  {STATUT_LABEL[room.statut]}
                </Badge>
              </div>

              {room.statut === 'OCCUPEE' ? (
                <p className="text-muted-foreground max-w-32 text-right text-xs">
                  Libérée via le check-out
                </p>
              ) : (
                <Select
                  value={room.statut}
                  onValueChange={(v) =>
                    v && handleChange(room.id, v as StatutChambre)
                  }
                  disabled={updatingRoomId === room.id}
                  items={STATUTS_MANUELS.map((s) => ({
                    value: s,
                    label: STATUT_LABEL[s],
                  }))}
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUTS_MANUELS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUT_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
