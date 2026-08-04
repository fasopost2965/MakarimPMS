import { useState } from 'react';
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
import type { Room } from '../../reservations/types';

interface Props {
  room: Room | null;
  onClose: () => void;
  onConfirm: (roomId: number, motif: string) => void;
  submitting: boolean;
}

export function HousekeepingTaskCreateDialog({
  room,
  onClose,
  onConfirm,
  submitting,
}: Props) {
  const [motif, setMotif] = useState('');

  const isValid = motif.trim().length >= 10;

  function handleConfirm() {
    if (!isValid || !room) return;
    onConfirm(room.id, motif.trim());
  }

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) {
      setMotif('');
      onClose();
    }
  }

  return (
    <Dialog open={room !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer une tâche de ménage</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Chambre</Label>
            <Input value={room ? room.numero : ''} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-reason">Motif (minimum 10 caractères)</Label>
            <Input
              id="create-reason"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || submitting}>
            Créer la tâche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
