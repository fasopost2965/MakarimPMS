import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listRooms, updateRoomStatus } from '../api';
import { RoomHistoryDialog } from '../components/RoomHistoryDialog';
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
  RESERVEE: 'Occupée au check-in',
  OCCUPEE: 'Libérée au check-out',
  DEPART_PREVU: 'Libérée au check-out',
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

// CH-063 (docs/design/design_handoff_exploitation_hotel) — le token violet
// distingue désormais EN_NETTOYAGE (en cours) de A_NETTOYER (warning, en
// attente), deux statuts manuels adjacents jusqu'ici tous deux en warning.
const STATUT_BADGE_VARIANT: Record<
  StatutChambre,
  'success' | 'info' | 'destructive' | 'warning' | 'violet'
> = {
  LIBRE_PROPRE: 'success',
  RESERVEE: 'info',
  OCCUPEE: 'destructive',
  DEPART_PREVU: 'info',
  A_NETTOYER: 'warning',
  EN_NETTOYAGE: 'violet',
  EN_MAINTENANCE: 'destructive',
};

// Puce (point coloré) des chips de stats — même mapping sémantique que les
// badges, en couleur pleine plutôt qu'en teinte 10 %.
const STATUT_DOT_CLASS: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'bg-success',
  RESERVEE: 'bg-info',
  OCCUPEE: 'bg-destructive',
  DEPART_PREVU: 'bg-info',
  A_NETTOYER: 'bg-warning',
  EN_NETTOYAGE: 'bg-violet',
  EN_MAINTENANCE: 'bg-destructive',
};

// Les 4 statuts pilotables manuellement, seuls repris en chips de stats
// (cohérent avec le mockup — Réservée/Occupée/Départ prévu ne sont que des
// reflets du planning, pas une charge de travail ménage à suivre ici).
const CHIP_STATUTS: StatutChambre[] = [
  'LIBRE_PROPRE',
  'A_NETTOYER',
  'EN_NETTOYAGE',
  'EN_MAINTENANCE',
];

function floorLabel(etage: number | null) {
  return etage === null ? 'Sans étage renseigné' : `Étage ${etage}`;
}

export function HousekeepingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingRoomId, setUpdatingRoomId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyRoom, setHistoryRoom] = useState<Room | null>(null);
  const [statutFilter, setStatutFilter] = useState<StatutChambre | null>(null);

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

  const chipCounts = useMemo(() => {
    const counts = new Map<StatutChambre, number>();
    for (const room of rooms) {
      counts.set(room.statut, (counts.get(room.statut) ?? 0) + 1);
    }
    return counts;
  }, [rooms]);

  const groupedByFloor = useMemo(() => {
    const filtered = statutFilter
      ? rooms.filter((r) => r.statut === statutFilter)
      : rooms;
    const map = new Map<number | null, Room[]>();
    for (const room of filtered) {
      const key = room.etage ?? null;
      const bucket = map.get(key);
      if (bucket) bucket.push(room);
      else map.set(key, [room]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
      .map(([etage, list]) => ({
        etage,
        rooms: list
          .slice()
          .sort((a, b) =>
            a.numero.localeCompare(b.numero, undefined, { numeric: true }),
          ),
      }));
  }, [rooms, statutFilter]);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {loadError && <p className="text-destructive text-sm">{loadError}</p>}
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {CHIP_STATUTS.map((statut) => {
              const active = statutFilter === statut;
              return (
                <button
                  key={statut}
                  type="button"
                  onClick={() =>
                    setStatutFilter((current) =>
                      current === statut ? null : statut,
                    )
                  }
                  className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs transition-colors ${
                    active
                      ? 'border-primary bg-primary/10'
                      : 'bg-card hover:bg-muted/50'
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${STATUT_DOT_CLASS[statut]}`}
                  />
                  <span className="text-sm font-bold">
                    {chipCounts.get(statut) ?? 0}
                  </span>
                  <span className="text-muted-foreground">
                    {STATUT_LABEL[statut]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="bg-card overflow-hidden rounded-lg border">
            <div className="bg-muted/60 text-muted-foreground grid grid-cols-[80px_1fr_170px_150px] gap-2 border-b px-4 py-2 text-[11px] font-bold tracking-wide uppercase">
              <span>Chambre</span>
              <span>Type</span>
              <span>Statut</span>
              <span className="text-right">Action</span>
            </div>

            {groupedByFloor.length === 0 && (
              <p className="text-muted-foreground p-4 text-sm">
                Aucune chambre pour ce filtre.
              </p>
            )}

            {groupedByFloor.map(({ etage, rooms: floorRooms }) => (
              <div key={etage ?? 'sans-etage'}>
                <div className="bg-muted/30 text-primary border-b px-4 py-1.5 text-[11px] font-bold tracking-wide uppercase">
                  {floorLabel(etage)}
                </div>
                {floorRooms.map((room) => (
                  <div
                    key={room.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setHistoryRoom(room)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setHistoryRoom(room);
                    }}
                    className="hover:bg-muted/40 grid cursor-pointer grid-cols-[80px_1fr_170px_150px] items-center gap-2 border-b px-4 py-2.5 text-sm last:border-b-0"
                  >
                    <span className="font-bold">{room.numero}</span>
                    <span className="text-muted-foreground text-xs">
                      {room.roomType.nom}
                    </span>
                    <span>
                      <Badge variant={STATUT_BADGE_VARIANT[room.statut]}>
                        {STATUT_LABEL[room.statut]}
                      </Badge>
                    </span>
                    {/* Empêche l'ouverture de l'historique quand on
                        manipule le select/action — pas un contrôle en
                        lui-même, le Select qu'il contient gère déjà son
                        propre clavier. */}
                    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
                    <span
                      className="flex justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {NON_MODIFIABLE_MANUELLEMENT[room.statut] ? (
                        <span className="text-muted-foreground text-right text-xs">
                          {NON_MODIFIABLE_MANUELLEMENT[room.statut]}
                        </span>
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
                          <SelectTrigger size="sm" className="h-7 text-xs">
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
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <RoomHistoryDialog
        roomId={historyRoom?.id ?? null}
        roomNumero={historyRoom?.numero ?? null}
        onClose={() => setHistoryRoom(null)}
      />
    </div>
  );
}
