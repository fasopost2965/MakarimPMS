import { Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MaintenanceTicket } from '../../maintenance/types';
import type { HousekeepingTask } from '../types';
import {
  ORIGINE_LABEL,
  TASK_STATUT_BADGE_VARIANT,
  TASK_STATUT_LABEL,
  formatTime,
} from '../utils/labels';
import { HousekeepingTaskActions } from './HousekeepingTaskActions';

interface Props {
  tasks: HousekeepingTask[];
  maintenanceByRoomId: Map<number, MaintenanceTicket>;
  permissions?: string[] | null;
  updatingTaskId: number | null;
  onAssign: (task: HousekeepingTask) => void;
  onStart: (task: HousekeepingTask) => void;
  onComplete: (task: HousekeepingTask) => void;
  onValidate: (task: HousekeepingTask) => void;
  onRefuse: (task: HousekeepingTask) => void;
  onCancel: (task: HousekeepingTask) => void;
  onReopen: (task: HousekeepingTask) => void;
  onTaskHistory: (task: HousekeepingTask) => void;
}

// DESIGN-008 — table dense reprise du prototype PrototypeHousekeepingA,
// mais avec de vraies actions RBAC-gated (HousekeepingTaskActions) au lieu
// des boutons désactivés du prototype (celui-ci n'appelait jamais aucune
// mutation par construction — voir son commentaire d'isolation).
export function HousekeepingTasksView({
  tasks,
  maintenanceByRoomId,
  permissions,
  updatingTaskId,
  onAssign,
  onStart,
  onComplete,
  onValidate,
  onRefuse,
  onCancel,
  onReopen,
  onTaskHistory,
}: Props) {
  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="bg-muted/60 text-muted-foreground border-b text-[11px] font-bold tracking-wide uppercase">
            <th className="px-3 py-2 text-left">Chambre</th>
            <th className="px-3 py-2 text-left">Étage</th>
            <th className="px-3 py-2 text-left">Origine</th>
            <th className="px-3 py-2 text-left">Statut</th>
            <th className="px-3 py-2 text-left">Agent</th>
            <th className="px-3 py-2 text-left">Affectée</th>
            <th className="px-3 py-2 text-left">Démarrée</th>
            <th className="px-3 py-2 text-left">Terminée</th>
            <th className="px-3 py-2 text-left">Maintenance</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const maintenance = maintenanceByRoomId.get(task.roomId);
            const disabled = updatingTaskId === task.id;
            return (
              <tr key={task.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-bold">{task.room.numero}</td>
                <td className="text-muted-foreground px-3 py-2">
                  {task.room.etage}
                </td>
                <td className="text-muted-foreground px-3 py-2">
                  {ORIGINE_LABEL[task.origine]}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={TASK_STATUT_BADGE_VARIANT[task.statut]}>
                    {TASK_STATUT_LABEL[task.statut]}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {task.assignedUser?.nom ?? (
                    <span className="text-muted-foreground">Non affecté</span>
                  )}
                </td>
                <td className="text-muted-foreground px-3 py-2">
                  {formatTime(task.assignedAt)}
                </td>
                <td className="text-muted-foreground px-3 py-2">
                  {formatTime(task.startedAt)}
                </td>
                <td className="text-muted-foreground px-3 py-2">
                  {formatTime(task.completedAt)}
                </td>
                <td className="px-3 py-2">
                  {maintenance ? (
                    <span className="text-destructive flex items-center gap-1 text-xs font-medium">
                      <Wrench className="size-3" />
                      Bloquant
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <HousekeepingTaskActions
                    task={task}
                    permissions={permissions}
                    disabled={disabled}
                    onAssign={() => onAssign(task)}
                    onStart={() => onStart(task)}
                    onComplete={() => onComplete(task)}
                    onValidate={() => onValidate(task)}
                    onRefuse={() => onRefuse(task)}
                    onCancel={() => onCancel(task)}
                    onReopen={() => onReopen(task)}
                    onTaskHistory={() => onTaskHistory(task)}
                    hideControlActions
                  />
                </td>
              </tr>
            );
          })}
          {tasks.length === 0 && (
            <tr>
              <td
                colSpan={10}
                className="text-muted-foreground px-3 py-10 text-center"
              >
                Aucune tâche ne correspond aux filtres.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
