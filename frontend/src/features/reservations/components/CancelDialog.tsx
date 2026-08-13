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
  cancelling: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

// DESIGN-007 — extrait tel quel de l'ancien ReservationsCalendarPage.tsx
// (aucun changement de logique) pour être réutilisable depuis Liste,
// Planning et ReservationContextPanel sans le dupliquer trois fois.
export function CancelDialog({
  reservation,
  motif,
  setMotif,
  cancelling,
  error,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog
      open={reservation !== null}
      onOpenChange={(open) => !open && !cancelling && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler la réservation</DialogTitle>
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
          <Label htmlFor="cancel-motif">Motif de l’annulation</Label>
          <Input
            id="cancel-motif"
            value={motif}
            onChange={(event) => setMotif(event.target.value)}
            minLength={10}
            required
            disabled={cancelling}
          />
          <p className="text-muted-foreground text-xs">
            10 caractères minimum.
          </p>
        </div>
        {error && (
          <Alert
            tone="destructive"
            title="Annulation impossible"
            description={error}
          />
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={cancelling}
            onClick={onClose}
          >
            Fermer
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={cancelling || motif.trim().length < 10}
            onClick={onConfirm}
          >
            {cancelling ? 'Annulation…' : 'Confirmer l’annulation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
