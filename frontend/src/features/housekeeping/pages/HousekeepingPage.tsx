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
import {
  listRooms,
  listHousekeepingTasks,
  assignHousekeepingTask,
  startHousekeepingTask,
  completeHousekeepingTask,
  validateHousekeepingTask,
  refuseHousekeepingTask,
  cancelHousekeepingTask,
  reopenHousekeepingTask,
  createHousekeepingTask,
} from '../api';
import { RoomHistoryDialog } from '../components/RoomHistoryDialog';
import { HousekeepingTaskRow } from '../components/HousekeepingTaskRow';
import { HousekeepingAssignmentDialog } from '../components/HousekeepingAssignmentDialog';
import { HousekeepingReasonDialog } from '../components/HousekeepingReasonDialog';
import { HousekeepingTaskCreateDialog } from '../components/HousekeepingTaskCreateDialog';
import { HousekeepingTaskHistoryDialog } from '../components/HousekeepingTaskHistoryDialog';
import type { Room, StatutChambre } from '../../reservations/types';
import type { HousekeepingTask } from '../types';

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

const STATUT_DOT_CLASS: Record<StatutChambre, string> = {
  LIBRE_PROPRE: 'bg-success',
  RESERVEE: 'bg-info',
  OCCUPEE: 'bg-destructive',
  DEPART_PREVU: 'bg-info',
  A_NETTOYER: 'bg-warning',
  EN_NETTOYAGE: 'bg-violet',
  EN_MAINTENANCE: 'bg-destructive',
};

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

