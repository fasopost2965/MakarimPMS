import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getRoomStatusHistory,
  listHousekeepingTasks,
  getHousekeepingTaskHistory,
} from '../../../housekeeping/api';
import { listTickets } from '../../../maintenance/api';
import type { Room } from '../../../reservations/types';
import { AccessDenied } from './AccessDenied';
import { STATUT_CHAMBRE_LABEL } from './mode';

interface Props {
  room: Room;
  permissions: string[] | null;
}

type Source = 'room' | 'housekeeping' | 'maintenance';

interface Entry {
  key: string;
  date: string;
  source: Source;
  label: string;
  detail?: string | null;
}

const SOURCE_BADGE: Record<
  Source,
  { label: string; variant: 'outline' | 'violet' | 'warning' }
> = {
  room: { label: 'Statut chambre', variant: 'outline' },
  housekeeping: { label: 'Housekeeping', variant: 'violet' },
  maintenance: { label: 'Maintenance', variant: 'warning' },
};

// Même convention que RoomHistoryDialog/HousekeepingTaskHistoryDialog
// existants : userId seul n'est jamais transformé en nom (aucune jointure
// utilisateur exposée par ces endpoints) — jamais d'acteur inventé.
const TASK_STATUT_LABEL: Record<string, string> = {
  A_FAIRE: 'À faire',
  AFFECTEE: 'Affectée',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

async function loadRoomStatusEntries(roomId: number): Promise<Entry[]> {
  const data = await getRoomStatusHistory(roomId);
  return data.map((entry) => ({
    key: `room-${entry.id}`,
    date: entry.createdAt,
    source: 'room' as const,
    label: `${STATUT_CHAMBRE_LABEL[entry.ancienStatut]} → ${STATUT_CHAMBRE_LABEL[entry.nouveauStatut]}`,
    detail: entry.motif,
  }));
}

// DESIGN-006 (mission §9) — "la tâche Housekeeping pertinente" est DERIVED
// comme la plus récente tâche de la chambre (active ou non), faute d'une
// notion de "tâche pertinente" définie ailleurs dans le PMS — ne prétend
// jamais reconstituer l'historique des séjours clôturés (Discovery Phase 1
// §9, hors périmètre, NEEDS BACKEND).
async function loadHousekeepingEntries(roomId: number): Promise<Entry[]> {
  const { data: tasks } = await listHousekeepingTasks({
    roomId,
    limit: 1,
  });
  const latest = tasks[0];
  if (!latest) return [];
  const { data: logs } = await getHousekeepingTaskHistory(latest.id, {
    limit: 100,
  });
  return logs.map((log) => ({
    key: `hk-${log.id}`,
    date: log.createdAt,
    source: 'housekeeping' as const,
    label: log.ancienStatut
      ? `${TASK_STATUT_LABEL[log.ancienStatut] ?? log.ancienStatut} → ${TASK_STATUT_LABEL[log.nouveauStatut] ?? log.nouveauStatut}`
      : (TASK_STATUT_LABEL[log.nouveauStatut] ?? log.nouveauStatut),
    detail: log.motif,
  }));
}

async function loadMaintenanceEntries(roomId: number): Promise<Entry[]> {
  const tickets = await listTickets({ roomId });
  const entries: Entry[] = [];
  for (const ticket of tickets) {
    entries.push({
      key: `mnt-open-${ticket.id}`,
      date: ticket.createdAt,
      source: 'maintenance',
      label: `Ticket ouvert — ${ticket.typePanne}`,
      detail: null,
    });
    if (ticket.resoluAt) {
      entries.push({
        key: `mnt-resolved-${ticket.id}`,
        date: ticket.resoluAt,
        source: 'maintenance',
        label: `Ticket résolu — ${ticket.typePanne}`,
        detail: null,
      });
    }
  }
  return entries;
}

// DESIGN-006 (mission §9) — fusion chronologique de trois sources REAL,
// chacune tolérante à l'échec des autres (une source en erreur n'empêche
// jamais l'affichage des deux autres, mission §9 "si une source échoue").
export function RoomHistoryPanel({ room, permissions }: Props) {
  const can = (permission: string) =>
    permissions?.includes(permission) ?? false;
  const canHousekeeping = can('housekeeping:read');
  const canMaintenance = can('maintenance:read');

  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failedSources, setFailedSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);

    const jobs: { source: Source; run: () => Promise<Entry[]> }[] = [];
    if (canHousekeeping) {
      jobs.push({ source: 'room', run: () => loadRoomStatusEntries(room.id) });
      jobs.push({
        source: 'housekeeping',
        run: () => loadHousekeepingEntries(room.id),
      });
    }
    if (canMaintenance) {
      jobs.push({
        source: 'maintenance',
        run: () => loadMaintenanceEntries(room.id),
      });
    }

    const results = await Promise.allSettled(jobs.map((job) => job.run()));
    if (requestId !== requestSequence.current) return;

    const collected: Entry[] = [];
    const failed: Source[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        collected.push(...result.value);
      } else {
        failed.push(jobs[index].source);
      }
    });
    collected.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    setEntries(collected);
    setFailedSources(failed);
    setLoading(false);
  }, [room.id, canHousekeeping, canMaintenance]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      requestSequence.current += 1;
    };
  }, [load]);

  if (!canHousekeeping && !canMaintenance) return <AccessDenied />;

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {failedSources.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {failedSources.includes('room') &&
            'Historique des statuts de la chambre indisponible. '}
          {failedSources.includes('housekeeping') &&
            'Historique Housekeeping indisponible. '}
          {failedSources.includes('maintenance') &&
            'Historique Maintenance indisponible.'}
        </p>
      )}
      {entries && entries.length > 0 ? (
        <ol className="grid gap-2" aria-label="Historique de la chambre">
          {entries.map((entry) => (
            <li key={entry.key} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={SOURCE_BADGE[entry.source].variant}>
                  {SOURCE_BADGE[entry.source].label}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {new Date(entry.date).toLocaleString('fr-FR')}
                </span>
              </div>
              <p className="mt-1">{entry.label}</p>
              {entry.detail && (
                <p className="text-muted-foreground text-xs">{entry.detail}</p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="Aucun historique"
          description="Aucun événement n'est enregistré pour cette chambre."
        />
      )}
      <p className="text-muted-foreground text-[11px]">
        Ne couvre pas l'historique des séjours clôturés (non disponible
        aujourd'hui).
      </p>
    </div>
  );
}
