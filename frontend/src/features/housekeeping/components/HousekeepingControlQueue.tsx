import { ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { HousekeepingTask } from '../types';
import { formatTime } from '../utils/labels';
import { HousekeepingTaskActions } from './HousekeepingTaskActions';

interface Props {
  tasks: HousekeepingTask[];
  permissions?: string[] | null;
  updatingTaskId: number | null;
  onValidate: (task: HousekeepingTask) => void;
  onRefuse: (task: HousekeepingTask) => void;
  onTaskHistory: (task: HousekeepingTask) => void;
}

const noop = () => {};

// DESIGN-008 — bandeau « Contrôle gouvernante » repris du prototype
// PrototypeHousekeepingA : toujours visible dès qu'une tâche TERMINEE
// existe (jamais caché derrière un clic), quelle que soit la vue active
// (mission §8 du prototype). Réutilise HousekeepingTaskActions — statut
// des tâches ici toujours TERMINEE, donc seuls Valider/Refuser [control]
// et Historique [read] peuvent s'afficher.
export function HousekeepingControlQueue({
  tasks,
  permissions,
  updatingTaskId,
  onValidate,
  onRefuse,
  onTaskHistory,
}: Props) {
  if (tasks.length === 0) return null;

  return (
    <Card className="border-warning/40 bg-warning-soft/40">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-warning size-4" />
          <h2 className="text-sm font-bold">
            Contrôle gouvernante — {tasks.length}{' '}
            {tasks.length > 1 ? 'chambres' : 'chambre'} en attente
          </h2>
        </div>
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold">Chambre {task.room.numero}</span>
                <span className="text-muted-foreground">
                  Agent : {task.assignedUser?.nom ?? 'Aucun agent affecté'}
                </span>
                <span className="text-muted-foreground">
                  Terminée à {formatTime(task.completedAt)}
                </span>
              </div>
              <HousekeepingTaskActions
                task={task}
                permissions={permissions}
                disabled={updatingTaskId === task.id}
                onAssign={noop}
                onStart={noop}
                onComplete={noop}
                onValidate={() => onValidate(task)}
                onRefuse={() => onRefuse(task)}
                onCancel={noop}
                onReopen={noop}
                onTaskHistory={() => onTaskHistory(task)}
                historyLabel="Historique"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
