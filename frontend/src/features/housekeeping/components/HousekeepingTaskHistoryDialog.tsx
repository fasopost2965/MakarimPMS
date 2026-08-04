import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { getHousekeepingTaskHistory } from '../api';
import type { HousekeepingTaskHistoryEntry } from '../types';

interface Props {
  taskId: number | null;
  roomNumero: string | null;
  onClose: () => void;
}

const TASK_STATUT_LABEL: Record<string, string> = {
  A_FAIRE: 'À faire',
  AFFECTEE: 'Affectée',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

export function HousekeepingTaskHistoryDialog({
  taskId,
  roomNumero,
  onClose,
}: Props) {
  const [entries, setEntries] = useState<HousekeepingTaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const requestSequence = useRef(0);

  const loadHistory = useCallback(
    async (targetPage: number) => {
      if (taskId === null) return;

      const requestId = ++requestSequence.current;
      setLoading(true);
      setError(null);
      try {
        const { data, meta } = await getHousekeepingTaskHistory(taskId, {
          page: targetPage,
          limit: 25,
        });
        if (requestId === requestSequence.current) {
          setEntries(data);
          setPage(meta.page);
          setTotalPages(meta.totalPages);
        }
      } catch (err) {
        if (requestId === requestSequence.current) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
        }
      } finally {
        if (requestId === requestSequence.current) setLoading(false);
      }
    },
    [taskId],
  );

  useEffect(() => {
    if (taskId === null) {
      requestSequence.current += 1;
      return;
    }

    const timer = setTimeout(() => {
      void loadHistory(1);
    }, 0);

    return () => {
      clearTimeout(timer);
      requestSequence.current += 1;
    };
  }, [loadHistory, taskId]);

  function handleClose() {
    requestSequence.current += 1;
    setEntries([]);
    setError(null);
    setLoading(false);
    setPage(1);
    setTotalPages(1);
    onClose();
  }

  return (
    <Dialog
      open={taskId !== null}
      onOpenChange={(next) => !next && handleClose()}
    >
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Historique de la tâche — chambre {roomNumero}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <p className="text-muted-foreground text-sm" role="status">
            Chargement de l’historique…
          </p>
        )}
        {!loading && error && (
          <ErrorState
            title="Impossible de charger l’historique"
            description={error}
            onRetry={() => void loadHistory(page)}
          />
        )}
        {!loading && !error && entries.length === 0 && (
          <EmptyState
            title="Aucun historique"
            description="Aucun historique n'est enregistré pour cette tâche."
          />
        )}
        {!loading && !error && entries.length > 0 && (
          <div className="grid gap-4">
            <ol
              className="grid gap-2"
              aria-label="Chronologie des statuts de la tâche"
            >
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-md border p-3 text-sm">
                  <p>
                    {entry.ancienStatut
                      ? `${TASK_STATUT_LABEL[entry.ancienStatut]} → `
                      : ''}
                    <span className="font-medium">
                      {TASK_STATUT_LABEL[entry.nouveauStatut]}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {new Date(entry.createdAt).toLocaleString('fr-FR')}
                    {entry.user && ` par ${entry.user.nom}`}
                    {entry.motif ? ` — ${entry.motif}` : ''}
                  </p>
                </li>
              ))}
            </ol>

            {(page > 1 || page < totalPages) && (
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => void loadHistory(page - 1)}
                >
                  Précédent
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} sur {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => void loadHistory(page + 1)}
                >
                  Suivant
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
