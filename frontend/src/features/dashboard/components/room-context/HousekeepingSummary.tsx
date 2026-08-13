import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { listHousekeepingTasks } from '../../../housekeeping/api';
import type { HousekeepingTask } from '../../../housekeeping/types';
import type { Room } from '../../../reservations/types';
import { AccessDenied } from './AccessDenied';

interface Props {
  room: Room;
  permissions: string[] | null;
  onNavigate: () => void;
}

const TASK_STATUT_LABEL: Record<string, string> = {
  A_FAIRE: 'À faire',
  AFFECTEE: 'Affectée',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

// Fallback défensif : le frontend ne connaît que CHECKOUT/MANUELLE/REPRISE
// (housekeeping/types.ts), le backend a depuis ajouté CHANGE_ROOM (GL-002).
// Plutôt que d'afficher "undefined" pour une valeur réelle mais non
// modélisée côté type, on retombe sur la chaîne brute reçue de l'API.
const ORIGINE_LABEL: Record<string, string> = {
  CHECKOUT: 'Check-out',
  MANUELLE: 'Manuelle',
  REPRISE: 'Reprise',
  CHANGE_ROOM: 'Changement de chambre',
};

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('fr-FR') : null;
}

// DESIGN-006 (mission §7) — au plus une HousekeepingTask active par
// chambre (activeRoomKey unique en base), voir Discovery Phase 1 §6.
export function HousekeepingSummary({ room, permissions, onNavigate }: Props) {
  const can = (permission: string) =>
    permissions?.includes(permission) ?? false;

  const [task, setTask] = useState<HousekeepingTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const { data } = await listHousekeepingTasks({
        roomId: room.id,
        active: true,
        limit: 1,
      });
      if (requestId !== requestSequence.current) return;
      setTask(data[0] ?? null);
    } catch (err) {
      if (requestId === requestSequence.current) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [room.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      requestSequence.current += 1;
    };
  }, [load]);

  if (!can('housekeeping:read')) return <AccessDenied />;

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Impossible de charger la tâche de ménage"
        description={error}
        onRetry={() => void load()}
      />
    );
  }

  if (!task) {
    return (
      <EmptyState
        title="Cette chambre a changé d'état depuis le dernier rafraîchissement."
        description="Aucune tâche de ménage active n'est plus enregistrée pour cette chambre."
        action={{ label: 'Rafraîchir', onClick: () => void load() }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={task.statut === 'EN_COURS' ? 'violet' : 'warning'}>
          {TASK_STATUT_LABEL[task.statut] ?? task.statut}
        </Badge>
        <Badge variant="outline">
          {ORIGINE_LABEL[task.origine] ?? task.origine}
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        {task.assignedUser
          ? `Affectée à ${task.assignedUser.nom}`
          : 'Aucun agent affecté'}
      </p>
      {formatDate(task.assignedAt) && (
        <p className="text-muted-foreground text-sm">
          Affectée le {formatDate(task.assignedAt)}
        </p>
      )}
      {formatDate(task.startedAt) && (
        <p className="text-muted-foreground text-sm">
          Démarrée le {formatDate(task.startedAt)}
        </p>
      )}
      {formatDate(task.completedAt) && (
        <p className="text-muted-foreground text-sm">
          Terminée le {formatDate(task.completedAt)}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="mt-1 self-start"
        onClick={onNavigate}
      >
        Voir Housekeeping
      </Button>
    </div>
  );
}
