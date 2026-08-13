import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
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
  reportIncident,
} from '../api';
import { listTickets } from '../../maintenance/api';
import { RoomContextModal } from '../../dashboard/components/RoomContextModal';
import { HousekeepingKpiStrip } from '../components/HousekeepingKpiStrip';
import { HousekeepingControlQueue } from '../components/HousekeepingControlQueue';
import {
  HousekeepingToolbar,
  ALL_FILTER,
  NO_FLOOR_FILTER,
  type HousekeepingViewMode,
} from '../components/HousekeepingToolbar';
import { HousekeepingRoomsView } from '../components/HousekeepingRoomsView';
import { HousekeepingTasksView } from '../components/HousekeepingTasksView';
import { HousekeepingAssignmentDialog } from '../components/HousekeepingAssignmentDialog';
import { HousekeepingReasonDialog } from '../components/HousekeepingReasonDialog';
import { HousekeepingTaskCreateDialog } from '../components/HousekeepingTaskCreateDialog';
import { HousekeepingTaskHistoryDialog } from '../components/HousekeepingTaskHistoryDialog';
import { HousekeepingIncidentDialog } from '../components/HousekeepingIncidentDialog';
import type { Room } from '../../reservations/types';
import type { MaintenanceTicket } from '../../maintenance/types';
import type { HousekeepingTask } from '../types';

type LoadMode = 'initial' | 'refresh' | 'status-update';

