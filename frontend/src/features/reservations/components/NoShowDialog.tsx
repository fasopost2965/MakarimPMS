import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Reservation } from '../types';

interface Props {
  reservation: Reservation | null;
  motif: string;
  setMotif: (value: string) => void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

// DESIGN-007 — branche POST /reservations/:id/no-show (mission §7),
// jusqu'ici sans aucun point d'entrée UI malgré un backend fonctionnel.
// Même contrat que CancelDialog (motif ≥ 10 caractères obligatoire,
// reservations:delete côté RBAC — voir ReservationContextPanel).
export function NoShowDialog({
  reservation,
  motif,
  setMotif,
  submitting,
  error,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog
      open={reservation !== null}
      onOpenChange={(open) => !open && !submitting && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marquer non-présentation (no-show)</DialogTitle>
        </DialogHeader>
        <Alert
          tone="warning"
          title="Action irréversible"
          description={
            reservation
              ? `${reservation.guest.nom} ${reservation.guest.prenom} · chambre ${reservation.room.numero}`
              : undefined
          }
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="no-show-motif">Motif</Label>
          <Input
            id="no-show-motif"
            value={motif}
            onChange={(event) => setMotif(event.target.value)}
            minLength={10}
            required
            disabled={submitting}
          />
          <p className="text-muted-foreground text-xs">
            10 caractères minimum.
          </p>
        </div>
        {error && (
          <Alert
            tone="destructive"
            title="Opération impossible"
            description={error}
          />
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={onClose}
          >
            Fermer
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={submitting || motif.trim().length < 10}
            onClick={onConfirm}
          >
            {submitting ? 'Enregistrement…' : 'Confirmer le no-show'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
