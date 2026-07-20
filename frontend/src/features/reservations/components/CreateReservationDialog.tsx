import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GuestPicker } from "@/features/guests/components/GuestPicker";
import type { GuestSelection } from "@/features/guests/components/GuestPicker";
import type { Room } from "../types";

export interface CreateReservationSelection {
  room: Room;
  dateArrivee: string;
  dateDepart: string;
}

interface Props {
  selection: CreateReservationSelection | null;
  onClose: () => void;
  onConfirm: (input: GuestSelection) => void;
  submitting: boolean;
  error: string | null;
}

export function CreateReservationDialog({
  selection,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props) {
  const open = selection !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {selection && (
          // Clé = remonte le formulaire (champs vides) à chaque nouvelle
          // sélection, sans passer par un effect pour resynchroniser l'état.
          <ReservationForm
            key={`${selection.room.id}-${selection.dateArrivee}-${selection.dateDepart}`}
            selection={selection}
            onClose={onClose}
            onConfirm={onConfirm}
            submitting={submitting}
            error={error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReservationForm({
  selection,
  onClose,
  onConfirm,
  submitting,
  error,
}: Props & { selection: CreateReservationSelection }) {
  const [guestSelection, setGuestSelection] = useState<GuestSelection | null>(
    null,
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouvelle réservation</DialogTitle>
      </DialogHeader>

      <p className="text-muted-foreground text-sm">
        Chambre {selection.room.numero} ({selection.room.roomType.nom}) — du{" "}
        {selection.dateArrivee} au {selection.dateDepart}
      </p>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!guestSelection) return;
          onConfirm(guestSelection);
        }}
      >
        <GuestPicker onChange={setGuestSelection} />

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting || !guestSelection}>
            {submitting ? "Création…" : "Créer la réservation"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