export function HousekeepingPage({
  permissions,
}: {
  permissions?: string[] | null;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<
    MaintenanceTicket[]
  >([]);

  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsLoadError, setRoomsLoadError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const [view, setView] = useState<HousekeepingViewMode>('chambres');
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState(ALL_FILTER);
  const [agentFilter, setAgentFilter] = useState(ALL_FILTER);
  const [statutFilter, setStatutFilter] = useState(ALL_FILTER);

  const requestSequence = useRef(0);

  // Modales
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [createRoom, setCreateRoom] = useState<Room | null>(null);
  const [assignTask, setAssignTask] = useState<HousekeepingTask | null>(null);
  const [reasonTask, setReasonTask] = useState<{
    task: HousekeepingTask;
    action: 'validate' | 'refuse' | 'cancel' | 'reopen';
  } | null>(null);
  const [historyTask, setHistoryTask] = useState<HousekeepingTask | null>(null);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentError, setIncidentError] = useState<string | null>(null);

  const hasRead = permissions?.includes('housekeeping:read');
  const hasWrite = permissions?.includes('housekeeping:write') ?? false;
  const hasReportIncident =
    permissions?.includes('housekeeping:report-incident') ?? false;
  const hasMaintenanceRead = permissions?.includes('maintenance:read');

  const loadData = useCallback(
    async (mode: LoadMode) => {
      const requestId = ++requestSequence.current;

      if (mode === 'initial') {
        setRoomsLoading(true);
        setRoomsLoadError(null);
      } else if (mode === 'refresh') {
        setRefreshing(true);
        setRefreshError(null);
      }

      const roomsPromise = listRooms()
        .then((res) => {
          if (requestId === requestSequence.current) setRooms(res);
        })
        .catch((err) => {
          if (requestId === requestSequence.current) {
            const msg =
              err instanceof Error
                ? err.message
                : 'Erreur de chargement des chambres';
            if (mode === 'initial') setRoomsLoadError(msg);
            else throw new Error(`Chambres: ${msg}`);
          }
        });

      const tasksPromise = hasRead
        ? listHousekeepingTasks({ active: true, limit: 100 })
            .then((res) => {
              if (requestId === requestSequence.current) setTasks(res.data);
            })
            .catch((err) => {
              if (requestId === requestSequence.current) {
                const msg =
                  err instanceof Error
                    ? err.message
                    : 'Erreur de chargement des tâches';
                if (mode !== 'initial') throw new Error(`Tâches: ${msg}`);
              }
            })
        : Promise.resolve();

      const maintenancePromise = hasMaintenanceRead
        ? listTickets({ ouvert: true })
            .then((res) => {
              if (requestId === requestSequence.current)
                setMaintenanceTickets(res);
            })
            .catch(() => {
              // Consultatif uniquement (mission : jamais d'erreur bloquante
              // si maintenance:read est absente ou en échec) — le badge
              // « Bloquant » disparaît simplement.
            })
        : Promise.resolve();

      try {
        await Promise.all([roomsPromise, tasksPromise, maintenancePromise]);
        if (requestId === requestSequence.current) setLastUpdatedAt(new Date());
      } catch (err) {
        if (requestId === requestSequence.current && mode === 'refresh') {
          setRefreshError(
            err instanceof Error
              ? err.message
              : 'Erreur lors du rafraîchissement',
          );
        }
      } finally {
        if (requestId === requestSequence.current) {
          if (mode === 'initial') setRoomsLoading(false);
          if (mode === 'refresh') setRefreshing(false);
        }
      }
    },
    [hasRead, hasMaintenanceRead],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData('initial');
    }, 0);
    return () => {
      requestSequence.current += 1;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const taskByRoomId = useMemo(() => {
    const map = new Map<number, HousekeepingTask>();
    for (const t of tasks) {
      if (t.activeRoomKey !== null) map.set(t.roomId, t);
    }
    return map;
  }, [tasks]);

  const maintenanceByRoomId = useMemo(() => {
    const map = new Map<number, MaintenanceTicket>();
    for (const ticket of maintenanceTickets) {
      if (ticket.roomId !== null && ticket.bloqueVente) {
        map.set(ticket.roomId, ticket);
      }
    }
    return map;
  }, [maintenanceTickets]);

  const floors = useMemo(
    () =>
      [...new Set(rooms.map((r) => r.etage ?? null))].sort(
        (a, b) => (a ?? Infinity) - (b ?? Infinity),
      ),
    [rooms],
  );

  const agents = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of tasks) {
      if (t.assignedUser) map.set(t.assignedUser.id, t.assignedUser.nom);
    }
    return [...map.entries()];
  }, [tasks]);

  const matchesFloor = useCallback(
    (etage: number | null | undefined) => {
      if (floorFilter === ALL_FILTER) return true;
      if (floorFilter === NO_FLOOR_FILTER) {
        return etage === null || etage === undefined;
      }
      return String(etage ?? '') === floorFilter;
    },
    [floorFilter],
  );

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('fr-FR');
    return rooms.filter((room) => {
      const matchesSearch =
        q.length === 0 || room.numero.toLocaleLowerCase('fr-FR').includes(q);
      const task = taskByRoomId.get(room.id);
      const matchesAgent =
        agentFilter === ALL_FILTER ||
        (task?.assignedUser && String(task.assignedUser.id) === agentFilter);
      const matchesStatut =
        statutFilter === ALL_FILTER || room.statut === statutFilter;
      return (
        matchesSearch &&
        matchesFloor(room.etage) &&
        matchesAgent &&
        matchesStatut
      );
    });
  }, [search, agentFilter, statutFilter, rooms, taskByRoomId, matchesFloor]);

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

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('fr-FR');
    return tasks
      .filter((t) => {
        const matchesSearch =
          q.length === 0 ||
          t.room.numero.toLocaleLowerCase('fr-FR').includes(q);
        const matchesAgent =
          agentFilter === ALL_FILTER ||
          (t.assignedUser && String(t.assignedUser.id) === agentFilter);
        const matchesStatut =
          statutFilter === ALL_FILTER || t.room.statut === statutFilter;
        return (
          matchesSearch &&
          matchesFloor(t.room.etage) &&
          matchesAgent &&
          matchesStatut
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [search, agentFilter, statutFilter, tasks, matchesFloor]);

  const controlQueue = useMemo(
    () => tasks.filter((t) => t.statut === 'TERMINEE'),
    [tasks],
  );

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

  const handleStart = (task: HousekeepingTask) =>
    performAction(task.id, () => startHousekeepingTask(task.id));
  const handleComplete = (task: HousekeepingTask) =>
    performAction(task.id, () => completeHousekeepingTask(task.id));

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
    let actionPromise: Promise<unknown>;
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

  async function handleIncidentConfirm(input: {
    roomId: number;
    typePanne: string;
    priorite?: MaintenanceTicket['priorite'];
  }) {
    setIncidentError(null);
    setIncidentSubmitting(true);
    try {
      await reportIncident(input);
      setIncidentDialogOpen(false);
      await loadData('status-update');
    } catch (err) {
      setIncidentError(
        err instanceof Error ? err.message : 'Erreur inattendue',
      );
    } finally {
      setIncidentSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <p className="text-muted-foreground text-[11px] font-bold tracking-[0.03em] uppercase">
            Exploitation hôtel
          </p>
          <h1 className="truncate text-xl font-extrabold tracking-[-0.01em]">
            Housekeeping
          </h1>
          <p className="text-muted-foreground text-xs first-letter:uppercase">
            ·{' '}
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lastUpdatedAt && (
            <p className="text-muted-foreground text-xs" aria-live="polite">
              Dernière mise à jour réussie :{' '}
              {lastUpdatedAt.toLocaleString('fr-FR', {
                dateStyle: 'short',
                timeStyle: 'medium',
              })}
            </p>
          )}
          {hasReportIncident && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIncidentDialogOpen(true)}
            >
              Signaler un incident
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => void loadData('refresh')}
            disabled={refreshing}
          >
            <RefreshCw className="size-4" />
            {refreshing ? 'Actualisation…' : 'Actualiser'}
          </Button>
        </div>
      </div>

      {actionError && (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      )}
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

      {roomsLoading ? (
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
          <HousekeepingKpiStrip rooms={rooms} tasks={tasks} />

          {hasRead && (
            <HousekeepingControlQueue
              tasks={controlQueue}
              permissions={permissions}
              updatingTaskId={updatingTaskId}
              onValidate={(task) => setReasonTask({ task, action: 'validate' })}
              onRefuse={(task) => setReasonTask({ task, action: 'refuse' })}
              onTaskHistory={(task) => setHistoryTask(task)}
            />
          )}

          <HousekeepingToolbar
            view={view}
            onViewChange={setView}
            search={search}
            onSearchChange={setSearch}
            floors={floors}
            floorFilter={floorFilter}
            onFloorFilterChange={setFloorFilter}
            agents={agents}
            agentFilter={agentFilter}
            onAgentFilterChange={setAgentFilter}
            statutFilter={statutFilter}
            onStatutFilterChange={setStatutFilter}
          />

          {view === 'chambres' ? (
            <HousekeepingRoomsView
              groupedByFloor={groupedByFloor}
              taskByRoomId={taskByRoomId}
              maintenanceByRoomId={maintenanceByRoomId}
              hasWrite={hasWrite}
              disabled={updatingTaskId !== null}
              onRoomClick={(room) => setSelectedRoom(room)}
              onCreateTask={(room) => setCreateRoom(room)}
            />
          ) : (
            <HousekeepingTasksView
              tasks={filteredTasks}
              maintenanceByRoomId={maintenanceByRoomId}
              permissions={permissions}
              updatingTaskId={updatingTaskId}
              onAssign={(task) => setAssignTask(task)}
              onStart={handleStart}
              onComplete={handleComplete}
              onValidate={(task) => setReasonTask({ task, action: 'validate' })}
              onRefuse={(task) => setReasonTask({ task, action: 'refuse' })}
              onCancel={(task) => setReasonTask({ task, action: 'cancel' })}
              onReopen={(task) => setReasonTask({ task, action: 'reopen' })}
              onTaskHistory={(task) => setHistoryTask(task)}
            />
          )}
        </>
      )}

      <RoomContextModal
        room={selectedRoom}
        rooms={rooms}
        permissions={permissions ?? null}
        onClose={() => setSelectedRoom(null)}
        onNavigate={() => setSelectedRoom(null)}
        onRoomsChanged={() => void loadData('status-update')}
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
        roomNumero={historyTask?.room.numero ?? null}
        onClose={() => setHistoryTask(null)}
      />

      <HousekeepingIncidentDialog
        open={incidentDialogOpen}
        rooms={rooms}
        onClose={() => {
          setIncidentDialogOpen(false);
          setIncidentError(null);
        }}
        onConfirm={handleIncidentConfirm}
        submitting={incidentSubmitting}
      />
      {incidentError && (
        <p className="text-destructive text-sm" role="alert">
          {incidentError}
        </p>
      )}
    </div>
  );
}
