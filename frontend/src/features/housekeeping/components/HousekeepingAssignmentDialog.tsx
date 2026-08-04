import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { listAssignableUsers } from '../api';
import type { AssignableUser, HousekeepingTask } from '../types';

interface Props {
  task: HousekeepingTask | null;
  onClose: () => void;
  onConfirm: (
    taskId: number,
    assignedUserId: number | null,
    motif?: string,
  ) => void;
  submitting: boolean;
  actionError: string | null;
}

export function HousekeepingAssignmentDialog({
  task,
  onClose,
  onConfirm,
  submitting,
  actionError,
}: Props) {
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<
    number | null | 'unassigned'
  >(null);
  const [motif, setMotif] = useState('');
  const requestSequence = useRef(0);

  const loadUsers = useCallback(async () => {
    if (!task) return;
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const data = await listAssignableUsers();
      if (requestId === requestSequence.current) {
        setUsers(data);
      }
    } catch (err) {
      if (requestId === requestSequence.current) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [task]);

  useEffect(() => {
    if (!task) {
      requestSequence.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsers([]);
      setError(null);
      setLoading(false);
      setSelectedUserId(null);
      setMotif('');
      return;
    }

    setSelectedUserId(task.assignedUserId ?? 'unassigned');
    setMotif('');
    void loadUsers();

    return () => {
      requestSequence.current += 1;
    };
  }, [loadUsers, task]);

  const isReassignment =
    task?.assignedUserId != null &&
    selectedUserId !== task.assignedUserId &&
    selectedUserId !== 'unassigned';
  const isUnassignment =
    task?.assignedUserId != null && selectedUserId === 'unassigned';
  const requiresMotif = isReassignment || isUnassignment;

  const isValidMotif = motif.trim().length >= 10;

  let isValid = false;
  if (selectedUserId !== null) {
    if (requiresMotif) {
      isValid = isValidMotif;
    } else {
      isValid = true;
    }
  }

  function handleConfirm() {
    if (!isValid || !task || selectedUserId === null) return;
    onConfirm(
      task.id,
      selectedUserId === 'unassigned' ? null : selectedUserId,
      requiresMotif ? motif.trim() : undefined,
    );
  }

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) {
      onClose();
    }
  }

  return (
    <Dialog open={task !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {task?.assignedUserId
              ? 'Modifier l’affectation'
              : 'Affecter la tâche'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground text-sm" role="status">
            Chargement des utilisateurs…
          </p>
        ) : error ? (
          <ErrorState
            title="Impossible de charger les utilisateurs"
            description={error}
            onRetry={() => void loadUsers()}
          />
        ) : users.length === 0 ? (
          <EmptyState
            title="Aucun utilisateur disponible"
            description="Aucun utilisateur ne peut être affecté à cette tâche."
          />
        ) : (
          <div className="grid gap-4 py-4">
            {actionError && (
              <div className="text-sm font-medium text-destructive">
                {actionError}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="assign-user">Assignataire</Label>
              <Select
                value={selectedUserId === null ? '' : String(selectedUserId)}
                onValueChange={(val) =>
                  setSelectedUserId(
                    val === 'unassigned' ? 'unassigned' : Number(val),
                  )
                }
                disabled={submitting}
              >
                <SelectTrigger id="assign-user">
                  <SelectValue placeholder="Sélectionner un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">-- Non assigné --</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {requiresMotif && (
              <div className="grid gap-2">
                <Label htmlFor="assign-reason">
                  Motif (minimum 10 caractères)
                </Label>
                <Input
                  id="assign-reason"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  disabled={submitting}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              !isValid ||
              submitting ||
              loading ||
              error !== null ||
              users.length === 0
            }
          >
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
