import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: (motif: string) => void;
  submitting: boolean;
}

export function HousekeepingReasonDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  submitting,
}: Props) {
  const [motif, setMotif] = useState('');

  const isValid = motif.trim().length >= 10;

  function handleConfirm() {
    if (!isValid) return;
    onConfirm(motif.trim());
  }

  function handleOpenChange(next: boolean) {
    if (!next && !submitting) {
      setMotif('');
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">Motif (minimum 10 caractères)</Label>
            <Input
              id="reason"
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
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
