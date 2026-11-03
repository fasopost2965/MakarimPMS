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
  // Erreur serveur de l'action en cours : affichée DANS la fenêtre, jamais
  // derrière elle (la fenêtre modale masque le reste de la page).
  actionError?: string | null;
  // Raison pour laquelle l'action est impossible pour cet utilisateur : le
  // bouton est désactivé et la raison est affichée (au lieu d'un refus serveur).
  blockedReason?: string | null;
}

export function HousekeepingReasonDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  submitting,
  actionError,
  blockedReason,
}: Props) {
  const [motif, setMotif] = useState('');

  const isValid = motif.trim().length >= 10 && !blockedReason;

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
          {blockedReason && (
            <p role="alert" className="text-sm font-medium text-amber-700">
              {blockedReason}
            </p>
          )}
          {actionError && (
            <p role="alert" className="text-destructive text-sm font-medium">
              {actionError}
            </p>
          )}
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
