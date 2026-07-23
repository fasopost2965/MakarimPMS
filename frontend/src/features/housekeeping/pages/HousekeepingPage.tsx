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

// Machine à états complète (cahier des charges §5.6, Phase 2) : ces quatre
// statuts sont pilotables manuellement. RESERVEE, OCCUPEE et DEPART_PREVU
// sont exclusivement pilotés par le système (réservation du jour, check-in,
// check-out — voir HousekeepingService côté backend) — jamais par un choix
// manuel ici.
const STATUTS_MANUELS: StatutChambre[] = [
  'A_NETTOYER',
  'EN_NETTOYAGE',
  'LIBRE_PROPRE',
  'EN_MAINTENANCE',
];

// Texte explicatif affiché à la place du sélecteur pour les statuts pilotés
// par le système (pas de changement manuel possible).
const NON_MODIFIABLE_MANUELLEMENT: Partial<Record<StatutChambre, string>> = {
  RESERVEE: 'Passera en Occupée au check-in',
  OCCUPEE: 'Libérée via le check-out',
  DEPART_PREVU: 'Libérée via le check-out',
};

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
  'success' | 'info' | 'destructive' | 'warning'
> = {
  LIBRE_PROPRE: 'success',
  RESERVEE: 'info',
  OCCUPEE: 'destructive',
  DEPART_PREVU: 'info',
  A_NETTOYER: 'warning',
  EN_NETTOYAGE: 'warning',
  EN_MAINTENANCE: 'destructive',
};

// Liseré de couleur sémantique par statut, cohérent avec les puces du
// mockup de direction visuelle (libre=succès, occupée/maintenance=danger,
// réservée/départ prévu=info, à nettoyer=alerte).
const STATUT_BORDER_CLASS: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'border-l-success',
  RESERVEE: 'border-l-info',
  OCCUPEE: 'border-l-destructive',
  DEPART_PREVU: 'border-l-info',
  A_NETTOYER: 'border-l-warning',
  EN_NETTOYAGE: 'border-l-warning',
  EN_MAINTENANCE: 'border-l-destructive',
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
      {loadError && <p className="text-destructive text-sm">{loadError}</p>}
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`bg-card flex items-center justify-between gap-2 rounded-md border border-l-4 p-3 ${STATUT_BORDER_CLASS[room.statut]}`}
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

              {NON_MODIFIABLE_MANUELLEMENT[room.statut] ? (
                <p className="text-muted-foreground max-w-32 text-right text-xs">
                  {NON_MODIFIABLE_MANUELLEMENT[room.statut]}
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