export function HousekeepingPage({
  permissions,
}: {
  permissions?: string[] | null;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);

  const [roomsLoading, setRoomsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [roomsLoadError, setRoomsLoadError] = useState<string | null>(null);
  const [tasksLoadError, setTasksLoadError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const [historyRoom, setHistoryRoom] = useState<Room | null>(null);

  const [statutFilter, setStatutFilter] = useState<
    StatutChambre | typeof ALL_STATUSES
  >(ALL_STATUSES);
  const [floorFilter, setFloorFilter] = useState(ALL_FLOORS);
  const [roomSearch, setRoomSearch] = useState('');

  const initialRoomsRequestId = useRef<number | null>(null);
  const initialTasksRequestId = useRef<number | null>(null);
  const refreshRequestId = useRef<number | null>(null);
  const requestSequence = useRef(0);

  // Modal states
  const [createRoom, setCreateRoom] = useState<Room | null>(null);
  const [assignTask, setAssignTask] = useState<HousekeepingTask | null>(null);
  const [reasonTask, setReasonTask] = useState<{
    task: HousekeepingTask;
    action: 'validate' | 'refuse' | 'cancel' | 'reopen';
  } | null>(null);
  const [historyTask, setHistoryTask] = useState<HousekeepingTask | null>(null);

  const hasRead = permissions?.includes('housekeeping:read');
  const hasWrite = permissions?.includes('housekeeping:write');

  const loadData = useCallback(
    async (mode: LoadMode) => {
      const requestId = ++requestSequence.current;

      if (mode === 'initial') {
        initialRoomsRequestId.current = requestId;
        initialTasksRequestId.current = requestId;
        setRoomsLoading(true);
        if (hasRead) setTasksLoading(true);
        setRoomsLoadError(null);
        setTasksLoadError(null);
      } else if (mode === 'refresh' || mode === 'status-update') {
        refreshRequestId.current = requestId;
        if (mode === 'refresh') {
          setRefreshing(true);
          setRefreshError(null);
        }
      }

      const roomsPromise = listRooms()
        .then((res) => {
          if (requestId === requestSequence.current) {
            setRooms(res);
          }
        })
        .catch((err) => {
          if (requestId === requestSequence.current) {
            const msg =
              err instanceof Error
                ? err.message
                : 'Erreur de chargement des chambres';
            if (mode === 'initial') setRoomsLoadError(msg);
            else if (mode === 'refresh') throw new Error(`Chambres: ${msg}`);
          }
        })
        .finally(() => {
          if (requestId === requestSequence.current && mode === 'initial') {
            setRoomsLoading(false);
            initialRoomsRequestId.current = null;
          }
        });

      let tasksPromise = Promise.resolve();
      if (hasRead) {
        tasksPromise = listHousekeepingTasks({ active: true, limit: 100 })
          .then((res) => {
            if (requestId === requestSequence.current) {
              setTasks(res.data);
            }
          })
          .catch((err) => {
            if (requestId === requestSequence.current) {
              const msg =
                err instanceof Error
                  ? err.message
                  : 'Erreur de chargement des tâches';
              if (mode === 'initial') setTasksLoadError(msg);
              else if (mode === 'refresh') throw new Error(`Tâches: ${msg}`);
            }
          })
          .finally(() => {
            if (requestId === requestSequence.current && mode === 'initial') {
              setTasksLoading(false);
              initialTasksRequestId.current = null;
            }
          });
      } else {
        if (mode === 'initial') setTasksLoading(false);
      }

      try {
        await Promise.all([roomsPromise, tasksPromise]);
        if (requestId === requestSequence.current) {
          setLastUpdatedAt(new Date());
        }
      } catch (err) {
        if (requestId === requestSequence.current && mode === 'refresh') {
          setRefreshError(
            err instanceof Error
              ? err.message
              : 'Erreur lors du rafraîchissement',
          );
        }
      } finally {
        if (requestId === requestSequence.current && mode === 'refresh') {
          setRefreshing(false);
          refreshRequestId.current = null;
        }
      }
    },
    [hasRead],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData('initial');
    }, 0);
    return () => {
      requestSequence.current += 1;
      clearTimeout(timer);
    };
  }, [loadData]);

  const taskByRoomId = useMemo(() => {
    const map = new Map<number, HousekeepingTask>();
    for (const t of tasks) map.set(t.roomId, t);
    return map;
  }, [tasks]);

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

  // Actions
  async function performAction(
    taskId: number,
    actionFn: () => Promise<unknown>,
    successCallback?: () => void,
  ) {
    setActionError(null);
    setUpdatingTaskId(taskId);
    try {
      await actionFn();
      if (successCallback) successCallback();
      await loadData('status-update');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setUpdatingTaskId(null);
    }
  }

  const handleStart = (taskId: number) =>
    performAction(taskId, () => startHousekeepingTask(taskId));
  const handleComplete = (taskId: number) =>
    performAction(taskId, () => completeHousekeepingTask(taskId));

  const handleCreateConfirm = (roomId: number, motif: string) => {
    performAction(
      -1,
      () => createHousekeepingTask({ roomId, motif }),
      () => setCreateRoom(null),
    );
  };

  const handleAssignConfirm = (
    taskId: number,
    assignedUserId: number | null,
    motif?: string,
  ) => {
    performAction(
      taskId,
      () => assignHousekeepingTask(taskId, { assignedUserId, motif }),
      () => setAssignTask(null),
    );
  };

  const handleReasonConfirm = (motif: string) => {
    if (!reasonTask) return;
    const { task, action } = reasonTask;
    let actionPromise;
    switch (action) {
      case 'validate':
        actionPromise = validateHousekeepingTask(task.id, { motif });
        break;
      case 'refuse':
        actionPromise = refuseHousekeepingTask(task.id, { motif });
        break;
      case 'cancel':
        actionPromise = cancelHousekeepingTask(task.id, { motif });
        break;
      case 'reopen':
        actionPromise = reopenHousekeepingTask(task.id, { motif });
        break;
    }
    performAction(
      task.id,
      () => actionPromise,
      () => setReasonTask(null),
    );
  };

  const isLoading = roomsLoading || tasksLoading;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {actionError && (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      )}
      {tasksLoadError && (
        <p className="text-destructive text-sm">
          Erreur de chargement des tâches : {tasksLoadError}
        </p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm" role="status">
          Chargement des données…
        </p>
      ) : roomsLoadError ? (
        <ErrorState
          title="Impossible de charger les chambres"
          description={roomsLoadError}
          onRetry={() => void loadData('initial')}
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
                onClick={() => void loadData('refresh')}
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
                onClick={() => void loadData('refresh')}
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
                  {floorRooms.map((room) => {
                    const task = taskByRoomId.get(room.id);

                    if (task) {
                      return (
                        <HousekeepingTaskRow
                          key={room.id}
                          room={room}
                          task={task}
                          permissions={permissions}
                          disabled={
                            updatingTaskId === task.id || updatingTaskId === -1
                          }
                          onShowHistory={() => setHistoryRoom(room)}
                          onAssign={() => setAssignTask(task)}
                          onStart={() => handleStart(task.id)}
                          onComplete={() => handleComplete(task.id)}
                          onValidate={() =>
                            setReasonTask({ task, action: 'validate' })
                          }
                          onRefuse={() =>
                            setReasonTask({ task, action: 'refuse' })
                          }
                          onCancel={() =>
                            setReasonTask({ task, action: 'cancel' })
                          }
                          onReopen={() =>
                            setReasonTask({ task, action: 'reopen' })
                          }
                          onTaskHistory={() => setHistoryTask(task)}
                        />
                      );
                    }

                    return (
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
                          {room.statut === 'A_NETTOYER' && hasWrite ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCreateRoom(room)}
                              disabled={updatingTaskId !== null}
                            >
                              Créer une tâche
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-right text-xs">
                              {NON_MODIFIABLE_MANUELLEMENT[room.statut] || '—'}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
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

      <HousekeepingTaskCreateDialog
        room={createRoom}
        onClose={() => setCreateRoom(null)}
        onConfirm={handleCreateConfirm}
        submitting={updatingTaskId === -1}
      />

      <HousekeepingAssignmentDialog
        task={assignTask}
        onClose={() => setAssignTask(null)}
        onConfirm={handleAssignConfirm}
        submitting={assignTask ? updatingTaskId === assignTask.id : false}
        actionError={actionError}
      />

      <HousekeepingReasonDialog
        open={reasonTask !== null}
        onClose={() => setReasonTask(null)}
        title={
          reasonTask?.action === 'validate'
            ? 'Valider la tâche'
            : reasonTask?.action === 'refuse'
              ? 'Refuser la tâche'
              : reasonTask?.action === 'cancel'
                ? 'Annuler la tâche'
                : 'Réouvrir la tâche'
        }
        confirmLabel={
          reasonTask?.action === 'validate'
            ? 'Valider'
            : reasonTask?.action === 'refuse'
              ? 'Refuser'
              : reasonTask?.action === 'cancel'
                ? 'Annuler'
                : 'Réouvrir'
        }
        submitting={reasonTask ? updatingTaskId === reasonTask.task.id : false}
        onConfirm={handleReasonConfirm}
      />

      <HousekeepingTaskHistoryDialog
        taskId={historyTask?.id ?? null}
        roomNumero={
          historyTask
            ? (rooms.find((r) => r.id === historyTask.roomId)?.numero ?? '')
            : null
        }
        onClose={() => setHistoryTask(null)}
      />
    </div>
  );
}
