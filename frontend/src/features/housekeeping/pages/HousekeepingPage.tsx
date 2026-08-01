import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
const CHIP_STATUTS = [
  'A_NETTOYER',
  'EN_NETTOYAGE',
  'LIBRE_PROPRE',
  'EN_MAINTENANCE',
] as const satisfies readonly StatutChambre[];

const CHIP_LABEL: Record<(typeof CHIP_STATUTS)[number], string> = {
  A_NETTOYER: 'Total à nettoyer',
  EN_NETTOYAGE: 'En nettoyage',
  LIBRE_PROPRE: 'Propres',
  EN_MAINTENANCE: 'En maintenance',
};

const ALL_STATUSES = 'ALL';
const ALL_FLOORS = 'ALL';
const NO_FLOOR = 'NO_FLOOR';

type LoadMode = 'initial' | 'refresh' | 'status-update';

function floorLabel(etage: number | null) {
  return etage === null ? 'Sans étage renseigné' : `Étage ${etage}`;
}

export function HousekeepingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [updatingRoomId, setUpdatingRoomId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyRoom, setHistoryRoom] = useState<Room | null>(null);
  const [statutFilter, setStatutFilter] = useState<
    StatutChambre | typeof ALL_STATUSES
  >(ALL_STATUSES);
  const [floorFilter, setFloorFilter] = useState(ALL_FLOORS);
  const [roomSearch, setRoomSearch] = useState('');
  const requestSequence = useRef(0);
  const initialRequestId = useRef<number | null>(null);
  const refreshRequestId = useRef<number | null>(null);

  const loadRooms = useCallback(async (mode: LoadMode) => {
    const requestId = ++requestSequence.current;
    if (mode === 'initial') {
      initialRequestId.current = requestId;
      setLoading(true);
      setLoadError(null);
    } else if (mode === 'refresh') {
      refreshRequestId.current = requestId;
      setRefreshing(true);
      setRefreshError(null);
    }

    try {
      const nextRooms = await listRooms();
      if (requestId !== requestSequence.current) return false;

      setRooms(nextRooms);
      setLastUpdatedAt(new Date());
      return true;
    } catch (err) {
      if (requestId !== requestSequence.current) return false;

      const message =
        err instanceof Error ? err.message : 'Erreur de chargement';
      if (mode === 'initial') setLoadError(message);
      else if (mode === 'refresh') setRefreshError(message);
      else throw err;
      return false;
    } finally {
      if (initialRequestId.current === requestId) {
        initialRequestId.current = null;
        setLoading(false);
      }
      if (refreshRequestId.current === requestId) {
        refreshRequestId.current = null;
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRooms('initial');

    return () => {
      requestSequence.current += 1;
      initialRequestId.current = null;
      refreshRequestId.current = null;
    };
  }, [loadRooms]);

  async function handleChange(roomId: number, statut: StatutChambre) {
    setActionError(null);
    setUpdatingRoomId(roomId);
    try {
      await updateRoomStatus(roomId, statut);
      await loadRooms('status-update');
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

  const availableFloors = useMemo(
    () =>
      [...new Set(rooms.map((room) => room.etage ?? null))].sort(
        (a, b) => (a ?? Infinity) - (b ?? Infinity),
      ),
    [rooms],
  );

  const filteredRooms = useMemo(() => {
    const normalizedSearch = roomSearch.trim().toLocaleLowerCase('fr-FR');

    return rooms.filter((room) => {
      const matchesStatus =
        statutFilter === ALL_STATUSES || room.statut === statutFilter;
      const matchesFloor =
        floorFilter === ALL_FLOORS ||
        (floorFilter === NO_FLOOR
          ? room.etage === null || room.etage === undefined
          : room.etage === Number(floorFilter));
      const matchesSearch =
        normalizedSearch.length === 0 ||
        room.numero.toLocaleLowerCase('fr-FR').includes(normalizedSearch);

      return matchesStatus && matchesFloor && matchesSearch;
    });
  }, [floorFilter, roomSearch, rooms, statutFilter]);

  const groupedByFloor = useMemo(() => {
    const map = new Map<number | null, Room[]>();
    for (const room of filteredRooms) {
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
  }, [filteredRooms]);

  const filtersActive =
    statutFilter !== ALL_STATUSES ||
    floorFilter !== ALL_FLOORS ||
    roomSearch.trim().length > 0;

  function resetFilters() {
    setStatutFilter(ALL_STATUSES);
    setFloorFilter(ALL_FLOORS);
    setRoomSearch('');
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {actionError && <p className="text-destructive text-sm">{actionError}</p>}

      {loading ? (
        <p className="text-muted-foreground text-sm" role="status">
          Chargement des chambres…
        </p>
      ) : loadError ? (
        <ErrorState
          title="Impossible de charger les chambres"
          description={loadError}
          onRetry={() => void loadRooms('initial')}
        />
      ) : (
        <>
          <div
            className="grid grid-cols-2 gap-2 lg:grid-cols-4"
            aria-label="Indicateurs housekeeping"
          >
            {CHIP_STATUTS.map((statut) => {
              return (
                <div
                  key={statut}
                  className="bg-card flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs"
                  aria-label={`${CHIP_LABEL[statut]} : ${chipCounts.get(statut) ?? 0}`}
                >
                  <span
                    className={`size-2 rounded-full ${STATUT_DOT_CLASS[statut]}`}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-bold">
                    {chipCounts.get(statut) ?? 0}
                  </span>
                  <span className="text-muted-foreground">
                    {CHIP_LABEL[statut]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="bg-card grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_auto] lg:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="housekeeping-status-filter">Statut</Label>
              <Select
                value={statutFilter}
                onValueChange={(value) =>
                  value &&
                  setStatutFilter(value as StatutChambre | typeof ALL_STATUSES)
                }
                items={[
                  { value: ALL_STATUSES, label: 'Tous les statuts' },
                  ...Object.entries(STATUT_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              >
                <SelectTrigger id="housekeeping-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUSES}>Tous les statuts</SelectItem>
                  {Object.entries(STATUT_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="housekeeping-floor-filter">Étage</Label>
              <Select
                value={floorFilter}
                onValueChange={(value) => value && setFloorFilter(value)}
                items={[
                  { value: ALL_FLOORS, label: 'Tous les étages' },
                  ...availableFloors.map((floor) => ({
                    value: floor === null ? NO_FLOOR : String(floor),
                    label: floorLabel(floor),
                  })),
                ]}
              >
                <SelectTrigger id="housekeeping-floor-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FLOORS}>Tous les étages</SelectItem>
                  {availableFloors.map((floor) => (
                    <SelectItem
                      key={floor ?? NO_FLOOR}
                      value={floor === null ? NO_FLOOR : String(floor)}
                    >
                      {floorLabel(floor)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="housekeeping-room-search">
                Numéro de chambre
              </Label>
              <Input
                id="housekeeping-room-search"
                type="search"
                value={roomSearch}
                onChange={(event) => setRoomSearch(event.target.value)}
                placeholder="Rechercher une chambre"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              disabled={!filtersActive}
            >
              Réinitialiser
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {filteredRooms.length}{' '}
              {filteredRooms.length > 1 ? 'chambres' : 'chambre'} sur{' '}
              {rooms.length}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <p className="text-muted-foreground text-xs" aria-live="polite">
                {lastUpdatedAt
                  ? `Dernière mise à jour réussie : ${lastUpdatedAt.toLocaleString(
                      'fr-FR',
                      {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      },
                    )}`
                  : 'Aucune mise à jour réussie'}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadRooms('refresh')}
                disabled={refreshing}
              >
                {refreshing ? 'Actualisation…' : 'Actualiser'}
              </Button>
            </div>
          </div>

          {refreshError && (
            <div
              className="border-destructive/40 bg-destructive/5 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              role="alert"
            >
              <p className="text-destructive text-sm">
                Échec de l’actualisation : {refreshError}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadRooms('refresh')}
                disabled={refreshing}
              >
                Réessayer l’actualisation
              </Button>
            </div>
          )}

          {rooms.length === 0 ? (
            <EmptyState
              title="Aucune chambre disponible"
              description="Aucune chambre n’est actuellement disponible dans la liste housekeeping."
            />
          ) : groupedByFloor.length === 0 ? (
            <EmptyState
              title="Aucune chambre ne correspond aux filtres"
              description="Modifiez vos critères ou réinitialisez les filtres pour afficher les chambres."
              action={{
                label: 'Réinitialiser les filtres',
                onClick: resetFilters,
              }}
            />
          ) : (
            <div className="bg-card overflow-hidden rounded-lg border">
              <div className="bg-muted/60 text-muted-foreground hidden grid-cols-[80px_1fr_170px_150px] gap-2 border-b px-4 py-2 text-[11px] font-bold tracking-wide uppercase md:grid">
                <span>Chambre</span>
                <span>Type</span>
                <span>Statut</span>
                <span className="text-right">Action</span>
              </div>

              {groupedByFloor.map(({ etage, rooms: floorRooms }) => (
                <div key={etage ?? 'sans-etage'}>
                  <div className="bg-muted/30 text-primary border-b px-4 py-1.5 text-[11px] font-bold tracking-wide uppercase">
                    {floorLabel(etage)}
                  </div>
                  {floorRooms.map((room) => (
                    <div
                      key={room.id}
                      className="hover:bg-muted/40 grid grid-cols-[minmax(0,1fr)_minmax(130px,auto)] items-center gap-2 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[80px_1fr_170px_150px] md:py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => setHistoryRoom(room)}
                        className="focus-visible:ring-ring rounded text-left font-bold outline-none hover:underline focus-visible:ring-2"
                        aria-label={`Voir l’historique de la chambre ${room.numero}`}
                      >
                        {room.numero}
                      </button>
                      <span className="text-muted-foreground col-start-1 row-start-2 text-xs md:col-start-2 md:row-start-1">
                        {room.roomType.nom}
                      </span>
                      <span className="col-start-1 row-start-3 md:col-start-3 md:row-start-1">
                        <Badge variant={STATUT_BADGE_VARIANT[room.statut]}>
                          {STATUT_LABEL[room.statut]}
                        </Badge>
                      </span>
                      <span className="col-start-2 row-span-3 row-start-1 flex justify-end md:col-start-4 md:row-span-1">
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
                            <SelectTrigger
                              size="sm"
                              className="h-7 text-xs"
                              aria-label={`Changer le statut de la chambre ${room.numero}`}
                            >
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
          )}
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
